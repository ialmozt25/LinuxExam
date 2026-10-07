import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Question } from '@/data/models/Question';
import { AnswerRecord } from '@/data/models/AnswerRecord';
import { QuestionRepository } from '@/data/repositories/QuestionRepository';
import { calculateProgress, ProgressMetrics } from '@/domain/quizService';
import {
  ensureRecords,
  pickToday,
  scheduleReview,
  SESSION_LIMIT,
  sortByOverdue,
  type ReviewRecord,
} from '@/domain/fsrs';
import {
  breakdownByTopic,
  pickExamQuestions,
  scoreExam,
  type ExamAnswer,
  type ExamConfig,
  type ExamFinishReason,
  type ExamScore,
  type ExamState,
  type TopicBreakdown,
} from '@/domain/exam';
import { DEFAULT_DAILY_GOAL_XP, LEGACY_DEFAULT_DAILY_GOAL_XP } from '@/domain/goal';
import {
  applyXpGain,
  levelFromXp,
  streakMilestoneXp,
  xpForAnswer,
  XP_EXAM_COMPLETE,
  XP_FIRST_ANSWER_OF_DAY,
  type AnswerStream,
  type XpPatch,
  type XpState,
} from '@/domain/xp';

/**
 * TODO(payments): Replace mock unlockPro with real Stripe / Telegram Stars provider.
 * TODO(screens): Connect to quiz UI screens in a later step.
 * TODO(telegram): Wire Telegram WebApp adapter when targeting Telegram.
 */

// TODO(content): raise to 20 after questions.json reaches 50+ items
export const FREE_QUESTION_LIMIT = 5;

export type Screen =
  | 'dashboard'
  | 'question'
  | 'results'
  | 'exam-setup'
  | 'exam-run'
  | 'exam-results'
  | 'analytics'
  | 'paywall';

/**
 * Прогон Exam mode (spec 054): пресеты 30/60/90, порог 70 %, разбор по темам.
 * Session-only — в `partialize` НЕ попадает (см. комментарий там): после reload
 * незавершённый прогон не должен поднимать пользователя обратно на экзамен.
 */
export interface ExamSession {
  status: ExamState;
  questionIds: string[];
  answers: ExamAnswer[];
  startedAt: number | null;
  durationMs: number;
  config: ExamConfig | null;
  /** Чем закончился прогон: таймером или ответом на последний вопрос. */
  finishReason: ExamFinishReason | null;
}

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

/**
 * Празднование нового уровня («Ты теперь {toName}!»). Несёт только имя уровня,
 * а не весь объект: UI показывает имя и ничего больше.
 *
 * Session-only — в `partialize` НЕ попадает: после reload профиль уже стоит на
 * своём уровне, и праздновать переход заново нечего. Это и есть требование
 * «toast не повторяется после перезагрузки» — не флаг «показан», а отсутствие
 * поля в персисте.
 */
export interface LevelUpNotice {
  /** Имя уровня, на который перешёл профиль (`LEVELS[].name`). */
  toName: string;
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

  /**
   * Переход на новый уровень, который UI ещё не показал. `null` — праздновать
   * нечего. Session-only (в `partialize` не попадает): см. `LevelUpNotice`.
   * Ставится ТОЛЬКО на росте номера уровня, поэтому перескок через несколько
   * ступеней сразу даёт ровно одно уведомление — о конечном уровне.
   */
  pendingLevelUp: LevelUpNotice | null;

  /**
   * Дневная цель (spec 061). `null` — цель ещё не подтверждена пользователем
   * (picker не пройден): миграции всегда выставляют текущий дефолт, поэтому
   * `null` остаётся только у профиля, прошедшего онбординг в этой же сессии.
   */
  dailyGoalXp: number | null;
  /** Накопленный за сегодня XP к дневной цели; обнуляется при смене даты. */
  todayXp: number;

  /**
   * День (`YYYY-MM-DD`), к которому относится `todayXp`; `null` — накопленного
   * XP за сегодня нет.
   *
   * Отдельный маркер, а не `lastActiveDate`: XP начисляют все три потока
   * (regular / review / exam), а `lastActiveDate` двигает только первый ответ
   * дня. По общему признаку день, в котором пользователь набирал XP лишь в
   * review или на экзамене, не опознавался бы — и сброс «в новый день» стирал бы
   * счётчик текущего дня при перезагрузке (та же причина, что и у
   * `todayAnsweredDate`).
   */
  todayXpDate: string | null;

  /**
   * Сколько ОТВЕТОВ дано сегодня (задание «счётчик ответов за сегодня», правая
   * часть CTA на Dashboard); обнуляется в полночь.
   *
   * Отдельное поле, а не `todayXp`: с XP-механикой величины по-прежнему не
   * совпадают — повторный ответ на вопрос даёт 0 XP (anti-farming), ответ
   * экзамена не даёт XP вообще (платит завершение прогона), а +10 за первый
   * ответ дня приходится на один ответ из многих. Инкремент — в
   * `recordQuestionStat`, единственной воронке всех трёх потоков ответов
   * (regular / review / exam).
   */
  todayAnswered: number;
  /**
   * День (`YYYY-MM-DD`), к которому относится `todayAnswered`; `null` — счётчика
   * нет (профиль ещё не отвечал).
   *
   * Отдельный маркер, а не `lastActiveDate`: тот обновляет только
   * `recordActivity` из regular-потока, поэтому день, в котором пользователь
   * отвечал лишь в review/exam, по нему не опознать — и сброс «в новый день»
   * стирал бы ответы текущего дня при перезагрузке.
   */
  todayAnsweredDate: string | null;

  /**
   * Вопросы, на которые сегодня уже был дан ответ (anti-farming). XP за ответ
   * платит только ПЕРВЫЙ ответ на вопрос за день — повторный даёт 0.
   *
   * Список, а не счётчик: важен сам факт «этот qid сегодня уже отвечен», а не
   * сколько раз. Ведётся в `recordQuestionStat` — единственной воронке, через
   * которую проходит каждый ответ (regular / review / exam), поэтому порядок
   * потоков не влияет на начисление. Сбрасывается вместе с `todayAnswered` по
   * маркеру `todayAnsweredDate`: день у обоих полей один и тот же.
   */
  answeredToday: string[];

  /**
   * Paywall (spec 063): момент старта 7-дневного trial, мс. `null` — trial не
   * начинался (кнопка «Попробовать 7 дней бесплатно» не нажата). Дата, а не
   * булев флаг: истечение считается по времени (`isTrialActive` в
   * `src/domain/paywall.ts`), поэтому «активен» не нужно переписывать в стор.
   */
  trialStartedAt: number | null;

  // Wrong-answer tracking for the regular stream (feeds review mode)
  wrongQuestionIds: string[];

  // Per-question local statistics (no backend). Keyed by question id; a question
  // simply has no entry until it is first answered, so the 42 existing questions
  // are deliberately NOT backfilled. Accumulates across every stream (regular,
  // review, topic, exam), because every answer goes through exactly one of
  // answerQuestion / answerReview / submitExamAnswer.
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

  // Онбординг (spec 060). Оба поля персистятся: `hasCompletedOnboarding`
  // удерживает факт прохождения между сессиями, `onboardingGoal` — выбранную
  // цель. Дефолт `false` обязателен: см. `useNeedsOnboarding`.
  //
  // `onboardingGoal` — ЛЕГАСИ: экран выбора цели удалён (упрощение онбординга),
  // поэтому текущий поток его не пишет и он всегда `null`. Поле оставлено частью
  // persist-контракта: удаление поля меняло бы структуру снимка, а bump версии в
  // этом задании не делался.
  onboardingGoal: string | null;
  hasCompletedOnboarding: boolean;

  // Exam mode (spec 054) — прогон с пресетами 30/60/90, порогом 70 % и разбором
  // по темам. Единственный экзамен в приложении с spec 068: исторический
  // инлайн-экзамен (examActive/examAnswers и экран-сводка в Results) удалён.
  examSession: ExamSession;

  loadQuestions: () => Promise<void>;
  /**
   * Re-aligns the persisted answer records with the bank currently on disk.
   * Called from `loadQuestions` (not from `migrate`): the bank is async, so it
   * does not exist yet when the persist middleware runs.
   */
  normalizeAnswersAgainstBank: () => void;
  recordActivity: () => void;
  /**
   * Гасит уведомление о новом уровне после показа. Отдельный экшен, а не
   * `set` из UI: поле session-only и меняется только из этой пары
   * (`xpGainWithLevelUp` ставит, `clearPendingLevelUp` снимает).
   */
  clearPendingLevelUp: () => void;
  /** Дневная цель (spec 061): выставляет выбранный пресет и снимает `null`. */
  setDailyGoal: (xp: number) => void;
  /**
   * Обнуляет todayXp и счётчик ответов при первом запуске в новый день
   * (вызов при гидратации). Оба поля сбрасываются по СВОИМ маркерам.
   */
  resetTodayXpIfNewDay: () => void;
  /**
   * Paywall (spec 063): стартует 7-дневный trial, если он ещё не начинался.
   * Идемпотентно — повторный вызов НЕ отодвигает дату старта (иначе кнопка
   * «Попробовать 7 дней» давала бы бессрочный доступ).
   */
  startTrial: () => void;
  navigateTo: (screen: Screen) => void;
  answerQuestion: (questionId: string, selectedIndex: number) => void;
  /**
   * Records one answer into the local per-question statistics И начисляет XP за
   * ответ (первый ответ на этот вопрос за день). `stream` обязателен: от него
   * зависит и цена ответа, и то, платит ли поток вообще (экзамен не платит).
   */
  recordQuestionStat: (questionId: string, isCorrect: boolean, stream: AnswerStream) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  resetProgress: () => void;
  unlockPro: () => void;
  hidePaywall: () => void;
  /** Paywall (spec 063): контентный вход — платная тема без доступа. */
  showPaywall: () => void;
  canAccessQuestion: (index: number) => boolean;
  getProgress: () => ProgressMetrics;
  resumeQuiz: () => void;
  /** Онбординг (spec 060): фиксирует выбранную цель перед демо-квизом. */
  setOnboardingGoal: (goalId: string) => void;
  /** Онбординг: помечает прохождение завершённым (кнопка «Начать» на итоге). */
  completeOnboarding: () => void;
  /** Онбординг: сбрасывает прохождение — только для тестов, в UI не вызывается. */
  resetOnboarding: () => void;
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
  /**
   * Размеры двух пулов прогона: `newQuestions` (записи в расписании нет) и
   * `dueQuestions` (`next <= now`). Экранам нужны именно числа — Dashboard
   * выбирает по ним кнопку, а не собирает сессию на каждый рендер.
   */
  getSessionCounts: () => { newCount: number; dueCount: number };
  /**
   * Идентификаторы одной сессии: сначала просроченные (самые запущенные
   * первыми), затем новые, до `limit`. Вопросов вне банка здесь быть не может.
   */
  getSessionIds: (limit?: number) => string[];
  /** Заполняет отсутствующие записи расписания «пора сейчас» (идемпотентно). */
  ensureReviewsInitialized: (bankIds: readonly string[]) => void;
  startRegularQuiz: () => void;
  startTopicQuiz: (topic: string) => void;

  // --- Exam mode (spec 054) -------------------------------------------------
  /** Готовит прогон по пресету и открывает экран прогона. */
  startExamSession: (config: ExamConfig, allIds: readonly string[]) => void;
  /** Пишет ответ текущего вопроса. Экран НЕ переключает (это дело nextExamQuestion). */
  submitExamAnswer: (questionId: string, selectedIndex: number) => void;
  /** Следующий вопрос; на последнем — завершает прогон ('manual'). */
  nextExamQuestion: () => void;
  /** Завершает прогон: 'timeout' (таймер) или 'manual' (ответ на последний вопрос). */
  finishExamSession: (reason?: ExamFinishReason) => void;
  /** Сбрасывает прогон и возвращает на Dashboard. */
  cancelExamSession: () => void;
  getExamResult: () => ExamScore;
  getExamBreakdown: () => TopicBreakdown[];
  /** Текущий вопрос прогона (для экрана прогона). */
  getExamCurrentQuestionId: () => string | null;
  /** Таймер прогона: остаток мс и признак истечения (без побочных эффектов). */
  getExamRemainingMs: (now: number) => number;
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

/**
 * Fisher–Yates over a copy of the input (`Math.random`). Extracted from the two
 * identical inline loops that `startTopicQuiz` and the legacy inline exam each
 * carried (audit §1 DUP4): the topic pool and the exam pool were shuffled by the
 * same copy-pasted code, so the two could drift apart silently. spec 068 removed
 * the exam pool; `startTopicQuiz` is the only remaining caller. The input array
 * is never mutated.
 */
const shuffleCopy = <T>(items: readonly T[]): T[] => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Начисление XP вместе с детектом перехода на новый уровень.
 *
 * Единственная точка, где XP попадает в стор. До неё `applyXpGain` вызывался в
 * трёх местах (ответ, первый ответ дня с бонусом серии, завершение экзамена), и
 * проверка «уровень вырос?» в каждом из них разошлась бы: достаточно забыть одну
 * ветку, и часть начислений молча не праздновалась бы.
 *
 * Сравниваются НОМЕРА уровней, а не «стало ровно на один больше»: один ответ
 * может перевести через ступень сразу (бонус серии), и это по-прежнему ровно
 * один переход. Начисление, не поднявшее уровень, НЕ гасит ещё не показанное
 * уведомление — `pendingLevelUp` перезаписывается только на росте.
 */
const xpGainWithLevelUp = (
  state: XpState,
  amount: number,
  today: string,
): XpPatch & { pendingLevelUp?: LevelUpNotice } => {
  const patch = applyXpGain(state, amount, today);
  const to = levelFromXp(patch.totalXp);
  const from = levelFromXp(state.totalXp);
  return to.number > from.number ? { ...patch, pendingLevelUp: { toName: to.name } } : patch;
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
      pendingLevelUp: null,
      dailyGoalXp: null,
      todayXp: 0,
      todayXpDate: null,
      todayAnswered: 0,
      todayAnsweredDate: null,
      answeredToday: [],
      trialStartedAt: null,
      wrongQuestionIds: [],
      questionStats: {},
      scheduledReviews: {},
      reviewQuestionIds: null,
      reviewAnswers: [],
      reviewKind: null,
      isQuizInProgress: false,
      activeTopic: null,
      onboardingGoal: null,
      hasCompletedOnboarding: false,
      examSession: {
        status: 'idle',
        questionIds: [],
        answers: [],
        startedAt: null,
        durationMs: 0,
        config: null,
        finishReason: null,
      },

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
        const { questions, answers, reviewAnswers } = get();
        if (questions.length === 0) return; // банк ещё не загружен — no-op
        set({
          answers: normalizeRecordsAgainstBank(answers, questions),
          reviewAnswers: normalizeRecordsAgainstBank(reviewAnswers, questions),
        });
      },

      navigateTo: (screen) => set({ currentScreen: screen }),

      // Explicitly leaves review mode and returns to the regular stream.
      // Does NOT touch answers or wrongQuestionIds.
      startRegularQuiz: () =>
        set({
          reviewQuestionIds: null,
          reviewAnswers: [],
          reviewKind: null,
          currentIndex: 0,
          activeTopic: null,
        }),

      // Starts a topic quiz. Reuses the REVIEW stream (reviewQuestionIds /
      // reviewAnswers) and tags it with activeTopic so it is distinguishable
      // from "Повторить ошибки" without a fourth answer stream.
      startTopicQuiz: (topic) => {
        const { questions } = get();
        const filtered = questions.filter((q) => q.topic === topic);
        if (filtered.length === 0) return;
        const shuffled = shuffleCopy(filtered);
        set({
          reviewQuestionIds: shuffled.map((q) => q.id),
          reviewAnswers: [],
          reviewKind: null,
          currentIndex: 0,
          isQuizInProgress: true,
          currentScreen: 'question',
          activeTopic: topic,
        });
      },

      // Первый ответ дня: +10 (серия) и, если серия дошла до вехи, её бонус.
      // Вызывается из `recordQuestionStat` — единственной воронки ответов, —
      // поэтому «первым ответом дня» считается первый ответ в ЛЮБОМ потоке, а
      // не только в regular, как было до XP-механики.
      recordActivity: () => {
        const today = new Date().toISOString().slice(0, 10);
        const { lastActiveDate, streak } = get();
        if (lastActiveDate === today) return;
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        // Веха считается по НОВОМУ значению серии: «каждый раз при достижении»
        // означает, что сброшенная разрывом и снова дошедшая до 3 серия платит
        // ещё раз, а не один раз в жизни профиля.
        const nextStreak = lastActiveDate === yesterday ? streak + 1 : 1;
        const xp = XP_FIRST_ANSWER_OF_DAY + streakMilestoneXp(nextStreak);
        set({
          streak: nextStreak,
          lastActiveDate: today,
          ...xpGainWithLevelUp(get(), xp, today),
        });
      },

      // Уведомление о новом уровне — session-only: гасится после показа на
      // Dashboard (см. `pendingLevelUp`). Отдельный экшен держит пару
      // «поставить/снять» в одном файле, рядом с тем, кто её ставит.
      clearPendingLevelUp: () => set({ pendingLevelUp: null }),

      setDailyGoal: (xp) => set({ dailyGoalXp: xp }),

      // Гидратация пришла с прошлой датой — дневные счётчики начинаются заново.
      // Идемпотентно: при сегодняшних маркерах состояние не трогается.
      //
      // Оба счётчика сбрасываются по СВОИМ маркерам (`todayXpDate` и
      // `todayAnsweredDate`), а не по `lastActiveDate`: последний обновляет
      // только `recordActivity` (первый ответ дня), поэтому день, в котором
      // пользователь отвечал лишь в review или на экзамене, по нему не
      // опознаётся — и сброс стёр бы сегодняшние значения при перезагрузке.
      resetTodayXpIfNewDay: () => {
        const today = new Date().toISOString().slice(0, 10);
        const { todayXpDate, todayAnsweredDate } = get();
        const patch: Partial<QuizState> = {};
        if (todayXpDate !== null && todayXpDate !== today) {
          patch.todayXp = 0;
          patch.todayXpDate = null;
        }
        if (todayAnsweredDate !== null && todayAnsweredDate !== today) {
          patch.todayAnswered = 0;
          patch.todayAnsweredDate = null;
          // Anti-farming — часть того же дня, что и счётчик ответов: сброс
          // «первых за день» обязан идти вместе с ним, иначе после полуночи
          // повторный ответ на вчерашний вопрос не дал бы XP.
          patch.answeredToday = [];
        }
        if (Object.keys(patch).length > 0) set(patch);
      },

      // Paywall (spec 063): trial стартует один раз. Уже стоящая дата не
      // перезаписывается — иначе повторное нажатие продлевало бы доступ.
      startTrial: () => {
        if (get().trialStartedAt !== null) return;
        set({ trialStartedAt: Date.now() });
      },

      // Local per-question stats. Kept out of the three answer streams so the
      // streams stay isolated; every answer records through here instead.
      //
      // Здесь же живёт ВСЯ выдача XP за ответ, и здесь же — дневной счётчик
      // ответов и anti-farming: это единственное место, через которое проходит
      // КАЖДЫЙ ответ — regular (answerQuestion), review (answerReview) и exam
      // (submitExamAnswer), — поэтому ни N, ни XP не зависят от того, каким
      // потоком отвечал пользователь.
      recordQuestionStat: (questionId, isCorrect, stream) => {
        const today = new Date().toISOString().slice(0, 10);
        const state = get();
        const prev = state.questionStats[questionId];
        const next: QuestionStat = {
          attempts: (prev?.attempts ?? 0) + 1,
          correct: (prev?.correct ?? 0) + (isCorrect ? 1 : 0),
          lastAt: new Date().toISOString(),
        };
        // Смена даты проверяется лениво и здесь, а не только на гидратации:
        // сессия может пережить полночь, и первый ответ нового дня обязан начать
        // счётчик заново, а не продолжить вчерашний.
        const isNewDay = state.todayAnsweredDate !== today;
        const answeredToday = isNewDay ? [] : state.answeredToday;
        // Anti-farming: платит только ПЕРВЫЙ ответ на этот вопрос за день.
        // Второй ответ на тот же вопрос сегодня даёт 0 XP — и в счётчике ответов
        // он по-прежнему учитывается (это разные величины).
        const isFirstToday = !answeredToday.includes(questionId);
        const xp = isFirstToday ? xpForAnswer(stream, isCorrect) : 0;
        set({
          questionStats: { ...state.questionStats, [questionId]: next },
          todayAnsweredDate: today,
          todayAnswered: (isNewDay ? 0 : state.todayAnswered) + 1,
          answeredToday: isFirstToday ? [...answeredToday, questionId] : answeredToday,
          ...xpGainWithLevelUp(state, xp, today),
        });
        // Первый ответ дня (в любом потоке) — он же шаг серии. Идемпотентно:
        // повторный вызов внутри того же дня выходит сразу.
        get().recordActivity();
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
        get().recordQuestionStat(questionId, isCorrect, 'regular');

        // Wrong-answer bookkeeping for review mode. This MUST NOT touch
        // reviewAnswers - the streams stay isolated.
        const { wrongQuestionIds } = get();
        if (!isCorrect && !wrongQuestionIds.includes(questionId)) {
          set({ wrongQuestionIds: [...wrongQuestionIds, questionId] });
        } else if (isCorrect && wrongQuestionIds.includes(questionId)) {
          set({ wrongQuestionIds: wrongQuestionIds.filter((id) => id !== questionId) });
        }
        set({ isQuizInProgress: true });
        // Серия (+10 за первый ответ дня) начисляется внутри recordQuestionStat:
        // первым ответом дня считается первый ответ в любом потоке, поэтому
        // отдельный вызов recordActivity здесь был бы вторым источником истины.
      },

      nextQuestion: () => {
        const { currentIndex, questions, isPro, activeTopic, reviewQuestionIds } = get();
        // Same review predicate as Question.tsx. Review is a study mode, not new
        // question consumption: answerReview deliberately skips canAccessQuestion,
        // and the payload screen hides the paywall for review - so gating here
        // deadlocked a free user at the limit (currentIndex froze, no paywall to
        // act on). Review therefore bypasses the free-question gate.
        const isReview = reviewQuestionIds !== null;
        // JOB 0: the pool must follow the ACTIVE stream. Without the review
        // branch a topic/review quiz would run past its own pool into questions
        // the Question screen does not even render.
        const poolSize = reviewQuestionIds ? reviewQuestionIds.length : questions.length;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= poolSize) {
          // 1.4: end of a topic quiz - drop the flag so the Dashboard stops
          // presenting it as the active topic.
          if (activeTopic !== null) set({ activeTopic: null });
          return;
        }
        // Review is exempt from the free-question gate (see the predicate above).
        if (!isReview && nextIndex >= FREE_QUESTION_LIMIT && !isPro) {
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
          // streak/lastActiveDate/totalXp are deliberately kept - they are the
          // user's accumulated record, not per-run progress.
        });
      },

      unlockPro: () => {
        // TODO(payments): Integrate real payment verification here.
        set({ isPro: true, isPaywallVisible: false });
      },

      hidePaywall: () => {
        set({ isPaywallVisible: false });
      },

      // spec 063: контентный вход на Paywall. Ставит ФЛАГ и ЭКРАН вместе, по
      // образцу `unlockPro`/`hidePaywall`: иначе состояние разъезжается —
      // экран 'paywall' при `isPaywallVisible: false`, из которого «Позже»
      // уводит на Dashboard, а Question.tsx (смотрит на флаг) платит иначе.
      showPaywall: () => {
        set({ isPaywallVisible: true, currentScreen: 'paywall' });
      },

      canAccessQuestion: (index: number): boolean => {
        return index < FREE_QUESTION_LIMIT || get().isPro;
      },

      getProgress: (): ProgressMetrics => {
        return calculateProgress(get().answers, get().questions.length);
      },

      resumeQuiz: () => set({ currentScreen: 'question' }),

      // Онбординг (spec 060). Три экшена, все — про два персистируемых поля;
      // сам поток (какой экран показать) живёт в App.tsx и в экране демо-квиза.
      // `setOnboardingGoal` — легаси удалённого экрана цели (см. поле); поток его
      // больше не вызывает, но контракт стора сохранён.
      setOnboardingGoal: (goalId) => set({ onboardingGoal: goalId }),

      // Онбординг заканчивается на демо-квизе: дневная цель фиксируется дефолтом
      // СРАЗУ, а не отдельным экраном-пикером. Иначе `dailyGoalXp` остался бы
      // `null`, и DailyGoalPicker всплыл бы поверх Dashboard четвёртым шагом
      // онбординга — ровно то, что задание убирает. Сам компонент пикера не
      // тронут: он по-прежнему показывает настройку, пока цель не подтверждена.
      completeOnboarding: () =>
        set({ hasCompletedOnboarding: true, dailyGoalXp: DEFAULT_DAILY_GOAL_XP }),

      resetOnboarding: () => set({ onboardingGoal: null, hasCompletedOnboarding: false }),

      startReviewQuiz: (ids, kind = null) =>
        set({
          reviewQuestionIds: ids,
          reviewAnswers: [],
          reviewKind: kind,
          currentIndex: 0,
          isQuizInProgress: true,
          currentScreen: 'question',
          activeTopic: null,
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
        get().recordQuestionStat(questionId, isCorrect, 'review');

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

      // FSRS-lite (spec 052 / spec 065): два пула прогона считаются по
      // ЗАГРУЖЕННОМУ банку, поэтому чужие и удалённые qid не попадают ни в
      // один из них, а до загрузки банка оба пула пусты.
      // `due` предшествует `new`: сначала закрываем долг, потом берём новое.
      getSessionCounts: () => {
        const { newQuestions, dueQuestions } = pickToday(
          get().scheduledReviews,
          get().questions,
          Date.now(),
        );
        return { newCount: newQuestions.length, dueCount: dueQuestions.length };
      },

      getSessionIds: (limit = SESSION_LIMIT) => {
        if (limit <= 0) return [];
        const { questions, scheduledReviews } = get();
        const now = Date.now();
        const { newQuestions, dueQuestions } = pickToday(scheduledReviews, questions, now);
        const ordered = [
          ...sortByOverdue(scheduledReviews, dueQuestions, now),
          ...newQuestions,
        ];
        return ordered.slice(0, limit);
      },

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

      // --- Exam mode (spec 054) ----------------------------------------------
      // Единственный экзамен в приложении (spec 068): пресеты 30/60/90,
      // порог 70 %, разбор по темам.
      startExamSession: (config, allIds) => {
        const questionIds = pickExamQuestions(allIds, config.count, Date.now());
        // Пустой банк — запускать нечего: остаёмся на экране настройки.
        if (questionIds.length === 0) return;
        set({
          examSession: {
            status: 'run',
            questionIds,
            answers: [],
            startedAt: Date.now(),
            durationMs: config.durationMs,
            config,
            finishReason: null,
          },
          currentScreen: 'exam-run',
        });
      },

      // Ответ пишется сразу (повторный ответ на тот же qid перезаписывается),
      // но экран НЕ переключается: переход делает nextExamQuestion.
      submitExamAnswer: (questionId, selectedIndex) => {
        const { questions, examSession } = get();
        if (examSession.status !== 'run') return;
        if (!examSession.questionIds.includes(questionId)) return;
        const question = questions.find((q) => q.id === questionId);
        if (!question) return;
        const option = question.options[selectedIndex];
        if (!option) return;

        const answer: ExamAnswer = {
          questionId,
          selectedIndex,
          isCorrect: option.correct,
        };
        const existingIndex = examSession.answers.findIndex((a) => a.questionId === questionId);
        const answers =
          existingIndex >= 0
            ? examSession.answers.map((a, i) => (i === existingIndex ? answer : a))
            : [...examSession.answers, answer];

        set({ examSession: { ...examSession, answers } });
        // Ответы экзамена не платят XP (платит завершение прогона), но проходят
        // через общую воронку: они считаются в дневном счётчике ответов и
        // закрывают anti-farming для этого qid — «первый ответ на вопрос за
        // день» уже дан, повторный (в review) XP не даст.
        get().recordQuestionStat(questionId, option.correct, 'exam');
      },

      nextExamQuestion: () => {
        const { examSession } = get();
        if (examSession.status !== 'run') return;
        const answered = examSession.answers.length;
        if (answered >= examSession.questionIds.length) {
          get().finishExamSession('manual');
        }
        // Индекс = число данных ответов, отдельного счётчика не держим:
        // прогон линеен (назад нельзя), а reload экзамен не возобновляет.
      },

      finishExamSession: (reason = 'manual') => {
        const { examSession } = get();
        if (examSession.status !== 'run') return;
        const today = new Date().toISOString().slice(0, 10);
        // XP платит ФАКТ завершения, а не ответы: +10 один раз на прогон.
        // Гард `status !== 'run'` выше делает начисление идемпотентным — и
        // таймаут, и ответ на последний вопрос приводят сюда ровно один раз.
        set({
          examSession: { ...examSession, status: 'done', finishReason: reason },
          currentScreen: 'exam-results',
          ...xpGainWithLevelUp(get(), XP_EXAM_COMPLETE, today),
        });
      },

      cancelExamSession: () => {
        set({
          examSession: {
            status: 'idle',
            questionIds: [],
            answers: [],
            startedAt: null,
            durationMs: 0,
            config: null,
            finishReason: null,
          },
          currentScreen: 'dashboard',
        });
      },

      getExamResult: () => {
        const { examSession } = get();
        return scoreExam(examSession.answers, examSession.questionIds.length);
      },

      getExamBreakdown: () => {
        const { examSession, questions } = get();
        const questionsById: Record<string, { topic: string }> = {};
        for (const question of questions) {
          questionsById[question.id] = { topic: question.topic };
        }
        return breakdownByTopic(examSession.answers, questionsById);
      },

      getExamCurrentQuestionId: () => {
        const { examSession } = get();
        if (examSession.status === 'idle') return null;
        const index = examSession.answers.length;
        return examSession.questionIds[index] ?? null;
      },

      getExamRemainingMs: (now) => {
        const { examSession } = get();
        if (examSession.status !== 'run' || examSession.startedAt === null) return 0;
        return Math.max(0, examSession.durationMs - (now - examSession.startedAt));
      },
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
        // Онбординг (spec 060) — в КОНЕЦ списка: порядок первых 17 полей
        // остаётся прежним (контракт partialize не переписывается).
        onboardingGoal: state.onboardingGoal,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        // Retention (spec 061) — тоже в КОНЕЦ: порядок первых 19 полей не меняется.
        dailyGoalXp: state.dailyGoalXp,
        todayXp: state.todayXp,
        // Paywall (spec 063) — в самый КОНЕЦ: порядок первых 21 поля не меняется.
        trialStartedAt: state.trialStartedAt,
        // Дневной счётчик ответов — тоже в КОНЕЦ: порядок предыдущих полей не
        // меняется. persist.version НЕ поднимается: zustand shallow-merge'ит
        // снимок поверх initialState, поэтому состояние без этих полей просто
        // получает `todayAnswered: 0` / `todayAnsweredDate: null` (тот же приём,
        // что и у `questionStats`, см. выше).
        todayAnswered: state.todayAnswered,
        todayAnsweredDate: state.todayAnsweredDate,
        // XP-механика — в самый КОНЕЦ: порядок предыдущих 19 полей не меняется.
        // `todayXpDate` — день дневного счётчика XP (свой маркер, см. поле),
        // `answeredToday` — «первые за день» ответы для anti-farming.
        todayXpDate: state.todayXpDate,
        answeredToday: state.answeredToday,
        // spec 068: legacy-поля инлайн-экзамена (examActive/examStartedAt/
        // examDurationMs/examQuestionIds/examAnswers) удалены из состояния и
        // отсюда. persist.version НЕ менялся: старый persisted-снапшот может
        // содержать эти ключи, но zustand их игнорирует (shallow-merge по
        // известным полям), а `partialize` их больше не пишет.
        // examLastResult (session-only) удалён вместе с экраном-сводкой.
        // examSession (spec 054) — НЕ персистится (session-only): иначе после
        // reload пользователь залипал бы на экране незавершённого экзамена.
        // pendingLevelUp (уровень вырос) — тоже НЕ персистится и по той же
        // причине, только с обратным знаком: после reload профиль уже стоит на
        // своём уровне, и праздновать переход заново нечего. Именно это даёт
        // «toast не повторяется» — не флаг «показан», а отсутствие поля в
        // снимке. persist.version НЕ менялся: поле добавляется, не переименовывается.
      }),
      version: 8,
      // На гидратации оба дневных счётчика сверяются с календарём: todayXp по
      // своему маркеру (`todayXpDate`), счётчик ответов — по `todayAnsweredDate`
      // (spec 061).
      onRehydrateStorage: () => (state) => {
        state?.resetTodayXpIfNewDay();
      },
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
        if (version < 5) {
          // v4 → v5 (spec 060): онбординг. `hasCompletedOnboarding: false` —
          // обязательный дефолт; сам по себе он НЕ показывает онбординг старым
          // пользователям: гейт `useNeedsOnboarding` требует ещё и пустых
          // `questionStats` (см. его комментарий).
          s = {
            ...s,
            onboardingGoal: null,
            hasCompletedOnboarding: false,
          } as Partial<QuizState>;
        }
        if (version < 6) {
          // v5 → v6 (spec 061): retention. `dailyGoalXp: 20` — дефолт, поэтому
          // обновившийся пользователь picker-а не видит; `todayXp: 0` — счётчик
          // дня начинается заново (гидратация досчитает по lastActiveDate).
          s = {
            ...s,
            dailyGoalXp: 20,
            todayXp: 0,
          } as Partial<QuizState>;
        }
        if (version < 7) {
          // v6 → v7 (spec 063): paywall. Существующий пользователь получает
          // 7-дневный trial, чтобы обновление не отобрало у него уже открытые
          // 11 платных тем (`hasCompletedOnboarding && !isPro` — то есть профиль,
          // который уже пользовался продуктом, но Pro не покупал).
          //
          // Свежий профиль trial НЕ получает: он начинается осознанным нажатием
          // «Попробовать 7 дней бесплатно» (`startTrial`). `isPro` не трогается.
          const existingUser =
            s.hasCompletedOnboarding === true && s.isPro !== true;
          s = {
            ...s,
            trialStartedAt: existingUser ? Date.now() : null,
          } as Partial<QuizState>;
        }
        if (version < 8) {
          // v7 → v8 (задание «XP-механика»): XP начал начисляться за ответы
          // (regular +3/+1, review +2/+1) и за завершённый экзамен (+10), а не
          // только +10 раз в сутки за активность. Из этого следуют три поля.
          //
          // 1. `todayXpDate` — свой маркер дня для `todayXp`. Раньше день
          //    дневного счётчика определялся по `lastActiveDate`, который
          //    двигал только regular-поток; теперь XP дают все три потока,
          //    поэтому маркер нужен отдельный. Старому профилю он ставится по
          //    прежнему признаку (`lastActiveDate`): накопленный `todayXp`
          //    читается ровно тем же днём, что и до обновления, и не сгорает.
          // 2. `answeredToday` — пустой список. У профиля, обновившегося
          //    посреди дня, «первых за день» ответов нет: anti-farming начинает
          //    считать с первого ответа после обновления. Восстановить его из
          //    `questionStats` нельзя — там только `lastAt`, без даты дня в
          //    форме, пригодной для сверки с календарём.
          // 3. `dailyGoalXp: 20 → 30` — новый дефолт дневной цели. Миграция
          //    переписывает РОВНО прежний дефолт: явный выбор 10 XP ею не
          //    затрагивается, а `null` (picker не пройден) сохраняется —
          //    иначе обновление молча закрыло бы picker.
          s = {
            ...s,
            todayXpDate: s.lastActiveDate ?? null,
            answeredToday: [],
            dailyGoalXp:
              s.dailyGoalXp === LEGACY_DEFAULT_DAILY_GOAL_XP ? DEFAULT_DAILY_GOAL_XP : s.dailyGoalXp ?? null,
          } as Partial<QuizState>;
        }
        return s;
      },
    }
  )
);
