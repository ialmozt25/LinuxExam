# Factory Usage

## 1. Что это

**MAS Factory** — переиспользуемая система разработки ИТ-продуктов: капитан ставит
задачу, оркестратор собирает команду агентов, агенты делают работу, центр
показывает состояние, капитан approves, изменения идут в коммит.

Фабрика отделяет процесс от продукта: план описывает *что и зачем*, правила —
*как*, память — *что было и что известно*. Шаблон `templates/factory/` — это
копия фабричной обвязки без продуктовой специфики: разворачивается в новом
репозитории одной командой и сразу даёт план, память, центр и гейты.

## 2. Шаблон `templates/factory/` — что входит

- `.project/ORCH-RULES.md` — правила процесса (один файл, правило 13).
- `.project/factory/` — DOD, roles.yaml, контракты ролей (без продуктовых research).
- `.project/scripts/` — `check-episodic.mjs` (правило 12) и скрипты хранителей
  `keepers/{checker,cleaner,watchdog}.ps1` + `run-headless.mjs` (с плейсхолдерами
  `{{PROJECT_ROOT}}` и `{{DSH_BIN}}`).
- `.githooks/pre-commit` — напоминание о `sync:check` (не блокирует коммит).
- `docs/FACTORY-PLAN.md` — шаблон плана (фазы F0–F5, плейсхолдеры).
- `docs/START-HERE.md` — точка входа для нового чата.
- `docs/memory/` — пять пустых тетрадей (episodic, semantic, procedural, working,
  alerts) с `entries_count: 0` и пустой `trends.jsonl`.
- `.project/sync.mjs` — урезанная (продуктово-нейтральная) версия: план, память,
  тренды, решения, тревоги, коммиты. Блока 6 (AgentTeams), банка, спек и продуктов нет.
- `.project/state.json` — минимальное состояние (фазы F0–F5, `pending`).
- `package.json`, `README.md`, `docs/FACTORY-USAGE.md` (этот файл).

## 3. Как развернуть новый продукт

```powershell
npm run factory:scaffold -- ../my-product --product="My Product"
```

Флаги:

| флаг | значение | дефолт |
|---|---|---|
| `--product=NAME` | название продукта (`{{PRODUCT}}`) | `basename <target-dir>` |
| `--factory=NAME` | название фабрики (`{{FACTORY}}`) | `MAS Factory` |
| `--captain-tz=TZ` | часовой пояс капитана (`{{CAPTAIN_TZ}}`) | `Europe/Moscow` |
| `--dsh-bin=PATH` | путь к `bin.js` DSH (`{{DSH_BIN}}`) | `dsh` (голая команда) |
| `--github-owner=NAME` | владелец репозитория (`{{GITHUB_OWNER}}`) | пусто |
| `--force` | разворачивать поверх непустого каталога | выключен |

Поведение по каталогу:

| состояние `<target-dir>` | без `--force` | с `--force` |
|---|---|---|
| не существует | создать и наполнить (exit 0) | — |
| существует, пуст | наполнить (exit 0) | наполнить (exit 0) |
| существует, не пуст | **exit 1** «target-dir не пуст…» | наполнить поверх: файлы шаблона перезаписываются, чужие файлы остаются |

Exit-коды: `0` — успех, `1` — ошибка (непустой каталог без `--force`, ошибка
копирования), `2` — плохие аргументы (не передан `<target-dir>`).

## 4. Что делать после развёртывания

```powershell
cd ../my-product
npm install                              # зависимости пока не нужны, но проверяет package.json
git init
git config core.hooksPath .githooks      # включить pre-commit hook
npm run sync                             # собрать производные (STATE.md, SPEC.md, index.html)
npm run check:episodic                   # правило 12: для фаз done нужна запись в episodic.md
git add -A
git commit -m "initial"
```

Дальше: открыть `docs/START-HERE.md`, заполнить `docs/FACTORY-PLAN.md` под свой
продукт, начать вести `docs/memory/`. Производные (`STATE.md`, `SPEC.md`,
`index.html`) в git не хранятся — они генерируются `npm run sync`.

## 5. Как обновлять шаблон

Шаблон собирается из текущего репозитория-источника:

```powershell
npm run factory:sync-template
```

Скрипт копирует фабричные файлы в `templates/factory/`, заменяет продуктовые
строки на плейсхолдеры (`LinuxExam` → `{{PRODUCT}}`, `ialmozt25` →
`{{GITHUB_OWNER}}`, `Europe/Moscow` → `{{CAPTAIN_TZ}}`, абсолютные пути →
`{{PROJECT_ROOT}}` / `{{DSH_BIN}}`) и не трогает файлы, которые в шаблоне живут
собственной жизнью (`sync.mjs`, `state.json`, план, `START-HERE.md`, тетради,
`package.json`, `README.md`, этот документ). Запускать после изменений фабрики.

## 6. Ограничения

- **`{{DSH_BIN}}`**: без `--dsh-bin` подставляется голая команда `dsh` — нужен
  DSH в `PATH`, иначе скрипты хранителей не запустятся.
- **Хранители** (headless-профиль + Task Scheduler) работают только при
  установленном DSH и настроенных задачах; без DSH шаблон полностью
  работоспособен без них — это опциональный слой.
- **Task Scheduler** — user-level: задачи не срабатывают при разлогине.
- **Прод-URL, банк вопросов, спеки, аудиты, отчёты, архив** в шаблон не входят.
- Кросс-платформенность: `factory:scaffold` использует `node:fs.cpSync` —
  внешние зависимости не нужны (Node 16.7+).

## 7. Что НЕ входит в шаблон

`src/`, `e2e/`, `tools/` (кроме `check-episodic.mjs`), `docs/index.html`,
`.agent-teams/**`, `drafts/`, отчёты, аудиты, snapshots, `.git/`, `node_modules/`,
спеки продукта, `docs/archive/**`, changelog плана, `.project/log.md`,
`.project/DECISIONS.md`.

## 8. Куда смотреть дальше

- `docs/START-HERE.md` — что прочитать в первые 5 минут.
- `.project/ORCH-RULES.md` — правила процесса (1–13).
- `docs/FACTORY-PLAN.md` — план, фазы, текущий шаг.
