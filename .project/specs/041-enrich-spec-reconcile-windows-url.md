---
id: 041
slug: enrich-spec-reconcile-windows-url
type: infra
status: done
commit: 4027b8a
---

# Spec 041 — enrich-spec: reconcile contract + Windows spawn + URL validation

## Контекст
Phase C (smoke test `enrich-spec.mjs` на живом `dsh --profile headless`) дала
вердикт **PARTIAL 4/5**. Отчёт: `.project/agents/orchestrator-report.md`;
финальная обогащённая спека: `.project/drafts/smoke-enrich-result.md`
(untracked, evidence — не коммитить, не удалять).

Что подтверждено живым прогоном: Phase 2 реально вызывает модель, ищет в
интернете и обогащает спеку. Изолированный прогон `--max-iterations 2`:
baseline 86/100 → 97/100, **delta +11**, маркеров `[enriched:` с URL 0 → 19.
Полный прогон Phase C занял ~45 мин при живом dsh.

Что блокирует Фазу D (пресет): дефолтный `node .project/scripts/enrich-spec.mjs <spec>`
без `--llm-cmd` не работает на Windows. Найдено 6 дефектов; **S1 и S2
блокируют Фазу D**.

Дерево после Phase C восстановлено, правок в код не вносилось:
`HEAD` = `origin/main` = `7d8c28d`, ahead 0.

## Цель
Устранить:

- **S1** — модель обходит JSON-контракт (работает нативными Read/Write/Edit),
  CLI видит `sources: []`, `edits: []` и не имеет traceability правок;
- **S2** — `spawnSync('dsh', …)` даёт `ENOENT` на Windows (шимы только
  `.cmd`/`.ps1`), прямой `dsh.cmd` — `EINVAL`;
- **S3** — URL не валидируются (Фаза 3 нашла галлюцинированный домен
  `developer.typescripts.org` → 403 и мёртвую ссылку
  `cmu-313.github.io/.../17-pbt.pdf` → 404);
- **S4** — метрика улики замыкается CLI-инъекцией маркера;
- **S5** — нет проброса `DEEPSEEK_API_KEY` в `childEnv`;
- **S6** — `resolveSpec` не ищет в `.project/drafts/`.

Критерий успеха: `node .project/scripts/enrich-spec.mjs <spec>` **без
`--llm-cmd`** работает на Windows на живом `dsh --profile headless`
с полной traceability правок в `run-log.jsonl`.

## Что делаем

### S1 — Reconcile-контракт (архитектурный)
Модель в headless использует нативные инструменты Read/Write/Edit и правит
спеку напрямую; CLI видит `sources: []`, `edits: []`. Fix: CLI снимает SHA
файла спеки до/после каждой edits-фазы (2, 3, 5, 9), считает diff hunks,
синтезирует `applied_edits[]` для run-log. Read-only фазы (6, 7, 8, 10) —
нативный JSON как есть.

Контракт ответа модели уточняется: модель ОБЯЗАНА вернуть JSON с полями
`{phase, status, model, summary, sources[], findings[], reason_per_hunk[]}`.
Поле `edits[]` в ответе остаётся опциональным — если пусто, CLI строит
`applied_edits[]` из diff; если непусто, применяет через существующий
`applyEdits`. `reason_per_hunk` сопоставляется с hunks по порядку.

Intent-guard Фаз 2, 3, 5 распространяется через diff: если hunks
пересекает «## Цель» или «## Критерии приёмки» — правка откатывается,
фаза получает warn, finding класса m11/m13 в report (как сейчас для Фазы 9).

### S2 — Windows spawn
Заменить `spawnSync(cmd, [...args, promptAbs])` на:
1. Резолв команды: если cmd содержит `.cmd`/`.bat`/`.ps1` — через
   `where cmd` получить полный путь.
2. Запуск через `spawnSync('cmd.exe', ['/d', '/s', '/c', fullPath, ...args, promptAbs])`.
3. **НЕ использовать `shell: true`** (shell-injection risk через `--llm-cmd`).
4. Для `node bin.js` путь остаётся как есть.

Тест: 3 сценария — голый `dsh` (резолвится в `.cmd`), `dsh.cmd` (явно),
`node bin.js`.

### S3 — URL validation
В CLI (не в SKILL.md) добавить шаг после Фазы 2: для каждого URL из
`sources[]` — HEAD-запрос (Node fetch, timeout 5 сек). Классификация:
`200/301/302` → ok; `403` → существует, но запрещает (warn);
`4xx/5xx/timeout` → dead.

Мёртвый URL: помечать маркер `[enriched: URL|tier|дата|unverified]` и
finding `{severity: medium, phase: 3-factcheck, evidence: 'dead URL',
requiredFix: 'replace or remove'}`. Правка **НЕ откатывается** (менее
деструктивно, чем rollback), но фиксируется в `report.md` разделе
«URL validation».

### S4 — Метрика улики (документация)
`SKILL.md` Фаза 2 шаг 8: заменить «есть ли `[enriched:` в спеке» на
«delta количества URL относительно `spec-original.md`». Проверка в отчёте
Фазы 2: `urls_in_final - urls_in_original ≥ 1` (было 0 → стало N).

### S5 — API key
Скопировать из `run-spec.mjs` (spec 035): `resolveApiKeyFromSystem`,
`resolveApiKey`, проброс `DEEPSEEK_API_KEY` в `childEnv` при `source=user-scope`.

### S6 — resolveSpec + drafts
Добавить `.project/drafts/` в корни поиска (второй приоритет после
`.project/specs/`).

## Декомпозиция
1. id: t1, subject: enrich-spec.mjs — S1 (reconcile: SHA-снимки для Фаз 2, 3, 5, 9
   + синтез applied_edits[] + intent-guard через diff для Фаз 2, 3, 5),
   S2 (spawn через cmd.exe /d /s /c), S3 (HEAD-проверка URL с timeout 5с
   + classification ok/warn/dead + маркер unverified), S5 (resolveApiKey + childEnv),
   S6 (drafts в resolveSpec); assignee: builder, dependencies: []
2. id: t2, subject: SKILL.md (spec-enrich) — S4 (метрика delta URL в Фазе 2 шаг 8)
   + документация S1 (reconcile-контракт: reason_per_hunk[], applied_edits[]
   синтезируется CLI) + документация S3 (unverified маркер, findings medium);
   assignee: builder, dependencies: [t1]
3. id: t3, subject: qc — ratification by re-execution: живой прогон
   `node .project/scripts/enrich-spec.mjs smoke-enrich-test --max-iterations 2`
   без `--llm-cmd`; проверить `run-log.jsonl`: `model != null`,
   `applied_edits[]` непусто на Фазе 2; тест S3 на фикстуре с одним мёртвым URL;
   assignee: qc, dependencies: [t1, t2]
4. id: t4, subject: reviewer — финальное ревью t1–t3; verdict=pass;
   assignee: reviewer, dependencies: [t3]

## Write-скоупы
  t1 → .project/scripts/enrich-spec.mjs
  t2 → docs/spec-chain/skills/spec-enrich/SKILL.md
  t3 → read-only (отчёты в .project/drafts/spec-041-qc/)
  t4 → read-only (отчёт reviewer)

t1 и t2 связаны зависимостью (t2 deps [t1]): контракт reconcile, который t2
документирует, сначала фиксируется кодом.

## Edge Cases
- **S1:** если модель возвращает и JSON `edits[]`, и правит напрямую —
  приоритет JSON `edits[]` (детерминированнее), diff игнорируется.
- **S1:** если SHA спеки не изменился, но модель вернула непустое `edits[]` —
  WARN, finding о рассинхронизации (модель заявила, но не сделала).
- **S2:** если `where dsh` не находит `.cmd` — fallback на существующее
  поведение + WARN «resolved: false, попробуйте --llm-cmd».
- **S3:** сеть недоступна → все URL помечаются UNVERIFIABLE, фаза warn,
  не hard-fail.
- **S5:** API key в env — приоритет; в User-scope — fallback; отсутствует —
  WARN (не блокер, существующее поведение).
- **S6:** если `.project/drafts/` тоже не содержит спеку — exit 2 с
  подсказкой обоих путей.
- **Фикстура для t3:** `.project/drafts/smoke-enrich-test.md` (расширенная,
  проходимая по Фазе 4 — та же, что в Phase C). Для теста S3 добавить в неё
  одну секцию «Источники» с одним битым URL
  (например, `https://nonexistent.invalid/`).
- Прогон t3 в off-peak (после 20:00 Хабаровск = 10:00 UTC) для экономии 50%.

## Критерии приёмки
1. `node .project/scripts/enrich-spec.mjs smoke-enrich-test --max-iterations 2`
   без `--llm-cmd` — exit 0;
   `Select-String -Path .project/drafts/spec-099-enrich/run-log.jsonl -Pattern '"model":"'`
   → ≥ 1 совпадение с непустым значением (S2).
   Прогон ≤ 20 мин на 2 итерации.
2. `node -e "const l=require('fs').readFileSync('.project/drafts/spec-099-enrich/run-log.jsonl','utf8').split('\n').filter(Boolean).map(JSON.parse); const p2=l.find(x=>x.phase==='2-research'); console.log(p2&&Array.isArray(p2.applied_edits)&&p2.applied_edits.length>0)"`
   → true (S1).
3. На фикстуре с битым URL: `report.md` содержит раздел «URL validation»
   с классификацией dead; финальная спека содержит
   `[enriched: https://nonexistent.invalid/|Tier X|<date>|unverified]` (S3).
   Файл фикстуры `.project/drafts/spec-041-qc-fixture-with-bad-url.md`
   создаётся t3 в его write-scope (read-only → создать перед прогоном,
   удалить после).
4. `node .project/scripts/enrich-spec.mjs smoke-enrich-test --dry-run` →
   exit 0 (не 2), `resolveSpec` находит в `.project/drafts/` (S6).
5. `Select-String -Path docs/spec-chain/skills/spec-enrich/SKILL.md -Pattern 'delta.*URL.*spec-original'`
   → ≥ 1 совпадение (S4).
6. `Select-String -Path .project/scripts/enrich-spec.mjs -Pattern 'resolveApiKey|DEEPSEEK_API_KEY'`
   → ≥ 2 совпадения (S5).
7. `npm run typecheck` → 0; `npm run test:run` → 0; `npm run sync:check` → 0.
8. qc verdict=pass; reviewer verdict=pass (ратификация by re-execution:
   qc/ревьюер перезапускают критерии 1–6 лично).

Критерии 7–8 — внешние гейты вне DAG (эквивалент «внешний владелец» Фазы 4).

## Что НЕ трогать
- `.project/scripts/validate-spec.mjs` (правки в нём → STOP, отдельная спека)
- `.project/scripts/run-spec.mjs`, `close-spec.mjs`, `check-consistency.mjs`
- `.project/sync.mjs`
- `src/**`, `tools/**`
- Спеки 028–040
- `docs/spec-chain/skills/run-spec-chain/SKILL.md`
- `docs/spec-chain/README.md`
- `docs/spec-chain/agent.cordis.yml`
- `~/.dsh/.agent-presets/**` (операция капитана)

## STOP-условия
- `sync:check != 0` → STOP.
- S1 требует правки исходников `validate-spec.mjs` (не просто вызова) →
  STOP, отдельная спека.
- S1 требует изменения рубрики Фазы 0 (веса, порог) → STOP, отдельная спека.
- S2 fix требует `shell: true` → STOP, искать альтернативу.
- Фикстура не проходит гейт Фазы 4 → не дефект enrich, зафиксировать
  и расширить фикстуру до проходимой (не искать причину в enrich).

## Отчёт капитану
- diff `enrich-spec.mjs`: отдельно по S1, S2, S3, S5, S6.
- S1: SHA спеки до/после Фазы 2 из run-log + число hunks в `applied_edits[]`.
- S2: сырой stdout/stderr трёх сценариев spawn (голый dsh, dsh.cmd, node bin.js).
- S3: тестовый битый URL, поведение (unverified + finding), фрагмент из `report.md`.
- S4, S5, S6: закрыты/не закрыты, с доказательством grep.
- Список пройденных критериев 1–8 с exit-кодами.

## Push не выполнять (правило 10/11).
