import {
  test,
  expect,
  blockAnalytics,
  emptyPersistedState,
  seedState,
  startTopic,
  TESTID,
} from './fixtures';

/**
 * spec 072 — MainButton как CTA и in-app футер как его фолбэк.
 *
 * ЧЕГО ЭТОТ ФАЙЛ НЕ ДЕЛАЕТ (записано явно, чтобы не выдавать зелёное за фикс).
 *
 * Задание предлагало мок `window.Telegram.WebApp.MainButton` с логом
 * `show/setText/onClick/hide`. Такой мок **не проверил бы наш код**: приложение
 * работает не с нативным API, а через `@telegram-apps/sdk-react`
 * (`mainButton.setParams/onClick`), и `window.Telegram.WebApp.MainButton` в `src/`
 * не вызывается ни разу. Лог этого мока остался бы пустым при любом поведении
 * приложения — тест «зеленел» бы независимо от дефекта.
 *
 * Второе ограничение: TMA-ветку в Playwright поднять не удалось. `isTMA()` в SDK
 * v3 = «прочитались launch-параметры»; проверены все документированные источники
 * (location.hash, performance navigation entries, localStorage['launchParams'] с
 * валидным `tgWebAppData`), приложение во всех случаях пишет «Not in Telegram —
 * running in browser mode». Поэтому нативная ветка проверяется unit-тестами
 * (`src/hooks/__tests__/useTelegramMainButton.test.tsx`: падение `setParams` не
 * отменяет `onClick`, падение `onClick` не отменяет настройку, позднее
 * монтирование повторяет настройку), а не e2e.
 *
 * Здесь — только наблюдаемое и не фальшивое зелёное: вне TMA фолбэк-CTA обязан
 * присутствовать и работать, страница не падает, а канал в Telegram не должен
 * получать `web_app_setup_main_button` (в веб-режиме кнопку настраивать нечего).
 */

const PROXY_RECORDER = `
(() => {
  window.__mbLog = [];
  const record = (event, data) => window.__mbLog.push({ event, data: data ?? null });
  window.TelegramWebviewProxy = { postEvent: record };
  window.TelegramWebviewProxyProto = { postEvent: record };
})();
`;

/** Первая тема реестра: любой доступный прогон годится для проверки CTA. */
const TOPIC = 'essential_tools';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('spec 072 — CTA и фолбэк', () => {
  test('вне TMA: фолбэк-CTA виден, включается после ответа, ведёт дальше, pageerror = 0', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await blockAnalytics(page);
    await seedState(page, emptyPersistedState());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 15000,
    });

    await startTopic(page, TOPIC);

    // Ключевое утверждение spec 072: пока MainButton недоступен, CTA существует —
    // иначе на устройстве кнопки нет вообще (в TMA in-app футер не рендерился).
    const next = page.getByTestId(TESTID.nextButton);
    await expect(next).toBeVisible();
    await expect(next).toBeDisabled(); // до ответа виден, но выключен

    const option = page.locator('[data-testid^="option-"]').first();
    await option.click();
    await expect(page.getByTestId(TESTID.explanation)).toBeVisible({ timeout: 15000 });

    await expect(next).toBeEnabled();
    await expect(next).toBeInViewport({ ratio: 1 });

    const before = await page.getByTestId(TESTID.questionText).innerText();
    await next.click();
    await expect(page.getByTestId(TESTID.questionText)).not.toHaveText(before, { timeout: 15000 });

    expect(errors).toEqual([]);
  });

  test('вне TMA канал в Telegram не получает настройку MainButton', async ({ page }) => {
    await page.addInitScript(PROXY_RECORDER);
    await blockAnalytics(page);
    await seedState(page, emptyPersistedState());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 15000,
    });

    await startTopic(page, TOPIC);
    const option = page.locator('[data-testid^="option-"]').first();
    await option.click();
    await expect(page.getByTestId(TESTID.explanation)).toBeVisible({ timeout: 15000 });

    const log = await page.evaluate(
      () => (window as unknown as { __mbLog: { event: string; data: string | null }[] }).__mbLog,
    );
    const setupEvents = log.filter((entry) => entry.event === 'web_app_setup_main_button');

    console.log('SPEC072_PROXY_LOG=' + JSON.stringify(log));
    // Вне TMA MainButton настраивать нечего: событий быть не должно.
    expect(setupEvents).toEqual([]);
  });
});
