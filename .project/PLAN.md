# LinuxExam — План развития

## Северная звезда
Время от начала новой сессии до полного понимания текущего состояния — ≤ 3 минуты.

## Milestones

### M0: Фундамент (закрыт 2026-09-25)
**Закрыт:** 2026-09-25
- [x] Создать `.project/`
- [x] Определить Goal Invariant
- [x] Создать пресет `linuxexam-orchestrator`
- [x] Написать skill `bootstrap.md`
- [x] Проверить: агент читает `.project/`

### M0.5: База знаний DSH
- [x] Создать docs/knowledge/ структуру
- [x] Первая запись: preset-common-errors
- [ ] Дополнять по мере работы (каждая значимая находка → запись)

### M1: Второй агент — Content Writer
- [ ] Создать пресет `linuxexam-content-writer`
- [ ] Agent Contract `orchestrator_to_writer.yaml`
- [ ] Проверить handoff

### M2: Третий агент — QC Auditor
- [ ] Создать пресет `linuxexam-qc-auditor`
- [ ] Agent Contract `writer_to_qc.yaml`
- [ ] Полный цикл: writer → qc → verdict

### M3: Дашборд — минимальный
- [ ] Overview, Agents, MAS Flow, ⌘K

### M4: NAS-бэкап + Patterns Library
- [ ] NAS-бэкап, restore drill, ≥5 паттернов

### M5: Монетизация
- [ ] Cloudflare Worker, Telegram Stars, E2E тест

### M6: Масштабирование MAS
- [ ] Fact-Checker, Marketing, Ops — по триггерам

## Отложенные решения

### Постоянные агенты (continuable + cron + recovery)
- **Статус:** отложено до M3–M4.
- **Суть:** держать постоянно запущенных агентов в DSH, которые восстанавливаются после перезапуска, работают по расписанию/условию, общаются с другими агентами.
- **Когда внедрять:** после M3 (дашборд) минимум; логичнее — на M4 (NAS-бэкап), когда есть реальная ops-нагрузка; идеально — после M5 (монетизация).
- **Триггеры готовности:** .project/STATE.md читается автоматически; есть бэкап-процедура для регулярной проверки; есть тесты для авто-прогона.
- **Минимальный набор:**
  - continuable agent "Ops Watchdog" (пресет linuxexam-ops-watchdog)
  - cron job "Nightly QC" (тесты + digest в .dsh/routines/runs/)
  - dsh-phoenix (сохранение состояния после рестарта DSH)
- **Ключевые факты:**
  - Continuable subagent ≠ процесс в памяти; это durable Session из лога.
  - Goals disarm'аются при рестарте — без dsh-phoenix агент "забудет".
  - dsh-cron — сторонний плагин, проверять совместимость при обновлении DSH.
  - Для cron нужен живой процесс DSH; при падении — systemd с autorestart.
- **Что НЕ делать:** не поднимать до M3 (преждевременно); не полагаться на community-плагины как на стабильные (DSH в developer preview).