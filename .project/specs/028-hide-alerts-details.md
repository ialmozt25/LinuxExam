---
id: 028
slug: hide-alerts-details
type: infra
status: approved
commit: null
---

# Свернуть блок «Тревоги» в <details>

## Цель
В docs/index.html блок <section class="alerts"> свернуть в
<details><summary>Тревоги</summary>…</details>. По клику
раскрывается, стили сохраняются.

## Что делаем
1. В .project/sync.mjs найти рендер секции alerts (renderCenter).
2. Обернуть содержимое секции в <details class="alerts"> с
   <summary>Тревоги · записей: N</summary>. Сохранить id="alerts".
3. Сохранить все стили, классы внутренних элементов.
4. Проверить: npm run sync → exit 0; в docs/index.html секция
   alerts в <details>.
5. Проверить: sync:check → exit 0.

## Критерии приёмки
1. В docs/index.html есть <details class="alerts"> или
   <details id="alerts">.
2. Внутри — <summary> с «Тревоги».
3. Содержимое (записи alerts) не потеряно.
4. npm run sync, check:episodic, sync:check — все exit 0.
5. Другие секции не тронуты (regression: plan-factory, plan-dev,
   memory, trends, commits, agents).

## Что НЕ трогать
- src/, tools/, templates/, .agent-teams/.
- Спеки 001–027.
- FACTORY-PLAN.md.
