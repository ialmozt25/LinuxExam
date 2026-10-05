---
name: ui-screen-migrate
description: Мигрировать экран на src/ui/ и токены. Использовать, когда экран содержит локальные Badge/Button/Card или hex.
---

# ui-screen-migrate

## Когда
Экран из `src/presentation/screens/` содержит локальные `Badge`/`Button`/`Card`
или hex-цвета вместо токенов.

## Шаги
1. Прочитай экран целиком: `src/presentation/screens/<Screen>.tsx`.
2. Найди нарушения в этом файле:
   - дубли `(?:function|const)\s+(Badge|Button|Card)\b`;
   - hex `#RRGGBB` / `#RGB` / `#RRGGBBAA`.
3. Замени дубли на импорт из `src/ui/`, а цвета — на `var(--...)` из
   `src/presentation/theme/tokens.css`. Если нужного компонента в `src/ui/`
   ещё нет — сначала скилл `ui-component-create`.
4. Логику экрана не менять: props, состояние, обработчики, тексты — как были.
5. Сними скриншоты на 390 / 768 / 1200 px и сравни с эталоном
   (ширина вьюпорта не должна давать горизонтальный скролл).
6. Прогони `npm run typecheck`, `npm run test:run`, `npm run test:e2e`.
7. Прогони `npm run fitness` — нарушения по этому экрану должны исчезнуть.

## Границы
- Не меняй логику поведения (условия, таймеры, переходы, API вызовы).
- Не трогай `src/data/`, `tools/`, `.project/sync.mjs`, `backend/`.
- Не добавляй зависимости.
- Не коммить без approve капитана.

## Проверка
```bash
npm run typecheck
npm run test:run
npm run test:e2e
npm run fitness
```
