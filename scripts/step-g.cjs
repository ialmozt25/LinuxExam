'use strict';
const fs = require('fs');
const files = [
  './src/data/state.step6.json',
  './scripts/verify.cjs',
  './scripts/step-a.cjs',
  './scripts/step-b.cjs',
  './scripts/step-c-snapshot.cjs',
  './scripts/step-d.cjs',
  './scripts/step-f.cjs',
  './scripts/step-g.cjs'
];
for (const p of files) {
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('removed', p); }
}
try { fs.rmdirSync('./scripts'); console.log('removed ./scripts'); } catch {}
console.log('cleanup done');