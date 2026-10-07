import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Dashboard from '@/presentation/screens/Dashboard';
import { useQuizStore } from '@/store/quizStore';

/**
 * Fresh User Mode (упрощение онбординга).
 *
 * Условие режима — `hasCompletedOnboarding && !hasAnyAnswers`, где «есть ответы»
 * это непустая `questionStats` (та же метрика, что у гейта `useNeedsOnboarding`).
 * Показывается только нужное до первого ответа; Exam mode, аналитика, повтор
 * ошибок и программа RHCSA скрыты, серия заменена заглушкой, CTA — одна.
 *
 * Проверяется именно пара состояний: «до первого ответа» и «после него» —
 * граница режима, а не разметка по отдельности.
 */

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
    onboardingGoal: null,
    // Онбординг пройден (кнопка «Начать обучение →» демо-квиза)…
    hasCompletedOnboarding: true,
    // …и дневная цель уже зафиксирована дефолтом: пикера в потоке нет.
    dailyGoalXp: 30,
  });
}

function renderDashboard() {
  return render(<Dashboard theme="light" onToggleTheme={() => {}} />);
}

/** «Есть ли ответы»: непустая статистика, записанная любым потоком. */
function recordFirstAnswer() {
  const bank = useQuizStore.getState().questions;
  act(() => {
    useQuizStore.setState({
      questionStats: { [bank[0].id]: { attempts: 1, correct: 1, lastAt: '2026-10-04' } },
    });
  });
}

describe('Dashboard — Fresh User Mode', () => {
  beforeEach(async () => {
    await resetStore();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('до первого ответа: одна CTA «Начать обучение», программа и Exam скрыты', async () => {
    renderDashboard();
    await flushInitialization();

    const start = screen.getByTestId('start-learning');
    expect(start.textContent).toContain('Начать обучение');
    // Счётчик справа — число тем реестра, а не прогресс пользователя.
    expect(start.textContent).toMatch(/\d+ тем/);

    for (const hidden of [
      'exam-mode',
      'analytics-mode',
      'dashboard-topics',
      'streak-badge',
      'review-wrong',
      // Вторая primary-CTA против контракта «одна кнопка до первого ответа».
      'dashboard-continue',
    ]) {
      expect(screen.queryByTestId(hidden), `в fresh mode не должно быть ${hidden}`).toBeNull();
    }

    // Пикер дневной цели не всплывает: цель уже зафиксирована дефолтом.
    expect(screen.queryByTestId('daily-goal-picker')).toBeNull();
  });

  it('серия заменена заглушкой, прогресс и уровень на месте', async () => {
    renderDashboard();
    await flushInitialization();

    expect(screen.getByTestId('streak-placeholder').textContent).toBe('Начни серию сегодня');
    expect(screen.getByTestId('dashboard-progress').textContent).toContain('0 из');
    // Уровень «Новичок» и «0 / 50 XP до Ученика» — та же полоса, что у обычного
    // профиля: режим скрывает блоки, а не переизобретает status-strip.
    expect(screen.getByText('Новичок')).toBeTruthy();
    expect(screen.getByText(/0 \/ 50 XP до Ученика/)).toBeTruthy();
  });

  it('первый ответ снимает режим: возвращаются Exam, аналитика, программа и серия', async () => {
    renderDashboard();
    await flushInitialization();

    expect(screen.queryByTestId('exam-mode')).toBeNull();

    recordFirstAnswer();

    for (const visible of [
      'exam-mode',
      'analytics-mode',
      'dashboard-topics',
      'streak-badge',
      'dashboard-continue',
    ]) {
      expect(screen.getByTestId(visible), `после ответа должен вернуться ${visible}`).toBeTruthy();
    }
    expect(screen.queryByTestId('streak-placeholder')).toBeNull();
    expect(screen.queryByTestId('start-learning')).toBeNull();
    // CTA профиля с историей — «Продолжить обучение».
    expect(screen.getByTestId('review-today').textContent).toContain('Продолжить обучение');
  });

  it('онбординг не пройден → режим выключен (ветка выбора темы сохранена)', async () => {
    act(() => {
      useQuizStore.setState({ hasCompletedOnboarding: false });
    });
    renderDashboard();
    await flushInitialization();

    // Ветка профиля без пройденного онбординга: приглашение СКРОЛЛИТ к темам,
    // поэтому список тем и Exam mode на месте.
    expect(screen.getByTestId('start-learning')).toBeTruthy();
    expect(screen.getByTestId('dashboard-topics')).toBeTruthy();
    expect(screen.getByTestId('exam-mode')).toBeTruthy();
  });
});
