#!/usr/bin/env node
/**
 * .project/scripts/factory-sync-template.mjs — пересборка `templates/factory/`
 * из источника (спека 024, F5.1a).
 *
 * Что делает:
 *   1) копирует продуктово-нейтральные файлы фабрики в `templates/factory/`;
 *   2) применяет замены продукто-специфичных строк на плейсхолдеры
 *      (`{{PRODUCT}}`, `{{GITHUB_OWNER}}`, `{{CAPTAIN_TZ}}`, `{{PROJECT_ROOT}}`,
 *      `{{DSH_BIN}}`) и удаляет продуктовые числа (банк 224/300);
 *   3) НЕ перезаписывает файлы, которые в шаблоне пишутся с нуля:
 *      `docs/FACTORY-PLAN.md`, `docs/START-HERE.md`, `.project/state.json`,
 *      `.project/sync.mjs`, `docs/memory/*.md`, `package.json`, `README.md`,
 *      `docs/FACTORY-USAGE.md` — они живут в `templates/factory/` и правятся
 *      вручную (или создаются B-шагом).
 *
 * Идемпотентность: повторный запуск не портит уже заменённые плейсхолдеры,
 * потому что замены ищут продуктовые строки, а их в шаблоне уже нет.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = path.join(ROOT, 'templates', 'factory');
const rel = (p) => path.join(ROOT, p);
const tpl = (p) => path.join(TEMPLATE, p);

/** Явный skip-list: эти пути в шаблон не попадают. */
const SKIP = [
  '.agent-teams/',
  '.project/agents/',
  '.project/audits/',
  '.project/drafts/',
  '.project/specs/',
  '.project/log.md',
  '.project/DECISIONS.md',
  '.project/factory/RESEARCH.md',
  '.project/factory/snapshots/',
  'docs/archive/',
  'docs/dashboard/',
  'docs/index.html',
  'node_modules/',
  '.git/',
  '.backup-tld-',
  'filelists-BaseOS.xml.gz',
];

/**
 * Замены: продуктовое → плейсхолдер. Порядок важен (длинные пути — раньше).
 * `ci: true` — регистронезависимая замена: в источнике встречается и `LinuxExam`,
 * и `linuxexam-*` (имена пресетов DSH в нижнем регистре).
 */
const REPLACEMENTS = [
  ['C:\\Users\\Alexey Udotov\\AppData\\Roaming\\npm\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js', '{{DSH_BIN}}', false],
  ['C:\\Users\\Alexey Udotov\\LinuxExam', '{{PROJECT_ROOT}}', false],
  ['ialmozt25', '{{GITHUB_OWNER}}', false],
  ['Europe/Moscow', '{{CAPTAIN_TZ}}', false],
  ['LinuxExam', '{{PRODUCT}}', true],
  ['224 / 300', '', false],
  ['224/300', '', false],
];

let copied = 0;
let skipped = 0;
let replacements = 0;
const applied = new Map();

function isSkipped(relPath) {
  const posix = relPath.split(path.sep).join('/');
  return SKIP.some((s) => posix === s.replace(/\/$/, '') || posix.startsWith(s) || posix.includes(s));
}

function applyReplacements(text) {
  let out = text;
  for (const [from, to, ci] of REPLACEMENTS) {
    if (ci) {
      const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const hits = (out.match(re) || []).length;
      if (hits > 0) {
        out = out.replace(re, to);
        replacements += hits;
        applied.set(from, (applied.get(from) || 0) + hits);
      }
      continue;
    }
    const hits = out.split(from).length - 1;
    if (hits > 0) {
      out = out.split(from).join(to);
      replacements += hits;
      applied.set(from, (applied.get(from) || 0) + hits);
    }
  }
  return out;
}

/** Файлы шаблона, которые НЕ перезаписываются из источника. */
const OURS = new Set([
  '.project/sync.mjs',
  '.project/state.json',
  '.project/scripts/check-episodic.mjs',
  'docs/FACTORY-PLAN.md',
  'docs/START-HERE.md',
  'docs/memory/episodic.md',
  'docs/memory/semantic.md',
  'docs/memory/procedural.md',
  'docs/memory/working.md',
  'docs/memory/alerts.md',
  'docs/memory/trends.jsonl',
  'package.json',
  'README.md',
  'docs/FACTORY-USAGE.md',
]);

function copyWithReplacements(srcRel, dstRel) {
  const from = rel(srcRel);
  if (!fs.existsSync(from)) return false;
  if (OURS.has(dstRel.split(path.sep).join('/'))) {
    skipped += 1;
    return false;
  }
  fs.mkdirSync(path.dirname(tpl(dstRel)), { recursive: true });
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const childSrc = path.join(srcRel, entry.name);
      const childDst = path.join(dstRel, entry.name);
      if (entry.isDirectory()) copyWithReplacements(childSrc, childDst);
      else copyWithReplacements(childSrc, childDst);
    }
    return true;
  }
  if (isSkipped(srcRel)) { skipped += 1; return false; }
  const text = fs.readFileSync(from, 'utf8');
  fs.writeFileSync(tpl(dstRel), applyReplacements(text), { encoding: 'utf8' });
  copied += 1;
  return true;
}

/* --- основной манифест ------------------------------------------------- */

const MANIFEST = [
  '.project/ORCH-RULES.md',
  '.project/factory/ARCHITECTURE.md',
  '.project/factory/CENTER-SPEC.md',
  '.project/factory/CONTRACTS.md',
  '.project/factory/DOD.md',
  '.project/factory/roles.yaml',
  '.project/factory/roles',
  '.githooks/pre-commit',
  'tools/check-episodic.mjs',
];

fs.mkdirSync(TEMPLATE, { recursive: true });
for (const srcRel of MANIFEST) {
  const dstRel = srcRel === 'tools/check-episodic.mjs'
    ? path.join('.project', 'scripts', 'check-episodic.mjs')
    : srcRel;
  const ok = copyWithReplacements(srcRel, dstRel);
  if (!ok) process.stdout.write(`  пропущено (нет в источнике): ${srcRel}\n`);
}

process.stdout.write(`скопировано: ${copied}; пропущено: ${skipped}; замен: ${replacements}\n`);
for (const [from, hits] of applied) process.stdout.write(`  ${from} → ×${hits}\n`);
