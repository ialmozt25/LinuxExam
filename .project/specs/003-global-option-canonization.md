---
id: 003
slug: global-option-canonization
status: draft
type: content
created: 2026-09-27
updated: 2026-09-27
commit: null
---

> **Почему здесь нет `commit_format` / `commit_regex`.** Эти поля обязательны для
> `type=content`, потому что `tools/gen-state.mjs:97-136` считает `goal.added_today`
> и `goal.avg_daily_7d`, грепая subject'ы коммитов. Эта задача **не добавляет
> вопросов**: банк остаётся 189, меняется только порядок элементов массива
> `options` внутри существующих вопросов. Коммит будет, например,
> `chore(bank): global option canonization - 189 questions, order only`, который
> намеренно **не** матчит ни `/^feat\(bank\)/i`, ни `/(\d+)\s+questions?/i`:
> метрика «добавлено сегодня» должна остаться нулевой, иначе центр соврёт о темпе.
> Поля опущены осознанно и правятся одновременно с форматом коммита, если он
> изменится.

## Цель

Одна согласованная, отревьюенная канонизация порядка опций **по всему банку**.
Сегодня банк намеренно нормализован не полностью: в M2.9 batch 4 глобальный
`shuffle-bank --apply` переупорядочил 40 существующих вопросов вне батча
(`deploy_systems`, `essential_tools`, `file_systems`), и Оркестратор ограничил
прогон темой `file_management` (DECISIONS 2026-09-27, п. 5; spec 001, раздел
«Отклонения», «Shuffle scope»). Зафиксированное состояние банка —
`BANK 189 = 55/45/36/53` (проверено чтением позиций `correct` по всем 14 файлам
`src/data/questions/*.json`). Задача — закрыть этот долг одним коммитом.

## Критерии приёмки

- [ ] `npm run shuffle-bank` (то есть `node tools/shuffle-bank.mjs --apply` **без**
      позиционного аргумента) выполнен; вывод содержит строку
      `--- files changed: N, questions changed: M` с `M > 0`.
- [ ] `npm run shuffle-bank:check` exit 0 и **нерастущий** отчёт: ни одного
      `WARN` вида `... pos<i> holds ... > 60%` (`WARN_SHARE = 0.6`,
      `tools/shuffle-bank.mjs:47`).
- [ ] Шер-контроль по каждой теме: доля любой позиции ≤ 60 % (это же проверяет
      guard-тест `MAX_POSITION_SHARE = 0.6`,
      `src/data/questions/__tests__/positional-distribution.test.ts:33`).
- [ ] **Доказано, что изменился только порядок опций.** Для каждого вопроса
      выполняется тройная сверка «до/после» (скрипт ниже): множество текстов опций
      совпадает, текст опции с `correct: true` совпадает, все остальные поля
      вопроса (`id`, `topic`, `difficulty`, `objective_domain`, `subtopic`,
      `question`, `explanation`) равны байт-в-байт. Ожидаемый вывод:
      `changedQuestions=B contentChanged=0` (B — фактическое число изменённых).
- [ ] `_order.json` не изменён (`git status --porcelain -- src/data/questions/_order.json` пусто):
      последовательность прохождения квиза не сдвинулась.
- [ ] `npm run qc` — `Fails: 0` (порядок опций не влияет на ratio/jaccard, но
      гейт обязан остаться зелёным).
- [ ] `npm run typecheck` exit 0; `npm run test:run` exit 0 (наблюдаемый baseline
      на момент написания спеки: `25 passed`, `149 passed`).
- [ ] `npm run build` exit 0 (DOD, «Общее»).
- [ ] `git status --porcelain` после работы: изменены **только**
      `src/data/questions/<topic>.json`; `docs/dashboard/state.json` возвращён к
      HEAD (DECISIONS 2026-09-27, п. 7).
- [ ] После коммита: `npm run sync` → `git add` → commit → `npm run sync:check`
      exit 0 (правило 3 оркестратора).
- [ ] Строка в `.project/log.md` (правило 5).

## Процедура доказательства «только порядок»

Скрипт читает банк из рабочего дерева и банк из коммита-предка `HEAD`, сверяет по
`id` и печатает расхождения. Запускать до коммита, при `HEAD` = коммит до
канонизации:

```powershell
node -e "
const {execFileSync}=require('node:child_process');const fs=require('fs');const path=require('path');
const dir='src/data/questions';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&!f.startsWith('_')).sort();
const read=(spec)=>files.flatMap(f=>JSON.parse(spec?execFileSync('git',['show',spec+':'+dir+'/'+f],{encoding:'utf8',maxBuffer:1e9}):fs.readFileSync(path.join(dir,f),'utf8')));
const before=new Map(read('HEAD').map(q=>[q.id,q]));const after=read(null);
let changed=0,contentChanged=0,missing=0;
for(const q of after){const b=before.get(q.id);if(!b){missing++;continue;}
 const sameSet=JSON.stringify(q.options.map(o=>o.text).slice().sort())===JSON.stringify(b.options.map(o=>o.text).slice().sort());
 const sameCorrect=q.options.find(o=>o.correct===true).text===b.options.find(o=>o.correct===true).text;
 const rest=o=>JSON.stringify({...o,options:undefined});const sameRest=rest(q)===rest(b);
 const order=JSON.stringify(q.options)!==JSON.stringify(b.options);
 if(order)changed++;if(!sameSet||!sameCorrect||!sameRest){contentChanged++;console.log('CONTENT CHANGED',q.id,sameSet,sameCorrect,sameRest);}}
console.log('changedQuestions='+changed+' contentChanged='+contentChanged+' newIds='+missing);
"
```

## Что НЕ трогать

- Контент вопросов: `question`, `options[].text`, `options[].correct`,
  `explanation`, `topic`, `subtopic`, `difficulty`, `objective_domain` — ни один
  символ; единственное допустимое изменение — порядок элементов `options`.
  (Набор ключей вопроса проверен чтением `src/data/questions/*.json`:
  `id, topic, difficulty, objective_domain, subtopic, question, options, explanation`.)
- `src/data/questions/_order.json` — глобальный порядок id (от него зависит
  сохранённый `currentIndex`).
- `src/data/topics.ts` — read-only канон 14 тем.
- `.project/contracts/*` — контракты MAS.
- `.project/specs/README.md`, `.project/DOD.md` — вне скоупа (правки политик идут
  своей задачей).
- Прод и `git push` без approve капитана (правило 4).

## Превью

1. Вывод `npm run shuffle-bank` целиком (какие темы и сколько вопросов затронуты).
2. Отчёт-скрипт выше: `changedQuestions=… contentChanged=0`.
3. `npm run shuffle-bank:check` до и после (таблица позиций + отсутствие WARN).
4. `git diff --stat` — только `src/data/questions/*.json`.
5. Путь к превью-файлу (например `.project/drafts/global-canonization-preview.md`)
   в отчёте капитану.

## Обработка отказов

- **`contentChanged > 0`** — STOP, немедленный откат (`git checkout -- src/data/questions`),
  доклад капитану: инструмент задел контент, канонизация запрещена.
- **Появился `WARN ... > 60%`** после `--apply` — STOP, откат, доклад: тема не
  балансируется солью в пределах `SALT_SEARCH_LIMIT = 100`
  (`tools/shuffle-bank.mjs:53`), нужен отдельный разбор, а не ручная правка.
- **Красный любой из гейтов** — коммита нет, доклад с выводом гейта.
- **Любое расхождение frontmatter'а этой спеки с `.project/specs/README.md`** —
  STOP, доклад, спека не исполняется до разрешения.

## Риски: что может пойти не так

- **Сохранённый `currentIndex`.** `src/store/quizStore.ts` персистит `currentIndex`
  (индекс в массиве из `_order.json`, `src/data/questions/index.ts:27-30`), а не
  порядок опций, поэтому канонизация опций его не сдвигает. Инвариант проверяется
  тестом `loaders-invariant.test.ts` («loadAll() resolves every id of _order.json,
  in order») — он обязан остаться зелёным.
- **Потребители, запомнившие индекс опции, а не её текст.** Позиция `correct`
  изменится у большинства вопросов. Безопасны: UI (`Question.tsx` шаффлит
  `shuffleOptions(options, seedFromId(id))`) и любые читатели, сопоставляющие
  опции по тексту. Опасны: черновики/артефакты MAS (`.project/drafts/*`,
  `drafts/_mas-results/`), где правильный ответ мог быть записан как «опция 1»,
  и любые заметки с номерами позиций — такие артефакты после канонизации нельзя
  читать как указатель на позицию.
- **Шум в диффе.** 189 вопросов × 4 опции = большой diff. Это ожидаемо; ревью
  капитана опирается на `contentChanged=0`, а не на построчное чтение.

## Отчёт капитану

1. До/после: таблица позиций банка и по каждой теме.
2. `changedQuestions` / `contentChanged` (обязательно `contentChanged=0`).
3. Exit-коды: `qc`, `shuffle-bank:check`, `typecheck`, `test:run`, `build`.
4. `git diff --stat` и подтверждение, что `_order.json` не тронут.
5. Отклонения от спеки и вопросы капитану.
6. Ждать approve. Коммит и push — только после него.
