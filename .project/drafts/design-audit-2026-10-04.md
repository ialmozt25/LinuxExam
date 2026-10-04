# Design-audit — 2026-10-04 (spec 074)

Аудит UI/a11y по результатам внедрённой автоматической проверки. **Только
детекция:** ни одна UI-проблема в этой спеке не исправлялась (это прямо
исключено заданием).

## Источники данных

| Источник | Что даёт |
|---|---|
| `.project/drafts/a11y-report.json`, `.project/drafts/a11y-baseline.json` | axe-core (`@axe-core/playwright` 4.13.0), теги `wcag2a`,`wcag2aa`,`wcag21aa`, 19 состояний экранов (8 экранов × 2 viewport'а + 3 онбординг × mobile) |
| `.project/drafts/layout-probe-2026-10-04.json` | геометрия DOM по тем же 19 состояниям: `scrollHeight/clientHeight` контейнера `#root`, горизонтальный overflow узлов, позиции ключевых CTA относительно вьюпорта, размеры тач-целей, вычисленные размеры/цвета текста. Артефакт снят временной пробой (`e2e/layout-probe.tmp.spec.ts`, в репозиторий не коммитится — `*.tmp.spec.ts` исключены); сами числа проверяемы по PNG-baseline'ам |
| `e2e/visual-regression.spec.ts-snapshots/*.png` | 19 baseline PNG (390×844 и 1440×900), эталон для визуальной регрессии |
| аудит консистентности по коду (read-only, отдельный агент) | сопоставление одной визуальной роли на разных экранах, `file:line` |

**Ограничение метода.** Пиксельный анализ скриншотов в этой сессии недоступен
(нет vision-адаптера), поэтому «Layout» построен на геометрии DOM (реальные
`getBoundingClientRect`/`scrollWidth` в браузере), а не на разглядывании картинок.
Для класса дефектов «элемент вне вьюпорта / текст шире контейнера» это более
жёсткое измерение, чем глаз; для «некрасиво» — менее чувствительное.

Итог axe: **15 нарушений, все `color-contrast`, все `serious`**; `critical` — 0,
`moderate`/`minor` — 0. Пустые по нарушениям экраны: `question-*`, `results-*`
(4 состояния из 19).

---

## 1. Читаемость (axe-core, по корневым причинам)

### R1. Акцентная кнопка: белый текст на `--accent` даёт **3.12:1** (норма AA — 4.5:1)

| Что | Где |
|---|---|
| Примитив цвета | `src/presentation/theme/tokens.css:6` (`--color-blue-500: #2196F3`) |
| Контракт текста кнопки | `src/presentation/theme/tokens.css:88-89` (`--btn-primary-bg: var(--accent)`, `--btn-primary-text: var(--color-white)`), объяснение — `:83-86` |
| `exam-start` | `src/presentation/screens/ExamSetup.tsx:120` |
| `exam-submit` | `src/presentation/screens/ExamRun.tsx:224` |
| `back-to-dashboard` | `src/presentation/screens/ExamResults.tsx:152` |
| `onboarding-start` | `src/presentation/screens/OnboardingResult.tsx:88` |
| `paywall-start-trial` | `src/presentation/screens/Paywall.tsx:267` |

Замер axe: `#ffffff` на `#2196f3` = **3.12**, 16px normal → нужно 4.5. Проходит
только как «large text» (≥24px или ≥18.66px bold), а кнопки свёрстаны 16px.
**Severity: High** — системно, на всех акцентных кнопках приложения (действие
доступно, но текст формально ниже нормы AA).

### R2. Счётчик вопросов темы акцентом на белом = **3.12:1**, 25 узлов, 12px

- цвет: `src/presentation/screens/Dashboard.tsx:619` (`color: isAvailable ? 'var(--accent)' : …`);
- 5 узлов на mobile-дашборде, тот же дефект на desktop (`19 вопр.`, `18 вопр.`, `17 вопр.` …).
  **Severity: High** — это самый массовый контрастный дефект (счётчик в каждой строке темы).

### R3. Бейдж «Бесплатно» (`paywall-badge-free`) = **2.59:1** — худший показатель в отчёте

- подпись: `src/presentation/screens/Dashboard.tsx:596`; цвет: `Dashboard.tsx:686`
  (`isFree ? 'var(--text-secondary)' : 'var(--accent')`);
- замер: `#2196f3` на `#eaeaea` = **2.59**, 12px.
  **Severity: High** — бейдж несёт смысл «доступно бесплатно», но читается хуже всего.

### R4. Бейдж «начните с этой» = **4.14:1** (чуть ниже AA)

- `src/presentation/screens/Dashboard.tsx:113-116` (`FIRST_TOPIC_BADGE`, `color: var(--success)`), рендер — `:651`;
- замер: `#377e3a` на `#eaeaea` = **4.14**, 12px → нужно 4.5.
  **Severity: Medium** (пограничное значение, не «не видно»).

### R5. «30 вопр.» на кнопке «Повторить ошибки» = **3.96:1**

- `src/presentation/screens/Dashboard.tsx:539` (`color: 'var(--danger)'`) внутри кнопки `:515`;
- замер: `#cf392e` на `#f5e3e2` = **3.96**, 12px.
  **Severity: Medium**.

### R6. DEV-бейдж «Web mode» = **2.52:1** — **не продуктовая проблема**

- `src/App.tsx:119-122` (inline-стиль), `src/App.tsx:131` (`TG: …` / `Web mode`);
- 10px `#666666` на `rgba(0,0,0,0.3)`. Рендерится **только в DEV-сборке**, в проде
  его нет. Попал в baseline как 1 узел на 15 экранах (все, кроме `question-*` и
  `results-*`, где он перекрыт другими слоями).
  **Severity: Low (dev-only).** Рекомендация на будущее: исключать его из
  axe-скопа (`AxeBuilder.exclude('#root > div…')`) либо оставить как известный —
  он стабилен и не маскирует продакшн-нарушения.

---

## 2. Консистентность (одна роль — разное оформление)

| # | Роль | Расхождение | file:line |
|---|---|---|---|
| K1 | Текст на акцентной кнопке | `var(--text-primary)` вместо `var(--btn-primary-text)`: в светлой теме главный CTA получает тёмный текст, соседняя кнопка на том же экране — белый | нарушители: `Question.tsx:440`, `Dashboard.tsx:55` (константа `PRIMARY_CTA` → `Dashboard.tsx:48`), `Dashboard.tsx:809`, `OnboardingDemo.tsx:137`; канон: `Question.tsx:185-186`, `Dashboard.tsx:778`, `Paywall.tsx:273`, `Results.tsx:180` |
| K2 | Фон карточки | `var(--bg-secondary)` **не объявлена нигде** → обе карточки Analytics без фона, рядом карточка пустого состояния с `var(--bg-surface)` | `Analytics.tsx:45` (использование), `Analytics.tsx:131` (канон), `Results.tsx:134`, `Paywall.tsx:131` |
| K3 | Радиус карточки | 8px против 12px; в основе — конфликт двух источников токенов | `theme/layout.ts:6` (`LAYOUT.cardRadius = 8px`) против `theme/tokens.css:96` (`--card-radius = var(--radius-md)` = 12px); вплотную: `Question.tsx:318` (12px) / `Question.tsx:371` (8px), `Analytics.tsx:44` (12px) / `StreakBadge.tsx:66` (8px) |
| K4 | Радиус primary-кнопки | 12px против 8px; в одном блоке Results соседние кнопки разного радиуса | `layout.ts:9` (`LAYOUT.buttonRadius = 8px`) против `tokens.css:90` (`--btn-primary-radius = var(--radius-md)` = 12px); `Results.tsx:371` (12px) рядом с `Results.tsx:392` (8px), `Question.tsx:187` против `Question.tsx:442` |
| K5 | Прогресс-бар | три геометрии одной роли: 3px/2px, 4px/2px, 8px/4px | `Question.tsx:228-230`, `Dashboard.tsx:257-259` и `:380-383`, `XpBar.tsx:43-45` (`LAYOUT.progressBarHeight`) |
| K6 | Подписи uppercase | `letterSpacing` 0.3px против 0.5px и `var(--letter-wide)` с **несуществующей** переменной | `Dashboard.tsx:104` (0.3px, `TOPIC_BADGE`) против `Dashboard.tsx:567,688,711` (`var(--letter-wide, 0.5px)`), `Question.tsx:382`, `Results.tsx:295` |
| K7 | Заголовок секции «По темам» | `<h2>` 14px против `<div>` 12px — один смысл, два размера и два тега | `Results.tsx:290-299` против `ExamResults.tsx:107-118` |
| K8 | Тинты «выбрано»/«статус» | захардкоженный `rgba(33,150,243,…)` (три разных alpha) вместо `--accent`; заливки статусов из **тёмной** палитры при темозависимой рамке | `ExamRun.tsx:170`, `ExamSetup.tsx:99`, `OnboardingDemo.tsx:111`, `Question.tsx:240`; `Question.tsx:286` / `:290` против `:287` / `:291`; `Dashboard.tsx:521` против `:522` |
| K9 | Маркер варианта ответа | `rgba(255,255,255,0.1)` — под тёмную тему; в светлой (`--bg-elevated` `#EAEAEA`) круг практически невидим | `Question.tsx:341`, `ExamRun.tsx:186` |
| K10 | Размеры вне шкалы | `fontSize: 13px` вне шкалы `{12,14,16,19,24,32}`; хардкод токенов вместо переменных | `Dashboard.tsx:239`, `Paywall.tsx:160,165,183,188,210,255`; `DailyGoalPicker.tsx:53,63,96,97` (= `--heading-2/--text-sm/--body/--text-xs`) |
| K11 | Тач-цель 44px | токен `--touch-min: 44px` объявлен и **не используется**, значение захардкожено в 7 файлах | `tokens.css:57`; `AppHeader.tsx:11`, `Dashboard.tsx:283-284`, `ExamSetup.tsx:41-42`, `ExamResults.tsx:41-42`, `Analytics.tsx:95-96`, `OnboardingGoal.tsx:70`, `OnboardingDemo.tsx:109` |

**Не найдено (проверялось целенаправленно):** Tailwind-палитра (`text-emerald-500`,
`bg-red-500` …) — 0 совпадений в `src`; произвольные Tailwind-значения
(`text-[15px]`, `p-[18px]`) — 0; `dark:` — 0 (тема целиком на
`data-theme`/`data-theme-source`, `index.html:8-39`, `tokens.css:120-194`);
инлайн-стилей в `index.html` нет; `hsl()/hsla()` — 0.

---

## 3. Layout (геометрия DOM, 19 состояний)

### L1. `results-*`: обе кнопки экрана итогов ниже сгиба на ~900px

- `results-retry` — `top = 1741`, `bottom = 1797`; `results-back` — `top = 1805`,
  `bottom = 1861` при вьюпорте **844px** (mobile) и **900px** (desktop);
- прокрутка контейнера: `rootOverflowY = 1017` (mobile) / `961` (desktop) —
  `#root` это скролл-контейнер (`html`/`body` `overflow: hidden`);
- код: `src/presentation/screens/Results.tsx:363` (`results-retry`), `:384` (`results-back`).
  **Severity: High** — «пройти заново» и «к темам» не видны без прокрутки почти
  на два экрана; ровно класс дефектов 070/071.

### L2. `paywall-mobile`: кнопка покупки обрезана сгибом

- `paywall-buy` — `top = 807.8`, `bottom = 865.8` при 844px → нижние **22px за
  вьюпортом**; `paywall-later` (`top = 873.8`) — целиком за сгибом;
- `rootOverflowY = 83`; код: `Paywall.tsx:288` (`paywall-buy`), `Paywall.tsx:311` (`paywall-later`).
  **Severity: High** — главное действие пейволла визуально «обрезано» на мобильном.

### L3. `dashboard-*`: CTA `dashboard-continue` на y≈1929–1985

- mobile: `top = 1929`, `bottom = 1985`; desktop: `top = 1904`; `rootOverflowY = 1276`
  (mobile) / `1123` (desktop); код: `Dashboard.tsx:800`;
- на засеянном профиле пользователю видна кнопка «Повторить сегодня», поэтому
  критичности нет, но **основной вход «Продолжить» стоит ниже 14 строк тем** —
  вне TMA его приходится искать прокруткой (в TMA роль CTA играет MainButton,
  см. spec 072). **Severity: Medium.**

### L4. `question-*`: текст варианта ответа шире контейнера

- mobile: `overflowX = 4px` (текст `AВладелец: только выполнение, группа:
  чтение/запись` при `right = 374`); desktop: `overflowX = 14px`;
- `rootOverflowY = 94` (mobile) — экран вопроса прокручивается на 94px;
- код варианта: `Question.tsx:310` (`option-<n>`), текст — `Question.tsx:325`.
  **Severity: Medium** (перенос/обрезка длинной формулировки).

### L5. `exam-run-*`: тач-цель «Прервать и выйти» = 34px < 44px

- высота кнопки `exam-cancel` — **34px** (mobile и desktop);
- код: `ExamRun.tsx:247`; токен `--touch-min: 44px` (`tokens.css:57`) не применён.
  **Severity: Medium** (a11y-правило 2.5.5/2.5.8 в axe-теги `wcag21aa` не входит,
  поэтому нарушением выше не помечено — нашёл DOM-замер).

### L6. `dashboard-mobile`: подзаголовки тем выходят за строку

- два `<div>` без testid: `chmod, chown, ACL, umask, special bits` —
  `overflowX = 8px`; `sed, awk, cut, sort, uniq, tr, wc, head/tail` — `overflowX = 10px`
  (правый край 260.6 при ширине вьюпорта 390). **Severity: Low** (мелкая обрезка).

### Хорошее

- `bodyOverflowX = 0` во всех 19 состояниях — горизонтального скролла страницы нет;
- у 13 из 19 состояний `rootOverflowY = 0` (экран целиком влезает);
- на `question-*` и `results-*` axe не нашёл ни одного нарушения.

---

## 4. Приоритеты

**Critical (действие невозможно):** не найдено. Ни один замер не показал
недоступного действия: все CTA присутствуют, `disabled` только там, где это
контракт (варианты после ответа, «Далее» до ответа в онбординге).

**High (визуальная нечитаемость / действие спрятано):**
1. R1 контраст акцентных кнопок 3.12:1 — 5 экранов;
2. R2 контраст счётчика тем 3.12:1 — 25 узлов;
3. R3 бейдж «Бесплатно» 2.59:1;
4. L1 `results-retry`/`results-back` ниже сгиба на ~900px;
5. L2 `paywall-buy` обрезан сгибом на мобильном;
6. K2 карточки Analytics без фона (`--bg-secondary` не существует).

**Medium (несоответствие токенам/системе):**
K1 (текст на CTA), K3/K4 (радиусы 8 vs 12), K5 (прогресс-бары), K9 (маркер под
тёмную тему), R4 (4.14:1), R5 (3.96:1), L3, L4, L5.

**Low (косметика / dev-only):**
K6, K7, K8 (в светлой теме), K10, K11, L6, R6 (DEV-бейдж).

---

## 5. Top-5 — капитану

1. **Контраст акцентных кнопок 3.12:1 (нужно 4.5:1).**
   `src/presentation/theme/tokens.css:6` (`--color-blue-500: #2196F3`) +
   `:88-89` (`--btn-primary-bg`/`--btn-primary-text`); затронуты
   `ExamSetup.tsx:120`, `ExamRun.tsx:224`, `ExamResults.tsx:152`,
   `OnboardingResult.tsx:88`, `Paywall.tsx:267`. **High.** Лечится одним
   изменением примитива (например `#1976D2` → 4.6:1), но это правка UI —
   вне границ spec 074.

2. **`var(--bg-secondary)` не существует → карточки Analytics без фона.**
   `src/presentation/screens/Analytics.tsx:45` (используется на `:268` и `:302`),
   канон — `Analytics.tsx:131` (`var(--bg-surface)`), `Results.tsx:134`.
   **High.** Пользователь видит текст на фоне страницы вместо карточек.

3. **Экран итогов: обе кнопки ниже сгиба.**
   `src/presentation/screens/Results.tsx:363` (`results-retry`, `top = 1741`) и
   `:384` (`results-back`, `top = 1805`) при вьюпорте 844/900px;
   `rootOverflowY = 1017/961`. **High.** Тот же класс, что 070/071: действие
   есть в DOM, но не видно.

4. **Мобильный пейволл: `paywall-buy` обрезан на 22px.**
   `src/presentation/screens/Paywall.tsx:288` (`top = 807.8`, `bottom = 865.8`);
   `paywall-later` (`:311`) целиком за сгибом. **High.** Главное действие
   пейволла выглядит «недорисованным» на 390×844.

5. **Бейдж «Бесплатно» — 2.59:1, худший контраст в приложении.**
   `src/presentation/screens/Dashboard.tsx:596` (подпись) + `:686` (цвет
   `var(--accent)` на `--bg-elevated`); плюс смысловая путаница: у Pro/trial та
   же подпись рисуется акцентом, а «PRO» остаётся только у не-Pro.
   **High.**

**Отдельно (не продукт):** DEV-бейдж `Web mode` — `src/App.tsx:119-122,131`,
2.52:1, только DEV-сборка (Low, в baseline как известный).

---

## Что дальше (вне этой спеки)

Фиксы UI — отдельные спеки (`type: ui`): каждая правка цвета/радиуса меняет
baseline, поэтому порядок такой: фикс → `--update-snapshots` (только для
затронутых снимков) → прогон 2 на стабильность → baseline в том же коммите.
Для контраста предпочтителен один системный фикс примитива в `tokens.css`, а не
точечные правки по экранам.
