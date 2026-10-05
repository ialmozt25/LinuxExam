---
name: recon-audit
description: Аудит без изменений: hex, дубли, мёртвые токены. Использовать, когда капитан просит аудит или перед миграцией.
---

# recon-audit

## Когда
Капитан просит аудит фронтенда или он нужен перед миграцией экрана.
Скилл только читает — изменений не делает.

## Шаги
1. Прогони `npm run fitness` (он же `node scripts/fitness/audit-ui.mjs`).
2. Собери таблицу нарушений: `нарушение | файл:строка | severity`.
   - `no-hex-in-tsx` — high
   - `no-duplicate-components` — high
   - `no-dead-tokens` — medium
   - `boundaries-guard` — high
3. Выведи сырой вывод проверок и сводную таблицу `check | status | violations`.
4. Если нарушений ноль — выведи ровно строку: `0 нарушений`.
5. Укажи ссылку на contract, из которого взяты правила:
   `.project/governance/frontend-contract.yaml`.

## Границы
- Read-only: никаких правок файлов, никаких `npm install`, никаких коммитов.
- Единственное исключение — сам запуск `npm run fitness` (только чтение).
- Не «чини» найденное здесь: починка — отдельный скилл
  (`ui-component-create` / `ui-screen-migrate`) под approve капитана.

## Проверка
```bash
npm run fitness
```
