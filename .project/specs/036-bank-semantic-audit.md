---
id: 036
slug: bank-semantic-audit
type: content
status: approved
commit: null
---

# Спека 036 — семантический аудит банка (RHEL 10)

Источник фактов: spec 030 (done) — objectives RHEL 10 (URL, 62 пункта, 10 категорий); spec 031 (done) — банк 225 вопросов; MAS-прогоны 030/031 (grep-аудит нашёл 2 id: fp_002, sec_007). Этот документ описывает семантический проход по всем 225 вопросам; правки — отдельная spec 037.

## Контекст

Grep-аудит (spec 030) нашёл только `fp_002` (set-GID) и `sec_007` (firewall). Но grep не ловит:

- устаревшие термины/команды (chkconfig, iptables как основной);
- устаревшие пути;
- изменённые формулировки objectives;
- изменения RHEL 9 → 10.

Семантический аудит — **прочитать каждый вопрос** и сравнить с objectives RHEL 10 содержательно.

## Источники

- `.project/specs/030-rhcsa-objectives-diff.md` — objectives RHEL 10 (URL + diff; возможно, требуется fetch полного).
- `src/data/questions/*.json` — 225 вопросов (14 тем).
- `docs/memory/episodic.md` — записи MAS 030/031.

## Цель

Для **каждого** из 225 вопросов — verdict:

- `актуален` — не требует правок;
- `требует правок` — устаревший термин/путь/формулировка (указать, что);
- `устарел` — вопрос не соответствует objectives RHEL 10;
- `требует ручного решения` — неоднозначно.

## Что делаем

1. **Fetch objectives** (t0, если в spec 030 нет полного current-списка) — URL из 030.
2. **Прочитать банк** (14 тем, 225 вопросов).
3. **Сравнить** каждый вопрос с objectives содержательно.
4. **Результат:** список id с verdict и причиной.
5. **Сводка** — категории + топ-5 проблемных тем.

## Декомпозиция

1. `id: t0` · `subject: fetch objectives RHEL 10 (URL из spec 030) — сохранить полный current-список (10 категорий, 62 пункта) в .project/objectives/030-objectives-full.md; если в 030 уже есть полный список — no-op (skip); сеть недоступна и полного нет — STOP` · `assignee: writer` · `dependencies: []`
2. `id: t1` · `subject: семантический аудит 4 тем — essential_tools (13), text_files (16), file_management (18), file_permissions (19); для каждого вопроса — verdict (актуален/требует правок/устарел/требует ручного решения) + причина; результат → .project/drafts/audit-036-group1.md` · `assignee: writer` · `dependencies: [t0]`
3. `id: t2` · `subject: семантический аудит 4 тем — shell_scripts (16), process_management (17), running_systems (16), users_groups (18); результат → .project/drafts/audit-036-group2.md` · `assignee: writer` · `dependencies: [t0]`
4. `id: t3` · `subject: семантический аудит 3 тем — local_storage (13), file_systems (14), manage_software (16); результат → .project/drafts/audit-036-group3.md` · `assignee: writer` · `dependencies: [t0]`
5. `id: t4` · `subject: семантический аудит 3 тем — networking (16), deploy_systems (13), security (20); результат → .project/drafts/audit-036-group4.md` · `assignee: writer` · `dependencies: [t0]`
6. `id: t5` · `subject: qc — интеграция: прочитать 4 файла audit-036-group*.md, сводный список id с verdict по 225; топ-5 проблемных тем; проверка полноты (225 = сумма); verdict=pass` · `assignee: qc` · `dependencies: [t1, t2, t3, t4]`

Оговорки:

- **14 тем, 225 вопросов** в 4 группах (4+4+3+3).
- **Правки банка НЕ выполняются** — только аудит + список id.
- `src/data/**` — **только чтение**.
- **Write-скоупы не пересекаются:** t0 — `030-objectives-full.md`; t1 — group1.md; t2 — group2.md; t3 — group3.md; t4 — group4.md; t5 — read-only.
- Approve капитана обязателен (правило 6, `type: content`).
- Правки — отдельная spec 037.

## Edge Cases и стратегия проверки

- **Fetch (t0):** если в spec 030 **уже есть** полный current-список — t0 = no-op (skip, отметить в отчёте). Если нет — fetch. Если сеть недоступна — STOP (t0 = `precondition-missing`), t1–t4 **не выполняются**.
- **Объём:** writer-задачи большие (55 вопросов × семантика). Если writer обрывается — partial результат допустим, qc отмечает непокрытые id.
- **Полнота (t5):** проверка 225 = сумма по 4 файлам. Если <225 — qc отмечает пробелы.
- **Неоднозначные вопросы:** вердикт `требует ручного решения` — не пытаться угадать.
- **Нормализация путей:** Windows-пути — использовать Unix-style в .md для consistency.

## Критерии приёмки

1. `.project/objectives/030-objectives-full.md` существует (или t0 = no-op skip).
2. `.project/drafts/audit-036-group1..4.md` — существуют.
3. Каждый из 225 вопросов имеет verdict + причину (в одном из group-файлов).
4. Список id — формат `id — тема — verdict — причина`.
5. Сводка: категории + топ-5.
6. qc verdict = pass.

## Отклонения

2026-09-30: критерий 1 аммендирован — артефакт перенесён из `.project/specs/` в `.project/objectives/`. Причина: путь `.project/specs/` сканируется `readSpecs()` в `.project/sync.mjs`; не-spect-артефакт интерпретировался как спека `id=030 status=draft`, гейт `sync:check`=2. Эксперимент: перенос → exit 0, возврат → exit 2.

## Что НЕ трогать

- `src/**` (только чтение).
- `tools/**`, `.project/factory/**`, `docs/archive/**`, `templates/factory/**`.
- Спеки 028–035.
