import { test, expect } from '@playwright/test';
import { SCREENS, MOBILE, DESKTOP, rootToTop } from './screens';

/**
 * .project/drafts/_audit-measure.spec.ts — программный обмер отрендеренного DOM
 * для визуального аудита spec 080 (PART 2.2).
 *
 * Vision в сессии недоступен (`read_image` → «no adapter registered for provider
 * "codex-local"`), поэтому аудит идёт программно — как прямо разрешено заданием.
 * Этот спек добирает то, что PNG в пикселях не отдают: реальные размеры
 * интерактивных элементов и fontSize/lineHeight КАЖДОГО текстового узла на
 * 19 baseline-состояниях (`e2e/screens.ts` — тот же рецепт, что у visual и axe).
 *
 * Ничего не меняет: пишет один JSON в `.project/drafts/`, никаких ассертов на
 * дефекты (аудит фиксирует, а не падает).
 */

test.setTimeout(180_000);

test('DOM-обмер 19 экранов (touch targets + типографика)', async ({ page }) => {
  const rows = [];
  const viewports = [
    { name: 'mobile', vp: MOBILE },
    { name: 'desktop', vp: DESKTOP },
  ];

  for (const { name: vpName, vp } of viewports) {
    await page.setViewportSize(vp);
    for (const screen of SCREENS.filter((s) => s.viewports.includes(vpName as never))) {
      await page.goto('about:blank');
      await screen.open(page);
      await rootToTop(page);

      const data = await page.evaluate(() => {
        const px = (v: string) => Number.parseFloat(v) || 0;
        const interactive = [...document.querySelectorAll('button, a, [role="button"], input, [tabindex]')]
          .map((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
              tag: el.tagName.toLowerCase(),
              testid: el.getAttribute('data-testid') ?? '',
              text: (el.textContent ?? '').trim().slice(0, 40),
              w: Math.round(r.width),
              h: Math.round(r.height),
              visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
            };
          })
          .filter((x) => x.visible);

        const textNodes = [...document.querySelectorAll('*')]
          .filter((el) => {
            const hasOwnText = [...el.childNodes].some(
              (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 1,
            );
            return hasOwnText;
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {
              testid: el.getAttribute('data-testid') ?? '',
              text: (el.textContent ?? '').trim().slice(0, 40),
              fontSize: Math.round(px(cs.fontSize) * 10) / 10,
              lineHeight: cs.lineHeight === 'normal' ? 0 : Math.round(px(cs.lineHeight) * 10) / 10,
              color: cs.color,
              visible: r.width > 0 && r.height > 0,
            };
          })
          .filter((x) => x.visible && x.fontSize > 0);

        const root = document.getElementById('root');
        return {
          url: location.href,
          htmlTheme: document.documentElement.getAttribute('data-theme'),
          themeSource: document.documentElement.getAttribute('data-theme-source'),
          rootOverflowX: root ? root.scrollWidth - root.clientWidth : -1,
          bodyScrollWidth: document.body.scrollWidth,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          count: { interactive: interactive.length, text: textNodes.length },
          interactive,
          text: textNodes,
        };
      });

      rows.push({ screen: screen.name, viewport: vpName, ...data });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const dir = '.project/drafts';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/_visual-audit-dom.json`, `${JSON.stringify({ screens: rows }, null, 2)}\n`, 'utf8');

  // Сводка в stdout: аудит читает её, а не гадает.
  const smallTargets = rows.flatMap((r) =>
    r.interactive
      .filter((x) => x.w < 44 || x.h < 44)
      .map((x) => ({ screen: r.screen, viewport: r.viewport, ...x })),
  );
  const smallText = rows.flatMap((r) =>
    r.text
      .filter((x) => x.fontSize < 16)
      .map((x) => ({ screen: r.screen, viewport: r.viewport, fontSize: x.fontSize, lineHeight: x.lineHeight, text: x.text, color: x.color })),
  );
  const tightLineHeight = rows.flatMap((r) =>
    r.text
      .filter((x) => x.lineHeight > 0 && x.fontSize >= 16 && x.lineHeight / x.fontSize < 1.4)
      .map((x) => ({ screen: r.screen, viewport: r.viewport, fontSize: x.fontSize, lineHeight: x.lineHeight, ratio: +(x.lineHeight / x.fontSize).toFixed(2), text: x.text })),
  );
  const overflows = rows.filter((r) => r.rootOverflowX > 1);

  console.log('AUDIT_SCREENS=' + rows.length);
  console.log('AUDIT_SMALL_TARGETS=' + JSON.stringify(smallTargets));
  console.log('AUDIT_TIGHT_LINE_HEIGHT=' + JSON.stringify(tightLineHeight));
  console.log('AUDIT_OVERFLOW=' + JSON.stringify(overflows.map((r) => ({ screen: r.screen, viewport: r.viewport, over: r.rootOverflowX }))));
  console.log('AUDIT_SMALL_TEXT_COUNT=' + smallText.length);
  console.log('AUDIT_SMALL_TEXT_SAMPLE=' + JSON.stringify(smallText.slice(0, 20)));
  console.log('AUDIT_FONT_SIZES=' + JSON.stringify([...new Set(rows.flatMap((r) => r.text.map((t) => t.fontSize)))].sort((a, b) => a - b)));
  console.log('AUDIT_THEMES=' + JSON.stringify([...new Set(rows.map((r) => `${r.htmlTheme}/${r.themeSource}`))]));
  expect(rows.length).toBe(19);
});
