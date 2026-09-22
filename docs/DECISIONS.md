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
