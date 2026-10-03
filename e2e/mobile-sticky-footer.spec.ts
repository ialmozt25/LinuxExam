import {
  test,
  expect,
  TOPIC_QUESTIONS,
  blockAnalytics,
  emptyPersistedState,
  liveRecord,
  readBank,
  resumeSeededRun,
  seedState,
  TESTID,
} from './fixtures';
import type { BankQuestion } from './fixtures';

/**
 * Mobile sticky footer (spec 056).
 *
 * RECON spec 054 показал: на мобильном viewport объяснение ответа достраивается
 * ПОСЛЕ ответа, контент перерастает высоту `#root`, и кнопка перехода уезжает
 * ниже фолда (замеры: 4 из 6 вопросов на 390x844, переполнение 25-55px; на
 * 390x664 кнопка была на 158px ниже кромки). Тест фиксирует контракт: кнопка
 * действия обязана быть ЦЕЛИКОМ видна без прокрутки.
 *
 * Фикстура вопроса — живой банк: берётся вопрос с самым длинным explanation
 * (не хардкод id), потому что именно длина объяснения задаёт переполнение.
 * Банк дрейфует, поэтому id ищем по факту, а не по литералу.
 */

/** Все вопросы банка, отсортированные по длине explanation (сначала длинные). */
function questionsByExplanationLength(): BankQuestion[] {
  const all: BankQuestion[] = [];
  for (const slug of Object.keys(TOPIC_QUESTIONS)) all.push(...TOPIC_QUESTIONS[slug]);
  const withExplanation = all.filter((question) => (question.explanation?.length ?? 0) > 0);
  if (withExplanation.length === 0) {
    throw new Error('live bank drift: no question carries an explanation');
  }
  return withExplanation.sort((a, b) => b.explanation.length - a.explanation.length);
}

/** Вопрос с самым длинным explanation среди всех тем банка. */
function longestExplanationQuestion(): BankQuestion {
  return questionsByExplanationLength()[0]!;
}

/** Позиция вопроса в РЕГУЛЯРНОМ потоке (`_order.json`), а не в его теме. */
function regularIndex(questionId: string): number {
  const order = readBank<string[]>('_order.json');
  const index = order.indexOf(questionId);
  if (index < 0) {
    throw new Error(`live bank drift: "${questionId}" отсутствует в _order.json`);
  }
  return index;
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe('spec 056 — кнопка действия видна без прокрутки', () => {
  test('Quiz: длинное объяснение не выталкивает «Следующий вопрос» ниже фолда', async ({
    page,
  }) => {
    // Целевой вопрос — самый длинный explanation в банке; его позиция берётся из
    // РЕГУЛЯРНОГО потока (`_order.json`), потому что дашборд-«Продолжить»
    // сознательно сбрасывает review-поток в обычный (`startRegularQuiz`).
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
    // Прогон без авто-доскролла приложения (Question.tsx прокручивает контейнер
    // к объяснению через 350 мс после ответа). Без этого замер ловит не вёрстку, а
    // гонку «успела ли анимация»: sticky-футер обязан держать кнопку в вьюпорте
    // при ЛЮБОМ scrollTop, поэтому отключаем ровно анимацию, не вёрстку.
    await page.addInitScript(() => {
      Element.prototype.scrollTo = function scrollToNoop() {};
    });
    await seedState(page, seeded);
    await page.goto('/');

    // Баннер возобновления лежит под списком тем, поэтому его надо доскроллить;
    // после перехода сбрасываем унаследованную прокрутку дашборда — вход на
    // вопрос совпадает с обычным сценарием (RECON: переполнение 25–55px именно
    // с нулевой прокрутки).
    await resumeSeededRun(page);
    await expect(page.getByTestId(TESTID.questionText)).toHaveText(target.question, {
      timeout: 15000,
    });
    await page.evaluate(() => {
      document.getElementById('root')!.scrollTop = 0;
    });

    // Позиция в потоке: счётчик в шапке (`question-progress` — это полоса, не текст).
    await expect(page.getByTestId(TESTID.headerCenter)).toHaveText(
      `${index + 1} / ${order.length}`
    );

    // До ответа кнопка видна — переполнение создаёт именно объяснение.
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });

    await page.locator('[data-testid^="option-"]').first().click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10000 });

    // Диагностика переполнения — сырые числа в выводе теста. Приложение само
    // доскролливает контейнер на ответ (350 мс анимация в Question.tsx), поэтому
    // геометрия фиксируется после её завершения.
    const snapshot = async () =>
      page.evaluate(() => {
        const root = document.getElementById('root')!;
        const rect = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement | null;
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
        };
        return {
          innerH: window.innerHeight,
          scrollTop: Math.round(root.scrollTop),
          overflow: root.scrollHeight - root.clientHeight,
          explanation: rect('[data-testid="explanation"]'),
          verdict: rect('[data-testid="explanation-verdict"]'),
          next: rect('[data-testid="next-button"]'),
        };
      });
    const rightAfter = await snapshot();
    await page.waitForTimeout(1200);
    const settled = await snapshot();
    console.log(
      'MOBILE_QUIZ_GEOMETRY=' +
        JSON.stringify({ id: target.id, explLen: target.explanation.length, rightAfter, settled })
    );

    // Контракт спеки: кнопка перехода видна ЦЕЛИКОМ, без прокрутки.
    // Без ratio (дефолт 0) проверяется лишь пересечение с вьюпортом — дефект не ловится.
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });

    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId(TESTID.questionText)).not.toHaveText(target.question);
  });

  test('ExamRun: кнопка действия не уходит ниже фолда на длинном вопросе', async ({ page }) => {
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

    // Прогон проходится ЦЕЛИКОМ: инвариант «кнопка действия видна без
    // прокрутки» проверяется на каждом вопросе, включая 30-й, где кнопка несёт
    // самый длинный текст («Завершить экзамен»).
    for (let question = 1; question <= 30; question++) {
      await page.getByTestId('exam-option-0').click();
      await expect(page.getByTestId('exam-submit'), `вопрос ${question}`).toBeInViewport({
        ratio: 1,
      });
      await expect(page.getByTestId('exam-cancel'), `вопрос ${question}`).toBeInViewport({
        ratio: 1,
      });
      await page.getByTestId('exam-submit').click();
      if (question < 30) {
        await expect(page.getByTestId('exam-progress')).toHaveText(
          `Вопрос ${question + 1} / 30`,
          { timeout: 10000 }
        );
      }
    }

    await expect(page.getByTestId('exam-results')).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Sanity фикстуры: без объяснения в банке подбор «самого длинного» молча
 * вернул бы произвольный вопрос и тест перестал бы проверять переполнение.
 */
test('фикстура: у выбранного вопроса есть объяснение', () => {
  expect(longestExplanationQuestion().explanation.length).toBeGreaterThan(0);
});
