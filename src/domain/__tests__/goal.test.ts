import { describe, it, expect } from 'vitest';
import {
  DAILY_GOAL_OPTIONS,
  XP_ACCENT_THRESHOLD,
  XP_MARK_THRESHOLD,
  computeDailyProgress,
  messageColor,
  shiftIsoDate,
  stateColor,
  streakMessage,
  streakStateByActivity,
  xpBarColor,
} from '@/domain/goal';

describe('DAILY_GOAL_OPTIONS (spec 061)', () => {
  it('ровно три пресета 10 / 20 / 50', () => {
    expect(DAILY_GOAL_OPTIONS).toEqual([10, 20, 50]);
    expect(DAILY_GOAL_OPTIONS).toHaveLength(3);
  });
});

describe('computeDailyProgress', () => {
  it('0 / 20 → доля 0, цель не достигнута', () => {
    expect(computeDailyProgress(0, 20)).toEqual({
      todayXp: 0,
      goalXp: 20,
      ratio: 0,
      met: false,
    });
  });

  it('15 / 20 → доля 0.75, цель не достигнута', () => {
    expect(computeDailyProgress(15, 20)).toEqual({
      todayXp: 15,
      goalXp: 20,
      ratio: 0.75,
      met: false,
    });
  });

  it('20 / 20 → доля 1, цель достигнута', () => {
    expect(computeDailyProgress(20, 20)).toEqual({
      todayXp: 20,
      goalXp: 20,
      ratio: 1,
      met: true,
    });
  });

  it('25 / 20 → доля ограничена 1, цель достигнута', () => {
    expect(computeDailyProgress(25, 20)).toEqual({
      todayXp: 25,
      goalXp: 20,
      ratio: 1,
      met: true,
    });
  });

  it('goalXp = 0 → доля 0 без NaN и деления на ноль', () => {
    const result = computeDailyProgress(15, 0);
    expect(result.ratio).toBe(0);
    expect(result.met).toBe(false);
    expect(Number.isNaN(result.ratio)).toBe(false);
  });
});

describe('streakMessage', () => {
  it('непуста для 0, 1, 5, 30, 100', () => {
    for (const streak of [0, 1, 5, 30, 100]) {
      const message = streakMessage(streak);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('персональные сообщения на узловых значениях', () => {
    expect(streakMessage(0)).toBe('Начните серию!');
    expect(streakMessage(1)).toBe('День 1 — хорошее начало');
    expect(streakMessage(5)).toBe('5 дней подряд');
    expect(streakMessage(30)).toBe('Месяц!');
    expect(streakMessage(100)).toBe('Легенда');
  });

  it('непуста на всей сетке 0…120 (контракт «для любого streak ∈ [0, ∞)»)', () => {
    for (let streak = 0; streak <= 120; streak++) {
      expect(streakMessage(streak).length).toBeGreaterThan(0);
    }
  });

  it('отрицательный вход трактуется как 0 (защита от битого персиста)', () => {
    expect(streakMessage(-3)).toBe('Начните серию!');
  });
});

describe('messageColor', () => {
  it('0 → red (broken), 1–6 → green (active), ≥7 → orange (warning)', () => {
    expect(messageColor(0)).toBe('red');
    expect(messageColor(1)).toBe('green');
    expect(messageColor(5)).toBe('green');
    expect(messageColor(6)).toBe('green');
    expect(messageColor(7)).toBe('orange');
    expect(messageColor(100)).toBe('orange');
  });
});

describe('xpBarColor', () => {
  it('<50 % серый, 50–84 % акцент, ≥85 % зелёный', () => {
    expect(xpBarColor(0)).toBe('gray');
    expect(xpBarColor(0.25)).toBe('gray');
    expect(xpBarColor(XP_ACCENT_THRESHOLD)).toBe('accent');
    expect(xpBarColor(0.75)).toBe('accent');
    expect(xpBarColor(XP_MARK_THRESHOLD)).toBe('green');
    expect(xpBarColor(1)).toBe('green');
  });
});

describe('streakStateByActivity + stateColor', () => {
  const today = '2026-10-03';
  const yesterday = shiftIsoDate(today, -1);

  it('todayXp > 0 → active → green', () => {
    const state = streakStateByActivity(10, today, today);
    expect(state).toBe('active');
    expect(stateColor(state)).toBe('green');
  });

  it('todayXp = 0 и вчерашняя активность → warning → orange', () => {
    const state = streakStateByActivity(0, yesterday, today);
    expect(state).toBe('warning');
    expect(stateColor(state)).toBe('orange');
  });

  it('активность раньше вчера → broken → red', () => {
    const state = streakStateByActivity(0, shiftIsoDate(today, -3), today);
    expect(state).toBe('broken');
    expect(stateColor(state)).toBe('red');
  });

  it('нет истории → broken → red', () => {
    const state = streakStateByActivity(0, null, today);
    expect(state).toBe('broken');
    expect(stateColor(state)).toBe('red');
  });
});

describe('shiftIsoDate', () => {
  it('сдвигает ISO-дату на день назад и вперёд через границу месяца', () => {
    expect(shiftIsoDate('2026-10-03', -1)).toBe('2026-10-02');
    expect(shiftIsoDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftIsoDate('2026-10-31', 1)).toBe('2026-11-01');
  });
});
