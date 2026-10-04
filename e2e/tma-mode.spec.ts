import { serializeInitDataQuery, serializeLaunchParamsQuery } from '@telegram-apps/sdk';
import type { Page } from '@playwright/test';
import {
  test,
  expect,
  blockAnalytics,
  emptyPersistedState,
  seedState,
  startTopic,
  waitForDashboard,
  TESTID,
} from './fixtures';

/**
 * TMA mode mock (spec 075).
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ХАРАКТЕРИЗУЮЩИЙ, НЕ ДОКАЗЫВАЮЩИЙ. Mock не эмулирует реальный Telegram
 * WebView: он подставляет launch-параметры, канал `postEvent` и ответы клиента,
 * но не воспроизводит сам клиент (нижний sheet, нативная кнопка, жесты,
 * реальные safe-area и тема). Единственная гарантия для нативной ветки —
 * ручная проверка на устройстве. Зелёный прогон здесь означает «в этом
 * окружении приложение ведёт себя так», а не «на телефоне работает».
 * ══════════════════════════════════════════════════════════════════════════
 *
 * RECON: почему в spec 072 TMA-ветку поднять не удалось (6 вариантов мока) и что
 * оказалось причиной. Мок состоит из ТРЁХ слоёв — без любого из них
 * `isTMA()` либо не включается, либо приложение не доходит до первого рендера:
 *
 * 1. **Гейт инициализации.** `src/main.tsx:108-119` грузит SDK только если
 *    `window.Telegram.WebApp != null` (или `VITE_MOCK_TELEGRAM=1`). Мок 072
 *    ставил `window.Telegram.WebApp.MainButton`, но не сам `window.Telegram`,
 *    а варианты с одними launch-параметрами вообще не открывали гейт — и
 *    `initTelegramSDK()` не вызывался.
 * 2. **Launch-параметры — в sessionStorage, а не в localStorage.** SDK читает их
 *    через `@telegram-apps/toolkit` `getStorageValue`, а тот работает с
 *    `sessionStorage['tapps/' + key]` (`function g(o){return `tapps/${o}`}`) и
 *    хранит значение как JSON. Запись в `localStorage['launchParams']` (как
 *    пробовали в 072) SDK не видит вовсе. Строка собирается ШТАТНЫМИ
 *    сериализаторами SDK: ручная не проходит парсер (`signature` в init data и
 *    `tgWebAppThemeParams` обязательны).
 * 3. **Ответы клиента.** SDK слушает `window` `message` с `source === window.parent`
 *    и `data = { eventType, eventData }`. Без ответов на `web_app_request_theme` /
 *    `web_app_request_viewport` промисы `themeParams.mount()` не резолвятся:
 *    `isTMA()` уже `true`, а `#root` остаётся ПУСТЫМ (проверено: `rootChildren = 0`).
 *
 * Соответствие понятий: `setText` / `show` / `hide` из заданий — API нативного
 * моста, которого в SDK v3 нет. Им соответствуют поля ОДНОГО события
 * `web_app_setup_main_button`: `text`, `is_visible`, `is_active` (= «enabled»).
 * `onClick` в канал не пишется вообще (это локальная подписка SDK) — проверка
 * этого пункта здесь невозможна и не выдумывается.
 */

const TMA_VIEWPORT = { width: 390, height: 720 };
/** Тема реестра: любой доступный прогон годится для проверки CTA. */
const TOPIC = 'essential_tools';
const ANCHOR_TIMEOUT = 15_000;
/** SDK хранит значения как sessionStorage['tapps/<key>'] с JSON-обёрткой. */
const LAUNCH_PARAMS_KEY = 'tapps/launchParams';

interface MbLogEntry {
  event: string;
  data: string | null;
}

interface TmaWindow {
  __mbLog: MbLogEntry[];
  TelegramWebviewProxy?: { postEvent: (event: string, data?: string) => void };
  TelegramWebviewProxyProto?: { postEvent: (event: string, data?: string) => void };
}

/**
 * Launch-параметры, которые SDK считает валидными. Версия WebView — параметр:
 * MainButton появился в 6.1, поэтому `'6.0'` даёт штатное «TMA без MainButton»
 * для проверки фолбэка.
 */
function launchParams(version: string): string {
  const theme = {
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#707579',
    link_color: '#2678b6',
    button_color: '#2196F3',
    button_text_color: '#ffffff',
    secondary_bg_color: '#f4f4f5',
  };
  const initData = serializeInitDataQuery({
    user: { id: 1, first_name: 'Test', language_code: 'ru' },
    auth_date: 1759500000,
    hash: 'a'.repeat(64),
    signature: 'b'.repeat(43),
  });
  return serializeLaunchParamsQuery({
    tgWebAppData: initData,
    tgWebAppVersion: version,
    tgWebAppPlatform: 'android',
    tgWebAppThemeParams: JSON.stringify(theme),
    tgWebAppStartParam: 'e2e-spec-075',
  });
}

/**
 * Init-скрипт мока. Всё, что нужно странице, передаётся аргументами: Playwright
 * перепарсит исходник функции внутри страницы, и замыкание на модульную
 * константу дало бы там ReferenceError (`e2e/fixtures.ts`, та же ловушка).
 */
function installTmaMock({
  params,
  key,
  withGate,
  withClient,
}: {
  params: string;
  key: string;
  withGate: boolean;
  withClient: boolean;
}): void {
  const target = window as unknown as TmaWindow;

  if (withGate) {
    (window as unknown as { Telegram?: unknown }).Telegram = {
      WebApp: {
        initData: '',
        initDataUnsafe: {},
        version: '7.10',
        platform: 'android',
        colorScheme: 'light',
        isExpanded: true,
        viewportHeight: window.innerHeight,
        viewportStableHeight: window.innerHeight,
        themeParams: {},
        ready: () => undefined,
        expand: () => undefined,
        onEvent: () => undefined,
        offEvent: () => undefined,
        sendData: () => undefined,
        openLink: () => undefined,
      },
    };
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(params));
  } catch {
    // Приватный режим/запрет хранилища — мок не поставится, тест это увидит.
  }

  const log: MbLogEntry[] = [];
  target.__mbLog = log;

  target.TelegramWebviewProxy = {
    postEvent: (event: string, data?: string) => {
      log.push({ event, data: data ?? null });
      if (!withClient) return;

      // Ответы «клиента»: без них mount() SDK не резолвится и приложение молчит.
      const replies: Record<string, [string, unknown]> = {
        web_app_request_theme: [
          'theme_changed',
          { theme_params: { bg_color: '#ffffff', text_color: '#000000' } },
        ],
        web_app_request_viewport: [
          'viewport_changed',
          {
            width: window.innerWidth,
            height: window.innerHeight,
            is_state_stable: true,
            is_expanded: true,
          },
        ],
        web_app_request_safe_area: ['safe_area_changed', { top: 0, bottom: 0, left: 0, right: 0 }],
        web_app_request_content_safe_area: [
          'content_safe_area_changed',
          { top: 0, bottom: 0, left: 0, right: 0 },
        ],
      };
      const reply = replies[event];
      if (!reply) return;
      const [eventType, eventData] = reply;
      window.setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: JSON.stringify({ eventType, eventData }),
            source: window.parent,
          }),
        );
      }, 0);
    },
  };
  target.TelegramWebviewProxyProto = target.TelegramWebviewProxy;
}

/** События настройки MainButton, разобранные из JSON-полезной нагрузки. */
async function mainButtonEvents(page: Page): Promise<Record<string, unknown>[]> {
  const log = await page.evaluate(() => (window as unknown as TmaWindow).__mbLog ?? []);
  return log
    .filter((entry) => entry.event === 'web_app_setup_main_button')
    .map((entry) => JSON.parse(entry.data ?? '{}') as Record<string, unknown>);
}

async function channelEvents(page: Page): Promise<string[]> {
  const log = await page.evaluate(() => (window as unknown as TmaWindow).__mbLog ?? []);
  return log.map((entry) => entry.event);
}

async function openDashboardWithMock(page: Page, version: string): Promise<void> {
  await page.addInitScript(installTmaMock, {
    params: launchParams(version),
    key: LAUNCH_PARAMS_KEY,
    withGate: true,
    withClient: true,
  });
  await blockAnalytics(page);
  await seedState(page, emptyPersistedState());
  await page.goto('/');
  await waitForDashboard(page);
}

test.use({ viewport: TMA_VIEWPORT });

test.describe('spec 075 — TMA mode mock', () => {
  test('1. isTMA() === true: приложение видит Telegram (DEV-бейдж TG: Test)', async ({ page }) => {
    const consoleLines: string[] = [];
    page.on('console', (message) => consoleLines.push(message.text()));

    await openDashboardWithMock(page, '7.10');

    // `TG: <имя>` печатает только DEV-бейдж при `isTMA() === true` (src/App.tsx:131).
    await expect(page.getByText('TG: Test', { exact: true })).toBeVisible({
      timeout: ANCHOR_TIMEOUT,
    });
    expect(consoleLines.some((line) => line.includes('Not in Telegram'))).toBe(false);
    // Канал в Telegram живой: SDK поздоровался и запросил viewport.
    const events = await channelEvents(page);
    expect(events).toContain('iframe_ready');
    expect(events).toContain('web_app_request_viewport');
  });

  test('2. quiz → ответ → канал Telegram получает настройку MainButton', async ({ page }) => {
    await openDashboardWithMock(page, '7.10');
    await startTopic(page, TOPIC);

    const before = await mainButtonEvents(page);
    expect(before.length).toBeGreaterThan(0);
    const beforeLast = before.at(-1) ?? {};
    expect(String(beforeLast.text)).toBe('Следующий вопрос');
    expect(beforeLast.is_visible).toBe(true);
    // «Выключена до ответа»: в протоколе SDK enabled — это `is_active`.
    expect(beforeLast.is_active).toBe(false);

    await page.locator('[data-testid^="option-"]').first().click();
    await expect(page.getByTestId(TESTID.explanation)).toBeVisible({ timeout: ANCHOR_TIMEOUT });

    const after = await mainButtonEvents(page);
    const afterLast = after.at(-1) ?? {};
    expect(String(afterLast.text)).toBe('Следующий вопрос');
    expect(afterLast.is_active).toBe(true);
    expect(afterLast.is_visible).toBe(true);
    // В TMA in-app футер не рендерится: CTA живёт в нативной кнопке.
    await expect(page.getByTestId(TESTID.nextButton)).toHaveCount(0);
  });

  test('3. фолбэк: SDK не поднялся, но isTMA() true → in-app футер с next-button', async ({
    page,
  }) => {
    // Сценарий ровно того класса, что чинила spec 072: «мы в Telegram»
    // (`isTMA()` истинно — launch-параметры читаются), но MainButton не
    // смонтирована (гейт инициализации закрыт, SDK не поднимался). Раньше CTA
    // в этом состоянии исчезал целиком: нативной кнопки нет, а in-app футер был
    // скрыт по `isTMA()`. Теперь видимость футера определяет `mainButtonReady`.
    await page.addInitScript(installTmaMock, {
      params: launchParams('7.10'),
      key: LAUNCH_PARAMS_KEY,
      withGate: false,
      withClient: false,
    });
    await blockAnalytics(page);
    await seedState(page, emptyPersistedState());
    await page.goto('/');
    await waitForDashboard(page);

    // TMA-режим виден (бейдж `TG: …`), но пользователь без initData.restore()
    // остаётся `user` по умолчанию — имя в бейдже здесь не проверяется.
    await expect(page.getByText(/^TG: /)).toBeVisible({ timeout: ANCHOR_TIMEOUT });

    await startTopic(page, TOPIC);
    await page.locator('[data-testid^="option-"]').first().click();
    await expect(page.getByTestId(TESTID.explanation)).toBeVisible({ timeout: ANCHOR_TIMEOUT });

    const next = page.getByTestId(TESTID.nextButton);
    await expect(next).toBeVisible();
    await expect(next).toBeInViewport({ ratio: 1 });
    expect(await mainButtonEvents(page)).toEqual([]);
  });

  test('4. visualViewport: высота 720 и совпадает с innerHeight', async ({ page }) => {
    await openDashboardWithMock(page, '7.10');

    const sizes = await page.evaluate(() => ({
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      visualHeight: window.visualViewport?.height ?? null,
      visualWidth: window.visualViewport?.width ?? null,
    }));

    expect(sizes.visualHeight).toBe(720);
    expect(sizes.innerHeight).toBe(720);
    expect(sizes.visualWidth).toBe(390);
  });
});
