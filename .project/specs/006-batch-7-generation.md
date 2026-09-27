---
id: 006
slug: batch-7-generation
status: done
type: content
created: 2026-09-27
updated: 2026-09-27
commit: 12c8439
commit_format: "feat(bank): M2.9 batch 7 - <N> questions on networking (<A>-><B>)"
commit_regex:  "^feat\\(bank\\), (\\d+)\\s+questions?"
---

# DRAFT ONLY — не запускать до approve капитана

> **РЕЗУЛЬТАТ (2026-09-27, freeze): `done`, commit `12c8439`.**
> Тема `networking` подтверждена. Сгенерировано и интегрировано **6 из 6**:
> `ntw_011`…`ntw_016`. Лучший батч смены по метрикам: cos против банка max 0.7614,
> cos intra-batch max 0.6274, ratio max 1.1455. Гейт дал 1 warn на `ntw_014`
> (absolute term) при 0 fail.
> **Ограничение:** `ntw_014` (firewalld) опирается на man-страницу firewalld **2.x**,
> тогда как RHEL 9 несёт **1.x**; построчный diff не сверен.

Это бумага. Никакой генерации, никакого Writer'а, никакого коммита по этой спеке
не происходит до явного approve. Approve переводит спеку в `running`.

## Pre-flight — STOP и доклад при любом расхождении

1. `git rev-parse --short HEAD` — зафиксировать SHA. `git status --porcelain` — зафиксировать
   изменённые/untracked пути и включить их в отчёт.
2. Прочитать `.project/specs/README.md` — frontmatter этой спеки должен совпасть по полям
   (включая `commit_format`/`commit_regex` для `type=content`). Расхождение — STOP, доклад.
3. Прочитать `src/data/topics.ts` — подтвердить канонический key темы = `networking`.
   Канон другой → использовать канон и отметить расхождение. Темы нет → STOP, доклад.
4. Определить свободные id: прочитать `id` в `src/data/questions/networking.json`.
   **Нумерация темы не сплошная** — наблюдаемые id: `net_001`, `net_002`, `net_003`,
   `net_005`, `net_006`, `net_007`, `net_008`, `net_010`, `net_011`, `net_012`
   (10 вопросов; `net_004` и `net_009` отсутствуют). Свободный номер берётся по факту
   чтения файла (кандидат — `net_004`), префикс `net_` канонический и не переиспользуется
   под другую тему. Полный список занятых префиксов банка: `ds_`, `et_`, `fm_`, `fp_`,
   `fs_`, `ls_`, `ms_`, `net_`, `pm_`, `rs_`, `sec_`, `sh_`, `tf_`, `ug_`.
5. **Размер банка — читать, а не помнить.** Прочитать `src/data/questions/_topics.json`,
   поле `total`. На момент написания спеки `total` = **189**. Хардкодить это число как
   «текущее» запрещено (spec 001 хардкодил 183 и устарел за один батч): в отчёт идёт
   фактическое значение — это `A` в формулировках ниже.
6. Проверить зелёный `npm run test:run` **до** генерации. Красные тесты на чистом дереве —
   STOP, доклад.
7. Прочитать `.project/specs/002-dehardcode-positional-test.md`. Если выполнена — правка
   guard-теста не нужна. Если нет — bump `EXPECTED_QUESTIONS` вне скоупа: STOP, доклад.

## Тема

Предложение (капитан может переопределить): **`networking`** — «Сеть».

Почему: наблюдаемые счётчики из `src/data/questions/_topics.json` (проверено чтением):

| слаг | count |
|---|---|
| `manage_software` | 8 |
| `local_storage` | 8 |
| `networking` | 10 |
| `running_systems` | 10 |
| `shell_scripts` | 10 |
| `text_files` | 10 |
| `deploy_systems` | 13 |
| `essential_tools` | 13 |
| `file_systems` | 14 |

`networking` (10) — следующий уровень после двух тем по 8. Это **предложение**:
смена темы капитаном требует правки pre-flight п.3–4 и этой таблицы.

## Цель

Банк `A` → `A + N` (N ≤ 6) новыми вопросами по канонической теме `networking`.
`A` — из `src/data/questions/_topics.json.total` на момент старта.

## Источники

- **Avoid-list:** `.project/log.md` (последние 30 строк) + `state.json.issues_open`
  (`ug_013`, `ug_018`, `ug_014`, `ug_016`, `ug_017`). Наблюдаемый список batch 4:
  `ds_002, ds_014, rs_001, pm_014, pm_010, fs_005, fs_006, fs_013, ls_002, ls_005, ls_007`.
  Оба источника пусты → доклад, не угадывать.
  **Свой стем-avoid-list:** выписать покрытые темы всех 10 существующих вопросов темы
  (прочитать файл) и не дублировать их.
- **Канон тем:** `src/data/topics.ts` (read-only).
- **DOD content:** `.project/DOD.md`, раздел `content`.
- **Контракты MAS:** `.project/contracts/orchestrator_to_writer.yaml`,
  `writer_to_qc.yaml`, `qc_to_orchestrator.yaml`.
- **Образец процесса и ловушек:** `.project/specs/001-file-management-batch-4.md`
  (раздел «Отклонения»).

## Критерии приёмки

- [ ] N новых вопросов (N ≤ 6), `topic = networking`, id из фактически свободных номеров.
- [ ] DOD content: 4 опции, ровно 1 верная, explanation ≤ 3 строк.
- [ ] Option ratio проверен тем же кодом, что гейт: `checkRatio(options, 'chars')`
      (`tools/_lib/ratio.cjs`); порог зависит от класса по числу слов
      (`sentences` 1.30 / `token` 2.00 / `mixed` 1.50). Долг — spec `007-qc-ratio-semantics`.
- [ ] `npm run qc` — `Fails: 0` (baseline на 189 вопросах: `Fails: 0, Warns: 16`).
- [ ] Cosine против всего банка ≤ 0.85 и между кандидатами ≤ 0.85
      (`tools/cosine.cjs` читает **только JSON**).
- [ ] Avoid-list соблюдён.
- [ ] Артефакты интеграции согласованы: файл темы, `_order.json` (новые id — в конец,
      существующий порядок не сдвигается), `_topics.json` через `npm run manifest`
      (ожидаемый вывод `OK: <total> questions, 14 topics`).
- [ ] `npm run shuffle-bank --apply networking` (только своя тема) →
      `npm run shuffle-bank:check` exit 0.
- [ ] Гейты: `npm run qc` exit 0, `npm run typecheck` exit 0, `npm run test:run` exit 0,
      `npm run build` exit 0.
- [ ] `npm run sync` → `git add` → **один** коммит → `npm run sync:check` exit 0.
- [ ] Строка в `.project/log.md` (append-only).
- [ ] `docs/dashboard/state.json` не коммитится (DECISIONS 2026-09-27, п. 7).

## Пайплайн

1. Writer (`reasoning_effort=high`) генерирует 6 кандидатов.
2. QC проверяет каждый: ratio (тем же кодом), cos против всего банка, cos между собой,
   второй верный дистрактор, explanation, man-верификация команд (для темы сети —
   `ip`, `ss`, `ping`, `dig`, `nmcli`, `/etc/hosts`, `firewall-cmd`/`ufw` и т. п.;
   проверять по man-странице, а не по памяти).
3. QC возвращает вердикт по каждому: `accept` / `reject` с причиной.

## Обработка отказов

- **1 reject:** Writer переделывает 1 вопрос → QC повторно. Макс 1 доп. итерация на вопрос.
- **2 reject:** Writer переделывает 2 → QC повторно. Макс 1 доп. итерация на вопрос.
- **После 2 итераций всё ещё reject:** вопрос выбывает; коммит с тем, что принято (N < 6).
- **Принято < 4:** партия провалилась, коммита нет, доклад капитану.
- **Partial approve капитаном:** коммит с N=4, отчёт о том, какие убраны.
- **Конфликт с существующим вопросом (cos > 0.85):** кандидат выбывает без итерации;
  выбыло ≥ 3 — STOP, доклад.

## Коммит

```
feat(bank): M2.9 batch 7 - <N> questions on networking (<A>-><B>)
```

Обязаны матчиться **обе** регулярки из `tools/gen-state.mjs:103-104`, `:127-128`
(`/^feat\(bank\)/i` и `/(\d+)\s+questions?/i`), иначе `goal.added_today` и
`goal.avg_daily_7d` молча обнулятся. `A` = `total` до интеграции, `B = A + N`.

Push НЕ делать до approve (правило 4).

## Что НЕ трогать

- `src/data/questions/*` других тем — только файл темы + `_order.json`/`_topics.json`.
- `src/data/topics.ts` — read-only канон.
- `docs/dashboard/*` — легаси-дашборд V1–V9.
- `.project/contracts/*`, `.project/DOD.md`, `.project/specs/README.md`.
- Глобальный `shuffle-bank --apply` без темы (переупорядочивает чужие темы — spec 003).
- Прод и origin — push только после approve.

## Превью

Файл `.project/drafts/batch-7-preview.md`:

1. Заголовок: «Batch 7 preview — N вопросов из 6, тема networking».
2. Таблица QC: id, cos против банка, класс + ratio, вердикт.
3. По каждому вопросу: id, question, 4 опции (A–D), correct, explanation, topic.
4. Отклонённые (если есть): id, причина.
5. Отдельно — какие номера id были свободны и почему выбраны именно они.

## Отчёт капитану

1. Pre-flight: HEAD, состояние дерева, канон темы, свободные номера id, `A` = `_topics.json.total`.
2. Кандидатов сгенерировано / принято / отклонено (с причинами).
3. Путь к превью.
4. Exit-коды: `qc`, `shuffle-bank:check`, `typecheck`, `test:run`, `build`, `sync:check`.
5. Отклонения от спеки и вопросы капитану.
6. Ждать approve. Коммит не делать.
