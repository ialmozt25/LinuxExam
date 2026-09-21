'use strict';
const fs = require('fs');
if (!fs.existsSync('docs')) fs.mkdirSync('docs', { recursive: true });
const p = 'docs/content-generation-20260921-1403.md';
if (!fs.existsSync(p)) { console.error('audit log missing:', p); process.exit(40); }
const add = '\n---\n\n## Post-Merge Adjustments (Step 6)\n' +
  '- Metadata: fp_001->9, fp_002->9, fm_001->1, fm_002->1, pm_001->3.\n' +
  '- FREE_QUESTION_LIMIT: 3 -> 5.\n' +
  '- Snapshot: src/data/state.step6.json.\n' +
  '- TECHNICAL DEBT: file_permissions domain mapping (9 vs 1/5) pending.\n';
fs.appendFileSync(p, add);
console.log('audit appended');