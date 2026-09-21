import { useState } from 'react';
import { useQuizStore, FREE_QUESTION_LIMIT } from '@/store/quizStore';
import { COLORS, SPACING, LAYOUT } from '@/presentation/theme';
import { pluralizeQuestions } from '@/utils/pluralize';
import { defaultPaymentProvider } from '@/platform/payment_provider';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';

/**
 * PAYWALL BEHAVIOR (INTENDED - do not change):
 * A free user at index 2 (the last free question) clicks "Следующий вопрос" and the store raises isPaywallVisible.
 * "Позже" hides the paywall and returns to the dashboard; pressing "Продолжить" comes back to index 2,
 * so the paywall appears again on the next click. currentIndex is deliberately not advanced.
 */
export default function Paywall() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hidePaywall = useQuizStore((s) => s.hidePaywall);
  const unlockPro = useQuizStore((s) => s.unlockPro);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const totalQuestions = useQuizStore((s) => s.questions.length);

  const provider = defaultPaymentProvider;
  const isDisabled = loading || !provider.isAvailable();

  const handlePurchase = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await provider.purchase();
      if (result.success) {
        unlockPro(); // sets isPro: true AND isPaywallVisible: false
        navigateTo('dashboard');
      } else {
        setError(result.error ?? 'Не удалось завершить оплату. Попробуйте ещё раз.');
      }
    } catch {
      setError('Ошибка соединения. Проверьте интернет и попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    hidePaywall();
    navigateTo('dashboard');
  };

  return (
    <ScreenContainer style={{ justifyContent: 'center' }}>
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
          color: COLORS.textSecondary,
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
          background: COLORS.surface,
          padding: SPACING.md,
          borderRadius: LAYOUT.cardRadius,
          marginBottom: SPACING.xl,
        }}
      >
        <div style={{ fontSize: 14, marginBottom: SPACING.sm }}>✓ Все вопросы по всем темам</div>
        <div style={{ fontSize: 14, marginBottom: SPACING.sm }}>
          ✓ Подробные объяснения к каждому
        </div>
        <div style={{ fontSize: 14 }}>✓ Режим экзамена с таймером</div>
      </div>

      {error !== null && (
        <div
          style={{
            color: COLORS.wrong,
            fontSize: 13,
            textAlign: 'center',
            marginBottom: SPACING.md,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={isDisabled}
        onClick={handlePurchase}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: COLORS.primary,
          color: COLORS.textPrimary,
          border: 'none',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 16,
          fontWeight: 600,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          opacity: isDisabled ? 0.6 : 1,
          marginBottom: SPACING.sm,
        }}
      >
        {loading ? 'Обработка…' : provider.label}
      </button>

      <button
        type="button"
        onClick={handleClose}
        disabled={loading}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: 'transparent',
          color: COLORS.textSecondary,
          border: 'none',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 14,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Позже
      </button>

      {/* TODO(payments): add "Оплатить Stars" secondary button in Step 5 */}
    </ScreenContainer>
  );
}
