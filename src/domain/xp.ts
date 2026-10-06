/**
 * XP-механика. Domain-слой: чистые функции, ноль импортов zustand/react
 * (правило слоя domain).
 *
 * Здесь живёт вся арифметика начисления и уровней; состояние (когда именно
 * начислять, что уже отвечено сегодня) остаётся в сторе. Одна таблица начисления
 * и одна шкала уровней на всё приложение — иначе UI и стор разошлись бы в
 * значениях, а расхождение читалось бы как «XP начисляется неправильно».
 */

/**
 * XP за ПЕРВЫЙ за день ответ на вопрос, обычный (regular) поток.
 *
 * Anti-farming живёт не здесь, а в сторе: вопрос дня — «это первый ответ на
 * ЭТОТ вопрос сегодня?», а на него домен ответить не может, он не знает истории.
 */
export const XP_REGULAR_CORRECT = 3;
export const XP_REGULAR_WRONG = 1;

/**
 * XP за первый за день ответ в review-потоке (повторение ошибок, тема,
 * «Повторить сегодня»). Верный ответ стоит дороже неверного и в повторении:
 * повторение — учёба, а не экзамен, но ошибка по-прежнему даёт меньше.
 */
export const XP_REVIEW_CORRECT = 2;
export const XP_REVIEW_WRONG = 1;

/**
 * Завершённый прогон Exam mode — за САМ ФАКТ завершения, а не за ответы
 * (ответы экзамена не платят ничего: `xpForAnswer('exam', …) === 0`).
 */
export const XP_EXAM_COMPLETE = 10;

/** Первый ответ дня: он же шаг серии, поэтому платит фиксированные +10. */
export const XP_FIRST_ANSWER_OF_DAY = 10;

/**
 * Вехи серии: порог дней → разовый XP. «Каждый раз при достижении» означает,
 * что это функция от НОВОГО значения серии, а не одноразовый флаг: серия,
 * сброшенная разрывом и снова дошедшая до 3, платит ещё раз.
 */
export const STREAK_MILESTONES: Readonly<Record<number, number>> = {
  3: 15,
  7: 50,
  14: 100,
  30: 200,
};

/**
 * Пороги уровней: XP, необходимый, чтобы ВОЙТИ в уровень 2, 3, 4, 5 и 6.
 * Уровень 1 — от 0 XP. Дальше шаг постоянный (`LEVEL_STEP`), поэтому список
 * конечен: 6-й уровень открывается на 1200, 7-й — на 1600, 8-й — на 2000.
 */
export const LEVEL_THRESHOLDS: readonly number[] = [100, 250, 500, 800, 1200];

/** Шаг уровней после последнего порога из `LEVEL_THRESHOLDS`. */
export const LEVEL_STEP = 400;

/**
 * Поток ответа. `exam` присутствует намеренно: экзамен — единственная воронка,
 * которая НЕ платит за ответ, и это должно читаться в типе, а не в комментарии
 * на месте вызова.
 */
export type AnswerStream = 'regular' | 'review' | 'exam';

/** Прогресс внутри уровня. `percent` — доля в процентах (0…100), не 0…1. */
export interface LevelProgress {
  /** Сколько XP набрано внутри текущего уровня (от 0). */
  current: number;
  /** Сколько XP нужно, чтобы закрыть текущий уровень целиком. */
  needed: number;
  /** `current / needed` в процентах, 0…100. */
  percent: number;
}

/** Приводит вход к конечному неотрицательному целому (защита от битого персиста). */
function nonNegativeInt(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** XP за один ответ: поток и верность. Экзамен не платит за ответы вообще. */
export function xpForAnswer(stream: AnswerStream, isCorrect: boolean): number {
  if (stream === 'exam') return 0;
  if (stream === 'review') return isCorrect ? XP_REVIEW_CORRECT : XP_REVIEW_WRONG;
  return isCorrect ? XP_REGULAR_CORRECT : XP_REGULAR_WRONG;
}

/** Бонус за достигнутую веху серии; 0 — серия не на вехе. */
export function streakMilestoneXp(streak: number): number {
  return STREAK_MILESTONES[nonNegativeInt(streak)] ?? 0;
}

/**
 * XP, с которого НАЧИНАЕТСЯ уровень `level` (уровень 1 — с 0 XP).
 * Уровни 2…6 заданы списком `LEVEL_THRESHOLDS`, дальше шаг постоянный.
 */
export function xpThresholdForLevel(level: number): number {
  const target = Math.max(1, nonNegativeInt(level));
  if (target <= 1) return 0;
  const index = target - 2;
  if (index < LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[index];
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return last + (target - (LEVEL_THRESHOLDS.length + 1)) * LEVEL_STEP;
}

/**
 * Уровень по накопленному XP: 0…99 → 1, 100…249 → 2, 250…499 → 3, 500…799 → 4,
 * 800…1199 → 5, 1200…1599 → 6, дальше каждые 400 XP.
 */
export function levelFromXp(totalXp: number): number {
  const xp = nonNegativeInt(totalXp);
  let level = 1;
  while (xp >= xpThresholdForLevel(level + 1)) level += 1;
  return level;
}

/**
 * Прогресс внутри текущего уровня. На входе — ЛЮБОЕ значение (в том числе
 * отрицательное или NaN от битого персиста): выход всегда согласован
 * (`current <= needed`, `percent` в 0…100), без NaN и деления на ноль.
 */
export function xpInLevel(totalXp: number): LevelProgress {
  const xp = nonNegativeInt(totalXp);
  const level = levelFromXp(xp);
  const start = xpThresholdForLevel(level);
  const needed = xpThresholdForLevel(level + 1) - start;
  const current = xp - start;
  return {
    current,
    needed,
    percent: needed > 0 ? Math.min(100, (current / needed) * 100) : 0,
  };
}

/** Состояние, к которому применяется начисление: ровно три персистируемых поля. */
export interface XpState {
  totalXp: number;
  todayXp: number;
  /** День (`YYYY-MM-DD`), к которому относится `todayXp`; `null` — счётчика нет. */
  todayXpDate: string | null;
}

/** Результат начисления: готовая часть патча стора. */
export interface XpPatch {
  totalXp: number;
  todayXp: number;
  todayXpDate: string;
}

/**
 * Начисляет `amount` XP: сначала ленивый ролловер дня, потом сложение.
 *
 * Ролловер здесь, а не только на гидратации, потому что сессия переживает
 * полночь: первое начисление нового дня обязано начать дневной счётчик заново,
 * а не продолжить вчерашний. `totalXp` не убывает никогда — `amount` только
 * неотрицательный, а `todayXp` при смене дня обнуляется, не вычитаясь.
 */
export function applyXpGain(state: XpState, amount: number, today: string): XpPatch {
  const gain = nonNegativeInt(amount);
  const base = state.todayXpDate === today ? nonNegativeInt(state.todayXp) : 0;
  return {
    totalXp: nonNegativeInt(state.totalXp) + gain,
    todayXp: base + gain,
    todayXpDate: today,
  };
}
