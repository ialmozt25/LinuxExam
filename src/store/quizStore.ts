import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Question, Topic } from '@/data/models/Question';
import { AnswerRecord } from '@/data/models/AnswerRecord';
import { QuestionRepository } from '@/data/repositories/QuestionRepository';
import { filterByTopic, getCurrentQuestion } from '@/domain/selectors';
import { calculateProgress, ProgressMetrics } from '@/domain/quizService';

/**
 * TODO(payments): Replace mock unlockPro with real Stripe / Telegram Stars provider.
 * TODO(screens): Connect to quiz UI screens in a later step.
 * TODO(telegram): Wire Telegram WebApp adapter when targeting Telegram.
 */

// TODO(content): raise to 20 after questions.json reaches 50+ items
export const FREE_QUESTION_LIMIT = 5;

export type Screen = 'dashboard' | 'question' | 'results';

interface QuizState {
  questions: Question[];
  currentIndex: number;
  answers: AnswerRecord[];
  isPro: boolean;
  isLoading: boolean;
  isPaywallVisible: boolean;
  currentScreen: Screen;
  streak: number;
  lastActiveDate: string | null;
  totalXp: number;

  // Wrong-answer tracking for the regular stream (feeds review mode)
  wrongQuestionIds: string[];

  // REVIEW stream — fully isolated from 'answers'
  reviewQuestionIds: string[] | null;
  reviewAnswers: AnswerRecord[];

  // Resume support
  isQuizInProgress: boolean;

  // Which topic quiz is running (null = regular / review / exam).
  // Session-only: deliberately NOT persisted.
  activeTopic: string | null;

  // Exam mode. Only the gate + last-result slot are introduced here; COMMIT B
  // adds the rest of the exam state (timing, question ids, answers, actions).
  examActive: boolean;
  examLastResult: {
    answers: AnswerRecord[];
    startedAt: number;
    finishedAt: number;
    durationMs: number;
  } | null;
  examStartedAt: number | null;
  examDurationMs: number;
  examQuestionIds: string[];
  examAnswers: AnswerRecord[];

  loadQuestions: () => void;
  recordActivity: () => void;
  navigateTo: (screen: Screen) => void;
  answerQuestion: (questionId: string, selectedIndex: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  resetProgress: () => void;
  unlockPro: () => void;
  hidePaywall: () => void;
  canAccessQuestion: (index: number) => boolean;
  getQuestionsByTopic: (topic: Topic) => Question[];
  getCurrentQuestion: () => Question | null;
  getProgress: () => ProgressMetrics;
  getActiveQuestions: () => Question[];
  resumeQuiz: () => void;
  startReviewQuiz: (ids: string[]) => void;
  answerReview: (questionId: string, selectedIndex: number) => void;
  startRegularQuiz: () => void;
  startTopicQuiz: (topic: string) => void;
  startExam: (count: number, durationMs: number) => void;
  answerExam: (questionId: string, selectedIndex: number) => void;
  finishExam: () => void;
  cancelExam: () => void;
}

const questionRepo = new QuestionRepository();

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      questions: [],
      currentIndex: 0,
      answers: [],
      isPro: false,
      isLoading: false,
      isPaywallVisible: false,
      currentScreen: 'dashboard',
      streak: 0,
      lastActiveDate: null,
      totalXp: 0,
      wrongQuestionIds: [],
      reviewQuestionIds: null,
      reviewAnswers: [],
      isQuizInProgress: false,
      activeTopic: null,
      examActive: false,
      examLastResult: null,
      examStartedAt: null,
      examDurationMs: 0,
      examQuestionIds: [],
      examAnswers: [],

      loadQuestions: () => {
        set({ isLoading: true });
        const questions = questionRepo.getAll();
        set({
          questions,
          isLoading: false,
        });
      },

      navigateTo: (screen) => set({ currentScreen: screen }),

      // Explicitly leaves review mode and returns to the regular stream.
      // Does NOT touch answers or wrongQuestionIds. It clears examLastResult only
      // so a finished exam summary cannot resurface; a running exam is untouched.
      startRegularQuiz: () =>
        set({
          reviewQuestionIds: null,
          reviewAnswers: [],
          currentIndex: 0,
          activeTopic: null,
          // Drop any previous exam summary so Results cannot show a stale one.
          examLastResult: null,
        }),

      // Starts a topic quiz. Reuses the REVIEW stream (reviewQuestionIds /
      // reviewAnswers) and tags it with activeTopic so it is distinguishable
      // from "Повторить ошибки" without a fourth answer stream.
      startTopicQuiz: (topic) => {
        const { questions } = get();
        const filtered = questions.filter((q) => q.topic === topic);
        if (filtered.length === 0) return;
        const shuffled = [...filtered];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        set({
          reviewQuestionIds: shuffled.map((q) => q.id),
          reviewAnswers: [],
          currentIndex: 0,
          isQuizInProgress: true,
          currentScreen: 'question',
          activeTopic: topic,
          examActive: false,
          examLastResult: null,
        });
      },

      recordActivity: () => {
        const today = new Date().toISOString().slice(0, 10);
        const { lastActiveDate, streak, totalXp } = get();
        if (lastActiveDate === today) return;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        set({
          streak: lastActiveDate === yesterday ? streak + 1 : 1,
          lastActiveDate: today,
          totalXp: totalXp + 10,
        });
      },

      answerQuestion: (questionId, selectedIndex) => {
        if (!get().canAccessQuestion(get().currentIndex)) {
          return;
        }
        const question = get().questions.find((q) => q.id === questionId);
        if (!question) return;
        if (selectedIndex < 0 || selectedIndex >= question.options.length) return;
        const isCorrect = question.options[selectedIndex].correct;
        const record: AnswerRecord = { questionId, selectedIndex, isCorrect };
        const existingIndex = get().answers.findIndex((a) => a.questionId === questionId);
        const answers =
          existingIndex >= 0
            ? get().answers.map((a, i) => (i === existingIndex ? record : a))
            : [...get().answers, record];
        set({ answers });

        // Wrong-answer bookkeeping for review mode. This MUST NOT touch
        // reviewAnswers or examAnswers - the three streams stay isolated.
        const { wrongQuestionIds } = get();
        if (!isCorrect && !wrongQuestionIds.includes(questionId)) {
          set({ wrongQuestionIds: [...wrongQuestionIds, questionId] });
        } else if (isCorrect && wrongQuestionIds.includes(questionId)) {
          set({ wrongQuestionIds: wrongQuestionIds.filter((id) => id !== questionId) });
        }
        set({ isQuizInProgress: true });

        get().recordActivity();
      },

      nextQuestion: () => {
        const { currentIndex, questions, examActive, examQuestionIds, isPro, activeTopic, reviewQuestionIds } =
          get();
        // JOB 0: the pool must follow the ACTIVE stream. Without the review
        // branch a topic/review quiz would run past its own pool into questions
        // the Question screen does not even render.
        const poolSize = examActive
          ? examQuestionIds.length
          : reviewQuestionIds
            ? reviewQuestionIds.length
            : questions.length;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= poolSize) {
          // 1.4: end of a topic quiz - drop the flag so the Dashboard stops
          // presenting it as the active topic.
          if (activeTopic !== null) set({ activeTopic: null });
          return;
        }
        // Exam is never paywalled - the whole point is a full timed run.
        if (!examActive && nextIndex >= FREE_QUESTION_LIMIT && !isPro) {
          set({ isPaywallVisible: true });
          return;
        }
        set({ currentIndex: nextIndex });
      },

      previousQuestion: () => {
        const { currentIndex, examActive } = get();
        // No back-navigation in exam mode.
        if (examActive) return;
        if (currentIndex > 0) {
          set({ currentIndex: currentIndex - 1 });
        }
      },

      resetProgress: () => {
        set({
          answers: [],
          currentIndex: 0,
          isPaywallVisible: false,
          isQuizInProgress: false,
          wrongQuestionIds: [],
          reviewQuestionIds: null,
          reviewAnswers: [],
          activeTopic: null,
        });
      },

      unlockPro: () => {
        // TODO(payments): Integrate real payment verification here.
        set({ isPro: true, isPaywallVisible: false });
      },

      hidePaywall: () => {
        set({ isPaywallVisible: false });
      },

      canAccessQuestion: (index: number): boolean => {
        return index < FREE_QUESTION_LIMIT || get().isPro;
      },

      getQuestionsByTopic: (topic: Topic): Question[] => {
        return filterByTopic(get().questions, topic);
      },

      getCurrentQuestion: (): Question | null => {
        return getCurrentQuestion(get().questions, get().currentIndex);
      },

      getProgress: (): ProgressMetrics => {
        return calculateProgress(get().answers, get().questions.length);
      },

      // Returns the regular question list, or the review subset when a review
      // session is active. Callers must use this instead of filtering questions
      // themselves so indexes stay aligned with this store.
      getActiveQuestions: (): Question[] => {
        const { questions, reviewQuestionIds } = get();
        if (!reviewQuestionIds) return questions;
        return questions.filter((q) => reviewQuestionIds.includes(q.id));
      },

      resumeQuiz: () => set({ currentScreen: 'question' }),

      startReviewQuiz: (ids) =>
        set({
          reviewQuestionIds: ids,
          reviewAnswers: [],
          currentIndex: 0,
          isQuizInProgress: true,
          currentScreen: 'question',
          activeTopic: null,
          // A finished exam summary must not resurface in review mode.
          examLastResult: null,
        }),

      // REVIEW stream. Deliberately bypasses canAccessQuestion: review is a
      // post-hoc study mode, not new question consumption.
      answerReview: (questionId, selectedIndex) => {
        const { questions, reviewAnswers } = get();
        const question = questions.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options[selectedIndex];
        if (!option) return;
        const record: AnswerRecord = { questionId, selectedIndex, isCorrect: option.correct };
        const existingIndex = reviewAnswers.findIndex((a) => a.questionId === questionId);
        const next =
          existingIndex >= 0
            ? reviewAnswers.map((a, i) => (i === existingIndex ? record : a))
            : [...reviewAnswers, record];
        set({ reviewAnswers: next, isQuizInProgress: true });
      },

      // EXAM stream. Fully isolated from answers and reviewAnswers.
      startExam: (count, durationMs) => {
        const { questions } = get();
        const shuffled = [...questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const selected = shuffled.slice(0, Math.min(count, questions.length));
        set({
          examActive: true,
          examStartedAt: Date.now(),
          examDurationMs: durationMs,
          examQuestionIds: selected.map((q) => q.id),
          examAnswers: [],
          examLastResult: null,
          currentIndex: 0,
          currentScreen: 'question',
          activeTopic: null,
        });
      },

      // Exam answers give no immediate feedback and bypass the paywall gate.
      answerExam: (questionId, selectedIndex) => {
        const { questions, examAnswers } = get();
        const question = questions.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options[selectedIndex];
        if (!option) return;
        const record: AnswerRecord = { questionId, selectedIndex, isCorrect: option.correct };
        const existingIndex = examAnswers.findIndex((a) => a.questionId === questionId);
        const next =
          existingIndex >= 0
            ? examAnswers.map((a, i) => (i === existingIndex ? record : a))
            : [...examAnswers, record];
        set({ examAnswers: next });
      },

      finishExam: () => {
        const { examAnswers, examStartedAt, examDurationMs } = get();
        if (!examStartedAt) return;
        set({
          examActive: false,
          examLastResult: {
            answers: examAnswers,
            startedAt: examStartedAt,
            finishedAt: Date.now(),
            durationMs: examDurationMs,
          },
          examStartedAt: null,
          isQuizInProgress: false,
          currentScreen: 'results',
        });
      },

      cancelExam: () =>
        set({
          examActive: false,
          examStartedAt: null,
          examDurationMs: 0,
          examQuestionIds: [],
          examAnswers: [],
          examLastResult: null,
          currentIndex: 0,
          currentScreen: 'dashboard',
          activeTopic: null,
        }),
    }),
    {
      name: 'rhcsa_progress',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        answers: state.answers,
        currentIndex: state.currentIndex,
        isPro: state.isPro,
        streak: state.streak,
        lastActiveDate: state.lastActiveDate,
        totalXp: state.totalXp,
        wrongQuestionIds: state.wrongQuestionIds,
        reviewQuestionIds: state.reviewQuestionIds,
        reviewAnswers: state.reviewAnswers,
        isQuizInProgress: state.isQuizInProgress,
        examActive: state.examActive,
        examStartedAt: state.examStartedAt,
        examDurationMs: state.examDurationMs,
        examQuestionIds: state.examQuestionIds,
        examAnswers: state.examAnswers,
        // examLastResult is deliberately NOT persisted - session state only.
      }),
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) {
          return {
            // defaults FIRST so they cannot overwrite existing values
            streak: 0,
            lastActiveDate: null,
            totalXp: 0,
            ...(persistedState as Partial<QuizState>),
          } as Partial<QuizState>;
        }
        return persistedState as Partial<QuizState>;
      },
    }
  )
);
