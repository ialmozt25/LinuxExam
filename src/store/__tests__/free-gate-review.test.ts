import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQuizStore, FREE_QUESTION_LIMIT } from '../quizStore';
import type { Question } from '@/data/models/Question';

// B1: nextQuestion applied FREE_QUESTION_LIMIT to EVERY non-exam stream, but
// Question.tsx hides the paywall for review - so a free user froze at the limit
// with no paywall to act on. Review must bypass the gate, exactly like exam.

function makeQuestion(id: string, topic: Question['topic']): Question {
  return {
    id,
    topic,
    difficulty: 'easy',
    question: `${id}?`,
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: 'A.',
  };
}

// 12 file_permissions questions, mirroring the real bank (12 per topic).
const FP_IDS = Array.from({ length: 12 }, (_, i) => `fp_${String(i + 1).padStart(3, '0')}`);
const mockQuestions: Question[] = [
  ...FP_IDS.map((id) => makeQuestion(id, 'file_permissions')),
  ...Array.from({ length: 6 }, (_, i) => makeQuestion(`fm_${i + 1}`, 'file_management')),
];

function resetStore() {
  useQuizStore.setState({
    questions: mockQuestions,
    answers: [],
    reviewAnswers: [],
    examAnswers: [],
    wrongQuestionIds: [],
    reviewQuestionIds: null,
    isQuizInProgress: false,
    currentIndex: 0,
    currentScreen: 'dashboard',
    activeTopic: null,
    examActive: false,
    examStartedAt: null,
    examDurationMs: 0,
    examQuestionIds: [],
    examLastResult: null,
    isPaywallVisible: false,
    isPro: false,
    streak: 0,
    lastActiveDate: null,
    totalXp: 0,
  });
}

describe('nextQuestion free-question gate', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    resetStore();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('review stream advances past the limit for a free user without a paywall', () => {
    useQuizStore.setState({
      reviewQuestionIds: FP_IDS,
      currentIndex: FREE_QUESTION_LIMIT - 1,
      isPro: false,
    });

    useQuizStore.getState().nextQuestion();
    const s = useQuizStore.getState();

    expect(s.currentIndex).toBe(FREE_QUESTION_LIMIT);
    expect(s.isPaywallVisible).toBe(false);
  });

  it('a free user can walk a whole topic run to the last question', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    expect(useQuizStore.getState().reviewQuestionIds).toHaveLength(12);

    for (let i = 0; i < 11; i++) {
      useQuizStore.getState().nextQuestion();
      expect(useQuizStore.getState().isPaywallVisible).toBe(false);
    }
    expect(useQuizStore.getState().currentIndex).toBe(11);
    // The pool boundary still holds: no advance past the last question.
    useQuizStore.getState().nextQuestion();
    expect(useQuizStore.getState().currentIndex).toBe(11);
  });

  it('regular stream is still blocked at the limit for a free user', () => {
    useQuizStore.setState({
      reviewQuestionIds: null,
      currentIndex: FREE_QUESTION_LIMIT - 1,
      isPro: false,
    });

    useQuizStore.getState().nextQuestion();
    const s = useQuizStore.getState();

    expect(s.currentIndex).toBe(FREE_QUESTION_LIMIT - 1);
    expect(s.isPaywallVisible).toBe(true);
  });

  it('regular stream still unblocks for a pro user', () => {
    useQuizStore.setState({
      reviewQuestionIds: null,
      currentIndex: FREE_QUESTION_LIMIT - 1,
      isPro: true,
    });

    useQuizStore.getState().nextQuestion();
    const s = useQuizStore.getState();

    expect(s.currentIndex).toBe(FREE_QUESTION_LIMIT);
    expect(s.isPaywallVisible).toBe(false);
  });

  it('exam stream stays ungated', () => {
    useQuizStore.getState().startExam(20, 60_000);
    useQuizStore.setState({ currentIndex: FREE_QUESTION_LIMIT - 1, isPro: false });

    useQuizStore.getState().nextQuestion();
    const s = useQuizStore.getState();

    expect(s.currentIndex).toBe(FREE_QUESTION_LIMIT);
    expect(s.isPaywallVisible).toBe(false);
  });

  it('review does not skip its own pool boundary in favour of the gate', () => {
    // A 6-question review pool with the limit at 5: index 5 is reachable because
    // the gate no longer applies, and the pool end still clears activeTopic.
    const ids = FP_IDS.slice(0, 6);
    useQuizStore.setState({
      reviewQuestionIds: ids,
      currentIndex: ids.length - 1,
      activeTopic: 'file_permissions',
      isPro: false,
    });

    useQuizStore.getState().nextQuestion();
    const s = useQuizStore.getState();

    expect(s.currentIndex).toBe(ids.length - 1);
    expect(s.activeTopic).toBeNull();
    expect(s.isPaywallVisible).toBe(false);
  });
});