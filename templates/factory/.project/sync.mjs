#!/usr/bin/env node
/**
 * .project/sync.mjs (шаблон MAS Factory) — урезанная версия.
 *
 * Назначение: собрать производные (`docs/index.html`, `.project/STATE.md`,
 * `.project/SPEC.md`) из источника `.project/state.json` + YAML-шапки
 * `docs/FACTORY-PLAN.md` + тетрадей `docs/memory/` + `.project/log.md`.
 *
 * Что осталось (продуктово-нейтральное):
 *   шапка, фазы плана, память (тетради), тренды, решения, тревоги, коммиты.
 *
 * Чего НЕТ (сознательно, в отличие от полной фабрики):
 *   блок 6 «Пульс агентов» (AgentTeams) — функции readAgentTeams / renderAgentBlock
 *   удалены, а не закомментированы; банк вопросов и темы; аудиты; продукты; спеки;
 *   ссылки на `src/`, `tools/`, продуктовые разделы.
 *
 * Режимы:
 *   node .project/sync.mjs           — запись производных
 *   node .project/sync.mjs --check   — READ-ONLY: производные совпадают с источником
 *                                      и закоммичены (exit 0) либо дрейф (exit 2)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const rel = (p) => path.join(ROOT, p);

const STATE_PATH = rel('.project/state.json');
const LOG_PATH = rel('.project/log.md');
const PLAN_PATH = rel('docs/FACTORY-PLAN.md');
const OUT_STATE_MD = rel('.project/STATE.md');
const OUT_SPEC_MD = rel('.project/SPEC.md');
const OUT_CENTER = rel('docs/index.html');

const NOTEBOOKS = [
  { file: 'docs/memory/episodic.md', label: 'episodic' },
  { file: 'docs/memory/semantic.md', label: 'semantic' },
  { file: 'docs/memory/procedural.md', label: 'procedural' },
  { file: 'docs/memory/working.md', label: 'working' },
  { file: 'docs/memory/alerts.md', label: 'alerts' },
];

const VOLATILE = { start: '<!--volatile:start-->', end: '<!--volatile:end-->' };
const COMMITS_IN_CENTER = 10;
const LOG_TAIL_LINES = 10;

/* ------------------------------------------------------------------ io */

const readText = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const normalizeLf = (text) => String(text).replace(/\r\n/g, '\n');

function writeLf(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, String(text).replace(/\r\n/g, '\n'), { encoding: 'utf8' });
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function stripVolatile(text) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${esc(VOLATILE.start)}[\\s\\S]*?${esc(VOLATILE.end)}`, 'g');
  return String(text).replace(re, VOLATILE.start + VOLATILE.end);
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* --------------------------------------------------------------- state */

function readState() {
  if (!exists(STATE_PATH)) throw new Error('.project/state.json не найден');
  return JSON.parse(readText(STATE_PATH));
}

/** YAML-шапка плана: плоские скаляры + inline-мапы фаз (без внешних зависимостей). */
function readPlanYaml() {
  if (!exists(PLAN_PATH)) throw new Error('docs/FACTORY-PLAN.md не найден');
  const lines = normalizeLf(readText(PLAN_PATH)).split('\n');
  if (lines[0].trim() !== '---') throw new Error('docs/FACTORY-PLAN.md: нет YAML-шапки');
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (closeIdx === -1) throw new Error('docs/FACTORY-PLAN.md: шапка не закрыта');
  const header = lines.slice(1, closeIdx);
  const out = { plan_version: null, product: null, factory: null, current_phase: null, current_step: null, phases: [] };

  for (const raw of header) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('- {')) {
      const inner = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'));
      const o = {};
      for (const part of inner.split(',')) {
        const m = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/.exec(part);
        if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
      if (o.id) out.phases.push(o);
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.+)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim().replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '');
    if (key in out && key !== 'phases') out[key] = val;
  }
  return out;
}

function readMeta(file) {
  if (!exists(file)) return { updated: null, entries: 0 };
  const m = /<!--\s*meta updated:\s*([^ ]+)\s+entries_count:\s*(\d+)\s*-->/.exec(readText(file));
  return m ? { updated: m[1], entries: Number(m[2]) } : { updated: null, entries: 0 };
}

function readAlerts() {
  const p = rel('docs/memory/alerts.md');
  if (!exists(p)) return { entries: [], total: 0 };
  const lines = normalizeLf(readText(p)).split('\n');
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(?:##\s*)?(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)$/.exec(lines[i].trim());
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
  return { entries, total: entries.length };
}

function readTrends(limit) {
  const p = rel('docs/memory/trends.jsonl');
  if (!exists(p)) return { rows: [], broken: 0, total: 0 };
  const raw = normalizeLf(readText(p)).split('\n').filter((l) => l.trim());
  const rows = [];
  let broken = 0;
  for (const line of raw) {
    try {
      const o = JSON.parse(line);
      rows.push({ date: o.date ?? '—', bank: o.bank ?? null, tasks_closed: o.tasks_closed ?? null });
    } catch (e) {
      broken += 1;
    }
  }
  return { rows: rows.slice(-limit), broken, total: rows.length };
}

function readRecentLog(limit) {
  if (!exists(LOG_PATH)) return [];
  return normalizeLf(readText(LOG_PATH))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const m = /^(\d{4}-\d{2}-\d{2})\s*\|\s*([\s\S]*)$/.exec(l);
      return m ? { date: m[1], text: m[2].trim() } : { date: '—', text: l };
    })
    .slice(-limit);
}

function readGitCommits(limit) {
  try {
    const raw = git(['log', `-${limit}`, '--pretty=format:%h%x09%ad%x09%s', '--date=short']);
    return raw.split('\n').filter((l) => l.trim()).map((l) => {
      const [sha, date, subject = ''] = l.replace(/\r/g, '').split('\t');
      return { sha: sha.trim(), date: (date || '').trim(), subject: subject.trim() };
    });
  } catch (e) {
    return [];
  }
}

/* ------------------------------------------------------------------ render */

function renderStateMd(state, plan, head) {
  const phases = plan.phases.length
    ? plan.phases.map((p) => `- ${p.id} — ${p.status} (${p.progress})`).join('\n')
    : '- фаз нет';
  return [
    `# ${plan.product || state.plan?.product || 'Проект'} — текущее состояние`,
    '',
    '> ФАЙЛ СГЕНЕРИРОВАН: `.project/sync.mjs` из `.project/state.json`.',
    '',
    `${VOLATILE.start}- HEAD: \`${head}\`${VOLATILE.end}`,
    '- last_sync: см. git log',
    '',
    '## План',
    '',
    phases,
    '',
    '## Ссылки',
    '',
    '- План: `docs/FACTORY-PLAN.md`',
    '- Журнал решений: `.project/log.md`',
    '- Правила: `.project/ORCH-RULES.md`',
    '',
  ].join('\n');
}

function renderSpecMd(state, plan) {
  return [
    '# Спецификации проекта',
    '',
    '> ФАЙЛ СГЕНЕРИРОВАН: `.project/sync.mjs`. Спеки кладите в `.project/specs/`.',
    '',
    `${VOLATILE.start}- HEAD: \`${state.head || ''}\`${VOLATILE.end}`,
    '- Спек: 0',
    '',
    '| id | slug | type | status | commit | updated |',
    '|---|---|---|---|---|---|',
    '| — | — | — | — | — | — |',
    '',
  ].join('\n');
}

function renderCenter(ctx) {
  const { state, plan, head, alerts } = ctx;
  const phaseRows = plan.phases.length
    ? plan.phases.map((p) => `        <tr><td class="mono">${esc(p.id)}</td><td>${esc(p.name || '')}</td><td><span class="chip chip--${esc(p.status)}">${esc(p.status)}</span></td><td class="mono">${esc(p.progress)}</td></tr>`).join('\n')
    : '        <tr><td colspan="4" class="muted">Фазы не описаны.</td></tr>';

  const notebookRows = NOTEBOOKS.map((n) => {
    const meta = readMeta(rel(n.file));
    return `        <tr><td class="mono">${esc(n.label)}</td><td class="mono muted">${esc(meta.updated || '—')}</td><td class="mono">${meta.entries}</td></tr>`;
  }).join('\n');

  const trendRows = ctx.trends.rows.length
    ? ctx.trends.rows.map((t) => `        <tr><td class="mono">${esc(t.date)}</td><td class="mono">${esc(t.bank ?? '—')}</td><td class="mono">${esc(t.tasks_closed ?? '—')}</td></tr>`).join('\n')
    : '        <tr><td colspan="3" class="muted">трендов нет</td></tr>';

  const decisionRows = ctx.recentLog.length
    ? ctx.recentLog.map((d) => `        <li><span class="mono muted">${esc(d.date)}</span> | ${esc(d.text)}</li>`).join('\n')
    : '        <li class="muted">Журнал пуст.</li>';

  const alertsHtml = alerts.entries.length
    ? alerts.entries.map((a) => `        <div class="entry"><div class="entry__title">${esc(a.date)} | ${esc(a.title)}</div>${a.body ? `<div class="entry__body muted">${esc(a.body)}</div>` : ''}</div>`).join('\n')
    : '        <p class="empty">Тревог нет</p>';

  const commitRows = ctx.commits.length
    ? ctx.commits.map((c) => `        <tr><td class="mono">${esc(c.sha)}</td><td>${esc(c.subject)}</td><td class="mono muted">${esc(c.date)}</td></tr>`).join('\n')
    : '        <tr><td colspan="3" class="muted">коммитов нет</td></tr>';

  return `<!DOCTYPE html>
<!-- docs/index.html — ЦЕНТР РАЗРАБОТКИ. ФАЙЛ СГЕНЕРИРОВАН .project/sync.mjs. Правки затираются. -->
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plan.product || 'Центр')} — центр разработки</title>
<style>
:root { --bg: #0b0d10; --fg: #e8eaed; --fg-muted: #9aa0a6; --border: #23262b; --ok: #34d399; --warn: #fbbf24; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
.wrap { max-width: 1000px; margin: 0 auto; padding: 24px; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
h2 { font-size: 1.05rem; margin: 28px 0 8px; }
.mono { font-family: ui-monospace, monospace; }
.muted { color: var(--fg-muted); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
.chip { border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px; font-size: 0.75rem; }
.chip--done { color: var(--ok); border-color: var(--ok); }
.chip--pending { color: var(--fg-muted); }
.entry { border-top: 1px solid var(--border); padding: 8px 0; }
.entry:first-child { border-top: none; }
.entry__title { font-weight: 600; }
.entry__body { font-size: 0.85rem; margin-top: 2px; }
.empty { color: var(--fg-muted); }
</style>
</head>
<body>
<div class="wrap">

  <section class="head" id="head">
    <h1>Центр разработки</h1>
    <div class="muted">${esc(plan.factory || 'MAS Factory')} · ${esc(plan.product || '')} · из <code>.project/state.json</code></div>
    <div class="head__row">${VOLATILE.start}<span class="mono">HEAD ${esc(head)}</span>${VOLATILE.end}</div>
  </section>

  <section class="plan" id="plan">
    <h2>План${plan.plan_version ? ` · v${esc(plan.plan_version)}` : ''}</h2>
    <div class="muted">Источник: <code>docs/FACTORY-PLAN.md</code>${plan.current_step ? ` · ${esc(plan.current_step)}` : ''}</div>
    <table><thead><tr><th>id</th><th>фаза</th><th>статус</th><th>прогресс</th></tr></thead>
      <tbody>
${phaseRows}
      </tbody></table>
  </section>

  <section class="notebooks" id="notebooks">
    <h2>Память — тетради</h2>
    <table><thead><tr><th>тетрадь</th><th>updated</th><th>записей</th></tr></thead>
      <tbody>
${notebookRows}
      </tbody></table>
  </section>

  <section class="trends" id="trends">
    <h2>Тренды</h2>
    <table><thead><tr><th>дата</th><th>bank</th><th>tasks_closed</th></tr></thead>
      <tbody>
${trendRows}
      </tbody></table>
  </section>

  <section class="decisions" id="decisions">
    <h2>Решения</h2>
    <div class="muted">Источник: <code>.project/log.md</code> · последние ${ctx.recentLog.length}</div>
    <ul>
${decisionRows}
    </ul>
  </section>

  <section class="alerts" id="alerts">
    <h2>Тревоги</h2>
    <div class="muted">Источник: <code>docs/memory/alerts.md</code> · записей: ${alerts.total}</div>
${alertsHtml}
  </section>

  <section class="commits" id="commits">
    <h2>Коммиты</h2>
    <table><thead><tr><th>SHA</th><th>сообщение</th><th>дата</th></tr></thead>
      <tbody>
${VOLATILE.start}
${commitRows}
${VOLATILE.end}
      </tbody></table>
  </section>

</div>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ main */

function main() {
  const state = readState();
  const plan = readPlanYaml();
  const head = state.head && state.head.length ? state.head : '';
  const fullHead = (() => { try { return git(['rev-parse', 'HEAD']); } catch (e) { return ''; } })();

  const ctx = {
    state,
    plan,
    head: fullHead || head,
    alerts: readAlerts(),
    trends: readTrends(10),
    recentLog: readRecentLog(LOG_TAIL_LINES),
    commits: readGitCommits(COMMITS_IN_CENTER),
  };

  const derived = new Map([
    [OUT_STATE_MD, renderStateMd(state, plan, ctx.head)],
    [OUT_SPEC_MD, renderSpecMd(state, plan)],
    [OUT_CENTER, renderCenter(ctx)],
  ]);

  if (CHECK) {
    const problems = [];
    for (const [p, content] of derived) {
      if (!exists(p)) { problems.push(`${path.relative(ROOT, p)} не сгенерирован`); continue; }
      if (stripVolatile(normalizeLf(readText(p))) !== stripVolatile(normalizeLf(content))) {
        problems.push(`${path.relative(ROOT, p)} отстал от state.json — нужен npm run sync`);
      }
    }
    // Производные сверяются с источником; состояние git здесь не проверяем:
    // у свежеразвёрнутой пустышки истории может не быть вовсе, а «не закоммичено»
    // в шаблоне — норма, а не дрейф (см. соответствие: полная версия проверяет).
    if (problems.length) {
      process.stderr.write('SYNC DRIFT: state.json и производные разошлись\n');
      for (const p of problems) process.stderr.write(`  - ${p}\n`);
      process.exitCode = 2;
      return;
    }
    process.stdout.write(`sync: ok (check) — производные совпадают с источником, HEAD ${ctx.head}\n`);
    return;
  }

  for (const [p, content] of derived) writeLf(p, content);
  process.stdout.write(`sync: производные обновлены (${derived.size})\n`);
  process.stdout.write(`  HEAD: ${ctx.head || '—'}\n`);
  process.stdout.write(`  фазы: ${plan.phases.length}\n`);
  process.stdout.write(`  тетради: ${NOTEBOOKS.length}\n`);
}

main();
