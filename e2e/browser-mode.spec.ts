import {
  test,
  expect,
  gotoApp,
  startTopic,
  answerQuestion,
  TESTID,
} from './fixtures';

/**
 * G10 items 2–3 (browser mode) from `.project/drafts/app-map.md` §6.
 *
 * Telegram is not emulated anywhere in this suite: the point is the OUTSIDE-Telegram
 * branch — the DEV badge says «Web mode», the Telegram-only affordances are absent,
 * and the in-app buttons that replace the MainButton are present. The streak/XP
 * half of G10 is covered by `persist.spec.ts` (the stored daily XP and streak).
 */

const TOPIC = 'file_permissions';

test.describe('режим браузера', () => {
  test('the DEV badge names the web mode when there is no Telegram', async ({ page }) => {
    await gotoApp(page);

    // App.tsx renders the badge only in dev, and only for a non-Telegram session.
    await expect(page.getByText('Web mode', { exact: true })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-tg', /.+/);
  });

  test('the in-app controls replace the Telegram MainButton and BackButton', async ({ page }) => {
    await gotoApp(page);
    await startTopic(page, TOPIC);

    // Question screen: the in-app next button exists and is disabled before an answer.
    await expect(page.getByTestId(TESTID.nextButton)).toHaveText(/Следующий вопрос/);
    await expect(page.getByTestId(TESTID.nextButton)).toBeDisabled();
    await answerQuestion(page, 'correct');

    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.headerBack)).toBeVisible();
    await expect(page.getByTestId(TESTID.headerHome)).toBeVisible();

    // Dashboard: the large in-app «Продолжить» exists outside Telegram.
    await page.getByTestId(TESTID.headerHome).click();
    await expect(page.getByTestId(TESTID.dashboardContinue)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(TESTID.dashboardContinue)).toHaveText('Продолжить');
  });

  test('the theme toggle is a browser control, not a Telegram theme reader', async ({ page }) => {
    await gotoApp(page);

    const toggle = page.getByTestId(TESTID.topicToggle);
    await expect(toggle).toBeVisible();
    const label = await toggle.getAttribute('aria-label');
    expect(['Переключить на тёмную', 'Переключить на светлую']).toContain(label);

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'manual');
  });

  test('the dashboard never renders a Telegram-only share entry point', async ({ page }) => {
    await gotoApp(page);

    // `isTelegram` is false, so the resume banner is the only conditional block —
    // there is no share control on the dashboard at all.
    await expect(page.getByText('Поделиться результатом')).toHaveCount(0);
    await expect(page.getByTestId(TESTID.resultsShare)).toHaveCount(0);
  });

  test('the dashboard works without the Telegram SDK bridge', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await gotoApp(page);
    await startTopic(page, TOPIC);
    await answerQuestion(page, 'correct');

    await page.getByTestId(TESTID.headerHome).click();
    await expect(page.getByTestId(TESTID.dashboardContinue)).toBeVisible({ timeout: 15000 });
    // A topic answer lives on the review stream, so the regular counter stays at 0
    // while the topic row keeps its live counter.
    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText('0 из 253');

    // No uncaught exception: every Telegram call is a guarded no-op outside the client.
    expect(errors).toEqual([]);
  });
});
