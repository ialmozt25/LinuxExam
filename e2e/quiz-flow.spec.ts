import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures';

/**
 * Live-bank fixtures (spec 049, component a).
 *
 * The question bank drifts: items are added and removed by tooling, so a literal
 * copy of a topic inside a spec goes stale without any visible failure — the suite
 * then asserts `N / 12` while the bank serves 19 questions. Both the id list and
 * the topic size are read from the bank itself instead. Playwright runs specs in
 * Node, so `src/data/questions/*.json` is on disk next to this file.
 */
type BankOption = { text: string; correct: boolean };
type BankQuestion = { id: string; options: BankOption[] };
type TopicIndex = { byTopic: Record<string, number> };

const QUESTIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'data',
  'questions'
);

/** The topic behind the dashboard button «Начать тему: Права доступа». */
const TOPIC = 'file_permissions';

function readBank<T>(file: string): T {
  return JSON.parse(readFileSync(join(QUESTIONS_DIR, file), 'utf8')) as T;
}

const TOPIC_QUESTIONS = readBank<BankQuestion[]>(`${TOPIC}.json`);

/** Live ids of the topic, in bank order — the review stream is filtered in this order. */
const TOPIC_IDS: string[] = TOPIC_QUESTIONS.map((q) => q.id);

/** Topic size as the generated `_topics.json` declares it: the counter denominator. */
const TOPIC_SIZE: number = readBank<TopicIndex>('_topics.json').byTopic[TOPIC];

if (TOPIC_IDS.length === 0 || TOPIC_IDS.length !== TOPIC_SIZE) {
  throw new Error(
    `live bank drift: ${TOPIC}.json holds ${TOPIC_IDS.length} questions, ` +
      `_topics.json declares ${TOPIC_SIZE} — the E2E fixtures follow the bank`
  );
}

/**
 * A stored answer record for one live question, in the shape the app itself writes.
 * `optionText` is the identity the store re-aligns against, so a seed may not guess
 * at an option index — the option order drifts with the bank (a wrong guess is
 * silently dropped by normalizeAnswersAgainstBank, which then reports 0 / 0).
 */
type AnswerSeed = {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  optionText: string;
};

function correctAnswer(id: string): AnswerSeed {
  const question = TOPIC_QUESTIONS.find((q) => q.id === id);
  const option = question?.options.find((o) => o.correct);
  if (!question || !option) {
    throw new Error(`live bank drift: ${id} in ${TOPIC}.json has no correct option`);
  }
  return {
    questionId: id,
    selectedIndex: question.options.indexOf(option),
    isCorrect: true,
    optionText: option.text,
  };
}

/** The `N / total` counter text the question screen renders. */
function counter(question: number): RegExp {
  return new RegExp(`${question}\\s*/\\s*${TOPIC_SIZE}`);
}

/**
 * `index.html` loads a third-party analytics beacon (`//gc.zgo.at/count.js`). It is
 * not part of the app under test, but `page.goto` waits for the `load` event and
 * `load` waits for that script, so a slow answer from the CDN fails the navigation
 * while the screen is already painted — observed 2026-10-03: the app fully rendered
 * (heading + dashboard in the failure snapshot) and `page.goto` still hit the 30 s
 * test timeout in two tests. Hanging the beacon on purpose reproduces it on demand
 * (goto timeout, heading visible); aborting it drops that navigation to ~0.3 s.
 * No assertion in this suite touches analytics, so the beacon is blocked.
 */
test.beforeEach(async ({ page }) => {
  await page.route(/gc\.zgo\.at/, (route) => route.abort());
});

test('full quiz journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('button', { name: 'Продолжить' }).click();

  for (let i = 0; i < 5; i++) {
    await page.locator('button[aria-label^="Ответ"]').first().click();
    await page.getByRole('button', { name: /Следующий|Завершить/ }).click();
  }

  await expect(page.getByText(/Бесплатные вопросы закончились|Результаты/)).toBeVisible({
    timeout: 10000,
  });
});

test('topic click starts filtered quiz', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: /Начать тему: Права доступа/ }).click();
  await expect(page.getByText(counter(1))).toBeVisible({ timeout: 5000 });
});

test('inherit mode follows the system colour scheme live', async ({ page }) => {
  // No stored preference => the app follows the system/Telegram.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'inherit');

  // Flipping the OS preference must re-theme without a reload (matchMedia change).
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });
});

test('inherit mode normalises a legacy system value', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => {
    window.localStorage.setItem('lx-theme', 'system');
    window.localStorage.setItem('lx-theme-manual', 'dark');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  // migrateThemeStorage() runs synchronously in main.tsx: the legacy value goes
  // away and the obsolete manual key is dropped.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('lx-theme')), { timeout: 5000 })
    .toBeNull();
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'inherit');
  expect(await page.evaluate(() => window.localStorage.getItem('lx-theme-manual'))).toBeNull();
});

test('theme icon flips the theme and can return to inherit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });

  // The icon lives in the Dashboard status strip and names the action it performs.
  const icon = page.getByRole('button', { name: 'Переключить на тёмную' });
  await expect(icon).toBeVisible();

  // Flip to dark: an explicit choice is pinned and the label now offers the reverse.
  await icon.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'manual');
  expect(await page.evaluate(() => window.localStorage.getItem('lx-theme'))).toBe('dark');
  const back = page.getByRole('button', { name: 'Переключить на светлую' });
  await expect(back).toBeVisible();

  // Flip back: it now equals the system theme, so the key is cleared entirely
  // (null, not an empty string) and the app follows the system again.
  await back.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'inherit');
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('lx-theme')), { timeout: 5000 })
    .toBeNull();
  await expect(page.getByRole('button', { name: 'Переключить на тёмную' })).toBeVisible();
});

test('theme icon does not navigate away from the dashboard', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('button', { name: 'Переключить на тёмную' }).click();

  // There is no Settings screen any more: the dashboard must still be the screen.
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible();
  await expect(page.getByText('Программа RHCSA')).toBeVisible();
  await expect(page.getByRole('switch')).toHaveCount(0);
});

test('the app inherits the theme on load without any interaction', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  // Clean storage: inherit is the default state.
  await page.addInitScript(() => window.localStorage.removeItem('lx-theme'));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-source', 'inherit');
  expect(await page.evaluate(() => window.localStorage.getItem('lx-theme'))).toBeNull();
  await expect(page.getByRole('button', { name: 'Переключить на тёмную' })).toBeVisible();

  // And the OS change propagates without a reload.
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark', { timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Переключить на светлую' })).toBeVisible();
});

// Computed-style assertions, not attribute assertions: the theme bug that
// DECISION-012 fixed was invisible at the attribute level (data-theme="light"
// while the page painted dark), because the dark value arrived through a static
// --tg-theme-* fallback in index.css.

const LIGHT_BG = 'rgb(245, 245, 245)';
const DARK_BG = 'rgb(30, 30, 30)';

async function themeProbe(
  page: import('@playwright/test').Page,
  colorScheme: 'light' | 'dark',
  stored: 'light' | 'dark' | null
) {
  await page.emulateMedia({ colorScheme });
  await page.addInitScript((value) => {
    if (value === null) window.localStorage.removeItem('lx-theme');
    else window.localStorage.setItem('lx-theme', value);
  }, stored);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });
  return page.evaluate(() => ({
    bgPrimary: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(),
    body: getComputedStyle(document.body).backgroundColor,
    container: (() => {
      const el = document.querySelector('#root > div');
      return el ? getComputedStyle(el).backgroundColor : 'n/a';
    })(),
  }));
}

test('computed --bg-primary resolves per theme (4 combinations)', async ({ page }) => {
  // inherit + OS light: the regression. Must be LIGHT.
  let r = await themeProbe(page, 'light', null);
  expect(r.bgPrimary.toLowerCase()).toBe('#f5f5f5');
  expect(r.body).toBe(LIGHT_BG);
  expect(r.container).toBe(LIGHT_BG);

  // inherit + OS dark.
  r = await themeProbe(page, 'dark', null);
  expect(r.bgPrimary.toLowerCase()).toBe('#1e1e1e');
  expect(r.body).toBe(DARK_BG);

  // manual light while the OS is dark.
  r = await themeProbe(page, 'dark', 'light');
  expect(r.bgPrimary.toLowerCase()).toBe('#f5f5f5');
  expect(r.body).toBe(LIGHT_BG);

  // manual dark while the OS is light.
  r = await themeProbe(page, 'light', 'dark');
  expect(r.bgPrimary.toLowerCase()).toBe('#1e1e1e');
  expect(r.body).toBe(DARK_BG);
});

test('inherit paints a light page in a plain browser (the reported bug)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => window.localStorage.removeItem('lx-theme'));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });

  // Outside Telegram nothing publishes --tg-theme-*, so the theme value must win.
  const tgVar = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--tg-theme-bg-color').trim()
  );
  expect(tgVar).toBe('');

  const html = await page.locator('html').getAttribute('data-theme-source');
  expect(html).toBe('inherit');

  const lum = await page.evaluate(() => {
    const m = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || []).map(Number);
    return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
  });
  expect(lum).toBeGreaterThan(0.8);
});

// K1: components migrated from the hardcoded COLORS palette to the semantic
// CSS variables. These assertions read COMPUTED colours, so a regression back to
// a literal (e.g. surface: '#2D2D2D') fails here even though the JSX still looks
// right.

const LIGHT = {
  primary: 'rgb(245, 245, 245)',
  surface: 'rgb(255, 255, 255)',
  elevated: 'rgb(234, 234, 234)',
};
const DARK = {
  primary: 'rgb(30, 30, 30)',
  surface: 'rgb(45, 45, 45)',
  elevated: 'rgb(37, 37, 37)',
};

test('migrated surfaces follow the theme (4 combinations)', async ({ page }) => {
  const cases = [
    { colorScheme: 'light' as const, stored: null, want: LIGHT },
    { colorScheme: 'dark' as const, stored: null, want: DARK },
    { colorScheme: 'dark' as const, stored: 'light' as const, want: LIGHT },
    { colorScheme: 'light' as const, stored: 'dark' as const, want: DARK },
  ];

  for (const c of cases) {
    await page.emulateMedia({ colorScheme: c.colorScheme });
    await page.addInitScript((value) => {
      if (value === null) window.localStorage.removeItem('lx-theme');
      else window.localStorage.setItem('lx-theme', value);
    }, c.stored);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 10000,
    });

    const probe = await page.evaluate(() => {
      const vars = getComputedStyle(document.documentElement);
      const container = document.querySelector('#root > div');
      const card = document.querySelector('#status-strip');
      return {
        primary: vars.getPropertyValue('--bg-primary').trim(),
        surface: vars.getPropertyValue('--bg-surface').trim(),
        elevated: vars.getPropertyValue('--bg-elevated').trim(),
        containerBg: container ? getComputedStyle(container).backgroundColor : 'n/a',
        bodyBg: getComputedStyle(document.body).backgroundColor,
        cardBg: card ? getComputedStyle(card).backgroundColor : 'n/a',
      };
    });

    // The variables themselves must resolve per theme.
    expect(probe.surface.toLowerCase()).toBe(c.want === LIGHT ? '#ffffff' : '#2d2d2d');
    expect(probe.elevated.toLowerCase()).toBe(c.want === LIGHT ? '#eaeaea' : '#252525');

    // ScreenContainer paints --bg-primary, and body carries the page colour.
    expect(probe.containerBg).toBe(c.want.primary);
    expect(probe.bodyBg).toBe(c.want.primary);
  }
});

test('answer options use the semantic elevated surface, not a literal', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => window.localStorage.removeItem('lx-theme'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить' }).click();

  const first = page.locator('button[aria-label^="Ответ"]').first();
  await expect(first).toBeVisible({ timeout: 10000 });

  // Must be the light elevated colour. The pre-migration literal was #252525,
  // which stayed dark in a light theme and made the options unreadable.
  await expect(first).toHaveCSS('background-color', LIGHT.elevated);

  const contrast = await first.evaluate((el) => {
    const lum = (rgb: string) => {
      const m = (rgb.match(/\d+/g) || []).map(Number);
      const chan = m.slice(0, 3).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
    };
    const cs = getComputedStyle(el);
    const a = lum(cs.backgroundColor);
    const b = lum(cs.color);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

// K2: --success/--danger became theme-scoped so each theme keeps AA against its
// own surface. Assert the computed tokens AND the measured ratio, so a future
// palette tweak that drops below 4.5 fails here instead of shipping.

test('theme-aware success/danger clear AA against the surface (4 combinations)', async ({ page }) => {
  const cases = [
    { colorScheme: 'light' as const, stored: null, success: 'rgb(55, 126, 58)', danger: 'rgb(207, 57, 46)' },
    { colorScheme: 'dark' as const, stored: null, success: 'rgb(76, 175, 80)', danger: 'rgb(255, 92, 74)' },
    { colorScheme: 'dark' as const, stored: 'light' as const, success: 'rgb(55, 126, 58)', danger: 'rgb(207, 57, 46)' },
    { colorScheme: 'light' as const, stored: 'dark' as const, success: 'rgb(76, 175, 80)', danger: 'rgb(255, 92, 74)' },
  ];

  for (const c of cases) {
    await page.emulateMedia({ colorScheme: c.colorScheme });
    await page.addInitScript((value) => {
      if (value === null) window.localStorage.removeItem('lx-theme');
      else window.localStorage.setItem('lx-theme', value);
    }, c.stored);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
      timeout: 10000,
    });

    const probe = await page.evaluate(() => {
      const vars = getComputedStyle(document.documentElement);
      // Resolve a token through a throwaway element so the measured value is what
      // the browser actually paints, not the raw token text.
      const resolve = (token: string, on: string) => {
        const el = document.createElement('span');
        el.style.color = token;
        el.style.backgroundColor = on;
        document.body.appendChild(el);
        const cs = getComputedStyle(el);
        const out = { fg: cs.color, bg: cs.backgroundColor };
        el.remove();
        return out;
      };
      const lum = (rgb: string) => {
        const m = (rgb.match(/\d+/g) || []).map(Number);
        const chan = m.slice(0, 3).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
      };
      const ratio = (a: string, b: string) => {
        const la = lum(a);
        const lb = lum(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
      };
      const surface = vars.getPropertyValue('--bg-surface').trim();
      const s1 = resolve('var(--success)', 'var(--bg-surface)');
      const d1 = resolve('var(--danger)', 'var(--bg-surface)');
      return {
        success: s1.fg,
        danger: d1.fg,
        surface: s1.bg,
        surfaceToken: surface,
        successRatio: ratio(s1.fg, s1.bg),
        dangerRatio: ratio(d1.fg, d1.bg),
      };
    });

    expect(probe.success).toBe(c.success);
    expect(probe.danger).toBe(c.danger);
    expect(probe.successRatio).toBeGreaterThanOrEqual(4.5);
    expect(probe.dangerRatio).toBeGreaterThanOrEqual(4.5);
  }
});

test('review first question has no back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 10000,
  });

  // A topic quiz runs on the review stream. Its first question has no previous
  // question, so neither the header back control nor Telegram's BackButton may
  // be offered (previousQuestion() is a no-op at index 0).
  await page.getByRole('button', { name: /Начать тему: Права доступа/ }).click();
  await expect(page.getByText(counter(1))).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Назад' })).toHaveCount(0);

  // Answering and advancing must bring the control back for question 2.
  await page.locator('button[aria-label^="Ответ"]').first().click();
  await page.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await expect(page.getByText(counter(2))).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible();
});

test('a completed topic run reports the review stream, not an empty screen', async ({ page }) => {
  // Seeded on the LAST question of a topic run, with currentScreen = 'question'
  // so the app boots straight into it (an unfinished review run is not offered
  // as a resumable banner, and driving the whole topic is impossible for a free
  // user - see the report on the free-question gate). This isolates the defect
  // under repair: a finished topic run must land on the REVIEW results and must
  // not claim "Вы ещё не ответили ни на один вопрос".
  // The seeded stream is the WHOLE live topic, so the last index is its last id,
  // and the two already-answered questions are built from their live correct option.
  await page.addInitScript(
    ({ ids, answers }: { ids: string[]; answers: AnswerSeed[] }) => {
      window.localStorage.setItem(
        'rhcsa_progress',
        JSON.stringify({
          version: 2,
          state: {
            answers: [],
            currentIndex: ids.length - 1,
            isPro: true,
            streak: 3,
            lastActiveDate: null,
            totalXp: 30,
            wrongQuestionIds: [],
            reviewQuestionIds: ids,
            reviewAnswers: answers,
            isQuizInProgress: true,
            currentScreen: 'question',
            // activeTopic is session-only (never persisted), so a topic run that is
            // resumed in a fresh session cannot restore its own title. Seed it here
            // to exercise the topic-title branch end to end.
            activeTopic: 'file_permissions',
            examActive: false,
            examStartedAt: null,
            examDurationMs: 0,
            examQuestionIds: [],
            examAnswers: [],
          },
        })
      );
    },
    { ids: TOPIC_IDS, answers: [correctAnswer(TOPIC_IDS[0]), correctAnswer(TOPIC_IDS[1])] }
  );

  await page.goto('/');

  // The review stream is live: the whole topic, its last question open.
  await expect(page.getByText(counter(TOPIC_SIZE))).toBeVisible({ timeout: 10000 });
  await page.locator('button[aria-label^="Ответ"]').first().click();
  await page.getByRole('button', { name: 'Завершить', exact: true }).click();

  // REVIEW results: titled with the topic, a real score - and no regular-only
  // affordances.
  await expect(page.getByRole('heading', { level: 1, name: 'Тема: Права доступа' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Вы ещё не ответили ни на один вопрос')).toHaveCount(0);
  await expect(page.getByText(/^[1-3] \/ [1-3]$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пройти заново' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'К темам' })).toBeVisible();
});


test('a finished exam still shows the exam summary', async ({ page }) => {
  // Guard for the other branch of the stream formula. The exam is driven through
  // its REAL auto-finish path: a persisted running exam whose time has already
  // elapsed triggers finishExam from useExamTimer, which populates
  // examLastResult (session-only, so it cannot be seeded directly).
  // The exam questions/answers are seeded from the live topic: the two answers are
  // the live correct options, so the summary really is 2 correct out of 2 answered.
  await page.addInitScript(
    ({ ids, answers }: { ids: string[]; answers: AnswerSeed[] }) => {
      window.localStorage.setItem(
        'rhcsa_progress',
        JSON.stringify({
          version: 2,
          state: {
            answers: [],
            currentIndex: 0,
            isPro: true,
            streak: 0,
            lastActiveDate: null,
            totalXp: 0,
            wrongQuestionIds: [],
            reviewQuestionIds: null,
            reviewAnswers: [],
            isQuizInProgress: true,
            currentScreen: 'question',
            activeTopic: null,
            examActive: true,
            examStartedAt: Date.now() - 120000,
            examDurationMs: 60000,
            examQuestionIds: [ids[0], ids[1]],
            examAnswers: answers,
            examLastResult: null,
          },
        })
      );
    },
    { ids: TOPIC_IDS, answers: [correctAnswer(TOPIC_IDS[1]), correctAnswer(TOPIC_IDS[2])] }
  );

  await page.goto('/');

  // The elapsed exam finalises itself: examLastResult is built from the EXAM
  // answers (2/2), not from the empty regular stream.
  await expect(page.getByText('Экзамен завершён')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('2 / 2')).toBeVisible();
  await expect(page.getByText('100%')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Пройти заново' })).toBeVisible();
});

test('a free user can advance past the limit inside a topic run (B1)', async ({ page }) => {
  // B1: nextQuestion applied FREE_QUESTION_LIMIT to the review stream while
  // Question.tsx hides the paywall for review, so a free user froze at the limit
  // with nothing to act on. Seeded AT the limit (index 4 = the fifth question,
  // FREE_QUESTION_LIMIT - 1) with isPro false: one click must move to the next
  // question and must not surface the paywall. The stream itself is the live topic,
  // and the already-answered fifth question carries its live correct option.
  await page.addInitScript(
    ({ ids, answers }: { ids: string[]; answers: AnswerSeed[] }) => {
      window.localStorage.setItem(
        'rhcsa_progress',
        JSON.stringify({
          version: 2,
          state: {
            answers: [],
            currentIndex: 4,
            isPro: false,
            streak: 0,
            lastActiveDate: null,
            totalXp: 0,
            wrongQuestionIds: [],
            reviewQuestionIds: ids,
            reviewAnswers: answers,
            isQuizInProgress: true,
            currentScreen: 'question',
            activeTopic: 'file_permissions',
            examActive: false,
            examStartedAt: null,
            examDurationMs: 0,
            examQuestionIds: [],
            examAnswers: [],
          },
        })
      );
    },
    { ids: TOPIC_IDS, answers: [correctAnswer(TOPIC_IDS[4])] }
  );

  await page.goto('/');

  // Fifth question of the topic run (the last free index) for a non-pro user.
  await expect(page.getByText(counter(5))).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();

  // Advanced past the free limit: question 6 renders and no paywall is shown.
  // Before the fix this stuck at 5 / N.
  await expect(page.getByText(counter(6))).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Бесплатные вопросы закончились')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Следующий вопрос', exact: true })).toBeVisible();

  // The run keeps going: two more steps land on 8 / N.
  await page.locator('button[aria-label^="Ответ"]').first().click();
  await page.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await page.locator('button[aria-label^="Ответ"]').first().click();
  await page.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await expect(page.getByText(counter(8))).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Бесплатные вопросы закончились')).toHaveCount(0);
});