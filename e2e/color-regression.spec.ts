import { test, expect } from '@playwright/test';

const palette = {
  light: { success: 'rgb(55, 126, 58)', danger: 'rgb(207, 57, 46)' },
  dark:  { success: 'rgb(76, 175, 80)', danger: 'rgb(255, 92, 74)' },
};

for (const theme of ['light', 'dark'] as const) {
  const p = palette[theme];

  test(`[${theme}] at least one option has success border after answer`, async ({ page, context }) => {
    await context.addInitScript((t) => {
      localStorage.clear();
      localStorage.setItem('lx-theme', t);
      localStorage.setItem('lx-theme-manual', t);
    }, theme);

    await page.goto('/');
    const start = page.getByRole('button', { name: /Начать тему/ }).first();
    if (await start.isVisible()) await start.click();

    const options = page.locator('button[aria-label^="Ответ"]');
    await expect(options).toHaveCount(4);

    await options.first().click();

    // Transition 'border-color 0.15s' must settle: reading mid-transition returns
    // interpolated rgba() values, not the final theme colours.
    await page.waitForTimeout(400);

    // Хотя бы один option должен иметь зелёный border (selected correct ИЛИ revealed correct)
    const count = await options.count();
    let greenFound = false;
    for (let i = 0; i < count; i++) {
      const bc = await options.nth(i).evaluate(el => getComputedStyle(el).borderTopColor);
      if (bc === p.success) { greenFound = true; break; }
    }
    expect(greenFound).toBe(true);
  });
}