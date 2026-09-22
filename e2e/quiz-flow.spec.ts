import { test, expect } from '@playwright/test';

test('full quiz journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('button', { name: 'Продолжить' }).click();

  for (let i = 0; i < 5; i++) {
    await page.locator('button[aria-label^="Ответ"]').first().click();
    await page.getByRole('button', { name: /Следующий|Завершить/ }).click();
  }

  await expect(page.getByText(/Бесплатные вопросы закончились|Результаты/)).toBeVisible({
    timeout: 10000,
  });
});

test('topic click starts filtered quiz', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: /Начать тему: Права доступа/ }).click();
  await expect(page.getByText(/1\s*\/\s*12/)).toBeVisible({ timeout: 5000 });
});
