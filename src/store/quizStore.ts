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
export const FREE_QUESTION_LIMIT = 3;

export type Screen = 'dashboard' | 'question' | 'results';

interface QuizState {
  questions: Question[];
  currentIndex: number;
  answers: AnswerRecord[];
  isPro: boolean;
  isLoading: boolean;
  isPaywallVisible: boolean;
  currentScreen: Screen;

  loadQuestions: () => void;
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

      loadQuestions: () => {
        set({ isLoading: true });
        const questions = questionRepo.getAll();
        set({
          questions,
          isLoading: false,
        });
      },

      navigateTo: (screen) => set({ currentScreen: screen }),

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
      },

      nextQuestion: () => {
        const { currentIndex, questions, isPro } = get();
        const nextIndex = currentIndex + 1;
        if (nextIndex >= questions.length) return;
        if (nextIndex >= FREE_QUESTION_LIMIT && !isPro) {
          set({ isPaywallVisible: true });
          return;
        }
        set({ currentIndex: nextIndex });
      },

      previousQuestion: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          set({ currentIndex: currentIndex - 1 });
        }
      },

      resetProgress: () => {
        set({ answers: [], currentIndex: 0, isPaywallVisible: false });
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
    }),
    {
      name: 'rhcsa_progress',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        answers: state.answers,
        currentIndex: state.currentIndex,
        isPro: state.isPro,
      }),
      version: 1,
      migrate: (persistedState, version) => {
        const persisted = persistedState as Partial<QuizState>;
        if (version === 0 || persisted.currentIndex === undefined) {
          return { ...persisted, currentIndex: 0, isPro: false };
        }
        return persisted;
      },
    }
  )
);
