#!/usr/bin/env node
/**
 * .project/scripts/audit-screens.mjs — точка входа визуального аудита (spec 077).
 *
 * Что делает скрипт: читает список baseline PNG (spec 074), проверяет, что
 * файлы реально есть и не пустые, и печатает АГЕНТУ инструкцию — прочитать
 * каждый PNG своим зрением (Read tool) и записать наблюдения в
 * `.project/drafts/visual-audit-<дата>.md`.
 *
 * Чего скрипт НЕ делает: не вызывает никаких API, не анализирует пиксели, не
 * генерирует отчёт сам. Зрение есть у агента, а не у `node`: скрипт —
 * детерминированная точка входа (список + шаблон + имя файла отчёта), чтобы
 * аудит запускался одной командой и не зависел от памяти прошлого прогона.
 *
 * Zero-deps, read-only: скрипт не пишет ни одного файла. Отчёт пишет агент —
 * поэтому и `exit 0` даже при битом PNG: битый файл это НАБЛЮДЕНИЕ отчёта
 * («PNG не читается»), а не повод остановить аудит остальных 18 экранов.
 *
 * Запуск: npm run audit:screens
 *         node .project/scripts/audit-screens.mjs [--date YYYY-MM-DD] [--json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

/** Каталог baseline-снимков spec 074. Только чтение — перегенерация запрещена. */
const SNAPSHOT_DIR = path.join(ROOT, 'e2e', 'visual-regression.spec.ts-snapshots');
const DRAFTS_DIR = path.join(ROOT, '.project', 'drafts');

/** Категории наблюдений: ровно те, что ждёт отчёт. */
const CATEGORIES = ['layout', 'typography', 'spacing', 'color', 'hierarchy', 'consistency', 'copy'];
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

/** Ожидаемое число снимков (spec 074). Меньше — сигнал, а не тишина. */
const EXPECTED_PNG = 19;

const args = process.argv.slice(2);

function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

function today() {
  const forced = argValue('--date');
  if (forced) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(forced)) {
      console.error(`audit-screens: --date ожидает YYYY-MM-DD, получено "${forced}"`);
      process.exit(2);
    }
    return forced;
  }
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/**
 * Инвентаризация PNG: имя, размер, читаемость.
 *
 * Причина отдельного поля `note`: `read_image` на файле 0 байт или с битым
 * заголовком вернёт ошибку, и без пометки в списке агент либо молча пропустит
 * экран, либо уронит весь аудит на одном файле. Пометка делает пропуск явным.
 */
function inventory() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    return { dir: rel(SNAPSHOT_DIR), present: false, items: [] };
  }
  const names = fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b));
  const items = names.map((name) => {
    const full = path.join(SNAPSHOT_DIR, name);
    let size = 0;
    try {
      size = fs.statSync(full).size;
    } catch {
      size = -1;
    }
    let note = '';
    let readable = size > 0;
    if (size < 0) {
      note = 'stat не удался';
      readable = false;
    } else if (size === 0) {
      note = '0 байт — PNG битый, читать нечего';
    } else {
      // Сигнатура PNG: агент всё равно попробует прочитать, но битый заголовок
      // лучше назвать заранее, чем получить непонятную ошибку Read tool.
      let magic = null;
      try {
        const fd = fs.openSync(full, 'r');
        const buf = Buffer.alloc(8);
        fs.readSync(fd, buf, 0, 8, 0);
        fs.closeSync(fd);
        magic = buf;
      } catch {
        magic = null;
      }
      const ok = magic && magic.toString('hex') === '89504e470d0a1a0a';
      if (!ok) {
        note = 'нет PNG-сигнатуры — файл повреждён';
        readable = false;
      }
    }
    return { name, rel: rel(full), size, readable, note };
  });
  return { dir: rel(SNAPSHOT_DIR), present: true, items };
}

function main() {
  const date = today();
  const reportPath = `.project/drafts/visual-audit-${date}.md`;
  const inv = inventory();

  if (args.includes('--json')) {
    console.log(JSON.stringify({ date, expected: EXPECTED_PNG, report: reportPath, ...inv }, null, 2));
    process.exit(0);
  }

  const readable = inv.items.filter((i) => i.readable).length;
  const broken = inv.items.filter((i) => !i.readable);

  console.log('=== audit-screens — визуальный аудит baseline PNG (spec 077) ===');
  console.log('');
  if (!inv.present) {
    console.log(`Каталога ${inv.dir} нет.`);
    console.log('Снимки baseline (spec 074) отсутствуют — визуальный аудит пропущен.');
    console.log(`Записать в отчёт ${reportPath}: PNG не найдены, аудит не выполнен.`);
    process.exit(0);
  }
  console.log(`Каталог: ${inv.dir}`);
  console.log(`Снимков: ${inv.items.length} (ожидалось ${EXPECTED_PNG}), читаемых: ${readable}, битых: ${broken.length}`);
  console.log('');
  console.log('Список для чтения (Read tool):');
  console.log('');
  for (const item of inv.items) {
    const kb = item.size >= 0 ? `${Math.round(item.size / 1024)} KB` : 'size?';
    const flag = item.readable ? 'ok' : `не читается (${item.note})`;
    console.log(`  - ${item.rel}  [${kb}] ${flag}`);
  }
  console.log('');
  if (inv.items.length < EXPECTED_PNG) {
    console.log(
      `WARN: снимков ${inv.items.length} меньше ожидаемых ${EXPECTED_PNG} — часть экранов не покрыта.`,
    );
    console.log('Причина, скорее всего, в прерванном прогоне: сам аудит всё равно выполняется.');
    console.log('');
  }
  if (broken.length) {
    console.log(`WARN: битых PNG ${broken.length}: ${broken.map((b) => b.name).join(', ')}`);
    console.log('Их надо назвать в отчёте строкой «PNG не читается: <файл> — <причина>» и не падать.');
    console.log('');
  }

  console.log('=== ИНСТРУКЦИЯ АГЕНТУ (это и есть визуальный аудит) ===');
  console.log('');
  console.log('Прочитай каждый PNG из списка через Read tool. Для каждого снимка запиши:');
  console.log('  screen, viewport, 3-5 проблем с severity (critical/high/medium/low)');
  console.log(`  и категорией (${CATEGORIES.join('|')}).`);
  console.log(`Запиши результат в ${reportPath}.`);
  console.log('');
  console.log('Требования к отчёту:');
  console.log(`  1. По одной секции на снимок: \`## <screen> / <viewport> (<файл>)\`.`);
  console.log(`  2. Каждое наблюдение: \`- [severity] <категория>: <что не так> — <что менять>\`.`);
  console.log('  3. Секция `## Сводка`: N проблем по severity, Top-5 по влиянию.');
  console.log('  4. Битый PNG — отдельной строкой «PNG не читается: <файл> — <причина>».');
  console.log('  5. Read tool недоступен — записать «vision unavailable» и НЕ останавливаться:');
  console.log('     сам список снимков и их размеры уже валидный (частичный) результат.');
  console.log('');
  console.log('Границы: аудит НИЧЕГО не меняет — ни PNG, ни src/**, ни e2e/**. Только отчёт.');
  console.log('Найденные дефекты — вход для отдельных спек, а не правка «по пути».');
  console.log('');
  console.log('audit-screens: exit 0 (аудит выполняет агент — скрипт только точка входа)');
  process.exit(0);
}

main();
