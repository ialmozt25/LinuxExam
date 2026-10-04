#!/usr/bin/env node
/**
 * .project/drafts/_probe-new-criteria.mjs — сухой прогон 30 новых критериев
 * (spec 080) ДО правки `ui-ux.yaml`.
 *
 * Зачем: `npm run check` переписывает `status` в чек-листе и роняет exit-код на
 * критичных fail. Опечатка в регекспе или недостижимый режим (`mode: distinct`
 * без именованной группы `(?<value>…)`) превратились бы в «критерий всегда
 * unknown» уже после правки — то есть в тихую регрессию чек-листа. Проба гоняет
 * ровно ту же логику (собирается из `check.mjs` построчно включённым кодом, а не
 * копией) на фрагменте и печатает ожидаемый status для каждого id.
 *
 * Запуск: node .project/drafts/_probe-new-criteria.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FRAGMENT = path.join(HERE, '_new-criteria.yaml');

// check.mjs переиспользуется как библиотека: он исполняет main() на импорте,
// поэтому берём только чистые функции через динамический import() его исходника
// не получится — вместо этого повторяем вызов CLI на «призрачном» чек-листе:
// фрагмент + шапка. Так прогон идёт ровно тем же кодом, что и боевой `check`.
const CHECKLIST = path.join(ROOT, '.project', 'checklists', 'ui-ux.yaml');
const backup = `${CHECKLIST}.probe-backup`;

if (!fs.existsSync(FRAGMENT)) {
  console.error(`нет фрагмента ${path.relative(ROOT, FRAGMENT)} — сначала node .project/drafts/_expand-checklist.mjs`);
  process.exit(2);
}

const original = fs.readFileSync(CHECKLIST, 'utf8');
const fragment = fs.readFileSync(FRAGMENT, 'utf8');

// Шапка боевого чек-листа + критерии фрагмента (существующие 30 убираем, чтобы
// проба мерила только новые id и не зависела от текущих статусов).
const header = original.slice(0, original.indexOf('criteria:') + 'criteria:'.length);
fs.copyFileSync(CHECKLIST, backup);
try {
  fs.writeFileSync(CHECKLIST, `${header}\n\n${fragment}\n`, 'utf8');
  const { execFileSync } = await import('node:child_process');
  let out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, '.project', 'scripts', 'check.mjs'), '--date', '1970-01-01'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch (e) {
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  console.log(out);

  const statuses = new Map();
  for (const line of fs.readFileSync(CHECKLIST, 'utf8').split('\n')) {
    const idm = /^\s{2}- id:\s*(.+)$/.exec(line);
    if (idm) {
      statuses.set(idm[1].trim(), null);
      continue;
    }
    const stm = /^\s{4}status:\s*(.+)$/.exec(line);
    if (stm) {
      const last = [...statuses.keys()].pop();
      if (last && statuses.get(last) === null) statuses.set(last, stm[1].trim());
    }
  }
  console.log('\n=== статусы новых критериев ===');
  for (const [id, st] of statuses) console.log(`  ${id}: ${st}`);
} finally {
  fs.copyFileSync(backup, CHECKLIST);
  fs.unlinkSync(backup);
  console.log('\nchecklist restored');
}
