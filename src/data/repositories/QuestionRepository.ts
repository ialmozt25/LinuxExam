import { fromJson, Question, QuestionJson, Topic } from '@/data/models/Question';
import questionsData from '@/data/questions.json';

/**
 * Pure TypeScript repository — no React imports.
 * Loads questions from the bundled JSON file.
 *
 * TODO(screens): Wire into quiz UI screens in a later step.
 */
export class QuestionRepository {
  private readonly questions: Question[];

  constructor() {
    this.questions = (questionsData as QuestionJson[]).map(fromJson);
  }

  getAll(): Question[] {
    return [...this.questions];
  }

  getByTopic(topic: Topic): Question[] {
    return this.questions.filter((q) => q.topic === topic);
  }

  getById(id: string): Question | undefined {
    return this.questions.find((q) => q.id === id);
  }

  count(): number {
    return this.questions.length;
  }
}
