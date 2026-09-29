# Тревоги

Что пошло не так: открытые проблемы, налоги, известные ловушки.

---

## 2026-09-28 | renderAgentTeamCard не обёрнут VOLATILE
`.project/sync.mjs:884-918` (секция «Пульс агентов») рендерит
`.agent-teams/*/team.json`. Любое изменение storage → `sync:check`
exit 2. Кандидат: volatile-маркеры или игнор.

## 2026-09-28 | Quality-gates контракты не применяются
Все задачи в D4 — `kind: work`. Harness не требует `objective`/
`acceptance`/`verify`/`reviewedTaskId`. Кандидат: усилить SKILL.md.

## 2026-09-28 | D5-порядок в шаблонах промптов
`sync:check` до коммита всегда exit 2. Правильный порядок:
A/B → F1 → D2/D3 → D4/D5/D6 → H. Кандидат: procedural.md.

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

## 2026-09-28 | [f4-checker] результат
Сверка 4 пунктов. **все проверки OK.**
1. **OK.** `state.head` = `dfc85c789c1dd9525fc3367621c92184c46b6fe8`; `git log -1` = `923b42715c6f00a77f26d3ce8406c63ae6045243` («feat(factory): F5.1b — factory:scaffold + 4 scenarios verified»). `git log --oneline dfc85c7..HEAD` → ровно 1 коммит — отставание в допуске (самоссылка spec 009, следствие amend).
2. **OK.** Все фазы `status: done` из YAML-шапки (`F0`, `F1`, `F2`, `F3`, `F4`) имеют запись в `docs/memory/episodic.md`; `node tools/check-episodic.mjs` → `OK F0 / OK F1 / OK F2 / OK F3 / OK F4`, exit 0.
3. **OK.** Файлы ЧАСТИ 4, упомянутые как созданные, на месте: `docs/FACTORY-PLAN.md`; `docs/memory/{episodic,semantic,procedural,working,alerts}.md`; `docs/memory/trends.jsonl`; `tools/check-episodic.mjs`; `.githooks/pre-commit`; `docs/index.html`; `docs/dashboard/state.json`; `.agent-teams/linuxexam-f3-smoke/team.json`; `.project/scripts/keepers/{checker.ps1,cleaner.ps1,watchdog.ps1,run-headless.mjs}`; `templates/factory/` + `templates/factory/README.md` (F5.1a). Не создан только `docs/FACTORY-USAGE.md` — это deliverable текущего шага F5.2 (ещё не выполнен), расхождением не является.
4. **OK.** Отставание `state.head` от HEAD ровно 1 коммит — в допуске (≤ 1). `sync:check` не вызывался (sandbox блокирует `spawnSync git`).

**Итог:** расхождений по 4 пунктам нет; правок не вносилось, кроме этой записи (`entries_count` в meta ниже не трогал — вне задания).

*Вне 4 пунктов (наблюдение, не расхождение задания):* шапка плана и `state.plan` держат `F5` как `pending` `0/4`, тогда как CHANGELOG v2.20 и git (`923b427`) фиксируют F5.1a/F5.1b сделанными, а `current_step` = F5.2 — прогресс фазы в машиночитаемых полях отстаёт от факта.

## 2026-09-28 | C2a-3 (inSync) отложен
`inSync: true` в `renderCenter` (строка `const centerHtml = renderCenter({ ...ctxBase, state: nextState, inSync: true })` в `main()`) остаётся: banner всегда «синхронизировано». Правильный фикс — переиспользовать логику `sync:check` (сравнить сгенерированное с `git show HEAD`) — 30–40 строк + возможный рефакторинг `renderCenter`. Дрейф виден в реальном `sync:check`. Фикс — в C2-close или отдельным подшагом.

## 2026-09-29 | process lesson | working.md — manual-файл (sync не пишет)
Любой коммит manual-файла после converge передвигает HEAD → следующий `sync` тянет drift → `sync:check` красный. Лечение: писать manual-файл ДО converge, либо принять отставание `state.head` на 1 коммит (f4-checker). Приём Pass 5c C1-fix: `git checkout --` на производные, если drift — артефакт одного не-sync коммита (коммит `3a2e931`).

## 2026-09-29 | process gap | handoff не отражал провал Swarm-pilot B
Handoff показывал «статус неизвестен» против факта: FAILED spawn 28.09, 12/12 task-агентов `child stopped: error` (детали — отчёт `C:\Users\Alexey Udotov\swarm-pilot\SWARM-PILOT-B-REPORT.md`, вне репо). Исправляется отдельным коммитом (handoff-update). Закрыто 2026-09-29 (handoff-create): заведён живой `docs/HANDOFF.md`; архивный `docs/archive/HANDOFF.md` оставлен как исторический артефакт. commit pending.

## 2026-09-29 | process gap | rule2-exception #3 — ПРОДОЛЖЕНИЕ записи `2026-09-28 | rule2-exception cumulative`
Третий случай (spec 029, C1-close `log.md:88`, embedded approve без метки). Предыдущая запись от 2026-09-28 остаётся открытой; эта — её продолжение. Кандидат на пересмотр правила 2 (`.project/ORCH-RULES.md`).

## 2026-09-29 | process gap | V2-кандидат: плитка «Состояние»
Решение C2d: принят **V1** (только `isCenterInSync()`, вариант A из C2a-3). Наблюдение: 🔴 достижим, но в нормальном потоке «sync → add → converge» почти всегда 🟢. Смысл плитки по spec 029 — «Всё работает / есть расхождение»; inSync даёт только синхронность центра, не состояние проекта. Кандидат C2a-4: агрегация inSync + consistency:check + sync:check (~30 строк, требует approve).

## 2026-09-29 | fragile | Метрика первого экрана = 30, порог 30
Критерий 1 spec 029 («нет прокрутки на 1440×900») выполнен впритык: 30 видимых строк до первого `<details>`. Любое добавление в первый экран сломает критерий. Отслеживать при будущих правках head/progress/ddn.

## 2026-09-29 | observation | preview-спек нет (на 29.09.2026)
Плитка «Требует решения» (spec 029, уровень 1) показывает число спек в статусе `preview`. На 29.09.2026: preview 0; approved 6, done 14, rejected 4, draft 3. Плитка всегда «—». Дизайн-сигнал на будущее, не баг.

## 2026-09-29 | process gap | Тревоги-счётчик: семантика
openAlerts() считает «открытые = записи без `[closed`». На 29.09.2026 (до добавления этой записи): 17 «открытых», из них 3 — записи-продолжения агентских реплик ([f4-checker] результат и правило 13). Реальных ~14. Кандидат: уточнить правило в openAlerts() — игнорировать записи с `[f*-checker]` / чисто-агентские заголовки.

## 2026-09-29 | override | Плитка «Состояние»: три статуса
Spec 029 описывает плитку «Состояние» с двумя статусами (🟢/🔴). Реализовано три: 🟢 Синхронизировано / 🟡 Данные устарели / 🔴 Есть расхождения. Основание: честность — показывать свежесть данных, не только факт синхронности (наблюдение: при статичном `last_sync` от 27.09 плитка показывала 🟢 «Всё работает», что противоречило двухдневной давности данных). Санкционировано капитаном 29.09.2026. Spec 029 не переоткрывается (approved, commit:null).

## 2026-09-29 | defect | `last_sync` статичен; индикатор 🔴 недостижим в этом контуре
Два связанных наблюдения, найденных при реализации трёх статусов. (1) Writer `last_sync` (`sync.mjs`, `last_sync: state.last_sync ?? new Date().toISOString()`) выставляет поле только при его отсутствии, а переменная `stateChanged` рядом вычисляется, но не используется, — поэтому значение застыло на `2026-09-27T15:37:59.477Z`, и плитка штатно показывает 🟡. Введён fallback `getFreshnessTime()`: `last_sync` → `git log -1 --format=%ct -- .project/state.json`. (2) 🔴 при `sync` практически недостижим: `isCenterInSync()` считается ДО записи и сравнивает СГЕНЕРИРОВАННОЕ содержимое с HEAD, а `sync` перед этим пишет файл из того же состояния — расхождение лечится в том же прогоне. Дополнительно потребовалось вырезать саму плитку «Состояние» из сравнения (`contentSansIndicator`), иначе индикатор самоссылался и залипал на 🔴 навсегда. Probe `--in-sync-probe` возвращает `false` на расхождении — логика рабочая, недостижим именно показ 🔴 в центре. [closed 2026-09-29: last_sync удалён из state/sync/STATE.md/гейта; freshness — git ct + .heartbeat; плитка — 4 уровня в VOLATILE]

## 2026-09-29 | trade-off | Плитка Состояние в VOLATILE
Плитка зависит от wall-clock (Date.now() - freshAt); обёрнута в VOLATILE целиком (сестринские маркеры снаружи div). Trade-off: гейт не ловит drift в плитке; потеря нулевая — contentSansIndicator уже вырезает плитку из isCenterInSync. note детерминированный (пустая строка или «нет данных о синхронизации»), НЕ humanTime — иначе per-sync churn через git status --porcelain (класс №3). Санкционировано капитаном 29.09.2026. [observed+fixed 2026-09-29: самоссылочность проявилась — converge 8a4afa3 зафиксировал 🔴; fix commit 65ea9b2]

## 2026-09-29 | tech debt | last_sync + dashboard churn
1) last_sync — остатки (вне EXPECTED, не правились): tools/gen-state.mjs (SYNC_OWNED_KEYS → 7/8); .project/factory/CENTER-SPEC.md; templates/factory/.project/sync.mjs (шаблон); .project/state.json — проза в log_tail/commits (история). Номера строк не указывать — смещаются при перегенерации. 2) docs/dashboard/state.json (легаси V1-V9): npm run state:update (tools/gen-state.mjs) безусловно копирует state.json → легаси. При каждом запуске state:update легаси становится грязной → churn. Решение сейчас: откат к HEAD (V1). Кандидат на spec: gitignore + git rm --cached, либо удаление легаси, либо расширение EXPECTED. Требует approve. [closed 2026-09-29: problem #3 gate — volatile-aware (commit a80835f); цикл commits↔converge разорван]

## 2026-09-29 | override | Плитка Состояние: убран inSync
Spec 029 (override от 29.09) описывала плитку с 4 уровнями на основе inSync + freshness. Самоссылочность inSync (вычисляется до коммита, коммит меняет HEAD) привела к залипшему 🔴 в converge 8a4afa3. Fix: плитка рендерит ТОЛЬКО freshness (Fresh/Aging/Stale/Critical + null). Сигнал «центр отстал» — в sync:check / CLI. Санкционировано капитаном 29.09.2026. [closed 2026-09-29: переименована в «Свежесть данных» — commit bc6124d]

## 2026-09-29 | override | Плитка «Свежесть данных» — переименование
Плитка `pulseTiles()` переименована: label «Состояние» → «Свежесть данных», значения уровней `FRESHNESS_LEVELS` → Свежие / Подустарели / Устарели / Критически старые, null-ветка → «Нет данных». Причина: имя обещало здоровье проекта («Всё работает»), а сигнал показывал возраст источников (git-время `state.json` + mtime `.heartbeat`). Правка только внутри `pulseTiles()`; `contentSansIndicator`, `isCenterInSync`, `getFreshnessTime`, VOLATILE-маркеры и соседние плитки не тронуты. Остаток (осознанно, вне границ правки): `contentSansIndicator` хранит regex по старому label «Состояние» — после переименования он не матчит, вырезание плитки полностью обеспечено VOLATILE-обёрткой. Санкционировано капитаном 29.09.2026.

## 2026-09-29 | MAS | Решения зафиксированы в DECISIONS.md
Требование DEV-PLAN D0 (запись выбора оркестратора) выполнено с опозданием. Зафиксированы: (1) оркестратор = dsh-agent-teams; (2) C-фаза соло; (3) Swarm закрыт; (4) MAS для RHCSA-diff и C2a-4; (5) Marketing MAS — spec 031.

## 2026-09-29 | defect | AnswerRecord.selectedIndex позиционный — ломается при reorder
Запись {questionId: 'pm_001', selectedIndex: 0, isCorrect: true} (сделана до коммита 3bc8470) при текущих данных указывает на неправильный вариант. Симптом: два зелёных в режиме «Продолжить». Fix: optionText + миграция v2→v3 + отложенная нормализация из loadQuestions (банк async — в migrate недоступен); несовместимые записи drop. Commit ca62109f45abc29bd7218f62ad78df5f6a487b25.

## 2026-09-29 | process gap | spec 027-memory-test отсутствует в репо
Прогон `.agent-teams/spec-027-memory-test` был (reviewer PASS), но файл `.project/specs/027-memory-test.md` отсутствует в репо и во всех коммитах. Дыра в процессе: skill `spec-to-team` не проверяет существование spec-файла. Кандидат в spec 031 (MAS-autonomy).

## 2026-09-29 | process gap | Spec 030 обогащена практиками SDD
Проведено интернет-исследование (GitHub Spec Kit, Spec-To-Ship, мультиагентная оркестрация). Спека 030 дополнена разделами «Контекст», «Edge Cases и стратегия проверки», переформулированы «Что делаем» (измеримые результаты) и «Критерии приёмки». Constraint «только чтение, правки банка не в этой спеке» сохранён дословно.

## 2026-09-29 | tech debt | _order.json — временно ручной механизм
CLI-инструмента для обновления `_order.json` в проекте нет: единственный писатель (`tools/split-questions.mjs`) требует удалённый монолит; `manifest` только валидирует. Исторически — ручная правка в батч-коммитах (`ad50dcd`, `0622321`). Решение капитана 29.09.2026: в spec 031 — временно Node-скрипт в %TEMP% (единая транзакция); постоянный инструмент (`tools/order-manifest.mjs`) — spec 032 (infra). Процессный пробел зафиксирован в `procedural.md:28`.

<!-- meta updated: 2026-09-29T11:59:21Z entries_count: 23 -->
