import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import Paywall from '@/presentation/screens/Paywall';
import { useQuizStore } from '@/store/quizStore';
import { testAccessibility } from '@/test/a11y-utils';

describe('Paywall a11y', () => {
  it('has no accessibility violations', async () => {
    await useQuizStore.getState().loadQuestions();

    const { container } = render(<Paywall />);
    await testAccessibility(container);
  });
});