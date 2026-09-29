// Contract of the _order.json CLI (tools/order-manifest.mjs, spec 032 / task t1).
//
// The test is deliberately READ-ONLY for the real bank: it imports the exported pure
// helpers (argument parsing, deterministic placement, removal, serialization, diff) and
// exercises the read-only `checkDir` on the real questions directory. `main()` is never
// called, so `src/data/questions/_order.json` is not mutated - the CLI contract has no
// `--file`/`--dir` flag and this test must not fake one.
//
// What is pinned here:
//   * id format `<topic>_<3 digits>` (validation of --add/--remove);
//   * --add placement: APPEND to the end, existing relative order untouched;
//   * idempotence: a second --add of the same id is a no-op (`added: false`);
//   * --remove cuts exactly the id and preserves the rest;
//   * LF-only serialization with a final newline (writeLf-style);
//   * --check semantics: 0 only for an array of unique ids whose set equals the topic ids.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import {
  ID_PATTERN,
  ORDER_NAME,
  isValidId,
  parseArgs,
  placeId,
  removeId,
  serializeOrder,
  diffOrder,
  collectTopicIds,
  checkDir,
} from '../order-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = path.resolve(__dirname, '..', '..', 'src', 'data', 'questions');

describe('order-manifest: формат id <topic>_<3 цифры>', () => {
  it('принимает реальные id банка', () => {
    for (const id of ['fp_001', 'fm_016', 'msw_015', 'lsl_009', 'net_011', 'et_013']) {
      expect(isValidId(id), id).toBe(true);
    }
  });

  it('отклоняет всё остальное', () => {
    for (const id of ['fp_99', 'fp_0999', 'fp1_001', 'FP_001', 'fp001', 'fp__001', 'fp_00a', ' fp_001', 'fp_001 ', '', 'fp_', '_001']) {
      expect(isValidId(id), JSON.stringify(id)).toBe(false);
    }
    expect(isValidId(undefined)).toBe(false);
    expect(isValidId(42)).toBe(false);
  });
});

describe('order-manifest: разбор аргументов', () => {
  it('--check не требует значения', () => {
    expect(parseArgs(['--check'])).toEqual({ ok: true, mode: 'check', id: undefined });
  });

  it('--add/--remove принимают id отдельным аргументом и через =', () => {
    expect(parseArgs(['--add', 'fp_099'])).toEqual({ ok: true, mode: 'add', id: 'fp_099' });
    expect(parseArgs(['--add=fp_099'])).toEqual({ ok: true, mode: 'add', id: 'fp_099' });
    expect(parseArgs(['--remove', 'fp_099'])).toEqual({ ok: true, mode: 'remove', id: 'fp_099' });
    expect(parseArgs(['--remove=fp_099'])).toEqual({ ok: true, mode: 'remove', id: 'fp_099' });
  });

  it('отвергает пустой вызов, два режима, отсутствующий id и чужие флаги', () => {
    expect(parseArgs([]).ok).toBe(false);
    expect(parseArgs(['--add', 'fp_099', '--check']).ok).toBe(false);
    expect(parseArgs(['--add']).ok).toBe(false);
    expect(parseArgs(['--add', '--check']).ok).toBe(false);
    expect(parseArgs(['--file', 'x']).ok).toBe(false);
    expect(parseArgs(['--dir=x']).ok).toBe(false);
    expect(parseArgs(['--check=1']).ok).toBe(false);
  });
});

describe('order-manifest: детерминированное размещение (append в конец)', () => {
  it('новый id добавляется в конец, порядок остальных не меняется', () => {
    const before = ['fp_001', 'fm_001', 'pm_001'];
    const { order, added } = placeId(before, 'fp_099');
    expect(added).toBe(true);
    expect(order).toEqual(['fp_001', 'fm_001', 'pm_001', 'fp_099']);
    expect(before).toEqual(['fp_001', 'fm_001', 'pm_001']); // вход не мутирован
    expect(order.slice(0, 3)).toEqual(before);
  });

  it('правило — чистая функция от (массив, id): повтор даёт тот же результат', () => {
    const base = ['a_001', 'b_002'];
    expect(placeId(base, 'c_003').order).toEqual(placeId(base, 'c_003').order);
    const twice = placeId(placeId(base, 'c_003').order, 'a_001').order; // уже есть
    expect(twice).toEqual(['a_001', 'b_002', 'c_003']);
  });

  it('--add существующего id — no-op (added: false), массив не меняется', () => {
    const before = ['fp_001', 'fp_002'];
    const { order, added } = placeId(before, 'fp_001');
    expect(added).toBe(false);
    expect(order).toBe(before);
  });
});

describe('order-manifest: --remove', () => {
  it('вырезает id и сохраняет порядок остальных', () => {
    const { order, removed } = removeId(['fp_001', 'fm_001', 'fp_002'], 'fm_001');
    expect(removed).toBe(true);
    expect(order).toEqual(['fp_001', 'fp_002']);
  });

  it('отсутствующий id — no-op (removed: false)', () => {
    const before = ['fp_001'];
    const { order, removed } = removeId(before, 'fp_099');
    expect(removed).toBe(false);
    expect(order).toBe(before);
  });

  it('round-trip add → remove возвращает исходный массив', () => {
    const before = ['fp_001', 'fm_001'];
    const after = placeId(before, 'fp_099').order;
    expect(removeId(after, 'fp_099').order).toEqual(before);
  });
});

describe('order-manifest: запись LF + финальный \\n', () => {
  it('сериализация: LF-only, финальный перевод строки, отступ 2', () => {
    const out = serializeOrder(['fp_001', 'fm_001']);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.includes('\r')).toBe(false);
    expect(out).toBe('[\n  "fp_001",\n  "fm_001"\n]\n');
    expect(JSON.parse(out)).toEqual(['fp_001', 'fm_001']);
  });

  it('пустой массив тоже пишется с финальным \\n', () => {
    expect(serializeOrder([])).toBe('[]\n');
  });
});

describe('order-manifest: --check (сверка множеств)', () => {
  it('совпадающие множества → ok', () => {
    expect(diffOrder(['fp_001', 'fm_001'], new Set(['fm_001', 'fp_001']))).toEqual({ ok: true, problems: [] });
  });

  it('не хватает id / лишний id → проблемы', () => {
    const missing = diffOrder(['fp_001'], new Set(['fp_001', 'fm_001']));
    expect(missing.ok).toBe(false);
    expect(missing.problems).toEqual(['id in topic files, not in _order.json: fm_001']);

    const extra = diffOrder(['fp_001', 'fm_001'], new Set(['fp_001']));
    expect(extra.ok).toBe(false);
    expect(extra.problems).toEqual(['id in _order.json, not in topic files: fm_001']);
  });

  it('дубликат или не-строка в _order.json → проблемы', () => {
    const dup = diffOrder(['fp_001', 'fp_001'], new Set(['fp_001']));
    expect(dup.ok).toBe(false);
    expect(dup.problems).toEqual(['_order.json: duplicate id: fp_001']);

    const broken = diffOrder(['fp_001', 7, ''], new Set(['fp_001']));
    expect(broken.ok).toBe(false);
    expect(broken.problems).toHaveLength(2);
  });

  it('корень не массив → проблема', () => {
    expect(diffOrder({ total: 1 }, new Set()).ok).toBe(false);
  });

  it('реальный банк согласован: checkDir → 0 (read-only)', () => {
    const result = checkDir(QUESTIONS_DIR);
    expect(result.problems).toEqual([]);
    expect(result.code).toBe(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.ordered).toBe(result.total);
    expect(result.files).toBeGreaterThan(0);
  });

  it('checkDir не пишет файл: содержимое _order.json байт-в-байт то же', () => {
    const file = path.join(QUESTIONS_DIR, ORDER_NAME);
    const before = fs.readFileSync(file);
    checkDir(QUESTIONS_DIR);
    expect(fs.readFileSync(file).equals(before)).toBe(true);
  });

  it('collectTopicIds читает реальный банк без записи', () => {
    const { ids, problems, files } = collectTopicIds(QUESTIONS_DIR);
    const manifest = JSON.parse(fs.readFileSync(path.join(QUESTIONS_DIR, ORDER_NAME), 'utf8'));
    expect(problems).toEqual([]);
    expect(files.length).toBeGreaterThan(0);
    expect(ids.has('fp_001')).toBe(true);
    expect(ids.size).toBe(manifest.length);
  });

  it('ID_PATTERN и ORDER_NAME — публичный контракт', () => {
    expect(ID_PATTERN.source).toBe('^[a-z]+_\\d{3}$');
    expect(ORDER_NAME).toBe('_order.json');
  });
});
