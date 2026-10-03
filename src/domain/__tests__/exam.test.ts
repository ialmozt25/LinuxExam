import { describe, it, expect } from 'vitest';
import {
  EXAM_PASS_THRESHOLD,
  EXAM_PRESETS,
  breakdownByTopic,
  findPreset,
  formatRemaining,
  pickExamQuestions,
  remainingMs,
  scoreExam,
  seededIndices,
} from '@/domain/exam';
import type { ExamAnswer } from '@/domain/exam';

const BANK = Array.from({ length: 253 }, (_, i) => `q${String(i + 1).padStart(3, '0')}`);
const SEED = 1_800_000_000_000;

const answer = (questionId: string, isCorrect: boolean, selectedIndex = 0): ExamAnswer => ({
  questionId,
  selectedIndex,
  isCorrect,
});

describe('exam.EXAM_PRESETS / findPreset', () => {
  it('пресеты: 30/30 мин, 60/60 мин, 90/120 мин; порог 70 %', () => {
    expect(EXAM_PRESETS.map((p) => p.count)).toEqual([30, 60, 90]);
    expect(EXAM_PRESETS.map((p) => p.durationMs / 60000)).toEqual([30, 60, 120]);
    expect(EXAM_PASS_THRESHOLD).toBeCloseTo(0.7, 10);
  });

  it('findPreset отдаёт конфиг по размеру и null для неизвестного', () => {
    expect(findPreset(60)).toEqual({ count: 60, durationMs: 60 * 60 * 1000 });
    expect(findPreset(20)).toBeNull(); // размер исторического инлайн-экзамена
    expect(findPreset(0)).toBeNull();
  });
});

describe('exam.pickExamQuestions — детерминированная выборка', () => {
  it('длина равна count, id уникальны и взяты из банка', () => {
    for (const count of [30, 60, 90]) {
      const picked = pickExamQuestions(BANK, count, SEED);
      expect(picked).toHaveLength(count);
      expect(new Set(picked).size).toBe(count);
      for (const id of picked) expect(BANK).toContain(id);
    }
  });

  it('тот же seed → тот же набор и тот же порядок (детерминизм)', () => {
    const first = pickExamQuestions(BANK, 30, SEED);
    const second = pickExamQuestions(BANK, 30, SEED);
    expect(second).toEqual(first);

    // Разные seed дают разный порядок (не «всегда первые 30»).
    const other = pickExamQuestions(BANK, 30, SEED + 1);
    expect(other).not.toEqual(first);
  });

  it('count больше банка → весь банк, без дублей и «добивки» undefined', () => {
    const picked = pickExamQuestions(BANK, 90, SEED);
    expect(picked).toHaveLength(90);

    const small = ['a', 'b', 'c'];
    expect(pickExamQuestions(small, 30, SEED).sort()).toEqual(['a', 'b', 'c']);
    expect(pickExamQuestions(small, 30, SEED)).toHaveLength(3);

    // count = 0 и пустой банк → пустой список, без исключений.
    expect(pickExamQuestions(small, 0, SEED)).toEqual([]);
    expect(pickExamQuestions([], 30, SEED)).toEqual([]);
    expect(seededIndices([], 30, SEED)).toEqual([]);
  });

  it('выборка не сводится к префиксу банка', () => {
    const picked = pickExamQuestions(BANK, 30, SEED);
    expect(picked).toEqual(pickExamQuestions(BANK, 30, SEED));
    const prefix = BANK.slice(0, 30);
    expect(picked).not.toEqual(prefix);
  });
});

describe('exam.scoreExam — границы порога 70 %', () => {
  it('пустые ответы и нулевой прогон → 0 / 0 / 0 %, не сдано (без NaN)', () => {
    expect(scoreExam([], 0)).toEqual({ correct: 0, total: 0, percent: 0, passed: false });
    expect(scoreExam([], 30)).toEqual({ correct: 0, total: 30, percent: 0, passed: false });
  });

  it('21 / 30 = 70 % → сдано (граница включительна)', () => {
    const answers = Array.from({ length: 21 }, (_, i) => answer(`q${i}`, true));
    const score = scoreExam(answers, 30);
    expect(score.correct).toBe(21);
    expect(score.total).toBe(30);
    expect(score.percent).toBe(70);
    expect(score.passed).toBe(true);
  });

  it('20 / 30 = 66.7 % → не сдано', () => {
    const answers = Array.from({ length: 20 }, (_, i) => answer(`q${i}`, true));
    const score = scoreExam(answers, 30);
    expect(score.percent).toBeCloseTo(66.7, 10);
    expect(score.passed).toBe(false);
  });

  it('неотвеченные вопросы считаются верными только если верны', () => {
    // 15 верных из 30: остальные 15 вопросов не отвечены вовсе.
    const answers = Array.from({ length: 15 }, (_, i) => answer(`q${i}`, true));
    const score = scoreExam(answers, 30);
    expect(score.correct).toBe(15);
    expect(score.percent).toBe(50);
    expect(score.passed).toBe(false);
  });

  it('повторный ответ на тот же qid не удваивает счёт', () => {
    const score = scoreExam([answer('q1', true), answer('q1', true)], 2);
    expect(score.correct).toBe(1);
    expect(score.total).toBe(2);
    expect(score.percent).toBe(50);
  });

  it('все верные 30 / 30 → 100 % и сдано', () => {
    const answers = Array.from({ length: 30 }, (_, i) => answer(`q${i}`, true));
    const score = scoreExam(answers, 30);
    expect(score.percent).toBe(100);
    expect(score.passed).toBe(true);
  });
});

describe('exam.breakdownByTopic — разбор по темам', () => {
  const questionsById = {
    q1: { topic: 'networking' },
    q2: { topic: 'networking' },
    q3: { topic: 'security' },
    q4: { topic: 'security' },
    q5: { topic: 'security' },
  };

  it('группирует по теме, считает правильные и процент', () => {
    const rows = breakdownByTopic(
      [answer('q1', true), answer('q2', false), answer('q3', true), answer('q4', true), answer('q5', false)],
      questionsById,
    );
    expect(rows).toEqual([
      { topic: 'networking', correct: 1, total: 2, percent: 50 },
      { topic: 'security', correct: 2, total: 3, percent: 66.7 },
    ]);
  });

  it('пустой answers → []', () => {
    expect(breakdownByTopic([], questionsById)).toEqual([]);
    expect(breakdownByTopic([], {})).toEqual([]);
  });

  it('qid вне банка отбрасывается, дубли ответов не считаются дважды', () => {
    const rows = breakdownByTopic(
      [answer('ghost', true), answer('q1', true), answer('q1', true)],
      questionsById,
    );
    expect(rows).toEqual([{ topic: 'networking', correct: 1, total: 1, percent: 100 }]);
  });
});

describe('exam.remainingMs / formatRemaining — таймер', () => {
  it('000:00:00 при null, 0 после истечения, полный остаток на старте', () => {
    expect(remainingMs(null, 60000, SEED)).toBe(0);
    expect(remainingMs(SEED - 90_000, 60_000, SEED)).toBe(0);
    expect(remainingMs(SEED, 60_000, SEED)).toBe(60_000);
    expect(remainingMs(SEED, 60_000, SEED + 15_000)).toBe(45_000);
  });

  it('формат HH:MM:SS, в том числе для 120-минутного пресета', () => {
    expect(formatRemaining(0)).toBe('00:00:00');
    expect(formatRemaining(1000)).toBe('00:00:01');
    expect(formatRemaining(61_000)).toBe('00:01:01');
    expect(formatRemaining(30 * 60 * 1000)).toBe('00:30:00');
    expect(formatRemaining(120 * 60 * 1000)).toBe('02:00:00');
    expect(formatRemaining(59 * 60 * 1000 + 59 * 1000)).toBe('00:59:59');
    // Битый вход не даёт NaN в разметке.
    expect(formatRemaining(Number.NaN)).toBe('00:00:00');
    expect(formatRemaining(-5)).toBe('00:00:00');
  });
});
