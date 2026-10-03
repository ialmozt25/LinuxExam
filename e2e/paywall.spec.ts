import {
  test,
  expect,
  gotoApp,
  startTopic,
  topicButton,
  topicSize,
  answerQuestion,
  optionButtons,
  waitForQuestion,
  waitForDashboard,
  readPersisted,
  seedNoAccess,
  TESTID,
} from './fixtures';

/**
 * G5 (free-question gate / paywall) from `.project/drafts/app-map.md` §6,
 * плюс контентный paywall spec 063 (3 Free-темы / 11 Paid + trial).
 *
 * Спека знает ДВА входа на один экран: гейт бесплатных ВОПРОСОВ (шестой вопрос
 * обычного прогона поднимает `isPaywallVisible`) и гейт ТЕМ (клик по платной
 * теме без Pro и без активного trial). Первый `describe` проверяет старый
 * инвариант, второй — новый (spec 063).
 *
 * The frozen INTENDED behaviour (the index does not advance while the paywall is
 * up) is deliberately not pinned here — app-map §7 excludes it.
 */

const TOPIC = 'file_permissions';
const FREE_LIMIT = 5;
/** Платная тема (spec 063): не входит в FREE_TOPICS. */
const PAID_TOPIC = 'networking';

/** Answers `count` questions of the regular stream, ending ON question `count`. */
async function reachFreeLimit(page: import('@playwright/test').Page) {
  await page.getByTestId(TESTID.dashboardContinue).click();
  await waitForQuestion(page);
  await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(/^1\s*\/\s*\d+$/);

  for (let i = 1; i < FREE_LIMIT; i++) {
    await answerQuestion(page, 'correct');
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^${i + 1}\\s*/\\s*\\d+$`)
    );
  }
  // Question 5 (the last free one) is answered but the step has not been taken yet.
  await answerQuestion(page, 'correct');
}

test.describe('пейволл — гейт бесплатных вопросов', () => {
  test('appears when a free user tries to leave the fifth question', async ({ page }) => {
    await gotoApp(page);
    await reachFreeLimit(page);

    await page.getByTestId(TESTID.nextButton).click();

    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Бесплатные вопросы закончились' })).toBeVisible();
    await expect(page.getByTestId(TESTID.paywallBuy)).toBeVisible();
    await expect(page.getByTestId(TESTID.paywallLater)).toBeVisible();
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText('LinuxExam');
  });

  test('«Не сейчас» скрывает paywall, не открывает Pro — лимит держится', async ({ page }) => {
    await gotoApp(page);
    await reachFreeLimit(page);
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });

    await page.getByTestId(TESTID.paywallLater).click();
    await waitForDashboard(page);

    // isPro must be untouched, and the regular progress is still recorded.
    const persisted = await page.evaluate(() => {
      const raw = window.localStorage.getItem('rhcsa_progress');
      return raw ? JSON.parse(raw).state : null;
    });
    expect(persisted?.isPro).toBe(false);
    expect(persisted?.answers).toHaveLength(FREE_LIMIT);

    // The banner resumes the run — and the gate blocks the very next step again.
    await expect(page.getByTestId(TESTID.resumeBanner)).toBeVisible();
    await page.getByTestId(TESTID.resumeButton).click();
    await waitForQuestion(page);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^${FREE_LIMIT}\\s*/\\s*\\d+$`)
    );
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });
  });

  test('«Купить» — заглушка spec 064: Pro НЕ открывается', async ({ page }) => {
    await gotoApp(page);
    await reachFreeLimit(page);
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });

    const buy = page.getByTestId(TESTID.paywallBuy);
    await expect(buy).toContainText('Купить — 299 Stars/мес');
    await buy.click();

    // Платёжный flow не открывается: экран не меняется, сообщение-заглушка на месте.
    await expect(page.getByTestId(TESTID.paywallPurchaseNotice)).toBeVisible();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible();
    await expect(page.getByTestId(TESTID.questionText)).toHaveCount(0);

    const persisted = await page.evaluate(() => {
      const raw = window.localStorage.getItem('rhcsa_progress');
      return raw ? JSON.parse(raw).state : null;
    });
    expect(persisted?.isPro).toBe(false);

    // Гейт держится: следующий шаг снова упирается в paywall.
    await page.getByTestId(TESTID.paywallLater).click();
    await waitForDashboard(page);
    await page.getByTestId(TESTID.resumeButton).click();
    await waitForQuestion(page);
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });
  });

  test('a topic quiz is never paywalled, even past the free limit', async ({ page }) => {
    await gotoApp(page);
    const size = await startTopic(page, TOPIC);
    expect(size).toBeGreaterThan(FREE_LIMIT);

    // Review is a study mode: the gate does not apply (B1 regression).
    for (let i = 1; i <= FREE_LIMIT; i++) {
      await answerQuestion(page, 'correct');
      await page.getByTestId(TESTID.nextButton).click();
      await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
        new RegExp(`^${i + 1}\\s*/\\s*${size}$`)
      );
    }
    await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);

    // The header home button is still the way out, and the topic keeps its counter.
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);
    await expect(topicButton(page, TOPIC)).toContainText(`${topicSize(TOPIC)} вопр.`);
  });

  test('an exam runs past the free limit without a paywall', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId(TESTID.startExam).click();
    await waitForQuestion(page);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      /^1\s*\/\s*20\s*·\s*\d{2}:\d{2}$/
    );

    // The exam itself is an easier start for the loop below (its questions are
    // answered without any feedback), so the option is clicked directly here.
    const size = 20;
    for (let i = 1; i <= FREE_LIMIT; i++) {
      const labels = await optionButtons(page).evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute('aria-label') ?? '')
      );
      expect(labels).toHaveLength(4);
      await page.getByRole('button', { name: labels[0], exact: true }).click();
      await page.getByTestId(TESTID.nextButton).click();

      if (i < FREE_LIMIT) {
        await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
          new RegExp(`^${i + 1}\\s*/\\s*${size}\\s*·\\s*\\d{2}:\\d{2}$`)
        );
      }
    }

    // The exam is never paywalled: question 6 of 20 is on screen, not the paywall.
    await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^${FREE_LIMIT + 1}\\s*/\\s*${size}\\s*·\\s*\\d{2}:\\d{2}$`)
    );
    // Exam mode gives no feedback at all.
    await expect(page.getByTestId(TESTID.explanation)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.explanationVerdict)).toHaveCount(0);
  });
});

/**
 * Контентный paywall (spec 063). Профиль без Pro и без trial-а сеется ДО
 * навигации (`seedNoAccess`), поэтому приложение стартует в этом состоянии.
 */
test.describe('пейволл — контентный (3 Free / 11 Paid)', () => {
  test('Free-тема открывается без paywall', async ({ page }) => {
    await seedNoAccess(page);
    await gotoApp(page);

    await startTopic(page, TOPIC);

    await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.questionText)).toBeVisible();
  });

  test('Paid-тема без Pro и без trial поднимает paywall и прогон не стартует', async ({ page }) => {
    await seedNoAccess(page);
    await gotoApp(page);

    await topicButton(page, PAID_TOPIC).click();

    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(TESTID.questionText)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText('LinuxExam');

    // Секции экрана: 3 бесплатные темы и 11 платных.
    await expect(page.getByTestId(TESTID.paywallFreeTopics)).toContainText('Бесплатно: 3 темы');
    await expect(page.getByTestId(TESTID.paywallPaidTopics)).toContainText(
      'Pro: 11 тем + Exam + Analytics'
    );
  });

  test('«Попробовать 7 дней бесплатно» → Dashboard, Paid-тема открывается', async ({ page }) => {
    await seedNoAccess(page);
    await gotoApp(page);
    await topicButton(page, PAID_TOPIC).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });

    const trial = page.getByTestId(TESTID.paywallStartTrial);
    await expect(trial).toContainText('Попробовать 7 дней бесплатно');
    await trial.click();

    await waitForDashboard(page);

    // Trial записан, Pro по-прежнему не куплен.
    const persisted = await readPersisted(page);
    const startedAt = persisted?.state.trialStartedAt as number | null | undefined;
    expect(typeof startedAt).toBe('number');
    expect(persisted?.state.isPro).toBe(false);

    // Paid-тема теперь открывается — и без paywall.
    const size = await startTopic(page, PAID_TOPIC);
    await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^1\\s*/\\s*${size}$`)
    );
  });

  test('«Не сейчас» → Dashboard без trial, Paid-тема по-прежнему закрыта', async ({ page }) => {
    await seedNoAccess(page);
    await gotoApp(page);
    await topicButton(page, PAID_TOPIC).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });

    await page.getByTestId(TESTID.paywallLater).click();
    await waitForDashboard(page);

    const persisted = await readPersisted(page);
    expect(persisted?.state.trialStartedAt).toBeNull();
    expect(persisted?.state.isPro).toBe(false);

    await topicButton(page, PAID_TOPIC).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });
  });

  test('бейджи: Paid-темы помечены PRO, Free-темы — «Бесплатно»', async ({ page }) => {
    await seedNoAccess(page);
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.paywallBadgePro)).toHaveCount(11);
    await expect(page.getByTestId(TESTID.paywallBadgeFree)).toHaveCount(3);
    await expect(topicButton(page, TOPIC)).toContainText('Бесплатно');
    await expect(topicButton(page, PAID_TOPIC)).toContainText('PRO');
  });
});
