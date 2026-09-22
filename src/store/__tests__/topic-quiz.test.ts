import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQuizStore } from '../quizStore';
import type { Question } from '@/data/models/Question';

const mockQuestions: Question[] = [
  { id: 'q1', topic: 'file_permissions', difficulty: 'easy',
    question: 'Q1?', options: [
      { text: 'A', correct: true }, { text: 'B', correct: false },
      { text: 'C', correct: false }, { text: 'D', correct: false },
    ], explanation: 'A.' },
  { id: 'q2', topic: 'file_permissions', difficulty: 'easy',
    question: 'Q2?', options: [
      { text: 'A', correct: true }, { text: 'B', correct: false },
      { text: 'C', correct: false }, { text: 'D', correct: false },
    ], explanation: 'A.' },
  { id: 'q3', topic: 'file_management', difficulty: 'easy',
    question: 'Q3?', options: [
      { text: 'A', correct: true }, { text: 'B', correct: false },
      { text: 'C', correct: false }, { text: 'D', correct: false },
    ], explanation: 'A.' },
];

function resetStore() {
  useQuizStore.setState({
    questions: mockQuestions,
    answers: [], reviewAnswers: [], examAnswers: [],
    wrongQuestionIds: [], reviewQuestionIds: null,
    isQuizInProgress: false, currentIndex: 0,
    currentScreen: 'dashboard', activeTopic: null,
    examActive: false, examStartedAt: null, examDurationMs: 0,
    examQuestionIds: [], examLastResult: null,
    isPaywallVisible: false, isPro: false,
    streak: 0, lastActiveDate: null, totalXp: 0,
  });
}

describe('startTopicQuiz', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    resetStore();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('filters questions by topic', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    const s = useQuizStore.getState();
    expect(s.reviewQuestionIds).toHaveLength(2);
    expect(s.reviewQuestionIds).toEqual(expect.arrayContaining(['q1', 'q2']));
  });

  it('sets activeTopic and navigates', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    const s = useQuizStore.getState();
    expect(s.activeTopic).toBe('file_permissions');
    expect(s.currentScreen).toBe('question');
  });

  it('does not mutate questions', () => {
    const before = useQuizStore.getState().questions;
    useQuizStore.getState().startTopicQuiz('file_permissions');
    expect(useQuizStore.getState().questions).toBe(before);
  });

  it('no-op for unknown topic', () => {
    useQuizStore.getState().startTopicQuiz('nonexistent');
    const s = useQuizStore.getState();
    expect(s.reviewQuestionIds).toBeNull();
    expect(s.currentScreen).toBe('dashboard');
  });

  it('startRegularQuiz clears activeTopic', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    useQuizStore.getState().startRegularQuiz();
    expect(useQuizStore.getState().activeTopic).toBeNull();
  });

  it('startReviewQuiz clears activeTopic', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    useQuizStore.getState().startReviewQuiz(['q1']);
    expect(useQuizStore.getState().activeTopic).toBeNull();
  });

  it('nextQuestion clears activeTopic at last topic question', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    useQuizStore.setState({ currentIndex: 1 });
    useQuizStore.getState().nextQuestion();
    expect(useQuizStore.getState().activeTopic).toBeNull();
  });

  it('nextQuestion respects the review pool size', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    useQuizStore.getState().nextQuestion();
    expect(useQuizStore.getState().currentIndex).toBe(1);
    useQuizStore.getState().nextQuestion();
    expect(useQuizStore.getState().currentIndex).toBe(1);
  });

  it('does not persist activeTopic', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('rhcsa_progress') : null;
    expect(raw === null || !raw.includes('activeTopic')).toBe(true);
  });
});
