# Тревоги

Что пошло не так: открытые проблемы, налоги, известные ловушки.

---
## 2026-09-28 | rule2-exception cumulative
F5.0b — второй случай `rule2-exception` (после spec 023 в F4.3). Если паттерн повторится — пересмотреть правило 2 (возможно, embedded approve — норма, а не исключение). Кандидат в F5.3 или в ORCH-RULES-правку.

## 2026-09-28 | headless: junction на web-профиль
Хранители (`DSH-Checker`/`DSH-Cleaner`) работают через `dsh --profile headless`. Профиль headless требует junction `node_modules/dsh-tier-router → web/node_modules/dsh-tier-router` (создан в F4.2a-i). Сломается, если web-профиль обновится/удалится. Кандидат: `dsh plugin --profile headless add dsh-tier-router`.

## 2026-09-28 | headless: package.json вне версионного контроля
`headless/package.json` (`dependencies` + `dsh.profile.bundles`) правился в F4.2a-i вне репо и вне git. Перезапишется при обновлении DSH. Кандидат: зафиксировать baseline в `docs/memory/semantic.md`.

## 2026-09-28 | headless sandbox: spawnSync EPERM
Песочница headless-профиля блокирует `spawnSync` с piped stdio (`git EPERM`). `npm run sync:check` внутри headless-агента не работает — гейт остаётся за оркестратором. Сверщик проверяет только отставание `state.head` > 1.

## 2026-09-28 | правило 2 узаконено; правило 13 смягчено (F5.0a)
F4.3 использовал embedded approve для перевода spec 023 в approved. В F5.0a правило 2 дополнено исключением (embedded approve для spec-перевода), правило 13 смягчено (правка ORCH-RULES через embedded approve, если файл и суть названы явно). Записи `rule2-exception` и `rule13-exception` — в `log.md`. [closed F5.0a]

## 2026-09-28 | Критерий 8 спеки 022 не проверен прогоном
Критерий 8 спеки 022 (фаза известна, но не `staged|running` → в `class` попадает только базовый `chip` без модификатора) подтверждён **только чтением кода**: фикстуру с неизвестным значением `phase` не удалось записать в edge-кейс-прогоне F3.0b — запись значения режется политикой оболочки. Не блокер F3. Кандидат: unit-тест `sync.mjs` (чистая функция рендера команды) в F4.

## 2026-09-28 | Dependabot — 52 уязвимости
GitHub: 1 critical, 23 high, 24 moderate, 4 low на default branch. Не следствие push. Кандидат в F4 или отдельную спеку. Действий пока нет.

## 2026-09-28 | F2.3 — стоп-условие 60 строк не сработало
Агент применил 133 строки вместо 60 в sync.mjs (F2.3), обосновал целостностью. Принято капитаном. Прецедент: впредь при превышении стоп-условия — СТОП и отчёт, не дожимать. [closed — принято капитаном, F2.3.1]

## 2026-09-28 | F2.1b partial — index.html drift
Коммит 78adca8: STATE.md:44 и commits[]/log_tail закрыты — 2 из 3 self-reference. Третий — docs/index.html: содержит pre-commit head в содержимом, regex volatile не strip'ает регион. sync:check exit 2 после каждого коммита. Принято как налог (правило 9). Правка — в F2.2b или F2.3. [closed F2.2b — variant A]

2026-09-28 | sync.mjs — устаревший путь к памяти
`.project/sync.mjs:898, :1150` ссылаются на `.project/factory/MEMORY-FACTORY.md`. После F1.3 файл переехал в `docs/archive/MEMORY-FACTORY-2026-09-28.md`. Карточка D3 в центре покажет «(нет файла)» до F2.1. Правка пути — вместе с self-reference в F2.1. Взято в работу в F2.1. [closed F2.1b]

2026-09-28 | sync.mjs self-reference
`sync.mjs` self-reference. `state.head` и `commits[]` всегда отстают на 1 от HEAD после verify-шага: pinned head (`STATE.md:44`) лежит вне volatile-маркеров, а любой прогон verify добавляет текущий коммит в `commits[]` — производные уезжают, `sync:check` даёт exit 2. Принято как налог правила 9. Лечение — F2 (volatile-маркеры). Конвергентами не биться. Взято в работу в F2.1. [closed F2.1b/F2.2b — volatile]

## 2026-09-28 | [f4-checker] результат
Сверка 4 пунктов (задание F4-checker).

1. **РАСХОЖДЕНИЕ.** `state.head` = `e7c4026cd39aab799ab8c8ab5fc357abbd0a459a`; `git log -1` = `70263107e8019b8d2c557d64188ddeea3f864a5a` («docs(spec): 023 F4 keepers + plan v2.12 (F4.1)»). `state.json` отстаёт ровно на 1 коммит: верх `commits[]` — `e7c4026` с тем же subject, то есть последний коммит сделан после прогона `state:update` (похоже на amend). Лечение: `npm run state:update` + конвергентный коммит.
2. **OK.** Все фазы `status: done` из YAML-шапки (`F0`, `F1`, `F2`, `F3`) имеют запись в `docs/memory/episodic.md`; `npm run check:episodic` → `OK F0 / OK F1 / OK F2 / OK F3`, exit 0.
3. **OK.** Все файлы, упомянутые в ЧАСТИ 4 как созданные, на месте: `docs/FACTORY-PLAN.md`; `docs/memory/{episodic,semantic,procedural,working,alerts}.md`; `docs/memory/trends.jsonl`; `tools/check-episodic.mjs`; `.githooks/pre-commit`; `docs/dashboard/state.json`; `.agent-teams/linuxexam-f3-smoke/team.json`. Файлы незакрытой F5 (`templates/factory/`, `docs/FACTORY-USAGE.md`) отсутствуют — фаза `pending`, это ожидаемо.
4. **НЕ ПРОВЕРЕНО.** `npm run sync:check` → exit 1, `sync: FAIL — spawnSync git EPERM` (sandbox блокирует piped stdio у `spawnSync git`). Эскалация `danger-full-access` для повторного прогона отклонена: канал approve недоступен. Результат гейта не подтверждён ни в плюс, ни в минус.

**Итог:** 1 фактическое расхождение (п.1) + 1 непроверяемый пункт (п.4, sandbox). Правок не вносилось, кроме этой записи; `entries_count` в meta-комментарии ниже оставлен как был (правка вне задания).

## 2026-09-28 | [f4-checker] результат
Сверка 4 пунктов. **все проверки OK.**
1. **OK.** `state.head` = `70263107e8019b8d2c557d64188ddeea3f864a5a`; `git log -1` = `05895a96f620d5068a3a64ea466ab72d5e32326e` («feat(keepers): F4.2a-ii — keepers scripts + plan v2.13»). Отставание ровно 1 коммит — допустимо (самоссылка spec 009, следствие amend).
2. **OK.** Все фазы `status: done` из YAML-шапки (`F0`, `F1`, `F2`, `F3`) имеют запись в `docs/memory/episodic.md`; `npm run check:episodic` → `OK F0 / OK F1 / OK F2 / OK F3`, exit 0.
3. **OK.** Файлы ЧАСТИ 4, упомянутые как созданные, на месте: `docs/FACTORY-PLAN.md`; `docs/memory/{episodic,semantic,procedural,working,alerts}.md`; `docs/memory/trends.jsonl`; `.project/sync.mjs`; `.githooks/pre-commit`; `docs/index.html`; `docs/dashboard/state.json`; `.agent-teams/linuxexam-f3-smoke/team.json`; `.project/scripts/keepers/{checker.ps1,cleaner.ps1,watchdog.ps1,run-headless.mjs}`. Отсутствуют только `templates/factory/` и `docs/FACTORY-USAGE.md` — фаза F5 `pending`, это ожидаемо.
4. **OK.** Отставание `state.head` от HEAD ровно 1 коммит — в допуске. `sync:check` не вызывался (sandbox блокирует `spawnSync git`).

## 2026-09-28 | [f4-checker] результат
Сверка 4 пунктов. **все проверки OK.**
1. **OK.** `state.head` = `05895a96f620d5068a3a64ea466ab72d5e32326e`; `git log -1` = `8bd3288e3b46bb1ae859f99954347d2bc6217de9` («feat(keepers): F4.2a-iii — Task Scheduler + plan v2.14»). Отставание ровно 1 коммит — допустимо (самоссылка spec 009, следствие amend).
2. **OK.** Все фазы `status: done` из YAML-шапки (`F0`, `F1`, `F2`, `F3`) имеют запись в `docs/memory/episodic.md`; `node tools/check-episodic.mjs` → `OK F0 / OK F1 / OK F2 / OK F3`, exit 0.
3. **OK.** Файлы ЧАСТИ 4, упомянутые как созданные, на месте: `docs/FACTORY-PLAN.md`; `docs/memory/{episodic,semantic,procedural,working,alerts}.md`; `docs/memory/trends.jsonl`; `tools/check-episodic.mjs`; `.project/sync.mjs`; `.githooks/pre-commit`; `docs/index.html`; `docs/dashboard/state.json`; `.agent-teams/linuxexam-f3-smoke/team.json`; `.project/scripts/keepers/{checker.ps1,cleaner.ps1,watchdog.ps1,run-headless.mjs}`. Отсутствуют только `templates/factory/` и `docs/FACTORY-USAGE.md` — фаза F5 `pending`, ожидаемо.
4. **OK.** Отставание `state.head` от HEAD ровно 1 коммит — в допуске. `sync:check` не вызывался (sandbox блокирует `spawnSync git`).

**Итог:** расхождений нет; правок не вносилось, кроме этой записи (`entries_count` в meta ниже не трогал — вне задания).

<!-- meta updated: 2026-09-28T05:33:00Z entries_count: 14 -->
