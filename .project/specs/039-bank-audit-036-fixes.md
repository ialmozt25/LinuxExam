---
id: 039
slug: bank-audit-036-fixes
type: content
status: draft
commit: null
---

# Спека 039 — правки банка по результатам audit-036

Источник фактов: spec 036 (bank-semantic-audit, done) →
.project/drafts/audit-036-summary.md. Audit выявил 225/225 вердиктов:
актуален 214, требует правок 10, устарел 0, требует ручного решения 1
(fm_011). Плюс пробелы покрытия: IPv6 (объектив 8.1), sudo/wheel (9.4).

## Контекст

Audit-036 нашёл конкретные устаревшие формулировки RHEL-9-эры (метки
«Rocky 9», `.el9`, модульные потоки, mlocate) + пробелы покрытия
(IPv6, sudo/wheel). Цель — привести банк в соответствие objectives
RHEL 10 без добавления новых тем.

## Источники

- .project/drafts/audit-036-summary.md (11 id с причинами).
- src/data/questions/{manage_software,networking,file_management,file_systems,users_groups}.json
- objectives RHEL 10: .project/objectives/030-objectives-full.md.

## Цель

1. Rewrite 9 вопросов из audit-036 (ms_004, msw_011, msw_014, net_001,
   net_002, net_003, fm_008, ug_002, ug_007, fs_004) — 10 фактически.
2. Закрыть fm_011 (см. «Открытые вопросы» — решение капитана).
3. Добавить 4 вопроса: 2 IPv6 (объектив 8.1), 2 sudo/wheel (объектив 9.4).
4. Синхронизировать _topics.json и _order.json.

Банк: 225 → 229. Изменения count: +2 networking, +2 users_groups.

## Что делаем

### P1 — rewrite manage_software (3 вопроса)
- ms_004: модульные потоки убрать; RHEL 10 post-modular, `dnf install postgresql16`.
- msw_011: `.el9` → `.el10` в условии и вариантах.
- msw_014: `.el9` → `.el10` в имени пакета.

### P2 — rewrite networking (3 вопроса) + add 2 IPv6
- net_001: разбор ссылается на несуществующий вариант `ip addr add` —
  переписать на существующий дистрактор (`nmcli connection show`).
- net_002, net_003: убрать метку «на Rocky 9».
- ADD (IPv6, объектив 8.1): 2 вопроса. Свободные id — по факту
  (префиксы net_ и ntw_ сосуществуют; выбирать минимальный свободный
  по обоим префиксам, документировать выбор).

### P3 — rewrite file_management + users_groups + file_systems
- fm_008: `mlocate` → `plocate` (пакет `plocate`, база
  `/var/lib/plocate/plocate.db`).
- ug_002, ug_007: убрать RHEL-9-эру и `_meta.human_review` про Rocky 9.8;
  переверифицировать под RHEL 10 shadow-utils 4.16.
- fs_004: убрать «Типа smbfs в RHEL 9 нет» (см. «Открытые вопросы»).
- ADD (sudo/wheel, объектив 9.4): 2 вопроса. Свободные id — ug_(NN+1), ug_(NN+2).

## Декомпозиция

1. id: t1, subject: rewrite manage_software — ms_004, msw_011, msw_014;
   assignee: writer, dependencies: []
2. id: t2, subject: rewrite networking — net_001, net_002, net_003
   + add 2 IPv6 (объектив 8.1); assignee: writer, dependencies: []
3. id: t3, subject: rewrite fm_008, ug_002, ug_007, fs_004 + add 2
   sudo/wheel (объектив 9.4); assignee: writer, dependencies: []
4. id: t4, subject: интеграция — _order.json (+4 id, одна транзакция)
   + _topics.json через npm run manifest; assignee: writer,
   dependencies: [t1, t2, t3]
5. id: t5, subject: qc — независимая проверка t1–t4 (ratification by
   re-execution), verdict=pass; assignee: qc, dependencies: [t4]
6. id: t6, subject: reviewer — финальное ревью t1–t5; verdict=pass;
   assignee: reviewer, dependencies: [t5]

Оговорки:
- Write-скоупы:
  t1 → src/data/questions/manage_software.json
  t2 → src/data/questions/networking.json
  t3 → src/data/questions/{file_management,users_groups,file_systems}.json
  t4 → src/data/questions/_order.json + _topics.json
  t5, t6 → read-only (отчёты в .project/drafts/ или .project/agents/)
- t1, t2, t3 параллельны. t4 после всех. t5 после t4. t6 после t5.
- Approve капитана обязателен (rule 6, type=content).

## Edge Cases

- **ms_004**: если RHEL 10 всё ещё поддерживает AppStream-модули в каком-то
  виде — НЕ переписывать, помечать requires-manual. Проверить через man dnf
  или Red Hat docs.
- **IPv6**: проверить, есть ли уже вопросы про IPv6 в networking.json.
  Если есть — задача add = 1, не 2.
- **sudo/wheel**: проверить users_groups.json — есть ли уже про sudo/wheel.
- **Идемпотентность**: `_order.json` — единая транзакция (вырезать нечего,
  дописать 4 id). Round-trip проверять SHA256 до/после.

## Открытые вопросы (капитану при approve)

1. **fs_004** — CIFS/SMB вне objectives RHEL 10. Варианты:
   (а) rewrite метки «RHEL 9», оставить как околоэкзаменационный;
   (б) удалить (не покрыт objectives).
   Рекомендация автора спеки: (а).

2. **fm_011** — два технически верных варианта (`tar -cjf` и
   `tar -cf --bzip2`). Варианты:
   (а) заменить дистрактор `--bzip2` на явно неверный (например,
       `tar -cJf` — не понимает bz2); explanation оставить.
   (б) оставить как есть, переписать explanation (признать оба верными).
   Рекомендация: (а) — certification bank требует один верный.

3. **Объём add** — 4 вопроса. Если часть покрытия уже есть — меньше.

## Критерии приёмки

1. 10 вопросов rewritten — нет меток «Rocky 9», «RHEL 9», `.el9`,
   `mlocate`, модульных потоков.
2. fm_011 — ровно 1 верный вариант в options (решение капитана,
   п.2 «Открытых вопросов»).
3. +4 новых вопроса (2 IPv6, 2 sudo/wheel) — схемы банка соблюдены,
   objective_domain соответствует.
4. _topics.json: total 229; counts по 2 темам обновлены:
   networking +2, users_groups +2.
5. _order.json: +4 новых id одной транзакцией.
6. npm run shuffle-bank:check → 0.
7. npm run manifest → 0 (OK: 229 questions, 14 topics).
8. npm run qc → 0 (Fails 0, Warns ≤ baseline).
9. npm run test:run → 0.
10. qc verdict=pass; reviewer verdict=pass.

## Что НЕ трогать

- Другие 9 тем банка (essential_tools, text_files, file_permissions,
  shell_scripts, process_management, running_systems, local_storage,
  deploy_systems, security).
- tools/**, .project/sync.mjs, .project/scripts/**.
- Спеки 028–038 (или 039, если фактический ID — 040).
