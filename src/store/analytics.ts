import { useQuizStore } from '@/store/quizStore';
import {
  overallReadiness,
  recentTrend,
  topicReadiness,
  weakTopics,
  type StatsByQuestion,
  type Trend,
  type WeakTopic,
} from '@/domain/analytics';
import type { Question } from '@/data/models/Question';
import { TOPICS } from '@/data/topics';

/**
 * Analytics selector (spec 058) — ВНЕ persist.
 *
 * Ничего не добавляется в `partialize`: агрегат выводится на каждом рендере из
 * уже персистируемых `questionStats` и загруженного банка, поэтому в
 * localStorage не появляется новое поле (и не нужен бамп версии persist).
 *
 * `now` — аргумент, а не вызов `Date.now()` внутри: хук остаётся детерминированным
 * для вызывающего, а «текущее время» не превращается в состояние стора (иначе
 * оно попало бы в persist и снова стало self-referential).
 */
export interface AnalyticsSnapshot {
  /** Готовность по банку, 0..1. */
  overall: number;
  /** Готовность по каждой теме реестра (ключ — слаг), 0..1. */
  byTopic: Record<string, number>;
  weak: WeakTopic[];
  trend: Trend;
  /** Ответов в `questionStats` нет вовсе — экран показывает пустое состояние. */
  isEmpty: boolean;
}

export function useAnalytics(now: number, topN = 3): AnalyticsSnapshot {
  const bank: Question[] = useQuizStore((s) => s.questions);
  const questionStats = useQuizStore((s) => s.questionStats);

  const stats: StatsByQuestion = questionStats;
  const byTopic: Record<string, number> = {};
  for (const topic of TOPICS) {
    byTopic[topic.key] = topicReadiness(stats, bank, topic.key);
  }

  const isEmpty = Object.keys(questionStats).length === 0;

  return {
    overall: overallReadiness(stats, bank),
    byTopic,
    weak: weakTopics(stats, bank, topN),
    trend: recentTrend(stats, now),
    isEmpty,
  };
}
