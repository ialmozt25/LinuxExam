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

test('inherit mode normalises a legacy system value', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    window.localStorage.setItem('lx-theme', 'system');
    window.localStorage.setItem('lx-theme-manual', 'dark');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  // migrateThemeStorage() runs synchronously in main.tsx: the legacy value goes
  // away and the obsolete manual key is dropped.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('lx-theme')), { timeout: 5000 })
    .toBeNull();
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'inherit');
  expect(await page.evaluate(() => window.localStorage.getItem('lx-theme-manual'))).toBeNull();
});

test('switch flips the theme and can return to inherit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('button', { name: 'Настройки' }).click();

  // inherit + OS light => the switch reports the light theme.
  const sw = page.getByRole('switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Светлая тема')).toBeVisible();
  await expect(page.getByText(/Следует системной теме/)).toBeVisible();

  // Flip to dark: an explicit choice is pinned.
  await sw.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'manual');
  await expect(page.getByText('Тёмная тема')).toBeVisible();
  await expect(page.getByText('Ручной выбор')).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('lx-theme'))).toBe('dark');

  // Flip back: it now equals the system theme, so the key is cleared entirely
  // (null, not an empty string) and the app follows the system again.
  await sw.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'inherit');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('lx-theme')), { timeout: 5000 })
    .toBeNull();
  await expect(page.getByText(/Следует системной теме/)).toBeVisible();
});
