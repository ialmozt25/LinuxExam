import {
  test,
  expect,
  blockAnalytics,
  seedOnboarding,
  seedStateOnce,
  waitForDashboard,
  waitForOnboardingDemo,
  waitForQuestion,
  answerQuestion,
  TESTID,
  TOPIC_INDEX,
} from './fixtures';

/**
 * Онбординг (spec 060, упрощён): демо-квиз → Dashboard в Fresh User Mode.
 *
 * Было четыре экрана (выбор цели → демо → «Готово · 1 из 3» → daily goal picker).
 * Стало: один демо-квиз с inline-фидбеком после каждого ответа и финальной
 * кнопкой «Начать обучение →». Экраны цели и итога удалены; пикер дневной цели
 * больше не часть потока (`completeOnboarding` фиксирует дефолт 30 XP).
 *
 * Viewport 390×844 — мобильный, потому что именно там целевая аудитория Mini App.
 */
const TOTAL = TOPIC_INDEX.total;

test.describe('онбординг', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('первый запуск: демо-квиз с inline-фидбеком → Dashboard в fresh mode', async ({ page }) => {
    await blockAnalytics(page);
    await seedOnboarding(page, false);
    await page.goto('/');

    // Один экран вместо четырёх: сразу демо-квиз, без экрана выбора цели.
    await waitForOnboardingDemo(page);

    for (let i = 1; i <= 3; i++) {
      await expect(page.getByTestId(TESTID.onboardingDemoProgress)).toHaveText(`Вопрос ${i} из 3`);
      // Фидбека до ответа нет, а экрана «Готово · N из 3» не существует вовсе.
      await expect(page.getByTestId('onboarding-feedback')).toHaveCount(0);
      await expect(page.getByTestId('onboarding-result')).toHaveCount(0);

      await page.getByTestId('onboarding-option-0').click();

      // Inline celebration появляется сразу после ответа.
      const feedback = page.getByTestId('onboarding-feedback');
      await expect(feedback).toBeVisible();
      await expect(feedback).toHaveAttribute('data-correct', /true|false/);
      await expect(page.getByTestId('onboarding-feedback-text')).toHaveText(
        /Отлично!|Запомни — так тоже бывает/,
      );

      // Последний шаг — финальная кнопка «Начать обучение →» вместо «Готово».
      const next = page.getByTestId(TESTID.onboardingDemoNext);
      await expect(next).toHaveText(i === 3 ? 'Начать обучение →' : 'Дальше');
      await next.click();
    }

    // Fresh User Mode: одна CTA, без Exam/аналитики/программы/пикера цели.
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.startLearning)).toHaveText(/Начать обучение/);
    await expect(page.getByTestId('exam-mode')).toHaveCount(0);
    await expect(page.getByTestId('analytics-mode')).toHaveCount(0);
    await expect(page.getByTestId(TESTID.dashboardTopics)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.streakBadge)).toHaveCount(0);
    await expect(page.getByTestId('streak-placeholder')).toHaveText('Начни серию сегодня');
    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText(`0 из ${TOTAL}`);
    // Пикер дневной цели не всплывает четвёртым шагом.
    await expect(page.getByTestId(TESTID.dailyGoalPicker)).toHaveCount(0);
  });

  test('первый ответ снимает fresh mode; reload его не возвращает', async ({ page }) => {
    await blockAnalytics(page);
    // `seedStateOnce`: на reload сид не перетирает накопленный прогоном ответ.
    await seedStateOnce(page, {
      hasCompletedOnboarding: false,
      questionStats: {},
      onboardingGoal: null,
    });
    await page.goto('/');

    await waitForOnboardingDemo(page);
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('onboarding-option-0').click();
      await page.getByTestId(TESTID.onboardingDemoNext).click();
    }
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.startLearning)).toBeVisible();

    // Первый ответ в потоке: статистика становится непустой → fresh mode снят.
    await page.getByTestId(TESTID.startLearning).click();
    await waitForQuestion(page);
    await answerQuestion(page, 'correct');
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    await expect(page.getByTestId('analytics-mode')).toBeVisible();
    await expect(page.getByTestId(TESTID.dashboardTopics)).toBeVisible();
    await expect(page.getByTestId('streak-placeholder')).toHaveCount(0);

    // Reload не возвращает fresh mode: прохождение отмечено, статистика непуста.
    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.startLearning)).toHaveCount(0);
    await expect(page.getByTestId('analytics-mode')).toBeVisible();
    await expect(page.getByTestId(TESTID.onboardingDemo)).toHaveCount(0);
  });

  test('профиль, уже проходивший онбординг, демо-квиз не видит', async ({ page }) => {
    await blockAnalytics(page);
    await seedOnboarding(page, true);
    await page.goto('/');

    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.onboardingDemo)).toHaveCount(0);
    // Это Fresh User Mode, а не полный Dashboard.
    await expect(page.getByTestId(TESTID.startLearning)).toBeVisible();
  });
});
