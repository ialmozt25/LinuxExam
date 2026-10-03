import {
  test,
  expect,
  gotoApp,
  startTopic,
  topicButton,
  topicSize,
  optionButtons,
  answerQuestion,
  currentQuestionText,
  waitForQuestion,
  findQuestionByText,
  waitForDashboard,
  TESTID,
} from './fixtures';

/**
 * G3 (feedback and navigation) + G4 (question rendering / display determinism)
 * from `.project/drafts/app-map.md` §6, plus the free-question gate path (G5).
 *
 * Option order is shuffled deterministically from the question id, so a test may
 * never assume a position — the correct option is resolved through the live bank.
 * `reducedMotion: 'reduce'` collapses the feedback enter-animation, so assertions
 * read settled DOM/motion styles instead of mid-transition values.
 */

test.use({ reducedMotion: 'reduce' });

const TOPIC = 'file_permissions';
const FREE_LIMIT = 5;

test.describe('поток вопроса', () => {
  test('answering shows the verdict, the explanation and locks the options', async ({ page }) => {
    await gotoApp(page);
    await startTopic(page, TOPIC);

    const question = findQuestionByText(await currentQuestionText(page));
    await expect(page.getByTestId(TESTID.questionText)).toHaveText(question.question);
    await expect(page.getByTestId(TESTID.explanation)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.nextButton)).toBeDisabled();

    await answerQuestion(page, 'correct');

    await expect(page.getByTestId(TESTID.explanationVerdict)).toHaveText('Верно');
    await expect(page.getByTestId(TESTID.explanation)).toHaveText(question.explanation);

    // All four options lock once answered — the answer cannot be changed.
    await expect(optionButtons(page)).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(optionButtons(page).nth(i)).toBeDisabled();
    }

    // motion animates only transform/opacity, so the highlighted option keeps
    // opacity 1 while the untouched distractors fade to 0.55.
    const borders = await optionButtons(page).evaluateAll((nodes) =>
      nodes.map((n) => getComputedStyle(n).borderTopColor)
    );
    const opacities = await optionButtons(page).evaluateAll((nodes) =>
      nodes.map((n) => getComputedStyle(n).opacity)
    );
    const surface = 'rgb(45, 45, 45)';
    expect(borders.filter((b) => b !== surface).length).toBeGreaterThanOrEqual(1);
    expect(opacities.some((o) => o === '1')).toBe(true);
    expect(opacities.filter((o) => o === '0.55').length).toBe(3);
  });

  test('continues to the next question and back again', async ({ page }) => {
    await gotoApp(page);
    const size = await startTopic(page, TOPIC);

    const first = await currentQuestionText(page);
    await answerQuestion(page, 'correct');
    await page.getByTestId(TESTID.nextButton).click();

    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^2\\s*/\\s*${size}$`)
    );
    expect(await currentQuestionText(page)).not.toBe(first);

    // Back is offered from the second question on, and returns to the first one.
    const back = page.getByTestId(TESTID.headerBack);
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^1\\s*/\\s*${size}$`)
    );
    // The first question keeps its recorded answer.
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible();
    await expect(optionButtons(page).first()).toBeDisabled();
  });

  test('a wrong answer is reported as «Неверно» and explained', async ({ page }) => {
    await gotoApp(page);
    await startTopic(page, TOPIC);

    const question = findQuestionByText(await currentQuestionText(page));
    await answerQuestion(page, 'wrong');

    await expect(page.getByTestId(TESTID.explanationVerdict)).toHaveText('Неверно');
    await expect(page.getByTestId(TESTID.explanation)).toHaveText(question.explanation);
  });

  test('renders the four live bank options of the current question', async ({ page }) => {
    await gotoApp(page);
    await startTopic(page, TOPIC);

    const question = findQuestionByText(await currentQuestionText(page));
    expect(question.options).toHaveLength(4);
    expect(question.options.filter((o) => o.correct)).toHaveLength(1);

    const rendered = await optionButtons(page).evaluateAll((nodes) =>
      nodes.map((n) => (n.textContent ?? '').trim())
    );
    await expect(optionButtons(page)).toHaveCount(4);
    const bankTexts = question.options.map((o) => o.text.trim());
    expect(bankTexts).toHaveLength(4);
    // Each rendered option ends with exactly one of the bank's option texts (the
    // button prefixes the A..D letter chip).
    for (const bankText of bankTexts) {
      expect(rendered.filter((r) => r.endsWith(bankText)).length).toBe(1);
    }
  });

  test('the option order of one question is stable across a reload', async ({ page }) => {
    await gotoApp(page);
    await startTopic(page, TOPIC);

    const questionText = await currentQuestionText(page);
    const labels = async () =>
      optionButtons(page).evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
    const before = await labels();
    expect(before).toHaveLength(4);

    // A topic run runs on the review stream, which the dashboard does NOT offer as
    // a resumable banner — so the reload is followed by a fresh entry into the same
    // topic. Option order is seeded from the question id, so it must come back
    // identical instead of re-shuffling.
    await page.reload();
    await waitForDashboard(page);
    await startTopic(page, TOPIC);

    expect(await currentQuestionText(page)).toBe(questionText);
    expect(await labels()).toEqual(before);
  });

  test('the last question of a topic ends the run on the topic results', async ({ page }) => {
    await gotoApp(page);
    const size = await startTopic(page, TOPIC);

    // Answer and advance until the screen offers the finishing action. The bank is
    // live, so the number of steps is read off the button label, not assumed.
    let steps = 0;
    while (!/Завершить/.test(await page.getByTestId(TESTID.nextButton).innerText())) {
      await answerQuestion(page, 'correct');
      await page.getByTestId(TESTID.nextButton).click();
      steps += 1;
      if (steps > size) break;
      await expect(page.getByTestId(TESTID.nextButton)).toBeVisible({ timeout: 10000 });
    }
    expect(steps).toBe(size - 1);

    await answerQuestion(page, 'correct');
    await page.getByTestId(TESTID.nextButton).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Тема: Права доступа' })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(TESTID.resultsScreen)).toBeVisible();
  });

  test('the free-question gate raises the paywall at the sixth question', async ({ page }) => {
    await gotoApp(page);

    await page.getByTestId(TESTID.dashboardContinue).click();
    await waitForQuestion(page);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(/^1\s*\/\s*\d+$/);

    const seen: string[] = [];
    for (let i = 1; i <= FREE_LIMIT; i++) {
      seen.push(await currentQuestionText(page));
      await answerQuestion(page, 'correct');
      await page.getByTestId(TESTID.nextButton).click();

      if (i < FREE_LIMIT) {
        // Still inside the free range: the next question renders with i+1.
        await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
          new RegExp(`^${i + 1}\\s*/\\s*\\d+$`)
        );
      }
    }

    // A free user may not reach the sixth question of the regular stream.
    await expect(page.getByTestId(TESTID.paywall)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Бесплатные вопросы закончились')).toBeVisible();
    expect(new Set(seen).size).toBe(FREE_LIMIT);
  });
});

test.describe('навигация с экрана вопроса', () => {
  test('home leaves a topic run and returns to the dashboard', async ({ page }) => {
    await gotoApp(page);
    await startTopic(page, TOPIC);

    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.startExam)).toBeVisible();
  });

  test('the resume banner is not offered while a topic run is unfinished', async ({ page }) => {
    await gotoApp(page);
    await startTopic(page, TOPIC);
    await answerQuestion(page, 'correct');

    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    // The resume banner is for the REGULAR stream only; a topic run answers on the
    // review stream, so it neither offers the banner nor moves the dashboard count.
    await expect(page.getByTestId(TESTID.resumeBanner)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText('0 из 253');
    // The topic itself stays startable with its live counter.
    await expect(topicButton(page, TOPIC)).toContainText(`${topicSize(TOPIC)} вопр.`);
  });

  test('«Продолжить» resumes the regular stream at the first question', async ({ page }) => {
    await gotoApp(page);

    await page.getByTestId(TESTID.dashboardContinue).click();
    await waitForQuestion(page);

    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(/^1\s*\/\s*\d+$/);
    await expect(page.getByTestId(TESTID.headerBack)).toHaveCount(0);
  });
});
