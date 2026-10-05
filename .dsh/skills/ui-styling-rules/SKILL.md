---
name: ui-styling-rules
description: Жёсткие правила вёрстки LinuxExam (best practices 2026). Использовать при любой правке UI/стилей: компоненты, экраны, tokens.css. Токены, адаптивность, TMA-специфика, доступность, анимации.
---

# ui-styling-rules

## Когда использовать
Любая правка `src/**/*.tsx`, `src/**/*.css`, `tokens.css`. Загружать до начала работы.

## 1. Design Tokens — только var(--...)
- Единственный источник: `src/presentation/theme/tokens.css`
- Иерархия: global (примитивы) → semantic (роли) → component
- Именование по назначению: `--color-action-primary` (не `--color-blue-500`)
- ЗАПРЕЩЕНО: hex, `rgb()`, `hsl()`, px-литералы для цветов/отступов
- Нет токена — добавь в `tokens.css` (уникальное имя, без дублей)

## 2. Mobile-first — только min-width
- Базовые стили для 390×844, улучшение через `@media (min-width: ...)`
- Breakpoints: 390 (base), 768 (tablet), 1200 (desktop)
- ЗАПРЕЩЕНО: `max-width` медиа-запросы

## 3. Container Queries — компонентная адаптивность
- `@container` для компонентов `src/ui/` (реагируют на родителя)
- `container-type: inline-size` на wrapper
- `@media` — только для «оболочки» страницы и user preferences

## 4. Telegram Mini App — специфика
- Высота: `100dvh` с fallback `100vh`
- Safe area: `padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px))`
- Meta viewport: `width=device-width, initial-scale=1, viewport-fit=cover`
- Слушать `window.visualViewport` для клавиатуры

## 5. Доступность — WCAG 2.2 AA
- Контраст: 4.5:1 обычный, 3:1 крупный (>18.66px bold или >24px)
- Focus: `:focus-visible` (не `:focus`) — контраст ≥3:1, толщина ≥2px, двухцветный
- `aria-label` для иконочных кнопок
- Семантика: `<button>` вместо `<div onclick>`
- Не полагаться только на цвет

## 6. Fluid Typography — clamp()
- `font-size: clamp(1rem, 0.5rem + 2vw, 2rem)`, `rem` обязателен
- Fluid spacing через `clamp()`
- ЗАПРЕЩЕНО: фиксированные `height` для контента

## 7. Анимации
- Только `transform` и `opacity` (GPU)
- `will-change` — запрещено превентивно
- Длительность 200–300ms (стандарт), 100–150ms (микро)
- Обязательно: `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }`

## 8. Dark Mode
- `color-scheme: light dark` в `:root`
- `light-dark()` для парных значений
- Тема через `[data-theme="dark"]` на root

## 9. Логические свойства
- `margin-inline-start` вместо `margin-left`, `padding-inline-end` вместо `padding-right`
- Хардкод `left`/`right` — баг для возможного RTL

## 10. Компоненты
- Все UI-компоненты в `src/ui/`: Badge, Button, Card
- ЗАПРЕЩЕНО: дубли вне `src/ui/`
- Props: typed `interface`, variant через union
- Никакой бизнес-логики
- DOM-контракты: Badge = `span`, Card `as="button"` = `button`

## 11. Современный CSS 2026 (разрешено)
- `:has()` — state-driven без JS
- `oklch()`, `color-mix()` — цветовые шкалы
- `text-wrap: balance` (заголовки), `pretty` (абзацы)
- `@starting-style`, `transition-behavior: allow-discrete` — entry/exit
- `scrollbar-gutter: stable` — анти-layout-shift
- Cascade layers (`@layer`) — только для custom CSS; Tailwind 3 управляет порядком
  через `@tailwind base/components/utilities`

## 12. Проверка перед коммитом
- `node scripts/fitness/audit-ui.mjs` → 0 violations (кроме advisory dead-tokens)
- `npm run typecheck` / `npm run test:run` → 0
- Скриншоты 390/768/1200
- VERIFIED на телефоне в TWA (обязательно, FASB-001)

## Ссылки
- Токены: `src/presentation/theme/tokens.css`
- Контракт: `.project/governance/frontend-contract.yaml`
- Компоненты: `src/ui/`
- TMA: https://docs.telegram-mini-apps.com/platform/viewport
