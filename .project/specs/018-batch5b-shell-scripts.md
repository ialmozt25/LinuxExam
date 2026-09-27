---
id: 018
slug: batch5b-shell-scripts
status: approved
type: content
created: 2026-09-28
updated: 2026-09-28
commit: null
---

> **M6.0 Phase 5 — второй батч после разморозки контента.** Спека создана по прямому
> заданию капитана. ВНИМАНИЕ: правило 2 (approved spec = авторизация исполнения) к
> `type=content` **не** применяется — см. правило 6 в редакции 2026-09-28.
> `status: approved` здесь означает «спека принята к исполнению», а **не** право
> коммитить вопросы в `src/data/**`. Точка остановки — превью
> `.project/drafts/batch-5b-preview.md` + явный approve капитана.

## Цель

Банк **212 → 218**: добавить **6** вопросов по канонической теме `shell_scripts`
(«Shell-скрипты»).

Обоснование выбора темы:
- после батча 5A (`text_files` 10 → 16) минимум по `_topics.json` делили
  `running_systems` (10) и `shell_scripts` (10);
- батчи 1–7 работали с `essential_tools`, `deploy_systems`, `file_systems`,
  `file_management`, `local_storage`, `manage_software`, `networking`; тема
  `shell_scripts` не затрагивалась;
- из двух кандидатов взят первый по каноническому порядку `src/data/topics.ts`:
  `text_files` (5) → **`shell_scripts`** (6) → `running_systems` (7).

Новые id: `sh_011`..`sh_016` (продолжение после существующих `sh_001`..`sh_010`).
`objective_domain` — `"2"`, как у всех 10 существующих вопросов темы.

## Что делать

1. Написать 6 вопросов в схеме банка (`id`, `topic`, `difficulty`, `objective_domain`,
   `subtopic`, `question`, `options[4]`, `explanation`).
2. `topic` — строго `shell_scripts` (канон из `src/data/topics.ts`, не выдуманный).
3. Прогнать QC: ratio по классу вопроса + cosine против **всего** банка + Haladyna.
4. Собрать превью `.project/drafts/batch-5b-preview.md`.
5. Остановиться и показать капитану сводную таблицу (`id`, ratio, cos, QC, флаг).

Интеграционный шаг (после approve, **не в этой задаче**): дописать вопросы в
`src/data/questions/shell_scripts.json`, дополнить `_order.json` (порядок не
нормализуется — HANDOFF §7.1), пересобрать `_topics.json` генератором, затем гейты.

## Критерии приёмки

- [ ] 6 вопросов, `topic = shell_scripts` — канон из `src/data/topics.ts` (одна из 14 тем).
- [ ] DOD content (`.project/DOD.md`): 4 опции и ровно 1 верная; explanation ≤ 3 строк;
      ratio в **символах** (`RATIO_UNIT = 'chars'`) не выходит за порог **класса**
      вопроса по числу слов (`sentences` FAIL > 1.30 / WARN > 1.25, `token` FAIL > 2.00 /
      WARN > 1.35, `mixed` FAIL > 1.50 / WARN > 1.35 — таблица `RATIO_TABLE` в
      `tools/_lib/ratio.cjs`).
- [ ] Haladyna: AUTO 5/5 у каждого вопроса (`node tools/haladyna.cjs --batch <candidate.json>`).
- [ ] Cosine против **всего** банка (212 вопросов) ≤ 0.85 — для каждого из 6 вопросов;
      цель — без `REJECT` у `tools/cosine.cjs` (его порог 0.80).
- [ ] Новые вопросы **не** повторяют subtopic'ы, уже занятые `sh_001`..`sh_010`:
      `if`/`test`, циклы `for`/`while`, позиционные аргументы, подстановка `$( )`,
      коды возврата `$?`/`exit`, функции и `local`, `read` и перенаправления.
- [ ] Avoid-list собран и применён: `.project/log.md`,
      `.project/factory/MEMORY-FACTORY.md` (раздел «Уроки»), известные аномалии
      `.project/audits/bank-audit-2026-09-27.md`.
- [ ] Превью `.project/drafts/batch-5b-preview.md` создано и показано капитану.
- [ ] Сводная таблица в чате: `id`, ratio (класс), max cos против банка, вердикт QC, флаг.
- [ ] Строка в `.project/log.md`.
- [ ] **Остановка до approve:** вопросы в `src/data/**` не коммитятся, push не выполняется.

## Что НЕ трогать

- `.project/sync.mjs` — ни одной правки.
- `.project/contracts/**`.
- Существующие вопросы банка (`sh_001`..`sh_010` и весь остальной банк) — включая
  пару `sh_004`~`sh_007`, найденную при подготовке батча (см. превью, §5): её правка —
  отдельная задача, разморозка не является разрешением править контент походя.
- `src/data/**` до approve капитана.
- `package.json`, конфиги сборки, `tools/**` (кроме запуска, не правки).
- Находки spec 017 (копия дашборда, строка «HEAD (закреплён)», dependabot) — прямо
  исключены заданием капитана.
- Порядок `_order.json` для существующих id — не переупорядочивается.

## Превью

Превью обязательно (правило 6, редакция 2026-09-28). Файл
`.project/drafts/batch-5b-preview.md` содержит:

1. Полный текст всех 6 вопросов (стем, 4 опции, explanation).
2. Таблицу метрик: `id`, класс по словам, ratio (chars), порог класса, max cos против
   банка, ближайший сосед, вердикт Haladyna AUTO/SEMI.
3. Явное указание, какие subtopic'ы выбраны и почему они не дублируют `sh_001`..`sh_010`.
4. Риски и места, где нужен человеческий взгляд (semi/manual-критерии Haladyna).

## Отчёт капитану

1. Тема: `shell_scripts`, `count = 10 → 16`, обоснование выбора.
2. Spec 018: approved, SHA коммита.
3. Батч 5B: 6 кандидатов, accept / reject по QC.
4. Превью: путь + сводная таблица.
5. Находка `sh_004`~`sh_007` (cos 0.8311) — существующий долг темы, не батча.
