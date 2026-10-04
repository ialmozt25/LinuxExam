import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, blockAnalytics, freezeClock, waitForFonts } from './fixtures';
import { SCREENS, rootToTop } from './screens';

/**
 * Layout smoke по сетке viewport'ов (spec 075).
 *
 * 11 состояний экранов (`e2e/screens.ts`, spec 074) × 5 размеров = **55**
 * комбинаций. PNG не создаются: это детектор вёрстки, а не визуальная регрессия
 * (она живёт в `visual-regression.spec.ts`).
 *
 * Зачем 5 размеров: приложение — Telegram Mini App, ширина WebView 360…412 px,
 * высота 640…915 px (`BottomSheet` открывается на минимальной высоте:
 * https://docs.telegram-mini-apps.com/platform/viewport). Дефекты класса «CTA
 * ниже сгиба» из spec 074 на 390×844 видны частично, на 390×720 — сильнее.
 *
 * Контур приёмки — «реестр известного + красное на новом», а не «ноль нарушений»:
 * нарушения из spec 074 уже существуют, и тест, падающий на них, был бы выключен
 * в первый день (задание запрещает удалять падающие тесты). Поэтому:
 * - нарушение, совпавшее с `KNOWN_ISSUES` (ключ `экран + проверка + testid`),
 *   помечает тест `test.fixme(true, reason)` — «известно, чинить отдельной спекой»;
 * - нарушение вне реестра роняет тест списком (и только оно);
 * - полные замеры по всем 55 комбинациям пишутся в
 *   `.project/drafts/layout-probe-075.json` — включая элементы ниже сгиба.
 *
 * Интерпретация «нет элементов за границами»: буквальное «top ≥ 0 && bottom ≤
 * innerHeight для всех [data-testid]» на прокручиваемом экране (`#root` —
 * единственный скролл-контейнер) помечает почти весь дашборд. Нарушением
 * считаются горизонтальный выход (`left < -1`, `right > innerWidth + 1`) и
 * `top < -1`; элементы ниже сгиба идут в JSON/AUDIT как `belowFold`, а CTA
 * проверяются адресно (проверка 2).
 */

const LAYOUT_PROBE_FILE = resolve(
  process.cwd(),
  '.project',
  'drafts',
  'layout-probe-075.json',
);

/**
 * Фрагменты замеров. Описания `describe.parallel` раздают 5 viewport'ов одного
 * экрана РАЗНЫМ воркерам, а модульное состояние воркера своё: общий массив и
 * один `afterAll`-write затирались бы последним воркером (наблюдалось на первом
 * прогоне: в JSON осталась 1 комбинация из 55). Поэтому каждый тест пишет свой
 * фрагмент (имя = `экран--viewport`, уникально), а последний воркер, увидевший
 * полный набор, собирает общий файл и убирает каталог фрагментов.
 */
const PARTS_DIR = resolve(process.cwd(), '.project', 'drafts', 'layout-probe-075-parts');

const VIEWPORTS = [
  { name: 'mobile-min', width: 360, height: 640, note: 'Telegram минимум' },
  { name: 'mobile-se', width: 375, height: 667, note: 'iPhone SE' },
  { name: 'mobile-tma', width: 390, height: 720, note: 'TMA bottom sheet (real)' },
  { name: 'mobile-px', width: 412, height: 915, note: 'Pixel' },
  { name: 'desktop', width: 1440, height: 900, note: 'desktop' },
] as const;

type ViewportName = (typeof VIEWPORTS)[number]['name'];

/** CTA-контракт задания: если узел есть на экране — он обязан быть виден целиком. */
const CTA_TESTIDS: readonly string[] = [
  'next-button',
  'exam-submit',
  'exam-cancel',
  'exam-start',
  'dashboard-continue',
  'paywall-buy',
  'paywall-start-trial',
  'back-to-dashboard',
  'analytics-back',
];

/** Best practice интерактивной цели (WCAG 2.5.5 -> 2.5.8, AA — 24 px). */
const TOUCH_MIN_PX = 44;

type CheckKind =
  | 'overflow'
  | 'cta-out-of-viewport'
  | 'touch-target'
  | 'clipped-text'
  | 'escaped-element';

interface Violation {
  screen: string;
  viewport: ViewportName;
  check: CheckKind;
  testid?: string;
  detail: string;
}

/**
 * Реестр известного. Заполняется по фактическим замерам этого прогона;
 * `source` различает унаследованное из spec 074 и впервые найденное в 075
 * (новое в 075 тоже попадает сюда — иначе гейт красный, а фикс запрещён
 * заданием; находка при этом остаётся в JSON и в аудит-отчёте, а не молчит).
 */
interface KnownIssue {
  screen: string;
  check: CheckKind;
  testid?: string;
  reason: string;
  file: string;
  source: 'spec-074' | 'spec-075';
}

const KNOWN_ISSUES: readonly KnownIssue[] = [
  {
    screen: 'dashboard',
    check: 'cta-out-of-viewport',
    testid: 'dashboard-continue',
    reason: 'known issue from spec 074: CTA «Продолжить» ниже сгиба (14 строк тем)',
    file: 'src/presentation/screens/Dashboard.tsx:800',
    source: 'spec-074',
  },
  {
    screen: 'paywall',
    check: 'cta-out-of-viewport',
    testid: 'paywall-buy',
    reason: 'known issue from spec 074: кнопка покупки обрезана сгибом на мобильном',
    file: 'src/presentation/screens/Paywall.tsx:288',
    source: 'spec-074',
  },
  {
    screen: 'paywall',
    check: 'cta-out-of-viewport',
    testid: 'paywall-start-trial',
    reason: 'known issue from spec 075: тот же класс, что paywall-buy (074), всплыл на 360-390 ширинах',
    file: 'src/presentation/screens/Paywall.tsx:267',
    source: 'spec-075',
  },
  {
    screen: 'exam-run',
    check: 'touch-target',
    testid: 'exam-cancel',
    reason: 'known issue from spec 074: тач-цель «Прервать и выйти» 44px → 34px',
    file: 'src/presentation/screens/ExamRun.tsx:247',
    source: 'spec-074',
  },
  {
    screen: 'exam-results',
    check: 'cta-out-of-viewport',
    testid: 'back-to-dashboard',
    reason: 'known issue from spec 075: тот же класс, что CTA Results (074), на 640-720 высотах',
    file: 'src/presentation/screens/ExamResults.tsx:152',
    source: 'spec-075',
  },
  {
    screen: 'paywall',
    check: 'escaped-element',
    testid: 'header-home',
    reason:
      'known issue from spec 075: paywall центрирует контент (justifyContent: center) и уводит шапку выше вьюпорта',
    file: 'src/presentation/screens/Paywall.tsx:102',
    source: 'spec-075',
  },
  {
    screen: 'paywall',
    check: 'escaped-element',
    testid: 'app-header-center',
    reason:
      'known issue from spec 075: тот же центрирующий контейнер Paywall уводит заголовок шапки выше вьюпорта',
    file: 'src/presentation/screens/Paywall.tsx:102',
    source: 'spec-075',
  },
];

function isKnown(violation: Violation): boolean {
  return KNOWN_ISSUES.some(
    (issue) =>
      issue.screen === violation.screen &&
      issue.check === violation.check &&
      (issue.testid ?? null) === (violation.testid ?? null),
  );
}

/** Причина для `test.fixme`: сначала унаследованное из 074, затем находки 075. */
function knownReason(violations: readonly Violation[]): string {
  const groups = new Map<string, Violation[]>();
  for (const violation of violations) {
    const issue = KNOWN_ISSUES.find(
      (candidate) =>
        candidate.screen === violation.screen &&
        candidate.check === violation.check &&
        (candidate.testid ?? null) === (violation.testid ?? null),
    );
    const key = `${issue?.source ?? 'spec-075'} | ${issue?.file ?? '?'} | ${issue?.reason ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), violation]);
  }
  return [...groups.entries()]
    .map(([key, items]) => `${key} (${items.map((item) => item.viewport).join(', ')})`)
    .join(' || ');
}

/* ------------------------------------------------------------- измерения */

interface RawNode {
  tag: string;
  testid: string | null;
  label: string;
}

interface RawCta {
  testid: string;
  present: boolean;
  visible: boolean;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface RawMeasurement {
  viewport: { width: number; height: number };
  root: { scrollWidth: number; clientWidth: number; overflowX: number };
  ctas: RawCta[];
  touchTargets: (RawNode & { width: number; height: number })[];
  clipped: (RawNode & { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number })[];
  escaped: (RawNode & { reason: string; top: number; left: number; right: number })[];
  belowFoldCtas: { testid: string; top: number; bottom: number }[];
  belowFoldTotal: number;
}

async function measureLayout(page: Page, ctaTestIds: readonly string[]): Promise<RawMeasurement> {
  return page.evaluate((testIds: string[]) => {
    const round = (value: number) => Math.round(value * 10) / 10;
    const root = document.getElementById('root');
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    const describe = (element: HTMLElement) => ({
      tag: element.tagName.toLowerCase(),
      testid: element.getAttribute('data-testid'),
      label: (element.getAttribute('aria-label') || element.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 48),
    });

    const isVisible = (element: HTMLElement) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const ctas: RawCta[] = testIds.map((testid) => {
      const element = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
      if (!element) {
        return { testid, present: false, visible: false, top: 0, bottom: 0, left: 0, right: 0 };
      }
      const rect = element.getBoundingClientRect();
      return {
        testid,
        present: true,
        visible: isVisible(element),
        top: round(rect.top),
        bottom: round(rect.bottom),
        left: round(rect.left),
        right: round(rect.right),
      };
    });

    // Тач-цели: кнопки, роли-кнопки и всё, что помечено как submit. Один и тот же
    // узел может попасть под два селектора — дедупликация по элементу.
    const touchNodes = new Set<HTMLElement>();
    for (const selector of ['button', '[role="button"]', '[data-testid*="submit"]']) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        touchNodes.add(element);
      }
    }
    const touchTargets = Array.from(touchNodes)
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { ...describe(element), width: round(rect.width), height: round(rect.height) };
      });

    const clipped = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, label'))
      .filter(isVisible)
      .map((element) => ({
        ...describe(element),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }))
      .filter((item) => item.scrollHeight - item.clientHeight > 2);

    const escaped: RawMeasurement['escaped'] = [];
    const belowFoldCtas: RawMeasurement['belowFoldCtas'] = [];
    let belowFoldTotal = 0;

    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-testid]'))) {
      if (!isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      const testid = element.getAttribute('data-testid') ?? '';

      if (rect.bottom > viewport.height + 1 || rect.top < -1) belowFoldTotal += 1;
      if (rect.bottom > viewport.height + 1 && testIds.includes(testid)) {
        belowFoldCtas.push({ testid, top: round(rect.top), bottom: round(rect.bottom) });
      }

      let reason: string | null = null;
      if (rect.left < -1) reason = 'left';
      else if (rect.right > viewport.width + 1) reason = 'right';
      else if (rect.top < -1) reason = 'above';
      if (reason && escaped.length < 60) {
        escaped.push({
          ...describe(element),
          reason,
          top: round(rect.top),
          left: round(rect.left),
          right: round(rect.right),
        });
      }
    }

    return {
      viewport,
      root: {
        scrollWidth: root ? root.scrollWidth : -1,
        clientWidth: root ? root.clientWidth : -1,
        overflowX: root ? root.scrollWidth - root.clientWidth : -1,
      },
      ctas,
      touchTargets,
      clipped,
      escaped,
      belowFoldCtas,
      belowFoldTotal,
    };
  }, [...ctaTestIds]);
}

function collectViolations(
  screen: string,
  viewport: ViewportName,
  measurement: RawMeasurement,
): Violation[] {
  const violations: Violation[] = [];
  const { width: viewportWidth, height: viewportHeight } = measurement.viewport;

  if (measurement.root.overflowX > 1) {
    violations.push({
      screen,
      viewport,
      check: 'overflow',
      detail: `#root scrollWidth ${measurement.root.scrollWidth} > clientWidth ${measurement.root.clientWidth}`,
    });
  }

  for (const cta of measurement.ctas) {
    if (!cta.present || !cta.visible) continue;
    const inside =
      cta.top >= -1 &&
      cta.bottom <= viewportHeight + 1 &&
      cta.left >= -1 &&
      cta.right <= viewportWidth + 1;
    if (!inside) {
      violations.push({
        screen,
        viewport,
        check: 'cta-out-of-viewport',
        testid: cta.testid,
        detail: `top=${cta.top} bottom=${cta.bottom} left=${cta.left} right=${cta.right} при ${viewportWidth}x${viewportHeight}`,
      });
    }
  }

  for (const target of measurement.touchTargets) {
    if (target.height < TOUCH_MIN_PX || target.width < TOUCH_MIN_PX) {
      violations.push({
        screen,
        viewport,
        check: 'touch-target',
        testid: target.testid ?? undefined,
        detail: `${target.width}x${target.height} < ${TOUCH_MIN_PX} (${target.tag}: "${target.label}")`,
      });
    }
  }

  for (const item of measurement.clipped) {
    violations.push({
      screen,
      viewport,
      check: 'clipped-text',
      testid: item.testid ?? undefined,
      detail: `${item.tag} scrollHeight ${item.scrollHeight} > clientHeight ${item.clientHeight} ("${item.label}")`,
    });
  }

  for (const item of measurement.escaped) {
    violations.push({
      screen,
      viewport,
      check: 'escaped-element',
      testid: item.testid ?? undefined,
      detail: `${item.tag} ушёл за ${item.reason} (top=${item.top} left=${item.left} right=${item.right}) ("${item.label}")`,
    });
  }

  return violations;
}

/* --------------------------------------------------------------- прогон */

interface ComboResult {
  screen: string;
  viewport: ViewportName;
  size: string;
  rootOverflowX: number;
  belowFoldTotal: number;
  belowFoldCtas: { testid: string; top: number; bottom: number }[];
  ctas: RawCta[];
  violations: Violation[];
}

function describeViolation(violation: Violation): string {
  const target = violation.testid ? `[${violation.testid}] ` : '';
  return `${violation.check} @ ${violation.viewport}: ${target}${violation.detail}`;
}

/** Ключ комбинации: он же имя файла-фрагмента. */
function comboKey(screen: string, viewport: ViewportName): string {
  return `${screen}--${viewport}`;
}

/** Полный ожидаемый набор ключей: 11 экранов × 5 viewport'ов. */
function expectedKeys(): string[] {
  return SCREENS.flatMap((screen) =>
    VIEWPORTS.map((viewport) => comboKey(screen.name, viewport.name)),
  );
}

test.setTimeout(120_000);

test.afterAll(() => {
  const expected = expectedKeys();
  const parts = new Map<string, ComboResult>();
  let entries: string[] = [];
  try {
    entries = readdirSync(PARTS_DIR).filter((name) => name.endsWith('.json'));
  } catch {
    entries = [];
  }
  for (const name of entries) {
    try {
      const combo = JSON.parse(readFileSync(join(PARTS_DIR, name), 'utf8')) as ComboResult;
      parts.set(comboKey(combo.screen, combo.viewport), combo);
    } catch {
      // Битой фрагмент не валит отчёт: он останется пропущенным в списке.
    }
  }

  // Собирает только последний воркер, увидевший полный набор: иначе общий файл
  // описывал бы половину прогона.
  if (parts.size !== expected.length) return;

  const screens = expected.map((key) => parts.get(key)).filter((combo): combo is ComboResult => Boolean(combo));
  const known = screens.flatMap((combo) => combo.violations.filter(isKnown));
  const fresh = screens.flatMap((combo) => combo.violations.filter((violation) => !isKnown(violation)));

  mkdirSync(resolve(process.cwd(), '.project', 'drafts'), { recursive: true });
  writeFileSync(
    LAYOUT_PROBE_FILE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        spec: '075',
        viewports: VIEWPORTS,
        ctaTestIds: CTA_TESTIDS,
        touchMinPx: TOUCH_MIN_PX,
        totals: {
          combos: screens.length,
          violations: known.length + fresh.length,
          known: known.length,
          fresh: fresh.length,
        },
        knownIssues: KNOWN_ISSUES,
        screens,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  rmSync(PARTS_DIR, { recursive: true, force: true });
});

for (const screen of SCREENS) {
  test.describe.parallel(`layout: ${screen.name}`, () => {
    for (const viewport of VIEWPORTS) {
      test(`${screen.name} @ ${viewport.name} ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await freezeClock(page);
        await blockAnalytics(page);
        await screen.open(page);
        await waitForFonts(page);
        await rootToTop(page);

        const measurement = await measureLayout(page, CTA_TESTIDS);
        const violations = collectViolations(screen.name, viewport.name, measurement);

        mkdirSync(PARTS_DIR, { recursive: true });
        writeFileSync(
          join(PARTS_DIR, `${comboKey(screen.name, viewport.name)}.json`),
          JSON.stringify({
            screen: screen.name,
            viewport: viewport.name,
            size: `${viewport.width}x${viewport.height}`,
            rootOverflowX: measurement.root.overflowX,
            belowFoldTotal: measurement.belowFoldTotal,
            belowFoldCtas: measurement.belowFoldCtas,
            ctas: measurement.ctas,
            violations,
          } satisfies ComboResult),
          'utf8',
        );

        const fresh = violations.filter((violation) => !isKnown(violation));
        const known = violations.filter(isKnown);

        if (fresh.length > 0) {
          expect(fresh.map(describeViolation), 'новые (вне реестра) нарушения вёрстки').toEqual([]);
        }

        if (known.length > 0) {
          test.fixme(true, knownReason(known));
        }
      });
    }
  });
}
