import {
  test,
  expect,
  gotoApp,
  topicButton,
  topicSize,
  waitForQuestion,
  TOPICS,
  TOPIC_INDEX,
  TESTID,
} from './fixtures';

/**
 * G1 (dashboard happy path / status) and G2 (topics, three representative topics —
 * the approved STOP-1 scope) from `.project/drafts/app-map.md` §6.
 *
 * Every size and title is read from the live bank manifest and the topic registry,
 * so a bank batch (241 → 253) cannot invalidate the assertions.
 */

const G2_TOPICS = ['file_permissions', 'users_groups', 'deploy_systems'] as const;

test.describe('дашборд', () => {
  test('renders the entry point and the RHCSA programme', async ({ page }) => {
    await gotoApp(page);

    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible();
    await expect(page.getByTestId(TESTID.dashboardSubtitle)).toHaveText(
      'Подготовка к RHCSA за 15 минут в день'
    );
    await expect(page.getByText('Программа RHCSA')).toBeVisible();
  });

  test('lists every topic as a startable button with its live counter', async ({ page }) => {
    await gotoApp(page);

    await expect(page.getByText(`${TOPICS.length} из ${TOPICS.length} тем`)).toBeVisible();

    // Кнопок тем ровно столько же, сколько тем в реестре. Считаются ИМЕННО
    // кнопки: `[data-testid^="topic-"]` сюда не годится — под префикс попадает и
    // бейдж-подсказка spec 065 (`topic-first-cta`, span), и переключатель темы
    // (`theme-toggle` не задет, а вот префикс `topic-` — общий контракт).
    const buttons = page.getByRole('button', { name: /^Начать тему: / });
    await expect(buttons).toHaveCount(TOPICS.length);

    for (const topic of TOPICS) {
      const button = topicButton(page, topic.key);
      await expect(button).toBeVisible();
      await expect(button).toHaveAccessibleName(`Начать тему: ${topic.title}`);
      // `${count} вопр.` comes from getTopicCount(), i.e. the generated manifest.
      await expect(button).toContainText(`${topicSize(topic.key)} вопр.`);
    }

    const sum = Object.values(TOPIC_INDEX.byTopic).reduce((acc, n) => acc + n, 0);
    expect(sum).toBe(TOPIC_INDEX.total);

    // spec 065 (К5.2): ровно одна тема отмечена как точка входа. Бейдж — span,
    // а не кнопка, поэтому счётчик `[data-testid^="topic-"]` выше его не видит.
    await expect(page.getByTestId('topic-first-cta')).toHaveCount(1);
    await expect(page.getByTestId('topic-first-cta')).toHaveText('начните с этой');
    await expect(topicButton(page, TOPICS[0].key).getByTestId('topic-first-cta')).toBeVisible();
  });

  test('opens on a clean profile: no progress, exam entry point, legal disclaimer', async ({
    page,
  }) => {
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.dashboardProgress)).toContainText(
      `0 из ${TOPIC_INDEX.total}`
    );
    // spec 068: единственный вход в экзамен — `exam-mode` (spec 054, Pro-only).
    // Legacy-кнопка «Режим экзамена (20 вопросов, 30 минут)» удалена.
    await expect(page.getByTestId('exam-mode')).toContainText(
      'Exam mode — 30/60/90 вопросов с разбором'
    );
    await expect(page.getByTestId('start-exam')).toHaveCount(0);
    await expect(page.getByTestId(TESTID.dashboardContinue)).toBeVisible();
    await expect(page.locator('[data-disclaimer="legal"]')).toContainText('независимый тренажёр');
    // A clean profile offers no resume banner and nothing to repeat.
    await expect(page.getByTestId(TESTID.resumeBanner)).toHaveCount(0);
    await expect(page.getByTestId(TESTID.reviewWrong)).toHaveCount(0);

    // spec 065 (К2.3/К5.4): свежий профиль приглашает учиться, а не повторять.
    // «Повторить сегодня (253)» — дефект до spec 065, поэтому N проверяется
    // отдельно в fsrs.spec.ts.
    await expect(page.getByTestId(TESTID.startLearning)).toHaveText(/Начать обучение/);
  });
});

test.describe('G2 — темы', () => {
  const cases = G2_TOPICS.map((slug) => [slug, TOPICS.find((t) => t.key === slug)!.title]);

  for (const [slug, title] of cases) {
    test(`тема ${title}: ${slug} запускается на первом вопросе`, async ({ page }) => {
      await gotoApp(page);

      await topicButton(page, slug).click();
      await waitForQuestion(page);

      await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
        new RegExp(`^1\\s*/\\s*${topicSize(slug)}$`)
      );
      await expect(page.getByTestId(TESTID.questionProgress)).toBeVisible();
    });
  }

  test('starting another topic resets the position to the first question', async ({ page }) => {
    const [firstSlug, secondSlug] = G2_TOPICS;

    await gotoApp(page);

    await topicButton(page, firstSlug).click();
    await waitForQuestion(page);
    const firstSize = topicSize(firstSlug);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^1\\s*/\\s*${firstSize}$`)
    );

    // Back to the topics and into a DIFFERENT topic: the counter must restart.
    await page.getByTestId(TESTID.headerHome).click();
    await expect(page.getByTestId(TESTID.dashboardContinue)).toBeVisible({ timeout: 10000 });

    await topicButton(page, secondSlug).click();
    await waitForQuestion(page);

    const secondSize = topicSize(secondSlug);
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      new RegExp(`^1\\s*/\\s*${secondSize}$`)
    );
    expect(secondSize).not.toBe(firstSize);
  });
});
