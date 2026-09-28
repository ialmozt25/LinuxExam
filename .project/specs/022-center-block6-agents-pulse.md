---
id: 022
slug: center-block6-agents-pulse
title: "Center block 6 — agents pulse"
status: approved
type: infra
created: 2026-09-28
updated: 2026-09-28
commit: 9718583
---

> **Спека создана как детализация существующего шага F3** (ЧАСТЬ 4, пункт 3:
> «Состояние в `.agent-teams/<teamId>/team.json` → дашборд блок 6»). Это не новый
> шаг и не смена фазы/шагов/бюджета/правил — повторный approve плана не требуется
> (ЧАСТЬ 11). Шаг получил рабочее имя **F3.0b**, план — v2.10.
> Time-box шага: **45 минут** на реализацию (шаг A — 20 минут, docs only).

## Цель

`sync.mjs` читает `.agent-teams/*/team.json` и рендерит блок 6 «Пульс агентов»
в `docs/index.html`: одна строка на команду — имя, фаза, агенты со статусами,
задачи со статусами. До F3.0b центр о блоке 6 молчал (ни секции, ни заглушки):
`git grep` по `.project/sync.mjs` не находил ни одного упоминания `agent-teams`.

## Критерии приёмки

1. Пустой `.agent-teams/` (каталога нет или нет подпапок) → секция печатает «нет данных», а не молчит.
2. Есть подпапка без `team.json` → строка команды с пометкой «нечитаем».
3. Невалидный JSON или гонка чтения → «нечитаем» через `try/catch`, без падения `sync.mjs`.
4. Файлы (не папки) внутри `.agent-teams/` игнорируются — фильтр `isDirectory()`.
5. Несколько команд → рендерятся все, порядок — по code points имени папки (детерминизм).
6. Все текстовые значения проходят через `esc()` (`sync.mjs:975-979`, покрывает `& < > " '`).
7. Рендерятся ровно 7 полей (whitelist) через одну нормализацию: `team.id`, `team.name`, `team.phase`, `members[].name`, `members[].status`, `tasks[].id`, `tasks[].status`. `output`, `result`, `description`, `artifacts`, `deliverables`, `executionPrompt`, `revisions`, `commandsRun` и любые не перечисленные поля не рендерятся.
8. `phase` попадает в `class` только при точном совпадении с `staged` или `running`; иначе — без модификатора класса (значение не подставляется как есть).
9. Отсутствующие `name`/`id` → знак «?», не пустая строка и не `undefined`.
10. Пустые `members[]` / `tasks[]` → строки «агенты: —» / «задачи: —».
11. `.agent-teams/` untracked: после `git clean -xfd` центр показывает «нет данных» — ожидаемое поведение, а не дефект.
12. Гейты `npm run typecheck`, `npm run test:run`, `npm run qc`, `npm run sync && npm run sync:check`, `npm run check:episodic` — все exit 0 (`check:episodic` → OK F0 / F1 / F2).

## Что НЕ трогать

- Другие секции `sync.mjs` (правка — в границах одного блока: читатель + `agentsHtml` + одна секция шаблона).
- `.project/state.json`, `.project/STATE.md`, `.project/SPEC.md` — только через `npm run sync`, руками не править.
- `docs/dashboard/state.json` — легаси-копия, вне объёма.
- `docs/FACTORY-PLAN.md` — кроме шапки и паспорта (в этом шаге уже сделано: v2.10).
- `docs/memory/semantic.md`, `docs/memory/procedural.md`.
- `.agent-teams/**` — содержимое состояния команд только читается.
- Spec 015 `batch5a-text-files` — занятый ID, не переиспользуем.

## Превью

Сгенерировано `npm run sync` при HEAD `9718583` из реального `.agent-teams/linuxexam-m6-phase4/team.json` (секция `#agents` в `docs/index.html`):

```html
  <section class="agents" id="agents">
    <h2>Пульс агентов</h2>
    <div class="muted">Источник: <code>.agent-teams/*/team.json</code> · команд: 1</div>
        <div class="entry">
          <div class="entry__title">linuxexam-m6-phase4 · <span class="chip chip--running">running</span></div>
          <div class="entry__body muted">агенты: phase4-writer (·) · phase4-verifier (·) · phase4-verifier-2 (·)</div>
          <div class="entry__body muted">задачи: t1 ✓ · t2 ✗ · t3 ✓ · t4 ⊘ · t5 ✓ · t6 ✓</div>
        </div>
  </section>
```

Гейты (B7, все exit 0): `npm run typecheck` → 0; `npm run test:run` → 0 (26 файлов / 167 тестов); `npm run qc` → 0 (224 вопроса, Fails: 0, Warns: 22); `npm run sync` → 0; `npm run sync:check` → 0 (`sync: ok (check) — производные совпадают с источником, HEAD 9718583`); `npm run check:episodic` → 0 (`OK F0 / OK F1 / OK F2`). Конвергентный коммит (правило 9) не потребовался.

Edge-кейс-прогон (критерии 1–5; изолированная копия `sync.mjs` в temp-каталоге с фикстурами `.agent-teams/`, репозиторий не затронут): битый JSON → `a-team · нечитаем`; каталог без `team.json` → `c-team · нечитаем`; файл `stray.txt` проигнорирован; `B <team>` отрендерился как `B &lt;team&gt;` (экранирование); неизвестные статусы → `?`; `claimed` → `◇`; `phase: staged` → `chip--staged` + метка «— ожидает approve»; пустые массивы → `агенты: —` / `задачи: —`; нет каталога → `нет данных — каталог .agent-teams/ отсутствует`; пустой каталог → `нет данных — команд нет`; сортировка — `a-team` → `b-team` → `c-team`.

## Зафиксированные решения

- **Прецедент `feat(center):`** — для шагов F3, затрагивающих центр (`sync.mjs` + производные). Зафиксирован здесь, чтобы F3.1+ и F3.2 следовали одному формату.
- **Символ `claimed` → `◇`** (утверждён капитаном). Маппинг задач: `pending ○` · `claimed ◇` · `in_progress ▶` · `completed ✓` · `failed ✗` · `cancelled ⊘` · иное `?`. Маппинг членов: `idle ·` · `working ▶` · `removed ⊘` · иное `?`.
- **Whitelist `phase` = `staged | running`**: только эти значения дают класс `chip--<phase>`; `staged` дополнительно печатает метку «ожидает approve».
- **Блок 6 — часть F3, не отдельная фаза**: обоснование в шапке спеки (ЧАСТЬ 11 — смена шага без смены фазы/бюджета/правил).
