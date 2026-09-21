import { useEffect, useState } from 'react';
import { useQuizStore } from '@/store/quizStore';

/**
 * Exam countdown derived from the wall-clock start timestamp rather than a
 * decrementing counter, so it stays accurate across a tab throttle, a re-render
 * or a reload mid-exam.
 */
export function useExamTimer() {
  const examActive = useQuizStore((s) => s.examActive);
  const examStartedAt = useQuizStore((s) => s.examStartedAt);
  const examDurationMs = useQuizStore((s) => s.examDurationMs);
  const finishExam = useQuizStore((s) => s.finishExam);

  const [remainingMs, setRemainingMs] = useState(() =>
    examStartedAt ? Math.max(0, examDurationMs - (Date.now() - examStartedAt)) : 0
  );

  useEffect(() => {
    if (!examActive || !examStartedAt) return;
    // Guard against a duplicate finishExam if several ticks land at/after zero.
    let fired = false;
    const tick = () => {
      const r = Math.max(0, examDurationMs - (Date.now() - examStartedAt));
      setRemainingMs(r);
      if (r <= 0 && !fired) {
        fired = true;
        finishExam();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [examActive, examStartedAt, examDurationMs, finishExam]);

  const mm = Math.floor(remainingMs / 60000);
  const ss = Math.floor((remainingMs % 60000) / 1000);
  return {
    remainingMs,
    display: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
  };
}
