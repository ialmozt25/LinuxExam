import { useState } from 'react';
import { useQuizStore, FREE_QUESTION_LIMIT } from '@/store/quizStore';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { pluralizeQuestions } from '@/utils/pluralize';
import { AVAILABLE_TOPICS } from '@/data/topics';
import { FREE_TOPICS, TRIAL_DAYS } from '@/domain/paywall';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { AppHeader } from '@/presentation/components/AppHeader';

/**
 * PAYWALL BEHAVIOR (INTENDED - do not change):
 * A free user at index 2 (the last free question) clicks "Следующий вопрос" and the store raises isPaywallVisible.
 * "Позже" hides the paywall and returns to the dashboard; pressing "Продолжить" comes back to index 2,
 * so the paywall appears again on the next click. currentIndex is deliberately not advanced.
 *
 * spec 063 добавила ВТОРОЙ вход на этот же экран — контентный: клик по платной
 * теме на Dashboard (`Dashboard.tsx`) при `!isPro` и неактивном trial. Разметка
 * ниже — общая для обоих входов: гейт бесплатных вопросов (`isPaywallVisible`)
 * остался в `Question.tsx` и не переписывался.
 */

const PLANS = [
  '✓ Все вопросы по всем темам',
  '✓ Подробные объяснения к каждому',
  '✓ Режим экзамена с таймером',
] as const;

export default function Paywall() {
  const [notice, setNotice] = useState<string | null>(null);

  const hidePaywall = useQuizStore((s) => s.hidePaywall);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const startTrial = useQuizStore((s) => s.startTrial);
  const totalQuestions = useQuizStore((s) => s.questions.length);

  // Списки тем для секций. Заголовки берутся из реестра `src/data/topics.ts`,
  // а не дублируются строками: реестр — единственный источник подписей.
  const freeTitles = AVAILABLE_TOPICS.filter((t) => FREE_TOPICS.includes(t.key)).map(
    (t) => t.title
  );
  const paidTitles = AVAILABLE_TOPICS.filter((t) => !FREE_TOPICS.includes(t.key)).map(
    (t) => t.title
  );

  // spec 064 подключит реальную оплату. Здесь — осознанная заглушка: платёжный
  // flow не открывается, `provider.purchase()` не вызывается.
  const handlePurchase = () => {
    setNotice('Оплата появится в spec 064 — сейчас подписку оформить нельзя.');
  };

  const handleStartTrial = () => {
    startTrial();
    hidePaywall();
    navigateTo('dashboard');
  };

  const handleClose = () => {
    hidePaywall();
    navigateTo('dashboard');
  };

  return (
    <ScreenContainer data-testid="paywall" style={{ justifyContent: 'center' }}>
      <AppHeader onHome={handleClose} center="LinuxExam" />
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          textAlign: 'center',
          margin: 0,
          marginBottom: SPACING.md,
        }}
      >
        Бесплатные вопросы закончились
      </h2>

      <p
        style={{
          color: 'var(--text-secondary)',
          textAlign: 'center',
          margin: 0,
          marginBottom: SPACING.xl,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {`Вы ответили на ${FREE_QUESTION_LIMIT} ${pluralizeQuestions(FREE_QUESTION_LIMIT)}. Откройте все ${totalQuestions} ${pluralizeQuestions(totalQuestions)} с объяснениями.`}
      </p>

      <div
        style={{
          background: 'var(--bg-surface)',
          padding: SPACING.md,
          borderRadius: LAYOUT.cardRadius,
          marginBottom: SPACING.xl,
        }}
      >
        {PLANS.map((line, index) => (
          <div
            key={line}
            style={{
              fontSize: 14,
              marginBottom: index === PLANS.length - 1 ? 0 : SPACING.sm,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* spec 063: что именно бесплатно и что открывает Pro. */}
      <div
        data-testid="paywall-free-topics"
        style={{
          background: 'var(--bg-surface)',
          padding: SPACING.md,
          borderRadius: LAYOUT.cardRadius,
          marginBottom: SPACING.md,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: SPACING.sm }}>
          {`Бесплатно: ${FREE_TOPICS.length} темы`}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {freeTitles.join(' · ')}
        </div>
      </div>

      <div
        data-testid="paywall-paid-topics"
        style={{
          background: 'var(--bg-surface)',
          padding: SPACING.md,
          borderRadius: LAYOUT.cardRadius,
          marginBottom: SPACING.xl,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: SPACING.sm }}>
          {`Pro: ${paidTitles.length} тем + Exam + Analytics`}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {paidTitles.join(' · ')}
        </div>
      </div>

      {notice !== null && (
        <div
          data-testid="paywall-purchase-notice"
          style={{
            color: 'var(--text-secondary)',
            fontSize: 13,
            textAlign: 'center',
            marginBottom: SPACING.md,
            lineHeight: 1.4,
          }}
        >
          {notice}
        </div>
      )}

      <button
        type="button"
        data-testid="paywall-start-trial"
        onClick={handleStartTrial}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: 'var(--accent)',
          color: 'var(--text-primary)',
          border: 'none',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: SPACING.sm,
        }}
      >
        {`Попробовать ${TRIAL_DAYS} дней бесплатно`}
      </button>

      <button
        type="button"
        data-testid="paywall-buy"
        onClick={handlePurchase}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--accent)',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 16,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: SPACING.sm,
        }}
      >
        Купить — 299 Stars/мес
      </button>

      <button
        type="button"
        data-testid="paywall-later"
        onClick={handleClose}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: 'transparent',
          color: 'var(--text-secondary)',
          border: 'none',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 14,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Не сейчас
      </button>

      {/* TODO(payments): заменить заглушку реальным потоком оплаты (spec 064). */}
    </ScreenContainer>
  );
}
