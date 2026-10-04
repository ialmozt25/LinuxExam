import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, TOPICS, gotoApp, seedHistoryProfile, TESTID } from './fixtures';

/**
 * Регрессия контраста (spec 079): 4 элемента, которые падали в `npm run check`
 * (`COLOR-001`/`COLOR-003`) на прогоне 2026-10-04.
 *
 * Смысл спека — узкий и быстрый гейт: axe запускается ТОЛЬКО на конкретном
 * элементе (`include`), а не на всём экране, поэтому падение однозначно
 * указывает на цель спеки, а не на посторонний узел. Полный перебор 19 экранов
 * остаётся за `e2e/accessibility.spec.ts` — он источник
 * `.project/drafts/a11y-baseline.json`, из которого `npm run check` берёт узлы.
 *
 * Порог — WCAG 2.2 AA 1.4.3: 4.5:1 для обычного текста. Все четыре цели — 12-16px
 * без bold-порога крупного текста (крупный в axe — от 18pt, либо от 14pt при
 * bold), то есть мягкий порог 3:1 к ним НЕ применяется.
 *
 * Тема фиксируется явно (`light`): именно светлая тема дала падения в baseline,
 * и именно её снимает `e2e/visual-regression.spec.ts`.
 */

/** Правило axe, которым меряется контраст (тот же, что и в COLOR-001). */
const RULE = 'color-contrast';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

// Полный 30-вопросный прогон экзамена (сценарий back-to-dashboard) не влезает
// в дефолтные 30 с — тот же бюджет, что у `accessibility.spec.ts` и
// `visual-regression.spec.ts`.
test.setTimeout(120_000);

/**
 * Селекторы целей. Первые три — точные пары из baseline прогона 2026-10-04
 * (`2.59`, `3.10`, `3.12`, `3.96`); четвёртая цель спеки — подсказка
 * `topic-first-cta` (`4.14`).
 */
const TOPIC_CTA = '[data-testid="topic-first-cta"]';
const TOPIC_BADGE_FREE = `[data-testid="topic-${TOPICS[0].key}"] [data-testid="paywall-badge-free"]`;
const EXAM_SUBMIT = '[data-testid="exam-submit"]';
const EXAM_START = '[data-testid="exam-start"]';
const BACK_TO_DASHBOARD = '[data-testid="back-to-dashboard"]';
const REVIEW_WRONG = `button[data-testid="${TESTID.reviewWrong}"] > span:nth-child(2)`;

/** Дочерние узлы, на которых axe и падал: сам span со счётчиком, а не кнопка. */
const REVIEW_WRONG_NODES = `${REVIEW_WRONG}, button[data-testid="${TESTID.reviewWrong}"] > span:nth-child(1)`;

function contrast(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS).withRules([RULE]);
}

/** Отчёт «какой узел и с каким коэффициентом» — чтобы падение было читаемым. */
function report(results: Awaited<ReturnType<ReturnType<typeof contrast>['analyze']>>): string {
  const lines: string[] = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      lines.push(`${node.target.join(' ')} — ${(node.failureSummary ?? '').replace(/\s+/g, ' ')}`);
    }
  }
  return lines.join('\n');
}

test.describe('regression 079: контраст ≥ 4.5:1', () => {
  test.use({ colorScheme: 'light' });

  test('paywall-badge-free — бейдж «Бесплатно» на бейдж-плашке #EAEAEA', async ({ page }) => {
    await seedHistoryProfile(page, 30);
    await gotoApp(page);

    const badge = page.locator(TOPIC_BADGE_FREE).first();
    await expect(badge).toBeVisible();
    // Стейт-гард: элемент на светлой плашке, а не «повезло с фоном».
    await expect(badge).toHaveCSS('background-color', 'rgb(234, 234, 234)');

    const results = await contrast(page).include(TOPIC_BADGE_FREE).analyze();
    expect(report(results), `paywall-badge-free: ${report(results)}`).toBe('');
  });

  test('topic-first-cta — подсказка «начните с этой» на той же плашке', async ({ page }) => {
    await seedHistoryProfile(page, 30);
    await gotoApp(page);

    const cta = page.locator(TOPIC_CTA);
    await expect(cta).toHaveCount(1);
    await expect(cta).toBeVisible();

    const results = await contrast(page).include(TOPIC_CTA).analyze();
    expect(report(results), `topic-first-cta: ${report(results)}`).toBe('');
  });

  test('accent-button — 4 акцентные кнопки: белый текст на заливке', async ({ page }) => {
    const expected = 'rgb(21, 101, 192)';

    // 1. exam-start (ExamSetup)
    await gotoApp(page);
    await page.getByTestId('exam-mode').click();
    await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('preset-30').click();
    const start = page.getByTestId('exam-start');
    await expect(start).toBeEnabled();
    await expect(start).toHaveCSS('background-color', expected);
    expect(
      report(await contrast(page).include(EXAM_START).analyze()),
      'exam-start не проходит 4.5:1',
    ).toBe('');

    // 2. exam-submit (ExamRun) — прогон session-only, поднимается только UI.
    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('exam-option-0').click();
    const submit = page.getByTestId('exam-submit');
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveCSS('background-color', expected);
    expect(
      report(await contrast(page).include(EXAM_SUBMIT).analyze()),
      'exam-submit не проходит 4.5:1',
    ).toBe('');
  });

  test('accent-button — back-to-dashboard (ExamResults, экзамен пройден)', async ({ page }) => {
    const PRESET = 30;
    await gotoApp(page);
    await page.getByTestId('exam-mode').click();
    await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('preset-30').click();
    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible({ timeout: 15_000 });
    for (let answered = 1; answered <= PRESET; answered += 1) {
      await page.getByTestId('exam-option-0').click();
      await page.getByTestId('exam-submit').click();
      if (answered < PRESET) {
        await expect(page.getByTestId('exam-progress')).toHaveText(`Вопрос ${answered + 1} / ${PRESET}`, {
          timeout: 15_000,
        });
      }
    }
    await expect(page.getByTestId('exam-results')).toBeVisible({ timeout: 15_000 });

    const back = page.getByTestId('back-to-dashboard');
    await expect(back).toHaveCSS('background-color', 'rgb(21, 101, 192)');

    const results = await contrast(page).include(BACK_TO_DASHBOARD).analyze();
    expect(report(results), `back-to-dashboard: ${report(results)}`).toBe('');
  });

  test('review-wrong — счётчик «N вопр.» на подложке rgba(244,67,54,0.1)', async ({ page }) => {
    await seedHistoryProfile(page, 30);
    await gotoApp(page);

    const counter = page.locator(REVIEW_WRONG);
    await expect(counter).toBeVisible();
    await expect(page.getByTestId(TESTID.reviewWrong)).toBeVisible();

    const results = await contrast(page).include(REVIEW_WRONG_NODES).analyze();
    expect(report(results), `review-wrong: ${report(results)}`).toBe('');
  });
});
