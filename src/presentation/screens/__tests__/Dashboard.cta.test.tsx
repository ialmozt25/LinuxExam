import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '@/presentation/screens/Dashboard';
import { useQuizStore } from '@/store/quizStore';

/**
 * Вход в занятие на Dashboard (spec 065, К2.3).
 *
 * Кнопка выбирается по состоянию профиля: нет ни одного ответа → приглашение к
 * обучению; есть просроченные → «Повторить сегодня»; остались только новые →
 * «Продолжить изучение».
 *
 * Про «Повторить сегодня» на свежем профиле: `ensureReviewsInitialized` при
 * монтировании расставляет всему банку `next = now`, то есть свежий профиль
 * ЧЕСТНО имеет 30 просроченных — ровно столько, сколько помещается в одну
 * сессию (SESSION_LIMIT). Поэтому приглашение и повторение соседствуют, а не
 * исключают друг друга; исключает их пустая `questionStats` только для
 * подписи: «Повторить 253» больше не появляется ни при каком профиле, потому
 * что N считается по отобранной сессии, а не по всему банку.
 *
 * Ветка «только новые» недостижима в рантайме из-за того же до-наполнения
 * (см. «Открытые вопросы» спеки), поэтому она проверяется здесь, где состояние
 * store задаётся напрямую.
 */

const DAY_MS = 86_400_000;

/** Ждёт, пока эффект монтирования Dashboard наполнит реестр расписания. */
async function flushInitialization() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function resetStore() {
  if (typeof localStorage !== 'undefined') localStorage.clear();
  await useQuizStore.getState().loadQuestions();
  useQuizStore.setState({
    answers: [],
    reviewAnswers: [],
    reviewQuestionIds: null,
    reviewKind: null,
    isQuizInProgress: false,
    currentIndex: 0,
    currentScreen: 'dashboard',
    activeTopic: null,
    wrongQuestionIds: [],
    questionStats: {},
    scheduledReviews: {},
    streak: 0,
    totalXp: 0,
    isPro: true,
  });
}

function renderDashboard() {
  return render(<Dashboard theme="light" onToggleTheme={() => {}} />);
}

describe('Dashboard — вход в занятие (spec 065)', () => {
  beforeEach(async () => {
    await resetStore();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('профиль без единого ответа → только «Начать обучение», без веток повторения (spec 066)', async () => {
    renderDashboard();
    await flushInitialization();

    const start = screen.getByTestId('start-learning');
    expect(start.textContent).toContain('Начать обучение');

    // spec 066: ветки взаимоисключающие. Реестр расписания к этому моменту уже
    // наполнен всем банком (`ensureReviewsInitialized`), но повторять новичку
    // нечего — приглашение показывается ОДНО, без «Повторить» и остатка пула.
    expect(screen.queryByTestId('review-today')).toBeNull();
    expect(screen.queryByTestId('review-today-remainder')).toBeNull();
    expect(screen.queryByTestId('continue-learning')).toBeNull();
  });

  it('клик по «Начать обучение» скроллит к списку тем', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const topics = screen.getByTestId('dashboard-topics');
    // jsdom не реализует scrollIntoView — подменяем и проверяем сам вызов.
    const scrollIntoView = vi.fn();
    topics.scrollIntoView = scrollIntoView;

    await user.click(screen.getByTestId('start-learning'));

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('просроченные идут первыми в сессии: прогон стартует с самого запущенного', async () => {
    const user = userEvent.setup();
    const bank = useQuizStore.getState().questions;
    renderDashboard();
    await flushInitialization();

    // Профиль не «свежий»: одна решённая карточка в статистике. Одна запись
    // сдвинута в прошлое — она обязана встать первой в сессии.
    const now = Date.now();
    act(() => {
      useQuizStore.setState({
        scheduledReviews: { ...useQuizStore.getState().scheduledReviews, [bank[0].id]: { next: now - DAY_MS, stability: 1, difficulty: 0.3 } },
        questionStats: { [bank[0].id]: { attempts: 1, correct: 0, lastAt: '2026-10-04' } },
      });
    });

    await user.click(screen.getByTestId('review-today'));

    const state = useQuizStore.getState();
    expect(state.reviewKind).toBe('today');
    expect(state.reviewQuestionIds?.[0]).toBe(bank[0].id);
    expect(state.reviewQuestionIds?.length).toBe(30);
    expect(state.currentScreen).toBe('question');
  });

  it('только новые вопросы → «Продолжить изучение (N)», «Повторить» скрыта', async () => {
    const bank = useQuizStore.getState().questions;
    renderDashboard();
    await flushInitialization();

    // Банк запланирован в будущем целиком → due пуст; часть записей убираем,
    // чтобы вопросы стали новыми. Профиль не свежий (questionStats непуста).
    const future = { next: Date.now() + DAY_MS, stability: 1, difficulty: 0.3 };
    const scheduled = Object.fromEntries(
      bank.map((q, i) => [q.id, i < 40 ? future : undefined]).filter(([, v]) => v !== undefined),
    );
    act(() => {
      useQuizStore.setState({
        scheduledReviews: scheduled as never,
        questionStats: { [bank[0].id]: { attempts: 1, correct: 1, lastAt: '2026-10-04' } },
      });
    });

    const cont = screen.getByTestId('continue-learning');
    expect(cont.textContent).toContain('Продолжить изучение (30)');
    expect(screen.queryByTestId('review-today')).toBeNull();
    expect(screen.queryByTestId('start-learning')).toBeNull();
  });

  it('оба пула пусты → ни одной кнопки входа', async () => {
    const bank = useQuizStore.getState().questions;
    renderDashboard();
    await flushInitialization();

    const future = { next: Date.now() + DAY_MS, stability: 1, difficulty: 0.3 };
    act(() => {
      useQuizStore.setState({
        scheduledReviews: Object.fromEntries(bank.map((q) => [q.id, future])),
        questionStats: { [bank[0].id]: { attempts: 1, correct: 1, lastAt: '2026-10-04' } },
      });
    });

    expect(screen.queryByTestId('review-today')).toBeNull();
    expect(screen.queryByTestId('continue-learning')).toBeNull();
    expect(screen.queryByTestId('start-learning')).toBeNull();
  });

  it('сохранённые testid дашборда на месте', () => {
    renderDashboard();

    // spec 068: legacy `start-exam` («Режим экзамена (20 вопросов, 30 минут)»)
    // удалён; вход в единственный экзамен — `exam-mode`.
    for (const id of ['exam-mode', 'analytics-mode', 'dashboard-continue']) {
      expect(screen.getByTestId(id), `пропал data-testid=${id}`).toBeTruthy();
    }
    expect(screen.queryByTestId('start-exam')).toBeNull();
    expect(screen.getByTestId('streak-badge')).toBeTruthy();
  });
});
