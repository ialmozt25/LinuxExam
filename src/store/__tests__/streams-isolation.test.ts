import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQuizStore } from '../quizStore';
import type { Question } from '@/data/models/Question';

// Fixture mirrors the real bank's shape: exactly one correct option, and here
// it sits at index 0 (index 1 is the wrong-answer probe).
const mockQuestions: Question[] = [
  {
    id: 'q1',
    topic: 'file_permissions',
    difficulty: 'easy',
    question: 'Q1?',
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: 'A.',
  },
  {
    id: 'q2',
    topic: 'file_permissions',
    difficulty: 'easy',
    question: 'Q2?',
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: 'A.',
  },
  {
    id: 'q3',
    topic: 'file_management',
    difficulty: 'easy',
    question: 'Q3?',
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: 'A.',
  },
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

describe('answerReview updates wrongQuestionIds (unified rule)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    resetStore();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('correct answer removes from wrongQuestionIds', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1', 'q2'] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 0);
    const s = useQuizStore.getState();
    expect(s.wrongQuestionIds).not.toContain('q1');
    expect(s.wrongQuestionIds).toContain('q2');
  });

  it('correct answer retires the question, shrinking the dashboard counter', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1', 'q2', 'q3'] });
    expect(useQuizStore.getState().wrongQuestionIds).toHaveLength(3);
    useQuizStore.getState().startReviewQuiz(['q1', 'q2', 'q3']);
    useQuizStore.getState().answerReview('q1', 0);
    expect(useQuizStore.getState().wrongQuestionIds).toHaveLength(2);
    useQuizStore.getState().answerReview('q2', 0);
    expect(useQuizStore.getState().wrongQuestionIds).toHaveLength(1);
  });

  it('wrong answer keeps question in wrongQuestionIds', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1'] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 1);
    expect(useQuizStore.getState().wrongQuestionIds).toContain('q1');
  });

  it('wrong answer adds if not present', () => {
    useQuizStore.setState({ wrongQuestionIds: [] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 1);
    expect(useQuizStore.getState().wrongQuestionIds).toContain('q1');
  });

  it('answerExam does NOT touch wrongQuestionIds', () => {
    const wrongBefore = ['q1'];
    useQuizStore.setState({ wrongQuestionIds: wrongBefore });
    useQuizStore.getState().startExam(1, 60000);
    // startExam leaves wrongQuestionIds alone; re-seed only if that ever changes.
    if (useQuizStore.getState().wrongQuestionIds.length === 0) {
      useQuizStore.setState({ wrongQuestionIds: wrongBefore });
    }
    useQuizStore.getState().answerExam('q1', 0);
    expect(useQuizStore.getState().wrongQuestionIds).toEqual(wrongBefore);
  });

  it('does not rewrite wrongQuestionIds when membership is unchanged', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1'] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    const before = useQuizStore.getState().wrongQuestionIds;
    useQuizStore.getState().answerReview('q1', 1);
    expect(useQuizStore.getState().wrongQuestionIds).toBe(before);
  });
});
