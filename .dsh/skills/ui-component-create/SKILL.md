---
name: ui-component-create
description: Создать переиспользуемый UI-компонент в src/ui/ с токенами из tokens.css. Использовать, когда нужен Badge/Button/Card.
---

# ui-component-create

## Когда
Нужен переиспользуемый UI-компонент: `Badge`, `Button`, `Card` или новый примитив
для `src/ui/`. Также когда один и тот же кусок разметки дублируется на 2+ экранах.

## Шаги
1. Если `src/ui/` нет — создай каталог `src/ui/`.
2. Прочитай `src/presentation/theme/tokens.css` и выбери существующие токены
   (`--btn-primary-bg`, `--card-radius`, `--space-3`, `--text-sm`, ...).
   Новых hex-значений не вводить.
3. Напиши компонент в `src/ui/<Name>.tsx`:
   - typed props через `interface`/`type`, без `any`;
   - цвета и отступы только через `var(--token)`;
   - экспорт по имени (`export function Badge(...)`), без default;
   - для иконочных кнопок — обязательный `aria-label`.
4. Добавь unit-тест Vitest рядом: `src/ui/__tests__/<Name>.test.tsx`
   (рендер, базовое поведение, доступное имя).
5. Прогони `npm run typecheck` и `npm run test:run`.
6. Прогони `npm run fitness` — нарушения «no-hex-in-tsx» и
   «no-duplicate-components» должны быть нулевыми по твоему файлу.

## Границы
- Не трогай экраны `src/presentation/screens/` без необходимости — миграция
  экранов это другой скилл (`ui-screen-migrate`).
- Не добавляй зависимости в `package.json`.
- Не меняй `src/domain/`, `src/data/`, `tools/`.
- Не коммить без approve капитана.

## Проверка
```bash
npm run typecheck
npm run test:run
npm run fitness
```
