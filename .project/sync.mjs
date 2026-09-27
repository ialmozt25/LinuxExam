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
 *   .project/STATE.md         — прогресс, банк/темы, HEAD, last_sync
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
    `- last_sync: ${state.last_sync ?? '—'}`,
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
 * Секция «Done / Doing / Next» — первый блок центра (M6.0 Phase 2, D3).
 *
 * Три колонки: что закрыто, что в работе, что дальше. Колонки видны ВСЕГДА,
 * даже пустые: пустая колонка — это утверждение («ничего не в работе»), а её
 * отсутствие — неизвестность. Капитану нужно различать эти два состояния.
 *
 * DOING = specs running/approved + черновики, изменённые за последние 2 часа
 * (mtime файла спеки). «Свежий draft» — это работа, которая идёт, но ещё не
 * переведена в running: ровно так выглядела ночная смена 2026-09-27.
 */
const DOING_DRAFT_WINDOW_MS = 2 * 60 * 60 * 1000;

function renderDoneDoingNext(ctx) {
  const { specs, roles, products, now } = ctx;

  const done = specs
    .filter((s) => s.status === 'done')
    .sort((a, b) => String(b.updated ?? '').localeCompare(String(a.updated ?? '')))
    .slice(0, 10);

  const doing = specs.filter((s) => s.status === 'running' || s.status === 'approved');
  const freshDrafts = specs.filter(
    (s) =>
      s.status === 'draft' &&
      s.mtime != null &&
      now - s.mtime <= DOING_DRAFT_WINDOW_MS,
  );
  const doingAll = [...doing, ...freshDrafts];

  const nextSpecs = specs.filter((s) => s.status === 'draft' && !freshDrafts.includes(s));
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

  const doneItems = done.map((s) => specItem(s, s.commit ? `commit ${s.commit}` : ''));
  const doingItems = [...doing.map((s) => specItem(s, s.status)), ...freshDrafts.map((s) => specItem(s, 'draft (свежий)'))];
  const nextItems = [
    ...nextSpecs.map((s) => specItem(s, 'draft')),
    ...nextProducts.map((p) => item(`продукт: ${p.name}`, p.metric || 'запланирован')),
  ];

  return [
    '  <section class="ddn" id="ddn">',
    '    <h2>Done / Doing / Next</h2>',
    '    <div class="ddn__grid">',
    col('done', 'Done', doneItems, 'Ничего не закрыто'),
    col('doing', 'Doing', doingItems, 'Ничего не в работе'),
    col('next', 'Next', nextItems, 'Очередь пуста'),
    '    </div>',
    '  </section>',
  ].join('\n');
}

function renderCenter(ctx) {
  const { state, goal, topics, specs, head, inSync, logTail, roles, products, commits, audits } = ctx;
  const circle = inSync ? 'ok' : 'bad';
  const statusText = inSync ? 'синхронизировано' : 'есть расхождение (запусти npm run sync)';

  const queue = specs.filter((s) => s.status === 'preview');
  const queueHtml = queue.length === 0
    ? '        <p class="empty">Решений не ждёт</p>'
    : queue
      .map((s) => [
        '        <div class="queue-item">',
        `          <div class="queue-item__id">${esc(s.id)} · <code>${esc(s.slug)}</code></div>`,
        `          <div class="queue-item__goal">${esc(s.goal) || '—'}</div>`,
        `          <div class="queue-item__meta">type: ${esc(s.type)} · spec: <code>.project/${esc(s.file)}</code></div>`,
        '        </div>',
      ].join('\n'))
      .join('\n');

  const specsRows = specs.length === 0
    ? '        <tr><td colspan="6" class="muted">Спек пока нет — шаблон: <code>.project/specs/README.md</code></td></tr>'
    : specs
      .map((s) => [
        '        <tr>',
        `          <td class="mono">${esc(s.id)}</td>`,
        `          <td class="mono">${esc(s.slug)}</td>`,
        `          <td>${esc(s.type)}</td>`,
        `          <td><span class="chip chip--${esc(s.status)}">${esc(s.status)}</span></td>`,
        `          <td class="mono">${esc(s.commit ?? '—')}</td>`,
        `          <td class="mono">${esc(s.updated ?? '—')}</td>`,
        '        </tr>',
      ].join('\n'))
      .join('\n');

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

  const journalRows = logTail.length === 0
    ? '        <li class="muted">Журнал пуст.</li>'
    : logTail.map((l) => `        <li>${esc(l)}</li>`).join('\n');

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

  /* --- D3: роли (из roles.yaml) */
  const roleStatusRu = { active: 'активна', planned: 'запланирована', deferred: 'отложена' };
  const roleRows = (roles || []).length === 0
    ? '        <tr><td colspan="3" class="muted">roles.yaml не найден.</td></tr>'
    : roles
      .map((r) => {
        const trig = r.trigger && r.trigger.check
          ? `<code>${esc(r.trigger.check)}</code>`
          : `<span class="muted">ручной</span> — ${esc((r.trigger && r.trigger.human) || '—')}`;
        const blocked = r.blocked_by ? `<div class="muted">⛔ ${esc(r.blocked_by)}</div>` : '';
        return [
          '        <tr>',
          `          <td><strong>${esc(r.title || r.name)}</strong></td>`,
          `          <td><span class="rstatus rstatus--${esc(r.status)}">${esc(roleStatusRu[r.status] || r.status)}</span></td>`,
          `          <td>${trig}${blocked}</td>`,
          '        </tr>',
        ].join('\n');
      })
      .join('\n');

  /* --- D3: продукты */
  const productStatusRu = { active: 'active', frozen: 'frozen', planned: 'planned' };
  const productRows = (products || []).length === 0
    ? '        <tr><td colspan="4" class="muted">Продукты не описаны.</td></tr>'
    : products
      .map((p) => [
        '        <tr>',
        `          <td><strong>${esc(p.name)}</strong></td>`,
        `          <td><span class="pstatus pstatus--${esc(p.status)}">${esc(productStatusRu[p.status] || p.status)}</span></td>`,
        `          <td class="mono">${esc(p.metric || '—')}</td>`,
        `          <td class="muted">${esc(p.frozen_by || '—')}${p.frozen_at ? ` (${esc(p.frozen_at)})` : ''}</td>`,
        '        </tr>',
      ].join('\n'))
      .join('\n');

  /* --- D3: аудиты и research */
  const auditRows = (audits || []).length === 0
    ? '        <tr><td colspan="3" class="muted">Отчётов нет.</td></tr>'
    : audits
      .map((a) => [
        '        <tr>',
        `          <td class="mono">${esc(a.path)}</td>`,
        `          <td><span class="ctype">${esc(a.kind)}</span></td>`,
        `          <td class="mono muted">${esc(String(a.lines))}</td>`,
        '        </tr>',
      ].join('\n'))
      .join('\n');

  /* --- D3: память */
  const memoryFiles = [
    { file: '.project/DECISIONS.md', note: 'решения (семантика, append-only)' },
    { file: '.project/log.md', note: `журнал решений, последние ${logTail.length} строк ниже` },
    { file: '.project/factory/MEMORY-FACTORY.md', note: 'память фабрики: решения / уроки / открытые вопросы' },
    { file: '.project/agents/', note: 'отчёты сессий (session logs)' },
  ];
  const memoryCards = memoryFiles
    .map((m) => [
      '        <li>',
      `          <code>${esc(m.file)}</code>`,
      `          <span class="muted">${esc(m.note)}</span>${exists(rel(m.file)) ? '' : ' <span class="muted">(нет файла)</span>'}`,
      '        </li>',
    ].join('\n'))
    .join('\n');

  const doneDoingNextHtml = renderDoneDoingNext({
    specs,
    roles,
    products,
    now: Date.now(),
  });

  return `<!DOCTYPE html>
<!--
  docs/index.html — ЦЕНТР РАЗРАБОТКИ LinuxExam.
  ФАЙЛ СГЕНЕРИРОВАН: .project/sync.mjs из .project/state.json. Правки затираются.
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
section { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 16px; padding: 20px 24px; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
h2 { font-size: 0.8125rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-muted); font-weight: 600; margin: 0 0 12px; }
.muted { color: var(--fg-muted); }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.head__row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 8px; color: var(--fg-muted); }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
.dot--ok { background: var(--ok); }
.dot--bad { background: var(--fail); }
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
.queue-item { border-left: 2px solid var(--accent); padding: 2px 0 2px 12px; margin-bottom: 12px; }
.queue-item__id { font-family: var(--mono); }
.queue-item__goal { color: var(--fg); }
.queue-item__meta { color: var(--fg-muted); font-size: 0.8125rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
th { color: var(--fg-muted); font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }
.chip { border: 1px solid var(--border); border-radius: 6px; padding: 1px 8px; font-family: var(--mono); font-size: 0.75rem; }
.chip--preview { color: var(--warn); border-color: var(--warn); }
.chip--running { color: var(--accent); border-color: var(--accent); }
.chip--approved, .chip--done { color: var(--ok); border-color: var(--ok); }
.chip--rejected { color: var(--fail); border-color: var(--fail); }
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

/* --- бейджи коммитов, ролей, продуктов */
.ctype { font-family: var(--mono); font-size: 0.75rem; border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; color: var(--fg-muted); }
.ctype--feat { color: var(--ok); border-color: var(--ok); }
.ctype--fix { color: var(--accent); border-color: var(--accent); }
.ctype--docs { color: var(--fg-muted); }
.ctype--chore { color: var(--warn); border-color: var(--warn); }
.rstatus { font-family: var(--mono); font-size: 0.75rem; }
.rstatus--active { color: var(--ok); }
.rstatus--planned { color: var(--warn); }
.rstatus--deferred { color: var(--fg-muted); }
.pstatus { font-family: var(--mono); font-size: 0.75rem; border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; }
.pstatus--frozen { color: var(--warn); border-color: var(--warn); }
.pstatus--active { color: var(--ok); border-color: var(--ok); }
.pstatus--planned { color: var(--fg-muted); }
</style>
</head>
<body>
<div class="wrap">

  <section class="head" id="head">
    <h1>Центр разработки</h1>
    <div class="muted">LinuxExam · состояние генерируется из <code>.project/state.json</code></div>
    <div class="head__row">
      <span class="mono">HEAD ${esc(head)}</span>
      <span class="mono">last_sync ${esc(state.last_sync ?? '—')}</span>
      <span><span class="dot dot--${circle}"></span>${esc(statusText)}</span>
    </div>
  </section>

  <section class="progress" id="progress">
    <h2>Прогресс банка</h2>
    <div class="progress__nums">
      <span class="progress__cur">${goal.current}</span>
      <span class="progress__tot">/ ${goal.target}</span>
      <span class="progress__pct">${goal.percent}% · осталось ${goal.remaining}</span>
    </div>
    <div class="progress__bar"><div class="progress__fill" style="width:${goal.percent}%"></div></div>
${topicRows}
  </section>

${doneDoingNextHtml}

  <section class="queue" id="queue">
    <h2>Очередь решений</h2>
${queueHtml}
  </section>

  <section class="specs" id="specs">
    <h2>Все спеки</h2>
    <table>
      <thead>
        <tr><th>id</th><th>slug</th><th>type</th><th>status</th><th>commit</th><th>updated</th></tr>
      </thead>
      <tbody>
${specsRows}
      </tbody>
    </table>
  </section>

  <section class="journal" id="journal">
    <h2>Журнал (последние ${LOG_TAIL_LINES} строк log.md)</h2>
    <ul class="log">
${journalRows}
    </ul>
  </section>

  <section class="commits" id="commits">
    <h2>Коммиты (последние ${COMMITS_IN_CENTER})</h2>
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
  </section>

  <section class="roles" id="roles">
    <h2>Роли</h2>
    <table>
      <thead>
        <tr><th>роль</th><th>статус</th><th>триггер запуска</th></tr>
      </thead>
      <tbody>
${roleRows}
      </tbody>
    </table>
  </section>

  <section class="products" id="products">
    <h2>Продукты</h2>
    <table>
      <thead>
        <tr><th>продукт</th><th>статус</th><th>метрика</th><th>freeze</th></tr>
      </thead>
      <tbody>
${productRows}
      </tbody>
    </table>
  </section>

  <section class="memory" id="memory">
    <h2>Память</h2>
    <ul class="policies">
${memoryCards}
    </ul>
  </section>

  <section class="audits" id="audits">
    <h2>Аудит и research</h2>
    <table>
      <thead>
        <tr><th>файл</th><th>тип</th><th>строк</th></tr>
      </thead>
      <tbody>
${auditRows}
      </tbody>
    </table>
  </section>

  <section class="policies" id="policies">
    <h2>Политики</h2>
    <ul class="policies">
${policyCards}
    </ul>
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
    `HEAD (закреплён): \`${head}\``,
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

  // --- состояние после синхронизации
  const nextState = {
    ...state,
    head,
    specs,
    log_tail: logTail,
    last_sync: state.last_sync ?? new Date().toISOString(),
    goal: { ...goal, current_questions: current, progress_percent: percent, target_questions: target },
    topics: topics.slice().sort((a, b) => a.slug.localeCompare(b.slug)),
    // --- зеркала фабрики (D1/D3). Истина: roles.yaml и git log; здесь — кэш для
    // потребителей, которые читают только state.json (центр, дашборд).
    schema_version: MIN_SCHEMA_VERSION,
    commits: commitLog,
    roles: rolesMirror,
    products: productsMirror,
    audits: auditIndex,
  };
  if (specCommit && nextState.specs.length > 0 && !nextState.spec_commit) {
    nextState.spec_commit = specCommit;
  }

  // --- idempotentность: если содержимое не изменилось, last_sync не трогаем
  const before = JSON.stringify({ ...state });
  const after = JSON.stringify(nextState);
  if (before === after) {
    nextState.last_sync = state.last_sync;
  }

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
  };
  const stateMd = renderStateMd({ ...ctxBase, state: nextState });
  const specMd = renderSpecMd({ ...ctxBase, state: nextState });
  const centerHtml = renderCenter({ ...ctxBase, state: nextState, inSync: true });

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
    for (const key of ['head', 'specs', 'log_tail', 'last_sync']) {
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

    // 3) производные + state.json должны быть зафиксированы коммитом
    const uncommitted = diffHead([STATE_PATH, ...targets.map((t) => t.path)]);
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
  const stateChanged = before !== after;
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
  const bytes = fs.readFileSync(OUT_CENTER);

  const out = [
    'sync: .project/STATE.md + .project/SPEC.md + docs/index.html обновлены',
    `  HEAD: ${head}`,
    `  last_sync: ${nextState.last_sync}`,
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
