import { describe, it, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Question from '@/presentation/screens/Question';
import { useQuizStore } from '@/store/quizStore';
import { testAccessibility } from '@/test/a11y-utils';

describe('Question a11y', () => {
  beforeEach(() => {
    useQuizStore.getState().loadQuestions();
    useQuizStore.setState({
      currentIndex: 0,
      answers: [],
      isPaywallVisible: false,
      streak: 0,
      totalXp: 0,
    });
  });

  it('unanswered question has no accessibility violations', async () => {
    const { container } = render(<Question />);
    await testAccessibility(container);
  });

  it('answered question with explanation has no accessibility violations', async () => {
    const first = useQuizStore.getState().questions[0];
    useQuizStore.getState().answerQuestion(first.id, 0);

    const { container } = render(<Question />);
    await testAccessibility(container);
  });
});