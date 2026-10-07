import { test, expect, gotoApp, isoDaysAgo, seedRetention, TESTID } from './fixtures';

/**
 * Retention UI на Dashboard (spec 061 → задание «редизайн верхней части Dashboard»).
 *
 * Было: streak badge + дневная полоса XP + пикер дневной цели тремя отдельными
 * узлами. Стало (решения капитана 2026-10-08): одна карточка прогресса
 * `dashboard-progress-card` — круговой уровень, серия (число + склонённое слово из
 * домена) и XP до следующей ступени — плюс единственная полоса банка
 * `dashboard-progress` (она теперь показывается всем профилям, включая свежий).
 * StreakBadge/XpBar/DailyGoalPicker в Dashboard больше не рендерятся (B5), поэтому
 * ни одного из их `data-testid` на экране нет; собственные контракты этих
 * компонентов остаются в их unit-тестах.
 *
 * Все сценарии идут на мобильном viewport 390×844 — целевая аудитория Mini App,
 * и именно там карточка обязана влезать в верх экрана.
 *
 * Сиды задают `todayXp` вместе с СЕГОДНЯШНЕЙ `lastActiveDate` (из неё
 * `seedRetention` выводит маркер дня `todayXpDate`): гидратация
 * (`resetTodayXpIfNewDay`) обнуляет дневной счётчик по СВОЕМУ маркеру, поэтому
 * «сегодняшний прогресс» без сегодняшнего дня — противоречивое состояние.
 * Вчерашняя дата используется только там, где ожидается ровно 0 XP.
 *
 * `seedRetention` выводит `totalXp = streak × 10`, поэтому уровень и процент кольца
 * считаются от серии: streak 1 → 10 XP внутри «Новичка» (0…50), то есть 20 %.
 */
test.describe('retention UI — карточка прогресса', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('seed: streak = 1, вчерашняя активность, todayXp = 0 → «1 день подряд», «0 XP сегодня», кольцо 20 %', async ({
    page,
  }) => {
    await seedRetention(page, {
      streak: 1,
      todayXp: 0,
      lastActiveDate: isoDaysAgo(-1),
    });
    await gotoApp(page);

    const card = page.getByTestId('dashboard-progress-card');
    await expect(card).toHaveCount(1);
    await expect(card).toBeVisible();

    // Серия: число рендерится напрямую из `streak`, слово согласует доменный
    // `pluralDays` (прежняя мотивационная подпись `streakMessage` не вернулась).
    const streak = page.getByTestId('dashboard-streak');
    await expect(streak).toBeVisible();
    await expect(streak).toContainText('1');
    await expect(streak).toContainText('день подряд');

    // Дневной счётчик XP — единственный потребитель `todayXp` после снятия XpBar.
    await expect(page.getByTestId('dashboard-today-xp')).toHaveText('0 XP сегодня');

    // Уровень: имя, остаток до ступени и машинно-читаемый процент кольца.
    await expect(card).toContainText('Новичок');
    await expect(page.getByTestId('level-next')).toHaveText('10 / 50 XP до Ученика');
    await expect(page.getByRole('progressbar', { name: /Уровень Новичок/ })).toHaveAttribute(
      'aria-valuenow',
      '20'
    );

    // Снятые узлы не вернулись ни одним тестидом.
    await expect(page.getByTestId(TESTID.streakBadge)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.xpBar)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.dashboardRetention)).toHaveCount(0);

    // Превью для приёмки (DOD type=ui): верхняя зона Dashboard на 390×844.
    await page.screenshot({ path: '.project/drafts/061-retention-dashboard.png' });
  });

  test('seed: todayXp = 15 → «15 XP сегодня», кольцо по xpInLevel(totalXp), серия active', async ({
    page,
  }) => {
    await seedRetention(page, {
      streak: 1,
      todayXp: 15,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await expect(page.getByTestId('dashboard-today-xp')).toHaveText('15 XP сегодня');
    await expect(page.getByTestId('dashboard-streak')).toContainText('день подряд');
    // Кольцо показывает XP ВНУТРИ уровня (10 из 50), а не дневную цель: у серии 1
    // `seedRetention` даёт totalXp = 10, то есть 20 %.
    await expect(page.getByRole('progressbar', { name: /Уровень Новичок/ })).toHaveAttribute(
      'aria-valuenow',
      '20'
    );
    // Полоса банка — отдельный прогресс и отдельная роль.
    await expect(page.getByTestId(TESTID.dashboardProgress)).toBeVisible();
    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText('из');
  });

  test('seed: streak = 2, todayXp = 27 → «2 дня подряд», кольцо 40 %', async ({ page }) => {
    await seedRetention(page, {
      streak: 2,
      todayXp: 27,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await expect(page.getByTestId('dashboard-today-xp')).toHaveText('27 XP сегодня');
    await expect(page.getByTestId('dashboard-streak')).toContainText('2 дня подряд');
    // totalXp = 20 → 20 из 50 внутри «Новичка» = 40 %.
    await expect(page.getByRole('progressbar', { name: /Уровень Новичок/ })).toHaveAttribute(
      'aria-valuenow',
      '40'
    );
    await expect(page.getByTestId('level-next')).toHaveText('20 / 50 XP до Ученика');
  });

  test('daily goal picker: цель не подтверждена, но пикера на Dashboard больше нет', async ({
    page,
  }) => {
    // Сид оставляет цель неподтверждённой (`dailyGoalXp: null`) — ровно то
    // состояние, в котором пикер всплывал «после онбординга и до подтверждения».
    // Заданием B5 он снят с экрана: дневную цель больше не выбирают на Dashboard,
    // а дневной счётчик показывает карточка.
    await seedRetention(page, {
      streak: 0,
      todayXp: 0,
      dailyGoalXp: null,
      lastActiveDate: null,
    });
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.dailyGoalPicker)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.xpBarDailyLabel)).toHaveCount(0);
    await expect(page.getByTestId('dashboard-today-xp')).toHaveText('0 XP сегодня');
    // Нулевая серия — приглашение, а не «0 дней»; кольцо пустое (0 %).
    await expect(page.getByTestId('dashboard-streak')).toHaveText('Начни серию сегодня');
    await expect(page.getByRole('progressbar', { name: /Уровень Новичок/ })).toHaveAttribute(
      'aria-valuenow',
      '0'
    );
  });

  test('карточка не ломает существующие кнопки Dashboard', async ({ page }) => {
    await seedRetention(page, {
      streak: 3,
      todayXp: 10,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await expect(page.getByTestId('exam-mode')).toBeVisible();
    await expect(page.getByTestId('analytics-mode')).toBeVisible();
    await expect(page.getByTestId('dashboard-progress-card')).toBeVisible();
    await expect(page.getByTestId('dashboard-progress')).toBeVisible();
  });

  test('карточка информационна: тап по серии не уводит с Dashboard', async ({ page }) => {
    // Прежний вход «тап по streak badge → аналитика» ушёл вместе с бейджем (B3/B5):
    // серия стала числом внутри карточки, а вход в аналитику остался один —
    // кнопка `analytics-mode` (проверяется тестом выше). Здесь пинится именно
    // отсутствие скрытой навигации на информационном узле.
    await seedRetention(page, {
      streak: 4,
      todayXp: 10,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await page.getByTestId('dashboard-streak').click();

    await expect(page.getByTestId(TESTID.dashboardSubtitle)).toBeVisible();
    await expect(page.getByTestId('analytics')).toHaveCount(0);
  });
});
