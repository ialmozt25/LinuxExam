---
id: 046
slug: run-spec-chain-content-stop
status: approved
type: infra
created: 2026-10-02
updated: 2026-10-02
commit: null
embedded_approve: rule 2 (исключение: embedded approve для перевода spec в approved), правило 6 (content) не применяется — type: infra
commit_format: "docs(spec-046): content STOP D - preview approve (rule 6)"
---

> **M6.0 Phase 6 — инфра-фикс цепочки перед контентным батчем 043.**
> Спека создана по прямому заданию капитана 2026-10-02 с embedded approve
> (правило 2 в редакции F5.0a: перевод spec в `approved` авторизован явной
> формулировкой капитана; запись `rule2-exception` — строкой в `.project/log.md`).
> Тип `infra`: правило 6 (approve превью) к самой спеке не применяется.
> Приёмка прогона — по общему правилу: MAS `verdict=pass` + гейты зелёные.

## Цель

Добавить в `docs/spec-chain/skills/run-spec-chain/SKILL.md` **STOP-точку D** —
approve капитана на превью вопросов для спек `type: content` (правило 6,
редакция 2026-09-28) — так, чтобы она стояла в Шаге 4 **между прогоном MAS
и записью кандидатов в `src/data/**`**. Сейчас скилл знает ровно три STOP-точки
(A — approve спеки, B — approve плана MAS, C — отчёт + push-авторизация): для
контента approve капитана нигде не запрашивается, а `spec-to-team/SKILL.md:123`
и `ORCH-RULES.md:83-95` его требуют. Отсутствие точки D уже ставит контентный
батч 043 под риск записи вопросов в банк без approve.

## Что делаем

Правки ровно в двух файлах, аддитивные и с минимальным диффом:

**1. `docs/spec-chain/skills/run-spec-chain/SKILL.md`**

- **Карта цепочки (репо-строки 44–48):** `A/B/C` → `A/B/D/C`. Строка `исполнение MAS →
  spec:close → STOP C` заменяется на две: исполнение MAS → **STOP D (approve превью,
  только `type: content`)** → запись в `src/data/**` → `spec:close` → STOP C.
  Инвариант «5 логических шагов» не трогается: STOP D — точка внутри Шага 4.
- **Шаг 4:** добавлен подраздел **«Шаг 4a — STOP-точка D: approve превью вопросов
  (`type: content`)»** между «Ожидаемый результат» и «Условие продолжения» Шага 4,
  по образцу A/B/C и с тем же набором частей: Вход / Команда-действие (уведомление
  `npm run notify -- "⏳ Спека <id>: STOP-точка D — превью вопросов готово…" --event
  stop_point`, сводка капитану, ожидание) / Ожидаемый результат / Условие продолжения /
  Режим отказа (STOP). Точка срабатывает **только** для `type: content`: для infra /
  feature / docs Шаг 4 переходит в Шаг 5 без изменений.
- **Сводная таблица STOP-точек:** новая строка **D** между строками `B` и `C`
  (порядок проверяется грепом строк 301–307): где — Шаг 4a, между прогоном MAS и
  записью в `src/data/**`, только `type: content`; что показываем — превью
  `.project/drafts/<batch>-preview.md` (полный текст вопросов, таблица метрик
  `id`/ratio/cos/ближайший сосед/Haladyna, риски); ждём — явный approve; таймаут
  30 мин; нет ответа — отчёт, остановка, интеграция не выполняется.
- **«Крайние случаи»:** строка «нет approve STOP D (или ответ `revision`)» →
  вопросы в `src/data/**` не пишутся, `feat`-коммит не делается, правки — новой
  итерацией кандидатов (не правкой уже интегрированного банка).
- **«Что не делать»:** запрет писать вопросы в `src/data/**` для `type: content`
  без явного approve STOP D.

**2. `docs/memory/alerts.md`**

- Новая запись в формате файла (`## <дата> | <тема>` + абзац): расхождение
  `per_topic_target: 22` × 14 тем = **308** против глобальной цели **300**
  (`state.json.goal`); цель по темам и глобальная цель несовместимы, при 229
  вопросах и батчах по 12 расхождение проявится на втором-третьем батче. Решение
  отложено (капитаном); первыми порог 22 превысят `security`/`users_groups` (20),
  `file_permissions` (19), `file_management` (18). Правок `state.json` /
  `gen-state.mjs` в этой спеке **нет** — запись фиксирует наблюдение.

**Порядок работ (правило 3):** правки SKILL.md → `npm run sync` → `git add` →
коммит → `npm run sync:check`. Manual-файл `alerts.md` пишется **до** конвергента
(иначе `sync:check` красный, `alerts.md:93-94`).

## Критерии приёмки

1. В `docs/spec-chain/skills/run-spec-chain/SKILL.md` есть подраздел «Шаг 4a — STOP-точка D»;
   `Select-String -Pattern "^### Шаг 4a"` → ровно 1 совпадение.
2. В «Карте цепочки» STOP D присутствует в порядке `A → B → D → C`;
   строка `STOP D` идёт между `STOP B` и `STOP C` (номера строк растут).
3. В сводной таблице STOP-точек есть строка `| D |`; она расположена между
   строками `| B |` и `| C |`; столбцы «Ждём» = явный approve, «Таймаут» = 30 мин,
   «Нет ответа» = отчёт, остановка, интеграция не выполняется.
4. В «Крайних случаях» есть строка про отсутствие approve STOP D с исходом
   «вопросы в `src/data/**` не пишутся, `feat`-коммит не делается, правки — новой
   итерацией кандидатов».
5. В «Что не делать» есть запрет писать вопросы в `src/data/**` для `type: content`
   без approve STOP D.
6. STOP D срабатывает только при `type: content`; для infra/feature/docs Шаг 4
   переходит в Шаг 5 без остановки (формулировка присутствует в тексте Шага 4a).
7. Уведомление STOP D использует существующий механизм `npm run notify -- … --event stop_point`
   (как A/B/C), а не новый инструмент.
8. Существующие якоря STOP A/B/C сохранены: строки таблицы `| A |`, `| B |`, `| C |`
   присутствуют, таймаут 30 мин и запрет push у них не изменены.
9. В `.project/specs/046-run-spec-chain-content-stop.md` заполнены frontmatter
   (`status: approved`, `type: infra`) и секции Цель / Что делаем / Критерии приёмки /
   Что НЕ трогать.
10. В `docs/memory/alerts.md` есть запись про `22 × 14 = 308 > 300` со словами
    «решение отложено»; запись не меняет `state.json` и `tools/gen-state.mjs`.
11. Гейты после правок: `npm run typecheck` → 0, `npm run test:run` → 0,
    `npm run sync:check` → 0 (после конвергента; правило 3).
12. Diff минимален и аддитивен: SKILL.md — только вставки (карта цепочки, Шаг 4a,
    строка таблицы, «Крайние случаи», «Что не делать»), ни одна из 5 секций
    «### Шаг …» не переписана; `docs/spec-chain/README.md` и `agent.cordis.yml`
    не тронуты.

## Что НЕ трогать

- `.project/sync.mjs`, `.project/contracts/**`, `tools/**` (в том числе `qc.cjs`,
  `cosine.cjs`, `shuffle-bank.mjs`), `src/**`.
- `docs/spec-chain/README.md`, `docs/spec-chain/agent.cordis.yml`,
  `docs/spec-chain/skills/spec-enrich/SKILL.md`, `skills/spec-to-team/SKILL.md`.
- Пресет `~/.dsh/.agent-presets/linuxexam-spec-chain/**` — синхронизация reference-копии
  с установленным пресетом выполняется капитаном (операция капитана, вне репо);
  спека ограничена reference-копией в репозитории.
- `.project/scripts/**` (в частности `close-spec.mjs`, `validate-spec.mjs`).
- `state.json` (`goal`, `per_topic_target`) и `tools/gen-state.mjs` — расхождение
  `22 × 14 = 308 > 300` только фиксируется в `alerts.md`, решение отложено.
- Спеки 001–045 и банк вопросов (`src/data/**`).
- Push не выполняется (правила 10/11).

## Декомпозиция

| id | subject | assignee | dependencies |
|---|---|---|---|
| t1 | Правки SKILL.md (карта цепочки A/B/D/C, Шаг 4a, строка таблицы D, «Крайние случаи», «Что не делать») | builder | — |
| t2 | Ревью правки по 12 критериям приёмки спеки; машиночитаемый `verdict` | reviewer | t1 |

`alerts.md` правит капитан (вне write-скоупа обеих задач), файл спеки — артефакт
капитана, коммит цепочки закрытия — за `close-spec.mjs`.

## Проверка

```powershell
# 1. Якоря STOP D (после правки)
Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг 4a','^\| B \|','^\| D \|','^\| C \|'
# 2. Порядок строк в сводной таблице: A < B < D < C
# 3. Сохранность A/B/C
(Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^\| A \|','^\| B \|','^\| C \|').Count  # == 3
# 4. Пять шагов не переписаны
(Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг').Count  # == 5
# 5. Гейты
npm run typecheck; npm run test:run; npm run sync:check
```

## Отчёт капитану

1. Что сделано: STOP D в Шаге 4a, карта цепочки `A/B/D/C`, строка в сводной таблице,
   «Крайние случаи», запрет в «Что не делать».
2. Diff SKILL.md (число вставленных строк, ни одной удалённой содержательной строки).
3. Запись в `alerts.md` про `308 > 300`.
4. Гейты: `typecheck`, `test:run`, `sync:check` — сырые exit-коды.
5. Что осталось капитану: синхронизировать reference-копию с пресетом
   `~/.dsh/.agent-presets/linuxexam-spec-chain/skills/run-spec-chain/SKILL.md`
   (операция капитана); push — отдельная per-command авторизация.
