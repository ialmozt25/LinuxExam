import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';
import { test, expect, freezeClock, waitForFonts } from './fixtures';
import { DESKTOP, MOBILE, SCREENS, rootToTop } from './screens';

/**
 * Accessibility (spec 074): axe-core, WCAG 2.1 A/AA, те же 19 состояний
 * экранов, что и visual baseline (см. `e2e/screens.ts`).
 *
 * Контур приёмки — «baseline + сравнение», а не «ноль violations»: на момент
 * внедрения экраны уже содержат нарушения, и тест, падающий на них, был бы
 * выключен в первый же день (задание запрещает удалять/отключать a11y-тесты).
 *
 * - **Первый прогон** (baseline-файла нет) — нарушения пишутся в
 *   `.project/drafts/a11y-baseline.json`, тест НЕ падает;
 * - **следующие прогоны** — сравнение с baseline по ключу `ruleId|target`;
 *   падение ТОЛЬКО на НОВЫХ `critical`/`serious`; известные идут в отчёт;
 * - перегенерация baseline (после осознанного принятия нового нарушения):
 *   `A11Y_UPDATE=1 npx playwright test e2e/accessibility.spec.ts`;
 * - сводка по каждому экрану -> `.project/drafts/a11y-report.json` (пишется
 *   всегда, в том числе при красном прогоне).
 *
 * Файлы пишутся в `test.afterAll`: по умолчанию Playwright выполняет тесты
 * одного файла последовательно в одном воркере, поэтому накопитель `observed`
 * не требует блокировок и не гоняется с другими воркерами.
 */

const DRAFTS_DIR = resolve(process.cwd(), '.project', 'drafts');
const BASELINE_FILE = resolve(DRAFTS_DIR, 'a11y-baseline.json');
const REPORT_FILE = resolve(DRAFTS_DIR, 'a11y-report.json');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];
/** Импакты, на которых тест падает, если нарушение новое. */
const BLOCKING_IMPACTS: readonly string[] = ['critical', 'serious'];
const IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;
const UPDATE_REQUESTED = process.env.A11Y_UPDATE === '1';

type Impact = (typeof IMPACTS)[number];

interface NodeSnapshot {
  target: string;
  html: string;
  summary: string;
}

interface ViolationSnapshot {
  id: string;
  impact: Impact;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: NodeSnapshot[];
}

interface ScreenSnapshot {
  url: string;
  counts: Record<Impact, number>;
  violations: ViolationSnapshot[];
}

interface BaselineFile {
  generatedAt: string;
  tool: string;
  tags: string[];
  screens: Record<string, ScreenSnapshot>;
}

/* ------------------------------------------------------------ накопитель */

const observed: Record<string, ScreenSnapshot> = {};
const blockingFindings: { screen: string; id: string; impact: Impact; nodes: number }[] = [];
const missingScreens: string[] = [];

const baseline: BaselineFile | null = readBaseline();
const baselineMode = baseline === null || UPDATE_REQUESTED;

function readBaseline(): BaselineFile | null {
  if (!existsSync(BASELINE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as BaselineFile;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    throw new Error(`a11y baseline is unreadable (${BASELINE_FILE}): ${text}`);
  }
}

/** Отпечаток нарушения: правило + цель в DOM. */
function keysOf(screen: ScreenSnapshot | undefined): Set<string> {
  const keys = new Set<string>();
  if (!screen) return keys;
  for (const violation of screen.violations) {
    for (const node of violation.nodes) keys.add(`${violation.id}|${node.target}`);
  }
  return keys;
}

function truncate(value: string, limit = 200): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

function impactOf(value: string | null | undefined): Impact {
  return (IMPACTS as readonly string[]).includes(value ?? '')
    ? (value as Impact)
    : 'minor';
}

function toSnapshot(url: string, violations: readonly Result[]): ScreenSnapshot {
  const counts: Record<Impact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const sorted = [...violations].sort(
    (a, b) => IMPACTS.indexOf(impactOf(a.impact)) - IMPACTS.indexOf(impactOf(b.impact)) ||
      a.id.localeCompare(b.id),
  );

  const result: ViolationSnapshot[] = sorted.map((violation) => {
    const impact = impactOf(violation.impact);
    counts[impact] += 1;
    return {
      id: violation.id,
      impact,
      help: violation.help,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      nodes: violation.nodes.map((node) => ({
        target: Array.isArray(node.target) ? node.target.join(' ') : String(node.target),
        html: truncate(node.html),
        summary: truncate(node.failureSummary ?? ''),
      })),
    };
  });

  return { url, counts, violations: result };
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(DRAFTS_DIR, { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/* ------------------------------------------------------------- сценарии */

test.setTimeout(120_000);

for (const viewport of ['mobile', 'desktop'] as const) {
  test.describe(`a11y: ${viewport}`, () => {
    test.use({
      viewport: viewport === 'mobile' ? MOBILE : DESKTOP,
      colorScheme: 'light',
    });

    for (const screen of SCREENS.filter((item) => item.viewports.includes(viewport))) {
      const screenKey = `${screen.name}-${viewport}`;
      test(`${screenKey}`, async ({ page }) => {
        await freezeClock(page);
        await screen.open(page);
        // Тот же DOM, что и на скриншоте: шрифты готовы, контейнер в начале.
        await waitForFonts(page);
        await rootToTop(page);

        const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const snapshot = toSnapshot(page.url(), results.violations);
        observed[screenKey] = snapshot;

        if (baselineMode) return;

        const known = keysOf(baseline?.screens[screenKey]);
        const fresh = snapshot.violations
          .filter((violation) => BLOCKING_IMPACTS.includes(violation.impact))
          .map((violation) => ({
            violation,
            newNodes: violation.nodes.filter(
              (node) => !known.has(`${violation.id}|${node.target}`),
            ),
          }))
          .filter((item) => item.newNodes.length > 0);

        for (const item of fresh) {
          blockingFindings.push({
            screen: screenKey,
            id: item.violation.id,
            impact: item.violation.impact,
            nodes: item.newNodes.length,
          });
        }

        expect(
          fresh.map(
            (item) => `${item.violation.id} (${item.violation.impact}): ${item.newNodes.length} new node(s)`,
          ),
          `new blocking a11y violations on ${screenKey}; baseline: ${BASELINE_FILE}`,
        ).toEqual([]);
      });
    }
  });
}

/* --------------------------------------------------- baseline + отчёт */

test.afterAll(() => {
  const expectedScreens = SCREENS.flatMap((screen) =>
    screen.viewports.map((viewport) => `${screen.name}-${viewport}`),
  );
  for (const expected of expectedScreens) {
    if (!observed[expected]) missingScreens.push(expected);
  }

  const fixed = discoverFixed();
  writeJson(REPORT_FILE, {
    generatedAt: new Date().toISOString(),
    tool: '@axe-core/playwright',
    tags: TAGS,
    mode: baselineMode ? (UPDATE_REQUESTED ? 'baseline (A11Y_UPDATE=1)' : 'baseline (first run)') : 'compare',
    baselineFile: '.project/drafts/a11y-baseline.json',
    expectedScreens: expectedScreens.length,
    screensObserved: Object.keys(observed).length,
    missingScreens,
    summary: {
      byImpact: countAll(Object.values(observed)),
      newBlocking: blockingFindings.length,
      fixedSinceBaseline: fixed.length,
    },
    newBlocking: blockingFindings,
    fixedSinceBaseline: fixed,
    screens: sortKeys(observed),
  });

  if (baselineMode) {
    writeJson(BASELINE_FILE, {
      generatedAt: new Date().toISOString(),
      tool: '@axe-core/playwright',
      tags: TAGS,
      screens: sortKeys(observed),
    } satisfies BaselineFile);
  }
});

function countAll(screens: readonly ScreenSnapshot[]): Record<Impact, number> & { total: number } {
  const counts: Record<Impact, number> & { total: number } = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    total: 0,
  };
  for (const screen of screens) {
    for (const impact of IMPACTS) counts[impact] += screen.counts[impact];
    counts.total += screen.violations.length;
  }
  return counts;
}

function sortKeys(screens: Record<string, ScreenSnapshot>): Record<string, ScreenSnapshot> {
  return Object.fromEntries(Object.entries(screens).sort(([a], [b]) => a.localeCompare(b)));
}

/** Нарушения, которые были в baseline и исчезли в текущем прогоне. */
function discoverFixed(): { screen: string; id: string; impact: Impact }[] {
  if (!baseline) return [];
  const fixed: { screen: string; id: string; impact: Impact }[] = [];
  for (const [screenKey, screen] of Object.entries(baseline.screens)) {
    const currentKeys = keysOf(observed[screenKey]);
    for (const violation of screen.violations) {
      const stillThere = violation.nodes.some((node) =>
        currentKeys.has(`${violation.id}|${node.target}`),
      );
      if (!stillThere) fixed.push({ screen: screenKey, id: violation.id, impact: violation.impact });
    }
  }
  return fixed;
}
