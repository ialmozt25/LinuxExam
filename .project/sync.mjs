#!/usr/bin/env node
/**
 * .project/sync.mjs — единый генератор производных от `state.json`.
 *
 * M4.0: «всё, что описывает СОСТОЯНИЕ, генерируется из state.json».
 * Причина: STATE.md и дашборд гнили, потому что писались руками.
 *
 * Источник правды (read-only, кроме самого state.json):
 *   .project/state.json       — состояние (единственный источник правды)
 *   git log / git rev-parse   — HEAD, последние коммиты, milestone-коммиты
 *   src/data/topics.ts        — канон тем (14), только чтение
 *   src/data/questions/_topics.json — счётчики банка (сумма = total)
 *   .project/PLAN.md          — чек-листы milestone'ов ([x] / [ ])
 *   .project/specs/*.md       — спеки (frontmatter + разделы)
 *   .project/log.md           — append-only журнал решений
 *
 * Производные (генерируются, руками не править):
 *   .project/STATE.md         — прогресс, банк/темы, HEAD
 *   .project/SPEC.md          — индекс specs
 *   docs/index.html           — центр разработки (один файл, без фреймворков)
 *
 * Режимы:
 *   node .project/sync.mjs           — регенерировать, exit 0 при успешной записи
 *   node .project/sync.mjs --check   — READ-ONLY: только сравнение, ничего не пишет
 *                                      exit 0 — производные совпали с источником
 *                                      exit 2 — SYNC DRIFT (расхождение)
 *
 * Почему --check READ-ONLY (spec 009, M6.0 Phase 2):
 *   Гейт обязан отвечать на вопрос «состояние согласовано?», а не менять его.
 *   Проверка зафиксирована тестом: hash state.json до == после.
 *
 * Почему --check больше НЕ требует head == HEAD:
 *   Раньше `state.head` был якорем, и любой не-sync коммит (спека, отчёт, документ)
 *   двигал HEAD → гейт краснел при полностью корректных производных → закрыть его
 *   можно было только ЕЩЁ одним коммитом (head пишется лишь в ветке записи).
 *   За смену 2026-09-27 это стоило 5 лишних коммитов. Теперь head информационное:
 *   «из какого коммита собрано состояние», а дрейф определяется тем, что реально
 *   означает расхождение — производные на диске совпадают с источником и закоммичены.
 *
 * Почему --check не использует `git diff` целиком:
 *   `git diff` сравнивает с индексом/HEAD, а гейт должен отвечать на вопрос
 *   «производные совпадают с тем, что даёт источник прямо сейчас». Поэтому
 *   --check побайтово сравнивает сгенерированные файлы с файлами на диске
 *   (учитывая переносы строк) и дополнительно проверяет схему state.json.
 *   `git add -N . && git diff --quiet` вызывает ту же регрессию (unborn HEAD
 *   в чистом worktree падает), поэтому в гейт он не вынесен.
 *
 * Запись: UTF-8 без BOM, LF-only, последний байт 0x0A.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const rel = (p) => path.join(ROOT, p);

const STATE_PATH = rel('.project/state.json');
const LOG_PATH = rel('.project/log.md');
const PLAN_PATH = rel('.project/PLAN.md');
const SPECS_DIR = rel('.project/specs');
const TOPICS_TS_PATH = rel('src/data/topics.ts');
const TOPICS_JSON_PATH = rel('src/data/questions/_topics.json');

const OUT_STATE_MD = rel('.project/STATE.md');
const OUT_SPEC_MD = rel('.project/SPEC.md');
const OUT_CENTER = rel('docs/index.html');
/**
 * Heartbeat свежести: отметка «sync состоялся». Живёт ВНЕ git (`.gitignore`),
 * потому что это volatile-время: в коммитимом файле оно давало churn.
 * Второй источник свежести для плитки «Состояние» — см. `getFreshnessTime`.
 */
const HEARTBEAT_REL = '.project/.heartbeat';
const HEARTBEAT_PATH = rel(HEARTBEAT_REL);

const LOG_TAIL_LINES = 10;
const EXPECTED_TOPIC_COUNT = 14;
const DEFAULT_TARGET_QUESTIONS = 300;

/**
 * Минимальная поддерживаемая версия схемы `state.json` (spec 009 / D1 M6.0 Phase 2).
 *
 * v1 — историческая схема: head/goal/topics/specs/log_tail.
 * v2 — расширение фабрикой: commits/roles/products/audits + schema_version,
 *      центр читает их для секций «Коммиты», «Роли», «Продукты», «Аудит».
 *
 * `--check` падает при версии ниже минимальной: старый state.json не даст центру
 * новые секции, и молчаливая деградация «секция пустая» неотличима от «данных нет».
 */
const MIN_SCHEMA_VERSION = 2;
/** Центральные секции «Коммиты» — сколько последних показывать. */
const COMMITS_IN_CENTER = 20;

/** Порядок статусов в индексе и таблице центра (SPEC.md §Сортировка). */
const STATUS_ORDER = ['preview', 'running', 'approved', 'draft', 'done', 'rejected'];
/**
 * Документы политик для свёрнутого блока «Политики» (spec 029: COLLAPSE).
 * Оглавление, а не данные: правится руками только при появлении/переезде файла.
 * Ссылка — путь в `<code>`, а не `<a href>`: центр открывается с диска (file://),
 * и «открыть файл» из браузера не работает; путь читается и копируется.
 */
const POLICY_FILES = [
  { file: '.project/DOD.md', title: 'DOD', note: 'Definition of Done: content / ui / feature' },
  { file: '.project/factory/DOD.md', title: 'DOD (фабрика)', note: 'инварианты И1–И6, общий DOD, типы' },
  { file: '.project/TOKENS.md', title: 'TOKENS', note: 'дизайн-токены: формат, источник, владелец' },
  { file: '.project/ORCH-RULES.md', title: 'ORCH-RULES', note: 'правила оркестратора (1–8)' },
];

const notes = [];
const warn = (m) => notes.push('WARN: ' + m);
const info = (m) => notes.push(m);

/* ------------------------------------------------------------------ volatile */
/**
 * Маркеры самоссылочных участков производных (spec 009, D3).
 *
 * Проблема: центр показывает последние коммиты. Сам факт коммита синхронизации
 * добавляет в список новую строку, поэтому регенерированный HTML ВСЕГДА чуть-чуть
 * отличается от закоммиченного → `--check` краснеет → требуется ещё один коммит.
 * Это не ошибка генератора, а самоссылка данных: артефакт содержит отпечаток
 * истории репозитория, в который его же и коммитят.
 *
 * Решение: участки между маркерами исключаются из побайтового сравнения `--check`.
 * Реальный дрейф (структура, цифры, спеки, роли, продукты) по-прежнему ловится.
 * Осознанный компромисс: самоссылочный участок может остаться несинхронизированным
 * на один коммит — это видно в отчёте и лечится следующим `npm run sync`.
 */
const VOLATILE = {
  start: '<!--volatile:start-->',
  end: '<!--volatile:end-->',
};

/** Убирает все участки между маркерами нестабильности — для сравнения в --check. */
function stripVolatile(text) {
  const re = new RegExp(
    VOLATILE.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '[\\s\\S]*?' +
      VOLATILE.end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    'g',
  );
  return String(text).replace(re, VOLATILE.start + VOLATILE.end);
}

/* ------------------------------------------------------------------ io */

const readText = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

/**
 * Запись производных: UTF-8 без BOM, LF-only.
 * Здесь НЕ используется gen-state.mjs (он собирает state.json и копирует его
 * в docs/dashboard/ для старого дашборда V1–V9 — это отдельный артефакт).
 */
function writeLf(p, text) {
  const s = String(text).replace(/\r\n/g, '\n');
  fs.writeFileSync(p, s, { encoding: 'utf8' });
  return s;
}

const normalizeLf = (text) => String(text).replace(/\r\n/g, '\n');

/* ------------------------------------------------------------------ git */

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/**
 * Полный SHA текущего HEAD — схема state.json («head»).
 *
 * Почему не короткий rev-parse: в этом worktree (путь с пробелом и кириллицей)
 * короткая форма через execFileSync вернула мусор — используем `-C <ROOT>` и
 * срезаем CR.
 */
function readFullHead() {
  return git(['-C', ROOT, 'rev-parse', 'HEAD']).replace(/\r/g, '').trim();
}

const SYNC_ONLY_FILES = new Set([
  '.project/state.json',
  '.project/STATE.md',
  '.project/SPEC.md',
  '.project/sync.mjs',
  'docs/index.html',
]);

/**
 * true — между закреплённым коммитом и текущим HEAD менялись ТОЛЬКО
 * синхронизируемые выходы (база не двигалась, состояние можно не переписывать).
 */
function movesOnlySyncFiles(pinned) {
  if (!pinned) return false;
  const head = readFullHead();
  if (head === pinned || head.startsWith(pinned) || pinned.startsWith(head)) return true;
  try {
    const raw = git(['diff', '--name-only', `${pinned}..HEAD`]);
    const files = raw
      .split('\n')
      .map((l) => l.replace(/\r/g, '').trim())
      .filter((l) => l !== '');
    return files.length > 0 && files.every((f) => SYNC_ONLY_FILES.has(f));
  } catch (e) {
    warn(`anchor: git diff ${pinned}..HEAD не удался (${e.message})`);
    return false;
  }
}

/**
 * Коммит, впервые добавивший milestone-коммит для specs[].commit.
 * Точной связи spec → commit нет, пока спеки пишутся руками, поэтому
 * подставляем последний commit, который выглядит как milestone M4.0.
 */
function readSpecCommit(specs) {
  if (!Array.isArray(specs) || specs.length === 0) return null;
  try {
    const raw = git(['log', '-50', '--pretty=format:%h%x09%s']);
    const lines = raw.split('\n').filter((l) => l.trim() !== '');
    for (const line of lines) {
      const [hash, subject = ''] = line.split('\t');
      if (/^M4\.0\b/i.test(subject.trim())) return hash.trim();
    }
    return null;
  } catch (e) {
    warn(`spec commit: git log не удался (${e.message})`);
    return null;
  }
}

/**
 * Дрейф производных относительно коммита (гейт `--check`).
 *
 * Почему не `git add -N .` + `git diff`: `-N` заносит в индекс ВСЕ untracked
 * файлы репозитория (в этом проекте — .project/drafts/*, drafts/_mas-results/*),
 * после чего `git diff HEAD` считает дрейфом посторонние файлы, и гейт краснеет
 * вечно. Поэтому область сужена до самих синхронизируемых путей через
 * `git status --porcelain -- <paths>`: он сравнивает HEAD ↔ индекс ↔ рабочее
 * дерево только для них (включая новые/untracked) и на посторонние файлы не
 * реагирует.
 *
 * Возвращает: true — расхождение с коммитом есть, false — чисто, null — сбой git.
 */
function diffHead(paths) {
  try {
    const raw = git(['status', '--porcelain', '--', ...paths]);
    return raw.trim() !== '';
  } catch (e) {
    warn(`git status не удался (${e.message})`);
    return null;
  }
}

/**
 * Незафиксированный дрейф производных — БЕЗ ложных срабатываний на
 * самоссылочных участках (VOLATILE).
 *
 * Почему не `git status`: он сравнивает байты рабочего дерева с HEAD и про
 * маркеры не знает. Таблица коммитов (участок в VOLATILE) меняется от КАЖДОГО
 * коммита, включая коммит самой синхронизации: гейт требовал ещё один коммит,
 * тот снова сдвигал таблицу — цикл commits↔converge. Здесь сравнивается то же,
 * что и в остальных местах гейта: `stripVolatile(HEAD:T)` против
 * `stripVolatile(generated)`. Реальный дрейф (структура, цифры, спеки) ловится
 * по-прежнему; отставание ВНУТРИ volatile-участка — сознательный компромисс
 * (см. VOLATILE). Write-путь не тронут: он сравнивает точно и обновляет
 * самоссылочный участок при каждом `sync`.
 *
 * ВАЖНО: НЕ через `git()` — тот обрезает вывод (`trim`) и съедает финальный
 * перевод строки committed-файла, из-за чего сравнение всегда давало бы дрейф.
 *
 * Возвращает: true — незафиксированный дрейф есть (в т.ч. файл отсутствует
 * в HEAD или git недоступен — это проблема, а не «чисто»), false — чисто.
 */
function diffHeadStripped(targets) {
  for (const t of targets) {
    const relPath = path.relative(ROOT, t.path).replace(/\\/g, '/');
    let committed = null;
    try {
      committed = execFileSync('git', ['show', `HEAD:${relPath}`], {
        cwd: ROOT,
        encoding: 'utf8',
      });
    } catch (e) {
      warn(`git show HEAD:${relPath} не удался (${e.message})`);
      return true;
    }
    if (stripVolatile(normalizeLf(committed)) !== stripVolatile(normalizeLf(t.content))) return true;
  }
  return false;
}

/**
 * Каноническая проекция `state.json` — БЕЗ самоссылочных полей.
 *
 * `commits[]` собирается из `git log`, `log_tail` — из `.project/log.md`. Оба меняются
 * от каждого коммита, включая коммит самих производных: сохранить их и не измениться
 * невозможно. `head` — пометка «состояние собрано на этом коммите»: spec 009 явно снял
 * требование `head == HEAD` с гейта, потому что любой не-sync коммит делал проверку
 * красной при корректных производных (это стоило 5 лишних коммитов за смену 2026-09-27).
 *
 * Поэтому гейт и решение о записи сравнивают проекцию: реальный дрейф (числа, спеки,
 * схема, гейты) виден, а «мы просто закоммитили» — нет. Наличие самих полей проверяется
 * отдельно — схемой в `--check`.
 *
 * Маркеры внутрь JSON НЕ пишем: `state.json` читают потребители (легаси-дашборд, центр),
 * которые ждут чистый JSON.
 */
function stateProjection(text) {
  try {
    const o = JSON.parse(String(text));
    const { head, commits, log_tail, ...rest } = o;
    return JSON.stringify(rest);
  } catch (e) {
    return null;
  }
}

/** Дрейф `state.json` по проекции: содержимое на диске против версии из HEAD. */
function diffHeadProjected() {
  if (!exists(STATE_PATH)) return true;
  try {
    const headRaw = git(['show', `HEAD:${path.relative(ROOT, STATE_PATH).replace(/\\/g, '/')}`]);
    const disk = stateProjection(readText(STATE_PATH));
    const head = stateProjection(headRaw);
    if (disk === null || head === null) return diffHead([STATE_PATH]);
    return disk !== head;
  } catch (e) {
    // untracked/новый файл или git недоступен — падаем на честный `git status`
    return diffHead([STATE_PATH]);
  }
}

/**
 * Содержимое центра без маркеров VOLATILE и без самой плитки «Состояние».
 * Плитка вырезается потому, что её значение — ФУНКЦИЯ от этой проверки; оставить
 * её в сравнении значит получить самоссылку (см. `isCenterInSync`).
 */
function contentSansIndicator(html) {
  const s = stripVolatile(normalizeLf(html));
  return s.replace(
    /<div class="pulse-tile"><div class="pulse-tile__label">Состояние<\/div>[\s\S]*?<\/div>\s*<\/div>/,
    '<div class="pulse-tile"><div class="pulse-tile__label">Состояние</div>[indicator]</div>',
  );
}

/**
 * C2a-3 (+ consistency-lastsync): реальная синхронность ЦЕНТРА — то, что
 * показывает плитка «Состояние».
 *
 * Сравниваем СГЕНЕРИРОВАННОЕ содержимое с ВЕРСИЕЙ ИЗ HEAD (`git show
 * HEAD:docs/index.html`), вырезая volatile-участки тем же `stripVolatile`, что и
 * гейт `--check`. Смысл: «центр на диске отстал от коммита — запусти
 * `npm run sync`».
 *
 * Почему не сравниваем файл на диске: sync пишет файл с актуальным volatile-пином,
 * поэтому «диск vs HEAD» давал false сразу после каждой синхронизации.
 *
 * Почему вырезаем саму плитку «Состояние»: она ЗАВИСИТ от результата этой же
 * проверки, и её значение уже вшито в committed-версию. Без вырезания получается
 * самоссылка: один раз красный индикатор сравнивается сам с собой и залипает
 * навсегда, а зелёный — никогда не возвращается.
 *
 * Возвращает true — синхронно; false — центр отстал; при невозможности получить
 * committed-версию (файла нет в HEAD, git недоступен) — true: красный индикатор
 * уместен только при ДОКАЗАННОМ расхождении.
 */
function isCenterInSync(generated) {
  try {
    // ВАЖНО: НЕ через `git()` — тот обрезает вывод (`trim`) и съедает финальный
    // перевод строки committed-версии, из-за чего сравнение всегда давало false.
    const committed = execFileSync(
      'git',
      ['show', `HEAD:${path.relative(ROOT, OUT_CENTER).replace(/\\/g, '/')}`],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const cand = generated === undefined
      ? (exists(OUT_CENTER) ? readText(OUT_CENTER) : null)
      : generated;
    if (cand === null) return true;
    return contentSansIndicator(cand) === contentSansIndicator(committed);
  } catch (e) {
    return true;
  }
}

/**
 * `--in-sync-probe` — READ-ONLY диагностика C2a-3: печатает вычисленный
 * `isCenterInSync()` и выходит. Нужен, чтобы доказать ДОСТИЖИМОСТЬ состояния
 * «есть расхождение» без правки боевых файлов и без «симуляций».
 */
function inSyncProbe() {
  const value = isCenterInSync();
  process.stdout.write(`center in-sync: ${value ? 'true' : 'false'}\n`);
  process.exitCode = 0;
}

/* --------------------------------------------------------------- state */
function readState() {
  if (!exists(STATE_PATH)) throw new Error('.project/state.json не найден');
  try {
    return JSON.parse(readText(STATE_PATH));
  } catch (e) {
    throw new Error(`.project/state.json не парсится: ${e.message}`);
  }
}

/** Целевое число вопросов: из state.json, при отсутствии — 300. */
function targetQuestions(state) {
  const t = Number(state?.goal?.target_questions);
  return Number.isFinite(t) && t > 0 ? t : DEFAULT_TARGET_QUESTIONS;
}

/* --------------------------------------------------------------- topics */

const TOPIC_ENTRY_RE = /\{\s*key:\s*'([^']+)'\s*,\s*title:\s*'([^']+)'/g;

/** Канон тем — только чтение (src/data/topics.ts). */
function readTopicLabels() {
  const labels = new Map();
  if (!exists(TOPICS_TS_PATH)) {
    warn('src/data/topics.ts не найден — человеческие имена тем недоступны');
    return labels;
  }
  const text = readText(TOPICS_TS_PATH);
  let m;
  while ((m = TOPIC_ENTRY_RE.exec(text)) !== null) labels.set(m[1], m[2]);
  if (labels.size !== EXPECTED_TOPIC_COUNT) {
    warn(`src/data/topics.ts: тем ${labels.size}, ожидалось ${EXPECTED_TOPIC_COUNT}`);
  }
  return labels;
}

/** Счётчики банка — только чтение (_topics.json). */
function readTopicCounts() {
  if (!exists(TOPICS_JSON_PATH)) throw new Error('src/data/questions/_topics.json не найден');
  const json = JSON.parse(readText(TOPICS_JSON_PATH));
  if (json.byTopic && typeof json.byTopic === 'object') return json.byTopic;
  if (Array.isArray(json.topics)) {
    const out = {};
    for (const t of json.topics) out[String(t.slug ?? t.key)] = Number(t.count ?? 0);
    return out;
  }
  throw new Error('_topics.json: нет byTopic/topics — счётчики банка недоступны');
}

function buildTopics(state) {
  const labels = readTopicLabels();
  const counts = readTopicCounts();
  const known = Array.isArray(state?.topics) ? state.topics : [];
  const slugs = Array.from(
    new Set([...known.map((t) => t.slug), ...Object.keys(counts), ...labels.keys()]),
  ).filter(Boolean);
  const target = Number(state?.goal?.per_topic_target)
    || Math.ceil(targetQuestions(state) / EXPECTED_TOPIC_COUNT);
  return slugs
    .map((slug) => ({
      slug,
      label: labels.get(slug) || known.find((t) => t.slug === slug)?.label || slug,
      count: Number(counts[slug] ?? known.find((t) => t.slug === slug)?.count ?? 0),
      target,
    }))
    .sort((a, b) => a.count - b.count || a.slug.localeCompare(b.slug));
}

/* ------------------------------------------------------------------ log */

function readLogTail() {
  if (!exists(LOG_PATH)) {
    warn('.project/log.md не найден — log_tail пуст');
    return [];
  }
  return normalizeLf(readText(LOG_PATH))
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '')
    .slice(-LOG_TAIL_LINES);
}

/* ---------------------------------------------------------------- specs */

function parseFrontmatter(text) {
  const lines = normalizeLf(text).split('\n');
  const meta = {};
  let end = 0;
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].trim() === '---') {
        end = i + 1;
        break;
      }
      const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return { meta, bodyLines: lines.slice(end) };
}

/** Секция «## Заголовок» → первая непустая строка содержимого. */
function sectionPreview(bodyLines, title) {
  const re = new RegExp('^##\\s*' + title + '\\s*$', 'i');
  for (let i = 0; i < bodyLines.length; i += 1) {
    if (re.test(bodyLines[i])) {
      for (let k = i + 1; k < bodyLines.length; k += 1) {
        const line = bodyLines[k].trim();
        if (line.startsWith('##')) break;
        if (line !== '') return line.replace(/^[-*]\s*/, '');
      }
    }
  }
  return '';
}

function readSpecs() {
  if (!exists(SPECS_DIR)) {
    warn('.project/specs/ не найден — specs пуст');
    return [];
  }
  const files = fs
    .readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();
  const specs = [];
  for (const file of files) {
    const full = path.join(SPECS_DIR, file);
    const { meta, bodyLines } = parseFrontmatter(readText(full));
    const id = meta.id || file.replace(/\.md$/, '').split('-')[0];
    const status = (meta.status || 'draft').toLowerCase();
    if (!STATUS_ORDER.includes(status)) {
      warn(`specs/${file}: статус "${status}" вне схемы (${STATUS_ORDER.join('/')})`);
    }
    // mtime нужен секции «Doing»: «свежий draft» = работа, которая идёт, но ещё
    // не переведена в running (spec 009 и фоновые задачи так и выглядят).
    let mtime = null;
    try {
      mtime = fs.statSync(full).mtimeMs;
    } catch {
      mtime = null;
    }
    specs.push({
      id,
      slug: meta.slug || file.replace(/\.md$/, '').replace(/^\d+-/, ''),
      status,
      type: meta.type || 'feature',
      created: meta.created || null,
      updated: meta.updated || null,
      commit: meta.commit && meta.commit !== 'null' ? meta.commit : null,
      file: `specs/${file}`,
      mtime,
      goal: sectionPreview(bodyLines, 'Цель'),
      acceptance: sectionPreview(bodyLines, 'Критерии приёмки'),
      noTouch: sectionPreview(bodyLines, 'Что НЕ трогать'),
      preview: sectionPreview(bodyLines, 'Превью'),
    });
  }
  return sortSpecs(specs);
}

function sortSpecs(specs) {
  const rank = (s) => {
    const i = STATUS_ORDER.indexOf(s.status);
    return i === -1 ? STATUS_ORDER.length : i;
  };
  return specs
    .slice()
    .sort((a, b) => rank(a) - rank(b) || String(a.id).localeCompare(String(b.id)));
}

/* --------------------------------------------------------------- factory */

/**
 * Минимальный парсер `roles.yaml` БЕЗ внешней зависимости.
 *
 * Почему не js-yaml: `sync.mjs` — часть гейта (`npm run sync:check`), и он не должен
 * зависеть от пакета, которого нет в `package.json` (js-yaml доступен только из
 * профилей DSH, вне репозитория). Формат ролей — плоский список скаляров, поэтому
 * парсер намеренно узкий: он понимает ровно ту структуру, которую пишем мы.
 *
 * Поддерживается: `version`, `updated`, мапа `type_map`, список `roles` c полями
 * скаляр / inline-список / вложенный `trigger`. Комментарии и пустые строки
 * игнорируются. Неизвестная строка верхнего уровня — предупреждение, не падение.
 */
function readRoles() {
  if (!exists(ROLES_PATH)) {
    warn('.project/factory/roles.yaml не найден — секция «Роли» пуста');
    return { version: null, type_map: {}, roles: [] };
  }
  const lines = normalizeLf(readText(ROLES_PATH)).split('\n');
  const out = { version: null, updated: null, type_map: {}, roles: [] };
  let mode = null; // 'type_map' | 'roles'
  let cur = null; // текущая роль
  let sub = null; // 'trigger'
  const strip = (s) => s.replace(/\s+#.*$/, '').trim();
  const unquote = (s) => s.replace(/^["']|["']$/g, '');
  const list = (s) =>
    s
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((x) => unquote(x.trim()))
      .filter(Boolean);

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.length - raw.replace(/^\s+/, '').length;
    const line = strip(raw);
    if (!line) continue;

    if (indent === 0) {
      const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
      if (!kv) continue;
      const [, key, val] = kv;
      if (key === 'type_map') { mode = 'type_map'; cur = null; continue; }
      if (key === 'roles') { mode = 'roles'; cur = null; continue; }
      out[key] = val === '' ? null : unquote(val);
      mode = null;
      continue;
    }

    if (mode === 'type_map' && indent >= 2) {
      const kv = /^([A-Za-z_][\w-]*):\s*(.+)$/.exec(line);
      if (kv) out.type_map[kv[1]] = unquote(kv[2]);
      continue;
    }

    if (mode === 'roles') {
      if (indent === 2 && line.startsWith('- ')) {
        cur = {};
        out.roles.push(cur);
        sub = null;
        const kv = /^-\s*([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
        if (kv) cur[kv[1]] = kv[2] === '' ? null : unquote(kv[2]);
        continue;
      }
      if (!cur) continue;
      if (indent === 4) {
        const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
        if (!kv) continue;
        const [, key, val] = kv;
        if (key === 'trigger') { sub = 'trigger'; cur.trigger = {}; continue; }
        sub = null;
        if (val === '') cur[key] = null;
        else if (val.startsWith('[')) cur[key] = list(val);
        else cur[key] = unquote(val);
        continue;
      }
      if (indent >= 6 && sub === 'trigger') {
        const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
        if (!kv) continue;
        const v = unquote(kv[2]);
        cur.trigger[kv[1]] = v === 'null' || v === '' ? null : v;
      }
      continue;
    }
  }
  if (out.roles.length === 0) warn('roles.yaml: список roles пуст');
  return out;
}

/* ------------------------------------------------------------ plan yaml (F2.3) */

/** Путь к мастер-плану фабрики: единственный источник правды о фазах F0–F5. */
const FACTORY_PLAN_PATH = rel('docs/FACTORY-PLAN.md');

/**
 * Путь к активному плану развития (фазы D0–D4). Файл МОЖЕТ отсутствовать:
 * тогда план развития не подключён, и синхронизация не падает (dev = null).
 * Когда файл есть — парсится тем же парсером, что и мастер-план: формат шапки
 * обязан совпадать (`DEV-PLAN`-онбординг это первое, что проверяет).
 */
const DEV_PLAN_PATH = rel('docs/DEV-PLAN.md');

/**
 * C2d: активный план центра (инициатива C). Читается тем же `readPlanYaml`,
 * что и две другие шапки: формат совпадает (плоские скаляры + inline-мапы фаз).
 */
const CPLAN_PATH = rel('docs/C-PLAN.md');

/**
 * YAML-шапка плана — машинный источник фаз для центра. Аргумент — абсолютный
 * путь к файлу плана: планов теперь два (мастер `docs/FACTORY-PLAN.md` и
 * активный `docs/DEV-PLAN.md`), парсер один и тот же.
 *
 * Шапка — первый блок между двумя строками `---` в начале файла (frontmatter).
 * Парсим её РУКОПИСНЫМ парсером, без внешней зависимости (F2.3.1): `sync.mjs` —
 * часть гейта `npm run sync:check`, а гейт не должен зависеть от пакета, которого
 * может не быть в `package.json` (js-yaml — devDependency, в проде её нет).
 * Та же конвенция, что у `parseFrontmatter` и `readRoles`.
 *
 * Поддерживается ровно наш формат: плоские скаляры верхнего уровня, список фаз
 * inline-мапами `- { id: F0, name: "…", status: done, progress: "4/4" }`,
 * вложенные блоки (`budget:`) пропускаются целиком.
 *
 * Возвращает нормализованную проекцию:
 *   { plan_version, current_phase, current_step, phases: [{ id, name, status, progress }] }
 *
 * При любой проблеме — throw с точной причиной (что не так и где): молча отдать
 * пустой план хуже, чем упасть, потому что дашборд покажет «фаз нет» как факт.
 */
function readPlanYaml(planPath) {
  const rel_ = path.relative(ROOT, planPath);
  if (!exists(planPath)) throw new Error(`план не найден: ${rel_}`);
  const lines = normalizeLf(readText(planPath)).split('\n');
  // frontmatter: закрывающий `---` ищем только после открывающего.
  if (lines[0].trim() !== '---') {
    throw new Error(`${rel_}:1 — нет открывающего "---"; YAML-шапка должна быть первой строкой`);
  }
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx === -1) {
    throw new Error(`${rel_} — нет закрывающего "---" после первой строки; шапка не закрыта`);
  }
  const where = `${rel_} — YAML-шапка (строки 2..${closeIdx}) не парсится`;
  const header = lines.slice(1, closeIdx);
  const out = { plan_version: null, current_phase: null, current_step: null };
  let sawPhasesKV = false;
  const phaseLines = [];

  /** Скаляр: снять кавычки, отбить хвостовой комментарий; бросает на незакрытой кавычке. */
  const scalar = (raw, i) => {
    const s = raw.trim();
    if (s.startsWith('"') || s.startsWith("'")) {
      const q = s[0];
      let esc = false;
      for (let k = 1; k < s.length; k += 1) {
        if (esc) { esc = false; continue; }
        if (s[k] === '\\' && q === '"') { esc = true; continue; }
        if (s[k] === q) return s.slice(1, k).replace(q === '"' ? /\\"/g : /''/g, q);
      }
      throw new Error(`${rel_}:${i + 2} — незакрытая кавычка: ${s}`);
    }
    return s.replace(/\s+#.*$/, '').trim();
  };

  /** `key: value, …` из `{ … }` — запятые внутри кавычек не разделяют. */
  const flowMap = (inner, i) => {
    const o = {};
    let rest = inner;
    while (rest.trim()) {
      const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(rest.trim());
      if (!m) throw new Error(`${rel_}:${i + 2} — не разобрать поле фазы: ${rest.trim()}`);
      const v = m[2];
      if (v.startsWith('"') || v.startsWith("'")) {
        const val = scalar(v, i);
        o[m[1]] = val;
        rest = v.slice(v.indexOf(v[0], 1) + 1).replace(/^\s*,/, '');
      } else {
        const cut = v.search(/,\s*[A-Za-z_][\w-]*\s*:|$/);
        o[m[1]] = scalar(v.slice(0, cut), i);
        rest = v.slice(cut).replace(/^\s*,/, '');
      }
    }
    return o;
  };

  for (let i = 0; i < header.length; i += 1) {
    const raw = header[i];
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const indent = raw.length - raw.replace(/^\s+/, '').length;
    const top = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (indent === 0 && top) {
      const [, key, val] = top;
      if (key === 'phases' && !val) { sawPhasesKV = true; continue; }
      if (key in out) out[key] = val === '' ? null : scalar(val, i);
      continue;
    }
    if (!line.startsWith('-') && /^[A-Za-z_][\w-]*\s*:/.test(line)) continue; // вложенный блок
    if (line.startsWith('-') && sawPhasesKV) { phaseLines.push({ text: line.replace(/^-\s*/, ''), i }); continue; }
    throw new Error(`${rel_}:${i + 2} — неожиданная строка в шапке: ${line}`);
  }

  const phases = [];
  let sawPhases = false;
  for (const { text, i } of phaseLines) {
    sawPhases = true;
    let p;
    if (text.startsWith('{')) {
      if (!text.endsWith('}')) throw new Error(`${rel_}:${i + 2} — нет закрывающей "}": ${text}`);
      p = flowMap(text.slice(1, -1), i);
    } else if (text && /^[A-Za-z_][\w-]*\s*:/.test(text)) {
      p = { [text.slice(0, text.indexOf(':')).trim()]: scalar(text.slice(text.indexOf(':') + 1), i) };
    } else {
      throw new Error(`${rel_}:${i + 2} — фаза не мапа: ${text}`);
    }
    if (!p.id) phases.push({ bad: i, p }); else phases.push({ p });
  }
  const badPhase = phases.find((x) => x.bad !== undefined);
  if (badPhase) {
    throw new Error(`${rel_} — phases[${phases.indexOf(badPhase)}] без поля id: ${JSON.stringify(badPhase.p)}`);
  }
  if (!sawPhases || phases.length === 0) {
    throw new Error(`${rel_} — в шапке нет непустого списка phases`);
  }
  return {
    plan_version: out.plan_version == null ? null : String(out.plan_version),
    current_phase: out.current_phase == null ? null : String(out.current_phase),
    current_step: out.current_step == null ? null : String(out.current_step),
    phases: phases.map(({ p }) => ({
      id: String(p.id),
      name: p.name == null ? '—' : String(p.name),
      status: p.status == null ? 'unknown' : String(p.status),
      progress: p.progress == null ? '—' : String(p.progress),
    })),
  };
}

/**
 * Свежесть тетради памяти: `meta updated` + `entries_count` из самого файла,
 * плюс возраст в часах. Слой 2.5 ЧАСТИ 5А: гейта на устаревание памяти нет,
 * поэтому центр показывает возраст явно, а не умалчивает.
 *
 * Возраст — производная от wall-clock, поэтому он попадёт в volatile-участок html
 * (как таблица коммитов): иначе `--check` краснел бы от одного часа простоя.
 */
function readNotebookMeta(relPath) {
  if (!exists(rel(relPath))) return null;
  const m = /<!--\s*meta updated:\s*([0-9T:\-Z]+)\s+entries_count:\s*(\d+)\s*-->/.exec(
    readText(rel(relPath)),
  );
  const updated = m ? m[1] : null;
  const entries = m ? Number(m[2]) : null;
  let ageHours = null;
  if (updated) {
    const t = Date.parse(updated);
    if (Number.isFinite(t)) ageHours = Math.max(0, Math.round((Date.now() - t) / 36e5));
  }
  return { updated, entries, ageHours };
}

/** 5 тетрадей памяти: короткое имя для дашборда + путь. */
const NOTEBOOKS = [
  { key: 'episodic', file: 'docs/memory/episodic.md', label: 'episodic' },
  { key: 'semantic', file: 'docs/memory/semantic.md', label: 'semantic' },
  { key: 'procedural', file: 'docs/memory/procedural.md', label: 'procedural' },
  { key: 'working', file: 'docs/memory/working.md', label: 'working' },
  { key: 'alerts', file: 'docs/memory/alerts.md', label: 'alerts' },
];

/**
 * Чип свежести тетради. Порог — «1 фаза» ≈ 3 дня (budget.wall_clock_per_phase
 * из YAML-шапки плана): 🟢 <72 ч, 🟡 72–144 ч, 🔴 >144 ч.
 */
function freshnessChip(ageHours) {
  if (ageHours == null) return { cls: 'chip--pending', text: '⚪ нет meta' };
  if (ageHours < 72) return { cls: 'chip--done', text: '🟢 свежая' };
  if (ageHours <= 144) return { cls: 'chip--in_progress', text: '🟡 стареет' };
  return { cls: 'chip--rejected', text: '🔴 холодная' };
}

/**
 * `docs/memory/trends.jsonl` — последние `limit` записей. Формат строки задан
 * планом v2.3: { date, bank, tasks_closed, blocked_hours, … }. Битые строки
 * пропускаем (журнал — не гейт), но не молча: считаем и отдаём их число.
 */
function readTrends(limit) {
  const p = rel('docs/memory/trends.jsonl');
  if (!exists(p)) return { rows: [], broken: 0, total: 0 };
  const raw = normalizeLf(readText(p)).split('\n').filter((l) => l.trim());
  const rows = [];
  let broken = 0;
  for (const line of raw) {
    try {
      const o = JSON.parse(line);
      rows.push({
        date: o.date == null ? '—' : String(o.date),
        bank: o.bank == null ? null : Number(o.bank),
        tasks_closed: o.tasks_closed == null ? null : Number(o.tasks_closed),
        blocked_hours: o.blocked_hours == null ? null : Number(o.blocked_hours),
      });
    } catch (e) {
      broken += 1;
    }
  }
  return { rows: rows.slice(-limit), broken, total: rows.length };
}

/**
 * C2d: последние `limit` записей `.project/log.md` для блока «Решения».
 * Журнал читается как ИСТОЧНИК (append-only), формат вывода правит рендер.
 */
function readRecentLog(limit) {
  const p = rel('.project/log.md');
  if (!exists(p)) return [];
  return normalizeLf(readText(p))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const m = /^(\d{4}-\d{2}-\d{2})\s*\|\s*([\s\S]*)$/.exec(l);
      return m ? { date: m[1], text: m[2].trim() } : { date: '—', text: l };
    })
    .slice(-limit);
}

/**
 * Записи `docs/memory/alerts.md`. Формат — `## YYYY-MM-DD | заголовок` плюс
 * следующая непустая строка как тело (старые записи шли без `##`, поэтому
 * заголовком считаем и строку, начинающуюся с даты).
 */
function readAlerts() {
  const p = rel('docs/memory/alerts.md');
  if (!exists(p)) return { entries: [], total: 0 };
  const lines = normalizeLf(readText(p)).split('\n');
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const m = /^(?:##\s*)?(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/.exec(line);
    if (!m) continue;
    let body = '';
    for (let k = i + 1; k < lines.length; k += 1) {
      const t = lines[k].trim();
      if (!t) continue;
      if (/^(?:##\s*)?\d{4}-\d{2}-\d{2}\s*\|/.test(t) || t.startsWith('<!--')) break;
      body = t;
      break;
    }
    entries.push({ date: m[1], title: m[2].trim(), body });
  }
  // Записи в файле идут сверху вниз от новых к старым — порядок сохраняем как есть.
  return { entries, total: entries.length };}

/**
 * Состояние команд AgentTeams — `.agent-teams/<teamId>/team.json` (спека 022,
 * блок 6 «Пульс агентов»).
 *
 * Плагин живёт на host-плоскости DSH и пишет своё состояние на диск (stateDir
 * из `cordis.patch.yml`), поэтому центр читает файлы, а не поднимает HTTP-роут
 * плагина: `/plugins/dsh-agent-teams/state` под фенсом авторизации (401/403),
 * а гейт `sync:check` должен работать офлайн и без сессии.
 *
 * Молчание запрещено (ЧАСТЬ 2 плана): каталога нет или подпапок нет — секция
 * печатает «нет данных»; подпапка без `team.json`, битый JSON или гонка чтения
 * — строка команды «нечитаем». Файлы (не каталоги) внутри `.agent-teams/`
 * игнорируются: состояние команды — всегда каталог `<teamId>/team.json`.
 *
 * Читаются РОВНО 7 полей (whitelist): `id`, `name`, `phase`, `members[].name`,
 * `members[].status`, `tasks[].id`, `tasks[].status`. `output`, `result`,
 * `description`, `executionPrompt` и прочие поля записи в центр не попадают —
 * они могут быть большими и содержать чужие тексты.
 *
 * @returns {{teams: Array, present: boolean}} present=false — каталога нет.
 */
const AGENT_TEAMS_DIR = rel('.agent-teams');

function readAgentTeams() {
  if (!exists(AGENT_TEAMS_DIR)) return { teams: [], present: false };
  const dirs = [];
  for (const entry of fs.readdirSync(AGENT_TEAMS_DIR, { withFileTypes: true })) {
    // Только каталоги: stateDir может содержать служебные файлы (lock, archive-файлы).
    if (entry.isDirectory()) dirs.push(entry.name);
  }
  // Детерминизм вывода: порядок команд — по code points имени каталога.
  dirs.sort();

  const teams = dirs.map((dir) => {
    const base = { dir, id: dir, name: dir, phase: '', readable: false, members: [], tasks: [] };
    try {
      const raw = fs.readFileSync(path.join(AGENT_TEAMS_DIR, dir, 'team.json'), 'utf8');
      const json = JSON.parse(raw);
      const members = Array.isArray(json.members) ? json.members : [];
      const tasks = Array.isArray(json.tasks) ? json.tasks : [];
      return {
        ...base,
        id: json.id,
        name: json.name,
        phase: json.phase,
        readable: true,
        members: members.map((m) => ({ name: m && m.name, status: m && m.status })),
        tasks: tasks.map((t) => ({ id: t && t.id, status: t && t.status })),
      };
    } catch (e) {
      // Битый JSON, нет файла, файл занят другим процессом (гонка чтения) — «нечитаем».
      return base;
    }
  });

  return { teams, present: true };
}

/** Текстовое поле team.json: отсутствующее/пустое значение → «?» (не пустая строка). */
function agentFieldText(v) {
  if (typeof v === 'string' && v.trim() !== '') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '?';
}

/** Маппинг статуса задачи в символ (утверждён для F3.0b). */
const AGENT_TASK_ICON = {
  pending: '○',
  claimed: '◇',
  in_progress: '▶',
  completed: '✓',
  failed: '✗',
  cancelled: '⊘',
};

/** Маппинг статуса участника в символ (утверждён для F3.0b). */
const AGENT_MEMBER_ICON = { idle: '·', working: '▶', removed: '⊘' };

/**
 * Строка команды для блока 6: имя + фаза (класс — только для staged/running),
 * затем агенты и задачи со статусными символами.
 *
 * `phase` по умолчанию отсутствует у команд, созданных до появления стейджинга
 * (`TeamState.phase` — опциональное поле, отсутствие трактуется как `running`),
 * поэтому отсутствие фазы показываем как «running», а неизвестное значение —
 * текстом без модификатора класса: в атрибут `class` чужие данные не попадают.
 */
function renderAgentTeamCard(t) {
  if (!t.readable) {
    return [
      '        <div class="entry">',
      `          <div class="entry__title">${esc(agentFieldText(t.dir))} · <span class="muted">нечитаем</span></div>`,
      '        </div>',
    ].join('\n');
  }

  const phase = t.phase == null || t.phase === '' ? 'running' : String(t.phase);
  const phaseKnown = phase === 'staged' || phase === 'running';
  const chip = phaseKnown
    ? `<span class="chip chip--${phase}">${esc(phase)}</span>`
    : `<span class="muted">${esc(phase)}</span>`;
  const staged = phase === 'staged' ? ' <span class="muted">— ожидает approve</span>' : '';

  const members = t.members.length === 0
    ? '—'
    : t.members
      .map((m) => `${esc(agentFieldText(m.name))} (${esc(AGENT_MEMBER_ICON[m.status] || '?')})`)
      .join(' · ');
  const tasks = t.tasks.length === 0
    ? '—'
    : t.tasks
      .map((x) => `${esc(agentFieldText(x.id))} ${AGENT_TASK_ICON[x.status] || '?'}`)
      .join(' · ');

  return [
    '        <div class="entry">',
    `          <div class="entry__title">${esc(agentFieldText(t.name))} · ${chip}${staged}</div>`,
    `          <div class="entry__body muted">агенты: ${members}</div>`,
    `          <div class="entry__body muted">задачи: ${tasks}</div>`,
    '        </div>',
  ].join('\n');
}

/** `git log` — коммиты для секции центра и зеркала state.json.commits. */
function readGitCommits(limit) {
  try {
    const raw = git(['log', `-${limit}`, '--pretty=format:%h%x09%ad%x09%s', '--date=short']);
    return raw
      .split('\n')
      .map((l) => l.replace(/\r/g, ''))
      .filter((l) => l.trim() !== '')
      .map((l) => {
        const [sha, date, subject = ''] = l.split('\t');
        const t = /^(feat|fix|docs|chore|refactor|test|style|perf|build|ci|revert)\b/i.exec(subject);
        return { sha: sha.trim(), date: (date || '').trim(), subject: subject.trim(), type: t ? t[1].toLowerCase() : null };
      });
  } catch (e) {
    warn(`git log не удался (${e.message}) — секция «Коммиты» пуста`);
    return [];
  }
}

/** Файлы отчётов: аудиты + factory-research. Только шапка, не полный парс. */
function readAuditIndex() {
  const out = [];
  const scan = (dir, kind) => {
    if (!exists(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.md')) continue;
      const p = path.join(dir, name);
      let lines = 0;
      try {
        lines = normalizeLf(readText(p)).split('\n').length;
      } catch {
        continue;
      }
      out.push({
        path: path.relative(ROOT, p).split(path.sep).join('/'),
        kind,
        lines,
        mtime: fs.statSync(p).mtime.toISOString(),
      });
    }
  };
  scan(AUDITS_DIR, 'audit');
  if (exists(path.join(FACTORY_DIR, 'RESEARCH.md'))) {
    const p = path.join(FACTORY_DIR, 'RESEARCH.md');
    out.push({
      path: path.relative(ROOT, p).split(path.sep).join('/'),
      kind: 'research',
      lines: normalizeLf(readText(p)).split('\n').length,
      mtime: fs.statSync(p).mtime.toISOString(),
    });
  }
  return out.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}

/* --------------------------------------------------------------- counts */

function readMilestoneProgress() {
  if (!exists(PLAN_PATH)) {
    warn('.project/PLAN.md не найден — прогресс milestone недоступен');
    return { done: 0, total: 0, running: [], doneIds: [] };
  }
  const checklist = /^- \[([ xX])\]\s+(M\d+(?:\.\d+)?)\s*:?\s*(.+?)\s*$/;
  const inProgress = /^\*\*Статус:\*\*\s*актив/i;
  const doneIds = [];
  const running = [];
  let total = 0;
  for (const line of normalizeLf(readText(PLAN_PATH)).split('\n')) {
    const c = checklist.exec(line);
    if (c) {
      total += 1;
      if (c[1].toLowerCase() === 'x') doneIds.push(c[2]);
      else running.push(c[2] + ': ' + c[3]);
      continue;
    }
    const section = /^###\s+(M\d+(?:\.\d+)?)\s*:\s*(.+?)\s*$/.exec(line);
    if (section) total += 1;
  }
  const active = [];
  const lines = normalizeLf(readText(PLAN_PATH)).split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const section = /^###\s+(M\d+(?:[.\u2013-]M?\d+)?)\s*:\s*(.+?)\s*$/.exec(lines[i]);
    if (!section) continue;
    const end = i + 20 < lines.length ? i + 20 : lines.length;
    for (let k = i + 1; k < end; k += 1) {
      if (inProgress.test(lines[k])) active.push(section[1] + ': ' + section[2]);
      if (/^###\s/.test(lines[k])) break;
    }
  }
  return { done: doneIds.length, total, running: active, doneIds };
}

/* ------------------------------------------------------------------- md */

function renderStateMd(ctx) {
  const { state, goal, topics, milestonesRaw, topicsRaw } = ctx;
  const list = (arr) => (arr.length === 0 ? ['— нет —'] : arr.map((s) => '- ' + s));
  const rows = topics.map(
    (t) => `| ${t.count} / ${t.target} | ${t.label} | \`${t.slug}\` |`,
  );
  const lines = [
    '# LinuxExam — Текущее состояние',
    '',
    '> ФАЙЛ СГЕНЕРИРОВАН: `.project/sync.mjs` из `.project/state.json`.',
    '> Правки здесь затираются. Меняй источник: `.project/state.json` (или `npm run sync`).',
    '',
    // head берём из state (закреплённое значение), а не из git: полный HEAD
    // меняется от каждого коммита и делает производные вечно «грязными».
    //
    // spec 012: значение head — САМОССЫЛОЧНОЕ (пишется в файл, который коммитится,
    // а коммит его же и меняет). Раньше блокировка закрепления спасала не всегда:
    // любой коммит с не-sync файлом (log.md, отчёт) обновлял head → производные
    // расходились с источником → exit 2 → ещё один коммит → head снова отстаёт.
    // Поэтому участок обёрнут volatile-маркерами: --check его вырезает (`:1288`),
    // а write-путь сравнивает точно (`:1352`) и значение по-прежнему обновляется.
    `${VOLATILE.start}- HEAD: \`${state.head ?? '—'}\`${VOLATILE.end}`,
    '',
    '## Прогресс',
    '',
    `- Банк: **${goal.current} / ${goal.target}** (${goal.percent}%)`,
    `- Осталось: ${goal.remaining}`,
    `- Добавлено сегодня: ${goal.added_today ?? '—'}`,
    `- Темп (7 дней): ${goal.avg_daily_7d ?? '—'} в день`,
    '',
    '## Банк по темам (по возрастанию — дыры сверху)',
    '',
    '| count / target | тема | slug |',
    '|---|---|---|',
    ...rows,
    '',
    '## Milestone',
    '',
    `- Чек-листов в PLAN.md: ${milestonesRaw.done} выполнено из ${milestonesRaw.total}`,
    ...list(milestonesRaw.running),
    '',
    '## Коммиты банка (M4.0)',
    '',
    ...list(topicsRaw),
    '',
    '## Следующие шаги',
    '',
    ...list([
      'M4.0: держать базу зелёной — `npm run sync` после каждой задачи, `npm run sync:check` как гейт.',
      'M2.9: массовая генерация (банк 183/300).',
      'M5: монетизация (Cloudflare Worker, Telegram Stars) — по approve капитана.',
    ]),
    '',
    '## Ссылки',
    '',
    '- Центр разработки: `docs/index.html` (сгенерирован)',
    '- Спеки: `.project/specs/` · индекс: `.project/SPEC.md`',
    '- Журнал решений: `.project/log.md`',
    '- Политики: `.project/DOD.md`, `.project/TOKENS.md`, `.project/ORCH-RULES.md`',
    '',
  ];
  return lines.join('\n');
}

function renderSpecMd(ctx) {
  const { specs, state } = ctx;
  const lines = [
    '# LinuxExam — Индекс спецификаций',
    '',
    '> ФАЙЛ СГЕНЕРИРОВАН: `.project/sync.mjs` из `.project/specs/*.md`.',
    '> Индекс руками не правится — добавляй спеку в `.project/specs/`.',
    '',
    // spec 012: см. renderStateMd — участок с state.head вырезается гейтом (`--check`).
    `${VOLATILE.start}- HEAD: \`${state.head ?? '—'}\`${VOLATILE.end}`,
    `- Спек: ${specs.length}`,
    `- Порядок: ${STATUS_ORDER.join(' → ')}`,
    '',
  ];
  if (specs.length === 0) {
    lines.push('Спек пока нет.', '', 'Шаблон: `.project/specs/README.md`.', '');
    return lines.join('\n');
  }
  lines.push('| id | slug | type | status | commit | updated |', '|---|---|---|---|---|---|');
  for (const s of specs) {
    lines.push(
      `| ${s.id} | \`${s.slug}\` | ${s.type} | ${s.status} | ${s.commit ?? '—'} | ${s.updated ?? '—'} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

/* ----------------------------------------------------------------- html */

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/**
 * ID спек, правленных относительно коммита (`git status` не пуст по путям спек).
 *
 * «Работа в ходу» для колонки Doing — это черновик, который лежит в рабочем
 * дереве изменённым. Черновик без правок — задокументированный backlog, а не
 * текущая работа. Признак стабилен: состояние путей в git не зависит ни от
 * wall-clock, ни от mtime файла, поэтому клон и `touch` не меняют HTML.
 *
 * Замена прежнего `Date.now() - s.mtimeMs <= 2 ч`, из-за которого спека
 * переезжала Doing ↔ Next сама и `sync:check` давал exit 2 без дрейфа.
 */
function readDirtySpecIds() {
  try {
    const raw = git(['status', '--porcelain', '-uno', '--', rel('.project/specs')]);
    const ids = new Set();
    for (const line of raw.split('\n')) {
      const m = /(\d+)-[^/\\]*\.md\s*$/.exec(line.replace(/^..\s+/, ''));
      if (m) ids.add(m[1]);
    }
    return ids;
  } catch (e) {
    warn(`git status по спекам не удался (${e.message})`);
    return new Set();
  }
}

/** Записи `docs/memory/alerts.md`, которые ещё НЕ закрыты. */
function openAlerts(doc) {
  const open = (doc.entries || []).filter((e) => !/\[closed/i.test(e.body || ''));
  const oldest = open
    .map((e) => e.date)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()[0];
  return { count: open.length, oldest };
}

/* --- C2c: человеческий язык для технических подстрок (только рендер) --- */

/** ISO-таймстамп → «обновлено 27.09, 15:37» / «3 ч назад» / «только что». */
function humanTime(iso) {
  const t = Date.parse(String(iso ?? ''));
  if (!Number.isFinite(t)) return 'обновлено недавно';
  const d = new Date(t);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dm = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} ч назад`;
  return `обновлено ${dm}, ${hhmm}`;
}

/** ISO-дата → DD.MM. */
const shortDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d ?? ''));
  return m ? `${m[3]}.${m[2]}` : '';
};

/**
 * Технические подстроки → человеческий язык. ТОЛЬКО для текста, который
 * попадает в HTML; источники (`log.md`, `alerts.md`) не переписываются.
 */
function humanizeText(s) {
  return String(s ?? '')
    .replace(/commit pending/gi, 'ещё не закоммичено')
    .replace(/\[AUTHORIZE\]/g, 'push разрешён')
    .replace(/rule2-exception/gi, 'исключение из правила 2')
    .replace(/rule13-exception/gi, 'исключение из правила 13')
    .replace(/sync:check/gi, 'проверка синхронизации')
    .replace(/exit 2/gi, 'не прошла')
    .replace(/ORCH-RULES/gi, 'правила оркестратора')
    .replace(/\.project\/sync\.mjs|sync\.mjs/gi, 'генератор центра')
    .replace(/\.project\/state\.json|state\.json/gi, 'состояние проекта')
    .replace(/\.project\/log\.md|log\.md/gi, 'журнал событий')
    .replace(/\balerts\.md\b/gi, 'журнал тревог');
}

/**
 * Обрезка по границе предложения: сначала по последнему «.», «!», «?», «…»
 * внутри лимита, затем по последней запятой/тире; иначе — по лимиту. В конец
 * добавляется «…», чтобы обрезка была видна.
 */
function trimToSentence(text, limit = 180) {
  const s = String(text ?? '');
  if (s.length <= limit) return s;
  const cut = s.slice(0, limit);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('… '));
  if (sentence > limit * 0.4) return `${cut.slice(0, sentence + 1).trim()}…`;
  const soft = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf(' — '));
  if (soft > limit * 0.4) return `${cut.slice(0, soft).trim()}…`;
  return `${cut.trim()}…`;
}

/** Текст записи тревоги: плейн-строки без code-span, обрезанные по предложению. */
const alertBodyText = (body) => trimToSentence(String(body ?? '').replace(/`/g, ''), 180);

/**
 * Уровни свежести данных для плитки «Состояние» (4 уровня, санкционировано
 * капитаном 29.09.2026). spec 029 описывает только 🟢/🔴; уровни добавлены для
 * честности — плитка должна показывать свежесть данных, а не только факт
 * синхронности.
 *
 * Пороги: Fresh < 24 ч, Aging < 48 ч, Stale < 96 ч, Critical ≥ 96 ч.
 * Возраст считает `getFreshnessTime()` — от времени коммита `state.json` и/или
 * метки `.project/.heartbeat` (см. ниже). Поле `last_sync` удалено из
 * `state.json`: volatile timestamp в коммитимом файле давал churn и цикл
 * sync↔converge (это же — закрытие записи «defect | last_sync статичен»).
 */
const FRESHNESS_LEVELS = [
  { limitMs: 24 * 3600 * 1000, status: 'ok', text: 'Свежие' },
  { limitMs: 48 * 3600 * 1000, status: 'warn', text: 'Подустарели' },
  { limitMs: 96 * 3600 * 1000, status: 'warn2', text: 'Устарели' },
  { limitMs: Number.POSITIVE_INFINITY, status: 'bad', text: 'Критически старые' },
];

/**
 * Время, от которого считается свежесть данных: максимум из двух источников.
 *
 *   1. время последнего коммита, затрагивавшего `.project/state.json`
 *      (`git log -1 --format=%ct`) — свежесть «по состоянию»;
 *   2. mtime `.project/.heartbeat` — метка «sync состоялся» (вне git, пишется
 *      в конце успешного прогона `main`).
 *
 * Максимум нужен потому, что `sync` без коммита не двигает git-время:
 * heartbeat — свидетель «данные только что собраны».
 *
 * Возвращает `null`, если недоступны оба — вызывающий трактует это как
 * «нет данных о синхронизации» (уровень Critical).
 *
 * Параметра состояния здесь больше нет: volatile-поле `last_sync` удалено из
 * `state.json` (timestamp в коммитимом файле = churn и цикл sync↔converge).
 */
function getFreshnessTime(root = ROOT) {
  let gitTime = null;
  try {
    const ct = git(['log', '-1', '--format=%ct', '--', '.project/state.json']);
    const sec = Number(String(ct).trim());
    if (Number.isFinite(sec) && sec > 0) gitTime = sec * 1000;
  } catch (e) {
    gitTime = null;
  }
  let heartbeatTime = null;
  try {
    heartbeatTime = fs.statSync(path.join(root, HEARTBEAT_REL)).mtimeMs;
  } catch (e) {
    heartbeatTime = null;
  }
  const known = [gitTime, heartbeatTime].filter(
    (t) => typeof t === 'number' && Number.isFinite(t) && t > 0,
  );
  return known.length === 0 ? null : Math.max(...known);
}

/**
 * C2d: Пульс — 4 плитки уровня 1 (spec 029, критерий приёмки 1–4).
 * `tile()` строит одну плитку; пустые значения показываются как «—».
 */
function pulseTiles(ctx) {
  const { goal, specs, alerts } = ctx;
  const tile = (label, value, note) => [
    `    <div class="pulse-tile"><div class="pulse-tile__label">${esc(label)}</div>`,
    `      <div class="pulse-tile__value">${value}</div>`,
    note ? `      <div class="pulse-tile__note">${esc(note)}</div>` : '',
    '    </div>',
  ].filter(Boolean).join('\n');

  // Свежесть данных: ТОЛЬКО свежесть данных — 4 уровня (Fresh/Aging/Stale/Critical)
  // плюс случай «нет данных». Сигнала синхронности центра здесь БОЛЬШЕ НЕТ
  // (override spec 029, санкционировано капитаном 29.09.2026): он вычислялся ДО
  // коммита — через `isCenterInSync()`, — а коммит меняет HEAD, поэтому
  // закоммиченный 🔴 «Есть расхождения» залипал в файле навсегда (converge
  // 8a4afa3), и снять его было нечем: плитку вырезают и VOLATILE (гейт), и
  // contentSansIndicator. Сигнал «центр отстал» живёт в гейте — `npm run sync:check`
  // и CLI, не в HTML.
  //
  // Блок обёрнут VOLATILE (см. ниже): статус — функция wall-clock, а `--check`
  // сравнивает производные побайтово; без обёртки гейт краснел бы от одного
  // течения времени. Пометка детерминирована состоянием: относительное
  // «обновлено N назад» зависело бы от текущей минуты и переписывало бы
  // docs/index.html на каждом sync → git-грязь → цикл.
  const freshAt = getFreshnessTime();
  const age = freshAt === null ? Number.POSITIVE_INFINITY : Date.now() - freshAt;
  const level = FRESHNESS_LEVELS.find((l) => age < l.limitMs);
  // Нет ни git-времени, ни heartbeat (или возраст не попал ни в один порог:
  // последний порог — POSITIVE_INFINITY, а `Infinity < Infinity` ложно) — «нет данных».
  const noData = freshAt === null || level === undefined;
  const status = noData ? 'bad' : level.status;
  const statusText = noData ? 'Нет данных' : level.text;
  const statusNote = noData ? 'источники freshness недоступны' : '';
  const stateValue = `<span class="dot dot--${status}"></span>${statusText}`;

  const bankValue = `${goal.current}/${goal.target} · ${goal.percent}%`;
  const bankNote = goal.added_today != null ? `+${goal.added_today} за сутки` : '';

  const queued = specs.filter((s) => s.status === 'preview').length;
  const debts = openAlerts(alerts || { entries: [] });

  return [
    '    <div class="pulse">',
    // VOLATILE-маркеры — сестринские элементы внутри .pulse, СНАРУЖИ плитки:
    // note проходит через esc(), и маркеры внутри были бы экранированы —
    // stripVolatile перестал бы их видеть. Гейт вырезает блок, write-путь
    // (точное сравнение) обновляет его как обычно.
    VOLATILE.start,
    tile('Свежесть данных', stateValue, statusNote),
    VOLATILE.end,
    tile('Банк', esc(bankValue), bankNote),
    tile('Требует решения', queued === 0 ? '—' : String(queued), 'спеки в preview'),
    tile('Долги', String(debts.count), debts.oldest ? `старейшая ${shortDate(debts.oldest)}` : ''),
    '    </div>',
  ].join('\n');
}

/**
 * Секция «Done / Doing / Next» — первый блок центра (M6.0 Phase 2, D3).
 *
 * Три колонки: что закрыто, что в работе, что дальше. Колонки видны ВСЕГДА,
 * даже пустые: пустая колонка — это утверждение («ничего не в работе»), а её
 * отсутствие — неизвестность. Капитану нужно различать эти два состояния.
 *
 * DOING = specs running/approved + черновики, ПРАВЛЕННЫЕ в рабочем дереве
 * (`readDirtySpecIds()`). «Свежий draft» — это работа, которая идёт, но ещё не
 * переведена в running: ровно так выглядела ночная смена 2026-09-27. Признак
 * «идёт» объявлен состоянием git, а не временем: wall-clock и mtime файла
 * делали HTML недетерминированным (спека сама переезжала Doing ↔ Next через два
 * часа без правок, и `sync:check` краснел без реального дрейфа).
 */
function renderDoneDoingNext(ctx) {
  const { specs, roles, products, dirtySpecIds, cplanVersion, cplanStep } = ctx;

  const done = specs
    .filter((s) => s.status === 'done')
    .sort((a, b) => String(b.updated ?? '').localeCompare(String(a.updated ?? '')))
    .slice(0, 10);

  const doing = specs.filter((s) => s.status === 'running' || s.status === 'approved');
  const dirty = dirtySpecIds instanceof Set ? dirtySpecIds : new Set();
  const freshDrafts = specs.filter((s) => s.status === 'draft' && dirty.has(s.id));
  const nextSpecs = specs.filter((s) => s.status === 'draft' && !dirty.has(s.id));
  const nextProducts = (products || []).filter((p) => p.status === 'planned');

  const item = (title, meta) => [
    '          <li class="ddn__item">',
    `            <span class="ddn__title">${esc(title)}</span>`,
    meta ? `            <span class="ddn__meta">${esc(meta)}</span>` : '',
    '          </li>',
  ].filter(Boolean).join('\n');

  const specItem = (s, extra) =>
    item(`#${s.id ?? '—'} ${s.slug ?? ''}`, `${s.type ?? ''}${extra ? ' · ' + extra : ''}`);

  const col = (key, title, items, empty) => [
    `        <div class="ddn__col ddn__col--${key}">`,
    `          <h3 class="ddn__h">${esc(title)} <span class="ddn__count">${items.length}</span></h3>`,
    items.length === 0
      ? `          <p class="ddn__empty">${esc(empty)}</p>`
      : ['          <ul class="ddn__list">', ...items, '          </ul>'].join('\n'),
    '        </div>',
  ].join('\n');

  const doneItems = done.map((s) => specItem(s, ''));
  const doingItems = [...doing.map((s) => specItem(s, s.status)), ...freshDrafts.map((s) => specItem(s, 'draft (свежий)'))];
  const nextItems = [
    ...nextSpecs.map((s) => specItem(s, 'draft')),
    ...nextProducts.map((p) => item(`продукт: ${p.name}`, p.metric || 'запланирован')),
  ];
  // C2c: сводка тревог. `openAlerts()` считает записи без `[closed` (см. alerts.md).
  const c2cAlerts = openAlerts(ctx.alerts || { entries: [] });
  const alertsLine = `Тревоги · открытых: ${c2cAlerts.count}${c2cAlerts.oldest ? ` · старейшая: ${shortDate(c2cAlerts.oldest)}` : ''}`;

  return [
    '  <section class="ddn" id="ddn">',
    '    <h2>Done / Doing / Next</h2>',
    '    <div class="ddn__grid">',
    col('done', 'Done', doneItems, 'Ничего не закрыто'),
    col('doing', 'Doing', doingItems, 'Ничего не в работе'),
    col('next', 'Next', nextItems, 'Очередь пуста'),
    '    </div>',
    // C2d: единый блок Плана вместо строки «Планы: …» (C2b-1) и удалённых
    // plan-factory/plan-dev. Версии читаются из машинных шапок планов, поэтому
    // строка не стареет руками; completed — закрытые инициативы из материалов C-PLAN.
    `    <div class="subline muted">План · Центр v${esc(cplanVersion)} 🔵 (${esc(cplanStep)}) · закрыто: F0–F5, D0–D4</div>`,
    `    <div class="subline muted">${esc(alertsLine)}</div>`,
    '  </section>',
  ].join('\n');
}

function renderCenter(ctx) {
  const { state, goal, topics, specs, head, inSync, logTail, commits } = ctx;

  // Группы спек: только реально встречающиеся статусы (`preview`/`running`
  // сегодня не используются) — пустая группа не выводится.
  const specGroups = [
    ['approved', 'Утверждены'],
    ['preview', 'Предпросмотр'],
    ['running', 'В работе'],
    ['draft', 'Черновики'],
    ['done', 'Завершены'],
    ['rejected', 'Отклонены'],
  ];
  const specItems = specGroups
    .filter(([st]) => specs.some((s) => s.status === st))
    .map(([st, label]) => [
      `          <div class="spec-group">${esc(label)} · ${specs.filter((s) => s.status === st).length}</div>`,
      '          <ul class="spec-list">',
      ...specs.filter((s) => s.status === st).map((s) => `            <li>#${esc(s.id)} ${esc(s.slug)}</li>`),
      '          </ul>',
    ].join('\n'));
  const specsRows = specs.length === 0
    ? '          <p class="empty">Спек пока нет</p>'
    : specItems.join('\n');

  const topicRows = topics
    .map((t) => {
      const pct = t.target > 0 ? Math.min(100, Math.round((t.count / t.target) * 100)) : 0;
      const gap = t.count < t.target * 0.5 ? ' topic--gap' : '';
      return [
        `        <div class="topic${gap}">`,
        `          <div class="topic__label">${esc(t.label)}</div>`,
        '          <div class="topic__bar">'
          + `<div class="topic__fill" style="width:${pct}%"></div></div>`,
        `          <div class="topic__count">${t.count} / ${t.target}</div>`,
        '        </div>',
      ].join('\n');
    })
    .join('\n');

  const policyCards = POLICY_FILES
    .map((p) => [
      '        <li>',
      `          <span class="policy__title">${esc(p.title)}</span>`,
      `          <code>${esc(p.file)}</code>`,
      `          <span class="muted">${esc(p.note)}</span>`,
      '        </li>',
    ].join('\n'))
    .join('\n');

  /* --- D3: коммиты (20 из git log).
   * Самоссылочный участок: см. VOLATILE выше. Обёрнут маркерами, чтобы `--check`
   * не требовал лишнего коммита из-за появления в списке самого коммита sync. */
  // C2d: «Решения» — последние записи log.md (источник append-only, читаем).
  const recentLog = readRecentLog(5);
  const decisionRows = recentLog.length === 0
    ? '        <li class="muted">Журнал пуст.</li>'
    : recentLog
      .map((d) => `        <li><span class="mono muted">${esc(shortDate(d.date))}</span> · ${esc(humanizeText(trimToSentence(d.text, 200)))}</li>`)
      .join('\n');

  const commitRows = (commits || []).length === 0
    ? '        <tr><td colspan="4" class="muted">Нет данных git log.</td></tr>'
    : commits
      .map((c) => [
        '        <tr>',
        `          <td class="mono">${esc(c.sha)}</td>`,
        `          <td>${c.type ? `<span class="ctype ctype--${esc(c.type)}">${esc(c.type)}</span>` : '<span class="muted">—</span>'}</td>`,
        `          <td>${esc(c.subject)}</td>`,
        `          <td class="mono muted">${esc(c.date)}</td>`,
        '        </tr>',
      ].join('\n'))
      .join('\n');

  /* --- F2.4 блок 1: «Память» — 5 тетрадей, мета и чип свежести.
   * Возраст считается от wall-clock → весь блок volatile (см. VOLATILE). */
  const notebookRows = NOTEBOOKS.map((nb) => {
    const meta = readNotebookMeta(nb.file);
    if (!meta) {
      return `        <tr><td class="mono">${esc(nb.label)}</td><td colspan="4" class="muted">нет файла: <code>${esc(nb.file)}</code></td></tr>`;
    }
    const chip = freshnessChip(meta.ageHours);
    const age = meta.ageHours == null
      ? '—'
      : (meta.ageHours < 1 ? '<1 ч' : `${meta.ageHours} ч`)
        + (meta.ageHours >= 24 ? ` (~${(meta.ageHours / 24).toFixed(1)} дн)` : '');
    return [
      '        <tr>',
      `          <td class="mono">${esc(nb.label)}</td>`,
      `          <td class="mono muted">${esc(meta.updated || '—')}</td>`,
      `          <td class="mono">${meta.entries == null ? '—' : meta.entries}</td>`,
      `          <td class="muted">${esc(age)}</td>`,
      `          <td><span class="chip ${chip.cls}">${esc(chip.text)}</span></td>`,
      '        </tr>',
    ].join('\n');
  }).join('\n');

  /* --- F2.4 блок 4: «Тревоги» — все записи alerts.md, новые сверху */
  const alertsDoc = readAlerts();
  const alertsHtml = alertsDoc.entries.length === 0
    ? '        <p class="empty">Тревог нет</p>'
    : alertsDoc.entries
      .map((a) => [
        '        <div class="entry">',
        `          <div class="entry__title">${esc(shortDate(a.date))} | ${esc(humanizeText(a.title))}</div>`,
        a.body ? `          <div class="entry__body muted">${esc(humanizeText(alertBodyText(a.body)))}</div>` : '',
        '        </div>',
      ].filter(Boolean).join('\n'))
      .join('\n');

  /* --- F3.0b блок 6: «Пульс агентов» — из .agent-teams/<teamId>/team.json (спека 022) */
  const agentsDoc = readAgentTeams();
  const agentsHtml = agentsDoc.teams.length === 0
    ? `        <p class="empty">${agentsDoc.present ? 'нет данных — команд нет' : 'нет данных — каталог .agent-teams/ отсутствует'}</p>`
    : agentsDoc.teams.map(renderAgentTeamCard).join('\n');

  const doneDoingNextHtml = renderDoneDoingNext({
    specs,
    roles: ctx.roles,
    products: ctx.products,
    alerts: ctx.alerts,
    cplanVersion: ctx.cplanVersion,
    cplanStep: ctx.cplanStep,
    dirtySpecIds: readDirtySpecIds(),
  });

  return `<!DOCTYPE html>
<!--
  docs/index.html — ЦЕНТР РАЗРАБОТКИ LinuxExam.
  ФАЙЛ СГЕНЕРИРОВАН автоматически (генератор центра) из состояния проекта. Правки затираются.
  Без фреймворков, без билда, без кнопок — только видимость состояния.
  Старый дашборд V1–V9 остаётся в docs/dashboard/ для сравнения.
-->
<html lang="ru" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LinuxExam — Центр разработки</title>
<style>
:root {
  color-scheme: dark;
  --bg: #1E1E1E;
  --bg-elev: #252525;
  --fg: #FFFFFF;
  --fg-muted: #B0B0B0;
  --accent: #2196F3;
  --ok: #4CAF50;
  --warn: #FF9800;
  --fail: #FF5C4A;
  --border: rgba(255, 255, 255, 0.12);
  --mono: 'JetBrains Mono', Consolas, monospace;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 0.875rem;
  line-height: 1.5;
}
code { font-family: var(--mono); font-size: 0.8125rem; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
section { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 12px; padding: 16px 20px; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
h2 { font-size: 0.8125rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); font-weight: 600; margin: 0 0 12px; }
.muted { color: var(--fg-muted); }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.head__row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 4px; color: var(--fg-muted); }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.dot--ok { background: var(--ok); }
.dot--bad { background: var(--fail); }
.dot--warn { background: #d9a800; }
/* 4 уровня свежести: Aging = .dot--warn (#d9a800), Stale = .dot--warn2 (оранжевый,
   темнее), Critical = .dot--bad. Пороги/тексты — FRESHNESS_LEVELS (pulseTiles). */
.dot--warn2 { background: #b87700; }
/* C2d: Пульс — 4 плитки уровня 1 в одном ряду (критерий приёмки 1: без прокрутки) */
.pulse { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 10px; }
@media (max-width: 820px) { .pulse { grid-template-columns: repeat(2, 1fr); } }
.pulse-tile { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; }
.pulse-tile__label { font-size: 0.6875rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 6px; }
.pulse-tile__value { font-family: var(--mono); font-size: 1.0625rem; font-variant-numeric: tabular-nums; }
.pulse-tile__note { color: var(--fg-muted); font-size: 0.75rem; margin-top: 4px; }
/* C2d: подстрочники внутри карточек (ddn и др.) */
.subline { margin-top: 10px; font-size: 0.75rem; }
.progress__nums { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; }
.progress__cur { font-size: 2.25rem; font-weight: 700; color: var(--accent); line-height: 1; }
.progress__tot { font-size: 2.25rem; font-weight: 700; line-height: 1; }
.progress__pct { color: var(--fg-muted); margin-left: auto; }
.progress__bar { height: 12px; background: var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
.progress__fill { height: 100%; background: var(--accent); }
.topic { display: grid; grid-template-columns: 180px 1fr 80px; gap: 16px; align-items: center; padding: 4px 0; }
.topic__bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.topic__fill { height: 100%; background: var(--ok); }
.topic--gap .topic__fill { background: var(--fail); }
.topic__count { text-align: right; color: var(--fg-muted); font-family: var(--mono); font-size: 0.8125rem; }
.empty { color: var(--fg-muted); margin: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
th { color: var(--fg-muted); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }
.chip { border: 1px solid var(--border); border-radius: 6px; padding: 1px 8px; font-family: var(--mono); font-size: 0.75rem; }
.chip--preview { color: var(--warn); border-color: var(--warn); }
.chip--running { color: var(--accent); border-color: var(--accent); }
.chip--approved, .chip--done { color: var(--ok); border-color: var(--ok); }
.chip--rejected, .chip--blocked { color: var(--fail); border-color: var(--fail); }
.chip--in_progress { color: var(--accent); border-color: var(--accent); }
/* F2.4: «Решения» и «Тревоги» — плотный список без таблицы */
.entry { border-top: 1px solid var(--border); padding: 8px 0; }
.entry:first-child { border-top: none; }
.entry__title { font-weight: 600; }
.entry__body { font-size: 0.85rem; margin-top: 2px; }
/* F2.4 (spec 028): «Тревоги» — сворачиваемая секция, card-стиль как у section.
   C2b-2: тот же card-стиль нужен commits/notebooks/policies, поэтому селектор
   обобщён на класс collapsible (единый паттерн details class="collapsible …");
   правила НЕ дублируются по секциям. */
details.collapsible { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 16px; padding: 20px 24px; }
details.collapsible > summary { cursor: pointer; list-style: none; font-size: 0.8125rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); font-weight: 600; margin: 0; }
details.collapsible > summary::-webkit-details-marker { display: none; }
details.collapsible[open] > summary { margin-bottom: 12px; }
.log { margin: 0; padding-left: 18px; }
.log li { font-family: var(--mono); font-size: 0.8125rem; color: var(--fg-muted); }
.policies { list-style: none; margin: 0; padding: 0; }
.policies li { display: flex; flex-wrap: wrap; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.policy__title { color: var(--accent); font-weight: 600; min-width: 110px; }

/* --- Done / Doing / Next (D3) */
.ddn__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 820px) { .ddn__grid { grid-template-columns: 1fr; } }
.ddn__col { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
.ddn__h { font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); font-weight: 600; margin: 0 0 10px; }
.ddn__col--doing .ddn__h { color: var(--accent); }
.ddn__col--done .ddn__h { color: var(--ok); }
.ddn__count { color: var(--fg-muted); font-family: var(--mono); }
.ddn__list { list-style: none; margin: 0; padding: 0; }
.ddn__item { padding: 6px 0; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }
.ddn__item:last-child { border-bottom: 0; }
.ddn__title { font-family: var(--mono); font-size: 0.8125rem; }
.ddn__meta { color: var(--fg-muted); font-size: 0.75rem; }
.ddn__empty { color: var(--fg-muted); margin: 0; font-size: 0.8125rem; }
.ddn__plans { margin-top: 10px; font-size: 0.75rem; }
/* C2c: группы спек внутри <details id="specs"> */
.spec-group { margin: 12px 0 6px; font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted); }
.spec-list { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 14px; }
.spec-list li { font-family: var(--mono); font-size: 0.8125rem; }

/* --- бейджи типов коммитов (секция «Коммиты») */
.ctype { font-family: var(--mono); font-size: 0.75rem; border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; color: var(--fg-muted); }
.ctype--feat { color: var(--ok); border-color: var(--ok); }
.ctype--fix { color: var(--accent); border-color: var(--accent); }
.ctype--docs { color: var(--fg-muted); }
.ctype--chore { color: var(--warn); border-color: var(--warn); }
</style>
</head>
<body>
<div class="wrap">

  <section class="head" id="head">
    <h1>Центр разработки</h1>
    <div class="head__row">
      <span class="muted">LinuxExam · состояние проекта собирается автоматически</span>
      ${VOLATILE.start}<span class="mono">на ${esc(String(head).slice(0, 7))}</span>${VOLATILE.end}
    </div>
${pulseTiles({ state, goal, specs, inSync, alerts: ctx.alerts })}
  </section>

  <section class="progress" id="progress">
    <h2>Темы банка · ${topics.length}</h2>
    <details class="collapsible progress-topics" id="progress-topics">
      <summary>Раскрыть темы · всего: ${topics.length}</summary>
${topicRows}
    </details>
  </section>

${doneDoingNextHtml}

  <details class="collapsible specs" id="specs">
    <summary>Спеки · всего: ${specs.length}</summary>
${specsRows}
  </details>

  <details class="collapsible commits" id="commits">
    <summary>Коммиты · последних ${COMMITS_IN_CENTER}</summary>
    <table>
      <thead>
        <tr><th>SHA</th><th>тип</th><th>сообщение</th><th>дата</th></tr>
      </thead>
      <tbody>
${VOLATILE.start}
${commitRows}
${VOLATILE.end}
      </tbody>
    </table>
  </details>

  <details class="collapsible notebooks" id="notebooks">
    <summary>Память · тетрадей: ${NOTEBOOKS.length}</summary>
    <div class="muted">Свежесть: 🟢 &lt;1 фазы (&lt;72 ч) · 🟡 1–2 фазы (72–144 ч) · 🔴 &gt;2 фаз (&gt;144 ч)</div>
    <table>
      <thead>
        <tr><th>тетрадь</th><th>updated</th><th>записей</th><th>возраст</th><th>свежесть</th></tr>
      </thead>
      <tbody>
${VOLATILE.start}${notebookRows}${VOLATILE.end}
      </tbody>
    </table>
  </details>

  <details class="collapsible decisions" id="decisions">
    <summary>Решения · последних ${recentLog.length}</summary>
    <ul class="log">
${decisionRows}
    </ul>
  </details>

  <details class="collapsible policies" id="policies">
    <summary>Политики · документов: ${POLICY_FILES.length}</summary>
    <ul class="policies">
${policyCards}
    </ul>
  </details>

  <details class="collapsible alerts" id="alerts">
    <summary>Тревоги · записей: ${alertsDoc.total}</summary>
    <div class="muted">Источник: <code>docs/memory/alerts.md</code> · записей: ${alertsDoc.total}</div>
${alertsHtml}
  </details>

  <section class="agents" id="agents">
    <h2>Пульс агентов</h2>
    <div class="muted">Источник: <code>.agent-teams/*/team.json</code> · команд: ${agentsDoc.teams.length}</div>
${agentsHtml}
  </section>

</div>
</body>
</html>
`;
}

/* ----------------------------------------------------------------- main */

/** Дополнительные источники фабрики (M6.0 Phase 2, D3). */
const FACTORY_DIR = rel('.project/factory');
const ROLES_PATH = rel('.project/factory/roles.yaml');
const AUDITS_DIR = rel('.project/audits');
const MEMORY_FACTORY_PATH = rel('.project/factory/MEMORY-FACTORY.md');

function fail(message) {
  process.stderr.write(`sync: FAIL — ${message}\n`);
  process.exitCode = 1;
}

function main() {
  // C2a-3: read-only диагностика индикатора «Состояние» (см. `inSyncProbe`).
  if (process.argv.includes('--in-sync-probe')) {
    inSyncProbe();
    return;
  }
  const state = readState();
  const fullHead = readFullHead();
  const specs = readSpecs();
  const logTail = readLogTail();
  const topics = buildTopics(state);
  const milestonesRaw = readMilestoneProgress();

  // --- HEAD, зафиксированный в состоянии (ИНФОРМАЦИОННОЕ поле, не гейт).
  //
  // Поле обязано быть СТАБИЛЬНЫМ: производные (STATE.md, docs/index.html) содержат
  // его значение, а `--check` сравнивает производные побайтово. Если писать сюда
  // всегда текущий HEAD, то после коммита синхронизации head отстаёт на один коммит
  // → побайтовое сравнение всегда краснеет → снова вечный convergence-цикл.
  //
  // Поэтому: пока сдвинулись ТОЛЬКО синхронизируемые выходы, head сохраняется
  // прежним; при реальном движении базы (любой не-sync файл) — обновляется.
  //
  // ЧТО ИЗМЕНИЛ spec 009: раньше `--check` требовал head == HEAD, и это был ГЕЙТ.
  // Любой не-sync коммит (спека, отчёт, документ) делал гейт красным при полностью
  // корректных производных, а закрыть его можно было только ещё одним коммитом.
  // За смену 2026-09-27 это стоило 5 лишних коммитов. Теперь это требование снято:
  // проверяется реальный дрейф (производные совпадают с источником и закоммичены).
  const pinnedHead = state.head ?? null;
  let head = fullHead;
  if (pinnedHead === null || pinnedHead === undefined) {
    info(`state.head закреплён впервые: ${fullHead}`);
  } else if (movesOnlySyncFiles(pinnedHead)) {
    head = pinnedHead;
  } else {
    info(`база изменилась: head ${pinnedHead.slice(0, 7)} → ${fullHead.slice(0, 7)}`);
  }

  const goal = state.goal ?? {};
  const target = targetQuestions(state);
  const current = Number(goal.current_questions ?? topics.reduce((s, t) => s + t.count, 0));
  const percent = Number(goal.progress_percent ?? Math.round((current / target) * 1000) / 10);
  const goalView = {
    target,
    current,
    percent,
    remaining: Math.max(0, target - current),
    added_today: goal.added_today ?? null,
    avg_daily_7d: goal.avg_daily_7d ?? null,
  };

  const specCommit = readSpecCommit(specs);
  const topicsRaw = [
    `Банк ${current} / ${target}`,
    `новых тем-коммитов: ${state.recent_commits?.length ?? 0} в recent_commits`,
    // Самоссылочный участок: head закрепляется, но печатается в STATE.md и в центре.
    // Раньше эта строка была вне маркеров, поэтому после не-sync коммита производные
    // расходились на один коммит и `sync:check` давал exit 2 без реального расхождения.
    // Гейт вырезает участок (`stripVolatile`), write-путь пишет точно (`:1352`).
    `${VOLATILE.start}HEAD (закреплён): \`${head}\`${VOLATILE.end}`,
  ];

  /* --- фабрика (D3): источники для секций центра «Роли», «Продукты»,
   * «Коммиты», «Аудит». roles.yaml — ИСТОЧНИК ИСТИНЫ, state.roles — зеркало. */
  const rolesDoc = readRoles();
  const rolesMirror = rolesDoc.roles.map((r) => ({
    name: r.name ?? null,
    title: r.title ?? r.name ?? null,
    status: r.status ?? 'planned',
    preset: r.preset ?? null,
    trigger: r.trigger ?? { human: null, check: null },
    blocked_by: r.blocked_by ?? null,
  }));
  const commitLog = readGitCommits(COMMITS_IN_CENTER);
  const auditIndex = readAuditIndex();
  const productsMirror = [
    {
      name: 'LinuxExam',
      status: 'frozen',
      metric: `${current} / ${target} вопросов`,
      metric_source: 'goal',
      frozen_at: '2026-09-27',
      frozen_by: 'ORCH-RULES правило 6',
    },
    { name: '<next>', status: 'planned', metric: null, metric_source: null, frozen_at: null, frozen_by: null },
  ];

  // --- F2.3 / D: YAML-шапки планов. Истина — docs/FACTORY-PLAN.md (исторический,
  // F0–F5) и docs/DEV-PLAN.md (активный, D0–D4); state.plan — зеркало.
  // Парсер ОДИН (readPlanYaml(path)); отсутствие DEV-PLAN.md — не ошибка: план
  // развития может быть не подключён, тогда dev = null, а allPhases = фазы мастера.
  const planDoc = readPlanYaml(FACTORY_PLAN_PATH);
  const devPlan = exists(DEV_PLAN_PATH) ? readPlanYaml(DEV_PLAN_PATH) : null;
  // C2d: активный план (C-PLAN) — третья шапка. Тем же парсером; если файл
  // отсутствует или шапка битая — `readPlanYaml` бросит исключение с причиной,
  // и синхронизация упадёт громко, а не покажет «плана нет» как факт.
  const cplanDoc = readPlanYaml(CPLAN_PATH);
  // `allPhases` — ЕДИНЫЙ список фаз обоих планов для потребителей, которые не
  // знают, сколько планов в проекте (правило 12 в `tools/check-episodic.mjs`,
  // а также любой будущий гейт «каждая закрытая фаза имеет запись в журнале»).
  // Порядок стабилен: сначала фабрика, затем развитие.
  const allPhases = planDoc.phases.concat(devPlan && devPlan.phases ? devPlan.phases : []);
  const planMirror = {
    // Легаси-поля мастера сохранены: их читают уже написанные потребители.
    version: planDoc.plan_version,
    phase: planDoc.current_phase,
    step: planDoc.current_step,
    phases: planDoc.phases,
    factory: planDoc,
    dev: devPlan,
    allPhases,
  };

  // --- состояние после синхронизации
  const nextState = {
    ...state,
    head,
    specs,
    log_tail: logTail,
    goal: { ...goal, current_questions: current, progress_percent: percent, target_questions: target },
    topics: topics.slice().sort((a, b) => a.slug.localeCompare(b.slug)),
    // --- зеркала фабрики (D1/D3). Истина: roles.yaml и git log; здесь — кэш для
    // потребителей, которые читают только state.json (центр, дашборд).
    schema_version: MIN_SCHEMA_VERSION,
    // ЭТО ПРОЕКЦИЯ, НЕ ИСТОЧНИК: commits[] собирается из `git log`, лог-хвост — из
    // `.project/log.md`. Оба меняются от каждого коммита, включая коммит самих производных,
    // поэтому «устаревшими» они становятся автоматически. В значение маркеры НЕ пишем:
    // state.json читают потребители, которые ждут чистый JSON (легаси-дашборд, центр).
    // Участок исключён из решения о записи (`projectedEqual`) и из гейта (`diffHeadProjected`).
    commits: commitLog,
    roles: rolesMirror,
    products: productsMirror,
    audits: auditIndex,
    // F2.3: проекция YAML-шапки плана (фазы, текущая фаза/шаг). Меняется только
    // вместе с docs/FACTORY-PLAN.md, поэтому дрейфа от коммитов не даёт.
    plan: planMirror,
  };
  // B1: `delete` — ОТДЕЛЬНОЙ строкой ПОСЛЕ литерала. `{ ...state }` переносит
  // существующий `last_sync` из файла, поэтому одного удаления строки-писателя
  // недостаточно: поле вернулось бы при первом же sync. Volatile timestamp
  // в коммитимом файле — источник churn и цикла sync↔converge.
  delete nextState.last_sync;
  if (specCommit && nextState.specs.length > 0 && !nextState.spec_commit) {
    nextState.spec_commit = specCommit;
  }

  // --- idempotentность: сравнение проекций состояния
  // Сдвиг `commits[]`/`log_tail` (проекция) не должен сам по себе означать новое
  // состояние — иначе каждый коммит требовал бы ещё одного. `last_sync` здесь
  // больше не копируется: поля нет вовсе. `before`/`after` ИСПОЛЬЗУЮТСЯ ниже
  // решением о записи state.json (`stateChanged`), поэтому остаются.
  const before = stateProjection(JSON.stringify(state)) ?? JSON.stringify(state);
  const after = stateProjection(JSON.stringify(nextState)) ?? JSON.stringify(nextState);

  // --- генерируем производные (в памяти), затем сравниваем с диском
  const ctxBase = {
    state,
    goal: goalView,
    topics,
    specs,
    head,
    milestonesRaw,
    topicsRaw,
    logTail,
    roles: rolesMirror,
    products: productsMirror,
    commits: commitLog,
    audits: auditIndex,
    plan: planDoc,
    devPlan,
    cplanVersion: cplanDoc.plan_version,
    cplanStep: String(cplanDoc.current_step ?? '').replace(/^C2\s*—\s*/i, 'C2 · '),
    alerts: readAlerts(),
  };
  const stateMd = renderStateMd({ ...ctxBase, state: nextState });
  const specMd = renderSpecMd({ ...ctxBase, state: nextState });
  // C2a-3: реальная проверка вместо hardcoded `true`. Считается ДО записи по
  // сгенерированному содержимому: «центр устарел» = то, что генератор выдаёт
  // сейчас, отличается от committed-версии центру (см. `isCenterInSync`).
  const centerPreview = renderCenter({ ...ctxBase, state: nextState, inSync: true });
  const centerHtml = renderCenter({
    ...ctxBase,
    state: nextState,
    inSync: isCenterInSync(centerPreview),
  });

  const targets = [
    { path: OUT_STATE_MD, content: stateMd },
    { path: OUT_SPEC_MD, content: specMd },
    { path: OUT_CENTER, content: centerHtml },
  ];

  // Для ГЕЙТА (`--check`) самоссылочные участки вырезаются: иначе каждый коммит
  // делает проверку красной и требует ещё одного коммита. См. VOLATILE.
  // ВАЖНО: решение о ЗАПИСИ ниже принимается по точному сравнению (`:809-816`),
  // иначе самоссылочный участок никогда не обновился бы.
  const diverged = targets
    .filter(
      (t) =>
        !exists(t.path) ||
        stripVolatile(normalizeLf(readText(t.path))) !== stripVolatile(normalizeLf(t.content)),
    )
    .map((t) => t.path);

  if (CHECK) {
    // --- READ-ONLY. Никаких записей: ни state.json, ни производных. Ранний
    // return ниже — единственная защита, ветка записи недостижима.
    const problems = [];

    // 1) схема state.json: обязательные ключи + версия схемы (spec 009 / D1)
    // `last_sync` из схемы исключён: volatile timestamp в коммитимом файле
    // (churn + цикл sync↔converge). Свежесть считает `getFreshnessTime()`
    // из git-времени state.json и `.project/.heartbeat`.
    for (const key of ['head', 'specs', 'log_tail']) {
      if (!(key in state)) problems.push(`.project/state.json: нет поля "${key}"`);
    }
    const sv = Number(state.schema_version ?? 1);
    if (sv < MIN_SCHEMA_VERSION) {
      problems.push(
        `.project/state.json: schema_version=${sv} < ${MIN_SCHEMA_VERSION} — нужен npm run state:update`,
      );
    }

    // 2) производные на диске должны совпадать с тем, что даёт источник
    for (const p of diverged) {
      problems.push(`${path.relative(ROOT, p)} отстал от state.json — нужен npm run sync`);
    }

    // 3) производные + state.json должны быть зафиксированы коммитом.
    // Производные сверяются с HEAD БЕЗ самоссылочных участков (VOLATILE): иначе
    // таблица коммитов давала ложное «изменён» после каждого коммита и требовала
    // ещё одного — цикл commits↔converge. `state.json` — по проекции
    // (`diffHeadProjected`): маркеры внутрь JSON не пишутся.
    const uncommitted = diffHeadProjected() || diffHeadStripped(targets);
    if (uncommitted === true) {
      problems.push('state.json/производные изменены и не закоммичены — sync → git add → commit');
    }

    // 4) ИНФОРМАЦИОННО (не гейт): из какого коммита собрано состояние.
    // Раньше это было жёсткое требование head == HEAD, из-за которого каждый
    // не-sync коммит требовал ещё одного sync-коммита для обновления head.
    const pin = String(state.head ?? '');
    if (pin !== fullHead) {
      info(
        `state.head ${pin.slice(0, 7)} — состояние собрано на этом коммите; git HEAD ${fullHead.slice(0, 7)} (не гейт, см. spec 009)`,
      );
    }

    if (problems.length > 0) {
      process.stderr.write('SYNC DRIFT: state.json и производные разошлись\n');
      for (const p of problems) process.stderr.write(`  - ${p}\n`);
      process.exitCode = 2;
      return;
    }
    process.stdout.write(
      `sync: ok (check) — производные совпадают с источником, HEAD ${fullHead} (read-only)\n`,
    );
    for (const n of notes) process.stdout.write(`  ${n}\n`);
    process.exitCode = 0;
    return;
  }

  // --- запись state.json
  // `head` — единственное самоссылочное поле, которое НЕ входит в проекцию
  // (`stateProjection` его вырезает), поэтому при равных проекциях коммит его не
  // обновлял, и производные (STATE.md/SPEC.md: volatile HEAD, docs/index.html: шапка)
  // показывали живой `readFullHead()` — голову, которой в `state.json` уже нет.
  // Держим источник и производные на одном значении: пишем, когда расходится `head`.
  const stateChanged = before !== after || state.head !== nextState.head;
  if (stateChanged) {
    writeLf(STATE_PATH, JSON.stringify(nextState, null, 2) + '\n');
  }

  // --- запись производных
  let written = 0;
  for (const t of targets) {
    if (!exists(t.path) || normalizeLf(readText(t.path)) !== normalizeLf(t.content)) {
      fs.mkdirSync(path.dirname(t.path), { recursive: true });
      writeLf(t.path, t.content);
      written += 1;
    }
  }

  // --- контроль: всё ли теперь совпадает (для честного индикатора)
  // Учитывает самоссылочные участки так же, как гейт (см. VOLATILE).
  const stillDiverged = targets.filter(
    (t) => stripVolatile(normalizeLf(readText(t.path))) !== stripVolatile(normalizeLf(t.content)),
  );
  const inSync = stillDiverged.length === 0;
  if (!inSync) {
    for (const t of stillDiverged) warn(`не удалось привести к источнику: ${path.relative(ROOT, t.path)}`);
  }

  // --- контроль кодировки всех сгенерированных файлов: LF, без BOM, 0x0A в конце
  const problems = [];
  for (const p of [OUT_STATE_MD, OUT_SPEC_MD, OUT_CENTER]) {
    const name = path.relative(ROOT, p);
    const bytes = fs.readFileSync(p);
    if (bytes[bytes.length - 1] !== 0x0a) problems.push(`${name}: последний байт не 0x0A`);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) problems.push(`${name}: BOM`);
    const cr = (bytes.toString('binary').match(/\r/g) ?? []).length;
    if (cr !== 0) problems.push(`${name}: CR=${cr}`);
  }
  if (problems.length > 0) {
    fail(problems.join('; '));
    return;
  }

  // --- heartbeat свежести: отметка «sync состоялся», вне git (HEARTBEAT_PATH).
  // Пишется ПОСЛЕДНЕЙ — после того как все производные записаны и проверены,
  // чтобы метка не «омолаживала» данные, которых нет на диске.
  try {
    writeLf(HEARTBEAT_PATH, String(Date.now()) + '\n');
  } catch (e) {
    warn(`не удалось записать ${HEARTBEAT_REL}: ${e.message}`);
  }

  const bytes = fs.readFileSync(OUT_CENTER);

  const out = [
    'sync: .project/STATE.md + .project/SPEC.md + docs/index.html обновлены',
    `  HEAD: ${head}`,
    `  банк: ${current}/${target} (${percent}%)`,
    `  темы: ${topics.length}`,
    `  specs: ${specs.length} (в очереди preview: ${specs.filter((s) => s.status === 'preview').length})`,
    `  log_tail: ${logTail.length} строк`,
    `  записано файлов: ${written}${stateChanged ? ' + state.json' : ' (state.json без изменений)'}`,
    `  state.json: ${stateChanged ? 'обновлён' : 'идемпотентен (содержимое то же)'}`,
    `  sha256 docs/index.html: ${crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16)}`,
    ...notes.map((n) => '  ' + n),
  ];
  process.stdout.write(out.join('\n') + '\n');
  process.exitCode = 0;
}

try {
  main();
} catch (e) {
  fail(e.message);
}
