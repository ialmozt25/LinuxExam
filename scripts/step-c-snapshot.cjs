'use strict';
const fs = require('fs');
const cp = require('child_process');
const crypto = require('crypto');

const qBuf = fs.readFileSync('./src/data/questions.json');
const q = JSON.parse(qBuf.toString('utf8'));
const st = fs.readFileSync('./src/store/quizStore.ts', 'utf8');
const lm = st.match(/FREE_QUESTION_LIMIT\s*=\s*(\d+)/);

const state = {
  captured_at: new Date().toISOString(),
  git_head: cp.execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
  questions_count: q.length,
  meta_count: q.filter(x => x.objective_domain).length,
  free_limit: Number(lm[1]),
  questions_sha256: crypto.createHash('sha256').update(qBuf).digest('hex'),
  questions: q
};
fs.writeFileSync('./src/data/state.step6.json', JSON.stringify(state, null, 2));
console.log('snapshot saved: total=' + q.length + ' meta=' + state.meta_count + ' limit=' + state.free_limit);