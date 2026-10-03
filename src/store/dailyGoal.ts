import { useQuizStore } from '@/store/quizStore';
import {
  computeDailyProgress,
  streakStateByActivity,
  DEFAULT_DAILY_GOAL_XP,
  type DailyProgress,
  type StreakState,
} from '@/domain/goal';

/**
 * Селекторы retention-зоны (spec 061) — ВНЕ стора: производные значения, своих
 * полей в localStorage не заводят (по прецеденту `useNeedsOnboarding`, spec 060).
 *
 * Подписка — на примитивы: `computeDailyProgress` возвращает новый объект на
 * каждый вызов, поэтому подписка на объект перерисовывала бы компонент на любом
 * изменении стора.
 *
 * `dailyGoalXp === null` (picker не пройден) читается как дефолт 20 XP — так
 * «на первом шаге default 20» (К6) виден и до подтверждения цели.
 */
export function useDailyGoalProgress(): DailyProgress {
  const todayXp = useQuizStore((s) => s.todayXp);
  const dailyGoalXp = useQuizStore((s) => s.dailyGoalXp);
  return computeDailyProgress(todayXp, dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP);
}

/** Сегодняшняя активность: active / warning / broken (см. `streakStateByActivity`). */
export function useStreakState(): StreakState {
  const todayXp = useQuizStore((s) => s.todayXp);
  const lastActiveDate = useQuizStore((s) => s.lastActiveDate);
  return streakStateByActivity(todayXp, lastActiveDate, new Date().toISOString().slice(0, 10));
}

/** Выбрана ли дневная цель: `null` — пользователь её ещё не подтверждал. */
export function useDailyGoalChosen(): boolean {
  return useQuizStore((s) => s.dailyGoalXp !== null);
}
