# HANDOFF: LinuxExam + MAS Factory

Живой документ передачи контекста. Собран **только из фактов репозитория**
(файлы, git, гейты). Дата создания: 2026-09-29. Язык — русский.

---

## 1. Где мы (снимок)

- **Продукт:** LinuxExam — тренажёр RHCSA EX200. Банк: **224 / 300** вопросов, **14 тем**. Прод: https://ialmozt25.github.io/LinuxExam/
- **Фабрика:** MAS Factory — фазы **F0–F5 закрыты**, **D0–D4 закрыты**. C2 закрыт (C2a-4 отложен); C3 — приёмка pending.
- **HEAD:** `553e32d`
- **origin/main:** `553e32d` (ahead 0)
- **Дерево:** clean; untracked `.agent-teams/`, `drafts/_mas-results/`.
- **Гейты:** sync:check 0, consistency:check 0, check:episodic 0.
- **Spec 030 (RHCSA objectives diff):** **approved**; ждёт `/spec-to-team 030`.

## 2. Что сделано в C

- **C0 — recon** центра: `docs/C0-CENTER-AUDIT.md` (коммит `0074d35`). Итог: 18 секций,
  3 KEEP / 3 HUMANIZE / 3 COLLAPSE / 10 DELETE, 4 дубликата, 7 багов `sync.mjs`.
- **C1 — дизайн:** spec `029-center-redesign` → `approved` (C-PLAN v1.1). Коммиты
  `ac08fc7` (C1) + `3cb7983` (C1-close).
- **C2b-1 — DELETE:** **10 секций** удалены из рендера (`queue`, `journal`, `roles`,
  `products`, `memory`, `trends`, `decisions`, `audits`, `plan-factory`, `plan-dev`);
  в `ddn` добавлена строка «Планы». Коммит `013aaae`.
- **C2b-2 — COLLAPSE:** `commits` и `notebooks` свёрнуты в `<details>`, `policies`
  возвращён как `<details>`, CSS обобщён на класс `collapsible`. Структура центра:
  **5 `<section>` + 4 `<details>`**. Коммит `3323d4c` (+ converge `cef07a8`).
- **C1-fix — снятие противоречия статуса:** п.5 spec 029 (строка 164) и решение 2
  `docs/C-PLAN.md` (строка 48) помечены как снятые; истина — frontmatter `approved`.
  Коммиты `a55cd87` … `3a2e931`.
- **alerts-hygiene:** 3 записи в `alerts.md` (manual-файлы, handoff-stale,
  rule2-exception #3) + запись в `procedural.md`. Коммиты `19b1506` … `c39e4e1`.
- **C2a (первый подшаг) — wall-clock «свежий draft» закрыт:** свежесть draft
  объявлена состоянием git (`readDirtySpecIds()`), а не `Date.now() − mtime`.
  Коммиты `e807455` + `85d96f6`.
- **C2a-2 — синхронизация числа банка:** `roles.yaml` «банк 206» → 224 (по
  `state.goal.current_questions`); шаблон обновлён через `factory:sync-template`.
  Коммит `a1a9442`.
- **C2a-3 — реальная синхронность центра:** `inSync` вычисляется сравнением
  `docs/index.html` с версией из HEAD (`isCenterInSync()`, вариант A); сообщение
  «есть расхождение» достижимо, 🔴 наблюдался на живом дереве. Коммит `56d067b`.
- **C2d — Пульс и Дела:** 4 плитки уровня 1 (Состояние, Банк, Требует решения,
  Долги), единый блок Плана в `ddn` («закрыто: F0–F5, D0–D4»), блок «Решения»
  в Справочнике; метрика первого экрана — 30 строк. Коммит `c50877f`.
- **Гигиена C-фазы (расширено 29.09):** +4 записи в `alerts.md` (V2-кандидат,
  хрупкая метрика первого экрана, пустой `preview`, семантика счётчика тревог)
  и урок «Time-box — уточнение» в `procedural.md`. Коммит `e471398`.
- **C2-close:** LASTSYNC-FRESHNESS → CHECK-VOLATILE-AWARE → SELF-REF-FIX → RENAME-TILE (плитка «Свежесть данных»). Коммиты `a80835f..bc6124d`.
- **FIX-ANSWER-REORDER:** `AnswerRecord.optionText` + миграция persist v2→v3 (reorder-safe); fix двойного зелёного на `pm_001`. Коммит `ca62109`.
- **EOL-RULE:** правило 16 в ORCH-RULES. Коммит `f334f90`.
- **Spec 030 (RHCSA objectives diff):** draft `f17752a` → enhance `1537a78` → converge `0ffe24d` → **approved** (SHA approve-коммита — в `log.md`).
- **Decision-MAS:** 5 записей MAS-трека в `DECISIONS.md` (оркестратор, C-фаза соло, Swarm закрыт, MAS-применение, Marketing). Коммит `e2701e0`.

## 3. Что открыто в C

- **C1-close** — push (`per-command authorization` капитана; правило 10).
- **RHCSA objectives** — возможная устарелость целей (RHEL 9 → RHEL 10).
- **C2a-4 (опционально)** — агрегация плитки «Состояние» (`inSync` + `consistency:check`
  + `sync:check`) и починка `openAlerts()` (подстрочный `[closed`).

## 4. MAS-оркестратор

- **Выбран:** `dsh-agent-teams` 0.1.20 (`docs/memory/episodic.md:52`, шаг D0-close) —
  единственный работающий (14 tools: `agent_teams_create`/`status`/`delete`).
- **Swarm-pilot B:** **FAILED (spawn)** — 4 прогона 28.09 19:52–20:00, **12/12**
  task-агентов умерли с `child stopped: error` (3–26 с). Отчёт:
  `C:\Users\Alexey Udotov\swarm-pilot\SWARM-PILOT-B-REPORT.md` (вне репо).
  След в системе: `~/.dsh/storages/swarm/events.jsonl` (51 событие, 4 `run/failed`).
- **Swarm не используем:** сломан spawn + архитектурно не подходит под правило 2
  (`.project/factory/RESEARCH.md:105` — «peer-коммуникация без центра противоречит
  правилу «решение за капитаном»»). Плагин `dsh-swarm-orchestrator@0.6.30` остаётся
  установленным в профиле `web` как неиспользуемый.
- **AgentTeams: 5 команд в проде** — `linuxexam-f3-smoke`, `linuxexam-m6-phase4`,
  `spec-026-smoke`, `spec-027-memory-test`, `spec-028-hide-alerts`
  (последняя по времени — `spec-028-hide-alerts`, 29.09 06:29).
- **Решение зафиксировано:** `DECISIONS.md` 29.09.2026 — раздел «MAS — оркестратор,
  C-фаза соло, закрытие Swarm, план применения» (5 записей MAS-трека).

## 5. Что работает автономно

- **Task Scheduler (Windows):**
  - `DSH-Checker` — сверщик, 5 прогонов в день в окне 09–21 (headless-профиль).
  - `DSH-Cleaner` — чистильщик, `WED` + `SUN` 09:00 (свёртка старых записей).
  - `DSH-Watchdog` — 22:00, следит за активностью сверщика.
  Скрипты: `.project/scripts/keepers/{checker,cleaner,watchdog}.ps1`.
- **AgentTeams** (см. §4) — запуск через skill `spec-to-team`.
- **Центр** `docs/index.html` — пересобирается гейтом `npm run sync`; руками не правится.

## 6. Ключевые файлы и ссылки

- **Планы:** `docs/FACTORY-PLAN.md` (v2.23), `docs/DEV-PLAN.md` (v1.4), `docs/C-PLAN.md` (v1.1).
- **Правила:** `.project/ORCH-RULES.md` (правила 1–13), `.project/DOD.md`, `docs/DOD.md`.
- **Спека C:** `.project/specs/029-center-redesign.md` (`approved`).
- **Аудит C0:** `docs/C0-CENTER-AUDIT.md`.
- **Память:** `docs/memory/{episodic,semantic,procedural,working,alerts}.md`, `docs/memory/trends.jsonl`.
- **Центр:** `docs/index.html` — генератор `.project/sync.mjs` (`npm run sync`, гейт `npm run sync:check`).
- **Лог решений:** `.project/log.md` (append-only, правило 5).
- **Состояние:** `.project/state.json` (машинный источник для центра и `STATE.md`/`SPEC.md`).
- **Гейты:** `npm run sync`, `npm run sync:check`, `npm run check:episodic` (`tools/check-episodic.mjs`).
- **Инструменты банка:** `tools/qc.cjs`, `tools/cosine.cjs`, `tools/shuffle-bank.mjs`, `tools/gen-topics-manifest.mjs`, `tools/gen-state.mjs`.
- **Архивный handoff (исторический, не обновлять):** `docs/archive/HANDOFF.md` (28.09, до swarm).
- **Проектные контексты:** `docs/START-HERE.md`, `docs/CONTEXT.md`, `docs/BLUEPRINT-300.md`, `docs/MAS-PROTOCOL.md`.

## 7. Правила, которые всегда в силе

- **Правило 2:** approved spec = авторизация исполнения.
- **Правило 3:** без зелёного `sync:check` задача не `done`.
- **Правило 5:** каждое решение — строка в `.project/log.md` (append-only, одна строка на решение).
- **Правило 6:** контент-трек — раздел «разморожен» в `ORCH-RULES`; approve капитана обязателен всегда.
- **Правило 7:** центр — единственный интерфейс капитана.
- **Правило 8:** откат — `git revert` + запись в `log.md` (без перезаписи истории).
- **Правило 9:** конвергентный коммит — постоянная стоимость state, лечится одним converge, не дожимать.
- **Правила 10/11:** push — только с explicit per-command авторизацией капитана; subagent не пушит.
- **Правило 12:** каждая закрытая фаза — запись в `docs/memory/episodic.md`.
- **Правило 13:** `ORCH-RULES` — один файл.
- **Канонический порядок коммита:** `npm run sync` → `git add` **явными путями** → `git commit` → `npm run sync:check` (exit 0 = done).
- **Стоп-правила (из архива):** «проверим промпт ещё раз» → отклонить; > 2 итераций на артефакт → заморозить; > 30 % бюджета на «оптимизацию» → режим исполнения; лучше отложить, чем сломать.

## 8. Неудачные попытки — не повторять

- **Headless repair (F4.2a-i):** `~/.dsh/settings.yaml` перебивает профиль; фикс — junction `node_modules/dsh-tier-router` + правка `dsh.profile.bundles`, а не правка профиля «сверху».
- **PowerShell 5.1:** `$ErrorActionPreference = 'Stop'` + любой stderr → скрипт умирает; `Out-File` пишет UTF-16; BOM в промпте ломает парсинг. Использовать `pwsh` и явные `-Encoding utf8`.
- **`.gitignore`:** паттерн `scripts/` без анкера блокировал `.project/scripts/keepers/` (хранители F4). Исправлено в F5.0a → `/scripts/` (`.gitignore:29`).
- **`sync.mjs` self-reference:** не вписывать SHA своего коммита в `log.md` — писать `pending` (spec 009); иначе производные расходятся на коммит и гейт краснеет без реального дрейфа.
- **`fs-extra`:** в корне не установлен (в `node_modules` отсутствует) — `factory:scaffold` сделан на `node:fs.cpSync`.
- **`check-episodic.mjs` при копировании в шаблон:** путь `ROOT` правится (в `templates/factory` он в `.project/scripts/`).
- **`rule2-exception` — 3 случая** (spec 023 в F4.3, spec 024 в F5.0b, spec 029 в C1-close `log.md:88`): кандидат на пересмотр правила 2. См. `docs/memory/alerts.md:20` и запись `2026-09-29 | process gap | rule2-exception #3`.
- **Пути с пробелами в PowerShell** (`C:\Users\Alexey Udotov\…`) — всегда в кавычках; без кавычек команда разваливается.
- **Промпты с обрывами:** давать полный промпт одним куском; если текст обрывается (как в C2b-2), дальше контракта не догадываться, а останавливаться и докладывать.
- **Отдельно, из архива §7.7:** `npm run sync:check` **раньше писал** `state.json` (побочный эффект «проверочной» команды) — закрыто spec 009, теперь `--check` read-only.

## 9. Открытые долги

Источник истины — `docs/memory/alerts.md`: **20 открытых записей** (без `[closed`).
Крупные:

- **`renderAgentTeamCard` не обёрнут VOLATILE** — любое изменение `.agent-teams/*/team.json` роняет гейт.
- **`headless: junction на web-профиль`** — сломается при обновлении/удалении web-профиля.
- **`headless: package.json` вне версионного контроля** — перезапишется при обновлении DSH.
- **Sandbox `spawnSync git`:** в основном профиле **работает** (проверено 29.09 в Layer 1 Pass 2). Проверить применимость к headless: если долг актуален только для headless-профиля — оставить как headless-ограничение, иначе снять.
- **`rule2-exception ×3`** — кандидат на пересмотр правила 2.
- **V2-кандидат (плитка «Состояние»)** — `inSync` слабый (синхронность центра, а не состояние проекта); кандидат C2a-4.
- **`openAlerts()` и `[closed`** — маркер ищется подстрокой, поэтому записи-продолжения считаются открытыми: подтверждено эмпирически (alert-count 17 → 20 вместо 21, гигиена C-фазы).
- **Метрика первого экрана = порог 30** — критерий 1 spec 029 выполнен впритык, любое добавление в первый экран его сломает.
- **`Dependabot — 52 уязвимости`** (1 critical, 23 high, 24 moderate, 4 low) на default branch.
- **`Quality-gates контракты не применяются`** в прогонах `kind: work`.

## 10. Жёсткие ограничения

- **Не трогать:** `docs/FACTORY-PLAN.md` и `docs/DEV-PLAN.md` (источники шапок планов), `docs/C0-CENTER-AUDIT.md` (артефакт C0), `src/data/**` (банк), spec `028`, `docs/archive/HANDOFF.md` (исторический артефакт).
- **Не переделывать:** логика `quizStore`, `shuffleOptions`, persist; paywall-логика (помечена INTENDED); async-загрузка банка; guard-тесты (кроме осознанного расширения); спеки `001` и `002` (закрыты).
- **Не запускать:** `npm install`/`npm i` без одобрения; `git add --renormalize .` без `docs/`; MAS-аудит без явной задачи; полный build без причины; `tools/shuffle-bank.mjs --apply` без имени темы; `npm run state:update` (перезаписывает `state.json` **и** `docs/dashboard/state.json`, который коммитить нельзя).
- **Push** — только с explicit per-command авторизацией капитана (правила 10/11).
- **Subagent'ы** — не запускать вне контура AgentTeams (skill `spec-to-team`).
- **`.agent-teams/**`** — не править руками.
- **Центр** `docs/index.html` — генерируется, руками не править.

## 11. Следующее действие

1. **Spec 031 — правки банка** (`delete fp_002` / `rewrite sec_007` / `add 2 Flatpak` / sync `_topics.json`) — продуктовый следующий шаг на основе результатов MAS-прогона spec-030.
2. **Spec 032 — MAS-autonomy** — 6 разрывов из RECON-MAS-AUTONOMY: run-spec.mjs, TASK.md/SESSION.md, spec-gate, авто-отчёт, атомарный коммиттер, метрики.
3. **Spec 033 — Agent-Training** — SOP-YAML, presets, learning-файлы.
4. **Spec 034 — Marketing MAS** — Director + Strategist + Content + SEO + Analyst.
5. **TODO-LX-UI-03** — мигание красным при переключении вопросов (косметика).

## 12. Что НЕ делать в этом handoff

- Не ссылаться на внешние обсуждения и переписку — только факты репозитория и гейтов.
- Не удалять «исторические» разделы (ключевые файлы, правила, неудачные попытки, ограничения) — они переносятся из архивного handoff и обновляются, но не выбрасываются.
- Не дублировать цифры без источника: каждый факт в этом файле имеет файл-источник или коммит.

## 13. История этого handoff

- **2026-09-29:** создан как живой документ вместо архивного `docs/archive/HANDOFF.md`
  (тот снят на 2026-09-28 12:14, до прогонов swarm и до инициативы C). Источники:
  факты репозитория (HEAD `c39e4e1`, ahead 16), `docs/C-PLAN.md`, `docs/C0-CENTER-AUDIT.md`,
  `docs/memory/*`, `.project/log.md`, `docs/FACTORY-PLAN.md`, `docs/DEV-PLAN.md`
  и 4 исторических раздела из архивного handoff (§3, §4.2, §9/§6.3/§4.4, §12).
- **2026-09-29 (обновление после C-фазы):** §1 — HEAD `ea1a026`, ahead 44; §2 —
  добавлены C2a-2, C2a-3, C2d и гигиена C-фазы; §3 — четыре выполненных пункта
  убраны, открыт C1-close; §9 — обновлён sandbox-долг, добавлены V2-кандидат,
  семантика `openAlerts()` и хрупкая метрика первого экрана; §11 и §13 обновлены.
  C2 закрыт, следующий шаг — C1-close.
