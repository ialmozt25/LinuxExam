import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AnswerRecord } from '@/data/models/AnswerRecord';
import type { Question } from '@/data/models/Question';

// `AnswerRecord.selectedIndex` is positional, so a bank reorder (commit 3bc8470
// shuffled options across all topics) silently moved a stored pick onto another
// option — that is what painted a wrong option green in "Продолжить".
// `optionText` is the stable identity of the pick; these tests pin the
// normalization that runs after the bank finally loads.

const STORAGE_KEY = 'rhcsa_progress';

type PersistedRecord = Omit<AnswerRecord, 'optionText'> & { optionText?: string };

// Inline fake bank: q1 keeps the correct option at index 1, q2 is the reordered
// shape where the same option moved to index 2.
const FAKE_QUESTIONS = [
  {
    id: 'q1',
    options: [
      { text: 'wrong old', correct: false }, // idx 0
      { text: 'right old', correct: true }, // idx 1
    ],
  },
  {
    id: 'q2',
    options: [
      { text: 'right', correct: true }, // idx 0
      { text: 'wrong', correct: false }, // idx 1
      { text: 'moved right', correct: true }, // idx 2
    ],
  },
] as unknown as Question[];

function setAnswered(answers: PersistedRecord[], version = 3) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { answers, currentIndex: 0, isPro: true }, version })
  );
}

async function freshStore(answers: PersistedRecord[], version = 3) {
  vi.resetModules();
  localStorage.clear();
  setAnswered(answers, version);
  const { useQuizStore } = await import('@/store/quizStore');
  return useQuizStore;
}

describe('normalizeAnswersAgainstBank', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('1. legacy record that still matches stays, and gains optionText', async () => {
    // q1: index 1 is the correct option and the stored flags agree.
    const useQuizStore = await freshStore([
      { questionId: 'q1', selectedIndex: 1, isCorrect: true },
    ]);
    useQuizStore.setState({ questions: FAKE_QUESTIONS });

    useQuizStore.getState().normalizeAnswersAgainstBank();

    expect(useQuizStore.getState().answers).toEqual([
      { questionId: 'q1', selectedIndex: 1, isCorrect: true, optionText: 'right old' },
    ]);
  });

  it('2. legacy record whose index no longer matches is dropped', async () => {
    // Exactly the pm_001 shape: index 0 claims to be correct, but q1.options[0]
    // is the wrong option now.
    const useQuizStore = await freshStore([
      { questionId: 'q1', selectedIndex: 0, isCorrect: true },
    ]);
    useQuizStore.setState({ questions: FAKE_QUESTIONS });

    useQuizStore.getState().normalizeAnswersAgainstBank();

    expect(useQuizStore.getState().answers).toEqual([]);
  });

  it('3. optionText wins: selectedIndex is recomputed for the moved option', async () => {
    const useQuizStore = await freshStore([
      { questionId: 'q2', selectedIndex: 0, isCorrect: false, optionText: 'moved right' },
    ]);
    useQuizStore.setState({ questions: FAKE_QUESTIONS });

    useQuizStore.getState().normalizeAnswersAgainstBank();

    const [record] = useQuizStore.getState().answers;
    expect(record.selectedIndex).toBe(2);
    expect(record.isCorrect).toBe(true);
    expect(record.optionText).toBe('moved right');
  });

  it('4. optionText that no longer exists in the bank is dropped', async () => {
    const useQuizStore = await freshStore([
      { questionId: 'q2', selectedIndex: 0, isCorrect: true, optionText: 'несуществующий' },
    ]);
    useQuizStore.setState({ questions: FAKE_QUESTIONS });

    useQuizStore.getState().normalizeAnswersAgainstBank();

    expect(useQuizStore.getState().answers).toEqual([]);
  });

  it('5. stored isCorrect is recomputed from the option, not trusted', async () => {
    const useQuizStore = await freshStore([
      { questionId: 'q1', selectedIndex: 1, isCorrect: false, optionText: 'right old' },
    ]);
    useQuizStore.setState({ questions: FAKE_QUESTIONS });

    useQuizStore.getState().normalizeAnswersAgainstBank();

    const [record] = useQuizStore.getState().answers;
    expect(record.isCorrect).toBe(true);
    expect(record.selectedIndex).toBe(1);
  });

  it('6. is idempotent', async () => {
    const useQuizStore = await freshStore([
      { questionId: 'q1', selectedIndex: 1, isCorrect: true },
      { questionId: 'q2', selectedIndex: 0, isCorrect: false, optionText: 'moved right' },
      { questionId: 'q_removed', selectedIndex: 0, isCorrect: true },
    ]);
    useQuizStore.setState({ questions: FAKE_QUESTIONS });

    useQuizStore.getState().normalizeAnswersAgainstBank();
    const first = JSON.stringify(useQuizStore.getState().answers);
    useQuizStore.getState().normalizeAnswersAgainstBank();
    const second = JSON.stringify(useQuizStore.getState().answers);

    expect(second).toBe(first);
    expect(JSON.parse(first)).toHaveLength(2);
  });

  it('7. empty bank is a no-op', async () => {
    const useQuizStore = await freshStore([
      { questionId: 'q1', selectedIndex: 0, isCorrect: true },
    ]);
    useQuizStore.setState({ questions: [] });

    useQuizStore.getState().normalizeAnswersAgainstBank();

    expect(useQuizStore.getState().answers).toEqual([
      { questionId: 'q1', selectedIndex: 0, isCorrect: true },
    ]);
  });

  it('8. reviewAnswers and examAnswers are normalized too', async () => {
    const useQuizStore = await freshStore([{ questionId: 'q1', selectedIndex: 1, isCorrect: true }]);
    useQuizStore.setState({
      questions: FAKE_QUESTIONS,
      reviewAnswers: [
        { questionId: 'q2', selectedIndex: 0, isCorrect: true, optionText: 'right' },
        { questionId: 'q1', selectedIndex: 0, isCorrect: true, optionText: 'wrong old' },
        { questionId: 'q1', selectedIndex: 0, isCorrect: true },
      ] as AnswerRecord[],
      examAnswers: [
        { questionId: 'q1', selectedIndex: 0, isCorrect: true, optionText: 'wrong old' },
      ] as AnswerRecord[],
    });

    useQuizStore.getState().normalizeAnswersAgainstBank();
    const s = useQuizStore.getState();

    // The optionText of a review pick is authoritative: the legacied flag is
    // recomputed. The third record has no optionText and its flags contradict
    // the bank, so it is dropped instead of being guessed at.
    expect(s.reviewAnswers).toEqual([
      { questionId: 'q2', selectedIndex: 0, isCorrect: true, optionText: 'right' },
      { questionId: 'q1', selectedIndex: 0, isCorrect: false, optionText: 'wrong old' },
    ]);
    expect(s.examAnswers).toEqual([
      { questionId: 'q1', selectedIndex: 0, isCorrect: false, optionText: 'wrong old' },
    ]);
  });
});
