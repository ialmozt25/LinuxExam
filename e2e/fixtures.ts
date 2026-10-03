import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';
import { TOPICS as topicRegistry } from '../src/data/topics';

/**
 * Shared E2E fixtures (Фаза 2.2).
 *
 * Every helper here reads the live bank from `src/data/questions/*.json` instead
 * of hard-coding ids, question text or topic sizes: the bank drifts (items are
 * added and removed by tooling), and a stale literal turns into a green test that
 * asserts the wrong thing. Playwright runs specs in Node, so the bank is on disk.
 */

export const BANK_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'questions');

export interface BankOption {
  text: string;
  correct: boolean;
}

export interface BankQuestion {
  id: string;
  topic: string;
  question: string;
  options: BankOption[];
  explanation: string;
}

/**
 * The real stream order is used by the entry points that do NOT re-shuffle:
 * `startRegularQuiz` keeps `questions` as loaded (the manifest order), so the
 * regular stream and a seeded exam run share it. Only `startTopicQuiz` /
 * `startExam` shuffle.
 */

/** Question the regular stream serves at `index`. */
export function regularQuestionAt(index: number): BankQuestion {
  const id = regularQuestionIdAt(index);
  for (const slug of Object.keys(TOPIC_QUESTIONS)) {
    const hit = TOPIC_QUESTIONS[slug].find((q) => q.id === id);
    if (hit) return hit;
  }
  throw new Error(`live bank drift: _order.json lists "${id}" but no topic chunk holds it`);
}

/** The first `count` questions of the regular stream, in stream order. */
export function regularQuestions(count: number): BankQuestion[] {
  return Array.from({ length: count }, (_, i) => regularQuestionAt(i));
}

export interface TopicIndex {
  total: number;
  byTopic: Record<string, number>;
}

export interface TopicEntry {
  key: string;
  title: string;
}

/**
 * Topic registry, read from `src/data/topics.ts` — the same file the Dashboard
 * renders from. The module is pure data (lucide icon components, no DOM, no Vite
 * globals), so Playwright can import it directly in Node and a new bank topic
 * cannot silently drop out of the E2E scope.
 */
export const TOPICS: TopicEntry[] = (topicRegistry as TopicEntry[]).map(({ key, title }) => ({
  key,
  title,
}));

export function readBank<T>(file: string): T {
  return JSON.parse(readFileSync(join(BANK_DIR, file), 'utf8')) as T;
}

/** The generated manifest: the same source the Dashboard uses for its counters. */
export const TOPIC_INDEX: TopicIndex = readBank<TopicIndex>('_topics.json');

/**
 * Live bank chunks, keyed by topic slug. Reading them once at module load keeps
 * the per-topic JSON on disk out of the loops that iterate every topic.
 */
export const TOPIC_QUESTIONS: Record<string, BankQuestion[]> = Object.fromEntries(
  Object.keys(TOPIC_INDEX.byTopic).map((slug) => [slug, readBank<BankQuestion[]>(`${slug}.json`)])
);

/**
 * The REGULAR stream order: `_order.json` interleaves the per-topic chunks, so the
 * question the app serves at index `i` is NOT `topicFile[i]` — it is the i-th entry
 * of the whole manifest. Any test that needs "the question at regular index i" must
 * go through here.
 */
const BANK_ORDER: string[] = readBank<string[]>('_order.json');

/** Question id the regular stream serves at `index`. */
export function regularQuestionIdAt(index: number): string {
  const id = BANK_ORDER[index];
  if (!id) throw new Error(`live bank drift: _order.json has no entry at index ${index}`);
  return id;
}

/** Live size of one topic, exactly as the dashboard and the header counter show it. */
export function topicSize(slug: string): number {
  const size = TOPIC_INDEX.byTopic[slug];
  if (!size) {
    throw new Error(`live bank drift: _topics.json declares no topic "${slug}"`);
  }
  return size;
}

/**
 * Dashboard button testid for a topic (`data-testid="topic-<key>"`).
 * The key is taken verbatim — topic keys contain underscores, so no slugify step
 * may touch it.
 */
export function topicTestId(slug: string): string {
  return `topic-${slug}`;
}

// ---------------------------------------------------------------------------
// Analytics beacon
// ---------------------------------------------------------------------------

/**
 * `index.html` loads a third-party analytics beacon (`//gc.zgo.at/count.js`).
 * `page.goto` waits for `load`, which waits for that script, so a slow CDN answer
 * turns a painted screen into a navigation timeout (observed 2026-10-03). Nothing
 * under test touches analytics, so the beacon is aborted.
 */
export async function blockAnalytics(page: Page): Promise<void> {
  await page.route(/gc\.zgo\.at/, (route) => route.abort());
}

/**
 * Persisted quiz state, in the shape zustand writes it: `{ version, state }`.
 * Only the keys the `partialize` contract persists belong here.
 */
export interface PersistedQuizState {
  answers: unknown[];
  currentIndex: number;
  isPro: boolean;
  streak: number;
  lastActiveDate: string | null;
  totalXp: number;
  wrongQuestionIds: string[];
  questionStats: Record<string, unknown>;
  /** FSRS-lite: реестр расписания повторений, ключ — qid (spec 052). */
  scheduledReviews: Record<string, { next: number; stability: number; difficulty: number }>;
  reviewQuestionIds: string[] | null;
  reviewAnswers: unknown[];
  isQuizInProgress: boolean;
  examActive: boolean;
  examStartedAt: number | null;
  examDurationMs: number;
  examQuestionIds: string[];
  examAnswers: unknown[];
}

/** A pristine stored profile; every field is present so nothing is merged in. */
export function emptyPersistedState(): PersistedQuizState {
  return {
    answers: [],
    currentIndex: 0,
    isPro: true,
    streak: 0,
    lastActiveDate: null,
    totalXp: 0,
    wrongQuestionIds: [],
    questionStats: {},
    scheduledReviews: {},
    reviewQuestionIds: null,
    reviewAnswers: [],
    isQuizInProgress: false,
    examActive: false,
    examStartedAt: null,
    examDurationMs: 0,
    examQuestionIds: [],
    examAnswers: [],
  };
}

/**
 * Seeds `rhcsa_progress` in `localStorage` BEFORE any navigation. The persisted
 * state is what a reload restores, so callers may seed and then `page.goto('/')`
 * once — the app boots straight into the seeded condition.
 *
 * The init script receives EVERY value as an argument: Playwright re-parses the
 * function source inside the page, so a closure over a module constant (the
 * storage key) throws a ReferenceError there and the seed is silently never
 * written — the app then boots with its defaults and the test fails far away.
 */
export async function seedState(
  page: Page,
  state: Partial<PersistedQuizState>
): Promise<void> {
  const payload = { version: PERSIST_VERSION, state: { ...emptyPersistedState(), ...state } };
  await page.addInitScript(
    ({ key, seeded }: { key: string; seeded: unknown }) => {
      window.localStorage.setItem(key, JSON.stringify(seeded));
    },
    { key: PERSIST_KEY, seeded: payload }
  );
}

export const PERSIST_KEY = 'rhcsa_progress';
/** Current persist version: 4 с spec 052 (FSRS-lite добавил scheduledReviews). */
export const PERSIST_VERSION = 4;

/** Reads the persisted envelope back out of the page. */
export async function readPersisted(
  page: Page
): Promise<{ version: number; state: Record<string, unknown> } | null> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('rhcsa_progress');
    return raw ? JSON.parse(raw) : null;
  });
}

/** One live answer record, in the exact shape the store writes. */
export function liveRecord(question: BankQuestion, correct: boolean) {
  const option = question.options.find((o) => o.correct === correct);
  if (!option) {
    throw new Error(`live bank drift: ${question.id} has no ${correct ? 'correct' : 'wrong'} option`);
  }
  return {
    questionId: question.id,
    selectedIndex: question.options.indexOf(option),
    isCorrect: correct,
    optionText: option.text,
  };
}

/**
 * Seeds a REVIEW run over `size` live questions of one topic, with no answers yet.
 * The dashboard's topic button starts the run (a topic quiz reuses the review
 * stream), and `startTopicQuiz` maps the topic's question ids to the review list —
 * so the run length equals the live topic size, not `size`. The seeded list only
 * sets the review stream up; it is the click that decides the run length.
 */
export async function seedTopicRun(
  page: Page,
  slug: string,
  size = 2
): Promise<{ size: number; answers: unknown[] }> {
  const questions = TOPIC_QUESTIONS[slug].slice(0, size);
  const state = emptyPersistedState();
  state.reviewQuestionIds = questions.map((q) => q.id);
  state.reviewAnswers = [];
  state.currentIndex = 0;
  state.isQuizInProgress = true;

  await seedState(page, state);
  return { size: questions.length, answers: [] };
}

/**
 * Seeds ONE wrong answer in the REGULAR stream (feeds «Повторить ошибки»). */
export async function seedWrongRegularAnswer(page: Page, question: BankQuestion) {
  const state = emptyPersistedState();
  const record = liveRecord(question, false);
  state.answers = [record];
  state.wrongQuestionIds = [question.id];
  state.streak = 1;
  state.totalXp = 10;
  state.isQuizInProgress = false;

  await seedState(page, state);
  return { record };
}

// ---------------------------------------------------------------------------
// Raw test ids (data-testid contract from app-map §4)
// ---------------------------------------------------------------------------

export const TESTID = {
  dashboardContinue: 'dashboard-continue',
  dashboardProgress: 'dashboard-progress',
  dashboardSubtitle: 'dashboard-subtitle',
  reviewWrong: 'review-wrong',
  reviewToday: 'review-today',
  resumeBanner: 'resume-banner',
  resumePosition: 'resume-position',
  resumeButton: 'resume-button',
  examBanner: 'exam-banner',
  examTimer: 'exam-timer',
  examContinue: 'exam-continue',
  startExam: 'start-exam',
  topicToggle: 'theme-toggle',

  headerBack: 'header-back',
  headerHome: 'header-home',
  headerCenter: 'app-header-center',

  questionText: 'question-text',
  questionProgress: 'question-progress',
  questionEmpty: 'question-empty',
  explanation: 'explanation',
  explanationVerdict: 'explanation-verdict',
  nextButton: 'next-button',

  paywall: 'paywall',
  paywallBuy: 'paywall-buy',
  paywallLater: 'paywall-later',

  resultsScreen: 'results-screen',
  resultsScore: 'results-score',
  resultsAccuracy: 'results-accuracy',
  resultsEmpty: 'results-empty',
  resultsRetry: 'results-retry',
  resultsBack: 'results-back',
  resultsShare: 'results-share',
  resultsTopics: 'results-topics',

  examSummary: 'exam-summary',
  examScore: 'exam-score',
  examAccuracy: 'exam-accuracy',
  examTime: 'exam-time',
  examRestart: 'exam-restart',
  examExit: 'exam-exit',
  examConfirm: 'exam-confirm',
  examStay: 'exam-stay',
  examLeave: 'exam-leave',
} as const;

// ---------------------------------------------------------------------------
// Helpers (Фаза 2.2 contract)
// ---------------------------------------------------------------------------

/**
 * Opens the app and waits for the dashboard.
 * The bank is loaded in per-topic chunks behind an `isLoading` gate, so a plain
 * `goto` leaves the caller on «Загрузка…» — every helper waits on a real anchor.
 */
export async function gotoApp(page: Page): Promise<void> {
  await blockAnalytics(page);
  await page.goto('/');
  await waitForDashboard(page);
}

export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'LinuxExam' })).toBeVisible({
    timeout: 15000,
  });
}

/** Waits for the question screen; returns once the question text is rendered. */
export async function waitForQuestion(page: Page): Promise<string> {
  await expect(page.getByTestId(TESTID.questionText)).toBeVisible({ timeout: 15000 });
  return currentQuestionText(page);
}

/** Normalised header counter, e.g. "3 / 19" (the exam adds the timer after a dot). */
export async function counterText(page: Page): Promise<string> {
  const raw = await page.getByTestId(TESTID.headerCenter).innerText();
  return raw.split('·')[0].replace(/\s+/g, ' ').trim();
}

/** Opens a seeded topic run at the dashboard and walks into its open question. */
export async function openSeededRun(page: Page, slug: string): Promise<void> {
  await topicButton(page, slug).click();
  await waitForQuestion(page);
}

/**
 * Presses the dashboard resume button.
 *
 * The banner sits BELOW the 14-row topic list, so on a 1280x720 viewport the
 * button is at y≈1388 — outside the viewport, where a plain `click()` waits for
 * actionability until the test times out. Scrolling it into view first is the
 * app's real behaviour (the list is long), not a test-only shortcut.
 */
export async function resumeSeededRun(page: Page): Promise<void> {
  const button = page.getByTestId(TESTID.resumeButton);
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await waitForQuestion(page);
}

/** Dashboard topic button. */
export function topicButton(page: Page, slug: string) {
  return page.getByTestId(topicTestId(slug));
}

/** Starts a topic quiz and returns the topic size the header counter must show. */
export async function startTopic(page: Page, slug: string): Promise<number> {
  const size = topicSize(slug);
  await topicButton(page, slug).click();
  await waitForQuestion(page);
  return size;
}

/** The question text currently rendered on the Question screen. */
export async function currentQuestionText(page: Page): Promise<string> {
  return (await page.getByTestId(TESTID.questionText).innerText()).trim();
}

/** Live bank record behind one question text (the screen renders only the text). */
export function findQuestionByText(text: string): BankQuestion {
  const wanted = text.trim();
  for (const slug of Object.keys(TOPIC_QUESTIONS)) {
    const hit = TOPIC_QUESTIONS[slug].find((q) => q.question.trim() === wanted);
    if (hit) return hit;
  }
  throw new Error(`live bank drift: no question matches the rendered text "${wanted.slice(0, 60)}…"`);
}

/** Option buttons of the current question, in visual (rendered) order. */
export function optionButtons(page: Page) {
  return page.locator('[data-testid^="option-"]');
}

export type OptionKind = 'correct' | 'wrong';

/**
 * Answers the current question.
 *
 * `correct` resolves the right option through the live bank and picks it by its
 * RENDERED `Ответ X:` label; `wrong` picks the first option that is not correct.
 *
 * The letter in that label is the VISUAL position, not the stored option index:
 * `Question.tsx` renders the options in a deterministic per-id shuffle order and
 * numbers them A..D after shuffling. Matching therefore goes by the option text,
 * which is also the identity the store persists for every answer.
 */
export async function answerQuestion(page: Page, kind: OptionKind): Promise<void> {
  const question = findQuestionByText(await currentQuestionText(page));
  const labels = await optionButtons(page).evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('aria-label') ?? '')
  );

  const index = question.options.findIndex((o) => (kind === 'correct' ? o.correct : !o.correct));
  if (index < 0) {
    throw new Error(`live bank drift: ${question.id} has no ${kind} option`);
  }
  const option = question.options[index];
  const label = labels.find((l) => l.endsWith(`: ${option.text}`));
  if (!label) {
    throw new Error(`live bank drift: option "${option.text}" of ${question.id} is not rendered`);
  }

  await page.getByRole('button', { name: label, exact: true }).click();
  await waitForFeedback(page);
}

/** Waits for the answered state: the feedback verdict appears and options lock. */
export async function waitForFeedback(page: Page): Promise<void> {
  await expect(page.getByTestId(TESTID.explanationVerdict)).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId(TESTID.nextButton)).toBeEnabled({ timeout: 10000 });
}

/**
 * Re-exported test object. The analytics beacon is blocked inside `gotoApp`, so
 * every spec that opens the app through the fixtures gets the same treatment.
 */
export const test = base;

export { expect };
