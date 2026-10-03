import { test, expect, gotoApp, isoDaysAgo, seedRetention, TESTID } from './fixtures';

/**
 * Retention UI (spec 061): streak badge + XP bar + daily goal.
 *
 * Все сценарии идут на мобильном viewport 390×844 — целевая аудитория Mini App,
 * и именно там retention-зона обязана влезать в верх экрана.
 *
 * Сиды задают `todayXp` вместе с СЕГОДНЯШНЕЙ `lastActiveDate`: гидратация
 * (`resetTodayXpIfNewDay`) обнуляет дневной счётчик при вчерашней дате, поэтому
 * «сегодняшний прогресс» без сегодняшней даты — противоречивое состояние.
 * Вчерашняя дата используется только там, где ожидается ровно 0 XP.
 */
test.describe('retention UI', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('seed: streak = 1, вчерашняя активность, todayXp = 0 → badge warning, XpBar 0/20', async ({
    page,
  }) => {
    await seedRetention(page, {
      streak: 1,
      todayXp: 0,
      lastActiveDate: isoDaysAgo(-1),
    });
    await gotoApp(page);

    const badge = page.getByTestId(TESTID.streakBadge);
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-streak-state', 'warning');
    await expect(badge).toContainText('1');
    await expect(badge).toContainText('День 1 — хорошее начало');

    await expect(page.getByTestId(TESTID.xpBarDailyLabel)).toHaveText('0 / 20 XP');
    await expect(page.getByTestId('xp-bar-fill')).toHaveCSS('width', '0px');
    await expect(page.getByTestId(TESTID.xpBar)).toHaveAttribute('data-mark-active', 'false');

    await expect(page.getByTestId(TESTID.dashboardRetention)).toBeVisible();

    // Превью для приёмки (DOD type=ui): верхняя зона Dashboard на 390×844.
    await page.screenshot({ path: '.project/drafts/061-retention-dashboard.png' });
  });

  test('seed: todayXp = 15 → XpBar 15/20, полоса 75 %, засечка неактивна', async ({ page }) => {
    await seedRetention(page, {
      streak: 1,
      todayXp: 15,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await expect(page.getByTestId('xp-bar-daily-label')).toHaveText('15 / 20 XP');
    await expect(page.getByTestId('xp-bar')).toHaveAttribute('data-xp-color', 'accent');
    await expect(page.getByTestId('xp-bar')).toHaveAttribute('data-mark-active', 'false');

    // 75 % от ширины полосы: сравниваем с самой полосой, а не с магическим числом.
    const track = page.getByTestId('xp-bar-daily');
    const fill = page.getByTestId('xp-bar-fill');
    const [trackBox, fillBox] = await Promise.all([track.boundingBox(), fill.boundingBox()]);
    expect(trackBox).not.toBeNull();
    expect(fillBox).not.toBeNull();
    const ratio = (fillBox?.width ?? 0) / (trackBox?.width ?? 1);
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.8);

    // Бейдж в состоянии active: сегодня уже занимались.
    await expect(page.getByTestId(TESTID.streakBadge)).toHaveAttribute(
      'data-streak-state',
      'active',
    );
  });

  test('seed: todayXp = 18 → засечка на 85 % активна', async ({ page }) => {
    await seedRetention(page, {
      streak: 2,
      todayXp: 18,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await expect(page.getByTestId('xp-bar-daily-label')).toHaveText('18 / 20 XP');
    await expect(page.getByTestId(TESTID.xpBarMark)).toBeVisible();
    await expect(page.getByTestId('xp-bar')).toHaveAttribute('data-mark-active', 'true');
    await expect(page.getByTestId('xp-bar')).toHaveAttribute('data-xp-color', 'green');
  });

  test('daily goal picker: цель не подтверждена → 3 карточки, выбор скрывает picker', async ({
    page,
  }) => {
    await seedRetention(page, {
      streak: 0,
      todayXp: 0,
      dailyGoalXp: null,
      lastActiveDate: null,
    });
    await gotoApp(page);

    const picker = page.getByTestId(TESTID.dailyGoalPicker);
    await expect(picker).toBeVisible();
    await expect(page.getByTestId('daily-goal-10')).toBeVisible();
    await expect(page.getByTestId('daily-goal-20')).toBeVisible();
    await expect(page.getByTestId('daily-goal-50')).toBeVisible();
    // Цель ещё не выбрана, но дефолт уже работает: бар показывает 0 / 20 XP.
    await expect(page.getByTestId('xp-bar-daily-label')).toHaveText('0 / 20 XP');

    await page.getByTestId('daily-goal-50').click();

    await expect(picker).toHaveCount(0);
    await expect(page.getByTestId('xp-bar-daily-label')).toHaveText('0 / 50 XP');

    // Выбор ушёл в persist (dailyGoalXp: 50, версия 6) — это и есть контракт
    // сохранения; восстановление из persist покрыто unit-тестами
    // `daily-goal.test.ts` (в e2e сид-скрипт фикстуры выполняется на каждой
    // навигации и перетёр бы сохранённый выбор — проверять reload здесь нельзя).
    const stored = await page.evaluate(() => window.localStorage.getItem('rhcsa_progress'));
    expect(stored).toContain('"dailyGoalXp":50');
    expect(stored).toContain('"version":6');
  });

  test('retention-зона не ломает существующие кнопки Dashboard', async ({ page }) => {
    await seedRetention(page, {
      streak: 3,
      todayXp: 10,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await expect(page.getByTestId('exam-mode')).toBeVisible();
    await expect(page.getByTestId('analytics-mode')).toBeVisible();
    await expect(page.getByTestId('dashboard-progress')).toBeVisible();
  });

  test('тап по streak badge ведёт на аналитику', async ({ page }) => {
    await seedRetention(page, {
      streak: 4,
      todayXp: 10,
      lastActiveDate: isoDaysAgo(0),
    });
    await gotoApp(page);

    await page.getByTestId(TESTID.streakBadge).click();

    await expect(page.getByTestId('analytics')).toBeVisible({ timeout: 15000 });
  });
});
