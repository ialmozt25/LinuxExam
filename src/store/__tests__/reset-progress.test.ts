import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQuizStore } from '../quizStore';
import type { AnswerRecord } from '@/data/models/AnswerRecord';

// resetProgress is the "start over" contract. It must clear every per-run
// stream - including the EXAM stream, which used to survive the reset and leak
// examActive/examStartedAt into the next session - while keeping the user's
// accumulated streak, XP and activity date.

const EXAM_ANSWERS: AnswerRecord[] = [
  { questionId: 'q1', selectedIndex: 0, isCorrect: true },
  { questionId: 'q2', selectedIndex: 1, isCorrect: false },
];

function seedExhaustedExam() {
  useQuizStore.setState({
    examActive: true,
    examStartedAt: Date.now() - 5000,
    examDurationMs: 60000,
    examQuestionIds: ['q1', 'q2'],
    examAnswers: EXAM_ANSWERS,
    examLastResult: {
      answers: EXAM_ANSWERS,
      startedAt: Date.now() - 5000,
      finishedAt: Date.now(),
      durationMs: 60000,
    },
    isQuizInProgress: true,
    currentIndex: 1,
  });
}

describe('resetProgress', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    useQuizStore.setState({
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
      streak: 0,
      lastActiveDate: null,
      totalXp: 0,
    });
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('clears exam state, keeps streak/xp', () => {
    seedExhaustedExam();
    useQuizStore.setState({ streak: 4, totalXp: 120, lastActiveDate: '2026-09-20' });

    useQuizStore.getState().resetProgress();
    const s = useQuizStore.getState();

    // Exam stream: fully cleared.
    expect(s.examActive).toBe(false);
    expect(s.examStartedAt).toBeNull();
    expect(s.examDurationMs).toBe(0);
    expect(s.examQuestionIds).toEqual([]);
    expect(s.examAnswers).toEqual([]);
    expect(s.examLastResult).toBeNull();

    // Accumulated record: untouched.
    expect(s.streak).toBe(4);
    expect(s.totalXp).toBe(120);
    expect(s.lastActiveDate).toBe('2026-09-20');
  });

  it('still clears the regular and review streams', () => {
    seedExhaustedExam();
    useQuizStore.setState({
      answers: [{ questionId: 'q1', selectedIndex: 0, isCorrect: true }],
      reviewAnswers: [{ questionId: 'q2', selectedIndex: 1, isCorrect: false }],
      reviewQuestionIds: ['q2'],
      wrongQuestionIds: ['q2'],
      activeTopic: 'file_permissions',
      isPaywallVisible: true,
    });

    useQuizStore.getState().resetProgress();
    const s = useQuizStore.getState();

    expect(s.answers).toEqual([]);
    expect(s.reviewAnswers).toEqual([]);
    expect(s.reviewQuestionIds).toBeNull();
    expect(s.wrongQuestionIds).toEqual([]);
    expect(s.activeTopic).toBeNull();
    expect(s.isPaywallVisible).toBe(false);
    expect(s.isQuizInProgress).toBe(false);
    expect(s.currentIndex).toBe(0);
  });

  it('a reset exam cannot leak a stale duration into the next exam', () => {
    seedExhaustedExam();
    const staleStart = useQuizStore.getState().examStartedAt;
    expect(staleStart).not.toBeNull();

    useQuizStore.getState().resetProgress();
    expect(useQuizStore.getState().examStartedAt).toBeNull();

    // finishExam is a no-op without a startedAt, so the stale timestamp cannot
    // be revived into a bogus result.
    useQuizStore.getState().finishExam();
    expect(useQuizStore.getState().examLastResult).toBeNull();
    expect(useQuizStore.getState().examActive).toBe(false);
  });
});