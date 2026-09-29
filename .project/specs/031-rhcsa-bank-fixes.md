---
id: 031
slug: rhcsa-bank-fixes
type: content
status: draft
commit: null
---

# Спека 031 — правки банка по результатам MAS-прогона spec-030

Источник фактов: spec 030 (`.project/specs/030-rhcsa-objectives-diff.md`, approved), секции «Список устаревших id» и «План правок» (MAS-прогон 2026-09-29, verdict PASS). Этот документ описывает план правок; сами правки — исполнение spec 031 после approve.

## Контекст

Продуктовый риск: банк (224 вопроса, 14 тем) построен на целях RHCSA для RHEL 9; экзамен EX200 перешёл на RHEL 10 (11.05.2026). MAS-прогон spec-030 выявил **2 устаревших id** (`fp_002`, `sec_007`) и **1 пробел покрытия** (Flatpak: 0 вопросов в банке, 2 objective RHEL 10 не покрыты). Остальные 9 причин diff-анализа проверены данными и дали 0 затронутых id.

## Источники

- spec 030 (approved, `f6beffc`) — «Diff objectives», «Соответствие банка», «Список устаревших id», «План правок».
- spec 005 (`.project/specs/005-batch-6-generation.md`, строки 25–26, 41–42, 182–183) — правило префикса `msw_`.
- `src/data/questions/{file_permissions,security,manage_software,_topics,_order}.json` — состояние банка (fetch `2026-09-29`).
- `docs/memory/procedural.md:28` — интеграционный шаг «обновить `_order.json`» (инструмента не называет — см. раздел «Механизм»).
- RECON v4 (29.09.2026): `_order.json` — массив из 224 id, дубликатов 0, множества id совпадают с topic-файлами; поведение `shuffle-bank` (см. «Edge Cases»).
- Baseline гейтов на `f6beffc`: `shuffle-bank:check` 0 · `manifest` 0 (`OK: 224 questions, 14 topics`) · `qc` 0 (`Total 224, Fails 0, Warns 22`) · `test:run` 0.

## Механизм `_order.json` (решение капитана 29.09.2026, временно)

```
CLI-инструмента для обновления `_order.json` в проекте НЕТ
(единственный писатель — `tools/split-questions.mjs`, требует удалённый монолит;
`manifest` только валидирует; исторически — ручная правка в батч-коммитах).

РЕШЕНИЕ (временно, до spec 032): обновление `_order.json` выполняется
единым Node-скриптом в `%TEMP%` (вне репо) — ОДНА транзакция:
1) вырезать `fp_002`;
2) дописать `msw_015`, `msw_016` в конец.
Это исключает race condition между t1 и t3 (общий ресурс — один файл).

Постоянный инструмент (`tools/order-manifest.mjs`) — spec 032 (infra).
```

## Цель

Привести банк в соответствие objectives RHEL 10: удалить устаревшее, исправить формулировки, восполнить пробел Flatpak; синхронизировать `_topics.json` и `_order.json`.

## Что делаем

1. **P1 — delete** `fp_002` из `file_permissions.json` (objective «Create and configure set-GID directories for collaboration» удалён из RHEL 10; вопрос ставил set-GID-бит на директорию, `chmod 2755 /shared`).
2. **P5 — rewrite** `sec_007` в `security.json`: `firewall` → `firewalld` в двух вариантах ответа (вариант 1 — верный — «текущая работа firewall эту службу не пропускает»; вариант 2 — «…не изменяет постоянную конфигурацию firewall»). `_meta`: `verified_rhel: "10"`, `verified_at: "2026-09-29"`, удалить `"review_recommended"` из `flags`. **Остальные поля `_meta` не трогать** (`added_at`, `pipeline_version`, `source`, `reference`, `status`).
3. **P12 — add** 2 вопроса в `manage_software.json`: id **`msw_015`** (objective `Configure access to Flatpak repositories`) и **`msw_016`** (`Install and remove Flatpak software packages`). Схема — 8 полей без `_meta` (`id`, `topic`, `difficulty`, `objective_domain: "6"`, `subtopic`, `question`, `options` — 4 шт., ровно один `correct`, `explanation`) — по 14 существующим вопросам файла. Правило id: префикс `ms_` занят (`ms_001`..`ms_008`), `msw_` не переиспользуется (spec 005), свободны `msw_015`, `msw_016`.
4. **P12b — shuffle новых вопросов.** По факту RECON (R2): `shuffle-bank` детерминирован и content-pure, но `pickSalt` зависит от набора топика — солт `manage_software` при переходе 14 → 16 меняется (`1` → `0`). Поэтому новые вопросы **генерируются сразу в canonical-формате** `targetOrder(q, salt=0)`; `npm run shuffle-bank` (apply) **не запускается** — гейт его не требует (см. «Edge Cases»). Глобальный `--apply` запрещён (переупорядочит чужие темы — прецедент M2.9 batch 4); topic-scoped `npm run shuffle-bank --apply manage_software` — допустимая альтернатива (перепишет все 16, меняется только порядок опций).
5. **P12c — `_order.json`** единым Node-скриптом в `%TEMP%`: вырезать `fp_002`, дописать `msw_015`, `msw_016` **в конец**. Одна транзакция — исключает race между t1 и t3.
6. **P13 — sync** `_topics.json` через `npm run manifest` (ожидание: total **225**, `manage_software` **16**). Арифметика: 224 − 1 + 2 = 225.
7. **P14 — doc** уточнить `## Соответствие банка` **в `.project/specs/030-rhcsa-objectives-diff.md`** (только эта секция): заменить статусы 8 тем на фактические (2 id + Flatpak-пробел). Правка `.md` — правило 16, Node-скрипт в `%TEMP%`.

## Декомпозиция

Формат — по SKILL.md (`spec-to-team`, шаг 3): нумерованный список `id, subject, assignee, dependencies`.

1. `id: t1` · `subject: Удалить fp_002 из file_permissions.json (set-GID удалён из objectives RHEL 10)` · `assignee: writer` · `dependencies: []`
2. `id: t2` · `subject: Переписать sec_007 в security.json — firewall → firewalld в 2 вариантах ответа; _meta: verified_rhel=10, verified_at=2026-09-29, удалить review_recommended из flags` · `assignee: writer` · `dependencies: []`
3. `id: t3` · `subject: Сгенерировать 2 вопроса Flatpak в manage_software.json (id msw_015, msw_016; схема 8 полей без _meta, objective_domain "6"); сразу в canonical shuffle-формате targetOrder(q, 0) по факту RECON R2` · `assignee: writer` · `dependencies: []`
4. `id: t4` · `subject: _order.json — единая транзакция Node-скриптом: вырезать fp_002, добавить msw_015/msw_016 в конец (исключает race между t1/t3)` · `assignee: writer` · `dependencies: [t1, t3]`
5. `id: t5` · `subject: Sync _topics.json через npm run manifest; проверить total 225, manage_software 16` · `assignee: writer` · `dependencies: [t4]`
6. `id: t6` · `subject: Doc — уточнить ## Соответствие банка в .project/specs/030-rhcsa-objectives-diff.md (P14); правка .md, Rule 16` · `assignee: writer` · `dependencies: [t5]`
7. `id: t7` · `subject: QC — независимое ревью t1–t6; qc-verdict=pass обязателен` · `assignee: qc` · `dependencies: [t6]`

Оговорки:

- Правки — в `src/data/questions/{file_permissions,security,manage_software,_order,_topics}.json` + `.project/specs/030-rhcsa-objectives-diff.md` (P14, только §«Соответствие банка»).
- После t5 — `npm run shuffle-bank:check`, `npm run test:run`, `npm run qc`, `npm run manifest` = exit 0 (baseline на `f6beffc` — все четыре 0).
- Approve капитана обязателен (правило 6, `type: content`; автономия на контент не распространяется).
- `_order.json` — временно Node-скрипт в `%TEMP%`; постоянный инструмент — spec 032.

## Edge Cases и стратегия проверки

- **id-уникальность**: `msw_015`/`msw_016` уникальны по всему банку (grep по всем topic-файлам; `manifest` падает `exit 4` на дубль).
- **Race condition `_order.json`**: t1 и t3 не пишут `_order` напрямую — это делает t4 единой транзакцией.
- **`shuffle-bank` — детерминирован (замеры RECON 29.09.2026).** `shuffle-bank:check` — read-only: считает распределение позиции верного варианта по топику и по банку и падает (`exit 1`) только если какая-то позиция занимает **> 60 %**. Каноничность порядка он **не** проверяет. Замер: `manage_software` 14 вопросов = [5,2,2,5], max 35.7 %, солт `1`, все 14 уже в canonical-форме; при добавлении 2 вопросов с `correct` на позиции 0 вышло бы [7,2,2,5] = 43.8 % — порог не пробит, `:check` = exit 0. Отсюда: обязательного `--apply` нет, canonical-форма новых вопросов достигается генерацией сразу в `targetOrder(q, 0)`.
- **Схема вопроса**: строго 8 полей (без `_meta`) по 14 существующим; `objective_domain` = `"6"`; 4 опции; ровно один `correct`; `topic` = имя файла (проверяет `manifest`).
- **`sec_007._meta`**: менять только `verified_rhel`, `verified_at`, `flags`; остальные поля не трогать. Формат `verified_at` в банке — ISO с временем (`"2026-09-23T11:45:21Z"`); значение `"2026-09-29"` из плана короче — если схема требует полный ISO, использовать `"2026-09-29T00:00:00Z"`.
- **Полнота покрытия**: каждый из 2 Flatpak objectives — ≥1 вопрос.
- **P14 (t6)**: правка `.md` — правило 16 (Node-скрипт в `%TEMP%`, только LF, финальный `\n`), правится **только** секция `## Соответствие банка`; остальные секции spec 030 — побайтово неизменны.
- **`_order.json` — дописывание в конец**: файл не сортируется (это quiz order); исторически id батчей дописывались в конец.

## Критерии приёмки

1. `fp_002` отсутствует в `file_permissions.json` **и** в `_order.json` (grep по `src/data/questions/` → 0).
2. `sec_007` — в `security.json` нет имени службы `firewall` (2 варианта ответа используют `firewalld`); `_meta.verified_rhel = "10"`, `review_recommended` удалён из `flags`.
3. `manage_software.json` содержит 16 вопросов; `msw_015` покрывает `Configure access to Flatpak repositories`, `msw_016` — `Install and remove Flatpak software packages`; оба id — в `_order.json` (в конце).
4. `_topics.json`: `total: 225`, `byTopic.manage_software: 16`.
5. `.project/specs/030-rhcsa-objectives-diff.md` §«Соответствие банка»: статусы 8 тем отражают факт (2 id + Flatpak-gap).
6. `npm run shuffle-bank:check`, `npm run test:run`, `npm run qc`, `npm run manifest` = exit 0. Baseline на `f6beffc`: 0 / 0 / 0 (`Total 224, Fails 0, Warns 22`) / 0 (`OK: 224 questions, 14 topics`).

## Что НЕ трогать

- Другие 12 тем банка.
- Spec 028/029 (spec 030 — правится только §«Соответствие банка», t6).
- `tools/**` (кроме запуска `manifest`, `shuffle-bank`, `shuffle-bank:check`, `qc`, `test:run`).
- `.project/factory/**`, `docs/dashboard/**`, `templates/**`.

