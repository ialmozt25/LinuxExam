/**
 * Контентный paywall (spec 063) — чистый домен.
 *
 * Решает ровно один вопрос: **какие темы доступны пользователю**. Здесь нет
 * ни экранов, ни стора: `now` передаётся аргументом, поэтому функция
 * детерминирована и проверяема без фейковых таймеров. Тот же контракт, что у
 * остальных domain-модулей (`fsrs`, `exam`, `analytics`, `goal`): ноль импортов
 * `zustand`/`react` и никаких обращений к `Date.now()` внутри.
 *
 * Гейт бесплатных ВОПРОСОВ (`FREE_QUESTION_LIMIT` в `quizStore`) — отдельный,
 * исторический слой; spec 063 его не касается.
 */

/**
 * Бесплатные темы (3 из 14). Слаги совпадают с ключами `src/data/topics.ts` и
 * с именами per-topic чанков банка (`src/data/questions/<slug>.json`).
 *
 * Набор заморожен: три темы — «вход» в продукт (базовые инструменты, права
 * доступа, пользователи), остальные 11 открываются Pro или trial-ом.
 */
export const FREE_TOPICS: readonly string[] = [
  'essential_tools',
  'file_permissions',
  'users_groups',
];

/** Длина trial-периода в днях. */
export const TRIAL_DAYS = 7;
/** Длина trial-периода в миллисекундах (источник — `TRIAL_DAYS`). */
export const TRIAL_MS = TRIAL_DAYS * 24 * 3600 * 1000;

/** Тема входит в бесплатный набор. Регистр слага значим — слаги строчные. */
export function isFreeTopic(slug: string): boolean {
  return FREE_TOPICS.includes(slug);
}

/**
 * Активен ли trial.
 *
 * `trialStartedAt === null` — trial не начинался (кнопка «Попробовать 7 дней»
 * не нажата) → `false`. Граница строгая: ровно семь дней после старта считаются
 * истёкшими. `trialStartedAt` из будущего (сбитые часы, переведённая дата) даёт
 * отрицательную разницу и читается как активный trial — доступ не отбирается
 * из-за расхождения часов.
 */
export function isTrialActive(trialStartedAt: number | null, now: number): boolean {
  if (trialStartedAt === null) return false;
  return now - trialStartedAt < TRIAL_MS;
}

export interface PaywallAccessState {
  isPro: boolean;
  trialStartedAt: number | null;
}

/**
 * Доступна ли тема целиком: Pro, активный trial или бесплатный набор.
 * Слаг, которого нет в банке, тоже проходит только по первому/второму условию —
 * список бесплатных тем закрыт.
 */
export function canAccessTopic(
  slug: string,
  state: PaywallAccessState,
  now: number,
): boolean {
  if (state.isPro) return true;
  if (isTrialActive(state.trialStartedAt, now)) return true;
  return isFreeTopic(slug);
}
