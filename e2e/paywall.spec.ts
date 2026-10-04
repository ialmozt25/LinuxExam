import {
  test,
  expect,
  gotoApp,
  startTopic,
  topicButton,
  topicSize,
  answerQuestion,
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

  test('«Купить» без настроенного backend: инвойс не создаётся, Pro не выдаётся', async ({
    page,
  }) => {
    await gotoApp(page);
    await reachFreeLimit(page);
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });

    const buy = page.getByTestId(TESTID.paywallBuy);
    await expect(buy).toContainText('Купить за 299 Stars');
    await buy.click();

    // spec 064: `VITE_API_GATEWAY_URL` в E2E-сборке не задан, поэтому запрос
    // инвойса не уходит вовсе. Экран не меняется, пользователь видит понятное
    // сообщение, окно оплаты не открывается — и Pro не выдаётся.
    const notice = page.getByTestId(TESTID.paywallPurchaseNotice);
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Не удалось начать оплату');
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible();
    await expect(page.getByTestId(TESTID.questionText)).toHaveCount(0);
    await expect(buy).toBeEnabled();

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
    // spec 068: единственный экзамен — прогон spec 054 (30/60/90). Он не идёт
    // через `nextQuestion`, поэтому гейт бесплатных вопросов его не касается:
    // шесть ответов подряд не поднимают paywall.
    await gotoApp(page);

    await page.getByTestId('exam-mode').click();
    await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible({ timeout: 10000 });
    // Пресет по умолчанию — 30 вопросов.
    await expect(page.getByTestId('exam-progress')).toHaveText('Вопрос 1 / 30');
    // Таймер идёт от wall-clock старта (формат HH:MM:SS — пресет 90 идёт 120 мин).
    await expect(page.getByTestId('exam-timer')).toHaveText(/^\d{2}:\d{2}:\d{2}$/);

    // Six answers = one past the free limit of the regular stream.
    for (let i = 1; i <= FREE_LIMIT + 1; i++) {
      await page.getByTestId('exam-option-0').click();
      await expect(page.getByTestId('exam-submit')).toBeEnabled();
      await page.getByTestId('exam-submit').click();
      await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);
      if (i < FREE_LIMIT + 1) {
        await expect(page.getByTestId('exam-progress')).toHaveText(`Вопрос ${i + 1} / 30`);
      }
    }

    // Paywall не появился, обратной связи по ответу нет (разбор — только в итогах).
    await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.explanation)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.explanationVerdict)).toHaveCount(0);
    await expect(page.getByTestId('exam-run')).toBeVisible();
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

/**
 * Тарифы Telegram Stars (spec 064). Окно инвойса Playwright воспроизвести не
 * может — эмуляции Telegram WebApp в проекте нет, — поэтому снаружи
 * проверяется то, что видно: контракт `plan-*`, дефолтный выбор и цена на
 * кнопке. Сам платёжный путь закрыт unit-тестами
 * (`Paywall.purchase.test.tsx`, `payment_provider.test.ts`).
 */
test.describe('пейволл — тарифы Telegram Stars (spec 064)', () => {
  test('три тарифа с data-testid, по умолчанию выбран месячный', async ({ page }) => {
    await gotoApp(page);
    await reachFreeLimit(page);
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });

    const plans = page.getByTestId(TESTID.paywallPlans);
    await expect(plans).toBeVisible();
    await expect(plans).toContainText('Месяц — 299 Stars');
    await expect(plans).toContainText('Год — 1499 Stars');
    await expect(plans).toContainText('Навсегда — 3999 Stars');

    await expect(page.getByTestId(TESTID.planMonthly)).toBeChecked();
    await expect(page.getByTestId(TESTID.planYearly)).not.toBeChecked();
    await expect(page.getByTestId(TESTID.planLifetime)).not.toBeChecked();

    await expect(page.getByTestId(TESTID.paywallBuy)).toContainText('Купить за 299 Stars');
  });

  test('выбор тарифа меняет цену на кнопке', async ({ page }) => {
    await gotoApp(page);
    await reachFreeLimit(page);
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });

    await page.getByTestId(TESTID.planYearly).check();
    await expect(page.getByTestId(TESTID.paywallBuy)).toContainText('Купить за 1499 Stars');

    await page.getByTestId(TESTID.planLifetime).check();
    await expect(page.getByTestId(TESTID.planLifetime)).toBeChecked();
    await expect(page.getByTestId(TESTID.planYearly)).not.toBeChecked();
    await expect(page.getByTestId(TESTID.paywallBuy)).toContainText('Купить за 3999 Stars');
  });
});
