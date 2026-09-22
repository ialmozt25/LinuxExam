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
