import {
  test,
  expect,
  gotoApp,
  seedTopicRun,
  openSeededRun,
  seedWrongRegularAnswer,
  readPersisted,
  answerQuestion,
  topicSize,
  TOPICS,
  TOPIC_INDEX,
  TOPIC_QUESTIONS,
  PERSIST_VERSION,
  TESTID,
} from './fixtures';

/**
 * G9 (results breakdown and transitions) and the review entry point (G6) from
 * `.project/drafts/app-map.md` §6.
 *
 * The store exposes no "show results" action, so the results screen is reached
 * through the real flow: the dashboard topic button starts the run and every
 * question is answered until the run ends. `startTopicQuiz` always instantiates
 * the WHOLE live topic and restarts at the first question, so the run length is
 * the topic size — there is no shorter in-app path into topic results.
 */

test.use({ reducedMotion: 'reduce' });

const TOPIC = 'file_permissions';
const TOPIC_TITLE = 'Права доступа';

/** Opens the topic run and answers every question; returns the run length. */
async function runTopicToResults(page: import('@playwright/test').Page, wrongLast: boolean) {
  const size = topicSize(TOPIC);
  await seedTopicRun(page, TOPIC, size);

  await gotoApp(page);
  await openSeededRun(page, TOPIC);

  for (let i = 1; i <= size; i++) {
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^${i}\\s*/\\s*${size}$`)
    );
    // The LAST question labels the action «Завершить», the others «Следующий вопрос».
    const label = await page.getByTestId(TESTID.nextButton).innerText();
    expect(label).toMatch(i === size ? /Завершить/ : /Следующий вопрос/);

    await answerQuestion(page, i === size && wrongLast ? 'wrong' : 'correct');
    await page.getByTestId(TESTID.nextButton).click();
  }

  await expect(page.getByTestId(TESTID.resultsScreen)).toBeVisible({ timeout: 10000 });
  return size;
}

test.describe('результаты прогона темы', () => {
  test('a finished topic run reports the review stream, not an empty screen', async ({ page }) => {
    const size = await runTopicToResults(page, false);

    // A topic run is a review: the header names the topic and the retry is absent.
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(`Тема: ${TOPIC_TITLE}`);
    await expect(page.getByTestId(TESTID.resultsEmpty)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.resultsScore)).toHaveText(`${size} / ${size}`);
    await expect(page.getByTestId(TESTID.resultsAccuracy)).toHaveText('100%');
    await expect(page.getByTestId(TESTID.resultsRetry)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.resultsBack)).toBeVisible();
  });

  test('the per-topic breakdown counts the ACTIVE stream', async ({ page }) => {
    const size = await runTopicToResults(page, false);

    await expect(page.getByTestId(TESTID.resultsTopics)).toBeVisible();
    await expect(page.getByTestId(`results-topic-${TOPIC}`)).toContainText(
      `${size}/${TOPIC_INDEX.byTopic[TOPIC]}`
    );
    // Topics that took part in no answer stay at 0 / their own live size.
    for (const topic of TOPICS) {
      if (topic.key === TOPIC) continue;
      await expect(page.getByTestId(`results-topic-${topic.key}`)).toContainText(
        `0/${TOPIC_INDEX.byTopic[topic.key]}`
      );
    }
  });

  test('«К темам» returns to the dashboard', async ({ page }) => {
    await runTopicToResults(page, false);

    await page.getByTestId(TESTID.resultsBack).click();
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 10000,
    });
    // Dashboard вернулся, а in-app футера «Продолжить» в нём больше нет
    // (фикс 2026-10-07: одна primary CTA на экран).
    await expect(page.getByTestId(TESTID.dashboardContinue)).toHaveCount(0);
  });

  test('a wrong last answer lowers the accuracy instead of reporting an empty run', async ({
    page,
  }) => {
    const size = await runTopicToResults(page, true);

    // One wrong answer out of the whole run: the score is (size-1)/size, and the
    // screen still reports a real run instead of the empty state.
    const correct = size - 1;
    await expect(page.getByTestId(TESTID.resultsScore)).toHaveText(`${correct} / ${size}`);
    await expect(page.getByTestId(TESTID.resultsAccuracy)).toHaveText(
      `${Math.round((correct / size) * 100)}%`
    );
    await expect(page.getByTestId(TESTID.resultsEmpty)).toHaveCount(0);
  });
  // Пустое состояние НУЛЕВОГО счёта (spec 065, К5.3) в e2e не проверяется:
  // до экрана `results-screen` доводит только review-прогон (тема или «Повторить
  // ошибки»), а его пул непустой — вопросов без неверного варианта в банке нет.
  // Регулярный поток в конце пула возвращает `nextQuestion` БЕЗ навигации, а
  // экзамен рисует собственный экран (`exam-results`, spec 054), не `results-screen`.
  // Поэтому нулевой счёт покрыт компонентным тестом Results.stream.test.tsx.
});

test.describe('повторение ошибок', () => {
  test('a wrong regular answer is persisted with its live option text', async ({ page }) => {
    const question = TOPIC_QUESTIONS[TOPIC][0];
    const { record } = await seedWrongRegularAnswer(page, question);

    await gotoApp(page);

    const stored = await readPersisted(page);
    // Текущая версия persist: 6 с spec 061 (retention добавил dailyGoalXp + todayXp).
    expect(stored?.version).toBe(PERSIST_VERSION);
    const answers = stored?.state.answers as unknown[];
    expect(answers).toHaveLength(1);
    expect(answers[0]).toEqual(record);
    expect(stored?.state.wrongQuestionIds).toEqual([question.id]);
    // Первый ответ дня (+10 серия) и неверный regular-ответ (+1) — таблица XP-механики.
    expect(stored?.state.totalXp).toBe(11);
    expect(stored?.state.streak).toBe(1);
  });

  test('«Повторить ошибки» is offered with the live count', async ({ page }) => {
    await seedWrongRegularAnswer(page, TOPIC_QUESTIONS[TOPIC][0]);
    await gotoApp(page);

    const reviewWrong = page.getByTestId(TESTID.reviewWrong);
    await expect(reviewWrong).toBeVisible();
    await expect(reviewWrong).toContainText('Повторить ошибки');
    await expect(reviewWrong).toContainText('1 вопр.');
  });

  test('the dashboard lists every topic with a live counter', async ({ page }) => {
    await seedWrongRegularAnswer(page, TOPIC_QUESTIONS[TOPIC][0]);
    await gotoApp(page);

    for (const topic of TOPICS) {
      await expect(page.getByTestId(`topic-${topic.key}`)).toContainText(
        `${TOPIC_INDEX.byTopic[topic.key]} вопр.`
      );
    }
  });
});
