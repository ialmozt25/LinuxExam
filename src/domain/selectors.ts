import { Question, Topic } from '@/data/models/Question';

/**
 * Pure selector functions — zero Zustand/React imports.
 */

export function filterByTopic(questions: Question[], topic: Topic): Question[] {
  return questions.filter((q) => q.topic === topic);
}

export function getCurrentQuestion(questions: Question[], index: number): Question | null {
  if (index < 0 || index >= questions.length) return null;
  return questions[index];
}
