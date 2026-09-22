# Option shuffle

> **Status: ENABLED at runtime** (was: disabled during early beta).
> Updated 2026-09-22.

## Current behaviour

Option order is randomised **deterministically at render time** by
`shuffleOptions()` in `src/domain/quizService.ts` (commit `a2e3b4c`).

| Aspect | Implementation |
|---|---|
| Algorithm | Fisher-Yates |
| PRNG | mulberry32 |
| Seed | `seedFromId(question.id)` - FNV-1a hash of the question id |
| Purity | Input array is never mutated |
| Mapping | Each option carries `originalIndex`, so a visual position maps back to the stored index |

Because the seed comes from the question id, a given question always renders its
options in the same order: stable across re-renders, reloads and sessions, so there
is no visual flicker and no test flakiness.

## Why it was enabled

Three of five beta testers noticed that **every** correct answer sat at position 1.
The stored bank still has `options[0].correct === true` for all 35 questions - that
is now invisible to the user because the display order is shuffled.

`AnswerRecord.selectedIndex` refers to the **original** options array, never the
displayed order. Any new code that maps a click to an answer must use
`option.originalIndex`.

## Question order is NOT shuffled

Only option order is randomised. Question order stays as authored (see
DECISION-007). Shuffling question order would need a new persisted
`questionOrder` field - a separate task.

## Tests

`src/domain/__tests__/shuffleOptions.test.ts` covers the algorithm, its
determinism, non-mutation, `originalIndex` mapping, and the real question bank
(it asserts the stored bank really does have every answer at position 0).

## Guards

- Do NOT shuffle without user approval.
- Do NOT change the seed source: determinism is what keeps the suite stable.

## letterSpacing fallback

`Dashboard.tsx` used `var(--letter-wide, 0.5px)` inline fallback. Token
`--letter-wide` is still NOT defined in `tokens.css`. If a migration is needed
later, add the token and remove the inline fallbacks in a separate commit.
