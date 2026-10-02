---
id: 048
slug: fast-track-obs-tester
status: done
type: infra
track: full-enrich-skip
created: 2026-10-02
updated: 2026-10-02
commit: 3aaa494
embedded_approve: rule 2 (исключение F5.0a — явная формулировка капитана 2026-10-02: «EMBEDDED APPROVE (rule 2): spec 048 → approved после создания», задание повторено с компонентом 4 в том же дне); rule 13 (исключение — правка .project/ORCH-RULES.md, правило 17, названа капитаном явно и по существу); rule 6 не применяется — type: infra
commit_format: "docs(spec-048): OBS-1 volatile agents pulse + Fast track + Playwright tester + vitest exclude"
---

> **M6.0 — инфраструктура spec-фабрики: OBS-1, трек Fast, Playwright-тестер в цепочке,
> структурный фикс гейта `test:run`.** Спека создана по прямому заданию капитана
> 2026-10-02 с embedded approve: правило 2 (исключение F5.0a) — перевод в `approved`
> явной формулировкой капитана; правило 13 (исключение) — правка
> `.project/ORCH-RULES.md` (правило 17, третий трек) названа капитаном явно и по
> существу. Тип `infra`: правило 6 (approve превью) к самой спеке не применяется.
>
> Трек прогона — **`full-enrich-skip`**: контур Full (правило 17: `.project/ORCH-RULES.md`
> и `.project/sync.mjs` — зоны Full), но `enrich` **пропускается** по прямому решению
> капитана (задание 2026-10-02; прецедент spec 043 — капитан вправе назначить контур
> прогона явной формулировкой). Трек **Fast** вступает в силу с spec 049 и к самой
> 048 не применяется: здесь он только документируется.

## Контекст

Четыре независимых дефекта контура, каждый подтверждён фактом в репозитории.

**OBS-1 — «Пульс агентов» вне VOLATILE-маркеров.** Секция `class="agents" id="agents"`
в `renderCenter()` (`.project/sync.mjs`, строки 2123-2127) рендерит **live**-данные
`.agent-teams/<teamId>/team.json`: статусы задач и состав агентов живой команды.
В отличие от соседних блоков (таблица коммитов, строки тетрадей, строка уведомлений)
эта секция **не** обёрнута маркерами `<!--volatile:start-->` / `<!--volatile:end-->`,
поэтому побайтовый `node .project/sync.mjs --check` дрожит от смены статусов задач
команды — при полностью корректных производных.

Дефект зафиксирован в четырёх местах и до сих пор числился «кандидатом в отдельную
спеку»:

- `docs/memory/working.md:103` — наблюдение **N3** приёмки spec 038;
- `docs/memory/episodic.md:149,184` — «`sync:check` — **2 в живом прогоне** (ожидаемо:
  не-volatile секция «Пульс агентов» считается по `.agent-teams/*/team.json`,
  `sync.mjs:968-1066`)»; изоляция в трёх worktree на `b3f9b25`;
- `docs/memory/alerts.md:8` — запись про тот же блок;
- `docs/C0-CENTER-AUDIT.md:47,195` — разбор блока `agents` в аудите центра.

Практическая цена: каждый живой прогон MAS делает `sync:check` красным, и гейт
зеленеет только после архивации команды. Именно поэтому гейт прогона обязан
перестать зависеть от live-состояния `.agent-teams/**`.

**Трек Fast.** Правило 17 (редакция spec 047) знает два трека — Small и Full.
Капитан добавляет третий: **Fast** — для `type: infra`/`type: content` с явными
требованиями капитана, `enrich` пропускается, MAS обязателен, после MAS —
обязательный Playwright-прогон. Вступает в силу с spec 049.

**Тестер в цепочке.** `docs/spec-chain/skills/run-spec-chain/SKILL.md` сегодня
знает четыре STOP-точки (A, B, D, C) и не содержит обязательного E2E-шага: прогон
может закрыть `type: feature`/`type: ui` спек без единого прогона Playwright.
Капитан требует: для `type=feature/ui` — **обязательный Playwright CLI** (не MCP)
после MAS и до `spec:close`. Пресет `~/.dsh/.agent-presets/linuxexam-spec-chain`
(включая `roster.yaml`) правит **капитан вручную** — агент только докладывает точные
строки для правки (см. раздел «Правка пресета (капитан)»).

**Гейт `test:run` ломается от посторонней сборки.** Базовая линия перед прогоном:
`npm run typecheck` → 0, `npm run sync:check` → 0, а `npm run test:run` → **1**.
Падал ровно один файл из 29 — `.project/drafts/test-runs/spec-043-batch6.spec.ts`:
Playwright-спека, оставшаяся от ручной E2E-верификации spec 043 (untracked, создана
2026-10-02 15:39). Vitest её собирал, потому что `vitest.config.ts` исключает только
`e2e/**`; 198 тестов при этом проходили. Закрыто двусторонне: разовая изоляция
leftover (rename в `.spec.ts.bak`, шаг 1 задания капитана) **и** структурный фикс —
исключение технических каталогов в `vitest.config.ts`, чтобы любой следующий
черновик в `.project/drafts/**` не мог уронить гейт.

Порядок работ (правило 3): правки файлов → `npm run sync` → `git add` → коммит →
`npm run sync:check`.

## Цель

Закрыть OBS-1 (VOLATILE-маркеры вокруг «Пульса агентов»), зафиксировать в правиле 17
и в Шаге 0 скилла третий трек **Fast**, сделать Playwright-CLI-прогон обязательным
шагом цепочки для `type=feature/ui` и убрать технические каталоги из сборки Vitest —
так, чтобы живой прогон AgentTeams перестал ломать `sync:check`, E2E-гейт перестал
быть необязательным, а `test:run` перестал зависеть от черновиков в дереве.

## Что делаем

Правки ровно в четырёх файлах репозитория, аддитивные; `enrich` не запускается
(прямое решение капитана).

**1. `.project/sync.mjs` — обернуть «Пульс агентов» в VOLATILE (OBS-1)**

В `renderCenter()` секция агентов (строки 2123-2127) принимает вид по образцу
соседних блоков (ср. строки 2082-2084, 2092, 2098):

```js
  <section class="agents" id="agents">
${VOLATILE.start}
    <h2>Пульс агентов</h2>
    <div class="muted">Источник: <code>.agent-teams/*/team.json</code> · команд: ${agentsDoc.teams.length}</div>
${agentsHtml}
${VOLATILE.end}
  </section>
```

Над секцией — короткий комментарий в стиле соседних пояснений (строки 1633, 1855,
1877-1880) с указанием причины: блок читает live `.agent-teams/*/team.json`, меняется
от статусов задач, а не от правки источников, и без маркеров ломает побайтовый
`--check` (spec 022/034/038; OBS-1, spec 048). Рендеримый HTML **не** меняется:
маркеры — HTML-комментарии внутри `<section>`, `--check` их маскирует.

**2. `.project/ORCH-RULES.md`, правило 17 — третий трек Fast** и
**`docs/spec-chain/skills/run-spec-chain/SKILL.md`, Шаг 0 — ветка Fast**

В правиле 17 добавляется определение трека со всем обязательным содержанием:

- **Fast** — быстрый капитанский трек: `enrich` **пропускается** (требования заданы
  капитаном полностью), MAS обязателен, после MAS и **до** закрытия спеки —
  обязательный прогон Playwright;
- условия допуска: тип спеки `infra` или `content`; требования в задании капитана
  **явные и полные** (критерии приёмки не требуют research/enrich); трек называет
  капитан **явной формулировкой** — агент трек Fast сам не выбирает и не выводит
  его из размера диффа;
- для `type:content` правило 6 сохраняется: превью и approve капитана (STOP-точка D)
  остаются обязательными и на треке Fast;
- инвариант правила 17 приводится в соответствие: `type:feature` — **всегда Full**;
  `type:content` — Full или Fast (но **не** Small);
- эскалация: `Small → Fast/Full` и `Fast → Full` разрешены; понижение
  `Full → Small/Fast` запрещено;
- строка о вступлении в силу: трек Fast действует **с spec 049**; сама 048 идёт
  треком Full с пропущенным `enrich` по прямому решению капитана.

Заголовок раздела `## 17. Двухтрековый режим` **не переименовывается** (на него
ссылаются `.project/specs/README.md` и исторические спеки); вместо переименования
добавляется одна строка-пояснение, что раздел сохраняет историческое имя, а с 048
определяет три трека — Small, Fast, Full.

В Шаге 0 скилла (`### Шаг 0 — Классификация Small/Full`) добавляется
`**Ветка Fast.**` с тем же обязательным содержанием, и строка про развилку в блоке
«Карта цепочки» дополняется треком Fast. Таблица порога Шага 0 (порог по диффу)
не переписывается: Fast, в отличие от Small/Full, назначается капитаном, а не
выводится из диффа.

**3. `docs/spec-chain/skills/run-spec-chain/SKILL.md` — обязательный Playwright CLI
для `type=feature`/`type=ui`**

Новый подшаг **`### Шаг 4b — Playwright E2E (обязателен для type: feature / type: ui)`**
после Шага 4a и перед Шагом 5:

- предусловие: `npx playwright install chromium` (chromium-only — `AGENTS.md`);
- команда: `npm run test:e2e` — **Playwright CLI**, не MCP;
- **Playwright MCP запрещён**: гейт требует воспроизводимого exit-кода и артефакта
  прогона в репозитории; MCP-сессия не оставляет ни того, ни другого в evidence;
- гейт: `npm run test:e2e` → exit 0. `≠ 0` → STOP, Шаг 5 не начинать;
- evidence: exit-код + артефакты прогона (`test-results/**`, отчёт Playwright);
- дополняются: таблица «Маппинг» (строка-дополнение по образцу Шага 4a), таблица
  «Крайние случаи», раздел «Что не делать» и «Критерий приёмки прогона».

**4. `vitest.config.ts` — исключить технические каталоги из сборки Vitest**

В `exclude` секции `test` (строка 21) добавляются два паттерна — рядом с уже
существующим `e2e/**` и с сохранением `...configDefaults.exclude`:

```ts
    exclude: [...configDefaults.exclude, 'e2e/**', '.project/drafts/**', '.agent-teams/**'],
```

Смысл: `.project/drafts/**` — черновики прогонов (там и лежал уронивший гейт
Playwright-файл), `.agent-teams/**` — live-состояние команд AgentTeams. Ни один из
каталогов не содержит тестов приложения; их сборка Vitest — чистый побочный эффект
дефолтного `include`. Комментарий над строкой объясняет, что исключение защищает
гейт `test:run` от посторонних файлов в дереве (spec 048). Правка — **только строка
`exclude`** (плюс комментарий); остальной файл не меняется.

## Критерии приёмки

1. **OBS-1 (код).** Содержимое секции `class="agents" id="agents"` в `docs/index.html`
   целиком накрыто VOLATILE-маркерами: заголовок «Пульс агентов» внутри секции
   присутствует, а после свёртки маркеров внутри секции не остаётся ничего, кроме
   пробелов. Проверка **скоупится секцией**: строка «Пульс агентов» в других,
   не-volatile блоках центра (записи решений `.project/log.md` и тревог
   `docs/memory/alerts.md`) глобальную проверку не ломает → проверка 1 блока
   «Проверка» → exit 0.
2. **OBS-1 (гейт).** `node .project/sync.mjs --check` → exit 0 **при живой команде**
   `.agent-teams/spec-048-*/team.json` → проверка 2 → exit 0.
3. **OBS-1 (рендер не потерян).** В `docs/index.html` секция `class="agents" id="agents"`
   присутствует и содержит заголовок «Пульс агентов» и карточки команд → проверка 3
   → exit 0.
4. **Правило 17 — трек Fast.** В разделе правила 17 есть трек Fast со всеми
   обязательными свойствами: `enrich` пропускается, MAS обязателен, Playwright после
   MAS до закрытия, «явные требования капитана», вступление в силу с 049, приведённый
   инвариант для `type:content`/`type:feature` → проверка 4 → exit 0.
5. **Шаг 0 — ветка Fast.** В `docs/spec-chain/skills/run-spec-chain/SKILL.md` между
   `### Шаг 0` и `### Шаг 1` есть ветка Fast с теми же свойствами → проверка 5 → exit 0.
6. **Playwright CLI в цепочке.** В скилле есть подшаг про `type: feature`/`ui`:
   Playwright, CLI, запрет MCP, `npx playwright install chromium`, `npm run test:e2e`,
   режим отказа STOP → проверка 6 → exit 0.
7. **Vitest не собирает технические каталоги.** В `vitest.config.ts` в `exclude`
   присутствуют `.project/drafts/**` и `.agent-teams/**` (при сохранённом
   `...configDefaults.exclude` и `e2e/**`), и это подтверждено эмпирически: файл-ловушка
   под `.project/drafts/**` в выводе `npx vitest list` не появляется → проверка 7 → exit 0.
8. **Пресет не тронут.** `~/.dsh/.agent-presets/**` в этом прогоне не менялся
   (правка — операция капитана); в спеке и отчёте перечислены **точные строки** для
   `roster.yaml` → проверка 8 → exit 0.
9. **Playwright E2E (t6).** `npx playwright install chromium` → exit 0;
   `npm run test:e2e` → exit 0 (chromium) → проверка 9 → exit 0.
10. **Ревью (t5).** Задача t5 (роль `reviewer`) → `verdict=pass` → проверка 10 → exit 0.
11. **Гейты и EOL.** `npm run typecheck` → 0; `npm run test:run` → 0; `npm run sync:check`
    → 0 после коммита производных; правки `.md`/`.mjs` в LF
    (`git ls-files --eol` → `i/lf w/lf`, правило 16) → проверка 11 → exit 0.
12. **Закрытие и память.** `npm run spec:close -- 048` → exit 0: frontmatter
    `status: done`, запись в `docs/memory/episodic.md`, строка в `.project/log.md`;
    **отдельной строкой** — решение про overflow 25 > 22 по теме `deploy_systems`
    (spec 043) → проверка 12 → exit 0.

## Что НЕ трогать

- `~/.dsh/.agent-presets/**` — пресет (`roster.yaml`, рабочая копия скилла): операция
  капитана; агент только докладывает строки.
- `.project/specs/README.md` — индексная документация папки спеков (правит капитан).
- `.project/specs/0*.md` — карточки других спеков (включая закрытые).
- `.project/state.json`, `.project/contracts/**`, `.project/scripts/**`, `package.json`,
  `tools/**`.
- `src/**`, `e2e/**` — новых E2E-тестов не пишем: t6 гоняет существующий набор
  (`npm run test:e2e`), состав `e2e/` не меняется.
- `vitest.config.ts` — меняется **только** строка `exclude` (два новых паттерна) и
  комментарий к ней; `include`, `environment`, `setupFiles` и плагины не трогаются.
- `.project/drafts/**` — черновики не правим; единственное действие в этом каталоге —
  разовая изоляция leftover из шага 1 задания капитана (rename
  `spec-043-batch6.spec.ts` → `spec-043-batch6.spec.ts.bak`, уже выполнено
  оркестратором до старта MAS).
- `docs/spec-chain/skills/spec-enrich/SKILL.md`,
  `docs/spec-chain/skills/spec-to-team/**`, `docs/spec-chain/README.md`.
- `enrich` не запускается (`npm run spec:enrich` в этом прогоне не вызывается).
- Push не выполняется (правила 10/11) — отдельная per-command авторизация капитана.

## Декомпозиция

1. `id: t1` · `subject: OBS-1 — обернуть секцию «Пульс агентов» в renderCenter (.project/sync.mjs) в VOLATILE-маркеры по образцу соседних блоков` · `assignee: builder` · `dependencies: []`
2. `id: t2` · `subject: Правило 17 (.project/ORCH-RULES.md) — третий трек Fast; Шаг 0 (docs/spec-chain/skills/run-spec-chain/SKILL.md) — ветка Fast` · `assignee: builder` · `dependencies: []`
3. `id: t3` · `subject: SKILL.md — обязательный Playwright CLI (не MCP) для type=feature/ui после MAS и до close; точные строки для roster.yaml — в отчёт` · `assignee: builder` · `dependencies: [t2]`
4. `id: t4` · `subject: vitest.config.ts — исключить .project/drafts/** и .agent-teams/** из сборки Vitest` · `assignee: builder` · `dependencies: []`
5. `id: t5` · `subject: Ревью правок t1-t4 — критерии приёмки 1-9, вердикт pass/needs_revision` · `assignee: reviewer` · `dependencies: [t1, t2, t3, t4]`
6. `id: t6` · `subject: Playwright E2E — предусловие npx playwright install chromium, npm run test:e2e, exit-код и артефакты в отчёт` · `assignee: tester` · `dependencies: [t5]`

Write-скоупы (без пересечений по писателю):

- t1 → `.project/sync.mjs`
- t2 → `.project/ORCH-RULES.md`, `docs/spec-chain/skills/run-spec-chain/SKILL.md`
- t3 → `docs/spec-chain/skills/run-spec-chain/SKILL.md`
- t4 → `vitest.config.ts`
- t5 → правок нет (read-only ревью)
- t6 → правок кода нет; артефакт отчёта — `.project/drafts/spec-048-playwright-e2e.md`,
  вывод прогона — `test-results/**`

**Расхождение с формулировкой задания (зафиксировано явно).** Задание капитана
задаёт `t1 ∥ t2 ∥ t3 ∥ t4`, но t2 и t3 пишут **один и тот же файл**
(`docs/spec-chain/skills/run-spec-chain/SKILL.md`): параллельная запись в один файл
даёт потерянные правки. Поэтому t3 зависит от t2 (один файл — один писатель в момент
времени), а `t1 ∥ t2 ∥ t4` сохраняется. Форма DAG: `t1 ∥ t2 ∥ t4 → t3 → t5 → t6`.

## Edge Cases

- **`test:run` красный на входе** → шаг 1 задания капитана: изоляция leftover
  (rename `.spec.ts` → `.spec.ts.bak`), затем `npm run test:run` = 0; `≠ 0` → STOP до
  старта MAS. Структурный фикс (компонент 4) закрывает класс дефекта, а не единичный файл.
- **Файл-ловушка под `.project/drafts/**` собирается Vitest** (критерий 7) → паттерн
  исключения недостаточен, вернуть в t4; гейт не обходится.
- **`sync:check` красный из-за незакоммиченных производных** → сначала `npm run sync`
  и коммит производных (правило 3), затем гейт; `≠ 0` после этого → STOP.
- **`sync:check` красный при живой команде** (критерий 2) → правка OBS-1 неполная
  (маркеры стоят не вокруг всего блока) → возврат в t1, гейт не обходится.
- **Рендер центра сломан** (правка секции уронила `npm run sync` или потеряла секцию,
  критерий 3) → STOP, закрытие не запускается.
- **t5 вернул `needs_revision`/`reject`** → STOP по заданию капитана: закрытие не
  запускается, findings — в отчёт; правки — новой задачей, вердикт перепроверяется.
- **t6 failed (`npm run test:e2e` ≠ 0)** → STOP по заданию капитана.
- **chromium не устанавливается** (нет сети/зеркала) → STOP с диагностикой
  (команда, текст ошибки); гейт не подменяется MCP-прогоном.
- **`type=feature/ui` без Playwright** → закрытие запрещено: Шаг 4b — обязательный
  подшаг цепочки, его пропуск не «оптимизация», а нарушение гейта.
- **Команда `.agent-teams/spec-048-*` архивирована до закрытия** → не блокер:
  `close-spec.mjs` ищет `team.json` и в `archive/`; но до закрытия команду не удалять.
- **Пресет `~/.dsh/.agent-presets/**` недоступен** → не блокер: правки репозитория
  не зависят от пресета; строки для `roster.yaml` всё равно докладываются капитану.
- **`enrich` не запускался** → не режим отказа, а прямое решение капитана
  (трек `full-enrich-skip`, зафиксирован в шапке спеки); Шаг 1 цепочки пропускается
  осознанно.

## Правка пресета (капитан) — предложение, не действие агента

`roster.yaml` правит капитан вручную. Предлагаемые точные строки для блока `roles:`
(после роли `tester`) — ввести явного владельца E2E-шага, чтобы Шаг 4b имел
роль-исполнителя из ростера:

```yaml
  tester_e2e:
    provider: deepseek-official
    model: deepseek-v4-flash
    reasoning_effort: high
    description: "Прогоняет Playwright E2E (CLI) как гейт цепочки"
```

Альтернатива (без правки ростера): Шаг 4b исполняет существующая роль `tester`.
Решение — за капитаном; агент пресет не открывает и не изменяет.

## Источники

- `.project/ORCH-RULES.md` — правила 2, 3, 5, 6, 9, 10, 11, 13, 16, 17 (редакция
  2026-10-02, spec 047).
- `docs/spec-chain/skills/run-spec-chain/SKILL.md` — Шаги 0-5, STOP-точки A/B/D/C.
- `.project/sync.mjs` — `VOLATILE` (строки 133-146), `maskVolatile`, `renderCenter`
  (строки 2123-2127), `readAgentTeams()` (строки 946-1066).
- `vitest.config.ts:21` — действующее исключение `e2e/**` и комментарий про Playwright
  спеки; `npm run test:run` (baseline exit 1) и
  `.project/drafts/test-runs/spec-043-batch6.spec.ts` (untracked leftover spec 043).
- `docs/memory/working.md:103` (N3), `docs/memory/episodic.md:149,184`,
  `docs/memory/alerts.md:8`, `docs/C0-CENTER-AUDIT.md:47,195` — фиксация OBS-1.
- `.project/specs/047-spec-chain-dual-track.md` — прецедент правки правила 17 и
  добавления Шага 0.
- `.project/specs/043-batch6-deploy-systems.md` — тема `deploy_systems` = 25 вопросов
  при `per_topic_target` 22 (для отдельной строки в `log.md`).
- `AGENTS.md` — гейты `npm run typecheck`, `npm run test:run`, Playwright (chromium only).

## Проверка

```powershell
# 0. Шаг 1 задания капитана: leftover изолирован, гейт test:run зелёный до MAS
Get-ChildItem .project/drafts/test-runs | Select-Object Name
npm run test:run; Write-Output "test:run EXIT=$LASTEXITCODE"

# 1. OBS-1: содержимое секции agents целиком внутри VOLATILE (свёртка не оставляет текста)
node -e "const fs=require('node:fs');const h=fs.readFileSync('docs/index.html','utf8');const m=/id=.agents./.exec(h);const i=m?m.index:0;const j=h.indexOf('</section>',i);const sec=h.slice(i,j);const inner=sec.slice(sec.indexOf('>')+1);const left=inner.replace(/<!--volatile:start-->[\s\S]*?<!--volatile:end-->/g,'').trim();const ok=i>0&&j>i&&sec.includes('Пульс агентов')&&left==='';console.log('agents section: title='+sec.includes('Пульс агентов')+' unmaskedLeft='+JSON.stringify(left));process.exit(ok?0:1)"

# 2. OBS-1: гейт не дрожит от живой команды spec-048
Test-Path .agent-teams/spec-048-fast-track-obs-tester/team.json
node .project/sync.mjs --check; Write-Output "sync-check EXIT=$LASTEXITCODE"

# 3. OBS-1: рендер секции не потерян (заголовок + карточки команд или empty-state)
node -e "const fs=require('node:fs');const h=fs.readFileSync('docs/index.html','utf8');const m=/id=.agents./.exec(h);const i=m?m.index:0;const j=h.indexOf('</section>',i);const sec=h.slice(i,j);const card=/entry__title|нет данных/.test(sec);const ok=i>0&&j>i&&sec.includes('Пульс агентов')&&card;console.log('agents render: title='+sec.includes('Пульс агентов')+' cardOrEmpty='+card);process.exit(ok?0:1)"

# 4. Правило 17: трек Fast со всеми обязательными свойствами
node -e "const t=require('node:fs').readFileSync('.project/ORCH-RULES.md','utf8');const i=t.indexOf('## 17.');const s=i<0?'':t.slice(i);const need=[/Fast/,/enrich/,/MAS/,/Playwright/,/049/,/явны/i,/content/i];const miss=need.filter(r=>!r.test(s)).map(String);console.log('rule17 miss='+(miss.join(',')||'none'));process.exit(i>=0&&miss.length===0?0:1)"

# 5. Шаг 0: ветка Fast
node -e "const t=require('node:fs').readFileSync('docs/spec-chain/skills/run-spec-chain/SKILL.md','utf8');const a=t.indexOf('### Шаг 0');const b=t.indexOf('### Шаг 1');const s=t.slice(a,b);const need=[/Fast/,/Playwright/,/MAS/];const miss=need.filter(r=>!r.test(s)).map(String);console.log('step0 miss='+(miss.join(',')||'none'));process.exit(a>=0&&b>a&&miss.length===0?0:1)"

# 6. Playwright CLI (не MCP) для feature/ui + гейт
node -e "const t=require('node:fs').readFileSync('docs/spec-chain/skills/run-spec-chain/SKILL.md','utf8');const need=[/type: feature/,/ui/,/Playwright/,/CLI/,/MCP/,/npx playwright install chromium/,/npm run test:e2e/];const miss=need.filter(r=>!r.test(t)).map(String);console.log('skill miss='+(miss.join(',')||'none'));process.exit(miss.length===0?0:1)"

# 7. Vitest не собирает технические каталоги: паттерны + эмпирическая ловушка
node -e "const t=require('node:fs').readFileSync('vitest.config.ts','utf8');const need=['.project/drafts/**','.agent-teams/**','configDefaults.exclude','e2e/**'];const miss=need.filter(s=>!t.includes(s));console.log('vitest exclude miss='+(miss.join(',')||'none'));process.exit(miss.length?1:0)"
node -e 'require("node:fs").writeFileSync(".project/drafts/__exclude_probe.spec.ts", "import { test } from \"vitest\"; test(\"probe\", () => {});\n")'
npx vitest list | Select-String -Pattern 'exclude_probe'   # ожидается: пусто
Remove-Item .project/drafts/__exclude_probe.spec.ts

# 8. Пресет не тронут (в дереве нет путей вне репозитория; roster.yaml не в write-скоупах)
git status --porcelain

# 9. Playwright E2E
npx playwright install chromium
npm run test:e2e; Write-Output "e2e EXIT=$LASTEXITCODE"

# 10. Вердикт ревьюера прогона (задача t5)
node .project/scripts/close-spec.mjs 048 --dry-run

# 11. Гейты и EOL
npm run typecheck
npm run test:run
npm run sync:check
git ls-files --eol .project/sync.mjs .project/ORCH-RULES.md docs/spec-chain/skills/run-spec-chain/SKILL.md vitest.config.ts .project/specs/048-fast-track-obs-tester.md

# 12. Закрытие
npm run spec:close -- 048 --dry-run
npm run spec:close -- 048
```

## Отчёт капитану

1. Спека 048 создана сразу в `approved` (embedded approve правила 2; rule 13 —
   правка правила 17). Трек — `full-enrich-skip`: Full с **пропущенным** `enrich`
   по прямому решению капитана.
2. Шаг 1 задания выполнен до MAS: leftover `.project/drafts/test-runs/spec-043-batch6.spec.ts`
   изолирован в `.spec.ts.bak`, `npm run test:run` = 0.
3. Четыре правки: VOLATILE вокруг «Пульса агентов» (OBS-1), трек Fast в правиле 17
   и в Шаге 0, обязательный Playwright CLI для `type=feature/ui` (Шаг 4b), исключение
   `.project/drafts/**` и `.agent-teams/**` в `vitest.config.ts`.
4. Сырые exit-коды гейтов ДО и ПОСЛЕ прогона (`typecheck`, `test:run`, `sync:check`,
   `test:e2e`) и вердикт t5.
5. Расхождение с заданием: `t2 ∥ t3` сведено к `t2 → t3` (один файл — один писатель).
6. Точные строки для `roster.yaml` (правка — капитана; пресет агентом не тронут).
7. Push не выполняется (правила 10/11) — отдельная per-command авторизация.
