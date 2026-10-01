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
 * usage:
 *   npm run spec:enrich -- <spec> [--dry-run] [--out <dir>] [--json]
 *                              [--llm-cmd <cmd>] [--max-iterations <n>]
 *
 * <spec> — путь (.project/specs/040-spec-chain.md) или id (040).
 * По умолчанию каталог прогона: .project/drafts/spec-<NNN>-enrich/.
 *
 * exit 0 — прогон завершён (в т.ч. с WARN [llm: unavailable — ...]);
 * exit 1 — hard-fail (детерминированные фазы или external audit Фазы 10);
 * exit 2 — ошибка использования/чтения.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
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

/** Спека по пути или по id (как в validate-spec.mjs). */
function resolveSpec(spec) {
  if (!spec) return null;
  const direct = path.resolve(ROOT, spec);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const specsDir = path.join(ROOT, '.project/specs');
  if (!fs.existsSync(specsDir)) return null;
  const want = spec.toLowerCase().replace(/\.md$/, '');
  const names = fs.readdirSync(specsDir).filter((n) => n.endsWith('.md')).sort();
  const exact = names.find((n) => n.toLowerCase().replace(/\.md$/, '') === want);
  if (exact) return path.join(specsDir, exact);
  const byId = names.find((n) => n.toLowerCase().split('-')[0] === want);
  return byId ? path.join(specsDir, byId) : null;
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
  '    отклоняются структурно (skip/WARN), дефекты m11/m13 требуют отдельного решения;',
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
  '  "edits":        [{"find":"<точная подстрока спеки>","replace":"<новый текст>","reason":"..."}], // только Фазы 2, 3, 5, 9',
  '  "coverage":     0.0,                                                              // Фаза 8',
  '  "verdict":      "INTENT-PRESERVED" | "INTENT-CHANGED"                             // Фаза 10',
  '}',
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
      ? 'Правки спеки разрешены: каждая правка — литеральная замена `find` → `replace`, `find` обязан встречаться в тексте спеки ровно один раз.'
      : 'Правки спеки запрещены (фаза read-only): поле "edits" верни пустым.',
  ];
  if (extra) head.push('', '## Контекст прогона', '', extra);
  head.push('', '## Текст спеки', '', '<<<SPEC', specText, 'SPEC>>>', '');
  return head.filter((x) => x !== null).join('\n');
}

/* --------------------------------------------------------------- раннер */

function invokeRunner(llmCmd, promptAbs) {
  const parts = String(llmCmd).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { ok: false, reason: 'пустая команда раннера' };
  const [cmd, ...args] = parts;
  const res = spawnSync(cmd, [...args, promptAbs], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: LLM_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  });
  if (res.error) {
    const reason = res.error.code === 'ENOENT'
      ? `раннер не найден: ${cmd}`
      : `раннер не запустился: ${res.error.message}`;
    return { ok: false, reason };
  }
  if (res.status !== 0) {
    const tail = String(res.stderr || '').trim().split('\n').filter(Boolean).slice(-1)[0] || 'без сообщения';
    return { ok: false, reason: `раннер завершился с кодом ${res.status}: ${tail}` };
  }
  const json = extractJson(res.stdout);
  if (!json) return { ok: false, reason: 'раннер не вернул JSON-объект' };
  return { ok: true, result: json };
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
  };

  const inv = invokeRunner(llmCmd, promptAbs);
  if (!inv.ok) {
    entry.status = 'skipped';
    entry.reason = inv.reason;
    return { ok: false, unavailable: true, status: 'skipped', reason: inv.reason, promptRel, promptHash, entry, result: null };
  }

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

/* ------------------------------------------------------------- отчёт */

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

  L.push('## Правки спеки (diff)', '');
  if (model.applied.length) {
    for (const a of model.applied) {
      L.push(`- фаза \`${a.phase}\`: \`${a.find}\` → \`${a.replace}\`${a.reason ? ` — ${a.reason}` : ''}`);
    }
  } else {
    L.push('Правок не применялось.');
  }
  if (model.skipped.length) {
    L.push('', 'Не применены (не найдено уникальное совпадение):');
    for (const s of model.skipped) L.push(`- фаза \`${s.phase}\`: ${s.reason}${s.find ? ` (\`${s.find}\`)` : ''}`);
  }
  if (model.rolledBack && model.rolledBack.length) {
    L.push('', 'Откатано (rollback правок Фазы 9 по вердикту Фазы 10 INTENT-CHANGED):');
    for (const a of model.rolledBack) L.push(`- фаза \`${a.phase}\`: \`${a.find}\` → \`${a.replace}\`${a.reason ? ` — ${a.reason}` : ''}`);
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
  L.push('- поля записи: `phase`, `runner`, `model`, `prompt_hash`, `timestamp`, `status`;');
  L.push('- детерминированные фазы 0, 1, 4 — в `score-before.json` / `score-after.json`.');
  L.push('');

  L.push('## WARN', '');
  if (model.warnings.length) for (const w of model.warnings) L.push(`- ${w}`);
  else L.push('WARN не зафиксировано.');
  L.push('');

  L.push('## Вердикт прогона', '');
  L.push(`- exit code: ${model.exitCode}`);
  L.push(`- итог: ${model.verdict}`);
  L.push('');
  return `${L.join('\n')}\n`;
}

/* ------------------------------------------------------------- вывода */

function printDryRun(det, specRel, specId, runDirRel, llmCmd, hardFail) {
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
  say(`Каталог прогона по умолчанию: ${runDirRel}`);
  say('');
  say(`dry-run: правки не применялись, файлы не создавались.${hardFail ? ' HARD-FAIL детерминированных фаз.' : ''}`);
}

/* ---------------------------------------------------------------- main */

function main() {
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
    printDryRun(detJson, specRel, specId, runDirRel, llmCmd, detHardFail);
    if (opts.json) {
      say(JSON.stringify({
        tool: 'enrich-spec.mjs', mode: 'dry-run', spec: specRel, specId,
        phases: PHASES.map((p) => ({ n: p.n, name: p.name, executor: p.kind, key: p.key })),
        phase0: detJson.phase0, phase1: { count: detJson.phase1.count, passed: detJson.phase1.passed, failed: detJson.phase1.failed, warned: detJson.phase1.warned },
        phase4: { decompositionPresent: detJson.phase4.decompositionPresent, hardFail: detJson.phase4.hardFail },
        runDir: runDirRel, llmCmd, hardFail: detHardFail, dryRun: true,
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
      intentBlocked, enrichment,
    });
    writeText(path.join(runDirAbs, 'report.md'), report);
    say(`отчёт: ${posixJoin(runDirRel, 'report.md')}`);
    process.exit(EXIT_HARD_FAIL);
  }

  const ctx = { specRel, specId, specText: specText0, runDirAbs, runDirRel, llmCmd, logAbs, skill };
  let specText = specText0;
  let llmCalls = 0;
  let runnerUnavailable = false;

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
    const res = callLlmPhase(ctx, phase, { extra });
    if (!res.ok) {
      commitLlmPhase(ctx, phase, res);
      phaseStatus.set(phase.n, 'skipped');
      runnerUnavailable = true;
      warnings.push(`[llm: unavailable — ${res.reason}] (Фаза ${phase.n}, промпт-пак: \`${res.promptRel}\`)`);
      llmCalls += 1;
      continue;
    }
    llmCalls += 1;
    const result = res.result || {};
    const patch = {};
    if (Array.isArray(result.sources)) sources.push(...result.sources);
    if (Array.isArray(result.findings)) {
      for (const f of result.findings) findings.push({ ...f, phase: phase.key });
    }
    if (phase.edits && Array.isArray(result.edits) && result.edits.length) {
      const split = splitIntentEdits(specText, result.edits);
      if (split.blocked.length) {
        patch.status = 'warn';
        patch.fields = { intent_blocked: split.blocked };
        for (const b of split.blocked) {
          intentBlocked.push({ phase: phase.key, ...b });
          warnings.push(`[intent-protected — секция «${b.section}» (стр. ${b.line}): правка не применена; дефект класса m11/m13 требует отдельного решения]`);
        }
      }
      const out = applyEdits(specText, split.allowed, phase.key);
      specText = out.text;
      ctx.specText = specText;
      applied.push(...out.applied);
      skippedEdits.push(...out.skipped);
      if (out.applied.length) commitSpec(specText);
    } else if (!phase.edits && Array.isArray(result.edits) && result.edits.length) {
      skippedEdits.push({ phase: phase.key, reason: 'фаза read-only: правки запрещены' });
    }
    if (phase.n === 2) {
      const guard = ensureEnrichedMarker(specText, sources);
      enrichment = { state: guard.state, marker: guard.marker || null, line: guard.line || null, reason: guard.reason || null };
      if (guard.state === 'injected') {
        specText = guard.text;
        ctx.specText = specText;
        commitSpec(specText);
        applied.push({ phase: '2-research#enrichment-guard', find: '—', replace: guard.bullet, reason: `гарантия F3: маркер ${guard.marker}` });
        patch.fields = { ...(patch.fields || {}), enriched_injected: true, enriched_marker: guard.marker };
      } else if (guard.state === 'no-section' || guard.state === 'no-source') {
        patch.status = 'warn';
        patch.fields = { ...(patch.fields || {}), enriched_guarantee: 'failed', enriched_reason: guard.reason };
        warnings.push(`[enriched: not guaranteed — ${guard.reason}] (Фаза 2)`);
      } else {
        patch.fields = { ...(patch.fields || {}), enriched_injected: false, enriched_note: 'маркер уже присутствовал в спеке' };
      }
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
    const res = callLlmPhase(ctx, phase9, { extra, iteration: i });
    llmCalls += 1;
    if (!res.ok) {
      commitLlmPhase(ctx, phase9, res);
      phaseStatus.set(9, 'skipped');
      runnerUnavailable = true;
      warnings.push(`[llm: unavailable — ${res.reason}] (Фаза 9, итерация ${i}, промпт-пак: \`${res.promptRel}\`)`);
      repair.push({ iteration: i, decision: 'runner-unavailable', scoreBefore: currentScore, scoreAfter: currentScore, applied: 0 });
      break;
    }
    const allEdits = Array.isArray(res.result.edits) ? res.result.edits : [];
    if (!allEdits.length) {
      commitLlmPhase(ctx, phase9, res);
      phaseStatus.set(9, res.entry.status);
      repair.push({ iteration: i, decision: 'no-edits', scoreBefore: currentScore, scoreAfter: currentScore, applied: 0 });
      break;
    }
    const split = splitIntentEdits(specText, allEdits);
    const patch = {};
    if (split.blocked.length) {
      patch.status = 'warn';
      patch.fields = { intent_blocked: split.blocked };
      for (const b of split.blocked) {
        intentBlocked.push({ phase: `9-repair#${i}`, ...b });
        warnings.push(`[intent-protected — секция «${b.section}» (стр. ${b.line}): правка не применена; дефект класса m11/m13 требует отдельного решения]`);
      }
    }
    const edits = split.allowed;
    if (!edits.length) {
      commitLlmPhase(ctx, phase9, res, patch);
      phaseStatus.set(9, res.entry.status);
      repair.push({ iteration: i, decision: 'intent-blocked', scoreBefore: currentScore, scoreAfter: currentScore, applied: 0 });
      break;
    }
    const snapshot = specText;
    const snapshotScore = currentScore;
    const out = applyEdits(specText, edits, `9-repair#${i}`);
    if (!out.applied.length) {
      commitLlmPhase(ctx, phase9, res, patch);
      phaseStatus.set(9, res.entry.status);
      repair.push({ iteration: i, decision: 'no-matching-edits', scoreBefore: currentScore, scoreAfter: currentScore, applied: 0 });
      skippedEdits.push(...out.skipped);
      break;
    }
    skippedEdits.push(...out.skipped);
    mkdirp(path.join(runDirAbs, `repair-${i}`));
    writeText(path.join(runDirAbs, `repair-${i}`, 'spec-before.md'), snapshot);
    writeText(path.join(runDirAbs, `repair-${i}`, 'score-before.json'), `${JSON.stringify(checks.error ? {} : checks.json, null, 2)}\n`);
    writeText(specAbs, out.text);
    const after = runValidate(specAbs);
    const newScore = after.error ? snapshotScore : after.json.phase0.score;
    if (newScore < snapshotScore) {
      writeText(specAbs, snapshot);
      specText = snapshot;
      ctx.specText = specText;
      currentScore = snapshotScore;
      commitLlmPhase(ctx, phase9, res, patch);
      phaseStatus.set(9, res.entry.status);
      repair.push({ iteration: i, decision: 'reverted', scoreBefore: snapshotScore, scoreAfter: newScore, applied: out.applied.length });
      warnings.push(`Фаза 9, итерация ${i}: score упал ${snapshotScore} → ${newScore}, правки откатаны (rollback)`);
      continue;
    }
    specText = out.text;
    ctx.specText = specText;
    applied.push(...out.applied);
    repairApplied.push(...out.applied);
    currentScore = newScore;
    writeText(path.join(runDirAbs, `repair-${i}`, 'spec-accepted.md'), specText);
    commitLlmPhase(ctx, phase9, res, patch);
    phaseStatus.set(9, res.entry.status);
    repair.push({ iteration: i, decision: 'accepted', scoreBefore: snapshotScore, scoreAfter: newScore, applied: out.applied.length });
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
  const audit = callLlmPhase(ctx, phase10, { extra: auditExtra });
  llmCalls += 1;
  if (!audit.ok) {
    commitLlmPhase(ctx, phase10, audit);
    phaseStatus.set(10, 'skipped');
    runnerUnavailable = true;
    warnings.push(`[llm: unavailable — ${audit.reason}] (Фаза 10, промпт-пак: \`${audit.promptRel}\`)`);
  } else {
    auditCalled = true;
    auditVerdict = String((audit.result && audit.result.verdict) || '—');
    commitLlmPhase(ctx, phase10, audit);
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
  const report = renderReport({
    mode: 'apply', specRel, specId, runDirRel, llmCmd, startedAt,
    phaseStatus, scoreBefore, scoreAfter, scoreMax: finalJson.phase0.weightSum, threshold: finalJson.phase0.threshold,
    dimensionsBefore: detJson.phase0.dimensions, dimensionsAfter: finalJson.phase0.dimensions,
    phase1: finalJson.phase1, phase4: finalJson.phase4, sources, findings, applied, skipped: skippedEdits, rolledBack, repair,
    oscillation, auditCalled, auditVerdict, auditRollback, llmCalls, warnings, exitCode, verdict,
    intentBlocked, enrichment,
  });
  writeText(path.join(runDirAbs, 'report.md'), report);

  if (opts.json) {
    say(JSON.stringify({
      tool: 'enrich-spec.mjs', mode: 'apply', spec: specRel, specId, runDir: runDirRel, llmCmd,
      scoreBefore, scoreAfter, delta: scoreAfter - scoreBefore,
      phases: PHASES.map((p) => ({ n: p.n, name: p.name, executor: p.kind, status: phaseStatus.get(p.n) || 'skipped' })),
      llmCalls, log: logRel, findings: findings.length, appliedEdits: applied.length,
      intentBlocked: intentBlocked.length, enrichment,
      auditCalled, auditVerdict, oscillation, exitCode,
    }, null, 2));
  } else {
    say('');
    say(`Score: ${scoreBefore} → ${scoreAfter} (delta ${scoreAfter - scoreBefore >= 0 ? '+' : ''}${scoreAfter - scoreBefore})`);
    say(`LLM-вызовов в логе: ${llmCalls} (${logRel})`);
    say(`Правок применено: ${applied.length}`);
    if (intentBlocked.length) say(`Отклонено структурной защитой intent (F2): ${intentBlocked.length}`);
    if (enrichment) say(`Гарантия маркера обогащения (F3): ${enrichment.state}`);
    for (const w of warnings) say(`WARN ${w}`);
    say(`Отчёт: ${posixJoin(runDirRel, 'report.md')}`);
    say(`Итог: ${verdict}`);
  }

  process.exit(exitCode);
}

main();
