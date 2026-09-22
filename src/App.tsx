import { useEffect } from 'react';
import { useQuizStore } from '@/store/quizStore';
import Dashboard from '@/presentation/screens/Dashboard';
import Question from '@/presentation/screens/Question';
import Results from '@/presentation/screens/Results';
import { isTelegramWebApp, getTelegramUser } from '@/platform/telegram_adapter';
import { useThemeController } from '@/hooks/useThemeController';

function App() {
  // Single source of truth: follows Telegram inside the client, the OS outside,
  // and re-applies on every live theme change. Publishes live --tg-theme-* too.
  const { resolved, toggle } = useThemeController();

  const currentScreen = useQuizStore((s) => s.currentScreen);
  const loadQuestions = useQuizStore((s) => s.loadQuestions);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const screen =
    currentScreen === 'dashboard' ? (
      <Dashboard theme={resolved} onToggleTheme={toggle} />
    ) : currentScreen === 'question' ? (
      <Question />
    ) : currentScreen === 'results' ? (
      <Results />
    ) : (
      <Dashboard theme={resolved} onToggleTheme={toggle} />
    );

  return (
    <>
      {screen}

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
