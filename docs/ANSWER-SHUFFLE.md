# Answer shuffle is INTENTIONALLY DISABLED (beta phase)

All correct answers are currently in position 1 (`options[0].correct === true`).
This is a deliberate choice for the beta phase:

- Beginners feel rewarded on first tries
- Simplifies manual QA and data verification
- Fast prototyping without option re-ordering

## Before public launch

Implement `QuizService.shuffleQuestions()` with a deterministic seed (42)
so all tests remain stable.

## Do NOT

- Do NOT shuffle without user approval
- Do NOT shuffle while beta testing is ongoing

## Known feedback

Beta tester with 6+ years of experience noticed the pattern immediately
(2026-09-22). Track as known issue.

## letterSpacing fallback

Dashboard.tsx uses `var(--letter-wide, 0.5px)` inline fallback (2 occurrences).
Token `--letter-wide` is NOT defined in `tokens.css`. If migration needed
later, add token and remove inline fallbacks in a separate commit.
