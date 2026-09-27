// Границы классов и порогов option ratio (tools/_lib/ratio.cjs, spec 007).
//
// `.mjs` + createRequire: сама библиотека гейта — CommonJS (tools/_lib/ratio.cjs),
// а `require('vitest')` внутри .cjs-теста Vitest запрещает
// («Vitest cannot be imported in a CommonJS module using require()»), поэтому
// тест — ESM, а CJS-модуль подключается через createRequire (spec 007 разрешает
// оба варианта пути).
//
// Контракт, который тут зафиксирован:
//   * длина опции — в СИМВОЛАХ (RATIO_UNIT), класс — по ЧИСЛУ СЛОВ;
//   * fail  <=> ratio > threshold; warn <=> warnFrom < ratio <= threshold; ok иначе.
// Пороги берутся из RATIO_TABLE, поэтому тест падает, если порог поменяют молча.
//
// NB: в спеке 007 граница названа «ok» для sentences 1.30 / token 2.00 / mixed 1.50;
// фактический вердикт на самой границе — `warn`, потому что ratio уже > warnFrom
// (1.25 / 1.35 / 1.35). `ok` там означает «не FAIL». Тест фиксирует реальное
// поведение кода, не меняя пороги (критерий «пороги не меняются»).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  RATIO_UNIT,
  RATIO_UNIT_LABEL,
  RATIO_TABLE,
  RULES,
  classifyOptions,
  computeRatio,
  checkRatio,
} = require('../_lib/ratio.cjs');

const BASE_W4 = ['truncate', '-s', '0', 'data.log'].join(' '); // 4 слова, 22 символа
const BASE_W3 = ['rm', '-f', 'x.log'].join(' '); // 3 слова, 11 символов

// Опция ровно из len символов: база добирается 'x' в последнем слове, поэтому
// число слов не меняется, а длина в символах — точная (нужна для границ ratio).
function optOf(words, len) {
  if (len < words.length) throw new Error(`len ${len} < base ${words.length} ("${words}")`);
  return { text: words + 'x'.repeat(len - words.length), correct: false };
}

const sentenceOptions = (...lens) => lens.map((l) => optOf(BASE_W4, l));
const tokenOptions = (...lens) => lens.map((l) => optOf(BASE_W3, l));
const mixedOptions = (shortLen, longLen) => [
  optOf(BASE_W3, shortLen),
  optOf(BASE_W3, shortLen),
  optOf(BASE_W4, longLen),
  optOf(BASE_W4, longLen),
];

describe('ratio: единица измерения и таблица порогов', () => {
  it('единица объявлена в библиотеке и равна chars', () => {
    expect(RATIO_UNIT).toBe('chars');
    expect(RATIO_UNIT_LABEL).toBe('символы');
  });

  it('RATIO_TABLE — единственный источник: пороги и условия классов из спеки 007', () => {
    expect(RATIO_TABLE.map((r) => [r.type, r.when, r.threshold, r.warnFrom, r.unit])).toEqual([
      ['sentences', 'все 4 опции ≥ 4 слов', 1.3, 1.25, 'chars'],
      ['token', 'все 4 опции ≤ 3 слов', 2.0, 1.35, 'chars'],
      ['mixed', 'иначе', 1.5, 1.35, 'chars'],
    ]);
  });

  it('RULES — производная от RATIO_TABLE, а не второй набор чисел', () => {
    for (const row of RATIO_TABLE) {
      expect(RULES[row.type]).toEqual({ threshold: row.threshold, warnFrom: row.warnFrom });
    }
    expect(Object.keys(RULES).sort()).toEqual(['mixed', 'sentences', 'token']);
  });

  it('потребители не объявляют собственную единицу (нет литерала const RATIO_UNIT)', () => {
    for (const rel of ['../qc.cjs', '../haladyna.cjs']) {
      const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
      expect(src).not.toMatch(/const\s+RATIO_UNIT\s*=/);
      expect(src).toMatch(/RATIO_UNIT[^=]*=\s*require\(['"]\.\/_lib\/ratio\.cjs['"]\)/);
    }
  });

  it('вердикт гейта отдаёт класс и единицу измерения', () => {
    const r = checkRatio(sentenceOptions(100, 100, 100, 131), RATIO_UNIT);
    expect(r.unit).toBe(RATIO_UNIT);
    expect(r.ruleUnit).toBe(RATIO_UNIT);
    expect(r.threshold).toBe(RULES.sentences.threshold);
    expect(r.warnFrom).toBe(RULES.sentences.warnFrom);
  });

  it('класс выбирается по числу слов', () => {
    expect(classifyOptions(sentenceOptions(100, 100, 100, 130))).toBe('sentences');
    expect(classifyOptions(tokenOptions(20, 20, 20, 40))).toBe('token');
    expect(classifyOptions(mixedOptions(20, 30))).toBe('mixed');
  });
});

describe('ratio: границы класса sentences (fail > 1.30, warn > 1.25)', () => {
  it('ratio 1.25 ровно — ok (warnFrom не превышен)', () => {
    const r = checkRatio(sentenceOptions(100, 100, 100, 125), RATIO_UNIT);
    expect(r.type).toBe('sentences');
    expect(r.ratio).toBe(1.25);
    expect(r.verdict).toBe('ok');
  });

  it('ratio 1.26 — warn (выше warnFrom 1.25, ниже порога)', () => {
    const r = checkRatio(sentenceOptions(100, 100, 100, 126), RATIO_UNIT);
    expect(r.ratio).toBeGreaterThan(1.25);
    expect(r.verdict).toBe('warn');
  });

  it('ratio ровно 1.30 — не fail (граница порога)', () => {
    const r = checkRatio(sentenceOptions(100, 100, 100, 130), RATIO_UNIT);
    expect(r.ratio).toBe(1.3);
    expect(r.threshold).toBe(1.3);
    expect(r.verdict).not.toBe('fail');
    expect(r.verdict).toBe('warn');
  });

  it('ratio 1.31 — fail', () => {
    const r = checkRatio(sentenceOptions(100, 100, 100, 131), RATIO_UNIT);
    expect(r.ratio).toBe(1.31);
    expect(r.verdict).toBe('fail');
  });
});

describe('ratio: границы класса token (fail > 2.00, warn > 1.35)', () => {
  it('ratio ровно 2.00 — не fail (граница порога)', () => {
    const r = checkRatio(tokenOptions(20, 20, 20, 40), RATIO_UNIT);
    expect(r.type).toBe('token');
    expect(r.ratio).toBe(2);
    expect(r.verdict).not.toBe('fail');
    expect(r.verdict).toBe('warn');
  });

  it('ratio 2.01 — fail', () => {
    const r = checkRatio(tokenOptions(100, 100, 100, 201), RATIO_UNIT);
    expect(r.ratio).toBe(2.01);
    expect(r.verdict).toBe('fail');
  });

  it('ratio ровно 1.35 — ok, 1.36 — warn', () => {
    expect(checkRatio(tokenOptions(100, 100, 100, 135), RATIO_UNIT).verdict).toBe('ok');
    expect(checkRatio(tokenOptions(100, 100, 100, 136), RATIO_UNIT).verdict).toBe('warn');
  });
});

describe('ratio: границы класса mixed (fail > 1.50, warn > 1.35)', () => {
  it('ratio ровно 1.50 — не fail (граница порога)', () => {
    const r = checkRatio(mixedOptions(20, 30), RATIO_UNIT);
    expect(r.type).toBe('mixed');
    expect(r.ratio).toBe(1.5);
    expect(r.verdict).not.toBe('fail');
    expect(r.verdict).toBe('warn');
  });

  it('ratio 1.51 — fail', () => {
    const r = checkRatio(mixedOptions(100, 151), RATIO_UNIT);
    expect(r.ratio).toBe(1.51);
    expect(r.verdict).toBe('fail');
  });
});

describe('computeRatio', () => {
  it('пустая опция → Infinity (сигнал, а не 0)', () => {
    const options = [optOf(BASE_W4, 100), { text: '', correct: false }];
    expect(computeRatio(options, RATIO_UNIT)).toBe(Infinity);
    expect(checkRatio(options, RATIO_UNIT).verdict).toBe('fail');
  });

  it('пустой список опций → 0', () => {
    expect(computeRatio([], RATIO_UNIT)).toBe(0);
  });

  it('считает в символах: ratio = max(len) / min(len)', () => {
    expect(computeRatio(sentenceOptions(100, 100, 100, 130), RATIO_UNIT)).toBe(1.3);
  });
});
