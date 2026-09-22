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
