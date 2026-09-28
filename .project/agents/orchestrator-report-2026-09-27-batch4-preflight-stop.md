# Orchestrator report — M2.9 batch 4 (file_management) — PRE-FLIGHT STOP

## 2026-09-27 · Orchestrator

### Goal
Банк 183 → 189: +6 вопросов по канонической теме «управление файлами»
(spec `001-file-management-batch-4`, status draft). Пайплайн Writer → QC → Orchestrator,
превью `.project/drafts/batch-4-preview.md`, коммит только после approve капитана.

### Pre-flight (spec §Pre-flight)

| # | Проверка | Ожидание spec | Факт | Итог |
|---|---|---|---|---|
| 1 | HEAD | `e01cd02` (M4.0) | `e01cd02` | OK |
| 1 | `git status --porcelain` | пустой | 15 untracked путей, 0 modified | **РАСХОЖДЕНИЕ** |
| 2 | `.project/specs/README.md` frontmatter | совместим | id/slug/status/type/created/updated/commit — полное совпадение | OK |
| 3 | Канон темы | `file_management` | `file_management` (topics.ts:22, title «Управление файлами») | OK |
| 4 | ID-префикс `fm_` свободен | свободен | **занят**: `fm_001`..`fm_012` (file_management.json, n=12). Следующий свободный — `fm_013` | **РАСХОЖДЕНИЕ** |
| 5 | Банк до старта = 183 | 183 | 183 (прямой пересчёт + `_topics.json.total`) | OK |

Дополнительно: `.project/contracts/` содержит все 3 контракта
(`orchestrator_to_writer.yaml` 767 B, `writer_to_qc.yaml` 1927 B,
`qc_to_orchestrator.yaml` 1322 B) — OK.

### Расхождение A — `npm run shuffle` не существует (блокер гейта)

Гейт из §Критерии приёмки («`npm run shuffle` exit 0») неисполним:

```
npm error Missing script: "shuffle"
[exit code: 1]
```

Фактические скрипты (`package.json`): `qc`, `shuffle-bank` (`--apply`),
`shuffle-bank:check` (`--check`), `manifest`, `sync`, `sync:check`,
`typecheck`, `test:run`, `build`, `cosine:intra`, `lang-scan` отсутствует,
прочие. Скрипта `shuffle` нет ни в одном виде.

DOD.md (раздел `content`) требует ровно два банк-гейта: `npm run qc` (Fails 0)
и `npm run shuffle-bank:check`. Т.е. **spec противоречит DOD**: DOD знает
`shuffle-bank:check`, spec — несуществующий `shuffle`. Скорее всего, опечатка в spec.

Также spec в списке гейтов **не упоминает `npm run qc`**, хотя DOD `content`
делает его обязательным (Fails 0).

### Расхождение B — `git status --porcelain` не пустой

Все 15 записей — untracked (`??`), ни одного modified/staged:

```
?? .project/drafts/m2.9-batch1-{integration-risks.md,pipeline.mjs,qc-input.yaml,qc-output.yaml,writer-input.yaml,writer-output.yaml}
?? .project/drafts/m2.9-batch2-{qc-input,qc-output,writer-input,writer-output}.yaml
?? .project/drafts/m2.9-batch3-{qc-input,qc-output,writer-input,writer-output}.yaml
?? drafts/_mas-results/
```

Это артефакты предыдущих батчей MAS. `.project/drafts/` не в `.gitignore`
(в нём игнорируются только `cleanup-*.txt`), из двух файлов каталога
отслеживаются только `cleanup-2026-09-26.txt` и `m2.8g-decision.yaml`.
Т.е. конвенция проекта — рабочие входы/выходы батчей остаются untracked.

Функциональный риск = 0: ни один путь не лежит в `src/`, `tools/` или `docs/`,
сборка/тесты/диффартефакты не затронуты. Но условие pre-flight «пустой
porcelain» формально не выполнено — по правилу spec это доклад, а не тихое
продолжение. Удалять/коммитить чужие артефакты без указания капитана не стал.

### Расхождение C — avoid-list отсутствует в обоих источниках

Spec §Источники: «взять из `.project/log.md` (последние 30 строк) + из `STATE.md`
(раздел про avoid-list). **Если в обоих пусто — доклад, не угадывать.**»

- `.project/log.md` — 8 строк всего; последняя запись
  `2026-09-27 | M4.0 | solid base + dev center | commit pending`. Упоминаний
  avoid-list нет.
- `.project/STATE.md` — 57 строк, раздела про avoid-list нет вообще.
- Поиск `avoid` по всему `.project/` даёт совпадения только в untracked
  артефактах батчей 1–3 (`.project/drafts/m2.9-batchN-writer-input.yaml`,
  `m2.9-batch3-qc-input.yaml`), т.е. в самом spec-таске как источник не заявлен.

Проверка «известного avoid-list» из spec по фактическому банку:

```
OK      ds_002 (deploy_systems)      MISSING ds_014      OK  rs_001 (running_systems)
OK      pm_014 (process_management)  OK  pm_010         OK  fs_005 (file_systems)
OK      fs_006 (file_systems)        OK  fs_013         OK  ls_002 (local_storage)
OK      ls_005 (local_storage)       OK  ls_007
```

`ds_014` **не существует** (deploy_systems = `ds_001`..`ds_013`, n=13) —
запись в списке no-op. Т.е. список пригоден, но требует подтверждения:
11 ID из spec ≠ проверенный против банка канонический список.

### Расхождение D — конфликт «Что НЕ трогать» с гейтом `test:run`

Guard-тест `src/data/questions/__tests__/positional-distribution.test.ts:30`
хардкодит `EXPECTED_QUESTIONS = 183` и на строке 67 делает
`expect(total).toBe(EXPECTED_QUESTIONS)`. При банке 189 тест падает.

Чтобы гейт «`npm run test:run` exit 0» прошёл, файл обязан быть изменён
(183 → 189 + строка в комментарии-летописи строк 22–28, где уже перечислены
батчи). Но spec §Что НЕ трогать: «`src/data/questions/*` — только добавление
новых файлов». Правка существующего теста — не «добавление файла».

**Критерии приёмки и «Что НЕ трогать» взаимоисключающи.** Нужно решение
капитана; сам править не стал.

### Расхождение E — spec не сохранён как файл (minor)

Spec `001-file-management-batch-4` пришёл в чате; в `.project/specs/` только
`README.md`, `SPEC.md` говорит «Спек: 0 / Спек пока нет». Правило 1
оркестратора — «без spec — нет задачи». Требуется решение: сохранить
`.project/specs/001-file-management-batch-4.md` (+ `npm run sync`) или нет.

### Расхождение F — state-файлы показывают устаревший HEAD (minor)

`STATE.md:6` и `STATE.md:44` показывают HEAD `3dcd59a3f88c90f5cdd2b4dc4ada56cec1d6adf0`,
фактический HEAD — `e01cd02`. Коммит `3dcd59a3` существует (`git log` →
«M4.0: solid base — state.json source of truth + sync + dev center»), т.е. это
тот же коммит, но указан полный SHA и он отстаёт от текущего. По DECISIONS
(2026-09-26, «STATE.md — изменение политики») хардкод HEAD должен был быть
убран в пользу даты sync — но поле в `state.json`/`STATE.md` осталось.

### Что НЕ сделано (осознанно)

Задача остановлена на pre-flight. Ни один вопрос не сгенерирован, Writer и QC
не запускались, файлы банка не тронуты, коммита нет, push нет.

### Blockers

1. `npm run shuffle` не существует → гейт неисполним без решения капитана
   (A).
2. avoid-list отсутствует в обоих заявленных источниках, а «известный» список
   содержит несуществующий `ds_014` (C).
3. guard-тест `EXPECTED_QUESTIONS` конфликтует с «Что НЕ трогать» (D).
4. porcelain не пустой (B), spec не сохранён (E), устаревший HEAD в state (F) —
   minor, но формально расхождения.

### Next Steps

1. Капитан подтверждает/правит: гейт `shuffle` → `shuffle-bank:check` (+ `qc`),
   avoid-list, право правки guard-теста, судьба untracked-артефактов,
   сохранять ли spec-файл.
2. После ответов — снять блокеры и запустить пайплайн batch 4:
   Writer (6 кандидатов, `fm_013`..`fm_018`, topic `file_management`) → QC
   (ratio, cos против всего банка, cos intra, дистракторы, explanation) →
   превью `.project/drafts/batch-4-preview.md` → approve капитана → коммит
   `M2.9 batch 4: file_management +6 (183→189)` → `npm run sync:check`.
