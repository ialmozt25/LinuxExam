import {
  test,
  expect,
  emptyPersistedState,
  gotoApp,
  openSeededRun,
  readPersisted,
  regularQuestionAt,
  seedState,
  seedTopicRun,
  waitForQuestion,
  answerQuestion,
  isoDaysAgo,
  TESTID,
} from './fixtures';

/**
 * XP-механика через реальный UI (банк → стор → persist).
 *
 * Домен и стор проверены unit-тестами (`src/domain/__tests__/xp.test.ts`,
 * `src/store/__tests__/xp-mechanics.test.ts`); здесь — только сквозной контракт:
 * ответ на живом вопросе банка меняет то, что реально уходит в `localStorage`.
 *
 * Вопрос выбирается по манифесту (`regularQuestionAt`) — при правке банка тест
 * едет за ним, а не падает на захардкоженном id.
 */

/** Тема для review-прогона: любая живая (её размер читает фикстура). */
const TOPIC = 'file_permissions';

test.describe('XP-механика — начисление за ответ', () => {
  test('первый верный ответ дня: +10 за серию и +3 за ответ', async ({ page }) => {
    const openQuestion = regularQuestionAt(0);
    await seedState(page, emptyPersistedState());
    await gotoApp(page);

    await page.getByTestId(TESTID.dashboardContinue).click();
    await waitForQuestion(page);
    await answerQuestion(page, 'correct');

    const stored = await readPersisted(page);
    expect(stored?.state.totalXp).toBe(13);
    expect(stored?.state.todayXp).toBe(13);
    expect(stored?.state.streak).toBe(1);
    expect(stored?.state.todayXpDate).toBe(isoDaysAgo(0));
    // Anti-farming: «первым за день» помечен ровно отвеченный вопрос.
    expect(stored?.state.answeredToday).toEqual([openQuestion.id]);
  });

  test('anti-farming: повторный ответ на тот же вопрос сегодня XP не даёт', async ({ page }) => {
    const answered = regularQuestionAt(0);
    const seeded = emptyPersistedState();
    // Профиль уже отвечал на этот вопрос сегодня: серия и дневной счётчик дня
    // стоят, «первый ответ дня» потрачен. `answeredToday` живёт под ОДНИМ
    // маркером дня со счётчиком ответов, поэтому маркер обязателен: без него
    // список читается как «новый день» и обнуляется.
    seeded.answeredToday = [answered.id];
    seeded.todayAnswered = 1;
    seeded.todayAnsweredDate = isoDaysAgo(0);
    seeded.streak = 1;
    seeded.lastActiveDate = isoDaysAgo(0);
    seeded.totalXp = 10;
    seeded.todayXp = 10;
    seeded.todayXpDate = isoDaysAgo(0);
    await seedState(page, seeded);
    await gotoApp(page);

    await page.getByTestId(TESTID.dashboardContinue).click();
    await waitForQuestion(page);
    await answerQuestion(page, 'correct');

    const stored = await readPersisted(page);
    // +0 за ответ, +0 за серию (она уже заведена сегодня) — счётчики стоят.
    expect(stored?.state.totalXp).toBe(10);
    expect(stored?.state.todayXp).toBe(10);
    expect(stored?.state.answeredToday).toEqual([answered.id]);
    // Счётчик ОТВЕТОВ при этом растёт: повторный ответ — всё ещё ответ.
    expect(stored?.state.todayAnswered).toBe(2);
  });

  test('ответ в review стоит +2 — дешевле нового ответа', async ({ page }) => {
    // Review-прогон входит через кнопку темы (`startTopicQuiz` переиспользует
    // review-поток): баннер «продолжить прогон» review-прогоны не показывают.
    await seedTopicRun(page, TOPIC, 1);
    await gotoApp(page);
    await openSeededRun(page, TOPIC);
    await answerQuestion(page, 'correct');

    const stored = await readPersisted(page);
    // +10 за первый ответ дня и +2 за верный ответ в review.
    expect(stored?.state.totalXp).toBe(12);
    expect(stored?.state.todayXp).toBe(12);
  });
});
