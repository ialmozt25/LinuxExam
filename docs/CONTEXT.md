# LinuxExam — CONTEXT

> Стартовая точка для новой сессии агента. Читать ПЕРВЫМ.

## Проект (30 секунд)

- Telegram Mini App для подготовки к сертификации RHCSA (EX200)
- Стек: React 18 + TS + Vite + Zustand + @telegram-apps/sdk + Tailwind + motion + lucide
- Прод: https://ialmozt25.github.io/LinuxExam/
- Репо: github.com/ialmozt25/LinuxExam (публичный, миграция на VPS — backlog)
- Бот: @linux_exam_bot (токен отозван — блокер монетизации)

## Текущее состояние

- Банк: 66 вопросов (3 базовых темы + essential_tools + users_groups + security)
- origin/main = 87c14a0
- Bundle gzip: 138 kB (backlog: lazy-load questions.json)
- Тема: 3 состояния (light/dark/inherit) через data-theme + data-theme-source
- 128 unit + 18 e2e — все зелёные

## Архитектура

- 4 слоя: data / domain / presentation / platform
- domain/ не импортирует React/Zustand
- 3 потока ответов: regular / review / exam
- QC: tools/qc.cjs (5 проверок), tools/cosine.cjs (semantic duplicates)

## Что закрыто (не переделывать)

- Тема (DECISION-009..013)
- Логика quizStore (B1 — free-gate)
- UI подсветка (hover + hex fix)
- Пайплайн вопросов: essential_tools, users_groups
- questionStats (persist version 2)

## Открытые вопросы

- Монетизация: токен бота отозван — перевыпустить в BotFather
- Хостинг: приватность репо (VPS или GitHub Pro)
- Lazy-load questions.json — критично до 100+ вопросов
- Ужесточение L8 (сейчас 4/4 чеклист мягкий: 12/12 без reject)
- L5c intra-batch — код и тесты в проде (per-text embedding, batch-independent, verified 2026-09-23)
- Dependabot: 52 уязвимости в deps
- @xenova/transformers в dependencies → devDependencies
- Cosine-модель: замена на русскоязычную (cointegrated/rubert-tiny2) после 100+ вопросов

## Отклонённые подходы (НЕ пробовать)

- Cloudflare Workers/Pages — недоступны в РФ
- МАС с гомогенными агентами — конформизм 85%, хуже одиночного
- !important в inline-стилях — anti-pattern
- \b с кириллицей в JS regex — не работает
- Add-Content в PS 5.1 — даёт UTF-16 BOM
- emulateMedia Playwright для тем — не работает с data-theme
- Cache-busting через query-params — Vite уже content-hashed
- Само-коррекция при zero_passed без ревью — понижает критерии

## Правила работы

1. Одна задача = одна сессия агента
2. Pre-read: session-log (3) + CONTEXT + DECISIONS + последний report
3. Context guard: usage > 500K → новая сессия
4. Не пушить без ahead=1 (перед push — fetch)
5. Атомарные коммиты: один симптом = один коммит
6. В session-log — append после каждой сессии
7. Промпт на 10 проходов — не более 2 итераций (diminishing returns)
8. Rocky Linux 9.8 в WSL2 — источник истины для man
9. Агент не может видеть свой context usage — если harness предупреждает, СТОП

## Ключевые цифры

- Порог cosine: 0.80 (class inversion — детектор не разделяет классы; см. calibration.json.cosine_limitation)
- Jaccard порог: 0.9 (bigram)
- Bundle watch: >137 kB gzip — стоп
- L8 порог: 4/4
- Категории verdict: pass / pass_with_flag / reserve / reject

## Ссылки

- DECISIONS: docs/DECISIONS.md
- Session-log: docs/session-log.md
- Audits: docs/audit-*.md
- Reports: drafts/report-*.md
- Calibration: tools/cosine-calibration.json