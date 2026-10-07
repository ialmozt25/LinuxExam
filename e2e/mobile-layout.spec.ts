import { test, expect, blockAnalytics, gotoApp, readPersisted, seedHistoryProfile, seedRetention, TESTID, TOPICS } from './fixtures';

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

/**
 * Вертикальный клиппинг: `scrollHeight > clientHeight` означает, что контент
 * вылезает за бокс элемента. Горизонтальную версию (`horizontalOverflows`) это
 * НЕ ловит: у streak-бейджа `overflow: visible`, поэтому переполнение вниз не
 * даёт ни horizontal overflow, ни нарушения тап-зоны — регрессия пилота
 * Dashboard (обрезанная подпись серии) прошла весь набор зелёной. Допуск 2px —
 * субпиксельное округление глифов и `line-height`.
 */
const CLIP_TOLERANCE = 2;

async function verticalClipping(
  page: import('@playwright/test').Page,
  selectors: string[],
): Promise<{ sel: string; scrollHeight: number; clientHeight: number; overflow: number; text: string }[]> {
  return page.evaluate(
    ({ sels, tol }: { sels: string[]; tol: number }) => {
      const out: { sel: string; scrollHeight: number; clientHeight: number; overflow: number; text: string }[] = [];
      for (const sel of sels) {
        for (const node of Array.from(document.querySelectorAll(sel))) {
          const el = node as HTMLElement;
          const overflow = el.scrollHeight - el.clientHeight;
          if (overflow > tol) {
            out.push({
              sel,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              overflow,
              text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
            });
          }
        }
      }
      return out;
    },
    { sels: selectors, tol: CLIP_TOLERANCE },
  );
}

/** Строки тем: контент не выходит за карточку, название и бейдж внутри строки. */
async function topicRowGeometry(page: import('@playwright/test').Page) {  return page.evaluate(() => {
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

  test('Dashboard: контент не обрезан по вертикали (карточка прогресса, полоса банка, карточки, строки тем)', async ({
    page,
  }) => {
    await gotoApp(page);

    // Быстрый профиль: streak 0 → строка серии короткая («Начни серию сегодня»).
    // Карточка прогресса и полоса банка показываются и ему (решение капитана
    // 2026-10-08), поэтому обе зоны входят в проверку клиппинга.
    const clipped = await verticalClipping(page, [
      '[data-testid="dashboard-progress-card"]',
      '[data-testid="dashboard-streak"]',
      '[data-testid="level-next"]',
      '[data-testid="dashboard-today-xp"]',
      '[data-testid="dashboard-progress"]',
      '[data-testid="topic-essential_tools"]',
      '[data-testid="topic-first-cta"]',
    ]);

    expect(
      clipped,
      `вертикальный клиппинг: ${JSON.stringify(clipped)}`,
    ).toEqual([]);
  });

  test('Dashboard: карточка прогресса не обрезана, кольцо уровня имеет размер 64×64 (B2)', async ({
    page,
  }) => {
    // Прежняя регрессия пилота — обрезанная 3-строчная подпись серии — ушла вместе
    // с `streakMessage` (домен больше не рендерит мотивационную подпись), но
    // карточка осталась самой плотной зоной экрана: серия, LEVEL-NEXT и дневной XP
    // стоят в одной колонке рядом с кольцом. Клиппинг проверяем на них.
    await seedRetention(page, { streak: 1, todayXp: 0 });
    await gotoApp(page);

    const clipped = await verticalClipping(page, [
      '[data-testid="dashboard-progress-card"]',
      '[data-testid="dashboard-streak"]',
      '[data-testid="level-next"]',
      '[data-testid="dashboard-today-xp"]',
    ]);
    expect(clipped, `карточка прогресса обрезана: ${JSON.stringify(clipped)}`).toEqual([]);

    // Геометрия кольца: 64×64 из задания (B2), а не 0×0 в свёрнутом flex-контейнере.
    const ring = await page.getByRole('progressbar', { name: /Уровень/ }).boundingBox();
    expect(ring).not.toBeNull();
    expect(Math.round(ring?.width ?? 0)).toBe(64);
    expect(Math.round(ring?.height ?? 0)).toBe(64);
  });

  test('Dashboard: полоса банка видна при нулевом прогрессе и не обрезана', async ({ page }) => {
    // Было: дневная полоса XP с нулевой заливкой получала минимальную ширину 2px
    // (dashboard-ux-2, проблема 4 — пустая полоса читалась как «ничего не
    // происходит»). Дневная полоса снята заданием B5; её место заняла полоса банка,
    // которая теперь видна и профилю без прогресса (решение капитана 2026-10-08) —
    // значит «пустая полоса» снова встречается, и трек обязан оставаться видимым.
    await seedRetention(page, { streak: 1, todayXp: 0 });
    await gotoApp(page);

    const clipped = await verticalClipping(page, [
      '[data-testid="dashboard-progress"]',
      '[data-testid="dashboard-progress-card"]',
    ]);
    expect(clipped, `карточка/полоса обрезаны: ${JSON.stringify(clipped)}`).toEqual([]);

    const bar = await page.evaluate(() => {
      const track = document.querySelector(
        '[data-testid="dashboard-progress"] [role="progressbar"]',
      ) as HTMLElement;
      const fill = track.firstElementChild as HTMLElement;
      return {
        trackHeight: Math.round(track.getBoundingClientRect().height),
        trackWidth: Math.round(track.getBoundingClientRect().width),
        fillWidth: Math.round(fill.getBoundingClientRect().width),
      };
    });
    expect(bar.trackWidth).toBeGreaterThan(0);
    expect(bar.trackHeight).toBeGreaterThan(0);
    // Ноль прогресса рисует пустой трек, а не «схлопнутый» блок.
    expect(bar.fillWidth).toBe(0);
    expect(bar.fillWidth).toBeLessThan(bar.trackWidth);
  });

  test('Dashboard: один variant — один цвет бейджа (computed-style)', async ({ page }) => {
    // diag-dashboard-fix, симптомы 1–2 + решение C (dashboard-ux-2). Роль бейджа
    // доступа обязана быть одинаковой: дефект был в том, что подпись считалась по
    // `isFree || allowed`, а variant — по `isFree`, и одна и та же надпись
    // «БЕСПЛАТНО» рисовалась серым (`free`) и синим (`pro`).
    //
    // Решение C: замки 🔒 убраны из строк, поэтому у профиля с доступом
    // (`seedRetention` = Pro + активный trial) бейджей доступа нет вообще —
    // строка платной темы визуально идентична free-строке.
    await seedRetention(page, { streak: 1, todayXp: 0 });
    await gotoApp(page);

    const bad = await page.evaluate(() => {
      const byVariant = new Map<string, { styles: string[]; testid: string | null }>();
      for (const node of Array.from(document.querySelectorAll('[data-variant]'))) {
        const el = node as HTMLElement;
        const cs = getComputedStyle(el);
        const variant = el.getAttribute('data-variant') ?? '';
        const style = `${cs.backgroundColor} / ${cs.color}`;
        const seen = byVariant.get(variant) ?? { styles: [], testid: el.getAttribute('data-testid') };
        if (!seen.styles.includes(style)) seen.styles.push(style);
        byVariant.set(variant, seen);
      }
      return Array.from(byVariant.entries())
        .filter(([, value]) => value.styles.length > 1)
        .map(([variant, value]) => ({ variant, styles: value.styles, testid: value.testid }));
    });

    expect(
      bad,
      `один variant покрашен разными цветами: ${JSON.stringify(bad)}`,
    ).toEqual([]);

    // Решение C: ни замка, ни плашек доступа у профиля с доступом. Плашка «PRO»
    // остаётся только у платной темы БЕЗ доступа (проверяется в paywall.spec.ts).
    await expect(page.locator('[data-testid="paywall-badge-lock"]')).toHaveCount(0);
    await expect(page.locator('[data-variant="restricted"]')).toHaveCount(0);
    await expect(page.locator('[data-variant="free"]')).toHaveCount(0);
    await expect(page.locator('[data-variant="pro"]')).toHaveCount(0);
    await expect(page.getByTestId(TESTID.paywallBadgeFree)).toHaveCount(0);
    // Оставшийся бейдж экрана — подсказка «начните с этой» (она была и раньше).
    await expect(page.locator('[data-variant="hint"]')).toHaveCount(1);
  });

  test('Dashboard: один primary-вход — верхняя CTA, in-app футера нет', async ({ page }) => {
    // diag-dashboard-fix, симптом 3: resume-баннер и нижний sticky-футер показывали
    // ДВЕ primary-кнопки с подписью «Продолжить». Футер удалён фиксом 2026-10-07
    // (DESIGN.md → Components: одна primary CTA на экран, sticky-футер допустим
    // только на Question/ExamRun). Здесь профиль с историей и незавершённым
    // регулярным прогоном: на экране ровно одна primary — верхняя CTA, а вход
    // «вернуться к прогону» даёт ВТОРИЧНАЯ кнопка resume-баннера.
    await seedHistoryProfile(page, 30, {
      overrides: { isQuizInProgress: true, currentIndex: 3, reviewQuestionIds: null },
    });
    await gotoApp(page);

    await expect(page.getByTestId(TESTID.resumeBanner)).toBeVisible();
    await expect(page.getByTestId(TESTID.dashboardContinue)).toHaveCount(0);

    const probe = await page.evaluate(() => {
      // Роль `--btn-primary-bg` резолвится через каскад временным узлом:
      // getPropertyValue('--accent') вернул бы саму var()-цепочку.
      const probeNode = document.createElement('span');
      probeNode.style.background = 'var(--btn-primary-bg)';
      document.body.appendChild(probeNode);
      const primaryBg = getComputedStyle(probeNode).backgroundColor;
      probeNode.remove();

      const hits: { testid: string | null; text: string; bg: string }[] = [];
      for (const node of Array.from(document.querySelectorAll('button'))) {
        const el = node as HTMLButtonElement;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.backgroundColor !== primaryBg) continue;
        hits.push({
          testid: el.getAttribute('data-testid'),
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
          bg: cs.backgroundColor,
        });
      }
      return { primaryBg, hits };
    });

    const continuePrimaries = probe.hits.filter((hit) => hit.text === 'Продолжить');
    expect(
      continuePrimaries.map((hit) => hit.testid),
      `primary-CTA «Продолжить» на экране: ${JSON.stringify(probe.hits)} (accent ${probe.primaryBg})`,
    ).toEqual([]);
    // Нижнего футера в DOM нет, а единственный primary-ВХОД в занятие — верхняя
    // CTA (primary «Повторить ошибки» в этом состоянии — свой контракт, он не
    // является входом в занятие).
    expect(probe.hits.map((hit) => hit.testid)).toContain(TESTID.reviewToday);
    expect(probe.hits.map((hit) => hit.testid)).not.toContain(TESTID.dashboardContinue);
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
    // Вход в занятие — верхняя CTA: in-app футер «Продолжить» снят (фикс 2026-10-07).
    await page.getByTestId(TESTID.reviewToday).click();
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
    // Вход в занятие — верхняя CTA (in-app футер «Продолжить» снят 2026-10-07).
    await page.getByTestId(TESTID.reviewToday).click();
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
