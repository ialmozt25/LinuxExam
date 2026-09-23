# Session Log — LinuxExam

Append-only журнал сессий. Обновляется в конце каждой сессии агентом.

## Правила работы

1. Одна задача = одна сессия агента. После push или длинной задачи — new session.
2. Pre-read при старте (read-only, 2 минуты):
   - Последние 3 записи этого файла
   - docs/DECISIONS.md
   - Последний drafts/report-*.md
   - tools/cosine-calibration.json
3. После чтения — кратко резюмируй состояние (3-5 строк), затем задача.
4. Context guard: если harness сообщает о приближении к лимиту или usage > 500K → СТОП, отчёт, новая сессия.

---

## 2026-09-23 (сессия 4) — users_groups merge + L5c

**Задачи:** merge 12 вопросов users_groups (42→54), fix self-check cosine, L5c.

**Коммиты:** 15551b6 (fix cosine self-check), 0142257 (merge users_groups).

**Что сделано:**
- Банк: 42 → 54. Тема users_groups (домен 7) закрыта.
- tools/cosine.cjs: --self-check, исправлен вывод distribution.
- tools/cosine-calibration.json: переснята на 54 вопросах.

**Ключевые находки:**
- L5 пробел (в работе): пайплайн не проверял кандидатов друг против друга. Решение — L5c (intra-batch).
- Порог 0.80 на грани: background_max = 0.8043 > threshold = 0.80.
- 12/12 без reject — аномалия vs 7/10 в пилоте. L8 мягкий.
- Bundle gzip 138 kB (было 131.94). +35 kB прогноз при 100+.

**Backlog:**
- L5c в tools/cosine.cjs
- Lazy-load questions.json (bundle)
- Ужесточение L8
- Dependabot: 52 уязвимости в deps

**Состояние:** origin/main = 0142257, банк 54.

---

## 2026-09-23 (сессия 3) — UI fix + 42 вопроса + calibration

**Задачи:** фикс подсветки (hover-конфликт), merge пилота essential_tools, cosine calibration.

**Коммиты:** 7fd4969 (P1-правки), 0773014 (UI fix), 258cf8e (7 вопросов пилота), 6427b49 (qc.cjs + questionStats), 7d4f499 (cosine.cjs), b94d8da (fix calibration).

**Что сделано:**
- Банк: 35 → 42 (7 вопросов essential_tools, домен 1).
- UI: удалён whileTap/whileHover (Motion резолвил CSS-переменные до применения темы).
- tools/qc.cjs: 5 проверок (schema, bigram Jaccard, плейсхолдеры, length ratio, absolute terms RU+EN).
- questionStats в quizStore (persist, version 2).
- tools/cosine.cjs + cosine-calibration.json.

**Ключевые находки:**
- Hover-конфликт — 3 сессии диагностики.
- Shorthand vs longhand — второй слой бага.
- Hex #4CAF50/#F44336 были dark-значениями токенов.

**Состояние:** origin/main = b94d8da, банк 42.

---

## 2026-09-22 (сессия 2) — Пилот essential_tools

**Задачи:** пайплайн генерации вопросов (8 уровней), пилот домена 1.

**Коммиты:** в ветке ad05155 (fix logic B1) и позже 7fd4969.

**Что сделано:**
- Пилот: 10 → 7 принятых. Отбраковано 2 (et_008, et_010) на Coherence.
- drafts/pending-2026-09-22-2322.json, drafts/report-2026-09-22.md.
- Калибровка cosine на 595 парах: background_max = 0.804, порог 0.85 мёртв.
- 4 фикса логики (4765e9f, 2ed2b95, 43ab27c, ad05155).
- Аудит неоднозначностей: pm_006, fm_006, fm_007, fp_005.
- Тема: 3 состояния через data-theme + data-theme-source (DECISION-009..013).

**Ключевые находки:**
- normalize не должна съедать + - % = :
- Cosine 0.85 — мёртвый порог.
- useTelegramTheme был мёртвым кодом.

**Состояние:** origin/main = ad05155, банк 35.

## 2026-09-23 (сессия 5) — CONTEXT.md

**Задачи:** создать docs/CONTEXT.md — стартовая точка для новых сессий.

**Коммиты:** 7726b065c80776a8cff330ed50e74d7dafdf33e4 docs: add CONTEXT.md

**Что сделано:**
- Зафиксированы: состояние проекта, что закрыто, открытые вопросы, 
  ОТКЛОНЁННЫЕ подходы, правила работы, ключевые цифры.

**Состояние:** origin/main = 7726b065c80776a8cff330ed50e74d7dafdf33e4, банк 54.


## 2026-09-23 (сессия 6) — commit untracked artifacts + sync CONTEXT

**Задачи:** закоммитить untracked артефакты прошлых сессий + устранить дрейф CONTEXT.md.

**Коммиты:** e46982b (audit-logic), 5b8af3f (drafts artifacts), 0be90f7 (package.json + cosine.cjs).

**Что сделано:**
- docs/audit-logic-20260922.md, drafts/_tools/, drafts/_votes/, pending-2026-09-22, report-2026-09-22 — в git.
- package.json (cosine:intra script) + tools/cosine.cjs (L5c) — в git.

**Обнаружено:** L5c intra-batch уже был написан (в tools/cosine.cjs), но не закоммичен и не протестирован. Теперь в проде — требует прогона 4 сценариев (задача 1.6).

**Состояние:** origin/main = 0be90f7, банк 54, working tree clean.