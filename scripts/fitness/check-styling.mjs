#!/usr/bin/env node
/**
 * check-styling.mjs — fitness-проверка «styling-rules» (severity: high).
 *
 * Машинный детектор правил скилла `.dsh/skills/ui-styling-rules/SKILL.md` и
 * `boundaries.forbidden_patterns` контракта. Ищет в `src/**` (кроме `__tests__`):
 *   1) `100vh` без `100dvh` в том же файле     → mobile/TMA: нужен fallback-порядок
 *   2) `onMouseEnter`/`onMouseLeave` + inline `style={{` в одном блоке
 *                                              → :hover/:focus живут в CSS, не в JS
 *   3) `@media ... max-width`                  → только mobile-first min-width
 *   4) `className={` + interpolated template   → интерполяция классов ломает статику
 *
 * Zero-deps: только node:*. Symlink-каталоги не разворачиваются.
 * Exit 1 — есть находки; exit 0 — чисто.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'test-results', '__tests__', '__mocks__']);
const MAX_WIDTH_MQ = /@media[^{\n]*max-width/;
const CLASSNAME_INTERP = /className=\{\s*`/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile() && /\.(tsx|css)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const files = walk(path.join(ROOT, 'src'));
const findings = [];
const push = (file, line, rule, text) => findings.push({ file: rel(file), line, rule, text: text.trim() });

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  const hasDvh = /\b100dvh\b/.test(source);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 1) 100vh без 100dvh рядом
    if (!hasDvh && /\b100vh\b/.test(line)) {
      push(file, i + 1, 'viewport-unit', line);
    }

    // 2) hover/focus через inline styles
    if (/onMouse(Enter|Leave)\s*=/.test(line)) {
      const block = lines.slice(i, Math.min(i + 9, lines.length)).join('\n');
      if (/style=\{\{/.test(block)) push(file, i + 1, 'inline-hover-focus', line);
    }

    // 3) max-width медиа-запрос
    if (MAX_WIDTH_MQ.test(line)) push(file, i + 1, 'max-width-media-query', line);

    // 4) интерполяция в className
    if (CLASSNAME_INTERP.test(line) && /\$\{/.test(line)) {
      push(file, i + 1, 'classname-interpolation', line);
    }
  }
}

if (findings.length === 0) {
  console.log(`[styling-rules] OK — нарушений нет (проверено файлов: ${files.length})`);
  console.log('[summary] violations=0');
  process.exit(0);
}

console.log(`[styling-rules] FAIL — нарушений: ${findings.length} (в ${files.length} файлах)`);
for (const f of findings) console.log(`  ${f.file}:${f.line}: ${f.rule} — ${f.text.slice(0, 100)}`);
console.log('  fix: см. .dsh/skills/ui-styling-rules/SKILL.md');
console.log(`[summary] violations=${findings.length}`);
process.exit(1);
