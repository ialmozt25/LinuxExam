import type { Page } from '@playwright/test';
import {
  expect,
  gotoApp,
  liveRecord,
  readBank,
  resumeSeededRun,
  seedHistoryProfile,
  seedNoAccess,
  seedState,
  TOPIC_QUESTIONS,
  waitForQuestion,
  TESTID,
  type BankQuestion,
  type PersistedQuizState,
} from './fixtures';

/**
 * Рецепты экранов для visual + a11y прогонов (spec 074).
 *
 * Один источник состояний на два спека: визуальный baseline и axe-прогон
 * обязаны смотреть на ОДИН И ТОТ ЖЕ экран в одном и том же состоянии, иначе
 * отчёт a11y описывает не то, что зафиксировано на скриншоте. Именно поэтому
 * рецепты вынесены отдельным модулем (`.ts`, а не `.spec.ts` — Playwright его
 * как тест не подхватывает), а не скопированы в оба файла.
 *
 * Каждый экран открывается СИДОМ из `fixtures.ts`; клики остаются только там,
 * где состояние иначе не создать (вопрос отвечен, экзамен пройден).
 */

export const MOBILE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };
/** Пресет экзамена из спеки: 30 вопросов. */
export const EXAM_PRESET_SIZE = 30;
export const ANCHOR_TIMEOUT = 15_000;
/** Авто-доскролл экрана вопроса (`Question.tsx`, 350 мс) + отрисовка. */
export const SETTLE_MS = 600;

export type ViewportName = 'mobile' | 'desktop';

export interface ScreenCase {
  name: string;
  viewports: readonly ViewportName[];
  open: (page: Page) => Promise<void>;
}

/**
 * `#root` — единственный скролл-контейнер приложения (`html`/`body` имеют
 * `overflow: hidden`). Снимок делается с прокруткой в начало: это состояние, в
 * котором пользователь приходит на экран, и единственное воспроизводимое.
 */
export async function rootToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.getElementById('root');
    if (root) root.scrollTop = 0;
  });
}

/** Полный живой банк по id — для сида «прогон почти закончен». */
function bankById(): Map<string, BankQuestion> {
  const byId = new Map<string, BankQuestion>();
  for (const slug of Object.keys(TOPIC_QUESTIONS)) {
    for (const question of TOPIC_QUESTIONS[slug]) byId.set(question.id, question);
  }
  return byId;
}

/**
 * Сид «регулярный поток пройден на 252 из 253»: `reviewQuestionIds: null`
 * оставляет активным именно регулярный поток, поэтому до Results остаётся ровно
 * один ответ. Идентификаторы берутся из живого манифеста (`_order.json`), а не
 * хардкодятся: банк растёт, и литерал молча разошёлся бы с реальностью.
 */
function almostFinishedRegularRun(): Partial<PersistedQuizState> {
  const order = readBank<string[]>('_order.json');
  const byId = bankById();
  const answers = order.slice(0, order.length - 1).map((id) => {
    const question = byId.get(id);
    if (!question) throw new Error(`live bank drift: _order.json lists unknown "${id}"`);
    return liveRecord(question, true);
  });
  return {
    answers,
    currentIndex: order.length - 1,
    isQuizInProgress: true,
    reviewQuestionIds: null,
    reviewAnswers: [],
    streak: 1,
    totalXp: 10,
  };
}

/* --------------------------------------------------------------- экраны */

/** Профиль с историей: возвращающийся пользователь — самый частый реальный кейс. */
async function openDashboard(page: Page): Promise<void> {
  await seedHistoryProfile(page, 30);
  await gotoApp(page);
  await expect(page.getByTestId(TESTID.dashboardSubtitle)).toBeVisible({ timeout: ANCHOR_TIMEOUT });
}

/** Экран вопроса ПОСЛЕ ответа: именно это состояние ломалось в 067/070/071. */
async function openAnsweredQuestion(page: Page): Promise<void> {
  await seedState(page, { answers: [], currentIndex: 0, isQuizInProgress: false });
  await gotoApp(page);
  await page.getByTestId(TESTID.dashboardContinue).click();
  await waitForQuestion(page);
  await page.locator('[data-testid^="option-"]').first().click();
  await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(TESTID.nextButton)).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(SETTLE_MS);
}

async function openResults(page: Page): Promise<void> {
  await seedState(page, almostFinishedRegularRun());
  await gotoApp(page);
  await resumeSeededRun(page);
  await page.locator('[data-testid^="option-"]').first().click();
  await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10_000 });
  await page.getByTestId(TESTID.nextButton).click();
  await expect(page.getByTestId(TESTID.resultsScreen)).toBeVisible({ timeout: ANCHOR_TIMEOUT });
}

async function startExamRun(page: Page): Promise<void> {
  await gotoApp(page);
  await page.getByTestId('exam-mode').click();
  await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: ANCHOR_TIMEOUT });
  await page.getByTestId('preset-30').click();
  await page.getByTestId('exam-start').click();
  await expect(page.getByTestId('exam-run')).toBeVisible({ timeout: ANCHOR_TIMEOUT });
}

async function openExamSetup(page: Page): Promise<void> {
  await gotoApp(page);
  await page.getByTestId('exam-mode').click();
  await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: ANCHOR_TIMEOUT });
}

async function openExamRun(page: Page): Promise<void> {
  await startExamRun(page);
  // Прогон session-only (в `partialize` не попадает), поэтому состояние
  // «экзамен идёт» сидом не поднимается — его создаёт только UI.
  await page.getByTestId('exam-option-0').click();
  await expect(page.getByTestId('exam-submit')).toBeEnabled();
}

async function openExamResults(page: Page): Promise<void> {
  await startExamRun(page);
  for (let answered = 1; answered <= EXAM_PRESET_SIZE; answered++) {
    await page.getByTestId('exam-option-0').click();
    await expect(page.getByTestId('exam-submit')).toBeEnabled();
    await page.getByTestId('exam-submit').click();
    if (answered < EXAM_PRESET_SIZE) {
      await expect(page.getByTestId('exam-progress')).toHaveText(
        `Вопрос ${answered + 1} / ${EXAM_PRESET_SIZE}`,
        { timeout: ANCHOR_TIMEOUT },
      );
    }
  }
  await expect(page.getByTestId('exam-results')).toBeVisible({ timeout: ANCHOR_TIMEOUT });
}

async function openAnalytics(page: Page): Promise<void> {
  await seedHistoryProfile(page, 30);
  await gotoApp(page);
  await page.getByTestId('analytics-mode').click();
  await expect(page.getByTestId('analytics')).toBeVisible({ timeout: ANCHOR_TIMEOUT });
}

async function openPaywall(page: Page): Promise<void> {
  await seedNoAccess(page);
  await gotoApp(page);
  const proRow = page.locator('[data-testid^="topic-"]').filter({ hasText: 'PRO' }).first();
  await expect(proRow).toBeVisible({ timeout: ANCHOR_TIMEOUT });
  await proRow.click();
  await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: ANCHOR_TIMEOUT });
}

/**
 * Все 8 значений `Screen` (`src/store/quizStore.ts`): по экрану на каждый
 * viewport (390×844 mobile, 1440×900 desktop). Онбординг-экрана в списке больше
 * нет — задание «удалить демо-квиз» убрало последний из них, и свежий профиль
 * попадает сразу на Dashboard, поэтому первый экран приложения описывает
 * baseline `dashboard-*`.
 */
export const SCREENS: readonly ScreenCase[] = [
  { name: 'dashboard', viewports: ['mobile', 'desktop'], open: openDashboard },
  { name: 'question', viewports: ['mobile', 'desktop'], open: openAnsweredQuestion },
  { name: 'results', viewports: ['mobile', 'desktop'], open: openResults },
  { name: 'exam-setup', viewports: ['mobile', 'desktop'], open: openExamSetup },
  { name: 'exam-run', viewports: ['mobile', 'desktop'], open: openExamRun },
  { name: 'exam-results', viewports: ['mobile', 'desktop'], open: openExamResults },
  { name: 'analytics', viewports: ['mobile', 'desktop'], open: openAnalytics },
  { name: 'paywall', viewports: ['mobile', 'desktop'], open: openPaywall },
];
