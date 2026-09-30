# RUN-SPEC-LIVE — spec-013 smoke (Step 0, spec 034)

Источник: ручной прогон капитана после t5 STOP.

## Команда
```
node .project/scripts/run-spec.mjs 013 --workspace . --timeout-ms 600000
```

## Результат
- Exit: **0**
- Duration: **105716 ms**
- Preflight: **6/6** (dsh CLI 0.1.5-rc.2, профиль `mas`, плагин `@nanmicoder/dsh-agent-teams`, workspace, `.agent-teams`, шаблоны `templates/mas`)
- `execute`: ok
- `collect`: ok — `team-id` = `spec-013-local-aliases`, `team.json` создан
- `mas-runs.json`: запись добавлена

## Команда на диске
- Path: `.agent-teams/spec-013-local-aliases/team.json`
- Members: 3, Tasks: 3
- Phase: `staged`
- Note: модель в headless-профиле остановилась на «present plan, end turn for review» — правильное поведение (не approve сама).

## Окружение
- Профиль: `C:\Users\Alexey Udotov\.dsh\profiles\mas`
- API key: `DEEPSEEK_API_KEY` (env, user-level)
- Создан: 2026-09-30, вручную капитаном после t5 STOP.

## Следствие
Критерий 1 spec 034 (Step 0) — **выполнен**. Цикл автономии технически замкнут: `run-spec.mjs <spec-id>` запускает команду через `dsh --profile mas` one-shot, без ручного переноса промптов.
