#!/usr/bin/env node
/**
 * enrich-spec.mjs — CLI-обёртка Проверяльщика спек (Компонент A спеки 040).
 *
 * Склеивает 11 фаз spec-enrich в один прогон:
 *   Фазы 0, 1, 4  — детерминированное ядро .project/scripts/validate-spec.mjs.
 *                   Логика score / 15 проверок / traceability НЕ дублируется:
 *                   CLI только вызывает ядро и читает его JSON-отчёт.
 *   Фазы 2, 3, 5–10 — внешний LLM-раннер по инструкции
 *                   docs/spec-chain/skills/spec-enrich/SKILL.md; каждый вызов
 *                   пишется в лог прогона {phase, runner, prompt_hash,
 *                   timestamp, status}.
 *
 * Дефекты спеки 041 (S1, S2, S3, S5, S6), которые закрывает этот слой:
 *   S1 — reconcile-контракт: CLI снимает SHA-256 файла спеки до/после каждой
 *        edits-фазы (2, 3, 5, 9), считает diff hunks и синтезирует
 *        `applied_edits[]` для run-log.jsonl. JSON `edits[]` модели имеет
 *        приоритет; read-only фазы (6, 7, 8, 10) — нативный JSON как есть.
 *        Intent-guard (Цель / Критерии приёмки) работает и через diff.
 *   S2 — Windows spawn: шимы .cmd/.bat/.ps1 резолвятся через `where` и
 *        запускаются через `cmd.exe /d /s /c`; `shell: true` запрещён.
 *   S3 — URL validation: после Фазы 2 каждый URL проверяется HEAD-запросом
 *        (Node fetch, timeout 5 с) → ok / warn (403) / dead (4xx/5xx/DNS);
 *        мёртвый URL помечается маркером `…|unverified` + finding medium
 *        (phase 3-factcheck), правка не откатывается.
 *   S5 — `DEEPSEEK_API_KEY`: env → User-scope Windows → проброс в childEnv.
 *   S6 — resolveSpec ищет спеку в .project/specs/, затем в .project/drafts/.
 *
 * usage:
 *   npm run spec:enrich -- <spec> [--dry-run] [--out <dir>] [--json]
 *                              [--llm-cmd <cmd>] [--max-iterations <n>]
 *
 * <spec> — путь (.project/specs/040-spec-chain.md) или id (040).
 * По умолчанию каталог прогона: .project/drafts/spec-<NNN>-enrich/.
 *
 * spec 051 (Autonomous Spec Chain, минимальный): после Фазы 10 считается решение
 * STOP-точки A — score ≥ 85% от weightSum ∧ hard-fail = 0 ∧ exit 0 → auto-approve
 * (лог `auto-approve STOP A | score:N | hard-fail:0` + строка `auto-decision` в
 * `.project/DECISIONS.md`); иначе STOP-точка A остаётся ручной, как была.
 *
 * exit 0 — прогон завершён (в т.ч. с WARN [llm: unavailable — ...]);
 * exit 1 — hard-fail (детерминированные фазы или external audit Фазы 10);
 * exit 2 — ошибка использования/чтения.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EXIT_CLEAN = 0;
const EXIT_HARD_FAIL = 1;
const EXIT_USAGE = 2;

const VALIDATE_REL = '.project/scripts/validate-spec.mjs';
const SKILL_REL = 'docs/spec-chain/skills/spec-enrich/SKILL.md';
const DEFAULT_LLM_CMD = 'dsh --profile headless';
const DEFAULT_MAX_ITERATIONS = 3;
const HARD_MAX_ITERATIONS = 3; // SKILL.md, Фаза 9: жёсткий лимит 3 итерации
const DEFAULT_THRESHOLD = 70;
const LLM_TIMEOUT_MS = Number(process.env.SPEC_ENRICH_LLM_TIMEOUT_MS || 600000);
const MAX_BUFFER = 64 * 1024 * 1024;
/** S3: timeout HEAD-проверки URL (спека 041). */
const URL_TIMEOUT_MS = Number(process.env.SPEC_ENRICH_URL_TIMEOUT_MS || 5000);

/* ----------------------------------------- STOP A: auto-approve (spec 051) */

/**
 * Порог auto-approve STOP A (spec 051): score ≥ 85 **% от weightSum** И ноль
 * hard-fail findings И `exit 0`. Ниже — STOP-точка A остаётся ручной, как была.
 */
const AUTO_APPROVE_SCORE = 85;

/** Журнал решений (append-only, правило 8 — существующие записи не правятся). */
const DECISIONS_REL = '.project/DECISIONS.md';

/** Заголовок секции auto-решений: создаётся один раз при первой записи. */
const AUTO_DECISIONS_HEADING = '## Auto-decisions (spec 051)';

/**
 * Решение STOP A по формату spec 051: auto-approve при score ≥ 85% и нуле
 * hard-fail. Лог-строка успеха — `auto-approve STOP A | score:N | hard-fail:0`.
 * Побочных эффектов нет.
 * @param {{exitCode: number, score: number, scoreMax: number, hardFailCount: number}} input
 */
export function resolveStopA(input) {
  const scoreMax = Number(input.scoreMax) || 0;
  const score = Number(input.score) || 0;
  const scorePercent = scoreMax > 0 ? Math.round((score / scoreMax) * 100) : 0;
  const hardFailCount = Number(input.hardFailCount) || 0;
  const clean = input.exitCode === EXIT_CLEAN;
  const auto = clean && scorePercent >= AUTO_APPROVE_SCORE && hardFailCount === 0;
  return {
    auto,
    threshold: AUTO_APPROVE_SCORE,
    score,
    scoreMax,
    scorePercent,
    hardFailCount,
    log: `auto-approve STOP A | score:${score} | hard-fail:${hardFailCount}`,
    reason: auto
      ? `score ${score}/${scoreMax} (${scorePercent}%) ≥ ${AUTO_APPROVE_SCORE}% и hard-fail 0`
      : !clean
        ? `exit ${input.exitCode} ≠ 0`
        : hardFailCount > 0
          ? `hard-fail ${hardFailCount} > 0`
          : `score ${score}/${scoreMax} (${scorePercent}%) < ${AUTO_APPROVE_SCORE}%`,
  };
}

/** Строка auto-решения: `DATE | auto-decision | STOP | spec-ID | reason:<условия>`. */
export function formatAutoDecision(entry) {
  return `${entry.date} | auto-decision | ${entry.stop} | spec-${entry.specId} | reason:${entry.reason}`;
}

/** Считать hard-fail findings прогона (severity = hard-fail). */
export function countHardFails(findings) {
  return (Array.isArray(findings) ? findings : []).filter(
    (finding) => String(finding?.severity ?? '').toLowerCase() === 'hard-fail',
  ).length;
}

/**
 * Дописать auto-решение в конец `.project/DECISIONS.md` (append-only, LF). Секция
 * `## Auto-decisions (spec 051)` добавляется один раз; строка решения остаётся
 * машиночитаемой (`|`-формат spec 051). Записи журнала не переписываются.
 * @returns {{file: string, line: string, created: boolean}}
 */
export function appendAutoDecision(root, entry) {
  const file = path.join(root, DECISIONS_REL);
  let current = '';
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch {
    current = '';
  }
  const line = formatAutoDecision(entry);
  const hasSection = current.includes(AUTO_DECISIONS_HEADING);
  const glue = current === '' || current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  const addition = hasSection ? `${line}\n` : `${glue}${AUTO_DECISIONS_HEADING}\n\n${line}\n`;
  fs.appendFileSync(file, addition, 'utf8');
  return { file, line, created: !hasSection };
}
/** S3: проба доступности сети — отличает «мёртвый URL» от «сети нет» (env-override для QC). */
const CONNECTIVITY_PROBE_URL = process.env.SPEC_ENRICH_CONNECTIVITY_URL || 'https://example.com/';
/** S5: переменная окружения, которую ждёт дочерний dsh (спека 035). */
const API_KEY_VAR = 'DEEPSEEK_API_KEY';
const API_KEY_SCOPE = 'User';
const API_KEY_EXPORT_HINT = `$env:${API_KEY_VAR} = [Environment]::GetEnvironmentVariable('${API_KEY_VAR}','${API_KEY_SCOPE}')`;
/** S6: корни поиска спеки — specs имеет приоритет над drafts. */
const SPEC_ROOTS = ['.project/specs', '.project/drafts'];

/* --------------------------------------------------------- 11 фаз */

const PHASES = [
  { n: 0, name: 'Baseline score', kind: 'deterministic', key: '0-baseline' },
  { n: 1, name: '15 механических проверок', kind: 'deterministic', key: '1-mechanical' },
  { n: 2, name: 'Research + enrichment', kind: 'llm', key: '2-research', edits: true, artifact: 'phase-2-sources.md' },
  { n: 3, name: 'Fact-check против репозитория', kind: 'llm', key: '3-factcheck', edits: true, artifact: 'phase-3-factcheck.md' },
  { n: 4, name: 'Traceability', kind: 'deterministic', key: '4-traceability' },
  { n: 5, name: 'Семантика', kind: 'llm', key: '5-semantics', edits: true, artifact: 'phase-5-semantics.md' },
  { n: 6, name: 'Adversarial', kind: 'llm', key: '6-adversarial', edits: false, artifact: 'phase-6-adversarial.md' },
  { n: 7, name: 'Simulation', kind: 'llm', key: '7-simulation', edits: false, artifact: 'phase-7-simulation.md' },
  { n: 8, name: 'Regeneration test', kind: 'llm', key: '8-regeneration', edits: false, artifact: 'phase-8-regeneration.md' },
  { n: 9, name: 'Repair loop', kind: 'llm', key: '9-repair', edits: true, artifact: 'repair-log.jsonl' },
  { n: 10, name: 'External audit', kind: 'llm', key: '10-external-audit', edits: false, artifact: 'phase-10-audit.md' },
];

const LLM_PHASE_KEYS = PHASES.filter((p) => p.kind === 'llm').map((p) => p.key);

/* --------------------------------------------------------- утилиты */

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

/** Относительный POSIX-путь от корня репозитория. */
function toRel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function posixJoin(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/{2,}/g, '/');
}

function appendJsonl(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(obj)}\n`, 'utf8');
}

/** Первый JSON-объект из вывода раннера. */
function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isBlank(s) {
  return String(s || '').trim() === '';
}

function say(line = '') {
  process.stdout.write(`${line}\n`);
}

function err(line = '') {
  process.stderr.write(`${line}\n`);
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* ----------------------------------------------------- корень и резолв */

function resolveRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  if (path.basename(path.dirname(here)) === '.project') return path.resolve(here, '..', '..');
  return process.cwd();
}

const ROOT = resolveRoot();
const VALIDATE_ABS = path.join(ROOT, VALIDATE_REL);
const SKILL_ABS = path.join(ROOT, SKILL_REL);

/* --------------------------------------- Telegram-уведомления (spec 042/T2) */

/** Ядро уведомлений (spec 042/T1). */
const NOTIFY_SCRIPT = path.join(ROOT, '.project', 'scripts', 'notify.mjs');

/**
 * Fire-and-forget Telegram-уведомление (spec 042/T2). Никогда не бросает, не
 * блокирует родителя, ничего не пишет в stdout парсеров и не влияет на
 * exit-код: дочерний процесс detached + unref, его вывод не читается
 * (`stdio: 'ignore'`). Сбой Telegram не ломает прогон обогащения.
 */
function notifyFireAndForget(event, message) {
  try {
    const child = spawn(process.execPath, [NOTIFY_SCRIPT, message, '--event', event], {
      cwd: ROOT,
      stdio: 'ignore',
      windowsHide: true,
      detached: true,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* уведомление не должно ломать прогон */
  }
}

/** Спека по пути или по id: сначала .project/specs/, затем .project/drafts/ (S6). */
function resolveSpec(spec) {
  if (!spec) return null;
  const direct = path.resolve(ROOT, spec);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const want = spec.toLowerCase().replace(/\.md$/, '');
  for (const root of SPEC_ROOTS) {
    const dir = path.join(ROOT, root);
    if (!fs.existsSync(dir)) continue;
    const names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort();
    const exact = names.find((n) => n.toLowerCase().replace(/\.md$/, '') === want);
    if (exact) return path.join(dir, exact);
    const byId = names.find((n) => n.toLowerCase().split('-')[0] === want);
    if (byId) return path.join(dir, byId);
  }
  return null;
}

/** Идентификатор спеки: frontmatter id → номер из имени файла → 'unknown'. */
function specIdOf(text, specAbs) {
  const m = /^---[\s\S]*?^id:\s*(.+)$/m.exec(String(text || ''));
  if (m && m[1].trim()) return m[1].trim().replace(/^["']|["']$/g, '');
  const base = path.basename(specAbs);
  const num = /^(\d+[a-z]?)/.exec(base);
  return num ? num[1] : 'unknown';
}

/* --------------------------------------------------------- аргументы */

function parseArgs(argv) {
  const opts = { positional: [], dryRun: false, out: null, json: false, llmCmd: null, maxIterations: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--out') { opts.out = argv[i + 1] || null; i += 1; }
    else if (a === '--llm-cmd') { opts.llmCmd = argv[i + 1] || null; i += 1; }
    else if (a === '--max-iterations') { opts.maxIterations = Number(argv[i + 1]); i += 1; }
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts.positional.push(a);
  }
  return opts;
}

const USAGE = [
  'usage: npm run spec:enrich -- <spec> [--dry-run] [--out <dir>] [--json] [--llm-cmd <cmd>] [--max-iterations <n>]',
  '',
  'Проверяльщик спек (Компонент A спеки 040): 11 фаз spec-enrich.',
  '  Фазы 0, 1, 4  — детерминированное ядро .project/scripts/validate-spec.mjs;',
  '  Фазы 2, 3, 5–10 — внешний LLM-раннер по инструкции',
  '                  docs/spec-chain/skills/spec-enrich/SKILL.md.',
  '',
  'Аргументы:',
  '  <spec>               путь к спеке (.project/specs/040-spec-chain.md) или её id (040)',
  '  --dry-run            показать 11 фаз и baseline score, ничего не писать и не править',
  '  --out <dir>          каталог прогона (по умолчанию .project/drafts/spec-<NNN>-enrich/)',
  '  --json               машиночитаемая сводка в stdout (человекочитаемый вывод подавляется)',
  `  --llm-cmd <cmd>      команда LLM-раннера (по умолчанию: ${DEFAULT_LLM_CMD})`,
  `  --max-iterations <n> итераций repair loop, жёсткий лимит ${HARD_MAX_ITERATIONS} (по умолчанию ${DEFAULT_MAX_ITERATIONS})`,
  '  --help               эта справка',
  '',
  'Гарантии конвейера:',
  '  • секции «## Цель» и «## Критерии приёмки» не правятся — такие правки',
  '    отклоняются структурно (skip/WARN), дефект m11/m13 требует отдельного решения;',
  '    в headless защита работает и через diff файла спеки (S1);',
  '  • reconcile-контракт (S1): SHA-256 спеки снимается до/после каждой edits-фазы',
  '    (2, 3, 5, 9); при пустом `edits[]` правки восстанавливаются из diff,',
  '    `applied_edits[]` пишется в run-log.jsonl; JSON `edits[]` имеет приоритет;',
  '  • URL из Фазы 2 проверяются HEAD-запросом (timeout 5 с): dead → маркер',
  '    `[enriched: URL|tier|дата|unverified]` + finding medium (phase 3-factcheck),',
  '    правка НЕ откатывается, раздел «URL validation» в report.md (S3);',
  '  • Windows-шимы раннера резолвятся через `where` и запускаются через',
  '    `cmd.exe /d /s /c` без `shell: true` (S2);',
  `  • ${API_KEY_VAR} берётся из env, затем из User-scope Windows (S5);`,
  '  • <spec> ищется в .project/specs/, затем в .project/drafts/ (S6);',
  '  • если Фаза 2 отдала sources без маркера `[enriched: URL|tier|дата]`,',
  '    CLI вставляет маркер в «## Источники» сам (или понижает Фазу 2 до warn).',
  '',
  `Каталог прогона по умолчанию: .project/drafts/spec-<NNN>-enrich/ (артефакты фаз,`,
  'prompts/ с промпт-паками, run-log.jsonl с записями LLM-вызовов, report.md).',
  '',
  'Таблица exit-кодов по классам отказа:',
  '  exit 0  чисто / WARN: прогон завершён, правки применены; недоступность LLM-раннера',
  '          (WARN [llm: unavailable — ...], status=skipped), отклонение правки структурной',
  '          защитой intent (intent-protected), STOP (oscillation) — тоже exit 0;',
  '  exit 0  --dry-run без hard-fail: показаны 11 фаз и baseline score, ничего не записано;',
  '  exit 1  STOP: hard-fail детерминированных фаз 0/1/4 (сироты traceability, нечитаемый',
  '          frontmatter m01 с severity hard-fail) — правки не применяются; одинаково',
  '          для --dry-run и apply;',
  '  exit 1  hard-fail Фазы 10 (INTENT-CHANGED) — правки Фазы 9 откатаны (rollback);',
  '  exit 2  ошибка окружения/использования: нет <spec>, спека/скилл/ядро недоступны или',
  '          не читаются, ядро вернуло не-JSON — ничего не записывается.',
].join('\n');

/* ------------------------------------------ детерминированное ядро (0/1/4) */

function runValidate(specAbs) {
  const res = spawnSync(process.execPath, [VALIDATE_ABS, specAbs, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
  if (res.error) return { error: `ядро validate-spec.mjs недоступно: ${res.error.message}` };
  const out = String(res.stdout || '');
  const json = extractJson(out);
  if (!json) {
    const tail = String(res.stderr || '').trim().split('\n').filter(Boolean).slice(-1)[0] || 'нет вывода';
    return { error: `validate-spec.mjs не вернул JSON (exit ${res.status}): ${tail}` };
  }
  return { json, exitCode: res.status === null ? EXIT_USAGE : res.status };
}

/* ------------------------------------------- инструкции фаз из SKILL.md */

function loadSkillSections() {
  const text = readText(SKILL_ABS);
  if (text === null) return null;
  const lines = text.split('\n');
  const map = new Map();
  let cur = null;
  let buf = [];
  const flush = () => {
    if (cur !== null) map.set(cur, buf.join('\n').trim());
    buf = [];
  };
  for (const line of lines) {
    const m = /^### Фаза (\d+) — (.+?)\s*$/.exec(line);
    if (m) {
      flush();
      cur = Number(m[1]);
      continue;
    }
    if (/^#{1,3} /.test(line)) {
      flush();
      cur = null;
      continue;
    }
    if (cur !== null) buf.push(line);
  }
  flush();
  return map.size ? map : null;
}

/* -------------------------------------------------------- промпт-пак */

const RESPONSE_CONTRACT = [
  'Ответ — ровно один JSON-объект в stdout (без markdown-обёртки):',
  '{',
  '  "phase": "<PHASE_KEY>",',
  '  "status": "ok" | "warn" | "skipped" | "error",',
  '  "model": "<идентификатор модели раннера>",',
  '  "summary": "<одна строка>",',
  '  "sources":      [{"url","tier","date","claim"}],                                  // Фаза 2',
  '  "findings":     [{"id","severity","confidence","location","evidence","requiredFix"}], // Фазы 6, 7, 8',
  '  "edits":        [{"find":"<точная подстрока спеки>","replace":"<новый текст>","reason":"..."}], // только Фазы 2, 3, 5, 9 (опционально)',
  '  "reason_per_hunk": ["<почему применён hunk 1>", "..."],                            // только Фазы 2, 3, 5, 9',
  '  "coverage":     0.0,                                                              // Фаза 8',
  '  "verdict":      "INTENT-PRESERVED" | "INTENT-CHANGED"                             // Фаза 10',
  '}',
  '',
  'Reconcile-контракт (S1): разрешены ОБА способа правки — нативные',
  'Write/Edit файла спеки по SPEC_PATH либо JSON `edits[]`. CLI снимает',
  'SHA-256 файла до и после фазы и сам синтезирует `applied_edits[]`: если',
  '`edits[]` непусто, оно применяется и имеет приоритет над diff; если',
  '`edits[]` пусто, правки восстанавливаются из diff файла. `reason_per_hunk`',
  'сопоставляется с hunks по порядку (нужен для трассируемости diff-правок).',
].join('\n');

function buildPrompt({ phase, specRel, specId, specText, section, extra, iteration }) {
  const head = [
    `# spec-enrich · LLM-фаза ${phase.n} — ${phase.name}`,
    '',
    `PHASE_KEY: ${phase.key}`,
    `SPEC_PATH: ${specRel}`,
    `SPEC_ID: ${specId}`,
    `RUNNER: ${DEFAULT_LLM_CMD} (переопределяется флагом --llm-cmd)`,
    iteration ? `REPAIR_ITERATION: ${iteration} из ${HARD_MAX_ITERATIONS}` : null,
    '',
    `## Инструкция фазы (источник: ${SKILL_REL})`,
    '',
    section || `(секция «### Фаза ${phase.n} — ${phase.name}» не найдена в ${SKILL_REL})`,
    '',
    '## Контракт ответа',
    '',
    RESPONSE_CONTRACT,
    phase.edits
      ? 'Правки спеки разрешены. Можно править файл спеки нативными инструментами (Write/Edit) — CLI снимет diff и построит `applied_edits[]`; либо вернуть `edits[]` (литеральная замена `find` → `replace`, `find` обязан встречаться в тексте спеки ровно один раз) — тогда приоритет у `edits[]`. Правки в секциях «## Цель» и «## Критерии приёмки» запрещены: такие правки откатываются, и фаза получает warn.'
      : 'Правки спеки запрещены (фаза read-only): файл спеки не меняй, поле "edits" верни пустым.',
  ];
  if (extra) head.push('', '## Контекст прогона', '', extra);
  head.push('', '## Текст спеки', '', '<<<SPEC', specText, 'SPEC>>>', '');
  return head.filter((x) => x !== null).join('\n');
}

/* ----------------------------------------------- S5: DEEPSEEK_API_KEY ---- */

/**
 * Прочитать DEEPSEEK_API_KEY из User-scope (только Windows) через PowerShell —
 * копия поведения `.project/scripts/run-spec.mjs` (спека 035, alert 2026-09-30).
 * Аргументы передаются массивом, без shell-интерполяции. Любая ошибка или
 * таймаут → `{ key: null }` (прогон не блокируется, пишется WARN).
 * @returns {{key: string|null}}
 */
function resolveApiKeyFromSystem() {
  if (process.platform !== 'win32') return { key: null };
  try {
    const res = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', `[Environment]::GetEnvironmentVariable('${API_KEY_VAR}','${API_KEY_SCOPE}')`],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    );
    const raw = (res.stdout ?? '').trim();
    if (res.status === 0 && raw !== '') return { key: raw };
  } catch {
    /* fall through: ключ считается отсутствующим */
  }
  return { key: null };
}

/**
 * Нормализовать результат чтения ключа: `{ key, source }`, где
 * `source: 'env' | 'user-scope' | 'missing'` (env имеет приоритет).
 * @param {{key: string|null|undefined}} [entry] - результат resolveApiKeyFromSystem().
 * @returns {{key: string|null, source: 'env'|'user-scope'|'missing'}}
 */
function resolveApiKey(entry) {
  const envKey = process.env[API_KEY_VAR];
  if (typeof envKey === 'string' && envKey.trim() !== '') return { key: envKey.trim(), source: 'env' };
  const raw = typeof entry?.key === 'string' ? entry.key.trim() : '';
  if (raw !== '') return { key: raw, source: 'user-scope' };
  return { key: null, source: 'missing' };
}

/* -------------------------------------------------- S2: Windows spawn ---- */

/** Кэш `where`-резолва: команда раннера не меняется между фазами. */
const WHERE_CACHE = new Map();
const WINDOWS_WRAPPER_RE = /\.(cmd|bat|ps1)$/i;

/**
 * Разбор строки команды раннера на токены без shell: пробелы вне двойных
 * кавычек разделяют, `"..."` склеивает (нужно для путей с пробелами, напр.
 * `node C:\Users\First Last\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\lib\bin.js`).
 */
function splitCommandLine(text) {
  const src = String(text);
  const out = [];
  let cur = '';
  let quoted = false;
  let started = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted && ch === '\\' && i + 1 < src.length && src[i + 1] === '"') {
      cur += '"';
      i += 1;
      started = true;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      started = true;
      continue;
    }
    if (!quoted && /\s/.test(ch)) {
      if (started) out.push(cur);
      cur = '';
      started = false;
      continue;
    }
    cur += ch;
    started = true;
  }
  if (started) out.push(cur);
  return out;
}

/** `where <name>` — путь(и) к исполняемому файлу; аргумент передаётся массивом, shell не используется. */
function whereLookup(name) {
  if (WHERE_CACHE.has(name)) return WHERE_CACHE.get(name);
  let found = [];
  try {
    const res = spawnSync('where', [name], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (!res.error && res.status === 0) {
      found = String(res.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    found = [];
  }
  WHERE_CACHE.set(name, found);
  return found;
}

/**
 * S2: полный путь к Windows-шиму (.cmd/.bat/.ps1).
 * Голое `dsh` на Windows — это шим `dsh.cmd`: `spawnSync('dsh')` даёт ENOENT,
 * а прямой `spawnSync('dsh.cmd')` — EINVAL (Node ≥ 18 запрещает запуск
 * .cmd/.bat без shell). Поэтому имя резолвится через `where`.
 * @returns {string|null}
 */
function resolveWindowsWrapper(token) {
  const looksLikePath = /[\\/]/.test(token) || /^[a-zA-Z]:/.test(token);
  if (looksLikePath) return WINDOWS_WRAPPER_RE.test(token) && fs.existsSync(token) ? token : null;
  const found = whereLookup(token);
  return found.find((p) => /\.cmd$/i.test(p))
    || found.find((p) => /\.bat$/i.test(p))
    || found.find((p) => /\.ps1$/i.test(p))
    || null;
}

/** Экранирование одного аргумента в payload для `cmd.exe /d /s /c` (внутри кавычек спецсимволы `&|<>^` не исполняются). */
function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * S2: собрать инвокацию раннера.
 *  • `node bin.js` (и любой .exe/.com) — прямой spawn, как было;
 *  • `.cmd`/`.bat` — `cmd.exe /d /s /c "<полный путь>" <args> "<prompt>"`
 *    (payload передаётся verbatim: путь пользователя содержит пробелы,
 *    `cmd /s` снимает внешнюю пару кавычек — ровно один уровень вложенности);
 *  • `.ps1` — `powershell.exe -File` (cmd.exe не исполняет .ps1);
 *  • `where` не нашёл шима — fallback на прежнее поведение + resolved: false.
 * `shell: true` не используется нигде (shell-injection risk через --llm-cmd).
 * @param {string} llmCmd - строка команды (напр. `dsh --profile headless`).
 * @param {string|null} promptAbs - путь к промпт-паку или null (preview/dry-run).
 */
function buildRunnerInvocation(llmCmd, promptAbs) {
  const parts = splitCommandLine(llmCmd);
  if (!parts.length) return { ok: false, reason: 'пустая команда раннера' };
  const [cmd, ...args] = parts;
  const tail = promptAbs ? [promptAbs] : [];
  const direct = (extra) => ({
    ok: true,
    command: cmd,
    argv: [...args, ...tail],
    windowsVerbatimArguments: false,
    via: 'direct',
    exe: cmd,
    resolved: true,
    note: null,
    ...extra,
  });
  if (process.platform !== 'win32') return direct();
  if (/\.(exe|com)$/i.test(cmd)) return direct();
  const wrapper = resolveWindowsWrapper(cmd);
  if (wrapper === null) {
    const resolved = whereLookup(cmd).some((p) => /\.(exe|com)$/i.test(p)) || fs.existsSync(cmd);
    return direct({
      resolved,
      note: resolved
        ? null
        : `\`where ${cmd}\` не нашёл .cmd/.bat/.ps1 — fallback на прямой запуск; попробуйте --llm-cmd`,
    });
  }
  if (/\.ps1$/i.test(wrapper)) {
    return {
      ok: true,
      command: 'powershell.exe',
      argv: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, ...args, ...tail],
      windowsVerbatimArguments: false,
      via: 'powershell-file',
      exe: wrapper,
      resolved: true,
      note: 'cmd.exe не исполняет .ps1 — запуск через powershell -File',
    };
  }
  const payload = `"${[wrapper, ...args, ...tail].map(quoteCmdArg).join(' ')}"`;
  return {
    ok: true,
    command: 'cmd.exe',
    argv: ['/d', '/s', '/c', payload],
    windowsVerbatimArguments: true,
    via: 'cmd-wrapper',
    exe: wrapper,
    resolved: true,
    note: null,
  };
}

/** Человекочитаемое описание резолва раннера (для --dry-run и stdout). */
function describeRunner(inv) {
  if (!inv || inv.ok !== true) return `не разрешён (${inv ? inv.reason : 'нет данных'})`;
  const resolved = inv.resolved === false ? ', resolved: false' : '';
  if (inv.via === 'cmd-wrapper') return `cmd.exe /d /s /c ${inv.argv[3]} (via: cmd-wrapper${resolved})`;
  return `${[inv.command, ...inv.argv].join(' ')} (via: ${inv.via}${resolved})`;
}

/* --------------------------------------------------------------- раннер */

function invokeRunner(llmCmd, promptAbs, apiKey) {
  const inv = buildRunnerInvocation(llmCmd, promptAbs);
  if (inv.ok !== true) return { ok: false, reason: inv.reason };
  // S5: harness-процесс не наследует User-scope переменные — ключ пробрасываем явно.
  const childEnv = { ...process.env };
  if (apiKey && apiKey.source === 'user-scope' && apiKey.key) childEnv[API_KEY_VAR] = apiKey.key;
  const meta = { via: inv.via, resolved: inv.resolved, note: inv.note || null, runnerCommand: inv.command, runnerExe: inv.exe };
  const res = spawnSync(inv.command, inv.argv, {
    cwd: ROOT,
    env: childEnv,
    encoding: 'utf8',
    timeout: LLM_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
    windowsVerbatimArguments: inv.windowsVerbatimArguments === true,
  });
  if (res.error) {
    const reason = res.error.code === 'ENOENT'
      ? `раннер не найден: ${inv.exe}${inv.note ? ` (${inv.note})` : ''}`
      : `раннер не запустился: ${res.error.message}`;
    return { ok: false, reason, ...meta };
  }
  if (res.status !== 0) {
    const tail = String(res.stderr || '').trim().split('\n').filter(Boolean).slice(-1)[0] || 'без сообщения';
    return { ok: false, reason: `раннер завершился с кодом ${res.status}: ${tail}`, ...meta };
  }
  const json = extractJson(res.stdout);
  if (!json) return { ok: false, reason: 'раннер не вернул JSON-объект', ...meta };
  return { ok: true, result: json, ...meta };
}

/**
 * Один вызов LLM-фазы: промпт-пак → раннер → запись в лог прогона.
 * Промпт-пак пишется ВСЕГДА, в том числе когда раннер недоступен.
 */
function callLlmPhase(ctx, phase, opts = {}) {
  const { specRel, specId, specText, runDirAbs, runDirRel, llmCmd, logAbs, skill } = ctx;
  const { extra, iteration } = opts;
  const section = skill.get(phase.n) || '';
  const prompt = buildPrompt({ phase, specRel, specId, specText, section, extra, iteration });
  const name = iteration ? `phase-${phase.key}.iter${iteration}.prompt.md` : `phase-${phase.key}.prompt.md`;
  const promptRel = posixJoin(runDirRel, 'prompts', name);
  const promptAbs = path.join(runDirAbs, 'prompts', name);
  writeText(promptAbs, prompt);
  const promptHash = `sha256:${sha256(prompt)}`;

  const entry = {
    phase: phase.key,
    runner: llmCmd,
    model: null,
    prompt_hash: promptHash,
    timestamp: nowIso(),
    status: 'ok',
    iteration: iteration || 1,
    prompt: promptRel,
    api_key_source: ctx.apiKey ? ctx.apiKey.source : 'missing',
  };

  const inv = invokeRunner(llmCmd, promptAbs, ctx.apiKey);
  if (inv.ok !== true) {
    entry.status = 'skipped';
    entry.reason = inv.reason;
    entry.runner_resolved = inv.resolved !== false;
    if (inv.via) entry.runner_via = inv.via;
    return { ok: false, unavailable: true, status: 'skipped', reason: inv.reason, promptRel, promptHash, entry, result: null };
  }
  entry.runner_resolved = inv.resolved !== false;
  if (inv.via) entry.runner_via = inv.via;
  if (inv.note) entry.runner_note = inv.note;

  const result = inv.result;
  entry.model = result.model || null;
  entry.status = result.status === 'error' ? 'error'
    : result.status === 'skipped' ? 'skipped'
      : result.status === 'warn' ? 'warn' : 'ok';
  if (result.summary) entry.summary = String(result.summary);
  return { ok: true, status: entry.status, model: entry.model, result, promptRel, promptHash, entry };
}

/**
 * Фиксация вызова фазы: патч статуса/полей → запись в run-log → артефакт фазы →
 * строка в stdout. Разделение call/commit сделано затем, чтобы статус фазы
 * учитывал пост-обработку ответа (структурная защита intent — F2, гарантия
 * маркера `[enriched: ...]` — F3), а не только `status` от раннера.
 */
function commitLlmPhase(ctx, phase, res, patch = {}) {
  const { runDirAbs, runDirRel, logAbs } = ctx;
  const entry = res.entry || {};
  if (patch.status) entry.status = patch.status;
  if (patch.fields) Object.assign(entry, patch.fields);
  if (res.ok) {
    const artifactRel = posixJoin(runDirRel, phase.artifact);
    if (phase.artifact !== 'repair-log.jsonl') {
      writeText(path.join(runDirAbs, phase.artifact), renderPhaseArtifact(phase, res.result || {}, entry));
      entry.artifacts = [artifactRel];
    }
  }
  appendJsonl(logAbs, entry);
  if (!res.ok) {
    say(`  Фаза ${phase.n} — ${phase.name}: WARN [llm: unavailable — ${res.reason}]`);
  } else {
    say(`  Фаза ${phase.n} — ${phase.name}: ${entry.status}${entry.model ? ` (model: ${entry.model})` : ''}`);
  }
  return entry;
}

/** Markdown-артефакт фазы из ответа раннера. */
function renderPhaseArtifact(phase, result, entry) {
  const lines = [
    `# Фаза ${phase.n} — ${phase.name}`,
    '',
    `- фаза: \`${phase.key}\``,
    `- статус: \`${entry.status}\``,
    `- runner: \`${entry.runner}\``,
    `- model: \`${entry.model || '—'}\``,
    `- prompt_hash: \`${entry.prompt_hash}\``,
    `- timestamp: ${entry.timestamp}`,
    `- prompt: \`${entry.prompt}\``,
    '',
    `Итог: ${result.summary || '—'}`,
    '',
  ];
  if (Array.isArray(result.sources) && result.sources.length) {
    lines.push('## Tiered sources', '', '| URL | Tier | Дата | Тезис |', '|---|---|---|---|');
    for (const s of result.sources) lines.push(`| ${s.url || '—'} | ${s.tier || '—'} | ${s.date || '—'} | ${s.claim || '—'} |`);
    lines.push('');
  }
  if (Array.isArray(result.findings) && result.findings.length) {
    lines.push('## Findings', '', '| id | severity | confidence | location | evidence | requiredFix |', '|---|---|---|---|---|---|');
    for (const f of result.findings) {
      lines.push(`| ${f.id || '—'} | ${f.severity || '—'} | ${f.confidence ?? '—'} | ${f.location || '—'} | ${f.evidence || '—'} | ${f.requiredFix || '—'} |`);
    }
    lines.push('');
  }
  if (result.coverage !== undefined) lines.push(`Coverage: ${result.coverage}`, '');
  if (result.verdict) lines.push(`Вердикт: **${result.verdict}**`, '');
  if (Array.isArray(result.edits) && result.edits.length) {
    lines.push('## Предложенные правки', '');
    for (const e of result.edits) lines.push(`- \`${e.find}\` → \`${e.replace}\` — ${e.reason || ''}`);
    lines.push('');
  }
  if (Array.isArray(entry.intent_blocked) && entry.intent_blocked.length) {
    lines.push('## Отклонено структурной защитой intent (F2)', '');
    for (const b of entry.intent_blocked) {
      lines.push(`- секция «${b.section}» (стр. ${b.line}): \`${b.find}\` — правка НЕ применена; дефект класса m11/m13 требует отдельного решения`);
    }
    lines.push('');
  }
  if (entry.enriched_injected) {
    lines.push(`Гарантия F3: маркер вставлен CLI в секцию «Источники» — \`${entry.enriched_marker}\``, '');
  } else if (entry.enriched_guarantee) {
    lines.push(`Гарантия F3: ${entry.enriched_guarantee}${entry.enriched_reason ? ` — ${entry.enriched_reason}` : ''}`, '');
  }
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------ правки */

/**
 * Литеральная замена: `find` обязан встречаться ровно один раз.
 * Ничего не применяется «похоже» — только точное совпадение.
 */
function applyEdits(text, edits, phaseKey) {
  let out = String(text);
  const applied = [];
  const skipped = [];
  for (const e of Array.isArray(edits) ? edits : []) {
    const find = String(e && e.find !== undefined ? e.find : '');
    const replace = String(e && e.replace !== undefined ? e.replace : '');
    if (!find) {
      skipped.push({ phase: phaseKey, reason: 'пустой `find`', edit: e });
      continue;
    }
    const first = out.indexOf(find);
    if (first === -1) {
      skipped.push({ phase: phaseKey, reason: '`find` не найден в тексте спеки', find });
      continue;
    }
    if (out.indexOf(find, first + find.length) !== -1) {
      skipped.push({ phase: phaseKey, reason: '`find` встречается больше одного раза', find });
      continue;
    }
    out = out.slice(0, first) + replace + out.slice(first + find.length);
    applied.push({ phase: phaseKey, find, replace, reason: (e && e.reason) || '' });
  }
  return { text: out, applied, skipped };
}

/** Severity-фильтр для правила oscillation Фазы 9. */
function hasBlockingFindings(findings) {
  return findings.some((f) => ['hard-fail', 'high', 'blocker'].includes(String(f.severity || '').toLowerCase()));
}

/* --------------------- структурная защита intent (находка F2) ------------ */

/**
 * Секции, которые НЕ правит конвейер: «Цель» и «Критерии приёмки».
 * Правило было только текстом промпта Фазы 9; теперь оно проверяется в коде
 * ДО применения каждой правки: `find`, пересекающий такую секцию, отклоняется
 * структурно (skip), а дефект класса m11/m13 помечается как требующий
 * отдельного решения — без hard-fail всего прогона.
 */
const INTENT_SECTION_RES = [
  { name: 'Цель', re: /^##\s+Цель(?![\p{L}\p{N}_])/u },
  { name: 'Критерии приёмки', re: /^##\s+Критерии\s+при[её]мки(?![\p{L}\p{N}_])/u },
];

/** Смещения начала каждой строки + конец текста. */
function lineOffsets(lines) {
  const offs = [];
  let pos = 0;
  for (const l of lines) {
    offs.push(pos);
    pos += l.length + 1;
  }
  offs.push(pos);
  return offs;
}

/** Диапазоны защищённых секций в символах текста. */
function intentRanges(text) {
  const lines = String(text).split('\n');
  const offs = lineOffsets(lines);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const hit = INTENT_SECTION_RES.find((s) => s.re.test(lines[i]));
    if (!hit) continue;
    let j = i + 1;
    while (j < lines.length && !/^#{1,2} /.test(lines[j])) j += 1;
    out.push({ name: hit.name, start: offs[i], end: offs[j], startLine: i + 1, endLine: j });
  }
  return out;
}

/** Номер строки по символьному смещению. */
function lineAt(text, pos) {
  return String(text).slice(0, Math.max(0, pos)).split('\n').length;
}

/**
 * Разделение правок раннера на допустимые и отклонённые структурно.
 * Правка отклоняется, если её `find` пересекает секцию intent.
 */
function splitIntentEdits(text, edits) {
  const ranges = intentRanges(text);
  const allowed = [];
  const blocked = [];
  for (const e of Array.isArray(edits) ? edits : []) {
    const find = String(e && e.find !== undefined ? e.find : '');
    if (!find) {
      allowed.push(e);
      continue;
    }
    const pos = String(text).indexOf(find);
    if (pos === -1) {
      allowed.push(e);
      continue;
    }
    const end = pos + find.length;
    const hit = ranges.find((r) => pos < r.end && end > r.start);
    if (hit) {
      blocked.push({
        section: hit.name,
        find,
        replace: String(e && e.replace !== undefined ? e.replace : ''),
        reason: (e && e.reason) || '',
        line: lineAt(text, pos),
      });
    } else {
      allowed.push(e);
    }
  }
  return { allowed, blocked };
}

/* ------------------ S1: reconcile правок по diff (спека 041) -------------- */

/**
 * Line-diff (LCS) между текстом спеки до и после edits-фазы.
 * Возвращает hunk'и: непрерывные блоки удалений/вставок между общими строками.
 * @returns {Array<{index:number,beforeStart:number,afterStart:number,beforeLines:string[],afterLines:string[]}>}
 */
function diffLineHunks(beforeText, afterText) {
  const a = String(beforeText).split('\n');
  const b = String(afterText).split('\n');
  const n = a.length;
  const m = b.length;
  if (n * m > 25_000_000) {
    // Защита от квадратичной памяти на аномально больших текстах: один hunk на весь файл.
    return [{ index: 1, beforeStart: 1, afterStart: 1, beforeLines: a, afterLines: b, whole: true }];
  }
  const W = m + 1;
  const dp = new Int32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * W + j] = a[i] === b[j]
        ? dp[(i + 1) * W + (j + 1)] + 1
        : Math.max(dp[(i + 1) * W + j], dp[i * W + (j + 1)]);
    }
  }
  const hunks = [];
  let cur = null;
  let lastEqA = -1;
  let lastEqB = -1;
  let i = 0;
  let j = 0;
  const open = () => {
    if (cur === null) {
      cur = { index: hunks.length + 1, beforeStart: lastEqA + 2, afterStart: lastEqB + 2, beforeLines: [], afterLines: [] };
    }
    return cur;
  };
  const flush = () => {
    if (cur !== null) {
      hunks.push(cur);
      cur = null;
    }
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush();
      lastEqA = i;
      lastEqB = j;
      i += 1;
      j += 1;
      continue;
    }
    const h = open();
    if (dp[(i + 1) * W + j] >= dp[i * W + (j + 1)]) {
      h.beforeLines.push(a[i]);
      i += 1;
    } else {
      h.afterLines.push(b[j]);
      j += 1;
    }
  }
  if (i < n || j < m) {
    const h = open();
    for (; i < n; i += 1) h.beforeLines.push(a[i]);
    for (; j < m; j += 1) h.afterLines.push(b[j]);
  }
  flush();
  return hunks;
}

/** Диапазон hunk'а в строках текста `before` (1-based); чистая вставка — пустой диапазон. */
function hunkLineRange(hunk) {
  const len = hunk.beforeLines.length;
  return { start: hunk.beforeStart, end: len ? hunk.beforeStart + len - 1 : hunk.beforeStart - 1 };
}

/** Пересекает ли hunk защищённую секцию intent (по номерам строк текста `before`). */
function hunkIntersectsIntent(hunk, ranges) {
  const len = hunk.beforeLines.length;
  return ranges.find((r) => (len === 0
    ? hunk.beforeStart > r.startLine && hunk.beforeStart <= r.endLine
    : hunk.beforeStart <= r.endLine && hunk.beforeStart + len - 1 >= r.startLine));
}

/**
 * Пересборка текста из hunk'ов: блоки из `blockedIdx` откатываются к строкам
 * `before` (intent-guard через diff), остальные применяются.
 */
function rebuildWithHunks(beforeText, hunks, blockedIdx) {
  const beforeLines = String(beforeText).split('\n');
  const out = [];
  let cursor = 0;
  for (const h of hunks) {
    const startIdx = Math.max(cursor, h.beforeStart - 1);
    if (startIdx > cursor) out.push(...beforeLines.slice(cursor, startIdx));
    if (blockedIdx.has(h.index)) out.push(...h.beforeLines);
    else out.push(...h.afterLines);
    cursor = startIdx + h.beforeLines.length;
  }
  out.push(...beforeLines.slice(cursor));
  return out.join('\n');
}

/**
 * S1 — reconcile правок edits-фазы (2, 3, 5, 9).
 * Приоритет способа правки:
 *   1) JSON `edits[]` модели — детерминированное применение через applyEdits;
 *   2) diff файла спеки (модель в headless правит спеку нативными Read/Write/Edit).
 * `reason_per_hunk` сопоставляется с hunks по порядку. Intent-guard работает в
 * обоих режимах: пересечение с «## Цель» / «## Критерии приёмки» → откат правки
 * (hunk), фаза получает warn, дефект класса m11/m13 идёт на отдельное решение.
 * @returns {{specText:string,source:string,applied:object[],skipped:object[],appliedEdits:object[],blocked:object[],declaredEdits:number,ignoredHunks:number}}
 */
function reconcilePhaseEdits({ phase, result, specText, fileText, shaBefore, shaAfter }) {
  const edits = Array.isArray(result && result.edits) ? result.edits : [];
  const reasons = Array.isArray(result && result.reason_per_hunk) ? result.reason_per_hunk.map((r) => String(r)) : [];
  const ranges = intentRanges(specText);
  const out = {
    specText,
    source: 'none',
    applied: [],
    skipped: [],
    appliedEdits: [],
    blocked: [],
    declaredEdits: edits.length,
    ignoredHunks: 0,
  };

  if (edits.length) {
    out.source = 'json-edits';
    const split = splitIntentEdits(specText, edits);
    out.blocked = split.blocked;
    const ap = applyEdits(specText, split.allowed, phase.key);
    out.specText = ap.text;
    out.applied = ap.applied;
    out.skipped = ap.skipped;
    out.appliedEdits = ap.applied.map((a, idx) => ({
      phase: phase.key,
      source: 'json-edits',
      find: a.find,
      replace: a.replace,
      reason: a.reason || reasons[idx] || '',
      sha_before: shaBefore,
      sha_after: shaAfter,
    }));
    // Diff тоже считаем: он фиксируется в run-log как проигнорированный (приоритет JSON edits[]).
    if (fileText !== null && fileText !== specText) out.ignoredHunks = diffLineHunks(specText, fileText).length;
    return out;
  }

  if (fileText === null || fileText === specText) return out;

  const hunks = diffLineHunks(specText, fileText);
  const blockedIdx = new Set();
  const kept = [];
  for (const h of hunks) {
    const range = hunkLineRange(h);
    const hit = hunkIntersectsIntent(h, ranges);
    if (hit) {
      blockedIdx.add(h.index);
      out.blocked.push({
        section: hit.name,
        find: h.beforeLines.join('\n') || '—',
        replace: h.afterLines.join('\n') || '—',
        reason: reasons[h.index - 1] || '',
        line: range.start,
        hunk: h.index,
        source: 'diff',
      });
      continue;
    }
    kept.push(h);
  }
  out.source = 'diff';
  out.specText = rebuildWithHunks(specText, hunks, blockedIdx);
  out.appliedEdits = kept.map((h) => {
    const range = hunkLineRange(h);
    return {
      phase: phase.key,
      source: 'diff',
      find: h.beforeLines.join('\n'),
      replace: h.afterLines.join('\n'),
      reason: reasons[h.index - 1] || '',
      line: range.start,
      end_line: range.end,
      hunk: h.index,
      sha_before: shaBefore,
      sha_after: shaAfter,
    };
  });
  out.applied = out.appliedEdits.map((a) => ({
    phase: phase.key,
    find: a.find || '—',
    replace: a.replace || '—',
    reason: a.reason,
    line: a.line,
    source: 'diff',
  }));
  return out;
}

/** Слить доп. поля в patch для commitLlmPhase, не затирая уже выставленные. */
function mergeFields(patch, fields) {
  patch.fields = { ...(patch.fields || {}), ...fields };
  return patch;
}

/* -------------------- гарантия маркера обогащения (находка F3) ----------- */

const ENRICHED_RE = /\[enriched:/i;

/**
 * Если Фаза 2 отдала tiered sources, но ни одна правка не вставила маркер
 * `[enriched: URL|tier|дата]`, CLI вставляет его сам в секцию «Источники».
 * Если это невозможно (нет секции или нет источника с URL) — состояние
 * `no-section`/`no-source`: Фаза 2 помечается warn и это фиксируется в отчёте
 * и run-log.
 */
function ensureEnrichedMarker(text, sources) {
  const src = String(text);
  if (ENRICHED_RE.test(src)) return { text: src, state: 'present' };
  const list = Array.isArray(sources) ? sources : [];
  const usable = list.find((s) => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url.trim()));
  if (!usable) return { text: src, state: 'no-source', reason: 'в ответе Фазы 2 нет источника с URL' };
  const lines = src.split('\n');
  let head = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^##\s+Источники(?![\p{L}\p{N}_])/u.test(lines[i])) {
      head = i;
      break;
    }
  }
  if (head === -1) return { text: src, state: 'no-section', reason: 'в спеке нет секции «## Источники»' };
  let end = head + 1;
  while (end < lines.length && !/^#{1,2} /.test(lines[end])) end += 1;
  let insertAt = end;
  while (insertAt - 1 > head && lines[insertAt - 1].trim() === '') insertAt -= 1;
  const tier = String(usable.tier || 'Tier 2').trim();
  const date = String(usable.date || new Date().toISOString().slice(0, 10)).trim();
  const claim = String(usable.claim || usable.url).trim();
  const marker = `[enriched: ${usable.url.trim()}|${tier}|${date}]`;
  const bullet = `- ${claim} ${marker}`;
  const next = [...lines.slice(0, insertAt), bullet, ...lines.slice(insertAt)];
  return { text: next.join('\n'), state: 'injected', marker, bullet, line: head + 1 };
}

/* ------------------------- S3: URL validation (спека 041) ----------------- */

/** Нормализовать URL-кандидат: только http(s), без хвостовой пунктуации и `|`-полей маркера. */
function cleanUrl(value) {
  const raw = String(value || '').trim().split('|')[0].replace(/[),;:.]+$/, '');
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const u = new URL(raw);
    return u.hostname ? raw : null;
  } catch {
    return null;
  }
}

/** Один запрос (HEAD или GET) с AbortController-таймаутом. */
async function probeOnce(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'enrich-spec-url-validator/1.0' },
    });
    if (method === 'GET' && res.body && typeof res.body.cancel === 'function') {
      try { await res.body.cancel(); } catch { /* тело не нужно */ }
    }
    return { status: res.status, error: null, code: null };
  } catch (e) {
    const cause = e && e.cause ? e.cause : null;
    const code = (cause && cause.code) || (e && e.code) || (e && e.name) || 'network-error';
    return { status: null, error: String(code), code: String(code) };
  } finally {
    clearTimeout(timer);
  }
}

/** Классификация HTTP-кода по спеке 041: 200/301/302 → ok, 403 → warn, остальные → dead. */
function classifyStatus(status, note) {
  const suffix = note ? ` (${note})` : '';
  if (status === 200 || status === 301 || status === 302) return { verdict: 'ok', status, code: `HTTP ${status}`, evidence: `HTTP ${status}${suffix}` };
  if (status === 403) return { verdict: 'warn', status, code: 'HTTP 403', evidence: `HTTP 403 — ресурс существует, но запрещает доступ${suffix}` };
  return { verdict: 'dead', status, code: `HTTP ${status}`, evidence: `HTTP ${status}${suffix}` };
}

/**
 * HEAD-проверка одного URL. DNS-ошибка (ENOTFOUND) — определённый вердикт
 * `dead` (имя не разрешается); timeout/сетевой сбой — `error` (на этапе
 * агрегации превращается либо в dead, либо в unverifiable).
 * 405/501 (сервер не поддерживает HEAD) перепроверяются GET-запросом.
 */
async function probeUrl(url) {
  if (typeof fetch !== 'function') {
    return { verdict: 'error', status: null, code: 'no-fetch', evidence: 'глобальный fetch недоступен (нужен Node ≥ 18)' };
  }
  const head = await probeOnce(url, 'HEAD');
  if (head.error === null && (head.status === 405 || head.status === 501)) {
    const get = await probeOnce(url, 'GET');
    if (get.error === null) return classifyStatus(get.status, `GET-fallback: HEAD ${head.status}`);
    return classifyFetchError(get, true);
  }
  if (head.error === null) return classifyStatus(head.status);
  return classifyFetchError(head, false);
}

/** Вердикт по сетевой ошибке fetch: ENOTFOUND → dead, прочее → error. */
function classifyFetchError(probe, afterFallback) {
  const code = String(probe.error || 'network-error');
  const note = afterFallback ? 'GET-fallback' : null;
  if (code.includes('ENOTFOUND') || code.includes('EAI_NODATA')) {
    return { verdict: 'dead', status: null, code, evidence: `DNS: имя не разрешается${note ? ` (${note})` : ''}` };
  }
  if (code === 'AbortError') return { verdict: 'error', status: null, code, evidence: `timeout ${URL_TIMEOUT_MS} мс${note ? ` (${note})` : ''}` };
  return { verdict: 'error', status: null, code, evidence: `сетевой сбой: ${code}${note ? ` (${note})` : ''}` };
}

/**
 * Сбор URL для S3: `sources[]` Фазы 2 ∪ маркеры `[enriched: …]` ∪ ссылки из
 * секции «## Источники». Маркеры/секция нужны потому, что в headless модель
 * правит спеку нативно и `sources[]` может прийти пустым (дефект S1).
 */
function collectUrlsToValidate(specText, sources) {
  const map = new Map();
  const add = (value, meta) => {
    const url = cleanUrl(value);
    if (url === null) return;
    const prev = map.get(url) || { url, tier: null, date: null, origins: new Set() };
    if (meta.tier && !prev.tier) prev.tier = String(meta.tier);
    if (meta.date && !prev.date) prev.date = String(meta.date);
    prev.origins.add(meta.origin);
    map.set(url, prev);
  };
  for (const s of Array.isArray(sources) ? sources : []) {
    if (s && s.url) add(s.url, { tier: s.tier, date: s.date, origin: 'sources[] Фазы 2' });
  }
  for (const m of String(specText).matchAll(/\[enriched:\s*([^\]|\s]+)\s*\|/gi)) {
    add(m[1], { origin: 'маркер [enriched:]' });
  }
  const lines = String(specText).split('\n');
  let inSources = false;
  for (const line of lines) {
    if (/^##\s+Источники(?![\p{L}\p{N}_])/u.test(line)) {
      inSources = true;
      continue;
    }
    if (/^#{1,2} /.test(line)) {
      inSources = false;
      continue;
    }
    if (!inSources) continue;
    for (const m of line.matchAll(/https?:\/\/[^\s)>\]\[|"'`,]+/gi)) add(m[0], { origin: 'секция «## Источники»' });
  }
  return [...map.values()].map((x) => ({ url: x.url, tier: x.tier, date: x.date, origin: [...x.origins].join(', ') }));
}

/**
 * Домечать мёртвый URL: `[enriched: URL|tier|дата]` → `…|unverified]`.
 * Если маркера нет, но URL есть в спеке — маркер вставляется после URL
 * (вне защищённых секций intent). Правка не откатывается (менее деструктивно,
 * чем rollback: факт мёртвой ссылки фиксируется в спеке и отчёте).
 */
function markDeadUrl(text, url, tier, date) {
  const src = String(text);
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\[enriched:\\s*${escaped}\\s*\\|([^\\]]*)\\]`, 'i');
  const hit = re.exec(src);
  if (hit) {
    if (/\|\s*unverified\s*$/.test(hit[0])) return { text: src, state: 'present', marker: hit[0] };
    const rest = hit[1].replace(/\s+$/, '');
    const marker = `[enriched: ${url}|${rest}|unverified]`;
    return { text: src.slice(0, hit.index) + marker + src.slice(hit.index + hit[0].length), state: 'annotated', marker, before: hit[0], line: lineAt(src, hit.index) };
  }
  const pos = src.indexOf(url);
  if (pos === -1) return { text: src, state: 'absent' };
  const line = lineAt(src, pos);
  const blocked = intentRanges(src).find((r) => line >= r.startLine && line <= r.endLine);
  if (blocked) return { text: src, state: 'intent-blocked', section: blocked.name, line };
  const marker = `[enriched: ${url}|${tier || 'Tier 2'}|${date || new Date().toISOString().slice(0, 10)}|unverified]`;
  return { text: src.slice(0, pos + url.length) + ` ${marker}` + src.slice(pos + url.length), state: 'injected', marker, before: url, line };
}

/**
 * S3 — шаг после Фазы 2: HEAD-проверка каждого URL, классификация
 * ok / warn (403) / dead (4xx/5xx, DNS, timeout), маркер `|unverified` для
 * мёртвых ссылок + finding {severity: medium, phase: 3-factcheck}.
 * Если ни один URL не ответил вообще (сеть недоступна) — все помечаются
 * `unverifiable`, фаза получает warn, hard-fail не выдаётся.
 */
async function validatePhaseUrls(specText, sources) {
  const out = {
    state: 'skipped',
    checked: 0,
    network: 'unknown',
    results: [],
    findings: [],
    warnings: [],
    applied: [],
    appliedEdits: [],
    specText,
    summary: null,
  };
  const list = collectUrlsToValidate(specText, sources);
  out.checked = list.length;
  if (!list.length) return out;

  // Проверки идут параллельно: timeout 5 с у каждого URL (не суммарный).
  const probed = await Promise.all(list.map(async (item) => ({ ...item, ...(await probeUrl(item.url)) })));
  // «Определённый» вердикт = сервер ответил кодом либо имя не разрешилось (DNS-ответ).
  const anyDefinitive = probed.some((r) => r.status !== null || r.verdict === 'dead');
  const results = probed.map((r) => ({ ...r }));
  out.network = anyDefinitive ? 'up' : 'unknown';
  if (!anyDefinitive) {
    /* Ни один URL не дал вердикта: проверяем саму сеть третьей пробой.
       Сеть жива → это свойство URL (dead), сети нет → все URL UNVERIFIABLE. */
    const probe = await probeOnce(CONNECTIVITY_PROBE_URL, 'HEAD');
    const online = probe.status !== null;
    out.network = online ? 'up' : 'down';
    for (const r of results) {
      if (online) {
        r.verdict = 'dead';
        r.evidence = `${r.evidence} — dead (сеть доступна: ${CONNECTIVITY_PROBE_URL} = HTTP ${probe.status}, URL не отвечает)`;
      } else {
        r.verdict = 'unverifiable';
        r.evidence = `${r.evidence} — UNVERIFIABLE (сеть недоступна: проба ${CONNECTIVITY_PROBE_URL} не ответила)`;
      }
    }
  } else {
    for (const r of results) {
      if (r.verdict === 'error') {
        r.verdict = 'dead';
        r.evidence = `${r.evidence} — dead (timeout/сетевой сбой при доступной сети)`;
      }
    }
  }

  let text = String(specText);
  let idx = 0;
  for (const r of results) {
    idx += 1;
    if (r.verdict === 'dead') {
      out.findings.push({
        id: `S3.${idx}`,
        severity: 'medium',
        confidence: 0.9,
        phase: '3-factcheck',
        location: r.url,
        evidence: 'dead URL',
        requiredFix: 'replace or remove',
      });
      const marked = markDeadUrl(text, r.url, r.tier, r.date);
      if (marked.state === 'annotated' || marked.state === 'injected') {
        text = marked.text;
        out.appliedEdits.push({
          phase: '2-research#url-validation',
          source: 'url-validation',
          find: marked.before,
          replace: marked.marker,
          reason: `мёртвый URL (${r.code || r.evidence}) помечен |unverified`,
          url: r.url,
          line: marked.line,
        });
      }
      out.warnings.push(`[url-validation: dead URL — ${r.url} (${r.evidence}); маркер \`|unverified\` ${marked.state === 'absent' ? 'не найден в спеке' : marked.state}, finding severity=medium phase=3-factcheck, правка не откатывается]`);
    } else if (r.verdict === 'warn') {
      out.warnings.push(`[url-validation: ${r.evidence} — ${r.url}; warn, правка не откатывается]`);
    } else if (r.verdict === 'unverifiable') {
      out.warnings.push(`[url-validation: ${r.url} — UNVERIFIABLE (${r.evidence})]`);
    }
  }
  out.specText = text;
  out.applied = out.appliedEdits.map((a) => ({ phase: a.phase, find: a.find || '—', replace: a.replace, reason: a.reason, line: a.line, source: 'url-validation' }));
  out.results = results.map((r) => ({ url: r.url, verdict: r.verdict, status: r.status, code: r.code, evidence: r.evidence, tier: r.tier, date: r.date, origin: r.origin }));
  const unverifiable = results.filter((r) => r.verdict === 'unverifiable').length;
  out.state = unverifiable === results.length ? 'unverifiable' : 'ok';
  out.summary = {
    checked: out.checked,
    ok: results.filter((r) => r.verdict === 'ok').length,
    warn: results.filter((r) => r.verdict === 'warn').length,
    dead: results.filter((r) => r.verdict === 'dead').length,
    unverifiable,
    state: out.state,
    network: out.network,
    results: out.results,
  };
  return out;
}

/* ------------------------------------------------------------- отчёт */

/** Однострочное представление фрагмента (для markdown-таблиц/списков). */
function oneLine(value, limit = 120) {
  const s = String(value === undefined || value === null ? '' : value).replace(/\s*\n\s*/g, ' ⏎ ').trim();
  return s.length <= limit ? s : `${s.slice(0, limit - 1)}…`;
}

/** Короткий SHA для отчёта. */
function shortSha(value) {
  const s = String(value || '');
  return s ? s.slice(0, 12) : '—';
}

function renderReport(model) {
  const L = [];
  L.push(`# spec-enrich — отчёт прогона (${model.mode})`, '');
  L.push(`- спека: \`${model.specRel}\` (id: ${model.specId})`);
  L.push(`- каталог прогона: \`${model.runDirRel}\``);
  L.push(`- LLM-раннер: \`${model.llmCmd}\``);
  L.push(`- старт: ${model.startedAt}; завершение: ${nowIso()}`);
  L.push(`- каталог прогона по умолчанию: \`.project/drafts/spec-<NNN>-enrich/\``);
  L.push('');

  L.push('## Фазы прогона', '');
  L.push('| Фаза | Имя | Исполнитель | Статус | Артефакт |', '|---|---|---|---|---|');
  for (const p of PHASES) {
    const st = model.phaseStatus.get(p.n) || '—';
    const art = p.kind === 'llm' ? (p.artifact === 'repair-log.jsonl' ? '`repair-log.jsonl`' : `\`${p.artifact}\``) : '—';
    L.push(`| ${p.n} | ${p.name} | ${p.kind === 'llm' ? 'LLM' : 'CLI validate-spec.mjs'} | ${st} | ${art} |`);
  }
  L.push('');

  L.push('## Score (Фаза 0, детерминированное ядро)', '');
  L.push(`- baseline score: **${model.scoreBefore}/${model.scoreMax}** (порог ${model.threshold})`);
  L.push(`- финальный score: **${model.scoreAfter}/${model.scoreMax}**`);
  L.push(`- delta: **${model.scoreAfter - model.scoreBefore >= 0 ? '+' : ''}${model.scoreAfter - model.scoreBefore}**`);
  L.push('');
  L.push('| Измерение | weight | baseline weighted | final weighted |', '|---|---|---|---|');
  for (const d of model.dimensionsBefore) {
    const after = model.dimensionsAfter.find((x) => x.key === d.key);
    L.push(`| ${d.key} | ${d.weight} | ${d.weighted} | ${after ? after.weighted : '—'} |`);
  }
  L.push('');

  L.push('## Фаза 1 — механические проверки (ядро)', '');
  L.push(`- ${model.phase1.count} проверок: ${model.phase1.passed} PASS / ${model.phase1.failed} FAIL / ${model.phase1.warned} WARN`);
  for (const c of model.phase1.checks) {
    if (c.status === 'PASS') continue;
    const issue = c.issues && c.issues[0] ? `${c.issues[0].message} (${c.issues[0].file}:${c.issues[0].line})` : '';
    L.push(`- ${c.status} \`${c.id}\` ${c.name} — ${issue}`);
  }
  L.push('');

  L.push('## Фаза 4 — traceability (ядро)', '');
  L.push(`- декомпозиция: ${model.phase4.decompositionPresent ? 'есть' : 'нет'}`);
  L.push(`- сироты: критерии ${model.phase4.orphanCriteria.length}, цели ${model.phase4.orphanGoals.length}, задачи ${model.phase4.orphanTasks.length}`);
  L.push(`- hard-fail traceability: ${model.phase4.hardFail}`);
  L.push('');

  L.push('## Tiered sources (Фаза 2)', '');
  if (model.sources.length) {
    L.push('| URL | Tier | Дата | Тезис |', '|---|---|---|---|');
    for (const s of model.sources) L.push(`| ${s.url || '—'} | ${s.tier || '—'} | ${s.date || '—'} | ${s.claim || '—'} |`);
  } else {
    L.push('Источников нет — фаза не отчиталась (см. WARN ниже).');
  }
  L.push('');

  L.push('## Findings (Фазы 6, 7, 8)', '');
  if (model.findings.length) {
    L.push('| id | severity | confidence | фаза | location | requiredFix |', '|---|---|---|---|---|---|');
    for (const f of model.findings) L.push(`| ${f.id || '—'} | ${f.severity || '—'} | ${f.confidence ?? '—'} | ${f.phase || '—'} | ${f.location || '—'} | ${f.requiredFix || '—'} |`);
  } else {
    L.push('Findings нет либо фазы adversarial/simulation/regeneration не отчитались.');
  }
  L.push('');

  L.push('## URL validation (S3)', '');
  const uv = model.urlValidation;
  if (uv && uv.checked) {
    L.push(`- проверено URL: ${uv.checked} (HEAD-запрос, timeout ${URL_TIMEOUT_MS / 1000} с, redirect вручную)`);
    L.push(`- состояние: \`${uv.state}\`; сеть: \`${uv.network || 'unknown'}\`${uv.state === 'unverifiable' ? ' — сеть недоступна: все URL UNVERIFIABLE, фаза warn, не hard-fail' : ''}`);
    L.push('');
    L.push('| URL | классификация | код/причина | tier | источник |', '|---|---|---|---|---|');
    for (const r of uv.results) {
      L.push(`| ${r.url} | ${r.verdict} | ${oneLine(r.evidence, 80)} | ${r.tier || '—'} | ${r.origin || '—'} |`);
    }
    L.push('');
    L.push(`- мёртвые URL помечаются маркером \`[enriched: URL|tier|дата|unverified]\`; правка НЕ откатывается, фиксируется finding \`severity: medium\`, \`phase: 3-factcheck\`, \`requiredFix: replace or remove\`;`);
    L.push('- `403` — ресурс существует, но запрещает доступ (warn, без finding); `4xx/5xx`, DNS-ошибка и timeout при доступной сети — dead.');
  } else {
    L.push('URL не проверялись: Фаза 2 не отчиталась (раннер недоступен) либо в спеке и `sources[]` нет http(s)-ссылок.');
  }
  L.push('');

  L.push('## Правки спеки (diff)', '');
  if (model.applied.length) {
    for (const a of model.applied) {
      L.push(`- фаза \`${a.phase}\`: \`${oneLine(a.find)}\` → \`${oneLine(a.replace)}\`${a.reason ? ` — ${oneLine(a.reason, 80)}` : ''}`);
    }
  } else {
    L.push('Правок не применялось.');
  }
  if (model.skipped.length) {
    L.push('', 'Не применены (не найдено уникальное совпадение):');
    for (const s of model.skipped) L.push(`- фаза \`${s.phase}\`: ${s.reason}${s.find ? ` (\`${oneLine(s.find, 60)}\`)` : ''}`);
  }
  if (model.rolledBack && model.rolledBack.length) {
    L.push('', 'Откатано (rollback правок Фазы 9 по вердикту Фазы 10 INTENT-CHANGED):');
    for (const a of model.rolledBack) L.push(`- фаза \`${a.phase}\`: \`${oneLine(a.find)}\` → \`${oneLine(a.replace)}\`${a.reason ? ` — ${a.reason}` : ''}`);
  }
  L.push('');

  L.push('## Reconcile правок (S1)', '');
  if (model.reconcile && model.reconcile.length) {
    L.push('SHA-256 файла спеки снимается до/после каждой edits-фазы; при пустом `edits[]` правки восстанавливаются из diff файла (нативные Write/Edit модели), `applied_edits[]` пишется в `run-log.jsonl`.');
    L.push('');
    L.push('| Фаза | Источник правок | SHA до | SHA после | hunks в applied_edits[] |', '|---|---|---|---|---|');
    for (const r of model.reconcile) {
      L.push(`| \`${r.phase}\` | ${r.source} | \`${shortSha(r.sha_before)}\` | \`${shortSha(r.sha_after)}\` | ${r.edits.length} |`);
    }
    const detail = [];
    for (const r of model.reconcile) {
      for (const e of r.edits) {
        const place = e.line ? ` (стр. ${e.line}${e.end_line > e.line ? `–${e.end_line}` : ''})` : '';
        const kind = Number.isInteger(e.hunk) ? `hunk ${e.hunk}` : `CLI-правка`;
        detail.push(`- фаза \`${r.phase}\`, ${kind}${place}, источник \`${e.source}\`: \`${oneLine(e.find) || '∅ (вставка)'}\` → \`${oneLine(e.replace) || '∅ (удаление)'}\`${e.reason ? ` — ${oneLine(e.reason, 80)}` : ''}`);
      }
    }
    if (detail.length) L.push('', 'Hunks:', '', ...detail);
    const desync = (model.reconcile || []).filter((r) => r.desync);
    if (desync.length) {
      L.push('', `WARN: непустое \`edits[]\` без изменения SHA спеки — ${desync.map((r) => `\`${r.phase}\``).join(', ')} (модель заявила правки, которых нет).`);
    }
  } else {
    L.push('Reconcile не применялся (все edits-фазы пропущены либо правок не было).');
  }
  L.push('');

  L.push('## Структурная защита intent (F2)', '');
  if (model.intentBlocked && model.intentBlocked.length) {
    L.push(`Отклонено правок: ${model.intentBlocked.length}. Секции «Цель» и «Критерии приёмки» конвейером не правятся — дефекты класса m11/m13 (критерий без verify-команды) требуют отдельного решения; hard-fail всего прогона из-за этого не выдаётся.`);
    for (const b of model.intentBlocked) {
      L.push(`- фаза \`${b.phase}\`, секция «${b.section}» (стр. ${b.line}): \`${b.find}\` → правка не применена`);
    }
  } else {
    L.push('Отклонённых правок нет: раннер не предлагал правок в секциях «Цель»/«Критерии приёмки».');
  }
  L.push('');

  L.push('## Гарантия маркера обогащения (F3)', '');
  if (model.enrichment) {
    L.push(`- состояние: \`${model.enrichment.state}\``);
    if (model.enrichment.marker) L.push(`- маркер: \`${model.enrichment.marker}\` (вставлен CLI в секцию «Источники», стр. ${model.enrichment.line})`);
    if (model.enrichment.reason) L.push(`- причина: ${model.enrichment.reason}`);
    if (model.enrichment.state === 'no-section' || model.enrichment.state === 'no-source') {
      L.push('- статус Фазы 2 понижен до `warn`: маркер `[enriched: URL|tier|дата]` в спеке не гарантирован (см. run-log).');
    }
  } else {
    L.push('Фаза 2 не отчиталась (раннер недоступен) — гарантия маркера не проверялась.');
  }
  L.push('');

  L.push('## Repair loop (Фаза 9)', '');
  if (model.repair.length) {
    L.push('| итерация | решение | score до | score после | правок |', '|---|---|---|---|---|');
    for (const r of model.repair) L.push(`| ${r.iteration} | ${r.decision} | ${r.scoreBefore} | ${r.scoreAfter} | ${r.applied} |`);
  } else {
    L.push('Итераций не было (раннер недоступен либо правки не требовались).');
  }
  if (model.oscillation) L.push('', 'STOP (oscillation): роста score нет при открытых hard-fail/high findings.');
  L.push('');

  L.push('## External audit (Фаза 10)', '');
  L.push(`- отдельный LLM-вызов: ${model.auditCalled ? 'да' : 'нет'}`);
  L.push(`- вердикт: ${model.auditVerdict || '—'}`);
  if (model.auditRollback) L.push('- hard-fail: intent изменён → правки Фазы 9 откатаны (rollback).');
  L.push('');

  L.push('## Лог прогона', '');
  L.push(`- \`${posixJoin(model.runDirRel, 'run-log.jsonl')}\` — по одной записи на каждый LLM-вызов (${model.llmCalls} ${plural(model.llmCalls, 'вызов', 'вызова', 'вызовов')});`);
  L.push('- поля записи: `phase`, `runner`, `runner_via`, `runner_resolved`, `model`, `prompt_hash`, `timestamp`, `status`, `api_key_source`;');
  L.push('- S1: `spec_sha_before`, `spec_sha_after`, `spec_sha_after_model`, `edit_source`, `applied_edits[]` (hunks или JSON-правки), `reconcile_desync`;');
  L.push('- S2: `runner_via` = `direct` | `cmd-wrapper` | `powershell-file`; `runner_resolved: false` — шим не найден, нужен `--llm-cmd`;');
  L.push('- S3: `url_validation` в записи Фазы 2 (классификация ok/warn/dead/unverifiable по каждому URL);');
  L.push('- детерминированные фазы 0, 1, 4 — в `score-before.json` / `score-after.json`.');
  L.push('');

  L.push('## WARN', '');
  if (model.warnings.length) for (const w of model.warnings) L.push(`- ${w}`);
  else L.push('WARN не зафиксировано.');
  L.push('');

  /* STOP A (spec 051) — печатается в отчёте прогона, когда решение рассчитано. */
  if (model.stopA !== undefined) {
    L.push('## STOP A (spec 051)', '');
    L.push(`- режим: ${model.stopA.auto ? '**auto-approve** (цепочка продолжается без аппрува капитана)' : 'STOP — ждёт аппрув капитана'}`);
    L.push(`- условие: score ≥ ${model.stopA.threshold}% ∧ hard-fail = 0; факт: score ${model.stopA.score}/${model.stopA.scoreMax} (${model.stopA.scorePercent}%), hard-fail ${model.stopA.hardFailCount}`);
    if (model.stopA.auto) L.push(`- лог: \`${model.stopA.log}\``);
    if (model.stopA.decision !== null && model.stopA.decision !== undefined) {
      L.push(`- DECISIONS.md: \`${model.stopA.decision}\` (записано append-only)`);
    }
    if (!model.stopA.auto) L.push(`- причина STOP: ${model.stopA.reason}`);
    L.push('');
  }

  L.push('## Вердикт прогона', '');
  L.push(`- exit code: ${model.exitCode}`);
  L.push(`- итог: ${model.verdict}`);
  L.push('');
  return `${L.join('\n')}\n`;
}

/* ------------------------------------------------------------- вывода */

function printDryRun(det, specRel, specId, runDirRel, llmCmd, hardFail, runnerPreview) {
  say('spec-enrich — dry-run (11 фаз, правки не применяются)');
  say(`спека: ${specRel} (id: ${specId})`);
  say('');
  say('Фазы:');
  for (const p of PHASES) {
    const who = p.kind === 'llm' ? `LLM (${p.key})` : 'CLI validate-spec.mjs';
    say(`  Фаза ${p.n} — ${p.name} · ${who}`);
  }
  say('');
  say('Детерминированное ядро (Фаза 0):');
  say(`  BASELINE SCORE ${det.phase0.score}/${det.phase0.weightSum} (порог ${det.phase0.threshold})`);
  for (const d of det.phase0.dimensions) {
    say(`    ${d.key}: weight ${d.weight}% → normalized ${d.normalized} → weighted ${d.weighted}`);
  }
  say('');
  say(`Фаза 1: ${det.phase1.count} проверок — ${det.phase1.passed} PASS / ${det.phase1.failed} FAIL / ${det.phase1.warned} WARN`);
  for (const c of det.phase1.checks) {
    if (c.status === 'PASS') continue;
    const issue = c.issues && c.issues[0] ? ` (${c.issues[0].message} @${c.issues[0].file}:${c.issues[0].line})` : '';
    say(`    ${c.status} ${c.id} ${c.name}${issue}`);
  }
  say('');
  say(`Фаза 4: декомпозиция ${det.phase4.decompositionPresent ? 'есть' : 'нет'}; сироты: критерии ${det.phase4.orphanCriteria.length}, цели ${det.phase4.orphanGoals.length}, задачи ${det.phase4.orphanTasks.length}; hard-fail ${det.phase4.hardFail}`);
  say('');
  say(`LLM-раннер для Фаз 2, 3, 5–10: ${llmCmd} (переопределяется --llm-cmd)`);
  if (runnerPreview) say(`  резолв (S2): ${describeRunner(runnerPreview)}`);
  say(`Каталог прогона по умолчанию: ${runDirRel}`);
  say('');
  say(`dry-run: правки не применялись, файлы не создавались.${hardFail ? ' HARD-FAIL детерминированных фаз.' : ''}`);
}

/* ---------------------------------------------------------------- main */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    say(USAGE);
    process.exit(EXIT_CLEAN);
  }

  const specArg = opts.positional[0];
  if (!specArg) {
    err('enrich-spec: не указан аргумент <spec>');
    err(USAGE);
    process.exit(EXIT_USAGE);
  }

  const specAbs = resolveSpec(specArg);
  if (!specAbs) {
    err(`enrich-spec: спека не найдена: ${specArg}`);
    err(`проверены корни: ${SPEC_ROOTS.map((r) => `\`${r}/\``).join(', ')} и прямой путь от корня репозитория (S6)`);
    process.exit(EXIT_USAGE);
  }
  const specRel = toRel(specAbs);
  const specText0 = readText(specAbs);
  if (specText0 === null) {
    err(`enrich-spec: спека не читается: ${specRel}`);
    process.exit(EXIT_USAGE);
  }

  const specId = specIdOf(specText0, specAbs);
  const llmCmd = (opts.llmCmd || DEFAULT_LLM_CMD).trim() || DEFAULT_LLM_CMD;
  const runDirRel = posixJoin((opts.out || `.project/drafts/spec-${specId}-enrich`).replace(/\\/g, '/').replace(/^\.[/\\]/, '.'));
  const runDirAbs = path.resolve(ROOT, runDirRel);
  const maxIterations = Math.max(1, Math.min(HARD_MAX_ITERATIONS, Number.isFinite(opts.maxIterations) ? opts.maxIterations : DEFAULT_MAX_ITERATIONS));

  /* S5: creds — env, затем User-scope Windows (как run-spec.mjs, спека 035). */
  const creds = resolveApiKey(resolveApiKeyFromSystem());
  /* S2: резолв раннера (preview без промпта) — нужен и в --dry-run, и как WARN. */
  const runnerPreview = buildRunnerInvocation(llmCmd, null);

  /* Фазы 0, 1, 4 — детерминированное ядро (без LLM). */
  const det = runValidate(specAbs);
  if (det.error) {
    err(`enrich-spec: ошибка окружения — ${det.error}`);
    err('exit 2: ядро/спека недоступны; ничего не записано.');
    process.exit(EXIT_USAGE);
  }
  const detJson = det.json;
  const detHardFail = detJson.hardFail === true || det.exitCode === EXIT_HARD_FAIL;
  const scoreBefore = detJson.phase0.score;

  if (opts.dryRun) {
    printDryRun(detJson, specRel, specId, runDirRel, llmCmd, detHardFail, runnerPreview);
    if (opts.json) {
      say(JSON.stringify({
        tool: 'enrich-spec.mjs', mode: 'dry-run', spec: specRel, specId,
        phases: PHASES.map((p) => ({ n: p.n, name: p.name, executor: p.kind, key: p.key })),
        phase0: detJson.phase0, phase1: { count: detJson.phase1.count, passed: detJson.phase1.passed, failed: detJson.phase1.failed, warned: detJson.phase1.warned },
        phase4: { decompositionPresent: detJson.phase4.decompositionPresent, hardFail: detJson.phase4.hardFail },
        runDir: runDirRel, llmCmd, hardFail: detHardFail, dryRun: true,
        runner: runnerPreview.ok === true
          ? { command: runnerPreview.command, argv: runnerPreview.argv, via: runnerPreview.via, resolved: runnerPreview.resolved !== false, note: runnerPreview.note || null, resolvedExe: runnerPreview.exe }
          : { resolved: false, reason: runnerPreview.reason },
        keySource: creds.source,
      }, null, 2));
    }
    process.exit(detHardFail ? EXIT_HARD_FAIL : EXIT_CLEAN);
  }

  const skill = loadSkillSections();
  if (!skill) {
    err(`enrich-spec: ошибка окружения — инструкция LLM-фаз не найдена: ${SKILL_REL}`);
    err('exit 2: логика Фаз 2, 3, 5–10 берётся только из SKILL.md; ничего не записано.');
    process.exit(EXIT_USAGE);
  }

  const startedAt = nowIso();
  mkdirp(runDirAbs);
  const logAbs = path.join(runDirAbs, 'run-log.jsonl');
  const logRel = posixJoin(runDirRel, 'run-log.jsonl');
  writeText(path.join(runDirAbs, 'spec-original.md'), specText0);
  writeText(path.join(runDirAbs, 'score-before.json'), `${JSON.stringify(detJson, null, 2)}\n`);

  const warnings = [];
  const phaseStatus = new Map([[0, `baseline ${scoreBefore}`], [1, `${detJson.phase1.passed}P/${detJson.phase1.failed}F/${detJson.phase1.warned}W`], [4, detHardFail ? 'hard-fail' : 'ok']]);
  const applied = [];
  const rolledBack = [];
  const repairApplied = [];
  const intentBlocked = [];
  let enrichment = null;
  const skippedEdits = [];
  const findings = [];
  const sources = [];
  const repair = [];
  const reconcileTrail = [];
  let oscillation = false;
  let auditCalled = false;
  let auditVerdict = null;
  let auditRollback = false;
  let exitCode = EXIT_CLEAN;
  let verdict = 'прогон завершён';

  say(`spec-enrich — спека ${specRel} (id: ${specId})`);
  say(`каталог прогона: ${runDirRel}`);
  say(`LLM-раннер: ${llmCmd}`);
  say('');
  say(`Фаза 0 — Baseline score: ${scoreBefore}/${detJson.phase0.weightSum} (порог ${detJson.phase0.threshold})`);
  say(`Фаза 1 — 15 механических проверок: ${detJson.phase1.passed} PASS / ${detJson.phase1.failed} FAIL / ${detJson.phase1.warned} WARN`);
  say(`Фаза 4 — Traceability: сироты ${detJson.phase4.orphanCriteria.length + detJson.phase4.orphanGoals.length}; hard-fail ${detJson.phase4.hardFail}`);

  /* STOP на hard-fail ядра: LLM-фазы не запускаются. */
  if (detHardFail) {
    say('');
    say('STOP: hard-fail детерминированных фаз (Фаза 4 / frontmatter). Правки не применяются.');
    const orphanLine = [...detJson.phase4.orphanCriteria.map((c) => `критерий ${c.num} (стр. ${c.line})`), ...detJson.phase4.orphanGoals.map((g) => `цель ${g.n} (стр. ${g.line})`)];
    if (orphanLine.length) say(`Сироты: ${orphanLine.join('; ')}`);
    const report = renderReport({
      mode: 'apply', specRel, specId, runDirRel, llmCmd, startedAt,
      phaseStatus, scoreBefore, scoreAfter: scoreBefore, scoreMax: detJson.phase0.weightSum, threshold: detJson.phase0.threshold,
      dimensionsBefore: detJson.phase0.dimensions, dimensionsAfter: detJson.phase0.dimensions,
      phase1: detJson.phase1, phase4: detJson.phase4, sources, findings, applied, skipped: skippedEdits, rolledBack: [], repair,
      oscillation, auditCalled, auditVerdict, auditRollback, llmCalls: 0, warnings,
      exitCode: EXIT_HARD_FAIL, verdict: 'STOP — hard-fail детерминированных фаз',
      intentBlocked, enrichment, urlValidation: null, reconcile: [],
    });
    writeText(path.join(runDirAbs, 'report.md'), report);
    say(`отчёт: ${posixJoin(runDirRel, 'report.md')}`);
    notifyFireAndForget('gate_failed', `⚠️ Спека ${specId}: проверка остановлена, обязательные правила не выполнены. Нужен разбор.`);
    process.exit(EXIT_HARD_FAIL);
  }

  const ctx = { specRel, specId, specText: specText0, runDirAbs, runDirRel, llmCmd, logAbs, skill, apiKey: creds };
  let specText = specText0;
  let llmCalls = 0;
  let runnerUnavailable = false;
  let urlValidation = null;

  /* S5/S2: предупреждения окружения (не блокеры). */
  if (creds.source === 'missing') {
    warnings.push(`[api-key: ${API_KEY_VAR} не найден ни в env, ни в User-scope — авторизация LLM-раннера может упасть; выставьте ключ: ${API_KEY_EXPORT_HINT}]`);
  }
  if (runnerPreview.ok === true && runnerPreview.resolved === false) {
    warnings.push(`[llm-runner: resolved: false — ${runnerPreview.note}]`);
  }

  const commitSpec = (text) => {
    if (text === specText0 && readText(specAbs) === text) return;
    writeText(specAbs, text);
  };

  /* Фазы 2, 3, 5, 6, 7, 8. */
  const preRepairPhases = PHASES.filter((p) => [2, 3, 5, 6, 7, 8].includes(p.n));
  for (const phase of preRepairPhases) {
    const extra = phase.n === 6
      ? 'Фаза 6 — независимый критик: атакуй спеку, не повторяй уже снятые претензии. Правки не применяй.'
      : phase.n === 8
        ? 'Фаза 8 — слепой regeneration test: у тебя только текст спеки; восстанови план и сравни его с декомпозицией спеки.'
        : null;
    /* S1: SHA файла спеки ДО фазы (edits-фазы 2, 3, 5 и read-only 6, 7, 8). */
    const shaBefore = sha256(readText(specAbs) ?? specText);
    const res = callLlmPhase(ctx, phase, { extra });
    if (!res.ok) {
      commitLlmPhase(ctx, phase, res, mergeFields({}, {
        spec_sha_before: shaBefore,
        spec_sha_after: sha256(readText(specAbs) ?? specText),
      }));
      phaseStatus.set(phase.n, 'skipped');
      runnerUnavailable = true;
      warnings.push(`[llm: unavailable — ${res.reason}] (Фаза ${phase.n}, промпт-пак: \`${res.promptRel}\`)`);
      llmCalls += 1;
      continue;
    }
    llmCalls += 1;
    const result = res.result || {};
    const patch = {};
    const fileText = readText(specAbs);
    const shaAfterModel = sha256(fileText ?? specText);
    let declaredEdits = 0;
    if (Array.isArray(result.sources)) sources.push(...result.sources);
    if (Array.isArray(result.findings)) {
      for (const f of result.findings) findings.push({ ...f, phase: phase.key });
    }
    if (phase.edits) {
      /* S1: приоритет JSON edits[] над diff; diff синтезирует applied_edits[]. */
      const rec = reconcilePhaseEdits({ phase, result, specText, fileText, shaBefore, shaAfter: shaAfterModel });
      declaredEdits = rec.declaredEdits;
      if (rec.blocked.length) {
        patch.status = 'warn';
        mergeFields(patch, { intent_blocked: rec.blocked });
        for (const b of rec.blocked) {
          intentBlocked.push({ phase: phase.key, ...b });
          warnings.push(`[intent-protected — секция «${b.section}» (стр. ${b.line}): правка не применена; дефект класса m11/m13 требует отдельного решения]`);
        }
      }
      specText = rec.specText;
      ctx.specText = specText;
      applied.push(...rec.applied);
      skippedEdits.push(...rec.skipped);
      mergeFields(patch, {
        edit_source: rec.source,
        applied_edits: rec.appliedEdits,
        spec_sha_before: shaBefore,
        spec_sha_after_model: shaAfterModel,
      });
      if (rec.ignoredHunks) mergeFields(patch, { ignored_diff_hunks: rec.ignoredHunks });
      if (rec.applied.length) commitSpec(specText);
    } else {
      /* Read-only фазы 6, 7, 8: нативный JSON как есть; прямое изменение файла
         фиксируется WARN, содержимое принимается (чтобы не потерять его). */
      if (fileText !== null && fileText !== specText) {
        mergeFields(patch, { read_only_modified: true });
        warnings.push(`[S1: read-only фаза ${phase.key} изменила файл спеки напрямую — правка принята как есть (read-only фазы не реконсилируются)]`);
        specText = fileText;
        ctx.specText = specText;
      }
      if (Array.isArray(result.edits) && result.edits.length) {
        skippedEdits.push({ phase: phase.key, reason: 'фаза read-only: правки запрещены' });
        mergeFields(patch, { read_only_edits_rejected: result.edits.length });
      }
      mergeFields(patch, {
        spec_sha_before: shaBefore,
        spec_sha_after_model: shaAfterModel,
        edit_source: 'native-json',
        applied_edits: [],
      });
    }
    if (phase.n === 2) {
      const guard = ensureEnrichedMarker(specText, sources);
      enrichment = { state: guard.state, marker: guard.marker || null, line: guard.line || null, reason: guard.reason || null };
      if (guard.state === 'injected') {
        specText = guard.text;
        ctx.specText = specText;
        commitSpec(specText);
        applied.push({ phase: '2-research#enrichment-guard', find: '—', replace: guard.bullet, reason: `гарантия F3: маркер ${guard.marker}` });
        mergeFields(patch, {
          enriched_injected: true,
          enriched_marker: guard.marker,
          applied_edits: [
            ...(patch.fields && Array.isArray(patch.fields.applied_edits) ? patch.fields.applied_edits : []),
            {
              phase: '2-research#enrichment-guard',
              source: 'cli-enrichment-guard',
              find: '—',
              replace: guard.bullet,
              reason: `гарантия F3: маркер ${guard.marker}`,
              line: guard.line || null,
            },
          ],
        });
      } else if (guard.state === 'no-section' || guard.state === 'no-source') {
        patch.status = 'warn';
        mergeFields(patch, { enriched_guarantee: 'failed', enriched_reason: guard.reason });
        warnings.push(`[enriched: not guaranteed — ${guard.reason}] (Фаза 2)`);
      } else {
        mergeFields(patch, { enriched_injected: false, enriched_note: 'маркер уже присутствовал в спеке' });
      }
      /* S3: HEAD-валидация URL — шаг после Фазы 2 (не блокирует прогон). */
      commitSpec(specText);
      const uv = await validatePhaseUrls(specText, sources);
      if (uv.checked) {
        specText = uv.specText;
        ctx.specText = specText;
        commitSpec(specText);
        applied.push(...uv.applied);
        findings.push(...uv.findings);
        for (const w of uv.warnings) warnings.push(w);
        urlValidation = uv;
        mergeFields(patch, {
          url_validation: uv.summary,
          applied_edits: [...(patch.fields && Array.isArray(patch.fields.applied_edits) ? patch.fields.applied_edits : []), ...uv.appliedEdits],
        });
        if (uv.state === 'unverifiable') {
          patch.status = 'warn';
          warnings.push(`[url-validation: сеть недоступна — все ${uv.checked} URL помечены UNVERIFIABLE, фаза warn, hard-fail не выдаётся]`);
        }
      }
    }
    /* S1: финальный SHA фазы + WARN о рассинхронизации edits[] ↔ SHA. */
    commitSpec(specText);
    const shaAfter = sha256(readText(specAbs) ?? specText);
    mergeFields(patch, { spec_sha_after: shaAfter });
    reconcileTrail.push({
      phase: phase.key,
      source: patch.fields.edit_source === 'none' && (patch.fields.applied_edits || []).length ? 'cli-only' : (patch.fields.edit_source || 'none'),
      sha_before: shaBefore,
      sha_after: shaAfter,
      edits: patch.fields.applied_edits || [],
      desync: false,
    });
    if (phase.edits && declaredEdits > 0 && shaAfter === shaBefore) {
      patch.status = 'warn';
      mergeFields(patch, { reconcile_desync: true, declared_edits: declaredEdits });
      reconcileTrail[reconcileTrail.length - 1].desync = true;
      findings.push({
        id: `S1.${phase.n}`,
        severity: 'medium',
        confidence: 1,
        phase: phase.key,
        location: specRel,
        evidence: 'reconcile desync: модель вернула непустое edits[], но SHA файла спеки не изменился',
        requiredFix: 'проверить, что заявленные правки действительно применились (find/replace или нативный Write/Edit)',
      });
      warnings.push(`[reconcile: Фаза ${phase.key} вернула ${declaredEdits} edits[], но SHA спеки не изменился — модель заявила правки, которых нет]`);
    }
    commitLlmPhase(ctx, phase, res, patch);
    phaseStatus.set(phase.n, res.entry.status);
  }

  /* Фаза 9 — repair loop: max 3 итерации, rollback при падении score. */
  const phase9 = PHASES.find((p) => p.n === 9);
  const beforeRepairText = specText;
  let currentScore = scoreBefore;
  let noGrowth = 0;
  for (let i = 1; i <= maxIterations; i += 1) {
    const checks = runValidate(specAbs);
    if (!checks.error) currentScore = checks.json.phase0.score;
    const findingsBrief = findings.map((f) => `- ${f.id || '?'} [${f.severity || '?'}] ${f.location || ''} — ${f.requiredFix || f.evidence || ''}`).join('\n');
    const extra = [
      `Итерация repair loop: ${i} из ${maxIterations}.`,
      `Текущий score: ${currentScore}. Открытые findings:`,
      findingsBrief || '- findings не переданы (Фазы 6–8 не отчитались)',
      'Применяй минимальный набор правок; правки Цели и Критериев приёмки запрещены — при их необходимости верни edits: [].',
    ].join('\n');
    const shaBefore9 = sha256(readText(specAbs) ?? specText);
    const res = callLlmPhase(ctx, phase9, { extra, iteration: i });
    llmCalls += 1;
    if (!res.ok) {
      commitLlmPhase(ctx, phase9, res, mergeFields({}, { spec_sha_before: shaBefore9, spec_sha_after: sha256(readText(specAbs) ?? specText) }));
      phaseStatus.set(9, 'skipped');
      runnerUnavailable = true;
      warnings.push(`[llm: unavailable — ${res.reason}] (Фаза 9, итерация ${i}, промпт-пак: \`${res.promptRel}\`)`);
      repair.push({ iteration: i, decision: 'runner-unavailable', scoreBefore: currentScore, scoreAfter: currentScore, applied: 0 });
      break;
    }
    /* S1: Фаза 9 — тоже edits-фаза: JSON edits[] либо diff нативных правок. */
    const fileText9 = readText(specAbs);
    const shaAfterModel9 = sha256(fileText9 ?? specText);
    const rec = reconcilePhaseEdits({ phase: phase9, result: res.result, specText, fileText: fileText9, shaBefore: shaBefore9, shaAfter: shaAfterModel9 });
    const patch = {};
    if (rec.blocked.length) {
      patch.status = 'warn';
      mergeFields(patch, { intent_blocked: rec.blocked });
      for (const b of rec.blocked) {
        intentBlocked.push({ phase: `9-repair#${i}`, ...b });
        warnings.push(`[intent-protected — секция «${b.section}» (стр. ${b.line}): правка не применена; дефект класса m11/m13 требует отдельного решения]`);
      }
    }
    mergeFields(patch, {
      iteration: i,
      edit_source: rec.source,
      applied_edits: rec.appliedEdits,
      spec_sha_before: shaBefore9,
      spec_sha_after_model: shaAfterModel9,
      declared_edits: rec.declaredEdits,
    });
    if (!rec.applied.length) {
      commitLlmPhase(ctx, phase9, res, patch);
      phaseStatus.set(9, res.entry.status);
      skippedEdits.push(...rec.skipped);
      const decision = rec.blocked.length ? 'intent-blocked' : (rec.declaredEdits ? 'no-matching-edits' : 'no-edits');
      repair.push({ iteration: i, decision, scoreBefore: currentScore, scoreAfter: currentScore, applied: 0 });
      reconcileTrail.push({ phase: `9-repair#${i}`, source: rec.source, sha_before: shaBefore9, sha_after: shaBefore9, edits: [], desync: false });
      break;
    }
    skippedEdits.push(...rec.skipped);
    const snapshot = specText;
    const snapshotScore = currentScore;
    mkdirp(path.join(runDirAbs, `repair-${i}`));
    writeText(path.join(runDirAbs, `repair-${i}`, 'spec-before.md'), snapshot);
    writeText(path.join(runDirAbs, `repair-${i}`, 'score-before.json'), `${JSON.stringify(checks.error ? {} : checks.json, null, 2)}\n`);
    writeText(specAbs, rec.specText);
    const after = runValidate(specAbs);
    const newScore = after.error ? snapshotScore : after.json.phase0.score;
    if (newScore < snapshotScore) {
      writeText(specAbs, snapshot);
      specText = snapshot;
      ctx.specText = specText;
      currentScore = snapshotScore;
      mergeFields(patch, { spec_sha_after: sha256(snapshot) });
      commitLlmPhase(ctx, phase9, res, patch);
      phaseStatus.set(9, res.entry.status);
      repair.push({ iteration: i, decision: 'reverted', scoreBefore: snapshotScore, scoreAfter: newScore, applied: rec.applied.length });
      reconcileTrail.push({ phase: `9-repair#${i}`, source: rec.source, sha_before: shaBefore9, sha_after: sha256(snapshot), edits: rec.appliedEdits, desync: false });
      warnings.push(`Фаза 9, итерация ${i}: score упал ${snapshotScore} → ${newScore}, правки откатаны (rollback)`);
      continue;
    }
    specText = rec.specText;
    ctx.specText = specText;
    applied.push(...rec.applied);
    repairApplied.push(...rec.applied);
    currentScore = newScore;
    writeText(path.join(runDirAbs, `repair-${i}`, 'spec-accepted.md'), specText);
    mergeFields(patch, { spec_sha_after: sha256(specText) });
    commitLlmPhase(ctx, phase9, res, patch);
    phaseStatus.set(9, res.entry.status);
    repair.push({ iteration: i, decision: 'accepted', scoreBefore: snapshotScore, scoreAfter: newScore, applied: rec.applied.length });
    reconcileTrail.push({ phase: `9-repair#${i}`, source: rec.source, sha_before: shaBefore9, sha_after: sha256(specText), edits: rec.appliedEdits, desync: false });
    if (newScore === snapshotScore) noGrowth += 1;
    else noGrowth = 0;
    if (noGrowth >= 2 && hasBlockingFindings(findings)) {
      oscillation = true;
      warnings.push('STOP (oscillation): роста score нет при открытых hard-fail/high findings — итерации прекращены');
      break;
    }
  }

  /* Фаза 10 — external audit: отдельный LLM-вызов, изоляция от Фазы 6. */
  const phase10 = PHASES.find((p) => p.n === 10);
  const auditExtra = [
    'Вход изолирован от Фазы 6: findings adversarial этой сессии в промпт НЕ передаются.',
    'Оригинал спеки (до правок):',
    '',
    '<<<ORIGINAL',
    specText0,
    'ORIGINAL>>>',
    '',
    'Проверь сохранение intent (Цель, Критерии приёмки, write-скоупы, «Что НЕ трогать») и верни verdict INTENT-PRESERVED либо INTENT-CHANGED.',
  ].join('\n');
  /* S1: read-only фаза 10 — нативный JSON как есть, но SHA-снимки фиксируются. */
  const shaBefore10 = sha256(readText(specAbs) ?? specText);
  const audit = callLlmPhase(ctx, phase10, { extra: auditExtra });
  llmCalls += 1;
  if (!audit.ok) {
    commitLlmPhase(ctx, phase10, audit, mergeFields({}, { edit_source: 'native-json', applied_edits: [], spec_sha_before: shaBefore10, spec_sha_after: sha256(readText(specAbs) ?? specText) }));
    phaseStatus.set(10, 'skipped');
    runnerUnavailable = true;
    warnings.push(`[llm: unavailable — ${audit.reason}] (Фаза 10, промпт-пак: \`${audit.promptRel}\`)`);
  } else {
    auditCalled = true;
    auditVerdict = String((audit.result && audit.result.verdict) || '—');
    if (readText(specAbs) !== specText) {
      warnings.push('[S1: read-only фаза 10-external-audit изменила файл спеки напрямую — правка будет перекрыта финальным состоянием CLI]');
      writeText(specAbs, specText);
    }
    commitLlmPhase(ctx, phase10, audit, mergeFields({}, {
      edit_source: 'native-json',
      applied_edits: [],
      spec_sha_before: shaBefore10,
      spec_sha_after: sha256(specText),
    }));
    reconcileTrail.push({ phase: '10-external-audit', source: 'native-json', sha_before: shaBefore10, sha_after: sha256(specText), edits: [], desync: false });
    phaseStatus.set(10, audit.entry.status);
    if (auditVerdict === 'INTENT-CHANGED') {
      auditRollback = true;
      writeText(specAbs, beforeRepairText);
      specText = beforeRepairText;
      ctx.specText = specText;
      if (repairApplied.length) {
        const rolled = new Set(repairApplied);
        const kept = applied.filter((a) => !rolled.has(a));
        applied.length = 0;
        applied.push(...kept);
        rolledBack.push(...repairApplied);
      }
      findings.push({ id: 'F10.1', severity: 'hard-fail', confidence: 1, phase: '10-external-audit', location: '—', evidence: 'intent изменён', requiredFix: 'правки Фазы 9 откатаны' });
      warnings.push('Фаза 10: INTENT-CHANGED → hard-fail, правки Фазы 9 откатаны (rollback)');
      exitCode = EXIT_HARD_FAIL;
      verdict = 'HARD-FAIL — external audit зафиксировал изменение intent';
    }
  }

  /* Финальный score и отчёт. */
  if (specText !== specText0 || auditRollback) {
    const cur = readText(specAbs);
    if (cur !== specText) writeText(specAbs, specText);
  }
  const final = runValidate(specAbs);
  const finalJson = final.error ? detJson : final.json;
  writeText(path.join(runDirAbs, 'score-after.json'), `${JSON.stringify(finalJson, null, 2)}\n`);
  writeText(path.join(runDirAbs, 'spec-final.md'), specText);

  if (runnerUnavailable && exitCode === EXIT_CLEAN) {
    verdict = 'прогон завершён с WARN: LLM-раннер недоступен, LLM-фазы пропущены (см. run-log.jsonl)';
  }
  if (oscillation && exitCode === EXIT_CLEAN) verdict = 'STOP (oscillation) — repair loop прекращён';

  const scoreAfter = finalJson.phase0.score;

  /* STOP A (spec 051): auto-approve при score ≥ 85% и нуле hard-fail. */
  const stopA = resolveStopA({
    exitCode,
    score: scoreAfter,
    scoreMax: finalJson.phase0.weightSum,
    hardFailCount: countHardFails(findings),
  });
  stopA.decision = null;
  stopA.decisionsFile = null;
  if (stopA.auto) {
    try {
      const decision = appendAutoDecision(ROOT, {
        date: new Date().toISOString().slice(0, 10),
        stop: 'STOP A',
        specId,
        reason: stopA.reason,
      });
      stopA.decision = decision.line;
      stopA.decisionsFile = toRel(decision.file);
    } catch (e) {
      warnings.push(
        `[auto-decision: запись в DECISIONS.md не удалась — ${e && e.message ? e.message : e}]`,
      );
    }
  }

  const report = renderReport({
    mode: 'apply', specRel, specId, runDirRel, llmCmd, startedAt,
    phaseStatus, scoreBefore, scoreAfter, scoreMax: finalJson.phase0.weightSum, threshold: finalJson.phase0.threshold,
    dimensionsBefore: detJson.phase0.dimensions, dimensionsAfter: finalJson.phase0.dimensions,
    phase1: finalJson.phase1, phase4: finalJson.phase4, sources, findings, applied, skipped: skippedEdits, rolledBack, repair,
    oscillation, auditCalled, auditVerdict, auditRollback, llmCalls, warnings, exitCode, verdict,
    intentBlocked, enrichment, urlValidation, reconcile: reconcileTrail, stopA,
  });
  writeText(path.join(runDirAbs, 'report.md'), report);

  if (opts.json) {
    say(JSON.stringify({
      tool: 'enrich-spec.mjs', mode: 'apply', spec: specRel, specId, runDir: runDirRel, llmCmd,
      runner: runnerPreview.ok === true
        ? { command: runnerPreview.command, via: runnerPreview.via, resolved: runnerPreview.resolved !== false, resolvedExe: runnerPreview.exe, note: runnerPreview.note || null }
        : { resolved: false, reason: runnerPreview.reason },
      keySource: creds.source,
      scoreBefore, scoreAfter, delta: scoreAfter - scoreBefore,
      phases: PHASES.map((p) => ({ n: p.n, name: p.name, executor: p.kind, status: phaseStatus.get(p.n) || 'skipped' })),
      llmCalls, log: logRel, findings: findings.length, appliedEdits: applied.length,
      intentBlocked: intentBlocked.length, enrichment,
      urlValidation: urlValidation ? urlValidation.summary : null,
      reconcile: reconcileTrail.map((r) => ({ phase: r.phase, source: r.source, sha_before: r.sha_before, sha_after: r.sha_after, hunks: r.edits.length, desync: r.desync })),
      auditCalled, auditVerdict, oscillation, exitCode,
      stopA: {
        auto: stopA.auto, score: stopA.score, scorePercent: stopA.scorePercent,
        hardFailCount: stopA.hardFailCount, threshold: stopA.threshold,
        log: stopA.auto ? stopA.log : null, reason: stopA.reason,
        decision: stopA.decision, decisionsFile: stopA.decisionsFile,
      },
    }, null, 2));
  } else {
    say('');
    say(`Score: ${scoreBefore} → ${scoreAfter} (delta ${scoreAfter - scoreBefore >= 0 ? '+' : ''}${scoreAfter - scoreBefore})`);
    say(`LLM-вызовов в логе: ${llmCalls} (${logRel})`);
    say(`Правок применено: ${applied.length}`);
    const hunks = reconcileTrail.reduce((acc, r) => acc + r.edits.length, 0);
    say(`S1 reconcile: hunks/applied_edits в run-log — ${hunks}; edit-фазы: ${reconcileTrail.filter((r) => r.edits.length).map((r) => r.phase).join(', ') || 'нет'}`);
    if (urlValidation && urlValidation.checked) say(`S3 URL validation: ${urlValidation.checked} URL — ok ${urlValidation.summary.ok} / warn ${urlValidation.summary.warn} / dead ${urlValidation.summary.dead} / unverifiable ${urlValidation.summary.unverifiable}`);
    if (intentBlocked.length) say(`Отклонено структурной защитой intent (F2): ${intentBlocked.length}`);
    if (enrichment) say(`Гарантия маркера обогащения (F3): ${enrichment.state}`);
    for (const w of warnings) say(`WARN ${w}`);
    say(`Отчёт: ${posixJoin(runDirRel, 'report.md')}`);
    say(`Итог: ${verdict}`);
    if (stopA.auto) {
      say(stopA.log);
      if (stopA.decision !== null) say(`DECISIONS.md: ${stopA.decision}`);
    } else {
      say(`STOP A: STOP — ${stopA.reason}`);
    }
  }

  // Терминальный исход enrichment: hard-fail (в т.ч. откат Фазы 9) vs успех.
  if (exitCode === EXIT_HARD_FAIL) {
    notifyFireAndForget('gate_failed', `⚠️ Спека ${specId}: правки откатили — внешняя проверка нашла смену замысла. Нужен разбор.`);
  } else if (stopA.auto) {
    notifyFireAndForget('spec_closed', `✅ Спека ${specId}: ${stopA.log} — цепочка идёт дальше без STOP A.`);
  } else {
    notifyFireAndForget('spec_closed', `✅ Спека ${specId}: обогащение готово, оценка выросла ${scoreBefore} → ${scoreAfter}. Жду твоё решение.`);
  }

  process.exit(exitCode);
}

// Запуск CLI только при прямом вызове: импорт модуля (проверка чистых функций
// вроде resolveStopA/appendAutoDecision) не должен исполнять прогон.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    err(`enrich-spec: непредвиденная ошибка — ${e && e.stack ? e.stack : e}`);
    process.exit(EXIT_HARD_FAIL);
  });
}
