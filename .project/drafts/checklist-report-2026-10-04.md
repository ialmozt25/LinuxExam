# UI/UX checklist — отчёт прогона 2026-10-04

Сгенерировано `npm run check` (`.project/scripts/check.mjs`, spec 077).
Источник критериев: `.project/checklists/ui-ux.yaml` (version 1, обновлён 2026-10-04).

**Summary: 23 pass / 6 fail / 0 unknown / 1 manual** (всего 30)

| статус | критичных | всего |
|---|---|---|
| pass | 1 | 23 |
| fail | 1 | 6 |
| unknown | 0 | 0 |
| manual | 0 | 1 |

## Сводка по критериям

| id | title | check | status | почему |
|---|---|---|---|---|
| LAYOUT-001 | Нет горизонтального скролла | playwright | pass | проба: 0 нарушений «overflow» на 55 комбинациях |
| LAYOUT-002 | Тач-цели не меньше 44px | playwright | pass | проба: 0 нарушений «touch-target» на 55 комбинациях |
| LAYOUT-003 | CTA целиком во вьюпорте | playwright | pass | проба: 0 нарушений «cta-out-of-viewport» на 55 комбинациях |
| LAYOUT-004 | Нет элементов за границами экрана | playwright | pass | проба: 0 нарушений «escaped-element» на 55 комбинациях |
| LAYOUT-005 | Нет обрезанного текста | playwright | pass | проба: 0 нарушений «clipped-text» на 55 комбинациях |
| LAYOUT-006 | Нет 100vh (только dvh / --app-height) | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| LAYOUT-007 | Учёт safe-area (env(safe-area-inset-*)) | grep | pass | grep: 9 совпадений (ожидалось > 0) в 34 файлов |
| LAYOUT-008 | Нет переполнения по overflow-x | playwright | pass | проба: 0 нарушений «overflow» на 55 комбинациях |
| COLOR-001 | Контраст обычного текста не ниже 4.5:1 | axe | fail | axe: «color-contrast» — 13 nodes на 19 экранах |
| COLOR-002 | Контраст крупного текста не ниже 3:1 | axe | pass | axe: «color-contrast» — 0 nodes крупного текста из 13 на 19 экранах (нарушения только у обычного текста, порог 4.5:1 — см. COLOR-001) |
| COLOR-003 | Контраст текста кнопок не ниже 4.5:1 | axe | fail | axe: «color-contrast» — 6 nodes на 10 экранах |
| COLOR-004 | Нет hardcoded hex-цветов | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COLOR-005 | Не больше 3 радиусов на роль | grep | pass | grep distinct: 1 уникальных значений (лимит 3) в 33 файлов |
| COLOR-006 | Цвета берутся из токенов (var(--*)) | grep | pass | grep: 149 совпадений (ожидалось > 0) в 33 файлов |
| TYPO-001 | Основной текст не меньше 16px | grep | fail | grep: 2 совпадений (ожидалось 0) в 33 файлов |
| TYPO-002 | Межстрочный интервал не меньше 1.4 | grep | fail | grep: 1 совпадений (ожидалось 0) в 33 файлов |
| TYPO-003 | Не больше 8 размеров шрифта | grep | pass | grep distinct: 3 уникальных значений (лимит 8) в 34 файлов |
| TYPO-004 | Нет текста меньше 12px | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| TYPO-005 | Для uppercase есть letter-spacing | grep | pass | grep near: 0/8 совпадений без «letterSpacing» (±5 строк) в 33 файлов |
| SPACE-001 | Отступы кратны 4px | grep | fail | grep modulo 4: 2 значений не кратны (всего значений 11, 33 файлов) |
| SPACE-002 | Отступы лэйаута кратны 8px | grep | fail | grep modulo 8: 5 значений не кратны (всего значений 11, 33 файлов) |
| SPACE-003 | Нет отступов 13/17/22px | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| SPACE-004 | Отступы берутся из токенов var(--space-*) | grep | pass | grep: 45 совпадений (ожидалось > 0) в 34 файлов |
| STATE-001 | Кнопки имеют disabled-состояние | playwright | pass | проба: 0 нарушений «touch-target» на 55 комбинациях |
| STATE-002 | Кнопки имеют видимый focus | axe | pass | axe: правило «focus-visible» не нарушено на 19 экранах (0 nodes) |
| STATE-003 | Focus не отключён (outline: none) | grep | pass | grep: 0 совпадений (ожидалось 0) в 34 файлов |
| STATE-004 | Пустые состояния имеют CTA | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| COPY-001 | Нет generic CTA (Далее / Submit / OK / Go) | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COPY-002 | Нет blame language (Вы ввели / You entered) | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COPY-003 | Tap вместо Click | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |

## Fail

### COLOR-001 — Контраст обычного текста не ниже 4.5:1 **[critical/high]**

- порог: `4.5:1 (WCAG 2.2 AA 1.4.3)`
- источник: WCAG 2.2
- найдено: axe: «color-contrast» — 13 nodes на 19 экранах

```
: .project/drafts/a11y-baseline.json · analytics-desktop · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · analytics-mobile · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · exam-run-desktop · div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · exam-run-mobile · div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · exam-setup-desktop · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · exam-setup-mobile · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · onboarding-demo-mobile · div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · onboarding-goal-mobile · div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · onboarding-result-mobile · div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · paywall-desktop · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · paywall-mobile · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · question-desktop · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 1.61 (foreground color: #666666, background color: #0f4786, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · question-mobile · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 1.61 (foreground color: #666666, background color: #0f4786, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
```

### COLOR-003 — Контраст текста кнопок не ниже 4.5:1

- порог: `4.5:1 (WCAG 2.2 AA 1.4.3)`
- источник: WCAG 2.2
- найдено: axe: «color-contrast» — 6 nodes на 10 экранах

```
: .project/drafts/a11y-baseline.json · exam-run-desktop · div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · exam-run-mobile · div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · paywall-desktop · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · paywall-mobile · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 2.52 (foreground color: #666666, background color: #acacac, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · question-desktop · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 1.61 (foreground color: #666666, background color: #0f4786, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
: .project/drafts/a11y-baseline.json · question-mobile · #root > div:nth-child(2) — Fix any of the following: Element has insufficient color contrast of 1.61 (foreground color: #666666, background color: #0f4786, font size: 7.5pt (10px), font weight: normal). Expected contrast ratio …
```

### TYPO-001 — Основной текст не меньше 16px

- порог: `совпадений 0`
- источник: Apple HIG
- найдено: grep: 2 совпадений (ожидалось 0) в 33 файлов

```
: src/presentation/screens/Dashboard.tsx:259: fontSize: '13px',
: src/presentation/screens/Dashboard.tsx:381: fontSize: '12px',
```

### TYPO-002 — Межстрочный интервал не меньше 1.4

- порог: `совпадений 0`
- источник: WCAG 2.2
- найдено: grep: 1 совпадений (ожидалось 0) в 33 файлов

```
: src/presentation/components/StreakBadge.tsx:79: lineHeight: 1.1,
```

### SPACE-001 — Отступы кратны 4px

- порог: `(padding|margin|gap) % 4 == 0`
- источник: Apple HIG
- найдено: grep modulo 4: 2 значений не кратны (всего значений 11, 33 файлов)

```
: src/presentation/screens/Dashboard.tsx:117: padding: '2px 6px',
: src/presentation/screens/Dashboard.tsx:696: gap: '2px',
```

### SPACE-002 — Отступы лэйаута кратны 8px

- порог: `(padding|margin|gap) % 8 == 0`
- источник: Apple HIG
- найдено: grep modulo 8: 5 значений не кратны (всего значений 11, 33 файлов)

```
: src/presentation/screens/Dashboard.tsx:117: padding: '2px 6px',
: src/presentation/screens/Dashboard.tsx:257: paddingBottom: '12px',
: src/presentation/screens/Dashboard.tsx:342: margin: '4px 0 0 0',
: src/presentation/screens/Dashboard.tsx:652: gap: '4px 6px',
: src/presentation/screens/Dashboard.tsx:696: gap: '2px',
```

## Unknown (источник не найден — не «чисто», а «не проверено»)

Нет unknown.

## Manual / vision (проверяет агент)

- STATE-004 — Пустые состояния имеют CTA: визуальный аудит: PNG читает агент (npm run audit:screens)

Визуальный аудит 19 baseline PNG: `npm run audit:screens` →
`.project/drafts/visual-audit-<дата>.md` (PNG читает агент, у него есть зрение).
