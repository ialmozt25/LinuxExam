# spec 039 — брифинг прогона AgentTeams (обязателен к прочтению каждой задачей)

> Автор: Оркестратор (капитан команды). Документ read-only для членов команды.
> Спека: `.project/specs/039-bank-audit-036-fixes.md` (`status: approved`).
> Аудит-источник: `.project/drafts/audit-036-summary.md` (spec 036, done).
> Objectives RHEL 10: `.project/objectives/030-objectives-full.md`.

## 0. Роль и результат прогона

Привести банк в соответствие objectives RHEL 10: переписать 10 вопросов из audit-036,
закрыть `fm_011` (решение капитана), добавить 4 новых вопроса (2 IPv6, 2 sudo/wheel),
синхронизировать `_order.json` и `_topics.json`. Банк 225 → 229.
Изменения `count`: networking 16 → 18, users_groups 18 → 20. Остальные 12 тем не меняются.

## 1. Гейты: baseline «до» (снято капитаном на HEAD `0abd6582`)

| гейт | до | ожидание «после» |
|---|---|---|
| `npm run typecheck` | 0 | 0 |
| `npm run test:run` | 0 (28 файлов / 198 тестов) | 0 |
| `npm run sync:check` | 0 | не гейт прогона (его закрывает капитан) |
| `npm run qc` | 0 — Total 225, **Fails 0, Warns 22** | 0 — Total 229, Fails 0, Warns ≤ 22 |
| `npm run shuffle-bank:check` | 0 — BANK 225 = 66/51/47/61 | 0 |
| `npm run order:check` | 0 — 225 ids | 0 — 229 ids |

**Важно про «промежуточные» гейты.** Пока t4 не сделана, банк намеренно неконсистентен:
новые id (`ntw_017/018`, `ug_019/020`) есть в файлах тем, но их нет в `_order.json`, а
`_topics.json` устарел. Поэтому `npm run order:check`, `npm run manifest` и
`npm run test:run` (тест `src/data/questions/__tests__/loaders-invariant.test.ts`
сверяет файлы ⇔ `_order.json` ⇔ `_topics.json`) **падают закономерно** до t4 и не
являются провалом t1–t3. За t1–t3 отвечают: `npm run qc` + предметные проверки ниже.

## 2. Жёсткие запреты (нарушение = failed)

- Менять только файлы из `inScope` своей задачи. `tools/**`, `.project/sync.mjs`,
  `.project/scripts/**`, `package.json`, `.project/specs/**` — не трогать.
- В скоупе прогона ровно 5 тем: `manage_software`, `networking`, `file_management`,
  `file_systems`, `users_groups`. Остальные 9 тем банка (`essential_tools`,
  `text_files`, `file_permissions`, `shell_scripts`, `process_management`,
  `running_systems`, `local_storage`, `deploy_systems`, `security`) не трогать вообще.
- Не менять порядок `options` у существующих вопросов и позицию верного ответа.
  Единственное исключение — `npm run shuffle-bank --apply <topic>` в t4 (только для
  тем `networking`/`users_groups`, если `shuffle-bank:check` упал).
- Не добавлять зависимости, не менять `.project/DOD.md`, не коммитить, не пушить.
- Не править `_order.json` / `_topics.json` вне t4.
- Никакого `console.warn`/TODO в данных, весь текст — русский, без `any`/`@ts-ignore`.

## 3. Схема вопроса и конвенции банка

```json
{
  "id": "ntw_017",
  "topic": "networking",
  "difficulty": "easy|medium|hard",
  "objective_domain": "1".."9",
  "subtopic": "короткая тема (до ~60 символов)",
  "question": "условие на русском",
  "options": [{ "text": "...", "correct": false }, { "text": "...", "correct": true }],
  "explanation": "разбор: почему верный вариант верен и почему каждый дистрактор неверен",
  "_meta": { "added_at": "YYYY-MM-DD", "pipeline_version": "spec-039", "verified_rhel": "10",
             "verified_at": "...", "source": "spec-039-bank-audit-036-fixes",
             "reference": "<man/URL>", "status": "active" }
}
```

- Ровно 4 опции, ровно **один** `correct: true`.
- `objective_domain` — legacy-шкала «категория objectives» строкой `"1".."9"`
  (валидируется `tools/qc.cjs` как `/^[1-9]$/`). Для новых IPv6 → `"8"`
  (объектив 8.1 «Configure IPv4 and IPv6 addresses»), для sudo/wheel → `"9"`
  (объектив 9.4 «Configure privileged access»).
- `explanation` — ≤ 3 строк, без переносов строки.
- `_meta` — **опциональна** (есть у 60/225). Если её добавляешь/правишь, соблюдай
  ключи выше. `_meta.verified_rhel` ставить `"10"` можно **только** при реальной
  улике RHEL 10 (официальная документация Red Hat с URL); эмпирическую проверку на
  хосте, которого нет, не заявлять (см. п. 6).
- Никаких меток предыдущей эры: `Rocky 9`, `Rocky 9.8`, `RHEL 9`, `.el9`,
  `mlocate`, «модульные потоки» (в переписываемых вопросах).

## 4. DOD `content` — как проверять кандидата

| критерий | чем проверять |
|---|---|
| 4 опции, 1 верная, ratio по классу | `npm run qc` (весь банк, exit 0) |
| ratio по классу вопроса, пороги `sentences 1.30 / token 2.00 / mixed 1.50` (единица — символы) | `node tools/haladyna.cjs <id> --auto-only` (AUTO 5/5 → exit 0); таблица — `tools/_lib/ratio.cjs` (`RATIO_TABLE`) |
| cosine против **всего** банка, самоисключение | `node .project/drafts/spec-039-cosine-neighbors.mjs <id> [<id>...]` (порог = `tools/cosine-calibration.json` → 0.80; exit 1 при превышении). Скрипт уже проверен: контроль на `tf_001` даёт `REJECT 0.9020` (известная пара из whitelist), `ntw_016` → `ok 0.5996` |
| порядок опций по банку | `npm run shuffle-bank:check` (t4/t5/t6) |

`tools/qc.cjs` аргументов не принимает — всегда проверяет весь банк. Если нужен
изолированный прогон по своим кандидатам: скопировать `src/data/questions/*.json` в
`$env:TEMP` и запускать `node tools/qc.cjs` только в репозитории (для скоупа — свои
предметные проверки ниже).

## 5. Точный список правок (ожидаемое состояние)

Проверено капитаном сканом банка: перечисленные токены встречаются **только** в этих
вопросах (карта «id → поле» ниже — из этого скана).

| id | файл | что именно | поле(я) с дефектом |
|---|---|---|---|
| `ms_004` | manage_software | модульные потоки → post-modular RHEL 10, versioned packages (`dnf install postgresql16`); верный ответ не может быть `dnf module enable` | subtopic, question, options, explanation |
| `msw_011` | manage_software | `.el9` → `.el10` в условии и всех опциях; переформулировать ошибочное «`dnf install` завершится ошибкой, т.к. репозитории не подключены» | question, options, explanation |
| `msw_014` | manage_software | `.el9` → `.el10` в имени пакета (условие + все опции) | question, options |
| `net_001` | networking | разбор ссылается на отсутствующий вариант `ip addr add` → переписать разбор на реальные дистракторы (в т.ч. `nmcli connection show`) | explanation |
| `net_002` | networking | убрать «на Rocky 9» из вопроса | question |
| `net_003` | networking | убрать «на Rocky 9» / «в Rocky 9» из вопроса и разбора | question, explanation |
| `fm_008` | file_management | `mlocate` → `plocate`, база `/var/lib/plocate/plocate.db`; дистрактор `mlocate -r` → `plocate -r`; верный ответ `updatedb` не меняется | options, explanation |
| `fs_004` | file_systems | убрать «Типа smbfs в RHEL 9 нет» → версионно-нейтральная/«в RHEL 10» формулировка; вопрос остаётся (решение капитана п.1) | explanation |
| `ug_002` | users_groups | убрать опору на эмпирику Rocky 9.8 («`-n` — недокументированный алиас»), переверифицировать формулировку под RHEL 10 shadow-utils; верный ответ `-m` не меняется | explanation (+`_meta`) |
| `ug_007` | users_groups | убрать «man неверен на Rocky 9.8 … проверено эмпирически» и `_meta.human_review` (`flags: educational_man_limitation`, `verdict_before/after`) с причиной «на RHEL 9» | explanation, `_meta.human_review` |
| `fm_011` | file_management | решение капитана п.2: дистрактор `tar -cf backup.tar.bz2 --bzip2 /home` переписать на `tar -cJf backup.tar.bz2 /home`; explanation оставить корректным для верного `tar -cjf` (и явно сказать, что `-J` — это xz, не bzip2) | options, explanation |
| NEW `ntw_017`, `ntw_018` | networking | 2 вопроса по объективу 8.1: IPv6-адресация (`nmcli`, `ip`, `ping -6`/`ping6`, `ip -6 addr`) | — |
| NEW `ug_019`, `ug_020` | users_groups | 2 вопроса по объективу 9.4 «Configure privileged access»: `sudo`, группа `wheel`, `/etc/sudoers`, `visudo`, `sudo -l`, drop-in `/etc/sudoers.d/` | — |

Контрольные факты из аудита (для ms_004): RHEL 10 — post-modular, AppStream-модули не
поставляются; установка версионными пакетами (`dnf install postgresql16`), без
`dnf module enable`. Улика аудита: Red Hat Developer, 2025-03-11.

## 6. Доказательства и STOP-условия

- Каждое содержательное утверждение правки подкрепляется источником: официальная
  документация Red Hat для **RHEL 10** (URL), `man` (если страница есть на этом
  хосте), либо прямой прогон команды. Хост — Ubuntu 26.04: `dnf`, `rpm`, `subscription-manager`,
  RHEL-специфичные бинарники **отсутствуют**; заявлять man/эмпирику, которой не было,
  запрещено (прецедент — правило #6 HANDOFF, `.project/DECISIONS.md`).
- Если факт не подтверждается (например, RHEL 10 всё ещё поддерживает AppStream-модули
  в каком-то виде, или IPv6-покрытие уже есть), задачу **не выдумывать**:
  пометить `requires-manual`, зафиксировать в отчёте с уликой и вернуть
  `verdict: needs_revision` в задаче (капитан решит).
- Edge cases спеки: «IPv6 — если покрытие уже есть, add = 1, не 2» и «sudo/wheel —
  проверить, нет ли уже» **уже проверены капитаном** сканом: в `networking.json` нет ни
  одного упоминания `IPv6/inet6`, в `users_groups.json` — ни одного `sudo/wheel`.
  Значит 2 + 2 = 4 новых вопроса, как в спеке.

## 7. Формат отчёта задачи (durable, обязателен)

Каждая задача пишет один файл-отчёт в свой write-скоуп (см. задачу) и в конце
возвращает в `output`:

```
verdict: pass|needs_revision
files: <изменённые пути>
гейты: <команда> => exit <N> (+ 1 строка вывода)
улики: <по каждому вопросу: источник утверждения>
оговорки: <если есть>
```

Отчёт обязан содержать вывод гейтов **дословно** (команда + exit code + ключевая строка),
а не пересказ. `verdict: pass` без сырых exit-кодов не принимается.

## 8. Декомпозиция и владельцы

| id | subject | assignee | deps | write-скоуп |
|---|---|---|---|---|
| t1 | rewrite manage_software (ms_004, msw_011, msw_014) | writer-software | — | `src/data/questions/manage_software.json`, `.project/drafts/spec-039-t1-*` |
| t2 | rewrite networking (net_001..003) + 2 IPv6 (ntw_017/018) | writer-network | — | `src/data/questions/networking.json`, `.project/drafts/spec-039-t2-*` |
| t3 | rewrite fm_008, fm_011, ug_002, ug_007, fs_004 + 2 sudo/wheel (ug_019/020) | writer-accounts | — | `src/data/questions/file_management.json`, `src/data/questions/users_groups.json`, `src/data/questions/file_systems.json`, `.project/drafts/spec-039-t3-*` |
| t4 | интеграция: `_order.json` +4, `_topics.json`, shuffle, полные гейты | writer-software | t1,t2,t3 | `src/data/questions/_order.json`, `src/data/questions/_topics.json`, `.project/drafts/spec-039-t4-*` |
| t5 | qc — независимая проверка t1–t4 (ratification by re-execution), verdict | qc | t4 | `.project/drafts/spec-039-qc-*` (банк — read-only) |
| t6 | reviewer — финальное ревью t1–t5, verdict | reviewer | t5 | `.project/drafts/spec-039-review-*` (банк — read-only) |

## 9. Приёмка (критерии спеки 039, для t5/t6)

1. 10 вопросов переписаны — нет меток «Rocky 9», «RHEL 9», `.el9`, `mlocate`, модульных потоков.
2. `fm_011` — ровно 1 верный вариант в `options`.
3. +4 новых вопроса (2 IPv6, 2 sudo/wheel) — схема банка соблюдена, `objective_domain` соответствует.
4. `_topics.json`: `total 229`; `networking 18`, `users_groups 20`.
5. `_order.json`: 229 id, +4 новых (одной транзакцией, append).
6. `npm run shuffle-bank:check` → 0.
7. `npm run manifest` → 0 (`OK: 229 questions, 14 topics`).
8. `npm run qc` → 0 (`Fails 0`, `Warns ≤ 22`).
9. `npm run test:run` → 0.
10. qc verdict=pass; reviewer verdict=pass (approve капитана — вне команды).
