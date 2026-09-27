'use strict';
/**
 * Интеграция батчей 5–7 (17 принятых вопросов) в банк.
 *
 * ПОЧЕМУ ВСТАВКА ТЕКСТОМ, А НЕ JSON.parse → JSON.stringify:
 * пересборка файла переформатировала бы все существующие вопросы (отступы,
 * порядок ключей, экранирование), и диф стал бы нечитаемым — как в batch 4
 * (`.project/drafts/m2.9-batch4-integrate.mjs`, «Textual insertion only»).
 * Здесь существующие байты не трогаются: в конец массива дописываются только новые.
 *
 * Использование:
 *   node .project/drafts/m2.9-batch5-7-integrate.cjs [--dry-run]
 *
 * Отказывается работать, если банк не 189 (защита от двойного применения).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'C:/Users/Alexey Udotov/LinuxExam';
const BANK_DIR = path.join(ROOT, 'src', 'data', 'questions');
const ORDER_FILE = path.join(BANK_DIR, '_order.json');
const TEMP = process.env.TEMP;

const BANK_BEFORE = 189;
/** lsl_013 исключён: дистрактор `lvremove -y lv_temp` даёт второй верный ответ. */
const REJECTED = 'lsl_013';

const PLAN = [
  { topic: 'local_storage', file: 'linuxexam-batch5-local_storage.json' },
  { topic: 'manage_software', file: 'linuxexam-batch6-manage_software.json' },
  { topic: 'networking', file: 'linuxexam-batch7-networking.json' },
];

const dryRun = process.argv.includes('--dry-run');

/* ---------------------------------------------------------------- guards */
const topicFiles = fs
  .readdirSync(BANK_DIR)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .sort();

let bankBefore = 0;
const existingIds = new Set();
for (const f of topicFiles) {
  for (const q of JSON.parse(fs.readFileSync(path.join(BANK_DIR, f), 'utf8'))) {
    bankBefore += 1;
    existingIds.add(q.id);
  }
}
if (bankBefore !== BANK_BEFORE) {
  console.error(`REFUSING: банк ${bankBefore}, ожидалось ${BANK_BEFORE}. Интеграция уже применена или банк уехал.`);
  process.exit(3);
}

/* --------------------------------------------------- собрать принятых */
const accepted = [];
for (const p of PLAN) {
  const all = JSON.parse(fs.readFileSync(path.join(TEMP, p.file), 'utf8'));
  const kept = all.filter((q) => q.id !== REJECTED);
  for (const q of kept) {
    if (q.topic !== p.topic) {
      console.error(`REFUSING: ${q.id} имеет topic ${q.topic}, ожидался ${p.topic}`);
      process.exit(3);
    }
    if (existingIds.has(q.id)) {
      console.error(`REFUSING: id ${q.id} уже существует в банке`);
      process.exit(3);
    }
  }
  accepted.push({ topic: p.topic, questions: kept });
}

const totalNew = accepted.reduce((s, a) => s + a.questions.length, 0);
console.log(`Принято к интеграции: ${totalNew} (исключён: ${REJECTED})`);
for (const a of accepted) console.log(`  ${a.topic}: +${a.questions.length}`);
console.log(`Банк: ${BANK_BEFORE} -> ${BANK_BEFORE + totalNew}`);
if (dryRun) {
  console.log('DRY RUN — файлы не изменяются.');
  process.exit(0);
}

/* ----------------------------------------------------- вставка в файлы тем */
const KEY_ORDER = ['id', 'topic', 'difficulty', 'objective_domain', 'subtopic', 'question', 'options', 'explanation'];

/**
 * Сериализация одного вопроса в стиле банка: 2 пробела на уровень,
 * options — объекты { text, correct }, порядок ключей как в KEY_ORDER.
 */
function renderQuestion(q) {
  const lines = [];
  lines.push('  {');
  for (const k of KEY_ORDER) {
    if (k === 'options') {
      lines.push('    "options": [');
      q.options.forEach((o, i) => {
        lines.push('      {');
        lines.push(`        "text": ${JSON.stringify(o.text)},`);
        lines.push(`        "correct": ${o.correct === true}`);
        lines.push(`      }${i === q.options.length - 1 ? '' : ','}`);
      });
      lines.push('    ],');
    } else {
      const comma = k === 'explanation' ? '' : ',';
      lines.push(`    "${k}": ${JSON.stringify(q[k])}${comma}`);
    }
  }
  lines.push('  }');
  return lines.join('\n');
}

for (const a of accepted) {
  const target = path.join(BANK_DIR, `${a.topic}.json`);
  const text = fs.readFileSync(target, 'utf8');
  const before = JSON.parse(text).length;

  const trimmed = text.replace(/\r\n/g, '\n');
  const endIdx = trimmed.lastIndexOf(']');
  if (endIdx < 0) {
    console.error(`REFUSING: в ${a.topic}.json нет закрывающей ]`);
    process.exit(4);
  }
  const head = trimmed.slice(0, endIdx).replace(/\s+$/, '');
  const tail = trimmed.slice(endIdx + 1);

  // head заканчивается на "}" (последний объект) или на "[" (пустой массив)
  const sep = head.endsWith('[') ? '\n' : ',\n';
  const body = head + sep + a.questions.map(renderQuestion).join(',\n') + '\n]' + (tail.startsWith('\n') ? tail : '\n' + tail.replace(/^\s*/, ''));

  const after = JSON.parse(body).length;
  if (after !== before + a.questions.length) {
    console.error(`REFUSING: ${a.topic}.json дал ${after} вопросов, ожидалось ${before + a.questions.length}`);
    process.exit(4);
  }
  fs.writeFileSync(target, body.endsWith('\n') ? body : body + '\n', 'utf8');
  console.log(`  ${a.topic}.json: ${before} -> ${after}`);
}

/* ------------------------------------------------------------- _order.json */
const orderRaw = fs.readFileSync(ORDER_FILE, 'utf8');
const order = JSON.parse(orderRaw);
if (order.length !== BANK_BEFORE) {
  console.error(`REFUSING: _order.json = ${order.length}, ожидалось ${BANK_BEFORE}`);
  process.exit(5);
}
const newIds = accepted.flatMap((a) => a.questions.map((q) => q.id));
for (const id of newIds) {
  if (order.includes(id)) {
    console.error(`REFUSING: ${id} уже в _order.json`);
    process.exit(5);
  }
}
const nextOrder = [...order, ...newIds];
/* ТОЛЬКО ДОБАВЛЕНИЕ В КОНЕЦ — существующий порядок не трогается.
 *
 * Почему НЕ пересортировка: `_order.json` задаёт последовательность regular-квиза,
 * а `currentIndex` хранится в persist у пользователей. Файл исторически НЕ отсортирован
 * канонически (проверено: все 189 позиций отличаются от префикс/номер-сортировки),
 * поэтому любая «нормализация» сдвинула бы все существующие вопросы и сломала бы
 * прогресс у тех, кто уже проходит квиз. Проверено до записи — см. ниже. */
const orderCmp = (x, y) => {
  const [xa, xn] = [x.slice(0, x.lastIndexOf('_')), Number(x.slice(x.lastIndexOf('_') + 1))];
  const [ya, yn] = [y.slice(0, y.lastIndexOf('_')), Number(y.slice(y.lastIndexOf('_') + 1))];
  return xa === ya ? xn - yn : (xa < ya ? -1 : 1);
};
const resorted = [...order].sort(orderCmp);
const wasCanonical = resorted.every((v, i) => v === order[i]);
console.log(`  порядок существующих id сохранён как есть (файл канонически отсортирован: ${wasCanonical};`);
console.log('  пересортировка сдвинула бы все существующие вопросы и сломала бы persist currentIndex)');
fs.writeFileSync(ORDER_FILE, JSON.stringify(nextOrder, null, 2) + '\n', 'utf8');
console.log(`  _order.json: ${order.length} -> ${nextOrder.length}`);
console.log('OK');
