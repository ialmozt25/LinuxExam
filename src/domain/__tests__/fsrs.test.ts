import { describe, it, expect } from 'vitest';
import {
  BASE_INTERVALS,
  DAY_MS,
  MAX_STABILITY,
  MIN_STABILITY,
  clamp,
  difficultyScoreOf,
  dueIds,
  ensureRecords,
  fsrsDifficulty,
  intervalIndex,
  isUsableRecord,
  nextInterval,
  nextIntervalRecord,
  pickToday,
  scheduleReview,
} from '@/domain/fsrs';
import type { ReviewRecord } from '@/domain/fsrs';
import type { Question } from '@/data/models/Question';

const NOW = 1_800_000_000_000; // фиксированный now: тесты не зависят от часов

/** Минимальная форма вопроса — pickToday читает только `id`. */
function q(id: string): Question {
  return { id } as Question;
}

describe('fsrs.nextInterval — базисная сетка дней', () => {
  it('сетка состоит из 1/3/7/14/30/60 дней, шаг растёт по floor(log2(stability))', () => {
    expect([...BASE_INTERVALS]).toEqual([1, 3, 7, 14, 30, 60]);

    // Последовательные Good: stability × 1.5, следующий интервал — первый шаг
    // сетки, индекс которого достигнут (1 → 3 → 3 → 7 → 7 → 14 …). Дубли шага
    // ожидаемы: сетка ступенчатая, а stability растёт множителем.
    const expected = [1, 3, 3, 7, 7, 14];
    const actual: number[] = [];
    let record = scheduleReview(null, 'Good', NOW);
    actual.push(nextInterval(record.stability, 'Good'));
    for (let i = 1; i < expected.length; i++) {
      record = scheduleReview(record, 'Good', NOW);
      actual.push(nextInterval(record.stability, 'Good'));
    }
    expect(actual).toEqual(expected);

    // Дальше по той же кривой сетка доходит до максимума 60 дней и упирается в него.
    for (let i = 0; i < 17; i++) record = scheduleReview(record, 'Good', NOW);
    expect(record.stability).toBe(MAX_STABILITY);
    expect(nextInterval(record.stability, 'Good')).toBe(60);

    // Обе крайние точки сетки достижимы: 20 дней → шаг 30, 365 дней → шаг 60.
    expect(nextInterval(20, 'Good')).toBe(30);
    expect(nextInterval(365, 'Good')).toBe(60);
  });

  it('индекс шага = floor(log2(stability)) с зажимом в [0, 5]', () => {
    expect(intervalIndex(0.1)).toBe(0);
    expect(intervalIndex(1)).toBe(0);
    expect(intervalIndex(2)).toBe(1);
    expect(intervalIndex(3.9)).toBe(1);
    expect(intervalIndex(4)).toBe(2);
    expect(intervalIndex(32)).toBe(5);
    expect(intervalIndex(365)).toBe(5);
    expect(intervalIndex(Number.NaN)).toBe(0); // битый вход → нижняя граница сетки
  });

  it('nextInterval(0.1, Good) === 1; nextInterval(365, Good) === 60', () => {
    expect(nextInterval(0.1, 'Good')).toBe(1);
    expect(nextInterval(1.5, 'Good')).toBe(1);
    expect(nextInterval(365, 'Good')).toBe(60);
    // Сетка не зависит от оценки: stability уже её учитывает.
    expect(nextInterval(365, 'Again')).toBe(60);
  });

  it('nextIntervalRecord отдаёт epoch ms из сетки и сохраняет обе шкалы', () => {
    const rec = nextIntervalRecord(3, 0.3, NOW, 'Good');
    expect(rec).toEqual({
      next: NOW + 3 * DAY_MS,
      stabilityDays: 3,
      difficultyScore: 0.3,
    });
    // Битые шкалы зажимаются, а не выбрасываются.
    expect(nextIntervalRecord(Number.NaN, 5, NOW).difficultyScore).toBe(1);
    expect(nextIntervalRecord(Number.NaN, 5, NOW).stabilityDays).toBe(MIN_STABILITY);
  });
});

describe('fsrs.scheduleReview — пересчёт записи расписания', () => {
  it('нет записи + Good → stability 1.5, difficulty 0.25, next = now + 1 день', () => {
    const rec = scheduleReview(null, 'Good', NOW);
    expect(rec.stability).toBe(1.5);
    expect(rec.difficulty).toBeCloseTo(0.25, 10);
    expect(rec.next).toBe(NOW + 1 * DAY_MS);
    expect(rec.next).toBeGreaterThan(NOW); // вопрос сразу выходит из N
  });

  it('нет записи + Again → stability 0.5, difficulty 0.4, next = now + 1 день', () => {
    const rec = scheduleReview(null, 'Again', NOW);
    expect(rec.stability).toBe(0.5);
    expect(rec.difficulty).toBeCloseTo(0.4, 10);
    expect(rec.next).toBe(NOW + 1 * DAY_MS);
  });

  it('cap 365 при повторных Good и пол 0.1 при повторных Again', () => {
    let good = scheduleReview(null, 'Good', NOW);
    for (let i = 0; i < 20; i++) good = scheduleReview(good, 'Good', NOW);
    expect(good.stability).toBe(MAX_STABILITY);
    // Сетка упирается в 60 дней: next не уходит за максимум сетки.
    expect(good.next - NOW).toBe(60 * DAY_MS);
    expect(good.difficulty).toBe(0);

    let again = scheduleReview(null, 'Again', NOW);
    for (let i = 0; i < 20; i++) again = scheduleReview(again, 'Again', NOW);
    expect(again.stability).toBe(MIN_STABILITY);
    expect(again.difficulty).toBe(1);
    expect(again.next - NOW).toBe(1 * DAY_MS);
  });

  it('битые шкалы (NaN, Infinity, −1) зажимаются к границам, запись не теряется', () => {
    const nan = scheduleReview({ next: NOW, stability: Number.NaN, difficulty: Number.NaN }, 'Again', NOW);
    expect(nan.stability).toBe(MIN_STABILITY); // NaN → нижняя граница
    expect(nan.difficulty).toBeCloseTo(0.1, 10); // 0 (нижняя граница) + 0.1
    expect(Number.isFinite(nan.next)).toBe(true);
    expect(nan.next - NOW).toBe(DAY_MS); // шаг 1 день: stability на нижней границе

    const inf = scheduleReview(
      { next: NOW, stability: Number.POSITIVE_INFINITY, difficulty: Number.POSITIVE_INFINITY },
      'Good',
      NOW,
    );
    expect(inf.stability).toBe(MAX_STABILITY);
    expect(inf.difficulty).toBeCloseTo(0.95, 10); // Infinity → 1 (верхняя граница), затем −0.05

    const negative = scheduleReview({ next: NOW, stability: -10, difficulty: -1 }, 'Again', NOW);
    expect(negative.stability).toBe(MIN_STABILITY);
    expect(negative.difficulty).toBeCloseTo(0.1, 10); // 0 (нижняя граница) + 0.1
  });

  it('clamp — единая точка зажима значений', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(Number.NaN, 0.1, 365)).toBe(0.1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('шкалы спеки и FSRS отображаются друг в друга', () => {
    expect(fsrsDifficulty(0)).toBe(1);
    expect(fsrsDifficulty(1)).toBe(10);
    expect(difficultyScoreOf(1)).toBe(0);
    expect(difficultyScoreOf(10)).toBe(1);
    expect(fsrsDifficulty(difficultyScoreOf(7))).toBeCloseTo(7, 10);
  });
});

describe('fsrs.pickToday — кого пора повторить', () => {
  it('пустой реестр + пустой банк → []', () => {
    expect(pickToday({}, [], NOW)).toEqual([]);
  });

  it('пустой реестр + банк → все id банка (нет записи = пора сейчас)', () => {
    expect(pickToday({}, [q('q1'), q('q2'), q('q3')], NOW)).toEqual(['q1', 'q2', 'q3']);
  });

  it('нет записи и для одного из трёх → он тоже в списке', () => {
    const rec = { next: NOW + DAY_MS, stability: 1.5, difficulty: 0.45 };
    expect(pickToday({ q1: rec, q3: rec }, [q('q1'), q('q2'), q('q3')], NOW)).toEqual(['q2']);
  });

  it('все next > now → []; все next ≤ now → все; смешанный → только истёкшие', () => {
    const future = { next: NOW + 1, stability: 1, difficulty: 0.5 };
    const past = { next: NOW - 1, stability: 1, difficulty: 0.5 };
    const bank = [q('q1'), q('q2'), q('q3')];

    expect(pickToday({ q1: future, q2: future, q3: future }, bank, NOW)).toEqual([]);
    expect(pickToday({ q1: past, q2: past, q3: past }, bank, NOW)).toEqual(['q1', 'q2', 'q3']);
    expect(pickToday({ q1: past, q2: future, q3: past }, bank, NOW)).toEqual(['q1', 'q3']);

    // Граница включительна: next === now уже пора.
    expect(pickToday({ q1: { next: NOW, stability: 1, difficulty: 0.5 } }, [q('q1')], NOW)).toEqual([
      'q1',
    ]);
  });

  it('просроченный next входит в N ровно один раз и не теряется', () => {
    const overdue = { next: NOW - 40 * DAY_MS, stability: 1, difficulty: 0.5 };
    expect(pickToday({ q1: overdue }, [q('q1')], NOW)).toEqual(['q1']);
  });

  it('id вне банка и битые записи не ломают расчёт', () => {
    // persist не валидирует форму JSON, поэтому такие записи реально доходят
    // до расчёта: типизируем их как неизвестные значения из хранилища.
    const broken: Record<string, unknown> = {
      q1: { next: Number.NaN },
      q2: { next: '2020-01-01' },
      q3: { next: null },
    };
    // Все три записи невалидны → для q1..q3 это «нет записи» → пора сейчас,
    // а чужой qid не попадает в результат, потому что его нет в банке.
    expect(
      pickToday(broken as unknown as Record<string, ReviewRecord>, [q('q1'), q('q2'), q('q3')], NOW),
    ).toEqual(['q1', 'q2', 'q3']);
    expect(pickToday({ ghost: { next: NOW - 1, stability: 1, difficulty: 0.5 } }, [q('q1')], NOW)).toEqual([
      'q1',
    ]);
  });

  it('isUsableRecord принимает только конечный числовой next', () => {
    expect(isUsableRecord({ next: NOW, stability: 1, difficulty: 0.5 })).toBe(true);
    expect(isUsableRecord({ next: Number.NaN })).toBe(false);
    expect(isUsableRecord({ next: 'soon' })).toBe(false);
    expect(isUsableRecord(null)).toBe(false);
    expect(isUsableRecord(undefined)).toBe(false);
  });

  it('dueIds работает по одному реестру и отбрасывает битые записи', () => {
    expect(dueIds({}, NOW)).toEqual([]);
    expect(
      dueIds(
        {
          q1: { next: NOW - 1, stability: 1, difficulty: 0.5 },
          q2: { next: NOW + 1, stability: 1, difficulty: 0.5 },
          q3: { next: Number.NaN, stability: 1, difficulty: 0.5 },
        },
        NOW,
      ),
    ).toEqual(['q1']);
  });
});

describe('fsrs.ensureRecords — наполнение реестра (ADV-601)', () => {
  it('пустой реестр + банк → запись на каждый id с next = now (N = банк)', () => {
    const filled = ensureRecords({}, ['q1', 'q2'], NOW);
    expect(Object.keys(filled)).toEqual(['q1', 'q2']);
    expect(filled.q1).toEqual({ next: NOW, stability: 1, difficulty: 0.3 });
    expect(pickToday(filled, [q('q1'), q('q2')], NOW)).toHaveLength(2);
  });

  it('идемпотентно: полный реестр возвращается тем же объектом (нет лишних рендеров)', () => {
    const full = ensureRecords({}, ['q1', 'q2'], NOW);
    const again = ensureRecords(full, ['q1', 'q2'], NOW);
    expect(again).toBe(full);
    // Повторный вызов не дублирует и не меняет существующие записи.
    const scheduled = { q1: { next: NOW + DAY_MS, stability: 1.5, difficulty: 0.45 } };
    const untouched = ensureRecords(scheduled, ['q1'], NOW);
    expect(untouched).toBe(scheduled);
    expect(untouched.q1.next).toBe(NOW + DAY_MS);
  });

  it('битая запись перезаписывается валидной, соседние не трогаются', () => {
    const scheduled = {
      q1: { next: Number.NaN, stability: 1, difficulty: 0.5 },
      q2: { next: NOW + 5 * DAY_MS, stability: 7, difficulty: 0.2 },
    };
    const filled = ensureRecords(scheduled, ['q1', 'q2'], NOW);
    expect(filled).not.toBe(scheduled);
    expect(filled.q1.next).toBe(NOW);
    expect(filled.q2).toBe(scheduled.q2);
  });

  it('миграция v3→v4 идемпотентна: пустой реестр даёт банк, повтор — no-op', () => {
    // «migrate» создаёт пустой реестр; наполнение считает N по банку.
    const migrated: Record<string, never> = {};
    const bankIds = ['a', 'b', 'c'];
    const first = ensureRecords(migrated, bankIds, NOW);
    expect(pickToday(first, bankIds.map(q), NOW)).toHaveLength(3);
    const second = ensureRecords(first, bankIds, NOW);
    expect(second).toBe(first);
    expect(Object.keys(second)).toHaveLength(3); // ни дублей, ни потерь
  });
});
