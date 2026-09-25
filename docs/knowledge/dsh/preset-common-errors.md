# DSH: типичные ошибки при создании пресета

Дата: 2026-09-25
Контекст: создание пресета `linuxexam-orchestrator`.

## Проблема
Пресет не загружался при выборе в DSH. Ошибка:
> Не удалось переключиться на LinuxExam Orchestrator: loader entries failed to apply —
> failed to apply loader entry tool-fs-search (@deepseek-ai/dsh-tool-fs-search):
> invalid config: $sampleOverCapGlobResults missing required value
> ... failed to apply loader entry plan-mode (@deepseek-ai/dsh-plan-mode):
> PlanModeConfig needs a non-empty `section`

## Причина
В `agent.cordis.yml` были пропущены обязательные поля конфига у двух плагинов:
1. `tool-fs-search` требует `sampleOverCapGlobResults` (boolean)
2. `plan-mode` требует `section` (non-empty string)

Шаблон был скопирован из документации без этих полей. DSH падает с runtime-ошибкой
только при загрузке пресета — то есть ошибка выявляется не сразу.

## Решение
Добавить оба поля:

    - id: tool-fs-search
      name: '@deepseek-ai/dsh-tool-fs-search'
      config:
        sampleOverCapGlobResults: false

    # ... и внутри группы planning:
        - id: plan-mode
          name: '@deepseek-ai/dsh-plan-mode'
          config:
            section: |
              Ты в plan mode. Оставайся в нём, пока exit_plan_mode не сработает
              или пользователь не переключит режим. Сначала исследуй: используй
              только читающие операции. Когда план готов — вызови exit_plan_mode.

## Как избежать
1. **Перед копированием пресета смотреть эталонный shipped** (`cordis` пресет поставки) —
   там все обязательные поля конфигов указаны.
2. **Загружать пресет сразу после создания** — DSH выдаст ошибку при монтировании,
   а не молча проигнорирует.
3. **Помнить:** любая ошибка загрузки пресета фатальна для сессии. DSH не поднимет
   сессию с частично загруженным пресетом.

## Проверка
После фикса:
- Новая сессия → выбрать «LinuxExam Orchestrator» → нет toast об ошибке.
- Агент читает `.project/` при старте (подтверждает, что skills работают).
