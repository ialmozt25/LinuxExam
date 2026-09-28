---
id: 020
slug: batch5c-running-systems
status: approved
type: content
created: 2026-09-28
updated: 2026-09-28
commit: null
commit_format: "feat(bank): M2.9 batch 5C - 6 questions on running_systems (218->224)"
commit_regex:  "^feat\\(bank\\), (\\d+)\\s+questions?"
---

> **M6.0 Phase 5 — третий батч после разморозки контента.** Спека создана по прямому
> заданию капитана. ВНИМАНИЕ: правило 2 (approved spec = авторизация исполнения) к
> `type=content` **не** применяется — см. правило 6 в редакции 2026-09-28.
> `status: approved` здесь означает «спека принята к исполнению», а **не** право
> коммитить вопросы в `src/data/**`. Точка остановки — превью
> `.project/drafts/batch-5c-preview.md` + явный approve капитана.

## Цель

Банк **218 → 224**: добавить **6** вопросов по канонической теме `running_systems`
(«Управление системами»).

Обоснование выбора темы:
- после батча 5B (`shell_scripts` 10 → 16) минимум по `src/data/questions/_topics.json`
  — `running_systems` (10), единственная незакрытая тема из минимума;
- батчи 1–7 работали с `essential_tools`, `deploy_systems`, `file_systems`,
  `file_management`, `local_storage`, `manage_software`, `networking`; тема
  `running_systems` не затрагивалась.

Новые id: `rs_011`..`rs_016` (продолжение после существующих `rs_001`..`rs_010`).
`objective_domain` — `"6"` (конвенция темы: все 10 существующих вопросов про systemd
имеют домен 6, два процессных — домен 3).

## Что делать

1. Написать 6 вопросов в схеме банка (`id`, `topic`, `difficulty`, `objective_domain`,
   `subtopic`, `question`, `options[4]`, `explanation`).
2. `topic` — строго `running_systems` (канон из `src/data/topics.ts`).
3. Прогнать QC: ratio по классу вопроса + cosine против **всего** банка + Haladyna,
   а **до** интеграции — оффлайн-пречек по правилам гейта
   (`.project/drafts/qc-preview-check.mjs`), чтобы блокер вида «опции токен-идентичны»
   не всплыл уже после записи в `src/data/**` (так вышло в батче 5B).
4. Собрать превью `.project/drafts/batch-5c-preview.md`.
5. Остановиться и показать капитану сводную таблицу (`id`, ratio, cos, QC, флаг).

Интеграционный шаг (после approve, **не в этой задаче**): дописать вопросы в
`src/data/questions/running_systems.json`, дополнить `_order.json` (порядок не
нормализуется — HANDOFF §7.1), пересобрать `_topics.json` генератором, прогнать гейты.

### Коммит (обязательное поле для добавления вопросов)

`commit_format` и `commit_regex` объявлены во frontmatter, потому что батч **добавляет
вопросы**: `tools/gen-state.mjs` считает `goal.added_today` и `avg_daily_7d`, грепя
subject коммита двумя регулярками (`/^feat\(bank\)/i` и `/(\d+)\s+questions?/i`).
Subject из `commit_format` матчит обе: он начинается с `feat(bank)` и содержит
`6 questions`. Это закрывает пробел specs 015/018, где поля отсутствовали, хотя
фактические subject'ы были парсер-совместимыми.

## Критерии приёмки

- [ ] 6 вопросов, `topic = running_systems` — канон из `src/data/topics.ts` (одна из 14 тем).
- [ ] DOD content (`.project/DOD.md`): 4 опции и ровно 1 верная; explanation ≤ 3 строк;
      ratio в **символах** (`RATIO_UNIT = 'chars'`) не выходит за порог **класса**
      вопроса по числу слов (`RATIO_TABLE` в `tools/_lib/ratio.cjs`).
- [ ] Haladyna: AUTO 5/5 **и** SEMI 3/3 у каждого вопроса
      (`node tools/haladyna.cjs --batch <candidate.json>` — SEMI 8 требует пути
      или имени команды в стеме).
- [ ] Bigram Jaccard между опциями ≤ 0.9 (`qc.cjs`): помнить, что токенизатор срезает
      пунктуацию с краёв токена — различие только в ней гейт не увидит.
- [ ] Cosine против **всего** банка (218 вопросов) ≤ 0.85 у каждого вопроса; без `REJECT`
      у `tools/cosine.cjs` (его порог 0.80).
- [ ] Новые вопросы **не** повторяют subtopic'ы `rs_001`..`rs_010` и не дублируют
      механизмы, уже занятые в других темах (`systemctl edit` — `ds_006`,
      `journald Storage=` — `ds_007`, `systemd-analyze blame` — `ds_013`).
- [ ] Батч **не добавляет** пар выше 0.80 внутри темы (`cosine --intra-batch`).
- [ ] Превью `.project/drafts/batch-5c-preview.md` создано и показано капитану.
- [ ] Строка в `.project/log.md`.
- [ ] **Остановка до approve:** вопросы в `src/data/**` не коммитятся, push не выполняется.

## Что НЕ трогать

- `.project/sync.mjs`, `.project/contracts/**`, `tools/**` (в том числе `qc.cjs` —
  его токенизатор признан неудобным, но правка вне скоупа: backlog).
- Существующие вопросы банка (`rs_001`..`rs_010` и весь остальной банк) — включая
  пары `rs_002`~`rs_007` (0.8355), `rs_004`~`rs_010` (0.8261), `rs_004`~`rs_005` (0.8155):
  это существующий долг темы, он в превью зафиксирован, но походя не правится.
- `src/data/**` до approve капитана.
- Находки spec 017 (копия дашборда, строка «HEAD (закреплён)», dependabot).
- Порядок `_order.json` для существующих id.

## Превью

Превью обязательно (правило 6, редакция 2026-09-28). Файл
`.project/drafts/batch-5c-preview.md` содержит:

1. Полный текст всех 6 вопросов (стем, 4 опции, explanation) — сгенерирован из
   файла-кандидата, а не перенабран руками.
2. Таблицу метрик: `id`, класс по словам, ratio (chars), порог класса, max cos против
   банка, ближайший сосед, вердикт Haladyna.
3. Разбор: какие механизмы выбраны, почему они не дублируют `rs_001`..`rs_010` и
   механизмы других тем.
4. Отдельно — риски, места для человеческого взгляда и результаты независимой проверки.

## Отчёт капитану

1. Тема: `running_systems`, `count = 10 → 16`.
2. Spec 020: approved, SHA коммита (+ `commit_format`).
3. Батч 5C: 6 кандидатов, accept / reject по QC.
4. Превью: путь + сводная таблица.
5. Находки: три существующие пары темы выше 0.80 и два концептуальных дубля,
   пойманных до интеграции.
