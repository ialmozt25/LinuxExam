import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Dashboard from '@/presentation/screens/Dashboard';
import { useQuizStore } from '@/store/quizStore';

/**
 * Fresh User Mode: продающий первый экран (задание «Fresh Dashboard»).
 *
 * Условие режима — `hasCompletedOnboarding && !hasAnyAnswers`, где «есть ответы»
 * это непустая `questionStats` (та же метрика, что у гейта `useNeedsOnboarding`).
 * Показывается: level-strip, header Tux+LinuxExam, Hero («Начните путь к RHCSA»,
 * числа банка и реестра, одна большая CTA старта) и блок «Внутри вас ждет»
 * (4 возможности, SVG-иконки). Скрыто: Exam mode, аналитика, повтор ошибок,
 * программа RHCSA, retention-зона (бейдж серии и «0 / 30 XP»), прогресс
 * «0 из 253», дисклеймер Red Hat и нативный MainButton.
 *
 * Нулей и юридических текстов на первом экране нет. Единственная строка с нулём,
 * оставленная осознанно, — level-strip «Новичок · 0 / 50 XP до Ученика» (A1
 * задания: «верхняя панель без изменений»).
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

  it('до первого ответа: Hero с конкретикой и ОДНА CTA, программа и Exam скрыты', async () => {
    renderDashboard();
    await flushInitialization();

    // Hero: заголовок, подзаголовок с числами банка и реестра, одна большая CTA.
    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Начните путь к RHCSA' })
    ).toBeTruthy();
    expect(screen.getByTestId('dashboard-hero-subtitle').textContent).toMatch(
      /^\d+ вопрос\S* · \d+ тем\S* · по официальным objectives$/
    );

    const start = screen.getByTestId('start-learning');
    expect(start.textContent).toContain('Начать первый вопрос');
    // Счётчика тем у Hero нет: «14 тем» переехало в подзаголовок как обещание,
    // а не как правая подпись кнопки.
    expect(start.textContent).not.toMatch(/\d+ тем/);

    // «Внутри вас ждет»: ровно 4 возможности, иконки — SVG (эмодзи запрещены
    // контрактом, tell `slop-emoji-as-icon`).
    const features = screen.getByTestId('dashboard-features');
    expect(features.querySelectorAll('li')).toHaveLength(4);
    expect(features.querySelectorAll('svg')).toHaveLength(4);

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

  it('нулей и юртекстов нет: серия, дневной XP, прогресс и дисклеймер скрыты', async () => {
    renderDashboard();
    await flushInitialization();

    // Узлы, показывавшие ноль: заглушка серии, бейдж серии («0 дней»), дневная
    // полоса XP («0 / 30 XP») вместе со всей retention-зоной и прогресс банка
    // («0 из 253»).
    for (const hidden of [
      'streak-placeholder',
      'streak-badge',
      'dashboard-retention',
      'xp-bar',
      'dashboard-progress',
    ]) {
      expect(screen.queryByTestId(hidden), `в fresh mode не должно быть ${hidden}`).toBeNull();
    }
    // Дисклеймер опознаётся атрибутом, а не testid: он остаётся в продукте для
    // возвращающегося профиля и скрыт только здесь (решение капитана на STOP-точке).
    expect(document.querySelector('[data-disclaimer="legal"]')).toBeNull();

    // Уровень «Новичок» и «0 / 50 XP до Ученика» — та же полоса, что у обычного
    // профиля: режим скрывает блоки-нули, а не переизобретает status-strip.
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
      'dashboard-retention',
      'dashboard-progress',
      'dashboard-continue',
    ]) {
      expect(screen.getByTestId(visible), `после ответа должен вернуться ${visible}`).toBeTruthy();
    }
    expect(screen.queryByTestId('streak-placeholder')).toBeNull();
    expect(screen.queryByTestId('start-learning')).toBeNull();
    // Hero и «Внутри вас ждет» — принадлежность fresh mode, а не экрана вообще.
    expect(screen.queryByTestId('dashboard-hero')).toBeNull();
    expect(screen.queryByTestId('dashboard-features')).toBeNull();
    // Дисклеймер возвращается вместе с обычным Dashboard.
    expect(document.querySelector('[data-disclaimer="legal"]')).toBeTruthy();
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
    // Подпись и счётчик у этой ветки прежние: Hero — принадлежность fresh mode.
    expect(screen.getByTestId('start-learning').textContent).toContain('Начать обучение');
    expect(screen.getByTestId('start-learning').textContent).toMatch(/\d+ тем/);
    expect(screen.queryByTestId('dashboard-hero')).toBeNull();
    expect(screen.queryByTestId('dashboard-features')).toBeNull();
    expect(screen.getByTestId('dashboard-topics')).toBeTruthy();
    expect(screen.getByTestId('exam-mode')).toBeTruthy();
  });
});
