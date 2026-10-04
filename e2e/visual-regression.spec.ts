import type { Page } from '@playwright/test';
import { test, expect, dynamicMasks, freezeClock, waitForFonts } from './fixtures';
import { DESKTOP, MOBILE, SCREENS, rootToTop } from './screens';

/**
 * Visual regression (spec 074).
 *
 * 19 базовых снимков: 8 «рабочих» экранов × 2 viewport'а (390×844 mobile,
 * 1440×900 desktop) + 3 онбординг-экрана × mobile. Состояния экранов общие с
 * axe-прогоном (`e2e/screens.ts`), поэтому a11y-отчёт описывает ровно те
 * экраны, что зафиксированы здесь.
 *
 * Что делает снимок устойчивым:
 * - `freezeClock` (`Date.now` и `new Date` фиксированы, таймеры продолжают
 *   идти) — иначе подписи с датой и streak менялись бы между прогонами;
 * - `document.fonts.ready` — до готовности шрифтов текст рисуется подменным;
 * - маски динамики (`dynamicMasks`) — таймер экзамена, streak, XP, дневная цель;
 * - `animations: 'disabled'` и пороги (`maxDiffPixelRatio` 0.01, `threshold` 0.2)
 *   из `playwright.config.ts`;
 * - прокрутка контейнера в начало — состояние «пользователь только пришёл».
 *
 * Baseline коммитится разработческий (платформенный суффикс Playwright -win32);
 * Linux-снимки для CI — отдельная задача, здесь ограничение только фиксируется.
 */

// spec 078: `maskColor` must be passed HERE, at the call site. Playwright lists
// `mask` and `maskColor` in `NonConfigProperties` and strips them from the
// config options, so `expect.toHaveScreenshot.maskColor` in
// `playwright.config.ts` has no effect. Masks and their selectors are unchanged;
// only the fill colour (default #F0F, read by the visual audit as a UI defect)
// is replaced with the neutral page background.
async function shoot(page: Page, file: string): Promise<void> {
  await waitForFonts(page);
  await rootToTop(page);
  await expect(page).toHaveScreenshot(file, {
    mask: dynamicMasks(page),
    maskColor: '#f5f5f5',
  });
}

test.setTimeout(120_000);

for (const viewport of ['mobile', 'desktop'] as const) {
  test.describe(`visual: ${viewport}`, () => {
    test.use({
      viewport: viewport === 'mobile' ? MOBILE : DESKTOP,
      // Тема фиксируется явно: иначе снимок зависел бы от системной схемы той
      // машины, на которой снят baseline.
      colorScheme: 'light',
    });

    for (const screen of SCREENS.filter((item) => item.viewports.includes(viewport))) {
      test(`${screen.name} (${viewport})`, async ({ page }) => {
        await freezeClock(page);
        await screen.open(page);
        await shoot(page, `${screen.name}-${viewport}.png`);
      });
    }
  });
}
