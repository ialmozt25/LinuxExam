#!/usr/bin/env node
/**
 * .project/drafts/_audit-png.mjs — программный анализ 19 baseline PNG (spec 080, PART 2.2).
 *
 * Vision недоступен в этой сессии (`read_image` → «no adapter registered for
 * provider "codex-local"` — тот же дефект, что зафиксирован в spec 077 и в
 * log.md), поэтому аудит идёт **программно**, как прямо разрешено заданием.
 * Инструмент декодирует PNG через `sharp` (transitive-зависимость playwright,
 * новых зависимостей не ставится) и снимает с КАЖДОГО снимка только то, что
 * вообще наблюдаемо в пикселях:
 *
 *   1. доминирующая палитра (top-10 + доля)            → COLOR: набор ролей
 *   2. площадь маджента-плейсхолдера (#ff00ff)          → COLOR: артефакт маски
 *   3. контент-бокс и поля до краёв вьюпорта            → LAYOUT: отступы/safe-area
 *   4. сегментация плоских областей (flood-fill по
 *      квантованным цветам) → пары «цвет на подложке»
 *      с реальным контрастом WCAG                       → COLOR: порог 4.5/3.0
 *   5. вертикальный профиль строк: пустые полосы,
 *      «склейка» контента по краям                      → LAYOUT/SPACING: ритм
 *   6. распределение высот строк и полос               → TYPO: межстрочный ритм
 *
 * Контраст считается честно: сначала области, потом пары «область ↔ её
 * сосед-подложка», а не «пиксель ↔ среднее окрестности» — усреднение по окну
 * ловит антиалиасинг буквы и даёт ложный ratio ≈ 1 на любом тексте.
 *
 * Что скрипт НЕ делает: не пишет отчёт (его пишет агент), не меняет PNG,
 * ничего не чинит. Запуск: node .project/drafts/_audit-png.mjs [--json <путь>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SNAP_DIR = path.join(ROOT, 'e2e', 'visual-regression.spec.ts-snapshots');

const args = process.argv.slice(2);
const jsonFlag = args.indexOf('--json');
const JSON_OUT = jsonFlag !== -1 && args[jsonFlag + 1] ? args[jsonFlag + 1] : null;

/** Точность квантования: 24 уровня на канал (>>3) — сохраняет близкие заливки. */
const SHIFT = 3;

const hex = (r, g, b) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`;

function luminance(r, g, b) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const l1 = luminance(a[0], a[1], a[2]);
  const l2 = luminance(b[0], b[1], b[2]);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Разница «различимо глазом»: сумма модулей по каналам. */
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/**
 * Сегментация на плоские области: BFS по 4-связности внутри одного
 * квантованного бина. Возвращает регионы с bbox, площадью и средним цветом.
 */
function segment(W, H, keys, idx, idOf, areaLimit) {
  const regions = [];
  const visited = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);

  for (let start = 0; start < W * H; start += 1) {
    if (visited[start]) continue;
    const want = keys[start];
    let head = 0;
    let tail = 0;
    queue[tail += 1] = start;
    visited[start] = 1;
    let n = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let minX = W;
    let maxX = -1;
    let minY = H;
    let maxY = -1;

    while (head < tail) {
      const p = queue[head += 1];
      if (p === undefined) break;
      const x = p % W;
      const y = (p - x) / W;
      const b = p * 3;
      const [r, g, bl] = idOf(keys[p]);
      n += 1;
      sr += r;
      sg += g;
      sb += bl;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && !visited[p - 1] && keys[p - 1] === want) {
        visited[p - 1] = 1;
        queue[tail += 1] = p - 1;
      }
      if (x < W - 1 && !visited[p + 1] && keys[p + 1] === want) {
        visited[p + 1] = 1;
        queue[tail += 1] = p + 1;
      }
      if (y > 0 && !visited[p - W] && keys[p - W] === want) {
        visited[p - W] = 1;
        queue[tail += 1] = p - W;
      }
      if (y < H - 1 && !visited[p + W] && keys[p + W] === want) {
        visited[p + W] = 1;
        queue[tail += 1] = p + W;
      }
      void idx;
      void b;
    }

    if (n >= areaLimit) {
      regions.push({
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
        area: n,
        color: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)],
        start,
      });
    }
  }
  return regions;
}

async function analyzeFile(file) {
  const full = path.join(SNAP_DIR, file);
  const { data, info } = await sharp(full).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const C = info.channels;
  const at = (i) => [data[i * C], data[i * C + 1], data[i * C + 2]];

  /* ------------------------------------------- 1. палитра + маджента */
  const hist = new Map();
  let magentaPx = 0;
  for (let i = 0; i < W * H; i += 1) {
    const [r, g, b] = at(i);
    if (r > 230 && g < 30 && b > 230) magentaPx += 1;
    const key = `${r >> SHIFT},${g >> SHIFT},${b >> SHIFT}`;
    const e = hist.get(key);
    if (e) {
      e.n += 1;
      e.r += r;
      e.g += g;
      e.b += b;
    } else hist.set(key, { n: 1, r, g, b });
  }
  const palette = [...hist.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 10)
    .map((e) => ({
      color: hex(Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)),
      px: e.n,
      share: +(e.n / (W * H)).toFixed(4),
    }));

  /* ------------------------------------------------- 2. контент-бокс */
  const bgRgb = [parseInt(palette[0].color.slice(1, 3), 16), parseInt(palette[0].color.slice(3, 5), 16), parseInt(palette[0].color.slice(5, 7), 16)];
  const nearBg = (r, g, b, tol = 20) => dist([r, g, b], bgRgb) <= tol * 3;
  const rowContent = new Int32Array(H);
  let minX = W;
  let maxX = -1;
  let minY = H;
  let maxY = -1;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const [r, g, b] = at(y * W + x);
      if (nearBg(r, g, b)) continue;
      rowContent[y] += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  /* --------------------------------- 3. сегментация плоских областей */
  const keys = new Array(W * H);
  const idMap = new Map();
  for (let i = 0; i < W * H; i += 1) {
    const [r, g, b] = at(i);
    const key = `${r >> SHIFT},${g >> SHIFT},${b >> SHIFT}`;
    keys[i] = key;
    if (!idMap.has(key)) idMap.set(key, [r, g, b]);
  }
  const idOf = (k) => idMap.get(k);
  const MIN_AREA = Math.max(12, Math.round(W * H * 0.00002));
  const regions = segment(W, H, keys, null, idOf, MIN_AREA);

  /* ------------------ 4. контраст: область против её подложки-соседа */
  // Подложка региона = самый частый цвет среди пикселей, лежащих сразу за его
  // границей. Это ловит именно пару «текст/иконка на поверхности», в отличие от
  // усреднения окна (тонет в антиалиасинге).
  const contrastPairs = [];
  for (const reg of regions) {
    const counts = new Map();
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const k = keys[y * W + x];
      if (k === keys[reg.start]) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    };
    for (let x = reg.x; x < reg.x + reg.w; x += 1) {
      push(x, reg.y - 1);
      push(x, reg.y + reg.h);
    }
    for (let y = reg.y; y < reg.y + reg.h; y += 1) {
      push(reg.x - 1, y);
      push(reg.x + reg.w, y);
    }
    if (!counts.size) continue;
    const [bk] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const behind = idOf(bk);
    const ratio = contrast(reg.color, behind);
    // «Текст» = компактная область (не полоса и не плита целиком).
    const compact = reg.area < W * H * 0.25;
    contrastPairs.push({
      color: hex(...reg.color),
      behind: hex(...behind),
      ratio: +ratio.toFixed(2),
      area: reg.area,
      box: `${reg.x},${reg.y} ${reg.w}x${reg.h}`,
      compact,
    });
  }
  const below45 = contrastPairs.filter((p) => p.compact && p.ratio < 4.5);
  const below3 = contrastPairs.filter((p) => p.compact && p.ratio < 3);

  /* ------------------------------------ 5. вертикальный ритм и полосы */
  const bands = [];
  let run = -1;
  for (let y = 0; y < H; y += 1) {
    const empty = rowContent[y] <= 1;
    if (empty && run === -1) run = y;
    if (!empty && run !== -1) {
      if (y - run >= 32) bands.push({ from: run, to: y - 1, h: y - run });
      run = -1;
    }
  }
  if (run !== -1 && H - run >= 32) bands.push({ from: run, to: H - 1, h: H - run });

  // Строки, где контент касается обоих краёв (full-bleed полосы: футеры, шапки).
  const fullBleedRows = [];
  let fbRun = -1;
  for (let y = 0; y < H; y += 1) {
    const touches = rowContent[y] > 1 && (() => {
      let l = false;
      let r = false;
      for (let x = 0; x < W && !(l && r); x += 1) {
        const [rr, gg, bb] = at(y * W + x);
        if (!nearBg(rr, gg, bb)) {
          if (x <= 1) l = true;
          if (x >= W - 2) r = true;
        }
      }
      return l && r;
    })();
    if (touches && fbRun === -1) fbRun = y;
    if (!touches && fbRun !== -1) {
      if (y - fbRun >= 8) fullBleedRows.push({ from: fbRun, to: y - 1, h: y - fbRun });
      fbRun = -1;
    }
  }
  if (fbRun !== -1 && H - fbRun >= 8) fullBleedRows.push({ from: fbRun, to: H - 1, h: H - fbRun });

  /* ------------------------------------------- 6. сводка по снимку */
  const uniqueColors = hist.size;

  return {
    file,
    width: W,
    height: H,
    palette,
    uniqueColors,
    magentaPx,
    contentBox: maxX < 0 ? null : { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 },
    margins: maxX < 0 ? null : { left: minX, right: W - 1 - maxX, top: minY, bottom: H - 1 - maxY },
    contentRatio: +(rowContent.filter((n) => n > 1).length / H).toFixed(3),
    emptyBands: bands,
    fullBleedRows,
    regions: regions.length,
    contrastPairs: contrastPairs.length,
    below45: below45.sort((a, b) => a.ratio - b.ratio).slice(0, 20),
    below3Count: below3.length,
    below45Count: below45.length,
  };
}

async function main() {
  const files = fs
    .readdirSync(SNAP_DIR)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b));

  const out = {
    generatedAt: new Date().toISOString(),
    tool: 'sharp (region segmentation, WCAG 2.x contrast)',
    vision: 'unavailable (provider codex-local has no adapter) — audit is programmatic',
    dir: 'e2e/visual-regression.spec.ts-snapshots',
    screens: [],
  };

  for (const f of files) {
    const res = await analyzeFile(f);
    const name = f.replace(/-win32\.png$/, '');
    const dash = name.lastIndexOf('-');
    out.screens.push({ screen: name.slice(0, dash), viewport: name.slice(dash + 1), ...res });
  }

  if (JSON_OUT) fs.writeFileSync(JSON_OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  for (const s of out.screens) {
    console.log(`\n=== ${s.file} ${s.width}x${s.height} ===`);
    console.log(`  palette(${s.uniqueColors} unique): ${s.palette.slice(0, 6).map((p) => `${p.color}:${(p.share * 100).toFixed(1)}%`).join(' ')}`);
    console.log(`  box ${s.contentBox?.w}x${s.contentBox?.h}@${s.contentBox?.minX},${s.contentBox?.minY} margins L${s.margins?.left} R${s.margins?.right} T${s.margins?.top} B${s.margins?.bottom} contentRatio=${s.contentRatio} magenta=${s.magentaPx}`);
    console.log(`  regions=${s.regions} pairs=${s.contrastPairs} below45=${s.below45Count} below3=${s.below3Count}`);
    console.log(`  fullBleed: ${s.fullBleedRows.map((b) => `${b.from}-${b.to}(${b.h})`).join(' ') || 'none'}`);
    console.log(`  emptyBands: ${s.emptyBands.map((b) => `${b.from}-${b.to}(${b.h})`).join(' ') || 'none'}`);
    for (const p of s.below45.slice(0, 6)) {
      console.log(`     ratio=${p.ratio} ${p.color} on ${p.behind} area=${p.area} @${p.box}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
