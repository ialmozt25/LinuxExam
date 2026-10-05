# .dsh/ — проектное подключение DSH

## Skills

`.dsh/skills/<name>/SKILL.md` — проектное дерево скиллов DSH. Проверено
эмпирически (2026-10-05): после создания файлов скиллы появились в каталоге
сессии без перезапуска — значит корень `<projectRoot>/.dsh/skills` сканируется.

Подтверждение: `~/.dsh/_config_dump.yml` (web-профиль) содержит плагины
`@deepseek-ai/dsh-skill` + `@deepseek-ai/dsh-skill-filesystem` +
`@deepseek-ai/dsh-tool-skill`. `dsh --help` про скиллы ничего не сообщает —
источник ответа именно конфиг профиля и README пакета `dsh-skill-filesystem`.

Формат скилла:

- каталог `<name>/SKILL.md` (или плоский `<name>.md` в корне корня);
- YAML-frontmatter с обязательными `name` (kebab-case) и `description`;
- `description` — единственный триггер выбора скилла моделью;
- тело ≤500 строк, скиллов в проекте ≤10 активных;
- вложенные `**/SKILL.md` намеренно НЕ обнаруживаются — только первый уровень.

Ручное подключение (если каталог скиллов не виден в сессии):

1. Убедиться, что запущен профиль с плагинами скиллов:
   `dsh --profile web --dump-config | Select-String skill`.
2. Проверить, что корень проекта определяется по ближайшему `.git`
   (LinuxExam — git-репозиторий в корне, поэтому `<projectRoot>` =
   `C:\Users\Alexey Udotov\LinuxExam`).
3. Перезапустить сессию (`dsh web`), если каталожный снапшот старый:
   провайдер вотчит корень, но первый снапшот берётся при старте сессии.
4. Пользовательский корень как альтернатива — `<dshHome>/skills`
   (например `~/.dsh/skills/<name>/SKILL.md`).

## Hooks

**Формат hooks — гипотеза.** `.dsh/hooks.json` (см. файл рядом) — рабочая
модель, а не подтверждённый контракт DSH: список поддерживаемых событий и
семантика `on_fail` в этой сборке не проверены. Схема:

- `pre-edit` → `node scripts/fitness/check-boundaries.mjs` — блокирует правку,
  если затронуты `boundaries.forbidden_paths` (`severity: blocking`, `block`);
- `post-edit` → `node scripts/fitness/audit-ui.mjs` — предупреждает, не блокирует
  (`severity: advisory`, `warn`).

Режим внедрения: **старт advisory, после пилота — fail**. Сначала hooks только
предупреждают (ложные срабатывания формата обходятся дорого), и лишь после
пилота `post-edit` переводится в `on_fail: "fail"`.

## Enforcement fallback

Единственный *подтверждённый* механизм в этом репозитории — git-хук:
`core.hooksPath=.githooks`. `.githooks/pre-commit` вызывает **только
blocking-проверки**: `node scripts/fitness/check-boundaries.mjs` (staged
forbidden-пути) и `node scripts/fitness/check-colors.mjs` (hex в `src/**/*.tsx`);
exit≠0 блокирует коммит. Advisory-проверки (`check-tokens.mjs` и агрегатор
`audit-ui.mjs`) в гейт не входят — они видны через `npm run fitness`.

### Исключения (exception path)

Ослабить проверку можно **только** записью в `scripts/fitness/allowlist.json`
(по `(file, hex)`, с обязательными `reason` и `expires`), политика —
`fitness_policy` в `.project/governance/frontend-contract.yaml`. Inline-подавлений
в коде нет. Поведение: `[allowlisted]` — не блокирует; `[expired]` — FAIL;
`[stale]` (запись ни с чем не совпала) — advisory, её надо удалить. Правило:
**allowlist только уменьшается**.

Порядок в хуке: **fitness-блок стоит первым**, до sync-проверки. Sync-ветки
завершаются `exit 0` (hook-напоминание по замыслу F2.4 не блокирует), поэтому
fitness-блок, помещённый после них, был бы недостижим. Проверено прогоном
через git-bash: без fitness-блока хук выходит 0 (`sync: ok`), с блоком и
текущими нарушениями — exit 1 с сообщением «коммит заблокирован».

Выбранный механизм: **pre-commit fallback применён** (hooks.json остаётся
гипотезой до пилота, поэтому enforcement не зависит от него).

### Воспроизводимость в свежем клоне

`.gitignore` больше не исключает контур: `/scripts/*` + `!/scripts/fitness/` и
`/.dsh/*` + `!/.dsh/skills/`, `!/.dsh/hooks.json`, `!/.dsh/README.md`. Поэтому
`scripts/fitness/*.mjs` (включая `allowlist.json`) и `.dsh/**` попадают в git, и
pre-commit-гейт воспроизводится в клоне. Проверка: `git check-ignore` без `-v`
даёт exit 1 (ничего не игнорируется) и `git ls-files --others` показывает 10 файлов.


## Ссылки

- `.project/governance/frontend-contract.yaml` — источник правил (Contract).
- `AGENTS.md` — карта (≤50 строк, первые 10 — критичное).
- `scripts/fitness/` — автопроверки.
- `.project/ORCH-RULES.md` §18 — иерархия governance.
