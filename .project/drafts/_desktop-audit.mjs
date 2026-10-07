/**
 * _desktop-audit.mjs — ЭТАП 1 задания: read-only аудит десктопного layout (после 9be3442).
 *
 * Запуск (нужен vite-node: он резолвит TS-импорт сида):
 *   npx vite-node .project/drafts/_desktop-audit.mjs
 *
 * Что делает: три viewport'а (1024×768, 1440×900, 1920×1080) × две темы (light —
 * паритет с visual-baseline'ом, dark — канон DESIGN.md), профиль сидится
 * `seedHistoryProfile(page, 30)` из `e2e/screens.ts` — тем же сидом, что снимает
 * baseline дашборда в `visual-regression.spec.ts` (`openDashboard`).
 *
 * Пишет только в `.project/drafts/desktop-audit/`: скриншоты `dashboard-{width}.png`,
 * машинный `report.json` (LF) и печатает таблицу в stdout. Приложение не меняет.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'https://localhost:5173';
const OUT_DIR = resolve('.project/drafts/desktop-audit');
/**
 * Три viewport'а из задания (1024×768, 1440×900, 1920×1080) + `1280×800`:
 * 1280 — граница Tailwind `xl`, то есть ровно та ширина, на которой сетка тем
 * меняет число колонок, поэтому полосу 1024–1246px из отчёта 9be3442 нельзя
 * проверить без неё.
 */
const VIEWPORTS = [
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1920x1080', width: 1920, height: 1080 },
];
/**
 * `--suffix=-after` → свои имена артефактов (`report-after.json`,
 * `dashboard-{w}-after.png`), чтобы прогон «до фикса» не перезаписывался.
 * Именно argv, а не env: vite-node не пробрасывает переменные окружения в
 * исполняемый модуль (проверено — `AUDIT_SUFFIX` не доехал).
 */
const SUFFIX = (process.argv.find((a) => a.startsWith('--suffix=')) ?? '').replace('--suffix=', '');

// ── сид и глушилка аналитики — те же модули, что у e2e-спеков ────────────────
// Рецепт «сид дашборда» живёт в `e2e/screens.ts` (`openDashboard` → SCREENS), и
// использует он ровно `seedHistoryProfile(page, 30)` из `e2e/fixtures.ts` — тот же
// сид, что снимает baseline в `visual-regression.spec.ts`. Сам `screens.ts`
// `seedHistoryProfile` не реэкспортирует, поэтому берём его напрямую из источника.
let seedHistoryProfile;
let blockAnalytics;
try {
  ({ seedHistoryProfile, blockAnalytics } = await import('../../e2e/fixtures.ts'));
} catch (error) {
  console.error('[audit] не удалось импортировать сид e2e:', error.message);
  console.error('[audit] запускать так: npx vite-node .project/drafts/_desktop-audit.mjs');
  process.exit(2);
}

/** Замеры внутри страницы: геометрия, computed-стили, переполнения, обрезка. */
const COLLECT = () => {
  const px = (v) => Math.round(Number.parseFloat(v) || 0);

  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height), right: px(r.right), bottom: px(r.bottom) };
  };

  /** Эффективный фон: поднимаемся по предкам, пока фон прозрачный. */
  const effectiveBg = (el) => {
    let node = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba?\([^)]*,\s*0\s*\)$/.test(bg)) return bg;
      node = node.parentElement;
    }
    return 'rgb(255, 255, 255)';
  };

  const textOf = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null);
  const style = (el) => (el ? getComputedStyle(el) : null);

  const root = document.getElementById('root');
  const viewportWidth = window.innerWidth;

  const sidebar = document.querySelector('[data-testid="sidebar"]');
  const statusStrip = document.getElementById('status-strip');
  const mainColumn = statusStrip ? statusStrip.parentElement : null;
  const topicsGrid = document.getElementById('dashboard-topics');
  const topicButtons = Array.from(document.querySelectorAll('button[data-testid^="topic-"]'));
  const firstRow = topicButtons[0] || null;
  const cta = document.querySelector('[data-testid="review-today"]');
  const footerCta = document.querySelector('[data-testid="dashboard-continue"]');
  const streak = document.querySelector('[data-testid="streak-badge"]');
  const activeNav = document.querySelector('[data-testid="sidebar-dashboard"]');

  // Контраст-пары: имя, элемент переднего плана, элемент-подложка (null → эффективный фон).
  const pairs = [];
  const addPair = (name, fgEl, bgEl) => {
    if (!fgEl) return;
    const s = style(fgEl);
    pairs.push({
      name,
      text: textOf(fgEl),
      fg: s.color,
      bg: bgEl ? style(bgEl).backgroundColor : effectiveBg(fgEl),
      fontPx: px(s.fontSize),
      fontWeight: s.fontWeight,
    });
  };

  addPair('active nav', activeNav, null);
  addPair('inactive nav', document.querySelector('[data-testid="sidebar-analytics"]'), null);
  addPair('CTA text', cta, cta);
  addPair('streak text', streak, null);
  addPair('level-strip', statusStrip ? statusStrip.querySelector('span') : null, null);

  let counter = null;
  if (firstRow) {
    counter = Array.from(firstRow.querySelectorAll('span')).find((span) =>
      /^\d+\s+вопр\.$/.test((span.textContent || '').trim()),
    );
    const title = (firstRow.getAttribute('aria-label') || '').replace('Начать тему: ', '');
    const titleEl = Array.from(firstRow.querySelectorAll('div')).find(
      (d) => (d.textContent || '').trim() === title,
    );
    addPair('card title', titleEl, null);
    const descEl = Array.from(firstRow.querySelectorAll('div')).find(
      (d) => d !== titleEl && getComputedStyle(d).overflow === 'hidden' && d.children.length === 0,
    );
    addPair('card description', descEl, null);
  }
  addPair('card counter', counter, null);

  // Обрезка текста (ellipsis): сколько узлов реально режется.
  const truncated = [];
  for (const row of topicButtons) {
    for (const el of Array.from(row.querySelectorAll('*'))) {
      const s = getComputedStyle(el);
      if (s.overflowX !== 'hidden' || s.textOverflow !== 'ellipsis') continue;
      const over = el.scrollWidth - el.clientWidth;
      if (over > 1) {
        truncated.push({
          row: row.getAttribute('data-testid'),
          text: textOf(el),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflow: over,
        });
      }
    }
  }

  // Переполнения вьюпорта по горизонтали (что реально вылезает за экран).
  const overflows = [];
  if (root) {
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > viewportWidth + 1) {
        overflows.push({
          tag: el.tagName.toLowerCase(),
          testid: el.getAttribute('data-testid'),
          className: (el.getAttribute('class') || '').slice(0, 60),
          right: px(r.right),
          over: px(r.right - viewportWidth),
        });
      }
    }
  }

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  return {
    viewportWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    theme: document.documentElement.getAttribute('data-theme'),
    themeSource: document.documentElement.getAttribute('data-theme-source'),
    tokens: {
      bgPrimary: cssVar('--bg-primary'),
      bgSurface: cssVar('--bg-surface'),
      surface1: cssVar('--surface-1'),
      surface2: cssVar('--surface-2'),
      textPrimary: cssVar('--text-primary'),
      textSecondary: cssVar('--text-secondary'),
      accentStrong: cssVar('--color-accent-strong'),
    },
    geometry: {
      sidebar: box(sidebar),
      sidebarStickyInner: sidebar ? box(sidebar.firstElementChild) : null,
      mainColumn: box(mainColumn),
      mainColumnMaxWidth: mainColumn ? style(mainColumn).maxWidth : null,
      mainColumnPaddingLeft: mainColumn ? style(mainColumn).paddingLeft : null,
      statusStrip: box(statusStrip),
      topicsGrid: topicsGrid
        ? {
            box: box(topicsGrid),
            display: style(topicsGrid).display,
            columns: style(topicsGrid).gridTemplateColumns,
            gap: style(topicsGrid).gap,
          }
        : null,
      firstCardWrapper: firstRow ? box(firstRow.parentElement) : null,
      firstCard: box(firstRow),
      cardBorderBox: firstRow ? { bg: style(firstRow).backgroundColor, border: style(firstRow).borderColor, radius: style(firstRow).borderRadius } : null,
      cardWrapperStyles: firstRow && firstRow.parentElement ? { bg: style(firstRow.parentElement).backgroundColor } : null,
      cta: box(cta),
      footerCta: box(footerCta),
      streak: box(streak),
      topicRows: topicButtons.length,
    },
    styles: {
      sidebarActive: activeNav ? { color: style(activeNav).color, bg: style(activeNav).backgroundColor, opacity: style(activeNav).opacity } : null,
      inactiveNav: document.querySelector('[data-testid="sidebar-analytics"]')
        ? { color: style(document.querySelector('[data-testid="sidebar-analytics"]')).color }
        : null,
      cta: cta ? { color: style(cta).color, bg: style(cta).backgroundColor } : null,
      body: { color: style(document.body).color, bg: style(document.body).backgroundColor },
    },
    contrastPairs: pairs,
    truncated,
    truncatedTotal: truncated.length,
    overflows,
  };
};

// ── WCAG 2.x: относительная яркость и отношение контраста ────────────────────
const parseRgb = (value) => {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value || '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (fg, bg) => {
  const a = parseRgb(fg);
  const b = parseRgb(bg);
  if (!a || !b) return null;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
};
/** Порог AA: крупный текст (≥18.66px bold / ≥24px) — 3:1, иначе 4.5:1. */
const requiredRatio = (pxSize, weight) => {
  const bold = Number(weight) >= 700;
  return pxSize >= 24 || (bold && pxSize >= 18.66) ? 3 : 4.5;
};

const rows = [];
const detail = [];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
for (const viewport of VIEWPORTS) {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      colorScheme: theme,
    });
    const page = await context.newPage();
    await blockAnalytics(page);
    await seedHistoryProfile(page, 30);
    await page.goto('/');
    await page.getByTestId('dashboard-subtitle').waitFor({ timeout: 30000 });
    await page.getByTestId('dashboard-topics').waitFor({ timeout: 30000 });
    await page.waitForTimeout(300);

    const shot = resolve(
      OUT_DIR,
      `dashboard-${viewport.width}${theme === 'dark' ? '-dark' : ''}${SUFFIX}.png`,
    );
    await page.screenshot({ path: shot });
    if (theme === 'light') {
      await page.screenshot({
        path: resolve(OUT_DIR, `dashboard-${viewport.width}-full${SUFFIX}.png`),
        fullPage: true,
      });
    }

    const measured = await page.evaluate(COLLECT);
    const contrastResults = measured.contrastPairs.map((pair) => ({
      ...pair,
      ratio: contrast(pair.fg, pair.bg),
      required: requiredRatio(pair.fontPx, pair.fontWeight),
    }));
    const failing = contrastResults.filter((c) => c.ratio !== null && c.ratio < c.required);

    const row = {
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      theme,
      screenshot: shot.replace(/\\/g, '/'),
      overflows: measured.overflows.length,
      overflowSample: measured.overflows.slice(0, 5),
      truncatedTotal: measured.truncatedTotal,
      truncatedSample: measured.truncated.slice(0, 5),
      sidebarVisible: Boolean(measured.geometry.sidebar && measured.geometry.sidebar.w > 0),
      sidebarWidth: measured.geometry.sidebar ? measured.geometry.sidebar.w : 0,
      mainColumnWidth: measured.geometry.mainColumn ? measured.geometry.mainColumn.w : null,
      mainColumnMaxWidth: measured.geometry.mainColumnMaxWidth,
      gridColumns: measured.geometry.topicsGrid ? measured.geometry.topicsGrid.columns : null,
      cardWidth: measured.geometry.firstCard ? measured.geometry.firstCard.w : null,
      ctaWidth: measured.geometry.cta ? measured.geometry.cta.w : null,
      footerCtaWidth: measured.geometry.footerCta ? measured.geometry.footerCta.w : null,
      contrastFailing: failing.map((c) => `${c.name}: ${c.ratio}:1 < ${c.required}:1`),
      contrast: contrastResults.map((c) => `${c.name}=${c.ratio}`),
      tokens: measured.tokens,
      measured,
    };
    rows.push(row);
    detail.push(row);

    console.log(
      `[audit] ${viewport.name} ${theme}: overflows=${row.overflows} truncated=${row.truncatedTotal} ` +
        `sidebar=${row.sidebarWidth} main=${row.mainColumnWidth} cards=${row.gridColumns} ` +
        `cta=${row.ctaWidth} contrastFail=${row.contrastFailing.length}`,
    );
    await context.close();
  }
}
await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  seed: 'seedHistoryProfile(page, 30) — как в e2e/screens.ts openDashboard (visual-regression)',
  phase: SUFFIX === '' ? 'before-fix (коммит 9be3442)' : `after-fix (${SUFFIX})`,  viewports: VIEWPORTS,
  rows: detail,
};
writeFileSync(resolve(OUT_DIR, `report${SUFFIX}.json`), `${JSON.stringify(report, null, 2)}\n`);

// ── таблица в stdout ────────────────────────────────────────────────────────
const pad = (v, n) => String(v).padEnd(n);
console.log('\n| viewport | theme | overflow | trunc | sidebar | main col | max-w | grid | card | CTA | footer CTA | contrast <AA |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(
    `| ${pad(r.viewport, 9)} | ${pad(r.theme, 5)} | ${pad(r.overflows, 8)} | ${pad(r.truncatedTotal, 5)} | ${pad(r.sidebarWidth, 7)} | ${pad(r.mainColumnWidth, 8)} | ${pad(r.mainColumnMaxWidth, 7)} | ${pad(r.gridColumns, 28)} | ${pad(r.cardWidth, 4)} | ${pad(r.ctaWidth, 3)} | ${pad(r.footerCtaWidth, 10)} | ${r.contrastFailing.length === 0 ? '—' : r.contrastFailing.join('; ')} |`,
  );
}
console.log('\n| viewport | theme | contrast |');
console.log('|---|---|---|');
for (const r of rows) {
  console.log(`| ${pad(r.viewport, 9)} | ${pad(r.theme, 5)} | ${r.contrast.join(', ')} |`);
}
console.log(`\n[audit] отчёт: ${OUT_DIR.replace(/\\/g, '/')}/report.json`);
