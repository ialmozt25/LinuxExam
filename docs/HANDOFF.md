# LinuxExam — HANDOFF

> Точка входа для новых сессий. Читать ПЕРВЫМ.
> Обновляется в конце каждой сессии.

## Идентификация проекта

| Параметр | Значение |
|---|---|
| Репо | `C:\Users\Alexey Udotov\LinuxExam` |
| GitHub | `github.com/ialmozt25/LinuxExam` (публичный) |
| Прод | https://ialmozt25.github.io/LinuxExam/ |
| HEAD | `fe49e10` (`fe49e104b2575b74ec3e4854c546222ab2344cbf`), `docs: log topics status fix (session 12)`, 2026-09-23 22:12:32 +1000 |
| Ветка / upstream | `main` / `origin/main`, ahead/behind `0/0` |
| История | 86 коммитов |
| Банк | 66 вопросов, 66 уникальных id, 0 невалидных, 54 сабтопика |
| Разбивка по темам | `file_permissions` 12, `file_management` 12, `users_groups` 12, `security` 12, `process_management` 11, `essential_tools` 7 |
| Домены (objective_domain) | 1:13, 2:**0**, 3:5, 4:2, 5:4, 6:3, 7:15, 8:1, 9:23 (все 66 записей имеют валидный домен) |
| topics.ts | 6 available / 8 planned; у всех planned — 0 вопросов |
| Bundle gzip | `dist/assets/index-CcJwThrt.js` = **138.77 kB** (raw 456.38 kB), CSS 2.70 kB; watch-порог **>137 kB → стоп** |
| Стек | React `^18.3.1`, Vite `^5.4.2`, TypeScript `^5.5.3`, Zustand `^5.0.15`, Tailwind `^3.4.1`, motion `^13.4.0`, @telegram-apps/sdk `^3.11.8`, lucide-react `^0.446.0`; Node `v24.13.0`, npm `11.6.2` |
| Дата снапшота | 2026-09-24 |
| Дата сборки HANDOFF | 2026-09-24 |

## Правила работы

1. 1 задача = 1 сессия. Не смешивать.
2. Pre-read: HANDOFF + session-log (3) + DECISIONS.
3. Guard 500K токенов контекста.
4. Не пушить без ahead=1 и явного одобрения.
5. Атомарные коммиты (1 симптом = 1 коммит).
6. Rocky 9.8 WSL2 — источник истины для man.
7. Субагентам запрещён pwsh/man.
8. questions.json не менять без явного одобрения.

## СТОП-ПРАВИЛА

- Стоп-1: мысль «проверим промпт ещё раз» → отклонить.
- Стоп-2: fs-доступ из workflow-агентов → отклонить.
- Стоп-3: > 2 итераций на артефакт → заморозить.
- Стоп-4: > 30% бюджета на «оптимизацию» → режим исполнения.
- Стоп-5: только minor findings в 2 батчах подряд → стоп аудит.

## Состояние на 2026-09-24

- HEAD `fe49e10`, ветка `main`, upstream `origin/main`, ahead/behind **0/0**, 86 коммитов.
- Банк **66** вопросов: `file_permissions` 12, `file_management` 12, `users_groups` 12, `security` 12, `process_management` 11, `essential_tools` 7. Уникальных id 66, невалидных 0.
- `topics.ts`: 6 available / 8 planned; у всех planned тем — 0 вопросов в банке.
- Bundle gzip **138.77 kB** при watch-пороге `>137 kB → стоп` — **красный флаг**.
- `npm audit`: **32** уязвимости — 1 critical, 20 high, 8 moderate, 3 low (564 зависимости).
- Cosine: `background_max` **0.8085**, threshold **0.80**, margin **−0.0085**, class inversion на русском; `threshold_warning` требует L5c-ревью перед приёмкой батча.
- `tools/qc.cjs`: length ratio — только `WARN > 2.5`, тогда как пилот v2.0 отбраковывал при `> 1.30` (осознанное расхождение, не баг).
- Все 66 правильных ответов в хранилище стоят в позиции A (`allCorrectAtPos0: true`); рендер маскирует это детерминированным шаффлом.
- `docs/HANDOFF.md` до этой сессии отсутствовал; каноническая точка входа — этот файл.

## Открытые задачи

### P0 (блокеры)

- Наполнение банка до 160+ (8 planned-тем без вопросов).
- Токен `@linux_exam_bot` отозван — перевыпустить.
- Option shuffle: все 66 ответов на позиции A на уровне данных (рендер перемешивает через `shuffleOptions` + seed, но банк вырожден для аудита).
- Bundle gzip 138.77 kB > 137 kB watch — резать (lazy-load `questions.json`).
- `npm audit`: 1 critical + 20 high — обновить deps.

### P1 (качество)

- Правки `major_fix` из MAS-аудита: `fp_005`, `fp_012`.
- Ужесточить L8 (мягкий чеклист).
- Привести QC length ratio к пилотному порогу 1.30 (сейчас 2.5).
- Type-safety: `Topic` знает 3 темы при 6 в банке; убрать `as`-каст в `fromJson` (F-6 в `docs/AUDIT.md`).
- Унифицировать схему `drafts/pending-*` (v2.0 → v4.4 → v4.5, у security нет блока `validation`).
- Cosine margin −0.0085 — решить L5c-ревью перед приёмкой батча.
- Домен 2 (shell scripts) — 0 вопросов.

### P2 (инфраструктура)

- Приватность репо.
- Cosine-модель русскоязычная (`cointegrated/rubert-tiny2`).
- Устаревшая цифра «52 vulns» в `docs/CONTEXT.md` — привести к 32.

### P3 (nice-to-have)

- `retired.json`, monthly re-verify, feedback endpoint, PDF/CSV.

## Что закрыто (не переделывать)

- Merge security: банк 54 → **66**, тема `security` закрыта (12 вопросов, домен 9).
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
| `src/data/questions.json` | банк, 66 вопросов (98 233 байта); бэкап `questions.json.bak` (4 522 байта) |
| `src/data/topics.ts` | 14 тем, `TOPICS`/`AVAILABLE_TOPICS`/`PLANNED_TOPICS`; источник валидных topic-ключей для `qc.cjs` |
| `src/store/quizStore.ts` | Zustand-стор: 3 потока (regular/review/exam), `FREE_QUESTION_LIMIT = 5`, persist |
| `src/domain/quizService.ts` | `seedFromId`, `shuffleOptions`, `calculateProgress` (чистые функции) |
| `tools/qc.cjs` | 5 проверок QC: schema, bigram Jaccard > 0.9 FAIL, плейсхолдеры, length ratio > 2.5 WARN, absolute terms WARN |
| `tools/cosine.cjs` | офлайн cosine/Jaccard (`all-MiniLM-L6-v2`, dim 384); `--self-check`, `--intra-batch`; `INTRA_FAIL 0.80` / `INTRA_WARN 0.75` |
| `tools/cosine-calibration.json` | пороги (`fail 0.80`, `warn 0.75`, `jaccard 0.9`), `background_max 0.8085`, `known_exceptions`, `cosine_limitation` |
| `docs/DECISIONS.md` | 13 решений (DECISION-001..013, все 2026-09-22) |
| `docs/session-log.md` | append-only журнал сессий |
| `docs/HANDOFF.md` | этот файл — точка входа |
| `docs/CONTEXT.md` | краткий контекст проекта (содержит устаревшую цифру vulns) |
| `docs/STATE-SNAPSHOT-2026-09-24.md` | полный снапшот состояния, 14 рисков |
| `docs/HANDOFF-2026-09-23.md` | разбор MAS-аудита (findings, ограничение `all_A`) |
| `drafts/pending-*.json` | артефакты партий (схемы разошлись: v2.0 / v4.4 / v4.5) |
| `drafts/_votes/*.json` | голоса 5 ролей по пилоту `essential_tools` |
| `drafts/audit-mas-2026-09-23.json` | результат MAS-аудита: 66 findings + `counts` + `positional_bias` |

## Долги по докам

- `docs/session-log.md`: пропуски — есть сессии 6, 7, 8, 9, 10, 12; **сессии 11 нет** — решить (восстановить или пометить как утрачено).
- `docs/CONTEXT.md`: устаревшие данные — «52 уязвимости» (фактически 32), открытый пункт «L5c intra-batch» числится незакрытым, хотя код и тесты в проде.
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
