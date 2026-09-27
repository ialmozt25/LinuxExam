import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

// local-serve.mjs — статический сервер с маршрутизацией ПО ХОСТУ.
// Назначение: человеческие адреса без порта для двух локальных артефактов.
//
//   Host: linuxexam.local        → ./dist/   (сборка приложения)
//   Host: center.local           → ./docs/   (центр разработки)
//   Host: localhost / 127.0.0.1  → ./docs/index.html (фолбэк, не зависит от hosts)
//
// Порт по умолчанию 80 (круглые адреса без порта), переопределяется `--port <n>`.
// Только встроенные модули Node — новых зависимостей нет.
//
// См. инструкцию: docs/LOCAL-ALIASES.md

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Правила маршрутизации. Порядок важен: точные хосты, затем фолбэк `*`.
 * `dir` — каталог, отдаваемый целиком; `index` — файл по умолчанию для `/`.
 */
const ROUTES = [
  { host: 'linuxexam.local', dir: 'dist', index: 'index.html' },
  { host: 'center.local', dir: 'docs', index: 'index.html' },
  { host: '*', dir: 'docs', index: 'index.html' },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const DEFAULT_MIME = 'application/octet-stream';
const DEFAULT_PORT = 80;

// --- Аргументы командной строки ---------------------------------------------

const args = process.argv.slice(2);
const getArg = (key) => {
  const inline = args.find((a) => a.startsWith(key + '='));
  if (inline) return inline.slice(key.length + 1);
  const i = args.indexOf(key);
  return i !== -1 ? args[i + 1] : null;
};

const portArg = getArg('--port');
const PORT = portArg === null ? DEFAULT_PORT : Number.parseInt(portArg, 10);

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  console.error(`Invalid --port value: ${portArg}`);
  process.exit(2);
}

// --- Маршрутизация -----------------------------------------------------------

/** `Host` без порта и без регистра: "Center.Local:8080" → "center.local". */
function normalizeHost(header) {
  if (!header) return '';
  const host = header.split(':')[0].trim().toLowerCase();
  return host;
}

/** Правило для хоста; неизвестный хост уходит на фолбэк `*`. */
function routeFor(host) {
  return ROUTES.find((r) => r.host === host) ?? ROUTES.find((r) => r.host === '*');
}

/**
 * Разбирает URL-путь в файл на диске внутри корня маршрута.
 * Возвращает null, если путь выходит за корень (traversal) — такой запрос запрещён.
 */
function resolveTarget(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const clean = decoded.split('\0').join('');
  const absolute = path.resolve(root, '.' + path.posix.normalize(clean));
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return absolute;
}

/** Файл для отдачи: индекс каталога, если запрошен каталог. */
function pickFile(target, indexName) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return null;
  }
  if (stat.isDirectory()) {
    const index = path.join(target, indexName);
    return fs.existsSync(index) ? index : null;
  }
  return stat.isFile() ? target : null;
}

// --- Логи --------------------------------------------------------------------

function log(req, status, startedAt, note) {
  const ms = Date.now() - startedAt;
  const host = normalizeHost(req.headers.host) || '-';
  const suffix = note ? ` ${note}` : '';
  process.stdout.write(`${host} ${req.method} ${req.url} ${status} ${ms}ms${suffix}\n`);
}

function sendPlain(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text + '\n');
}

// --- Стартовая диагностика ---------------------------------------------------

/** Пустой dist/ — самая частая причина «пустой страницы»; подсказываем команду. */
function distIsEmpty() {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) return true;
  return fs.readdirSync(dist).length === 0;
}

// --- Сервер ------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const startedAt = Date.now();
  const route = routeFor(normalizeHost(req.headers.host));
  const root = path.join(ROOT, route.dir);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    log(req, 405, startedAt);
    sendPlain(res, 405, 'Method Not Allowed');
    return;
  }

  const urlPath = (req.url ?? '/').split('?')[0];
  const target = resolveTarget(root, urlPath);

  if (target === null) {
    log(req, 403, startedAt, 'traversal blocked');
    sendPlain(res, 403, 'Forbidden');
    return;
  }

  const file = pickFile(target, route.index);

  if (!file) {
    const note = route.dir === 'dist' && distIsEmpty() ? 'dist is empty — run npm run build' : '';
    log(req, 404, startedAt, note);
    sendPlain(res, 404, 'Not Found' + (note ? ` (${note})` : ''));
    return;
  }

  const ext = path.extname(file).toLowerCase();
  let content;
  try {
    content = fs.readFileSync(file);
  } catch (e) {
    log(req, 500, startedAt, e.message);
    sendPlain(res, 500, 'Internal Server Error');
    return;
  }

  log(req, 200, startedAt);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? DEFAULT_MIME,
    'Content-Length': content.length,
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') res.end();
  else res.end(content);
});

server.on('error', (e) => {
  if (e.code === 'EACCES') {
    console.error(`Порт ${PORT} недоступен (нужны права администратора).`);
    console.error('Вариант без admin: npm run serve:local:8080');
  } else if (e.code === 'EADDRINUSE') {
    console.error(`Порт ${PORT} уже занят. Вариант: npm run serve:local:8080`);
  } else {
    console.error(`Ошибка сервера: ${e.message}`);
  }
  process.exit(2);
});

server.listen(PORT, () => {
  if (distIsEmpty()) {
    console.warn('dist/ пуст — для linuxexam.local сначала выполните: npm run build');
  }
  const marked = PORT === DEFAULT_PORT ? `http://center.local` : `http://center.local:${PORT}`;
  process.stdout.write(`local-serve: порт ${PORT}\n`);
  process.stdout.write(`  linuxexam.local  → ${path.join(ROOT, 'dist')}\n`);
  process.stdout.write(`  center.local     → ${path.join(ROOT, 'docs')}\n`);
  process.stdout.write(`  фолбэк localhost → ${path.join(ROOT, 'docs', 'index.html')}\n`);
  process.stdout.write(`  открой: ${marked}\n`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
