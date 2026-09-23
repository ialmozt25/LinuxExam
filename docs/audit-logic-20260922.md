# Аудит логики LinuxExam

Date: 2026-09-22
Прод: `c4e3a60`. Диагностика read-only, правок не вносилось.

## 0. Главный вывод диагностики

**Тема НЕ ломала логику.** Побайтовое сравнение с состоянием «до темы» (`79524b0`):

```
git diff 79524b0..HEAD -- src/store/quizStore.ts   -> ПУСТО
git diff 79524b0..HEAD -- src/domain/quizService.ts -> ПУСТО
```

Изменён только `Question.tsx` (+46/−46) и `Results.tsx`, и весь diff — замена цветов
(`COLORS.*` → `var(--*)`, hex → `var(--bg-elevated)`). Ни одного изменения условий,
ветвлений или порядка вызовов. Все найденные дефекты **предсуществующие**:
`resetProgress` не менялся с `df42450` («Start repository»), `hasHistory` пришёл из
`feat(ux)`, а `Results` читает regular-стрим с самого начала.

Тесты на момент аудита: typecheck 0, lint 0, **109 unit**, **12 e2e**, build 0.
Искомые дефекты тестами НЕ покрыты — поэтому и не были замечены.

## 1. Сценарии A–J: факт vs эталон

| # | Сценарий | Вердикт | Факт |
|---|---|---|---|
| A | Regular: wrongQuestionIds, score | **OK** | неправильный → `["fp_001"]`, затем правильный → `[]` |
| B | Unified rule (regular + review) | **OK** | правильно в review удаляет из wrong (`answers` не тронут); неправильно — возвращает |
| C | Review stream изоляция | **OK** | `answers=2`, `reviewAnswers=2` одновременно; next не перескакивает в regular |
| D | Topic quiz | **OK** | `activeTopic=file_permissions`, 12 вопросов, темы = только `file_permissions` |
| E | Exam | **OK** | `examQuestionIds=20`, `answerExam` не трогает wrong, `finishExam` → `examLastResult`, `cancelExam` обнуляет |
| F | Stream isolation | **OK** | regular 2 + review 2 не смешиваются |
| G | Persist + миграция | **OK** | новая загрузка восстанавливает `answers=2, currentIndex=1, wrong=1, isQuizInProgress=true`; миграция v1→v2 работает |
| H | Screen transitions | **OK** | dashboard↔question↔results; `settings` отсутствует в union и в DOM |
| I | resetProgress | **СЛОМАНО** | сбрасывает стримы и streak/xp не трогает, но **не очищает exam-состояние** (см. находку 2) |
| J | Exam boundary | **OK** | на последнем вопросе кнопка «Завершить экзамен»; выход в середине → диалог «Выйти из экзамена?», `examActive` остаётся true; таймер 04:59 → 04:56 |

**Важное уточнение по сценарию G.** Первый прогон показал полную потерю состояния после
`reload`. Это оказался **артефакт моей проверки**: `addInitScript(() => localStorage.clear())`
в Playwright выполняется при КАЖДОЙ навигации, включая `reload`, то есть мой же тест стирал
хранилище между записью и чтением. Чистая проверка (запись на одной странице, чтение на
новой загрузке в том же контексте) подтвердила: persist работает. Ложная находка снята.

## 2. Топ-5 сломанного

### СЛОМАНО-1. Results показывает regular-стрим после завершения REVIEW/TOPIC

**Симптом.** Пользователь проходит тему («Начать тему: Права доступа») или «Повторить
ошибки», отвечает на все вопросы, нажимает «Завершить» — и попадает на экран, который
сообщает «Вы ещё не ответили ни на один вопрос», а по темам `0/12 0%`. Хотя он только что
ответил на все вопросы. Это **основной путь** использования тренажёра.

**Где.** `src/presentation/screens/Results.tsx:11,30-41`

```ts
const answers = useQuizStore((s) => s.answers);   // <- только regular-стрим
const answered = answers.length;                   // 0 при review
const correct  = answers.filter((a) => a.isCorrect).length;
```

`Results` вообще не читает `reviewAnswers` (при том что `reviewQuestionIds` читает — строка 17).
Тематический поток пишется в `reviewAnswers` (`quizStore.ts:299`), поэтому Results его не видит.

**Причина.** Предсуществующая: `Results` всегда считал результаты из `answers`. Когда добавили
review/topic-поток (`feat(ux)`, DECISION-004), экран не научили различать активный стрим.
Дефект темы не вносил.

**Fix.** Читать активный стрим так же, как это делает `Question.tsx:75`:

```ts
const reviewQuestionIds = useQuizStore((s) => s.reviewQuestionIds);
const reviewAnswers = useQuizStore((s) => s.reviewAnswers);
const isReview = reviewQuestionIds !== null;
const answers = isReview ? reviewAnswers : useQuizStore.getState().answers;
```
(точную форму селектора подобрать так, чтобы не нарушать правила хуков, и добавить ветку
заголовка/кнопок для review — «Пройти заново» в review сейчас не должен вызывать
`resetProgress`, так как это очистит и regular-поток).

### СЛОМАНО-2. `resetProgress` не очищает exam-состояние

**Симптом.** В store остаётся `examActive: true`, `examStartedAt` (старая метка времени),
`examQuestionIds` (5 id) и `examDurationMs: 60000` после вызова `resetProgress`.
`examStartedAt` при этом **персистится** (`partialize`, строка 415), а `finishExam` считает
длительность как `Date.now() - examStartedAt` — то есть устаревшая метка даёт неверное время.

**Где.** `src/store/quizStore.ts:236-247` — сбрасываются только `answers`, `currentIndex`,
`isPaywallVisible`, `isQuizInProgress`, `wrongQuestionIds`, `reviewQuestionIds`,
`reviewAnswers`, `activeTopic`. Экзаменационных полей нет.

**Причина.** Предсуществующая: экзамен-режим добавили позже (`feat(exam)`), а `resetProgress`
не расширили. `resetProgress` не менялся с `df42450`.

**Достижимость.** Через UI — **ограниченная**: единственный вызов — `Results.tsx:65`
(«Пройти заново»), а на Results при активном экзамене пользователь оказаться не может
(экзамен сначала завершается). Это дефект контракта store, а не воспроизводимый из UI путь.
Спецификация прямо требует «все поля» — поэтому фикс всё равно нужен, но приоритет ниже.

**Fix.** Добавить в `set({...})` обнуление exam-полей:
`examActive: false, examStartedAt: null, examDurationMs: 0, examQuestionIds: [],
examAnswers: [], examLastResult: null`

### СЛОМАНО-3. В review кнопка «Назад» показывается на первом вопросе и ничего не делает

**Симптом.** В режиме темы/review на первом вопросе в хедере видна активная кнопка «Назад».
Клик по ней не меняет ничего (индекс остаётся 0). Пользователь воспринимает это как
сломанную кнопку. При этом Telegram BackButton в той же ситуации **выключен** — то есть
два представления одного действия расходятся.

**Где.** `src/presentation/screens/Question.tsx:87`

```ts
const hasHistory = examActive ? false : isReview ? true : currentIndex > 0;
//                                                  ^^^^^^^^^^^^^ всегда true в review
```
и `Question.tsx:101-104` — `useTelegramBackButton(..., currentIndex > 0)` (здесь верно).
Рендер: `Question.tsx:222` `onBack={hasHistory ? () => previousQuestion() : undefined}`.
`previousQuestion` (`quizStore.ts:227-234`) при `currentIndex === 0` ничего не делает.

**Причина.** Предсуществующая: `isReview ? true` было введено, чтобы разрешить возврат
внутри review, но не учло первый индекс. Дефект темы не вносил.

**Fix.** `const hasHistory = examActive ? false : currentIndex > 0;`
(в review разница между «есть история» и «нет» — тот же `currentIndex > 0`; константа
`isReview ? true` ничего не добавляет, кроме ложного «назад» на нулевом вопросе).

### СЛОМАНО-4. Review без regular-ответов даёт пустой Results (следствие 1)

Отдельным пунктом не выделяю — это тот же дефект, что СЛОМАНО-1, но в самом остром виде:
чистый вход через тему (в базе нет `answers`) даёт экран «Вы ещё не ответили ни на один
вопрос» при `reviewAnswers.length === 2`. Воспроизведено дословно:

```
после завершения: {"screen":"results","answers":0,"review":2,"wrong":0}
экран: "Результаты … Вы ещё не ответили ни на один вопрос … 0/12 0% … 0/11 0%"
```

### СЛОМАНО-5. `currentScreen` не персистится — «продолжить» после перезагрузки недоступно

**Симптом.** Посреди теста перезагрузка возвращает на Dashboard, хотя
`isQuizInProgress=true` и ответы сохранены. Тур не возобновляется автоматически.

**Где.** `src/store/quizStore.ts:403-420` — `partialize` не включает `currentScreen`.
Это может быть осознанным решением (баннер «Тест не завершён» на Dashboard и есть механизм
возобновления), но баннер требует ручного клика, а `resumeQuiz` (`quizStore.ts:283`)
только меняет экран. Формально расходится со спецификацией, где `currentScreen` не назван,
но и не исключён. **Требует решения пользователя.**

## 3. Что требует решения пользователя

1. **[DECISION-008 vs текущее] `Results` для review.** Должен ли Results показывать
   результаты активного стрима (review), или завершение review вообще не должно вести на
   Results? Спецификация описывает «По завершении → Results» только для REGULAR.
   Варианты: (а) Results читает активный стрим; (б) review завершается возвратом на Dashboard;
   (в) отдельный экран результатов для review. **Это главный пункт — от него зависит фикс 1.**
2. **`resetProgress` и streak/totalXp.** Сейчас НЕ сбрасывает (и это выглядит правильно).
   Спецификация говорит «все поля» неоднозначно. Подтвердить: streak/xp сохраняются, экзамен
   обнуляется?
3. **`currentScreen` в persist.** Нужно ли авто-возобновление тура после перезагрузки, или
   баннер на Dashboard — достаточный механизм (тогда это не баг)?
4. **Приоритет фикса 2** (`resetProgress` + exam). Дефект контракта, из UI недостижим.
   Делать в этом проходе или в backlog?

## 4. План фиксов (после одобрения)

Отдельный коммит на каждый фикс, по одному симптому:

| # | Коммит | Файлы | Зависит от |
|---|---|---|---|
| 1 | `fix(logic): review results use the active stream` | `src/presentation/screens/Results.tsx` | решения по п.1 |
| 2 | `fix(logic): resetProgress clears exam state` | `src/store/quizStore.ts` | решения по п.4 |
| 3 | `fix(logic): hide header back on first review question` | `src/presentation/screens/Question.tsx` | — |

Фикс 3 независим и минимален (одна строка) — можно делать первым.
Фиксы 1 и 2 меняют поведение и требуют вашего решения до реализации.

Правок в `questions.json`, `tokens.css`, `index.css`, `useThemeController.ts`, `theme.ts`
не требуется — ни один дефект не лежит в этих файлах.
