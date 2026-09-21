import { useEffect } from 'react';
import { useQuizStore } from '@/store/quizStore';
import Dashboard from '@/presentation/screens/Dashboard';
import Question from '@/presentation/screens/Question';
import Results from '@/presentation/screens/Results';

function App() {
  const currentScreen = useQuizStore((s) => s.currentScreen);
  const loadQuestions = useQuizStore((s) => s.loadQuestions);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  if (currentScreen === 'dashboard') return <Dashboard />;
  if (currentScreen === 'question') return <Question />;
  if (currentScreen === 'results') return <Results />;
  return <Dashboard />;
}

export default App;
