import { describe, expect, it } from 'vitest';
import { fromJson, type Topic } from '../Question';
import { QUESTION_TOPICS } from '../../questions/index';
import { TOPICS } from '../../topics';
import bankTotals from '../../questions/_topics.json';

/**
 * Регресс spec 057: `Topic` обязан покрывать все темы банка.
 *
 * До фикса union знал три темы при 14 в банке, и это не проявлялось в рантайме
 * только потому, что `fromJson` приводит строку через `as Topic`. Тест фиксирует
 * фактический контракт: любая тема из реестра загрузчиков (`QUESTION_TOPICS` —
 * ключи `LOADERS`, то есть реальные чанки банка) принимается типом и не теряется
 * при разборе JSON.
 *
 * Compile-time половина контракта живёт в `src/data/models/Question.ts`: guard
 * `TOPIC_COVERAGE: Record<Topic, true>` не даст добавить слаг банка, не расширив
 * union. Здесь проверяется та же граница во время выполнения.
 */

const bankTopics: string[] = QUESTION_TOPICS;

describe('Topic union покрывает банк (spec 057)', () => {
  it('банк содержит 14 тем, и union знает ровно их', () => {
    expect(bankTopics.length).toBe(14);
    expect(Object.keys(bankTotals.byTopic).length).toBe(bankTopics.length);
  });

  it('каждый слаг банка принимается типом и не теряется при разборе JSON', () => {
    for (const slug of bankTopics) {
      const question = fromJson({
        id: `spec-057-${slug}`,
        topic: slug,
        difficulty: 'easy',
        question: 'q',
        options: [{ text: 'a', correct: true }],
        explanation: 'e',
      });
      // `topic` объявлен как Topic: присваивание ниже не компилировалось бы,
      // если бы слаг выпал из union.
      const typed: Topic = question.topic;
      expect(typed).toBe(slug);
      expect(question.topic).toBe(slug);
    }
  });

  it('реестр заголовков покрывает те же темы, что и банк (radar spec 058)', () => {
    const registryKeys: string[] = TOPICS.map((t) => t.key);
    expect(registryKeys.slice().sort()).toEqual(bankTopics.slice().sort());
    expect(registryKeys.length).toBe(bankTopics.length);
  });

  it('слаг вне банка в QUESTION_TOPICS не входит', () => {
    expect(bankTopics).not.toContain('legacy_topic');
  });
});
