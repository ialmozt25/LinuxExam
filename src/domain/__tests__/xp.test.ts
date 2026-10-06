import { describe, it, expect } from 'vitest';
import {
  LEVEL_STEP,
  LEVEL_THRESHOLDS,
  STREAK_MILESTONES,
  XP_EXAM_COMPLETE,
  XP_FIRST_ANSWER_OF_DAY,
  XP_REGULAR_CORRECT,
  XP_REGULAR_WRONG,
  XP_REVIEW_CORRECT,
  XP_REVIEW_WRONG,
  applyXpGain,
  levelFromXp,
  streakMilestoneXp,
  xpForAnswer,
  xpInLevel,
  xpThresholdForLevel,
  type AnswerStream,
} from '@/domain/xp';

/**
 * Контракт XP-механики на доменном слое: таблица начисления, вехи серии, шкала
 * уровней и ленивый ролловер дня.
 */

describe('xpForAnswer — таблица начисления', () => {
  it('regular: верный +3, неверный +1', () => {
    expect(xpForAnswer('regular', true)).toBe(3);
    expect(xpForAnswer('regular', false)).toBe(1);
    expect(XP_REGULAR_CORRECT).toBe(3);
    expect(XP_REGULAR_WRONG).toBe(1);
  });

  it('review: верный +2, неверный +1', () => {
    expect(xpForAnswer('review', true)).toBe(2);
    expect(xpForAnswer('review', false)).toBe(1);
    expect(XP_REVIEW_CORRECT).toBe(2);
    expect(XP_REVIEW_WRONG).toBe(1);
  });

  it('exam: за ответы не платит НИЧЕГО — платит завершение прогона', () => {
    expect(xpForAnswer('exam', true)).toBe(0);
    expect(xpForAnswer('exam', false)).toBe(0);
    expect(XP_EXAM_COMPLETE).toBe(10);
  });

  it('повторение дешевле нового ответа: верный ответ в review стоит меньше regular', () => {
    expect(xpForAnswer('review', true)).toBeLessThan(xpForAnswer('regular', true));
  });

  it('таблица покрывает весь тип потока (ни один поток не «забыт»)', () => {
    const streams: AnswerStream[] = ['regular', 'review', 'exam'];
    for (const stream of streams) {
      expect(Number.isFinite(xpForAnswer(stream, true))).toBe(true);
      expect(Number.isFinite(xpForAnswer(stream, false))).toBe(true);
    }
  });
});

describe('streakMilestoneXp — вехи серии', () => {
  it('3 / 7 / 14 / 30 → +15 / +50 / +100 / +200', () => {
    expect(streakMilestoneXp(3)).toBe(15);
    expect(streakMilestoneXp(7)).toBe(50);
    expect(streakMilestoneXp(14)).toBe(100);
    expect(streakMilestoneXp(30)).toBe(200);
    expect(STREAK_MILESTONES).toEqual({ 3: 15, 7: 50, 14: 100, 30: 200 });
  });

  it('не-веха даёт 0: дни 1, 2, 4, 6, 8, 15, 29, 31', () => {
    for (const streak of [0, 1, 2, 4, 6, 8, 15, 29, 31, 100]) {
      expect(streakMilestoneXp(streak)).toBe(0);
    }
  });

  it('веха — функция от нового значения серии: достигнутая повторно платит снова', () => {
    // Серия 3 (первое достижение) и серия 3 после сброса разрывом — одно и то же
    // значение, значит одинаковый бонус. Никакого «один раз в жизни профиля».
    expect(streakMilestoneXp(3)).toBe(streakMilestoneXp(3));
  });

  it('битый вход (NaN, отрицательное, дробное) не выдумывает бонус', () => {
    expect(streakMilestoneXp(Number.NaN)).toBe(0);
    expect(streakMilestoneXp(-3)).toBe(0);
    expect(streakMilestoneXp(2.9)).toBe(0);
    expect(streakMilestoneXp(3.9)).toBe(15);
  });
});

describe('levelFromXp / xpThresholdForLevel — шкала уровней', () => {
  it('пороги 100 / 250 / 500 / 800 / 1200, дальше +400', () => {
    expect(LEVEL_THRESHOLDS).toEqual([100, 250, 500, 800, 1200]);
    expect(LEVEL_STEP).toBe(400);
    expect(xpThresholdForLevel(1)).toBe(0);
    expect(xpThresholdForLevel(2)).toBe(100);
    expect(xpThresholdForLevel(3)).toBe(250);
    expect(xpThresholdForLevel(4)).toBe(500);
    expect(xpThresholdForLevel(5)).toBe(800);
    expect(xpThresholdForLevel(6)).toBe(1200);
    expect(xpThresholdForLevel(7)).toBe(1600);
    expect(xpThresholdForLevel(8)).toBe(2000);
    expect(xpThresholdForLevel(9)).toBe(2400);
  });

  it('уровень меняется ровно на пороге и не меняется на пороге − 1', () => {
    const thresholds: Array<[number, number]> = [
      [100, 2],
      [250, 3],
      [500, 4],
      [800, 5],
      [1200, 6],
      [1600, 7],
    ];
    for (const [xp, level] of thresholds) {
      expect(levelFromXp(xp - 1)).toBe(level - 1);
      expect(levelFromXp(xp)).toBe(level);
    }
  });

  it('0 XP → уровень 1; уровень не убывает с ростом XP', () => {
    expect(levelFromXp(0)).toBe(1);
    let prev = 0;
    for (let xp = 0; xp <= 2500; xp += 7) {
      const level = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  it('битый вход не ломает шкалу (NaN, отрицательное, дробное)', () => {
    expect(levelFromXp(Number.NaN)).toBe(1);
    expect(levelFromXp(-500)).toBe(1);
    expect(levelFromXp(99.9)).toBe(1);
    expect(levelFromXp(100.5)).toBe(2);
  });
});

describe('xpInLevel — прогресс внутри уровня', () => {
  it('внутри первого уровня current/needed — это XP / 100', () => {
    expect(xpInLevel(0)).toEqual({ current: 0, needed: 100, percent: 0 });
    expect(xpInLevel(40)).toEqual({ current: 40, needed: 100, percent: 40 });
  });

  it('на уровне 2 «нужно» — это шаг уровня, а не абсолютный порог', () => {
    // 100…249: шаг 150 (250 − 100).
    expect(xpInLevel(100)).toEqual({ current: 0, needed: 150, percent: 0 });
    expect(xpInLevel(175)).toEqual({ current: 75, needed: 150, percent: 50 });
    expect(xpInLevel(249)).toEqual({ current: 149, needed: 150, percent: (149 / 150) * 100 });
  });

  it('на верхнем пороге списка уровень переключается и счёт начинается заново', () => {
    expect(xpInLevel(1200)).toEqual({ current: 0, needed: 400, percent: 0 });
    expect(xpInLevel(1400)).toEqual({ current: 200, needed: 400, percent: 50 });
  });

  it('инварианты на всей шкале: current < needed, percent ∈ [0, 100], без NaN', () => {
    for (let xp = 0; xp <= 3000; xp += 13) {
      const { current, needed, percent } = xpInLevel(xp);
      expect(needed).toBeGreaterThan(0);
      expect(current).toBeGreaterThanOrEqual(0);
      expect(current).toBeLessThan(needed);
      expect(percent).toBeGreaterThanOrEqual(0);
      expect(percent).toBeLessThan(100);
      expect(Number.isNaN(percent)).toBe(false);
    }
  });

  it('битый вход не даёт NaN и отрицательных значений', () => {
    expect(xpInLevel(Number.NaN)).toEqual({ current: 0, needed: 100, percent: 0 });
    expect(xpInLevel(-40)).toEqual({ current: 0, needed: 100, percent: 0 });
  });
});

describe('applyXpGain — начисление и ленивый ролловер дня', () => {
  const today = '2026-03-10';
  const yesterday = '2026-03-09';

  it('тот же день: складывает и totalXp, и todayXp', () => {
    const patch = applyXpGain({ totalXp: 100, todayXp: 6, todayXpDate: today }, 3, today);
    expect(patch).toEqual({ totalXp: 103, todayXp: 9, todayXpDate: today });
  });

  it('новый день: todayXp начинается заново, totalXp продолжает копиться', () => {
    const patch = applyXpGain({ totalXp: 100, todayXp: 40, todayXpDate: yesterday }, 3, today);
    expect(patch).toEqual({ totalXp: 103, todayXp: 3, todayXpDate: today });
  });

  it('маркера нет (свежий профиль): todayXp считается с нуля', () => {
    const patch = applyXpGain({ totalXp: 0, todayXp: 40, todayXpDate: null }, 10, today);
    expect(patch).toEqual({ totalXp: 10, todayXp: 10, todayXpDate: today });
  });

  it('totalXp не убывает: отрицательное и NaN-начисление ничего не вычитают', () => {
    const base = { totalXp: 50, todayXp: 0, todayXpDate: today };
    expect(applyXpGain(base, -30, today).totalXp).toBe(50);
    expect(applyXpGain(base, Number.NaN, today).totalXp).toBe(50);
  });

  it('битый персист (отрицательный totalXp) не создаёт отрицательный счётчик', () => {
    const patch = applyXpGain({ totalXp: -50, todayXp: -5, todayXpDate: today }, 3, today);
    expect(patch).toEqual({ totalXp: 3, todayXp: 3, todayXpDate: today });
  });

  it('первый ответ дня: +10 идёт в оба счётчика', () => {
    expect(XP_FIRST_ANSWER_OF_DAY).toBe(10);
    const patch = applyXpGain({ totalXp: 0, todayXp: 0, todayXpDate: null }, XP_FIRST_ANSWER_OF_DAY, today);
    expect(patch.totalXp).toBe(10);
    expect(patch.todayXp).toBe(10);
  });
});
