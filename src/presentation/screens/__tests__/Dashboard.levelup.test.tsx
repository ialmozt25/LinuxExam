import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Dashboard from '@/presentation/screens/Dashboard';
import { useQuizStore } from '@/store/quizStore';

/**
 * Именованные уровни и празднование перехода на Dashboard.
 *
 * Пороги, имена и границы S-кривой проверяет домен
 * (`src/domain/__tests__/xp.test.ts`); здесь — только то, что экран их ПОКАЗЫВАЕТ
 * и что уведомление о новом уровне не залипает навсегда.
 *
 * Полосу ищем по `aria-label`, а не по роли: на Dashboard два `progressbar`
 * (уровень в status-strip и прогресс банка), и `getByRole` был бы неоднозначен.
 */

function renderDashboard() {
  return render(<Dashboard theme="light" onToggleTheme={() => {}} />);
}

function setupStore(totalXp: number) {
  useQuizStore.getState().loadQuestions();
  useQuizStore.setState({
    answers: [],
    currentIndex: 0,
    streak: 0,
    totalXp,
    pendingLevelUp: null,
  });
}

describe('Dashboard — имя уровня и прогресс внутри него', () => {
  it('свежий профиль: «Новичок» и «0 / 50 XP до Ученика»', () => {
    setupStore(0);
    renderDashboard();

    expect(screen.getByText('Новичок')).toBeInTheDocument();
    expect(screen.getByTestId('level-next').textContent).toBe('0 / 50 XP до Ученика');
    expect(screen.getByLabelText('Уровень Новичок, XP внутри 0%')).toBeInTheDocument();
  });

  it('порог 50: имя меняется на «Ученик», счёт внутри уровня начинается заново', () => {
    setupStore(50);
    renderDashboard();

    expect(screen.getByText('Ученик')).toBeInTheDocument();
    expect(screen.getByTestId('level-next').textContent).toBe('0 / 100 XP до Практика');
  });

  it('предпоследняя ступень: «Мастер» и 799 / 800 XP до Гранд-мастера', () => {
    setupStore(1999);
    renderDashboard();

    expect(screen.getByText('Мастер')).toBeInTheDocument();
    expect(screen.getByTestId('level-next').textContent).toBe('799 / 800 XP до Гранд-мастера');
  });

  it('Гранд-мастер: следующий уровень не обещается, полоса на 100 %', () => {
    setupStore(2000);
    renderDashboard();

    expect(screen.getByText('Гранд-мастер')).toBeInTheDocument();
    expect(screen.queryByTestId('level-next')).toBeNull();
    expect(screen.getByLabelText('Уровень Гранд-мастер, XP внутри 100%')).toBeInTheDocument();
  });
});

describe('Dashboard — празднование нового уровня', () => {
  beforeEach(() => {
    setupStore(50);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('без перехода уведомления нет', () => {
    renderDashboard();

    expect(screen.queryByTestId('level-up-toast')).toBeNull();
  });

  it('переход показывает «Ты теперь …!» и гасит уведомление по таймеру', () => {
    useQuizStore.setState({ pendingLevelUp: { toName: 'Ученик' } });
    vi.useFakeTimers();
    renderDashboard();

    expect(screen.getByText('Ты теперь Ученик!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Ты теперь Ученик!')).toBeNull();
    expect(useQuizStore.getState().pendingLevelUp).toBeNull();
  });
});

describe('Dashboard — переход взводится БОЕВЫМ начислением', () => {
  // Сквозная проверка той самой связки, которую задание называет `awardXp`:
  // реальный экшен начисления XP (recordQuestionStat — единственная воронка
  // ответов) обязан САМ поставить `pendingLevelUp`, а не только домен уметь
  // считать уровень. Без этого теста сравнение «номер до / номер после» внутри
  // `xpGainWithLevelUp` не покрыто ничем: домен проверен отдельно, отрисовка —
  // выше, а сама передача «событие из стора → экран» осталась бы на телефоне.
  it('ответ, поднявший уровень, ставит pendingLevelUp и рендерит toast', () => {
    // 49 XP — ровно ступень от Ученика (порог 50); верный regular-ответ стоит +3.
    setupStore(49);
    useQuizStore.setState({
      answeredToday: [],
      todayAnsweredDate: null,
      lastActiveDate: null,
      todayXp: 0,
      todayXpDate: null,
    });
    renderDashboard();

    expect(screen.queryByTestId('level-up-toast')).toBeNull();

    act(() => {
      useQuizStore.getState().recordQuestionStat('regular_001', true, 'regular');
    });

    // 49 + 3 (ответ) + 10 (первый ответ дня) — порог 50 перейдён, но уровень
    // по-прежнему Ученик: перескока нет, уведомление одно и о конечном уровне.
    expect(useQuizStore.getState().totalXp).toBeGreaterThanOrEqual(50);
    expect(useQuizStore.getState().pendingLevelUp).toEqual({ toName: 'Ученик' });
    expect(screen.getByText('Ты теперь Ученик!')).toBeInTheDocument();
  });
});
