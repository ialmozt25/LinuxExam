import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Dashboard from '@/presentation/screens/Dashboard';
import { useQuizStore } from '@/store/quizStore';

/**
 * Fresh User Mode: продающий первый экран (задание «Fresh Dashboard»).
 *
 * Условие режима — `isFreshUser = hasNoHistory`, то есть пустая `questionStats`:
 * это ровно состояние первого запуска. Флаг `hasCompletedOnboarding` из условия
 * УБРАН заданием «удалить демо-квиз»: выставлялся он только на удалённом
 * демо-экране, поэтому оставленный флаг сделал бы режим недостижимым навсегда.
 * Показывается: header Tux+LinuxExam с переключателем темы, карточка прогресса
 * (круговой уровень, серия, «0 / 50 XP до Ученика», «0 XP сегодня»), полоса банка
 * «Всего изучено 0 из 253», Hero («Начните путь к RHCSA», числа банка и реестра,
 * одна большая CTA старта) и блок «Внутри вас ждет» (4 возможности, SVG-иконки).
 * Скрыто: Exam mode, аналитика, повтор ошибок, программа RHCSA, retention-зона
 * (бейдж серии и «0 / 30 XP» — узлы сняты заданием «редизайн верхней части
 * Dashboard»), дисклеймер Red Hat и нативный MainButton.
 *
 * Нулей СЕРИИ и дневной цели на первом экране нет: вместо «0 дней» карточка
 * показывает «Начни серию сегодня». Уровневый ноль («0 / 50 XP до Ученика») и
 * полоса банка («0 из 253») оставлены осознанно — решение капитана 2026-10-08
 * (полоса банка показывается всем профилям, включая fresh).
 *
 * Проверяется пара состояний — «до первого ответа» и «после него» — плюс
 * независимость режима от флага онбординга.
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
    // Флаг онбординга в условии режима больше не участвует (демо удалено), но
    // остаётся частью persist-контракта — держим его как у обычного профиля.
    hasCompletedOnboarding: true,
    // Дневная цель уже зафиксирована дефолтом: пикера в потоке нет.
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

  it('нулей серии и дневного XP нет: retention-зона и её узлы скрыты', async () => {
    renderDashboard();
    await flushInitialization();

    // Узлы, показывавшие ноль: заглушка серии, бейдж серии («0 дней») и дневная
    // полоса XP («0 / 30 XP») вместе со всей retention-зоной. Полосы банка в списке
    // больше НЕТ: решением капитана (2026-10-08) «0 из 253» показывается и свежему
    // профилю — она стала частью нового единства экрана (карточка + полоса + одна
    // CTA). Её видимость во Fresh проверяется ниже и в `e2e/onboarding.spec.ts`.
    for (const hidden of [
      'streak-placeholder',
      'streak-badge',
      'dashboard-retention',
      'xp-bar',
    ]) {
      expect(screen.queryByTestId(hidden), `в fresh mode не должно быть ${hidden}`).toBeNull();
    }
    // Дисклеймер опознаётся атрибутом, а не testid: он остаётся в продукте для
    // возвращающегося профиля и скрыт только здесь (решение капитана на STOP-точке).
    expect(document.querySelector('[data-disclaimer="legal"]')).toBeNull();

    // Уровень «Новичок» и «0 / 50 XP до Ученика» — та же карточка прогресса, что у
    // обычного профиля: режим скрывает блоки-нули серии и дневной цели, а не
    // переизобретает верхнюю панель.
    expect(screen.getByText('Новичок')).toBeTruthy();
    expect(screen.getByText(/0 \/ 50 XP до Ученика/)).toBeTruthy();
    // Новая пара узлов видна и свежему профилю: карточка с приглашением к серии и
    // полоса банка с нулевым прогрессом (решение капитана 2026-10-08).
    expect(screen.getByTestId('dashboard-progress-card')).toBeTruthy();
    expect(screen.getByTestId('dashboard-streak').textContent).toContain(
      'Начни серию сегодня'
    );
    expect(screen.getByTestId('dashboard-progress').textContent).toContain('0 из');
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
      'dashboard-progress-card',
      'dashboard-streak',
      'dashboard-progress',
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

  it('режим не зависит от флага онбординга: флаг осиротел вместе с демо', async () => {
    act(() => {
      useQuizStore.setState({ hasCompletedOnboarding: false });
    });
    renderDashboard();
    await flushInitialization();

    // Единственный источник режима — пустая `questionStats`. Раньше
    // `hasCompletedOnboarding` был вторым слагаемым условия, но выставлялся он
    // только на демо-экране: после его удаления оставленный флаг сделал бы Fresh
    // User Mode недостижимым. Поэтому профиль без ответов обязан видеть Hero и при
    // `hasCompletedOnboarding: false` — иначе первый запуск показывал бы полный
    // Dashboard вместо Hero.
    expect(screen.getByTestId('dashboard-hero')).toBeTruthy();
    expect(screen.getByTestId('dashboard-features')).toBeTruthy();
    expect(screen.getByTestId('start-learning').textContent).toContain('Начать первый вопрос');
    // Ветка «Начать обучение» со скроллом к темам недостижима: списка тем нет.
    expect(screen.queryByTestId('dashboard-topics')).toBeNull();
    expect(screen.queryByTestId('exam-mode')).toBeNull();
  });
});
