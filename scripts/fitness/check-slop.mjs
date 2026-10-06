#!/usr/bin/env node
/**
 * check-slop.mjs — fitness-проверка «check-slop» (severity: high).
 *
 * 12 anti-slop tells дизайн-контура LinuxExam (.project/governance/DESIGN.md,
 * «Do's and Don'ts»). Контракт — DESIGN.md, процедура — .dsh/skills/design-guardian.
 *
 * Область сканирования ровно по контракту: `src/**`/*.tsx плюс
 * `src/presentation/theme/tokens.css` (остальные .css не входят — там нет
 * дизайн-решений экрана, а ложные срабатывания на чужих файлах дороже).
 *   1. tech gradient  #6366f1 / #8b5cf6 / #a855f7 в gradient
 *   2. feature-tile grid: >=3 <Card> с icon + <h3> + <p> в одном файле
 *   3. centered hero: text-align center + gradient + одна primary-кнопка в hero
 *   4. backdrop-filter: blur вне modal/popover/toast
 *   5. stat monument: font-size >= 48px без label (<14px) рядом
 *   6. icon topper: >=3 секций подряд icon-then-heading
 *   7. diffuse shadow: box-shadow с blur > 24px
 *   8. emoji-as-icon в feature-блоке (не streak/achievement)
 *   9. hardcoded font-size в .tsx (fontSize: Npx)
 *  10. >=2 accent в tokens.css (accent + accent-strong = одна роль)
 *  11. default type stack (Inter/Roboto/Arial/Helvetica первым в font-family)
 *  12. token bypass: hex в .tsx == значению существующего токена
 *
 * Структурные проверки (2, 3, 6) эвристические и считаются по файлу; построчные
 * (1, 4, 5, 7, 8, 9, 11, 12) — по строке с окном контекста. Проверки НЕ ремонтируют
 * код: они только находят. Ложные срабатывания разбираются вручную по tell-id.
 *
 * Exception path (governance Contract, секция fitness_policy):
 *   scripts/fitness/allowlist.json — исключения по (file, hex) с обязательными
 *   reason и expires (ISO YYYY-MM-DD). Касается ТОЛЬКО tell 12 (token-bypass):
 *   это тот же дефект, что «no-hex-in-tsx» у check-colors.mjs (hex-литерал в .tsx),
 *   поэтому исключение — свойство пары (file, hex), а не отдельного детектора:
 *   одобренный капитаном SDK-payload не должен краснеть дважды. Записи читаются
 *   из ВСЕХ секций allowlist.json (по имени проверки-владельца).
 *     - (file, hex) совпал и не истёк  → [allowlisted] (exit не блокирует);
 *     - expires < сегодня               → [expired] → FAIL;
 *     - запись не совпала и её hex — значение существующего токена
 *       → [stale] (advisory, exit 0). Записи, чей hex вообще не равен значению
 *       токена, для этого фильтра вне области (он их не может найти) и stale не
 *       объявляются: их использует проверка-владелец.
 *   Inline-подавлений в коде нет намеренно: исключение живёт в одном файле и
 *   видно целиком.
 *
 * Zero-deps: только node:*. Symlink-каталоги не разворачиваются.
 * Exit 0 — чисто; exit 1 — есть находки (в т.ч. [expired]); exit 2 — внутренняя
 * ошибка (нет tokens.css).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const CHECK_ID = 'check-slop';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'test-results', '__tests__', '__mocks__']);
const TOKENS_CSS = path.join(ROOT, 'src', 'presentation', 'theme', 'tokens.css');
const ALLOWLIST = path.join(SCRIPT_DIR, 'allowlist.json');

const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const TECH_GRADIENT_HEX = /#(?:6366f1|8b5cf6|a855f7)\b/i;
const DECL_RE = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]*);/;
const VAR_NAME_RE = /var\(\s*(--[a-z0-9-]+)\s*/g;
const EMOJI_RE = /[\p{Extended_Pictographic}]/u;
const DEFAULT_STACK = /^(inter|roboto|arial|helvetica)(\s|$)/i;
/** Подпись рядом с числом-монументом: мелкий кегль ИЛИ явный label-маркер. */
const SMALL_LABEL = /(?:font-size|fontSize)\s*:\s*['"]?1[0-3](?:\.\d+)?px|label|caption|hint|subtitle/i;
/** Кегль >= 48px в .tsx (fontSize) или в tokens.css (font-size). */
const TSX_FONT_SIZE = /fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)px/i;
const CSS_FONT_SIZE = /font-size\s*:\s*(\d+(?:\.\d+)?)px/i;

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
    } else if (e.isFile() && e.name.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const normHex = (h) => String(h).trim().toUpperCase();
const normFile = (f) => String(f).trim().replace(/\\/g, '/');
const firstHex = (s) => {
  const m = s.match(HEX_RE);
  return m ? m[0].toLowerCase() : null;
};
const firstFamily = (s) => {
  const first = s.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return first || null;
};

/** Сегодняшняя дата в локальной зоне как ISO YYYY-MM-DD (сравнение с expires). */
function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Записи allowlist по (file, hex) — из ВСЕХ секций файла (ключ = имя проверки-
 * владельца). ENOENT/битый JSON → пустой список + WARN (проверка не падает).
 */
function readAllowlist() {
  let raw;
  try {
    raw = fs.readFileSync(ALLOWLIST, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') console.log(`[${CHECK_ID}] warn: allowlist не прочитан (${e.code || e.message})`);
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    const out = [];
    for (const key of Object.keys(parsed ?? {})) {
      const list = parsed[key];
      if (Array.isArray(list)) out.push(...list);
    }
    return out;
  } catch (e) {
    console.log(`[${CHECK_ID}] warn: allowlist.json не парсится (${e.message}) — считаю пустым`);
    return [];
  }
}

/** Парсит tokens.css: декларации, hex по имени, акцентные роли, hex по значению. */
function readTokens() {
  const source = fs.readFileSync(TOKENS_CSS, 'utf8');
  const lines = source.split(/\r?\n/);
  const decls = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(DECL_RE);
    if (m) decls.push({ name: m[1], value: m[2].trim(), line: i + 1 });
  }
  const hexByName = new Map();
  const tokenByHex = new Map();
  for (const d of decls) {
    const h = firstHex(d.value);
    if (h) {
      hexByName.set(d.name, h);
      if (!tokenByHex.has(h)) tokenByHex.set(h, []);
      tokenByHex.get(h).push(d.name);
    }
  }
  // Акцентные роли: --accent и --color-accent*; accent + accent-strong = ОДНА роль.
  // Роль различается по РЕЗУЛЬТИРУЮЩЕМУ hex, а не по имени, поэтому алиас
  // `--accent: var(--color-accent-strong)` второй роли не создаёт.
  const accentHexes = new Set();
  const accentLines = [];
  for (const d of decls) {
    if (d.name !== '--accent' && !d.name.startsWith('--color-accent')) continue;
    accentLines.push(d.line);
    const resolved = new Set();
    const direct = firstHex(d.value);
    if (direct) resolved.add(direct);
    for (const vm of d.value.matchAll(VAR_NAME_RE)) {
      const refHex = hexByName.get(vm[1]);
      if (refHex) resolved.add(refHex);
    }
    for (const h of resolved) accentHexes.add(h);
  }
  return { tokenByHex, accentHexes, accentLines };
}

export function main() {
  let tokens;
  try {
    tokens = readTokens();
  } catch (e) {
    console.log(`[${CHECK_ID}] ERROR — не прочитан tokens.css (${e.code || e.message})`);
    console.log('[summary] violations=unknown');
    process.exit(2);
  }

  const scanFiles = [...walk(path.join(ROOT, 'src')), TOKENS_CSS];
  const findings = [];
  const bypassHits = [];
  const push = (file, line, tell, text) => findings.push({ file: rel(file), line, tell, text });

  for (const file of scanFiles) {
    const isCss = file.endsWith('.css');
    const source = fs.readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const win = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join('\n');

      // 1. tech gradient
      if (TECH_GRADIENT_HEX.test(line) && /gradient/i.test(win)) {
        push(file, i + 1, 'tech-gradient', 'градиент на tech-палитре — замени на accent/нейтральную шкалу');
      }

      // 4. backdrop blur вне modal/popover/toast
      if (/backdrop-filter\s*:\s*blur|backdropFilter\s*:\s*['"]?blur/i.test(line)) {
        if (!/(modal|popover|toast|overlay|sheet|dialog|drawer)/i.test(win)) {
          push(file, i + 1, 'backdrop-blur', 'backdrop blur вне modal/popover/toast — стеклянный эффект не несёт смысла');
        }
      }

      // 5. stat monument: font-size >= 48px без label < 14px рядом
      const fsMatch = line.match(isCss ? CSS_FONT_SIZE : TSX_FONT_SIZE);
      if (fsMatch && parseFloat(fsMatch[1]) >= 48) {
        const wideWin = lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 11)).join('\n');
        if (!SMALL_LABEL.test(wideWin)) {
          push(file, i + 1, 'stat-monument', `кегль ${fsMatch[1]}px без подписи <14px рядом — число без контекста`);
        }
      }

      // 7. diffuse shadow: box-shadow blur > 24px
      // Цветовые функции вырезаются до разбора: иначе числа из rgba() попадают в
      // список длин и blur считается не с той позиции. Длины разбираются по
      // каждой тени отдельно (`box-shadow` допускает список через запятую), и
      // unitless-ноль (`0 8px 48px`) — такая же длина, как `0px`, поэтому px
      // в токене необязателен. Blur — ТРЕТЬЯ длина.
      const shadowMatch = line.match(/box-shadow\s*:\s*([^;]+)/i) || line.match(/boxShadow\s*:\s*['"]([^'"]+)['"]/i);
      if (shadowMatch) {
        const shadows = shadowMatch[1].replace(/(?:rgba?|hsla?)\([^)]*\)/gi, ' ').split(',');
        for (const part of shadows) {
          const lengths = part
            .split(/\s+/)
            .filter((t) => /^-?\d+(?:\.\d+)?(?:px)?$/.test(t))
            .map((t) => parseFloat(t));
          if (lengths.length >= 3 && lengths[2] > 24) {
            push(file, i + 1, 'diffuse-shadow', `blur ${lengths[2]}px > 24px — срезай до контурной тени`);
            break;
          }
        }
      }

      // 8. emoji-as-icon в feature-блоке (не streak/achievement)
      if (EMOJI_RE.test(line) && /(feature|card|benefit|section|tile)/i.test(win) && !/(streak|achievement|award)/i.test(win)) {
        push(file, i + 1, 'emoji-as-icon', 'emoji вместо иконки в feature-блоке — используй SVG-иконку');
      }

      // 9. hardcoded font-size в .tsx
      if (!isCss && /fontSize\s*:\s*['"]?\d+(?:\.\d+)?px['"]?/i.test(line)) {
        push(file, i + 1, 'hardcoded-font-size', 'px font-size в .tsx — бери var(--text-*/--heading-*) из tokens.css');
      }

      // 11. default type stack (первым Inter/Roboto/Arial/Helvetica)
      const ffMatch = isCss
        ? line.match(/(?:^|\s)(?:--[\w-]*font[\w-]*|font-family)\s*:\s*([^;]+);/i)
        : line.match(/fontFamily\s*:\s*(['"`])([^'"`]+)\1/i);
      if (ffMatch) {
        const fam = firstFamily(isCss ? ffMatch[1] : ffMatch[2]);
        if (fam && DEFAULT_STACK.test(fam)) {
          push(file, i + 1, 'default-type-stack', `шрифт «${fam}» первым в стеке — используй system-ui / -apple-system`);
        }
      }

      // 12. token bypass: hex в .tsx == значению существующего токена.
      // Находки копятся, а не пушатся: их судьбу решает allowlist (ниже), и
      // решение требует индекса токенов целиком.
      if (!isCss) {
        for (const hm of line.matchAll(HEX_RE)) {
          const h = hm[0].toLowerCase();
          if (tokens.tokenByHex.has(h)) {
            bypassHits.push({ file, line: i + 1, hex: normHex(hm[0]), tokens: tokens.tokenByHex.get(h) });
          }
        }
      }
    }

    if (!isCss) {
      // 2. feature-tile grid: >=3 Card с icon + h3 + p
      const cards = (source.match(/<Card\b/g) || []).length;
      const h3 = (source.match(/<h3\b/g) || []).length;
      const p = (source.match(/<p\b/g) || []).length;
      const icons = (source.match(/<Icon\b|<svg\b|<[A-Z]\w*Icon\b/g) || []).length;
      if (cards >= 3 && h3 >= 3 && p >= 3 && icons >= 3) {
        push(file, 1, 'feature-tile-grid', `>=3 Card с icon+h3+p (cards=${cards}, h3=${h3}, p=${p}, icons=${icons})`);
      }

      // 3. centered hero: text-align center + gradient + одна primary-кнопка
      const hero = /hero/i.test(source);
      const center = /text-align\s*:\s*center|textAlign\s*:\s*['"]center/i.test(source);
      const gradient = /gradient/i.test(source);
      const primaries = (source.match(/variant\s*=\s*["']primary["']/g) || []).length;
      if (hero && center && gradient && primaries === 1) {
        push(file, 1, 'centered-hero', 'centered hero: центр + градиент + одна primary-кнопка');
      }

      // 6. icon topper: >=3 секций подряд icon-then-heading
      let pairs = 0;
      for (let i = 0; i < lines.length; i += 1) {
        if (/<Icon\b|<svg\b|<[A-Z]\w*Icon\b/.test(lines[i])) {
          const ahead = lines.slice(i + 1, Math.min(lines.length, i + 6)).join('\n');
          if (/<h[1-4]\b/.test(ahead)) pairs += 1;
        }
      }
      if (pairs >= 3) push(file, 1, 'icon-topper', `>=3 секций подряд icon-then-heading (найдено ${pairs})`);
    }
  }

  // 10. >=2 accent в tokens.css
  if (tokens.accentHexes.size > 1) {
    push(TOKENS_CSS, tokens.accentLines[0] || 1, 'multi-accent', `акцентных ролей больше одной: ${[...tokens.accentHexes].join(', ')}`);
  }

  // --- token-bypass × allowlist (та же семантика, что у check-colors.mjs)
  const today = todayIso();
  const entries = readAllowlist()
    .filter((e) => e && typeof e === 'object' && e.file && e.hex)
    .map((e) => ({ ...e, file: normFile(e.file), hex: normHex(e.hex), matched: 0 }));
  const allowlisted = [];
  const expired = [];

  for (const hit of bypassHits) {
    const entry = entries.find((e) => e.file === normFile(rel(hit.file)) && e.hex === normHex(hit.hex));
    if (!entry) {
      push(
        hit.file,
        hit.line,
        'token-bypass',
        `hex ${hit.hex} == значению токена ${hit.tokens.join(', ')} — используй var()`,
      );
      continue;
    }
    entry.matched += 1;
    if (typeof entry.expires === 'string' && entry.expires < today) expired.push({ ...hit, expires: entry.expires });
    else allowlisted.push(hit);
  }
  for (const hit of expired) {
    push(
      hit.file,
      hit.line,
      'token-bypass',
      `hex ${hit.hex} — исключение истекло (expires ${hit.expires}): продлить или снять в allowlist.json`,
    );
  }
  // Stale — только записи В ОБЛАСТИ этого фильтра (hex == значение токена):
  // запись с чужим hex он всё равно никогда не найдёт, объявлять её stale значит
  // требовать удалить исключение, нужное проверке-владельцу.
  const stale = entries.filter((e) => e.matched === 0 && tokens.tokenByHex.has(e.hex.toLowerCase()));

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  // Отчётность по исключениям — после заголовка OK/FAIL, как у check-colors.mjs.
  const allowLines = allowlisted.map((hit) => `  [allowlisted] ${rel(hit.file)}:${hit.line}: ${hit.hex}`);
  const staleLines = stale.map((e) => `  [stale] ${e.file} ${e.hex} — исключение не совпало с находкой check-slop, удалить`);
  const bypassLine =
    `[${CHECK_ID}] token-bypass: ${bypassHits.length - allowlisted.length} ` +
    `(allowlisted=${allowlisted.length}, expired=${expired.length}, stale=${stale.length})`;

  if (findings.length === 0) {
    console.log(`[${CHECK_ID}] OK — нарушений нет (проверено файлов: ${scanFiles.length})`);
    for (const l of allowLines) console.log(l);
    for (const l of staleLines) console.log(l);
    console.log(bypassLine);
    console.log(`[summary] violations=0 allowlisted=${allowlisted.length} stale=${stale.length}`);
    process.exit(0);
  }

  console.log(`[${CHECK_ID}] FAIL — нарушений: ${findings.length} (в ${scanFiles.length} файлах)`);
  for (const f of findings) console.log(`  ${f.file}:${f.line}: ${f.tell}: ${f.text}`);
  for (const l of allowLines) console.log(l);
  for (const l of staleLines) console.log(l);
  console.log(bypassLine);
  console.log('  fix: см. .project/governance/DESIGN.md и .dsh/skills/design-guardian/SKILL.md');
  console.log(`[summary] violations=${findings.length} allowlisted=${allowlisted.length} stale=${stale.length}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
