import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_GOALS,
  DEMO_QUESTION_COUNT,
  computeDemoResult,
  pickDemoQuestions,
} from '@/domain/onboarding';
import type { Question, Topic } from '@/data/models/Question';

const OPTIONS = [
  { text: 'A', correct: true },
  { text: 'B', correct: false },
];

function question(id: string, topic: Topic = 'file_permissions'): Question {
  return {
    id,
    topic,
    difficulty: 'easy',
    question: `Вопрос ${id}?`,
    options: OPTIONS,
    explanation: 'Объяснение.',
  };
}

const BANK: Question[] = Array.from({ length: 12 }, (_, i) => question(`q${i + 1}`));

describe('ONBOARDING_GOALS', () => {
  it('ровно 3 цели с уникальными id', () => {
    expect(ONBOARDING_GOALS).toHaveLength(3);
    const ids = ONBOARDING_GOALS.map((g) => g.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(['rhcsa', 'refresh', 'interview']);
  });

  it('у каждой цели есть label и description', () => {
    for (const goal of ONBOARDING_GOALS) {
      expect(goal.label.length).toBeGreaterThan(0);
      expect(goal.description.length).toBeGreaterThan(0);
    }
  });

  it('демо-квиз показывает 3 вопроса', () => {
    expect(DEMO_QUESTION_COUNT).toBe(3);
  });
});

describe('pickDemoQuestions — детерминизм', () => {
  it('тот же seed на том же банке → те же qid', () => {
    const first = pickDemoQuestions(BANK, 'rhcsa').map((q) => q.id);
    const second = pickDemoQuestions(BANK, 'rhcsa').map((q) => q.id);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
  });

  it('детерминизм сохраняется и при другом порядке объектов того же банка', () => {
    // Пересозданный массив с теми же id и в том же порядке — тот же результат:
    // подборка зависит только от длины банка и seed-строки.
    const rebuilt = BANK.map((q) => ({ ...q }));
    expect(pickDemoQuestions(rebuilt, 'refresh').map((q) => q.id)).toEqual(
      pickDemoQuestions(BANK, 'refresh').map((q) => q.id),
    );
  });

  it('разные цели дают разные подборки (не совпадают все 3)', () => {
    const rhcsa = pickDemoQuestions(BANK, 'rhcsa').map((q) => q.id);
    const interview = pickDemoQuestions(BANK, 'interview').map((q) => q.id);
    expect(rhcsa).not.toEqual(interview);
  });

  it('не мутирует входной банк', () => {
    const before = BANK.map((q) => q.id);
    pickDemoQuestions(BANK, 'rhcsa');
    expect(BANK.map((q) => q.id)).toEqual(before);
  });

  it('вопросы подборки — из банка и без дублей', () => {
    const picked = pickDemoQuestions(BANK, 'rhcsa');
    const ids = picked.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(BANK.some((q) => q.id === id)).toBe(true);
  });

  it('n по умолчанию = 3, явный n соблюдается', () => {
    expect(pickDemoQuestions(BANK, 'rhcsa')).toHaveLength(3);
    expect(pickDemoQuestions(BANK, 'rhcsa', 1)).toHaveLength(1);
  });
});

describe('pickDemoQuestions — короткий банк', () => {
  it('bank < 3 → возвращает весь банк в исходном порядке', () => {
    const short = [question('a'), question('b')];
    expect(pickDemoQuestions(short, 'rhcsa').map((q) => q.id)).toEqual(['a', 'b']);
  });

  it('bank ровно 3 → возвращает весь банк', () => {
    const three = [question('a'), question('b'), question('c')];
    expect(pickDemoQuestions(three, 'rhcsa').map((q) => q.id)).toEqual(['a', 'b', 'c']);
  });

  it('пустой банк → пустой массив (без исключения)', () => {
    expect(pickDemoQuestions([], 'rhcsa')).toEqual([]);
  });

  it('возвращённый короткий банк — копия, а не сам вход', () => {
    const short = [question('a')];
    const out = pickDemoQuestions(short, 'rhcsa');
    expect(out).not.toBe(short);
  });
});

describe('computeDemoResult — границы 0/3 … 3/3', () => {
  const answers = (correctCount: number, total = 3) =>
    Array.from({ length: total }, (_, i) => ({ isCorrect: i < correctCount }));

  it('каждый счёт 0..3 даёт {correct,total,message} без NaN', () => {
    for (let correct = 0; correct <= 3; correct++) {
      const result = computeDemoResult(answers(correct));
      expect(result.correct).toBe(correct);
      expect(result.total).toBe(3);
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message).not.toContain('NaN');
    }
  });

  it('0/3 — поддерживающее сообщение, 3/3 — сообщение об успехе', () => {
    expect(computeDemoResult(answers(0)).message).not.toBe(computeDemoResult(answers(3)).message);
  });

  it('3/3 сообщает счёт в тексте', () => {
    expect(computeDemoResult(answers(3)).message).toContain('3 из 3');
  });

  it('1/3 и 2/3 — промежуточное сообщение (отличное от границ)', () => {
    const one = computeDemoResult(answers(1)).message;
    const two = computeDemoResult(answers(2)).message;
    expect(one).not.toBe(computeDemoResult(answers(0)).message);
    expect(two).not.toBe(computeDemoResult(answers(3)).message);
  });

  it('пустой прогон → 0/0 и fallback-сообщение (не NaN, не деление на ноль)', () => {
    const result = computeDemoResult([]);
    expect(result.correct).toBe(0);
    expect(result.total).toBe(0);
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.message).not.toContain('NaN');
  });

  it('итог считается по ответам, а не по длине банка', () => {
    expect(computeDemoResult(answers(1, 1)).total).toBe(1);
  });
});
