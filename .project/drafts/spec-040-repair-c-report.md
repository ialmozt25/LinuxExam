# spec 040 — отчёт ремонта C (t10, раунд 2)

> Задача: устранить находку **F4** qc-раунда 1 — вход Шага 3 reference-скилла
> `run-spec-chain` ссылается на `roster.yaml` «рядом со скиллом `spec-to-team`»,
> которого в репозитории нет; выбор ролей оставался импровизацией.
> Исполнитель: builder-orchestrator. Attempt: 1
> (`e36b274d-c4dd-4f78-a228-a872aa6e977d`).
> Источник находки: `.project/drafts/spec-040-qc-report.md`, §5 «F4 — `roster.yaml`
> для `spec-to-team` отсутствует в репозитории (severity: medium)», строки 273–285;
> сводка — строка 355.

```
verdict: pass
files: docs/spec-chain/skills/run-spec-chain/SKILL.md            (правка, 298 → 329 строк)
       .project/drafts/spec-040-repair-c-report.md               (этот отчёт)
       drafts/_mas-results/spec-040/t10/f4-verify.txt            (артефакт: дословная верификация)
       drafts/_mas-results/spec-040/t10/f4-step3-after.txt       (артефакт: Шаг 3 после правки)
```

## 1. Что изменено (4 правки, один файл)

| # | Место (после правки) | Было | Стало |
|---|---|---|---|
| 1 | строка 28, таблица «## Входы» | `\| роли и модели \| `roster.yaml` рядом со скиллом `spec-to-team` \|` | `\| роли и модели \| `~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team/roster.yaml` (вне репо); если недоступен — fallback-дефолт ростера из Шага 3 \|` |
| 2 | строки 152–153, Шаг 3 «Вход» | «`**Вход.**` Approve Шага 2; спека `approved`; `roster.yaml`; snapshot гейтов.» | «`**Вход.**` Approve Шага 2; спека `approved`; ростер ролей и моделей (см. блок ниже); snapshot гейтов.» |
| 3 | строки 155–181, Шаг 3, новый блок «**Источник ролей и моделей (устранение F4).**» | — | фактический путь `roster.yaml` + команда `Test-Path` + самодостаточный fallback-дефолт (6 ролей: provider/model/reasoning_effort) + правило выбора по `type` |
| 4 | строки 186–190, Шаг 3, пункт 1 действий | «выбрать роли по `roster.yaml` (infra/feature → …)» | «выбрать роли по ростеру из блока выше (фактический путь пресета или fallback-дефолт; состав по типу: …)» |
| 5 | строка 299, «## Крайние случаи» | — | «\| ростер недоступен по пути пресета (`Test-Path` → `False`) \| не STOP: взять fallback-дефолт ростера из Шага 3 (роли + модели + reasoning_effort) и пометить это в плане на STOP-точке B \|» |

Итог: формулировка «`roster.yaml` **рядом со скиллом** `spec-to-team`» из файла
удалена (грепом по SKILL.md — 0 совпадений). Размер: 298 → 329 строк (норма
150–350 соблюдена), UTF-8 без BOM, LF (crlf=0).

## 2. Достижимый источник ролей (улика)

Ростер физически лежит в пресете-владельце скилла `spec-to-team` **вне
репозитория**; в этом окружении он существует:

```
> Test-Path 'C:\Users\Alexey Udotov\.dsh\.agent-presets\linuxexam-orchestrator\skills\spec-to-team\roster.yaml'
True
> Test-Path ~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team/roster.yaml
True
```

Содержимое (35 строк, `provider: deepseek-official`), перенесённое в SKILL.md
как fallback-дефолт:

| Роль | provider | model | reasoning_effort |
|---|---|---|---|
| architect | deepseek-official | deepseek-v4-pro | high |
| builder | deepseek-official | deepseek-v4-flash | high |
| tester | deepseek-official | deepseek-v4-flash | high |
| reviewer | deepseek-official | deepseek-v4-pro | high |
| writer (content) | deepseek-official | deepseek-v4-flash | high |
| qc (content) | deepseek-official | deepseek-v4-pro | high |

В SKILL.md попало и правило допустимых уровней (`off`/`low`/`high`/`max`;
`medium` для pro не поддерживается — «Известные проблемы» скилла `spec-to-team`),
состав ролей по `type` спеки и требование: любая иная комбинация ролей/моделей —
только с approve капитана на STOP-точке B. Импровизация в выборе моделей
запрещена явным текстом.

Ответ на находку F4 — **двойной** (как и предлагал `requiredFix`): указан
фактический путь (проверяемый `Test-Path` → `True`) **и** зафиксирован
самодостаточный fallback-дефолт на случай, когда пресет не установлен (другая
машина, свежий клон). Fallback не является STOP-условием: цепочка продолжается,
но в плане на STOP-точке B источник ростера виден капитану.

## 3. Почему не появился `roster.yaml` в репо

- Скилл `spec-to-team` в репозитории не хранится и спекой 040 не предусмотрен:
  reference-копии по Компоненту C — только `spec-enrich` и `run-spec-chain`
  (`docs/spec-chain/skills/<name>/SKILL.md`), а сам пресет — операция капитана
  вне репо. Копировать чужой файл пресета в репо задача t10 не уполномочена
  (inScope — один SKILL.md и артефакты), поэтому выбран путь «указать
  фактический источник + fallback».
- Проверка остатков формулировки вне SKILL.md: грепом по репо фраза «рядом со
  скиллом» больше не встречается ни в `.md` вне `.project/drafts/**` (в
  `spec-040-qc-report.md:276` она осталась как цитата находки — это отчёт qc,
  править его задача t10 не уполномочена). В `docs/spec-chain/README.md` и
  `docs/spec-chain/agent.cordis.yml` упоминаний `roster` нет вообще
  (`Select-String -Pattern 'roster'` → 0 совпадений), поэтому править их не
  потребовалось; они, кроме того, вне inScope.

## 4. Верификация (дословный вывод)

Полный лог — `drafts/_mas-results/spec-040/t10/f4-verify.txt`. Ключевые строки:

```
Test-Path ~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team/roster.yaml -> True
(Select-String -Path 'docs/spec-chain/skills/run-spec-chain/SKILL.md' -Pattern '^### Шаг ').Count -> 5
verify exit: PASS
Test-Path 'docs/spec-chain/skills/run-spec-chain/SKILL.md' -> True
matches 'рядом со скиллом' in SKILL.md -> 0
STOP-точка A/B/C occurrences: 7
mapping rows ^| N | = 8
lines=329 crlf=0 bom=False
```

Заголовки шагов (ровно 5, формат «`### Шаг N — <Name>`», N = 1..5, U+2014):

```
### Шаг 1 — Enrich спеки (11 фаз)
### Шаг 2 — STOP-точка A: approve обогащённой спеки
### Шаг 3 — /spec-to-team: план MAS + STOP-точка B
### Шаг 4 — Исполнение MAS-команды
### Шаг 5 — close-spec + STOP-точка C: отчёт и push-авторизация
```

Сохранность требований t3 (регрессия не внесена):

- три STOP-точки A/B/C на месте (Шаг 2 → A, Шаг 3 → B до `agent_teams_create`,
  Шаг 5 → C + push-авторизация) и сводная таблица STOP-точек не изменена;
- таблица маппинга «пункт Компонента B (1–8) → шаг скилла (1–5)» не изменена:
  8 строк `^| N | `, покрытие 8/8;
- обязательные блоки шагов (Вход / Команда-действие / Ожидаемый результат /
  Условие продолжения / Режим отказа (STOP)) — в Шаге 3 все пять на месте, блок
  «Источник ролей» вставлен между «Вход» и «Команда / действие»;
- запрет push для агента (правила 10/11) не затронут.

Дословный текст Шага 3 после правки — артефакт
`drafts/_mas-results/spec-040/t10/f4-step3-after.txt` (строки 150–191).

## 5. Оговорки

1. Правки — только в `docs/spec-chain/skills/run-spec-chain/SKILL.md` (inScope).
   `.project/scripts/**`, `docs/spec-chain/skills/spec-enrich/**`,
   `docs/spec-chain/README.md`, `docs/spec-chain/agent.cordis.yml`,
   `.project/specs/**`, `src/**`, `tools/**`, `package.json` не тронуты.
   Артефакты — только в `drafts/_mas-results/spec-040/t10/`.
2. Гейты `typecheck` / `test:run` / `sync:check` не запускались: правок кода и
   JSON нет, изменён один markdown-файл вне сборки.
3. **F4 закрыта только для Шага 3 SKILL.md.** Отчёт qc `spec-040-qc-report.md`
   (строка 276) упоминает `docs/spec-chain/README.md` как второй файл находки,
   но фактической формулировки «рядом со скиллом» там нет (грепом — 0); если
   ревьюер считает нужным добавить в README путь пресета явно, это отдельная
   задача вне inScope t10.
4. **F5 (соседняя находка qc) остаётся открытой и t10 не закрывается:** в
   `.agent-teams/spec-040-spec-chain/team.json` задача `t7` (kind `review`) без
   assignee, из-за чего `npm run spec:close -- 040 --dry-run` → `exit 2`. Правка
   — за капитаном (`reassign_task` t7 на участника роли reviewer). На текст
   Шага 5 это не влияет, но dry-run цепочки до правки останется красным.
