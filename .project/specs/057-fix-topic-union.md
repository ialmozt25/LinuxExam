---
id: 057
slug: fix-topic-union
status: done
type: infra
track: small
created: 2026-10-03
updated: 2026-10-03
commit: 8896618
embedded_approve: rule 2 (F5.0a — задание капитана 2026-10-03, прямой путь, прецедент 054)
---

## Контекст

`Topic` в `src/data/models/Question.ts:1` — union из **трёх** слагов
(`file_permissions | file_management | process_management`), тогда как банк
содержит **14** тем: `_topics.json` даёт 253 вопроса и 14 ключей `byTopic`
(`deploy_systems, essential_tools, file_management, file_permissions,
file_systems, local_storage, manage_software, networking, process_management,
running_systems, security, shell_scripts, text_files, users_groups`), а реестр
загрузчиков `src/data/questions/index.ts:35-53` экспортирует ровно эти 14
слагов в `QUESTION_TOPICS`.

Сегодня это не проявляется в рантайме: `fromJson` (`Question.ts:30`) приводит
`raw.topic as Topic`, а тема приходит строкой из JSON, поэтому фильтрация по
темам работает на любом слаге. Типизация ломается в момент, когда код
начинает опираться на сам union: анализ покрытия по темам (spec 058),
исчерпывающие `switch`/`Record<Topic, …>`, тестовые данные, ограниченные
тремя слагами. Расширение банка 11 темами уже произошло — union отстал от
данных на 11 значений.

## Цель

`Topic` покрывает все 14 тем банка, и это покрытие проверяется регресс-тестом;
поведение рантайма не меняется (те же строки, тот же `fromJson`, тот же банк).

## Что делаем

Факт кода решает вариант: `QUESTION_TOPICS: string[]` (`index.ts:53`) и
`TOPICS: TopicConfig[]` с `key: string` (`src/data/topics.ts:16`) — ширина
`string`, поэтому вариант (б) (`typeof QUESTION_TOPICS[number]['key']`) дал бы
`Topic = string` и потерял бы exhaustiveness; он отклонён по факту, а не по
предпочтению. Принят вариант (в): явный union из 14 слагов, закрытый
compile-time guard'ом на **все** слаги банка.

1. `src/data/models/Question.ts` — `export type Topic = 'deploy_systems' | … | 'users_groups'`
   (14 слагов, порядок — как в `QUESTION_TOPICS`).
2. Там же — guard покрытия:
   `const TOPIC_COVERAGE: Record<Topic, true> = { … все 14 … }` (или эквивалент).
   Забытый в union слаг банка ломает typecheck, лишний — тоже; guard не
   экспортируется и в рантайме не используется.
3. `src/data/models/__tests__/topic.test.ts` — регресс:
   - `QUESTION_TOPICS.length === 14` (номер занят? фактический счёт берём из данных: 14);
   - каждый слаг из `QUESTION_TOPICS` принимается `fromJson` и не теряется
     (`fromJson({...topic: slug}).topic === slug` для всех 14);
   - число осей аналитики (`TOPICS.length`) совпадает с `QUESTION_TOPICS.length`;
   - слаг вне union (например `'legacy_topic'`) в `QUESTION_TOPICS` не входит.

## Критерии приёмки

1. В `src/data/models/Question.ts` union `Topic` содержит все слаги
   `QUESTION_TOPICS` (14), guard покрытия присутствует.
2. `src/data/models/__tests__/topic.test.ts` зелёный и падает, если из union
   убрать любой слаг банка (проверяется мутацией union при ревью).
3. Единственная правка продового кода — `src/data/models/Question.ts` в части
   типа `Topic`/guard'а: банк, `fromJson` и поведение не меняются
   (`src/data/questions/**` не тронут).
4. `npm run typecheck` exit 0; `npm run test:run` exit 0 (базовые 255 + новые).
5. `git diff` по спекам/коду не содержит `mas-runs.json`.

## Что НЕ трогать

`src/data/questions/**` (банк 253 и загрузчики), `src/data/topics.ts`,
`tools/**`, `.project/sync.mjs`, `.project/ORCH-RULES.md`, `playwright.config.ts`,
`tailwind.config.*`, `package.json`.

## Проверка

npm run typecheck; npm run test:run

## Edge Cases

- **Слаг вне union в persisted-состоянии.** Старый профиль не хранит тему
  (`answers` хранят qid/текст), поэтому расширение union миграции не требует.
- **`fromJson` на незнакомом слаге.** Поведение прежнее: `as Topic` не
  валидирует во время выполнения — тест проверяет только слаги банка, а не
  «любую строку».
- **Расширение банка 15-й темой.** Guard ломает typecheck до тех пор, пока
  union не обновлён, — это и есть цель фикса.
- **Пустой банк.** `QUESTION_TOPICS` не пустой (14 ключей `LOADERS`), тест не
  зависит от загрузки JSON.

## Открытые вопросы

1. Вариант (б) задания (`typeof QUESTION_TOPICS[number]['key']`) требует
   сужения ширины `QUESTION_TOPICS`/`TOPICS` до литералов (правка `src/data/questions/index.ts`
   и, возможно, `_topics.json`-типизации). Факт кода: `loadTopic(topic: string)`
   (`index.ts:62`) и внешние потребители ждут `string[]`, поэтому сужение —
   отдельный рефакторинг вне рамок Small-задачи. Решение: вариант (в) + guard.
