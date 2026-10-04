#!/usr/bin/env node
/**
 * .project/scripts/check.mjs — единая точка проверки UI/UX (spec 077).
 *
 * Зачем: критерии UI/UX размазаны по трём источникам (проба вёрстки spec 075,
 * axe-baseline spec 074, правила кода в `src/presentation/**`). Скрипт читает
 * чек-лист `.project/checklists/ui-ux.yaml` (30 критериев) и для каждого
 * критерия диспатчит проверку по полю `check`:
 *
 *   playwright → .project/drafts/layout-probe-075.json — нарушения по `check`-виду
 *                (`overflow`, `touch-target`, `cta-out-of-viewport`,
 *                `clipped-text`, `escaped-element`) из пробы spec 075;
 *   axe        → .project/drafts/a11y-baseline.json — правила axe
 *                (`color-contrast`, `focus-visible`) и их
 *                `violations[].nodes[].failureSummary`;
 *   grep       → `src/presentation/**` — регексп по исходникам;
 *   manual     → пропуск (status остаётся `manual`);
 *   vision     → пропуск (status остаётся `manual`; аудит агентом — `npm run
 *                audit:screens`, скрипт печатает инструкцию, PNG читает агент).
 *
 * Семантика grep (как в спеке 077):
 *   0 совпадений   → pass (для `expect: match` — наоборот, fail);
 *   1..20          → fail, в отчёте все совпадения с `file:line`;
 *   >20            → fail, первые 20 + «…и ещё N»;
 *   режим distinct → pass, если уникальных значений <= max-distinct;
 *   режим modulo   → pass, если каждое значение кратно modulo;
 *   файлов нет     → unknown (источник не найден — не то же самое, что «чисто»).
 *
 * Zero-deps: YAML-подмножество парсится своим сканером (как `sync.mjs`
 * читает `roles.yaml`), внешние пакеты не нужны — скрипт обязан работать
 * в голом `node` без установки.
 *
 * Выход:
 *   .project/checklists/ui-ux.yaml — обновлённые `status:` (запись temp + rename);
 *   .project/drafts/checklist-report-YYYY-MM-DD.md — отчёт прогона;
 *   exit 1 — есть fail с severity critical/high (COLOR-001, LAYOUT-003),
 *   иначе 0. `unknown` критичного критерия — exit 0 с пометкой в отчёте:
 *   «источник не найден» отличается от «проверено и плохо».
 *
 * Запуск: npm run check
 *         node .project/scripts/check.mjs [--date YYYY-MM-DD] [--self-test]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const CHECKLIST = path.join(ROOT, '.project', 'checklists', 'ui-ux.yaml');
const DRAFTS = path.join(ROOT, '.project', 'drafts');
const PRESENTATION = path.join(ROOT, 'src', 'presentation');
const PROBE_JSON = path.join(DRAFTS, 'layout-probe-075.json');
const A11Y_JSON = path.join(DRAFTS, 'a11y-baseline.json');

/** Fail этих критериев — «стало хуже»: контраст текста и CTA во вьюпорте. */
const CRITICAL = new Set(['COLOR-001', 'LAYOUT-003']);

const MODES = new Set(['plain', 'distinct', 'modulo', 'near']);
const CHECKS = new Set(['playwright', 'axe', 'grep', 'manual', 'vision']);
const STATUSES = new Set(['pass', 'fail', 'unknown', 'manual']);
const SEP = '\u0000';

/* ═══════════════════════════════════════════════════ CLI / helpers */

const args = process.argv.slice(2);
const SELF_TEST = args.includes('--self-test');

function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

/**
 * Дата отчёта. По умолчанию — локальная дата машины; `--date` нужен для
 * воспроизводимых прогонов (имя отчёта — часть контракта спеки).
 */
function reportDate() {
  const forced = argValue('--date');
  if (forced) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(forced)) {
      console.error(`check: --date ожидает YYYY-MM-DD, получено "${forced}"`);
      process.exit(2);
    }
    return forced;
  }
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const exists = (p) => fs.existsSync(p);
const readText = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

/* ═══════════════════════════════════════════ YAML (подмножество) */

/**
 * Значение-скаляр YAML: кавычки (одинарные с `''`-экранированием, двойные),
 * inline-список `[a, b]`, bool/number. Хвостовой комментарий отбивается.
 */
function parseScalar(raw) {
  const s = String(raw).trim();
  if (s === '') return null;
  if (s.startsWith('[') && s.endsWith(']')) {
    return s
      .slice(1, -1)
      .split(',')
      .map((x) => parseScalar(x))
      .filter((x) => x !== null);
  }
  const q = s[0];
  if (q === "'" || q === '"') {
    let out = '';
    for (let i = 1; i < s.length; i += 1) {
      if (q === "'" && s[i] === "'" && s[i + 1] === "'") {
        out += "'";
        i += 1;
        continue;
      }
      if (q === '"' && s[i] === '\\' && i + 1 < s.length) {
        out += s[i + 1] === 'n' ? '\n' : s[i + 1];
        i += 1;
        continue;
      }
      if (s[i] === q) return out;
      out += s[i];
    }
    return out;
  }
  const bare = s.replace(/\s+#.*$/, '').trim();
  if (bare === 'true') return true;
  if (bare === 'false') return false;
  if (bare === 'null') return null;
  if (/^-?\d+$/.test(bare)) return Number(bare);
  return bare;
}

const unquote = (s) => String(s).replace(/^["']|["']$/g, '');

const kvOf = (line) => {
  const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
  return m ? { key: m[1], val: m[2] } : null;
};

/**
 * Сканер ровно нашего формата: плоские скаляры верхнего уровня, список
 * `criteria:` из мапов, вложенные блоки второго уровня (`grep:`, `probe:`).
 * Неизвестная строка — ошибка с номером строки: молча съеденный критерий
 * хуже падения (чек-лист — гейт, а не заметка).
 */
function parseChecklist(text) {
  const lines = text.split('\n');
  const meta = {};
  const criteria = [];
  let mode = null; // 'criteria' | 'grep' | 'probe'
  let cur = null;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const indent = raw.length - raw.replace(/^\s+/, '').length;
    const where = `${rel(CHECKLIST)}:${i + 1}`;

    if (indent === 0) {
      const kv = kvOf(line);
      if (!kv) throw new Error(`${where} — не разобрать строку верхнего уровня: ${line}`);
      if (kv.key === 'criteria') {
        mode = 'criteria';
        cur = null;
        continue;
      }
      meta[kv.key] = parseScalar(kv.val);
      mode = null;
      continue;
    }

    // Новый критерий — из любого режима: блоки grep:/probe: короткие и
    // «склеиваются» с следующей записью лишь по отступу.
    if (indent === 2 && line.startsWith('- ') && (mode === 'criteria' || mode === 'grep' || mode === 'probe' || mode === 'axe')) {
      mode = 'criteria';
      cur = {};
      criteria.push(cur);
      const kv = kvOf(line.slice(2));
      if (!kv) throw new Error(`${where} — запись критерия без ключа: ${line}`);
      cur[kv.key] = parseScalar(kv.val);
      continue;
    }

    if (mode === 'criteria') {
      if (!cur) throw new Error(`${where} — строка вне записи критерия: ${line}`);
      if (indent === 4) {
        const kv = kvOf(line);
        if (!kv) throw new Error(`${where} — не разобрать поле критерия: ${line}`);
        if ((kv.key === 'grep' || kv.key === 'probe' || kv.key === 'axe') && kv.val.trim() === '') {
          cur[kv.key] = {};
          mode = kv.key;
          continue;
        }
        mode = 'criteria';
        cur[kv.key] = parseScalar(kv.val);
        continue;
      }
      throw new Error(`${where} — слишком глубокий отступ: ${line}`);
    }

    // Вложенные блоки grep:/probe:
    if (indent !== 6 || !cur || !cur[mode]) {
      throw new Error(`${where} — неожиданная строка в блоке ${mode}: ${line}`);
    }
    const kv = kvOf(line);
    if (!kv) throw new Error(`${where} — не разобрать поле блока ${mode}: ${line}`);
    cur[mode][kv.key] = parseScalar(kv.val);
  }

  return { meta, criteria };
}

/** Карта id → status: ровно шесть пробелов отступа у поля `status:`. */
function readStatuses(text) {
  const map = new Map();
  let curId = null;
  for (const raw of text.split('\n')) {
    const idm = /^\s{2}- id:\s*(.+)$/.exec(raw);
    if (idm) {
      curId = unquote(idm[1].trim());
      continue;
    }
    const stm = /^\s{4}status:\s*(.+)$/.exec(raw);
    if (stm && curId) {
      map.set(curId, unquote(stm[1].trim()));
      curId = null;
    }
  }
  return map;
}

/**
 * Точечная запись статусов: правится ТОЛЬКО значение поля `status` внутри
 * своей записи. Остальной текст (комментарии, порядок, форматирование)
 * сохраняется байт-в-байт, поэтому diff прогона читаем.
 */
function rewriteStatuses(text, statuses) {
  const lines = text.split('\n');
  const out = [];
  let curId = null;
  let changed = 0;
  for (const raw of lines) {
    const idm = /^\s{2}- id:\s*(.+)$/.exec(raw);
    if (idm) {
      curId = unquote(idm[1].trim());
      out.push(raw);
      continue;
    }
    const stm = /^(\s{4}status:\s*)(.+)$/.exec(raw);
    if (stm && curId && statuses.has(curId)) {
      const next = statuses.get(curId);
      const prev = unquote(stm[2].trim());
      if (next !== prev) changed += 1;
      out.push(`${stm[1]}${next}`);
      curId = null;
      continue;
    }
    out.push(raw);
  }
  return { text: out.join('\n'), changed };
}

/** Атомарная запись: temp-файл в том же каталоге + rename (LF-only). */
function writeAtomic(target, text) {
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, String(text).replace(/\r\n/g, '\n'), { encoding: 'utf8' });
  fs.renameSync(tmp, target);
}

/* ═══════════════════════════════════════════════════════ источники */

function loadProbe() {
  if (!exists(PROBE_JSON)) return { ok: false, reason: `нет файла ${rel(PROBE_JSON)}` };
  try {
    const json = JSON.parse(readText(PROBE_JSON));
    if (!Array.isArray(json.screens)) {
      return { ok: false, reason: `${rel(PROBE_JSON)}: нет массива screens` };
    }
    return { ok: true, json };
  } catch (e) {
    return { ok: false, reason: `${rel(PROBE_JSON)} не парсится: ${e.message}` };
  }
}

function loadAxe() {
  if (!exists(A11Y_JSON)) return { ok: false, reason: `нет файла ${rel(A11Y_JSON)}` };
  try {
    const json = JSON.parse(readText(A11Y_JSON));
    if (!json.screens || typeof json.screens !== 'object') {
      return { ok: false, reason: `${rel(A11Y_JSON)}: нет объекта screens` };
    }
    return { ok: true, json };
  } catch (e) {
    return { ok: false, reason: `${rel(A11Y_JSON)} не парсится: ${e.message}` };
  }
}

/** Рекурсивный обход `src/presentation/**` с фильтром по расширениям. */
function collectSources(include, exclude) {
  const exts = Array.isArray(include) && include.length ? include : ['.ts', '.tsx'];
  const exRes = (Array.isArray(exclude) ? exclude : []).map((e) => new RegExp(String(e)));
  const out = [];
  if (!exists(PRESENTATION)) return out;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!exts.some((e) => entry.name.endsWith(e))) continue;
      const r = rel(full);
      if (exRes.some((re) => re.test(r))) continue;
      out.push(r);
    }
  };
  walk(PRESENTATION);
  return out;
}

function scanLines(files, pattern) {
  let re;
  try {
    re = new RegExp(pattern);
  } catch (e) {
    throw new Error(`некорректный регексп "${pattern}": ${e.message}`);
  }
  const hits = [];
  for (const file of files) {
    const lines = readText(path.join(ROOT, file)).split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const m = re.exec(lines[i]);
      if (!m) continue;
      hits.push({
        file,
        line: i + 1,
        text: lines[i].trim().slice(0, 160),
        // Значение для режимов distinct/modulo берётся из ИМЕНОВАННОЙ группы
        // `(?<value>…)`: индекс группы в регекспе ломается от любой правки
        // паттерна (например, скобки вокруг `padding|margin|gap`), а имя — нет.
        group: m.groups && 'value' in m.groups ? m.groups.value : m[m.length - 1] ?? null,
      });
    }
  }
  return hits;
}

/* ═══════════════════════════════════════════════════════ проверки */

const clip = (s, n = 220) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function sample(hits, limit = 20) {
  const head = hits.slice(0, limit).map((h) => ({
    ...h,
    // Строка отчёта — «где именно»: JSON-источники несут имя экрана/узла в
    // самом тексте, поэтому `line: 0` не печатается вовсе.
    text: h.line ? `${h.file}:${h.line}: ${h.text}` : h.text,
    file: '',
    line: 0,
  }));
  if (hits.length > limit) {
    head.push({ file: '', line: 0, text: `…и ещё ${hits.length - limit}` });
  }
  return head;
}

/** playwright: нарушения пробы spec 075 по виду `check`. */
function runPlaywright(criterion, probe) {
  if (!probe.ok) return { status: 'unknown', reason: probe.reason };

  if (criterion.probe && criterion.probe['check-kind']) {
    const kind = String(criterion.probe['check-kind']);
    const found = [];
    for (const screen of probe.json.screens) {
      for (const v of screen.violations || []) {
        if (v.check !== kind) continue;
        found.push({
          file: rel(PROBE_JSON),
          line: 0,
          text: `${v.screen} / ${v.viewport}: ${v.detail}${v.testid ? ` [${v.testid}]` : ''}`,
        });
      }
    }
    const combos = probe.json.screens.length;
    if (found.length === 0) {
      return {
        status: 'pass',
        reason: `проба: 0 нарушений «${kind}» на ${combos} комбинациях`,
        lines: [],
        count: 0,
      };
    }
    return {
      status: 'fail',
      reason: `проба: ${found.length} нарушений «${kind}» на ${combos} комбинациях`,
      lines: sample(found),
      count: found.length,
    };
  }

  // Fallback: поле самой пробы (rootOverflowX и т.п.).
  const field = criterion.probe && criterion.probe.field;
  if (!field) return { status: 'unknown', reason: 'в критерии нет probe.check-kind/probe.field' };
  const bad = probe.json.screens.filter((s) => Number(s[field]) > 1);
  if (bad.length === 0) {
    return { status: 'pass', reason: `проба: ${field} <= 1 во всех комбинациях`, lines: [], count: 0 };
  }
  return {
    status: 'fail',
    reason: `проба: ${field} > 1 в ${bad.length} комбинациях`,
    lines: sample(
      bad.map((s) => ({ file: rel(PROBE_JSON), line: 0, text: `${s.screen} / ${s.viewport}: ${field}=${s[field]}` })),
    ),
    count: bad.length,
  };
}

/**
 * Крупный ли текст по axe-сводке.
 *
 * axe печатает `font size: 7.5pt (10px), font weight: normal`. Порог WCAG 2.2
 * AA 1.4.3: крупный — от 14pt (≈18.66px) bold или от 18pt (24px) обычный.
 * Если размер в сводке не назван — считаем текст обычным (строгий порог):
 * «не смогли прочитать» не должно превращаться в «прошло по мягкому порогу».
 */
function isLargeText(summary) {
  const m = /font size:\s*([\d.]+)pt/i.exec(summary);
  if (!m) return false;
  const pt = Number(m[1]);
  if (!Number.isFinite(pt)) return false;
  const bold = /font weight:\s*(bold|[6-9]00)/i.test(summary);
  return bold ? pt >= 14 : pt >= 18;
}

/**
 * axe: нарушения правила на экранах, подходящих под screen-match.
 * Детали берутся из `violations[].nodes[].failureSummary` (spec 077).
 */
function runAxe(criterion, axe) {
  if (!axe.ok) return { status: 'unknown', reason: axe.reason };
  const cfg = criterion.axe || {};
  if (!cfg.rule) return { status: 'unknown', reason: 'в критерии нет axe.rule' };
  const screenRe = cfg['screen-match'] ? new RegExp(String(cfg['screen-match'])) : null;

  const hits = [];
  let screened = 0;
  let nodesTotal = 0;
  let nodesInScope = 0;
  let largeTextInScope = 0;

  for (const [name, screen] of Object.entries(axe.json.screens)) {
    if (screenRe && !screenRe.test(name)) continue;
    screened += 1;
    for (const v of screen.violations || []) {
      if (v.id !== cfg.rule) continue;
      for (const node of v.nodes || []) {
        nodesTotal += 1;
        const summary = String(node.failureSummary || node.summary || '');
        const isLarge = isLargeText(summary);
        if (cfg['large-text'] === true && !isLarge) continue;
        if (cfg['large-text'] === false && isLarge) continue;
        if (cfg['large-text'] === true) largeTextInScope += 1;
        nodesInScope += 1;
        hits.push({
          file: rel(A11Y_JSON),
          line: 0,
          text: `${rel(A11Y_JSON)} · ${name} · ${node.target || '?'} — ${clip(summary)}`,
        });
      }
    }
  }

  if (screened === 0) {
    return { status: 'unknown', reason: `axe: ни один экран не подошёл под ${cfg['screen-match']}` };
  }
  if (nodesTotal === 0) {
    return {
      status: 'pass',
      reason: `axe: правило «${cfg.rule}» не нарушено на ${screened} экранах (0 nodes)`,
      lines: [],
      count: 0,
    };
  }
  if (hits.length === 0) {
    // Нарушения есть, но все — у крупного текста: для AA 1.4.3 это отдельный порог.
    return {
      status: 'pass',
      reason: `axe: «${cfg.rule}» — 0 nodes крупного текста из ${nodesTotal} на ${screened} экранах (нарушения только у обычного текста, порог 4.5:1 — см. COLOR-001)`,
      lines: [],
      count: 0,
    };
  }
  return {
    status: 'fail',
    reason: `axe: «${cfg.rule}» — ${hits.length} nodes на ${screened} экранах${cfg['large-text'] ? ' (крупный текст)' : ''}`,
    lines: sample(hits),
    count: hits.length,
  };
}

/** Окно вокруг строки совпадения: для критериев вида «X рядом с Y». */
function linesAround(file, lineNo, radius) {
  const lines = readText(path.join(ROOT, file)).split('\n');
  const from = Math.max(0, lineNo - 1 - radius);
  const to = Math.min(lines.length, lineNo + radius);
  return lines.slice(from, to).join('\n');
}

/** grep: 0 → pass, 1..20 → fail (все), >20 → fail (первые 20 + «…и ещё N»). */
function runGrep(criterion) {
  const cfg = criterion.grep || {};
  if (!cfg.pattern) return { status: 'unknown', reason: 'в критерии нет grep.pattern' };
  const files = collectSources(cfg.include, cfg.exclude);
  if (files.length === 0) {
    return { status: 'unknown', reason: `нет файлов для скана (${(cfg.include || []).join(', ') || 'по умолчанию'})` };
  }
  const hits = scanLines(files, String(cfg.pattern));
  const mode = cfg.mode ? String(cfg.mode) : 'plain';
  if (!MODES.has(mode)) return { status: 'unknown', reason: `неизвестный grep.mode "${mode}"` };
  const where = `${files.length} файлов`;

  if (mode === 'distinct') {
    const values = [...new Set(hits.map((h) => h.group).filter((g) => g !== null))];
    const max = Number(cfg['max-distinct']);
    const bad = values.filter((v) => Number(v) > 0).length > max;
    return {
      status: bad ? 'fail' : 'pass',
      reason: `grep distinct: ${values.length} уникальных значений (лимит ${max}) в ${where}`,
      lines: values.slice(0, 20).map((v) => ({
        file: '',
        line: 0,
        text: `${rel(CHECKLIST)}: значение ${v}`,
      })),
      count: values.length,
    };
  }

  if (mode === 'modulo') {
    const mod = Number(cfg.modulo);
    const bad = hits.filter((h) => h.group !== null && Number(h.group) % mod !== 0);
    return {
      status: bad.length ? 'fail' : 'pass',
      reason: `grep modulo ${mod}: ${bad.length} значений не кратны (всего значений ${hits.length}, ${where})`,
      lines: sample(bad),
      count: bad.length,
    };
  }

  // near — «X только вместе с Y»: критерий проверяет пару свойств в одном
  // блоке стилей. radius задан в строках: JSX-инлайн-стиль компактнее CSS,
  // и 5 строк хватает, чтобы накрыть один объект `style={{ … }}`.
  if (mode === 'near') {
    if (!cfg.near) return { status: 'unknown', reason: 'нет grep.near' };
    const radius = Number.isFinite(Number(cfg.radius)) ? Number(cfg.radius) : 5;
    const nearRe = new RegExp(String(cfg.near));
    const violations = hits.filter((h) => !nearRe.test(linesAround(h.file, h.line, radius)));
    const all = cfg.require === 'all';
    if (all) {
      const withNear = hits.filter((h) => nearRe.test(linesAround(h.file, h.line, radius)));
      return withNear.length ? {
        status: violations.length ? 'fail' : 'pass',
        reason: `grep near: ${withNear.length}/${hits.length} совпадений имеют «${cfg.near}» (±${radius} строк)`,
        lines: sample(violations),
        count: violations.length,
      } : {
        status: 'fail',
        reason: `grep near: ни одно из ${hits.length} совпадений не имеет «${cfg.near}»`,
        lines: sample(hits),
        count: hits.length,
      };
    }
    return {
      status: violations.length ? 'fail' : 'pass',
      reason: `grep near: ${violations.length}/${hits.length} совпадений без «${cfg.near}» (±${radius} строк) в ${where}`,
      lines: sample(violations),
      count: violations.length,
    };
  }

  const expect = cfg.expect === 'match';
  if (expect) {
    return {
      status: hits.length ? 'pass' : 'fail',
      reason: `grep: ${hits.length} совпадений (ожидалось > 0) в ${where}`,
      lines: hits.length ? sample(hits) : [],
      count: hits.length,
    };
  }  return {
    status: hits.length ? 'fail' : 'pass',
    reason: `grep: ${hits.length} совпадений (ожидалось 0) в ${where}`,
    lines: sample(hits),
    count: hits.length,
  };
}

function evaluate(criterion, sources) {
  const check = String(criterion.check || '');
  if (!CHECKS.has(check)) {
    return { status: 'unknown', reason: `неизвестный check "${check}"` };
  }
  if (check === 'playwright') return runPlaywright(criterion, sources.probe);
  if (check === 'axe') return runAxe(criterion, sources.axe);
  if (check === 'grep') return runGrep(criterion);
  return {
    status: 'manual',
    reason:
      check === 'vision'
        ? 'визуальный аудит: PNG читает агент (npm run audit:screens)'
        : 'ручная проверка: агент фиксирует наблюдение',
  };
}

/* ═══════════════════════════════════════════════════════ отчёт */

function buildReport(date, results, meta) {
  const buckets = { pass: [], fail: [], unknown: [], manual: [] };
  for (const r of results) buckets[r.criterion.status].push(r);

  const out = [];
  out.push(`# UI/UX checklist — отчёт прогона ${date}`);
  out.push('');
  out.push('Сгенерировано `npm run check` (`.project/scripts/check.mjs`, spec 077).');
  out.push(`Источник критериев: \`.project/checklists/ui-ux.yaml\` (version ${meta.version ?? '—'}, обновлён ${meta.updated ?? '—'}).`);
  out.push('');
  out.push(
    `**Summary: ${buckets.pass.length} pass / ${buckets.fail.length} fail / ${buckets.unknown.length} unknown / ${buckets.manual.length} manual** (всего ${results.length})`,
  );
  out.push('');
  out.push('| статус | критичных | всего |');
  out.push('|---|---|---|');
  for (const s of ['pass', 'fail', 'unknown', 'manual']) {
    const crit = buckets[s].filter((r) => CRITICAL.has(r.criterion.id)).length;
    out.push(`| ${s} | ${crit} | ${buckets[s].length} |`);
  }
  out.push('');

  out.push('## Сводка по критериям');
  out.push('');
  out.push('| id | title | check | status | почему |');
  out.push('|---|---|---|---|---|');
  for (const r of results) {
    out.push(
      `| ${r.criterion.id} | ${r.criterion.title} | ${r.criterion.check} | ${r.criterion.status} | ${clip(r.reason, 160)} |`,
    );
  }
  out.push('');

  out.push('## Fail');
  out.push('');
  if (buckets.fail.length === 0) {
    out.push('Нет fail: машинные критерии чистые.');
    out.push('');
  } else {
    for (const r of buckets.fail) {
      const mark = CRITICAL.has(r.criterion.id) ? ' **[critical/high]**' : '';
      out.push(`### ${r.criterion.id} — ${r.criterion.title}${mark}`);
      out.push('');
      out.push(`- порог: \`${r.criterion.threshold}\``);
      out.push(`- источник: ${r.criterion.source}`);
      out.push(`- найдено: ${r.reason}`);
      if (r.lines && r.lines.length) {
        out.push('');
        out.push('```');
        for (const l of r.lines) out.push(l.line ? `${l.file}:${l.line}: ${l.text}` : `${l.file}: ${l.text}`);
        out.push('```');
      }
      out.push('');
    }
  }

  out.push('## Unknown (источник не найден — не «чисто», а «не проверено»)');
  out.push('');
  if (buckets.unknown.length === 0) {
    out.push('Нет unknown.');
  } else {
    for (const r of buckets.unknown) out.push(`- ${r.criterion.id} — ${r.criterion.title}: ${r.reason}`);
  }
  out.push('');

  out.push('## Manual / vision (проверяет агент)');
  out.push('');
  if (buckets.manual.length === 0) {
    out.push('Нет ручных критериев.');
  } else {
    for (const r of buckets.manual) out.push(`- ${r.criterion.id} — ${r.criterion.title}: ${r.reason}`);
  }
  out.push('');
  out.push('Визуальный аудит 19 baseline PNG: `npm run audit:screens` →');
  out.push('`.project/drafts/visual-audit-<дата>.md` (PNG читает агент, у него есть зрение).');
  out.push('');
  return out.join('\n');
}

/* ═══════════════════════════════════════════════════════ self-test */

/**
 * `--self-test` — не валидация приложения, а проверка самого чек-листа и
 * регекспов: ловит опечатку в YAML до того, как она станет «критерий всегда
 * unknown». Exit 0 — структура и фабрики валидны, 1 — нет.
 *
 * Числа ниже — КОНТРАКТ состава чек-листа, а не «настройка порога»: расширение
 * списка (spec 080: 30 → 60 критериев) обязано быть здесь отражено, иначе
 * self-test честно падает «критериев 60, ожидалось 30». Правка этих чисел
 * НЕ меняет смысл ни одного критерия — в отличие от правки логики проверок.
 */
function selfTest(criteria) {
  const problems = [];
  // spec 080: A. LAYOUT (12 позиций состава: LAYOUT-001..008 · TYPO-001..003 ·
  // SPACE-002/003 · новые TYPO-006 и SPACE-005) · B. COLOR (7) ·
  // C. USABILITY (12, Нильсен) · D. COPY (8) · E. MARKETING (6) · F. TMA (5).
  // Категории-носители: LAYOUT 8, TYPO 6, SPACE 5, STATE 4. Итого 61.
  const cats = {
    LAYOUT: 8, COLOR: 7, USABILITY: 12, COPY: 8, MARKETING: 6, TMA: 5,
    TYPO: 6, SPACE: 5, STATE: 4,
  };
  const expected = Object.entries(cats).reduce((s, [, n]) => s + n, 0);

  if (criteria.length !== expected) {
    problems.push(`критериев ${criteria.length}, ожидалось ${expected}`);
  }
  const ids = new Set();
  for (const c of criteria) {
    if (!c.id) problems.push('критерий без id');
    else if (ids.has(c.id)) problems.push(`дубль id ${c.id}`);
    else ids.add(c.id);
    for (const f of ['title', 'check', 'threshold', 'status', 'source']) {
      if (!c[f]) problems.push(`${c.id}: не заполнено поле ${f}`);
    }
    if (c.check && !CHECKS.has(String(c.check))) problems.push(`${c.id}: неизвестный check ${c.check}`);
    if (c.status && !STATUSES.has(String(c.status))) problems.push(`${c.id}: неизвестный status ${c.status}`);
    if (c.grep && c.grep.pattern) {
      try {
        new RegExp(String(c.grep.pattern));
      } catch (e) {
        problems.push(`${c.id}: регексп не компилируется (${e.message})`);
      }
    }
  }
  for (const [cat, n] of Object.entries(cats)) {
    const got = criteria.filter((c) => String(c.id).startsWith(`${cat}-`)).length;
    if (got !== n) problems.push(`${cat}: ${got} критериев, ожидалось ${n}`);
  }

  if (problems.length === 0) {
    console.log(`check --self-test: OK — ${criteria.length} критериев, структура и регекспы валидны`);
    return 0;
  }
  console.error(`check --self-test: ${problems.length} проблем`);
  for (const p of problems) console.error(`  - ${p}`);
  return 1;
}

/* ═══════════════════════════════════════════════════════ main */

function main() {
  if (!exists(CHECKLIST)) {
    console.error(`check: нет чек-листа ${rel(CHECKLIST)}`);
    process.exit(2);
  }
  const yamlText = readText(CHECKLIST);
  const { meta, criteria } = parseChecklist(yamlText);

  if (SELF_TEST) process.exit(selfTest(criteria));

  if (criteria.length === 0) {
    console.error('check: в чек-листе нет ни одного критерия');
    process.exit(2);
  }

  const sources = { probe: loadProbe(), axe: loadAxe() };
  const results = criteria.map((c) => ({ criterion: c, ...evaluate(c, sources) }));

  // Статус в YAML пишет прогон: ручные и vision-критерии остаются manual.
  const statuses = new Map();
  for (const r of results) {
    r.criterion.status = r.status;
    statuses.set(String(r.criterion.id), r.status);
  }
  const rewritten = rewriteStatuses(yamlText, statuses);
  writeAtomic(CHECKLIST, rewritten.text);

  const date = reportDate();
  const reportPath = path.join(DRAFTS, `checklist-report-${date}.md`);
  if (!exists(DRAFTS)) fs.mkdirSync(DRAFTS, { recursive: true });
  writeAtomic(reportPath, buildReport(date, results, meta));

  const buckets = { pass: 0, fail: 0, unknown: 0, manual: 0 };
  for (const r of results) buckets[r.status] += 1;

  console.log(`check: ${buckets.pass} pass / ${buckets.fail} fail / ${buckets.unknown} unknown / ${buckets.manual} manual`);
  console.log(`check: status обновлён в ${rel(CHECKLIST)} (изменено ${rewritten.changed})`);
  console.log(`check: отчёт ${rel(reportPath)}`);
  if (!sources.probe.ok) console.log(`check: WARN источник пробы — ${sources.probe.reason}`);
  if (!sources.axe.ok) console.log(`check: WARN источник axe — ${sources.axe.reason}`);

  for (const r of results.filter((x) => x.status === 'fail')) {
    console.log(`check: FAIL ${r.criterion.id} — ${r.criterion.title}: ${r.reason}`);
    for (const l of (r.lines || []).slice(0, 20)) {
      console.log(`  ${l.line ? `${l.file}:${l.line}: ${l.text}` : `${l.file}: ${l.text}`}`);
    }
  }

  const criticalFail = results.filter((r) => r.status === 'fail' && CRITICAL.has(String(r.criterion.id)));
  const criticalUnknown = results.filter((r) => r.status === 'unknown' && CRITICAL.has(String(r.criterion.id)));
  for (const r of criticalUnknown) {
    console.log(`check: NOTE критичный критерий ${r.criterion.id} не проверен — ${r.reason}`);
  }
  if (criticalFail.length > 0) {
    console.log(`check: exit 1 — fail critical/high: ${criticalFail.map((r) => r.criterion.id).join(', ')}`);
    process.exit(1);
  }
  console.log('check: exit 0 — fail critical/high нет');
  process.exit(0);
}

main();
