import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQuizStore } from '../quizStore';
import type { Question } from '@/data/models/Question';
import { EXAM_PRESETS, findPreset } from '@/domain/exam';

/**
 * Exam mode (spec 054) — store-контракт прогона.
 *
 * Проверяется именно то, что не видно в domain-тестах: переходы экранов,
 * session-only природа `examSession` и то, что исторический инлайн-экзамен
 * (`examActive` / `answerExam` / `finishExam`) продолжает работать как раньше.
 */

// Тип Topic в модели объявляет три темы (исторический union), поэтому банк-фикстура
// использует только их: разбор по темам всё равно проверяется, а `as`-каст запрещён.
const TOPICS = ['file_permissions', 'file_management', 'process_management'] as const;

/** Банк из 253 вопросов в форме живого: 4 варианта, правильный всегда index 0. */
const mockQuestions: Question[] = Array.from({ length: 253 }, (_, i) => ({
  id: `q${String(i + 1).padStart(3, '0')}`,
  topic: TOPICS[i % TOPICS.length],
  difficulty: 'easy',
  question: `Вопрос ${i + 1}?`,
  options: [
    { text: 'Верный', correct: true },
    { text: 'Неверный 1', correct: false },
    { text: 'Неверный 2', correct: false },
    { text: 'Неверный 3', correct: false },
  ],
  explanation: 'Пояснение.',
}));

const bankIds = mockQuestions.map((q) => q.id);

function resetStore() {
  useQuizStore.setState({
    questions: mockQuestions,
    answers: [],
    reviewAnswers: [],
    reviewKind: null,
    examAnswers: [],
    examActive: false,
    examStartedAt: null,
    examDurationMs: 0,
    examQuestionIds: [],
    examLastResult: null,
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
    currentIndex: 0,
    wrongQuestionIds: [],
    questionStats: {},
    scheduledReviews: {},
    isQuizInProgress: false,
    activeTopic: null,
    isPaywallVisible: false,
    isPro: false,
  });
}

/** Отвечает на первые `n` вопросов прогона, каждый раз «правильным» вариантом. */
function answerFirst(n: number, selectedIndex = 0) {
  for (let i = 0; i < n; i++) {
    const id = useQuizStore.getState().getExamCurrentQuestionId();
    if (!id) break;
    useQuizStore.getState().submitExamAnswer(id, selectedIndex);
    useQuizStore.getState().nextExamQuestion();
  }
}

describe('examSession — прогон Exam mode', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    resetStore();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('startExamSession готовит прогон по пресету и открывает экран прогона', () => {
    const preset = findPreset(30);
    expect(preset).not.toBeNull();
    useQuizStore.getState().startExamSession(preset!, bankIds);

    const { examSession, currentScreen } = useQuizStore.getState();
    expect(currentScreen).toBe('exam-run');
    expect(examSession.status).toBe('run');
    expect(examSession.questionIds).toHaveLength(30);
    expect(new Set(examSession.questionIds).size).toBe(30);
    expect(examSession.answers).toEqual([]);
    expect(examSession.durationMs).toBe(EXAM_PRESETS[0].durationMs);
    expect(examSession.config).toEqual(preset);
    expect(examSession.startedAt).not.toBeNull();
    // Исторический инлайн-экзамен не запускается этим действием.
    expect(useQuizStore.getState().examActive).toBe(false);
  });

  it('preset 60/90 дают прогон нужной длины; пустой банк прогон не стартует', () => {
    for (const count of [60, 90] as const) {
      resetStore();
      useQuizStore.getState().startExamSession(findPreset(count)!, bankIds);
      expect(useQuizStore.getState().examSession.questionIds).toHaveLength(count);
      expect(useQuizStore.getState().examSession.durationMs).toBe(
        EXAM_PRESETS.find((p) => p.count === count)!.durationMs
      );
    }

    resetStore();
    useQuizStore.getState().startExamSession(findPreset(30)!, []);
    expect(useQuizStore.getState().examSession.status).toBe('idle');
    expect(useQuizStore.getState().currentScreen).toBe('dashboard');
  });

  it('submitExamAnswer пишет ответ, не переключая экран', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    const first = useQuizStore.getState().getExamCurrentQuestionId();
    expect(first).not.toBeNull();

    useQuizStore.getState().submitExamAnswer(first!, 0);

    const s = useQuizStore.getState();
    expect(s.currentScreen).toBe('exam-run'); // экран НЕ меняется
    expect(s.examSession.answers).toEqual([
      { questionId: first!, selectedIndex: 0, isCorrect: true },
    ]);
    expect(s.examSession.answers).toHaveLength(1);
    expect(s.examSession.questionIds).toContain(first!);
    // Статистика вопроса пишется как в остальных потоках.
    expect(s.questionStats[first!]?.attempts).toBe(1);

    // Повторный ответ на тот же qid перезаписывается, а не дублируется.
    useQuizStore.getState().submitExamAnswer(first!, 1);
    expect(useQuizStore.getState().examSession.answers).toHaveLength(1);
    expect(useQuizStore.getState().examSession.answers[0].isCorrect).toBe(false);

    // qid вне прогона игнорируется (чужой экзамен/вопрос из другой сессии).
    useQuizStore.getState().submitExamAnswer('q999', 0);
    expect(useQuizStore.getState().examSession.answers).toHaveLength(1);
  });

  it('ответы после завершения прогона не принимаются (status !== run)', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    const id = useQuizStore.getState().getExamCurrentQuestionId()!;
    useQuizStore.getState().finishExamSession('timeout');
    expect(useQuizStore.getState().examSession.status).toBe('done');

    useQuizStore.getState().submitExamAnswer(id, 0);
    expect(useQuizStore.getState().examSession.answers).toEqual([]);
  });

  it('getExamResult считает домен: неотвеченные вопросы — неверные', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    answerFirst(21); // 21 из 30 верных = 70 % → сдано

    const score = useQuizStore.getState().getExamResult();
    expect(score).toEqual({ correct: 21, total: 30, percent: 70, passed: true });
  });

  it('getExamResult: 20 верных из 30 → не сдано', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    answerFirst(20);
    const score = useQuizStore.getState().getExamResult();
    expect(score.correct).toBe(20);
    expect(score.percent).toBeCloseTo(66.7, 10);
    expect(score.passed).toBe(false);
  });

  it('nextExamQuestion на последнем вопросе завершает прогон (manual) и открывает итоги', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    answerFirst(30);

    const s = useQuizStore.getState();
    expect(s.examSession.status).toBe('done');
    expect(s.examSession.finishReason).toBe('manual');
    expect(s.currentScreen).toBe('exam-results');
    expect(s.getExamCurrentQuestionId()).toBeNull();
    expect(s.getExamResult()).toEqual({ correct: 30, total: 30, percent: 100, passed: true });
  });

  it('finishExamSession(\'timeout\') сохраняет причину; cancelExamSession сбрасывает прогон', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    answerFirst(5);
    useQuizStore.getState().finishExamSession('timeout');

    expect(useQuizStore.getState().examSession.finishReason).toBe('timeout');
    expect(useQuizStore.getState().currentScreen).toBe('exam-results');
    // Частичный прогон: 5 из 30.
    expect(useQuizStore.getState().getExamResult()).toEqual({
      correct: 5,
      total: 30,
      percent: 16.7,
      passed: false,
    });

    useQuizStore.getState().cancelExamSession();
    const s = useQuizStore.getState();
    expect(s.currentScreen).toBe('dashboard');
    expect(s.examSession).toEqual({
      status: 'idle',
      questionIds: [],
      answers: [],
      startedAt: null,
      durationMs: 0,
      config: null,
      finishReason: null,
    });
  });

  it('таймер: остаток считается от wall-clock старта, без побочных эффектов', () => {
    useQuizStore.getState().startExamSession(findPreset(90)!, bankIds);
    const { startedAt, durationMs } = useQuizStore.getState().examSession;
    expect(durationMs).toBe(120 * 60 * 1000);
    expect(useQuizStore.getState().getExamRemainingMs(startedAt!)).toBe(durationMs);
    expect(useQuizStore.getState().getExamRemainingMs(startedAt! + 60_000)).toBe(durationMs - 60_000);
    // Истёкший таймер не уходит в минус и не завершает прогон сам (это делает UI).
    expect(useQuizStore.getState().getExamRemainingMs(startedAt! + durationMs + 5_000)).toBe(0);
    expect(useQuizStore.getState().examSession.status).toBe('run');
  });

  it('getExamBreakdown группирует ответы по темам банка', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    answerFirst(3);

    const rows = useQuizStore.getState().getExamBreakdown();
    // Все ответы разложены по темам без потерь и дублей; строки отсортированы,
    // проценты в диапазоне. Точный состав тем зависит от seed выборки (три
    // вопроса могут попасть в одну тему), поэтому он проверяется отдельным
    // детерминированным кейсом ниже.
    expect(rows.reduce((sum, r) => sum + r.total, 0)).toBe(3);
    expect(rows.reduce((sum, r) => sum + r.correct, 0)).toBe(3);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(3);
    for (const row of rows) {
      expect(row.correct).toBeLessThanOrEqual(row.total);
      expect(row.percent).toBeGreaterThanOrEqual(0);
      expect(row.percent).toBeLessThanOrEqual(100);
    }
    expect(rows.map((r) => r.topic)).toEqual([...rows.map((r) => r.topic)].sort());
  });

  it('getExamBreakdown: детерминированный кейс — тема → счёт и процент', () => {
    // Банк из трёх вопросов (по одному на тему): правильный и неправильный ответ
    // дают ожидаемые 100 % и 0 % внутри своих тем.
    useQuizStore.setState({ questions: mockQuestions.slice(0, 3) });
    const ids = mockQuestions.slice(0, 3).map((q) => q.id);
    useQuizStore.getState().startExamSession(findPreset(30)!, ids);
    expect(useQuizStore.getState().examSession.questionIds).toHaveLength(3);

    const first = useQuizStore.getState().getExamCurrentQuestionId()!;
    useQuizStore.getState().submitExamAnswer(first, 0); // верный
    useQuizStore.getState().nextExamQuestion();
    const second = useQuizStore.getState().getExamCurrentQuestionId()!;
    useQuizStore.getState().submitExamAnswer(second, 1); // неверный
    useQuizStore.getState().nextExamQuestion();

    const rows = useQuizStore.getState().getExamBreakdown();
    expect(rows).toHaveLength(2);
    const byTopic = Object.fromEntries(rows.map((r) => [r.topic, r]));
    const firstTopic = mockQuestions.find((q) => q.id === first)!.topic;
    const secondTopic = mockQuestions.find((q) => q.id === second)!.topic;
    expect(byTopic[firstTopic]).toEqual({ topic: firstTopic, correct: 1, total: 1, percent: 100 });
    expect(byTopic[secondTopic]).toEqual({ topic: secondTopic, correct: 0, total: 1, percent: 0 });
    // Неотвеченный третий вопрос в разбор не попадает (нет ответа).
    expect(rows.reduce((sum, r) => sum + r.total, 0)).toBe(2);
  });

  it('examSession — session-only: в persisted-состоянии его нет', () => {
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    answerFirst(1);
    // Любое изменение состояния заставляет persist записать снимок.
    useQuizStore.getState().recordActivity();

    const raw = localStorage.getItem('rhcsa_progress');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(String(raw)) as { state: Record<string, unknown>; version: number };
    expect(parsed.state).not.toHaveProperty('examSession');
    // Текущая версия persist: 6 с spec 061 (retention добавил dailyGoalXp + todayXp).
    expect(parsed.version).toBe(6);
    // При этом текущее (in-memory) состояние прогон содержит.
    expect(useQuizStore.getState().examSession.answers).toHaveLength(1);
  });

  it('исторический инлайн-экзамен не сломан: answerExam/finishExam ведут к results', () => {
    useQuizStore.setState({ isQuizInProgress: true, currentIndex: 0 });
    useQuizStore.getState().startExam(20, 30 * 60 * 1000);
    expect(useQuizStore.getState().examQuestionIds).toHaveLength(20);
    expect(useQuizStore.getState().currentScreen).toBe('question');

    const id = useQuizStore.getState().examQuestionIds[0];
    useQuizStore.getState().answerExam(id, 0);
    expect(useQuizStore.getState().examAnswers).toHaveLength(1);

    useQuizStore.getState().finishExam();
    const s = useQuizStore.getState();
    expect(s.examActive).toBe(false);
    expect(s.currentScreen).toBe('results');
    expect(s.examLastResult?.answers).toHaveLength(1);
    // Новый прогон этим не затронут.
    expect(s.examSession.status).toBe('idle');
  });
});
