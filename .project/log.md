# .project/log.md — журнал решений (append-only)

Одна строка = одно решение. Только добавление в конец, правки запрещены.
Формат: `YYYY-MM-DD | milestone | что решено | commit <sha|pending>`

Последние 10 строк попадают в `state.json.log_tail` и в секцию «Журнал» центра.

2026-09-27 | M4.0 | solid base + dev center | commit pending
