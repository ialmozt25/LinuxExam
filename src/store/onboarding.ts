import { useSyncExternalStore } from 'react';
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
 */
export function useNeedsOnboarding(): boolean {
  const hasCompletedOnboarding = useQuizStore((s) => s.hasCompletedOnboarding);
  const statsCount = useQuizStore((s) => Object.keys(s.questionStats).length);

  return !hasCompletedOnboarding && statsCount === 0;
}

/**
 * Ответы демо-квиза — session-only канал.
 *
 * Осознанно НЕ поле стора: spec 060 требует, чтобы демо не попадало ни в
 * `questionStats`, ни в персист-состояние, а хранить его в `QuizState` ради
 * передачи между двумя экранами значило бы завести поле, которое нельзя
 * персистить (ровно тот класс ошибок, от которого предостерегает
 * `.project/ORCH-RULES.md` §16 про session-only).
 *
 * Один подписчик — экран результата; демо-квиз только пишет.
 */
export type DemoAnswer = { isCorrect: boolean };

let demoAnswers: readonly DemoAnswer[] = [];
const listeners = new Set<() => void>();

/** Записывает ответы завершённого демо-квиза (вызывает экран демо). */
export function setDemoAnswers(next: readonly DemoAnswer[]): void {
  demoAnswers = [...next];
  for (const listener of listeners) listener();
}

/** Сбрасывает канал — для тестов и повторного прохождения онбординга. */
export function clearDemoAnswers(): void {
  setDemoAnswers([]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): readonly DemoAnswer[] {
  return demoAnswers;
}

/** Читает ответы демо-квиза на экране итога. */
export function useDemoAnswers(): readonly DemoAnswer[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
