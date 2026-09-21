'use strict';
const fs = require('fs');
const cp = require('child_process');

const mode = process.argv[2] || 'preflight';
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readText = (p) => fs.readFileSync(p, 'utf8');
const ok = (m) => console.log('OK', m);
const fail = (m) => { console.error('FAIL', m); process.exit(1); };
const stripCR = (s) => s.split('\r').join('');

if (mode === 'preflight') {
  const s = stripCR(cp.execSync('git status --short', { encoding: 'utf8' })).trim();
  const lines = s ? s.split('\n').filter(Boolean) : [];
  const allowed = [
    '?? questions.json.bak',
    '?? src/data/questions.json.bak'
  ];
  const bad = lines.filter(l => !allowed.includes(l.trim()));
  if (bad.length) fail('unexpected git status lines: ' + bad.join(' | '));
  ok('git status clean (only .bak allowed)');

  const q = readJson('./src/data/questions.json');
  if (q.length !== 35) fail('total != 35: ' + q.length);
  const first5 = q.slice(0, 5).map(x => x.id).join(',');
  if (first5 !== 'fp_001,fp_002,fm_001,fm_002,pm_001') fail('first5 mismatch: ' + first5);
  const metaCount = q.filter(x => x.objective_domain).length;
  if (metaCount !== 30) fail('meta count != 30: ' + metaCount);
  ok('questions: 35 total, 30 meta');

  const st = readText('./src/store/quizStore.ts');
  const lm = st.match(/FREE_QUESTION_LIMIT\s*=\s*(\d+)/);
  if (!lm || lm[1] !== '3') fail('limit != 3: ' + (lm ? lm[1] : 'NOT_FOUND'));
  ok('limit: 3');
  process.exit(0);
}

if (mode === 'postmetadata') {
  const q = readJson('./src/data/questions.json');
  const errs = [];
  q.forEach(x => {
    ['id','topic','difficulty','objective_domain','subtopic','question','explanation'].forEach(f => {
      if (!x[f]) errs.push(x.id + ':missing ' + f);
    });
    if (!Array.isArray(x.options) || x.options.length !== 4) errs.push(x.id + ':options not 4');
    if (x.options.filter(o => o.correct).length !== 1) errs.push(x.id + ':correct wrong');
    if (!/^[1-9]$/.test(String(x.objective_domain))) errs.push(x.id + ':domain invalid');
  });
  if (errs.length) fail('schema: ' + JSON.stringify(errs));
  ok('schema OK');

  const ids = q.map(x => x.id);
  const dups = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dups.length) fail('dups: ' + dups.join(','));
  ok('no duplicates');

  const snap = readJson('./src/data/state.step6.json');
  for (let i = 0; i < 5; i++) {
    const a = snap.questions[i], b = q[i];
    if (a.id !== b.id || a.question !== b.question || a.explanation !== b.explanation ||
        a.topic !== b.topic || a.difficulty !== b.difficulty ||
        JSON.stringify(a.options) !== JSON.stringify(b.options)) {
      fail('content mismatch: ' + b.id);
    }
  }
  ok('content integrity vs snapshot');

  const doms = new Set(q.map(x => String(x.objective_domain)));
  if (doms.size < 7) fail('objectives < 7: ' + doms.size);
  ok('objectives: ' + doms.size + '/9');
  process.exit(0);
}

if (mode === 'postbuild') {
  const st = readText('./src/store/quizStore.ts');
  const lm = st.match(/FREE_QUESTION_LIMIT\s*=\s*(\d+)/);
  if (!lm || lm[1] !== '5') fail('limit != 5: ' + (lm ? lm[1] : 'NOT_FOUND'));
  ok('limit: 5');
  process.exit(0);
}

fail('unknown mode: ' + mode);