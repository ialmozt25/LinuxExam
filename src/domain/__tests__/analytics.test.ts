import { describe, expect, it } from 'vitest';
import type { Question } from '@/data/models/Question';
import { TOPICS } from '@/data/topics';
import {
  overallReadiness,
  recentTrend,
  topicReadiness,
  weakTopics,
  type StatsByQuestion,
} from '../analytics';

/**
 * Границы analytics (spec 058): пустой stats, одна тема, все 14 тем, деление на
 * ноль, NaN-защита, детерминизм `weakTopics` и `deltaPct = null` без базы.
 *
 * Банк здесь синтетический: смысл проверки — арифметика готовности, а не размер
 * боевого банка (его размер фиксирует spec 057 и e2e через живые данные).
 */

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);

function question(id: string, topic: string): Question {
  return {
    id,
    topic: topic as Question['topic'],
    difficulty: 'easy',
    question: `q ${id}`,
    options: [{ text: 'a', correct: true }],
    explanation: 'e',
  };
}

/** По одному вопросу на каждую из 14 тем реестра. */
const FULL_BANK: Question[] = TOPICS.map((t, i) => question(`q${i}`, t.key));

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

describe('topicReadiness (spec 058)', () => {
  it('пустой stats → 0, без NaN', () => {
    expect(topicReadiness({}, FULL_BANK, 'security')).toBe(0);
  });

  it('одна тема: accuracy × coverage', () => {
    const bank = [question('a', 'security'), question('b', 'security'), question('c', 'security')];
    // Ответ верный и неверный на первый вопрос → accuracy = 1/2; покрыт 1 из 3.
    const stats: StatsByQuestion = {
      a: { attempts: 2, correct: 1 },
    };
    expect(topicReadiness(stats, bank, 'security')).toBeCloseTo(0.5 * (1 / 3), 10);
  });

  it('тема, которой нет в банке → 0 (не NaN)', () => {
    expect(topicReadiness({ x: { attempts: 5, correct: 5 } }, FULL_BANK, 'нет_такой_темы')).toBe(0);
  });

  it('attempts = 0 → 0 (деление на ноль защищено)', () => {
    const stats: StatsByQuestion = { q0: { attempts: 0, correct: 0 } };
    expect(topicReadiness(stats, FULL_BANK, TOPICS[0].key)).toBe(0);
  });

  it('НЕ NaN-защита: битые числа и correct > attempts не ломают результат', () => {
    const stats = {
      q0: { attempts: Number.NaN, correct: Number.NaN },
      q1: { attempts: -4, correct: -1 },
      q2: { attempts: Infinity, correct: 1 },
      q3: { attempts: 2, correct: 99 },
    } as StatsByQuestion;
    const value = topicReadiness(stats, FULL_BANK, TOPICS[0].key);
    expect(Number.isNaN(value)).toBe(false);
    expect(Number.isFinite(value)).toBe(true);
  });

  it('все 14 тем покрыты: полное покрытие и точность = 1', () => {
    const stats: StatsByQuestion = {};
    FULL_BANK.forEach((q) => {
      stats[q.id] = { attempts: 1, correct: 1 };
    });
    for (const topic of TOPICS) {
      expect(topicReadiness(stats, FULL_BANK, topic.key)).toBe(1);
    }
    expect(overallReadiness(stats, FULL_BANK)).toBe(1);
  });

  it('частичное покрытие в одной теме: 13 из 14 тем пусты', () => {
    const stats: StatsByQuestion = { q0: { attempts: 1, correct: 1 } };
    expect(topicReadiness(stats, FULL_BANK, TOPICS[0].key)).toBe(1);
    expect(topicReadiness(stats, FULL_BANK, TOPICS[13].key)).toBe(0);
  });
});

describe('overallReadiness (spec 058)', () => {
  it('пустой банк → 0', () => {
    expect(overallReadiness({ q: { attempts: 1, correct: 1 } }, [])).toBe(0);
  });

  it('взвешено по bank.length: крупная тема влияет сильнее', () => {
    const bank = [
      question('a', 'security'),
      question('b', 'security'),
      question('c', 'security'),
      question('d', 'networking'),
    ];
    // security: 3/3 верно → 1; networking: 0 → 0. Вклад: (3*1 + 1*0) / 4 = 0.75.
    const stats: StatsByQuestion = {
      a: { attempts: 1, correct: 1 },
      b: { attempts: 1, correct: 1 },
      c: { attempts: 1, correct: 1 },
    };
    expect(overallReadiness(stats, bank)).toBeCloseTo(0.75, 10);
  });
});

describe('weakTopics (spec 058)', () => {
  it('пустой банк → пустой список', () => {
    expect(weakTopics({ a: { attempts: 1, correct: 1 } }, [])).toEqual([]);
  });

  it('сортирует от худшей к лучшей и режет до topN', () => {
    const bank = [
      question('s1', 'security'),
      question('n1', 'networking'),
      question('u1', 'users_groups'),
      question('f1', 'file_systems'),
    ];
    const stats: StatsByQuestion = {
      s1: { attempts: 1, correct: 0 }, // 0
      n1: { attempts: 2, correct: 1 }, // 0.5
      u1: { attempts: 1, correct: 1 }, // 1
      // file_systems без ответов → 0
    };
    const weak = weakTopics(stats, bank, 3);
    expect(weak.map((w) => w.slug)).toEqual(['file_systems', 'security', 'networking']);
    expect(weak.map((w) => w.label)).toEqual(['Файловые системы', 'Безопасность', 'Сеть']);
    expect(weak[0].score).toBe(0);
  });

  it('детерминизм при равных score: ничья разрешается по слагу', () => {
    const bank = [question('s1', 'security'), question('n1', 'networking')];
    const stats: StatsByQuestion = {
      s1: { attempts: 1, correct: 0 },
      n1: { attempts: 1, correct: 0 },
    };
    expect(weakTopics(stats, bank, 2).map((w) => w.slug)).toEqual(['networking', 'security']);
  });

  it('topN по умолчанию 3 и не превышает число тем банка', () => {
    expect(weakTopics({}, FULL_BANK).length).toBe(3);
    expect(weakTopics({}, [question('a', 'security')]).length).toBe(1);
  });

  it('лейбл вне реестра TOPICS — сам слаг (не падает)', () => {
    const bank = [question('x1', 'legacy_topic')];
    expect(weakTopics({}, bank, 1)).toEqual([
      { slug: 'legacy_topic', label: 'legacy_topic', score: 0 },
    ]);
  });
});

describe('recentTrend (spec 058)', () => {
  it('пустой stats → нули и deltaPct = null', () => {
    expect(recentTrend({}, NOW)).toEqual({ answered: 0, correct: 0, deltaPct: null });
  });

  it('свежая половина против предыдущей: одинаковое число вопросов', () => {
    const stats: StatsByQuestion = {
      a: { attempts: 1, correct: 1, lastAt: iso(-DAY) }, // свежая половина
      b: { attempts: 1, correct: 0, lastAt: iso(-DAY) }, // свежая половина
      c: { attempts: 1, correct: 1, lastAt: iso(-5 * DAY) }, // предыдущая
      d: { attempts: 1, correct: 0, lastAt: iso(-5 * DAY) }, // предыдущая
    };
    const trend = recentTrend(stats, NOW, 7);
    expect(trend.answered).toBe(2);
    expect(trend.correct).toBe(1);
    expect(trend.deltaPct).toBe(0);
  });

  it('рост точности даёт положительный deltaPct', () => {
    const stats: StatsByQuestion = {
      a: { attempts: 1, correct: 1, lastAt: iso(-DAY) },
      b: { attempts: 1, correct: 1, lastAt: iso(-DAY) },
      c: { attempts: 1, correct: 1, lastAt: iso(-5 * DAY) },
      d: { attempts: 1, correct: 0, lastAt: iso(-5 * DAY) },
    };
    const trend = recentTrend(stats, NOW, 7);
    expect(trend.answered).toBe(2);
    expect(trend.correct).toBe(2);
    expect(trend.deltaPct).toBe(100);
  });

  it('пустая предыдущая половина → deltaPct = null (нет базы)', () => {
    const stats: StatsByQuestion = { a: { attempts: 1, correct: 1, lastAt: iso(-DAY) } };
    expect(recentTrend(stats, NOW, 7)).toEqual({ answered: 1, correct: 1, deltaPct: null });
  });

  it('ответы вне окна (старше 7 дней и в будущем) игнорируются', () => {
    const stats: StatsByQuestion = {
      old: { attempts: 5, correct: 5, lastAt: iso(-30 * DAY) },
      future: { attempts: 5, correct: 5, lastAt: iso(DAY) },
      bad: { attempts: 5, correct: 5, lastAt: 'не-дата' },
      missing: { attempts: 5, correct: 5 },
    } as StatsByQuestion;
    expect(recentTrend(stats, NOW, 7)).toEqual({ answered: 0, correct: 0, deltaPct: null });
  });

  it('нулевая точность предыдущей половины не даёт деления на ноль', () => {
    const stats: StatsByQuestion = {
      a: { attempts: 1, correct: 1, lastAt: iso(-DAY) },
      c: { attempts: 1, correct: 0, lastAt: iso(-5 * DAY) },
      d: { attempts: 1, correct: 0, lastAt: iso(-5 * DAY) },
    };
    const trend = recentTrend(stats, NOW, 7);
    expect(trend.deltaPct).toBe(null);
    expect(Number.isNaN(trend.deltaPct as number)).toBe(false);
  });
});
