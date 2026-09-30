---
id: 037
slug: user-counter
type: infra
status: approved
commit: null
---

# Спека 037 — счётчик уникальных пользователей и заходов

Источник фактов: исследование 30.09.2026 (GoatCounter, Umami, GitHub Traffic API). Выбрано: GoatCounter (hosted free tier) — privacy-first, no cookies, работает на github.io, приватный dashboard, API. Реализация — после approve.

## Контекст

LinuxExam — статический сайт на GitHub Pages. Backend отсутствует. Требования: данные с прода; видит только владелец; отображение в центре.

**Выбор:** GoatCounter hosted — privacy-first, free (100k pageviews/мес), no cookies, API.

**Решения капитана (30.09.2026):**

- Site code: **`barsik`** → dashboard `https://barsik.goatcounter.com`, API-хост `https://barsik.goatcounter.com/api/v0`.
- Хранение токена: **`~/.dsh/goatcounter-token.json`** (`os.homedir()/.dsh/...`, вне репо; совпадает с `DSH_HOME`). Env-fallback `GOATCOUNTER_TOKEN` — опционально, только для CI.
- `.gitignore`: **точечно `/.dsh/`**, а не широкий `.dsh/` (последний молча игнорировал бы любой вложенный каталог `.dsh/` в проекте). Дополнительно — `*goatcounter-token*.json`.

**Контракт API (проверено 30.09.2026 по исходникам `handlers/api.go`):**

- `GET https://barsik.goatcounter.com/api/v0/stats/total` — заголовки `Authorization: Bearer <token>`, `Accept: application/json`, `Content-Type: application/json`; query `start`, `end` (RFC3339, по умолчанию — последние 7 дней). Токену нужны права **`stats`**.
- Ответ: `{ "total": int, "total_events": int, "total_utc": int, "stats": [{ "day": "YYYY-MM-DD", "hourly": [..], "daily": int }] }`.
- `total` — число **посетителей** за период (`stats[]` — разбивка по дням, `daily` — посетители за день); pageviews в этом ответе нет — считать их из `stats[].hourly` не нужно, поле `pageviews` допускается `null`.
- Ошибки: 401 (нет/неверный токен), 403 (нет прав `stats`), 429/5xx — retry с backoff.

## Источники

- Исследование 30.09.2026.
- `docs/index.html` — плитки (R1). Рекон 30.09.2026: 4 плитки — `Свежесть данных`, `Банк` (`225/300 · 75%`), `Требует решения` (`—`), `Долги` (`30`).
- `.project/sync.mjs` — `pulseTiles()` (R2). Рекон 30.09.2026: `function pulseTiles(ctx)` (строка 1546), локальный хелпер `const tile = (label, value, note) => [...]`, вызов `${pulseTiles({ state, goal, specs, inSync, alerts })}` (строка 1947).
- `.project/state.json` (R3). Рекон 30.09.2026: top-level ключи — `last_update, goal, topics, milestones, gates, issues_open, recent_commits, head, specs, log_tail, schema_version, commits, roles, products, audits, plan`. Ключа `user_counter` нет — добавляется t1.
- `index.html` — Vite-template (R4). Рекон 30.09.2026: существует, `</body>` на строке 59 (перед ним — точка вставки скрипта).
- `.gitignore` (R5). Рекон 30.09.2026: `.env`, `dist`, `.tmp-*` есть; **`.dsh/`, `*token*`, `*secret*` — нет** → добавляется t4.

## Цель

1. Сбор: скрипт GoatCounter в `dist/index.html` (из `index.html` корня).
2. Хранение: GoatCounter dashboard + кэш в `.project/state.json` (`user_counter`).
3. Отображение: плитка «Пользователи» в центре.
4. CLI: `npm run stats:users`.

## Что делаем

1. **Регистрация GoatCounter** — вне репо, капитан; site code **`barsik`**.
2. **Скрипт в `index.html`** перед `</body>` — GoatCounter JS (site code `barsik`).
3. **`.project/scripts/fetch-stats.mjs`** — GoatCounter API → `state.user_counter`.
4. **`npm run stats:users`**.
5. **Плитка «Пользователи»** в `pulseTiles()` (`sync.mjs`).
6. **Токен:** `~/.dsh/goatcounter-token.json` (вне репо).
7. **`.gitignore`:** добавить `/.dsh/` + `*goatcounter-token*.json` (R5: сейчас не покрыто).

## Декомпозиция

1. `id: t1` · `subject: .project/scripts/fetch-stats.mjs — GoatCounter API (site barsik) → user_counter (unique_users = total, pageviews) в .project/state.json; токен ~/.dsh/goatcounter-token.json, права stats` · `assignee: builder` · `dependencies: []`
2. `id: t2` · `subject: package.json — npm run stats:users (fetch-stats.mjs)` · `assignee: builder` · `dependencies: []`
3. `id: t3` · `subject: .project/sync.mjs — pulseTiles(): плитка «Пользователи» (N/M); state.user_counter; fallback «—»` · `assignee: builder` · `dependencies: []`
4. `id: t4` · `subject: index.html (корень) — GoatCounter script (barsik) перед </body>; .gitignore — добавить /.dsh/ и *goatcounter-token*.json` · `assignee: builder` · `dependencies: []`
5. `id: t5` · `subject: reviewer — integration: npm run stats:users → state.user_counter; npm run sync → плитка; verdict=pass` · `assignee: reviewer` · `dependencies: [t1, t2, t3, t4]`

Оговорки:

- Write-скоупы не пересекаются: t1 — `fetch-stats.mjs`; t2 — `package.json`; t3 — `sync.mjs`; t4 — `index.html` + `.gitignore`.
- GoatCounter регистрация — **вне репо**: site code `barsik`, dashboard `https://barsik.goatcounter.com` (создаёт капитан).
- `~/.dsh/goatcounter-token.json` — **вне репо**; формат `{ "token": "...", "site": "barsik" }`, права токена — `stats`. Отсутствие файла → exit 1 с печатью ожидаемого пути (без печати значения токена).
- `.gitignore` — точечно `/.dsh/` + `*goatcounter-token*.json` (широкий `.dsh/` не использовать: он игнорирует любой вложенный каталог `.dsh/`).
- `state.user_counter` — `{ unique_users, pageviews, period: { start, end }, fetched_at, source: "goatcounter" }`; запись идемпотентна (повторный прогон в те же сутки не должен давать диффа, кроме `fetched_at`).
- Approve капитана обязателен.

## Edge Cases и стратегия проверки

- **Регистрация:** капитан вручную. Без токена `fetch-stats.mjs` → exit 1.
- **API-лимиты:** free tier — разумные; retry при 429/5xx.
- **Приватность:** GoatCounter не использует cookies, уникальные — по hash(IP+UA).
- **Fallback:** `state.user_counter` пуст → плитка «—».
- **Vite:** правка `index.html` (корень) → `npm run build` → `dist/index.html`.
- **`dsh-defend`:** файлы с `token`/`secret` могут блокироваться сканером при правке — использовать точечный edit, не общие генераторы.
- **`.gitignore`:** в репо нет ни `.dsh/`, ни `*token*`, ни `*secret*` (рекон 30.09.2026; есть только `.env`) — t4 добавляет точечно `/.dsh/` + `*goatcounter-token*.json`.
- **Первый прогон на пустом сайте:** у нового сайта `total = 0` — плитка обязана показать «—» (а не `0`), иначе выглядит как данные.

## Критерии приёмки

1. `index.html` содержит GoatCounter script (site code `barsik`).
2. `npm run stats:users` → `state.user_counter` заполнен (`unique_users` из поля `total`).
3. `pulseTiles()` рендерит плитку «Пользователи».
4. `docs/index.html` (после sync) содержит плитку.
5. `.gitignore` покрывает `/.dsh/` и `*goatcounter-token*.json`.
6. Reviewer verdict = pass.

## Что НЕ трогать

- `src/data/**`, `tools/**`.
- Спеки 028–036.
- `.project/factory/**`, `templates/**`, `docs/dashboard/**`.
