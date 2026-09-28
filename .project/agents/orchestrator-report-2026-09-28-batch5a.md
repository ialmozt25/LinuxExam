# Orchestrator — batch 5A integration (spec 015)

## 2026-09-28 · Orchestrator · Phase 5, батч 5A

### Goal

Закоммитить батч 5A (spec 015): 6 вопросов `tf_011..tf_016` по теме `text_files`,
банк **206 → 212**, без push. Задание — прямое, с pre-flight и явным списком коммитов.
Модель: `reasoning_effort=high`.

Предшественник: этот же заход останавливался на pre-flight
(`orchestrator-report-2026-09-28-batch5a-preflight-stop.md`) — путь интеграции
`src/data/questions/text_files/tf_011..tf_016.json` не существовал. Капитан выдал
исправленную команду; она и исполнена.

### Completed

**Pre-flight (повторно, все ✅).** HEAD `553330b`, `sync:check` exit 0, tracked-дерево
чистое, `batch-5a-candidates.json` = ровно `tf_011..tf_016` / `topic=text_files`,
наборы ключей кандидатов побайтово идентичны ключам `tf_001..tf_010`, `qc` baseline
Total 206 / Fails 0.

**Интеграция.** Backups `text_files.json.bak` / `_order.json.bak` созданы и сверены
по SHA256, сняты после валидации. Интеграция выполнена детерминированным скриптом
`.project/drafts/m2.9-batch5a-integrate.mjs` (по образцу канонического
`m2.9-batch4-integrate.mjs`): сначала `--dry-run`, затем apply. Текстовый append
перед закрывающей `]`, без ре-сериализации существующих байт:

- `src/data/questions/text_files.json`: 10 → 16 вопросов, +8647 B, 162 добавленных
  строк, 0 удалённых;
- `src/data/questions/_order.json`: 206 → 212, шесть id в **самый конец** массива;
  единственное изменение существующей строки — запятая после `"ntw_016"`; префикс
  массива проверен на идентичность бэкапу, порядок не нормализован (HANDOFF §7.1);
- формат: UTF-8 без BOM, LF-only, 2-space indent, последний байт 0x0A — у обоих файлов;
- `JSON.parse` обоих файлов → exit 0 (проверка задания).

**Генераторы.** `npm run manifest` → `_topics.json`: Total **212**, `text_files` **16**
(генератор заодно сверил `_order.json` ⇔ файлы тем в обе стороны). Банк-метрика в
`state.json`: `goal.current_questions` 206 → 212, `progress_percent` 68.7 → 70.7,
далее выведена через `npm run sync` (STATE.md: «Банк: **212 / 300** (70.7%)»,
`| 16 / 22 | Работа с текстом |`).

**Spec 015** → `status: done`, `commit: null`; в тело добавлен раздел «Закрытие
(2026-09-28)» с SHA, гейтами и двумя отклонениями (образец — spec 013).
**Spec 016** (`draft`, `type: content`) создана как backlog: цель — долг
`tf_003~tf_007` (0.8114) и `tf_003~tf_008` (0.8004), триггер «после batch 5C»,
явное «не исполнять в Phase 5».

**Замер долга 016 — первой рукой** (не пересказ превью), банк 212:
`node tools/cosine.cjs --intra-batch src/data/questions/text_files.json` → 120 пар,
3 пары > 0.80 (`tf_001~tf_002` 0.9020, `tf_003~tf_007` 0.8114, `tf_003~tf_008` 0.8004),
exit 1. Числа спеки 016 подтверждены; WARN-полоса 0.75–0.80 (7 пар, кластер
`cut`/`sort`/`uniq`) зафиксирована в спеке как желательная, но не приёмочная.

### Гейты (все exit 0)

| гейт | exit | факт |
|---|---|---|
| `typecheck` | 0 | чисто |
| `test:run` | 0 | 26 файлов / **167** тестов passed, регрессий нет |
| `build` | 0 | built in 10.08s |
| `qc` | 0 | **Total 212**, Fails **0**, Warns **22** (столько же, сколько до батча) |
| `shuffle-bank:check` | 0 | правка порядка не потребовалась (`--apply` не запускался) |
| `sync:check` | 0 | после конвергентного коммита; перепроверен на финальном HEAD |

### Коммиты (6, все сверх `553330b`)

| SHA | subject |
|---|---|
| `df1a12f` | feat(bank): M2.9 batch 5A - 6 questions on text_files (206->212) |
| `96a419f` | chore(state): converge after batch 5A |
| `b99c574` | docs(spec): close 015 as done |
| `40191eb` | chore(state): converge after spec 015 |
| `d00dfe9` | docs(spec): backlog 016 tf-cosine-debt |
| `8505522` | chore(state): converge after spec 016 |

Tracked-дерево чистое. `origin/main` = `9ce80e2` (не двигался): **push не выполнялся**
(правило 10 + явное «push не делать»). Локально 10 коммитов впереди origin — 4 из них
были не отправлены до этой задачи.

### Отклонения от буквы задания

1. **`_topics.json` добавлен в коммит батча** (не назван в `git add` задания).
   Задание относило его к «через `npm run sync`», но `sync.mjs` `_topics.json` только
   читает (`:68`, `:279-289`); генерирует `tools/gen-topics-manifest.mjs`. Без
   пересборки `test:run` краснеет: `loaders-invariant.test.ts` и
   `positional-distribution.test.ts` сверяют manifest с файлами тем.
   Ручной правки не было — только запуск генератора.
2. **Строка в `.project/log.md`** (не названа в задании) — требование правила 5, DOD
   и критерия приёмки самой spec 015. Добавлена в коммит батча.

Оба отклонения — исполнение требования, а не расширение объёма; ни один файл вне
`src/data/questions/**`, `.project/log.md`, `state.json` + производных, specs и
backup'ов не тронут.

### Находки (не чинились, требуют решения капитана)

1. **`npm run state:update` несовместим со схемой v2.** `tools/gen-state.mjs`
   (`:518-534`) пишет `state.json` фиксированным набором ключей v1
   (`last_update/goal/topics/milestones/gates/issues_open/recent_commits`) и **не
   переносит** v2-поля (`head`, `specs`, `log_tail`, `last_sync`, `schema_version`,
   `commits`, `roles`, `products`, `audits`). Прогон обнулил бы их, после чего
   `sync:check` стал бы красным (`schema_version < 2`, ветка `:1309-1314`).
   Пункт 4 плана интеграции в превью батча («`npm run state:update`») поэтому **не
   исполнялся**. Задевает ли это spec 009 — решает капитан.
2. **Побочный эффект:** `goal.added_today` / `goal.avg_daily_7d` считаются только
   `gen-state.mjs`, поэтому в центре останутся прежние `added_today: 0` и
   `avg_daily_7d: "6.57"`, хотя `sync.mjs` метрику банка (212) уже показывает верно.
3. **Spec 015 без `commit_format` / `commit_regex`** — README требует их у
   `type=content`, добавляющего вопросы. Ущерба нет: использованный subject
   матчит обе регулярки парсера (`/^feat\(bank\)/i` ✓, `/(\d+)\s+questions?/i` →
   «6 questions» ✓), метрика посчитается. В спеке 016 требование учтено явно.
4. **4 неотправленных коммита** были в локальной истории до этой задачи
   (`e5afd76`, `5701e70`, `553330b`, `fbf3fe6`) — push за капитаном (правило 10).

### Blockers

Нет. Все шесть целевых коммитов созданы, все гейты зелёные, дерево чистое.

### Next Steps

1. Ждать промпт на **batch 5B** (контент: approve превью обязателен, правило 6).
2. Решить по находке 1 (`state:update` vs схема v2) — отдельная инфра-спека или
   правка `gen-state.mjs`.
3. `git push` — только отдельной per-command авторизацией (правило 10),
   субъект — orchestrator (правило 11).
