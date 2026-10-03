import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Question, Topic } from '@/data/models/Question';
import { AnswerRecord } from '@/data/models/AnswerRecord';
import { QuestionRepository } from '@/data/repositories/QuestionRepository';
import { filterByTopic, getCurrentQuestion } from '@/domain/selectors';
import { calculateProgress, ProgressMetrics } from '@/domain/quizService';
import {
  ensureRecords,
  pickToday,
  scheduleReview,
  type ReviewRecord,
} from '@/domain/fsrs';

/**
 * TODO(payments): Replace mock unlockPro with real Stripe / Telegram Stars provider.
 * TODO(screens): Connect to quiz UI screens in a later step.
 * TODO(telegram): Wire Telegram WebApp adapter when targeting Telegram.
 */

// TODO(content): raise to 20 after questions.json reaches 50+ items
export const FREE_QUESTION_LIMIT = 5;

export type Screen = 'dashboard' | 'question' | 'results';

/**
 * Вид review-прогона. `'today'` — FSRS-lite («Повторить сегодня (N)»): ответы
 * пересчитывают расписание повторений. `null` — обычный прогон ошибок, темы и
 * регулярный поток: расписание они не трогают.
 */
export type ReviewKind = 'today' | null;

/** Local per-question statistics. Persisted with the rest of the progress. */
export interface QuestionStat {
  /** Total number of times the question has been answered in any stream. */
  attempts: number;
  /** How many of those attempts were correct. */
  correct: number;
  /** ISO-8601 timestamp of the most recent answer. */
  lastAt: string;
}

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

  // Per-question local statistics (no backend). Keyed by question id; a question
  // simply has no entry until it is first answered, so the 42 existing questions
  // are deliberately NOT backfilled. Accumulates across all three streams
  // (regular, review, topic), because every answer goes through exactly one of
  // answerQuestion / answerReview / answerExam.
  questionStats: Record<string, QuestionStat>;

  // FSRS-lite: реестр расписания повторений по qid (spec 052). Отсутствие записи
  // трактуется как «пора сейчас», поэтому пустой реестр на свежем профиле даёт
  // N = размер банка. Пишет реестр только review-прогон (answerAndReschedule).
  scheduledReviews: Record<string, ReviewRecord>;

  // REVIEW stream — fully isolated from 'answers'
  reviewQuestionIds: string[] | null;
  reviewAnswers: AnswerRecord[];
  // Только для review-прогонов; session-only (в partialize не попадает), потому
  // что после reload прогон всегда начинается заново с Dashboard.
  reviewKind: ReviewKind;

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

  loadQuestions: () => Promise<void>;
  /**
   * Re-aligns the persisted answer records with the bank currently on disk.
   * Called from `loadQuestions` (not from `migrate`): the bank is async, so it
   * does not exist yet when the persist middleware runs.
   */
  normalizeAnswersAgainstBank: () => void;
  recordActivity: () => void;
  navigateTo: (screen: Screen) => void;
  answerQuestion: (questionId: string, selectedIndex: number) => void;
  /** Records one answer into the local per-question statistics. */
  recordQuestionStat: (questionId: string, isCorrect: boolean) => void;
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
  /**
   * Стартует review-прогон. `kind = 'today'` помечает FSRS-lite-прогон, в
   * котором каждый ответ пересчитывает расписание повторений (spec 052);
   * без kind это обычный прогон ошибок или темы.
   */
  startReviewQuiz: (ids: string[], kind?: ReviewKind) => void;
  answerReview: (questionId: string, selectedIndex: number) => void;
  /**
   * «Повторить сегодня»: ответ в review-стриме + пересчёт расписания FSRS-lite.
   * Записывает ответ через `answerReview` (поэтому бесплатный лимит обычного
   * потока не расходуется) и сохраняет запись расписания для этого qid.
   *
   * `isCorrect` — ожидание вызывающего: если оно расходится с реально
   * записанным ответом, расписание не трогается, чтобы не разойтись с историей.
   */
  answerAndReschedule: (questionId: string, isCorrect: boolean, selectedIndex: number) => void;
  /** qid, которые пора повторить: нет записи или next <= now. */
  getTodayReviewIds: () => string[];
  /** Заполняет отсутствующие записи расписания «пора сейчас» (идемпотентно). */
  ensureReviewsInitialized: (bankIds: readonly string[]) => void;
  startRegularQuiz: () => void;
  startTopicQuiz: (topic: string) => void;
  startExam: (count: number, durationMs: number) => void;
  answerExam: (questionId: string, selectedIndex: number) => void;
  finishExam: () => void;
  cancelExam: () => void;
}

const questionRepo = new QuestionRepository();

/**
 * Re-aligns one answer stream with the bank. `selectedIndex` is positional: a
 * stored record keeps pointing at the position it was written with, so a bank
 * reorder (commit 3bc8470 shuffled options across all topics) silently moves it
 * onto a different option — that is what painted a wrong option green.
 *
 * `optionText` is the stable identity of the pick, so it wins whenever present.
 * Records written before `optionText` existed fall back to the positional check:
 * they survive only when index AND isCorrect still match the current data.
 * Anything that cannot be proven consistent is dropped, never guessed.
 */
const normalizeRecordsAgainstBank = (
  records: AnswerRecord[],
  questions: Question[],
): AnswerRecord[] => {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out: AnswerRecord[] = [];
  for (const r of records) {
    const q = byId.get(r.questionId);
    if (!q) continue; // вопрос удалён — drop
    if (r.optionText) {
      const idx = q.options.findIndex((o) => o.text === r.optionText);
      if (idx < 0) continue; // текст не найден — drop
      const opt = q.options[idx];
      out.push({ ...r, selectedIndex: idx, isCorrect: opt.correct });
    } else {
      const opt = q.options[r.selectedIndex];
      if (!opt) continue; // индекс вне диапазона — drop
      if (opt.correct !== r.isCorrect) continue; // данные сдвинулись — drop
      out.push({ ...r, optionText: opt.text });
    }
  }
  return out;
};

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
      questionStats: {},
      scheduledReviews: {},
      reviewQuestionIds: null,
      reviewAnswers: [],
      reviewKind: null,
      isQuizInProgress: false,
      activeTopic: null,
      examActive: false,
      examLastResult: null,
      examStartedAt: null,
      examDurationMs: 0,
      examQuestionIds: [],
      examAnswers: [],

      // The bank is no longer a static import: it arrives as per-topic chunks, so
      // loading is asynchronous. `isLoading` drives the loading gate in App.tsx;
      // every accessor below stays synchronous and reads the snapshot afterwards.
      loadQuestions: async () => {
        set({ isLoading: true });
        try {
          await questionRepo.load();
          set({
            questions: questionRepo.getAll(),
            isLoading: false,
          });
        } catch (error) {
          // A failed chunk fetch must not leave the UI stuck on the loading gate.
          console.error('[quizStore] failed to load questions', error);
          set({ questions: [], isLoading: false });
        }
        // Outside try/catch on purpose: re-alignment must not depend on a network
        // error, and it reads the snapshot set above. A no-op while the bank is empty.
        get().normalizeAnswersAgainstBank();
      },

      // v2 → v3 debt: `migrate` runs while the bank is still empty, so the records
      // are re-aligned here, once `questions` actually exist.
      normalizeAnswersAgainstBank: () => {
        const { questions, answers, reviewAnswers, examAnswers } = get();
        if (questions.length === 0) return; // банк ещё не загружен — no-op
        set({
          answers: normalizeRecordsAgainstBank(answers, questions),
          reviewAnswers: normalizeRecordsAgainstBank(reviewAnswers, questions),
          examAnswers: normalizeRecordsAgainstBank(examAnswers, questions),
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
          reviewKind: null,
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
          reviewKind: null,
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

      // Local per-question stats. Kept out of the three answer streams so the
      // streams stay isolated; every answer records through here instead.
      recordQuestionStat: (questionId, isCorrect) => {
        const prev = get().questionStats[questionId];
        const next: QuestionStat = {
          attempts: (prev?.attempts ?? 0) + 1,
          correct: (prev?.correct ?? 0) + (isCorrect ? 1 : 0),
          lastAt: new Date().toISOString(),
        };
        set({ questionStats: { ...get().questionStats, [questionId]: next } });
      },


      answerQuestion: (questionId, selectedIndex) => {
        if (!get().canAccessQuestion(get().currentIndex)) {
          return;
        }
        const question = get().questions.find((q) => q.id === questionId);
        if (!question) return;
        if (selectedIndex < 0 || selectedIndex >= question.options.length) return;
        const isCorrect = question.options[selectedIndex].correct;
        const record: AnswerRecord = {
          questionId,
          selectedIndex,
          isCorrect,
          optionText: question.options[selectedIndex].text,
        };
        const existingIndex = get().answers.findIndex((a) => a.questionId === questionId);
        const answers =
          existingIndex >= 0
            ? get().answers.map((a, i) => (i === existingIndex ? record : a))
            : [...get().answers, record];
        set({ answers });
        get().recordQuestionStat(questionId, isCorrect);

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
        const {
          currentIndex,
          questions,
          examActive,
          examQuestionIds,
          isPro,
          activeTopic,
          reviewQuestionIds,
        } = get();
        // Same review predicate as Question.tsx. Review is a study mode, not new
        // question consumption: answerReview deliberately skips canAccessQuestion,
        // and the payload screen hides the paywall for review - so gating here
        // deadlocked a free user at the limit (currentIndex froze, no paywall to
        // act on). Review therefore bypasses the free-question gate, exactly like
        // the exam branch already does.
        const isReview = reviewQuestionIds !== null;
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
        // Exam is never paywalled - the whole point is a full timed run. Review is
        // exempt for the same reason.
        if (!examActive && !isReview && nextIndex >= FREE_QUESTION_LIMIT && !isPro) {
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
          reviewKind: null,
          // Расписание повторений — часть прогресса: после полного сброса
          // отсутствие записей означает «пора сейчас», то есть N = размер банка.
          scheduledReviews: {},
          activeTopic: null,
          // Exam mode is part of "progress" too: a stale examActive/examStartedAt
          // would resurface an exam gate (and finishExam would compute its
          // duration from an outdated timestamp). streak/lastActiveDate/totalXp
          // are deliberately kept - they are the user's accumulated record, not
          // per-run progress.
          examActive: false,
          examStartedAt: null,
          examDurationMs: 0,
          examQuestionIds: [],
          examAnswers: [],
          examLastResult: null,
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

      startReviewQuiz: (ids, kind = null) =>
        set({
          reviewQuestionIds: ids,
          reviewAnswers: [],
          reviewKind: kind,
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
        // FSRS-lite: в прогоне «Повторить сегодня» ответ дополнительно
        // пересчитывает расписание. Обе ветки пишут ответ одним и тем же кодом
        // НИЖЕ — делегирование обратно в answerReview дало бы бесконечную
        // рекурсию (answerReview → answerAndReschedule → answerReview).
        const reschedule = get().reviewKind === 'today';

        const { questions, reviewAnswers, wrongQuestionIds } = get();
        const question = questions.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options[selectedIndex];
        if (!option) return;
        const record: AnswerRecord = {
          questionId,
          selectedIndex,
          isCorrect: option.correct,
          optionText: option.text,
        };
        const existingIndex = reviewAnswers.findIndex((a) => a.questionId === questionId);
        const next =
          existingIndex >= 0
            ? reviewAnswers.map((a, i) => (i === existingIndex ? record : a))
            : [...reviewAnswers, record];

        // Unified rule: a correct answer retires the question from the
        // wrong-answer list, a wrong one (re)adds it. wrongQuestionIds is only
        // written when the membership actually changes, so unrelated state and
        // array identity stay stable.
        const isCorrect = option.correct;
        const isInWrong = wrongQuestionIds.includes(questionId);
        const update: {
          reviewAnswers: AnswerRecord[];
          isQuizInProgress: boolean;
          wrongQuestionIds?: string[];
        } = { reviewAnswers: next, isQuizInProgress: true };
        if (isCorrect && isInWrong) {
          update.wrongQuestionIds = wrongQuestionIds.filter((id) => id !== questionId);
        } else if (!isCorrect && !isInWrong) {
          update.wrongQuestionIds = [...wrongQuestionIds, questionId];
        }

        set(update);
        get().recordQuestionStat(questionId, isCorrect);

        if (reschedule) {
          get().answerAndReschedule(questionId, isCorrect, selectedIndex);
        }
      },

      // REVIEW-ТОДЕЙ. Ответ записывается через общую с answerReview ветку
      // (store сам решает, когда её вызывать), а здесь пересчитывается ТОЛЬКО
      // расписание — поэтому вызов идёт напрямую, без повторной записи ответа:
      // (1) прогон повторения не расходует бесплатный лимит обычного потока;
      // (2) при отсутствии записи (вопроса нет в банке, вариант вне диапазона,
      // вопрос уже отвечен) расписание не меняется;
      // (3) `isCorrect` — ожидание вызывающего; истина берётся из записанного
      // ответа, потому что Question.tsx передаёт индекс ВИЗУАЛЬНОГО порядка.
      answerAndReschedule: (questionId, isCorrect, selectedIndex) => {
        const answered = get().reviewAnswers.find((a) => a.questionId === questionId);
        // Ответ не записан → расписание не трогаем.
        if (!answered) return;
        // Ожидание вызывающего расходится с записанным ответом → не угадываем.
        if (answered.isCorrect !== isCorrect) return;
        if (selectedIndex < 0) return;

        const { scheduledReviews } = get();
        const current = scheduledReviews[questionId] ?? null;
        const record = scheduleReview(current, isCorrect ? 'Good' : 'Again', Date.now());
        set({
          scheduledReviews: { ...scheduledReviews, [questionId]: record },
        });
      },

      // FSRS-lite: «пора сейчас» = записи нет ИЛИ next <= now (spec 052).
      // Считается по загруженному банку, поэтому чужие и удалённые qid в N не
      // попадают, а до загрузки банка N = 0.
      getTodayReviewIds: () => pickToday(get().scheduledReviews, get().questions, Date.now()),

      // Миграция v3→v4 создаёт ПУСТОЙ реестр: банк на момент migrate ещё не
      // загружен, а отсутствие записи само по себе означает «пора сейчас».
      // Поэтому наполнение идёт здесь, когда банк уже в состоянии.
      ensureReviewsInitialized: (bankIds) => {
        if (bankIds.length === 0) return;
        const { scheduledReviews } = get();
        const next = ensureRecords(scheduledReviews, bankIds, Date.now());
        // Тот же объект = ничего не изменилось: без этого эффект в Dashboard
        // зациклился бы на собственном set().
        if (next === scheduledReviews) return;
        set({ scheduledReviews: next });
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
          reviewKind: null,
        });
      },

      // Exam answers give no immediate feedback and bypass the paywall gate.
      answerExam: (questionId, selectedIndex) => {
        const { questions, examAnswers } = get();
        const question = questions.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options[selectedIndex];
        if (!option) return;
        const record: AnswerRecord = {
          questionId,
          selectedIndex,
          isCorrect: option.correct,
          optionText: option.text,
        };
        const existingIndex = examAnswers.findIndex((a) => a.questionId === questionId);
        const next =
          existingIndex >= 0
            ? examAnswers.map((a, i) => (i === existingIndex ? record : a))
            : [...examAnswers, record];
        set({ examAnswers: next });
        get().recordQuestionStat(questionId, option.correct);
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
        // Local per-question statistics (see QuestionStat). No version bump:
        // zustand shallow-merges persisted state over initialState, so states
        // written before this field existed simply receive questionStats: {}.
        questionStats: state.questionStats,
        // FSRS-lite: расписание переживает reload — иначе N снова стал бы равен
        // размеру банка после каждой перезагрузки (spec 052, Компонент 2).
        scheduledReviews: state.scheduledReviews,
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
      version: 4,
      migrate: (persistedState, version) => {
        let s = persistedState as Partial<QuizState>;
        if (version < 2) {
          // defaults FIRST so they cannot overwrite existing values
          s = {
            streak: 0,
            lastActiveDate: null,
            totalXp: 0,
            ...s,
          } as Partial<QuizState>;
        }
        // v2 → v3: answers мигрируются отложенно, после загрузки банка
        // (см. normalizeAnswersAgainstBank). Здесь банк пуст — трогать нельзя.
        if (version < 4) {
          // v3 → v4: реестр расписания создаётся ПУСТЫМ. Наполнять его в migrate
          // нельзя (банк ещё не загружен), и не нужно: отсутствие записи само по
          // себе означает «пора сейчас», поэтому первый запуск даёт N = банк.
          // Остальные поля сохраняются как есть. Функция чистая, поэтому
          // повторный вызов на состоянии v4 — no-op без дублей.
          s = {
            ...s,
            scheduledReviews: {},
          } as Partial<QuizState>;
        }
        return s;
      },
    }
  )
);
