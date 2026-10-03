---
id: 054
slug: exam-mode
status: done
type: feature
track: fast
created: 2026-10-03
updated: 2026-10-03
commit: 8d58264
embedded_approve: rule 2 (F5.0a)
---

## Цель

Exam mode: 30/60/90 вопросов × 30/60/120 мин, порог 70%. 3 экрана.

## Что делаем

exam.ts (domain) + 3 экрана + router + Dashboard + e2e. См. feat-коммит.

Отличия от исторического инлайн-экзамена (20 вопросов / 30 минут, живёт в
`Question.tsx` через `examActive` / `startExam` / `answerExam` / `finishExam`):
конфигурируемые пресеты, порог сдачи 70 %, разбор по темам, отдельные экраны.
Исторический путь не тронут — на него опираются существующие e2e-спеки
(`dashboard.spec.ts`, `paywall.spec.ts`, `quiz-flow.spec.ts`), поэтому новый
прогон живёт в отдельном поле `examSession` и в session-only состоянии.

## Проверка

npm run typecheck; npm run test:run; npm run test:e2e
