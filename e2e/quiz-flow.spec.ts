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

test('inherit mode follows the system colour scheme live', async ({ page }) => {
  // No stored preference => the app follows the system/Telegram.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'inherit');

  // Flipping the OS preference must re-theme without a reload (matchMedia change).
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });
});
