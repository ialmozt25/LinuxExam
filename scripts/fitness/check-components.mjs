#!/usr/bin/env node
/**
 * check-components.mjs — fitness-проверка «no-duplicate-components» (high).
 *
 * Запрещает определения Badge/Button/Card вне src/ui/. Строки с импортом
 * (`from '...'`) исключаются, чтобы `import { Button } from ...` не считался
 * определением.
 *
 * Zero-deps: только node:*. Exit 1 — есть находки; exit 0 — чисто.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const DEF_RE = /(?:function|const)\s+(Badge|Button|Card)\b/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'test-results', '__tests__']);
const UI_DIR = path.join(ROOT, 'src', 'ui');

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
    } else if (e.isFile() && /\.(tsx|ts)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const files = walk(path.join(ROOT, 'src'));
const findings = [];
let scanned = 0;

for (const file of files) {
  // src/ui/** — санкционированное место для Badge/Button/Card.
  if (file === UI_DIR || file.startsWith(UI_DIR + path.sep)) continue;
  scanned += 1;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/\bfrom\b/.test(line)) continue; // импорт, не определение
    const m = line.match(DEF_RE);
    if (m) findings.push(`${rel(file)}:${i + 1}: ${m[1]}`);
  }
}

if (findings.length === 0) {
  console.log(`[no-duplicate-components] OK — дублей нет (проверено файлов вне src/ui/: ${scanned})`);
  console.log('[summary] violations=0');
  process.exit(0);
}

console.log(`[no-duplicate-components] FAIL — дублей: ${findings.length} (в ${scanned} файлах вне src/ui/)`);
for (const f of findings) console.log(`  ${f}`);
console.log('  fix: перенести компонент в src/ui/ и импортировать его');
console.log(`[summary] violations=${findings.length}`);
process.exit(1);
