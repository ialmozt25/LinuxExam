#!/usr/bin/env node
/**
 * tools/check-episodic.mjs — проверка правила 12 (`ORCH-RULES.md`).
 *
 * Правило 12: «Каждая фаза заканчивается записью в `docs/memory/episodic.md`».
 * *Checkable:* для каждой фазы со статусом `done` в YAML-шапке плана должна быть
 * запись в журнале. Проверка — здесь.
 *
 * Источник правды (только чтение):
 *   docs/FACTORY-PLAN.md      — YAML-шапка (phases[].id / phases[].status)
 *   docs/memory/episodic.md   — журнал событий (поиск ID фазы подстрокой)
 *
 * Поведение:
 *   done        → проверяем наличие записи, печатаем `OK <id>` или `WARN <id> — запись не найдена`
 *   in_progress → пропускаем (фаза ещё идёт)
 *   pending     → пропускаем
 *
 * Exit code: ВСЕГДА 0. WARN — сигнал для человека и для правила 12, не ошибка
 * сборки: гейт не должен ломать пайплайн из-за отсутствующей записи журнала.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);

const PLAN_PATH = rel('docs/FACTORY-PLAN.md');
const EPISODIC_PATH = rel('docs/memory/episodic.md');

/** YAML-шапка файла: блок между первой парой `---`. */
function readFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : null;
}

/** ID фазы ищем подстрокой, регистронезависимо: F0 / f0 / Ф0 — одно и то же. */
function phaseRecorded(journal, id) {
  const needle = String(id).toLowerCase();
  return String(journal).toLowerCase().includes(needle);
}

function main() {
  if (!fs.existsSync(EPISODIC_PATH)) {
    process.stdout.write('WARN — episodic.md не найден\n');
    process.exitCode = 0;
    return;
  }

  const journal = fs.readFileSync(EPISODIC_PATH, 'utf8');
  const plan = fs.readFileSync(PLAN_PATH, 'utf8');
  const frontmatter = readFrontmatter(plan);
  if (frontmatter === null) {
    process.stdout.write('WARN — YAML-шапка плана не найдена\n');
    process.exitCode = 0;
    return;
  }

  const head = yaml.load(frontmatter) ?? {};
  const phases = Array.isArray(head.phases) ? head.phases : [];
  let warned = false;

  for (const phase of phases) {
    const id = phase?.id;
    const status = String(phase?.status ?? '');
    if (id === undefined || id === null) continue;
    // Правило 12 судит только закрытые фазы; идущие и запланированные пропускаем.
    if (status !== 'done') continue;
    if (phaseRecorded(journal, id)) {
      process.stdout.write(`OK ${id}\n`);
    } else {
      process.stdout.write(`WARN ${id} — запись не найдена\n`);
      warned = true;
    }
  }

  if (warned) {
    process.stdout.write('правило 12: запись в docs/memory/episodic.md обязательна для каждой закрытой фазы\n');
  }
  process.exitCode = 0;
}

main();
