# LinuxExam — Журнал решений

## 2026-09-25 · Создание файлового состояния
- **Decision:** Создать `.project/` с файловым состоянием (STATE, SPEC, DECISIONS, PLAN).
- **Why:** Решает проблему потери контекста между сессиями.
- **Alternatives:** Внешняя БД, Notion, GitHub Issues.
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Пресет `linuxexam-orchestrator`
- **Decision:** Создать первый DSH-пресет для роли Orchestrator.
- **Why:** Обеспечивает повторяемость и управляемость запуска агента.
- **Alternatives:** Каждый раз писать промпт вручную.
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Event sourcing вместо прямых записей
- **Decision:** `STATE.md` и `METRICS.json` генерируются из `events.jsonl`.
- **Why:** Устраняет race conditions при конкурентной записи.
- **Alternatives:** Advisory lock, optimistic concurrency.
- **Decided-by:** Orchestrator.

## 2026-09-25 · Event sourcing отложен до M3
- **Decision:** Запись "STATE.md и METRICS.json генерируются из events.jsonl" от 2026-09-25 остаётся в силе как цель, но реализация отложена до M3 (дашборд).
- **Why:** M0 закрывается на статических MD-файлах; event sourcing — преждевременная сложность, нужен только когда дашборд начнёт читать данные.
- **Alternatives:** Реализовать сейчас (отклонено — усложнит закрытие M0), откатить запись (отклонено — цель остаётся верной).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Постоянные агенты отложены до M3–M4
- **Decision:** Зафиксировать как отложенное решение идею continuable-агентов с cron, recovery и peer-коммуникацией. Детали — в PLAN.md, секция "Отложенные решения".
- **Why:** Преждевременно до M3; нужен источник данных (STATE) и реальная ops-нагрузка (бэкапы), чтобы watchdog был полезен.
- **Alternatives:** Внедрить сейчас (отклонено — coordination overhead без пользы).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Запуск базы знаний docs/knowledge/
- **Decision:** Начать вести docs/knowledge/ для наработок по DSH и MAS.
- **Why:** Не наступать дважды на одни грабли; передавать знания в новые проекты.
- **Alternatives:** Хранить в голове; писать в чат (теряется).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Разграничение журналов решений
- **Decision:** Переименовать docs/DECISIONS.md в docs/ENGINEERING-DECISIONS.md. Разделить домены: docs/ENGINEERING-DECISIONS.md — инженерные решения по коду; .project/DECISIONS.md — решения по процессу и инфраструктуре.
- **Why:** Два файла с одинаковым именем «журнал решений» создавали риск перепутать домены в новых сессиях; README базы знаний указывал неверно.
- **Alternatives:** Объединить в один (отклонено — старый журнал 18.8 KB, 13 записей, 9 коммитов истории, потеря контекста); оставить как есть (отклонено — риск неверной записи).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Центр разработки выделен в полноценный milestone
- **Decision:** Расширить M3 «Дашборд — минимальный» до «Центр разработки — MVP» с явными модулями. Добавить M3.5 «Переиспользование».
- **Why:** Исходная цель проекта — масштабируемый и переиспользуемый центр разработки, а не «просто дашборд». Урезанная формулировка M3 не отражала цель.
- **Alternatives:** Оставить M3 как было (отклонено — потеря исходной цели); вынести центр в отдельный репо (отложено до появления второго проекта).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Автоматизация моста DeepSeek → DSH запланирована (M0.7)
- **Decision:** Зафиксировать M0.7. Архитектурное решение — dubridge при триггере «≥3 итерации ручного копипаста в одной задаче».
- **Why:** Ручной перенос инструкций убивает ценность MAS (orchestrator overhead ~100%); но внедрять сейчас — преждевременно, M1 ещё не отлажен.
- **Alternatives:** dubridge (прямой мост), dsh-ops-mcp + MCP-клиент, dsh-hermes-link. Выбор — при активации.
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-25 · Мост DeepSeek ↔ DSH принят как рабочий процесс
- **Decision:** Переформулировать M0.7: мост браузерного чата с DSH — не проблема, а принятая практика. Капитан сохраняет контроль: анализирует результат и решает. Автоматизация — подпункт M0.7.1, отложена.
- **Why:** Капитан должен сохранять контроль над решениями; преждевременная автоматизация лишила бы этого.
- **Alternatives:** Автоматизировать сейчас (отклонено — преждевременно); считать мост временным неудобством (отклонено — это осознанный процесс).
- **Decided-by:** Капитан.

## 2026-09-26 · M1 закрыт: Content Writer работает
- **Decision:** Считать M1 закрытым. Handoff-тест Orchestrator -> Content Writer пройден (PASS).
- **Why:** Все 5 полей контракта на месте, evidence — list из 6 записей, 2 вопроса соответствуют схеме, gates пройдены (haladyna AUTO=2/2, cosine max=0.7896 <= 0.9020, qc — зеркальная проверка ok).
- **Alternatives:** Продолжать диагностику (отклонено — все проверки зелёные).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-26 · Найдены баги в qc.cjs и cosine.cjs
- **Decision:** Зафиксировать два бага инструментов в BACKLOG. Исправление — отдельная задача после M2.
- **Why:** `qc.cjs --batch` молча игнорируется (проверяет весь банк); `cosine.cjs --batch` падает с ENOENT (рабочая форма — `--intra-batch`). Оба найдены на handoff-тесте M1.
- **Alternatives:** Фиксить сейчас (отклонено — вне зоны M1).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-26 · M1.5 закрыт: content-pipeline формализован
- **Decision:** Зафиксировать 7-этапный pipeline как skill `content-pipeline` у Content Writer. Раньше pipeline применялся неформально.
- **Why:** Воспроизводимость генерации. Writer больше не импровизирует — следует протоколу (draft в $env:TEMP, man-верификация, cosine до интеграции, snapshot-проверка, gates как блокеры). Handoff-тест M1 подтвердил, что пресет работает в правильном workspace.
- **Alternatives:** Оставить pipeline как практику в голове (отклонено — теряется); вынести в общий skill для всех агентов (отложено — Writer специфичен).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-26 · Архитектура M2: QC Auditor
- **Decision:** QC Auditor — третий агент MAS. 4 skills (`bootstrap`, `adversarial-verification`, `man-verification`, `verdict-rules`). Протокол: ratification by re-execution (перезапускает gates сам, не доверяет evidence Writer'а) + adversarial-refutation-vote (5 проходов). Периодичность: после 3-4 батчей, не ежебатчно.
- **Why:** Независимая верификация требует другого фрейма и модели. Research показывает: verifier на той же модели с тем же фреймом — фейковый гейт. Diversity фреймов (5 проходов) + diversity моделей (QC ≠ Writer) + детерминированные gates в приоритете над LLM-судьёй.
- **Alternatives:** MAS v2 с 6 отдельными ролями (дороже, coordination overhead); ежебатчный QC (теряет diversity); LLM-судья без re-execution (независимость падает).
- **Decided-by:** Капитан + Orchestrator.

## 2026-09-26 — QC Auditor: reference-копия, модель, YAML, pwsh-ловушка

**Решение:** пресет `linuxexam-qc-auditor` закрыт как копия Writer'а с 7 правками:
- 5 правок в persona: список скиллов, фраза делегирования, роль (`Ты — QC Auditor`),
  глагол-роль (`генерировать` → `независимо верифицировать`), вставка блока про модель;
- 2 остаточных Writer-изма в рабочей части: `соблюдая` → `проверяя соответствие`,
  `генерировать вопросы и отчитываться` → `верифицировать вопросы и возвращать issues`;
- шапка-комментарий (строки 1–3) и `description` в preset.yml.

**Deviation от изначального плана M2.2:** reference-копия пресета добавлена в репо
(`docs/knowledge/dsh/presets/linuxexam-qc-auditor/`) — на случай сброса worktree
(инцидент 4.5). SHA256-сверка гарантирует байт-идентичность копии и источника.

**Модель НЕ задаётся файлами пресета (M2.2c-1):**
`readPresetMetadata()` в `dsh-agent-presets` читает только `name`, `description`, `order`.
`agentOptions()` в `dsh-api-session-controller` читает host-сервис `agentDefaultModel`.
Поле `model:` в `agent.cordis.yml` или `preset.yml` молча отбрасывается.
**Следствие:** diversity слепых пятен Writer↔QC зависит от дисциплины капитана
(per-session выбор через /model в UI), не от конфига.

**Модель QC по умолчанию:** `deepseek-official/deepseek-v4-pro`.
**Причина:** Writer на `tier-router/smart` (обычно flash, иногда pro); QC на pro даёт
стабильно другой tier на большинстве вопросов.

**YAML-валидация:** js-yaml из `$dsh\profiles\node_modules`, с заменой тега `!!js`
на `!!str` ТОЛЬКО В ПАМЯТИ (файл не меняется). Обход ограничения handoff §4.3.
Позволяет ловить структурные ошибки ДО перезапуска DSH (M2.5).

**Новая pwsh-ловушка:** см. `docs/knowledge/dsh/pwsh-cyrillic-escaped-parens.md`.

## 2026-09-26 — Milestone M2 закрыт: MAS из 3 агентов работает

**Что закрыто:**
M2.1–M2.7. Создан и проверен полный цикл мультиагентной системы:
  Orchestrator → Writer → QC → Orchestrator.

**Артефакты:**
- Пресет `linuxexam-qc-auditor` (вне репо): agent.cordis.yml + preset.yml + 4 скилла.
- Reference-копия в репо: docs/knowledge/dsh/presets/linuxexam-qc-auditor/.
- 3 контракта в .project/contracts/: orchestrator_to_writer, writer_to_qc, qc_to_orchestrator.
- Knowledge-base: 8 файлов + reference (см. docs/knowledge/dsh/README.md).

**Проверено в M2.6:**
Цикл Writer → QC → Orchestrator отработал за один оборот. QC нашёл CRITICAL
(um-001 — структурный дубликат активного ug_006) и SUBSTANTIAL (um-002 —
дистрактор groupmod -U). Orchestrator независимо перепроверил ug_006,
подтвердил и принял decision=rework с rework_targets=[um-001, um-002].
Ни один вопрос в банк не принят — цикл работает как задумано.

**Модель QC:** deepseek-official/deepseek-v4-pro (per-session через /model).
Модель Writer: tier-router/smart (default). Diversity слепых пятен обеспечена.

**Ограничение (подтверждено в M2.2c-1):** модель НЕ задаётся файлами пресета.
Только per-session через /model в UI.

**Уроки M2.6:**
1. Orchestrator обязан сверять topic с банком ПЕРЕД выдачей задачи Writer'у.
   В M2.6 topic user_management из задания не существует; канон — users_groups
   (src/data/topics.ts).
2. workspace-write блокирует WSL (Wsl/Service/E_ACCESSDENIED). man-верификация
   требует danger-full-access.
3. STATE.md хронически отставал (4+ коммитов). Решение: убрать хардкод HEAD,
   заменить на дату sync. Лаг устранён архитектурно.

**STATE.md — изменение политики:**
Раньше: HEAD = <hex> — требовало финального коммита на каждый milestone.
Теперь: sync <дата> — не требует синхронизации HEAD после коммита.
Реальные хеши видны через git log.
