import { test, expect, blockAnalytics, gotoApp, TESTID } from './fixtures';

/**
 * Exam mode (spec 054), поток из трёх экранов.
 *
 * Живой банк — 253 вопроса, пресет 30 → прогон из 30 вопросов. Ответы идут без
 * обратной связи: «Ответить» пишет ответ и двигает прогон дальше, объяснений нет.
 * Прогон session-only: reload его не возобновляет (это проверяется ниже).
 */

const HHMMSS = /^\d{2}:\d{2}:\d{2}$/;
const PRESET_30 = 30;

test.describe.serial('Exam mode — настройка, прогон, итоги', () => {
  test.beforeEach(async ({ page }) => {
    // Аналитический beacon из index.html ждёт `load` — без блокировки goto
    // может упасть в таймаут навигации (см. fixtures.ts).
    await blockAnalytics(page);
    // Свежий профиль: очистка РОВНО один раз, иначе reload стирал бы состояние.
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem('exam-spec-seeded')) {
        window.localStorage.clear();
        window.sessionStorage.setItem('exam-spec-seeded', '1');
      }
    });
  });

  test('настройка → прогон: таймер, ответы без фидбэка, отмена возвращает домой', async ({
    page,
  }) => {
    await gotoApp(page);

    // 1. Вход в Exam mode с Dashboard.
    await page.getByTestId('exam-mode').click();
    await expect(page.getByTestId('exam-setup')).toBeVisible();
    await expect(page.getByTestId('preset-30')).toHaveAttribute('aria-checked', 'true');

    // Переключение пресета обратимо и не запускает прогон.
    await page.getByTestId('preset-90').click();
    await expect(page.getByTestId('preset-90')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('preset-30')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('exam-setup')).toBeVisible();
    await page.getByTestId('preset-30').click();

    // 2. Старт прогона.
    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible();
    await expect(page.getByTestId('exam-progress')).toHaveText(`Вопрос 1 / ${PRESET_30}`);

    // 4. Таймер виден и в формате HH:MM:SS (пресет 30 → 00:2x:xx).
    const timer = page.getByTestId('exam-timer');
    await expect(timer).toBeVisible();
    await expect(timer).toHaveText(HHMMSS);
    await expect(timer).toHaveText(/^00:\d{2}:\d{2}$/);

    // 3. Пять ответов: вариант + «Ответить». Без фидбэка и без explanation.
    for (let answered = 1; answered <= 5; answered++) {
      await page.getByTestId('exam-option-0').click();
      await expect(page.getByTestId('exam-submit')).toBeEnabled();
      await page.getByTestId('exam-submit').click();
      await expect(page.getByTestId('exam-progress')).toHaveText(
        `Вопрос ${answered + 1} / ${PRESET_30}`
      );
      await expect(page.getByTestId(TESTID.explanation)).toHaveCount(0);
      await expect(page.getByTestId(TESTID.explanationVerdict)).toHaveCount(0);
    }
    // Следующий вопрос не показывает прежний выбор.
    await expect(page.getByTestId('exam-option-0')).toHaveAttribute('aria-pressed', 'false');

    // 5. Выход: «Прервать и выйти» → Dashboard, прогон сброшен.
    await page.getByTestId('exam-cancel').click();
    await expect(page.getByTestId('exam-mode')).toBeVisible();
    await expect(page.getByTestId('exam-run')).toHaveCount(0);

    // Прогон session-only: после reload пользователь остаётся на Dashboard,
    // а не «залипает» на экране экзамена.
    await page.reload();
    await expect(page.getByTestId('exam-mode')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('exam-run')).toHaveCount(0);
  });

  test('полный прогон 30/30 доходит до итогов и не персистится', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('exam-mode').click();
    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible();

    for (let answered = 1; answered <= PRESET_30; answered++) {
      await page.getByTestId('exam-option-0').click();
      await page.getByTestId('exam-submit').click();
      if (answered < PRESET_30) {
        await expect(page.getByTestId('exam-progress')).toHaveText(
          `Вопрос ${answered + 1} / ${PRESET_30}`
        );
      }
    }

    // Итоги: счёт, вердикт по порогу 70 % и разбор по темам из домена.
    await expect(page.getByTestId('exam-results')).toBeVisible();
    await expect(page.getByTestId('exam-score')).toHaveText(/^\d+ \/ 30 \(\d+(\.\d)?%\)$/);
    await expect(page.getByTestId('exam-verdict')).toContainText(
      /(✅ Сдано|❌ Не сдано)/
    );
    await expect(page.getByTestId('exam-breakdown')).toBeVisible();
    await expect(page.getByTestId('exam-finish-reason')).toContainText('Завершено вручную');

    // Ответы прогона не утекли в persisted-состояние: экзамен session-only.
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('rhcsa_progress');
      return raw ? (JSON.parse(raw) as { state: Record<string, unknown> }) : null;
    });
    expect(stored?.state).not.toHaveProperty('examSession');

    await page.getByTestId('back-to-dashboard').click();
    await expect(page.getByTestId('exam-mode')).toBeVisible();
  });
});
