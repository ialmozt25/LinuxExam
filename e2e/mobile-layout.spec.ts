import { test, expect, blockAnalytics, gotoApp, readPersisted, TESTID, TOPICS } from './fixtures';

/**
 * Mobile layout (spec 067).
 *
 * ВАЖНО, ЧТО ЗДЕСЬ НЕ ПРОВЕРЯЕТСЯ. Главный дефект spec 067 — расхождение LAYOUT
 * и VISUAL viewport на живом мобильном (динамическая адресная строка, жест-бар):
 * sticky-футер липнет к низу скролл-контейнера, а его низ уезжал ниже видимой
 * области. Playwright `setViewportSize` меняет layout и visual ОДНОВРЕМЕННО,
 * поэтому воспроизвести расхождение здесь нельзя — эти тесты защищают от
 * РЕГРЕССИИ раскладки и вьюпорт-контракта, а не доказывают фикс на устройстве.
 * Фикс остаётся UNVERIFIED до ручной проверки капитаном.
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
/** Минимальная тап-зона бейджа из задания (spec 067, К3). */
const MIN_BADGE_TAP = 32;

interface Overflow {
  tag: string;
  testid: string | null;
  scrollWidth: number;
  clientWidth: number;
  overflow: number;
}

/**
 * Горизонтальные переполнения внутри `#root`.
 *
 * ПРОПУСКАЮТСЯ узлы с `overflow: hidden` + `text-overflow: ellipsis`: там
 * `scrollWidth > clientWidth` — это ШТАТНЫЙ признак обрезки однострочного текста
 * (название и описание темы), а не выезд раскладки за экран. Реальный дефект —
 * когда контент вылезает за границу карточки/экрана; его ловит проверка
 * `#root` и каждой строки темы ниже.
 */
async function horizontalOverflows(page: import('@playwright/test').Page): Promise<Overflow[]> {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    if (!root) return [];
    const rows: Overflow[] = [];
    for (const element of Array.from(root.querySelectorAll('*'))) {
      const node = element as HTMLElement;
      const style = getComputedStyle(node);
      const truncates = style.overflowX === 'hidden' && style.textOverflow === 'ellipsis';
      if (truncates) continue;
      const overflow = node.scrollWidth - node.clientWidth;
      // 1px допуск на субпиксельное округление: getBoundingClientRect возвращает
      // дробные значения, а scrollWidth — целые.
      if (overflow > 1) {
        rows.push({
          tag: node.tagName.toLowerCase(),
          testid: node.getAttribute('data-testid'),
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
          overflow,
        });
      }
    }
    return rows;
  });
}

/** Строки тем: контент не выходит за карточку, название и бейдж внутри строки. */
async function topicRowGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    // Только КНОПКИ тем: под префикс `topic-` попадает и бейдж-подсказка
    // `topic-first-cta` (span), который строкой не является.
    const nodes = Array.from(document.querySelectorAll('button[data-testid^="topic-"]'));
    return nodes.map((n) => {
      const row = n as HTMLElement;
      const box = row.getBoundingClientRect();
      const children = Array.from(row.children).map((child) => {
        const childBox = child.getBoundingClientRect();
        return {
          testid: child.getAttribute('data-testid'),
          outside: childBox.right > box.right + 1 || childBox.left < box.left - 1,
        };
      });
      return { testid: row.getAttribute('data-testid'), children };
    });
  });
}

test.describe('mobile 390x844 — контракт высоты и раскладки (spec 067)', () => {
  test.use({ viewport: MOBILE });

  test('загрузка не разъезжается: приложение и #root не шире экрана', async ({ page }) => {
    await gotoApp(page);

    const dimensions = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        rootScroll: root?.scrollWidth ?? 0,
        rootClient: root?.clientWidth ?? 0,
      };
    });

    expect(dimensions.docScroll).toBeLessThanOrEqual(dimensions.docClient);
    expect(dimensions.rootScroll).toBeLessThanOrEqual(dimensions.rootClient);
  });

  test('Dashboard: строка темы и бейджи не переполняют экран по горизонтали', async ({ page }) => {
    await gotoApp(page);

    // Обе ветки CTA перебраны намеренно: свежий профиль показывает приглашение,
    // а бейджи тем от этого не зависят.
    await expect(page.getByTestId(TESTID.dashboardTopics)).toBeAttached();

    const overflows = await horizontalOverflows(page);
    expect(overflows, `горизонтальные переполнения: ${JSON.stringify(overflows)}`).toEqual([]);

    // Строки тем: ни один прямой потомок не выходит за карточку по горизонтали,
    // то есть название, бейджи и счётчик не распирают строку.
    const rows = await topicRowGeometry(page);
    expect(rows.length).toBe(TOPICS.length);
    for (const row of rows) {
      for (const child of row.children) {
        expect(
          child.outside,
          `в строке ${row.testid} потомок ${child.testid ?? '(без testid)'} выходит за карточку`,
        ).toBe(false);
      }
    }

    // Каждый бейдж темы: свой замер + тап-зона.
    const badges = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll(
          '[data-testid="topic-first-cta"], [data-testid="paywall-badge-free"], [data-testid="paywall-badge-pro"]',
        ),
      );
      return nodes.map((n) => {
        const node = n as HTMLElement;
        const box = node.getBoundingClientRect();
        return {
          testid: node.getAttribute('data-testid'),
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      });
    });

    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(
        badge.scrollWidth,
        `бейдж ${badge.testid} обрезан по горизонтали`,
      ).toBeLessThanOrEqual(badge.clientWidth + 1);
      expect(badge.height, `тап-зона бейджа ${badge.testid} меньше ${MIN_BADGE_TAP}px`).toBeGreaterThanOrEqual(
        MIN_BADGE_TAP,
      );
    }
  });

  test('Dashboard: подсказка «начните с этой» под названием темы, не в ряду чипа', async ({ page }) => {
    await gotoApp(page);

    // Ровно одна подсказка (spec 065, К5.2) и она внутри первой free-темы.
    const cta = page.getByTestId('topic-first-cta');
    await expect(cta).toHaveCount(1);

    const firstFree = await page.evaluate(() => {
      const ctaNode = document.querySelector('[data-testid="topic-first-cta"]') as HTMLElement | null;
      const row = ctaNode?.closest('button[data-testid^="topic-"]') as HTMLElement | null;
      const ctaBox = ctaNode?.getBoundingClientRect();
      const rowBox = row?.getBoundingClientRect();
      // Название темы — `aria-label` строки без префикса «Начать тему: ».
      // Ищем его среди `div` строки: заголовок — самый глубокий узел с этим
      // текстом, поэтому обход идёт от потомков.
      const title = (row?.getAttribute('aria-label') ?? '').replace('Начать тему: ', '');
      const titleNode = title
        ? Array.from(row?.querySelectorAll('div') ?? []).find(
            (n) => (n.textContent ?? '').trim() === title,
          )
        : undefined;
      return {
        rowTestid: row?.getAttribute('data-testid') ?? null,
        titleFound: titleNode !== undefined,
        ctaInsideRow: Boolean(ctaBox && rowBox && ctaBox.left >= rowBox.left && ctaBox.right <= rowBox.right),
        ctaLeft: ctaBox?.left ?? -1,
        rowLeft: rowBox?.left ?? -1,
        rowRight: rowBox?.right ?? -1,
      };
    });

    expect(firstFree.rowTestid).toMatch(/^topic-/);
    expect(firstFree.titleFound, 'название темы не найдено в строке').toBe(true);
    expect(firstFree.ctaInsideRow).toBe(true);
    // Подсказка живёт в колонке названия — то есть в левой части строки, а не
    // прижата к правому краю рядом с «Бесплатно»/«N вопр.».
    const rowWidth = firstFree.rowRight - firstFree.rowLeft;
    expect(firstFree.ctaLeft - firstFree.rowLeft).toBeLessThan(rowWidth / 2);
  });

  test('Quiz: после ответа «Следующий вопрос» целиком в вьюпорте', async ({ page }) => {
    await blockAnalytics(page);

    // Регулярный поток: открываем первый вопрос и отвечаем.
    await gotoApp(page);
    await page.getByTestId(TESTID.dashboardContinue).click();
    await expect(page.getByTestId(TESTID.questionText)).toBeVisible({ timeout: 15000 });

    const options = page.locator('[data-testid^="option-"]');
    await expect(options.first()).toBeVisible({ timeout: 15000 });
    await options.first().click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10000 });

    // Контракт spec 056/065, защищаемый здесь от регрессии spec 067.
    await expect(page.getByTestId(TESTID.nextButton)).toBeEnabled();
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });
  });

  test('вьюпорт-контракт: bindAppHeight выставляет --app-height', async ({ page }) => {
    await gotoApp(page);

    const contract = await page.evaluate(() => {
      const root = document.documentElement;
      const raw = getComputedStyle(root).getPropertyValue('--app-height').trim();
      const rootHeight = getComputedStyle(document.getElementById('root')!).height;
      return { raw, rootHeight, innerHeight: window.innerHeight };
    });

    // Переменная заполнена JS-хуком и совпадает с CSS-фолбэком по смыслу:
    // и то и другое — высота вьюпорта, а не произвольное число.
    expect(contract.raw).toMatch(/^\d+(\.\d+)?(px|dvh|vh|%)$/);
    const rootPx = Number.parseFloat(contract.rootHeight);
    expect(rootPx).toBeGreaterThan(0);
    expect(rootPx).toBeLessThanOrEqual(contract.innerHeight + 1);
  });
});

test.describe('desktop 1440x900 — раскладка не сломана (spec 067)', () => {
  test.use({ viewport: DESKTOP });

  test('Quiz: кнопка внизу, контент не перекрыт', async ({ page }) => {
    await blockAnalytics(page);
    await gotoApp(page);
    await page.getByTestId(TESTID.dashboardContinue).click();
    await expect(page.getByTestId(TESTID.questionText)).toBeVisible({ timeout: 15000 });

    const options = page.locator('[data-testid^="option-"]');
    await expect(options.first()).toBeVisible({ timeout: 15000 });
    await options.first().click();
    await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10000 });

    const geometry = await page.evaluate(() => {
      const root = document.getElementById('root')!;
      const next = document.querySelector('[data-testid="next-button"]') as HTMLElement;
      const question = document.querySelector('[data-testid="question-text"]') as HTMLElement;
      const nextBox = next.getBoundingClientRect();
      const questionBox = question.getBoundingClientRect();
      return {
        viewportHeight: window.innerHeight,
        rootHeight: root.clientHeight,
        nextTop: nextBox.top,
        nextBottom: nextBox.bottom,
        nextHeight: nextBox.height,
        questionTop: questionBox.top,
      };
    });

    // Кнопка в пределах вьюпорта и ниже начала вопроса — то есть раскладка не
    // «схлопнулась» и футер не накрыл контент сверху.
    expect(geometry.nextTop).toBeGreaterThan(0);
    expect(geometry.nextBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.nextTop).toBeGreaterThan(geometry.questionTop);
    expect(geometry.rootHeight).toBeGreaterThan(0);
  });

  test('Dashboard: бейджи не ломают широкую раскладку', async ({ page }) => {
    await gotoApp(page);

    const overflows = await horizontalOverflows(page);
    expect(overflows, `горизонтальные переполнения: ${JSON.stringify(overflows)}`).toEqual([]);
    await expect(page.getByTestId('topic-first-cta')).toHaveCount(1);
    // Все темы реестра по-прежнему отрисованы.
    await expect(page.getByRole('button', { name: /^Начать тему: / })).toHaveCount(TOPICS.length);
  });
});
