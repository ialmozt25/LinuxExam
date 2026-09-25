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
- [ ] `deploy.yml` без `paths-ignore`: doc-only push триггерит деплой Pages
      (добавить `paths-ignore: ['docs/**', '*.md', '.project/**']`)
- [ ] Dependabot: 52 уязвимости в default branch (1 critical, 23 high, 24 moderate, 4 low)
      — проверить и обновить зависимости
- [ ] `tools/qc.cjs`: добавить поддержку `--batch <file>` (сейчас молча игнорирует; проверяет весь банк)
- [ ] `tools/cosine.cjs`: добавить поддержку `--batch <file>` (сейчас падает с ENOENT; рабочий режим — `--intra-batch`)