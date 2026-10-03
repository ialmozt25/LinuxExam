import {
  expect,
  liveRecord,
  readBank,
  resumeSeededRun,
  seedState,
  test,
  TESTID,
  TOPIC_QUESTIONS,
  blockAnalytics,
  emptyPersistedState,
  gotoApp,
} from './fixtures';
import type { BankQuestion } from './fixtures';
import { isoDaysAgo } from './fixtures';

/**
 * UX-регрессии 2026-10-04 (прямой путь, без MAS).
 *
 * Четыре контракта, по одному на жалобу капитана:
 *   1. mobile, длинное объяснение: кнопка «Далее» (`next-button`) обязана быть
 *      видна БЕЗ прокрутки на 390x844 (spec 056 — перепроверка после UX-фикса Ф3);
 *   2. Analytics: выход обязан быть в первом экране (был последним блоком);
 *   3. Dashboard: серия (flame + streak) рендерится РОВНО ОДИН раз (было два);
 *   4. ExamResults: выход есть и целиком виден на 390x844.
 *
 * Фикстура длинного объяснения берётся из живого банка (самый длинный
 * `explanation`), а не хардкодится: длину объяснения задаёт банк, он дрейфует.
 */

/** Вопросы банка, отсортированные по убыванию длины `explanation`. */
function questionsByExplanationLength(): BankQuestion[] {
  const all: BankQuestion[] = [];
  for (const slug of Object.keys(TOPIC_QUESTIONS)) all.push(...TOPIC_QUESTIONS[slug]);
  const withExplanation = all.filter((question) => (question.explanation?.length ?? 0) > 0);
  if (withExplanation.length === 0) {
    throw new Error('live bank drift: no question carries an explanation');
  }
  return withExplanation.sort((a, b) => b.explanation.length - a.explanation.length);
}

/** Вопрос с самым длинным объяснением среди всех тем банка. */
function longestExplanationQuestion(): BankQuestion {
  return questionsByExplanationLength()[0]!;
}

/** Позиция вопроса в РЕГУЛЯРНОМ потоке (`_order.json`), а не внутри его темы. */
function regularIndex(questionId: string): number {
  const order = readBank<string[]>('_order.json');
  const index = order.indexOf(questionId);
  if (index < 0) {
    throw new Error(`live bank drift: "${questionId}" отсутствует в _order.json`);
  }
  return index;
}

/**
 * Считает ВИДИМЫЕ визуальные вхождения серии — по ЛИСТЬЯМ, а не по предкам.
 *
 * История метрики (обе версии ниже — реальные шаги отладки):
 *   · наивный счёт «любой узел, в textContent которого есть 🔥» дал `flame: 5` —
 *     это один 🔥, посчитанный на 5 уровнях вложенности, то есть метрика мерила
 *     глубину DOM, а не дубль;
 *   · фильтр `aria-hidden="true"` дал `flame: 0` — но сам 🔥 в StreakBadge
 *     помечен `aria-hidden` намеренно (декор), поэтому так выкидывался искомый
 *     элемент.
 *
 * Корректный критерий — узел без дочерних ЭЛЕМЕНТОВ, чей собственный текст
 * состоит из 🔥 или из числа серии. Обёртки (`role="status"`, `#status-strip`,
 * `<body>`) в счёт не попадают.
 */
async function streakVisuals(page: import('@playwright/test').Page, streak: number) {
  return page.evaluate((value) => {
    const isVisible = (node: Element): boolean => {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return node.getClientRects().length > 0;
    };

    const leaves = Array.from(document.querySelectorAll('body *')).filter(
      (node) => node.childElementCount === 0 && isVisible(node)
    );
    const own = (node: Element) => (node.textContent ?? '').trim();

    const statusStrip = document.getElementById('status-strip');
    return {
      flameLeaves: leaves.filter((node) => own(node) === '🔥').length,
      streakNumberLeaves: leaves.filter((node) => own(node) === String(value)).length,
      statusStripFlame: (statusStrip?.textContent ?? '').includes('🔥'),
      statusStripText: (statusStrip?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  }, streak);
}

test.describe('UX-регрессии — мобильный 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Quiz: длинное объяснение не выталкивает «Далее» за фолд', async ({ page }) => {
    const target = longestExplanationQuestion();
    const index = regularIndex(target.id);

    const order = readBank<string[]>('_order.json');
    const byId = new Map<string, BankQuestion>();
    for (const slug of Object.keys(TOPIC_QUESTIONS)) {
      for (const question of TOPIC_QUESTIONS[slug]) byId.set(question.id, question);
    }
    const seeded = emptyPersistedState();
    seeded.isPro = true;
    seeded.answers = order.slice(0, index).map((id) => {
      const question = byId.get(id);
      if (!question) throw new Error(`live bank drift: _order.json lists unknown "${id}"`);
      return liveRecord(question, true);
    });
    seeded.currentIndex = index;
    seeded.isQuizInProgress = true;
    seeded.streak = 1;
    seeded.totalXp = 10;

    await blockAnalytics(page);
    // Авто-скролл приложения (Question.tsx, 350 мс) отключён: замер должен ловить
    // вёрстку, а не гонку «успела ли анимация». Sticky-футер обязан держать
    // кнопку в вьюпорте при ЛЮБОМ scrollTop.
    await page.addInitScript(() => {
      Element.prototype.scrollTo = function scrollToNoop() {};
    });
    await seedState(page, seeded);
    await page.goto('/');

    await resumeSeededRun(page);
    await expect(page.getByTestId(TESTID.questionText)).toHaveText(target.question, {
      timeout: 15000,
    });
    await page.evaluate(() => {
      document.getElementById('root')!.scrollTop = 0;
    });

    // До ответа кнопка есть, но заблокирована: переполнение создаёт объяснение.
    await expect(page.getByTestId(TESTID.nextButton)).toBeDisabled();
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });

    await page.locator('[data-testid^="option-"]').first().click();
    await expect(page.getByTestId(TESTID.explanation)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(TESTID.explanation)).toHaveText(target.explanation);

    // Главный контракт UX-регрессии: кнопка ЦЕЛИКОМ во вьюпорте без прокрутки.
    await expect(page.getByTestId(TESTID.nextButton)).toBeEnabled();
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });

    const geometry = await page.evaluate(() => {
      const root = document.getElementById('root')!;
      const rect = (selector: string) => {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          height: Math.round(box.height),
        };
      };
      return {
        innerH: window.innerHeight,
        scrollTop: Math.round(root.scrollTop),
        overflow: root.scrollHeight - root.clientHeight,
        explanation: rect('[data-testid="explanation"]'),
        next: rect('[data-testid="next-button"]'),
      };
    });
    console.log('UX_REGRESSION_MOBILE_QUESTION=' + JSON.stringify({ id: target.id, geometry }));

    expect(geometry.next).not.toBeNull();
    expect(geometry.next!.bottom).toBeLessThanOrEqual(geometry.innerH);
    expect(geometry.next!.top).toBeGreaterThanOrEqual(0);

    // Переход работает: следующий вопрос — другой текст.
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId(TESTID.questionText)).not.toHaveText(target.question);
  });

  test('ExamResults: выход виден без прокрутки', async ({ page }) => {
    await blockAnalytics(page);
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByTestId('exam-mode').click();
    await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('preset-30').click();
    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible({ timeout: 10000 });

    for (let question = 1; question <= 30; question++) {
      await page.getByTestId('exam-option-0').click();
      await page.getByTestId('exam-submit').click();
    }

    await expect(page.getByTestId('exam-results')).toBeVisible({ timeout: 10000 });

    // Существующий testid нижней кнопки сохранён (его нельзя менять)...
    await expect(page.getByTestId('back-to-dashboard')).toHaveCount(1);
    // ...но на 390x844 с разбором по темам он виден лишь частично (замер
    // viewport ratio 0.375). Выход в первом экране — шапка.
    const back = page.getByTestId('exam-results-back');
    await expect(back).toHaveCount(1);
    await expect(back).toBeVisible();
    await expect(back).toBeInViewport({ ratio: 1 });

    await back.click();
    await expect(page.getByTestId('dashboard-subtitle')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('UX-регрессии — выход и дубль серии', () => {
  test('Analytics: выход в шапке ведёт на Dashboard', async ({ page }) => {
    await gotoApp(page);
    await page.getByTestId('analytics-mode').click();
    await expect(page.getByTestId('analytics')).toBeVisible({ timeout: 15000 });

    const back = page.getByTestId(TESTID.analyticsBack);
    await expect(back).toHaveCount(1);
    await expect(back).toBeInViewport({ ratio: 1 });

    // Выход переехал в общий AppHeader: id `header-back` больше не занят
    // самописной кнопкой в конце экрана, поэтому он однозначен.
    await expect(page.getByTestId(TESTID.headerBack)).toHaveCount(1);

    await back.click();
    await expect(page.getByTestId('dashboard-subtitle')).toBeVisible({ timeout: 15000 });
  });

  test('Dashboard: серия рендерится ровно один раз', async ({ page }) => {
    const seeded = emptyPersistedState();
    seeded.streak = 7;
    seeded.todayXp = 10;
    seeded.lastActiveDate = isoDaysAgo(0);
    await seedState(page, seeded);
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.streakBadge)).toHaveCount(1);
    await expect(page.getByTestId(TESTID.streakBadge)).toHaveAttribute(
      'data-streak-state',
      'active'
    );

    const counts = await streakVisuals(page, 7);
    console.log('UX_REGRESSION_DASHBOARD_STREAK=' + JSON.stringify(counts));

    // Ровно один 🔥 на Dashboard и ровно одно число серии.
    expect(counts.flameLeaves).toBe(1);
    expect(counts.streakNumberLeaves).toBe(1);
    // Главное утверждение по жалобе: в status-strip серии больше нет.
    expect(counts.statusStripFlame).toBe(false);
    expect(counts.statusStripText).toContain('Уровень');

    // Уровень и переключатель темы из status-strip не пропали вместе с flame.
    await expect(page.getByTestId(TESTID.topicToggle)).toBeVisible();
  });
});
