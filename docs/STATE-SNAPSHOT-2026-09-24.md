# LinuxExam — STATE SNAPSHOT (2026-09-24)

> Собран в read-only режиме: единственный записанный файл — этот снапшот.
> `questions.json` не изменялся, коммитов и push не делалось, build не запускался.

Репо: `C:\Users\Alexey Udotov\LinuxExam`

---

## 1. Git

| Параметр | Значение |
|---|---|
| branch | `main` |
| HEAD | `fe49e104b2575b74ec3e4854c546222ab2344cbf` (`fe49e10`) |
| HEAD subject | `docs: log topics status fix (session 12)` |
| HEAD date | `2026-09-23 22:12:32 +1000` |
| commit count | `86` |
| upstream | `origin/main` |
| ahead / behind | `0 / 0` |

`git status --porcelain` (на момент сбора снапшота — до появления самого файла снапшота):

```
?? docs/HANDOFF-2026-09-23.md
?? drafts/audit-mas-2026-09-23.json
```

`git log --oneline -15`:

```
fe49e10 docs: log topics status fix (session 12)
f5e7a77 fix(topics): enable essential_tools and users_groups (were planned)
6c26ebe docs: log security merge (session 10)
0f14023 content: merge security pilot (12 questions, 54 -> 66)
87c14a0 docs: log security pilot (session 9)
eabe1f8 docs: sync CONTEXT.md (origin/main fe0dcae)
bcbd8ef content(drafts): security pilot (12 questions, domain 9)
fe0dcae docs: log cosine class inversion (session 8)
17ce56b docs(qc): document cosine class inversion, decision keep 0.80
c3dc43a docs: log cosine batch-independence fix (session 7)
6deaf4c docs: sync CONTEXT.md (L5c verified, cosine bg_max 0.8085)
f29aec9 fix(qc): cosine batch-independent (per-text embedding)
b3c9d01 docs: log session 6 (untracked artifacts commit)
a39acaf docs: sync CONTEXT.md with actual HEAD (0be90f7)
0be90f7 chore: commit residual package.json + cosine.cjs changes
```

---

## 2. Дерево проекта

Корень (без `node_modules/`, `.git/`, `dist/`):

```
d---- .github            d---- src           -a--- .gitignore
d---- .tmp-audit         d---- test-results  -a--- .prettierrc
d---- .vscode            d---- tools         -a--- AGENTS.md
d---- docs               d---- e2e           -a--- AUDIT.md
d---- drafts             d---- public        -a--- README.md
d---- scripts            -a--- index.html    -a--- package.json
                         -a--- playwright.config.ts
                         -a--- eslint.config.js / postcss.config.js / tailwind.config.js
                         -a--- vite.config.ts / vitest.config.ts
                         -a--- tsconfig.json / tsconfig.app.json / tsconfig.node.json
```

`src/` (файлы; каталоги помечены `/`):

```
App.tsx [1753]
data/models/AnswerRecord.ts [108]
data/models/Question.ts [954]
data/questions.json [98233]
data/questions.json.bak [4522]
data/repositories/QuestionRepository.ts [838]
data/topics.ts [2903]
domain/quizService.ts [2230]
domain/selectors.ts [458]
domain/__tests__/shuffleOptions.test.ts [4591]
hooks/useExamTimer.ts [1454]
hooks/useTelegramBackButton.ts [1322]
hooks/useTelegramHaptics.ts [1024]
hooks/useTelegramMainButton.ts [1420]
hooks/useTelegramTheme.ts [2349]
hooks/useThemeController.ts [5148]
hooks/__tests__/{useTelegramBackButton,useTelegramHaptics,useTelegramMainButton,useTelegramTheme,useThemeController}.test.*
index.css [1190]
main.tsx [2350]
platform/payment_provider.ts [850]
platform/telegram_adapter.ts [3274]
presentation/components/{AppHeader,MotionButton,ScreenContainer,StreakBadge,XpBar}.tsx
presentation/components/__tests__/{MotionButton,StreakBadge,XpBar}.test.tsx
presentation/screens/{Dashboard,Paywall,Question,Results}.tsx
presentation/screens/__tests__/{Dashboard.a11y,Paywall.a11y,Question.a11y,Question.back,Results.a11y,Results.stream}.test.tsx
presentation/theme/{index.ts,layout.ts,spacing.ts,tokens.css}
store/quizStore.ts [19329]
store/__tests__/{free-gate-review,persist-migration,reset-progress,streak,streams-isolation,topic-quiz}.test.ts
test/{a11y-utils.ts,setup.ts}
types/window.d.ts [151]
utils/pluralize.ts [285]
utils/theme.ts [5785]
utils/__tests__/theme.test.ts [8458]
vite-env.d.ts [39]
```

`tools/`:

```
cosine-calibration.json  7304
cosine.cjs              15723
qc.cjs                   4632
```

`docs/`, `drafts/` — см. секции 9 и 10.

`scripts/` — **каталог существует, но пуст (0 файлов)**. В `package.json` нет ни одного скрипта, который бы его использовал.

---

## 3. package.json

| Поле | Значение |
|---|---|
| name | `vite-react-typescript-starter` (переименование в `linuxexam` — открытый пункт AUDIT.md F-11) |
| version | `0.0.0` |
| private | `true` |
| type | `module` |

scripts:
```json
{
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "qc": "node tools/qc.cjs",
  "cosine:intra": "node tools/cosine.cjs --intra-batch",
  "typecheck": "tsc --noEmit -p tsconfig.app.json",
  "test:run": "vitest run",
  "test:e2e": "playwright test"
}
```

dependencies:
```
@telegram-apps/sdk ^3.11.8      @telegram-apps/sdk-react ^3.3.9
@xenova/transformers ^2.17.2    lucide-react ^0.446.0
motion ^13.4.0                  react ^18.3.1
react-dom ^18.3.1               zustand ^5.0.15
```

devDependencies (27): `@eslint/js ^9.9.1`, `@playwright/test ^1.63.0`, `@testing-library/jest-dom ^7.0.1`, `@testing-library/react ^16.3.3`, `@testing-library/user-event ^14.6.7`, `@types/jest-axe ^3.5.9`, `@types/react ^18.3.5`, `@types/react-dom ^18.3.0`, `@vitejs/plugin-react ^4.3.1`, `@vitest/ui ^3.2.7`, `autoprefixer ^10.4.18`, `eslint ^9.9.1`, `eslint-config-prettier ^10.1.8`, `eslint-plugin-react-hooks ^5.1.0-rc.0`, `eslint-plugin-react-refresh ^0.4.11`, `globals ^15.9.0`, `jest-axe ^11.0.0`, `jsdom ^29.1.1`, `postcss ^8.4.35`, `prettier ^3.9.8`, `tailwindcss ^3.4.1`, `typescript ^5.5.3`, `typescript-eslint ^8.3.0`, `vite ^5.4.2`, `vite-plugin-mkcert ^2.1.0`, `vitest ^3.2.7`.

`npm audit` (summary):

```json
{"info":0,"low":3,"moderate":8,"high":20,"critical":1,"total":32}
```

Метаданные аудита: `prod 108`, `dev 452`, `optional 42`, `peer 18`, всего `564` зависимостей.

---

## 4. Сборка (существующий `dist/`, build не запускался)

- `dist/` существует: 5 файлов, суммарно **481 157 байт** (469.9 KB).
- `dist/assets/`:

| файл | raw | gzip |
|---|---|---|
| `index-CcJwThrt.js` | 456.38 kB | **138.77 kB** |
| `index-BEMZT2TL.css` | 9.58 kB | 2.70 kB |

**Красный флаг:** JS gzip **138.77 kB** при задокументированном watch-пороге `>137 kB gzip — стоп` (`docs/CONTEXT.md`, «Ключевые цифры»). Порог превышен на 1.77 kB; lazy-load `questions.json` числится в backlog как критичный до 100+ вопросов.

---

## 5. Банк вопросов (`src/data/questions.json`)

**Метрики (node, чтение без записи в банк):**

`json
{
  "total": 66,
  "uniqueIds": 66,
  "topics": {
    "file_permissions": 12,
    "file_management": 12,
    "process_management": 11,
    "essential_tools": 7,
    "users_groups": 12,
    "security": 12
  },
  "domains": {
    "1": 13,
    "3": 5,
    "4": 2,
    "5": 4,
    "6": 3,
    "7": 15,
    "8": 1,
    "9": 23
  },
  "subtopicsCount": 54,
  "allCorrectAtPos0": true,
  "idsFirst5": [
    "fp_001",
    "fp_002",
    "fm_001",
    "fm_002",
    "pm_001"
  ],
  "idsLast5": [
    "sec_008",
    "sec_009",
    "sec_010",
    "sec_011",
    "sec_012"
  ],
  "fieldsUnion": [
    "_meta",
    "difficulty",
    "explanation",
    "id",
    "objective_domain",
    "options",
    "question",
    "subtopic",
    "topic"
  ]
}
`

**Поля, встречающиеся в банке:**

| поле | у скольких записей |
|---|---|
| `_meta` | 31 |
| `difficulty` | 66 |
| `explanation` | 66 |
| `id` | 66 |
| `objective_domain` | 66 |
| `options` | 66 |
| `question` | 66 |
| `subtopic` | 66 |
| `topic` | 66 |

**Темы (topic):**

| topic | вопросов |
|---|---|
| `file_permissions` | 12 |
| `file_management` | 12 |
| `users_groups` | 12 |
| `security` | 12 |
| `process_management` | 11 |
| `essential_tools` | 7 |

**Домены (objective_domain):**

| домен | вопросов |
|---|---|
| 1 | 13 |
| 2 | 0 |
| 3 | 5 |
| 4 | 2 |
| 5 | 4 |
| 6 | 3 |
| 7 | 15 |
| 8 | 1 |
| 9 | 23 |

Все 66 записей имеют `objective_domain` (поле присутствует у всех, валидные значения 1–9), `subtopic` и `topic` присутствуют у всех 66. Домен **2 (Create simple shell scripts)** — 0 вопросов. Сумма по доменам = 66.
`_meta` есть у 31 записи (`et_001..et_007`, `ug_001..ug_012`, `sec_001..sec_012`); у 5 базовых `fp_001/fp_002/fm_001/fm_002/pm_001` и у `fp_003..fp_012/fm_003..fm_012/pm_002..pm_011` блок `_meta` отсутствует. Внимание: `docs/content-generation-20260921-1403.md` утверждает, что у 5 унаследованных записей нет `objective_domain`/`subtopic`, но в текущем банке эти поля есть у всех 66 — тот документ отражает состояние ДО Step 6/merge.


---

## 6. `src/data/topics.ts` — статусы тем

| id | title | status | вопросов в банке |
|---|---|---|---|
| `file_permissions` | Права доступа | available | 12 |
| `file_management` | Управление файлами | available | 12 |
| `process_management` | Управление процессами | available | 11 |
| `essential_tools` | Базовые инструменты | available | 7 |
| `text_files` | Работа с текстом | planned | 0 |
| `shell_scripts` | Shell-скрипты | planned | 0 |
| `running_systems` | Управление системами | planned | 0 |
| `manage_software` | Управление ПО | planned | 0 |
| `local_storage` | Локальное хранилище | planned | 0 |
| `file_systems` | Файловые системы | planned | 0 |
| `deploy_systems` | Развёртывание систем | planned | 0 |
| `networking` | Сеть | planned | 0 |
| `users_groups` | Пользователи и группы | available | 12 |
| `security` | Безопасность | available | 12 |

- **available: 6** тем, **planned: 8** тем.
- Экспорты: `TOPICS`, `AVAILABLE_TOPICS`, `PLANNED_TOPICS`, типы `TopicStatus`, `TopicConfig`.
- Асимметрия: `essential_tools` = 7 вопросов (пилот дал 10 черновиков, 2 отбракованы, 1 остался в резерве как `et_009`), остальные available-темы — по 11–12.
- Все planned-темы **без единого вопроса в банке** — консистентно (7 planned = 7 доменов без контента; соответствие статуса и наличия вопросов не нарушено).

---

## 7. Ключевые файлы кода

### `src/domain/quizService.ts` (2230 B)

```ts
export interface ProgressMetrics { /* ... */ }
export interface ShuffledOption { /* ... */ }
export function seedFromId(id: string): number
export function shuffleOptions(...)
export function calculateProgress(...)
```
Назначение: чистая domain-логика — детерминированный шаффл опций (mulberry32 + FNV-1a seed от `question.id`) и расчёт прогресса. Ноль импортов из React/Zustand.

### `src/domain/selectors.ts` (458 B)

```ts
export function filterByTopic(questions: Question[], topic: Topic): Question[]
export function getCurrentQuestion(questions: Question[], index: number): Question | null
```

### `src/store/quizStore.ts` (19 329 B)

```ts
export const FREE_QUESTION_LIMIT = 5;
export type Screen = 'dashboard' | 'question' | 'results';
export interface QuestionStat { /* ... */ }
interface QuizState { /* ... */ }
export const useQuizStore = create<QuizState>()( /* persist */ )
```
Ключевые методы состояния: `loadQuestions`, `recordActivity`, `navigateTo`, `answerQuestion(questionId, selectedIndex)` (правильность считается внутри стора — F-1 из AUDIT.md исправлен), `recordQuestionStat`, `nextQuestion`, `previousQuestion`, `resetProgress`, `unlockPro`, `hidePaywall`, `canAccessQuestion`, `getQuestionsByTopic`, `getCurrentQuestion`, `getProgress`, `getActiveQuestions`, `resumeQuiz`, `startReviewQuiz`, `answerReview`, `startRegularQuiz`, `startTopicQuiz`, `startExam`, `answerExam`, `finishExam`, `cancelExam`.

### `src/data/models/Question.ts` (954 B)

```ts
export type Topic = 'file_permissions' | 'file_management' | 'process_management';
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface QuestionOption { text: string; correct: boolean }
export interface Question { id; topic; difficulty; question; options; explanation }
export interface QuestionJson { /* то же, но строковые topic/difficulty */ }
export function fromJson(raw: QuestionJson): Question
```
**Красный флаг:** `Topic` знает только 3 темы, а банк содержит 6 topic-ключей (`essential_tools`, `users_groups`, `security` вне типа); `fromJson` использует `as Topic` / `as Difficulty` — это ровно тот `as`-каст для JSON, который запрещён `AGENTS.md` («Использовать `as`-касты для валидации JSON (нужна runtime-проверка)»), и та проблема, что зафиксирована в AUDIT.md как F-6.

### `src/App.tsx` (1753 B)

Роутер по `currentScreen` из стора: `dashboard | question | results`, fallback → Dashboard. Дёргает `loadQuestions()` в `useEffect`, тянет тему через `useThemeController()`, в DEV-режиме рисует оверлей с TG-пользователем или пометкой `Web mode`.

### Компоненты (`src/presentation/components/`)

| файл | экспорт | назначение |
|---|---|---|
| `AppHeader.tsx` | `AppHeader({onBack,onHome,center,right})` | шапка с кнопками назад/домой и правым слотом |
| `MotionButton.tsx` | `MotionButton` | кнопка с motion-анимацией, прокидывает props |
| `ScreenContainer.tsx` | `ScreenContainer({children,style})` | обёртка экрана (layout/отступы) |
| `StreakBadge.tsx` | `StreakBadge()` | бейдж серии дней |
| `XpBar.tsx` | `XpBar()` | прогресс-бар XP |

### Экраны (`src/presentation/screens/`)

| файл | экспорт | назначение |
|---|---|---|
| `Dashboard.tsx` (18 195 B) | `default Dashboard({theme,onToggleTheme})` | главный экран: темы, потоки, статистика |
| `Question.tsx` (20 287 B) | `default Question()` | экран вопроса всех 3 потоков |
| `Results.tsx` (15 095 B) | `default Results()` | результаты попытки/экзамена |
| `Paywall.tsx` (5 121 B) | `default Paywall()` | экран оплаты |

---

## 8. `tools/`

| файл | размер | что делает |
|---|---|---|
| `qc.cjs` | 4 632 | детерминированный QC банка: читает `src/data/questions.json` и `src/data/topics.ts` (валидные topic-ключи вытягиваются regex-ом), 5 проверок |
| `cosine.cjs` | 15 723 | офлайн-семантические дубликаты (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`), модель `Xenova/all-MiniLM-L6-v2`, dim 384 |
| `cosine-calibration.json` | 7 304 | калибровка порогов и задокументированное ограничение модели |

### `qc.cjs` — фактические проверки и пороги

| # | Проверка | Условие |
|---|---|---|
| 1 | schema | `id` обязателен и уникален; `question`/`explanation`/`topic` не пусты; `topic` из `topics.ts`; `objective_domain` валиден; ровно 4 опции, непустой `text`, ровно один `correct` |
| 2 | bigram Jaccard между опциями | **FAIL** при `> 0.9` |
| 3 | плейсхолдеры | FAIL при совпадении в опции или в стеме |
| 4 | length ratio опций | **WARN** при `max/min > 2.5` (в пилоте отбраковка была при `> 1.30`) |
| 5 | absolute terms RU+EN | **WARN** при абсолютном термине в стеме |

`cosine.cjs`: `DEFAULT_JACCARD_THRESHOLD = 0.9`; cosine-порог читается из `cosine-calibration.json` (fallback 0.80); intra-batch пороги в коде: `INTRA_FAIL_THRESHOLD = 0.80`, `INTRA_WARN_THRESHOLD = 0.75`; есть `--self-check` и `--intra-batch`.

### `tools/cosine-calibration.json` (содержимое, целиком)

```json
{
  "model": "Xenova/all-MiniLM-L6-v2",
  "dim": 384,
  "pooling": "per-text embedding (batch=1), mean over token axis weighted by attention_mask, then L2-normalised",
  "offline": true,
  "corpus": "src/data/questions.json",
  "corpus_size": 54,
  "pairs_measured": 1431,
  "measured_at": "2026-09-23",
  "background_max": 0.8085,
  "background": {
    "max": 0.8085,
    "max_pair": ["ug_005", "ug_006"],
    "p99": 0.719,
    "p95": 0.6521,
    "mean": 0.4862,
    "min": 0.1013,
    "note": "recalibrated on the 54-question bank with per-text embedding. Previously the background maximum was a property of batch composition (0.7661 / 0.7727 / 0.8043 / 0.8085 for the same texts at batch sizes 1 / 2 / 54 / 54-per-text). p99/p95/mean/min are now measured on the 54-question bank instead of the 42-question pass."
  },
  "distribution": {
    "gt_0_80": 2,
    "gt_0_78": 2,
    "gt_0_75": 5,
    "gt_0_70": 21,
    "note": "measured on 1431 pairs of the 54-question bank with per-text embedding. gt_0_80 counts ug_005~ug_006 (0.8085) and fm_002~fm_003 (0.8040). Both are whitelisted as known exceptions."
  },
  "known_exceptions": ["fm_002~fm_003", "ug_005~ug_006"],
  "thresholds": { "fail": 0.80, "warn": 0.75, "cosine": 0.80, "jaccard": 0.9 },
  "threshold_margin": {
    "threshold": 0.8,
    "background_max": 0.8085,
    "margin": -0.0085,
    "verdict": "the threshold sits 0.0085 BELOW the measured background maximum, so exactly two pairs exceed it under per-text embedding: ug_005~ug_006 (0.8085) and fm_002~fm_003 (0.8040). "
  },
  "threshold_warning": "0.80 < background_max. New pairs > 0.80 will be auto-rejected. L5c (intra-batch manual review) required before accepting new batches.",
  "cosine_limitation": {
    "finding": "per-text cosine under Xenova/all-MiniLM-L6-v2 does not separate paraphrases from background on Russian text",
    "class_inversion": true,
    "primary_defense": "jaccard_0.9",
    "threshold_decision": "keep_0.80",
    "backlog_task": "replace cosine model with Russian-language model (e.g. cointegrated/rubert-tiny2)"
  },
  "true_paraphrase_probes": [
    { "id": "et_003", "cosine": 0.9249, "paraphrase_preserved_correct": true },
    { "id": "fp_006", "cosine": 0.8675, "paraphrase_preserved_correct": true },
    { "id": "ug_008", "cosine": 0.8253, "paraphrase_preserved_correct": true },
    { "id": "ug_009", "cosine": 0.7665, "paraphrase_preserved_correct": true },
    { "id": "pm_005", "cosine": 0.7662, "paraphrase_preserved_correct": true },
    { "id": "fp_003", "cosine": 0.7488, "paraphrase_preserved_correct": false },
    { "id": "fm_002", "cosine": 0.7247, "paraphrase_preserved_correct": false },
    { "id": "fm_009", "cosine": 0.7229, "paraphrase_preserved_correct": true },
    { "id": "fp_004", "cosine": 0.6686, "paraphrase_preserved_correct": true }
  ],
  "true_paraphrase_probes_legacy": [0.9626, 0.8932, 0.8745, 0.8553],
  "calibrated_at": "2026-09-23T10:55:38Z"
}
```
(Кавычки и порядок ключей при перезаписи сохранены; в исходном файле есть ещё ключи `pooling_note`, `pooling_validation`, `calibration_note`, `justification`, `note`, `caveat`, `recalibrated`, `recalibration_history` — они здесь свёрнуты в `threshold_margin`/`cosine_limitation` для читаемости.)

---

## 9. `docs/` — инвентарь

| файл | размер | изменён | первая строка |
|---|---|---|---|
| `ANSWER-SHUFFLE.md` | 2 052 | 2026-09-22 16:49 | `# Option shuffle` |
| `audit-ambiguity-20260922.md` | 11 485 | 2026-09-22 15:40 | `# Question Ambiguity Audit` |
| `audit-logic-20260922.md` | 14 159 | 2026-09-22 20:25 | `# Аудит логики LinuxExam` |
| `content-generation-20260921-1403.md` | 4 222 | 2026-09-21 14:36 | `# Отчёт генерации контента` |
| `CONTEXT.md` | 4 194 | 2026-09-23 21:36 | `# LinuxExam — CONTEXT` |
| `DECISIONS.md` | 18 839 | 2026-09-22 19:16 | `# Decisions Log` |
| `HANDOFF-2026-09-23.md` | 7 498 | 2026-09-24 20:12 | `# HANDOFF — MAS-аудит банка вопросов RHCSA (2026-09-23)` |
| `session-log.md` | 12 131 | 2026-09-23 22:12 | `# Session Log — LinuxExam` |

`docs/HANDOFF.md` (без суффикса даты) — **MISSING**, секцию «Открытые задачи» взять неоткуда; её роль выполняют CONTEXT.md и HANDOFF-2026-09-23.md.

### DECISIONS.md — 13 решений (все датированы 2026-09-22)

| id | контекст (первые строки) |
|---|---|
| DECISION-001 | Контекст: topics clickable vs non-clickable в roadmap Dashboard |
| DECISION-002 | Контекст: `--letter-wide` отсутствует в tokens.css |
| DECISION-003 | Контекст: `nextQuestion` использовал `questions.length` как pool size, игнорируя review stream |
| DECISION-004 | Контекст: topics should be clickable, store не имеет `startTopicQuiz` |
| DECISION-005 | Контекст: «Повторить ошибки» пропала с Dashboard |
| DECISION-006 | Контекст: E2E flake на assertion заголовка из-за race с dev-server |
| DECISION-007 | Контекст: testers asked for both option order and question order shuffle |
| DECISION-008 | Контекст: bug — правильный ответ в режиме «Повторить ошибки» не подсвечивался |
| DECISION-009 | Контекст: фидбек от Евгения — «неудобно читать белое на чёрном» |
| DECISION-010 | Контекст: чат-фидбек Ilya и Евгения; тема была three-state (System/Light/Dark) |
| DECISION-011 | Контекст: UX-баги в настройках темы; подпись свитча была статичной |
| DECISION-012 | Контекст: в inherit-режиме вне Telegram страница рисовалась тёмной |
| DECISION-013 | Контекст: после миграции на семантические токены оставались три проблемы |

### session-log.md — последние 5 записей

| сессия | дата | итог |
|---|---|---|
| 7 | 2026-09-23 | cosine batch-independence fix (per-text embedding) |
| 8 | 2026-09-23 | cosine class inversion; решение `keep 0.80` |
| 9 | 2026-09-23 | security pilot (domain 9) |
| 10 | 2026-09-23 | security merge, банк 54 → 66 |
| 12 | 2026-09-23 | fix `topics.ts` status (essential_tools и users_groups были planned) |

(Сессия 11 в журнале отсутствует — нумерация с пропуском.)

### docs/HANDOFF-2026-09-23.md — заголовки

```
# HANDOFF — MAS-аудит банка вопросов RHCSA (2026-09-23)
## Как исполнялось
## Результат консенсуса
## Findings с `is_critical = true`
## Главное ограничение: `all_A = true`
## Рекомендации
## Не сделано (ожидает одобрения)
```

### docs/ANSWER-SHUFFLE.md — суть (5 строк)

1. Шаффл опций **включён в рантайме** (`shuffleOptions()` в `quizService.ts`), алгоритм Fisher-Yates + PRNG mulberry32, seed от `question.id` (FNV-1a).
2. Порядок стабилен между рендерами/сессиями — нет мигания и flaky-тестов; в опции хранится `originalIndex` для обратного маппинга.
3. Включён потому, что трое из пяти бета-тестеров заметили: **правильный ответ всегда на позиции 1**.
4. В хранилище по-прежнему `options[0].correct === true` у всех вопросов — это скрыто только на уровне отображения.
5. `AnswerRecord.selectedIndex` ссылается на исходный массив; порядок **вопросов** не шаффлится (DECISION-007). Тест `shuffleOptions.test.ts` проверяет, в том числе, что банк действительно содержит все ответы на позиции 0.

---

## 10. `drafts/` — инвентарь

| файл | размер | изменён |
|---|---|---|
| `_tools/calibration.json` | 2 037 | 2026-09-23 09:19 |
| `_tools/candidates-v1.json` | 10 787 | 2026-09-23 09:17 |
| `_tools/candidates-v2.json` | 2 596 | 2026-09-23 09:21 |
| `_votes/beginner.json` | 1 742 | 2026-09-23 09:21 |
| `_votes/ex200_examiner.json` | 4 031 | 2026-09-23 09:24 |
| `_votes/rhcsa_instructor.json` | 2 085 | 2026-09-23 09:21 |
| `_votes/skeptic.json` | 3 922 | 2026-09-23 09:23 |
| `_votes/sysadmin_10y.json` | 2 346 | 2026-09-23 09:21 |
| `audit-mas-2026-09-23.json` | 62 578 | 2026-09-24 20:12 |
| `pending-2026-09-22-2322.json` | 24 966 | 2026-09-23 09:24 |
| `pending-2026-09-23-users-groups.json` | 89 518 | 2026-09-23 16:27 |
| `pending-security-2026-09-23.json` | 38 770 | 2026-09-23 21:13 |
| `report-2026-09-22.md` | 7 923 | 2026-09-23 09:24 |
| `report-2026-09-23.md` | 23 301 | 2026-09-23 16:27 |
| `report-security-2026-09-23.md` | 10 195 | 2026-09-23 21:13 |

### `pending-*.json`

| файл | тема / домен | pipeline_version | черновиков | принято | отбраковано | в файле | reserve |
|---|---|---|---|---|---|---|---|
| `pending-2026-09-22-2322.json` | `essential_tools` / «1. Understand and use essential tools» | 2.0 | 10 | 7 | 2 | 7 | 1 (`et_009`) |
| `pending-2026-09-23-users-groups.json` | `users_groups` (поле `domain` отсутствует; есть `domain_title`) | 4.4 | нет поля (`total_drafted` отсутствует) | 11 (`total_passed`) | 0 | 12 | 0 |
| `pending-security-2026-09-23.json` | `security` (поле `domain` отсутствует; есть `domain_title`) | 4.5 | нет поля | 1 (`total_passed`) + `total_pass_with_flag` | 0 | 12 | 0 |

Схема у трёх артефактов **разошлась**: пилот (v2.0) использует `total_drafted`/`domain`/`objective_processed`, а v4.4/v4.5 — `mode`, `self_refine_mode`, `cosine_skipped`, `thresholds`, `review_summary`, `master_verdict`/`review_class`/`_l7_verdict` на вопросе и блок `verdict_ledger` (v4.5). У security-артефакта вопрос **не содержит** объекта `validation` вовсе — вместо него `_l5`, `_l7_verdict`, `verdict`, `confidence`, `flags`.

### `drafts/_votes/*.json`

| файл | записей | роль | вопросы |
|---|---|---|---|
| `beginner.json` | 8 | `beginner` | `et_001..et_008` |
| `ex200_examiner.json` | 8 | `ex200_examiner` | `et_001..et_008` |
| `rhcsa_instructor.json` | 8 | `rhcsa_instructor` | `et_001..et_008` |
| `skeptic.json` | 8 | `skeptic` | `et_001..et_008` |
| `sysadmin_10y.json` | 8 | `sysadmin_10y` | `et_001..et_008` |

Итого 40 записей = 8 вопросов × 5 ролей (включая отбракованный `et_008`).

### `drafts/audit-mas-2026-09-23.json` — структура (ключи верхнего уровня)

```
generated_at, method, bank_size, batches, ground_truth_blind, positional_bias, counts, findings
```

`counts`: `{"keep":61,"minor_fix":3,"major_fix":2,"retire":0,"unanimous":40,"strong_majority":20,"weak_majority":4,"disagreement":2,"insufficient_data":0,"critical":0}`; `positional_bias`: `{"actual_all_A":true,"inferred_match_actual":65,"total_judged":66}`.

---

## 11. Untracked / незакоммиченное

`git status --porcelain` → только untracked файлы. Modified — **нет**. Staged — **нет**.

| статус | файл | размер | что это |
|---|---|---|---|
| `??` | `docs/HANDOFF-2026-09-23.md` | 7 498 B | «HANDOFF — MAS-аудит банка вопросов RHCSA (2026-09-23)»: как исполнялся пайплайн, counts консенсуса, разбор findings, ограничение `all_A = true` |
| `??` | `drafts/audit-mas-2026-09-23.json` | 62 578 B | артефакт консенсуса MAS-аудита: 66 findings, сводка `counts`, `positional_bias`, `per_role` разбивка |
| `??` | `docs/STATE-SNAPSHOT-2026-09-24.md` | 37 011 B | этот снапшот (появился уже после снятия `git status`, поэтому в блоке §1 его нет) |

`src/data/questions.json` **не изменён** (`git diff HEAD` пуст). Отдельно незакоммичен (и не отслеживается, т.к. в `.gitignore`) каталог `.tmp-audit/` с `workflow-run.js`, контекстами батчей и per-role результатами `raw/b0..b10`.

---

## 12. Планы (сводная таблица)

| Приоритет | Задача | Источник | Статус |
|---|---|---|---|
| P0 | Монетизация: токен бота отозван — перевыпустить в BotFather | CONTEXT.md (Открытые вопросы) | блокер монетизации |
| P0 | Lazy-load `questions.json` — критично до 100+ вопросов | CONTEXT.md, session-log (сессия 4), SECURITY report | открыто; сейчас gzip 138.77 kB > watch 137 kB |
| P1 | Приватность репо: VPS или GitHub Pro (хостинг) | CONTEXT.md | открыто |
| P1 | 32 уязвимости в deps (1 critical, 20 high) — `npm audit` | CONTEXT.md («52 уязвимости», теперь 32), session-log | открыто |
| P1 | Заменить cosine-модель на русскоязычную (`cointegrated/rubert-tiny2`) после 100+ вопросов | CONTEXT.md, `cosine-calibration.json#cosine_limitation` | открыто, требует онлайн-загрузки и полной перекалибровки |
| P2 | Ужесточить L8: чеклист 4/4 мягкий, 12/12 без reject | CONTEXT.md, session-log (сессия 4) | открыто |
| P2 | `@xenova/transformers` из dependencies → devDependencies | CONTEXT.md | открыто |
| P2 | Решить судьбу 5 вопросов MAS-аудита: `fp_005`, `fp_012` (править стемы), `fm_008` (нет man), `pm_005` (уточнить стем), `et_001` (шаблон `. *` и текст excerpt) | HANDOFF-2026-09-23.md (Рекомендации) | открыто, ожидает решения |
| P2 | Проверить/перемешать позиции правильных ответов в банке | HANDOFF-2026-09-23.md, ANSWER-SHUFFLE.md | открыто (в хранилище все ответы на позиции 0) |
| P3 | Коммит + push артефактов MAS-аудита | git status, HANDOFF-2026-09-23.md | ожидает одобрения |
| P3 | Полные reasoning батчей 4–10 сохранить на диск (сейчас компактный вид) | HANDOFF-2026-09-23.md | опционально, требует повторного прогона |
| P3 | `package.json`: name `vite-react-typescript-starter` → `linuxexam`; добавить `engines` | AUDIT.md F-11 | открыто |
| P3 | `scripts/` пуст — либо наполнить, либо удалить | инвентарь §2 | открыто, нигде не зафиксировано |

---

## 13. Стек и версии

| Компонент | Версия |
|---|---|
| node | `v24.13.0` |
| npm | `11.6.2` |
| react | `^18.3.1` |
| react-dom | `^18.3.1` |
| vite | `^5.4.2` |
| typescript | `^5.5.3` |
| zustand | `^5.0.15` |
| tailwindcss | `^3.4.1` (devDependency) |
| vitest | `^3.2.7` |
| @playwright/test | `^1.63.0` |
| motion | `^13.4.0` |
| @telegram-apps/sdk | `^3.11.8` |
| lucide-react | `^0.446.0` |
| @xenova/transformers | `^2.17.2` |

`.nvmrc` — **MISSING**, `.node-version` — **MISSING**. Версия Node зафиксирована только текстом (`AGENTS.md` не содержит, `AUDIT.md` F-11 отмечает отсутствие `engines`).

---

## 14. Риски / красные флаги

1. **Bundle gzip превышает watch-порог:** `dist/assets/index-CcJwThrt.js` = **138.77 kB gzip** при задокументированном пороге `>137 kB → стоп`. Lazy-load `questions.json` не сделан.
2. **`docs/HANDOFF.md` MISSING** — канонической секции «Открытые задачи» нет; планы пришлось собирать из CONTEXT.md, session-log и HANDOFF-2026-09-23.md.
3. **3 незакоммиченных артефакта** (два от MAS-аудита + этот снапшот) — не в git, могут потеряться; push ожидает одобрения.
4. **ahead/behind = 0/0** — код и origin синхронны, но локальные артефакты вне истории.
5. **32 уязвимости:** 1 critical + 20 high + 8 moderate + 3 low (`npm audit`). В CONTEXT.md фигурирует цифра «52» — устарела.
6. **Cosine-порог ниже фона:** `threshold 0.80` при `background_max 0.8085`, `margin = -0.0085`; два известных исключения whitelisted. Любая новая пара > 0.80 будет авто-отклонена; `threshold_warning` прямо требует L5c-ревью перед приёмкой батча.
7. **Cosine class inversion:** на русском тексте модель (англоязычная `all-MiniLM-L6-v2`) перефразы и фон не разделяет (`6/9 перефраз ниже bgMax`); основная защита — Jaccard 0.9.
8. **QC мягче пилота:** length ratio сейчас только `WARN > 2.5`, тогда как пилот отбраковывал при `> 1.30` (случай `et_007-old`).
9. **Тип `Topic` устарел:** `Question.ts` знает 3 темы, банк — 6; `fromJson` делает `as Topic`/`as Difficulty`, что запрещено `AGENTS.md` и соответствует AUDIT.md F-6 (нет runtime-валидации JSON).
10. **Домены без контента.** По `objective_domain` домен **2 (Create simple shell scripts) — 0 вопросов**, домен 8 — 1 вопрос, домен 4 — 2. Записи без `objective_domain` отсутствуют (все 66 имеют валидный домен). Соответствие «статус темы = есть вопросы» не нарушено (все 8 planned-тем пусты), но покрытие доменов неравномерное.
11. **`scripts/` пуст**, при этом каталог существует и закоммичен — мёртвая структура.
12. **Позиции ответов:** все 66 вопросов имеют `correct` в индексе 0 (`allCorrectAtPos0: true`); маскируется рантайм-шаффлом. Любая метрика «угадал позицию» на сырых данных вырождена.
13. **`pending-*` схемы разошлись:** v2.0 (`essential_tools`) → v4.4 (`users_groups`) → v4.5 (`security`, без блока `validation`, с `verdict`/`confidence`/`flags`). Единого формата артефакта нет — при повторении пайплайна на новой теме придётся выбирать версию.
14. **`essential_tools` = 7 вопросов** против 11–12 в остальных available-темах: пилот отдал 10 черновиков, `et_008`/`et_010` отбракованы, `et_009` остался в reserve. Слот закрыт не полностью — резерв не влит.
15. **Пропуск в нумерации сессий:** session-log содержит сессии 6, 7, 8, 9, 10, 12 — **сессии 11 в журнале нет**.
