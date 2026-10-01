#!/usr/bin/env node
/**
 * .project/scripts/validate-spec.mjs — Компонент A spec 040 (Проверяльщик спек),
 * детерминированное ядро: Фазы 0, 1, 4 из 11.
 *
 *   Фаза 0 — baseline score 0–100 по 5 измерениям
 *            (Completeness 30 / Clarity 25 / Testability 25 /
 *             Consistency 10 / Scope 10; сумма весов = 100).
 *   Фаза 1 — ровно 15 механических проверок (frontmatter, DAG декомпозиции,
 *            существование путей, уникальность id, поле commit/SHA,
 *            placeholder-маркеры, self-reference, write-scope overlap и др.).
 *   Фаза 4 — traceability Цель -> Критерий приёмки -> Задача декомпозиции;
 *            сирота уровня «цель» или «критерий» -> hard-fail (exit 1).
 *
 * Фазы 2, 3, 5–10 (research/enrich, fact-check, семантика, adversarial,
 * simulation, regeneration, repair loop, external audit) — LLM-часть,
 * живёт в docs/spec-chain/skills/spec-enrich/SKILL.md и вызывается
 * .project/scripts/enrich-spec.mjs.
 *
 * Ограничения: Node ESM, zero-deps (только node:fs, node:path),
 * никаких сетевых вызовов, никаких мутаций репозитория.
 *
 * Запуск:
 *   node .project/scripts/validate-spec.mjs .project/specs/040-spec-chain.md
 *   node .project/scripts/validate-spec.mjs 040
 *   node .project/scripts/validate-spec.mjs 040 --json
 *   node .project/scripts/validate-spec.mjs 040 --out .project/drafts/report.md
 *   node .project/scripts/validate-spec.mjs 040 --json --out report.json
 *
 * Exit codes: 0 — чисто (допускаются WARN);
 *             1 — hard-fail (FAIL механических проверок или сирота traceability);
 *             2 — ошибка использования/чтения (спека не найдена, нет аргумента).
 *
 * Язык вывода — русский, маркеры PASS/FAIL/WARN, без emoji.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXIT_CLEAN = 0;
const EXIT_HARD_FAIL = 1;
const EXIT_USAGE = 2;

/* ------------------------------------------------------------------ util */

/** Чтение файла с нормализацией EOL. null — файла нет либо он не читается. */
function readTextSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');
  } catch {
    return null;
  }
}

/** Абсолютный путь → POSIX-относительный от корня репозитория. */
function toRel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

/** Разбивка текста на строки (EOL уже нормализованы). */
function splitLines(text) {
  return String(text).split('\n');
}

/**
 * Строки внутри секции `## <заголовок>` — до следующего заголовка того же
 * или более высокого уровня. Возвращает { line (1-based), text }[].
 */
function sectionLines(lines, headingRe) {
  const out = [];
  let inSection = false;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (m) {
      if (inSection && m[1].length <= level) break;
      if (!inSection && headingRe.test(m[2].trim())) {
        inSection = true;
        level = m[1].length;
        continue;
      }
    }
    if (inSection) out.push({ line: i + 1, text: lines[i] });
  }
  return out;
}

/** Заголовки верхнего уровня: { level, text, line }. */
function headings(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (m) out.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
  }
  return out;
}

/** Плоский YAML-frontmatter: блок между первой парой `---`. */
function parseFrontmatter(lines) {
  if (!lines.length || lines[0].trim() !== '---') return { meta: {}, end: -1 };
  const meta = {};
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') return { meta, end: i + 1 };
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[i]);
    if (m) meta[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, end: -1 }; // закрывающего `---` нет — фиксируется проверкой m01
}

/** Номер строки первого вхождения регулярки (1-based). 0 — не найдено. */
function lineOf(lines, re) {
  for (let i = 0; i < lines.length; i += 1) if (re.test(lines[i])) return i + 1;
  return 0;
}

/** Все вхождения регулярки: { line, match }[]. */
function allMatches(lines, re) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = re.exec(lines[i]);
    if (m) out.push({ line: i + 1, match: m[0] });
    re.lastIndex = 0;
  }
  return out;
}

const isBlank = (s) => String(s).trim() === '';

/* -------------------------------------------------- нормализация токенов */

/**
 * Ключевые токены фразы для сопоставления «критерий ↔ задача».
 * Латиница/цифры — как есть; кириллица — обрезка типового окончания.
 * Служебные слова отбрасываются.
 */
const STOPWORDS = new Set([
  'и', 'или', 'в', 'во', 'на', 'с', 'со', 'по', 'для', 'из', 'от', 'до',
  'не', 'ни', 'как', 'что', 'это', 'при', 'без', 'под', 'над', 'же', 'ли',
  'а', 'но', 'то', 'бы', 'the', 'of', 'and', 'or', 'an', 'to',
  'in', 'is', 'are', 'be', 'it', 'on', 'for', 'with',
]);

/**
 * ВАЖНО: `\b` в JS ASCII-центричен («Декомпозиция\b» для кириллицы НЕ
 * матчится). Для русских заголовков используем `(?![\p{L}\p{N}_])` с флагом u.
 */
const NO_WORD_AFTER = '(?![\\p{L}\\p{N}_])';
const HEAD_RE = (word) => new RegExp(`^${word}${NO_WORD_AFTER}`, 'u');
const CONTAINS_RE = (word) => new RegExp(`${word}${NO_WORD_AFTER}`, 'u');

/** Полный набор допустимых статусов спеки в репозитории. */
const STATUS_SET = new Set(['draft', 'approved', 'in-progress', 'blocked', 'done', 'closed', 'rejected']);

function normToken(raw) {
  const t = String(raw).toLowerCase().replace(/ё/g, 'е');
  return t.split(/[^0-9a-zа-я]+/i).filter(Boolean);
}

function words(text) {
  return normToken(text).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** Грубая русская стемминг-обрезка (без внешних зависимостей). */
function stem(w) {
  if (!/^[а-я]+$/.test(w)) return w;
  for (const suf of [
    'ями', 'ами', 'иями', 'ией', 'иях', 'ах', 'ях', 'ов', 'ев', 'ой', 'ей',
    'ый', 'ий', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ами', 'ями', 'ию', 'ия',
    'ью', 'ем', 'ом', 'ах', 'у', 'ю', 'а', 'я', 'ы', 'и', 'е', 'о', 'ь',
  ]) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, -suf.length);
  }
  return w;
}

const stemSet = (text) => new Set(words(text).map(stem));

/**
 * Совпадение множеств токенов. Связь признаётся, если:
 *   - есть общий токен длиной >= `rareLen`, встречающийся в репозитории не
 *     более `rareDf` раз (редкий технический термин — достаточное доказательство);
 *   - либо >= `minCount` общих токенов длиной >= `minLen`.
 * Одиночные общеупотребительные слова («спека», «задача») связи не создают:
 * иначе traceability не различает сирот.
 */
function tokenOverlap(aSet, bSet, opts = {}) {
  const { minCount = 2, minLen = 5, rareLen = 7, rareDf = 3, docFreq = new Map() } = opts;
  const common = [];
  for (const t of aSet) if (bSet.has(t) && t.length >= minLen) common.push(t);
  const rare = common.filter((t) => t.length >= rareLen && (docFreq.get(t) || 0) <= rareDf);
  if (rare.length) return rare.sort((x, y) => y.length - x.length)[0];
  if (common.length >= minCount) return common.sort((x, y) => y.length - x.length)[0];
  return null;
}

/* ------------------------------------------------- разбор спецификации */

/** Кандидаты путей: `path` / «path» / просто слово с расширением. */
const PATH_RE = /`([^`\n]+)`|«([^»\n]+)»|"([^"\n]+)"/g;

function isPathLike(s) {
  const v = String(s).trim();
  if (!v || v.length > 200) return false;
  if (/[\s]/.test(v) && !/^[.\w/\\-]+$/.test(v)) return false;
  if (/[<>*?{}|]/.test(v)) return false; // <id>, glob, шаблон
  if (v.includes('...') || v.includes('…')) return false;
  if (/^https?:/.test(v)) return false;
  if (v.startsWith('~')) return false; // вне репозитория
  if (/^--/.test(v) || v.startsWith('npm ') || v.startsWith('node ')) return false;
  // Путь = есть разделитель каталогов ЛИБО расширение файла.
  return /[./\\]/.test(v) || /\.[a-z0-9]{1,5}$/i.test(v);
}

/**
 * Имена/сборки артефактов, упомянутые как элементы структуры, а не как адрес
 * в репозитории (`agent.cordis.yml` как «имя шаблона», `skills/` как
 * «каталог скиллов пресета»). Резолвить их от корня репо — ложный FAIL.
 * Держим список минимальным: любое добавление обязано быть либо именем
 * структуры пресета, либо маркером каталога без пути.
 */
const STRUCTURE_ONLY = new Set(['agent.cordis.yml', 'skills/']);

/** Все путеподобные упоминания в тексте спеки: { raw, line }. */
function references(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    PATH_RE.lastIndex = 0;
    let m;
    while ((m = PATH_RE.exec(lines[i])) !== null) {
      const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      if (isPathLike(raw)) out.push({ raw, line: i + 1, context: lines[i] });
    }
  }
  return out;
}

/** Секция `## Декомпозиция` → (startLine, lines). */
function decompositionSection(lines) {
  return sectionLines(lines, HEAD_RE('Декомпозиция'));
}

/** Карта строк внутри code-fence: там живут usage-примеры, а не нормы. */
function fenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let open = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*```/.test(lines[i])) {
      mask[i] = true;
      open = !open;
      continue;
    }
    mask[i] = open;
  }
  return mask;
}

/**
 * Задачи декомпозиции:
 *  1. id: t1, subject: ...; assignee: builder, dependencies: []
 *  1. id: t1, subject: ... (многострочный, продолжение — с отступом)
 *  1. id: t1, subject: ... ; assignee: ...; dependencies: [t1]
 */
function parseDecomposition(lines) {
  const sec = decompositionSection(lines);
  if (!sec.length) return { present: false, items: [], sectionStart: 0 };

  const items = [];
  let cur = null;
  for (const row of sec) {
    const t = row.text;
    // Две исторические формы записи задачи (обе встречаются в .project/specs):
    //   1. id: t1, subject: ...; assignee: builder, dependencies: []
    //   1. `id: t1` · `subject: ...` · `assignee: builder` · `dependencies: []`
    const start = /^\s*(\d+)[.)]\s+(.*)$/.exec(t);
    if (start && /(?:^|[`\s])id:\s*[A-Za-z0-9_.-]+/i.test(start[2])) {
      cur = { line: row.line, chunks: [start[2]], refs: [] };
      items.push(cur);
      continue;
    }
    if (cur) {
      if (isBlank(t)) cur = null;
      else cur.chunks.push(t);
    }
  }

  for (const it of items) {
    const body = it.chunks.join(' ').replace(/`/g, ' ').replace(/·/g, '; ');
    it.text = body.replace(/\s+/g, ' ').trim();
    it.id = (/id:\s*([A-Za-z0-9_.-]+)/i.exec(body) || [, ''])[1];
    const subj = /subject:\s*(.+?)(?:;\s*(?:assignee|dependencies|write)|$)/is.exec(body);
    it.subject = subj ? subj[1].replace(/\s+/g, ' ').trim() : '';
    const asg = /assignee:\s*([A-Za-zА-Яа-я_-]+)/i.exec(body);
    it.assignee = asg ? asg[1] : '';
    const dep = /dependencies:\s*\[([^\]]*)\]/i.exec(body);
    it.dependencies = dep
      ? dep[1].split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    it.deliverables = deliveriesOf(it.subject || it.text);
  }
  return { present: true, items: items.filter((i) => i.id), sectionStart: sec[0].line };
}

/** Пути/имена файлов, извлечённые из произвольного текста (в т.ч. без кавычек). */
function extractPathTokens(text) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const v = String(raw).replace(/^[`«"(]+/, '').replace(/[`»").,;:]+$/, '');
    if (!v || seen.has(v)) return;
    if (/[<>*?{}|]/.test(v)) return;
    if (v.includes('...') || v.includes('…')) return;
    if (!/[./\\]/.test(v) && !/\.[a-z0-9]{1,5}$/i.test(v)) return;
    // `до/после` — диапазон, а не файл: без расширения путь обязан лежать в
    // известном каталоге репозитория.
    const hasExt = /\.[a-z0-9]{1,5}$/i.test(v);
    const inKnownDir = /^(?:\.?[A-Za-z0-9_.-]+(?:\/|$)){1,}/.test(v)
      && /^(?:\.project|\.agent-teams|docs|src|tools|public|scripts)\//.test(v);
    if (!hasExt && !inKnownDir) return;
    seen.add(v);
    out.push(v);
    // Имя файла тоже атом: задача может объявлять полный путь, а критерий —
    // только `close-spec.mjs`, и наоборот.
    if (v.includes('/')) {
      const base = path.posix.basename(v);
      if (base.length >= 6 && !seen.has(base)) {
        seen.add(base);
        out.push(base);
      }
    }
  };
  PATH_RE.lastIndex = 0;
  let m;
  while ((m = PATH_RE.exec(String(text))) !== null) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (raw.length >= 3) {
      if (isPathLike(raw)) push(raw);
      // `npm run spec:close -- --help` — команда, а не путь: берём её слова,
      // чтобы имя скрипта из задачи всё-таки связалось с критерием.
      else for (const w of raw.split(/\s+/)) push(w);
    }
  }
  for (const w of String(text).split(/\s+/)) push(w);
  return out;
}

/** Пути-артефакты (deliverables) из текста задачи. */
function deliveriesOf(text) {
  return extractPathTokens(text).filter((p) => p.includes('/') || /\.(?:mjs|md|json|yml|yaml|ts|tsx|cjs)$/i.test(p));
}

/**
 * Объединённый набор артефактов задачи: пути из её собственного текста плюс
 * write-скоупы, назначенные ей в «Оговорках». Без второго источника критерий
 * «`node .project/scripts/x.mjs --help` → usage» не связывался бы с задачей,
 * которая этот скрипт пишет, — файл назван только в write-скоупе.
 */
function attachWriteScopes(decomp, writeScopes) {
  const byTask = new Map();
  for (const ws of writeScopes) {
    if (!byTask.has(ws.task)) byTask.set(ws.task, []);
    for (const p of ws.paths) byTask.get(ws.task).push(p);
  }
  for (const it of decomp.items) {
    const extra = byTask.get(it.id) || [];
    it.deliverables = [...new Set([...it.deliverables, ...extra])];
    it.writeScopes = extra;
  }
  return decomp;
}

/** Раздел «Write-скоупы» (внутри «Оговорок»): t1 → path[, path]. */
function parseWriteScopes(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^\s*[-*]?\s*(t\d+)\s*(?:->|→|:)\s*(.+)$/.exec(lines[i]);
    if (m) {
      const paths = m[2].split(/[,+]|\s+и\s+/).map((s) => s.trim().replace(/^[`«"]|[`»"]$/g, ''));
      out.push({ task: m[1], paths: paths.filter((p) => p && isPathLike(p)), line: i + 1 });
    }
  }
  return out;
}

/** Критерии приёмки: `N. ...` в секции «## Критерии приёмки». */
function parseCriteria(lines) {
  const sec = sectionLines(lines, HEAD_RE('Критерии приёмки'));
  if (!sec.length) return { present: false, items: [] };
  const items = [];
  let cur = null;
  for (const row of sec) {
    const m = /^\s*(\d+)\.\s+(.*)$/.exec(row.text);
    if (m) {
      cur = { num: Number(m[1]), line: row.line, parts: [m[2]] };
      items.push(cur);
      continue;
    }
    if (cur && !isBlank(row.text) && /^\s{2,}\S/.test(row.text)) cur.parts.push(row.text.trim());
  }
  for (const it of items) it.text = it.parts.join(' ').replace(/\s+/g, ' ').trim();
  return { present: true, items };
}

/** Цели: абзацы секции «## Цель». */
function parseGoals(lines) {
  const sec = sectionLines(lines, HEAD_RE('Цель'));
  if (!sec.length) return { present: false, items: [] };
  const items = [];
  let buf = [];
  let start = 0;
  const flush = () => {
    const text = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (text) items.push({ n: items.length + 1, line: start, text });
    buf = [];
  };
  for (const row of sec) {
    if (/^\s*[-*]\s+/.test(row.text)) continue; // маркированные пункты не цели
    if (isBlank(row.text)) {
      flush();
      continue;
    }
    if (!buf.length) start = row.line;
    buf.push(row.text.trim());
  }
  flush();
  return { present: true, items };
}

/* -------------------------------------------------------- Фаза 1 (15) */

/** Заголовок-секция верхнего уровня есть? */
function hasSection(heads, re) {
  return heads.some((h) => h.level === 2 && re.test(h.text));
}

/** Существование артефакта: файл/каталог в репозитории. */
function existsInRepo(root, raw) {
  const clean = raw.replace(/^\.\//, '').replace(/[),.;:]+$/, '');
  if (!clean) return false;
  const abs = path.resolve(root, clean);
  return fs.existsSync(abs);
}

/** [регулярка, допустимо ли в usage-примерах CLI]. */
const PLACEHOLDER_RES = [
  [/\bTBD\b/i, false],
  [/\bTODO\b/i, false],
  [/\bFIXME\b/i, false],
  [/\bXXX\b/, false],
  [/\[\s*citation needed\s*\]/i, false],
  [/\bTK\b/, false],
  [/<\s*(?:id|spec-id|url|path|name|value)\s*>/i, true],
];

/** Проверка m01…m15 — ровно 15 штук, ордер фиксирован. */
function mechanicalChecks(ctx) {
  const {
    lines, text, heads, meta, fmEnd, fileRel, relPath, root,
    decomp, criteria, writeScopes, goals, refs, fence,
  } = ctx;

  /**
   * Артефакты, которые спека объявляет к созданию. Их отсутствие СЕЙЧАС —
   * норма, а не дефект: иначе любой «зелёный» план падал бы на своих
   * собственных deliverables. Источник — текст секции «Декомпозиция» и
   * write-скоупы.
   */
  const deliverableSet = new Set();
  {
    const sec = decompositionSection(lines);
    for (const row of sec) {
      PATH_RE.lastIndex = 0;
      let m;
      while ((m = PATH_RE.exec(row.text)) !== null) {
        const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim();
        if (isPathLike(raw)) deliverableSet.add(raw.replace(/^\.\//, '').replace(/[),.;:]+$/, ''));
      }
    }
    for (const it of decomp.items) for (const d of it.deliverables) deliverableSet.add(d);
    for (const ws of writeScopes) for (const p of ws.paths) deliverableSet.add(p);
  }
  const isFuture = (raw) => deliverableSet.has(raw) || [...deliverableSet].some((d) => raw.endsWith(`/${d}`));
  /** CLI usage / примеры в fences — не утверждения спеки о репозитории. */
  const isUsageExample = (line, raw) =>
    fence[line - 1] || (raw.startsWith('--') && /(usage|флаг|аргумент|запуск|example|пример)/i.test(lines[line - 1] || ''));

  const checks = [];
  /**
   * `severity` — машиночитаемый уровень влияния проверки на exit-код:
   *   'hard-fail' — нарушение блокирует конвейер (exit 1);
   *   'diagnostic' — дефект оформления/качества: печатается как FAIL,
   *                  но exit-код не меняет.
   * Так политика exit-кода не привязана к литеральным id проверок.
   */
  const add = (id, name, status, issues, note, severity) => {
    checks.push({ id, name, status, issues, note: note || '', severity: severity || 'diagnostic' });
  };

  /* m01 — frontmatter: блок `---` и обязательные поля.
   * Нечитаемый frontmatter (нет блока `---`, не закрыт, нет `id`) —
   * единственный hard-fail уровня Фазы 1: без него спека неадресуема. */
  {
    const issues = [];
    if (lines[0] === undefined || lines[0].trim() !== '---') {
      issues.push({ file: fileRel, line: 1, message: 'нет открывающего `---` (frontmatter отсутствует)' });
    } else if (fmEnd === -1) {
      issues.push({ file: fileRel, line: 1, message: 'frontmatter не закрыт строкой `---`' });
    }
    for (const field of ['id', 'slug', 'type', 'status', 'commit']) {
      if (meta[field] === undefined) {
        const l = lineOf(lines, /^---\s*$/);
        issues.push({ file: fileRel, line: Math.max(l, 1), message: `во frontmatter нет поля \`${field}\`` });
      }
    }
    // Отсутствие `id` делает спеку неадресуемой: это нечитаемый frontmatter,
    // а не дефект оформления.
    const unreadable = issues.some((i) => /frontmatter отсутствует|не закрыт|поля `id`/.test(i.message));
    add(
      'm01',
      'frontmatter: блок --- и поля id/slug/type/status/commit',
      issues.length ? 'FAIL' : 'PASS',
      issues,
      unreadable ? 'FAIL: нечитаемый frontmatter (блок --- / поле id) — hard-fail' : '',
      unreadable ? 'hard-fail' : 'diagnostic',
    );
  }

  /* m02 — согласованность frontmatter id/slug с именем файла спеки.
   * F7 (qc-раунд 1): расхождение id/slug с именем файла — дефект ОФОРМЛЕНИЯ.
   * Печатается как FAIL-диагностика, но НЕ блокирует конвейер: поля
   * id/type/status читаются, дальше спека адресуема, а имя файла поправимо
   * переименованием. Hard-fail уровня Фазы 1 остаётся ровно у m01
   * (нечитаемый frontmatter). */
  {
    const issues = [];
    const fileId = path.basename(fileRel).split('-')[0];
    const fileSlug = path.basename(fileRel).replace(/^\d+[a-z]?-/, '').replace(/\.md$/, '');
    if (meta.id && meta.id !== fileId) {
      issues.push({ file: fileRel, line: lineOf(lines, /^id\s*:/i) || 1, message: `frontmatter id: ${meta.id} != имя файла ${fileId}` });
    }
    if (meta.slug && fileSlug && meta.slug !== fileSlug) {
      issues.push({ file: fileRel, line: lineOf(lines, /^slug\s*:/i) || 1, message: `frontmatter slug: ${meta.slug} != имя файла ${fileSlug}` });
    }
    add('m02', 'id/slug спеки согласованы с именем файла', issues.length ? 'FAIL' : 'PASS', issues, '', 'diagnostic');
  }

  /* m03 — блок «## Декомпозиция» присутствует */
  {
    const issues = [];
    if (!decomp.present) {
      issues.push({ file: fileRel, line: 0, message: 'нет секции `## Декомпозиция`' });
    }
    add('m03', 'секция «## Декомпозиция» присутствует', issues.length ? 'WARN' : 'PASS', issues,
      decomp.present ? '' : 'WARN: спека без декомпозиции — Фаза 4 понижается до advisory, hard-fail не выдаётся');
  }

  /* m04 — DAG декомпозиции: id, неизвестные зависимости, циклы, порядок */
  {
    const issues = [];
    const ids = decomp.items.map((i) => i.id);
    for (const it of decomp.items) {
      for (const dep of it.dependencies) {
        if (!ids.includes(dep)) {
          issues.push({ file: fileRel, line: it.line, message: `задача ${it.id}: неизвестная зависимость \`${dep}\`` });
        }
        if (dep === it.id) {
          issues.push({ file: fileRel, line: it.line, message: `задача ${it.id}: ссылается на себя в dependencies` });
        }
      }
    }
    // дубликаты id внутри декомпозиции — тоже DAG-дефект
    for (const dup of duplicates(ids)) {
      const it = decomp.items.find((i) => i.id === dup);
      issues.push({ file: fileRel, line: it ? it.line : 0, message: `duplicate id задачи: \`${dup}\`` });
    }
    // цикл: t1 -> t2 -> t1
    const cyc = findCycle(decomp.items);
    if (cyc) {
      issues.push({ file: fileRel, line: (decomp.items.find((i) => i.id === cyc[0]) || {}).line || 0, message: `цикл зависимостей: ${cyc.join(' -> ')}` });
    }
    // порядок: задача должна появляться после своих зависимостей
    const pos = new Map(decomp.items.map((i, idx) => [i.id, idx]));
    for (const it of decomp.items) {
      for (const dep of it.dependencies) {
        if (pos.has(dep) && pos.get(dep) > pos.get(it.id)) {
          issues.push({ file: fileRel, line: it.line, message: `задача ${it.id} объявлена раньше своей зависимости ${dep}` });
        }
      }
    }
    add('m04', 'DAG декомпозиции: известные зависимости, без дублей и циклов', issues.length ? 'FAIL' : (decomp.present ? 'PASS' : 'WARN'), issues,
      decomp.present ? '' : 'WARN: декомпозиции нет — проверять нечего');
  }

  /* m05 — уникальность id спеки в каталоге спек */
  {
    const issues = [];
    const specsDir = path.join(root, '.project/specs');
    if (fs.existsSync(specsDir)) {
      const dup = [];
      for (const name of fs.readdirSync(specsDir)) {
        if (!name.endsWith('.md') || name.toLowerCase() === 'readme.md') continue;
        const t = readTextSafe(path.join(specsDir, name));
        if (t === null) continue;
        const id = parseFrontmatter(splitLines(t)).meta.id;
        if (id && meta.id && id === meta.id && name !== path.basename(fileRel)) {
          dup.push(`.project/specs/${name}`);
        }
      }
      for (const d of dup) {
        issues.push({ file: d, line: 1, message: `frontmatter id: ${meta.id} дублируется с ${fileRel}` });
      }
    }
    add('m05', 'уникальность id спеки в .project/specs', issues.length ? 'FAIL' : 'PASS', issues);
  }

  /* m06 — существование путей, упомянутых в спеке */
  {
    const issues = [];
    const seen = new Set();
    let checked = 0;
    for (const r of refs) {
      if (isUsageExample(r.line, r.raw)) continue;
      const clean = r.raw.replace(/^\.\//, '').replace(/[),.;:]+$/, '');
      if (seen.has(clean)) continue;
      seen.add(clean);
      if (STRUCTURE_ONLY.has(clean)) continue; // имя элемента структуры, не адрес
      if (isFuture(clean)) continue; // deliverable спеки
      if (/^\.agent-teams\//.test(clean)) continue; // runtime-каталог команд
      if (/^\.dsh\//.test(clean) || clean.startsWith('~')) continue;
      checked += 1;
      if (!existsInRepo(root, clean)) {
        issues.push({ file: fileRel, line: r.line, message: `упомянутый путь не существует: \`${clean}\`` });
      }
    }
    add('m06', 'существование путей, упомянутых в спеке', issues.length ? 'FAIL' : 'PASS', issues,
      `проверено путей: ${checked}`);
  }

  /* m07 — placeholder-маркеры */
  {
    const issues = [];
    for (let i = 0; i < lines.length; i += 1) {
      // usage-примеры CLI (в т.ч. в fences) содержат шаблонные <id>/<spec-id>
      // законно: это синтаксис вызова, а не незаполненное место спеки.
      const line = lines[i];
      const usage = fence[i] || /(?:usage|--out|--json|\/run-spec-chain|\/spec-to-team|\/close-spec|npm run|node )/i.test(line);
      for (const [re, skippable] of PLACEHOLDER_RES) {
        if (!re.test(line)) continue;
        if (skippable && usage) continue;
        issues.push({ file: fileRel, line: i + 1, message: `placeholder-маркер: ${re.source}` });
        break;
      }
    }
    add('m07', 'placeholder-маркеры (TBD/TODO/<id>/[citation needed])', issues.length ? 'WARN' : 'PASS', issues,
      issues.length ? 'WARN: заглушки допустимы, если спека декларирует фазу, которая их закрывает (см. Фаза 2)' : '');
  }

  /* m08 — self-reference: пути и id самой спеки в write-скоупах/задачах */
  {
    const issues = [];
    const specRelBase = path.basename(fileRel);
    for (const ws of writeScopes) {
      for (const p of ws.paths) {
        const base = path.basename(p);
        if (base.startsWith(`${meta.id}-`) || p.includes('.project/specs/')) {
          issues.push({ file: fileRel, line: ws.line, message: `self-reference: задача ${ws.task} пишет в саму спеку (\`${p}\`)` });
        }
      }
    }
    for (const it of decomp.items) {
      for (const d of it.deliverables) {
        if (d.includes('.project/specs/')) {
          issues.push({ file: fileRel, line: it.line, message: `self-reference: задача ${it.id} объявляет правку спеки (\`${d}\`)` });
        }
      }
    }
    if (meta.id && text.includes(`spec-${meta.id}/${specRelBase}`)) {
      issues.push({ file: fileRel, line: 1, message: 'self-reference: спека ссылается на собственный путь как внешний артефакт' });
    }
    add('m08', 'self-reference: спека не пишет сама в себя', issues.length ? 'FAIL' : 'PASS', issues);
  }

  /* m09 — write-scope overlap между задачами */
  {
    const issues = [];
    const byTask = new Map(writeScopes.map((w) => [w.task, w]));
    const tasks = writeScopes.map((w) => w.task);
    for (let i = 0; i < tasks.length; i += 1) {
      for (let j = i + 1; j < tasks.length; j += 1) {
        const a = byTask.get(tasks[i]);
        const b = byTask.get(tasks[j]);
        for (const pa of a.paths) {
          for (const pb of b.paths) {
            if (pa === pb) {
              issues.push({ file: fileRel, line: a.line, message: `write-scope overlap: ${a.task} и ${b.task} пишут в \`${pa}\`` });
            }
          }
        }
      }
    }
    // запись в запрещённые зоны («Что НЕ трогать»)
    const forbidden = sectionLines(lines, /^Что НЕ трогать\b/i)
      .map((r) => r.text.trim())
      .filter((t) => /^\s*[-*]\s+/.test(t))
      .map((t) => t.replace(/^\s*[-*]\s+/, '').replace(/[`«"].*$/, '').replace(/[.,;].*$/, '').trim())
      .filter((t) => t && !/\.\.\.$/.test(t));
    for (const ws of writeScopes) {
      for (const p of ws.paths) {
        for (const f of forbidden) {
          const zone = f.replace(/\/\*\*$/, '').replace(/\/$/, '');
          if (zone && (p === zone || p.startsWith(`${zone}/`))) {
            issues.push({ file: fileRel, line: ws.line, message: `write-scope ${ws.task} пересекается с зоной «Что НЕ трогать»: \`${zone}\`` });
          }
        }
      }
    }
    add('m09', 'write-scope overlap: задачи не делят файлы, не пишут в «НЕ трогать»', issues.length ? 'FAIL' : 'PASS', issues);
  }

  /* m10 — поле commit/SHA */
  {
    const issues = [];
    const commit = (meta.commit || '').trim();
    const nullish = /^(null|~|none|-|)$/i.test(commit);
    const status = (meta.status || '').toLowerCase();
    const finalStates = new Set(['done', 'closed']);
    for (const c of commit.split(/[\s,]+/).filter(Boolean)) {
      if (/^(null|~|none|-)$/i.test(c)) continue;
      if (!/^[0-9a-f]{7,40}$/i.test(c)) {
        issues.push({ file: fileRel, line: lineOf(lines, /^commit\s*:/i) || 2, message: `commit: \`${c}\` не является SHA (7–40 hex)` });
      }
    }
    if (nullish && finalStates.has(status)) {
      issues.push({ file: fileRel, line: lineOf(lines, /^commit\s*:/i) || 2, message: `status: ${status} требует заполненного commit (сейчас \`${commit || 'пусто'}\`)` });
    }
    if (!nullish && !finalStates.has(status) && status && status !== 'approved') {
      issues.push({ file: fileRel, line: lineOf(lines, /^status\s*:/i) || 4, message: `commit заполнен при status: ${status} — SHA появляется на closing-фазе` });
    }
    if (status && !STATUS_SET.has(status)) {
      issues.push({ file: fileRel, line: lineOf(lines, /^status\s*:/i) || 4, message: `status: \`${status}\` вне допустимого набора (${[...STATUS_SET].join('/')})` });
    }
    add('m10', 'поле commit/SHA согласовано со статусом спеки', issues.length ? 'FAIL' : 'PASS', issues);
  }

  /* m11 — критерии приёмки: наличие и проверяемость */
  {
    const issues = [];
    if (!criteria.present || !criteria.items.length) {
      issues.push({ file: fileRel, line: 0, message: 'секция `## Критерии приёмки` отсутствует или пуста' });
    } else {
      const nums = criteria.items.map((c) => c.num);
      for (const dup of duplicates(nums.map(String))) {
        const it = criteria.items.find((c) => String(c.num) === dup);
        issues.push({ file: fileRel, line: it.line, message: `дубликат номера критерия: ${dup}` });
      }
      for (const c of criteria.items) {
        if (!isVerifiable(c.text)) {
          issues.push({ file: fileRel, line: c.line, message: `критерий ${c.num} не содержит проверяемого признака (команда/exit/путь/порог)` });
        }
      }
    }
    add('m11', 'критерии приёмки: наличие и проверяемость каждого', issues.length ? 'FAIL' : 'PASS', issues);
  }

  /* m12 — обязательные секции (кроме декомпозиции) */
  {
    const issues = [];
    const required = [
      [HEAD_RE('Контекст'), 'Контекст'],
      [HEAD_RE('Цель'), 'Цель'],
      [HEAD_RE('Что делаем'), 'Что делаем'],
      [HEAD_RE('Критерии приёмки'), 'Критерии приёмки'],
    ];
    for (const [re, label] of required) {
      if (!hasSection(heads, re)) issues.push({ file: fileRel, line: 0, message: `нет секции «## ${label}»` });
    }
    add('m12', 'обязательные секции: Контекст/Цель/Что делаем/Критерии приёмки', issues.length ? 'FAIL' : 'PASS', issues);
  }

  /* m13 — проверяемые команды в критериях приёмки */
  {
    const issues = [];
    if (!criteria.items.length) {
      issues.push({ file: fileRel, line: 0, message: 'нет критериев — нет проверяемых команд' });
    } else {
      const withCmd = criteria.items.filter(hasVerifyCommand);
      if (!withCmd.length) {
        issues.push({ file: fileRel, line: criteria.items[0].line, message: 'ни один критерий не содержит исполняемой verify-команды' });
      }
    }
    add('m13', 'критерии приёмки содержат verify-команды', issues.length ? 'FAIL' : 'PASS', issues,
      criteria.items.length ? `критериев с командой: ${criteria.items.filter(hasVerifyCommand).length}/${criteria.items.length}` : '');
  }

  /* m14 — edge cases описаны */
  {
    const issues = [];
    const edgeRe = /^Edge Cases(?![a-z])/i;
    if (!hasSection(heads, edgeRe)) {
      issues.push({ file: fileRel, line: 0, message: 'нет секции «## Edge Cases»' });
    } else {
      const sec = sectionLines(lines, edgeRe);
      const bullets = sec.filter((r) => /^\s*[-*]\s+\S/.test(r.text));
      if (!bullets.length) {
        issues.push({ file: fileRel, line: sec[0].line, message: 'секция Edge Cases пуста' });
      }
    }
    add('m14', 'edge cases описаны (секция + непустой список)', issues.length ? 'FAIL' : 'PASS', issues);
  }

  /* m15 — битые внутренние ссылки на спеки/документы */
  {
    const issues = [];
    const found = new Map();
    const cands = [
      /\bспек[а-я]*\s+(\d{3}[a-z]?)/gi,
      /\bspec[- ](\d{3}[a-z]?)/gi,
    ];
    for (let i = 0; i < lines.length; i += 1) {
      for (const re of cands) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(lines[i])) !== null) {
          const id = m[1].toLowerCase();
          if (!found.has(id)) found.set(id, { line: i + 1 });
        }
      }
    }
    const specsDir = path.join(root, '.project/specs');
    const known = new Set();
    if (fs.existsSync(specsDir)) {
      for (const name of fs.readdirSync(specsDir)) {
        if (name.endsWith('.md')) known.add(name.split('-')[0].toLowerCase());
      }
    }
    for (const [id, info] of found) {
      const key = id.replace(/[a-z]+$/, '');
      if (!known.has(id) && !known.has(key)) {
        issues.push({ file: fileRel, line: info.line, message: `ссылка на спеку ${id} — файла в .project/specs нет` });
      }
    }
    // внутренние ссылки на документы репозитория
    for (const r of refs) {
      const clean = r.raw.replace(/^\.\//, '').replace(/[),.;:]+$/, '');
      if (!/\.md$/.test(clean)) continue;
      if (isUsageExample(r.line, r.raw) || isFuture(clean)) continue;
      if (!existsInRepo(root, clean)) {
        issues.push({ file: fileRel, line: r.line, message: `ссылка на несуществующий документ: \`${clean}\`` });
      }
    }
    add('m15', 'внутренние ссылки (спеки, документы) разрешаются', issues.length ? 'FAIL' : 'PASS', issues);
  }

  return checks;
}

/** Дубликаты в массиве. */
function duplicates(arr) {
  const seen = new Set();
  const dup = new Set();
  for (const x of arr) {
    if (seen.has(x)) dup.add(x);
    seen.add(x);
  }
  return [...dup];
}

/** Поиск цикла в графе зависимостей задач. */
function findCycle(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const state = new Map();
  const stack = [];
  let found = null;
  const visit = (id) => {
    if (found) return;
    const st = state.get(id) || 0;
    if (st === 1) {
      const at = stack.indexOf(id);
      found = stack.slice(at).concat(id);
      return;
    }
    if (st === 2) return;
    state.set(id, 1);
    stack.push(id);
    const it = byId.get(id);
    for (const dep of (it && it.dependencies) || []) if (byId.has(dep)) visit(dep);
    stack.pop();
    state.set(id, 2);
  };
  for (const it of items) visit(it.id);
  return found;
}

/** Проверяемый признак в критерии приёмки. */
function isVerifiable(text) {
  const t = String(text);
  if (/`[^`]+`/.test(t)) return true;
  if (/\bexit\s*(?:code\s*)?(?:=|:|!=|==|<>)?\s*\d/i.test(t)) return true;
  if (/\b\d+\s*\/\s*\d+\b/.test(t)) return true;
  if (/\b(?:не\s+меняется|не\s+создаёт|не\s+делает|остаётся|равно\s+нулю|пусто)\b/iu.test(t)) return true;
  if (/\b(?:verdict|pass|fail|warn|score|delta)\b/iu.test(t)) return true;
  if (/(?:в\s+логе|запис[а-я]*\s+в\s+лог|лог[аеу]?\b)/iu.test(t)) return true;
  return false;
}

/** Критерий несёт исполняемую verify-команду (node/npm/grep/git) или exit-код. */
function hasVerifyCommand(c) {
  const t = c.text;
  return /`[^`]*(?:node|npm|grep|git|npx)\b[^`]*`/i.test(t) || /\bexit\b/i.test(t);
}

/* -------------------------------------------------------- Фаза 0 (score) */

function scoreItem(label, points, max, note) {
  return { label, points, max, note };
}

function assessScore(ctx) {
  const { lines, text, heads, meta, decomp, criteria, writeScopes, refs, checks, fence } = ctx;
  const dims = [];

  /** «Что НЕ трогать» с реальными зонами (а не заголовком без списка). */
  const notTouchZones = sectionLines(lines, HEAD_RE('Что НЕ трогать'))
    .filter((r) => /^\s*[-*]\s+\S/.test(r.text)).length;
  const writeScopeTaskIds = new Set(writeScopes.map((w) => w.task));
  const declarationsPresent = decomp.items.length > 0 && decomp.items.every((it) => it.dependencies !== undefined);

  /* Completeness 30 */
  {
    const items = [];
    const need = [
      [HEAD_RE('Контекст'), 4, 'Контекст'],
      [HEAD_RE('Цель'), 4, 'Цель'],
      [HEAD_RE('Что делаем'), 5, 'Что делаем'],
      [HEAD_RE('Критерии приёмки'), 6, 'Критерии приёмки'],
      [HEAD_RE('Декомпозиция'), 5, 'Декомпозиция'],
      [HEAD_RE('Источники'), 3, 'Источники'],
      [/^Edge Cases(?![a-z])/i, 2, 'Edge Cases'],
      [HEAD_RE('Что НЕ трогать'), 1, 'Что НЕ трогать'],
    ];
    for (const [re, pts, label] of need) {
      const ok = hasSection(heads, re);
      items.push(scoreItem(`секция «${label}»`, ok ? pts : 0, pts, ok ? '' : 'отсутствует'));
    }
    const contextLines = sectionLines(lines, HEAD_RE('Контекст')).filter((r) => !isBlank(r.text)).length;
    const contextOk = contextLines >= 5;
    items.push(scoreItem('глубина «Контекст»', contextOk ? 2 : 0, 2, contextOk ? '' : `содержательных строк: ${contextLines} (нужно >= 5)`));
    dims.push({ key: 'Completeness', weight: 30, items });
  }

  /* Clarity 25 */
  {
    const items = [];
    const body = lines.slice(1).join('\n');
    const sentences = body.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
    const long = sentences.filter((s) => s.split(/\s+/).length > 45).length;
    let pts = 8;
    if (long > 0) pts = Math.max(0, 8 - Math.min(8, Math.ceil((long / Math.max(sentences.length, 1)) * 24)));
    items.push(scoreItem('длина предложений', pts, 8, long ? `предложений >45 слов: ${long} из ${sentences.length}` : ''));

    const vague = ['и т.д.', 'и т.п.', 'и др.', 'нечто', 'что-то', 'как-нибудь', 'по возможности', 'нормально', 'удобно', 'быстро'];
    const vagueHits = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (fence[i]) continue; // usage-примеры CLI не текст спеки
      for (const v of vague) if (lines[i].toLowerCase().includes(v)) vagueHits.push({ line: i + 1, v });
    }
    items.push(scoreItem('vague terms', vagueHits.length ? 0 : 6, 6, vagueHits.length ? `найдено: ${vagueHits.map((h) => `${h.v} (стр. ${h.line})`).join(', ')}` : ''));

    // [citation needed] — законная метка «Фаза 2 закроет»; снижаем балл, но не
    // обнуляем, если спека прямо декларирует, кто эти заглушки закрывает.
    const open = allMatches(lines, /\[(?:открыт[а-я]*\s+вопрос|citation needed)[^\]]*\]/iu);
    const phase2Owns = /Фаза\s*2|spec-enrich|enrich/i.test(text);
    let openPts = 6;
    let openNote = '';
    if (open.length) {
      openPts = phase2Owns ? 2 : 0;
      openNote = `строк: ${open.map((o) => o.line).join(', ')}${phase2Owns ? ' (закрывает Фаза 2 — заявлено в спеке)' : ''}`;
    }
    items.push(scoreItem('открытые вопросы/заглушки', openPts, 6, openNote));

    const subjectLens = allMatches(lines, /^###\s+(?:Компонент|Источник)/iu).length;
    items.push(scoreItem('структура «Что делаем»', subjectLens >= 2 ? 5 : subjectLens === 1 ? 3 : 0, 5,
      subjectLens ? `подразделов компонентов: ${subjectLens}` : 'подразделы компонентов не выделены'));
    dims.push({ key: 'Clarity', weight: 25, items });
  }

  /* Testability 25 */
  {
    const items = [];
    const n = criteria.items.length;
    items.push(scoreItem('критерии приёмки присутствуют', n > 0 ? 6 : 0, 6, n ? `критериев: ${n}` : 'секции нет'));
    const verifiable = criteria.items.filter((c) => isVerifiable(c.text)).length;
    items.push(scoreItem('проверяемость критериев', n ? Math.round((verifiable / n) * 10) : 0, 10, n ? `${verifiable}/${n}` : ''));
    const withCmd = criteria.items.filter(hasVerifyCommand).length;
    items.push(scoreItem('verify-команды', n ? Math.round((withCmd / n) * 6) : 0, 6, n ? `${withCmd}/${n}` : ''));
    const hasVerify = hasSection(heads, /^(?:Verify|Проверка|Как проверить)(?![a-zа-я])/iu);
    items.push(scoreItem('секция Verify', hasVerify ? 3 : 0, 3, hasVerify ? '' : 'явной секции нет (критерии несут команды)'));
    dims.push({ key: 'Testability', weight: 25, items });
  }

  /* Consistency 10 */
  {
    const items = [];
    const fieldOk = ['id', 'slug', 'type', 'status', 'commit'].filter((f) => meta[f] !== undefined && meta[f] !== '');
    items.push(scoreItem('frontmatter поля', Math.round((fieldOk.length / 5) * 3), 3, `${fieldOk.length}/5`));
    let phases = allMatches(lines, /Фаза\s+(\d+)(?![0-9])/u).map((m) => Number(/\d+/.exec(m.match)[0]));
    phases = [...new Set(phases)].sort((a, b) => a - b);
    const seq = phases.length > 0 && phases.every((p, i) => p === i);
    items.push(scoreItem('нумерация фаз 0..N без пропусков', seq ? 3 : 0, 3,
      phases.length ? `фаз: ${phases.length}${seq ? '' : ' (нумерация с разрывом)'}` : 'фаз не найдено'));
    const crossRefs = refs.filter((r) => /\.md$/.test(r.raw) && !/^https?:/.test(r.raw));
    const resolved = crossRefs.filter((r) => {
      const clean = r.raw.replace(/^\.\//, '').replace(/[),.;:]+$/, '');
      return existsInRepo(ctx.root, clean);
    });
    items.push(scoreItem('cross-refs разрешаются', crossRefs.length ? Math.round((resolved.length / crossRefs.length) * 2) : 2, 2,
      crossRefs.length ? `${resolved.length}/${crossRefs.length}` : 'ссылок нет'));
    const statusOk = STATUS_SET.has((meta.status || '').trim().toLowerCase());
    items.push(scoreItem('status из допустимого набора', statusOk ? 2 : 0, 2, statusOk ? '' : `status: ${meta.status || '—'}`));
    dims.push({ key: 'Consistency', weight: 10, items });
  }

  /* Scope 10 */
  {
    const items = [];
    const ids = decomp.items.map((i) => i.id);
    const withScope = writeScopes.filter((w) => ids.includes(w.task)).length;
    items.push(scoreItem('write-скоупы задач', ids.length ? Math.round((Math.min(withScope, ids.length) / ids.length) * 4) : 0, 4,
      ids.length ? `${withScope}/${ids.length} задач` : ''));

    // Внешние ограничения (то, что спека НЕ делает) достаточно объявить:
    // список «Что НЕ трогать» — усиление, а не обязательный артефакт.
    const externalConstraints = ids.length > 0 && declarationsPresent;
    items.push(scoreItem('внешние ограничения/порядок задач', externalConstraints ? 3 : 0, 3,
      externalConstraints ? `dependencies объявлены у ${decomp.items.length} задач${notTouchZones ? '' : '; список «Что НЕ трогать» пуст'}` : 'dependencies не объявлены'));

    // Собственная декларация спеки о write-скоупах принимается как граница
    // (у t6/t7 write-скоуп = read-only отчёты, он не перечисляется).
    const hasBoundary = writeScopeTaskIds.size > 0 || ids.length === 0;
    items.push(scoreItem('граница write-скоупов зафиксирована', hasBoundary ? 3 : 0, 3,
      ids.length ? `задач с write-скоупом: ${writeScopeTaskIds.size}/${ids.length}` : 'задач нет'));
    dims.push({ key: 'Scope', weight: 10, items });
  }

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0);
  const measured = dims.map((d) => {
    const max = d.items.reduce((s, i) => s + i.max, 0);
    const pts = d.items.reduce((s, i) => s + i.points, 0);
    const norm = max ? Math.round((pts / max) * 100) : 0;
    return { ...d, max, points: pts, normalized: norm, weighted: Math.round((norm * d.weight) / 100) };
  });
  const score = measured.reduce((s, d) => s + d.weighted, 0);
  return { measured, totalWeight, score };
}

/* ------------------------------------------------------- Фаза 4 (trace) */

const OWNER_EXTERNAL_RE = /(?:операц[а-я]*\s+капитана|капитан\s+копирует|вне\s+репо|вне\s+репозитория|~\/(?:\.dsh|\.config))/iu;
const GATE_RE = /(?:sync:check|test:run|verdict\s*=|verdict|qc\s+verdict|reviewer\s+verdict|финальн[а-я]*\s+(?:гейт|проверка)|baseline\s+\d+|baseline)/iu;

/** Атомы критерия: фазы (`Фаза 2`), пути/имена артефактов (`path.md`). */
function criterionAtoms(text) {
  const phases = new Set();
  for (const m of allMatchesIn(text, /Фаза\s+(\d+)(?![0-9])/giu)) phases.add(Number(m));
  const atoms = new Set();
  for (const p of extractPathTokens(text)) {
    if (p.length >= 4 && /[./\\]/.test(p)) atoms.add(p);
    const base = path.basename(p);
    if (base.length >= 6 && /\.(?:mjs|md|json|yml|yaml|ts|tsx|cjs)$/i.test(base)) atoms.add(base);
  }
  return { phases, atoms };
}

/** Все совпадения группы 1 в строке. */
function allMatchesIn(text, re) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/** Диапазоны фаз, объявленные в subject задачи («Фазы 2, 3, 5–10»). */function phaseRanges(subject) {
  const s = String(subject).replace(/[–—]/g, '-');
  const ranges = [];
  const re = /(\d+)\s*(?:-\s*(\d+))?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a <= 20 && b <= 20) ranges.push([Math.min(a, b), Math.max(a, b)]);
  }
  const tail = s.match(/(\d+)\)?\s*$/);
  if (tail) {
    const n = Number(tail[1]);
    if (n <= 20 && !ranges.some(([a, b]) => n >= a && n <= b)) ranges.push([n, n]);
  }
  return ranges;
}

/* --- доказательство из репозитория (канал 4 трейсабилити) --------------- */

const EVIDENCE_DIRS = ['.project', 'docs'];
const EVIDENCE_ROOT_FILES = ['AGENTS.md', 'README.md'];
const EVIDENCE_MAX_BYTES = 200 * 1024;
const EVIDENCE_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.agent-teams', 'archive']);

/** Файлы-свидетели: .project/**, docs/** и корневые *.md (без банка/инструментов). */
function evidenceFiles(root) {
  const out = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (EVIDENCE_SKIP_DIRS.has(e.name)) continue;
        walk(abs, depth + 1);
      } else if (/\.(?:md|mjs|cjs|json|yml|yaml)$/i.test(e.name)) {
        const rel = toRel(root, abs);
        if (/^\.project\/specs\//.test(rel)) continue; // сама спека — не свидетель
        // Генерируемые артефакты прогонов не входят в корпус свидетелей.
        // Их объём растёт с каждым прогоном (промпты, отчёты фаз, отчёты qc),
        // а порог «редкости» токена считается от размера корпуса: без этого
        // исключения канал «уже выполнено в репозитории» деградирует
        // (docs/index.html накапливает отчёты) и выдумывает сирот уровня
        // критерия -> ложный hard-fail, блокирующий конвейер (регресс t9:
        // критерий 9 spec 040 стал сиротой).
        if (/^\.project\/drafts\//.test(rel)) continue;
        const text = readTextSafe(abs);
        if (text !== null && text.length <= EVIDENCE_MAX_BYTES) out.push({ path: rel, text });
      }
    }
  };
  for (const d of EVIDENCE_DIRS) {
    const abs = path.join(root, d);
    if (fs.existsSync(abs)) walk(abs, 0);
  }
  for (const f of EVIDENCE_ROOT_FILES) {
    const abs = path.join(root, f);
    const text = readTextSafe(abs);
    if (text !== null) out.push({ path: f, text });
  }
  return out;
}

/** Ссылка на саму спеку (`040-spec-chain.md` / путь в `.project/specs/`). */
function isSelfReference(p, specBase) {
  const clean = String(p).replace(/^\.\//, '');
  return /^\.project\/specs\//.test(clean) || clean === specBase || clean.endsWith(`/${specBase}`);
}

/**
 * Канал 4: критерий уже выполнен в репозитории. Применяется ПОСЛЕ проверки
 * связей с задачами и намеренно узкий:
 *   - жёсткий режим: критерий называет файл-артефакт → свидетелем может быть
 *     только этот файл (сама спека исключена);
 *   - мягкий режим (атомов нет): ВСЕ редкие токены критерия найдены в одном
 *     файле-отчёте, среди них есть токен длиной >= 7.
 */
function repoEvidence(criterion, files, docFreq, totalFiles, specBase) {
  const tokens = [...stemSet(criterion.text)].filter((t) => t.length >= 5);
  if (tokens.length < 2) return null;
  const rare = tokens.filter((t) => (docFreq.get(t) || 0) <= Math.max(3, totalFiles * 0.15));
  const { atoms } = criterionAtoms(criterion.text);
  const narrowed = [...atoms].filter((a) => !isSelfReference(a, specBase));
  const atomsEffective = narrowed.length;

  // Жёсткий режим: критерий называет конкретный файл-артефакт. Тогда
  // доказательством может быть только этот файл (или вложенный в него) —
  // никакой поиск «где-нибудь в репо».
  if (atomsEffective) {
    for (const a of narrowed) {
      const clean = String(a).replace(/^\.\//, '');
      const witness = files.find((f) => f.path === clean || f.path.startsWith(`${clean}/`));
      if (!witness) continue;
      const fTokens = stemSet(witness.text);
      const hits = tokens.filter((t) => fTokens.has(t));
      if (!hits.length) continue;
      return { path: witness.path, hits, mode: 'atom-file' };
    }
    return null; // атом назван, но файла-свидетеля нет → не доказано
  }

  // Мягкий режим: атомов нет. Требуем наличие всех редких токенов в одном
  // файле-свидетеле, который сам является отчётом/артефактом процесса.
  const reportWitness = /(?:report|отч[её]т|draft|audit|verdict|summary|skill|chain)/iu;
  if (rare.length < 2) return null;
  let best = null;
  for (const f of files) {
    if (!reportWitness.test(f.path)) continue;
    const fTokens = stemSet(f.text);
    const hits = rare.filter((t) => fTokens.has(t));
    if (hits.length !== rare.length) continue;
    if (!hits.some((h) => h.length >= 7)) continue;
    if (!best || f.path.length < best.path.length) best = { path: f.path, hits, mode: 'token-file' };
  }
  return best;
}

function assessTraceability(ctx) {
  const { decomp, criteria, goals, text, root, fileRel } = ctx;
  const taskIds = new Set(decomp.items.map((i) => i.id));

  // Корпус-свидетели и частота токенов — считаем один раз.
  const evidence = evidenceFiles(root);
  const docFreq = new Map();
  for (const f of evidence) {
    for (const t of stemSet(f.text)) docFreq.set(t, (docFreq.get(t) || 0) + 1);
  }

  const links = criteria.items.map((c) => {
    const cTokens = stemSet(c.text);
    const { phases, atoms } = criterionAtoms(c.text);
    const assigned = [];
    // 1) явная ссылка на id задачи в тексте критерия
    const explicit = [...taskIds].filter((id) => new RegExp(`(^|[^0-9a-z])${id}(?![0-9a-z])`, 'i').test(c.text));
    for (const it of decomp.items) {
      const via = [];
      if (explicit.includes(it.id)) via.push('id');
      // 2) атом-ссылка: путь/имя артефакта, который задача доставляет
      //    (совпадение по полному пути или по имени файла)
      const del = it.deliverables;
      const atomHit = [...atoms].find((a) => {
        if (del.includes(a)) return true;
        const base = path.basename(a);
        return del.some((d) => d === a || path.basename(d) === base || d.endsWith(`/${a}`) || a.endsWith(`/${d}`));
      });
      if (atomHit) via.push(`atom:${atomHit}`);
      // 3) диапазон фаз: критерий про «Фазу N» и задача владеет этими фазами
      if (!via.length && phases.size) {
        const ranges = phaseRanges(it.subject);
        const hit = [...phases].find((p) => ranges.some(([a, b]) => p >= a && p <= b));
        if (hit !== undefined) via.push(`phase:${hit}`);
      }
      // 4) роль: критерий проверяется ролью (qc/reviewer/verdict/приёмк), и
      //    задача объявлена за этой ролью — прямая связь «критерий ↔ роль».
      if (!via.length) {
        const role = /(?:verdict|qc|reviewer|review|ревью|приёмк|приемк)/iu.test(c.text);
        if (role && /(?:verdict|qc|reviewer|review|ревью|приёмк|приемк)/iu.test(it.subject)) via.push('role');
      }
      // 5) строгий token-fallback. Одиночные короткие или общеупотребительные
      //    слова («спека», «проверка») связи не создают: нужно либо один
      //    редкий длинный токен, либо >= 2 общих токена длиной >= 5.
      if (!via.length) {
        const tTokens = new Set([...stemSet(it.subject), ...stemSet(it.text)]);
        const strong = tokenOverlap(cTokens, tTokens, { minCount: 2, minLen: 5, rareLen: 7, rareDf: 3, docFreq });
        if (strong) via.push(`token:${strong}`);
      }
      if (via.length) assigned.push({ task: it.id, via: via.join('+') });
    }
    // 5) внешний владелец / финальный гейт — покрытие вне DAG
    let external = OWNER_EXTERNAL_RE.test(c.text) || (GATE_RE.test(c.text) && explicit.length === 0);
    // 6) канал «уже выполнено в репозитории» — только если задача не нашлась
    let evidenceHit = null;
    if (!assigned.length && !external) {
      evidenceHit = repoEvidence(c, evidence, docFreq, evidence.length, path.basename(fileRel));
      if (evidenceHit) external = true;
    }
    const externalOnly = !assigned.length && external;
    return {
      criterion: c,
      assigned: externalOnly ? [] : assigned,
      external,
      evidence: evidenceHit,
      phases: [...phases],
    };
  });

  const orphans = {
    goals: [],
    criteria: [],
    tasks: [],
    external: [],
  };

  for (const l of links) {
    if (l.assigned.length) continue;
    if (l.external) {
      orphans.external.push(l.criterion);
      continue;
    }
    orphans.criteria.push(l.criterion);
  }

  // задачи без критерия и без внешнего/ролевого обоснования
  const taskLinks = decomp.items.map((it) => {
    const covers = links.filter((l) => l.assigned.some((a) => a.task === it.id)).map((l) => l.criterion.num);
    return { task: it, covers };
  });
  for (const tl of taskLinks) {
    if (tl.covers.length) continue;
    const owner = /(?:операц[а-я]*\s+капитана|капитан)/i.test(tl.task.text);
    if (!owner) orphans.tasks.push(tl.task);
  }

  // уровень «Цель»: цель сирота, если её токены не пересекаются ни с одним
  // критерием/задачей и она не декларирует внешнюю операцию.
  const goalLinks = goals.items.map((g) => {
    const gTokens = stemSet(g.text);
    const coveredBy = [];
    for (const l of links) {
      if (tokenOverlap(gTokens, stemSet(l.criterion.text))) coveredBy.push(l.criterion.num);
    }
    for (const it of decomp.items) {
      if (tokenOverlap(gTokens, stemSet(it.text))) {
        coveredBy.push(`task:${it.id}`);
        for (const l of links) if (l.assigned.some((a) => a.task === it.id)) coveredBy.push(l.criterion.num);
      }
    }
    const external = OWNER_EXTERNAL_RE.test(g.text);
    return { goal: g, coveredBy: [...new Set(coveredBy)], external };
  });
  for (const gl of goalLinks) {
    if (gl.coveredBy.length || gl.external) continue;
    orphans.goals.push(gl.goal);
  }

  // «спека без Декомпозиции» — advisory: hard-fail не выдаём. Сироты,
  // найденные при отсутствующем DAG, не доказуемы (сравнивать не с чем) и
  // переносятся в advisory-список.
  const decompositionMissing = !decomp.present;
  const advisory = [];
  if (decompositionMissing) {
    advisory.push(...orphans.criteria.map((c) => `критерий ${c.num} (стр. ${c.line})`));
    advisory.push(...orphans.goals.map((g) => `цель ${g.n} (стр. ${g.line})`));
    orphans.criteria = [];
    orphans.goals = [];
  }
  const hardFail = !decompositionMissing && (orphans.criteria.length > 0 || orphans.goals.length > 0);

  return { links, taskLinks, goalLinks, orphans, decompositionMissing, hardFail, advisory };
}

/* -------------------------------------------------------------- отчёт */

function renderReport(model) {
  const { specRel, meta, score, checks, trace, exitCode, jsonMode } = model;
  const L = [];
  L.push('=== spec-enrich / Проверяльщик спек — Фазы 0, 1, 4 (детерминированное ядро) ===');
  L.push(`Спека: ${specRel}`);
  L.push(`id: ${meta.id || '—'}   slug: ${meta.slug || '—'}   type: ${meta.type || '—'}   status: ${meta.status || '—'}   commit: ${meta.commit || '—'}`);
  L.push('');

  L.push('--- Фаза 0 — baseline score ---');
  L.push('измерение      вес  норма  вклад  детали');
  for (const d of score.measured) {
    const details = d.items.filter((i) => i.note).map((i) => `${i.label}: ${i.note}`).join('; ');
    L.push(`${d.key.padEnd(14)} ${String(d.weight).padStart(3)}%  ${String(d.normalized).padStart(3)}%  ${String(d.weighted).padStart(5)}  ${details || 'ok'}`);
  }
  L.push(`сумма весов: ${score.totalWeight}%`);
  const verdict = score.score >= 70 ? 'OK (порог 70)' : 'BELOW THRESHOLD 70';
  L.push(`BASELINE SCORE: ${score.score}/100 — ${verdict}`);
  L.push('');

  L.push(`--- Фаза 1 — механические проверки (${checks.length}) ---`);
  for (const c of checks) {
    const sev = c.status === 'FAIL' && c.severity === 'hard-fail' ? ' (hard-fail)' : '';
    L.push(`[${c.status}${sev}] ${c.id} ${c.name}`);
    if (c.note) L.push(`        note: ${c.note}`);
    for (const issue of c.issues) {
      const loc = issue.line ? `${issue.file}:${issue.line}` : issue.file;
      L.push(`        ${loc} — ${issue.message}`);
    }
  }
  const passed = checks.filter((c) => c.status === 'PASS').length;
  const failed = checks.filter((c) => c.status === 'FAIL').length;
  const warned = checks.filter((c) => c.status === 'WARN').length;
  L.push(`Итог Фазы 1: PASS ${passed} / FAIL ${failed} / WARN ${warned}`);
  if (failed && exitCode === EXIT_CLEAN) {
    L.push('Примечание: механические FAIL — диагностика качества текста (заглушки, пути,');
    L.push('не-verify критерии); exit-код они не меняют. Hard-fail дают только сироты');
    L.push('traceability (Фаза 4) и нечитаемый frontmatter (m01/m02).');
  }
  L.push('');

  L.push('--- Фаза 4 — traceability: Цель -> Критерий приёмки -> Задача декомпозиции ---');
  if (trace.decompositionMissing) {
    L.push('WARN: секция «## Декомпозиция» отсутствует — traceability понижена до advisory, hard-fail не выдаётся');
    if (trace.advisory.length) {
      L.push('ADVISORY (не hard-fail):');
      for (const a of trace.advisory) L.push(`  ${a}`);
    }
  }
  const byTask = new Map();
  for (const l of trace.links) {
    for (const a of l.assigned) {
      if (!byTask.has(a.task)) byTask.set(a.task, []);
      byTask.get(a.task).push(`кр.${l.criterion.num} (${a.via})`);
    }
  }
  L.push('Критерий -> задача:');
  for (const l of trace.links) {
    const cov = l.assigned.length
      ? l.assigned.map((a) => `${a.task}(${a.via})`).join(', ')
      : l.evidence ? `уже выполнено в репозитории (${l.evidence.path})`
        : l.external ? 'вне DAG (внешний владелец/финальный гейт)' : 'СИРОТА';
    L.push(`  кр.${l.criterion.num} (стр. ${l.criterion.line}) -> ${cov}`);
  }
  L.push('Задача -> критерии:');
  for (const tl of trace.taskLinks) {
    L.push(`  ${tl.task.id} (стр. ${tl.task.line}) -> ${tl.covers.length ? tl.covers.map((n) => `кр.${n}`).join(', ') : 'нет покрытия'}`);
  }
  L.push('Цель -> критерии/задачи:');
  for (const gl of trace.goalLinks) {
    const cov = gl.coveredBy.length ? gl.coveredBy.join(', ') : gl.external ? 'вне DAG' : 'СИРОТА';
    L.push(`  цель ${gl.goal.n} (стр. ${gl.goal.line}) -> ${cov}`);
  }
  L.push(`Вне DAG (внешний владелец/гейт): ${trace.orphans.external.length ? trace.orphans.external.map((c) => `кр.${c.num}`).join(', ') : 'нет'}`);
  L.push(`Сироты: цели ${trace.orphans.goals.length}, критерии ${trace.orphans.criteria.length}, задачи ${trace.orphans.tasks.length}`);
  if (trace.orphans.tasks.length) {
    L.push('WARN: задачи без критерия (инфраструктурные работы) — не hard-fail');
    for (const t of trace.orphans.tasks) L.push(`  ${t.id} (стр. ${t.line})`);
  }
  if (trace.hardFail) {
    L.push('HARD-FAIL: traceability нарушена — найдены сироты уровня «цель»/«критерий»');
    for (const g of trace.orphans.goals) L.push(`  HARD-FAIL цель ${g.n} (стр. ${g.line}): нет покрытия задачей`);
    for (const c of trace.orphans.criteria) L.push(`  HARD-FAIL критерий ${c.num} (стр. ${c.line}): нет покрытия задачей и внешнего владельца`);
  } else {
    L.push('Traceability: OK (сирот уровня «цель»/«критерий» нет)');
  }
  L.push('');

  const statusText = exitCode === EXIT_CLEAN ? 'PASS' : exitCode === EXIT_HARD_FAIL ? 'HARD-FAIL' : 'USAGE/IO ERROR';
  L.push(`Результат: ${statusText} (exit ${exitCode})`);
  if (!jsonMode) L.push('');
  return L.join('\n');
}

/* ----------------------------------------------------------- CLI/сборка */

function parseArgs(argv) {
  const opts = { positional: [], json: false, out: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--out') {
      opts.out = argv[i + 1] || null;
      i += 1;
    } else if (a === '--help' || a === '-h') opts.help = true;
    else opts.positional.push(a);
  }
  return opts;
}

const USAGE = [
  'usage: node .project/scripts/validate-spec.mjs <spec> [--json] [--out <path>]',
  '',
  '  <spec>        путь к спеке (.project/specs/040-spec-chain.md) или её id (040)',
  '  --json        машиночитаемый отчёт в stdout (человекочитаемая форма подавляется)',
  '  --out <path>  запись отчёта в файл (форма зависит от --json)',
  '  --help        эта справка',
  '',
  'exit 0 — чисто; 1 — hard-fail (FAIL механических проверок или сироты traceability);',
  'exit 2 — ошибка использования/чтения.',
].join('\n');

/** Резолв спеки: путь или id. */
function resolveSpec(root, spec) {
  if (!spec) return null;
  const direct = path.resolve(root, spec);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const specsDir = path.join(root, '.project/specs');
  if (!fs.existsSync(specsDir)) return null;
  const want = spec.toLowerCase().replace(/\.md$/, '');
  const names = fs.readdirSync(specsDir).filter((n) => n.endsWith('.md')).sort();
  const exact = names.find((n) => n.toLowerCase().replace(/\.md$/, '') === want);
  if (exact) return path.join(specsDir, exact);
  const byId = names.find((n) => n.toLowerCase().split('-')[0] === want);
  return byId ? path.join(specsDir, byId) : null;
}

/** Корень репозитория: .project/scripts/ → ../../ . */
function resolveRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  if (path.basename(path.dirname(here)) === '.project') return path.resolve(here, '..', '..');
  return process.cwd();
}

function build(opts) {
  const root = resolveRoot();
  const specAbs = resolveSpec(root, opts.positional[0]);
  if (!specAbs) {
    const msg = opts.positional[0]
      ? `спека не найдена: ${opts.positional[0]}`
      : 'не указан аргумент <spec>';
    return { error: msg };
  }
  const text = readTextSafe(specAbs);
  if (text === null) return { error: `спека не читается: ${specAbs}` };

  const lines = splitLines(text);
  const { meta, end: fmEnd } = parseFrontmatter(lines);
  const heads = headings(lines);
  const fileRel = toRel(root, specAbs);
  const decomp = parseDecomposition(lines);
  const criteria = parseCriteria(lines);
  const goals = parseGoals(lines);
  const writeScopes = parseWriteScopes(lines);
  attachWriteScopes(decomp, writeScopes);
  const refs = references(lines);

  const ctx = { lines, text, heads, meta, fmEnd, fileRel, relPath: specAbs, root, decomp, criteria, goals, writeScopes, refs, fence: fenceMask(lines) };
  const checks = mechanicalChecks(ctx);
  ctx.checks = checks;
  const score = assessScore(ctx);
  const trace = assessTraceability(ctx);

  const failedChecks = checks.filter((c) => c.status === 'FAIL');
  // Политика exit-кода. Hard-fail = «дальше идти нельзя» и ровно два случая:
  //   1) сироты traceability (Фаза 4);
  //   2) нечитаемый frontmatter — проверка m01 с severity 'hard-fail'
  //      (нет блока `---` / нет поля `id`): спека неадресуема.
  // Прочие механические FAIL (m02 id/slug vs имя файла, заглушки, нерешаемые
  // пути, не-verify критерии) — диагностика оформления/качества в отчёте,
  // exit-код они не меняют: спека может быть одобрена капитаном и нести
  // задокументированные долги, которые закрывает Фаза 2.
  const structuralFail = checks.some((c) => c.status === 'FAIL' && c.severity === 'hard-fail');
  let exitCode = EXIT_CLEAN;
  if (trace.hardFail || structuralFail) exitCode = EXIT_HARD_FAIL;
  void failedChecks;

  return { root, specAbs, specRel: fileRel, meta, lines, checks, score, trace, exitCode, structuralFail, failedChecks };
}

function toJson(model) {
  const { specRel, meta, score, checks, trace, exitCode } = model;
  return {
    tool: 'validate-spec.mjs',
    spec040Component: 'A',
    phases: [0, 1, 4],
    spec: {
      path: specRel,
      id: meta.id || null,
      slug: meta.slug || null,
      type: meta.type || null,
      status: meta.status || null,
      commit: meta.commit || null,
    },
    phase0: {
      weights: { Completeness: 30, Clarity: 25, Testability: 25, Consistency: 10, Scope: 10 },
      weightSum: score.totalWeight,
      score: score.score,
      threshold: 70,
      dimensions: score.measured.map((d) => ({
        key: d.key,
        weight: d.weight,
        normalized: d.normalized,
        weighted: d.weighted,
        items: d.items,
      })),
    },
    phase1: {
      count: checks.length,
      passed: checks.filter((c) => c.status === 'PASS').length,
      failed: checks.filter((c) => c.status === 'FAIL').length,
      warned: checks.filter((c) => c.status === 'WARN').length,
      checks: checks.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        severity: c.severity || 'diagnostic',
        note: c.note || null,
        issues: c.issues,
      })),
    },
    phase4: {
      decompositionPresent: !trace.decompositionMissing,
      advisory: trace.advisory,
      orphanGoals: trace.orphans.goals.map((g) => ({ n: g.n, line: g.line, text: g.text })),
      orphanCriteria: trace.orphans.criteria.map((c) => ({ num: c.num, line: c.line, text: c.text })),
      orphanTasks: trace.orphans.tasks.map((t) => ({ id: t.id, line: t.line })),
      external: trace.orphans.external.map((c) => ({ num: c.num, line: c.line })),
      links: trace.links.map((l) => ({
        criterion: l.criterion.num,
        line: l.criterion.line,
        tasks: l.assigned,
        external: l.external,
      })),
      goalLinks: trace.goalLinks.map((g) => ({ goal: g.goal.n, line: g.goal.line, coveredBy: g.coveredBy, external: g.external })),
      hardFail: trace.hardFail,
    },
    hardFail: exitCode === EXIT_HARD_FAIL,
    exitCode,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(`${USAGE}\n`);
    process.exit(EXIT_CLEAN);
  }

  const model = build(opts);
  if (model.error) {
    process.stderr.write(`validate-spec: ${model.error}\n\n${USAGE}\n`);
    process.exit(EXIT_USAGE);
  }

  const report = opts.json ? JSON.stringify(toJson(model), null, 2) : renderReport({ ...model, jsonMode: false });

  if (opts.out) {
    const outAbs = path.resolve(model.root, opts.out);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, `${report}\n`, 'utf8');
    process.stdout.write(`отчёт записан: ${toRel(model.root, outAbs)}\n`);
  } else {
    process.stdout.write(`${report}\n`);
  }

  process.exit(model.exitCode);
}

main();
