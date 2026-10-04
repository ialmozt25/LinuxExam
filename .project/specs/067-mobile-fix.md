---
id: 067
slug: mobile-fix
type: fix
track: full
status: done
created: 2026-10-04
updated: 2026-10-04
commit: 3109445
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

Капитан подтвердил **на реальном телефоне** два дефекта, которые Playwright с
фиксированным `390×844` не воспроизводит:

1. **Кнопка «Следующий вопрос» не видна на мобильном.** Её sticky-обёртка
   (`Question.tsx:430-440`, `ExamRun.tsx:197-207`) привязана к низу
   скролл-контейнера `#root`. Пока `#root` считался от LAYOUT viewport
   (`height: 100%` от `html`), на живом мобильном его низ оказывался **ниже
   видимой области**: динамическая адресная строка и жест-бар уменьшают VISUAL
   viewport, а layout viewport остаётся прежним. Итого `bottom: 0` контейнера
   лежало вне экрана, а `env(safe-area-inset-bottom)` запас (spec 065) не
   помогает — он вычитается внутри контейнера, который сам уехал.
   **Почему Playwright не видит:** `setViewportSize` меняет layout и visual
   одновременно, поэтому расхождение воспроизводится только на устройстве.
2. **Бейджи «Бесплатно» и «начните с этой» не влезают в строку.** Ряд темы —
   `display: flex` **без** `flexWrap`, поэтому четыре элемента (icon, название с
   описанием, бейдж доступа, счётчик `N вопр.`) плюс подсказка `topic-first-cta`
   конкурировали за одну строку шириной ~326px: бейдж-подсказка не имела ни
   `maxWidth`, ни обрезки и выдавливала название.

Факты PRE-CHECK:

| Что | Где | Состояние |
|---|---|---|
| layout-контейнер | `src/index.css` — `#root` | `height: 100%`, скролл-контейнер приложения |
| `100vh` | `src/App.tsx:39` (`Loading`) | единственный `vh` в layout |
| `viewport-fit=cover` | `index.html:42` | **уже есть** |
| sticky-футер | `Question.tsx:434`, `ExamRun.tsx:204` | `z-index: 10` |
| оверлеи | `exam-confirm` (`Question.tsx:485`), DEV badge | `z-index: 9999` — **выше** футера |
| оверлеи | `DailyGoalPicker` | `z-index: 40` — выше футера |
| Paywall | `Paywall.tsx` | отдельный экран (`currentScreen === 'paywall'`), `position: fixed` нет → с футером не сосуществует |
| бейджи | `Dashboard.tsx` | `--text-xs`, `padding: 2px 6px`; `letterSpacing` то `0.5px`, то `0.3px` у подсказки — нет |

## Цель

Кнопка «Следующий вопрос» видна всегда, независимо от динамической адресной
строки; бейджи тем влезают в строку темы на 390px и не выдавливают название.

- `#root` привязывается к **визуальному** вьюпорту: `--app-height`, который
  выставляет `bindAppHeight()` из `visualViewport.height`, с CSS-каскадом
  фолбэков `100dvh` → `100%`.
- JS-путь применяется **всегда**, не только «если `dvh` не сработал»: Telegram
  WebView на iOS/Android сообщает высоту по-разному и по-разному ведёт себя при
  показе клавиатуры.
- Бейджи сведены к одному каркасу (`TOPIC_BADGE`) с `maxWidth: 100%` +
  `textOverflow: ellipsis`; подсказка «начните с этой» переезжает **под название
  темы**, а не в общий ряд с чипом вопросов; правая колонка получает
  `maxWidth: 45%`.
- Sticky-обёртки **не переписываются**: `position: sticky` + прежний
  `padding-bottom` (spec 065) сохраняются, `z-index` футера **не трогается** —
  оверлеи и без этого выше.
- `data-testid` не меняются.

**НЕ входит:** логика, domain, store, банк, `persist`, порядок CTA (spec 065/066).

## Что делаем

### К1. FIX A — высота приложения

**A1 `src/presentation/theme/tokens.css`** — добавлен хук `--app-height: 100dvh`
(со ссылкой на `bindAppHeight()`).

**A1 `src/index.css`** — `#root` получает каскад
`height: 100vh; height: 100dvh; height: var(--app-height, 100dvh);`
(`html, body` остаются `height: 100%`; `body`-правило сохранено).

**A2 `index.html`** — `viewport-fit=cover` **уже присутствует**, правка не нужна.

**A3 `src/main.tsx`** — `bindAppHeight()`: пишет `--app-height` из
`visualViewport.height`, слушает `visualViewport.resize` + `visualViewport.scroll`
(показ/скрытие адресной строки на Android) + `orientationchange`; без
`visualViewport` — фолбэк на `window.innerHeight` + `resize`. Невалидная высота
(`0`/`NaN`/отрицательная) игнорируется, работает CSS-фолбэк.

**A1 `src/App.tsx`** — `Loading` переведён с `minHeight: '100vh'` на
`var(--app-height, 100dvh)`.

**A4 — sticky НЕ менялся.** `position: fixed` **не применён**: он потребовал бы
резервировать высоту футера в скролл-контейнере, а sticky при корректной высоте
контейнера (K1) решает задачу меньшей правкой. `z-index` футера остаётся 10;
все оверлеи (`9999`, `40`) выше — правок не требуют.

### К2. FIX B — бейджи

`Dashboard.tsx`:

- `TOPIC_BADGE` — единый каркас (`--text-xs`, `padding: 2px 6px`,
  `borderRadius: var(--radius-sm)`, `maxWidth: 100%`, `overflow: hidden`,
  `textOverflow: ellipsis`, `flexShrink: 0`, `letterSpacing: 0.3px`);
  `FIRST_TOPIC_BADGE` = он же + `color: var(--success)`. До этого четыре копии
  стилей расходились по `letterSpacing`.
- Ряд названия: `display: flex; flexWrap: wrap; gap: 4px 6px; minWidth: 0` —
  название обрезается ellipsis, подсказка переносится на свою строку.
- Правая колонка (`Бесплатно`/`PRO`/`Скоро` + `N вопр.`): `flexDirection:
  column; alignItems: flex-end; maxWidth: 45%; flexShrink: 0`.
- Тап-зона бейджа ≥ 32px обеспечивается `padding` 2px по вертикали + строкой
  `--text-xs` внутри строки темы высотой ≥ 44px (проверяется e2e замером).

### К3. Тесты

- `390×844`: после ответа `next-button` в вьюпорте (`ratio: 1`); карточка темы
  не переполняется по горизонтали (`scrollWidth ≤ clientWidth`) для корневого
  контейнера, каждой строки темы и бейджей; тап-зона бейджа ≥ 32px.
- `1440×900`: `next-button` внизу, layout не сломан, ничего не перекрыто.
- Сид — существующие фикстуры.

**Playwright НЕ воспроизводит dvh-баг** — e2e здесь защита от регрессии, а не
доказательство FIX A. FIX A остаётся **UNVERIFIED** до ручной проверки капитаном
на устройстве; зелёный e2e это не маскирует.

### К4. Гейты и коммиты

`typecheck` · `test:run` · `test:e2e` · `build` → 0;
`fix(spec-067): mobile next-button (dvh) + badge sizing` →
`chore(state): converge after spec-067` → `chore(state): converge after spec-067 done`
→ `sync:check = 0`.

## Критерии приёмки

- [ ] `#root` имеет каскад `100vh` → `100dvh` → `var(--app-height, 100dvh)`.
- [ ] `main.tsx` вызывает `bindAppHeight()`, который пишет `--app-height` из
      `visualViewport.height` и подписан на `resize`/`scroll`/`orientationchange`.
- [ ] `--app-height` объявлен в `tokens.css` с фолбэком `100dvh`.
- [ ] `Loading` (`App.tsx`) больше не использует `100vh`.
- [ ] `viewport-fit=cover` присутствует в `index.html`.
- [ ] Sticky-обёртки `Question.tsx`/`ExamRun.tsx` сохранили `position: sticky`,
      `bottom: 0`, `zIndex: 10` и `padding-bottom` из spec 065.
- [ ] `z-index` оверлеев (`exam-confirm` 9999, `DailyGoalPicker` 40) выше
      `z-index` футера (10); `z-index` футера не менялся.
- [ ] Все четыре бейджа тем используют единый каркас; у подсказки есть
      `maxWidth: 100%`, `overflow: hidden`, `textOverflow: ellipsis`.
- [ ] Подсказка `topic-first-cta` рендерится под названием темы (в колонке
      названия), а не в общем ряду с чипом вопросов.
- [ ] `390×844`: `document.documentElement.scrollWidth ≤ clientWidth` и
      `#root.scrollWidth ≤ #root.clientWidth`; для каждого бейджа темы
      `scrollWidth ≤ clientWidth`.
- [ ] `390×844`: после ответа `next-button` `toBeInViewport({ ratio: 1 })`.
- [ ] `1440×900`: `next-button` внизу, layout не сломан, контент не перекрыт.
- [ ] `data-testid` не изменены: `next-button`, `exam-submit`, `topic-first-cta`,
      `paywall-badge-free`, `paywall-badge-pro`, `start-learning`,
      `review-today`, `dashboard-topics`.
- [ ] Гейты `typecheck`, `test:run`, `test:e2e`, `build` — exit 0.
- [ ] `sync:check` — exit 0; frontmatter `status: done` + `commit <feat-SHA>`;
      запись в `.project/log.md`.
- [ ] EOL правленых файлов: `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] Push **не выполняется** — ожидает отдельной авторизации капитана.
- [ ] **FIX A помечен UNVERIFIED** до ручной проверки на устройстве; зелёный e2e
      не подан как доказательство dvh-фикса.

## Проверка (сигналы критериев)

```powershell
# базовая линия до правок (HEAD c94bacd)
npm run test:run           # 439 passed
npm run test:e2e           # 96 passed

# после правок
npm run typecheck          # exit 0
npm run test:run           # 0 fail
npm run test:e2e           # 0 fail
npm run build              # exit 0
npm run sync:check         # exit 0
git ls-files --eol src/index.css src/main.tsx src/App.tsx src/presentation/theme/tokens.css src/presentation/screens/Dashboard.tsx
```

Функциональные сигналы:

- в браузере на `--app-height` подписаны `resize`/`scroll` `visualViewport`;
- `getComputedStyle(document.getElementById('root')).height` равен высоте
  визуального вьюпорта, а не layout;
- на 390px ни один бейдж темы не имеет `scrollWidth > clientWidth`.

**Ручная проверка (обязательна, не заменяется e2e):** открыть приложение на
реальном мобильном (и в Telegram WebView, и в браузере), убедиться, что кнопка
«Следующий вопрос» видна без прокрутки при длинном объяснении и что бейджи
влезают в строку. Результат — в отчёт капитану.

## Что НЕ трогать

- `src/data/**` (банк 253), `tools/**`, `.project/sync.mjs`,
  `.project/ORCH-RULES.md`, `package.json`, `backend/**`, `src/domain/**`,
  `src/store/**`;
- `data-testid` (перечень в критериях);
- `Question.tsx` / `ExamRun.tsx` — sticky-обёртки целиком не переписываются;
- `persist.version`, `partialize`;
- `z-index` футера (10) и порядок CTA (spec 065/066).

## Превью

Скриншоты mobile после фикса — `.project/drafts/ux-audit-2026-10-04/mobile-fix/`
(390×844): Dashboard со влезающими бейджами и Question с видимой нижней кнопкой.
Playwright-скриншоты показывают результат раскладки, но **не** доказывают фикс на
устройстве: расхождение layout/visual viewport ими не воспроизводится.

## Открытые вопросы

- **FIX A не подтверждён на устройстве** (см. «Ручная проверка»). Если после
  проверки кнопка всё ещё уезжает, следующий шаг — `position: fixed` с
  резервированием высоты футера в скролл-контейнере (A4 из задания), отдельной
  правкой: текущий объём правок это сознательно не включает.
- Telegram оставляет непрозрачное поведение `visualViewport` при открытой
  клавиатуре: значение может кратковременно «прыгать». Фолбэк-каскад `100dvh`
  покрывает момент до первой записи переменной.
