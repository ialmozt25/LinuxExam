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

### M0.7: Мост «браузерный DeepSeek ↔ DSH» — рабочий процесс
- **Статус:** активен как часть workflow.
- **Роли:**
  - **Ассистент (браузерный чат):** анализ результата, формирование следующего шага.
  - **Капитан:** перенос инструкции, анализ результата, **принятие решения**.
  - **DSH-агент:** исполнение в проекте, отчёт.
- **Принцип:** ручной перенос — принятая практика, не проблема. Капитан
  сохраняет контроль над решениями.
- **M0.7.1 (отложено):** автоматизация переноса (dubridge / dsh-ops-mcp /
  dsh-hermes-link) — при триггере «≥3 итерации ручного копипаста в одной задаче».

### M1: Второй агент — Content Writer (закрыт 2026-09-26)
**Закрыт:** 2026-09-26
- [x] Создать пресет `linuxexam-content-writer`
- [x] Agent Contract `orchestrator_to_writer.yaml`
- [x] Проверить handoff

### M1.5: Content Writer — pipeline skill (закрыт 2026-09-26)
**Закрыт:** 2026-09-26
- [x] Skill `content-pipeline` создан (7 этапов: pre-flight, draft, cosine, integration, shuffle, gates, push)
- [x] Persona обновлена: 4 skills в автозагрузке
- [x] Проверено: пресет Content Writer загружает 4/4 skills

### M2: Третий агент — QC Auditor
- [x] M2.1: расширить PLAN.md архитектурой QC (этот шаг)
- [x] M2.2: создать пресет `linuxexam-qc-auditor` + 4 skills
- [x] M2.3: создать контракт `writer_to_qc.yaml`
- [x] M2.4: создать контракт `qc_to_orchestrator.yaml`
- [x] M2.5: перезапуск DSH + проверка пресета QC
- [x] M2.6: тест цикла Writer → QC → Orchestrator
- [x] M2.7: закрыть M2 в `.project/`
- [x] M2.8: первая реальная генерация через MAS (банк 160 → 166, commit d73c016)
- [x] M2.9: массовая генерация через MAS (батч 1: essential_tools, +6)

**Архитектура QC:**
- 4 skills: `bootstrap`, `adversarial-verification`, `man-verification`, `verdict-rules`
- Протокол: ratification by re-execution + adversarial-refutation-vote
- 5 проходов: fact-check, objective, language, beginner-view, skeptic-view
- Hard blockers только от fact-check и objective (advisory — остальные)
- Периодичность: после 3-4 батчей (не ежебатчно)
- Модель: другая, чем у Writer — для diversity

**Ключевое отличие от Writer:**
- QC НЕ доверяет evidence Writer'а — перезапускает gates сам
- QC НЕ правит контент — возвращает issues Writer'у
- QC НЕ принимает финальное решение — Orchestrator принимает
- Adversarial stance: default FAIL, докажи обратное

### M3: Центр разработки — MVP (локальное веб-приложение)
- [x] M3.1: Create state.json (M3.1)
- [x] M3.2: tools/gen-state.mjs — сборщик данных
- [x] M3.3: dashboard.css — дизайн-токены
- [x] M3.4: dashboard.html + dashboard.js — рендер 4 модулей
- [x] M3.5: auto-sync state.json → docs/dashboard/ (в gen-state.mjs)
- [x] M3.6: закрытие M3 — STATE, DECISIONS, sync
- [ ] Архитектура: React + Vite + тонкий Node backend + WebSocket
- [ ] Configuration-based widgets (JSON-описание, а не хардкод)
- [ ] Модуль Overview: прогресс к цели, текущий milestone, % выполнения
- [ ] Модуль Agents: heartbeat активных агентов, статус HEALTHY/STUCK/DEAD
- [ ] Модуль MAS Flow: DAG взаимодействий, timeline параллельных потоков
- [ ] Модуль Decisions: журнал решений с фильтрами
- [ ] Модуль Blockers: открытые проблемы + критичность
- [ ] Модуль Ideas: backlog идей
- [ ] Command palette (⌘K) для быстрого перехода
- [ ] Dark mode: near-black, layered elevation, contrast ≥ 4.5:1
- [ ] Progressive disclosure: Tier 1 (видно) → Tier 2 (клик) → Tier 3 (навигация)

### M3.7: Центр разработки — переиспользование
- [ ] Вынести общее ядро (widgets, layout, reader .project/) в отдельный пакет
- [ ] Документировать: как подключить к новому проекту
- [ ] Patterns Library: 5+ переиспользуемых паттернов (SKILL.md)

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
