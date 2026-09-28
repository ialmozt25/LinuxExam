# LinuxExam — Backlog

## Идеи
- [ ] Telegram-бот для ежедневных напоминаний
- [ ] Режим экзамена с таймером
- [ ] Экспорт прогресса в PDF
- [ ] Мультиязычность (EN, RU)

## Технические долги
- [ ] `shuffle-bank.mjs --path <file>` — не принимает путь
- [ ] `export-pending.mjs` дата-ориентирован
- [ ] `drafts/_mas-results/` — untracked
- [ ] `.backup-tld-20260928-080821/` + `filelists-BaseOS.xml.gz` — untracked, оставлены
      сознательно в F0.1 (2026-09-28, решение капитана); судьба не решена —
      разобрать в F2 (`MEMORY-FACTORY.md:53` — «битый артефакт в корне репо»)
- [ ] `deploy.yml` без `paths-ignore`: doc-only push триггерит деплой Pages
      (добавить `paths-ignore: ['docs/**', '*.md', '.project/**']`)
- [ ] Dependabot: 52 уязвимости в default branch (1 critical, 23 high, 24 moderate, 4 low)
      — проверить и обновить зависимости
- [ ] `tools/qc.cjs`: добавить поддержку `--batch <file>` (сейчас молча игнорирует; проверяет весь банк)
- [ ] `tools/cosine.cjs`: добавить поддержку `--batch <file>` (сейчас падает с ENOENT; рабочий режим — `--intra-batch`)

> Владелец пунктов «Dependabot» и «`paths-ignore`» — роль **DevOps**:
> `docs/knowledge/ops/devops-role.md` (spec 008). Владелец пункта не меняет правило 6
> (content freeze) и не даёт права на push в прод без approve капитана.