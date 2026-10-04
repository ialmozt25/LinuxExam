#!/usr/bin/env node
/**
 * .project/drafts/_insert-criteria.mjs — вставка фрагмента `_new-criteria.yaml`
 * в боевой `.project/checklists/ui-ux.yaml` (spec 080).
 *
 * Вставка идемпотентная: блока, которого в чек-листе ещё нет, дописывается в
 * конец, кроме `USABILITY-emptystates` — его место в разделе C (USABILITY),
 * поэтому он встаёт перед началом раздела D (`COPY-004`). Существующие записи
 * не переписываются ни на байт.
 *
 * Реализация: разбор через ЗАГЛЯДЫВАЮЩИЙ сплит по заголовкам записей —
 * сравнение «номер текущего блока меньше номера следующего» устойчиво к
 * свёрнутому пробелу на границе блоков, из-за которого `slice` по индексу
 * съедал соседнюю запись.
 */
import fs from 'node:fs';

const Y = '.project/checklists/ui-ux.yaml';
const FRAG = '.project/drafts/_new-criteria.yaml';

let out = fs.readFileSync(Y, 'utf8');
const frag = fs.readFileSync(FRAG, 'utf8');

const heads = [...frag.matchAll(/^ {2}- id: (\S+)$/gm)];
const blocks = [];
for (let k = 0; k < heads.length; k += 1) {
  const from = heads[k].index;
  const to = k + 1 < heads.length ? heads[k + 1].index + 1 : frag.length;
  blocks.push({ id: heads[k][1], text: frag.slice(from, to).replace(/\s*$/, '') });
}

const missing = blocks.filter((b) => !new RegExp(`^ {2}- id: ${b.id}$`, 'm').test(out));

// Два прохода: сначала дописываем хвост (там появляется якорь COPY-004), потом
// ставим USABILITY-emptystates в его раздел C. Одним проходом не получилось бы:
// на момент обработки emptystates якорь ещё не дописан.
const inserted = new Set();
const tail = missing.filter((b) => b.id !== 'USABILITY-emptystates').map((b) => {
  inserted.add(b.id);
  return b.text;
});
if (tail.length) out = `${out.replace(/\s*$/, '')}\n\n${tail.join('\n\n')}\n`;

const empty = missing.find((b) => b.id === 'USABILITY-emptystates');
if (empty) {
  const target = '  - id: COPY-004';
  if (!out.includes(target)) throw new Error(`нет якоря «${target}» для ${empty.id}`);
  out = out.replace(target, `${empty.text}\n\n${target}`);
  inserted.add(empty.id);
}

fs.writeFileSync(Y, out, 'utf8');

const ids = [...out.matchAll(/^ {2}- id: (\S+)$/gm)].map((m) => m[1]);
if (ids.length !== 30 + missing.length) {
  throw new Error(`вставлено ${ids.length}, ожидалось ${30 + missing.length}`);
}
for (const b of blocks) {
  if (!ids.includes(b.id)) throw new Error(`блок ${b.id} потерян при вставке`);
}
const cat = {};
for (const i of ids) {
  const k = i.split('-')[0];
  cat[k] = (cat[k] ?? 0) + 1;
}
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log('inserted:', missing.length);
console.log('criteria:', ids.length, cat);
console.log('duplicates:', dup.length ? dup.join(', ') : 'none');
