#!/usr/bin/env node
/** Сборка фрагмента: генератор → UTF-8 файл (без PowerShell-редиректа, он пишет UTF-16). */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const out = execFileSync(process.execPath, ['.project/drafts/_expand-checklist.mjs'], { encoding: 'utf8' });
fs.writeFileSync('.project/drafts/_new-criteria.yaml', out, 'utf8');
const ids = [...out.matchAll(/^ {2}- id: (\S+)$/gm)].map((m) => m[1]);
console.log('fragment ids:', ids.length, ids.join(' '));
