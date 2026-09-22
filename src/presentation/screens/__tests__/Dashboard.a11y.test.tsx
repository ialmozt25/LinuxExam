import { describe, it, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import Dashboard from '@/presentation/screens/Dashboard';
import { useQuizStore } from '@/store/quizStore';
import { testAccessibility } from '@/test/a11y-utils';

describe('Dashboard a11y', () => {
  beforeEach(() => {
    useQuizStore.getState().loadQuestions();
    useQuizStore.setState({ answers: [], currentIndex: 0, streak: 0, totalXp: 0 });
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Dashboard theme="light" onToggleTheme={() => {}} />);
    await testAccessibility(container);
  });
});