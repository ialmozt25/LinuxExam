---
id: 072
slug: tma-mainbutton
type: fix
track: small
status: approved
created: 2026-10-04
updated: 2026-10-04
commit: null
embedded_approve: rule 2 (F5.0a — 2026-10-04)
execution: direct
---

## Контекст

**Симптом (капитан, реальное устройство, TMA):** после ответа на вопрос кнопка
«Следующий вопрос» **не появляется вообще**. Сломано давно, к 065–071 отношения
не имеет.

**Что уже известно (RECON spec 071):** в TMA (`isTMA() === true`) in-app футер в
`Question.tsx` не рендерится — роль CTA играет нативный Telegram MainButton.
Playwright при этом зелёный, потому что он работает **вне** TMA. CSS-фиксы
067/070/071 правили футер, которого в TMA нет, — то есть были мимо.

**PRE-CHECK (read-only):**

- `.project/specs/072*.md` → **False** (спеки не было);
- `git log -S 'MainButton' -- src/` → `7fb6007` (реализация Telegram-native UX) и
  `2f89eef` (упоминание в комментарии); **MainButton не пропадал** — это не регрессия;
- SDK один: `@telegram-apps/sdk-react@3.3.9` + `@telegram-apps/sdk@3.11.8`;
  прямого `window.Telegram.WebApp.MainButton` в `src/` **нет** → двойной
  инициализации нет;
- DEV-бейдж существует: `src/App.tsx:131` (`TG: <имя>` в TMA / `Web mode` вне),
  только в DEV-сборке;
- `e2e/tma-mainbutton.spec.ts` на входе **отсутствовал**;
- BACKUP: `src/presentation/**` (34), `src/platform/**`, `src/App.tsx`,
  `e2e/` (20) → `.project/drafts/backup/2026-10-04-mainbutton/`.

## RECON — жизненный цикл MainButton

### 1. Инициализация

| Что | Где |
|---|---|
| `mainButton.mount()` — один раз, до первого рендера | `src/platform/telegram_adapter.ts:39-41` |
| `mainButton.isMounted()` — ранний `return`, если кнопка не смонтирована | `src/hooks/useTelegramMainButton.ts:29` (было) |
| `mainButton.setParams({ text, isVisible, isEnabled })` | `src/hooks/useTelegramMainButton.ts:30` (было) |
| `mainButton.onClick(handler)` | `src/hooks/useTelegramMainButton.ts:31` (было) |
| `offClick` + `setParams({ isVisible: false })` | `src/hooks/useTelegramMainButton.ts:39-41` (было) |
| Единственный вызов на экране вопроса | `src/presentation/screens/Question.tsx:89-97` |
| Вызов на Dashboard | `src/presentation/screens/Dashboard.tsx:212` |

`show` / `hide` / `setText` / `enable` / `disable` в SDK v3 **не существуют** —
всё делается одним `setParams`; это зафиксировано в комментарии адаптера.

### 2. Жизненный цикл (до фикса)

| Событие | Что происходило |
|---|---|
| Старт приложения | `init()` → `mainButton.mount()` (синхронно, до `createRoot`) |
| Dashboard | `useTelegramMainButton('Продолжить', → 'question')`, `enabled = true` |
| Заход на вопрос, `hasAnswered = false` | effect: `setParams({ text: 'Следующий вопрос', isVisible: true, isEnabled: false })` + `onClick` |
| `hasAnswered = true` (после ответа) | deps `[text, enabled, visible]` → cleanup (`setParams({ isVisible: false })`) → повторный `setParams({ …, isEnabled: true })` + `onClick` |
| Следующий вопрос | effect **не** перезапускается (`text`/`enabled` те же), `onClickRef` актуален |
| Последний вопрос | `text` → «Завершить» → полный re-setup |
| Уход с экрана | cleanup: `offClick` + `setParams({ isVisible: false })` |

### 3. Условие рендера in-app футера (до фикса)

- `Question.tsx:403` — `{!isTelegram && (…)}`, где `isTelegram = isTMA()` (`:87`);
  распорка — `:460`;
- `Dashboard.tsx:795` — `{!isTelegram && <button data-testid="dashboard-continue">}`;
- `ScreenContainer.tsx:12` — `isTMA()` только для `padding-bottom` MainButton.

Пути «ни MainButton, ни in-app футер» в коде не было: при `isTMA() === false`
футер рендерился. Значит на устройстве `isTMA() === true`, приложение считает себя
Mini App, in-app CTA не рисует — а нативная кнопка не появляется.

### 4. Как определяется недоступность MainButton

У SDK v3 каждый метод — `SafeWrapped` и имеет `isAvailable: Computed<boolean>`,
возвращающий `true` только при одновременном выполнении: (1) среда = Telegram Mini
Apps, (2) SDK инициализирован, (3) компонент MainButton смонтирован.
`setParams` документирован как **бросающий** `FunctionNotAvailableError`
(«environment is unknown», «SDK is not initialized», «parent component is not
mounted») — то есть каждое из этих состояний ломало setup.

### 5. Причина (одна) и почему прежний код её не переживал

**Гипотеза:** `setParams()` (или проверка `isMounted()`) выбрасывает исключение в
setup-эффекте, и общий `try/catch` глушит его вместе с регистрацией `onClick`.

```text
try {
  if (typeof mainButton.isMounted === 'function' && !mainButton.isMounted()) return;  // ранний выход
  mainButton.setParams({ … });   // ← падает здесь
  mainButton.onClick(handler);   // ← не выполняется ⇒ кнопка без обработчика
  registered = true;
} catch (e) { console.warn('mainButton setup failed:', e); }   // след теряется
```

Последствия совпадают с симптомом: кнопка не обновляется и остаётся скрытой/выключенной,
`onClick` не зарегистрирован, а in-app футера в TMA нет — **CTA исчезает полностью**.

Что проверено по исходникам SDK (только чтение, `node_modules`):

- `web_app_setup_main_button` **не** гейтится по версии Telegram (гейт `7.10`
  только у поля `has_shine_effect`) — версия клиента сама кнопку не отключает;
- `isTMA()` = «прочитались launch-параметры» (источники: `location.href` →
  `performance navigation entries` → `localStorage['launchParams']`);
- в jsdom с валидными launch-параметрами SDK-состояние
  (`isMounted/isVisible/isEnabled/text`) обновляется корректно — падение
  происходит не в модели SDK, а на пути «событие → Telegram».

**Чего воспроизвести не удалось:** TMA-ветку в Playwright поднять не получилось —
6 вариантов мока (см. `.project/drafts/spec-072-recon/`), приложение во всех
случаях пишет «Not in Telegram — running in browser mode». Поэтому e2e проверяет
только наблюдаемое, а нативная ветка — unit-тестами.

## Цель

MainButton показывается и обновляется после ответа, а если он недоступен —
CTA берёт на себя in-app футер.

**НЕ входит:** CSS in-app футера (используется как есть из spec 070), Exam (P2),
Analytics (P3).

## Что делаем

### A. `src/hooks/useTelegramMainButton.ts`

- `onClick` регистрируется **до** `setParams` и в **своём** `try/catch`: провал
  настройки текста/видимости больше не оставляет кнопку без обработчика.
- Убран ранний `return` по `isMounted()`: настройка применяется всегда, а не
  только когда кнопка уже смонтирована.
- Повторная попытка при монтировании: `const isMounted = useSignal(mainButton.isMounted)`
  добавлен в deps эффекта — если `mount()` завершился позже первого рендера,
  setup перезапускается (сигнал SDK, а не опрос).
- Cleanup: `offClick` **до** `setParams({ isVisible: false })` (обратный порядок
  к настройке).
- Добавлены `isMainButtonAvailable()` и `useMainButtonAvailable()` — доступность
  MainButton как сигнал для экранов: `isTMA() && mainButton.setParams.isAvailable()`,
  с защитой от исключений.

### B. Реактивный фолбэк

- `Question.tsx:409` и `:467`: гейт in-app футера и распорки — `!mainButtonReady`
  вместо `!isTMA()`; `useMainButtonAvailable()` вызывается безусловно (rules of
  hooks).
- `Dashboard.tsx:798`: гейт `dashboard-continue` — тот же `!mainButtonReady`.
- Поведение: MainButton доступен → футер скрыт (как в TMA и раньше); недоступен →
  футер рендерится и работает. **CSS футера не изменён.**

Минимальность: 3 файла, ~40 строк; лимит «2 попытки» не израсходован (первая
попытка — успешная).

## Критерии приёмки

- [ ] `onClick` регистрируется независимо от успеха `setParams` (unit-тест).
- [ ] Провал `onClick` не мешает применить текст/видимость (unit-тест).
- [ ] Позднее монтирование MainButton повторяет настройку (unit-тест).
- [ ] `isMainButtonAvailable()` возвращает `false` вне TMA и не бросает.
- [ ] `useMainButtonAvailable()` — `false` вне TMA и при недоступной кнопке,
      `true` при смонтированной доступной кнопке.
- [ ] Вне TMA in-app CTA виден, выключается до ответа, включается после ответа,
      находится в вьюпорте целиком и ведёт к следующему вопросу (e2e).
- [ ] Вне TMA `web_app_setup_main_button` в канал Telegram не отправляется (e2e).
- [ ] `pageerror` = 0 в обоих e2e-сценариях.
- [ ] CSS in-app футера не изменён; `data-testid` не изменены.
- [ ] Гейты `typecheck`, `test:run`, `test:e2e`, `build` — exit 0.
- [ ] EOL правленых файлов: `i/lf w/lf`, последний байт `0x0A` (правило 16).
- [ ] `sync:check` = 0; frontmatter `status: done`, `commit <feat-SHA>`;
      запись в `log.md`.
- [ ] **ФИКС UNVERIFIED** до ручной проверки на телефоне; зелёный e2e не подан
      как доказательство.

## Проверка (сигналы критериев)

```powershell
npx vitest run src/hooks/__tests__/useTelegramMainButton.test.tsx   # 11 passed
npx playwright test e2e/tma-mainbutton.spec.ts                      # 2 passed
npm run typecheck; npm run test:run; npm run test:e2e; npm run build  # 0
npm run sync:check                                                   # 0
```

**Ручная проверка (обязательна, не заменяется e2e):** Telegram на телефоне →
вопрос → ответ → видна «Следующий вопрос»; то же на Dashboard («Продолжить»).
Если чего-то не хватает, диагностика: DEV-бейдж `TG:` / `Web mode` в углу.

## Что НЕ трогать

- `src/domain/**`, `src/data/**`, `tools/**`, `.project/sync.mjs`,
  `.project/ORCH-RULES.md`, `package.json`, `backend/**`, `vite.config.ts`;
- CSS in-app футера (`fixedFooter.ts`, стили в `Question.tsx`/`ExamRun.tsx`);
- `data-testid`; `persist`; новые зависимости.

## Отклонения от задания

- **E2E не пишет мок `window.Telegram.WebApp.MainButton`.** Такой мок не проверял
  бы наш код: приложение ходит через `@telegram-apps/sdk-react`, а нативного
  `MainButton` в `src/` нет — лог мока был бы пустым при любом поведении и дал бы
  ложнозелёный тест. Вместо этого: (1) e2e проверяет фолбэк-CTA и отсутствие
  `web_app_setup_main_button` вне TMA по реальному каналу
  `TelegramWebviewProxy.postEvent`; (2) нативная ветка покрыта unit-тестами,
  включая падение `setParams` и позднее монтирование.
- **TMA-эмуляция не поднялась** (6 вариантов мока) — ограничение записано, а не
  замаскировано: `isTMA()` в браузере остаётся `false`.
- **`Dashboard.tsx` тоже затронут**, хотя в задании назван только экран вопроса:
  там тот же hook с тем же дефектом, и без него на Dashboard CTA тоже мог
  исчезнуть. Объём — один гейт.
