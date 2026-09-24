# LinuxExam — HANDOFF

> Точка входа для новых сессий. Читать ПЕРВЫМ.
> Обновляется в конце каждой сессии.

## Идентификация проекта

| Параметр | Значение |
|---|---|
| Репо | `C:\Users\Alexey Udotov\LinuxExam` |
| GitHub | `github.com/ialmozt25/LinuxExam` (публичный) |
| Прод | https://ialmozt25.github.io/LinuxExam/ |
| HEAD | `8c80c5e` — база этой работы (после merge running_systems); сверху **этот коммит** (`docs: update HANDOFF after running_systems merge`, банк 96 → **106**), 2026-09-25 |
| Ветка / upstream | `main` / `origin/main`, ahead/behind `0/0` |
| История | 110 коммитов |
| Банк | 106 вопросов, 106 уникальных id, 0 невалидных, 83 сабтопика |
| Разбивка по темам | `file_permissions` 12, `file_management` 12, `users_groups` 12, `security` 12, `process_management` 11, `networking` 10, `shell_scripts` 10, `text_files` 10, `running_systems` 10, `essential_tools` 7 |
| Домены (objective_domain) | 1:23, 2:**10**, 3:7, 4:2, 5:4, 6:**11**, 7:25, 8:1, 9:23 (все 106 записей имеют валидный домен) |
| topics.ts | 10 available / 4 planned; у всех planned — 0 вопросов |
| Bundle gzip | entry `index-B7YDS_6E.js` = **51.56 kB** (raw 158.39 kB), CSS 2.76 kB; ленивые чанки: Question+motion 47.94, SDK 18.41, Dashboard 3.48, topics 2.51, банк 31.57; первый экран (entry + SDK + Dashboard + topics + банк) ≈ **110 kB** gzip, сумма всех чанков 160.74 kB; watch-порог **>137 kB** считается по entry — проходит с запасом |
| Стек | React `^18.3.1`, Vite `^5.4.2`, TypeScript `^5.5.3`, Zustand `^5.0.15`, Tailwind `^3.4.1`, motion `^13.4.0`, @telegram-apps/sdk `^3.11.8`, lucide-react `^0.446.0`; Node `v24.13.0`, npm `11.6.2` |
| Дата снапшота | 2026-09-24 |
| Дата сборки HANDOFF | 2026-09-25 |

## Правила работы

1. 1 задача = 1 сессия. Не смешивать.
2. Pre-read: HANDOFF + session-log (3) + DECISIONS.
3. Guard 500K токенов контекста.
4. Не пушить без ahead=1 и явного одобрения.
5. Атомарные коммиты (1 симптом = 1 коммит).
6. Rocky 9.8 WSL2 — источник истины для man.
7. Субагентам запрещён pwsh/man.
8. questions.json не менять без явного одобрения.
9. Голоса L4.5 — СТРОГО последовательно (один subagent-вызов → дождаться settled → записать файл → следующий). Параллельные и пакетные вызовы запрещены: 20 параллельных голосов накопили >1M токенов в контексте родителя и уронили сессию 2026-09-24.

## СТОП-ПРАВИЛА

- Стоп-1: мысль «проверим промпт ещё раз» → отклонить.
- Стоп-2: fs-доступ из workflow-агентов → отклонить.
- Стоп-3: > 2 итераций на артефакт → заморозить.
- Стоп-4: > 30% бюджета на «оптимизацию» → режим исполнения.
- Стоп-5: только minor findings в 2 батчах подряд → стоп аудит.

## Состояние на 2026-09-24

- HEAD `302fe00` + этот коммит (`perf: reduce entry bundle gzip`), ветка `main`, upstream `origin/main`, ahead/behind **2/0** (два коммита ждут одобрения push), 101 коммит.
- Банк **96** вопросов: `file_permissions` 12, `file_management` 12, `users_groups` 12, `security` 12, `process_management` 11, `networking` 10, `shell_scripts` 10, `text_files` 10, `essential_tools` 7. Уникальных id 96, невалидных 0, уникальных сабтопиков 76.
- `topics.ts`: 9 available / 5 planned; у всех planned тем — 0 вопросов в банке.
- `subagent_calls` этой сессии: **0** (обе bundle-сессии решены без субагентов).
- Bundle: entry-чанк **51.56 kB** gzip (было 125.22, исходно 150.21 одним чанком) — идеал «≤ 60 kB» **достигнут**. `motion` уехал вместе с ленивым `Question` (47.94 kB gzip), SDK — в отдельный ленивый чанк (18.41), экраны — `React.lazy`, Dashboard берёт счётчики из 261-байтного `_topics.json`. Сумма всех чанков 160.74 kB (на 3.95 больше прежних 156.79 из-за накладных на чанки), но первый экран грузит ≈110 kB вместо ≈159 kB.
- Уязвимости (два среза): Dependabot 52 (1 critical, 23 high, 24 moderate, 4 low); npm audit 32 (1 critical, 20 high, 8 moderate, 3 low, 564 зависимости).
- Cosine: `background_max` **0.8085**, threshold **0.80**, margin **−0.0085**, class inversion на русском; `threshold_warning` требует L5c-ревью перед приёмкой батча.
- `tools/qc.cjs`: length ratio — только `WARN > 2.5`, тогда как пилот v2.0 отбраковывал при `> 1.30` (осознанное расхождение, не баг).
- Все 106 правильных ответов в хранилище стоят в позиции A (`allCorrectAtPos0: true`); рендер маскирует это детерминированным шаффлом.
- `docs/HANDOFF.md` до этой сессии отсутствовал; каноническая точка входа — этот файл.

## Состояние на 2026-09-25

- Сессия: **recovery** после падения 2026-09-24 на L4.5 (MAS-vote) из-за переполнения контекста (1 057 432 / 1 048 576 токенов). Причина падения — параллельный запуск subagent-вызовов (wave 1 + wave 2 одновременно).
- На диске уцелело: черновик `drafts/pending-running_systems-2026-09-24.json` (10 вопросов, 7 сабтопиков, LF/no BOM, все ключи на позиции 0), coherence 10/10 pass (rs_007 — итоговая pass-версия после правки стема), голоса wave 1 (`sysadmin_10y` 10/10 PASS) и wave 2 (`rhcsa_instructor` 10/10 PASS).
- Дособрано в этой сессии: 30 голосов **строго последовательно** — `ex200_examiner` 10/10 PASS, `beginner` 10/10 PASS, `skeptic` 10/10 PASS. Итого **50/50 голосов, 10/10 accepted, 0 REJECT, 0 ABSTAIN**.
- `subagent_calls` этой сессии: **30** (лимит сессии ≤ 35) — только голоса L4.5; coherence переиспользована с диска и не генерировалась повторно.
- L5 Haladyna: 10/10 у всех 10 вопросов (min 10, max 10), порог ≥ 8 выполнен. Option-only length ratio max **1.2667** (rs_004) ≤ 1.30.
- L3 QC на объединённом банке (106): **Fails 0, Warns 2** (fm_002, fm_003 — унаследованные, не rs_*); `npm run typecheck` — **0 ошибок**.
- Duplicate detection: Jaccard max против банка **0.1667** (rs_005~sec_002), intra-batch **0.1667** (rs_004~rs_005), между опциями **0.5000** (rs_005) — все ниже порога 0.9; cosine SKIPPED (кэш модели отсутствует).
- Merge: банк **96 → 106**, `running_systems` переведена `planned → available`, `_topics.json` перегенерирован (10 тем), `_order.json` — 106 id, 10 файлов тем.
- Коммиты сессии: `aee0cfb` (голоса ex200_examiner), `399d74a` (beginner), `f15b2c7` (skeptic), `b398bb6` (черновик: pipeline complete), `2f2e8b8` (merge 96 → 106), `8c80c5e` (восстановленные coherence + голоса wave 1/2), + этот (HANDOFF).
- Push: `origin/main` = HEAD, ahead/behind **0/0**.
- Отклонение от скрипта сессии (осознанное, две правки): (1) в merge-коммит добавлен 5-й файл — сам черновик (`meta.status` → `CLOSED`), чтобы артефакт соответствовал конвенции репозитория; (2) отдельным коммитом закоммичены 30 восстановленных артефактов упавшей сессии (10 coherence + 20 голосов wave 1/2), которые лежали untracked и не были durable.
- Bundle: сборка **не пересобиралась** (не входило в скрипт сессии); цифры в таблице — замер 2026-09-24 при банке 96. Банк грузится ленивыми чанками по темам, поэтому +10 вопросов entry-чанк не увеличивают; при следующей сессии перепроверить watch-порог сборкой.
- Остаток P0: 4 planned-темы без вопросов (`manage_software` — конвейер 2 так и не начинался, `local_storage`, `file_systems`, `deploy_systems`); option shuffle на уровне данных (все 106 ключей в позиции A).

## Открытые задачи

### P0 (блокеры)

- Наполнение банка до 160+ (4 planned-темы без вопросов: `manage_software`, `local_storage`, `file_systems`, `deploy_systems`).
- Токен `@linux_exam_bot` отозван — перевыпустить.
- Option shuffle: все 106 ответов на позиции A на уровне данных (рендер перемешивает через `shuffleOptions` + seed, но банк вырожден для аудита).
- Bundle: entry приведён к **51.56 kB** gzip (цель ≤60 достигнута). Остаток entry — React (≈45.5 kB gzip) + store/theme/glue; дальше только смена рантайма (Preact) или отказ от React-зависимостей. Суммарный вес всех чанков 160.74 kB — watch 137 kB считается по entry и проходит.
- `npm audit`: 1 critical + 20 high — обновить deps.

### P1 (качество)

- Правки `major_fix` из MAS-аудита: `fp_005`, `fp_012`.
- Ужесточить L8 (мягкий чеклист).
- Привести QC length ratio к пилотному порогу 1.30 (сейчас 2.5).
- Type-safety: `Topic` знает 3 темы при 6 в банке; убрать `as`-каст в `fromJson` (F-6 в `docs/AUDIT.md`).
- Унифицировать схему `drafts/pending-*` (v2.0 → v4.4 → v4.5, у security нет блока `validation`).
- Cosine margin −0.0085 — решить L5c-ревью перед приёмкой батча.
- `tools/qc.cjs`: placeholder-проверка считает FAIL любую конструкцию вида `{...}` в стеме/опции, поэтому каноническую awk-программу `{print $1}` в опцию записать нельзя — сабтопик BLUEPRINT «awk: выбор полей и печать колонок» закрывается только brace-free формой (см. meta батча 3).

### P2 (инфраструктура)

- Приватность репо.
- Cosine-модель русскоязычная (`cointegrated/rubert-tiny2`).
- `docs/CONTEXT.md`: согласовать с HANDOFF — Dependabot 52 ≠ npm audit 32, это разные срезы, не «устарело».

### P3 (nice-to-have)

- `retired.json`, monthly re-verify, feedback endpoint, PDF/CSV.

## Что закрыто (не переделывать)

- Bundle-opt: entry 125.22 → **51.56 kB** gzip. `motion` (44 kB gzip) уехал вместе с ленивым `Question` — он используется только в `Question.tsx` и `MotionButton.tsx`; `@telegram-apps/sdk` — через dynamic import адаптера в `main.tsx` в отдельный чанк (инициализация по-прежнему до первого рендера, порядок не менялся); экраны — `React.lazy` + `Suspense` с общим фолбэком; Dashboard считает вопросы и общий итог из `_topics.json`. Тема стала SDK-free: добавлен мост `src/platform/telegramTheme.ts` (адаптер публикует, `useThemeController` читает через `useSyncExternalStore`), `bindCssVars` переехал в адаптер; тесты контроллера переведены с мока SDK на публикацию в мост. tsc 0 ошибок, 128 unit + 18 e2e зелёные.
- НЕ сделано осознанно (нужна отдельная задача): отказ от загрузки банка на старте. Три экрана (`Dashboard`, `Paywall`, `Results`) используют `questions.length` как знаменатель, а `start*Quiz` синхронны и в трёх тест-файлах получают банк через `setState({ questions: mock })`. Вынос требует async-квери, ленивой загрузки темы по клику и переписывания этих тестов — вне рамок bundle-задачи, эффект только на суммарный вес, не на entry.
- Lazy-load банка: монолит `src/data/questions.json` (143 093 б) разбит на `src/data/questions/{topic}.json` (9 файлов) + `_order.json` (порядок id) + лоадер `index.ts` (dynamic import → отдельный чанк на тему); store грузит банк асинхронно (`loadQuestions(): Promise<void>`), у UI появился loading-gate; tsc 0 ошибок, 128 unit + 18 e2e тестов зелёные; entry 150.21 → 125.22 kB gzip. В e2e пришлось снять гонку: `color-regression` проверял `isVisible()` до появления кнопки темы (loading-gate) и пропускал клик — заменено на ожидание `waitFor`. Грабли: пока монолит лежал рядом, Vite резолвил `@/data/questions` в `questions.json` раньше `questions/index.ts`, и тесты падали с `loadAll is not a function` — коллизию снимает удаление монолита (tsc при этом уже был зелёным).
- Merge text_files: банк 86 → **96**, тема `text_files` закрыта (10 вопросов, домен 1), commit `dd4434d`; L4 — 3 вопроса вернулись с fail и перепроверены после правок стемов (tf_003, tf_006, tf_007); L4.5 — 49 PASS + 1 опровергнутый REJECT (tf_001); Haladyna 10/10 у всех, Jaccard max 0.2250.
- Merge shell_scripts: банк 76 → **86**, домен 2 закрыт впервые (10 вопросов, `sh_001..sh_010`), commit `f54a3dc`; L4.5 10/10 unanimous, Haladyna min 9 / max 10, Jaccard max 0.1429; на L2 исправлены 2 дефекта (нерабочий дистрактор sh_010, лазейка в стеме sh_008).
- Merge networking: банк 66 → **76**, тема `networking` закрыта (10 вопросов, домен 7), commit `cd8e348`; пайплайн L1..L5, Haladyna min 9 / max 10, L4.5 9/10 unanimous 5/5 (net_003 — правка объяснения), Jaccard max 0.1818, cosine SKIPPED.
- Merge security: банк 54 → **66**, тема `security` закрыта (12 вопросов, домен 9).
- Merge running_systems (2026-09-25, recovery): банк 96 → **106**, тема `running_systems` переведена `planned → available` (10 вопросов, `rs_001..rs_010`, домены 6:8 и 3:2), commit `2f2e8b8`; L4.5 — 10/10 accepted, все 5/5 unanimous, 0 REJECT/ABSTAIN; Haladyna min 10 / max 10; option ratio max 1.2667; Jaccard max 0.1667; cosine SKIPPED; QC на банке 106 — Fails 0, Warns 2 (fm_002, fm_003).
- `fix(topics): enable essential_tools and users_groups` — обе темы переведены `planned → available` (до этого UI показывал 47 из 66).
- MAS-аудит 66 вопросов выполнен: `keep 61`, `minor_fix 3`, `major_fix 2`, `retire 0`; `disagreement 2`, `insufficient_data 0`, `critical 0`; `positional_bias` — `all_A=true`, `match 65/66`.
- Пайплайн v2.0 восстановлен и задокументирован (см. ниже).
- Пилот `essential_tools`: 10 черновиков → 7 принятых, 2 отбракованы (`et_008`, `et_010`), 1 в резерве (`et_009`); merged коммитом `258cf8e`.
- Cosine batch-independence fixed (per-text embedding): `ug_003~ug_004` даёт одинаковые 0.7661 при batch 1/2/54.
- Тема light/dark/inherit (DECISION-009..013), логика quizStore (B1 free-gate), UI-подсветка (hover + hex), `questionStats` (persist version 2) — закрыты.
- 128 unit + 18 e2e зелёные (по CONTEXT.md на момент 66 вопросов).

## Восстановленный пайплайн v2.0

8 уровней: **1** Schema → **2** Man verification (Rocky 9.8, цитата man + реальный прогон + `exit_code`) → **2.5** Blueprint alignment → **3** Deterministic QC (`tools/qc.cjs`) → **3.5** Duplicate detection (exact + Jaccard + cosine) → **4** Coherence/ambiguity → **4.5** Multi-agent vote → **4.6** Version-specific (RHEL 8 vs 9) → **5** Item writing (Haladyna).

5 ролей: `sysadmin_10y`, `rhcsa_instructor`, `ex200_examiner`, `beginner`, `skeptic`. Каждая подтверждает проверку прогоном в Rocky 9.8 (`verified: true`); `beginner` имеет право на `ABSTAIN`.

Строгие пороги пилота: length ratio ≤ **1.30**, Haladyna ≥ **8/10**, votes **5/5** (4/5 + ABSTAIN → reject), Jaccard **0.9**, cosine **> 0.80 reject** (в пилоте было 0.85 — мёртвый порог, максимум фона 0.804).

Артефакты: `drafts/pending-<topic>-<date>.json` + `drafts/_votes/<role>.json` (по одному массиву на роль) + `drafts/report-<date>.md`.

## Отклонено (не пробовать)

- Cloudflare Workers/Pages — недоступны в РФ.
- МАС с гомогенными агентами — конформизм 85%, хуже одиночного.
- fs-доступ из workflow-агентов (`readFileSync`/`fs.` внутри скрипта workflow).
- `!important` в inline-стилях — anti-pattern.
- `\b` с кириллицей в JS regex — не работает.
- `Add-Content` в PS 5.1 — даёт UTF-16 BOM.
- `emulateMedia` Playwright для тем — не работает с `data-theme`.
- Cache-busting через query-params — Vite уже content-hashed.
- `ConvertTo-Json` для `calibration.json` — теряет точность/структуру.
- Timers (`setTimeout`/`setInterval`) в workflow-скриптах — недоступны.
- AgentTeams для этого пайплайна — план отклонён; работаем inline per-batch.
- node-driver pipeline (собственный драйвер вместо workflow-инструмента).
- Само-коррекция при `zero_passed` без ревью — понижает критерии.

## Ключевые файлы

| Файл | Назначение |
|---|---|
| `src/data/questions/` | банк 106 вопросов: 10 файлов по темам + `_order.json` (порядок id) + `_topics.json` (счётчики для Dashboard, 289 б) + ленивый лоадер `index.ts`; монолит `questions.json` удалён |
| `src/platform/telegramTheme.ts` | SDK-free мост состояния Telegram-темы: адаптер публикует, `useThemeController` читает через `useSyncExternalStore` — SDK не попадает в entry |
| `src/data/topics.ts` | 14 тем, `TOPICS`/`AVAILABLE_TOPICS`/`PLANNED_TOPICS`; источник валидных topic-ключей для `qc.cjs` |
| `src/store/quizStore.ts` | Zustand-стор: 3 потока (regular/review/exam), `FREE_QUESTION_LIMIT = 5`, persist |
| `src/domain/quizService.ts` | `seedFromId`, `shuffleOptions`, `calculateProgress` (чистые функции) |
| `tools/qc.cjs` | 5 проверок QC: schema, bigram Jaccard > 0.9 FAIL, плейсхолдеры, length ratio > 2.5 WARN, absolute terms WARN |
| `tools/cosine.cjs` | офлайн cosine/Jaccard (`all-MiniLM-L6-v2`, dim 384); `--self-check`, `--intra-batch`; `INTRA_FAIL 0.80` / `INTRA_WARN 0.75` |
| `tools/cosine-calibration.json` | пороги (`fail 0.80`, `warn 0.75`, `jaccard 0.9`), `background_max 0.8085`, `known_exceptions`, `cosine_limitation` |
| `docs/DECISIONS.md` | 13 решений (DECISION-001..013, все 2026-09-22) |
| `docs/HALADYNA.md` | 10 критериев оценки MCQ (адаптация Haladyna 1997), порог приёмки ≥ 8/10 |
| `docs/session-log.md` | append-only журнал сессий |
| `docs/HANDOFF.md` | этот файл — точка входа |
| `docs/CONTEXT.md` | краткий контекст проекта (два среза vulns: Dependabot 52, npm audit 32) |
| `docs/STATE-SNAPSHOT-2026-09-24.md` | полный снапшот состояния, 14 рисков |
| `docs/HANDOFF-2026-09-23.md` | разбор MAS-аудита (findings, ограничение `all_A`) |
| `drafts/pending-*.json` | артефакты партий (схемы разошлись: v2.0 / v4.4 / v4.5) |
| `drafts/_votes/*.json` | голоса 5 ролей (211 файлов: `essential_tools`, `networking`, `running_systems`, `shell_scripts`, `text_files`) |
| `drafts/audit-mas-2026-09-23.json` | результат MAS-аудита: 66 findings + `counts` + `positional_bias` |

## Долги по докам

- `docs/session-log.md`: пропуски — есть сессии 6, 7, 8, 9, 10, 12; **сессии 11 нет** — решить (восстановить или пометить как утрачено).
- `docs/CONTEXT.md`: два среза vulns — Dependabot 52 ≠ npm audit 32 (не «устарело»); открытый пункт «L5c intra-batch» числится незакрытым, хотя код и тесты в проде.
- `docs/content-generation-20260921-1403.md`: утверждает, что у 5 унаследованных записей нет `objective_domain`/`subtopic` — это состояние ДО Step 6/merge; в текущем банке поля есть у всех 66.
- `docs/HANDOFF-2026-09-23.md` ссылается на `.tmp-audit/` (консенсус-скрипт и raw-результаты) — каталог в `.gitignore` и не закоммичен, ссылки невоспроизводимы из репозитория.

## Метавыводы

Из `docs/HANDOFF-2026-09-23.md`:

1. `is_critical = 0` — метрика вырождена, потому что в банке все 66 ключей в позиции A; «совпадение ответа» здесь отражает позиционное согласие, а не знание.
2. Реальные разногласия голосов — `fp_005` и `fp_012`; оба дали `major_fix` при расхождении вердиктов, ключ при этом верен.
3. Вопросы с `man_unavailable=true` непроверяемы по построению (`fm_008`): пять ролей вернули `unknown`/`minor_fix` с confidence 0.43 — особый случай сработал, но вопрос требует man или замены.
4. Транспорт воркфлоу ограничен: возврат значения усекается харнессом, поэтому результат нужно писать на диск по батчу, а не одним прогоном на 11 батчей.
5. Схемы артефактов между пилотом и прод-пайплайном разошлись — единого формата `pending-*.json` нет.

Новый метавывод из `docs/STATE-SNAPSHOT-2026-09-24.md`: снапшот зафиксировал **14 рисков**, из них **5 попали в P0** (банк до 160+, токен бота, option shuffle на уровне данных, bundle gzip > watch, npm audit 1 critical + 20 high) — то есть больше четверти зафиксированных проблем блокирующие, а не «качество».

## Дата и провенанс

HANDOFF собран 2026-09-24 из `docs/STATE-SNAPSHOT-2026-09-24.md` (SHA1 `B59A1986BEF00B07E9A1B6FAC22A2E198CA5775D`).

При расхождении HANDOFF и снапшота — верить снапшоту.
