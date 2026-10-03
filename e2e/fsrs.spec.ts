import {
  test,
  expect,
  answerQuestion,
  blockAnalytics,
  counterText,
  gotoApp,
  waitForDashboard,
  waitForQuestion,
  readPersisted,
  PERSIST_VERSION,
  TESTID,
} from './fixtures';

/**
 * FSRS-lite (spec 052), кнопка «Повторить сегодня (N)» на Dashboard.
 *
 * Живой банк — 253 вопроса (src/data/questions/_order.json), профиль свежий:
 * реестр расписания пуст, а отсутствие записи трактуется как «пора сейчас»,
 * поэтому N = размер банка. После каждого ответа запись пересчитывается
 * (`next` уходит в будущее), и вопрос выходит из N.
 */

const BANK_TOTAL = 253;

/** Заголовок кнопки, из которого берётся N: «Повторить сегодня (253)». */
const TITLE = /^Повторить сегодня \((\d+)\)$/;

async function reviewTodayCount(page: import('@playwright/test').Page): Promise<number> {
  const text = (await page.getByTestId(TESTID.reviewToday).innerText()).trim();
  const match = TITLE.exec(text.split('\n')[0].trim());
  if (!match) throw new Error(`не удалось разобрать N из «${text}»`);
  return Number(match[1]);
}

test.describe.serial('FSRS-lite — повторение сегодня', () => {
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

  test('пустая история → N = 253, ответы уменьшают N на Dashboard', async ({ page }) => {
    await gotoApp(page);

    const button = page.getByTestId(TESTID.reviewToday);
    await expect(button).toBeVisible();
    expect(await reviewTodayCount(page)).toBe(BANK_TOTAL);

    // Клик запускает review-прогон ровно по этим вопросам.
    await button.click();
    await waitForQuestion(page);

    for (let answered = 0; answered < 2; answered++) {
      await answerQuestion(page, 'correct');
      if (answered === 0) {
        await page.getByTestId(TESTID.nextButton).click();
        await waitForQuestion(page);
      }
    }

    // Оба ответа записали расписание: next > now, поэтому вопросы ушли в будущее.
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    expect(await reviewTodayCount(page)).toBe(BANK_TOTAL - 2);

    // И реестр расписания переживает reload: N не откатывается к размеру банка.
    await page.reload();
    await waitForDashboard(page);
    expect(await reviewTodayCount(page)).toBe(BANK_TOTAL - 2);

    const stored = await readPersisted(page);
    // Текущая версия persist: 6 с spec 061 (retention добавил dailyGoalXp + todayXp).
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

    expect(await reviewTodayCount(page)).toBe(BANK_TOTAL);
    const after = Object.keys((await readPersisted(page))?.state.scheduledReviews ?? {}).length;
    expect(after).toBe(before);
    // Ошибка обычного потока по-прежнему кормит отдельную кнопку «Повторить ошибки».
    await expect(page.getByTestId(TESTID.reviewWrong)).toContainText('1 вопр.');
  });

  test('review-прогон не расходует бесплатный лимит и ведёт весь банк', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId(TESTID.reviewToday).click();
    await waitForQuestion(page);

    // Хедер показывает длину прогона: это весь банк, а не 5 бесплатных вопросов.
    expect(await counterText(page)).toBe(`1 / ${BANK_TOTAL}`);

    // Пятый ответ обычного потока уже упёрся бы в пейволл; в review его нет.
    for (let i = 0; i < 5; i++) {
      await answerQuestion(page, 'correct');
      await page.getByTestId(TESTID.nextButton).click();
    }
    await expect(page.getByTestId(TESTID.paywall)).toHaveCount(0);
    expect(await counterText(page)).toBe(`6 / ${BANK_TOTAL}`);
  });
});
