'use strict';
const fs = require('fs');

// D.1 Metadata
const meta = {
  'fp_001': { domain: '9', sub: 'numeric modes' },
  'fp_002': { domain: '9', sub: 'special bits' },
  'fm_001': { domain: '1', sub: 'cp / mv / ln (symbolic vs hard)' },
  'fm_002': { domain: '1', sub: 'find: -name, -type, -mtime, -size, -exec' },
  'pm_001': { domain: '3', sub: 'kill signals: TERM, KILL, HUP, USR1' }
};
const qPath = './src/data/questions.json';
const q = JSON.parse(fs.readFileSync(qPath, 'utf8'));
for (const id of Object.keys(meta)) {
  const i = q.findIndex(x => x.id === id);
  if (i < 0) { console.error('missing question:', id); process.exit(1); }
  if (q[i].objective_domain) { console.error('already has metadata:', id); process.exit(1); }
  const { domain, sub } = meta[id];
  const rebuilt = {};
  for (const k of Object.keys(q[i])) {
    rebuilt[k] = q[i][k];
    if (k === 'difficulty') {
      rebuilt.objective_domain = domain;
      rebuilt.subtopic = sub;
    }
  }
  q[i] = rebuilt;
}
fs.writeFileSync(qPath, JSON.stringify(q, null, 2) + '\n');
console.log('D.1 metadata added to 5');

// D.2 Limit 3 -> 5 (replacement function to avoid $1/$2 shell issues)
const sPath = './src/store/quizStore.ts';
let s = fs.readFileSync(sPath, 'utf8');
const re = /(FREE_QUESTION_LIMIT\s*=\s*)3(\s*;)/;
if (!re.test(s)) { console.error('D.2 anchor not found'); process.exit(1); }
s = s.replace(re, (m, p1, p2) => p1 + '5' + p2);
fs.writeFileSync(sPath, s);
console.log('D.2 limit -> 5');