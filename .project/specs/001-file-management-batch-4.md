---
id: 001
slug: file-management-batch-4
status: draft
type: content
created: 2026-09-27
updated: 2026-09-27
commit: null
---

## Pre-flight — STOP и доклад при любом расхождении

1. HEAD = `e01cd02` (M4.0), `git status --porcelain` пустой
2. Прочитать `.project/specs/README.md` — frontmatter этого spec должен совпасть по полям. Если README требует другое — STOP, доклад.
3. Прочитать `src/data/topics.ts` — найти канонический topic для темы «управление файлами».
   - Если канон = `file_management` → продолжать.
   - Если канон другой (например `files_management`) → использовать канон, в отчёте указать расхождение.
   - Если темы нет вообще → STOP, доклад капитану.
4. Определить ID-префикс: посмотреть существующие ID в `src/data/questions/*` (`ds_`, `ls_`, `fs_`, `m28-`). Выбрать свободный 2–3-символьный префикс для новой темы. По умолчанию — `fm_`. Проверить, что не занят.
5. Банк до старта = 183. Зафиксировать число.

## Цель

Банк 183 → 189. +6 новых вопросов по канонической теме «управление файлами» (см. pre-flight п.3).

## Источники

- **Avoid-list:** взять из `.project/log.md` (последние 30 строк) + из `STATE.md` (раздел про avoid-list). Если в обоих пусто — доклад, не угадывать. Известный avoid-list: `ds_002, ds_014, rs_001, pm_014, pm_010, fs_005, fs_006, fs_013, ls_002, ls_005, ls_007`.
- **Канон topics:** `src/data/topics.ts` (read-only).
- **DOD content:** `.project/DOD.md`, раздел `content`.
- **Контракты MAS:** `.project/contracts/orchestrator_to_writer.yaml`, `writer_to_qc.yaml`, `qc_to_orchestrator.yaml`.

## Критерии приёмки

- [ ] N новых вопросов (N ≤ 6), topic = канон из pre-flight п.3
- [ ] DOD content соблюдён: 4 опции, 1 верная, option ratio ≤1.5, explanation ≤3 строк
- [ ] QC: cos против всего банка ≤0.85 (не только против темы — cross-theme риск с `ls_*`, `fs_*`)
- [ ] QC: нет дублей внутри новой партии (cos ≤ 0.85 между собой)
- [ ] Avoid-list соблюдён (см. «Источники»)
- [ ] ID уникальны, префикс из pre-flight п.4
- [ ] Гейты: `npm run typecheck` exit 0; `npm run test:run` exit 0 (число тестов — по факту, без регрессий); `npm run shuffle` exit 0; `npm run build` exit 0
- [ ] Preview показан капитану → approve → коммит
- [ ] После коммита: `npm run sync:check` exit 0; центр (`docs/index.html`) показывает обновлённый банк

## Пайплайн

1. Writer (`reasoning_effort=high`) генерирует 6 кандидатов (попытка получить все 6 — лучше 5+1 запас, чем 6 с риском).
2. QC проверяет каждый: ratio, cos против всего банка, cos между собой, корректность дистракторов (нет второго верного), explanation.
3. QC возвращает вердикт по каждому: `accept` / `reject` с причиной.

## Обработка отказов

- **1 reject:** Writer переделывает 1 вопрос → QC повторно. Макс 1 доп. итерация на вопрос.
- **2 reject:** Writer переделывает 2 → QC повторно. Макс 1 доп. итерация на вопрос.
- **После 2 итераций вопрос всё ещё reject:** вопрос выбывает. Партия коммитится с тем, что принято (N < 6).
- **Если принято < 4:** партия считается провалившейся, коммита нет, доклад капитану.
- **Partial approve капитаном** (он говорит «эти 4 ок, эти 2 убери»): коммит с N=4, отчёт о том, какие убраны.

## Превью

Файл: `.project/drafts/batch-4-preview.md`. Содержит:

1. Заголовок: «Batch 4 preview — N вопросов из 6»
2. Таблица QC: id, cos против банка, ratio, вердикт
3. По каждому вопросу: id, question, 4 options (A–D), correct, explanation, topic
4. Отклонённые (если есть): id, причина
5. Путь к файлу даётся капитану в отчёте

## Коммит

Формат: `M2.9 batch 4: <topic> +N (183→183+N)`

- N = 6 → `+6 (183→189)`
- N = 4 → `+4 (183→187)`
- N < 4 → коммита нет

Push НЕ делать до approve.

## Что НЕ трогать

- `src/data/questions/*` — только добавление новых файлов
- `src/data/topics.ts` — read-only канон
- `docs/dashboard/*` — старый дашборд
- `.project/contracts/*` — контракты MAS
- Прод / origin — push только после approve

## Отчёт капитану

1. Pre-flight: HEAD OK, README совместим, канон = `file_management` (или другой), префикс = `fm_`
2. N кандидатов сгенерировано, N принято, N отклонено (причины)
3. Ссылка на `.project/drafts/batch-4-preview.md`
4. Гейты: exit codes по каждому
5. Отклонения от spec
6. Вопросы капитану (если есть)
7. Ждать approve. Коммит не делать.

## Отклонения

Зафиксировано по итогам выполнения (решения капитана 2026-09-27):

- **Гейт A:** исполняются `npm run qc` + `npm run shuffle-bank:check` +
  `npm run shuffle-bank` (apply), а не `npm run shuffle` — такого скрипта в
  `package.json` нет (`Missing script: "shuffle"`, exit 1). Алиас не добавлялся.
- **Блокер B:** untracked артефакты `m2.9-batch*` / `drafts/_mas-results`
  батчей 1–3 — не блокер (decision: proceed). Действия с ними вне скоупа spec 001.
- **Блокер C:** avoid-list отсутствовал и в `log.md`, и в `STATE.md`; использован
  список из spec как есть, включая `ds_014`. `ds_014` в банке отсутствует
  (deploy_systems = `ds_001`..`ds_013`) — намеренный no-op.
- **Блокер D:** guard-тест `positional-distribution.test.ts` хардкодил
  `EXPECTED_QUESTIONS = 183`; правка 183 → 189 разрешена капитаном
  (иначе недостижим критерий `npm run test:run` exit 0). Tech debt →
  spec `002-dehardcode-positional-test`.
- **Commit format:** использован `feat(bank): M2.9 batch 4 - 6 questions on
  file_management (183->189)` вместо формата из раздела «Коммит» — для
  совместимости с `tools/gen-state.mjs`, который считает `added_today` и
  `avg_daily_7d` по subject'ам `/^feat\(bank\)/i` + `/(\d+)\s+questions?/i`.
  Формат spec не матчил ни один regex и молча обнулял бы метрики центра.
- **Shuffle scope:** `shuffle-bank --apply` ограничен темой `file_management`
  (BANK 189 = 55/45/36/53). Глобальный `--apply` переупорядочил бы ещё 40
  существующих вопросов в `deploy_systems`, `essential_tools`, `file_systems`
  — вне скоупа. Полная канонизация банка → spec `003` (backlog), отдельный
  коммит и approve.
