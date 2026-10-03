import { describe, it, expect } from 'vitest';
import {
  FREE_TOPICS,
  TRIAL_DAYS,
  TRIAL_MS,
  canAccessTopic,
  isFreeTopic,
  isTrialActive,
} from '@/domain/paywall';
import { AVAILABLE_TOPICS } from '@/data/topics';

/**
 * Контентный paywall (spec 063) — чистый домен.
 *
 * Список бесплатных тем проверяется против РЕЕСТРА тем (`src/data/topics.ts`), а
 * не против литералов: слаг, которого нет в реестре, не показать в секции
 * «Бесплатно» на Paywall — тест обязан это поймать.
 */

const DAY_MS = 24 * 3600 * 1000;

/** Стабильная точка отсчёта — домен обязан быть детерминированным. */
const NOW = 1_800_000_000_000;

describe('FREE_TOPICS', () => {
  it('содержит ровно 3 слага', () => {
    expect(FREE_TOPICS).toHaveLength(3);
  });

  it('все слаги существуют в реестре тем', () => {
    const known = AVAILABLE_TOPICS.map((topic) => topic.key);
    for (const slug of FREE_TOPICS) {
      expect(known, `FREE_TOPICS содержит неизвестный слаг "${slug}"`).toContain(slug);
    }
  });

  it('бесплатные слаги уникальны', () => {
    expect(new Set(FREE_TOPICS).size).toBe(FREE_TOPICS.length);
  });
});

describe('isFreeTopic', () => {
  it('true для всех трёх бесплатных тем', () => {
    for (const slug of FREE_TOPICS) {
      expect(isFreeTopic(slug)).toBe(true);
    }
  });

  it('false для остальных 11 доступных тем', () => {
    const paid = AVAILABLE_TOPICS.map((topic) => topic.key).filter(
      (key) => !FREE_TOPICS.includes(key)
    );
    expect(paid).toHaveLength(11);
    for (const slug of paid) {
      expect(isFreeTopic(slug)).toBe(false);
    }
  });

  it('false для неизвестного слага', () => {
    expect(isFreeTopic('no_such_topic')).toBe(false);
    expect(isFreeTopic('')).toBe(false);
  });
});

describe('isTrialActive', () => {
  it('false, когда trial не начинался', () => {
    expect(isTrialActive(null, NOW)).toBe(false);
  });

  it('true в первый день', () => {
    expect(isTrialActive(NOW, NOW)).toBe(true);
    expect(isTrialActive(NOW - DAY_MS, NOW)).toBe(true);
  });

  it('true на шестой день', () => {
    expect(isTrialActive(NOW - 6 * DAY_MS, NOW)).toBe(true);
  });

  it('false на восьмой день', () => {
    expect(isTrialActive(NOW - 8 * DAY_MS, NOW)).toBe(false);
  });

  it('граница: ровно 7 дней — trial истёк, 7 дней без миллисекунды — активен', () => {
    expect(isTrialActive(NOW - TRIAL_MS, NOW)).toBe(false);
    expect(isTrialActive(NOW - TRIAL_MS + 1, NOW)).toBe(true);
  });

  it('trialStartedAt из будущего читается как активный (часы сбиты)', () => {
    expect(isTrialActive(NOW + DAY_MS, NOW)).toBe(true);
  });

  it('TRIAL_MS выводится из TRIAL_DAYS', () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(TRIAL_MS).toBe(7 * DAY_MS);
  });
});

describe('canAccessTopic', () => {
  const NO_TRIAL = { isPro: false, trialStartedAt: null };
  const PRO = { isPro: true, trialStartedAt: null };
  const ACTIVE_TRIAL = { isPro: false, trialStartedAt: NOW - DAY_MS };
  const EXPIRED_TRIAL = { isPro: false, trialStartedAt: NOW - 8 * DAY_MS };

  it('Free-тема доступна без Pro и без trial', () => {
    for (const slug of FREE_TOPICS) {
      expect(canAccessTopic(slug, NO_TRIAL, NOW)).toBe(true);
    }
  });

  it('Paid-тема доступна с Pro (даже с истёкшим trial)', () => {
    expect(canAccessTopic('networking', PRO, NOW)).toBe(true);
    expect(
      canAccessTopic('networking', { isPro: true, trialStartedAt: NOW - 30 * DAY_MS }, NOW)
    ).toBe(true);
  });

  it('Paid-тема доступна на активном trial', () => {
    expect(canAccessTopic('networking', ACTIVE_TRIAL, NOW)).toBe(true);
  });

  it('Paid-тема недоступна без Pro и без trial', () => {
    expect(canAccessTopic('networking', NO_TRIAL, NOW)).toBe(false);
  });

  it('Paid-тема недоступна после истечения trial', () => {
    expect(canAccessTopic('networking', EXPIRED_TRIAL, NOW)).toBe(false);
  });

  it('Free-тема остаётся доступной и после истечения trial', () => {
    for (const slug of FREE_TOPICS) {
      expect(canAccessTopic(slug, EXPIRED_TRIAL, NOW)).toBe(true);
    }
  });

  it('неизвестный слаг платный', () => {
    expect(canAccessTopic('no_such_topic', NO_TRIAL, NOW)).toBe(false);
    expect(canAccessTopic('no_such_topic', PRO, NOW)).toBe(true);
  });
});
