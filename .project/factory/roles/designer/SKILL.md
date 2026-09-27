# SKILL.md — роль Designer (фабрика LinuxExam)

**M6.0 Phase 4 (D4) · дата: 2026-09-28 · статус роли: `planned`** (`roles.yaml`).
Контракт входа — `.project/factory/CONTRACTS.md` §4.2 `orchestrator_to_designer`
(**ссылка, не копия**: конверт, вход/выход, `failure_modes` живут только там).
Триггер роли и его состояние — `TRIGGER.md` рядом с этим файлом.

## Когда роль применяется

- Вход — UI-задача с `area` из контракта §4.2: `screen` | `component` | `tokens` |
  `a11y` | `theme` | `center`. Постановщик — Orchestrator, ссылка на спеку обязательна
  (правило 1 ORCH-RULES).
- Роль включается **на второй** UI-задаче (`TRIGGER.md`, `fired: false`): первую,
  как и раньше, делает Orchestrator. До срабатывания триггера этот каталог — документ,
  а не действующий исполнитель.
- Роль **не** берёт контентные задачи (freeze, правило 6) и не меняет бизнес-логику:
  скоуп — представление, токены и доступность.

## Три навыка роли

### 1. Токены — никакого хардкода

- Канон значений — `src/presentation/theme/tokens.css`; политика — `.project/TOKENS.md`
  (формат `--<область>-<роль>[-<вариант>]`; компонент не знает hex-значений и ссылается
  на токен, например `var(--accent)`).
- Копии токенов в артефактах (`docs/dashboard/dashboard.css`, `docs/index.html`) —
  **производные**: значения обязаны совпадать с каноном; расхождение — дрейф, а не «свой
  стиль».
- Добавить/изменить токен может только капитан через approve спеки типа `ui`; массовый
  ренейм — отдельная задача.
- Доказательство: `git diff` без hex/пиксельных литералов в компонентах + ссылка на
  конкретную строку `tokens.css` в отчёте.

### 2. Темы — dark/light не ломаются

- Тема переключается атрибутом `data-theme` на `<html>` (`dark` / `light`), см.
  `.project/TOKENS.md`. Обе темы проверяются на одном и том же DOM.
- Контраст (WCAG) проверяется отдельными утверждениями: `jest-axe` в jsdom не считает
  colour-contrast («incomplete» без layout-движка) — это сказано прямо в комментарии
  `src/test/a11y-utils.ts`.
- Текст интерфейса — **на русском** (AGENTS.md); английские строки в UI — регрессия.
- Доказательство: прогон тестов темы в двух режимах + отсутствие хардкода цвета.

### 3. Визуальные тесты — структура DOM, доступность, preview

- **jsdom-тест структуры**: рендер компонента через `@testing-library/react`,
  утверждения на разметку (классы, порядок, подписи) — так UI-задача получает
  объективный гейт, а не «на глаз». Прецеденты: `docs/dashboard/__tests__/humanize.test.mjs`,
  `src/test/a11y-utils.ts`.
- **a11y-тест**: `testAccessibility(container)` (`jest-axe`); `violations > 0` — задача
  не done (контракт §4.2, `failure_modes`).
- **E2E** (`playwright test`, chromium) — для пользовательских сценариев, которые не
  проверить на разметке (`npm run test:e2e`).
- **Preview**: скриншот до коммита — часть приёмки типа `ui` (`.project/DOD.md`, раздел
  `ui`); без preview approve невозможен. Preview-артефакт — путь к файлу/ссылка в отчёте.

## Границы (не-цели)

- Не меняет `quizStore`/persist и paywall-логику (контракт §4.2, `sender_may_not`).
- Не правит контент банка `src/data/**` (правило 6).
- Не коммитит без preview-скриншота (DOD `ui`).
- Не вводит хардкод цветов/отступов вне `TOKENS.md`.
- Не создаёт пресеты и не добавляет себя в пресеты — это действие капитана;
  пресет роли `null` до эскалации.

## Порядок работы

1. Прочитать спеку и контракт §4.2; зафиксировать `area`, `goal`, `target_screens`,
   `constraints`, `goal_invariant`.
2. Изменить только представление: `src/presentation/**`, `docs/dashboard/**`,
   `TOKENS.md` (по approve).
3. Написать/обновить jsdom-тест структуры и a11y-тест; прогнать
   `npm run typecheck`, `npm run test:run`, `npm run build`.
4. Собрать preview (скриншот/ссылка) — без него задача не уходит на approve.
5. Отдать отчёт по `output` контракта §4.2 (`changed_paths`, `preview`, `evidence`).
6. Закрыть задачу `sync` → коммит → конвергентный коммит → `sync:check` exit 0
   (правило 9). Push — только с approve капитана (правило 4).

## Ссылки

- Контракт: `.project/factory/CONTRACTS.md` §4.2 `orchestrator_to_designer`.
- Триггер и статус роли: `.project/factory/roles/designer/TRIGGER.md`,
  `.project/factory/roles.yaml`.
- Критерии DONE: `.project/factory/roles/designer/DOD.md`, `.project/DOD.md` (раздел `ui`).
- Токены: `.project/TOKENS.md`, `src/presentation/theme/tokens.css`.
- Инструменты проверки: `src/test/a11y-utils.ts`, `vitest.config.ts` (jsdom глобально).
- Правила: `.project/ORCH-RULES.md` (1, 3, 4, 6, 9).
