# E2E Фаза 2+3 — покрытие приложения (spec 051)

Дата: 2026-10-03 · База: `2960a05` (после push spec-051) · Автор: оркестратор (капитанская сессия)
Скоуп STOP-1: `app-map.md` approved, G2 → 3 темы, G10 оставить, `data-testid` — только атрибуты.

## 1. Итог прогонов

| Прогон | Команда | Результат | EXIT | Длительность |
|---|---|---|---|---|
| run9 | `npm run test:e2e` (2 воркера) | **58 passed, 0 failed** | 0 | 1.3 мин |
| run10 | `npm run test:e2e` (2 воркера) | **58 passed, 0 failed** | 0 | 1.3 мин |
| run11 | `npm run test:e2e` (2 воркера) | 55 passed, 3 failed (таймауты навигации) | 1 | 1.9 мин |
| run12 | `npx playwright test --workers=1` | 55 passed, 3 failed (те же) | 1 | 3.2 мин |
| run13 | `npx playwright test --workers=1` | **58 passed, 0 failed** | 0 | 1.7 мин |

Итоговое состояние: 3 полных зелёных прогона из 5, последний — зелёный.
Все 5 прогонов длились ≤ 3.2 мин (лимит задания 15 мин соблюдён, `test.skip`/`--grep` не применялись).

### 1.1. Плавающие падения run11/run12 (среда, не логика тестов)

Упали ровно 3 теста, все — `page.goto: Test timeout of 30000ms exceeded / waiting until "load"`:

- `color-regression.spec.ts:11` — оба варианта (light/dark) — **неизменяемый файл**;
- `persist.spec.ts:214` — «a finished exam leaves no resumable exam in storage» (единственный мой тест,
  который навигировал **без** `blockAnalytics`, потому что `gotoApp()` ждёт дашборд, а тут boot
  идёт прямо на экран результатов экзамена).

Диагностика (временный `e2e/diag-beacon.spec.ts`, удалён):

| Сценарий | `page.goto` | Дашборд отрисован |
|---|---|---|
| без блокировки бикона | 2021 мс | да (после загрузки ленивого чанка) |
| с блокировкой `gc.zgo.at` | 320 мс | да |

Причина: `index.html:59` тянет сторонний счётчик GoatCounter; когда запрос к CDN «залипает»,
событие `load` (и следующая за ним загрузка ленивого чанка `Dashboard`) не наступает, и `page.goto`
упирается в 30-секундный таймаут теста. Это уже зафиксировано в `quiz-flow.spec.ts` (там есть
`test.beforeEach: page.route(/gc\.zgo\.at/, route => route.abort())` — все 16 его тестов зелёные
во всех прогонах).

**Исправлено у меня:** `persist.spec.ts:214` теперь вызывает `blockAnalytics(page)` до `page.goto`
(6/6 в этом файле, отдельный прогон — зелёный).

**Остаётся и требует твоего решения:** `color-regression.spec.ts` не блокирует бикон, и задание
прямо запрещает его править. Фикс — одна строка `test.beforeEach` с `page.route`, но менять файл
может только капитан. Пока это принято как известный environmental-флейк (не регресс:
`src/**` правок логики не содержит, таймаут навигационный и воспроизводится только у тестов
без блокировки бикона).

## 2. Скрипты и файлы

```
e2e/fixtures.ts          общие фикстуры (live-bank, сиды, хелперы) + TESTID-контракт
e2e/dashboard.spec.ts    7 тестов
e2e/question-flow.spec.ts 10 тестов
e2e/results.spec.ts      7 тестов
e2e/paywall.spec.ts      5 тестов
e2e/persist.spec.ts      6 тестов
e2e/browser-mode.spec.ts 5 тестов
tsconfig.e2e.json        отдельный typecheck для e2e (не входит в tsconfig.app.json)
```

Существующие спеки не тронуты: `quiz-flow.spec.ts` (16), `color-regression.spec.ts` (2).
Всего в наборе: **58 тестов в 8 файлах** (`npx playwright test --list`).

Проверки типов: `npm run typecheck` (приложение) exit 0, `npx tsc --noEmit -p tsconfig.e2e.json` exit 0.

## 3. `data-testid` (Фаза 2.1)

47 вхождений атрибутов в 6 файлах, `git diff --stat -- src/`: 61 insertion(+), 11 deletion(-) —
удаления это только переносы однострочных JSX-элементов на многострочные под новый атрибут.

| Файл | Что добавлено |
|---|---|
| `presentation/screens/Dashboard.tsx` | `dashboard-subtitle`, `dashboard-progress`, `theme-toggle`, `review-wrong`, `topic-<key>`, `exam-banner`, `exam-timer`, `exam-continue`, `resume-banner`, `resume-position`, `resume-button`, `start-exam`, `dashboard-continue` |
| `presentation/components/AppHeader.tsx` | `header-back`, `app-header-center`, `header-home` |
| `presentation/screens/Question.tsx` | `question-progress`, `question-text`, `option-0..3`, `explanation-verdict`, `explanation`, `next-button`, `question-empty`, `exam-confirm`, `exam-stay`, `exam-leave` |
| `presentation/screens/Paywall.tsx` | `paywall` (на корневом контейнере), `paywall-buy`, `paywall-later` |
| `presentation/screens/Results.tsx` | `results-screen`, `results-empty`, `results-score`, `results-accuracy`, `results-review-wrong`, `results-topics`, `results-topic-<key>`, `results-retry`, `results-back`, `results-share`, `exam-summary`, `exam-score`, `exam-accuracy`, `exam-time`, `exam-restart`, `exam-exit` |
| `presentation/components/ScreenContainer.tsx` | прокидка `data-testid` на корневой div (один типизированный проп) |

Логика/разметка/тексты не менялись; в `src/**` — только атрибуты.

## 4. Что покрыто (по группам `app-map.md` §6)

- **G1 Дашборд (3):** заголовок и подзаголовок, «14 из 14 тем», 14 кнопок тем с
  `aria-label` и живыми счётчиками `{n} вопр.` из `_topics.json` (сумма = 253),
  чистый профиль → «0 из 253», кнопка экзамена, дисклеймер `[data-disclaimer="legal"]`.
- **G2 Темы, 3 темы (4):** `file_permissions`, `users_groups`, `deploy_systems` — старт с `1 / {size}`;
  повторный старт другой темы сбрасывает позицию на `1 / {size другой темы}`.
- **G3 Фидбэк и навигация (в `question-flow`):** «Верно»/«Неверно» + текст объяснения из банка,
  все 4 опции `disabled` после ответа, подсветка (border ≠ surface + 1 опция с opacity 1 против 3×0.55),
  переход на 2-й вопрос и «Назад», отсутствие «Назад» на первом вопросе,
  лейбл «Следующий вопрос» → «Завершить» на последнем, завершение → «Тема: Права доступа» + `results-screen`.
- **G4 Отображение вопроса (2):** 4 живые опции банка (текст каждой встречается ровно один раз),
  порядок опций стабилен между перезагрузками (детерминированный shuffle по id).
- **G5 Free-gate / paywall (5, `paywall.spec.ts`):** пейволл после 5-го вопроса;
  «Позже» → дашборд, `isPro: false`, лимит держится (повторный шаг снова даёт пейволл);
  покупка стаба → `isPro: true` и 6-й вопрос доступен; тема не пейволится за лимитом;
  экзамен идёт за лимит без пейволла и без фидбэка. INTENDED-поведение (§7 app-map) не пиннится.
- **G6 Повторение ошибок (3):** неверный ответ в regular-стриме пишется с `optionText`
  (identity по тексту опции) и пополняет `wrongQuestionIds`; «Повторить ошибки» показывается с живым счётчиком.
- **G7 Экзамен (2):** идущий экзамен переживает reload (баннер + таймер `MM:SS`, «Продолжить» → `1 / 5 · MM:SS`);
  экзамен без фидбэка/подсветки в потоке вопросов.
- **G8 Persist (6):** позиция/ответы восстанавливаются (баннер «Вопрос 5 из 253», resume на том же вопросе,
  +1 ответ поверх восстановленного); review-стрим изолирован от regular; `partialize` пишет ровно 16 ключей
  и не пишет `activeTopic/currentScreen/examLastResult/isLoading/isPaywallVisible/questions`;
  streak=1 и +10 XP за первый ответ дня переживают reload; `finishExam()` закрывает гейт
  (`examActive=false`, `examStartedAt=null`, `isQuizInProgress=false`), оставляя `examQuestionIds/examAnswers`;
  `examLastResult` в хранилище отсутствует.
- **G9 Результаты (7):** review-результаты темы («Тема: Права доступа», счёт `size/size`, 100 %, нет «Пройти заново»);
  разбивка «По темам» против активного стрима (`{n}/{size}` у темы, `0/{size}` у остальных);
  «К темам» → дашборд; неверный последний ответ даёт `(size-1)/size` и не показывает пустое состояние.
- **G10 Режим браузера (5) + часть streak:** DEV-бейдж «Web mode»; in-app «Следующий вопрос»/header-контролы
  вместо MainButton/BackButton; переключатель темы как браузерный контрол (`data-theme-source="manual"`);
  отсутствие Telegram-only «Поделиться результатом»; отсутствие `pageerror` при работе без Telegram SDK.

## 5. Падавшие тесты и фиксы (Фаза 3.3)

Все падения первых итераций — **тесты, а не приложение** (`src/**` правился только атрибутами).
Реальных багов приложения не обнаружено, STOP по этой причине не потребовался.

| # | Симптом | Причина | Фикс |
|---|---|---|---|
| 1 | `option "…" of fp_001 is not rendered` (17 тестов) | Хелпер искал `Ответ {A..D}` по **исходному** индексу опции, а приложение нумерует A..D **после** детерминированного shuffle | Матчинг по тексту опции (`endsWith(': ' + text)`), буква больше не предполагается |
| 2 | `getByTestId('dashboard-progress')` не найден | Ушёл `id="dashboard-progress"`, а не `data-testid` | Добавлен `data-testid` рядом с `id` |
| 3 | Сид из `localStorage` не применялся (7 тестов) | `addInitScript`-функция пере-парсится в странице: замыкание на модульную константу `PERSIST_KEY` давало ReferenceError, и сид молча не писался | Ключ/полезная нагрузка передаются аргументами |
| 4 | `resume-button` не найден (30 с клик-таймаут) | Баннер ниже 14 строк тем: `y≈1388` при вьюпорте 720, вне вьюпорта | `scrollIntoViewIfNeeded()` перед кликом (реальное поведение приложения) |
| 5 | `resume-banner` «не виден» при валидном DOM | `toBeVisible()` требует попадания в вьюпорт | `toBeAttached()` + явный скролл |
| 6 | Тема пишет «1 / 19» вместо «1 / 2» | `startTopicQuiz` всегда создаёт прогон по **всей** теме и сбрасывает индекс на 0 | Тест ведёт полный живой прогон темы, размер берётся из `_topics.json` |
| 7 | Дашборд показывал «0 из 253» после ответа в теме | Ответы темы идут в **review**-стрим; счётчик дашборда считает `answers` (regular) | Ожидание исправлено на «0 из 253»; инвариант «тема не двигает regular-счётчик» зафиксирован отдельным тестом |
| 8 | Вопрос на открытой позиции не совпадал | Порядок regular-потока — `_order.json` (интерливинг), а не файл темы | `regularQuestionAt(i)` / `regularQuestions(n)` из `_order.json` |
| 9 | `examQuestionIds` не пуст после финиша экзамена | `finishExam()` намеренно их **не** чистит (чистит `cancelExam`), `examLastResult` — сессионный | Тест приведён к фактическому контракту + `expect.poll` вместо гонки с записью persist |
| 10 | `page.goto` 30 с (3 теста, run11/12) | Сторонний бикон GoatCounter задерживает `load`/ленивый чанк | `blockAnalytics` в моём тесте; `color-regression.spec.ts` — вне скоупа правок, см. §1.1 |

Флаки-процедура: запрещённых приёмов (`test.skip`, `--grep`, таймаут-инфляция, правки `src/**` ради
зелёного) не применялось; таймауты только локальные (`toBeVisible({timeout})`), глобальный конфиг не менялся.

## 6. Честные пробелы (что НЕ покрыто)

1. **11 тем из 14** в E2E не проверяются (STOP-1: G2 → 3 темы; остальные 11 закрыты косвенно —
   счётчиками дашборда и разбивкой «По темам»).
2. **Пустое состояние вопроса** (`question-empty`): требует недостижимого при живом банке
   состояния `currentQuestion == null`; атрибут добавлен, тест не писался (потребовал бы правки
   стора/банка, что запрещено).
3. **Модалка «Выйти из экзамена?»**: атрибуты `exam-confirm`/`exam-stay`/`exam-leave` добавлены,
   но сценарий не пиннится (из экзамена нет кнопки home-выхода в текущем потоке без подмены состояния).
4. **«Пройти заново» (regular results)**: переход к `results` из regular-потока требует 5 ответов
   + пейволл; сброс прогресса и сохранение streak/XP проверены на уровне хранилища (`partialize`,
   streak/XP), но клик по кнопке E2E не проверяет.
5. **«Поделиться результатом»** — только отсутствие в браузерной ветке; Telegram-ветка не тестируется.
6. **Telegram API** (MainButton/BackButton/haptics/shareURL/viewport) — вне скоупа (§7 app-map).
7. **a11y (axe)** — остаётся в vitest, в E2E не дублируется (§7 app-map).
8. **shuffle-детерминизм** конкретной перестановки не проверяется — только стабильность.
9. **Экзамен: авто-финиш по таймеру** покрыт через сид «просроченного» экзамена; прогон 30 минут
   в реальном времени не проверяется.
10. **Цветовые регрессии** — существующий `color-regression.spec.ts` (2 теста, сетевой флейк §1.1).

## 7. Артефакты

- `test-results/` — Playwright-артефакты последнего прогона (при 0 падений остаётся `.last-run.json`;
  скриншоты/`error-context.md` создаются только для падений — все они были разобраны и удалены
  последним зелёным прогоном).
- Логи прогонов: `.project/drafts/spec-051-e2e-run1.txt`, `run2…run8-new.txt`,
  `run9-full.txt`, `run10-full.txt`, `run11-full.txt`, `run12-w1.txt`, `run13-w1.txt`.
- `git diff --stat -- src/**` — 6 файлов, 61(+)/11(−).
- Набор тестов: 58 в 8 файлах (`npx playwright test --list`).

## 8. Следующий шаг

Коммит E2E-слоя (ожидает approve капитана): `e2e/{fixtures,dashboard,question-flow,results,paywall,persist,browser-mode}.*`,
`tsconfig.e2e.json`, правки `data-testid` в `src/presentation/**` (6 файлов) и этот документ.
Push — только отдельной per-command авторизацией (rule 10), не сделан.
