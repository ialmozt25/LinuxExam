import { useQuizStore } from '@/store/quizStore';
import { canAccessTopic } from '@/domain/paywall';

/**
 * Селекторы контентного paywall (spec 063) — ВНЕ стора, по прецеденту
 * `useNeedsOnboarding` (spec 060) и `useDailyGoalProgress` (spec 061): здесь
 * только производное значение, своих полей в localStorage модуль не заводит.
 *
 * Подписка — на примитивы (`isPro`, `trialStartedAt`), а не на объект: решение
 * `canAccessTopic` зависит ещё и от времени, поэтому объект-состояние, собранный
 * на каждом рендере, перерисовывал бы компонент на любом изменении стора.
 *
 * `now` берётся в момент рендера: trial истекает по календарю, и решение должно
 * пересчитываться при каждом заходе на Dashboard, а не кешироваться в сторе.
 */
export function useCanAccessTopic(slug: string): boolean {
  const isPro = useQuizStore((s) => s.isPro);
  const trialStartedAt = useQuizStore((s) => s.trialStartedAt);
  return canAccessTopic(slug, { isPro, trialStartedAt }, Date.now());
}
