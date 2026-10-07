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
  TESTID,
  PERSIST_VERSION,
  PERSIST_KEYS,
} from './fixtures';

/**
 * G8 (persist / restart) from `.project/drafts/app-map.md` §6.
 *
 * Two contracts are checked side by side: what the store WROTE into
 * `rhcsa_progress` (version 7 since spec 063), and what a reload restores from it. `currentScreen`
 * is deliberately not persisted, so a reload always boots on the dashboard.
 */

test.use({ reducedMotion: 'reduce' });

const TOTAL = 253;

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
    // spec 068: из контракта убраны 5 legacy-полей инлайн-экзамена
    // (examActive/examStartedAt/examDurationMs/examQuestionIds/examAnswers).
    for (const key of [
      'answers',
      'currentIndex',
      'dailyGoalXp',
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
    // Первый ответ дня заводит серию (+10), сам верный regular-ответ стоит +3
    // (таблица XP-механики).
    expect(earned?.state.totalXp).toBe(13);
    expect(earned?.state.streak).toBe(1);

    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);
    // Уровень подписан ИМЕНЕМ, а не номером: 13 XP — это «Новичок»
    // (лестница LEVELS: Новичок 0…49, Ученик с 50). Прежняя подпись
    // «Уровень 1» удалена вместе с номерной шкалой.
    await expect(page.getByText('Новичок')).toBeVisible();

    await page.reload();
    await waitForDashboard(page);

    const after = await readPersisted(page);
    expect(after?.state.totalXp).toBe(13);
    expect(after?.state.streak).toBe(1);
    await expect(page.getByText('Новичок')).toBeVisible();
    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText(`1 из ${TOTAL}`);
  });
});

test.describe('persist — экзамен', () => {
  test('an exam run is session-only: a reload does not resume it', async ({ page }) => {
    // spec 068: экзамен — единственный прогон spec 054. Он session-only
    // (`examSession` нет в partialize), и это НАМЕРЕННО: reload не должен
    // поднимать пользователя обратно на прогон, начатый до перезагрузки.
    // Прежние кейсы проверяли обратное для legacy-инлайн-экзамена
    // (persisted examActive + самозавершение по таймеру) — механик больше нет.
    await gotoApp(page);
    await page.getByTestId('exam-mode').click();
    await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('exam-option-0').click();
    await page.getByTestId('exam-submit').click();
    await expect(page.getByTestId('exam-progress')).toHaveText(/^Вопрос 2 \/ \d+$/);

    // Прогон идёт, но в localStorage его нет вовсе.
    const stored = await readPersisted(page);
    expect(stored?.version).toBe(PERSIST_VERSION);
    expect(stored?.state).not.toHaveProperty('examSession');
    // И ни одного legacy-поля экзамена в снапшоте не осталось (spec 068).
    for (const legacy of [
      'examActive',
      'examStartedAt',
      'examDurationMs',
      'examQuestionIds',
      'examAnswers',
      'examLastResult',
    ]) {
      expect(stored?.state).not.toHaveProperty(legacy);
    }

    await page.reload();
    await waitForDashboard(page);

    // Reload вернул на Dashboard: возобновляемого прогона нет.
    await expect(page.getByTestId('exam-run')).toHaveCount(0);
    await expect(page.getByTestId('exam-mode')).toBeVisible();
  });
});
