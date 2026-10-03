import {
  test,
  expect,
  gotoApp,
  waitForDashboard,
  answerQuestion,
  currentQuestionText,
  findQuestionByText,
  readPersisted,
  regularQuestionAt,
  regularQuestions,
  resumeSeededRun,
  seedState,
  emptyPersistedState,
  liveRecord,
  blockAnalytics,
  TOPIC_QUESTIONS,
  TESTID,
  PERSIST_VERSION,
  PERSIST_KEYS,
} from './fixtures';
import type { BankQuestion } from './fixtures';

/**
 * G8 (persist / restart) and the persisted half of G8.4 (exam session state) from
 * `.project/drafts/app-map.md` §6.
 *
 * Two contracts are checked side by side: what the store WROTE into
 * `rhcsa_progress` (version 7 since spec 063), and what a reload restores from it. `currentScreen`
 * is deliberately not persisted, so a reload always boots on the dashboard.
 */

test.use({ reducedMotion: 'reduce' });

const TOPIC = 'file_permissions';
const TOTAL = 253;

function liveAnswers(questions: BankQuestion[], correct = true) {
  return questions.map((question) => liveRecord(question, correct));
}

test.describe('persist — обычный прогон', () => {
  test('reloading mid-run restores the position and the recorded answers', async ({ page }) => {
    // Index 4 == the fifth question of the REGULAR stream (bank order), one step
    // short of the free limit, so a free profile is a valid condition for this seed.
    const openQuestion = regularQuestionAt(4);
    const seeded = emptyPersistedState();
    seeded.answers = regularQuestions(4).map((q) => liveRecord(q, true));
    seeded.currentIndex = 4;
    seeded.isQuizInProgress = true;
    seeded.isPro = false;
    seeded.streak = 1;
    seeded.totalXp = 10;
    await seedState(page, seeded);

    await gotoApp(page);

    const stored = await readPersisted(page);
    expect(stored?.version).toBe(PERSIST_VERSION);
    expect(stored?.state.answers).toHaveLength(4);
    expect(stored?.state.currentIndex).toBe(4);
    expect(stored?.state.isQuizInProgress).toBe(true);

    // The dashboard presents the unfinished run with its live position …
    await expect(page.getByTestId(TESTID.resumeBanner)).toBeAttached();
    await expect(page.getByTestId(TESTID.resumePosition)).toHaveText(`Вопрос 5 из ${TOTAL}`);
    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText(`4 из ${TOTAL}`);

    // … and resuming lands on the question the regular stream serves at index 4 —
    // the one the store had open — with four answers already recorded.
    await resumeSeededRun(page);
    const open = findQuestionByText(await currentQuestionText(page));
    expect(open.id).toBe(openQuestion.id);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(/^5\s*\/\s*\d+$/);
    await expect(page.getByTestId(TESTID.explanation)).toHaveCount(0);

    // Answering it is recorded on top of the restored state.
    await answerQuestion(page, 'correct');
    const after = await readPersisted(page);
    expect(after?.state.answers).toHaveLength(5);
    expect(after?.state.currentIndex).toBe(4);
  });

  test('a reload keeps the regular run resumable and the review list intact', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId(TESTID.dashboardContinue).click();
    await expect(page.getByTestId(TESTID.questionText)).toBeVisible({ timeout: 15000 });

    await answerQuestion(page, 'wrong');
    const stored = await readPersisted(page);
    expect(stored?.state.answers).toHaveLength(1);
    expect(stored?.state.wrongQuestionIds).toHaveLength(1);
    expect(stored?.state.reviewAnswers).toEqual([]);

    await page.reload();
    await waitForDashboard(page);

    const after = await readPersisted(page);
    expect(after?.state.answers).toHaveLength(1);
    expect(after?.state.wrongQuestionIds).toEqual(stored?.state.wrongQuestionIds);
    // The wrong answer is offered for review, and the banner resumes at question 1:
    // clicking «Продолжить» only OPENS the run, so the index stays where the answer
    // left it (the first question) until the next «Следующий вопрос».
    await expect(page.getByTestId(TESTID.reviewWrong)).toBeVisible();
    await expect(page.getByTestId(TESTID.resumeBanner)).toBeAttached();
    await expect(page.getByTestId(TESTID.resumePosition)).toHaveText(`Вопрос 1 из ${TOTAL}`);
  });
});

test.describe('persist — частичная запись состояния', () => {
  test('partialize keeps the quiz state and drops the session-only fields', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId(TESTID.dashboardContinue).click();
    await expect(page.getByTestId(TESTID.questionText)).toBeVisible({ timeout: 15000 });
    await answerQuestion(page, 'correct');

    const stored = await readPersisted(page);
    const keys = Object.keys(stored!.state).sort();

    // Written by partialize and restored on boot.
    for (const key of [
      'answers',
      'currentIndex',
      'dailyGoalXp',
      'examActive',
      'examAnswers',
      'examDurationMs',
      'examQuestionIds',
      'examStartedAt',
      'isPro',
      'isQuizInProgress',
      'lastActiveDate',
      'questionStats',
      'reviewAnswers',
      'reviewQuestionIds',
      'scheduledReviews',
      'streak',
      'todayXp',
      'totalXp',
      'wrongQuestionIds',
    ]) {
      expect(keys, `partialize must persist "${key}"`).toContain(key);
    }

    // Deliberately NOT persisted: session-only state.
    for (const key of [
      'activeTopic',
      'currentScreen',
      'examLastResult',
      'isLoading',
      'isPaywallVisible',
      'questions',
    ]) {
      expect(keys, `partialize must not persist "${key}"`).not.toContain(key);
    }

    // spec 063: `trialStartedAt` добавлен В КОНЕЦ, порядок 21 предыдущего поля не
    // изменён — контракт partialize проверяется целиком и по порядку.
    expect(keys, 'partialize contract (spec 063: trialStartedAt last)').toEqual(
      [...PERSIST_KEYS].sort()
    );
  });

  test('a reload on the dashboard keeps the streak and XP earned in the run', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId(TESTID.dashboardContinue).click();
    await expect(page.getByTestId(TESTID.questionText)).toBeVisible({ timeout: 15000 });

    const before = await readPersisted(page);
    expect(before?.state.totalXp).toBe(0);
    expect(before?.state.streak).toBe(0);

    await answerQuestion(page, 'correct');
    const earned = await readPersisted(page);
    // The FIRST answer of the calendar day is what grants the daily XP and streak.
    expect(earned?.state.totalXp).toBe(10);
    expect(earned?.state.streak).toBe(1);

    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);
    await expect(page.getByText('Уровень 1')).toBeVisible();

    await page.reload();
    await waitForDashboard(page);

    const after = await readPersisted(page);
    expect(after?.state.totalXp).toBe(10);
    expect(after?.state.streak).toBe(1);
    await expect(page.getByText('Уровень 1')).toBeVisible();
    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText(`1 из ${TOTAL}`);
  });
});

test.describe('persist — экзамен', () => {
  test('a reload during an exam keeps the exam running', async ({ page }) => {
    const ids = TOPIC_QUESTIONS[TOPIC].slice(0, 5).map((q) => q.id);
    const seeded = emptyPersistedState();
    seeded.examActive = true;
    // Well inside the deadline, so useExamTimer does not finish the exam.
    seeded.examStartedAt = Date.now();
    seeded.examDurationMs = 30 * 60 * 1000;
    seeded.examQuestionIds = ids;
    seeded.isQuizInProgress = true;
    await seedState(page, seeded);

    await gotoApp(page);

    // The dashboard presents the running exam and offers the way back into it.
    await expect(page.getByTestId(TESTID.examBanner)).toBeVisible();
    await expect(page.getByTestId(TESTID.examTimer)).toContainText('осталось');
    await expect(page.getByTestId(TESTID.resumeBanner)).toHaveCount(0);

    await page.getByTestId(TESTID.examContinue).click();
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      /^1\s*\/\s*5\s*·\s*\d{2}:\d{2}$/,
      { timeout: 15000 }
    );

    // Exam state survives a reload of the question screen as well.
    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.examBanner)).toBeVisible();
  });

  test('a finished exam leaves no resumable exam in storage', async ({ page }) => {
    // An exam run uses the bank manifest order, so the seed follows it too.
    const questions = regularQuestions(3);
    const seeded = emptyPersistedState();
    seeded.examActive = true;
    // Already past the deadline: useExamTimer finishes the exam through its REAL
    // path on mount, which is what populates the (session-only) examLastResult.
    seeded.examStartedAt = Date.now() - 120000;
    seeded.examDurationMs = 60000;
    seeded.examQuestionIds = questions.map((q) => q.id);
    seeded.examAnswers = liveAnswers(questions);
    seeded.isQuizInProgress = true;
    await seedState(page, seeded);

    // This test cannot use gotoApp() (it must NOT wait for the dashboard: the boot
    // lands on the exam summary), so the analytics-route block is applied by hand —
    // without it `page.goto` waits for a third-party `load` and times out.
    await blockAnalytics(page);
    await page.goto('/');

    // The elapsed exam finalises itself through useExamTimer — examLastResult is
    // built from the EXAM answers (3 / 3), not from any other stream.
    await expect(page.getByTestId(TESTID.examSummary)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(TESTID.examScore)).toHaveText('3 / 3');
    await expect(page.getByTestId(TESTID.examAccuracy)).toHaveText('100%');
    await expect(page.getByTestId(TESTID.examTime)).toContainText('Время:');
    await expect(page.getByTestId(TESTID.examRestart)).toBeVisible();
    await expect(page.getByTestId(TESTID.examExit)).toBeVisible();

    // The read is polled: the summary is painted from the same commit that clears
    // the exam gate, and zustand's persist write follows that commit.
    await expect
      .poll(async () => (await readPersisted(page))?.state.examActive, { timeout: 10000 })
      .toBe(false);
    const stored = await readPersisted(page);

    // finishExam closes the gate and drops the wall-clock start, and marks the quiz
    // as finished. It deliberately KEEPS examQuestionIds/examAnswers (cancelExam is
    // what clears those) — replaying the same set is what «Пройти заново» uses.
    expect(stored?.state.examActive).toBe(false);
    expect(stored?.state.examStartedAt).toBeNull();
    expect(stored?.state.isQuizInProgress).toBe(false);
    // The summary itself is session-only: the storage envelope has no such key, so
    // nothing about it can be restored by any later boot.
    expect(stored?.state).not.toHaveProperty('examLastResult');
    expect(stored?.state.answers).toEqual([]);

    // Leaving through the app's own «Выйти» lands on the dashboard with no exam
    // affordance left: no summary, no running-exam banner, nothing to resume.
    await page.getByTestId(TESTID.examExit).click();
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.examSummary)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.examBanner)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.resumeBanner)).toHaveCount(0);
  });
});
