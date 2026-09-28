# Журнал событий

Одна запись на событие: дата, фаза или спека, что сделано, номера коммитов.

---

## 2026-09-28 | F1 закрыта
F1 (память) закрыта 5/5. Тетради: episodic, semantic, procedural, working, alerts. trends.jsonl, check-episodic.mjs. MEMORY-FACTORY.md и session-log.md в архив. Числа верифицированы (ahead 9→11). Открытый долг: sync.mjs:898/:1150 — устаревший путь, правка в F2.1.

2026-09-28 | F0.1 финал: фиксация налога правила 9
Закоммичены `.project/state.json` + `docs/index.html` как финальный snapshot F0.1 (`96303a2`), затем запись правила 5 в `.project/log.md` (`4fc2ce1`). Диагноз: self-reference `state.head` — структурный, правка `sync.mjs` отложена в F2, третий converge не делался. Дерево tracked чистое, остались только 4 согласованных untracked пути.

2026-09-28 | F0.1 log record (правило 5)
Запись в `.project/log.md`: F0.1 закрыт, налог правила 9 отмечен явно (`ef9ed33`).

2026-09-28 | F0.1 налог правила 9 (одна запись на весь налог)
`sync:check` после `4489de6` дал exit 2 (`.project/STATE.md`, `docs/index.html` — самоссылочный pinned head, `STATE.md:44` вне volatile-маркеров). Три SHA налога: `2ff1306` — первый конвергентный коммит; `b0c9c5f` — конвергентный коммит после записи в log.md (`sync:check` = exit 0); `96303a2` — финальный snapshot, exit 2 принят как постоянный налог. Не дефект исполнителя — постоянная стоимость самоссылочного state.

2026-09-28 | F0.1: план в репо, хвосты закрыты, untracked разобран
Коммит `4489de6` (73 файла, +10 730/−39): `docs/FACTORY-PLAN.md` v2.2 в репо; 12 отчётов `.project/agents/` и 46 черновиков `.project/drafts/` взяты под git; `docs/HANDOFF.md` и `docs/HANDOFF-2026-09-23.md` перенесены в `docs/archive/` через `git mv` (R099/R100, история сохранена), reference-ссылки обновлены в 8 файлах; `docs/dashboard/state.json` не тронут — разбор в F2; оставлены untracked: `.agent-teams/`, `drafts/_mas-results/`, `.backup-tld-20260928-080821/`, `filelists-BaseOS.xml.gz`.

2026-09-28 | Спеки 014 и 010 закрыты формально
Коммит `3a6266a`: spec 014 (`subagent-push-lockdown`) → `done` — правило 11 реализовано коммитом `61787a0`, спека добавлена `49fec29`; spec 010 (`jsdom-smoke-center`) → `rejected` — отменена по факту, подменена контент-батчами 5A/5B/5C, артефакт `docs/__tests__/center-smoke.test.mjs` не создан. Перед этим `5a806d1` — запись авторизованного push 5C (правила 10/11), `2dd251e` — converge после неё.

<!-- meta updated: 2026-09-28T02:56:14Z entries_count: 6 -->
