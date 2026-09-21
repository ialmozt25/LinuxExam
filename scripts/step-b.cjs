'use strict';
const cp = require('child_process');

const status = cp.execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (!status) {
  console.log('B SKIPPED — working tree clean');
  try { console.log('B commit (existing):', cp.execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()); } catch {}
  process.exit(0);
}
try {
  cp.execSync('git add -A', { stdio: 'inherit' });
  const args = [
    'commit',
    '-m', 'feat: quiz trainer MVP scaffold',
    '-m', 'Data: 35 questions (5 base + 30 generated)',
    '-m', 'Domain: quizService, selectors',
    '-m', 'Store: Zustand persist, paywall, navigation',
    '-m', 'Screens: Dashboard, Question, Results, Paywall',
    '-m', 'Platform: payment provider stub, DEV store exposure',
    '-m', 'Theme: dark mode constants',
    '-m', 'Tooling: VS Code, Prettier, ESLint'
  ];
  cp.execSync('git ' + args.map(a => JSON.stringify(a)).join(' '), { stdio: 'inherit' });
  console.log('B commit:', cp.execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim());
} catch (e) {
  console.error('B COMMIT FAILED:', e.message);
  process.exit(40);
}