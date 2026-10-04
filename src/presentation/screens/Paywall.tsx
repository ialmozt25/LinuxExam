import { useState } from 'react';
import { useQuizStore, FREE_QUESTION_LIMIT } from '@/store/quizStore';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { pluralizeQuestions } from '@/utils/pluralize';
import { AVAILABLE_TOPICS } from '@/data/topics';
import { FREE_TOPICS, TRIAL_DAYS } from '@/domain/paywall';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { AppHeader } from '@/presentation/components/AppHeader';
import { DEFAULT_PLAN_ID, PAYMENT_PLANS, type PaymentPlanId } from '@/platform/config';
import { createInvoiceLink, openInvoice } from '@/platform/payment_provider';

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
 *
 * spec 064 заменила заглушку покупки реальным потоком Telegram Stars: выбор
 * тарифа (`PAYMENT_PLANS` из `src/platform/config.ts`) → инвойс нашего backend'а
 * → окно инвойса Telegram. Pro выдаёт КЛИЕНТ по статусу `paid` (MVP-граница
 * spec 064); серверной верификации платежа здесь нет — это spec 066.
 */

const BENEFITS = [
  '✓ Все вопросы по всем темам',
  '✓ Подробные объяснения к каждому',
  '✓ Режим экзамена с таймером',
] as const;

export default function Paywall() {
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanId>(DEFAULT_PLAN_ID);
  const [isProcessing, setIsProcessing] = useState(false);

  const hidePaywall = useQuizStore((s) => s.hidePaywall);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const startTrial = useQuizStore((s) => s.startTrial);
  // spec 064: существующий экшен store, НЕ дублируется здесь — он же ставит
  // `isPaywallVisible: false`, и потому после успешной оплаты достаточно уйти
  // на dashboard.
  const unlockPro = useQuizStore((s) => s.unlockPro);
  const totalQuestions = useQuizStore((s) => s.questions.length);

  // Списки тем для секций. Заголовки берутся из реестра `src/data/topics.ts`,
  // а не дублируются строками: реестр — единственный источник подписей.
  const freeTitles = AVAILABLE_TOPICS.filter((t) => FREE_TOPICS.includes(t.key)).map(
    (t) => t.title
  );
  const paidTitles = AVAILABLE_TOPICS.filter((t) => !FREE_TOPICS.includes(t.key)).map(
    (t) => t.title
  );

  // Цена на кнопке следует за выбранным тарифом; fallback нужен только на случай
  // рассинхрона констант и не достижим при `selectedPlan: PaymentPlanId`.
  const activePlan = PAYMENT_PLANS.find((plan) => plan.id === selectedPlan) ?? PAYMENT_PLANS[0];

  /**
   * spec 064: покупка. Два шага — инвойс у нашего backend'а, затем окно инвойса
   * Telegram. `isProcessing` держит кнопку задизейбленной, пока окно открыто:
   * повторный клик открыл бы второй инвойс.
   */
  const handlePurchase = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setNotice(null);
    try {
      const invoiceUrl = await createInvoiceLink(selectedPlan);
      const status = await openInvoice(invoiceUrl);
      if (status === 'paid') {
        unlockPro();
        navigateTo('dashboard');
        return;
      }
      // cancelled / failed / pending — экран остаётся paywall, Pro не выдаётся.
      setNotice('Оплата не завершена');
    } catch {
      // Ненастроенный backend (`Payment backend not configured`) и недоступное
      // окно инвойса приходят сюда одинаково: наружу — одна понятная фраза.
      setNotice('Не удалось начать оплату. Попробуйте позже.');
    } finally {
      setIsProcessing(false);
    }
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
          fontSize: 'var(--heading-2)',
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
          fontSize: 'var(--body)',
          lineHeight: 'var(--body-line-height)',
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
        {BENEFITS.map((line, index) => (
          <div
            key={line}
            style={{
              fontSize: 'var(--text-sm)',
              marginBottom: index === BENEFITS.length - 1 ? 0 : SPACING.sm,
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

      {/* spec 064: тарифы. Список и цены — из PAYMENT_PLANS (config.ts), не из
          разметки: те же три пары «подпись + цена» уходят в Bot API. */}
      <fieldset
        data-testid="paywall-plans"
        style={{
          border: 'none',
          padding: 0,
          margin: 0,
          marginBottom: SPACING.md,
        }}
      >
        <legend
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            padding: 0,
            marginBottom: SPACING.sm,
          }}
        >
          Тариф
        </legend>
        {PAYMENT_PLANS.map((plan) => (
          <label
            key={plan.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
              padding: SPACING.sm,
              marginBottom: SPACING.xs,
              borderRadius: 'var(--btn-secondary-radius)',
              border: `1px solid ${plan.id === selectedPlan ? 'var(--accent)' : 'var(--border-subtle)'}`,
              cursor: isProcessing ? 'default' : 'pointer',
            }}
          >
            <input
              type="radio"
              name="payment-plan"
              value={plan.id}
              data-testid={`plan-${plan.id}`}
              checked={plan.id === selectedPlan}
              disabled={isProcessing}
              onChange={() => setSelectedPlan(plan.id)}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 14 }}>{`${plan.label} — ${plan.stars} Stars`}</span>
          </label>
        ))}
      </fieldset>

      {notice !== null && (
        <div
          data-testid="paywall-purchase-notice"
          role="status"
          aria-live="polite"
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
          color: 'var(--btn-primary-text)',
          border: 'none',
          borderRadius: 'var(--btn-primary-radius)',
          fontSize: 'var(--body)',
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
        disabled={isProcessing}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--btn-secondary-radius)',
          fontSize: 'var(--body)',
          fontWeight: 600,
          cursor: isProcessing ? 'default' : 'pointer',
          opacity: isProcessing ? 0.6 : 1,
          fontFamily: 'inherit',
          marginBottom: SPACING.sm,
        }}
      >
        {isProcessing ? 'Открываем оплату…' : `Купить за ${activePlan.stars} Stars`}
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
          borderRadius: 'var(--btn-secondary-radius)',
          fontSize: 'var(--text-sm)',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Не сейчас
      </button>
    </ScreenContainer>
  );
}
