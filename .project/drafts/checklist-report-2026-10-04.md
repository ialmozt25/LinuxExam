# UI/UX checklist — отчёт прогона 2026-10-04

Сгенерировано `npm run check` (`.project/scripts/check.mjs`, spec 077).
Источник критериев: `.project/checklists/ui-ux.yaml` (version 1, обновлён 2026-10-04).

**Summary: 50 pass / 0 fail / 0 unknown / 11 manual** (всего 61)

| статус | критичных | всего |
|---|---|---|
| pass | 2 | 50 |
| fail | 0 | 0 |
| unknown | 0 | 0 |
| manual | 0 | 11 |

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
| COLOR-001 | Контраст обычного текста не ниже 4.5:1 | axe | pass | axe: правило «color-contrast» не нарушено на 19 экранах (0 nodes) |
| COLOR-002 | Контраст крупного текста не ниже 3:1 | axe | pass | axe: правило «color-contrast» не нарушено на 19 экранах (0 nodes) |
| COLOR-003 | Контраст текста кнопок не ниже 4.5:1 | axe | pass | axe: правило «color-contrast» не нарушено на 10 экранах (0 nodes) |
| COLOR-004 | Нет hardcoded hex-цветов | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COLOR-005 | Не больше 3 радиусов на роль | grep | pass | grep distinct: 1 уникальных значений (лимит 3) в 33 файлов |
| COLOR-006 | Цвета берутся из токенов (var(--*)) | grep | pass | grep: 149 совпадений (ожидалось > 0) в 33 файлов |
| TYPO-001 | Основной текст не меньше 16px | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| TYPO-002 | Межстрочный интервал не меньше 1.4 | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| TYPO-003 | Не больше 8 размеров шрифта | grep | pass | grep distinct: 1 уникальных значений (лимит 8) в 34 файлов |
| TYPO-004 | Нет текста меньше 12px | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| TYPO-005 | Для uppercase есть letter-spacing | grep | pass | grep near: 0/8 совпадений без «letterSpacing» (±5 строк) в 33 файлов |
| SPACE-001 | Отступы кратны 4px | grep | pass | grep modulo 4: 0 значений не кратны (всего значений 11, 33 файлов) |
| SPACE-002 | Отступы лэйаута кратны 8px | grep | pass | grep modulo 8: 0 значений не кратны (всего значений 4, 33 файлов) |
| SPACE-003 | Нет отступов 13/17/22px | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| SPACE-004 | Отступы берутся из токенов var(--space-*) | grep | pass | grep: 45 совпадений (ожидалось > 0) в 34 файлов |
| STATE-001 | Кнопки имеют disabled-состояние | playwright | pass | проба: 0 нарушений «touch-target» на 55 комбинациях |
| STATE-002 | Кнопки имеют видимый focus | axe | pass | axe: правило «focus-visible» не нарушено на 19 экранах (0 nodes) |
| STATE-003 | Focus не отключён (outline: none) | grep | pass | grep: 0 совпадений (ожидалось 0) в 34 файлов |
| STATE-004 | Пустые состояния имеют CTA | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| COPY-001 | Нет generic CTA (Далее / Submit / OK / Go) | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COPY-002 | Нет blame language (Вы ввели / You entered) | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COPY-003 | Tap вместо Click | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| TYPO-006 | Межстрочный интервал не больше 1.6 | grep | pass | grep: 0 совпадений (ожидалось 0) в 34 файлов |
| SPACE-005 | Горизонтальные отступы кратны 4px | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COLOR-007 | Радиусы берутся из токенов var(--radius-*) | grep | pass | grep: 27 совпадений (ожидалось > 0) в 34 файлов |
| USABILITY-loading | Состояние загрузки показано пользователю | grep | pass | grep: 1 совпадений (ожидалось > 0) в 33 файлов |
| USABILITY-realworld | Язык интерфейса совпадает с языком пользователя | grep | pass | grep: 0 совпадений (ожидалось 0) в 29 файлов |
| USABILITY-control | У пользователя есть выход из потока (отмена / назад) | grep | pass | grep: 15 совпадений (ожидалось > 0) в 33 файлов |
| USABILITY-consistency | Кнопки описаны ролями (--btn-*), а не набором свойств | grep | pass | grep: 46 совпадений (ожидалось > 0) в 34 файлов |
| USABILITY-errorprevent | Необратимые действия требуют подтверждения | grep | pass | grep: 1 совпадений (ожидалось > 0) в 33 файлов |
| USABILITY-recognition | Подсказки на месте: не нужно припоминать | grep | pass | grep: 10 совпадений (ожидалось > 0) в 33 файлов |
| USABILITY-onecta | Одно главное действие на экран | manual | manual | ручная проверка: агент фиксирует наблюдение |
| USABILITY-choices | Не больше 5 вариантов выбора в одном блоке | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| USABILITY-feedback | Действие даёт обратную связь (aria-live / haptic) | grep | pass | grep: 3 совпадений (ожидалось > 0) в 33 файлов |
| USABILITY-focusvisible | Видимая фокус-рамка не отключена | grep | pass | grep: 0 совпадений (ожидалось 0) в 34 файлов |
| USABILITY-states | Состояния элемента различимы (hover / active / disabled) | grep | pass | grep: 7 совпадений (ожидалось > 0) в 34 файлов |
| USABILITY-emptystates | Пустые состояния объясняют и предлагают действие | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| COPY-004 | Кнопка называет действие (глагол + объект) | grep | pass | grep: 1 совпадений (ожидалось > 0) в 29 файлов |
| COPY-005 | В UI нет служебных заглушек (TODO / lorem) | grep | pass | grep: 0 совпадений (ожидалось 0) в 29 файлов |
| COPY-006 | У ошибки есть путь восстановления | grep | pass | grep: 28 совпадений (ожидалось > 0) в 33 файлов |
| COPY-007 | Тон текста не винит пользователя | grep | pass | grep: 0 совпадений (ожидалось 0) в 33 файлов |
| COPY-008 | Один термин на одно понятие | manual | manual | ручная проверка: агент фиксирует наблюдение |
| MARKETING-001 | Заголовок объясняет продукт, а не приветствует | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| MARKETING-002 | Ценность считывается за 5 секунд | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| MARKETING-003 | CTA называет результат, а не шаг навигации | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| MARKETING-004 | Есть социальное доказательство | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| MARKETING-005 | Снято ключевое возражение (цена / время / сложность) | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| MARKETING-006 | Иерархия: один главный визуальный акцент на экран | vision | manual | визуальный аудит: PNG читает агент (npm run audit:screens) |
| TMA-001 | Используются themeParams Telegram (--tg-theme-*) | grep | pass | grep: 12 совпадений (ожидалось > 0) в 34 файлов |
| TMA-002 | Высота приложения по visual viewport | grep | pass | grep: 4 совпадений (ожидалось > 0) в 34 файлов |
| TMA-003 | Учтён MainButton (или осознанно не используется) | grep | pass | grep: 14 совпадений (ожидалось > 0) в 34 файлов |
| TMA-004 | Учтены safe-area inset сверху и снизу | grep | pass | grep: 5 совпадений (ожидалось > 0) в 34 файлов |
| TMA-005 | Мобильный вьюпорт без горизонтальной прокрутки | playwright | pass | проба: rootOverflowX <= 1 во всех комбинациях |

## Fail

Нет fail: машинные критерии чистые.

## Unknown (источник не найден — не «чисто», а «не проверено»)

Нет unknown.

## Manual / vision (проверяет агент)

- STATE-004 — Пустые состояния имеют CTA: визуальный аудит: PNG читает агент (npm run audit:screens)
- USABILITY-onecta — Одно главное действие на экран: ручная проверка: агент фиксирует наблюдение
- USABILITY-choices — Не больше 5 вариантов выбора в одном блоке: визуальный аудит: PNG читает агент (npm run audit:screens)
- USABILITY-emptystates — Пустые состояния объясняют и предлагают действие: визуальный аудит: PNG читает агент (npm run audit:screens)
- COPY-008 — Один термин на одно понятие: ручная проверка: агент фиксирует наблюдение
- MARKETING-001 — Заголовок объясняет продукт, а не приветствует: визуальный аудит: PNG читает агент (npm run audit:screens)
- MARKETING-002 — Ценность считывается за 5 секунд: визуальный аудит: PNG читает агент (npm run audit:screens)
- MARKETING-003 — CTA называет результат, а не шаг навигации: визуальный аудит: PNG читает агент (npm run audit:screens)
- MARKETING-004 — Есть социальное доказательство: визуальный аудит: PNG читает агент (npm run audit:screens)
- MARKETING-005 — Снято ключевое возражение (цена / время / сложность): визуальный аудит: PNG читает агент (npm run audit:screens)
- MARKETING-006 — Иерархия: один главный визуальный акцент на экран: визуальный аудит: PNG читает агент (npm run audit:screens)

Визуальный аудит 19 baseline PNG: `npm run audit:screens` →
`.project/drafts/visual-audit-<дата>.md` (PNG читает агент, у него есть зрение).
