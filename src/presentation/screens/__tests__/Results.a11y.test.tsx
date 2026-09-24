import { describe, it, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Results from '@/presentation/screens/Results';
import { useQuizStore } from '@/store/quizStore';
import { testAccessibility } from '@/test/a11y-utils';

describe('Results a11y', () => {
  beforeEach(async () => {
    await useQuizStore.getState().loadQuestions();
    const questions = useQuizStore.getState().questions;
    useQuizStore.setState({
      answers: [
        { questionId: questions[0].id, selectedIndex: 0, isCorrect: true },
        { questionId: questions[1].id, selectedIndex: 0, isCorrect: false },
      ],
      currentIndex: 0,
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Results />);
    await testAccessibility(container);
  });
});