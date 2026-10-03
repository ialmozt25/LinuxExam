import type { Question } from '@/data/models/Question';

/**
 * FSRS-lite — расписание повторений для кнопки «Повторить сегодня (N)».
 *
 * Упрощение против настоящего FSRS (см. spec 052, «Открытые вопросы»):
 * следующий интервал берётся из фиксированной сетки дней, а не из формулы
 * I(r, S) = S / FACTOR · (r^(1/DECAY) − 1). Шкалы полей записи — шкала спеки:
 * `stability` в днях, `difficulty` — нормированный `difficultyScore` ∈ [0,1],
 * который отображается на шкалу FSRS [1,10] формулами ниже.
 *
 * Слой domain: только чистые функции. Импортируется ОДИН тип (`import type`
 * стирается при транспиляции), поэтому рантайм-зависимостей от store/react нет.
 */

/** Базисная сетка интервалов, дни. Максимум сетки — 60 дней. */
export const BASE_INTERVALS = [1, 3, 7, 14, 30, 60] as const;

/** Оценка ответа: верный → Good, неверный → Again (оценок Hard/Easy нет). */
export type Grade = 'Good' | 'Again';

/** Дни в миллисекундах — единственное место, где эта константа определена. */
export const DAY_MS = 86400000;

/** Границы нормированных шкал спеки. */
export const MIN_STABILITY = 0.1;
export const MAX_STABILITY = 365;
export const MIN_DIFFICULTY = 0;
export const MAX_DIFFICULTY = 1;

/** Начальная stable-запись: день 1 и нормализованная сложность 0.3. */
export const INITIAL_STABILITY = 1;
export const INITIAL_DIFFICULTY = 0.3;

/** Запись расписания одного вопроса. `next` — epoch ms, `stability` — дни. */
export interface Scheduled {
  next: number;
  stability: number;
  difficulty: number;
}

/** Псевдоним из спеки («ReviewRecord»): та же запись расписания. */
export type ReviewRecord = Scheduled;

/**
 * История попыток одного вопроса — структурное подмножество `QuestionStat`
 * из store. Объявлено здесь отдельно, чтобы domain не тянул store даже типом.
 */
export interface QuestionHistory {
  attempts: number;
  correct: number;
  lastAt: string;
}

/** Шкала сложности спеки → шкала FSRS. `difficultyScore` не клампится здесь. */
export function fsrsDifficulty(difficultyScore: number): number {
  return 1 + 9 * difficultyScore;
}

/** Шкала FSRS → шкала сложности спеки. */
export function difficultyScoreOf(fsrsDifficultyValue: number): number {
  return (fsrsDifficultyValue - 1) / 9;
}

/**
 * NaN → нижняя граница `min` (запись не выбрасывается); +∞/−∞ и любой выход за
 * диапазон зажимаются к ближней границе — Math.min/Math.max сами обрабатывают ±∞.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Индекс шага сетки: `floor(log2(stability))`, зажатый в [0, 5].
 * stability ≤ 1 → шаг 1 день; stability ≥ 32 → шаг 60 дней.
 */
export function intervalIndex(stability: number): number {
  const s = Number.isFinite(stability) ? stability : MIN_STABILITY;
  const raw = Math.floor(Math.log2(Math.max(MIN_STABILITY, s)));
  return Math.min(BASE_INTERVALS.length - 1, Math.max(0, raw));
}

/**
 * Следующий интервал В ДНЯХ (1..60) для данной stability.
 * `grade` оставлен в сигнатуре как часть контракта-сетки: стабильность уже
 * отражает исход ответа (Good растёт, Again падает), поэтому отдельной ветки
 * по оценке нет.
 */
export function nextInterval(stability: number, _grade?: Grade): number {
  return BASE_INTERVALS[intervalIndex(stability)];
}

/**
 * Интервал как запись: `next` — epoch ms, плюс обе шкалы на момент расчёта.
 * Удобно там, где шкалы (`stabilityDays`/`difficultyScore`) нужны вызывающему
 * вместе с абсолютной датой следующего показа.
 */
export function nextIntervalRecord(
  stabilityDays: number,
  difficultyScore: number,
  now: number,
  grade?: Grade,
): { next: number; stabilityDays: number; difficultyScore: number } {
  const stability = clamp(stabilityDays, MIN_STABILITY, MAX_STABILITY);
  const difficulty = clamp(difficultyScore, MIN_DIFFICULTY, MAX_DIFFICULTY);
  return {
    next: now + nextInterval(stability, grade) * DAY_MS,
    stabilityDays: stability,
    difficultyScore: difficulty,
  };
}

/**
 * Пересчёт расписания после ответа.
 *
 * - нет записи (`current === null`) → стартовая stable-запись (день 1);
 * - `Good` → stability × 1.5 (не выше 365), difficulty − 0.05 (не ниже 0);
 * - `Again` → stability × 0.5 (не ниже 0.1), difficulty + 0.10 (не выше 1);
 * - `next` = now + шаг сетки; шаг всегда ≥ 1 день, поэтому после ответа
 *   `next > now` и вопрос сразу выходит из N.
 *
 * Невалидные (`NaN`) входные значения не выбрасывают запись: clamp прижимает
 * их к ближней границе.
 */
export function scheduleReview(
  current: Scheduled | null,
  grade: Grade,
  now: number,
): Scheduled {
  const base = current ?? { stability: INITIAL_STABILITY, difficulty: INITIAL_DIFFICULTY };
  // Вход зажимается ДО множителя: NaN прижимается к ближней границе (0.1 / 0),
  // Infinity прижимается к верхней (365 / 1) — запись никогда не выбрасывается.
  const stability = clamp(base.stability, MIN_STABILITY, MAX_STABILITY);
  const difficulty = clamp(base.difficulty, MIN_DIFFICULTY, MAX_DIFFICULTY);

  const raised = grade === 'Good' ? stability * 1.5 : stability * 0.5;
  const nextStability = clamp(raised, MIN_STABILITY, MAX_STABILITY);
  const nextDifficulty = clamp(
    grade === 'Good' ? difficulty - 0.05 : difficulty + 0.1,
    MIN_DIFFICULTY,
    MAX_DIFFICULTY,
  );

  return {
    stability: nextStability,
    difficulty: nextDifficulty,
    next: now + nextInterval(nextStability, grade) * DAY_MS,
  };
}

/** Запись сохраняет `next` только когда он валиден: null/NaN/строка → drop. */
export function isUsableRecord(record: unknown): record is Scheduled {
  if (typeof record !== 'object' || record === null) return false;
  const next = (record as { next?: unknown }).next;
  return typeof next === 'number' && Number.isFinite(next);
}

/**
 * Размер одной сессии повторения/изучения, вопросов.
 *
 * Один банк — 253 вопроса, и «повторить всё» одним прогоном не является
 * продуктовым действием: пользователь не проходит 253 вопроса за сессию.
 * Лимит живёт в domain-слое, чтобы store и экраны не заводили собственных
 * копий числа.
 */
export const SESSION_LIMIT = 30;

/**
 * Два пула прогона: то, что пользователь ещё не видел, и то, что пора
 * повторить.
 *
 * `newQuestions` — у вопроса НЕТ записи в реестре расписания (битая запись
 * считается отсутствующей: восстановить из неё нечего). `dueQuestions` — запись
 * есть и её `next <= now`.
 *
 * Идёт по банку (`all`), а не по реестру: только банк знает про вопрос, у
 * которого записи нет. Поэтому записи вне банка (чужой id, вопрос удалён из
 * банка) не попадают ни в один список — persisted-состояние при этом не
 * чистится. Пустой банк даёт `{ newQuestions: [], dueQuestions: [] }`, деления
 * на ноль нет.
 */
export function pickToday(
  scheduled: Record<string, ReviewRecord>,
  all: Question[],
  now: number,
): { newQuestions: string[]; dueQuestions: string[] } {
  const newQuestions: string[] = [];
  const dueQuestions: string[] = [];
  for (const question of all) {
    const record: unknown = scheduled[question.id];
    if (!isUsableRecord(record)) {
      newQuestions.push(question.id); // записи нет или она битая
      continue;
    }
    if (record.next <= now) dueQuestions.push(question.id);
  }
  return { newQuestions, dueQuestions };
}

/**
 * `ids`, отсортированные по убыванию просрочки (`now - next`): самый
 * запущенный вопрос идёт первым. Не создаёт копию, когда сортировать нечего.
 *
 * id без записи в список не попадают: у них нет `next`, а «просрочка» для них
 * не определена — их место в пуле новых вопросов (`pickToday`).
 */
export function sortByOverdue(
  scheduled: Record<string, ReviewRecord>,
  ids: string[],
  now: number,
): string[] {
  const overdueOf = (id: string): number => {
    const record: unknown = scheduled[id];
    return isUsableRecord(record) ? now - record.next : 0;
  };
  return ids.length < 2 ? ids : [...ids].sort((a, b) => overdueOf(b) - overdueOf(a));
}

/**
 * То же правило для одного лишь реестра расписания (без банка): id, у которых
 * нет записи, сюда попасть не могут — их знает только банк. Страховка для
 * «осиротевших» id вне банка не нужна: их отсекает сам `pickToday`.
 */
export function dueIds(scheduled: Record<string, ReviewRecord>, now: number): string[] {
  return Object.keys(scheduled).filter((id) => isUsableRecord(scheduled[id]) && scheduled[id].next <= now);
}

/**
 * Заполняет отсутствующие записи реестра «пора сейчас» (`next = now`).
 * Идемпотентно: существующие записи не трогаются, повторный вызов на полном
 * реестре возвращает тот же объект, что позволяет React-эффекту не зациклиться.
 *
 * Банк приходит аргументом (в persist-`migrate` он ещё не загружен), поэтому
 * миграция v3→v4 только создаёт пустой реестр, а наполнение идёт здесь.
 */
export function ensureRecords(
  scheduled: Record<string, ReviewRecord>,
  bankIds: readonly string[],
  now: number,
): Record<string, ReviewRecord> {
  let next = scheduled;
  for (const id of bankIds) {
    if (isUsableRecord(next[id])) continue;
    if (next === scheduled) next = { ...scheduled };
    next[id] = { next: now, stability: INITIAL_STABILITY, difficulty: INITIAL_DIFFICULTY };
  }
  return next;
}
