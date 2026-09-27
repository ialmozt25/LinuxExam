---
id: 015
slug: batch5a-text-files
status: done
type: content
created: 2026-09-28
updated: 2026-09-28
commit: null
---

> **M6.0 Phase 5 — первый батч после разморозки контента (2026-09-28).**
> Спека создана по прямому заданию капитана. ВНИМАНИЕ: правило 2 (approved spec =
> авторизация исполнения) к `type=content` **не** применяется — см. правило 6 в
> редакции 2026-09-28. `status: approved` здесь означает «спека принята к
> исполнению», а **не** право коммитить вопросы в `src/data/**`. Точка остановки —
> превью `.project/drafts/batch-5a-preview.md` + явный approve капитана.

## Цель

Банк **206 → 212**: добавить **6** вопросов по канонической теме `text_files`
(«Работа с текстом») — наименее наполненной теме банка, не затронутой батчами 1–7.

Обоснование выбора темы:
- `count = 10` — минимум по `src/data/questions/_topics.json` (вместе с
  `shell_scripts` и `running_systems`);
- батчи 1–7 работали с `essential_tools`, `deploy_systems`, `file_systems`,
  `file_management`, `local_storage`, `manage_software`, `networking` — тема
  `text_files` не затрагивалась (проверено `git log -- src/data/questions/`);
- из трёх кандидатов взят первый по каноническому порядку `src/data/topics.ts`:
  `text_files` → «Работа с текстом» (`sed, awk, cut, sort, uniq, tr, wc, head/tail`).

Новые id: `tf_011`..`tf_016` (продолжение после существующих `tf_001`..`tf_010`).

## Что делать

1. Написать 6 вопросов в схеме банка (`id`, `topic`, `difficulty`, `objective_domain`,
   `subtopic`, `question`, `options[4]`, `explanation`).
2. `topic` — строго `text_files` (канон из `src/data/topics.ts`, не выдуманный).
3. Прогнать QC: ratio по классу вопроса + cosine против **всего** банка + Haladyna.
4. Собрать превью `.project/drafts/batch-5a-preview.md`.
5. Остановиться и показать капитану сводную таблицу (`id`, ratio, cos, QC, флаг).

Интеграционный шаг (после approve, **не в этой задаче**): дописать вопросы в
`src/data/questions/text_files.json`, дополнить `_order.json` (порядок не
нормализуется — MEMORY-FACTORY, урок 2026-09-27), прогнать `npm run manifest`,
затем гейты.

## Критерии приёмки

- [ ] 6 вопросов, `topic = text_files` — канон из `src/data/topics.ts` (одна из 14 тем).
- [ ] DOD content (`.project/DOD.md`): 4 опции и ровно 1 верная; explanation ≤ 3 строк;
      ratio в **символах** (`RATIO_UNIT = 'chars'`) не выходит за порог **класса** вопроса
      по числу слов (`sentences` FAIL > 1.30 / WARN > 1.25, `token` FAIL > 2.00 / WARN > 1.35,
      `mixed` FAIL > 1.50 / WARN > 1.35 — таблица `RATIO_TABLE` в `tools/_lib/ratio.cjs`).
- [ ] Haladyna: AUTO 5/5 у каждого вопроса (`node tools/haladyna.cjs --batch <candidate.json>`).
- [ ] Cosine против **всего** банка (206 вопросов) ≤ 0.85 — для каждого из 6 вопросов.
- [ ] Avoid-list собран и применён: `.project/log.md` (последние 50 строк) +
      `.project/factory/MEMORY-FACTORY.md` (раздел «Уроки», включая уроки про
      verification-среду, ratio-классы и `_order.json`); плюс известные аномалии
      `.project/audits/bank-audit-2026-09-27.md` (`tf_001`~`tf_002` cos 0.9020,
      `ms_002`~`ms_008` 0.8527, дубли верной опции `ug_002`~`ug_018`, `ds_013`~`pm_014`).
- [ ] Новые вопросы **не** повторяют subtopic'ы уже занятые близко: `tf_001`/`tf_002`
      (sed подстановка), `tf_003` (sed диапазоны), `tf_004` (awk поля), `tf_005`/`tf_006`
      (cut), `tf_007`/`tf_008` (sort/uniq), `tf_009` (tr регистр), `tf_010` (tail).
- [ ] Превью `.project/drafts/batch-5a-preview.md` создано и показано капитану.
- [ ] Сводная таблица в чате: `id`, ratio (класс), max cos против банка, вердикт QC, флаг.
- [ ] Гейты: `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run qc`,
      `npm run shuffle-bank:check`, `npm run sync:check` — все exit 0 (после
      конвергентного коммита, правило 9).
- [ ] Строка в `.project/log.md`.
- [ ] **Остановка до approve:** вопросы в `src/data/**` не коммитятся, push не выполняется.

## Что НЕ трогать

- `.project/sync.mjs` — ни одной правки.
- `.project/contracts/**`.
- Существующие вопросы банка (`tf_001`..`tf_010` и весь остальной банк) — в том числе
  известная пара `tf_001`~`tf_002`: её исправление — отдельная тема (spec 011
  `rejected` в рамках freeze), разморозка **не** является разрешением править контент
  походя.
- `package.json`, конфиги сборки, `tools/**` (кроме запуска, не правки).
- Правила 1–11 по существу (правило 6 уже приведено к редакции 2026-09-28).
- Порядок `_order.json` для существующих id — не переупорядочивается.

## Превью

Превью обязательно (правило 6, редакция 2026-09-28). Файл
`.project/drafts/batch-5a-preview.md` содержит:

1. Полный текст всех 6 вопросов (стем, 4 опции, explanation).
2. Таблицу метрик: `id`, класс по словам, ratio (chars), порог класса, max cos против
   банка, ближайший сосед, вердикт Haladyna AUTO/SEMI.
3. Явное указание, какие subtopic'ы выбраны и почему они не дублируют `tf_001`..`tf_010`.
4. Отдельно — риски и места, где нужен человеческий взгляд (semi-критерии Haladyna).

## Отчёт капитану

1. Тема: `text_files`, `count = 10 → 16`, обоснование выбора.
2. Spec 015: approved, SHA коммита.
3. Unfreeze: SHA коммита.
4. Батч 5A: 6 кандидатов, сколько accept / reject по QC.
5. Превью: путь + сводная таблица.

## Закрытие (2026-09-28)

Интеграция выполнена после явного approve капитана на превью (правило 6, редакция
2026-09-28). `commit: null` в frontmatter — это осознанно: SHA коммитов не
самоссылочны к спеке (ср. spec 013), они приведены в отчёте капитану.

**Коммиты (SHA — в отчёте):** `feat(bank): M2.9 batch 5A - 6 questions on text_files
(206->212)` → `chore(state): converge after batch 5A` → `docs(spec): close 015 as done`
→ `chore(state): converge after spec 015`.

**Что сделано:** `tf_011..tf_016` дописаны в конец массива
`src/data/questions/text_files.json` (10 → 16) и в конец `_order.json` (206 → 212,
существующий порядок не нормализован — HANDOFF §7.1); `_topics.json` пересобран
генератором (`npm run manifest` → Total 212, `text_files` 16); банк 206 → 212.

**Гейты (все exit 0):** `typecheck`, `test:run` (26 файлов / 167 тестов), `build`,
`qc` (Total **212**, Fails **0**, Warns 22 — столько же, сколько до батча),
`shuffle-bank:check` (правка порядка не потребовалась), `sync:check` (после
конвергентного коммита).

**Отклонения от буквы задания (две, обе по существу):**

1. **Путь интеграции.** Задание называло `src/data/questions/text_files/tf_011..tf_016.json`;
   такого каталога в репозитории нет — банк хранит один агрегирующий файл на тему
   (`src/data/questions/text_files.json`, единственный потребитель — `index.ts:48`).
   Интеграция выполнена по исправленному адресу, как и требует сама эта спека
   (раздел «Что делать»). Детали — `.project/agents/orchestrator-report-2026-09-28-batch5a-preflight-stop.md`.
2. **`_topics.json`.** Задание относило его к «через `npm run sync`», но `sync.mjs`
   `_topics.json` только **читает** (строки 68, 279–289); файл генерирует
   `tools/gen-topics-manifest.mjs`. Запущен генератор, результат добавлен в
   коммит батча. Ручной правки не было.

**Находка (не входит в эту спеку).** `npm run state:update`
(`tools/gen-state.mjs`) пишет `state.json` фиксированным набором ключей схемы v1
(`last_update/goal/topics/milestones/gates/issues_open/recent_commits`) — он **не
переносит** v2-поля (`head`, `specs`, `log_tail`, `schema_version`, `commits`,
`roles`, `products`, `audits`) и после прогона `sync:check` стал бы красным
(`schema_version < 2`). Пункт 4 плана интеграции в превью («`npm run state:update`»)
поэтому **не исполнялся**; банк-метрика обновлена в `state.json` (`goal.current_questions`
206 → 212, `progress_percent` 68.7 → 70.7) и далее выведена через `npm run sync`.
Задевает ли находка spec 009 — решает капитан; здесь только зафиксирована.
