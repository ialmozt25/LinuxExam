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
 * Регрессии spec 071 (P1/P2/P3) — три жалобы капитана после 065–070.
 *
 * ВАЖНО о статусе этих тестов: они **характеризующие**, а не доказывающие фикс.
 * На входе задачи ни одна из трёх проблем не воспроизвелась в Playwright
 * (см. RECON в `.project/specs/071-regression-fix.md`), поэтому тесты
 * фиксируют текущее наблюдаемое поведение и ловят будущую регрессию — они
 * НЕ означают «на устройстве работает».
 *
 * Из-за этого P1 не проверяется «по-настоящему» и по второй причине: дефект
 * виден только в Telegram WebView, а расхождение layout/visual viewport
 * подменой вьюпорта не моделируется (то же ограничение, что в spec 067 и 070).
 * Здесь проверяются две вещи, которые МОГЛИ бы это вызвать и проверяемы
 * детерминированно: (1) кнопка целиком во вьюпорте, (2) ни у #root, ни у одного
 * родителя футера нет `transform` / `will-change` / `filter` / `perspective` /
 * `contain: paint` — любой из них сделал бы `position: fixed` отсчётным от
 * контейнера, а не от вьюпорта.
 */

/**
 * Ошибки страницы (uncaught) и console.error за время теста.
 *
 * Шум dev-сервера отфильтрован: Playwright открывает страницу на `localhost`,
 * а Vite слушает `127.0.0.1` (см. playwright.config.ts), поэтому HMR-сокет
 * закономерно падает и пишет в console.error на каждом прогоне. Это не ошибка
 * приложения, и без фильтра проверка «errors=0» была бы всегда красной.
 * Так же отфильтрованы сетевые отказы (`net::ERR_*`): SDK Telegram под эмуляцией
 * тянет свои remote-скрипты и получает отказ — тоже окружение, а не приложение.
 */
const ENV_NOISE = /WebSocket|vite|hmr|net::ERR_[A-Z_]+/i;

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (ENV_NOISE.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

function allBankQuestions(): BankQuestion[] {
  const all: BankQuestion[] = [];
  for (const slug of Object.keys(TOPIC_QUESTIONS)) all.push(...TOPIC_QUESTIONS[slug]);
  if (all.length === 0) throw new Error('live bank drift: TOPIC_QUESTIONS пуст');
  return all;
}

function longestExplanationQuestion(): BankQuestion {
  const withExplanation = allBankQuestions().filter((q) => (q.explanation?.length ?? 0) > 0);
  if (withExplanation.length === 0) throw new Error('live bank drift: нет объяснений в банке');
  return withExplanation.sort((a, b) => b.explanation.length - a.explanation.length)[0]!;
}

/**
 * Сид прогона, остановленного на вопросе с самым длинным объяснением.
 *
 * Авто-доскролл к объяснению отключён (как в spec 070-спеке): он меняет scrollTop
 * уже после ответа и мешал бы проверять «кнопка видна независимо от прокрутки».
 */
async function seedLongestExplanationRun(page: import('@playwright/test').Page) {
  const target = longestExplanationQuestion();
  const order = readBank<string[]>('_order.json');
  const index = order.indexOf(target.id);
  if (index < 0) throw new Error(`live bank drift: "${target.id}" отсутствует в _order.json`);
  const byId = new Map(allBankQuestions().map((question) => [question.id, question]));

  const seeded = emptyPersistedState();
  seeded.answers = order.slice(0, index).map((id) => {
    const question = byId.get(id);
    if (!question) throw new Error(`live bank drift: _order.json ссылается на неизвестный "${id}"`);
    return liveRecord(question, true);
  });
  seeded.currentIndex = index;
  seeded.isQuizInProgress = true;
  seeded.streak = 1;
  seeded.totalXp = 10;

  await blockAnalytics(page);
  await page.addInitScript(() => {
    Element.prototype.scrollTo = function scrollToNoop() {};
  });
  await seedState(page, seeded);
  await page.goto('/');
  await resumeSeededRun(page);
  await expect(page.getByTestId(TESTID.questionText)).toHaveText(target.question, {
    timeout: 15000,
  });
  return { target, index };
}

/** CSS-свойства, способные превратить `position: fixed` в контейнерный. */
const CONTAINING_BLOCK_PROPS = ['transform', 'willChange', 'filter', 'perspective', 'contain'];

test.use({ viewport: { width: 390, height: 844 } });

test.describe.serial('spec 071 — регрессии P1/P2/P3 (390×844)', () => {
  test('P1: кнопка «Следующий вопрос» целиком во вьюпорте, ни у одного родителя нет containing-block свойств', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const { target } = await seedLongestExplanationRun(page);

    // Отвечаем: футер включается только после ответа.
    const option = page.locator('[data-testid^="option-"]').first();
    await option.click();
    await expect(page.getByTestId(TESTID.explanation)).toBeVisible({ timeout: 15000 });

    const geometry = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="next-button"]') as HTMLElement | null;
      const footer = button?.parentElement ?? null;
      if (!button || !footer) return null;

      const buttonRect = button.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const chain: { tag: string; id: string; cls: string; found: string[] }[] = [];
      let node: HTMLElement | null = footer;
      while (node) {
        const style = getComputedStyle(node);
        const found: string[] = [];
        for (const prop of ['transform', 'willChange', 'filter', 'perspective', 'contain']) {
          const value = style.getPropertyValue(
            prop.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
          );
          const isNeutral =
            value === '' ||
            value === 'none' ||
            value === 'auto' ||
            value === 'normal' ||
            value === 'visible';
          if (!isNeutral) found.push(`${prop}=${value}`);
        }
        chain.push({
          tag: node.tagName,
          id: node.id,
          cls: node.className?.toString().slice(0, 40) ?? '',
          found,
        });
        node = node.parentElement;
      }

      return {
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        scrollTop: document.getElementById('root')?.scrollTop ?? null,
        footer: {
          position: getComputedStyle(footer).position,
          zIndex: getComputedStyle(footer).zIndex,
          top: Math.round(footerRect.top),
          bottom: Math.round(footerRect.bottom),
        },
        button: {
          top: Math.round(buttonRect.top),
          bottom: Math.round(buttonRect.bottom),
          height: Math.round(buttonRect.height),
          disabled: (button as HTMLButtonElement).disabled,
        },
        containingBlockHits: chain.filter((entry) => entry.found.length > 0),
        chain,
      };
    });

    console.log('P1_GEOMETRY=' + JSON.stringify(geometry));
    expect(geometry).not.toBeNull();

    // Кнопка включена (ответ дан) и целиком во вьюпорте.
    expect(geometry!.button.disabled).toBe(false);
    await expect(page.getByTestId(TESTID.nextButton)).toBeInViewport({ ratio: 1 });
    expect(geometry!.footer.position).toBe('fixed');
    expect(geometry!.button.bottom).toBeLessThanOrEqual(geometry!.innerHeight);
    expect(geometry!.button.top).toBeGreaterThanOrEqual(0);

    // Ни один родитель футера не создаёт containing block для fixed.
    expect(geometry!.containingBlockHits).toEqual([]);

    // scrollTop не влияет на позицию fixed-футера.
    await page.evaluate(() => {
      const root = document.getElementById('root');
      if (root) root.scrollTop = root.scrollHeight;
    });
    await page.waitForTimeout(150);
    const atBottom = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="next-button"]') as HTMLElement;
      const rect = button.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        innerHeight: window.innerHeight,
        scrollTop: document.getElementById('root')?.scrollTop ?? null,
      };
    });
    console.log('P1_AT_BOTTOM=' + JSON.stringify(atBottom));
    expect(atBottom.innerHeight - atBottom.bottom).toBe(geometry!.innerHeight - geometry!.button.bottom);

    console.log('P1_QUESTION=' + target.id);
    expect(errors).toEqual([]);
  });

  test('P2: Exam mode — setup рендерится, прогон идёт 3 вопроса, ошибок нет', async ({ page }) => {
    const errors = collectErrors(page);
    await blockAnalytics(page);
    await seedState(page, emptyPersistedState());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId('exam-mode').click();
    await expect(page.getByTestId('exam-setup')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('exam-setup-summary')).toContainText('Вопросов в прогоне: 30');

    await page.getByTestId('exam-start').click();
    await expect(page.getByTestId('exam-run')).toBeVisible({ timeout: 15000 });

    for (let answered = 1; answered <= 3; answered++) {
      await page.getByTestId('exam-option-0').click();
      await page.getByTestId('exam-submit').click();
      await expect(page.getByTestId('exam-progress')).toHaveText(
        `Вопрос ${answered + 1} / 30`
      );
    }

    // Кнопка выхода остаётся в вьюпорте — та же fixed-геометрия, что у Question.
    const cancel = page.getByTestId('exam-cancel');
    await expect(cancel).toBeInViewport({ ratio: 1 });
    const cancelBottom = await cancel.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(cancelBottom).toBeLessThanOrEqual(844);

    console.log('P2_ERRORS=' + JSON.stringify(errors));
    expect(errors).toEqual([]);
  });

  test('P3: пустой профиль → Fresh User Mode без входа в аналитику, ошибок нет', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await blockAnalytics(page);
    await seedState(page, { answers: [], currentIndex: 0, questionStats: {} });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 15000,
    });

    // Упрощение онбординга: пустая статистика теперь Fresh User Mode, и аналитика
    // из UI недостижима (кнопка скрыта). Прежний контракт «пустой профиль рендерит
    // приглашение аналитики без NaN» проверялся на экране, до которого из этого
    // состояния больше не дойти; здесь остаётся регресс рендера — страница не
    // падает и не пишет в консоль.
    await expect(page.getByTestId('analytics-mode')).toHaveCount(0);
    await expect(page.getByTestId('analytics')).toHaveCount(0);
    await expect(page.getByTestId('start-learning')).toBeVisible();

    console.log('P3_ERRORS=' + JSON.stringify(errors));
    expect(errors).toEqual([]);
  });
});

/**
 * P1 в Telegram-ветке: эмуляция TMA (единственное место в сьюте — в остальных
 * спеках Telegram намеренно не эмулируется, см. browser-mode.spec.ts).
 *
 * Проверяется контракт ветки: при `isTMA() === true` in-app кнопки и распорки
 * в DOM НЕТ (роль кнопки берёт нативный MainButton), страница не падает.
 * Геометрия самого MainButton нативной кнопкой не моделируется — это остаётся
 * ручной проверкой капитана на устройстве.
 */
const TMA_MOCK = `
(() => {
  const tg = {
    initData: 'user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Recon%22%7D&hash=recon',
    initDataUnsafe: { user: { id: 123456789, first_name: 'Recon' } },
    version: '7.0',
    platform: 'android',
    colorScheme: 'dark',
    themeParams: { bg_color: '#1E1E1E', text_color: '#FFFFFF', button_color: '#2196F3' },
    isExpanded: true,
    viewportHeight: 700,
    viewportStableHeight: 700,
    isClosingConfirmationEnabled: false,
    headerColor: '#1E1E1E',
    backgroundColor: '#1E1E1E',
    ready: () => {},
    expand: () => {},
    isVersionAtLeast: () => true,
    onEvent: () => {},
    offEvent: () => {},
    sendData: () => {},
    openLink: () => {},
    openTelegramLink: () => {},
    close: () => {},
  };
  window.Telegram = { WebApp: tg };
  if (!window.TelegramWebviewProxy) window.TelegramWebviewProxy = { postEvent: () => {} };
  if (!window.TelegramWebviewProxyProto) window.TelegramWebviewProxyProto = { postEvent: () => {} };
  // Узлы MainButton/BackButton создаются, когда body уже есть (SDK проверяет их
  // наличие при mount); до этого Telegram их и не отдаёт.
  const mount = () => {
    if (!document.body) return false;
    const mb = document.createElement('div');
    mb.id = 'tg-main-button';
    mb.style.display = 'none';
    const bb = document.createElement('div');
    bb.id = 'tg-back-button';
    bb.style.display = 'none';
    document.body.appendChild(bb);
    document.body.appendChild(mb);
    return true;
  };
  if (!mount()) document.addEventListener('DOMContentLoaded', mount);
})();
`;

test.describe('spec 071 — P1 в Telegram-ветке (эмуляция TMA)', () => {
  test('TMA: in-app футер не рендерится, страница не падает', async ({ page }) => {
    const errors = collectErrors(page);
    await page.addInitScript(TMA_MOCK);
    await blockAnalytics(page);
    await seedState(page, emptyPersistedState());
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 15000,
    });

    const tma = await page.evaluate(() => ({
      nextButton: document.querySelectorAll('[data-testid="next-button"]').length,
      spacer: document.querySelectorAll('[data-testid="fixed-footer-spacer"]').length,
      dashboardContinue: document.querySelectorAll('[data-testid="dashboard-continue"]').length,
      appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height'),
      rootClientHeight: document.getElementById('root')?.clientHeight ?? null,
    }));
    console.log('P1_TMA=' + JSON.stringify(tma));

    expect(tma.nextButton).toBe(0);
    expect(tma.spacer).toBe(0);
    // `dashboard-continue` здесь НЕ проверяется: свежий профиль показывает
    // онбординг-ветку (свой вход), и эта кнопка принадлежит ей, а не browser-only
    // ветке MainButton. Telegram-контракт — именно отсутствие in-app футера.
    console.log('P1_TMA_ERRORS=' + JSON.stringify(errors));
    expect(errors).toEqual([]);
  });
});
