import type { Question } from '@/data/models/Question';

/**
 * Онбординг — чистые функции домена.
 *
 * Ничего не знает ни о store, ни о React: вход — банк, выход — детерминированные
 * вопросы и текст inline-фидбека. Экранная обвязка живёт в
 * `src/presentation/screens/OnboardingDemo.tsx`.
 *
 * Детерминизм — не украшение: подборка вопросов обязана совпадать между рендерами,
 * reload'ами и тестами, поэтому `Math.random` здесь запрещён. Seed задаётся
 * строковой константой (`DEMO_SEED`). До упрощения онбординга seed'ом была
 * выбранная цель (`goalId` удалённого экрана цели), поэтому строка сохранена
 * дословно: подборка остаётся воспроизводимой, просто одна и та же у всех.
 */

/** Сколько вопросов показывает демо-квиз. */
export const DEMO_QUESTION_COUNT = 3;

/**
 * Seed демо-подборки. Легаси-значение цели «onboarding» (см. комментарий модуля):
 * менять его нельзя без перегенерации baseline'ов, смысла в смене нет.
 */
export const DEMO_SEED = 'onboarding';

/**
 * FNV-1a хэш строки. Отдельная копия, а не импорт из `quizService`: домен
 * онбординга не должен зависеть от модуля с перемешиванием вариантов ответа
 * (`src/domain/fsrs.ts`, `exam.ts`, `analytics.ts` тоже не трогаются).
 */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Индекс демо-подборки: детерминированная перестановка `0..bank.length-1` по seed,
 * отрезанная до `n`. Fisher–Yates с mulberry32 — без `Math.random` и без опоры на
 * текущее время, поэтому результат воспроизводим в тестах и между перезагрузками.
 */
function demoIndices(size: number, seed: string, n: number): number[] {
  const total = size;
  if (total === 0) return [];
  const wanted = Math.min(Math.max(0, Math.floor(n)), total);
  // Нулевой хэш дал бы вырожденную последовательность: подставляем константу.
  let state = hashSeed(seed) || 0x9e3779b9;
  const nextRandom = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order.slice(0, wanted);
}

/**
 * Вопросы демо-квиза. Тот же банк → те же qid (seed фиксирован, см. `DEMO_SEED`).
 *
 * Вход не мутируется. Если вопросов в банке меньше `n` (в том числе 0) —
 * возвращается весь банк в исходном порядке: показывать меньше вопросов лучше,
 * чем падать на пустом банке.
 */
export function pickDemoQuestions(
  bank: readonly Question[],
  n: number = DEMO_QUESTION_COUNT,
): Question[] {
  if (bank.length <= n) return [...bank];
  return demoIndices(bank.length, DEMO_SEED, n).map((i) => bank[i]);
}

/**
 * Inline celebration демо-квиза: вердикт показывается СРАЗУ после ответа, а не
 * экраном-итогом (он удалён вместе с экраном «Готово · N из 3»). Тексты живут в
 * домене, а не в разметке: это контракт, который пинят и unit-, и e2e-тесты.
 */
export const DEMO_FEEDBACK_CORRECT = 'Отлично!';
export const DEMO_FEEDBACK_WRONG = 'Запомни — так тоже бывает';

/** Текст inline celebration по вердикту ответа. */
export function demoAnswerFeedback(isCorrect: boolean): string {
  return isCorrect ? DEMO_FEEDBACK_CORRECT : DEMO_FEEDBACK_WRONG;
}
