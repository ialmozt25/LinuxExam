#!/usr/bin/env node
/**
 * .project/scripts/factory-scaffold.mjs — разворачивание `templates/factory/`
 * в целевой каталог (спека 024, F5.1b).
 *
 * Кросс-платформенность: встроенный `node:fs` (`cpSync`/`mkdirSync`), без shell
 * `cp` и без внешних зависимостей — в корневом `package.json` фабрики
 * `fs-extra` нет, а тянуть пакет только ради копирования не нужно.
 *
 * Плейсхолдеры заменяются строго по полному токену `{{TOKEN}}` (не подстрока),
 * порядок — от длинных к коротким (`{{PRODUCT_KEBAB}}` раньше `{{PRODUCT}}`).
 *
 * Exit-коды: 0 — успех; 1 — ошибка (непустой target-dir без --force, ошибка
 * копирования); 2 — плохие аргументы (нет target-dir).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEMPLATE = path.join(ROOT, 'templates', 'factory');

/** Текстовые файлы, в которых вообще имеет смысл заменять плейсхолдеры. */
const TEXT_EXT = new Set(['.md', '.json', '.mjs', '.js', '.ps1', '.yml', '.yaml', '.txt', '.sh', '.psm1']);

function usage() {
  process.stderr.write(
    'использование: npm run factory:scaffold -- <target-dir> ' +
    '[--product=NAME] [--factory=NAME] [--captain-tz=TZ] [--dsh-bin=PATH] [--force]\n',
  );
}

/** Простой парсер аргументов: позиционный target-dir + флаги `--k=v` / `--k v`. */
function parseArgs(argv) {
  const out = { target: null, product: null, factory: null, captainTz: null, dshBin: null, githubOwner: null, force: false };
  const valueFlags = { '--product': 'product', '--factory': 'factory', '--captain-tz': 'captainTz', '--dsh-bin': 'dshBin', '--github-owner': 'githubOwner' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') { out.force = true; continue; }
    const eq = a.indexOf('=');
    if (eq > 0 && valueFlags[a.slice(0, eq)]) { out[valueFlags[a.slice(0, eq)]] = a.slice(eq + 1); continue; }
    if (valueFlags[a]) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        process.stderr.write(`аргумент ${a} требует значения\n`);
        process.exitCode = 2;
        return null;
      }
      out[valueFlags[a]] = next;
      i += 1;
      continue;
    }
    if (a.startsWith('--')) {
      process.stderr.write(`неизвестный аргумент: ${a}\n`);
      process.exitCode = 2;
      return null;
    }
    if (out.target === null) out.target = a;
    else {
      process.stderr.write(`лишний позиционный аргумент: ${a}\n`);
      process.exitCode = 2;
      return null;
    }
  }
  return out;
}

/** slugify: lowercase, пробелы → '-', не-ASCII удаляется, дефисы схлопываются. */
function slugify(value) {
  const s = String(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'product';
}

/** Пуст ли каталог (после создания). */
function isEmptyDir(dir) {
  return fs.readdirSync(dir).length === 0;
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) return;
  if (!args.target) {
    usage();
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(TEMPLATE)) {
    process.stderr.write(`шаблон не найден: ${TEMPLATE}\n`);
    process.exitCode = 1;
    return;
  }

  const target = path.resolve(args.target);
  const product = args.product ?? path.basename(target);
  const values = new Map([
    ['{{PRODUCT_KEBAB}}', slugify(product)],
    ['{{CAPTAIN_TZ}}', args.captainTz ?? 'Europe/Moscow'],
    ['{{PROJECT_ROOT}}', target],
    ['{{PRODUCT}}', product],
    ['{{FACTORY}}', args.factory ?? 'MAS Factory'],
    ['{{DSH_BIN}}', args.dshBin ?? 'dsh'],
    ['{{DATE}}', new Date().toISOString().slice(0, 10)],
    // `{{GITHUB_OWNER}}` приезжает из `factory:sync-template` (замена `ialmozt25`),
    // но не задаётся флагом: без него владелец репозитория просто не подставлен.
    ['{{GITHUB_OWNER}}', args.githubOwner ?? ''],
  ]);

  // Порядок ключей Map — от длинных токенов к коротким.
  const replaceAll = (text) => {
    let out = text;
    for (const [token, value] of values) out = out.split(token).join(value);
    return out;
  };

  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory()) {
      process.stderr.write(`target-dir существует и не является каталогом: ${target}\n`);
      process.exitCode = 1;
      return;
    }
    if (!isEmptyDir(target) && !args.force) {
      process.stderr.write(`target-dir не пуст: ${target}. Используйте --force или выберите другой каталог.\n`);
      process.exitCode = 1;
      return;
    }
  } else {
    fs.mkdirSync(target, { recursive: true });
  }

  let files = 0;
  let replacements = 0;
  for (const src of listFiles(TEMPLATE)) {
    const rel = path.relative(TEMPLATE, src);
    const dst = path.join(target, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const ext = path.extname(src).toLowerCase();
    // Текстовыми считаем файлы с известным расширением, `.gitignore` и файлы
    // без расширения (например, `.githooks/pre-commit`) — иначе плейсхолдеры
    // в них останутся жить.
    const isText = TEXT_EXT.has(ext) || path.basename(src) === '.gitignore' || ext === '';
    if (!isText) {
      fs.copyFileSync(src, dst);
      files += 1;
      continue;
    }
    const text = fs.readFileSync(src, 'utf8');
    const out = replaceAll(text);
    for (const [token, value] of values) {
      const before = text.split(token).length - 1;
      if (before > 0) replacements += before;
      void value;
    }
    fs.writeFileSync(dst, out, { encoding: 'utf8' });
    files += 1;
  }

  // Производные шаблона (`docs/index.html`, `.project/STATE.md`, `.project/SPEC.md`)
  // могли остаться от последнего `npm run sync` в самом шаблоне — они содержат
  // placeholder'ы и чужой HEAD. Поэтому стираем их в цели: ниже перегенерируем.
  for (const derived of ['.project/STATE.md', '.project/SPEC.md', 'docs/index.html']) {
    const p = path.join(target, derived);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }

  // Простая синхронизация в цели: `sync.mjs` пишет пустые производные (HEAD ещё
  // нет — репозиторий не инициализирован), поэтому это no-op идемпотентно.
  try {
    execFileSync(process.execPath, [path.join(target, '.project', 'sync.mjs')], {
      cwd: target,
      stdio: 'inherit',
    });
  } catch (e) {
    process.stderr.write(`предупреждение: не удалось собрать производные в цели (${e.message})\n`);
  }

  if (!args.dshBin) {
    process.stdout.write('⚠ {{DSH_BIN}} заменён на "dsh" — предполагается, что dsh в PATH. ' +
      'Используйте --dsh-bin=PATH для явного пути.\n');
  }
  process.stdout.write(`Развёрнуто: ${files} файлов; замен: ${replacements}\n`);
  process.stdout.write(`  target: ${target}\n`);
  process.stdout.write(`  product: ${product} (kebab: ${values.get('{{PRODUCT_KEBAB}}')})\n`);
  process.stdout.write(`  factory: ${values.get('{{FACTORY}}')}, tz: ${values.get('{{CAPTAIN_TZ}}')}, date: ${values.get('{{DATE}}')}\n`);
}

main();
