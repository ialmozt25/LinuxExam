## 2026-09-30 · Orchestrator
### Goal
Spec 036 (`bank-semantic-audit`, type=content, approved): семантический проход по **всем 225 вопросам** банка против current-objectives RHCSA EX200 (RHEL 10) — для каждого вопроса verdict (`актуален` / `требует правок` / `устарел` / `требует ручного решения`) + причина. Правки банка **не выполняются** (правки — отдельная spec 037). Grep-аудит spec 030 нашёл только `fp_002` и `sec_007`; spec 036 закрывает слепую зону grep — устаревшие термины/команды/пути и изменённые формулировки objectives.

### Completed
Прогон AgentTeams `spec-036-bank-semantic-audit` — 6 ролей (writer-t0 + writer-g1…g4 на `deepseek-official/deepseek-v4-flash`, qc на `deepseek-official/deepseek-v4-pro`, effort high), DAG: **t0 → {t1 ∥ t2 ∥ t3 ∥ t4} → t5**. Все 6 задач `completed`; loop = `deliverable`. Длительность 1119379 мс (18 мин 39 с).

- **t0** (writer-t0): `.project/specs/030-objectives-full.md` (5304 Б) — полный дословный список current-objectives RHCSA EX200 (RHEL 10). `web_fetch` отдал усечённую страницу (только навигация, без секции objectives) → fallback на кэш `%TEMP%/rhcsa-current.html` (340 777 Б, снимок 2026-09-29, HTTP 200), линейный сканер `<li aria-level>`. Контроль: `<li aria-level>` = 72 = 10 категорий + 62 пункта; распределение 11/4/4/10/6/5/6/4/4/8; `Manage software` есть, `Manage containers` нет; программная сверка MD ↔ HTML — 0 расхождений verbatim. Проверено лидом построчно против diff-таблицы spec 030 (GPT-only, `privileged access`, `firewalld and firewall-cmd`, VFAT/ext4/XFS, `at, cron and systemd timer units`) — совпадает.
- **t1…t4** (writer-g1…g4): `.project/drafts/audit-036-group1..4.md` — по одной строке `id — тема — verdict — причина` на каждый вопрос, группы 66 / 67 / 43 / 49. Каждый writer программно сверил свой охват с банком (missing / extra / duplicates = 0) и отдельно отчитался о проверке отсутствия устаревшей лексики.
- **t5** (qc): `.project/drafts/audit-036-summary.md` (73 388 Б) — сводный список 225 вердиктов, сводка, топ-5, findings; **verdict = pass**. Независимо: полнота скриптом (225/225), формат 0 нарушений, adversarial-чтение 18 вопросов (все 10 «требует правок» + 1 «ручного решения» + 7 «актуален») — расхождений нет.
- **Итог аудита: актуален 214 · требует правок 10 · устарел 0 · требует ручного решения 1.** «Требует правок» — `ms_004` (модульные потоки → post-modular), `msw_011`/`msw_014` (`.el9` в именах rpm), `net_001` (разбор ссылается на отсутствующий вариант `ip addr add`), `net_002`/`net_003` (метка «Rocky 9»), `fm_008` (`mlocate.db` → `plocate`), `ug_002`/`ug_007` (объяснения на эмпирике RHEL-9-эры), `fs_004` («в RHEL 9 нет» + CIFS вне objectives). «Ручного решения» — `fm_011` (два верных варианта: `-cjf` и `-cf … --bzip2`; объяснение «без -f» опровергнуто на GNU tar 1.35).
- **Независимая проверка лида** (свой node-скрипт, не доверие отчётам членов): 225 id банка = 225 строк-вердиктов, `MISSING=0 EXTRA=0`, дублей нет.
- **Ключевой отрицательный результат:** устаревшей лексики класса `chkconfig` / `sysvinit service` / `/etc/init.d` / `yum`-как-основной / `ifconfig`/`route` / `ifcfg-*`/`network-scripts` / MBR / Podman / set-GID по всем 225 вопросам — **0 вхождений**; `sec_007` не переоткрывался (закрыт spec 031).
- **Пробелы покрытия** (на вердикты не влияют, вход для spec 037): IPv6 и объектив 8.3 (networking), 7.6 «Modify the system bootloader» (нет нигде в банке), 4.3 «Interrupt the boot process» и 4.8 `Storage=persistent`, tuned (4.6), редакторы (1.7), 9.4 sudo/wheel в `users_groups`.
- **Гигиена метаданных** (вход для spec 037/отдельного решения): `objective_domain` — legacy-шкала 1–9 эры RHEL 9 (кодом не читается, но валидируется `tools/qc.cjs:110` как `/^[1-9]$/`); `_meta.verified_rhel: "9.8"` у значительной части вопросов; неоднородный префикс id в `networking.json` (`net_*` + `ntw_*`).
- Память: `## 2026-09-30 | spec-036-bank-semantic-audit` в `docs/memory/episodic.md` (+ `entries_count` 25 → 26) и новый верхний блок в `docs/memory/working.md`; evidence — `git status --porcelain` содержит `M docs/memory/episodic.md` и `M docs/memory/working.md`.
- Метрики: `npm run runs:log -- spec-036-bank-semantic-audit` → `.agent-teams/archive/spec-036-bank-semantic-audit/team.json`, статус `completed`, verdict `completed`, 6 задач, durationMs 1119379 (`.project/mas-runs.json`, записей 15 → 16).
- Команда архивирована: `agent_teams_delete` → `.agent-teams/archive/spec-036-bank-semantic-audit`.

### Гейты (сырые exit-коды)
| гейт | до прогона | после прогона |
|---|---|---|
| `npm run typecheck` | 0 | **0** |
| `npm run test:run` | 0 (28 файлов / 198 тестов) | **0** (28 / 198) |
| `npm run qc` | — | **0** (Total 225, Fails 0, Warns 22) |
| `npm run shuffle-bank:check` | — | **0** (BANK 225 = 66/51/47/61) |
| `npm run check:episodic` | — | **0** (F·· D0–D4 — OK) |
| `npm run sync:check` | **0** | **2 (SYNC DRIFT)** — см. Blockers |

`src/**` и `tools/**` не тронуты: `git diff` и `git diff --cached` к HEAD **пусты**. Все артефакты прогона — новые untracked `.md`.

### Blockers
**Один блокер для перевода spec 036 в `done`: `sync:check` = 2 (SYNC DRIFT).** Root cause найден лидом в коде и **доказан экспериментом**, а не выведен рассуждением.

- Причина: `readSpecs()` (`.project/sync.mjs:538-546`) читает **любой** `*.md` в `.project/specs/` без требования frontmatter (исключён только `README.md`). Обязательный по **критерию 1 спеки 036** файл `specs/030-objectives-full.md` (frontmatter у него нет) регистрируется как «фантомная» спека `id=030, slug=objectives-full, type=feature, status=draft`, дублируя id существующей spec 030, → генерируемые `.project/SPEC.md` и `docs/index.html` расходятся с диском. `state.json` и `STATE.md` не затронуты — ровно те два файла и названы в диагностике.
- Доказательство: (1) сразу после архивации команды drift сохранился — версия «виноват live-блок „Пульс агентов“» (`.agent-teams/*/team.json`, урок spec 034) **опровергнута**; (2) при временно перенесённом в `%TEMP%` снапшоте `npm run sync:check` → **0** (`sync: ok (check)`), при возвращённом → **2**; файл восстановлен байт-в-байт (`ROUNDTRIP_SHA256_OK=True`). Отсюда: drift вызывает **исключительно** артефакт, путь которого предписан спекой, — то есть это дефект связки «spec 036 ↔ `sync.mjs`», а не дефект аудита.
- Решение — за капитаном (генератор без спеки не правился; прецедент spec 012 → `rejected`): **(а)** перенести снапшот objectives из machine-scanned `.project/specs/` (например в `.project/objectives/`) с правкой критерия 1 спеки 036; **(б)** научить `readSpecs()` пропускать `.md` без frontmatter отдельной infra-спекой (правка `.project/sync.mjs` — гейт-критичный файл, самовольная правка запрещена). До решения `npm run sync` + converge-коммит **не выполнялись**: они бы легализовали фантомную строку спеки в индексе центра.
- Tracked-файлы прогоном не изменены, поэтому `npm run sync` / коммит / push не нужны для приемки результатов — только для закрытия гейта.

Блокеров исполнения нет. Оговорки:
- **Отклонение от декомпозиции спеки (обосновано правилом AgentTeams).** Роль `writer` развёрнута в 5 членов (`writer-t0` + `writer-g1…g4`), а не в одного: один член не может владеть двумя незавершёнными задачами, а t1–t4 параллельны и имеют непересекающиеся write-скоупы (group1/2/3/4.md). `writer-t0` выделен под t0, потому что t1–t4 зависят от t0 — совмещение двух задач на одном члене дало бы ту же сериализацию, что и DAG, но с нарушением правила владения.
- **Расширение write-скоупа t5 (осознанное решение капитана).** Спека объявляла t5 read-only, но критерий 5 требует «сводку: категории + топ-5», у которой не было названного файла. QC пишет **один новый** файл `.project/drafts/audit-036-summary.md`, непересекающийся со всеми остальными скоупами; group-файлы и `src/**` он не правит. Это единственная интерпретация, при которой критерий 5 имеет durable-артефакт.
- **`web_fetch` по URL спеки недостаточен.** t0 подтвердил: страница Red Hat отдаётся усечённой (навигация без секции objectives) — без кэша `%TEMP%/rhcsa-current.html` задача упиралась бы в STOP-условие. Кандидат в knowledge-base.
- **Side effect (штатный).** `npm run runs:log` дозаписал `.project/mas-runs.json` (15 → 16 записей) — дизайн инструмента.

### Next Steps
1. **Approve капитана** на результат прогона (rule 6, `type: content`) — аудит выполнен, QC verdict = pass.
2. **Решение по `sync:check` (блокер выше):** вариант (а) или (б). После решения — `npm run sync` → коммит → `chore(state): converge` → `sync:check` = 0 → spec 036 в `done`.
3. Коммит артефактов прогона (`.project/specs/030-objectives-full.md`, `.project/drafts/audit-036-*.md`, память) — conventional-сообщение, без push. Push — только по отдельной per-command авторизации (правило 10/11).
4. **Spec 037 (правки банка)** — 10 id «требует правок» + 1 «требует ручного решения» (`fm_011`) + пробелы покрытия (8.1 IPv6/8.3, 7.6 bootloader, 4.3/4.8, 4.6 tuned, 1.7 редакторы, 9.4 sudo/wheel) + гигиена `objective_domain` (legacy 1–9) и `_meta.verified_rhel`.
