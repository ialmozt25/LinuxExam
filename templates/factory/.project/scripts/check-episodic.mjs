#!/usr/bin/env node
/**
 * .project/scripts/check-episodic.mjs — проверка правила 12 (`ORCH-RULES.md`).
 *
 * Правило 12: «Каждая фаза заканчивается записью в `docs/memory/episodic.md`».
 * *Checkable:* для каждой фазы со статусом `done` в YAML-шапке плана должна быть
 * запись в журнале. Проверка — здесь.
 *
 * Отличие от версии полной фабрики (`tools/check-episodic.mjs`): YAML-шапка
 * парсится рукописно, без `js-yaml`, — в шаблоне внешних зависимостей нет
 * (см. spec 024: devDeps = только `fs-extra`).
 *
 * Источник правды (только чтение):
 *   docs/FACTORY-PLAN.md      — YAML-шапка (phases[].id / phases[].status)
 *   docs/memory/episodic.md   — журнал событий (поиск ID фазы подстрокой)
 *
 * Exit code: ВСЕГДА 0. WARN — сигнал для человека и для правила 12, не ошибка
 * сборки.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Скрипт лежит в `.project/scripts/`, поэтому корень — на два уровня выше.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rel = (p) => path.join(ROOT, p);

const PLAN_PATH = rel('docs/FACTORY-PLAN.md');
const EPISODIC_PATH = rel('docs/memory/episodic.md');

/** YAML-шапка файла: блок между первой парой `---`. */
function readFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : null;
}

/** Строки фаз из шапки: `- { id: F0, …, status: done, … }` → [{id, status}]. */
function readPhases(frontmatter) {
  const phases = [];
  for (const raw of frontmatter.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('- {')) continue;
    const inner = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'));
    const o = {};
    for (const part of inner.split(',')) {
      const m = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/.exec(part);
      if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    if (o.id) phases.push(o);
  }
  return phases;
}

/** ID фазы ищем подстрокой, регистронезависимо: F0 / f0 / Ф0 — одно и то же. */
function phaseRecorded(journal, id) {
  return String(journal).toLowerCase().includes(String(id).toLowerCase());
}

function main() {
  if (!fs.existsSync(EPISODIC_PATH)) {
    process.stdout.write('WARN — episodic.md не найден\n');
    return;
  }
  if (!fs.existsSync(PLAN_PATH)) {
    process.stdout.write('WARN — FACTORY-PLAN.md не найден\n');
    return;
  }

  const journal = fs.readFileSync(EPISODIC_PATH, 'utf8');
  const frontmatter = readFrontmatter(fs.readFileSync(PLAN_PATH, 'utf8'));
  if (frontmatter === null) {
    process.stdout.write('WARN — YAML-шапка плана не найдена\n');
    return;
  }

  const phases = readPhases(frontmatter);
  if (phases.length === 0) {
    process.stdout.write('OK — закрытых фаз нет\n');
    return;
  }

  let warned = false;
  for (const phase of phases) {
    const status = String(phase.status ?? '');
    // Правило 12 судит только закрытые фазы; идущие и запланированные пропускаем.
    if (status !== 'done') continue;
    if (phaseRecorded(journal, phase.id)) {
      process.stdout.write(`OK ${phase.id}\n`);
    } else {
      process.stdout.write(`WARN ${phase.id} — запись не найдена\n`);
      warned = true;
    }
  }

  if (warned) {
    process.stdout.write('правило 12: запись в docs/memory/episodic.md обязательна для каждой закрытой фазы\n');
  }
}

main();
