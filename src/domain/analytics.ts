import type { Question, Topic } from '@/data/models/Question';
import { TOPICS } from '@/data/topics';

/**
 * Analytics core (spec 058) — чистые функции, ноль импортов zustand/react.
 *
 * Вход — то, что уже лежит в persist-состоянии стора (`questionStats`), выход —
 * числа для экрана «персональный тренер» (radar, готовность, слабые темы,
 * тренд). Время (`now`) всегда аргумент: результат детерминирован, а значит
 * проверяем unit-тестами без подмены системных часов.
 *
 * Модель готовности: `readiness = accuracy × coverage`.
 *  - `accuracy` — доля верных попыток в теме (качество ответов);
 *  - `coverage` — доля вопросов темы, до которых пользователь дотянулся
 *    (широта охвата).
 * Так «3 вопроса на 100 %» не выглядят как готовность: accuracy = 1, но
 * coverage мала, и тема честно остаётся слабой.
 */

/** Структурно совместим с `QuestionStat` из стора (лишнее поле `lastAt` допустимо). */
export interface TopicStat {
  attempts: number;
  correct: number;
  /** ISO-8601 последнего ответа. Нужен только тренду за 7 дней. */
  lastAt?: string;
}

/** Статистика по qid — та же форма, что `questionStats` в сторе. */
export type StatsByQuestion = Record<string, TopicStat>;

export interface WeakTopic {
  slug: string;
  label: string;
  /** Готовность темы, 0..1. */
  score: number;
}

export interface Trend {
  /** Ответы в свежей половине окна. */
  answered: number;
  /** Из них верных. */
  correct: number;
  /**
   * Изменение accuracy свежей половины относительно предыдущей, в процентах.
   * `null` — в предыдущей половине не было ответов: сравнивать не с чем
   * («нет базы», а не «0 %»).
   */
  deltaPct: number | null;
}

const DAY_MS = 86_400_000;

/** Заголовок темы из реестра `TOPICS`; вне реестра — сам слаг. */
function labelFor(slug: string): string {
  return (TOPICS.find((t) => t.key === slug) as { title?: string } | undefined)?.title ?? slug;
}

/** Число в [0, ∞) или 0: защита от NaN/Infinity/отрицательных входов. */
function safeNumber(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isTopic(question: Question, slug: string): boolean {
  return String(question.topic) === slug;
}

/**
 * Готовность одной темы, 0..1. Никогда не NaN: пустая тема (нет вопросов в
 * банке) и нулевые попытки дают 0.
 */
export function topicReadiness(
  stats: StatsByQuestion,
  bank: Question[],
  slug: string
): number {
  const questions = bank.filter((q) => isTopic(q, slug));
  if (questions.length === 0) return 0;

  let attempts = 0;
  let correct = 0;
  let answeredQuestions = 0;
  for (const question of questions) {
    const stat = stats[question.id];
    if (!stat) continue;
    const questionAttempts = safeNumber(stat.attempts);
    if (questionAttempts > 0) answeredQuestions += 1;
    attempts += questionAttempts;
    correct += Math.min(safeNumber(stat.correct), questionAttempts);
  }

  if (attempts === 0) return 0;
  const accuracy = correct / attempts;
  const coverage = answeredQuestions / questions.length;
  return accuracy * coverage;
}

/**
 * Готовность по всему банку, 0..1: среднее `topicReadiness` по темам банка,
 * взвешенное размером темы (крупная тема влияет сильнее). Пустой банк → 0.
 */
export function overallReadiness(stats: StatsByQuestion, bank: Question[]): number {
  if (bank.length === 0) return 0;

  const slugs = new Set(bank.map((q) => String(q.topic)));
  let weighted = 0;
  for (const slug of slugs) {
    const size = bank.filter((q) => isTopic(q, slug)).length;
    weighted += topicReadiness(stats, bank, slug) * size;
  }
  return weighted / bank.length;
}

/**
 * Слабые темы, от худшей к лучшей, срез до `topN`. Ничья разрешается по слагу,
 * поэтому порядок детерминирован. Темы вне банка не попадают в список: они дают
 * score 0 без данных, и «слабая тема» из пустоты вводила бы в заблуждение.
 */
export function weakTopics(
  stats: StatsByQuestion,
  bank: Question[],
  topN = 3
): WeakTopic[] {
  if (bank.length === 0 || topN <= 0) return [];

  const slugs = Array.from(new Set(bank.map((q) => String(q.topic)))).sort();
  return slugs
    .map((slug) => ({ slug, label: labelFor(slug), score: topicReadiness(stats, bank, slug) }))
    .sort((a, b) => a.score - b.score || a.slug.localeCompare(b.slug))
    .slice(0, topN);
}

/** Доля верных попыток в половине окна; окно без ответов → `null`. */
function accuracyOf(half: { attempts: number; correct: number }): number | null {
  return half.attempts > 0 ? half.correct / half.attempts : null;
}

/**
 * Тренд за окно `days` (по умолчанию 7): окно делится на две половины —
 * свежую (последние `days/2` суток) и предыдущую. `answered`/`correct` считаются
 * по свежей половине, `deltaPct` — процентное изменение accuracy относительно
 * предыдущей. Записи с отсутствующим или невалидным `lastAt` игнорируются.
 */
export function recentTrend(stats: StatsByQuestion, now: number, days = 7): Trend {
  const recentHalf = { attempts: 0, correct: 0 };
  const previousHalf = { attempts: 0, correct: 0 };
  if (!Number.isFinite(now) || !Number.isFinite(days) || days <= 0) {
    return { answered: 0, correct: 0, deltaPct: null };
  }

  const windowStart = now - days * DAY_MS;
  const midpoint = now - (days * DAY_MS) / 2;

  for (const stat of Object.values(stats)) {
    if (!stat || typeof stat.lastAt !== 'string') continue;
    const at = Date.parse(stat.lastAt);
    if (!Number.isFinite(at) || at < windowStart || at > now) continue;

    const attempts = safeNumber(stat.attempts);
    const correct = Math.min(safeNumber(stat.correct), attempts);
    const half = at >= midpoint ? recentHalf : previousHalf;
    half.attempts += attempts;
    half.correct += correct;
  }

  const recent = accuracyOf(recentHalf);
  const previous = accuracyOf(previousHalf);
  const deltaPct =
    recent === null || previous === null || previous === 0
      ? null
      : Math.round(((recent - previous) / previous) * 100);

  return { answered: recentHalf.attempts, correct: recentHalf.correct, deltaPct };
}
