#!/usr/bin/env node
/**
 * audit-ui.mjs — агрегатор fitness-проверок (npm run fitness).
 *
 * Запускает 6 проверок через spawnSync (shell:false), печатает сводную таблицу
 * check | status | violations и пробрасывает exit-код: 1, если любая проверка
 * вернула 1; 1 также, если проверка не запустилась (это fail, не skip).
 *
 * Zero-deps: только node:*.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const CHECKS = [
  { id: 'no-hex-in-tsx', severity: 'high', script: 'check-colors.mjs' },
  { id: 'no-duplicate-components', severity: 'high', script: 'check-components.mjs' },
  { id: 'no-dead-tokens', severity: 'medium', script: 'check-tokens.mjs' },
  { id: 'styling-rules', severity: 'high', script: 'check-styling.mjs' },
  { id: 'boundaries-guard', severity: 'high', script: 'check-boundaries.mjs' },
  { id: 'check-slop', severity: 'high', script: 'check-slop.mjs' },
];

const relScript = (s) => `scripts/fitness/${s}`;
const results = [];
const details = [];

for (const check of CHECKS) {
  const scriptPath = path.join(SCRIPT_DIR, check.script);
  if (!fs.existsSync(scriptPath)) {
    results.push({ ...check, status: 'MISSING', violations: 'n/a' });
    details.push(`--- ${check.id} (${relScript(check.script)}) ---\nфайл проверки не найден`);
    continue;
  }

  const res = spawnSync(process.execPath, [relScript(check.script)], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });

  const stdout = (res.stdout || '').trimEnd();
  const stderr = (res.stderr || '').trimEnd();
  const crashed = Boolean(res.error) || res.status === null;
  // Проверки печатают машиночитаемую строку `[summary] violations=N`.
  const summaryMatch = stdout.match(/\[summary\]\s+violations=(\d+|unknown)/);
  const detailLines = stdout.split(/\r?\n/).filter((l) => /^\s{2}\S/.test(l));

  const status = crashed ? 'ERROR' : res.status === 0 ? 'OK' : 'FAIL';
  results.push({
    ...check,
    status,
    violations: crashed
      ? 'crash'
      : summaryMatch
        ? summaryMatch[1]
        : detailLines.length === 0
          ? '0'
          : `${detailLines.length}*`,
  });

  const parts = [`--- ${check.id} (${relScript(check.script)}) ---`, stdout];
  if (stderr) parts.push(`[stderr] ${stderr}`);
  if (res.error) parts.push(`[spawn error] ${res.error.message}`);
  parts.push(`[exit] ${res.status === null ? 'null' : res.status}`);
  details.push(parts.filter(Boolean).join('\n'));
}

console.log('[ADVISORY ONLY — NOT A COMMIT GATE]');
console.log('=== fitness: audit-ui ===');
console.log(details.join('\n\n'));

const pad = (s, n) => String(s).padEnd(n, ' ');
console.log('\n=== сводка ===');
console.log(`| ${pad('check', 24)} | ${pad('severity', 9)} | ${pad('status', 7)} | ${pad('violations', 10)} |`);
console.log(`|${'-'.repeat(26)}|${'-'.repeat(11)}|${'-'.repeat(9)}|${'-'.repeat(12)}|`);
for (const r of results) {
  console.log(`| ${pad(r.id, 24)} | ${pad(r.severity, 9)} | ${pad(r.status, 7)} | ${pad(r.violations, 10)} |`);
}

const failed = results.filter((r) => r.status !== 'OK');
if (failed.length === 0) {
  console.log('\nfitness: OK — нарушений нет');
  process.exit(0);
}

console.log(`\nfitness: FAIL — проверок с нарушением: ${failed.length}/${results.length} (${failed.map((r) => r.id).join(', ')})`);
process.exit(1);
