# Оплата Telegram Stars — установка (spec 064)

Инструкция по развёртыванию платёжного backend'а и включению покупки в Mini App.
Пока эти шаги не пройдены, `API_GATEWAY_URL` остаётся пустым и кнопка покупки
показывает «Не удалось начать оплату. Попробуйте позже.» — **непроверенный
backend не может выдать Pro «тихо»**.

## Архитектура

```
клиент (Mini App)                Yandex Cloud                Telegram
─────────────────                ────────────                ────────
Paywall: выбор тарифа
  │ POST /create-invoice {plan}
  ├──────────────────────────►  Cloud Function (Node.js 18)
  │                                │ POST /bot<token>/createInvoiceLink
  │                                ├──────────────────────────► Bot API
  │  { invoiceLink }               │        { invoiceLink }
  ◄───────────────────────────────┘
  │
  │ Telegram.WebApp.openInvoice(url, cb)
  ├─────────────────────────────────────────────────────────► окно оплаты Stars
  │
  │ callback: paid                    pre_checkout_query
  │                                 ◄─────────────────────────  webhook
  │  unlockPro() + dashboard          ──► answerPreCheckoutQuery(ok: true)
  │                                   successful_payment ──► строка в логе
```

Backend **stateless**: ни БД, ни таблиц, ни выдачи прав. Pro ставит клиент по
статусу `paid` (MVP-граница spec 064); серверная верификация платежа — spec 066.

## 1. Бот и его кредит

- Бот создаётся/берётся у [@BotFather](https://t.me/BotFather) (`/newbot` или
  существующий LinuxExam-бот). Кредит бота (из `/mybots` → API Token) знает
  **только функция**: он попадает в переменную окружения `TG_BOT_TOKEN`.
- В клиент этот кредит не попадает никогда: всё, что начинается с `VITE_`, лежит
  в публичном бандле.
- Stars (XTR) не требуют ни карточного провайдера, ни YooKassa: `provider_token`
  в запросе инвойса пустой, `currency: 'XTR'`, `prices[].amount` — цена в звёздах.

## 2. Переменные окружения функции

| Переменная | Обязательна | Значение |
|---|---|---|
| `TG_BOT_TOKEN` | да | кредит бота из @BotFather |
| `WEBHOOK_SECRET` | да | длинная случайная строка; Telegram будет присылать её в заголовке `X-Telegram-Bot-Api-Secret-Token`, функция сравнивает её постоянным по времени сравнением |
| `ALLOWED_ORIGIN` | нет | origin клиента (например домен GitHub Pages); по умолчанию `*` |
| `TG_API_BASE` | нет | база Bot API, по умолчанию `https://api.telegram.org`; точка подмены на прокси, если прямой доступ из облака закрыт (см. §6) |

Секреты не хранятся в репозитории и в истории команд. Заведите файл вне git
(каталог `.secrets/` — в `.gitignore` не нужен, достаточно не коммитить) и
экспортируйте значения в сессию терминала перед командами ниже; в примерах
используются переменные `$env:TG_BOT_TOKEN` и `$env:WEBHOOK_SECRET`.

## 3. Cloud Function

1. В консоли Yandex Cloud: каталог → **Cloud Functions** → **Создать функцию**
   `tg-stars`.
2. **Создать версию**: среда выполнения **Node.js 18**, точка входа
   `index.handler`, источник — каталог `backend/tg-stars` (там только
   `index.mjs`, зависимостей нет), таймаут 10 с, память 128 МБ.
3. В переменные окружения версии добавьте четыре значения из §2.

Через CLI (значения подставляются из вашей сессии, литералов в команде нет):

```powershell
yc serverless function version create `
  --function-name tg-stars `
  --runtime nodejs18 `
  --entrypoint index.handler `
  --source-path ./backend/tg-stars `
  --memory 128m --execution-timeout 10s `
  --environment "TG_BOT_TOKEN=$env:TG_BOT_TOKEN,WEBHOOK_SECRET=$env:WEBHOOK_SECRET,ALLOWED_ORIGIN=https://ialmozt25.github.io"
```

## 4. API Gateway

1. **API Gateway** → создать шлюз, спецификация — один маршрут `$default` на
   функцию `tg-stars` с интеграцией `cloud_functions`:

```yaml
openapi: 3.0.0
info:
  title: linuxexam-payments
  version: 1.0.0
paths:
  /health:
    get:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <id функции tg-stars>
  /create-invoice:
    post:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <id функции tg-stars>
  /webhook:
    post:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <id функции tg-stars>
```

2. Скопируйте служебный домен шлюза — он и есть `API_GATEWAY_URL`
   (например `https://d5dxxxxxxxxxxxxx.apigw.yandexcloud.net`).
3. CORS настраивать не нужно: preflight (`OPTIONS`) обрабатывает сама функция.

## 5. Webhook

```powershell
curl.exe -s "https://api.telegram.org/bot$env:TG_BOT_TOKEN/setWebhook?url=$env:GATEWAY_URL/webhook&secret_token=$env:WEBHOOK_SECRET&allowed_updates=%5B%22pre_checkout_query%22%2C%22message%22%5D"
```

Ожидаемый ответ: `{"ok":true,"result":true,"description":"Webhook was set"}`.
`secret_token` обязан совпадать с `WEBHOOK_SECRET` функции — иначе каждый апдейт
получает `403 forbidden` (и Telegram будет ретраить его).

Проверить текущее состояние: `GET https://api.telegram.org/bot$env:TG_BOT_TOKEN/getWebhookInfo`.

## 6. Проверка доступности Bot API из облака (обязательный PRE-CHECK)

Прямой доступ к `api.telegram.org` из российских сетей не гарантирован, а
Cloudflare Workers как транспорт отпадает по той же причине — поэтому шлюз
выбран Yandex Cloud. Убедитесь в доступности **до** включения клиента:

1. Временно добавьте в функцию ветку проверки (или создайте тестовую функцию),
   которая делает `fetch('https://api.telegram.org/bot<кредит бота>/getMe')`.
2. Вызовите её и посмотрите результат. `{"ok":true,...}` — доступ есть,
   продолжайте с §7.
3. Если вызов падает по таймауту — **STOP**: прямой доступ закрыт. Решение
   капитана: (а) прокси Bot API (например Amvera) и тогда `TG_API_BASE`
   функции указывает на прокси, либо (б) смена площадки backend'а. Клиент
   менять не нужно — он знает только `API_GATEWAY_URL`.

## 7. Клиент

1. `.env.production` (в git не попадает):

```
VITE_API_GATEWAY_URL=https://<домен шлюза>
```

Секретов в этом файле быть не должно — переменная публичная.

2. Пересобрать и задеплоить статику (`npm run build`).
3. Перезапустить Mini App в Telegram (кэш бандла).

## 8. Проверка

```powershell
# 1. функция жива
curl.exe -s "$env:GATEWAY_URL/health"          # {"ok":true}

# 2. инвойс создаётся (звёзды не списываются)
curl.exe -s -X POST "$env:GATEWAY_URL/create-invoice" `
  -H "Content-Type: application/json" -d '{\"plan\":\"monthly\"}'
# {"invoiceLink":"https://t.me/invoice/..."}

# 3. живая оплата: открыть paywall в Mini App, выбрать тариф, «Купить за 299 Stars»,
#    оплатить. После оплаты экран уходит на dashboard, isPro = true.
```

Проверка логов: в логах функции после оплаты должна быть одна строка
`{"event":"successful_payment",...}` и перед ней `{"event":"pre_checkout_query",...}`.

## 9. Границы MVP (что здесь сознательно не сделано)

- **Нет серверной верификации.** Pro выдаёт клиент по callback'у. Пользователь
  с devtools теоретически может поставить `isPro` сам — это принято как цена MVP
  и закрывается spec 066 (проверка `successful_payment` на сервере + выдача
  доступа по аккаунту).
- **Нет recurring**: тарифы — разовые платежи за период (месяц/год) и lifetime;
  автосписаний Stars не существует, продление — повторная покупка.
- **Нет refunds** и нет учёта платежей: backend ничего не хранит, поэтому
  «вернуть звёзды» можно только вручную через @BotFather/Support.
- Одна валюта — XTR; рублёвая оплата и YooKassa не поддерживаются.

## 10. Диагностика

| Симптом | Причина | Что делать |
|---|---|---|
| `{"error":"forbidden"}` на webhook | `secret_token` в setWebhook не совпал с `WEBHOOK_SECRET` | переставить webhook (§5) |
| `{"error":"bot_token_not_configured"}` | нет `TG_BOT_TOKEN` в окружении функции | добавить переменную, выпустить новую версию |
| `{"error":"telegram_api_error"}` | Bot API недоступен или ответил ошибкой (описание в теле) | см. §6, при необходимости `TG_API_BASE` |
| `{"error":"unknown_plan"}` | клиент прислал тариф вне `PAYMENT_PLANS` | проверить сборку клиента |
| В браузере «Не удалось начать оплату» | `VITE_API_GATEWAY_URL` не задан или пуст | §7, пересобрать клиент |
| Окно инвойса не открывается | приложение открыто не внутри Telegram | открыть через кнопку бота, не по прямой ссылке |
| CORS-ошибка в консоли | `ALLOWED_ORIGIN` не совпадает с origin клиента | исправить переменную функции |
