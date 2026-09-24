import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll, QUESTION_TOPICS } from '../index';

/**
 * Bank ⇔ loader invariant.
 *
 * The bank is one file per topic (`<topic>.json`) plus two manifests: `_order.json`
 * (global id order) and `_topics.json` (counters for the Dashboard). The loader in
 * `index.ts` reaches every topic file through an explicit dynamic `import()`, so a
 * topic file that nobody imports is simply never fetched.
 *
 * That failure is silent: `loadAll()` skips ids absent from its pool, so a forgotten
 * import drops questions without any error while `_topics.json` keeps advertising the
 * larger total. The 2026-09-25 running_systems merge hit exactly this — 10 of 106
 * questions were unreachable and the topic was a no-op — and neither `tools/qc.cjs`
 * (it reads the directory) nor `tsc` could see it.
 *
 * ESM-safe on purpose: `import.meta.url`, never `__dirname`.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const BANK_DIR = join(HERE, '..');

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(BANK_DIR, name), 'utf8')) as T;
}

/** Topic files = every *.json that is not a manifest (`_order`, `_topics`). */
const topicFiles = readdirSync(BANK_DIR)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .sort();
const topicKeys = topicFiles.map((f) => f.replace(/\.json$/, ''));

const manifest = readJson<{ total: number; byTopic: Record<string, number> }>('_topics.json');
const order = readJson<string[]>('_order.json');

describe('bank loader invariant (files ⇔ LOADERS ⇔ _order.json ⇔ _topics.json)', () => {
  it('registers every bank topic file in LOADERS', () => {
    const registered = new Set(QUESTION_TOPICS);
    expect(topicKeys.filter((t) => !registered.has(t))).toEqual([]);
  });

  it('has a bank file for every topic LOADERS advertises', () => {
    const files = new Set(topicKeys);
    expect(QUESTION_TOPICS.filter((t) => !files.has(t))).toEqual([]);
  });

  it('keeps _topics.json in sync with the topic files and _order.json', () => {
    expect(Object.keys(manifest.byTopic).sort()).toEqual([...topicKeys].sort());
    expect(manifest.total).toBe(order.length);
    const sum = topicKeys.reduce((acc, t) => acc + manifest.byTopic[t], 0);
    expect(sum).toBe(manifest.total);
  });

  it('keeps _order.json and the topic files holding the same ids', () => {
    const fileIds = topicKeys.flatMap((t) =>
      readJson<Array<{ id: string }>>(t + '.json').map((q) => q.id)
    );
    expect(new Set(fileIds).size).toBe(fileIds.length); // no duplicate ids
    expect([...fileIds].sort()).toEqual([...order].sort());
  });

  it('loadAll() resolves every id of _order.json, in order', async () => {
    const loaded = await loadAll();
    // Order-sensitive: the regular quiz walks `questions` by index and
    // `currentIndex` is persisted, so the sequence must not shift.
    expect(loaded.map((q) => q.id)).toEqual(order);
    expect(loaded.length).toBe(manifest.total);
  });
});
