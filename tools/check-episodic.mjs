#!/usr/bin/env node
/**
 * tools/check-episodic.mjs — проверка правила 12 (`ORCH-RULES.md`).
 *
 * Правило 12: «Каждая фаза заканчивается записью в `docs/memory/episodic.md`».
 * *Checkable:* для каждой фазы со статусом `done` в плане должна быть
 * запись в журнале. Проверка — здесь. Правило применяется к ОБОИМ планам
 * проекта (`D`-фазы развития — такое же обязательство, как `F`-фазы фабрики).
 *
 * Источник правды (только чтение):
 *   .project/state.json      — план агрегата: plan.allPhases = F0–F5 + D0–D4
 *                              (собирает `.project/sync.mjs` из обеих YAML-шапок)
 *   docs/FACTORY-PLAN.md     — ФОЛБЭК: YAML-шапка мастер-плана, если в state.json
 *                              агрегата ещё нет (sync не запускался)
 *   docs/memory/episodic.md  — журнал событий (поиск ID фазы подстрокой)
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

const STATE_PATH = rel('.project/state.json');
const PLAN_PATH = rel('docs/FACTORY-PLAN.md');
const EPISODIC_PATH = rel('docs/memory/episodic.md');

/** YAML-шапка файла: блок между первой парой `---`. */
function readFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? m[1] : null;
}

/**
 * Фазы для проверки и имя источника (для диагностики).
 *
 * Основной путь — агрегат `state.json.plan.allPhases`: он один знает про оба
 * плана сразу, поэтому новая фаза (например D0) попадает под правило 12 без
 * правок этого скрипта. Фолбэк — YAML-шапка мастер-плана: тогда проверяются
 * только F-фазы, и это честно сообщается, а не молча пропускается.
 */
function readPhases() {
  try {
    const st = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    const all = st && st.plan && st.plan.allPhases;
    if (Array.isArray(all) && all.length > 0) {
      return { phases: all, source: '.project/state.json → plan.allPhases' };
    }
  } catch (e) {
    // state.json отсутствует или не парсится — это не ошибка гейта, идём в фолбэк
  }
  if (!fs.existsSync(PLAN_PATH)) return { phases: null, source: null };
  const frontmatter = readFrontmatter(fs.readFileSync(PLAN_PATH, 'utf8'));
  if (frontmatter === null) return { phases: null, source: null };
  const head = yaml.load(frontmatter) ?? {};
  return {
    phases: Array.isArray(head.phases) ? head.phases : [],
    source: 'docs/FACTORY-PLAN.md (YAML-шапка) — агрегат state.json.plan.allPhases не найден',
  };
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
  const { phases, source } = readPhases();
  if (phases === null) {
    process.stdout.write('WARN — ни state.json.plan.allPhases, ни YAML-шапка плана не найдены\n');
    process.exitCode = 0;
    return;
  }

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
    if (source) process.stdout.write(`источник фаз: ${source}\n`);
  }
  process.exitCode = 0;
}

main();
