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
  seedHistoryProfile,
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

/**
 * Контракт кнопки входа в занятие после ux-copy-3 (2026-10-07): подпись —
 * «Продолжить обучение», правый счётчик — фиксированное обещание сессии
 * «15 минут · 30 вопросов».
 *
 * Числа сессии в подписи больше нет: N не живёт в DOM, поэтому размер сессии
 * проверяется по счётчику самого прогона (`counterText` → `1 / 30`), а не по
 * подписи кнопки. Остатка пула (`data-fsrs-remaining`) в DOM тоже нет —
 * хвост наблюдается по persist (см. `dueInFuture`).
 */
const TITLE = /^Продолжить обучение$/;
const PROMISE = '15 минут · 30 вопросов';

/** Подпись кнопки повторения и обещание сессии — оба узла контракта. */
async function expectReviewCta(page: import('@playwright/test').Page): Promise<void> {
  const button = page.getByTestId(TESTID.reviewToday);
  // Подпись — тоже часть контракта: если она поедет, тест обязан упасть здесь,
  // с понятным сообщением, а не в математике где-то дальше.
  const text = (await button.innerText()).trim();
  if (!TITLE.test(text.split('\n')[0].trim())) {
    throw new Error(`подпись кнопки повторения изменилась: «${text}»`);
  }
  await expect(button).toContainText(PROMISE);
}

/**
 * Сколько записей расписания ушло в будущее (`next > now`).
 *
 * Замена удалённому `data-fsrs-remaining` (ux-copy-3): размер хвоста за одной
 * сессией больше не рендерится ни числом, ни подписью, поэтому остаток
 * наблюдается по источнику правды — persist-состоянию, а не по DOM.
 */
async function dueInFuture(page: import('@playwright/test').Page): Promise<number> {
  const stored = await readPersisted(page);
  const reviews = (stored?.state.scheduledReviews ?? {}) as Record<string, { next: number }>;
  const now = Date.now();
  return Object.values(reviews).filter((record) => record.next > now).length;
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

  test('свежий профиль → только «Начать обучение», без «Повторить» (spec 066)', async ({ page }) => {
    await gotoApp(page);

    // Дефект до spec 065: свежий профиль видел «Повторить сегодня (253)».
    // Дефект до spec 066: профиль видел приглашение И повторение одновременно —
    // кнопку повторения плюс строку остатка с числом. Строку удалил ux-copy-3
    // (2026-10-07) вместе с её узлом `review-today-remainder`; ассерт ниже
    // фиксирует, что узел больше не рендерится ни на одном профиле.
    await expect(page.getByTestId(TESTID.startLearning)).toBeVisible();
    await expect(page.getByTestId(TESTID.startLearning)).toHaveText(/Начать обучение/);

    // Ветки CTA взаимоисключающие: повторять новичку нечего.
    await expect(page.getByTestId(TESTID.reviewToday)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.reviewRemainder)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.continueLearning)).toHaveCount(0);
    // Кнопка повторения не возвращается ни в одном виде: повторять новичку нечего.
    // Подпись «Продолжить»/«Повторить» проверяется по кнопкам, а не по тексту
    // страницы: «253» законно встречается в прогрессе («0 из 253») и в счётчике
    // темы, поэтому широкий поиск по числу дал бы ложное срабатывание.
    await expect(page.getByRole('button', { name: /Повторить/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Продолжить обучение|Продолжить изучение/ })).toHaveCount(0);
  });

  test('после первого ответа → кнопка повторения, приглашение снято (spec 066)', async ({ page }) => {
    await gotoApp(page);

    // Профиль ещё свежий: только приглашение.
    await expect(page.getByTestId(TESTID.startLearning)).toBeVisible();
    await expect(page.getByTestId(TESTID.reviewToday)).toHaveCount(0);

    // Один ответ в обычном потоке: `recordQuestionStat` делает статистику
    // непустой, поэтому признак «свежести» снимается сам.
    await page.getByTestId(TESTID.dashboardContinue).click();
    await waitForQuestion(page);
    await answerQuestion(page, 'correct');
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    // Кнопка рендерится только при `dueCount > 0`, то есть «сессия непуста»
    // доказано самим её появлением: числа сессии подпись больше не несёт.
    await expectReviewCta(page);
    await expect(page.getByTestId(TESTID.startLearning)).toHaveCount(0);
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
    // История нужна: spec 066 не показывает повторение на свежем профиле.
    // Пул БОЛЬШЕ одной сессии — иначе хвоста за её пределами не существует.
    const pool = 2 * SESSION_LIMIT;
    // `once`: сценарий перезагружает страницу и проверяет, что уменьшенный
    // остаток ПЕРЕЖИЛ reload — сид на каждой навигации затёр бы его.
    await seedHistoryProfile(page, pool, { once: true });
    await gotoApp(page);

    // Пул 60, сессия 30. Размер сессии проверяется по счётчику прогона (ниже),
    // а не по подписи кнопки: числа в ней больше нет (ux-copy-3).
    await expectReviewCta(page);
    // Строки остатка больше нет вовсе — узел и его data-атрибут удалены.
    await expect(page.getByTestId(TESTID.reviewRemainder)).toHaveCount(0);
    // Хвост наблюдается по persist: сид планирует в будущее весь банк за
    // пределами пула, то есть `BANK_TOTAL - pool` записей уже в будущем.
    expect(await dueInFuture(page)).toBe(BANK_TOTAL - pool);

    const button = page.getByTestId(TESTID.reviewToday);
    await button.click();
    await waitForQuestion(page);

    // Прогон — ровно одна сессия, а не весь пул.
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
    // именно остаток: к «будущим» добавились ровно два отвеченных вопроса.
    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    await expectReviewCta(page);
    expect(await dueInFuture(page)).toBe(BANK_TOTAL - pool + 2);

    // И реестр расписания переживает reload.
    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    expect(await dueInFuture(page)).toBe(BANK_TOTAL - pool + 2);

    const stored = await readPersisted(page);
    // Текущая версия persist: 6 с spec 061, 7 с spec 063 — spec 065 её не меняет.
    expect(stored?.version).toBe(PERSIST_VERSION);
    expect(Object.keys(stored?.state.scheduledReviews ?? {})).toHaveLength(BANK_TOTAL);
  });

  test('реестр расписания не меняется от ответа в обычном потоке', async ({ page }) => {
    // Профиль с историей: без неё spec 066 не показывает ветки повторения.
    // `seedDueProfile` закрывает ровно ОДИН вопрос (первый в банке), а не первые
    // N: `answers`/`wrongQuestionIds` сида должны совпадать с реально
    // отвеченным вопросом потока, иначе живой вопрос №1 окажется уже отвеченным
    // и его варианты будут `disabled`.
    await seedDueProfile(page);
    await gotoApp(page);

    const before = Object.keys((await readPersisted(page))?.state.scheduledReviews ?? {}).length;

    await page.getByTestId(TESTID.dashboardContinue).click();
    await waitForQuestion(page);
    await answerQuestion(page, 'wrong');
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    // Ответ обычного потока расписание повторений не трогает…
    const after = Object.keys((await readPersisted(page))?.state.scheduledReviews ?? {}).length;
    expect(after).toBe(before);
    expect(after).toBe(BANK_TOTAL);

    // …и «Повторить ошибки» кормится отдельным списком.
    await expect(page.getByTestId(TESTID.reviewWrong)).toContainText('1 вопр.');
    // Повторение по-прежнему доступно: профиль с историей, ветки не скрыты.
    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
  });

  test('review-прогон не расходует бесплатный лимит и ведёт всю сессию', async ({ page }) => {
    // История нужна: spec 066 не показывает повторение на свежем профиле.
    await seedHistoryProfile(page, SESSION_LIMIT);
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

  test('due-профиль → сессия на 30 и «Ещё N» на итогах прогона', async ({ page }) => {
    // Профиль, у которого просрочен весь банк: 253 в пуле, 30 в одной сессии.
    await seedDueProfile(page);
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    await expectReviewCta(page);
    // Новых вопросов нет: приглашение к обучению не показывается.
    await expect(page.getByTestId(TESTID.startLearning)).toHaveCount(0);
    // Весь банк просрочен, в будущем не запланировано ничего, а хвост за одной
    // сессией (`BANK_TOTAL - SESSION_LIMIT`) в DOM больше не рендерится.
    await expect(page.getByTestId(TESTID.reviewRemainder)).toHaveCount(0);
    expect(await dueInFuture(page)).toBe(0);

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

    // 253 просроченных в пуле, но каждая сессия — не больше 30: длину сессии
    // читаем из счётчика самого прогона (подпись кнопки числа не несёт).
    await expectReviewCta(page);
    expect(BANK_TOTAL).toBeGreaterThan(SESSION_LIMIT);

    await page.getByTestId(TESTID.reviewToday).click();
    await waitForQuestion(page);
    expect(await counterText(page)).toBe(`1 / ${SESSION_LIMIT}`);

    const stored = await readPersisted(page);
    expect(Object.keys(stored?.state.scheduledReviews ?? {})).toHaveLength(BANK_TOTAL);
  });
});
