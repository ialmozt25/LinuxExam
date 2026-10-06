#!/usr/bin/env node
/**
 * check-styling.mjs — fitness-проверка «styling-rules» (severity: high).
 *
 * Машинный детектор правил скилла `.dsh/skills/ui-styling-rules/SKILL.md` и
 * `boundaries.forbidden_patterns` контракта. Ищет в `src/**` (кроме `__tests__`):
 *   1) `100vh` без `100dvh` в том же файле     → mobile/TMA: нужен fallback-порядок
 *   2) `onMouseEnter`/`onMouseLeave` + inline `style={{` в одном блоке
 *                                              → :hover/:focus живут в CSS, не в JS
 *   3) `@media ... max-width`                  → только mobile-first min-width
 *   4) `className={` + interpolated template   → интерполяция классов ломает статику
 *   5) тег бейджа без явного `variant=`       → роль бейджа теряется, у компонента
 *                                              нет фолбэка (BadgeProps.variant обязателен)
 *   6) две primary-кнопки в одном блоке рендера
 *                                              → две конкурирующие primary-CTA
 *   7) две primary-кнопки с ОДИНАКОВЫМ текстом в одном файле
 *                                              → тот же CTA продублирован в двух
 *                                                местах экрана (дубль «Продолжить»:
 *                                                resume-баннер + нижний футер,
 *                                                diag-dashboard-fix)
 *
 * Правила 5–6 структурные, а не построчные: позиция ищется в ИСХОДНИКЕ по
 * замаскированному тексту (строки, шаблоны и комментарии заменяются пробелами,
 * `maskNonCode`), а «блок рендера» — это ближайшая незакрытая `{` (`renderGroups`).
 * Зачем маскировка и группировка: у Dashboard.tsx взаимно исключающие ветки
 * (`{cond ? <Button variant="primary"/> : null}`) — законная причина держать в
 * файле больше одной primary-кнопки, и построчный счётчик «≥2 в файле» дал бы
 * ложное срабатывание на исправленном коде. Инвариант «на экране ровно одна
 * primary-CTA» проверяется в e2e (`e2e/mobile-layout.spec.ts`).
 *
 * Zero-deps: только node:*. Symlink-каталоги не разворачиваются.
 * Exit 1 — есть находки; exit 0 — чисто.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'test-results', '__tests__', '__mocks__']);
const MAX_WIDTH_MQ = /@media[^{\n]*max-width/;
const CLASSNAME_INTERP = /className=\{\s*`/;
/**
 * Тег бейджа без `variant=` в пределах открывающего тега.
 * `\b` после имени обязателен: без него `<BadgeProps>` (тип, не JSX) считался бы
 * бейджем. `[^>]` переходит через переводы строки сам, поэтому многострочная
 * запись `<Badge\n  variant={...}` матчится так же, как однострочная; s-флаг
 * добавлен явно, чтобы это не зависело от формы регулярки.
 */
const BADGE_NO_VARIANT = /<Badge\b(?![^>]*\bvariant\s*=)/gs;
/** primary-кнопка: `<Button` + `variant="primary"` в том же открывающем теге. */
const PRIMARY_BUTTON = /<Button\b[^>]*\bvariant\s*=\s*"primary"/gs;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile() && /\.(tsx|css)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/**
 * Заменяет содержимое строк/шаблонов и комментариев пробелами, сохраняя ДЛИНУ
 * текста и все переводы строк. Нужна, чтобы `{`/`}` и `<` внутри строк
 * (`{`${n} тем`}`, регулярки, комментарии с примерами JSX) не сбивали ни
 * группировку по скобкам, ни поиск тегов. Символы, оставшиеся в коде,
 * unmasked — смещения в исходнике не меняются.
 *
 * Состояние (какая кавычка/комментарий открыт) переносится между строками:
 * многострочный шаблон или блочный комментарий не «закрывается» на переводе
 * строки.
 */
export function maskNonCode(source) {
  const out = new Array(source.length);
  let quote = null; // ' | " | `
  let block = false; // /* */
  let line = false; // //
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (line) {
      out[i] = ch === '\n' ? '\n' : ' ';
      if (ch === '\n') line = false;
      continue;
    }
    if (block) {
      out[i] = ch === '\n' ? '\n' : ' ';
      if (ch === '*' && next === '/') {
        out[i + 1] = ' ';
        i += 1;
        block = false;
      }
      continue;
    }
    if (quote) {
      out[i] = ch === '\n' ? '\n' : ' ';
      if (ch === '\\') {
        if (next !== undefined) out[i + 1] = next === '\n' ? '\n' : ' ';
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      out[i] = ' ';
      line = true;
      continue;
    }
    if (ch === '/' && next === '*') {
      out[i] = ' ';
      block = true;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      out[i] = ch; // саму кавычку оставляем: она часть синтаксиса
      quote = ch;
      continue;
    }
    out[i] = ch;
  }
  return out.join('');
}

/**
 * Для каждого символа `<` в замаскированном исходнике — смещение ближайшей
 * незакрытой `{` (или -1, если её нет). Это и есть «блок рендера»: два тега с
 * одним и тем же ключом попадают в один JSX-блок (и могут быть видны
 * одновременно), а теги в разных ветках `{cond ? … : …}` — в разные.
 */
export function renderGroups(source) {
  const masked = maskNonCode(source);
  const stack = [];
  const groups = new Map();
  for (let i = 0; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === '{') {
      stack.push(i);
      continue;
    }
    if (ch === '}') {
      stack.pop();
      continue;
    }
    if (ch === '<') groups.set(i, stack.length > 0 ? stack[stack.length - 1] : -1);
  }
  return groups;
}

/** Номер строки (1-based) по смещению в исходнике. */
function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

/** Текст строки по смещению — для читаемого отчёта (обрезается вызывающим). */
function lineText(source, offset) {
  const start = source.lastIndexOf('\n', offset - 1) + 1;
  const end = source.indexOf('\n', offset);
  return source.slice(start, end === -1 ? source.length : end);
}

/** Правило 5: теги бейджа без явного `variant=` (в порядке исходника). */
export function findBadgeWithoutVariant(source) {
  const masked = maskNonCode(source);
  const out = [];
  BADGE_NO_VARIANT.lastIndex = 0;
  for (const match of masked.matchAll(BADGE_NO_VARIANT)) {
    out.push({ index: match.index, line: lineAt(source, match.index), text: lineText(source, match.index) });
  }
  return out;
}

/** Правило 6: ≥2 primary-кнопки в одном блоке рендера. */
export function findDuplicatePrimaries(source) {
  const groups = renderGroups(source);
  const byGroup = new Map();
  PRIMARY_BUTTON.lastIndex = 0;
  // Матчинг идёт по ИСХОДНИКУ: маска заменяет содержимое строк пробелами, и
  // `variant="primary"` в замаскированном тексте перестал бы совпадать. Для
  // группировки и поиска конца тега используется маска — смещения в обоих
  // текстах совпадают, потому что маска сохраняет длину.
  for (const match of source.matchAll(PRIMARY_BUTTON)) {
    const key = groups.get(match.index) ?? -1;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push({ index: match.index, line: lineAt(source, match.index), text: lineText(source, match.index) });
  }
  const out = [];
  for (const hits of byGroup.values()) {
    if (hits.length < 2) continue;
    for (const hit of hits) {
      out.push({
        index: hit.index,
        line: hit.line,
        text: hit.text,
        rule: 'duplicate-primary',
        detail: `в одном блоке рендера primary-кнопок: ${hits.length} (строки ${hits.map((h) => h.line).join(', ')})`,
      });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Конец открывающего тега (`>`), пропуская стрелки `=>` внутри пропсов. */
function openingTagEnd(masked, from) {
  for (let i = from; i < masked.length; i += 1) {
    if (masked[i] !== '>') continue;
    if (masked[i - 1] === '=') continue; // `=>` — стрелка, не конец тега
    return i;
  }
  return -1;
}

/**
 * Текст кнопки, если он ПРОСТОЙ литерал: `…>Продолжить</Button>` → «Продолжить».
 * Композитные дети (`<span>…</span>`, `{выражение}`, вложенные теги) дают null:
 * там подпись собирается из разметки, и сравнение строк было бы ложным.
 */
function primaryLabel(source, tagEndIndex) {
  const close = source.indexOf('</Button>', tagEndIndex);
  if (close === -1) return null;
  const inner = source.slice(tagEndIndex, close);
  if (inner.includes('<') || inner.includes('{') || inner.includes('}')) return null;
  const text = inner.replace(/\s+/g, ' ').trim();
  return text.length >= 3 ? text : null;
}

/**
 * Правило 7: две primary-кнопки с одинаковым ПРОСТЫМ текстом в одном файле.
 * Ровно этот дефект («Продолжить» в resume-баннере и «Продолжить» в нижнем
 * футере) не выражается через блоки рендера: у кнопок разные условия, но в
 * состоянии `isQuizInProgress && !mainButtonReady` они видны одновременно.
 */
export function findDuplicatePrimaryLabels(source) {
  const masked = maskNonCode(source);
  const byLabel = new Map();
  PRIMARY_BUTTON.lastIndex = 0;
  // Матчинг по исходнику (см. findDuplicatePrimaries), конец тега — по маске.
  for (const match of source.matchAll(PRIMARY_BUTTON)) {
    const tagEnd = openingTagEnd(masked, match.index);
    if (tagEnd === -1) continue;
    const label = primaryLabel(source, tagEnd + 1);
    if (label === null) continue;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push({ index: match.index, line: lineAt(source, match.index) });
  }
  const out = [];
  for (const [label, hits] of byLabel) {
    if (hits.length < 2) continue;
    for (const hit of hits) {
      out.push({
        index: hit.index,
        line: hit.line,
        rule: 'duplicate-primary-label',
        detail: `primary «${label}» повторяется: ${hits.length} (строки ${hits.map((h) => h.line).join(', ')})`,
        text: `«${label}»`,
      });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

function main() {
  const files = walk(path.join(ROOT, 'src'));
  const findings = [];
  const push = (file, line, rule, text) => findings.push({ file: rel(file), line, rule, text: text.trim() });

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    const hasDvh = /\b100dvh\b/.test(source);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      // 1) 100vh без 100dvh рядом
      if (!hasDvh && /\b100vh\b/.test(line)) {
        push(file, i + 1, 'viewport-unit', line);
      }

      // 2) hover/focus через inline styles
      if (/onMouse(Enter|Leave)\s*=/.test(line)) {
        const block = lines.slice(i, Math.min(i + 9, lines.length)).join('\n');
        if (/style=\{\{/.test(block)) push(file, i + 1, 'inline-hover-focus', line);
      }

      // 3) max-width медиа-запрос
      if (MAX_WIDTH_MQ.test(line)) push(file, i + 1, 'max-width-media-query', line);

      // 4) интерполяция в className
      if (CLASSNAME_INTERP.test(line) && /\$\{/.test(line)) {
        push(file, i + 1, 'classname-interpolation', line);
      }
    }

    // 5) тег бейджа без variant — только .tsx (в .css JSX-тегов не бывает)
    if (file.endsWith('.tsx')) {
      for (const hit of findBadgeWithoutVariant(source)) {
        push(file, hit.line, 'badge-without-variant', hit.text);
      }
      // 6) две primary в одном блоке рендера
      for (const hit of findDuplicatePrimaries(source)) {
        push(file, hit.line, hit.rule, `${hit.detail} — ${hit.text}`);
      }
      // 7) одинаковый текст у двух primary-кнопок файла
      for (const hit of findDuplicatePrimaryLabels(source)) {
        push(file, hit.line, hit.rule, `${hit.detail} — ${hit.text}`);
      }
    }
  }

  if (findings.length === 0) {
    console.log(`[styling-rules] OK — нарушений нет (проверено файлов: ${files.length})`);
    console.log('[summary] violations=0');
    process.exit(0);
  }

  console.log(`[styling-rules] FAIL — нарушений: ${findings.length} (в ${files.length} файлах)`);
  for (const f of findings) console.log(`  ${f.file}:${f.line}: ${f.rule} — ${f.text.slice(0, 100)}`);
  console.log('  fix: см. .dsh/skills/ui-styling-rules/SKILL.md');
  console.log(`[summary] violations=${findings.length}`);
  process.exit(1);
}

// CLI-режим: скрипт запускают как файл (audit-ui.mjs / npm run fitness). При
// импорте (self-test правил) main() не выполняется и процесс не завершается.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
