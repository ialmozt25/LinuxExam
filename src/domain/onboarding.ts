import type { Question } from '@/data/models/Question';

/**
 * Онбординг (spec 060) — чистые функции домена.
 *
 * Ничего не знает ни о store, ни о React: вход — банк и seed-строка, выход —
 * детерминированные вопросы и текст результата. Экранная обвязка живёт в
 * `src/presentation/screens/Onboarding*.tsx`.
 *
 * Детерминизм — не украшение: подборка вопросов обязана совпадать между рендерами,
 * reload'ами и тестами, поэтому `Math.random` здесь запрещён. Seed задаётся
 * строкой (`goalId`), то есть одна и та же цель всегда даёт одни и те же 3 вопроса.
 */

/** Цель подготовки, выбранная на первом экране онбординга. */
export interface OnboardingGoal {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

/** Три цели активации. Порядок — порядок показа карточек. */
export const ONBOARDING_GOALS: readonly OnboardingGoal[] = [
  {
    id: 'rhcsa',
    label: 'Сдать RHCSA',
    description: 'Готовлюсь к экзамену RHCSA с нуля или после перерыва',
  },
  {
    id: 'refresh',
    label: 'Освежить знания',
    description: 'Практикую Linux, чтобы не терять форму',
  },
  {
    id: 'interview',
    label: 'Пройти собеседование',
    description: 'Разбираю темы, которые спрашивают на интервью',
  },
];

/** Сколько вопросов показывает демо-квиз. */
export const DEMO_QUESTION_COUNT = 3;

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
 * Вопросы демо-квиза. Тот же `seed` на том же банке → те же qid.
 *
 * Вход не мутируется. Если вопросов в банке меньше `n` (в том числе 0) —
 * возвращается весь банк в исходном порядке: показывать меньше вопросов лучше,
 * чем падать на пустом банке.
 */
export function pickDemoQuestions(
  bank: readonly Question[],
  seed: string,
  n: number = DEMO_QUESTION_COUNT,
): Question[] {
  if (bank.length <= n) return [...bank];
  return demoIndices(bank.length, seed, n).map((i) => bank[i]);
}

/** Итог демо-квиза: счёт и персональное сообщение. */
export interface DemoResult {
  readonly correct: number;
  readonly total: number;
  readonly message: string;
}

/**
 * Итог по ответам демо-квиза. Границы 0/3 … 3/3 покрыты явно; пустой прогон
 * (банк не загрузился) даёт 0/0 и fallback-сообщение, а не NaN.
 *
 * `total` — число ОТВЕТОВ, а не длина банка: демо-квиз линейный и без фидбека,
 * поэтому итог считается ровно по тому, что пользователь успел ответить.
 */
export function computeDemoResult(
  answers: readonly { isCorrect: boolean }[],
): DemoResult {
  const total = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;

  if (total === 0) {
    return {
      correct,
      total,
      message: 'Вопросы ещё загружаются — начните тренировку на главном экране.',
    };
  }
  if (correct === total) {
    return {
      correct,
      total,
      message: `Отличное начало: ${correct} из ${total}. Осталось закрепить темпом.`,
    };
  }
  if (correct === 0) {
    return {
      correct,
      total,
      message: 'Это нормально: объяснения к каждому вопросу — в основном режиме.',
    };
  }
  return {
    correct,
    total,
    message: 'Хорошая база: разбор ошибок покажет, где теряются баллы.',
  };
}
