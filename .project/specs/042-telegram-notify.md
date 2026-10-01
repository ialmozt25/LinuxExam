---
id: 042
slug: telegram-notify
type: infra
status: approved
created: 2026-10-01
updated: 2026-10-01
commit: null
---

# Spec 042 — Telegram-уведомления о ходе работ

## Контекст

Капитан не видит прогон между STOP-точками. Токен и `chat_id` — в
`~/.dsh/telegram-bot.json` (вне репо, `{"token","chat_id"}`).

## Цель

`npm run notify -- "текст" --event <type>` шлёт сообщение в Telegram.
Встроена в `close-spec`, `enrich-spec`, `run-spec`, skill `run-spec-chain`.
Минимальная видимость в центре (одна строка).
Не ломает прогон при сбое Telegram.

## Технические решения (обязательны)

- Node >= 18, `node:https` (не fetch). Preflight в `notify.mjs`.
- Persistent state: `.project/scripts/notify-state.json`
  (gitignored, tmp+rename, file lock `.lock` с PID+timestamp, stale
  >30s удаляется, повреждённый JSON → дефолты + WARN).
- Token Bucket: 1 msg/sec на chat, burst 10.
- Retry: `429` → `retry_after` + retry(3); `5xx` → backoff + jitter (до 3); `401` → без retry.
- Circuit breaker: 5 ошибок подряд → cooldown 60s → запись в
  `notify-log.jsonl` со `status:circuit_open` (НЕ в `log.md`).
- Dedup по ключу `(event, hash(message))`, окно из конфига.
- HTML escape (`<`, `>`, `&`), обрезка > 4096.
- Redaction (WARN): Telegram `\d{8,10}:[A-Za-z0-9_-]{35}`, OpenAI
  `sk-...`, GitHub `ghp_...`, AWS `AKIA...` → `[REDACTED]`.
- NullNotifier при отсутствии токена/chat_id (no-op, `status:skipped`).
- Exit: send-режим = 0 всегда; `--health` = 0 / 1 (invalid_token) / 2 (no_network).

## Задачи

**T1** `.project/scripts/notify.mjs` (zero-deps): ядро по решениям выше.
Флаги: `--dry-run --event --health` + тестовые
`--token-file --state-file --dedup-window-override --rate-override
--simulate-network-error --cooldown-override`.

**T2** Интеграция: `close-spec.mjs` (spec_closed),
`enrich-spec.mjs` (gate_failed / spec_closed),
`run-spec.mjs` (mas_started / mas_finished),
skill `run-spec-chain/SKILL.md` (stop_point). Fire-and-forget, try/catch.

**T3** `package.json` (`notify`, `notify:health`), конфиг
`.project/notify-config.json` (`enabled, events[], rate_limit_sec,
dedup_window_sec, circuit_breaker_threshold, circuit_breaker_cooldown_sec`),
логи `.project/logs/notify-log.jsonl` (создаётся при первом вызове,
без ротации в MVP), `.gitignore` (`notify-state.json`, `.lock`,
`/.project/logs/`).

**T4** `.project/sync.mjs` — одна строка видимости в центре:
читает `notify-state.json` + последнюю запись `notify-log.jsonl`,
рендерит в существующий блок (Память или рядом с плитками):

- нет state → `Уведомления: —`
- состояние ok → `Уведомления: ✓ отправлено N сегодня`
- circuit_open → `Уведомления: ⚠ circuit open (N мин назад)`
- последний статус `invalid_token` → `Уведомления: ⚠ invalid token`

Не создавать новую плитку. Не менять существующие блоки. Только одна
строка.

Write-скоупы: T1→notify.mjs; T2→4 файла интеграции; T3→package.json+
config+logs+.gitignore; T4→.project/sync.mjs. T2, T3, T4 зависят от T1.
Без пересечений.

## Write-скоупы

```
t0  → .project/drafts/spec-042-design.md (артефакт прогона, untracked)
t1  → .project/scripts/notify.mjs
t2  → .project/scripts/close-spec.mjs, .project/scripts/enrich-spec.mjs,
      .project/scripts/run-spec.mjs,
      docs/spec-chain/skills/run-spec-chain/SKILL.md
t3  → package.json, .project/notify-config.json, .project/logs/,
      .gitignore
t4  → .project/sync.mjs
t5  → read-only (отчёты в .project/drafts/spec-042-qc/)
t6  → read-only (отчёт reviewer)
```

## Декомпозиция

1. id: `t0-design`, subject: спроектировать интерфейс `notify.mjs`, схемы
   `notify-state.json` / `notify-log.jsonl` и точки интеграции;
   assignee: architect, dependencies: []
2. id: `t1-notify-core`, subject: `.project/scripts/notify.mjs` — ядро
   (T1: zero-deps, `node:https`, preflight, state+lock, token bucket,
   retry, circuit breaker, dedup, HTML escape, redaction, NullNotifier,
   exit-коды, все флаги); assignee: builder, dependencies: [`t0-design`]
3. id: `t2-integration`, subject: интеграция в `close-spec.mjs`,
   `enrich-spec.mjs`, `run-spec.mjs`, skill `run-spec-chain/SKILL.md`
   (T2, fire-and-forget + try/catch); assignee: builder,
   dependencies: [`t1-notify-core`]
4. id: `t3-package-config`, subject: `package.json` (`notify`,
   `notify:health`) + `.project/notify-config.json` + `.project/logs/` +
   `.gitignore` (T3); assignee: builder, dependencies: [`t1-notify-core`]
5. id: `t4-sync-line`, subject: одна строка `Уведомления:` в
   `.project/sync.mjs` (T4, без новой плитки); assignee: builder,
   dependencies: [`t1-notify-core`]
6. id: `t5-verify`, subject: прогнать критерии приёмки 1–13 и гейты
   (ratification by re-execution); assignee: tester,
   dependencies: [`t2-integration`, `t3-package-config`, `t4-sync-line`]
7. id: `t6-review`, subject: финальное ревью `t1–t5`, verdict PASS/FAIL;
   assignee: reviewer, dependencies: [`t5-verify`]

## Критерии приёмки

1. `notify --dry-run --event spec_closed` → 0, печатает `DRY-RUN`.
2. `notify --event spec_closed` с реальным токеном → 0, сообщение в TG.
3. Без токена → 0, `status:skipped` в notify-log.
4. Rate limit (persist): 2 вызова → 2-й `status:rate_limited`.
5. Dedup (persist): 2 вызова с тем же `--event` и текстом в окне
   `--dedup-window-override 3` → 1 отправка, 2-й `status:deduped`.
6. HTML: `test <b>x</b> & y` → жирный + `&`.
7. Redaction: `123456789:ABCdef...` → `[REDACTED]` в отправке + WARN.
8. Circuit breaker: 5 вызовов `--token-file <invalid>` → 5×`error`,
   6-й → `circuit_open`.
9. `notify:health` (valid) → 0, `{healthy:true,latency_ms,bot_username}`.
10. `notify:health --token-file <invalid>` → 1, `error:invalid_token`.
11. `notify:health --simulate-network-error` → 2, `error:no_network`.
12. После `npm run sync` в `docs/index.html` есть строка
    `Уведомления: ...` (проверка: `Select-String "Уведомления:"`).
13. `typecheck` 0, `test:run` 0, `sync:check` 0, `consistency:check` 0.

## Что НЕ трогать

- `src/**`, `tools/**`
- `.project/check-consistency.mjs`
- `log.md` (manual, strict format, single-writer)
- спеки 028–041
- `~/.dsh/**`

## Отчёт капитану

- diff + скриншот TG-сообщения + exit-коды тестов + скриншот строки
  «Уведомления:» в центре + проверка
  `git log --all -p | Select-String "AAF|8648988114"` → пусто.

## Push не выполнять (правило 10/11).
