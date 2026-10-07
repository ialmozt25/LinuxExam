import { describe, it, expect } from 'vitest';
import {
  LEVELS,
  STREAK_MILESTONES,
  XP_EXAM_COMPLETE,
  XP_FIRST_ANSWER_OF_DAY,
  XP_REGULAR_CORRECT,
  XP_REGULAR_WRONG,
  XP_REVIEW_CORRECT,
  XP_REVIEW_WRONG,
  applyXpGain,
  levelFromXp,
  nextLevel,
  streakMilestoneXp,
  xpForAnswer,
  xpInLevel,
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

describe('LEVELS — именованная лестница уровней', () => {
  it('семь ступеней RHCSA с порогами 0/50/150/350/700/1200/2000', () => {
    expect(LEVELS.map((level) => level.name)).toEqual([
      'Новичок',
      'Ученик',
      'Практик',
      'Специалист',
      'Эксперт',
      'Мастер',
      'Гранд-мастер',
    ]);
    expect(LEVELS.map((level) => level.minXp)).toEqual([0, 50, 150, 350, 700, 1200, 2000]);
    expect(LEVELS.map((level) => level.nameGenitive)).toEqual([
      'Новичка',
      'Ученика',
      'Практика',
      'Специалиста',
      'Эксперта',
      'Мастера',
      'Гранд-мастера',
    ]);
  });

  it('кривая «быстро на старте»: каждый следующий шаг дороже предыдущего', () => {
    const steps = LEVELS.slice(1).map((level, index) => level.minXp - LEVELS[index].minXp);
    expect(steps).toEqual([50, 100, 200, 350, 500, 800]);
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]).toBeGreaterThan(steps[index - 1]);
    }
  });
});

describe('levelFromXp — номер и имя уровня по накопленному XP', () => {
  it('границы 49/50/149/150/1999/2000 переключают уровень ровно на пороге', () => {
    expect(levelFromXp(49)).toEqual({ number: 1, name: 'Новичок' });
    expect(levelFromXp(50)).toEqual({ number: 2, name: 'Ученик' });
    expect(levelFromXp(149)).toEqual({ number: 2, name: 'Ученик' });
    expect(levelFromXp(150)).toEqual({ number: 3, name: 'Практик' });
    expect(levelFromXp(1999)).toEqual({ number: 6, name: 'Мастер' });
    expect(levelFromXp(2000)).toEqual({ number: 7, name: 'Гранд-мастер' });
  });

  it('каждая ступень достижима: порог − 1 — предыдущая, порог — эта', () => {
    LEVELS.forEach((level, index) => {
      if (index === 0) return;
      expect(levelFromXp(level.minXp - 1).number).toBe(index);
      expect(levelFromXp(level.minXp)).toEqual({ number: index + 1, name: level.name });
    });
  });

  it('выше Гранд-мастера лестница конечна: уровень не растёт', () => {
    expect(levelFromXp(50_000)).toEqual(levelFromXp(2000));
    expect(levelFromXp(50_000).number).toBe(LEVELS.length);
  });

  it('0 XP → Новичок: свежий профиль', () => {
    expect(levelFromXp(0)).toEqual({ number: 1, name: 'Новичок' });
  });

  it('уровень не убывает с ростом XP', () => {
    let prev = 0;
    for (let xp = 0; xp <= 2500; xp += 7) {
      const level = levelFromXp(xp).number;
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });

  it('битый вход не ломает шкалу (NaN, отрицательное, дробное)', () => {
    expect(levelFromXp(Number.NaN)).toEqual({ number: 1, name: 'Новичок' });
    expect(levelFromXp(-500)).toEqual({ number: 1, name: 'Новичок' });
    expect(levelFromXp(49.9)).toEqual({ number: 1, name: 'Новичок' });
    expect(levelFromXp(50.5)).toEqual({ number: 2, name: 'Ученик' });
  });
});

describe('nextLevel — подпись «до следующего»', () => {
  it('называет следующую ступень на каждой, кроме верхней', () => {
    expect(nextLevel(0)?.name).toBe('Ученик');
    expect(nextLevel(49)?.name).toBe('Ученик');
    expect(nextLevel(50)?.name).toBe('Практик');
    expect(nextLevel(1199)?.name).toBe('Мастер');
    expect(nextLevel(1200)?.name).toBe('Гранд-мастер');
  });

  it('имя идёт в родительном падеже — «до Ученика», а не «до Ученик»', () => {
    expect(nextLevel(0)?.nameGenitive).toBe('Ученика');
    expect(nextLevel(50)?.nameGenitive).toBe('Практика');
    expect(nextLevel(1999)?.nameGenitive).toBe('Гранд-мастера');
  });

  it('у каждой ступени форма родительного падежа отличается от имени', () => {
    for (const level of LEVELS) {
      expect(level.nameGenitive.length).toBeGreaterThan(0);
      expect(level.nameGenitive).not.toBe(level.name);
    }
  });

  it('Гранд-мастер без next: null', () => {
    expect(nextLevel(1999)?.name).toBe('Гранд-мастер');
    expect(nextLevel(2000)).toBeNull();
    expect(nextLevel(99_999)).toBeNull();
    expect(nextLevel(Number.NaN)?.name).toBe('Ученик');
  });
});

describe('xpInLevel — прогресс внутри уровня', () => {
  it('внутри первого уровня current/needed — это XP / 50', () => {
    expect(xpInLevel(0)).toEqual({ current: 0, needed: 50, percent: 0 });
    expect(xpInLevel(25)).toEqual({ current: 25, needed: 50, percent: 50 });
    expect(xpInLevel(49)).toEqual({ current: 49, needed: 50, percent: 98 });
  });

  it('на уровне 2 «нужно» — это шаг уровня, а не абсолютный порог', () => {
    // 50…149: шаг 100 (150 − 50).
    expect(xpInLevel(50)).toEqual({ current: 0, needed: 100, percent: 0 });
    expect(xpInLevel(100)).toEqual({ current: 50, needed: 100, percent: 50 });
    expect(xpInLevel(149)).toEqual({ current: 99, needed: 100, percent: 99 });
  });

  it('на пороге 150 уровень переключается и счёт начинается заново (шаг 200)', () => {
    expect(xpInLevel(150)).toEqual({ current: 0, needed: 200, percent: 0 });
    expect(xpInLevel(250)).toEqual({ current: 100, needed: 200, percent: 50 });
  });

  it('предпоследняя ступень: 1999 — это 799 / 800 XP до Гранд-мастера', () => {
    expect(xpInLevel(1999)).toEqual({ current: 799, needed: 800, percent: (799 / 800) * 100 });
  });

  it('Гранд-мастер: needed === null и percent === 100 — следующего уровня нет', () => {
    expect(xpInLevel(2000)).toEqual({ current: 0, needed: null, percent: 100 });
    expect(xpInLevel(2500)).toEqual({ current: 500, needed: null, percent: 100 });
  });

  it('инварианты ниже верхнего уровня: 0 ≤ current < needed, percent ∈ [0, 100), без NaN', () => {
    for (let xp = 0; xp < 2000; xp += 13) {
      const progress = xpInLevel(xp);
      expect(progress.needed).not.toBeNull();
      if (progress.needed === null) {
        throw new Error(`ниже 2000 XP уровень не терминальный, а needed === null (${xp})`);
      }
      expect(progress.current).toBeGreaterThanOrEqual(0);
      expect(progress.current).toBeLessThan(progress.needed);
      expect(progress.percent).toBeGreaterThanOrEqual(0);
      expect(progress.percent).toBeLessThan(100);
      expect(Number.isNaN(progress.percent)).toBe(false);
    }
  });

  it('битый вход не даёт NaN и отрицательных значений', () => {
    expect(xpInLevel(Number.NaN)).toEqual({ current: 0, needed: 50, percent: 0 });
    expect(xpInLevel(-40)).toEqual({ current: 0, needed: 50, percent: 0 });
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
