import { test, expect, blockAnalytics, seedOnboarding, waitForDashboard, waitForOnboardingGoal, TESTID } from './fixtures';

/**
 * Онбординг (spec 060): цель → демо-квиз → результат → Dashboard.
 *
 * Два сценария: свежий профиль проходит активацию целиком, а профиль с уже
 * отмеченным прохождением не видит онбординг вовсе (второй барьер — непустая
 * статистика — покрыт юнит-тестами `onboarding-migration.test.ts`).
 *
 * Viewport 390×844 — мобильный, потому что именно там целевая аудитория Mini App.
 */
test.describe('онбординг', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('первый запуск: цель → 3 вопроса → результат → Dashboard', async ({ page }) => {
    await blockAnalytics(page);
    await seedOnboarding(page, false);
    await page.goto('/');

    // Шаг 1: цель. Свежий профиль обязан попасть сюда, а не на Dashboard.
    await waitForOnboardingGoal(page);
    await expect(page.getByTestId(`${TESTID.onboardingGoal}-rhcsa`)).toBeVisible();
    await expect(page.getByTestId(`${TESTID.onboardingGoal}-refresh`)).toBeVisible();
    await expect(page.getByTestId(`${TESTID.onboardingGoal}-interview`)).toBeVisible();

    await page.getByTestId(`${TESTID.onboardingGoal}-rhcsa`).click();

    // Шаг 2: три вопроса, по одному за раз, без фидбека между ними.
    await expect(page.getByTestId(TESTID.onboardingDemo)).toBeVisible({ timeout: 15000 });
    const total = 3;
    for (let i = 1; i <= total; i++) {
      await expect(page.getByTestId(TESTID.onboardingDemoProgress)).toHaveText(
        `Вопрос ${i} из ${total}`,
      );
      await page.getByTestId('onboarding-option-0').click();
      // Фидбека нет: вердикт и объяснение не рендерятся.
      await expect(page.getByTestId(TESTID.explanationVerdict)).toHaveCount(0);
      await expect(page.getByTestId(TESTID.explanation)).toHaveCount(0);
      await page.getByTestId(TESTID.onboardingDemoNext).click();
    }

    // Шаг 3: результат со счётом и кнопкой «Начать».
    await expect(page.getByTestId(TESTID.onboardingResult)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(TESTID.onboardingResultScore)).toHaveText(/\d+ из 3/);

    await page.getByTestId(TESTID.onboardingStart).click();

    // Dashboard — и онбординг больше не поднимается.
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.onboardingGoal)).toHaveCount(0);
  });

  test('второй запуск: с отмеченным прохождением онбординг не показан', async ({ page }) => {
    await blockAnalytics(page);
    await seedOnboarding(page, true);
    await page.goto('/');

    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.onboardingGoal)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.onboardingDemo)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.onboardingResult)).toHaveCount(0);
  });
});
