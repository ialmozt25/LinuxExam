import { fromJson, Question, QuestionJson, Topic } from '@/data/models/Question';
import { loadAll } from '@/data/questions';

/**
 * Pure TypeScript repository — no React imports.
 *
 * The bank is no longer a static import: it is fetched as per-topic chunks by the
 * lazy loader and mapped into the domain model once, on the first `load()`.
 * The accessors stay synchronous and read the in-memory snapshot, so every existing
 * caller keeps working after awaiting `load()`.
 *
 * TODO(screens): Wire into quiz UI screens in a later step.
 */
export class QuestionRepository {
  private questions: Question[] = [];
  private loadPromise: Promise<void> | null = null;

  /** Loads and maps the whole bank once; concurrent callers share one promise. */
  load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = loadAll()
        .then((raw) => {
          this.questions = raw.map((q: QuestionJson) => fromJson(q));
        })
        .catch((error) => {
          // Allow a retry on the next call instead of caching the failure forever.
          this.loadPromise = null;
          throw error;
        });
    }
    return this.loadPromise;
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
