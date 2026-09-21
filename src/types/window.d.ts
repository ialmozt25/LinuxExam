import type { useQuizStore } from '@/store/quizStore';

declare global {
  interface Window {
    __quizStore?: typeof useQuizStore;
  }
}

export {};
