---
version: alpha
name: LinuxExam
dials:
  variance: 4
  motion: 2
  density: 6
colors:
  primary: "#1565C0"
  neutral: "#1E1E1E"
typography:
  base: 16px
  ratio: 1.25
rounded:
  sm: 4px
  md: 8px
spacing:
  base: 4px
---

# DESIGN.md — LinuxExam

## Overview
Читаю LinuxExam как: образовательный тренажёр для IT-специалистов (RHCSA), с вайбом
Linear-clean meets technical precision, склоняясь к тёмной теме + один акцент.
Три ручки: variance 4 (структура, не хаос), motion 2 (движение служебное), density 6
(плотный cockpit данных). Это инструмент, не лендинг: экран существует, чтобы отвечать
на вопросы, а не чтобы продавать.

## Colors
Один accent — `#1565C0` (`--color-accent`), нейтральная шкала `#1E1E1E` → `#FFFFFF`.
`--color-accent` и `--color-accent-strong` — ОДНА роль в двух оттенках, не два accent:
strong — для текста и hover, базовый — для заливок. Контраст: 4.5:1 для текста,
3:1 для крупных элементов и границ. Второй accent — нарушение (tell 10).

## Typography
Один sans-стек: `system-ui` / `-apple-system`. Inter/Roboto/Arial/Helvetica как
ПЕРВЫЙ шрифт запрещены (tell 11). Шкала 1.25 от 16px: 13 / 16 / 20 / 25 / 31 / 39 / 49.
Line-height 1.5 для body, 1.25 для заголовков. Иерархия — через weight и size,
не через цвет и не через рамки.

## Layout
4pt grid: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Все отступы — только `var(--space-*)`,
px-литералов в `.tsx` нет. Mobile-first: 390 (base) → 768 → 1200, медиа-запросы
только `min-width`. Один столбец — норма, а не бедность: сетка появляется, когда
данные реально параллельны.

## Elevation
Максимум 2 уровня shadow. Большинство поверхностей — flat; границу даёт
`--border-subtle`, а не тень. Blur > 24px и diffuse shadow — нарушение (tell 7).
Elevation поднимает модалку/поповер, а не «делает красиво».

## Shapes
4px — компактные элементы (badge, input, chip), 8px — карточки и панели.
16px+ на большинстве поверхностей запрещено. Пилюля — только для статуса.

## Components
Atoms живут в `src/ui/`. Варианты отделены от состояний: variant — это роль
(primary/secondary/ghost), state — это hover/focus/disabled/loading. Composition через
`children`, не через проп-флаги. Компонент читает токены, hex в `.tsx` запрещён.

## Do's and Don'ts
Do's: один accent; SVG-иконки; тёмная тема — канон; типографика ведёт иерархию;
5 состояний формы; tap-target ≥ 44px; focus-ring видим всегда.
Don'ts — 12 anti-slop tells (машинный фильтр `scripts/fitness/check-slop.mjs`):
1. tech gradient `#6366f1`/`#8b5cf6`/`#a855f7`; 2. 3-column feature grid; 3. centered
hero + gradient; 4. `backdrop-filter: blur` вне modal/popover/toast; 5. stat monument
(число ≥ 48px без label < 14px рядом); 6. icon topper (≥ 3 секций подряд);
7. diffuse shadow (blur > 24px); 8. emoji-as-icon в feature-блоке; 9. hardcoded
font-size в px; 10. ≥ 2 accent в `tokens.css`; 11. default type stack
(Inter/Roboto/Arial/Helvetica); 12. token bypass (hex == значение существующего токена).

## Anti-references
Не Notion — много воздуха, нет плотности. Не Vercel — tech-bro-минимализм и градиенты.
Не Duolingo — playful, геймификация ради геймификации. Ориентир: Linear + терминал.
