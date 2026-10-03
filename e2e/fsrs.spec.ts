import {
  test,
  expect,
  answerQuestion,
  blockAnalytics,
  counterText,
  gotoApp,
  openSeededRun,
  seedDueProfile,
  seedExhaustedProfile,
  seedTopicRun,
  topicSize,
  waitForDashboard,
  waitForQuestion,
  readPersisted,
  PERSIST_VERSION,
  TESTID,
} from './fixtures';

/**
 * FSRS-lite (spec 052, семантическое разделение пулов — spec 065).
 *
 * Пул разбит надвое: `new` (записи в реестре расписания нет) и `due`
 * (`next <= now`). Одна сессия — до `SESSION_LIMIT = 30` вопросов, просроченные
 * первыми. Поэтому на Dashboard больше НЕ появляется «Повторить сегодня (253)»:
 * N считается по отобранной сессии, а свежий профиль видит приглашение
 * «Начать обучение».
 *
 * Живой банк — 253 вопроса (`src/data/questions/_order.json`).
 */

const BANK_TOTAL = 253;
/** SESSION_LIMIT из `src/domain/fsrs.ts` — размер одной сессии. */
const SESSION_LIMIT = 30;
/** Тема для проверки итогов прогона: та же, что в results.spec.ts. */
const TOPIC = 'file_permissions';

/** Заголовок кнопки повторения: «Повторить сегодня (30)». */
const TITLE = /^Повторить сегодня \((\d+)\)$/;

/** Остаток пула за пределами одной сессии: «Осталось повторить: 223». */
const REMAINDER = /Осталось повторить:\s*(\d+)/;

async function reviewTodayCount(page: import('@playwright/test').Page): Promise<number> {
  const text = (await page.getByTestId(TESTID.reviewToday).innerText()).trim();
  const match = TITLE.exec(text.split('\n')[0].trim());
  if (!match) throw new Error(`не удалось разобрать N из «${text}»`);
  return Number(match[1]);
}

/** Сколько просроченных осталось за пределами текущей сессии. */
async function reviewRemainder(page: import('@playwright/test').Page): Promise<number> {
  const text = (await page.getByTestId(TESTID.reviewRemainder).innerText()).trim();
  const match = REMAINDER.exec(text);
  if (!match) throw new Error(`не удалось разобрать остаток из «${text}»`);
  return Number(match[1]);
}

test.describe.serial('FSRS-lite — разделение new / due', () => {
  test.beforeEach(async ({ page }) => {
    // Аналитический beacon из index.html: page.goto ждёт `load`, поэтому
    // медленный CDN превращается в таймаут навигации (см. fixtures.ts).
    await blockAnalytics(page);
    // Профиль свежий: пустая история → пустой реестр расписания. Очистка идёт
    // РОВНО ОДИН раз: addInitScript срабатывает на каждой навигации, поэтому
    // безусловный clear() стирал бы расписание и на reload — тогда N после
    // перезагрузки снова стал бы равен размеру банка (и это был бы баг теста,
    // а не приложения).
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('fsrs-spec-seeded')) {
        window.localStorage.clear();
        window.sessionStorage.setItem('fsrs-spec-seeded', '1');
      }
    });
  });

  test('свежий профиль → «Начать обучение», а не «Повторить (253)»', async ({ page }) => {
    await gotoApp(page);

    // Главный дефект до spec 065: свежий профиль видел «Повторить сегодня (253)».
    await expect(page.getByTestId(TESTID.startLearning)).toBeVisible();
    await expect(page.getByTestId(TESTID.startLearning)).toHaveText(/Начать обучение/);

    // Повторение существует (реестр до-наполнен), но его N — одна сессия.
    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    expect(await reviewTodayCount(page)).toBe(SESSION_LIMIT);
    // И это НЕ размер банка.
    expect(await reviewTodayCount(page)).not.toBe(BANK_TOTAL);
    // «Продолжить изучение» на свежем профиле не показывается: просроченные есть.
    await expect(page.getByTestId(TESTID.continueLearning)).toHaveCount(0);
  });

  test('«Начать обучение» ведёт к списку тем, а не в прогон', async ({ page }) => {
    await gotoApp(page);

    await page.getByTestId(TESTID.startLearning).click();

    // Прогон не открылся: экран вопроса не появился.
    await expect(page.getByTestId(TESTID.questionText)).toHaveCount(0);
    // Список тем достижим и доступен как цель скролла.
    await expect(page.getByTestId(TESTID.dashboardTopics)).toBeAttached();
    // И тема запускается оттуда же.
    const topic = page.locator('[data-testid^="topic-"]').first();
    await topic.click();
    await waitForQuestion(page);
  });

  test('ответы в прогоне уменьшают остаток и переживают reload', async ({ page }) => {
    await gotoApp(page);

    // Свежий профиль: 253 просроченных, сессия 30, за её пределами 223.
    expect(await reviewTodayCount(page)).toBe(SESSION_LIMIT);
    expect(await reviewRemainder(page)).toBe(BANK_TOTAL - SESSION_LIMIT);

    const button = page.getByTestId(TESTID.reviewToday);
    await button.click();
    await waitForQuestion(page);

    // Прогон — ровно одна сессия, а не весь банк.
    expect(await counterText(page)).toBe(`1 / ${SESSION_LIMIT}`);

    for (let answered = 0; answered < 2; answered++) {
      await answerQuestion(page, 'correct');
      if (answered === 0) {
        await page.getByTestId(TESTID.nextButton).click();
        await waitForQuestion(page);
      }
    }

    // Оба ответа записали расписание: next > now, поэтому вопросы вышли из пула.
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    // Сессия остаётся ПОЛНОЙ — она набирается из остатка пула, — а уменьшается
    // именно остаток. Это и есть смысл разделения: «повторить 30 сегодня»,
    // а не «повторить всё».
    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    expect(await reviewTodayCount(page)).toBe(SESSION_LIMIT);
    expect(await reviewRemainder(page)).toBe(BANK_TOTAL - SESSION_LIMIT - 2);

    // И реестр расписания переживает reload.
    await page.reload();
    await waitForDashboard(page);
    expect(await reviewTodayCount(page)).toBe(SESSION_LIMIT);
    expect(await reviewRemainder(page)).toBe(BANK_TOTAL - SESSION_LIMIT - 2);

    const stored = await readPersisted(page);
    // Текущая версия persist: 6 с spec 061, 7 с spec 063 — spec 065 её не меняет.
    expect(stored?.version).toBe(PERSIST_VERSION);
    expect(Object.keys(stored?.state.scheduledReviews ?? {})).toHaveLength(BANK_TOTAL);
  });

  test('реестр расписания пишется только review-прогоном', async ({ page }) => {
    await gotoApp(page);

    // Обычный поток: ответ не должен менять расписание повторений.
    await page.getByTestId(TESTID.dashboardContinue).click();
    await waitForQuestion(page);
    const before = Object.keys((await readPersisted(page))?.state.scheduledReviews ?? {}).length;
    await answerQuestion(page, 'wrong');
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    expect(await reviewTodayCount(page)).toBe(SESSION_LIMIT);
    const after = Object.keys((await readPersisted(page))?.state.scheduledReviews ?? {}).length;
    expect(after).toBe(before);
    // Ошибка обычного потока по-прежнему кормит отдельную кнопку «Повторить ошибки».
    await expect(page.getByTestId(TESTID.reviewWrong)).toContainText('1 вопр.');
  });

  test('review-прогон не расходует бесплатный лимит и ведёт всю сессию', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId(TESTID.reviewToday).click();
    await waitForQuestion(page);

    // Хедер показывает длину сессии: это не 5 бесплатных вопросов.
    expect(await counterText(page)).toBe(`1 / ${SESSION_LIMIT}`);

    // Пятый ответ обычного потока уже упёрся бы в пейволл; в review его нет.
    for (let i = 0; i < 5; i++) {
      await answerQuestion(page, 'correct');
      await page.getByTestId(TESTID.nextButton).click();
    }
    await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);
    expect(await counterText(page)).toBe(`6 / ${SESSION_LIMIT}`);
  });

  test('due-профиль → «Повторить (30)» и «Ещё N» на итогах прогона', async ({ page }) => {
    // Профиль, у которого просрочен весь банк: 253 в пуле, 30 в одной сессии.
    await seedDueProfile(page);
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    expect(await reviewTodayCount(page)).toBe(SESSION_LIMIT);
    // Новых вопросов нет: приглашение к обучению не показывается.
    await expect(page.getByTestId(TESTID.startLearning)).toHaveCount(0);
    expect(await reviewRemainder(page)).toBe(BANK_TOTAL - SESSION_LIMIT);

    await page.getByTestId(TESTID.reviewToday).click();
    await waitForQuestion(page);
    expect(await counterText(page)).toBe(`1 / ${SESSION_LIMIT}`);

    // Ответ сдвигает `next` в будущее: вопрос выходит из пула повторения.
    await answerQuestion(page, 'correct');
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(/^2\s*\/\s*30$/);
  });

  test('на итогах прогона остаток открывается кнопкой «Ещё N»', async ({ page }) => {
    // Профиль с просроченным банком + прогон темы целиком: экран итогов
    // review-прогона открывается только по завершении списка.
    const size = topicSize(TOPIC);
    await seedDueProfile(page);
    await seedTopicRun(page, TOPIC, size);
    await gotoApp(page);
    await openSeededRun(page, TOPIC);

    for (let i = 1; i <= size; i++) {
      await answerQuestion(page, 'correct');
      await page.getByTestId(TESTID.nextButton).click();
    }
    await expect(page.getByTestId(TESTID.resultsScreen)).toBeVisible({ timeout: 15000 });

    // Прогон темы — review-режим, пул просрочен: остаток предлагается кнопкой.
    const nextBatch = page.getByTestId(TESTID.reviewNextBatch);
    await expect(nextBatch).toBeVisible();
    // spec 065: подпись фиксирована — «Ещё 30» = размер одной сессии
    // (SESSION_LIMIT), а сколько реально осталось, показывает счётчик справа.
    await expect(nextBatch).toContainText(`Ещё ${SESSION_LIMIT}`);

    // Клик открывает новую сессию ровно такого размера — обещание совпадает
    // с фактом, и оно не длиннее одной сессии.
    await nextBatch.click();
    await waitForQuestion(page);
    expect(await counterText(page)).toBe(`1 / ${SESSION_LIMIT}`);
  });

  test('повторять нечего → вход в занятие не предлагается', async ({ page }) => {
    await seedExhaustedProfile(page);
    await gotoApp(page);

    // Весь реестр в будущем, новых вопросов нет: обе кнопки пула скрыты.
    await expect(page.getByTestId(TESTID.reviewToday)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.continueLearning)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.startLearning)).toHaveCount(0);
  });

  test('сессия не длиннее SESSION_LIMIT при пуле больше сессии', async ({ page }) => {
    await seedDueProfile(page);
    await gotoApp(page);

    // 253 просроченных в пуле, но каждая сессия — не больше 30.
    expect(await reviewTodayCount(page)).toBe(SESSION_LIMIT);
    expect(BANK_TOTAL).toBeGreaterThan(SESSION_LIMIT);

    const stored = await readPersisted(page);
    expect(Object.keys(stored?.state.scheduledReviews ?? {})).toHaveLength(BANK_TOTAL);
  });
});
