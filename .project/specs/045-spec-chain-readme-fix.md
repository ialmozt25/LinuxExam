---
id: 045
slug: spec-chain-readme-fix
type: infra
status: approved
created: 2026-10-01
updated: 2026-10-01
commit: null
---

# Spec 045 — фикс README spec-chain + run-spec-chain SKILL

## Контекст

Recon перед установкой пресета `linuxexam-spec-chain` (read-only, 2026-10-01)
нашёл три расхождения документации с реальностью:

- **A.** Скилл `close-spec` **не существует нигде**: его нет ни в репо
  (`docs/spec-chain/skills/` содержит только `spec-enrich`, `run-spec-chain`),
  ни в пресете `linuxexam-orchestrator` (там `bootstrap`, `spec-to-team`), ни
  под `~/.dsh` вообще. При этом README перечисляет его как часть пресета,
  как «уже поставляемый оркестратором», как шаг установки 7 и как ожидаемый
  результат шага 10; `run-spec-chain/SKILL.md` — как обязательный скилл.
  Фактически закрытие делает CLI `npm run spec:close -- <id>`
  (`.project/scripts/close-spec.mjs`, spec 038).
- **B.** README шаг 8 требует «top-level строк ≥ 20», тогда как
  `.project/drafts/spec-040-t5-report.md` фиксирует эталон **18**
  (`top_level_rows=18`, `rows_with_id=18`, `VALID=true`). Замер на HEAD:
  18 top-level (26 с вложенными), `js-yaml` load OK, `persona.prefix/suffix`,
  `{{cwd}}`, `customSkillDirs` — всё на месте. Шаблон исправен, порог завышен.
- **C.** README шаг 11 предлагает приёмочный прогон `/run-spec-chain 040`, но
  спека 040 уже `status: done` (`c5d86b4`) — прогон цепочки на закрытой спеке
  правит репозиторий и рискует повторным закрытием.

## Решения капитана (embedded approve, 2026-10-01)

- **A.** Скилл `close-spec` **не создавать**. Заменить все упоминания его как
  скилла (README + `run-spec-chain/SKILL.md`) на CLI `npm run spec:close`.
- **B.** README шаг 8: порог `top-level ≥ 20` → **`≥ 18`**.
- **C.** README шаг 11: пример `/run-spec-chain 040` → **`043`**.

## Что делаем

Только документация: 2 файла, никакого кода, никаких новых зависимостей.

| # | файл | было | стало |
|---|---|---|---|
| A1 | `README.md` (дерево пресета) | строка `├── close-spec/SKILL.md # R5-trace, …` | строка удалена (скилла нет) |
| A2 | `README.md` (таблица «Скиллы») | строка `\| close-spec \| Закрытие спеки: … \|` | строка `\| npm run spec:close -- <id> \| Закрытие спеки: … (CLI, не скилл) \|`; заголовок колонки «Скилл» → «Скилл / команда» |
| A3 | `README.md` (после таблицы) | «`spec-to-team` и `close-spec` уже поставляются пресетом `linuxexam-orchestrator`…» | «`spec-to-team` уже поставляется…; закрытие — не скилл, а CLI `npm run spec:close -- <id>`» |
| A4 | `README.md` шаг 7 | «Добавить недостающие скиллы `spec-to-team` и `close-spec`…; для `close-spec` — из его источника» | «Добавить недостающий скилл `spec-to-team`…; закрытие скиллом не является — его делает CLI» |
| A5 | `README.md` шаг 10 | «видны `spec-enrich`, `spec-to-team`, `close-spec`, `run-spec-chain`» | «видны `spec-enrich`, `spec-to-team`, `run-spec-chain` (три скилла; закрытие — CLI)» |
| B | `README.md` шаг 8 | «top-level строк ≥ 20» | «top-level строк ≥ 18 (эталон: `spec-040-t5-report.md`)» |
| C | `README.md` шаг 11 | `/run-spec-chain 040` | `/run-spec-chain 043` |
| A6 | `run-spec-chain/SKILL.md` (шапка-таблица) | «скиллы: `spec-enrich`, `spec-to-team`, `close-spec`, `run-spec-chain`» | «скиллы: `spec-enrich`, `spec-to-team`, `run-spec-chain`; закрытие — CLI `npm run spec:close`» |
| A7 | `run-spec-chain/SKILL.md` (заголовок Шага 5) | `### Шаг 5 — close-spec + STOP-точка C` | `### Шаг 5 — npm run spec:close + STOP-точка C` |

Упоминания CLI `spec:close` (с двоеточием) и общие слова про «закрытие»
сохраняются дословно — они корректны.

## Критерии приёмки

1. В `docs/spec-chain/README.md` и
   `docs/spec-chain/skills/run-spec-chain/SKILL.md` **не остаётся ни одного**
   упоминания `close-spec` в смысле скилла: ни `close-spec/SKILL.md`, ни
   `close-spec` в перечне скиллов. Проверка:
   `Select-String -Pattern 'close-spec/SKILL|скилл\w*\s+`close-spec`|\| `close-spec` \|'`
   → пусто. Упоминания CLI-скрипта `.project/scripts/close-spec.mjs` при этом
   допустимы и ожидаемы (это имя файла, а не скилл).
2. README шаг 8: порог `18`; шаг 11: пример `/run-spec-chain 043`.
3. Все прочие упоминания шага 5/закрытия/`spec:close` не изменены по смыслу.
4. `npm run typecheck` = 0, `npm run test:run` = 0, `npm run sync:check` = 0.
5. `.project/scripts/**`, `src/**`, `tools/**` и `notify*` не тронуты.

## Что НЕ трогать

- `.project/scripts/**` (в т.ч. `close-spec.mjs`), `src/**`, `tools/**`.
- `.project/notify-config.json`, `.project/scripts/notify.mjs`.
- Спеки 028–044.
- `docs/memory/log.md` — single-writer, только через closing-фазу.

## Замечено при выполнении (решение за капитаном)

- `docs/spec-chain/agent.cordis.yml` **тоже** содержит два упоминания
  `close-spec`: строка ~34 (persona: «отчёт close-spec») и строка ~165
  (комментарий «Скиллы: spec-enrich, spec-to-team, close-spec, run-spec-chain»).
  В скоуп 045 не входят (капитан назвал два файла) — вынесено на STOP.

## Отчёт капитану

- diff по двум файлам, «было / стало» по каждому из 9 мест.
- `grep -n close-spec` по обоим файлам → пусто.
- exit-коды `typecheck`, `test:run`, `sync:check`.

## Push не выполнять (правило 10/11).
