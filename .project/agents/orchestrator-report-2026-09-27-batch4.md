# Orchestrator report — M2.9 batch 4 (file_management, банк 183 → 189)

## 2026-09-27 · Orchestrator

### Goal

Spec `001-file-management-batch-4`: банк 183 → 189, +6 новых вопросов по
канонической теме «управление файлами» через пайплайн Writer → QC → Оркестратор,
превью капитану, коммит только после approve.

**Статус: работа выполнена, гейты зелёные, коммита НЕТ — жду approve капитана.**

---

## 1. Pre-flight

| # | Проверка | Факт | Итог |
|---|---|---|---|
| 1 | HEAD = `e01cd02` (M4.0) | `e01cd02` | OK |
| 1 | `git status --porcelain` пустой | 15 untracked артефактов батчей 1–3, 0 modified | расхождение, решение капитана: не блокер (вне скоупа) |
| 2 | `.project/specs/README.md` frontmatter | поля spec совпали: id/slug/status/type/created/updated/commit | OK |
| 3 | Канон темы | `file_management` (`src/data/topics.ts:22`, «Управление файлами») | OK, совпал с веткой spec |
| 4 | Префикс | `fm_` ЗАНЯТ темой: `fm_001`..`fm_012` → продолжаем нумерацию, `fm_013`..`fm_018` | расхождение, решено |
| 5 | Банк до старта | **183** (прямой пересчёт + `_topics.json.total`) | OK |

Контракты MAS на месте: `orchestrator_to_writer.yaml`, `writer_to_qc.yaml`,
`qc_to_orchestrator.yaml`.

### Расхождения pre-flight и решения

- **A. `npm run shuffle` не существует** (`Missing script: "shuffle"`, exit 1).
  *Решение капитана:* исполнять `npm run qc` + `npm run shuffle-bank:check` +
  `npm run shuffle-bank` (apply); алиас не добавлять. Зафиксировано в DECISIONS.
- **B. porcelain не пустой** (только untracked `m2.9-batch*`/`drafts/_mas-results`).
  *Решение капитана:* не блокер, действия с файлами вне скоупа. Pre-flight пройден.
- **C. Avoid-list отсутствует и в `log.md` (8 строк), и в `STATE.md` (раздела нет).**
  *Решение капитана:* использовать 11 ID из spec как есть, включая `ds_014`;
  `ds_014` в банке отсутствует → намеренный no-op (подтверждено QC).
- **D. Guard-тест хардкодил `EXPECTED_QUESTIONS = 183`** и конфликтовал с
  «Что НЕ трогать». *Решение капитана:* правку разрешил (183 → 189), плюс
  spec `002-dehardcode-positional-test` (status draft) и строка в `log.md` —
  одним коммитом с батчем.
- **E. Spec 001 не сохранён файлом** в `.project/specs/` (там только README;
  `SPEC.md` теперь показывает «Спек: 1» — это spec 002). **Открытый вопрос №3.**
- **F. Устаревший HEAD в state-файлах** — закрыто как by design: `sync:check`
  сам сообщает «state.head отстаёт на синхронизируемый коммит — это ожидаемо».

---

## 2. Пайплайн: кандидаты, вердикты, отказы

| Этап | Роль / маршрут | Результат |
|---|---|---|
| Writer v1 | `deepseek-official/deepseek-v4-pro`, `reasoning_effort=high` | 6 кандидатов `fm_013`..`fm_018`; status OK |
| QC раунд 1 | `tier-router/smart` (иной маршрут = diversity) | **FAIL**, 5 accept / **1 reject** |
| Оркестратор | независимая верификация | подтвердил ровно тот же 1 дефект |
| Rework 1 | Writer, тот же маршрут | v2: изменён ТОЛЬКО `fm_016` |
| QC раунд 2 | `tier-router/smart` | **PASS**, 6/6 accept, 0 hard blockers |

**Сгенерировано 6. Принято 6 (после rework). Отклонено итогово 0.**

Единственный reject: **`fm_016`** — HARD BLOCKER по option ratio.
`tools/qc.cjs` считает отношение по **символам**, но порог берёт по классу
опций по **числу слов**: 4/4/4/4 слова → `sentences` → порог **1.30**, а не 1.5
из DOD. Факт: 24/20/17/22 → **1.4118 > 1.30** → `npm run qc` дал бы `Fails 1`.
Исправление: дистрактор `rm -f -- data.log` (17) → `rm --force -- data.log` (22)
→ ratio **1.2000** (ниже даже warn-порога 1.25). Стем, верный ответ и
explanation не менялись; новый дистрактор синтаксически валиден и по-прежнему
объективно неверен.

### Независимая верификация Оркестратора (не по evidence Writer'а)

- Собственный harness `.project/drafts/m2.9-batch4-verify.mjs` (4 опции / 1 correct,
  ratio через **тот же** `checkRatio` из `tools/_lib/ratio.cjs`, длина и число
  строк explanation, `objective_domain`, уникальность/диапазон id, avoid-list и
  intra-batch Jaccard): v1 → **FAIL (1)**, v2 → **PASS (0)**.
- Cosine пересчитан сам: intra max **0.6674** (`fm_014~fm_015`), против банка 183
  max **0.7539** (`fm_015`), `rejected 0/6` — числа Writer'а и QC воспроизвелись
  точно.
- Delta v1 → v2 сверена машинно: изменён **ровно один** содержательный фрагмент;
  пять прочих вопросов идентичны по всем полям, включая `_meta`.

### Что проверено не было (ограничения, действуют с batch 3)

Live-прогоны команд RHCSA и WSL запрещены капитаном — факты сверены по
man-страницам RHEL/Rocky 9 (coreutils 8.32, rsync 3.2.3), не исполнением.
UI-рендеринг опций вне контракта QC.

---

## 3. Превью

**`.project/drafts/batch-4-preview.md`** — заголовок «Batch 4 preview — 6 вопросов
из 6», таблица QC (id, cos против банка, ratio+класс, порог, вердикт QC, вердикт
Оркестратора), все 6 вопросов (id, question, A–D, correct, explanation, topic),
раздел «Отклонённые» (пуст) и 4 advisory MINOR от QC. Файл сгенерирован из тех же
байтов, что пойдут в коммит (уже после нормализации порядка опций).

---

## 4. Гейты

| Гейт | Команда | Exit | Факт |
|---|---|---|---|
| DOD content / банк | `npm run qc` | **0** | Total **189**, Fails **0**, Warns **16** (baseline 183 = те же 16, `absolute=1 ratio=13 stopword=2`) |
| Позиции | `npm run shuffle-bank:check` | **0** | BANK 189 = pos0 55 / pos1 45 / pos2 36 / pos3 53 |
| Нормализация позиций | `npm run shuffle-bank` (apply) | **0** | применён со скоупом `file_management` |
| Типы | `npm run typecheck` | **0** | — |
| Тесты | `npm run test:run` | **0** | 25 файлов, **149/149** (без регрессий; guard видит 189) |
| Сборка | `npm run build` | **0** | ✓ built |
| Состояние | `npm run state:update` | **0** | goal 189/300 (63%); gates exits qc=0 typecheck=0 vitest=0 shuffle=0 |
| Центр | `npm run sync` | **0** | `docs/index.html` показывает **189**/300, specs: 1, log_tail: 7 |
| Дрейф | `npm run sync:check` | **2 → ожидается 0 после коммита** | «state.json/производные изменены и не закоммичены — sync → git add → commit». Это пост-коммитный гейт из spec; до коммита exit 2 корректен by design |

Дополнительно (независимо от Оркестратора): QC раунда 2 собрал **зеркало банка на
189** в `$env:TEMP` и прогнал **настоящий** `tools/qc.cjs` (патч 2 строки в копии) →
`Total 189, Fails 0, Warns 16, exit 0`.

Содержимое банка после интеграции: 189 вопросов, дублей id **0**, вопросов не
ровно с одним `correct` — **0**, `_order.json` = 189 (id батча добавлены в конец,
как в батчах 1–3), `_topics.json` `file_management` = 18.

---

## 5. Отклонения от spec 001

1. **Гейт `npm run shuffle` заменён** на `qc` + `shuffle-bank:check` +
   `shuffle-bank` (apply) — скрипта `shuffle` в `package.json` нет. (Решение капитана.)
2. **Скоуп `shuffle-bank --apply` сужен** до `file_management`. Глобальный
   `--apply` переупорядочил опции ещё в 3 темах — 40 существующих вопросов
   (`deploy_systems`, `essential_tools`, `file_systems`); все изменения —
   чистая перестановка опций (`contentChanged=0`). Три темы возвращены к HEAD.
   Обе ветки дают `shuffle-bank:check` exit 0. **Открытый вопрос №1.**
3. **Формат коммита** из spec несовместим с инструментарием:
   `tools/gen-state.mjs` считает `added_today` и `avg_daily_7d`, грепая subject'ы
   на `/^feat\(bank\)/i` **и** `/(\d+)\s+questions?/i`; формат
   `M2.9 batch 4: file_management +6 (183→189)` не матчит ни один regex → метрики
   центра молча обнулятся. **Открытый вопрос №2.**
4. **Guard-тест изменён** (183 → 189) — прямо запрещено разделом «Что НЕ трогать»,
   но иначе недостижим критерий «`npm run test:run` exit 0». Разрешено капитаном,
   tech debt вынесен в spec 002.
5. **`docs/dashboard/state.json` не коммитится.** `npm run state:update` (M3.5)
   перезаписывает его, но spec запрещает трогать `docs/dashboard/*`. Файл возвращён
   к HEAD; `sync:check` мониторит только 4 пути (`.project/state.json`, `STATE.md`,
   `SPEC.md`, `docs/index.html`), поэтому гейт не страдает.
6. **`DECISIONS.md` дополнен** разделом о M2.9 batch 4 (мой bootstrap-протокол
   требует фиксировать значимые решения). Если это лишнее в коммите батча — скажите.
7. **`log.md`: добавлены 2 строки** — ваша строка про guard test дословно плюс
   строка о самом батче (DOD «Общее» требует строку журнала для задачи).
8. **Артефакт QC раунда 2 починен:** `.project/drafts/m2.9-batch4-qc-output-v2.yaml`
   был невалидным YAML (ключ `method:` с отступом внутри последовательности
   `ratio_rerun`, падение `js-yaml` на строке 100). Исправлено минимально — ключ
   вынесен на верхний уровень как `ratio_method:`, текст QC сохранён дословно.

---

## 6. Вопросы капитану

1. **Скоуп shuffle:** оставить минимальный (только `file_management`; BANK 189 =
   55/45/36/53) — рекомендую — или принять полную канонизацию `--apply`
   (+40 переупорядоченных вопросов в 3 темах; BANK 189 = 51/44/37/57)?
2. **Формат коммита:** рекомендую
   `feat(bank): M2.9 batch 4 - 6 questions on file_management (183->189)` —
   сохраняет и метрики `gen-state`, и числа из spec. Альтернатива — формат spec
   дословно, ценой обнуления `added_today`/`avg_daily_7d`.
3. **Spec 001 файлом:** сохранить `.project/specs/001-file-management-batch-4.md`
   (тогда «Спек: 2», и правило «без spec — нет задачи» соблюдено формально) или
   оставить spec 001 только в переписке?
4. **Объём коммита** (11 файлов): 4 content/infra + 4 производных
   (`.project/state.json`, `STATE.md`, `SPEC.md`, `docs/index.html`) +
   `log.md` + `DECISIONS.md` + новый `.project/specs/002-dehardcode-positional-test.md`.
   Подтвердить или урезать?

---

## 7. Approve получен — коммит сделан, push НЕ делался

Капитан approve'нул (2026-09-27) с уточнениями: формат коммита — гибрид
`feat(bank)`, скоуп shuffle — только `file_management`, spec 001 сохранить файлом
с разделом «Отклонения», объём — 12 файлов.

| Что | Значение |
|---|---|
| Контент-коммит | **`f4e2538`** — `feat(bank): M2.9 batch 4 - 6 questions on file_management (183->189)`, 12 файлов, +612/−94 |
| State-коммит | **`edc5d24`** — `chore(state): sync after M2.9 batch 4 (bank 189)`, 4 синхронизируемых файла |
| `npm run sync:check` (после коммита) | **exit 0** — «sync: ok (check) — производные совпадают с источником, HEAD edc5d249…» |
| Центр `docs/index.html` | показывает **189** / 300 |
| Рабочее дерево (tracked) | чисто |
| Push | **не делался** (`main...origin/main [ahead 3]`) |

**Почему два коммита.** Сделать `sync:check` зелёным одним коммитом невозможно
по конструкции гейта: `state.json.head` — «якорь», и он может отставать ровно на
один коммит, трогающий **только** синхронизируемые файлы
(`.project/state.json`, `STATE.md`, `SPEC.md`, `docs/index.html`) — см. комментарий
в `.project/sync.mjs:767-769`. Коммит с `src/**` двигает базу, поэтому после него
требуется `npm run sync` (пере-закрепление якоря) + отдельный state-коммит. Это
штатный поток M4.0; первая попытка `sync:check` сразу после контент-коммита дала
exit 2 с диагностикой «база изменилась, нужен npm run sync».

### Итог пайплайна

- Сгенерировано 6 → принято 6 → отклонено итогово 0 (один reject `fm_016` закрыт
  rework'ом за 1 итерацию, как допускает spec).
- Ноль hard blockers у QC раунда 2; 4 advisory MINOR зафиксированы, не блокируют.
- Банк 183 → 189; `file_management` 12 → 18; дублей id 0; вопросов не ровно с одним
  `correct` — 0.

### Оставшиеся открытые пункты

1. **Spec 003** (полная канонизация порядка опций банка) — капитан назвал backlog,
   файл не создавался (нужен отдельный approve).
2. **Lifecycle spec 001**: файл сохранён «в исходном виде, как был отдан» — `status: draft`,
   `commit: null`. После коммита формально он `done` с `commit: f4e2538`; если нужно,
   это отдельная правка frontmatter + `npm run sync` (state-коммит).
3. **Отчёты в `.project/agents/*.md`** (этот и pre-flight STOP) не входили в
   12 согласованных файлов и остаются untracked.


### Артефакты сессии

- Превью: `.project/drafts/batch-4-preview.md`
- Входы/выходы MAS: `.project/drafts/m2.9-batch4-writer-input.yaml`,
  `-writer-output.yaml`, `-writer-output-v2.yaml`, `-writer-rework1-input.yaml`,
  `-qc-input.yaml`, `-qc-output.yaml`, `-qc-input-v2.yaml`, `-qc-output-v2.yaml`
- Инструменты Оркестратора: `m2.9-batch4-verify.mjs`,
  `m2.9-batch4-integrate.mjs`, `m2.9-batch4-make-qc-input.mjs`,
  `m2.9-batch4-make-preview.mjs`
- Pre-flight STOP-отчёт: `.project/agents/orchestrator-report-2026-09-27-batch4-preflight-stop.md`
