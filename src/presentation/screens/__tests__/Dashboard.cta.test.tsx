import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '@/presentation/screens/Dashboard';
import { useQuizStore } from '@/store/quizStore';

/**
 * Вход в занятие на Dashboard (spec 065, К2.3).
 *
 * Кнопка выбирается по состоянию профиля: НЕТ НИ ОДНОГО ОТВЕТА → Fresh User Mode
 * с Hero и единственной CTA «Начать первый вопрос →»; есть просроченные →
 * «Повторить сегодня»; остались только новые → «Продолжить изучение».
 *
 * Условие режима — `isFreshUser = hasNoHistory` (задание «удалить демо-квиз»: флаг
 * `hasCompletedOnboarding` из условия убран, потому что выставлялся только на
 * удалённом демо-экране). Поэтому профиль с пустой `questionStats` в этом файле —
 * ВСЕГДА fresh mode, а ветка `hasNoHistory && !isFreshUser` (подпись «Начать
 * обучение» со скроллом к списку тем) недостижима: её контракт здесь больше не
 * проверяется — списка тем в режиме нет вовсе.
 *
 * Про «Повторить сегодня» на свежем профиле: `ensureReviewsInitialized` при
 * монтировании расставляет всему банку `next = now`, то есть свежий профиль ЧЕСТНО
 * имеет 30 просроченных — ровно столько, сколько помещается в одну сессию
 * (SESSION_LIMIT). Но повторение новичку не предлагается вовсе: ветки CTA
 * взаимоисключающие, и fresh mode показывает только Hero.
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

  it('профиль без единого ответа → Hero и ОДНА CTA, без веток повторения (spec 066)', async () => {
    renderDashboard();
    await flushInitialization();

    // Fresh User Mode: Hero с ценностью вместо нулей.
    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
    expect(screen.getByTestId('dashboard-features')).toBeTruthy();

    const start = screen.getByTestId('start-learning');
    expect(start.textContent).toContain('Начать первый вопрос');
    // Счётчик тем у Hero не показывается — он ушёл в подзаголовок.
    expect(start.textContent).not.toMatch(/\d+ тем/);

    // spec 066: ветки взаимоисключающие. Реестр расписания к этому моменту уже
    // наполнен всем банком (`ensureReviewsInitialized`), но повторять новичку
    // нечего — CTA показывается ОДНА, без «Повторить» и остатка пула.
    expect(screen.queryByTestId('review-today')).toBeNull();
    expect(screen.queryByTestId('review-today-remainder')).toBeNull();
    expect(screen.queryByTestId('continue-learning')).toBeNull();
    // Список тем в режиме скрыт: прежняя ветка «Начать обучение» скроллила именно
    // к нему, и после B1 (`isFreshUser = hasNoHistory`) она недостижима.
    expect(screen.queryByTestId('dashboard-topics')).toBeNull();
  });

  it('клик по CTA в fresh mode стартует занятие, а не скроллит к темам', async () => {
    const user = userEvent.setup();
    renderDashboard();
    await flushInitialization();

    await user.click(screen.getByTestId('start-learning'));

    // Прежний контракт этой кнопки (scrollIntoView к `dashboard-topics`)
    // принадлежал ветке профиля БЕЗ пройденного онбординга; демо удалено, ветка
    // недостижима, поэтому CTA всегда стартует review-сессию дня.
    const state = useQuizStore.getState();
    expect(state.currentScreen).toBe('question');
    expect(state.reviewKind).toBe('today');
    expect(state.reviewQuestionIds?.length).toBeGreaterThan(0);
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

  it('сохранённые testid дашборда на месте (профиль с историей)', () => {
    // Узлы обычного режима живут только вне fresh mode, поэтому профиль сеется
    // непустой статистикой — иначе проверялся бы Hero, а не они.
    const bank = useQuizStore.getState().questions;
    useQuizStore.setState({
      questionStats: { [bank[0].id]: { attempts: 1, correct: 1, lastAt: '2026-10-04' } },
    });
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
