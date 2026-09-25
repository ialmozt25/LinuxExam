import type { QuestionJson } from '@/data/models/Question';
import bankTotals from './_topics.json';

/**
 * Bank sizes without loading the bank.
 *
 * `_topics.json` (≈260 B) is generated next to the topic chunks, so screens that
 * only need counts — the Dashboard, the paywall denominator — can render correct
 * numbers on the first paint instead of waiting for the bank.
 */
export function getBankTotal(): number {
  return bankTotals.total;
}

export function getTopicCount(topic: string): number {
  return (bankTotals.byTopic as Record<string, number>)[topic] ?? 0;
}

/**
 * Lazy loader for the question bank.
 *
 * The monolithic `questions.json` (≈143 kB) used to be a static import, which put
 * the whole bank inside the initial JS chunk. It is now split into one file per
 * topic, and every file is reached through a dynamic `import()` — Vite emits one
 * separate chunk per topic, so the initial chunk no longer carries the bank.
 *
 * `_order.json` holds the ids in the original global order. The regular quiz walks
 * `questions` by index (and `currentIndex` is persisted), so the loader must
 * restore that exact sequence rather than concatenating topics.
 */

type JsonModule = { default: QuestionJson[] };

/** One dynamic import per topic — each becomes its own build chunk. */
const LOADERS: Record<string, () => Promise<JsonModule>> = {
  essential_tools: () => import('./essential_tools.json'),
  file_management: () => import('./file_management.json'),
  file_permissions: () => import('./file_permissions.json'),
  file_systems: () => import('./file_systems.json'),
  local_storage: () => import('./local_storage.json'),
  manage_software: () => import('./manage_software.json'),
  networking: () => import('./networking.json'),
  process_management: () => import('./process_management.json'),
  running_systems: () => import('./running_systems.json'),
  security: () => import('./security.json'),
  shell_scripts: () => import('./shell_scripts.json'),
  text_files: () => import('./text_files.json'),
  users_groups: () => import('./users_groups.json'),
};

/** Topics that have a chunk, in the deterministic order of LOADERS. */
export const QUESTION_TOPICS: string[] = Object.keys(LOADERS);

function unwrap(mod: JsonModule | QuestionJson[]): QuestionJson[] {
  return Array.isArray(mod) ? mod : mod.default;
}

const topicCache = new Map<string, QuestionJson[]>();

/** Raw items of one topic (chunk fetched at most once). Unknown topic → empty list. */
export async function loadTopic(topic: string): Promise<QuestionJson[]> {
  const cached = topicCache.get(topic);
  if (cached) return cached;
  const loader = LOADERS[topic];
  if (!loader) return [];
  const items = unwrap(await loader());
  topicCache.set(topic, items);
  return items;
}

let allCache: QuestionJson[] | null = null;

/**
 * The complete bank in the original global order.
 * Any question missing from the manifest (a hand-added item) is appended at the end
 * instead of being dropped.
 */
export async function loadAll(): Promise<QuestionJson[]> {
  if (allCache) return allCache;
  const [orderMod, ...topicItems] = await Promise.all([
    import('./_order.json'),
    ...QUESTION_TOPICS.map(loadTopic),
  ]);

  const pool = new Map<string, QuestionJson>();
  for (const items of topicItems) {
    for (const q of items) pool.set(q.id, q);
  }

  const manifest = unwrap(orderMod as unknown as JsonModule) as unknown as string[];
  const ordered: QuestionJson[] = [];
  const used = new Set<string>();
  for (const id of manifest) {
    const q = pool.get(id);
    if (q) {
      ordered.push(q);
      used.add(id);
    }
  }
  for (const [id, q] of pool) {
    if (!used.has(id)) ordered.push(q);
  }

  allCache = ordered;
  return allCache;
}
