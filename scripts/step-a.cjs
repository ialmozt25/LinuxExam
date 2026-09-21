'use strict';
const fs = require('fs');
const cp = require('child_process');

// A.1 Remove temp dirs
for (const d of ['.tmp-question-gen', '.tmp']) {
  if (fs.existsSync(d)) { fs.rmSync(d, { recursive: true, force: true }); console.log('removed', d); }
}
console.log('A.1 temp clean');

// A.2 Ensure .bak in .gitignore (semantic check via git check-ignore)
const bakPath = 'src/data/questions.json.bak';
let ignored = false;
try { cp.execSync('git check-ignore -q ' + bakPath, { stdio: 'pipe' }); ignored = true; } catch { ignored = false; }
if (!ignored) {
  if (!fs.existsSync('.gitignore')) fs.writeFileSync('.gitignore', '');
  const g = fs.readFileSync('.gitignore', 'utf8');
  if (!g.split('\n').includes(bakPath)) {
    fs.appendFileSync('.gitignore', (g.endsWith('\n') ? '' : '\n') + bakPath + '\n');
    console.log('A.2 added to .gitignore');
  } else { console.log('A.2 .gitignore has literal path'); }
} else { console.log('A.2 already ignored'); }

// A.3 Untrack .bak if tracked
try { cp.execSync('git ls-files --error-unmatch ' + bakPath, { stdio: 'pipe' }); cp.execSync('git rm --cached ' + bakPath, { stdio: 'pipe' }); console.log('A.3 untracked'); }
catch { console.log('A.3 not tracked'); }

// A.4 Identity check
try {
  const n = cp.execSync('git config user.name', { encoding: 'utf8' }).trim();
  const e = cp.execSync('git config user.email', { encoding: 'utf8' }).trim();
  if (!n || !e) throw new Error('empty');
  console.log('A.4 identity:', n, '<' + e + '>');
} catch {
  console.error('A.4 MISSING IDENTITY — run: git config user.name "Name"; git config user.email "you@example.com"');
  process.exit(40);
}
console.log('A done');