import { useEffect } from 'react';
import { useQuizStore } from '@/store/quizStore';

/**
 * Placeholder root component — proves store wiring.
 *
 * TODO(screens): Replace with real quiz UI (home, quiz, results screens).
 */
function App() {
  const { questions, isLoading, isPro, loadQuestions, canAccessQuestion } = useQuizStore();

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Тренажёр RHCSA</h1>
        <p className="text-gray-600 mb-6">Подготовка к сертификации Linux</p>

        {isLoading ? (
          <p className="text-gray-500">Загрузка вопросов…</p>
        ) : (
          <div className="space-y-2 text-sm text-gray-700">
            <p>Вопросов загружено: {questions.length}</p>
            <p>Статус: {isPro ? 'PRO' : 'Бесплатный'}</p>
            <p>Доступно вопросов: {questions.filter((_, i) => canAccessQuestion(i)).length}</p>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          TODO: экраны викторины, адаптер Telegram, оплата
        </p>
      </div>
    </div>
  );
}

export default App;
