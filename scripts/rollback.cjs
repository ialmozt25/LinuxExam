'use strict';
const fs = require('fs');

// 1. Restore questions from snapshot
const snap = JSON.parse(fs.readFileSync('./src/data/state.step6.json', 'utf8'));
fs.writeFileSync('./src/data/questions.json', JSON.stringify(snap.questions, null, 2) + '\n');
console.log('data restored');

// 2. Restore limit via replacement function
const p = './src/store/quizStore.ts';
let s = fs.readFileSync(p, 'utf8');
const re = /(FREE_QUESTION_LIMIT\s*=\s*)5(\s*;)/;
if (re.test(s)) {
  s = s.replace(re, (m, p1, p2) => p1 + '3' + p2);
  fs.writeFileSync(p, s);
  console.log('limit reverted to 3');
} else {
  console.log('limit already 3, no change');
}
console.log('rollback done');