import {
  test,
  expect,
  blockAnalytics,
  gotoApp,
  seedState,
  TOPIC_QUESTIONS,
  type PersistedQuizState,
} from './fixtures';

/**
 * Analytics (spec 058).
 *
 * Два состояния профиля: пустой (нет ни одного ответа) и частично заполненный —
 * `questionStats` по реальным qid из живого банка. Проверяются ЗНАЧЕНИЯ, а не
 * геометрия SVG: в headless-браузере `getBBox()` у таких элементов даёт 0, и
 * тест на координаты был бы ложным.
 *
 * Ожидаемая готовность НЕ хардкодится: домен считает её как
 * `Σ(точность темы × охват темы × размер темы) / размер банка`, а размеры тем
 * живые (`TOPIC_QUESTIONS`). Поэтому ожидание выводится тем же правилом — если
 * банк изменится, тест останется честным.
 */

const SEEDED_SLUGS = ['deploy_systems', 'essential_tools'] as const;
const OTHER_SLUGS = Object.keys(TOPIC_QUESTIONS).filter(
  (slug) => !(SEEDED_SLUGS as readonly string[]).includes(slug)
);

/** Один вопрос темы, отвеченный верно (attempts = 1, correct = 1). */
function statsForHalfTopic(slug: string): Record<string, unknown> {
  const question = TOPIC_QUESTIONS[slug][0];
  if (!question) throw new Error(`live bank drift: у темы "${slug}" нет вопросов`);
  return {
    [question.id]: { attempts: 1, correct: 1, lastAt: new Date().toISOString() },
  };
}

/** Ожидаемая готовность по правилу домена, в процентах. */
function expectedReadinessPercent(): number {
  const bankSize = OTHER_SLUGS.reduce((sum, s) => sum + TOPIC_QUESTIONS[s].length, 0) +
    SEEDED_SLUGS.reduce((sum, s) => sum + TOPIC_QUESTIONS[s].length, 0);
  const weighted = SEEDED_SLUGS.reduce((sum, slug) => {
    const size = TOPIC_QUESTIONS[slug].length;
    const accuracy = 1; // единственный ответ верный
    const coverage = 1 / size; // покрыт 1 вопрос темы
    return sum + accuracy * coverage * size;
  }, 0);
  return Math.round((weighted / bankSize) * 100);
}

test.describe.serial('Analytics — экран «персональный тренер»', () => {
  test.beforeEach(async ({ page }) => {
    // Она же нужна и для `page.goto`: медленный CDN аналитики из index.html
    // превращается в таймаут навигации (см. fixtures.ts).
    await blockAnalytics(page);
  });

  test('пустой профиль: Fresh User Mode на Dashboard, входа в аналитику нет', async ({ page }) => {
    await seedState(page, {
      answers: [],
      currentIndex: 0,
      questionStats: {},
    } as Partial<PersistedQuizState>);

    await gotoApp(page);

    // Упрощение онбординга: пустая статистика означает Fresh User Mode («до
    // первого ответа»), а он прячет аналитику вместе с Exam mode и программой
    // RHCSA. Поэтому экран аналитики с пустым состоянием из UI недостижим, и
    // проверяется именно это следствие режима.
    await expect(page.getByTestId('analytics-mode')).toHaveCount(0);
    await expect(page.getByTestId('analytics')).toHaveCount(0);
    await expect(page.getByTestId('start-learning')).toBeVisible();
  });

  test('частично заполненный профиль: готовность из банка, слабые темы, тренд без NaN', async ({
    page,
  }) => {
    const questionStats = Object.assign(
      {},
      ...SEEDED_SLUGS.map((slug) => statsForHalfTopic(slug))
    );
    await seedState(page, {
      answers: [],
      currentIndex: 0,
      questionStats,
    } as Partial<PersistedQuizState>);

    await gotoApp(page);
    await page.getByTestId('analytics-mode').click();

    await expect(page.getByTestId('analytics')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('analytics-empty')).toHaveCount(0);

    // Готовность: одна верная попытка на вопрос в двух темах, охват 1/размер.
    await expect(page.getByTestId('analytics-readiness')).toContainText(
      `Готовность: ${expectedReadinessPercent()}%`
    );

    // Слабые темы: ровно topN строк (3), каждая со значением-процентом.
    // Какой именно слаг попадёт в тройку — зависит от живых размеров тем с
    // нулевым score, поэтому проверяется контракт списка, а не конкретные слаги:
    // три темы с минимальной готовностью, и хотя бы одна из них — 0 % (тема без
    // ответов вообще).
    const weak = page.getByTestId('analytics-weak');
    await expect(weak).toBeVisible();
    const weakRows = weak.locator('li');
    await expect(weakRows).toHaveCount(3);
    const rows = (await weakRows.allInnerTexts()).map((text) => text.replace(/\s+/g, ' ').trim());
    for (const row of rows) {
      expect(row).toMatch(/^\S.* \d+%$/);
    }
    expect(rows.some((row) => row.endsWith(' 0%'))).toBe(true);
    expect(rows.join(' ')).not.toContain('NaN');

    // Тренд: все засеянные ответы (по одному на тему) в окне 7 дней, все верные;
    // предыдущая половина пуста → «нет базы для сравнения» (не NaN).
    await expect(page.getByTestId('analytics-trend')).toContainText(
      `Отвечено: ${SEEDED_SLUGS.length}, верно: ${SEEDED_SLUGS.length}`
    );
    await expect(page.getByTestId('analytics-trend-delta')).toContainText('нет базы для сравнения');
    await expect(page.getByTestId('analytics-trend-delta')).not.toContainText('NaN');

    // Оси radar = число тем реестра: точки есть и у нулевых тем.
    await expect(page.getByTestId('analytics-point-deploy_systems')).toBeVisible();
    await expect(page.getByTestId('analytics-point-users_groups')).toBeVisible();
  });
});
