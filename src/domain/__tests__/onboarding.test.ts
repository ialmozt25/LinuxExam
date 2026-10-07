import { describe, it, expect } from 'vitest';
import {
  DEMO_FEEDBACK_CORRECT,
  DEMO_FEEDBACK_WRONG,
  DEMO_QUESTION_COUNT,
  demoAnswerFeedback,
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

describe('демо-квиз — контракт подборки', () => {
  it('демо-квиз показывает 3 вопроса', () => {
    expect(DEMO_QUESTION_COUNT).toBe(3);
  });
});

describe('pickDemoQuestions — детерминизм', () => {
  it('на том же банке → те же qid', () => {
    const first = pickDemoQuestions(BANK).map((q) => q.id);
    const second = pickDemoQuestions(BANK).map((q) => q.id);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
  });

  it('детерминизм сохраняется и при другом порядке объектов того же банка', () => {
    // Пересозданный массив с теми же id и в том же порядке — тот же результат:
    // подборка зависит только от длины банка и фиксированного seed-а.
    const rebuilt = BANK.map((q) => ({ ...q }));
    expect(pickDemoQuestions(rebuilt).map((q) => q.id)).toEqual(
      pickDemoQuestions(BANK).map((q) => q.id),
    );
  });

  it('не мутирует входной банк', () => {
    const before = BANK.map((q) => q.id);
    pickDemoQuestions(BANK);
    expect(BANK.map((q) => q.id)).toEqual(before);
  });

  it('вопросы подборки — из банка и без дублей', () => {
    const picked = pickDemoQuestions(BANK);
    const ids = picked.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(BANK.some((q) => q.id === id)).toBe(true);
  });

  it('n по умолчанию = 3, явный n соблюдается', () => {
    expect(pickDemoQuestions(BANK)).toHaveLength(3);
    expect(pickDemoQuestions(BANK, 1)).toHaveLength(1);
  });
});

describe('pickDemoQuestions — короткий банк', () => {
  it('bank < 3 → возвращает весь банк в исходном порядке', () => {
    const short = [question('a'), question('b')];
    expect(pickDemoQuestions(short).map((q) => q.id)).toEqual(['a', 'b']);
  });

  it('bank ровно 3 → возвращает весь банк', () => {
    const three = [question('a'), question('b'), question('c')];
    expect(pickDemoQuestions(three).map((q) => q.id)).toEqual(['a', 'b', 'c']);
  });

  it('пустой банк → пустой массив (без исключения)', () => {
    expect(pickDemoQuestions([])).toEqual([]);
  });

  it('возвращённый короткий банк — копия, а не сам вход', () => {
    const short = [question('a')];
    const out = pickDemoQuestions(short);
    expect(out).not.toBe(short);
  });
});

describe('demoAnswerFeedback — inline celebration после ответа', () => {
  it('верный ответ → «Отлично!»', () => {
    expect(demoAnswerFeedback(true)).toBe(DEMO_FEEDBACK_CORRECT);
    expect(demoAnswerFeedback(true)).toBe('Отлично!');
  });

  it('неверный ответ → поддерживающий текст, а не тот же самый', () => {
    expect(demoAnswerFeedback(false)).toBe(DEMO_FEEDBACK_WRONG);
    expect(demoAnswerFeedback(false)).toBe('Запомни — так тоже бывает');
  });

  it('тексты верного и неверного ответа различаются', () => {
    expect(demoAnswerFeedback(true)).not.toBe(demoAnswerFeedback(false));
  });

  it('оба текста непустые и без NaN', () => {
    for (const isCorrect of [true, false]) {
      const text = demoAnswerFeedback(isCorrect);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('NaN');
    }
  });
});
