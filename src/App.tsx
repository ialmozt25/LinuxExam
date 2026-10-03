import { lazy, Suspense, useEffect } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { isTelegramWebApp, getTelegramUser } from '@/platform/telegram_adapter';
import { useThemeController } from '@/hooks/useThemeController';
import { useNeedsOnboarding } from '@/store/onboarding';

/**
 * Screens are code-split. React, the store, the theme controller and the DEV badge
 * stay in the initial chunk, while each screen carries its own dependencies
 * (motion, lucide icons, the screen-level Telegram hooks) in a separate chunk.
 * The Dashboard is the first screen and therefore loads immediately; Question and
 * Results only when navigation reaches them.
 */
const Dashboard = lazy(() => import('@/presentation/screens/Dashboard'));
const Question = lazy(() => import('@/presentation/screens/Question'));
const Results = lazy(() => import('@/presentation/screens/Results'));
// Exam mode (spec 054): настройка → прогон → итоги. Отдельный поток от
// исторического инлайн-экзамена в Question.tsx (examActive).
const ExamSetup = lazy(() => import('@/presentation/screens/ExamSetup'));
const ExamRun = lazy(() => import('@/presentation/screens/ExamRun'));
const ExamResults = lazy(() => import('@/presentation/screens/ExamResults'));
// Analytics (spec 058): «персональный тренер» — radar по темам, готовность,
// слабые зоны и тренд за 7 дней. Данные — из уже персистируемого questionStats.
const Analytics = lazy(() => import('@/presentation/screens/Analytics'));
// Paywall: экран лимита бесплатных вопросов. Подключён к роутеру (spec 059),
// чтобы его можно было смонтировать напрямую; штатный вход по-прежнему из
// Question.tsx по флагу isPaywallVisible.
const Paywall = lazy(() => import('@/presentation/screens/Paywall'));
// Онбординг (spec 060): цель → демо-квиз → результат. Показывается только новому
// пользователю — гейт useNeedsOnboarding (пустая статистика + незавершённый онбординг).
const OnboardingGoal = lazy(() => import('@/presentation/screens/OnboardingGoal'));
const OnboardingDemo = lazy(() => import('@/presentation/screens/OnboardingDemo'));
const OnboardingResult = lazy(() => import('@/presentation/screens/OnboardingResult'));

function Loading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Загрузка…
    </div>
  );
}

function App() {
  // Single source of truth: follows Telegram inside the client, the OS outside,
  // and re-applies on every live theme change. Publishes live --tg-theme-* too.
  const { resolved, toggle } = useThemeController();

  const currentScreen = useQuizStore((s) => s.currentScreen);
  const loadQuestions = useQuizStore((s) => s.loadQuestions);
  const isLoading = useQuizStore((s) => s.isLoading);
  const needsOnboarding = useNeedsOnboarding();
  const navigateTo = useQuizStore((s) => s.navigateTo);

  useEffect(() => {
    // Fire-and-forget: the async action reports progress through `isLoading`.
    void loadQuestions();
  }, [loadQuestions]);

  // Онбординг-гейт (spec 060): новый пользователь стартует на 'dashboard', поэтому
  // единственная точка входа — перенаправление с него. Эффект намеренно не
  // перебивает уже выбранный экран: 'question' после reload, 'paywall' и прочие
  // потоки остаются нетронутыми.
  useEffect(() => {
    if (needsOnboarding && currentScreen === 'dashboard') {
      navigateTo('onboarding-goal');
    }
  }, [needsOnboarding, currentScreen, navigateTo]);

  // The bank arrives as per-topic chunks. Until it is in place every screen would
  // render an empty bank (topic counts of 0, no current question), so gate on it.
  if (isLoading) {
    return <Loading />;
  }

  const screen =
    currentScreen === 'dashboard' ? (
      <Dashboard theme={resolved} onToggleTheme={toggle} />
    ) : currentScreen === 'question' ? (
      <Question />
    ) : currentScreen === 'results' ? (
      <Results />
    ) : currentScreen === 'exam-setup' ? (
      <ExamSetup />
    ) : currentScreen === 'exam-run' ? (
      <ExamRun />
    ) : currentScreen === 'exam-results' ? (
      <ExamResults />
    ) : currentScreen === 'analytics' ? (
      <Analytics />
    ) : currentScreen === 'paywall' ? (
      <Paywall />
    ) : currentScreen === 'onboarding-goal' ? (
      <OnboardingGoal />
    ) : currentScreen === 'onboarding-demo' ? (
      <OnboardingDemo />
    ) : currentScreen === 'onboarding-result' ? (
      <OnboardingResult />
    ) : (
      <Dashboard theme={resolved} onToggleTheme={toggle} />
    );

  return (
    <>
      {/* The lazy screen chunk is fetched on first render of that screen. */}
      <Suspense fallback={<Loading />}>{screen}</Suspense>

      {import.meta.env.DEV && (
        <div
          style={{
            position: 'fixed',
            bottom: 4,
            left: 4,
            fontSize: 10,
            color: '#666',
            padding: 4,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 4,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          {isTelegramWebApp() ? `TG: ${getTelegramUser()?.first_name ?? 'user'}` : 'Web mode'}
        </div>
      )}
    </>
  );
}

export default App;
