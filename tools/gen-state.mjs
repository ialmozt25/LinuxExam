#!/usr/bin/env node
/**
 * tools/gen-state.mjs — сборщик данных для .project/state.json.
 *
 * M3.2: единый источник правды о состоянии проекта.
 *
 * Источники:
 *   - src/data/questions/_topics.json          -> goal.current_questions + topics[].count
 *   - src/data/topics.ts                       -> topics[].label (человеческие имена тем)
 *   - .project/PLAN.md                         -> milestones (чек-листы + заголовки-секции)
 *   - .project/drafts/m2.8g-decision.yaml      -> issues_open (js-yaml, !!js -> !!str)
 *   - git log -5                               -> recent_commits
 *   - npm run qc / typecheck / test:run / shuffle-bank:check -> gates
 *
 * Запись: UTF-8 без BOM, LF-only, корень — объект, последний байт 0x0A.
 *
 * Флаги:
 *   --no-gates   пропустить прогон гейтов (переиспользовать прошлые значения gates)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);
const NO_GATES = process.argv.includes('--no-gates');

const TARGET_QUESTIONS = 300;
const STATE_PATH = rel('.project/state.json');
const PLAN_PATH = rel('.project/PLAN.md');
const TOPICS_PATH = rel('src/data/questions/_topics.json');
const TOPICS_TS_PATH = rel('src/data/topics.ts');
const DECISION_PATH = rel('.project/drafts/m2.8g-decision.yaml');

const messages = [];
const warn = (m) => messages.push('WARN: ' + m);
const info = (m) => messages.push(m);

/* ------------------------------------------------------------------ helpers */

function readJson(file, label) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${label}: JSON не парсится (${file}): ${e.message}`);
  }
}

function readText(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label}: файл не найден (${file})`);
  return fs.readFileSync(file, 'utf8');
}

function isIsoUtc(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value);
}

function nowIso() {
  return new Date().toISOString();
}

/* ------------------------------------------------------- git native helpers */

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function readRecentCommits() {
  const raw = git(['log', '-5', '--pretty=format:%h%x09%ad%x09%s', '--date=short']);
  const commits = [];
  for (const line of raw.split('\n')) {
    if (line.trim() === '') continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    commits.push({
      hash: parts[0].trim(),
      date: parts[1].trim(),
      message: parts.slice(2).join('\t').trim(),
    });
  }
  return commits;
}

/**
 * V7: сколько вопросов добавлено в банк за сегодня (локальная полночь).
 * Источник — все коммиты дня (`git log --since=midnight`), а НЕ окно
 * recent_commits (5 шт.): окно слишком короткое и метрика обнулялась, как
 * только feat(bank) вытеснялся из топ-5.
 * Формат сообщения: "feat(bank): ... N questions ...".
 * При любой ошибке git — 0 (метрика не должна ронять сборку состояния).
 */
function readAddedToday() {
  try {
    const raw = git(['log', '--since=midnight', '--pretty=format:%s']);
    let sum = 0;
    for (const line of raw.split('\n')) {
      const msg = line.trim();
      if (!/^feat\(bank\)/i.test(msg)) continue;
      const m = msg.match(/(\d+)\s+questions?/i);
      if (m) sum += parseInt(m[1], 10);
    }
    return sum;
  } catch (e) {
    warn(`goal.added_today: git log не удался (${e.message}) — 0`);
    return 0;
  }
}

/**
 * V8: продуктовые данные для дашборда владельца.
 *
 * _topics.json    -> { total, byTopic: { slug: count } }
 * src/data/topics.ts -> { key: 'slug', title: 'Человеческое имя' }
 *
 * ВАЛИДАЦИЯ: тем должно быть ровно 14 — эталон проекта (src/data/topics.ts,
 * TOPICS). Меньше/больше = сломанный парсер или неожиданное состояние: сборка
 * состояния падает, а не публикует кривые цифры.
 */
const EXPECTED_TOPIC_COUNT = 14;

const TOPIC_ENTRY_RE = /\{\s*key:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'/g;

function parseTopicLabels(text) {
  const labels = new Map();
  let m;
  while ((m = TOPIC_ENTRY_RE.exec(text)) !== null) {
    labels.set(m[1], m[2]);
  }
  return labels;
}

function buildTopics(topicsJson, labels, perTopicTarget) {
  const byTopic = topicsJson?.byTopic;
  if (!byTopic || typeof byTopic !== 'object') {
    throw new Error('_topics.json: отсутствует объект byTopic');
  }
  const entries = Object.entries(byTopic);
  if (entries.length !== EXPECTED_TOPIC_COUNT) {
    throw new Error(
      `_topics.json: тем ${entries.length}, ожидалось ${EXPECTED_TOPIC_COUNT} — STOP`,
    );
  }
  const topics = entries.map(([slug, count]) => ({
    slug,
    label: labels.get(slug) ?? slug,
    count: Number(count),
    target: perTopicTarget,
  }));
  const noLabel = topics.filter((t) => t.label === t.slug).map((t) => t.slug);
  if (noLabel.length > 0) {
    warn(`topics: нет label в src/data/topics.ts для ${noLabel.join(', ')} — использован slug`);
  }
  return topics;
}

/* ------------------------------------------------------ PLAN.md  -> milestones */

/**
 * Два прохода по PLAN.md:
 *   1) чек-листы  "- [x] M2.8: ..." / "- [ ] M3.2: ..."
 *   2) заголовки-секции "### M3: ..." / "### M3.5: ..."
 * Заголовок секции может задать статус через **Закрыт:** <date>.
 */

// - [x] M2.8: текст  |  - [ ] M3.2: текст
const CHECKLIST_RE = /^- \[([ xX])\]\s+(M\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/;
// ### M3: текст | ### M3.5: текст | ### M4–M6: текст (любой диапазон в id)
const SECTION_RE = /^###\s+(M\d+(?:[.\u2013\u2014-]M?\d+)?)\s*:\s*(.+?)\s*$/;

/**
 * Порядок milestone'ов — документный: M0, M0.5, M0.7, M1, M1.5, M2, M2.1..,
 * M3, M3.1, M3.5, M4, M4–M6, M5, M6. Сегменты id сравниваются по числу.
 */
function milestoneRank(id) {
  const first = String(id).match(/M(\d+)/);
  const major = first ? Number(first[1]) : Number.MAX_SAFE_INTEGER;
  const rest = String(id)
    .replace(/^M\d+/, '')
    .split(/[.\u2013\u2014-]/)
    .filter((s) => s !== '')
    .map((s) => Number((s.match(/\d+/) ?? ['0'])[0]));
  return [major, ...(rest.length > 0 ? rest : [0])];
}

function compareMilestones(a, b) {
  const ra = milestoneRank(a.id);
  const rb = milestoneRank(b.id);
  const len = Math.max(ra.length, rb.length);
  for (let i = 0; i < len; i += 1) {
    const da = ra[i] ?? 0;
    const db = rb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return a.id.localeCompare(b.id);
}

function parsePlan(text) {
  const checklist = [];
  const sections = [];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const c = CHECKLIST_RE.exec(line);
    if (c) {
      checklist.push({
        id: c[2].trim(),
        title: c[3].trim(),
        status: c[1].toLowerCase() === 'x' ? 'completed' : 'planned',
      });
      continue;
    }
    const s = SECTION_RE.exec(line);
    if (s) {
      sections.push({ id: s[1].trim(), title: s[2].trim(), line: i });
    }
  }

  // "### M0: Фундамент (закрыт 2026-09-25)" -> заголовок содержит дату закрытия
  const closedRe = /\(закрыт\s+([0-9]{4}-[0-9]{2}-[0-9]{2})\)/i;

  const isChildOf = (childId, parentId) =>
    childId === parentId || childId.startsWith(parentId + '.');

  const seen = new Map();
  const ordered = [];

  const push = (entry) => {
    if (seen.has(entry.id)) {
      const prev = seen.get(entry.id);
      // чек-лист приоритетнее заголовка по статусу, заголовок — по title
      if (prev.from === 'section' && entry.from === 'checklist') prev.status = entry.status;
      return;
    }
    seen.set(entry.id, entry);
    ordered.push(entry);
  };

  for (const c of checklist) {
    push({ id: c.id, title: c.title, status: c.status, commit: null, from: 'checklist' });
  }

  // bare-чекбоксы секции: "- [ ]" / "- [x]" без milestone-id перед текстом
  const BARE_OPEN_RE = /^\s*-\s*\[ \]\s*\S/;
  const BARE_DONE_RE = /^\s*-\s*\[[xX]\]\s*\S/;

  const pushSection = (s) => {
    const children = checklist.filter((c) => isChildOf(c.id, s.id));
    const kidsOpen = children.filter((c) => c.status === 'planned').length;
    // доказательство начатой работы: id-ребёнок или bare "- [x]"
    const work = children.length > 0 || s.bareDone > 0;
    let status;
    if (s.closed) {
      // 1) "[закрыт YYYY-MM-DD]" -> completed (приоритет)
      status = 'completed';
    } else if (s.bareOpen > 0 && work) {
      // 2) открытые bare + доказательство работы -> in_progress
      status = 'in_progress';
    } else if (children.length > 0 && kidsOpen === 0 && s.bareOpen === 0) {
      // 3) все id-дети completed, открытых bare нет -> completed
      status = 'completed';
    } else if (kidsOpen > 0) {
      // 4) есть id-ребёнок в planned -> in_progress
      status = 'in_progress';
    } else {
      // 5) иначе -> planned (пустая секция больше НЕ completed)
      status = 'planned';
    }
    push({ id: s.id, title: s.title, status, commit: null, from: 'section' });
  };

  // Секции — диапазоны строк: bare-чекбоксы считаются ВНУТРИ своей секции.
  for (let i = 0; i < sections.length; i += 1) {
    const sec = sections[i];
    if (seen.has(sec.id)) continue;
    const end = i + 1 < sections.length ? sections[i + 1].line : lines.length;
    let bareOpen = 0;
    let bareDone = 0;
    for (let k = sec.line + 1; k < end; k += 1) {
      if (BARE_OPEN_RE.test(lines[k])) {
        bareOpen += 1;
      } else if (BARE_DONE_RE.test(lines[k])) {
        bareDone += 1;
      }
    }
    pushSection({
      id: sec.id,
      title: sec.title,
      line: sec.line,
      closed: closedRe.test(sec.title),
      bareOpen,
      bareDone,
    });
  }

  return ordered
    .map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      commit: e.commit,
    }))
    .sort(compareMilestones);
}

/* ------------------------------------------- decision yaml -> issues_open */

function resolveJsYaml() {
  const candidates = [];
  if (process.env.DSH_HOME) {
    candidates.push(path.join(process.env.DSH_HOME, 'profiles', 'node_modules', 'js-yaml'));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return require(c);
  }
  try {
    return require('js-yaml');
  } catch {
    return null;
  }
}

function readIssues() {
  if (!fs.existsSync(DECISION_PATH)) {
    warn(`issues_open: ${path.relative(ROOT, DECISION_PATH)} не найден — issues=[]`);
    return [];
  }
  const yaml = resolveJsYaml();
  if (!yaml) {
    warn('issues_open: js-yaml не найден (DSH_HOME/profiles/node_modules и node_modules) — issues=[]');
    return [];
  }
  const text = fs
    .readFileSync(DECISION_PATH, 'utf8')
    // legacy-теги из js-yaml 3.x не парсятся js-yaml 4.x — понижаем до строк
    .replace(/!!js\/(\w+)/g, '!!str')
    .replace(/!!js\b/g, '!!str');

  let doc;
  try {
    doc = yaml.load(text);
  } catch (e) {
    warn(`issues_open: ${path.relative(ROOT, DECISION_PATH)} не парсится (${e.message}) — issues=[]`);
    return [];
  }
  const known = Array.isArray(doc?.issues_known) ? doc.issues_known : [];
  return known.map((i) => ({
    id: String(i.question_id ?? i.id ?? ''),
    severity: String(i.severity ?? 'MINOR'),
    note: String(i.note ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

/* ------------------------------------------------------------- gates */

/**
 * Гейты запускаются как npm-скрипты, но без shell, когда это возможно.
 * Почему: (1) Node >= 18.20 на Windows бросает EINVAL для npm.cmd без shell;
 * (2) shell:true даёт DEP0190. Поэтому для скриптов вида "node <file>" берём
 * команду из package.json и запускаем её через process.execPath напрямую.
 * Всё остальное (tsc, vitest) идёт через npm с shell.
 */
const PACKAGE_JSON = readJson(rel('package.json'), 'package.json');
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runNpmScript(script) {
  const declared = PACKAGE_JSON?.scripts?.[script];
  const tokens = typeof declared === 'string' ? declared.trim().split(/\s+/) : [];

  const direct = tokens[0] === 'node' && tokens.length > 1;
  const file = direct ? tokens[1] : null;
  const argv = direct ? [file, ...tokens.slice(2)] : ['run', script];
  const cmd = direct ? process.execPath : NPM_CMD;

  try {
    const out = execFileSync(cmd, argv, {
      cwd: ROOT,
      encoding: 'utf8',
      shell: direct ? false : process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { exitCode: 0, output: out };
  } catch (e) {
    const output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    return { exitCode: typeof e.status === 'number' ? e.status : 1, output };
  }
}

function parseGates(stamp) {
  const qc = runNpmScript('qc');
  const qcTotal = Number(/Total:\s*(\d+)/.exec(qc.output)?.[1] ?? 0);
  const qcFails = Number(/Fails:\s*(\d+)/.exec(qc.output)?.[1] ?? 0);
  let qcStatus = qc.exitCode === 0 && qcFails === 0 ? 'pass' : 'fail';
  let total = qcTotal;
  if (qcStatus === 'pass' && total === 0) {
    warn('qc: pass, но Total не распарсен (total=0)');
  }

  const tsc = runNpmScript('typecheck');
  const tscStatus = tsc.exitCode === 0 ? 'pass' : 'fail';

  const vitest = runNpmScript('test:run');
  const tm = /Tests\s+(\d+)\s+passed\s*\((\d+)\)/s.exec(vitest.output);
  const testsPassed = Number(tm?.[1] ?? 0);
  const testsTotal = Number(tm?.[2] ?? 0);
  const vitestStatus = vitest.exitCode === 0 ? 'pass' : 'fail';

  const shuffle = runNpmScript('shuffle-bank:check');
  const shuffleStatus = shuffle.exitCode === 0 ? 'pass' : 'fail';

  return {
    gates: {
      qc: { status: qcStatus, total, fails: qcFails, last_run: stamp },
      typecheck: { status: tscStatus, last_run: stamp },
      vitest: { status: vitestStatus, tests_passed: testsPassed, tests_total: testsTotal, last_run: stamp },
      shuffle_bank: { status: shuffleStatus, last_run: stamp },
    },
    exits: {
      qc: qc.exitCode,
      typecheck: tsc.exitCode,
      vitest: vitest.exitCode,
      shuffle_bank: shuffle.exitCode,
    },
  };
}

function previousGates() {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    const prev = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return prev?.gates ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------- main */

function main() {
  const steps = [];

  // --- goal
  const topics = readJson(TOPICS_PATH, '_topics.json');
  if (typeof topics.total !== 'number') {
    throw new Error('_topics.json: отсутствует числовое поле total');
  }
  const currentQuestions = topics.total;
  const progressPercent = Math.round((currentQuestions / TARGET_QUESTIONS) * 1000) / 10;

  // --- продуктовые темы (V8): 14 тем с count/label/target
  const topicLabels = parseTopicLabels(readText(TOPICS_TS_PATH, 'topics.ts'));
  const perTopicTarget = Math.ceil(TARGET_QUESTIONS / EXPECTED_TOPIC_COUNT);
  const topicsList = buildTopics(topics, topicLabels, perTopicTarget);

  // --- milestones
  const planText = readText(PLAN_PATH, 'PLAN.md');
  const milestones = parsePlan(planText);

  // --- issues
  const issuesOpen = readIssues();

  // --- recent commits
  const recentCommits = readRecentCommits();

  // --- сколько вопросов добавлено сегодня (V7, hero-метрика дашборда)
  const addedToday = readAddedToday();

  // --- gates
  const stamp = nowIso();
  let gates;
  let exits = null;
  if (NO_GATES) {
    const prev = previousGates();
    if (prev) {
      gates = prev;
      info('gates: --no-gates — переиспользованы значения из предыдущего state.json');
    } else {
      warn('gates: --no-gates, но предыдущий state.json недоступен — gates не обновлены');
      gates = {};
    }
  } else {
    const res = parseGates(stamp);
    gates = res.gates;
    exits = res.exits;
  }

  const state = {
    last_update: stamp,
    goal: {
      target_questions: TARGET_QUESTIONS,
      current_questions: currentQuestions,
      progress_percent: progressPercent,
      target_deadline: null,
      added_today: addedToday,
      per_topic_target: perTopicTarget,
    },
    topics: topicsList,
    milestones,
    gates,
    issues_open: issuesOpen,
    recent_commits: recentCommits,
  };

  // --- запись: UTF-8 без BOM, LF-only, корень — объект
  const json = JSON.stringify(state, null, 2).replace(/\r\n/g, '\n') + '\n';
  if (!json.startsWith('{')) throw new Error('сборка state.json: корень не объект');
  fs.writeFileSync(STATE_PATH, json, { encoding: 'utf8' });

  const bytes = fs.readFileSync(STATE_PATH);
  const reparsed = JSON.parse(bytes.toString('utf8'));
  if (bytes[bytes.length - 1] !== 0x0a) throw new Error('state.json: последний байт не 0x0A');
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('state.json: BOM обнаружен');
  // --- M3.5: byte-for-byte синхронизация state.json для дашборда
  const dashboardDir = path.join(ROOT, 'docs', 'dashboard');
  const dashboardPath = path.join(dashboardDir, 'state.json');
  fs.mkdirSync(dashboardDir, { recursive: true });
  fs.copyFileSync(STATE_PATH, dashboardPath);

  // --- self-check
  const requiredKeys = ['goal', 'milestones', 'gates', 'issues_open', 'recent_commits', 'last_update', 'topics'];
  const missing = requiredKeys.filter((k) => !(k in reparsed));
  if (missing.length > 0) throw new Error(`state.json: нет ключей ${missing.join(', ')}`);
  if (!Array.isArray(reparsed.topics)) throw new Error('state.json: topics не массив');
  if (reparsed.topics.length !== EXPECTED_TOPIC_COUNT) {
    throw new Error(
      `state.json: topics.length=${reparsed.topics.length}, ожидалось ${EXPECTED_TOPIC_COUNT}`,
    );
  }
  for (const t of reparsed.topics) {
    if (typeof t.slug !== 'string' || typeof t.label !== 'string') {
      throw new Error('state.json: topics: slug/label должны быть строками');
    }
    if (typeof t.count !== 'number' || typeof t.target !== 'number') {
      throw new Error('state.json: topics: count/target должны быть числами');
    }
  }
  if (reparsed.goal.per_topic_target !== perTopicTarget) {
    throw new Error('state.json: goal.per_topic_target не совпадает с расчётом');
  }
  if (!isIsoUtc(reparsed.last_update)) throw new Error('state.json: last_update не ISO-8601 UTC');
  for (const g of Object.values(reparsed.gates)) {
    if (!['pass', 'fail'].includes(g.status)) throw new Error('state.json: некорректный статус гейта');
    if (!isIsoUtc(g.last_run)) throw new Error('state.json: last_run не ISO-8601 UTC');
  }

  steps.push(`milestones: ${milestones.length}`);
  steps.push(`issues_open: ${issuesOpen.length}`);
  steps.push(`recent_commits: ${recentCommits.length}`);
  steps.push(`goal: ${currentQuestions}/${TARGET_QUESTIONS} (${progressPercent}%)`);
  steps.push(`topics: ${topicsList.length} (target ${perTopicTarget} на тему)`);
  steps.push(`added_today: ${addedToday}`);
  if (exits) {
    steps.push(
      `gates exits: qc=${exits.qc} typecheck=${exits.typecheck} vitest=${exits.vitest} shuffle=${exits.shuffle_bank}`,
    );
  }
  steps.push(`bytes: ${bytes.length}, cr: ${(bytes.toString('binary').match(/\r/g) ?? []).length}`);

  process.stdout.write(
    ['gen-state: .project/state.json обновлён', ...steps.map((s) => '  ' + s), ...messages.map((m) => '  ' + m)].join(
      '\n',
    ) + '\n',
  );

  const failed =
    exits && Object.values(exits).some((c) => c !== 0) ? ' (один или несколько гейтов FAIL)' : '';
  process.stdout.write(`gen-state: итог — ok${failed}\n`);
}

try {
  main();
} catch (e) {
  process.stderr.write(`gen-state: FAIL — ${e.message}\n`);
  process.exitCode = 1;
}
