---
id: 047
slug: spec-chain-dual-track
status: done
type: infra
created: 2026-10-02
updated: 2026-10-02
commit: 41e42d8
embedded_approve: rule 2 (исключение F5.0a: явная формулировка капитана «Создать spec 047 (infra, approved)» в задании 2026-10-02), rule 13 (исключение: правка .project/ORCH-RULES.md явно названа в задании), rule 6 не применяется — type: infra
commit_format: "docs(spec-047): dual-track spec-chain - Small/Full threshold table (rule 13)"
---

> **М6.0 — инфраструктура spec-фабрики, spec-chain v2.** Спека создана по прямому
> заданию капитана 2026-10-02 с embedded approve: правило 2 (исключение F5.0a,
> явная формулировка) для перевода в approved, правило 13 (исключение: правка
> `.project/ORCH-RULES.md` названа капитаном явно и по существу).
> Тип infra: правило 6 (approve превью) к самой спеке не применяется.

## Контекст

Сейчас цепочка spec-chain однопоточная и тяжёлая: любая спека идёт полный круг —
`enrich` (11 фаз, 40+ мин), MAS-команда из 4–6 ролей, `spec:close`. Для мелкой
правки в два файла это несоразмерно: основное время тратится на обряд, а не на
работу.

Проверка факта перед правкой (шаг 2 задания):

```powershell
Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг \d+ —'
```

Результат: 6 совпадений — Шаг 1, Шаг 2, Шаг 3, Шаг 4, Шаг 4a, Шаг 5. Шага 0 в
скилле **нет**: классификация Small/Full сегодня не существует, а раздел
«Двухтрековый режим» в `.project/ORCH-RULES.md` отсутствует. Порог `track` в
`.project/specs/README.md` тоже не объявлен.

Требование 5 задания фиксирует границу работы: решение по
`npm run spec:close -- --no-team` (расширение spec 038) в 047 **не входит** —
это отдельная спека. Здесь строится только малый трек с минимальным MAS.

Отдельная оговорка для прозрачности. Артефакт MAS-команды — два файла:
`.project/ORCH-RULES.md` и скилл цепочки. Третий файл задания —
`.project/specs/README.md` — это индексная документация папки спеков: по
сложившейся практике (spec 046 правил индексную документацию памяти рядом с
правкой скилла) такие файлы правит капитан, они не
входят в write-скоуп ни одной задачи и в счёт порога не идут. С учётом этой
границы по вводимому порогу прогон 047 — **Small**: два файла, дифф менее 50
строк, без `src/data/**`, без content и feature. Small подтверждается прямым
решением капитана, а не выводится из размера диффа.

## Цель

Ввести двухтрековый режим spec-chain (Small / Full) с таблицей порога в
`.project/ORCH-RULES.md`, Шагом 0 в `docs/spec-chain/skills/run-spec-chain/SKILL.md`
и полем `track` в `.project/specs/README.md`, чтобы мелкая инфраструктурная правка
проходила за 5–7 минут без enrich и с минимальной MAS-командой, а полный контур
сохранялся для content, feature и крупных правок.

## Что делаем

Правки ровно в трёх файлах, аддитивные и с минимальным диффом.

**1. `.project/ORCH-RULES.md` — новый раздел «Двухтрековый режим»**

Раздел добавляется после правила 16 (конец файла, append-only-логика не
нарушается). Содержание:

- Две петли: **Small** — enrich пропускается, MAS минимальный (1 builder,
  `kind=work`), закрытие через CLI закрытия спеки; целевое время 5–7 мин.
  **Full** — текущий контур целиком (enrich → MAS → закрытие).
- Таблица порога классификации: строка **Small** и строка **Full**.
  Small: правок файлов ≤ 2, строк диффа ≤ 50, без `src/data/**`, без `type:content`,
  без `type:feature`, без правок `.project/sync.mjs`, `.project/contracts/**` и
  самого `.project/ORCH-RULES.md`. Full: всё остальное.
- Инвариант: content и feature — **всегда** Full, независимо от размера диффа.
- Порог считается по фактическому диффу спеки; при расхождении оценки и факта
  трек повышается до Full (Small → Full допускается, обратно — нет).

**2. `docs/spec-chain/skills/run-spec-chain/SKILL.md` — Шаг 0**

- Новый подраздел `### Шаг 0 — Классификация Small/Full` **перед** Шагом 1
  (перед строкой `### Шаг 1 — Enrich спеки (11 фаз)`). Шаг 0 — **развилка**, а не
  шестой шаг конвейера: существующий инвариант «пять логических шагов» не
  меняется.
- Содержание Шага 0: вход (спека из `.project/specs/`), таблица порога (Small /
  Full), ветка Small (enrich пропускается, минимальный MAS: 1 builder с
  `kind=work`, STOP-точки не сокращаются ниже обязательных), ветка Full (цепочка
  без изменений), запись выбранного трека в отчёт прогона.
- «Карта цепочки» получает одну строку про развилку Small/Full на входе;
  существующие Шаги 1–5 не переписываются.
- В таблицу «Крайние случаи» добавляется строка про неоднозначную классификацию:
  трек повышается до Full, запуск не продолжается по догадке.

**3. `.project/specs/README.md` — поле `track`** (правит капитан, вне write-скоупов задач)

- В таблицу «Поля frontmatter» добавляется строка `track` со значениями
  `small` | `full`; поле необязательное, совместимо со спеками 001–046.

Порядок работ (правило 3): правки файлов → `npm run sync` → `git add` → коммит →
`npm run sync:check`.

## Критерии приёмки

1. В `.project/ORCH-RULES.md` есть раздел «Двухтрековый режим»: команда
   `Select-String -Path .project/ORCH-RULES.md -Pattern '^## .*Двухтрековый режим'`
   даёт ровно 1 совпадение → exit 0.
2. В разделе «Двухтрековый режим» есть таблица порога со строками Small и Full,
   и в ней названы все пять границ малого трека: число файлов, число строк,
   `src/data/**`, type:content, type:feature; content и feature объявлены всегда
   Full → exit 0 по проверке 2 блока «Проверка».
3. В `docs/spec-chain/skills/run-spec-chain/SKILL.md` есть раздел «Шаг 0»:
   `Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг 0 —'`
   даёт ровно 1 совпадение → exit 0.
4. Шаг 0 описывает развилку: малый трек пропускает enrich и запускает MAS из
   1 builder с kind=work, полный трек сохраняет enrich → MAS → закрытие
   спеки → exit 0 по проверке 4 блока «Проверка».
5. Шаг 0 содержит режим отказа: неоднозначная классификация → трек повышается
   до Full, enrich и полный MAS; по догадке прогон не продолжается → exit 0 по
   проверке 5 блока «Проверка».
6. В `.project/specs/README.md` в таблице «Поля frontmatter» есть строка `track`
   со значениями `small` и `full` → exit 0 по проверке 6 блока «Проверка».
7. Шаг 0 стоит перед Шагом 1: номер строки с `### Шаг 0 —` меньше номера строки
   с `### Шаг 1 —` → exit 0 по проверке 7 блока «Проверка».
8. Инвариант «пять логических шагов» сохранён: в
   `docs/spec-chain/skills/run-spec-chain/SKILL.md` заголовков вида
   `### Шаг <цифра> —` ровно 6 (Шаг 0 добавлен, Шаги 1–5 не переписаны) → exit 0
   по проверке 8 блока «Проверка».
9. Гейты прогона зелёные: `npm run typecheck` → exit 0, `npm run test:run` →
   exit 0, `npm run sync:check` → exit 0 после конвергентного коммита
   (правило 3 и правило 9).
10. Ревьюер прогона даёт verdict=pass по правкам трёх файлов → exit 0 по
    проверке 10 блока «Проверка».

## Что НЕ трогать

- `.project/scripts/`
- `.project/contracts/`
- `.project/sync.mjs`
- `.project/state.json`
- `tools/`
- `src/`
- `docs/spec-chain/skills/spec-enrich/SKILL.md`
- `docs/spec-chain/skills/spec-to-team/SKILL.md`
- `docs/spec-chain/README.md`
- `package.json`
- `.project/specs/0*.md` — все карточки спеков папки (в том числе закрытые);
  единственное исключение ниже — поле `track` в `.project/specs/README.md`,
  которое добавляет капитан
- пресет `~/.dsh/.agent-presets/linuxexam-spec-chain`: синхронизация reference-копии
  скилла с установленным пресетом — операция капитана, вне репозитория.

Решение по закрытию спеки без MAS-команды (расширение spec 038) в 047 не
делается: только малый трек с минимальным MAS. Push не выполняется
(правила 10 и 11).

## Декомпозиция

1. `id: t1` · `subject: Правки двух файлов — раздел «Двухтрековый режим» в .project/ORCH-RULES.md (таблица порога Small/Full, content и feature всегда Full) и Шаг 0 «Классификация Small/Full» в docs/spec-chain/skills/run-spec-chain/SKILL.md (перед Шагом 1, с развилкой и режимом отказа)` · `assignee: builder` · `dependencies: []`
2. `id: t2` · `subject: Ревью правок t1 — проверить критерии приёмки 1-9 и доказательства, вынести вердикт pass или needs_revision` · `assignee: reviewer` · `dependencies: [t1]`

Write-скоупы (без пересечений):

- t1 → `.project/ORCH-RULES.md`, `docs/spec-chain/skills/run-spec-chain/SKILL.md`
- t2 → правок нет (read-only ревью)
- `.project/specs/README.md` — артефакт капитана, вне write-скоупов задач

`track` прогона 047 — `small` по прямому решению капитана (см. «Контекст»);
закрытие через CLI закрытия спеки, решение про `--no-team` — отдельной спекой.

## Edge Cases

- **Дифф неоднозначен** (не хватает данных для оценки файлов или строк) → трек
  Full, enrich и полный MAS; прогон по догадке не продолжается.
- **Правка вышла за порог в процессе** (файлов стало больше двух, дифф вырос) →
  трек повышается до Full в отчёте прогона; Small не понижается задним числом.
- **type:content или type:feature** → Full всегда, размер диффа роли не играет
  (для content действует ещё и правило 6 — approve превью).
- **Правка `.project/ORCH-RULES.md`, `.project/sync.mjs`, `.project/contracts/`** →
  Full: эти зоны меняют контур оркестрации, а не текст.
- **Ревьюер вернул needs_revision** → закрытие спеки не запускается; правки идут
  новой задачей с тем же треком, вердикт перепроверяется.
- **enrich для Small недоступен или падает** → не блокер: малый трек его не
  вызывает; для Full действует прежний режим отказа Шага 1.

## Источники

- `.project/ORCH-RULES.md` — правила 2, 3, 6, 9, 10, 11, 13, 16 (редакция 2026-09-28).
- `.project/specs/038-close-spec-automation.md` — CLI закрытия спеки, откуда взята
  граница «решение про `--no-team` — отдельная спека».
- `.project/specs/040-spec-chain.md` — Компонент B, пять шагов цепочки и STOP-точки.
- `.project/specs/046-run-spec-chain-content-stop.md` — образец STOP-точки D и
  приём «STOP внутри Шага, а не шестой шаг».
- `AGENTS.md` — гейты `npm run typecheck`, `npm run test:run`.

## Проверка

```powershell
# 1. Раздел в ORCH-RULES: == 1
(Select-String -Path .project/ORCH-RULES.md -Pattern '^## .*Двухтрековый режим').Count
# 2. Порог: обе строки таблицы и все пять границ + «всегда Full»
(Select-String -Path .project/ORCH-RULES.md -Pattern '^## .*Двухтрековый режим$').LineNumber
Select-String -Path .project/ORCH-RULES.md -Pattern 'src/data/\*\*'
Select-String -Path .project/ORCH-RULES.md -Pattern 'всегда Full'
# 3. Шаг 0 в скилле: == 1
(Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг 0 —').Count
# 4. Развилка описана
Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern 'kind=work'
Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern 'enrich пропускается'
# 5. Режим отказа Шага 0
Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern 'трек повышается до Full'
# 6. Поле track в README спеки: == 1
(Select-String -Path .project/specs/README.md -Pattern '^\| `track` \|').Count
# 7. Шаг 0 идёт перед Шагом 1
(Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг 0 —').LineNumber
(Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг 1 —').LineNumber
# 8. Инвариант «пять шагов»: == 6
(Select-String -Path docs/spec-chain/skills/run-spec-chain/SKILL.md -Pattern '^### Шаг \d+ —').Count
# 9. Гейты
npm run typecheck
npm run test:run
npm run sync:check
# 10. Вердикт ревьюера прогона
node .project/scripts/close-spec.mjs 047 --dry-run
```

## Отчёт капитану

1. Создана спека 047 (infra, approved по embedded approve правила 2) и три правки:
   раздел «Двухтрековый режим», Шаг 0, поле `track`.
2. Диффы трёх файлов и сырые exit-коды гейтов.
3. Вердикт ревьюера прогона (t2) и список changedPaths.
4. Расхождение: спека правит три файла → по новому порогу это Full, но прогон
   047 идёт малым треком по прямому решению капитана (зафиксировано в «Контексте»).
5. Что осталось капитану: синхронизировать reference-копию скилла с пресетом
   (операция капитана); push — отдельная per-command авторизация (правила 10 и 11).
