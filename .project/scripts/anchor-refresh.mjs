#!/usr/bin/env node
// anchor:refresh — SETUP §4 automation for the push/close session guard (spec 049).
//
// The guard compares DSH_SESSION_ID of the executing process with the single line in
// .project/.captain-session-id (docs/SETUP.md §1). When the captain switches sessions,
// that anchor must be rewritten to the new captain session id. Per SETUP §3 the file is
// written only by an explicit captain action — this script performs exactly that one
// deliberate action, it does not remove or weaken the guard.
//
// --dry   print anchor/env/match and exit WITHOUT writing (safe diagnostic).
// --log   append a `guard` trail line to .project/log.md after a successful write.
//
// exit 0 — anchor readable and, when not --dry, written;
// exit 1 — DSH_SESSION_ID is empty (nothing to anchor).

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SESSION_FILE = path.join(REPO_ROOT, '.project', '.captain-session-id');
const LOG_FILE = path.join(REPO_ROOT, '.project', 'log.md');

const args = new Set(process.argv.slice(2));
const isDry = args.has('--dry');
const isLog = args.has('--log');

/** Current anchor value, or empty string when the file is missing/unreadable. */
function readAnchor() {
  try {
    return fs.readFileSync(SESSION_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

/** Local calendar date as YYYY-MM-DD (the log format used across .project/log.md). */
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Append one `commit pending` trail line, keeping the file LF-terminated. */
function appendLogLine(line) {
  const existing = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
  const prefix = existing.length === 0 || existing.endsWith('\n') ? existing : `${existing}\n`;
  fs.writeFileSync(LOG_FILE, `${prefix}${line}\n`);
}

function main() {
  const env = (process.env.DSH_SESSION_ID ?? '').trim();
  if (env === '') {
    console.error('anchor:refresh: DSH_SESSION_ID пуст — сессия запущена не через DSH.');
    console.error('  Якорь писать нечего; см. docs/SETUP.md §7 «Что делать при блокировке».');
    return 1;
  }

  const anchor = readAnchor();
  const match = anchor === env;

  // Same fields as the SETUP §4 verification snippet, so the two are comparable.
  console.log(`anchor=${anchor.slice(0, 24)} env=${env.slice(0, 24)} match=${match}`);

  if (isDry) {
    console.log('anchor:refresh: --dry — запись не выполнялась.');
    return 0;
  }

  if (match) {
    console.log('anchor:refresh: якорь уже указывает на эту сессию — запись не требуется.');
    return 0;
  }

  // Exactly one line, no BOM, no CRLF (SETUP §2 recommended form).
  fs.writeFileSync(SESSION_FILE, env);
  console.log(`anchor:refresh: якорь перезаписан → ${SESSION_FILE}`);
  console.log(`  было: ${anchor === '' ? '(нет файла)' : `${anchor.slice(0, 24)}…`}`);
  console.log(`  стало: ${env.slice(0, 24)}…`);

  if (isLog) {
    appendLogLine(`${today()} | guard | якорь перезаписан на ${env.slice(0, 16)}… | commit pending`);
    console.log(`anchor:refresh: строка добавлена в ${LOG_FILE}`);
  }

  return 0;
}

process.exit(main());
