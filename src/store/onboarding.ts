import { useQuizStore } from '@/store/quizStore';

/**
 * Онбординг-гейт (spec 060) — ВНЕ persist: производное значение, своего поля в
 * localStorage не заводит.
 *
 * Показываем онбординг **только новому пользователю**: недостаточно
 * `!hasCompletedOnboarding`, потому что у существующего пользователя, обновившегося
 * до версии persist 5, миграция выставит `hasCompletedOnboarding: false` — и он
 * получил бы онбординг после апдейта. Второй барьер — пустые `questionStats`:
 * статистика заполняется при первом же ответе, поэтому у любого, кто уже
 * тренировался, она непуста.
 *
 * Селекторы возвращают примитивы (`boolean` и `number`), так как каждый вызов
 * `Object.keys(...).length` — новое значение; подписка на объект перерисовывала бы
 * App на каждом рендере стора.
 *
 * Симметричное условие на Dashboard — Fresh User Mode: онбординг пройден, а
 * ответов всё ещё нет (`hasCompletedOnboarding && пустые questionStats`). Тот же
 * признак «есть ли у пользователя ответы», что и здесь: две копии одной проверки
 * разошлись бы на первом же изменении модели статистики.
 */
export function useNeedsOnboarding(): boolean {
  const hasCompletedOnboarding = useQuizStore((s) => s.hasCompletedOnboarding);
  const statsCount = useQuizStore((s) => Object.keys(s.questionStats).length);

  return !hasCompletedOnboarding && statsCount === 0;
}
