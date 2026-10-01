# spec 040 / t11 — отчёт qc раунда 2 (ratification by re-execution)

**Задача:** t11 — повторная независимая верификация ремонтов F2/F3/F4/F6/F7/F8
(после t8/t9/t10) + уточнённый критерий sync:check.
**Исполнитель:** qc (роль qc — не builder; закрывает отклонение раунда 1, где
t6 исполнял участник роли builder, критерий приёмки 14).
**Режим:** ratification by re-execution — все находки перепроверены собственными
фикстурами и стенд-раннером qc; evidence исполнителей t8/t9/t10 не переиспользовался.
**Дата:** 2026-10-01 (сессия DSH).
**Вердикт задания:** `pass` — F2/F3/F4/F6/F7/F8 закрыты; sync:check подтверждён
по уточнённой редакции. F1 (sync:check) закрыт в уточнённой редакции критерия,
F5 (assignee t7) остаётся за капитаном и в скоуп t11 не входит.

---

## 1. Что и чем перепроверялось

| Находка | Артефакт | Прогон qc | Результат |
|---|---|---|---|
| F7 (m02) | `.project/scripts/validate-spec.mjs` | фикстура `907-qc-m02.md` (id 900/slug mismatch vs имя файла) | FAIL m02 диагностика, exit 0 |
| F7 (A2) | то же | `905-qc-brokenfm.md` (нет `---`) | `[FAIL (hard-fail)] m01`, exit 1 |
| F7 (A3) | то же | `906-qc-orphan.md` (сирота кр.2) | HARD-FAIL traceability, exit 1 |
| F2 (1) | `.project/scripts/enrich-spec.mjs` | `902` + stub `--mode criteria-edit` | правка критерия НЕ применена, фаза warn, exit 0 |
| F2 (2) | то же | `903` + stub `--mode intent-change` | INTENT-CHANGED → hard-fail + rollback, exit 1 |
| F3 | то же | `901` + stub (sources без маркера) | `[enriched:` injected (grep), exit 0 |
| F6 | SKILL.md + enrich | `904` + stub `--mode mclass` | m04/m06/m07 сняты, score 95 → 95 (delta 0) |
| F8 | SKILL.md + `--help` + enrich | dry-run hard-fail / apply Фаза 10 / недоступный раннер | 1 / 1 / 0 |
| F4 | run-spec-chain SKILL.md | Test-Path roster + подсчёт заголовков/STOP | True; 5 «### Шаг »; STOP A/B/C на месте |
| sync:check | `.project/sync.mjs` | изолированная копия HEAD 09448a5 | sync → add → commit → check exit 0 |
| t6 (базовое) | ядро + CLI + скиллы + гейты | `901` (3 дефекта), `test:run`, `node --check` | см. §3 |

Все артефакты qc созданы самостоятельно в `drafts/_mas-results/spec-040/t11/`:
7 фикстур + `stub-qc.mjs` (собственный стенд-раннер) + `run-*/` каталоги
прогонов + `evidence-*.txt`. Артефакты t8/t9/t10 (`t8/**`, `t9/**`, `t10/**`,
`t4-cli/**`) не читались и не переиспользовались.

---

## 2. Матрица критериев t11

| # | Критерий | Статус | Доказательство |
|---|---|---|---|
| 1 | Каждая находка F2/F3/F4/F6/F7/F8 проверена собственным прогоном qc | **PASS** | §4, таблица «находка → улика» |
| 2 | F2: правка «Критерии приёмки» НЕ применяется, нет hard-fail Фазы 10; intent иным способом → hard-fail + rollback Фазы 9 | **PASS** | `902` exit 0, intent_blocked; `903` exit 1, rollback |
| 3 | F3: sources без маркера → `[enriched:` в спеке (grep) или warn в run-log | **PASS** | grep `spec-final.md` → 1 маркер |
| 4 | F4: Шаг 3 ссылается на достижимый вход (Test-Path True) или fallback самодостаточен; 5 «### Шаг » и STOP A/B/C | **PASS** | Test-Path True; 5 шагов; 7 STOP-вхождений |
| 5 | F6: ограничения рубрики Фазы 0 в SKILL.md согласуются с score (прогон m04/m06/m07) | **PASS** | SKILL.md:170–183; `904` delta 0 |
| 6 | F7: m02 → диагностика exit 0; нечитаемый frontmatter и сирота → exit != 0 | **PASS** | 907 exit 0; 905/906 exit 1 |
| 7 | F8: таблица exit-кодов SKILL.md/`--help` совпадает с фактическими кодами | **PASS** | §4.8 |
| 8 | sync:check (уточнённый): изолированная копия sync→add→commit → exit 0; дрейф голого checkout pre-existing | **PASS** | §5 |
| 9 | Все критерии t6 (в уточнённой редакции п.7) подтверждены повторно | **PASS** | §3 |
| 10 | Отчёт содержит матрицу, статус F1–F8, итоговый verdict | **PASS** | этот файл, §7 |

---

## 3. Повторная сверка критериев t6

1. **Ядро находит 3 дефекта с id/строкой** — `901-qc3defects.md`:
   `m04 @46` (t2: неизвестная зависимость t9), `m06 @30`
   (`no-such-qc-script.mjs`), `m07 @18/@19` (TBD) — все с id и строкой
   (`evidence-901-validate.txt`).
2. **11 фаз** — apply-прогон `901`: Фазы 0,1,4 (детерминированные) + Фазы
   2,3,5,6,7,8,9×2,10 отчитались в `run-log.jsonl` (9 LLM-вызовов).
3. **delta > 0 на измеримом классе** — `901`: score 89 → 95 (**+6**) от правки
   vague term «Сборка идёт быстро.» → измеримая формулировка (Clarity 76→100).
4. **Отдельная запись Фазы 10 ≠ Фазы 6** — `run-log.jsonl`: `6-adversarial |
   stub-qc-critic-1` vs `10-external-audit | stub-qc-auditor-1` (разные phase и
   model); `prompt_hash` различается.
5. **11 «### Фаза »** (`spec-enrich/SKILL.md`) = 11; **5 «### Шаг »**
   (`run-spec-chain/SKILL.md`) = 5.
6. **test:run** — 28 файлов / 198 тестов, exit 0 (68.94s).
7. **Правок вне inScope нет** — `git diff --name-only` = только `package.json`
   (чужая правка t4); `git status --short` по `.project/specs`,
   `.project/sync.mjs`, `close-spec.mjs`, `run-spec.mjs`,
   `check-consistency.mjs`, `src`, `tools` — пусто. Все правки qc — только в
   `drafts/_mas-results/spec-040/t11/` и отчёт.

---

## 4. Находки → улика (сырые прогоны)

### 4.1 F7 — m02 диагностика без hard-fail

```
$ node .project/scripts/validate-spec.mjs drafts/_mas-results/spec-040/t11/907-qc-m02.md
[FAIL] m02 id/slug спеки согласованы с именем файла
  …:2 — frontmatter id: 900 != имя файла 907
  …:3 — frontmatter slug: qc-m02-mismatch != имя файла qc-m02
Сироты: цели 0, критерии 0, задачи 0
Результат: PASS (exit 0)        ← F7 устранён
```

### 4.2 F7 — нечитаемый frontmatter и сирота по-прежнему hard-fail

```
$ …/905-qc-brokenfm.md   → [FAIL (hard-fail)] m01 …:1 — нет открывающего `---`; exit 1
$ …/906-qc-orphan.md     → HARD-FAIL критерий 2 (стр. 41): нет покрытия задачей; exit 1
```

### 4.3 F2 — правка критерия отклоняется структурно (нет hard-fail Фазы 10)

```
$ node .project/scripts/enrich-spec.mjs …/902-qc-criteria.md --out …/run-902 \
    --llm-cmd "node …/stub-qc.mjs --mode criteria-edit"
Фаза 9 — Repair loop: warn (model: stub-qc-v1)
Score: 90 → 90 (delta +0)
Правок применено: 1          ← это гарантия маркера F3, НЕ правка критерия
Отклонено структурной защитой intent (F2): 1
WARN [intent-protected — секция «Критерии приёмки» (стр. 56): правка не применена; дефект класса m11/m13 требует отдельного решения]
Итог: прогон завершён
exit=0
```

Сверка спеки после прогона: строка «3. Фабрика работает корректно (задача t1).»
осталась (grep → 1), целевая правка «…печатает score… delta > 0» отсутствует
(grep → 0). `run-log.jsonl` Фазы 9: `status:"warn"`,
`intent_blocked:[{section:"Критерии приёмки", line:56}]`.

### 4.4 F2 (вторая половина) — INTENT-CHANGED сохраняет hard-fail + rollback

```
$ …/903-qc-intent.md --out …/run-903 --llm-cmd "node …/stub-qc.mjs --mode intent-change"
Фаза 9 — Repair loop: ok    (правка TBD применена)
Фаза 10 — External audit: ok (model: stub-qc-auditor-1)
WARN Фаза 10: INTENT-CHANGED → hard-fail, правки Фазы 9 откатаны (rollback)
Итог: HARD-FAIL — external audit зафиксировал изменение intent
exit=1
```

Сверка `spec-final.md`: «Порог спеки: TBD.» восстановлен (правка Фазы 9
откатана), при этом «Сборка занимает не более 2 секунд…» сохранена (правки
Фаз 3/5 уцелели) — rollback затронул ровно правки Фазы 9.

### 4.5 F3 — CLI вставляет маркер, когда раннер отдал sources без маркера

```
$ …/901-qc3defects.md --out …/run-901 --llm-cmd "node …/stub-qc.mjs --mode fix"
Фаза 2 — Research + enrichment: ok (model: stub-qc-v1)
Score: 89 → 95 (delta +6)
Гарантия маркера обогащения (F3): injected
exit=0

$ grep -n '\[enriched:' …/run-901/spec-final.md
- ESM-модули Node.js [enriched: https://nodejs.org/api/esm.html|Tier 1|2026-10-01]
```

### 4.6 F6 — устранение m04/m06/m07 не меняет score (delta = 0)

```
$ …/904-qc-mclass.md --out …/run-904 --llm-cmd "node …/stub-qc.mjs --mode mclass"
Score: 95 → 95 (delta +0)
exit=0
```

`score-before.json`: m04 FAIL, m06 FAIL, m07 WARN (12P/2F/1W), score 95 →
`score-after.json`: 15P/0F/0W, score 95. Формулировка SKILL.md (Фаза 0,
«Что НЕ влияет на baseline score», m04/m06/m07/m08/m09/m10) согласуется.

### 4.7 F4 — Шаг 3 ссылается на достижимый вход + самодостаточный fallback

```
> Test-Path ~/.dsh/.agent-presets/linuxexam-orchestrator/skills/spec-to-team/roster.yaml
True   (35 строк, provider deepseek-official)

grep '^### Шаг '  run-spec-chain/SKILL.md  → 5
grep '^### Фаза ' spec-enrich/SKILL.md     → 11
STOP-точка A/B/C вхождений                 → 7
grep 'рядом со скиллом' run-spec-chain/SKILL.md → 0
```

Fallback-дефолт в Шаге 3 самодостаточен: 6 ролей
(architect/builder/tester/reviewer/writer/qc) с provider `deepseek-official`,
model `deepseek-v4-pro|flash`, reasoning_effort `high` + правило состава по
`type` + допустимые уровни `off/low/high/max`. «Крайние случаи»:
«ростер недоступен → fallback, не STOP».

### 4.8 F8 — таблица exit-кодов совпадает с фактическими кодами

| Класс | Ожидание (SKILL.md/`--help`) | Факт |
|---|---|---|
| dry-run hard-fail (сирота) | exit 1 | `906 --dry-run` → 1 |
| dry-run hard-fail (frontmatter) | exit 1 | `905 --dry-run` → 1 |
| apply hard-fail Фазы 10 (INTENT-CHANGED) | exit 1 | `903` → 1 |
| недоступный раннер | exit 0 | `901 --llm-cmd "node -e process.exit(1)"` → 0, 8× WARN `[llm: unavailable — …]`, `status: skipped` |
| intent-protected (F2) | exit 0 | `902` → 0 |
| m-class only (delta 0) | exit 0 | `904` → 0 |
| нет `<spec>` / спека не найдена | exit 2 | без аргумента → 2; `999-no-such.md` → 2 |

---

## 5. sync:check (уточнённый критерий 12)

**Изолированная копия (клон HEAD `09448a5`, `%TEMP%/t11-isocopy`):**

```
# 1) голый checkout — дрейф pre-existing (mtime state.json + относительное время)
$ node .project/sync.mjs --check
SYNC DRIFT: state.json и производные разошлись
  - docs\index.html отстал от state.json — нужен npm run sync
  - state.json/производные изменены и не закоммичены — sync → git add → commit
exit=2                     # git status при этом чистый → дрейф в самом HEAD

# 2) npm run sync → git add → git commit
$ npm run sync            → state.json: обновлён; sha256 docs/index.html: e9489ac76f5a2829 (exit 0)
$ git add .project/state.json docs/index.html && git commit   (2 files, 66/68)
$ npm run sync:check
sync: ok (check) — производные совпадают с источником, HEAD 7dc45c4…
consistency: OK (0 findings)
exit=0                     # ← после фиксации гейт зелёный
```

**Рабочее дерево прогона:** `npm run sync:check` → exit 2 «state.json/производные
изменены и не закоммичены» — это **по построению** (правило 3/spec 009:
производные должны быть закоммичены). Фиксируется как статус, не как fail.

**Классификация дрейфа** (воспроизведение round 1): `.project/state.json`
хранит mtime файлов спек; после checkout клона mtime меняются, `docs/index.html`
пересобирается с другими числами, и `--check` видит «изменено». Дрейф не
порождён правками spec 040 (воспроизводится на чистом клоне `09448a5`).

---

## 6. Сводка по находкам F1–F8

| id | Находка | Статус | Где закрыто |
|---|---|---|---|
| F1 | sync:check красный на чистом HEAD | **закрыто (уточнённый критерий)** | §5: изолированная копия → exit 0; дрейф pre-existing |
| F2 | правки критериев откатывались Фазой 10 | **закрыто** | §4.3/4.4: intent-protected (exit 0) + INTENT-CHANGED rollback (exit 1) |
| F3 | CLI не гарантировал `[enriched:` | **закрыто** | §4.5: injected + grep |
| F4 | roster.yaml недостижим в Шаге 3 | **закрыто** | §4.7: Test-Path True + fallback-дефолт |
| F5 | spec:close не видит reviewer (t7 без assignee) | **вне скоупа t11** (операция капитана `reassign_task` t7 на reviewer) | — |
| F6 | score delta не реагирует на m04/m06/m07 | **закрыто** | §4.6: SKILL.md согласовано, delta 0 |
| F7 | m02 давал hard-fail за имя файла | **закрыто** | §4.1/4.2: m02 exit 0; frontmatter/сирота exit 1 |
| F8 | неоднородная политика exit-кодов | **закрыто** | §4.8: таблица = фактические коды |

**Наблюдение (accepted-low, вне скоупа правки):** человекочитаемый отчёт
`validate-spec.mjs` (примечание после Фазы 1) содержит устаревшую формулировку
«Hard-fail дают только сироты traceability (Фаза 4) и нечитаемый frontmatter
(m01/m02)» — `m02` больше не даёт hard-fail. Машиночитаемый контракт (JSON
`severity`) и exit-политика корректны; расходится только этот текст примечания.
Правка — в `validate-spec.mjs` (вне inScope t11), отдельной строкой: заменить
`(m01/m02)` на `(m01)`. Не блокирует приёмку.

---

## 7. Итоговый verdict

- **verdict: `pass`** — F2/F3/F4/F6/F7/F8 закрыты собственными прогонами qc;
  sync:check подтверждён по уточнённой редакции (изолированная копия exit 0);
  критерии t6 повторно подтверждены.
- Все verify-гейты зелёные: `npm run test:run` = 28/198 exit 0;
  `node --check validate-spec.mjs` = 0; `node --check enrich-spec.mjs` = 0.
- Правки qc — только в `drafts/_mas-results/spec-040/t11/` и в этом отчёте;
  вне inScope (`src/**`, `tools/**`, `.project/specs/**`, `.project/sync.mjs`,
  `.project/scripts/**`, `docs/**`, `package.json`) изменений нет.

---

## 8. Артефакты qc (inScope)

Каталог `drafts/_mas-results/spec-040/t11/`:

| Файл | Что это |
|---|---|
| `stub-qc.mjs` | собственный детерминированный стенд-ин LLM-раннера (режимы fix/criteria-edit/intent-change/mclass) |
| `901-qc3defects.md` + `pristine/` | 3 дефекта (m04/m06/m07) + измеримый (vague) — t6 и delta |
| `902-qc-criteria.md` | m11-критерий — F2 (intent-protected) |
| `903-qc-intent.md` | TBD + vague — F2 (INTENT-CHANGED rollback) |
| `904-qc-mclass.md` | только m04/m06/m07 — F6 (delta 0) |
| `905-qc-brokenfm.md` | нечитаемый frontmatter — F7 A2 |
| `906-qc-orphan.md` | сирота критерия — F7 A3 |
| `907-qc-m02.md` | расхождение id/slug — F7 A1 |
| `evidence-*.txt` | сырые выводы прогонов (ядро, apply, dry-run, nollm, usage) |
| `run-901/`, `run-902/`, `run-903/`, `run-904/`, `run-nollm/` | каталоги прогонов (report.md, run-log.jsonl, score до/после, spec-original/final) |

Временная изолированная копия `%TEMP%/t11-isocopy` удаляется по завершении
(использовалась только для проверки sync:check).
