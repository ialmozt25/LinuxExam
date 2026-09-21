export type Topic = 'file_permissions' | 'file_management' | 'process_management';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface QuestionOption {
  text: string;
  correct: boolean;
}

export interface Question {
  readonly id: string;
  readonly topic: Topic;
  readonly difficulty: Difficulty;
  readonly question: string;
  readonly options: readonly QuestionOption[];
  readonly explanation: string;
}

export interface QuestionJson {
  id: string;
  topic: string;
  difficulty: string;
  question: string;
  options: { text: string; correct: boolean }[];
  explanation: string;
}

export function fromJson(raw: QuestionJson): Question {
  return {
    id: raw.id,
    topic: raw.topic as Topic,
    difficulty: raw.difficulty as Difficulty,
    question: raw.question,
    options: raw.options.map((o) => ({ text: o.text, correct: o.correct })),
    explanation: raw.explanation,
  };
}
