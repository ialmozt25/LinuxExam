/**
 * Exam mode (spec 054) — чистые функции домена.
 *
 * Ничего не знает ни о store, ни о React: вход — массив qid, ответы и карта
 * тем; выход — детерминированные числа. Экранная обвязка живёт в
 * `src/presentation/screens/Exam*.tsx`.
 *
 * Отличие от исторического инлайн-экзамена (20 вопросов / 30 минут, живёт в
 * `Question.tsx` через `examActive`): здесь конфигурируемые пресеты 30/60/90,
 * порог сдачи 70 % и разбор по темам. Оба пути сосуществуют — старый не тронут.
 */

/** Конфигурация прогона: сколько вопросов и сколько времени. */
export interface ExamConfig {
  count: 30 | 60 | 90;
  durationMs: number;
}

/** Статус прогона. */
export type ExamState = 'idle' | 'run' | 'done';

/** Один ответ экзамена: qid, выбранный индекс и его правильность. */
export interface ExamAnswer {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
}

/** Один шаг разбора по темам. */
export interface TopicBreakdown {
  topic: string;
  correct: number;
  total: number;
  percent: number;
}

/** Итог прогона. */
export interface ExamScore {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
}

/** Причина завершения прогона: истёк таймер или ответ на последний вопрос. */
export type ExamFinishReason = 'timeout' | 'manual';

/** Разрешённые пресеты: 30/30 мин, 60/60 мин, 90/120 мин. */
export const EXAM_PRESETS = [
  { count: 30, durationMs: 30 * 60 * 1000 },
  { count: 60, durationMs: 60 * 60 * 1000 },
  { count: 90, durationMs: 120 * 60 * 1000 },
] as const;

/** Порог сдачи — 70 % правильных. */
export const EXAM_PASS_THRESHOLD = 0.7;

/** Допустимые размеры прогона (для валидации входа). */
export const EXAM_COUNTS: ReadonlyArray<ExamConfig['count']> = [30, 60, 90];

/** Пресет по размеру; неизвестный размер → null. */
export function findPreset(count: number): ExamConfig | null {
  const preset = EXAM_PRESETS.find((p) => p.count === count);
  return preset ? { count: preset.count, durationMs: preset.durationMs } : null;
}

/**
 * Индексы выборки: детерминированная перестановка `0..allIds.length-1` по seed,
 * отрезанная до `count`. Один и тот же seed на том же банке даёт тот же набор —
 * поэтому прогон воспроизводим и тестируем без таймеров.
 *
 * Реализация — Fisher–Yates с mulberry32. Возвращаются ПОЗИЦИИ, а не id, чтобы
 * домен не зависел от формы банка; `pickExamQuestions` превращает их в qid.
 */
export function seededIndices(allIds: readonly string[], count: number, seed: number): number[] {
  const total = allIds.length;
  if (total === 0) return [];
  const wanted = Math.min(Math.max(0, Math.floor(count)), total);
  let state = (Math.floor(seed) >>> 0) || 0x9e3779b9;
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
 * Выборка вопросов экзамена: qid в порядке показа.
 * `count` больше банка → весь банк (перестановка всё равно детерминирована).
 */
export function pickExamQuestions(allIds: readonly string[], count: number, seed: number): string[] {
  return seededIndices(allIds, count, seed).map((i) => allIds[i]);
}

/**
 * Итог по ответам. `totalQuestions` — длина прогона (а не число данных ответов):
 * неотвеченный вопрос считается неверным, поэтому процент падает.
 * Пустой прогон даёт 0 %, а не NaN.
 */
export function scoreExam(answers: readonly ExamAnswer[], totalQuestions: number): ExamScore {
  const total = Math.max(0, Math.floor(totalQuestions));
  const seen = new Set<string>();
  let correct = 0;
  for (const answer of answers) {
    // Один вопрос = один ответ: повторная запись того же qid не удваивает счёт.
    if (seen.has(answer.questionId)) continue;
    seen.add(answer.questionId);
    if (answer.isCorrect) correct += 1;
  }
  const percent = total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
  return {
    correct,
    total,
    percent,
    passed: total > 0 && correct / total >= EXAM_PASS_THRESHOLD,
  };
}

/**
 * Разбор по темам. Темы берутся из банка (`questionsById`), поэтому qid вне
 * банка отбрасываются и не создают «фантомную» строку. Порядок строк —
 * по алфавиту темы, чтобы отчёт не зависел от порядка ответов.
 */
export function breakdownByTopic(
  answers: readonly ExamAnswer[],
  questionsById: Record<string, { topic: string }>,
): TopicBreakdown[] {
  const acc = new Map<string, { correct: number; total: number }>();
  const seen = new Set<string>();
  for (const answer of answers) {
    if (seen.has(answer.questionId)) continue;
    const question = questionsById[answer.questionId];
    if (!question) continue;
    seen.add(answer.questionId);
    const bucket = acc.get(question.topic) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (answer.isCorrect) bucket.correct += 1;
    acc.set(question.topic, bucket);
  }
  return [...acc.entries()]
    .map(([topic, { correct, total }]) => ({
      topic,
      correct,
      total,
      percent: total === 0 ? 0 : Math.round((correct / total) * 1000) / 10,
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
}

/** Остаток времени в мс (0, если таймер уже истёк или не запущен). */
export function remainingMs(
  startedAt: number | null,
  durationMs: number,
  now: number,
): number {
  if (startedAt === null) return 0;
  return Math.max(0, durationMs - (now - startedAt));
}

/** Остаток в формате HH:MM:SS (часы нужны: пресет 90 идёт 120 минут). */
export function formatRemaining(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.floor(ms)) : 0;
  const hours = Math.floor(safe / 3600000);
  const minutes = Math.floor((safe % 3600000) / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
