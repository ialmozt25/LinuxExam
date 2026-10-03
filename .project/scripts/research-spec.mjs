#!/usr/bin/env node
/**
 * research-spec.mjs — research-фаза цепочки спеки до enrich (spec 051, Шаг 0.5).
 *
 * Четыре фазы (детерминированный каркас, без LLM-раннера):
 *   1. plan      — 3–5 вопросов из цели/критериев спеки (детерминированно);
 *   2. search    — веб-поиск (Tavily, если задан `TAVILY_API_KEY`) и/или обход
 *                  репозитория (артефакты памяти, скрипты, решения, алерты);
 *   3. reflect   — дедуп по URL, ранжирование по tier, противоречия и пробелы;
 *   4. synthesize— `.project/drafts/spec-<id>-research.md`
 *                  («Best practices (с URL)» / «Risks» / «Recommendations»)
 *                  + строка решения «подход X, потому что Y» в `.project/DECISIONS.md`.
 *
 * Деградация (spec 051): веб недоступен (нет ключа, 403, таймаут, DNS) — это НЕ
 * STOP: печатается WARN `[research: skipped — no network]`, research выполняется
 * только по репозиторию, прогон продолжается с exit 0.
 *
 * usage:
 *   npm run research:spec -- <spec> [--out <path>] [--max-questions <n>] [--no-web]
 *                                 [--no-decision] [--json]
 *
 * <spec> — путь (.project/specs/051-autonomous-spec-chain.md) или id (051).
 *
 * exit 0 — research выполнен (в т.ч. repo-only с WARN);
 * exit 1 — непредвиденная ошибка ввода-вывода;
 * exit 2 — ошибка использования: нет <spec>, спека не найдена/не читается.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень репозитория (скрипт лежит в `<repo>/.project/scripts/`). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Корни поиска спеки: спеки, затем черновики (как в enrich-spec.mjs, S6). */
export const SPEC_ROOTS = ['.project/specs', '.project/drafts'];

/** Каталог артефактов research-фазы. */
export const DRAFTS_REL = '.project/drafts';

/** Журнал решений (append-only, правило 8). */
export const DECISIONS_REL = '.project/DECISIONS.md';

/** Заголовок секции research-решений: создаётся один раз при первой записи. */
export const RESEARCH_DECISIONS_HEADING = '## Research decisions (spec 051)';

/** Endpoint и лимиты веб-поиска (Tavily). */
const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const TAVILY_TIMEOUT_MS = Number(process.env.SPEC_RESEARCH_TIMEOUT_MS || 8000);
const WEB_RESULTS_PER_QUERY = 3;

/** Границы числа вопросов фазы plan (spec 051: 3–5). */
export const MIN_QUESTIONS = 3;
export const MAX_QUESTIONS = 5;

/** Ключи ключевых артефактов памяти репозитория для repo-only research. */
const MEMORY_FILES = [
  'docs/memory/procedural.md',
  'docs/memory/alerts.md',
  '.project/DECISIONS.md',
  'docs/memory/episodic.md',
];

/* ------------------------------------------------------------------ утилиты */

function say(line) {
  process.stdout.write(`${line}\n`);
}

function err(line) {
  process.stderr.write(`${line}\n`);
}

async function readTextIfExists(abs) {
  try {
    return await fsp.readFile(abs, 'utf8');
  } catch {
    return null;
  }
}

function toRel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function errorCodeOf(error) {
  const code = error !== null && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' ? code : 'UNKNOWN';
}

/* --------------------------------------------------------------- разбор спеки */

/**
 * Разбор спеки: frontmatter, H1, цели из «## Цель», критерии из
 * «## Критерии приёмки», пункты «## Что делаем». Парсер намеренно минимальный.
 * @param {string} raw - содержимое файла спеки.
 */
export function parseSpec(raw) {
  const lines = raw.split(/\r?\n/);
  const fm = {};
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      if (lines[index].trim() === '---') break;
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[index]);
      if (match !== null) fm[match[1]] = match[2].trim();
    }
  }
  const section = (name) => {
    const out = [];
    // `\b` после кириллицы в JS не работает: границу секции даёт (?=\s|$).
    const head = new RegExp(`^##\\s+${name}(?=\\s|$)`);
    let inside = false;
    for (const line of lines) {
      if (/^##\s+/.test(line)) {
        inside = head.test(line);
        continue;
      }
      if (!inside) continue;
      const match = /^\s*(?:\d+\.|[-*])\s+(.*)$/.exec(line);
      if (match !== null && match[1].trim() !== '') out.push(match[1].trim());
    }
    return out;
  };
  const title = lines.find((line) => line.startsWith('# '));
  return {
    fmId: fm['id'] ?? null,
    slug: fm['slug'] ?? null,
    type: fm['type'] ?? null,
    status: fm['status'] ?? null,
    title: title === undefined ? '' : title.slice(2).trim(),
    goals: section('Цель'),
    criteria: section('Критерии приёмки'),
    actions: section('Что делаем'),
  };
}

/** Найти спеку по id или пути. */
export async function resolveSpec(specArg) {
  const direct = path.resolve(ROOT, specArg);
  const directText = await readTextIfExists(direct);
  if (directText !== null) {
    const parsed = parseSpec(directText);
    return { ok: true, path: direct, relative: toRel(direct), text: directText, spec: parsed };
  }
  const id = String(specArg ?? '').replace(/\.md$/i, '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    return { ok: false, error: `недопустимый spec-id: ${specArg}` };
  }
  for (const root of SPEC_ROOTS) {
    const dir = path.join(ROOT, root);
    let entries;
    try {
      entries = await fsp.readdir(dir);
    } catch {
      continue;
    }
    const exact = entries.find((name) => name === `${id}.md`);
    const candidates = entries.filter((name) => name.startsWith(`${id}-`) && name.endsWith('.md'));
    const picked = exact ?? (candidates.length === 1 ? candidates[0] : null);
    if (picked === null) continue;
    const abs = path.join(dir, picked);
    const text = await readTextIfExists(abs);
    if (text === null) continue;
    return { ok: true, path: abs, relative: toRel(abs), text, spec: parseSpec(text) };
  }
  return { ok: false, error: `спека "${specArg}" не найдена (проверены ${SPEC_ROOTS.join(', ')})` };
}

/* ----------------------------------------------------------------- фаза plan */

/** Стоп-слова: служебная лексика, которая давала бы шум вместо темы research. */
const STOP_WORDS = new Set([
  'снять', 'снимать', 'выполнении', 'выполнение', 'технических', 'технический',
  'явная', 'явный', 'формулировка', 'должна', 'должен', 'можно', 'будет',
  'чтобы', 'этого', 'также', 'после', 'перед', 'через', 'если', 'либо', 'только',
  'каждой', 'каждая', 'вместо', 'нужно', 'более', 'менее', 'иначе', 'затем',
]);

/** Ключевые слова темы: слова длиной ≥ 5 из заголовка, целей и критериев. */
export function keywordsOf(spec) {
  const source = [spec.title, ...spec.goals, ...spec.criteria].join(' ');
  const words = source
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !STOP_WORDS.has(word));
  return [...new Set(words)].slice(0, 8);
}

/**
 * Фаза plan: 3–5 вопросов по спеке (детерминированно, без модели). Вопросы
 * покрывают три обязательных разреза: практики, риски, проверка.
 * @returns {{id: string, text: string, kind: string}[]}
 */
export function buildQuestions(spec, limit = MAX_QUESTIONS) {
  const topic =
    spec.title !== ''
      ? spec.title
      : spec.slug !== null && spec.slug !== ''
        ? `spec-${spec.fmId ?? ''} (${spec.slug})`
        : `spec-${spec.fmId ?? ''}`;
  const candidate = [
    { id: 'q1', kind: 'practices', text: `Какие проверенные практики (best practices) применимы к «${topic}»?` },
    { id: 'q2', kind: 'risks', text: `Какие риски и типовые ошибки связаны с «${topic}»?` },
    { id: 'q3', kind: 'verification', text: `Как независимо проверить результат «${topic}» (команды, метрики, гейты)?` },
    {
      id: 'q4',
      kind: 'precedent',
      text: `Какие прецеденты и решения уже зафиксированы в репозитории по теме «${topic}»?`,
    },
    {
      id: 'q5',
      kind: 'alternatives',
      text: `Какие альтернативные подходы к «${topic}» существуют и почему они хуже выбранного?`,
    },
  ];
  const wanted = Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, Number(limit) || MAX_QUESTIONS));
  return candidate.slice(0, wanted);
}

/* --------------------------------------------------------------- фаза search */

/** Веб-поиск через Tavily. Никогда не бросает: любая ошибка → `{ok:false}`. */
export async function webSearch(query, apiKey) {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return { ok: false, results: [], reason: 'TAVILY_API_KEY не задан' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);
  try {
    const response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey.trim(),
        query,
        max_results: WEB_RESULTS_PER_QUERY,
        search_depth: 'basic',
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, results: [], reason: `HTTP ${response.status}` };
    }
    const payload = await response.json();
    const results = (Array.isArray(payload?.results) ? payload.results : []).map((item) => ({
      title: String(item?.title ?? '').slice(0, 160),
      url: String(item?.url ?? ''),
      snippet: String(item?.content ?? '').replace(/\s+/g, ' ').slice(0, 300),
      tier: 1,
    }));
    return { ok: true, results, reason: null };
  } catch (error) {
    const aborted = error !== null && typeof error === 'object' && error.name === 'AbortError';
    return {
      ok: false,
      results: [],
      reason: aborted ? `таймаут ${TAVILY_TIMEOUT_MS} мс` : `${errorCodeOf(error)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Совпадения ключевых слов темы в артефакте памяти (repo-only research). */
export async function scanMemoryFile(rel, keywords) {
  const text = await readTextIfExists(path.join(ROOT, rel));
  if (text === null) return { rel, found: false, matches: 0, examples: [] };
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (const [index, line] of lines.entries()) {
    const lower = line.toLowerCase();
    if (keywords.some((word) => lower.includes(word))) {
      hits.push({ line: index + 1, text: line.trim().slice(0, 200) });
      if (hits.length >= 3) break;
    }
  }
  return { rel, found: true, matches: hits.length, examples: hits };
}

/** Пути из текста спеки (файлы/каталоги), упомянутые в обратных кавычках. */
export function referencedPaths(specText) {
  const ticks = [...specText.matchAll(/`([^`\n]{3,120})`/g)].map((match) => match[1].trim());
  const paths = ticks.filter((tick) => /^[\w./-]+\.(mjs|cjs|js|ts|tsx|json|md|ya?ml)$/.test(tick));
  return [...new Set(paths)].slice(0, 20);
}

/** Каталоги, в которых ищется упомянутое в спеке имя файла без пути. */
const REFERENCE_DIRS = [
  '.project/scripts',
  '.project/specs',
  '.project/drafts',
  '.project',
  'docs',
  'docs/memory',
  'docs/spec-chain/skills/run-spec-chain',
  '.githooks',
  'e2e',
  'templates/mas',
  '.',
];

/** Тип существующего пути (`file` | `dir`) либо `null`. */
async function statKind(abs) {
  try {
    const stat = await fsp.stat(abs);
    return stat.isDirectory() ? 'dir' : 'file';
  } catch {
    return null;
  }
}

/**
 * Разрешить упомянутый в спеке путь. Спека часто называет файлы без пути
 * (`alerts.md`, `run-spec.mjs`) — такие имена ищутся в известных каталогах
 * репозитория, иначе они давали бы ложный «пробел».
 * @returns {{rel: string, kind: string|null, resolved: string|null}}
 */
export async function resolveReferenced(rel) {
  const direct = await statKind(path.join(ROOT, rel));
  if (direct !== null) return { rel, kind: direct, resolved: rel };
  if (rel.includes('/') || rel.includes('\\')) return { rel, kind: null, resolved: null };
  for (const dir of REFERENCE_DIRS) {
    const candidate = path.join(ROOT, dir, rel);
    const kind = await statKind(candidate);
    if (kind !== null) return { rel, kind, resolved: toRel(candidate) };
  }
  return { rel, kind: null, resolved: null };
}

/**
 * repo-only фаза поиска: артефакты памяти по ключевым словам + существование
 * путей, упомянутых в спеке. Всегда доступна (не требует сети).
 */
export async function repoSearch(spec, specText) {
  const keywords = keywordsOf(spec);
  const memory = [];
  for (const rel of MEMORY_FILES) memory.push(await scanMemoryFile(rel, keywords));
  const referenced = referencedPaths(specText);
  const existing = [];
  for (const rel of referenced) existing.push(await resolveReferenced(rel));
  const scripts = await fsp.readdir(path.join(ROOT, '.project', 'scripts')).catch(() => []);
  return {
    keywords,
    memory,
    referenced: existing,
    scripts: scripts.filter((name) => name.endsWith('.mjs')).length,
    criteria: spec.criteria.length,
    tasks: (specText.match(/^\s*\d+\.\s+`?id:\s*t\d+/gm) ?? []).length,
  };
}

/* -------------------------------------------------------------- фаза reflect */

/** Дедуп по URL, сортировка по tier и порядку вопроса. */
export function reflect(search) {
  const seen = new Set();
  const web = [];
  for (const item of search.web) {
    const key = item.url === '' ? `${item.title}|${item.snippet}` : item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    web.push(item);
  }
  const gaps = [];
  if (search.web.length === 0) gaps.push('внешние источники недоступны — best practices не подтверждены веб-источниками');
  if (search.repo.memory.every((entry) => entry.matches === 0)) {
    gaps.push('в артефактах памяти репозитория нет упоминаний ключевых слов темы');
  }
  const absent = search.repo.referenced.filter((item) => item.kind === null).map((item) => item.rel);
  if (absent.length > 0) gaps.push(`упомянуты, но отсутствуют в репозитории: ${absent.join(', ')}`);
  return { web, gaps, keywords: search.repo.keywords };
}

/* ----------------------------------------------------------- фаза synthesize */

/** Строка research-решения: `DATE | research | spec-ID | approach:… | reason:…`. */
export function formatResearchDecision(entry) {
  return `${entry.date} | research | spec-${entry.specId} | approach:${entry.approach} | reason:${entry.reason}`;
}

/**
 * Дописать research-решение в конец `.project/DECISIONS.md` (append-only, LF).
 * Секция `## Research decisions (spec 051)` добавляется один раз.
 * @returns {{file: string, line: string, created: boolean}}
 */
export async function appendResearchDecision(root, entry) {
  const file = path.join(root, DECISIONS_REL);
  let current = '';
  try {
    current = await fsp.readFile(file, 'utf8');
  } catch {
    current = '';
  }
  const line = formatResearchDecision(entry);
  const hasSection = current.includes(RESEARCH_DECISIONS_HEADING);
  const glue = current === '' || current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  const addition = hasSection ? `${line}\n` : `${glue}${RESEARCH_DECISIONS_HEADING}\n\n${line}\n`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.appendFile(file, addition, 'utf8');
  return { file, line, created: !hasSection };
}

/**
 * Решение «подход X, потому что Y» по итогам фаз: с веб-источниками подход
 * опирается на внешние практики, без них — на прецеденты репозитория.
 */
export function resolveApproach(reflected, webAvailable) {
  if (webAvailable && reflected.web.length > 0) {
    return {
      approach: 'идти по внешним практикам tier 1-2 и подтверждать их гейтами репозитория',
      reason: `веб-источников ${reflected.web.length}; внутренние прецеденты — ${reflected.keywords.length} ключей`,
    };
  }
  return {
    approach: 'идти по прецедентам репозитория (procedural.md, DECISIONS.md, alerts.md) и требованиям спеки',
    reason: 'внешние источники недоступны (repo-only); риски подтверждаются только внутренними артефактами',
  };
}

/** Собрать markdown-артефакт research-фазы. */
export function renderResearch(model) {
  const L = [];
  L.push(`# Research — спека ${model.specId}${model.slug === null ? '' : ` (${model.slug})`}`);
  L.push('');
  L.push(`- дата: ${model.date}`);
  L.push(`- спека: \`${model.specRel}\` (type: ${model.type ?? '—'}, status: ${model.status ?? '—'})`);
  L.push(`- режим: ${model.webAvailable ? 'web + repo' : 'repo-only (веб недоступен)'}`);
  L.push(`- вопросы фазы plan: ${model.questions.length}; веб-источников после дедупа: ${model.reflected.web.length}`);
  if (!model.webAvailable) L.push(`- WARN: \`[research: skipped — no network]\` — ${model.webReason}`);
  L.push('');

  L.push('## Best practices (с URL)', '');
  if (model.reflected.web.length > 0) {
    for (const item of model.reflected.web) {
      L.push(`- [${item.title || item.url}](${item.url}) — ${item.snippet} _(tier ${item.tier}, вопрос ${item.questionId})_`);
    }
  } else {
    L.push('- Внешние источники недоступны — раздел заполнен внутренними артефактами (tier: repo).');
  }
  for (const entry of model.repo.memory) {
    if (entry.matches === 0) continue;
    L.push(`- \`${entry.rel}\` — ${entry.matches} релевантных ${entry.matches === 1 ? 'строка' : 'строк'} по ключам темы; пример: \`${entry.examples[0].text}\` (L${entry.examples[0].line})`);
  }
  const present = [];
  const seenResolved = new Set();
  for (const item of model.repo.referenced) {
    if (item.kind === null) continue;
    const resolved = item.resolved ?? item.rel;
    if (seenResolved.has(resolved)) continue;
    seenResolved.add(resolved);
    present.push({ ...item, resolved });
  }
  if (present.length > 0) {
    L.push(`- Пути, упомянутые в спеке и существующие в репозитории: ${present.map((item) => `\`${item.resolved}\` (${item.kind})`).join(', ')}`);
  }
  L.push(`- Контекст репозитория: ${model.repo.scripts} CLI-скриптов в \`.project/scripts/\`, критериев в спеке — ${model.repo.criteria}, задач в декомпозиции — ${model.repo.tasks}.`);
  L.push('');

  L.push('## Risks', '');
  if (model.reflected.gaps.length > 0) {
    for (const gap of model.reflected.gaps) L.push(`- ${gap}`);
  }
  L.push(`- Ключевые слова темы (${model.reflected.keywords.length}): ${model.reflected.keywords.join(', ') || '—'} — при пустом наборе research вырождается в общий обзор.`);
  L.push(`- Research не заменяет STOP-точку A: её условие считается по score/hard-fail прогона \`spec:enrich\`.`);
  if (!model.webAvailable) {
    L.push('- Веб недоступен: внешние практики не проверены; при появлении сети research стоит перезапустить с ключом `TAVILY_API_KEY`.');
  }
  L.push('');

  L.push('## Recommendations', '');
  L.push(`- **Подход:** ${model.approach.approach}, потому что ${model.approach.reason}.`);
  L.push(`- Применить находки в Шаге 1 (enrich): учитывать их при правках Фазы 9 и в tiered sources.`);
  L.push(`- Проверка результата — гейты цепочки: \`npm run typecheck\`, \`npm run test:run\`, \`npm run sync:check\`.`);
  for (const item of model.reflected.web.slice(0, 3)) {
    L.push(`- Внешний ориентир: ${item.url}`);
  }
  L.push('');

  L.push('## Вопросы фазы plan', '');
  for (const question of model.questions) L.push(`- \`${question.id}\` (${question.kind}): ${question.text}`);
  L.push('');
  return `${L.join('\n')}\n`;
}

/* --------------------------------------------------------------------- main */

const USAGE = [
  'usage: node .project/scripts/research-spec.mjs <spec> [--out <path>] [--max-questions <n>]',
  '       [--no-web] [--no-decision] [--json]',
  '',
  'Research-фаза цепочки спеки (spec 051, Шаг 0.5): plan → search → reflect → synthesize.',
  'Артефакт по умолчанию: .project/drafts/spec-<id>-research.md.',
  'Веб недоступен → WARN [research: skipped — no network], repo-only research, exit 0.',
  '',
  'Аргументы:',
  '  <spec>               путь к спеке или её id (051)',
  '',
  'Флаги:',
  '  --out <path>         путь артефакта (по умолчанию .project/drafts/spec-<id>-research.md)',
  '  --max-questions <n>  число вопросов фазы plan, 3–5 (по умолчанию 5)',
  '  --no-web             не обращаться к вебу: только репозиторий (режим repo-only)',
  '  --no-decision        не дописывать строку решения в .project/DECISIONS.md',
  '  --json               машиночитаемая сводка в stdout',
  '  -h, --help           эта справка',
].join('\n');

/** Разбор argv: `{ok, options}` либо `{ok:false, error, exitCode}`. */
export function parseArgs(argv) {
  const options = { positional: [], out: null, maxQuestions: MAX_QUESTIONS, noWeb: false, noDecision: false, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inline] = arg.startsWith('--') ? arg.split('=', 2) : [arg, undefined];
    const takeValue = () => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };
    if (arg === '-h' || flag === '--help') {
      options.help = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      options.positional.push(arg);
      continue;
    }
    switch (flag) {
      case '--out': {
        const raw = takeValue();
        if (raw === undefined || raw.trim() === '') return { ok: false, error: 'флаг --out требует значение', exitCode: 2 };
        options.out = raw.trim();
        break;
      }
      case '--max-questions': {
        const value = Number(takeValue());
        if (!Number.isFinite(value) || value < MIN_QUESTIONS || value > MAX_QUESTIONS) {
          return { ok: false, error: `флаг --max-questions требует число ${MIN_QUESTIONS}–${MAX_QUESTIONS}`, exitCode: 2 };
        }
        options.maxQuestions = value;
        break;
      }
      case '--no-web':
        options.noWeb = true;
        break;
      case '--no-decision':
        options.noDecision = true;
        break;
      case '--json':
        options.json = true;
        break;
      default:
        return { ok: false, error: `неизвестный флаг: ${flag}`, exitCode: 2 };
    }
  }
  if (options.positional.length > 1) return { ok: false, error: `лишний аргумент: ${options.positional[1]}`, exitCode: 2 };
  if (options.positional.length === 0) return { ok: false, error: 'не задан <spec>', exitCode: 2 };
  return { ok: true, options };
}

/**
 * Полный сценарий research-фазы. Никогда не бросает на ожидаемых состояниях:
 * возвращает `{exitCode, report}`.
 * @param {object} options - разобранные опции.
 */
export async function researchSpec(options) {
  const startedAtMs = Date.now();
  const resolved = await resolveSpec(options.positional[0]);
  if (!resolved.ok) {
    return { exitCode: 2, report: { tool: 'research-spec', ok: false, error: resolved.error } };
  }
  const spec = resolved.spec;
  const specId = spec.fmId ?? path.basename(resolved.path).replace(/\.md$/i, '');

  /* 1. plan */
  const questions = buildQuestions(spec, options.maxQuestions);

  /* 2. search: веб (если разрешён) + репозиторий */
  const apiKey = process.env.TAVILY_API_KEY;
  const web = [];
  let webAvailable = false;
  let webReason = options.noWeb ? 'флаг --no-web' : '';
  if (!options.noWeb) {
    for (const question of questions) {
      const result = await webSearch(question.text, apiKey);
      if (!result.ok) {
        webAvailable = false;
        webReason = result.reason ?? 'неизвестная причина';
        web.length = 0;
        break;
      }
      webAvailable = true;
      for (const item of result.results) web.push({ ...item, questionId: question.id });
    }
  }
  const repo = await repoSearch(spec, resolved.text);

  /* 3. reflect */
  const reflected = reflect({ web, repo });

  /* 4. synthesize */
  const date = new Date().toISOString().slice(0, 10);
  const approach = resolveApproach(reflected, webAvailable);
  const artifactRel = options.out ?? `${DRAFTS_REL}/spec-${specId}-research.md`;
  const artifactAbs = path.isAbsolute(artifactRel) ? artifactRel : path.join(ROOT, artifactRel);
  const markdown = renderResearch({
    specId, slug: spec.slug, specRel: resolved.relative, type: spec.type, status: spec.status,
    date, questions, reflected, repo, webAvailable, webReason, approach,
  });
  await fsp.mkdir(path.dirname(artifactAbs), { recursive: true });
  await fsp.writeFile(artifactAbs, markdown, 'utf8');

  let decision = null;
  if (!options.noDecision) {
    decision = await appendResearchDecision(ROOT, {
      date, specId, approach: approach.approach, reason: approach.reason,
    });
  }

  const report = {
    tool: 'research-spec',
    ok: true,
    spec: specId,
    slug: spec.slug,
    specFile: resolved.relative,
    mode: webAvailable ? 'web+repo' : 'repo-only',
    phases: [
      { name: 'plan', status: 'ok', detail: `вопросов: ${questions.length}` },
      {
        name: 'search',
        status: webAvailable ? 'ok' : 'warn',
        detail: webAvailable
          ? `веб: ${web.length} результатов по ${questions.length} вопросам; repo: ${repo.memory.filter((e) => e.matches > 0).length} артефакт(ов) памяти`
          : `WARN [research: skipped — no network] — ${webReason}; repo-only: ${repo.memory.filter((e) => e.matches > 0).length} артефакт(ов) памяти`,
      },
      { name: 'reflect', status: 'ok', detail: `дедуп: ${web.length} → ${reflected.web.length} веб-источников; пробелов: ${reflected.gaps.length}` },
      { name: 'synthesize', status: 'ok', detail: `${artifactRel}${decision === null ? '' : `; DECISIONS.md: ${decision.line}`}` },
    ],
    warning: webAvailable ? null : `[research: skipped — no network] — ${webReason}`,
    artifact: artifactRel,
    decision: decision === null ? null : { line: decision.line, file: toRel(decision.file), created: decision.created },
    approach,
    keywords: reflected.keywords,
    webSources: reflected.web.length,
    gaps: reflected.gaps,
    elapsedMs: Date.now() - startedAtMs,
  };

  if (!options.json) {
    say(`research-spec — research-фаза спеки ${specId} (spec 051, Шаг 0.5)`);
    say(`спека: ${resolved.relative} (type: ${spec.type ?? '—'})`);
    say(`режим: ${report.mode}`);
    for (const phase of report.phases) say(`  ${phase.name} — ${phase.status}: ${phase.detail}`);
    if (report.warning !== null) say(`WARN ${report.warning}`);
    else for (const source of reflected.web) say(`  источник: ${source.url}`);
    for (const gap of reflected.gaps) say(`  пробел: ${gap}`);
    say(`подход: ${approach.approach}`);
    say(`артефакт: ${artifactRel}`);
    if (decision !== null) say(`DECISIONS.md: ${decision.line}`);
  }
  return { exitCode: 0, report };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    err(`${parsed.error}\n\n${USAGE}`);
    process.exitCode = parsed.exitCode;
    return;
  }
  if (parsed.options.help) {
    say(USAGE);
    return;
  }
  let outcome;
  try {
    outcome = await researchSpec(parsed.options);
  } catch (error) {
    err(`research-spec: непредвиденная ошибка — ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  if (parsed.options.json) say(JSON.stringify(outcome.report, null, 2));
  process.exitCode = outcome.exitCode;
}

// Запуск CLI только при прямом вызове: импорт не должен выполнять research.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
