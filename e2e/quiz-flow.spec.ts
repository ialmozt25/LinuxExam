import { test, expect } from '@playwright/test';

test('full quiz journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Тренажёр RHCSA')).toBeVisible();

  await page.getByRole('button', { name: 'Продолжить' }).click();

  for (let i = 0; i < 5; i++) {
    await page.locator('button[aria-label^="Ответ"]').first().click();
    await page.getByRole('button', { name: /Следующий|Завершить/ }).click();
    await page.waitForLoadState('networkidle');
  }

  await expect(page.getByText(/Бесплатные вопросы закончились|Результаты/)).toBeVisible();
});