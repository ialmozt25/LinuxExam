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
  seedOnboarding,
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
 * N считается по отобранной сессии, а профиль без ответов (Fresh User Mode)
 * видит единственную CTA Hero — «Начать первый вопрос →».
 *
 * Живой банк — 253 вопроса (`src/data/questions/_order.json`).
 */

const BANK_TOTAL = 253;
/** SESSION_LIMIT из `src/domain/fsrs.ts` — размер одной сессии. */
const SESSION_LIMIT = 30;
/** Тема для проверки итогов прогона: та же, что в results.spec.ts. */
const TOPIC = 'file_permissions';

/**
 * Контракт кнопки входа в занятие: подпись — «Продолжить обучение», правая
 * часть — дневной счётчик ОТВЕТОВ (`data-testid="cta-counter"`, задание
 * ux-counter) в трёх состояниях:
 *
 *   N = 0     → «30 вопросов»        (день не начат, обещание дня)
 *   N = 1..30 → «N из 30 вопросов»   (прогресс дня)
 *   N > 30    → «✓ N»                (цель взята)
 *
 * История подписи: ux-copy-3 (2026-10-07) сделал правую часть хардкодом
 * обещания («15 минут · 30 вопросов»); ux-copy-3-fix вернул в неё число —
 * размер СЛЕДУЮЩЕЙ сессии, N = min(SESSION_LIMIT, dueCount + newCount), и тест
 * читал его регуляркой. Задание ux-counter заменило обещание на дневное:
 * счётчик считает ответы за календарный день (сброс в полночь). Регулярка ушла
 * вместе с ним — правая часть читается по своему `data-testid`, а НЕ по форме
 * строки: на N > 30 в подписи появляется «✓ N» без слова «вопросов».
 *
 * Почему прежние ассерты `toBe(SESSION_LIMIT)` в силе: из трёх состояний
 * обещание дня несут два первых, и цель дня численно совпадает с размером
 * сессии (оба 30 — `DAILY_ANSWER_GOAL` в Dashboard.tsx и `SESSION_LIMIT` в
 * src/domain/fsrs.ts). Они читают из подписи именно обещанную цель дня; размер
 * же сессии, как и раньше, проверяется счётчиком прогона (`counterText`, «1 / 30»).
 *
 * Остатка пула (`data-fsrs-remaining`) в DOM нет — хвост наблюдается по persist
 * (см. `dueInFuture`).
 */
const TITLE = /^Продолжить обучение$/;
/** `data-testid` правой части CTA (Dashboard.tsx, задание ux-counter). */
const CTA_COUNTER_TESTID = 'cta-counter';
/** Ключ persist — тот же литерал, что читает `readPersisted` из fixtures.ts. */
const PERSIST_STORAGE_KEY = 'rhcsa_progress';

/** Текст правой части кнопки ровно как он отрендерен. */
async function ctaCounterText(page: import('@playwright/test').Page): Promise<string> {
  return (await page.getByTestId(CTA_COUNTER_TESTID).innerText()).trim();
}

/**
 * Обещание кнопки, прочитанное из правой части подписи.
 *
 * Подпись — часть контракта: если она поедет, тест обязан упасть здесь, с
 * понятным сообщением, а не «не разобрать N» где-то дальше. Обещание дня несут
 * первые два состояния — «30 вопросов» и «N из 30 вопросов»; в третьем («✓ N»)
 * обещания в подписи уже нет, и это ошибка вызова, а не пустое значение.
 */
async function reviewTodayCount(page: import('@playwright/test').Page): Promise<number> {
  const text = (await page.getByTestId(TESTID.reviewToday).innerText()).trim();
  if (!TITLE.test(text.split('\n')[0].trim())) {
    throw new Error(`подпись кнопки повторения изменилась: «${text}»`);
  }
  const counter = await ctaCounterText(page);
  const within = /из\s+(\d+)/.exec(counter);
  if (within) return Number(within[1]);
  const bare = /^(\d+)\s+вопросов$/.exec(counter);
  if (bare) return Number(bare[1]);
  throw new Error(`правая часть CTA не обещает дневную цель: «${counter}»`);
}

/** Кнопка обязана появиться с непустой сессией; возвращает обещание дня. */
async function expectReviewCta(page: import('@playwright/test').Page): Promise<number> {
  const goal = await reviewTodayCount(page);
  expect(goal).toBeGreaterThanOrEqual(1);
  return goal;
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

/**
 * Досеивает дневной счётчик ответов в persisted-снимок.
 *
 * `seedHistoryProfile` пишет состояние через `emptyPersistedState()`, а полей
 * `todayAnswered`/`todayAnsweredDate` в его типе нет (правка `e2e/fixtures.ts` вне
 * разрешённых путей задания), поэтому счётчик дописывается ВТОРЫМ init-скриптом
 * поверх уже записанного снимка. Порядок init-скриптов и есть контракт: Playwright
 * выполняет их в порядке регистрации, значит сначала обязан идти сид профиля.
 *
 * Дата считается В СТРАНИЦЕ: сравнение с `today` приложения иначе разъезжалось бы
 * на границе суток. `todayAnsweredDate = today` для гидратации означает «счётчик
 * уже сегодняшний», поэтому `resetTodayXpIfNewDay` его не обнулит.
 */
async function seedDailyAnswered(
  page: import('@playwright/test').Page,
  answered: number,
): Promise<void> {
  await page.addInitScript(
    ({ key, seeded }: { key: string; seeded: number }) => {
      const today = new Date().toISOString().slice(0, 10);
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
      parsed.state = { ...(parsed.state ?? {}), todayAnswered: seeded, todayAnsweredDate: today };
      window.localStorage.setItem(key, JSON.stringify(parsed));
    },
    { key: PERSIST_STORAGE_KEY, seeded: answered },
  );
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

  test('профиль без ответов → только «Начать обучение», без «Повторить» (spec 066)', async ({ page }) => {
    // Fresh User Mode: онбординг пройден, статистика пуста. Базовый профиль
    // авто-фикстуры теперь моделирует пользователя С историей, поэтому состояние
    // «до первого ответа» сеется явно.
    await seedOnboarding(page, true);
    await gotoApp(page);

    // Дефект до spec 065: свежий профиль видел «Повторить сегодня (253)».
    // Дефект до spec 066: профиль видел приглашение И повторение одновременно —
    // кнопку повторения плюс строку остатка с числом. Строку удалил ux-copy-3
    // (2026-10-07) вместе с её узлом `review-today-remainder`; ассерт ниже
    // фиксирует, что узел больше не рендерится ни на одном профиле.
    await expect(page.getByTestId(TESTID.startLearning)).toBeVisible();
    await expect(page.getByTestId(TESTID.startLearning)).toHaveText(/Начать первый вопрос/);

    // Ветки CTA взаимоисключающие: повторять новичку нечего.
    await expect(page.getByTestId(TESTID.reviewToday)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.reviewRemainder)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.continueLearning)).toHaveCount(0);
    // Кнопка повторения не возвращается ни в одном виде: повторять новичку нечего.
    // Подпись «Продолжить»/«Повторить» проверяется по кнопкам, а не по тексту
    // страницы: число банка законно встречается в подзаголовке Hero («253 вопроса»)
    // и в счётчике темы, поэтому широкий поиск по числу дал бы ложное срабатывание.
    await expect(page.getByRole('button', { name: /Повторить/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Продолжить обучение|Продолжить изучение/ })).toHaveCount(0);
  });

  test('после первого ответа → кнопка повторения, приглашение снято (spec 066)', async ({ page }) => {
    await seedOnboarding(page, true);
    await gotoApp(page);

    // Профиль ещё без ответов: только приглашение.
    await expect(page.getByTestId(TESTID.startLearning)).toBeVisible();
    await expect(page.getByTestId(TESTID.reviewToday)).toHaveCount(0);

    // Один ответ: `recordQuestionStat` делает статистику непустой, поэтому признак
    // «свежести» снимается сам. В Fresh User Mode `dashboard-continue` скрыт
    // (контракт «одна CTA до первого ответа»), поэтому вход в занятие — сама
    // кнопка «Начать обучение»: она стартует сессию дня.
    await page.getByTestId(TESTID.startLearning).click();
    await waitForQuestion(page);
    await answerQuestion(page, 'correct');
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    // Правая часть — счётчик ответов дня: один живой ответ обычного потока уже
    // поднял N до 1, а обещанная цель дня (численно = SESSION_LIMIT) видна в той
    // же подписи. Кнопка рендерится только при `dueCount > 0`.
    expect(await expectReviewCta(page)).toBe(SESSION_LIMIT);
    expect(await ctaCounterText(page)).toBe(`1 из ${SESSION_LIMIT} вопросов`);
    await expect(page.getByTestId(TESTID.startLearning)).toHaveCount(0);
  });

  test('«Начать первый вопрос» в Fresh User Mode стартует занятие', async ({ page }) => {
    await seedOnboarding(page, true);
    await gotoApp(page);

    // Список тем в этом режиме скрыт (до первого ответа 14 тем — выбор без
    // основания), поэтому CTA ведёт в прогон. Прежний контракт «CTA скроллит к
    // списку тем» принадлежал ветке профиля БЕЗ пройденного онбординга: в рантайме
    // она недостижима (App уводит такой профиль на демо-квиз), и её пинит
    // юнит-тест `Dashboard.cta.test.tsx`.
    await expect(page.getByTestId(TESTID.dashboardTopics)).toHaveCount(0);

    await page.getByTestId(TESTID.startLearning).click();
    await waitForQuestion(page);
    expect(await counterText(page)).toMatch(/^1 \/ \d+$/);
  });

  test('ответы в прогоне уменьшают остаток и переживают reload', async ({ page }) => {
    // История нужна: spec 066 не показывает повторение на свежем профиле.
    // Пул БОЛЬШЕ одной сессии — иначе хвоста за её пределами не существует.
    const pool = 2 * SESSION_LIMIT;
    // `once`: сценарий перезагружает страницу и проверяет, что уменьшенный
    // остаток ПЕРЕЖИЛ reload — сид на каждой навигации затёр бы его.
    await seedHistoryProfile(page, pool, { once: true });
    await gotoApp(page);

    // Пул 60, сессия 30. Сид даёт N = 0 ответов за сегодня, поэтому правая часть
    // читается как обещание дня (30), а не как размер пула (60).
    expect(await expectReviewCta(page)).toBe(SESSION_LIMIT);
    expect(await ctaCounterText(page)).toBe(`${SESSION_LIMIT} вопросов`);
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
    expect(await expectReviewCta(page)).toBe(SESSION_LIMIT);
    // Два ответа review-прогона подняли дневной счётчик: review — отдельный
    // поток, но ответ в нём считается так же (единая воронка `recordQuestionStat`).
    expect(await ctaCounterText(page)).toBe(`2 из ${SESSION_LIMIT} вопросов`);
    expect(await dueInFuture(page)).toBe(BANK_TOTAL - pool + 2);

    // И реестр расписания переживает reload.
    await page.reload();
    await waitForDashboard(page);
    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    // …и дневной счётчик переживает reload тоже: день опознаётся своим маркером
    // (`todayAnsweredDate`), а не `lastActiveDate` — последний двигает только
    // regular-поток, поэтому день «из одних review» по нему не опознался бы и
    // сброс на гидратации стёр бы сегодняшние ответы.
    expect(await ctaCounterText(page)).toBe(`2 из ${SESSION_LIMIT} вопросов`);
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
    expect(await expectReviewCta(page)).toBe(SESSION_LIMIT);
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

    // 253 просроченных в пуле, но каждая сессия — не больше 30. Обещание дня из
    // подписи (30) обязано совпасть с фактом: прогон открывается на 30, и счётчик
    // прогона показывает «1 / 30».
    const promised = await expectReviewCta(page);
    expect(promised).toBe(SESSION_LIMIT);
    expect(BANK_TOTAL).toBeGreaterThan(SESSION_LIMIT);

    await page.getByTestId(TESTID.reviewToday).click();
    await waitForQuestion(page);
    expect(await counterText(page)).toBe(`1 / ${promised}`);

    const stored = await readPersisted(page);
    expect(Object.keys(stored?.state.scheduledReviews ?? {})).toHaveLength(BANK_TOTAL);
  });

  /**
   * Три состояния правой части CTA (задание ux-counter). Порог = 30
   * (`DAILY_ANSWER_GOAL` в Dashboard.tsx: численно совпадает с SESSION_LIMIT, но
   * это норма ДНЯ, а не потолок одного прогона).
   */
  test('CTA-счётчик, состояние 0: день не начат → «30 вопросов»', async ({ page }) => {
    // Профиль с историей: счётчик живёт на кнопке повторения, а её spec 066
    // показывает только непустому профилю.
    await seedHistoryProfile(page, SESSION_LIMIT);
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    // Сегодня ответов не было: правая часть — обещание дня, ровно та же строка,
    // что показывал ux-copy-3-fix (цель дня совпадает с размером сессии).
    expect(await ctaCounterText(page)).toBe(`${SESSION_LIMIT} вопросов`);
  });

  test('CTA-счётчик, состояние 1..30: пять живых ответов → «5 из 30 вопросов»', async ({ page }) => {
    await seedHistoryProfile(page, SESSION_LIMIT);
    await gotoApp(page);

    // Пять РЕАЛЬНЫХ ответов review-прогона: счётчик кормит `recordQuestionStat`,
    // единственная воронка всех трёх потоков (regular / review / exam), поэтому
    // «5» здесь — это пять данных ответов, а не размер сессии и не размер пула.
    await page.getByTestId(TESTID.reviewToday).click();
    await waitForQuestion(page);
    for (let i = 0; i < 5; i++) {
      await answerQuestion(page, 'correct');
      await page.getByTestId(TESTID.nextButton).click();
    }
    await page.getByTestId(TESTID.headerHome).click();
    await waitForDashboard(page);

    expect(await ctaCounterText(page)).toBe(`5 из ${SESSION_LIMIT} вопросов`);
  });

  test('CTA-счётчик, состояние >30: цель взята → «✓ 31»', async ({ page }) => {
    // 31 живой ответ стоил бы минуты прогона, а проверяется здесь РЕНДЕР третьего
    // состояния: арифметику счётчика закрывают живые ответы выше (e2e) и
    // `src/store/__tests__/daily-answer-counter.test.ts` (unit). N приходит из
    // persist-сида — и ниже отдельно подтверждается, что сид действительно лёг.
    await seedHistoryProfile(page, SESSION_LIMIT);
    await seedDailyAnswered(page, SESSION_LIMIT + 1);
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.reviewToday)).toBeVisible();
    const stored = await readPersisted(page);
    expect(stored?.state.todayAnswered).toBe(SESSION_LIMIT + 1);
    // Маркер дня тоже лежит: без него гидратация сочла бы счётчик чужим и обнулила.
    const pageToday = await page.evaluate(() => new Date().toISOString().slice(0, 10));
    expect(stored?.state.todayAnsweredDate).toBe(pageToday);

    // Цель дня перекрыта: в подписи остаётся только число, слова «вопросов» нет —
    // ровно поэтому контракт читается по `data-testid`, а не по форме строки.
    expect(await ctaCounterText(page)).toBe(`✓ ${SESSION_LIMIT + 1}`);
  });
});
