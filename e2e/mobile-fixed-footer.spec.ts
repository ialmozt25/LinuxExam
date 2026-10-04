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
 * Fixed footer (spec 070).
 *
 * Spec 067 (FIX A) на устройстве не сработал: sticky-обёртка липнет к низу
 * scroll-контейнера `#root` и не выходит за его пределы, а в Telegram WebView низ
 * контейнера оказывается вне видимой области (visual viewport меньше layout).
 * Фикс — `position: fixed` (считается от вьюпорта) + резерв измеренной высоты
 * футера в скролл-контейнере.
 *
 * Playwright дефект НЕ воспроизводит (`setViewportSize` меняет layout и visual
 * viewport одновременно), поэтому тесты ниже — защита от регрессии: фиксируют
 * `position: fixed`, `z-index`, резерв высоты и геометрию кнопки. Доказательством
 * фикса на устройстве они не являются (см. «Ручная проверка» в спеке).
 */

/** Футер кнопок действия: родитель кнопки (обёртка без собственного testid). */
function footerOf(page: import('@playwright/test').Page, testId: string) {
  return page.getByTestId(testId).locator('xpath=..');
}

/** Геометрия футера и его контейнера — сырые числа для диагностики и ассертов. */
async function footerGeometry(page: import('@playwright/test').Page, testId: string) {
  return page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const footer = button?.parentElement ?? null;
    const container = footer?.parentElement ?? null;
    if (!button || !footer || !container) return null;
    const style = getComputedStyle(footer);
    const buttonRect = button.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      position: style.position,
      zIndex: style.zIndex,
      footer: {
        top: Math.round(footerRect.top),
        bottom: Math.round(footerRect.bottom),
        left: Math.round(footerRect.left),
        right: Math.round(footerRect.right),
        height: footer.offsetHeight,
      },
      button: {
        top: Math.round(buttonRect.top),
        bottom: Math.round(buttonRect.bottom),
        height: Math.round(buttonRect.height),
      },
      container: {
        paddingBottom: parseFloat(getComputedStyle(container).paddingBottom),
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
        bottom: Math.round(containerRect.bottom),
      },
      spacer: (() => {
        const el = container.querySelector('[data-testid="fixed-footer-spacer"]') as HTMLElement | null;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          height: el.offsetHeight,
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          position: getComputedStyle(el).position,
        };
      })(),
      footerVar: container.style.getPropertyValue('--fixed-footer-h'),
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  }, testId);
}

/**
 * Ожидаемая высота распорки: футер + остаточный отступ контейнера.
 *
 * Футер перекрывает и padding-box контейнера, а не только контент, поэтому
 * распорка обязана быть выше футера ровно на этот отступ — иначе последний
 * элемент потока заходит под футер (замерено: 4px при 390×844).
 */
function expectedSpacerHeight(footerHeight: number, containerPaddingBottom: number) {
  return footerHeight + Math.round(containerPaddingBottom);
}
function longestExplanationQuestion(): BankQuestion {
  const all: BankQuestion[] = [];
  for (const slug of Object.keys(TOPIC_QUESTIONS)) all.push(...TOPIC_QUESTIONS[slug]);
  const withExplanation = all.filter((question) => (question.explanation?.length ?? 0) > 0);
  if (withExplanation.length === 0) {
    throw new Error('live bank drift: no question carries an explanation');
  }
  return withExplanation.sort((a, b) => b.explanation.length - a.explanation.length)[0]!;
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

/** Сид прогона, остановленного на самом длинном объяснении банка. */
async function seedLongestExplanationRun(page: import('@playwright/test').Page) {
  const target = longestExplanationQuestion();
  const index = regularIndex(target.id);
  const order = readBank<string[]>('_order.json');
  const byId = new Map<string, BankQuestion>();
  for (const slug of Object.keys(TOPIC_QUESTIONS)) {
    for (const question of TOPIC_QUESTIONS[slug]) byId.set(question.id, question);
  }

  const seeded = emptyPersistedState();
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
  // Авто-доскролл приложения к объяснению отключён (см. mobile-sticky-footer.spec):
  // фиксированный футер обязан держать кнопку в вьюпорте при ЛЮБОМ scrollTop.
  await page.addInitScript(() => {
    Element.prototype.scrollTo = function scrollToNoop() {};
  });
  await seedState(page, seeded);
  await page.goto('/');
  await resumeSeededRun(page);
  await expect(page.getByTestId(TESTID.questionText)).toHaveText(target.question, {
    timeout: 15000,
  });
  return target;
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe('spec 070 — fixed-футер и резерв его высоты (390×844)', () => {
  test('Quiz: футер fixed, кнопка целиком в вьюпорте после ответа, под неё зарезервировано место', async ({
    page,
  }) => {
    const target = await seedLongestExplanationRun(page);

    const before = await footerGeometry(page, TESTID.nextButton);
    expect(before, 'футер и его контейнер должны существовать').not.toBeNull();
    if (!before) throw new Error('unreachable: footer geometry missing');

    // Контракт фикса: футер считается от вьюпорта, а не от низа #root.
    expect(before.position).toBe('fixed');
    expect(before.zIndex).toBe('50');
    // Кросс-проверка: sticky-вариант липнул бы к низу контейнера, а не к низу окна.
    expect(Math.abs(before.footer.bottom - before.innerHeight)).toBeLessThanOrEqual(1);
    expect(before.footer.left).toBe(0);
    expect(before.footer.right).toBeGreaterThanOrEqual(before.innerWidth - 1);
    expect(before.button.bottom).toBeLessThanOrEqual(before.innerHeight);
    // F3: место под футер резервирует распорка высотой ровно с футер.
    expect(before.spacer, 'распорка под футер должна существовать').not.toBeNull();
    expect(before.spacer!.position).toBe('static');
    expect(before.spacer!.height).toBe(expectedSpacerHeight(before.footer.height, before.container.paddingBottom));

    // До ответа кнопка неактивна, но видна.
    await expect(page.getByTestId(TESTID.nextButton)).toBeDisabled();
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });

    await page.locator('[data-testid^="option-"]').first().click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10000 });

    const after = await footerGeometry(page, TESTID.nextButton);
    if (!after) throw new Error('unreachable: footer geometry missing after answer');
    console.log(
      'MOBILE_FIXED_FOOTER_GEOMETRY=' + JSON.stringify({ id: target.id, explLen: target.explanation.length, before, after }),
    );

    // Главный критерий приёмки спеки: кнопка видна ЦЕЛИКОМ без прокрутки.
    await expect(page.getByTestId(TESTID.nextButton)).toBeEnabled({ timeout: 10000 });
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });
    expect(after.position).toBe('fixed');
    expect(Math.abs(after.footer.bottom - after.innerHeight)).toBeLessThanOrEqual(1);
    expect(after.button.bottom).toBeLessThanOrEqual(after.innerHeight);

    // F3: распорка держит высоту футера, а контейнер сохраняет базовый отступ.
    expect(after.footerVar).toBe(`${after.footer.height}px`);
    expect(after.spacer!.height).toBe(expectedSpacerHeight(after.footer.height, after.container.paddingBottom));
    expect(after.container.paddingBottom).toBeGreaterThan(0);

    // Прокрутка в самый низ: контейнер доскролливается ровно так, чтобы его
    // нижний отступ целиком вывел контент из-под футера.
    await page.evaluate(() => {
      const root = document.getElementById('root')!;
      root.scrollTop = root.scrollHeight;
    });
    const scrollState = await page.evaluate(() => {
      const root = document.getElementById('root')!;
      const container = document.querySelector('[data-testid="next-button"]')!.parentElement!
        .parentElement as HTMLElement;
      root.scrollTop = root.scrollHeight;
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
      };
      return {
        scrollTop: Math.round(root.scrollTop),
        maxScroll: root.scrollHeight - root.clientHeight,
        rootClient: root.clientHeight,
        containerClient: container.clientHeight,
        containerScroll: container.scrollHeight,
        container: rect(container),
        kids: Array.from(container.children).map((k) => ({
          tag: k.tagName,
          testId: k.getAttribute('data-testid'),
          pos: getComputedStyle(k).position,
          marginBottom: getComputedStyle(k).marginBottom,
          ...rect(k),
        })),
      };
    });
    const scrolled = await footerGeometry(page, TESTID.nextButton);
    if (!scrolled) throw new Error('unreachable: footer geometry missing after scroll');
    const contentBottom = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="next-button"]')!.parentElement!
        .parentElement as HTMLElement;
      // Только элементы ПОТОКА, кроме распорки: футер выведен из него (`fixed`),
      // а распорка — это и есть резерв, её сравнивать с футером нельзя.
      const flow = Array.from(container.children).filter(
        (child) =>
          getComputedStyle(child).position !== 'fixed' &&
          child.getAttribute('data-testid') !== 'fixed-footer-spacer' &&
          child.getBoundingClientRect().height > 0,
      );
      const rect = container.getBoundingClientRect();
      const style = getComputedStyle(container);
      return {
        count: container.children.length,
        container: {
          tag: container.tagName,
          className: container.className,
          inlineStyle: container.getAttribute('style'),
          rect: {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height),
          },
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          computedHeight: style.height,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
        },
        flow: flow.map((child) => ({
          tag: child.tagName,
          testId: child.getAttribute('data-testid'),
          pos: getComputedStyle(child).position,
          top: Math.round(child.getBoundingClientRect().top),
          bottom: Math.round(child.getBoundingClientRect().bottom),
        })),
        last: flow.length
          ? Math.round(flow[flow.length - 1]!.getBoundingClientRect().bottom)
          : null,
      };
    });
    console.log(
      'MOBILE_FIXED_FOOTER_OVERLAP=' +
        JSON.stringify({ scrollState, contentBottom, footerTop: scrolled.footer.top }),
    );
    if (contentBottom.last !== null && scrollState.maxScroll > 0) {
      // На максимальной прокрутке последний элемент потока обязан быть выше
      // начала футера — это и есть проверка резерва, а не совпадение.
      expect(contentBottom.last).toBeLessThanOrEqual(scrolled.footer.top + 2);
    }
    // Инвариант резерва проверяется ВСЕГДА (в т.ч. когда контент не переполняет
    // контейнер): распорка в потоке не ниже высоты футера.
    expect(scrolled.spacer!.height).toBeGreaterThanOrEqual(scrolled.footer.height);
    expect(scrolled.footer.bottom).toBeLessThanOrEqual(scrolled.innerHeight + 1);
    expect(scrolled.container.scrollWidth).toBeLessThanOrEqual(scrolled.container.clientWidth);

    // Футер не сломал переход: кнопка работает.
    await page.getByTestId(TESTID.nextButton).click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId(TESTID.questionText)).not.toHaveText(target.question);
  });

  test('ExamRun: exam-submit и exam-cancel целиком в вьюпорте на каждом вопросе', async ({
    page,
  }) => {
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

    // 3 вопроса достаточно: геометрия не зависит от длины вопроса (объяснений в
    // экзамене нет), а полный прогон покрыт mobile-sticky-footer.spec (spec 056).
    for (let question = 1; question <= 3; question++) {
      await page.getByTestId('exam-option-0').click();
      await expect(page.getByTestId('exam-submit'), `вопрос ${question}`).toBeInViewport({
        ratio: 1,
      });
      await expect(page.getByTestId('exam-cancel'), `вопрос ${question}`).toBeInViewport({
        ratio: 1,
      });

      const geometry = await footerGeometry(page, 'exam-submit');
      if (!geometry) throw new Error('unreachable: exam footer geometry missing');
      expect(geometry.position, `вопрос ${question}`).toBe('fixed');
      expect(geometry.zIndex, `вопрос ${question}`).toBe('50');
      expect(Math.abs(geometry.footer.bottom - geometry.innerHeight)).toBeLessThanOrEqual(1);
      expect(geometry.spacer!.height, `вопрос ${question}`).toBe(
        expectedSpacerHeight(geometry.footer.height, geometry.container.paddingBottom),
      );

      await page.getByTestId('exam-submit').click();
      if (question < 3) {
        await expect(page.getByTestId('exam-progress')).toHaveText(
          `Вопрос ${question + 1} / 30`,
          { timeout: 10000 },
        );
      }
    }
  });
});

test.describe('spec 070 — desktop 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('футер не ломает layout: по ширине вьюпорта, кнопка в вьюпорте, без горизонтального скролла', async ({
    page,
  }) => {
    await seedLongestExplanationRun(page);

    await page.locator('[data-testid^="option-"]').first().click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10000 });

    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });

    const geometry = await footerGeometry(page, TESTID.nextButton);
    if (!geometry) throw new Error('unreachable: footer geometry missing on desktop');
    console.log('DESKTOP_FIXED_FOOTER_GEOMETRY=' + JSON.stringify(geometry));

    expect(geometry.position).toBe('fixed');
    expect(geometry.footer.left).toBe(0);
    expect(geometry.footer.right).toBeGreaterThanOrEqual(geometry.innerWidth - 1);
    expect(Math.abs(geometry.footer.bottom - geometry.innerHeight)).toBeLessThanOrEqual(1);
    // Кнопка не растянута на всю ширину окна: контент сохраняет свои отступы.
    expect(geometry.button.bottom).toBeLessThanOrEqual(geometry.innerHeight);
    // Документ горизонтально не скроллится (fixed left:0/right:0 на layout-вьюпорте).
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    expect(geometry.spacer!.height).toBe(expectedSpacerHeight(geometry.footer.height, geometry.container.paddingBottom));

    // Карточка объяснения не вылезает за контентную область контейнера.
    // Замер — после затухания pulse-анимации верной опции (`scale 1.05`, 300ms):
    // до её завершения ЛЮБОЙ элемент выходит за кромку на 3–6px, и это не дефект
    // раскладки (проверено на baseline без фикса — то же поведение).
    await page.waitForTimeout(600);
    const settled = await page.evaluate(() => {
      const container = document.querySelector('[data-testid="next-button"]')!.parentElement!
        .parentElement as HTMLElement;
      const style = getComputedStyle(container);
      const contentRight = container.getBoundingClientRect().right - parseFloat(style.paddingRight);
      const card = document.querySelector('[data-testid="explanation"]')!
        .closest('div[style*="border-left"]') as HTMLElement | null;
      const root = document.getElementById('root')!;
      return {
        contentRight: Math.round(contentRight),
        cardRight: card ? Math.round(card.getBoundingClientRect().right) : null,
        maxOptionRight: Math.max(
          ...Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="option-"]')).map((el) =>
            Math.round(el.getBoundingClientRect().right),
          ),
        ),
        containerScrollWidth: container.scrollWidth,
        containerClientWidth: container.clientWidth,
        rootScrollWidth: root.scrollWidth,
        rootClientWidth: root.clientWidth,
      };
    });
    console.log('DESKTOP_SETTLED_LAYOUT=' + JSON.stringify(settled));
    expect(settled.cardRight).not.toBeNull();
    expect(settled.cardRight!).toBeLessThanOrEqual(settled.contentRight + 1);
    // Контейнер не переполнен по горизонтали после затухания анимаций.
    expect(settled.containerScrollWidth).toBeLessThanOrEqual(settled.containerClientWidth);
    expect(settled.rootScrollWidth).toBeLessThanOrEqual(settled.rootClientWidth);
  });
});
