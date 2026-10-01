# spec 040 / t5 — отчёт: документация пресета `linuxexam-spec-chain` (Компонент C)

- task: `t4` (в спеке — `t5`), attempt_id `145b6099-005e-4417-9a6d-eef730d53754`, member `builder-docs`
- зависимости: нет (`dependencies: []`)
- write-скоуп: `docs/spec-chain/README.md`, `docs/spec-chain/agent.cordis.yml`,
  `.project/drafts/spec-040-t5-report.md`
- НЕ делалось (границы задачи): создание/правка `~/.dsh/.agent-presets/**`,
  `docs/spec-chain/skills/**`, `.project/scripts/**`, `package.json`, `src/**`,
  `tools/**`, `.project/specs/**`, коммит/push

## verdict

```
verdict: pass
files: docs/spec-chain/README.md, docs/spec-chain/agent.cordis.yml, .project/drafts/spec-040-t5-report.md
yaml: VALID=true (js-yaml, 18 top-level строк, persona prefix+suffix, {{cwd}}, customSkillDirs)
encoding: UTF-8 без BOM, LF, финальный LF у обоих файлов
materials: пресет в ~/.dsh/.agent-presets/ НЕ создавался (операция капитана)
```

## 1. Состав файлов (что создано)

| файл | bytes | строк | SHA256 |
|---|---|---|---|
| `docs/spec-chain/README.md` | 12780 | 170 | `A798A117D552BDFBEBF4632596520390A2CB8A0716B76CBA51BBADF35D198012` |
| `docs/spec-chain/agent.cordis.yml` | 8792 | 192 | `39B83FB9FEA3EFB203308CB681909B901D72723493299BC2ADB9ED2A557E445A` |
| `.project/drafts/spec-040-t5-report.md` | — | — | (этот отчёт) |

### 1.1 `docs/spec-chain/README.md` — разделы

Обязательные разделы (H2, дословные названия из контракта):

| раздел | строки | содержимое |
|---|---|---|
| `## Границы: кто что делает` | 15–28 | таблица «агент (репо) vs капитан (`~/.dsh/.agent-presets/`)» |
| `## Структура пресета` | 30–70 | дерево `agent.cordis.yml + preset.yml + skills/`, список строк-плагинов шаблона, «без абсолютных путей и секретов» |
| `## Инструменты` | 72–88 | `agent_teams_*`, `npm`, `git`, `Read`, `Write`, `Edit` + пояснение, что `agent_teams_*` — host-plane бандл |
| `## Скиллы` | 90–106 | 4 скилла: `spec-enrich`, `spec-to-team`, `close-spec`, `run-spec-chain` |
| `## Установка` | 108–158 | 11 нумерованных шагов (требование ≥6), шаг 6 — копирование `docs/spec-chain/skills/**` |
| `## Системный промпт` | 160–172 | промпт дословно в код-блоке + пояснение границ |
| `## Проверка после установки` | 174–183 | Test-Path ×4 + `npm run spec:enrich 040 --dry-run` |
| `## Связанное` | 185–191 | ссылки на спеку 040, скиллы, DECISIONS, knowledge/dsh |

Проверка обязательных разделов (все True):

```
numbered_steps=11
section_Структура пресета=True
section_Инструменты=True
section_Скиллы=True
section_Установка=True
section_Системный промпт=True
has_spec-enrich=True has_spec-to-team=True has_close-spec=True has_run-spec-chain=True
has_agent_teams_=True has_npm=True has_git=True has_Read=True has_Write=True has_Edit=True
verbatim_prompt=True
copy_skills_step=True
preset_dir_mention=True
captain_only=True
```

Фиксация «операция капитана» присутствует трижды: таблица «Границы»,
вводный абзац `## Установка` («Ручная установка пресета — **операция
капитана** (агент в `~/.dsh/.agent-presets/` не пишет)») и явная строка
«Репозиторий хранит только документацию и reference-копии скиллов».

Дословный системный промпт в README (код-блок, строка 164):

```
Ты — оркестратор цепочки. Твоя задача — исполнять run-spec-chain с STOP-точками для approve капитана.
```

### 1.2 `docs/spec-chain/agent.cordis.yml` — структура шаблона

YAML-массив из 18 строк (`- id: <name>`), 3 тега `!!js` (платформенные
`disabled`), 0 секретов, 0 абсолютных пользовательских путей:

```
persona, agent-instructions, tool-bash, tool-pwsh, tool-fs, tool-fs-search,
tool-jobs, command-goal, tool-goal, planning, compaction, delegation,
tool-ask-user, tool-todo, tool-web, skill-filesystem, tool-skill, present
```

- `persona.prefix` — системный промпт оркестратора (дословно) + расшифровка
  5 шагов и границ; `persona.suffix` — `Твоя рабочая директория: {{cwd}}.`
- `skill-filesystem.customSkillDirs` — `skills/` от `baseUrl` пресета
  (`!!js "…new URL('skills/', baseUrl)"`) — переносимо между машинами.
- `delegation` (subagent/subagent_fork) — для MAS-шага 4.
- Инструменты `agent_teams_*` намеренно **не** строкой пресета: их
  регистрирует host-бандл `@nanmicoder/dsh-agent-teams` в общем `tools`
  registry профиля (комментарий-блок в конце файла + шаг 2 установки в README).

## 2. YAML-валидация (структурная, не SHA256)

Метод — из `docs/knowledge/dsh/preset-structural-validation.md`: `js-yaml`
load с заменой `!!js` → `!!str` только в памяти (файл не правится), затем
структурные проверки. js-yaml взят из `$env:DSH_HOME\profiles\node_modules`
(`C:\Users\<user>\.dsh\profiles\node_modules\js-yaml`), скрипт лежит вне репо
(`%TEMP%\validate-preset-040.cjs`) — файлов в репо не добавлено.

Скрипт (воспроизведение):

```js
const fs = require('fs');
const yaml = require(process.env.DSH_HOME.replace(/\\/g, '/') + '/profiles/node_modules/js-yaml');
const file = process.argv[2];
let text = fs.readFileSync(file, 'utf8');
const jsTags = (text.match(/!!js /g) || []).length;
text = text.replace(/!!js/g, '!!str');
const doc = yaml.load(text);
if (!Array.isArray(doc)) { console.log('VALID=false reason=not-a-top-level-sequence'); process.exit(1); }
const ids = doc.map(x => x && x.id).filter(Boolean);
const names = doc.filter(x => x && x.name).map(x => x.name);
const persona = doc.find(x => x && x.id === 'persona');
const cfg = persona && persona.config;
const skillFs = doc.find(x => x && x.id === 'skill-filesystem');
console.log('VALID=true');
console.log('top_level_rows=' + doc.length);
console.log('rows_with_id=' + ids.length);
console.log('ids=' + ids.join(','));
console.log('js_tags_replaced=' + jsTags);
console.log('persona_cfg_keys=' + Object.keys(cfg || {}).join(','));
console.log('persona_suffix=' + (cfg && cfg.suffix));
console.log('persona_has_cwd=' + !!(cfg && String(cfg.suffix).includes('{{cwd}}')));
console.log('prompt_verbatim=' + !!(cfg && cfg.prefix.includes('Ты — оркестратор цепочки. Твоя задача — исполнять run-spec-chain с STOP-точками для approve капитана.')));
console.log('customSkillDirs=' + !!skillFs);
console.log('plugin_names_unique=' + (new Set(names).size === names.length));
console.log('absolute_user_path=' + /[A-Za-z]:\\Users|\\home\//.test(fs.readFileSync(file, 'utf8')));
console.log('secret_scan=' + /(api[_-]?key|secret|token\s*:|password)/i.test(fs.readFileSync(file, 'utf8')));
```

Команда и сырой вывод (exit 0):

```
$ node %TEMP%\validate-preset-040.cjs docs/spec-chain/agent.cordis.yml
VALID=true
top_level_rows=18
rows_with_id=18
ids=persona,agent-instructions,tool-bash,tool-pwsh,tool-fs,tool-fs-search,tool-jobs,command-goal,tool-goal,planning,compaction,delegation,tool-ask-user,tool-todo,tool-web,skill-filesystem,tool-skill,present
js_tags_replaced=3
persona_cfg_keys=prefix,suffix
persona_suffix=Твоя рабочая директория: {{cwd}}.
persona_has_cwd=true
prompt_verbatim=true
customSkillDirs=true
plugin_names_unique=false
absolute_user_path=false
secret_scan=false
```

Оговорки по двум строкам вывода:

- `plugin_names_unique=false` — **ожидаемо и безвредно**: одна plugin-строка
  (`@deepseek-ai/dsh-tool-subagent`) намеренно используется дважды с разными
  `toolName` (`subagent` / `subagent_fork`), плюс повторяется `cordis:group`.
  Так же устроены shipped-пресеты (`standard-economy`, `linuxexam-orchestrator`)
  — уникальность проверялась для информации, а не как критерий.
- `absolute_user_path=false` — первая версия файла упоминала `C:\Users\<user>`
  в комментарии-примере и ложно срабатывала; формулировка переписана без
  абсолютных путей. Финальная версия — чистая.

## 3. Кодировка и переводы строк

```
$ node -e "…"
docs/spec-chain/README.md        bytes=12780 bom=false cr=false finalLF=true lines=170
docs/spec-chain/agent.cordis.yml bytes=8792  bom=false cr=false finalLF=true lines=192
```

Оба файла — UTF-8 без BOM, переводы строк LF, финальный LF присутствует.

## 4. Шаги установки (как зафиксировано в README, раздел «Установка»)

11 шагов (контракт требует ≥6); выполняет **капитан** вручную:

1. Предпосылки: `node/npm/git --version`, `Test-Path .project/specs/040-spec-chain.md`.
2. Host-бандл AgentTeams в профиле: `Select-String … profiles/web/package.json -Pattern 'dsh-agent-teams'`; при отсутствии — `dsh plugin --profile web add @nanmicoder/dsh-agent-teams` + перезапуск хоста.
3. Создать каталоги: `New-Item -ItemType Directory -Force ~/.dsh/.agent-presets/linuxexam-spec-chain/skills`.
4. Скопировать шаблон: `Copy-Item docs/spec-chain/agent.cordis.yml ~/.dsh/.agent-presets/linuxexam-spec-chain/agent.cordis.yml -Force`.
5. Создать `preset.yml` (`name: LinuxExam Spec Chain`, `description: …`).
6. **Скопировать скиллы из репо**: `Copy-Item docs/spec-chain/skills/* ~/.dsh/.agent-presets/linuxexam-spec-chain/skills/ -Recurse -Force` — т.е. `docs/spec-chain/skills/**` → `~/.dsh/.agent-presets/linuxexam-spec-chain/skills/` (минимум `spec-enrich/SKILL.md`, `run-spec-chain/SKILL.md`).
7. Добрать `spec-to-team` и `close-spec` (например, из `linuxexam-orchestrator/skills/`).
8. Структурная валидация пресета по чек-листу (js-yaml, `!!js`→`!!str`, persona keys, `{{cwd}}`, `customSkillDirs`).
9. `npm run spec:enrich 040 --dry-run` — 11 фаз и baseline score, без правок спеки.
10. Перезапуск DSH / `patchReload: live`, выбор пресета, проверка каталога скиллов (4 скилла).
11. Приёмочный прогон `/run-spec-chain 040` — остановка в STOP-точке A = ожидаемое поведение.

Обновление после правок reference-скиллов в репо — повтор шагов 4, 6, 8
(репо — источник истины для шаблона и reference-копий).

## 5. Гейты задачи (сырые команды + коды)

```
$ Test-Path docs/spec-chain/README.md
True                                             (V1=PASS)

$ Test-Path docs/spec-chain/agent.cordis.yml
True                                             (V2=PASS)

$ if ((Select-String -Path 'docs/spec-chain/README.md' -Pattern '^\d+\.').Count -lt 6) { exit 1 }
V3_count=11
V3=PASS exit 0                                   (V3=PASS)
```

Дополнительно (не входит в контракт, но проверено): `Select-String` по
`## Структура пресета|## Инструменты|## Скиллы|## Установка|## Системный
промпт` → 5/5 найдено; дословный системный промпт — `verbatim_prompt=True`.

## 6. Границы (что НЕ делалось)

- `~/.dsh/.agent-presets/linuxexam-spec-chain/**` — **не создавался и не
  правился** (установка пресета = операция капитана, спека 040 §Компонент C).
- `docs/spec-chain/skills/**` — не изменялся (скоуп t2/t3; на момент отчёта
  существует `docs/spec-chain/skills/run-spec-chain/SKILL.md`).
- `preset.yml` в репо не создавался — его содержимое описано в README (шаг 5).
- `src/**`, `tools/**`, `.project/scripts/**`, `package.json`,
  `.project/specs/**` — не изменялись.
- Файлы валидации и отчёты вне write-скоупа в репо не добавлялись
  (валидатор — во временном каталоге `%TEMP%`).
- Коммит и push не делались.

## 7. Итог для output

```
verdict: pass
files: docs/spec-chain/README.md (12780 B, LF, 11 шагов установки, 5 обязательных разделов,
       дословный системный промпт, 4 скилла, инструменты agent_teams_*/npm/git/Read/Write/Edit),
       docs/spec-chain/agent.cordis.yml (8792 B, LF, VALID=true, 18 строк, persona prefix+suffix,
       {{cwd}}, customSkillDirs, js_tags=3, секретов 0, абсолютных путей 0),
       .project/drafts/spec-040-t5-report.md
гейты: Test-Path README=True; Test-Path agent.cordis.yml=True; ^\d+\. count=11 (>=6) exit 0
yaml: js-yaml из $env:DSH_HOME\profiles\node_modules — VALID=true, exit 0
материалы: пресет в ~/.dsh/.agent-presets/ не создавался (операция капитана, шаги 1–11 в README)
```
