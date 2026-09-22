# Decisions Log

Журнал решений агента при неоднозначных спецификациях.

## DECISION-001 (2026-09-22)

**Контекст:** topics clickable vs non-clickable в roadmap Dashboard.
**Решение:** некликабельные `<div>` без onClick.
**Обоснование:** store не имеет `startTopicQuiz(topic)`. Клик с одним
`navigateTo('question')` может попасть в stale review stream. Отдельный
коммит после добавления `startTopicQuiz` в store.

## DECISION-002 (2026-09-22)

**Контекст:** `--letter-wide` отсутствует в tokens.css.
**Решение:** inline fallback `var(--letter-wide, 0.5px)` (2 места в Dashboard).
**Обоснование:** 2 использования, минимальный scope, fallback работает
независимо от наличия токена.

## DECISION-003 (2026-09-22)

**Контекст:** `nextQuestion` использовал `questions.length` как pool size, игнорируя review stream.
**Решение:** pool size теперь следует активному stream: exam > review > regular.
**Обоснование:** без этого topic-quiz (12 вопросов) уходил за пределы своего пула,
`activeTopic` никогда не очищался, а счётчик в Question показывал чужой total.

## DECISION-004 (2026-09-22)

**Контекст:** topics should be clickable, store не имеет startTopicQuiz.
**Решение:** startTopicQuiz переиспользует reviewQuestionIds/reviewAnswers + добавляет
флаг activeTopic для отличия topic quiz от «Повторить ошибки».
**Обоснование:** отдельный 4-й stream = дублирование логики Question.tsx.
`activeTopic` не персистится (session state).

## DECISION-005 (2026-09-22)

**Контекст:** «Повторить ошибки» пропала с Dashboard.
**Решение:** добавлена conditional button выше roadmap (видна только при wrongQuestionIds.length > 0).

## DECISION-006 (2026-09-22)

**Контекст:** E2E flake на assertion заголовка из-за race с dev-server.
**Решение:** явный timeout 10s на assertion. НЕ используем
`waitForLoadState("networkidle")` — deprecated в Playwright, никогда не
достигается на Vite HMR WebSocket.

## DECISION-007 (2026-09-22)

**Контекст:** testers asked for both option order and question order shuffle.
**Решение:** implemented option shuffle only (deterministic, seed from
question.id). Question order stays as-is.
**Обоснование:** option shuffle solves 80% of "cheat by peeking". Question
order shuffle needs new state field (questionOrder) — separate task.

## DECISION-008 (2026-09-22)

**Контекст:** bug — правильный ответ в режиме «Повторить ошибки» не
уменьшал wrongQuestionIds.

**Решение:** unified rule — любой правильный ответ (в regular, review,
topic) удаляет вопрос из wrongQuestionIds; любой неправильный добавляет.
answerExam по-прежнему изолирован (экзамен не влияет на ошибки).

**Обоснование:** Duolingo-style mastery-based retry. Счётчик уменьшается
при правильных ответах — мотивация. Spaced repetition (SRS) — отдельная
задача.

**Примечание (реализация):** `streams-isolation.test.ts` не существовал —
создан в этом коммите. Хелперы `resetStore`/`mockQuestions` продублированы
(не импортированы из `topic-quiz.test.ts`), чтобы тесты не были связаны.
`wrongQuestionIds` пишется только при фактическом изменении membership —
это проверяется отдельным тестом.

## DECISION-009 (2026-09-22)

**Контекст:** фидбек от Евгения — «неудобно читать белое на чёрном».

**Решение:** three-state theme (System/Light/Dark):

1. `<meta name="color-scheme">` + `color-scheme: light dark` в CSS —
   нативные controls следуют теме.
2. `data-theme` на `<html>` — вместо MQ `prefers-color-scheme` в CSS
   (W3C CSSWG: MQ конфликтует с manual toggle).
3. FOUC prevention — inline `<script>` в `<head>` до загрузки JS.
4. Three states, не binary — System сохраняется как отдельный выбор.
5. WCAG 2.2 AA — text ≥4.5:1, borders документированы как декоративные.

**Не переопределяем:** `--accent`, `--success`, `--danger`, `--warning`.
**Не используем:** `light-dark()` CSS function (не поддерживается в
старых WebView Telegram — Android 8-10).

**Multi-tab sync:** не реализовано. Если нужен — добавить
`window.addEventListener('storage', ...)` в отдельной задаче.

**Трейд-офф (важно):** `[data-theme]` блоки задают `--bg-*`/`--text-*`
явными hex вместо `var(--tg-theme-*, fallback)`. Это осознанно: иначе
явный выбор «Светлая» не работал бы внутри тёмного Telegram-клиента.
Следствие — Mini App больше не наследует тему Telegram. Откат: убрать
hex-переопределения и вернуть `var(--tg-theme-*)` в базовом `:root`.

## DECISION-010 (2026-09-22)

**Контекст:** чат-фидбек Ilya и Евгения. Тема была three-state (System/Light/Dark),
но `system` ориентировался только на OS `prefers-color-scheme` и игнорировал тему
клиента Telegram; переключатель находился в самом низу Dashboard (после roadmap).

**Решение:** live inherit + перенос UI в настройки.

1. `useThemeController` — единый источник истины: внутри Telegram читает
   `themeParams.isDark` через `useSignal` (реагирует на смену темы без перезагрузки),
   вне Telegram — `matchMedia` с change-listener.
2. `themeParams.bindCssVars()` при mount: публикует `--tg-theme-*` и поддерживает их
   в актуальном состоянии. Одноразовый `themeParams.state()` из `useTelegramTheme`
   этого не давал.
3. `data-theme-source="inherit" | "manual"` на `<html>`. CSS-блоки темы получили
   `:not([data-theme-source="inherit"])`, поэтому в inherit-режиме hex-переопределения
   уступают живой палитре Telegram.
4. Два ключа localStorage: `lx-theme` (`system|light|dark`, источник истины) и
   `lx-theme-manual` (последний ручной выбор, дефолт `dark`).
5. UI: селектор удалён из Dashboard; в status strip — кнопка настроек; три состояния
   в `SettingsScreen` (чекбокс «Следовать Telegram / системе» + `role="switch"` с
   `aria-checked` / `aria-disabled`).

**Последствия:**

- **Breaking change для существующих `system`:** раньше внутри Telegram `system` = OS,
  теперь `system` = тема клиента Telegram. Смена поведения молчаливая — вынести как
  открытый вопрос: уведомлять пользователя или нет.
- `--accent`/`--success`/`--danger`/`--warning` по-прежнему не переопределяются.
- `light-dark()` не используется (совместимость со старыми WebView).
- Multi-tab sync не реализован (см. DECISION-009).

## DECISION-011 (2026-09-22)

**Контекст:** UX-баги в настройках темы. Подпись свитча была статичной, при
inherit могла встать тёмная тема при светлой OS, ручной режим был непонятен.
Read-only разведка нашла две независимые причины.

**Причина 1 (UI):** свитч читал `readManualChoice()`, то есть *последний ручной
выбор*, а не текущую resolved-тему. При inherit он показывал дефолтное значение,
а не то, что реально применено.

**Причина 2 (данные):** путь `useThemeController` → `applyThemeChoice(choice)` →
`resolveTheme(choice)` не передавал `themeParams.isDark`. Оба вызова — в
`applyThemeChoice` и в `applyThemeState` — падали в `getSystemTheme()` (matchMedia),
поэтому внутри Telegram при `inherit` применялась тема OS, а не клиента.

**Решение:**

1. **Один свитч вместо чекбокса + свитча.** Подпись, иконка и `aria-checked`
   описывают ТЕКУЩУЮ resolved-тему; свитч переключает её напрямую.
   Это отступление от более ранней модели «чекбокс inherit + свитч day/night»,
   которая и породила баги: два контрола на одно состояние допускали
   рассогласование, а «inherit» как отдельный переключатель не читался.
   Принцип: одно состояние — один контрол.
2. **Новый формат хранения:** ключ `lx-theme` ОТСУТСТВУЕТ = inherit;
   `lx-theme` = `light` | `dark` = явный выбор. `'system'` больше не пишется,
   но всё ещё читается как inherit (обратная совместимость).
   Ключ `lx-theme-manual` упразднён.
3. **`migrateThemeStorage()`** — чистая идемпотентная функция без флага миграции;
   вызывается синхронно в `main.tsx` ДО первого чтения темы (в `useEffect` был бы
   возможен мигание-флэш).
4. **Сигнатуры:** `resolveTheme(choice, options?: { inTelegram, telegramIsDark })` и
   `applyThemeChoice(choice, telegramIsDark?: boolean)`. Выбран булев второй параметр,
   а не объект: внутри Telegram уже определяется самим наличием сигнала.
   Проверка строгая — `telegramIsDark === true`, а не truthy, чтобы `undefined` от
   несмонтированного Computed не трактовался как «тёмная».
5. **Инвариант переключения:** если новый выбор совпадает с системной темой, ключ
   удаляется (возврат к inherit); иначе записывается. Двукратное переключение при
   системной теме оставляет хранилище пустым.

**Известный трейд-офф:** `main.tsx` применяет тему на уровне модуля, где сигнал
Telegram недоступен, поэтому первый кадр использует OS-предпочтение. Если OS и
клиент Telegram расходятся, возможен короткий flash до монтирования
`useThemeController`. В этой задаче НЕ чинится (сознательно; решение — либо
проброс сигнала в early-boot пути, либо перенос применения темы на первый рендер).
