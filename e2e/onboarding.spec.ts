import {
  test,
  expect,
  blockAnalytics,
  seedOnboarding,
  seedStateOnce,
  waitForDashboard,
  waitForQuestion,
  answerQuestion,
  TESTID,
  TOPIC_INDEX,
  TOPICS,
} from './fixtures';

/**
 * Первый запуск после удаления онбординга (задание «удалить демо-квиз»).
 *
 * Было: fresh user → редирект на демо-квиз (3 вопроса «Вопрос N из 3») →
 * «Начать обучение» → Dashboard в Fresh User Mode.
 * Стало: fresh user попадает СРАЗУ на Dashboard в Fresh User Mode. Ни демо-экрана,
 * ни редиректа, ни Screen-значения `'onboarding-demo'` в приложении больше нет,
 * поэтому «трех демо-вопросов» не существует ни при каком состоянии хранилища.
 *
 * Профиль сеется `seedOnboarding(page, false)` — это репозиторный «свежий профиль»
 * (онбординг не отмечен, статистика пуста). Буквально пустой `localStorage` под
 * авто-фикстурой недостижим by design: её сид — инлайн-скрипт в самом документе,
 * он выполняется ПОСЛЕ init-скриптов спека и досыпает профиль, если ключа нет
 * (`e2e/fixtures.ts`, `onboardingSeedScript`). На контракт это не влияет: с
 * удалённым демо онбординг-экран не рендерится НИ ИЗ ОДНОГО состояния хранилища,
 * и это здесь проверяется явно — по узлу и по текстам.
 *
 * Viewport 390×844 — мобильный, потому что именно там целевая аудитория Mini App.
 */
const TOTAL = TOPIC_INDEX.total;

/** Селектор удалённого экрана: сырой, чтобы исчезновение узла было видно и после
 * удаления его `data-testid` из карты `TESTID` (e2e/fixtures.ts). */
const DEMO_SCREEN = '[data-testid="onboarding-demo"]';

test.describe('первый запуск: онбординга больше нет', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('свежий профиль → сразу Dashboard fresh mode, ни одного demo-узла', async ({ page }) => {
    await blockAnalytics(page);
    await seedOnboarding(page, false);
    await page.goto('/');

    // Экран один — Dashboard. Демо-квиза нет ни по узлу, ни по его текстам.
    await waitForDashboard(page);
    await expect(page.locator(DEMO_SCREEN)).toHaveCount(0);
    await expect(page.getByTestId('onboarding-demo-progress')).toHaveCount(0);
    await expect(page.getByText('Вопрос 1 из 3')).toHaveCount(0);
    await expect(page.getByText('Запомни — так тоже бывает')).toHaveCount(0);
    await expect(page.getByText('Отлично!')).toHaveCount(0);

    // Fresh User Mode на месте: Hero с числами банка и единственная CTA.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Начните путь к RHCSA' })
    ).toBeVisible();
    await expect(page.getByTestId('dashboard-hero-subtitle')).toHaveText(
      new RegExp(`^${TOTAL} вопрос\\S* · ${TOPICS.length} тем\\S* · по официальным objectives$`)
    );
    await expect(page.getByTestId(TESTID.startLearning)).toHaveText(/Начать первый вопрос/);
    await expect(page.getByTestId('dashboard-features').locator('li')).toHaveCount(4);

    // ...и ни одного узла обычного режима: до первого ответа их прячет сам режим.
    await expect(page.getByTestId(TESTID.dashboardProgress)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.dashboardRetention)).toHaveCount(0);
  });

  test('тап по CTA ведёт сразу в Q1 обычного прогона, а не в демо', async ({ page }) => {
    await blockAnalytics(page);
    await seedOnboarding(page, false);
    await page.goto('/');
    await waitForDashboard(page);

    await page.getByTestId(TESTID.startLearning).click();

    await waitForQuestion(page);
    await expect(page.locator(DEMO_SCREEN)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.questionProgress)).toBeVisible();
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
    // Hero и «Внутри вас ждет» — принадлежность fresh mode, а не экрана вообще.
    await expect(page.getByTestId('dashboard-hero')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-features')).toHaveCount(0);

    // Reload не возвращает fresh mode и уж тем более не возвращает демо.
    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId('dashboard-hero')).toHaveCount(0);
    await expect(page.getByTestId('analytics-mode')).toBeVisible();
    await expect(page.locator(DEMO_SCREEN)).toHaveCount(0);
  });
});
