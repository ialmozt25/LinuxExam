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

/** Одна ступень лестницы: имя уровня и XP, с которого он начинается. */
export interface LevelStep {
  /** Имя уровня для UI: `Уровень {name}`, «Ты теперь {name}!». */
  name: string;
  /**
   * То же имя в РОДИТЕЛЬНОМ падеже: «N / M XP до {nameGenitive}». Отдельного
   * поля требует русский, а не UI: «до Ученик» неверно, и собрать падеж из
   * имени нельзя. Падеж известен заранее ровно один — родительный (единственная
   * фраза, где имя стоит после «до»), поэтому таблица и есть его источник.
   */
  nameGenitive: string;
  /** XP, с которого уровень начинается (включительно). */
  minXp: number;
}

/**
 * Лестница уровней RHCSA: имя + XP, с которого уровень начинается.
 *
 * Кривая намеренно «быстрая на старте»: шаги 50 → 100 → 200 → 350 → 500 → 800.
 * Первый уровень закрывается за пару ответов (прогресс виден сразу), а
 * Гранд-мастер — длинная цель: 2000 XP суммарно.
 *
 * Последний уровень ТЕРМИНАЛЬНЫЙ: следующего порога не существует, поэтому у
 * него `needed === null` (см. `xpInLevel`). Конечность — часть контракта:
 * прежняя шкала росла бесконечно (100/250/500/800/1200, дальше +400), и уровень
 * было нечем назвать.
 *
 * Список — единственный источник и порогов, и имён: UI читает имя отсюда, а не
 * собирает подпись на месте (иначе вторая копия лестницы разошлась бы с этой).
 */
export const LEVELS: readonly LevelStep[] = [
  { name: 'Новичок', nameGenitive: 'Новичка', minXp: 0 },
  { name: 'Ученик', nameGenitive: 'Ученика', minXp: 50 },
  { name: 'Практик', nameGenitive: 'Практика', minXp: 150 },
  { name: 'Специалист', nameGenitive: 'Специалиста', minXp: 350 },
  { name: 'Эксперт', nameGenitive: 'Эксперта', minXp: 700 },
  { name: 'Мастер', nameGenitive: 'Мастера', minXp: 1200 },
  { name: 'Гранд-мастер', nameGenitive: 'Гранд-мастера', minXp: 2000 },
];

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
  /**
   * Сколько XP нужно, чтобы закрыть текущий уровень целиком; `null` — уровня
   * больше нет (Гранд-мастер): следующего порога не существует, и числового
   * «сколько осталось» тоже нет. UI обязан проверять `needed !== null`.
   */
  needed: number | null;
  /** `current / needed` в процентах, 0…100; на верхнем уровне — 100. */
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

/** Уровень, в котором находится профиль: номер (1…7) и имя для UI. */
export interface Level {
  /** Номер уровня, 1…7 (индекс в `LEVELS` + 1). */
  number: number;
  /** Имя уровня из `LEVELS`. */
  name: string;
}

/** Индекс текущей ступени в `LEVELS` (0…`LEVELS.length − 1`) по накопленному XP. */
function levelIndexForXp(xp: number): number {
  let index = 0;
  for (let next = 1; next < LEVELS.length; next += 1) {
    if (xp < LEVELS[next].minXp) break;
    index = next;
  }
  return index;
}

/**
 * Уровень по накопленному XP: 0…49 → Новичок, 50…149 → Ученик, 150…349 →
 * Практик, 350…699 → Специалист, 700…1199 → Эксперт, 1200…1999 → Мастер,
 * 2000+ → Гранд-мастер (дальше не растёт — лестница конечна).
 *
 * На входе — ЛЮБОЕ значение (в том числе отрицательное или NaN от битого
 * персиста): всё, что ниже первого порога, читается как «Новичок».
 */
export function levelFromXp(totalXp: number): Level {
  const index = levelIndexForXp(nonNegativeInt(totalXp));
  return { number: index + 1, name: LEVELS[index].name };
}

/**
 * Прогресс внутри текущего уровня. На входе — ЛЮБОЕ значение (в том числе
 * отрицательное или NaN от битого персиста): выход всегда согласован
 * (`current >= 0`, `percent` в 0…100), без NaN и деления на ноль.
 *
 * На верхнем уровне (`needed === null`) `percent === 100`: следующего порога
 * нет, и полоса показывает «пройдено», а не «сколько до следующего».
 */
export function xpInLevel(totalXp: number): LevelProgress {
  const xp = nonNegativeInt(totalXp);
  const index = levelIndexForXp(xp);
  const start = LEVELS[index].minXp;
  const current = xp - start;
  const next = LEVELS[index + 1];
  if (next === undefined) return { current, needed: null, percent: 100 };
  const needed = next.minXp - start;
  return {
    current,
    needed,
    percent: Math.min(100, (current / needed) * 100),
  };
}

/**
 * Следующая ступень лестницы или `null` на верхнем уровне (Гранд-мастер).
 * Отдельная функция, а не поле в `Level`: подпись «до следующего» нужна только
 * прогрессу, а сам уровень про следующую ступень ничего не утверждает.
 */
export function nextLevel(totalXp: number): LevelStep | null {
  const next = LEVELS[levelIndexForXp(nonNegativeInt(totalXp)) + 1];
  return next === undefined ? null : next;
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
