// run-spec.mjs — запуск MAS-прогона по спеке через CLI-путь к dsh-agent-teams
// (spec 033a, задача t1; артефакт t0 — .project/scripts/RUN-SPEC-SPIKE.md).
//
// ПУТЬ (вердикт t0, строка `PATH: H2` в RUN-SPEC-SPIKE.md):
//   CLI-раннтайм DSH. `dsh agent-teams …` не существует, поэтому используется
//   one-shot headless-поверхность: `dsh --profile <p> "/agent-teams <цель>"`.
//   Ведущий `/agent-teams` активирует протокол капитана через gesture boundary
//   (README плагина:122-125 — «Surfaces without command adjudication (for example
//   the headless CLI) get the same deterministic activation»). Второй CLI-вход из
//   отчёта — stdio JSON-RPC `dsh --profile sdk` (вариант C) — этим скриптом не
//   используется: он даёт поток событий вместо финального ответа и не имеет
//   per-prompt результата.
//
// PRECONDITION (отчёт t0, §5 «Выбранный путь и precondition»):
//   - запущенный DSH НЕ нужен, HTTP-сервер не поднимается;
//   - токен/cookie НЕ нужен (путь H1 — HTTP API — отклонён);
//   - нужен профиль, из чьего node_modules резолвится @nanmicoder/dsh-agent-teams:
//     в t0 зафиксировано `headless → MODULE_NOT_FOUND`, `web → OK`. Разовая
//     настройка (вне репозитория):
//       dsh --profile mas --from-default-profile headless
//       dsh plugin --profile mas add @nanmicoder/dsh-agent-teams
//   - нужен LLM-роут профиля (headless-шаблон несёт dsh-tier-router) —
//     иначе прогон падает до создания команды;
//   - cwd = workspace: состояние команды лежит в `<workspace>/.agent-teams/<teamId>/`;
//     читается с диска (путь H3 = только read-канал: watcher'а у плагина нет,
//     живой процесс DSH внешнюю запись не замечает).
//
// Использование:
//   node .project/scripts/run-spec.mjs <spec-id> [--dry-run|--live] [--json]
//        [--profile <name>] [--workspace <dir>] [--timeout-ms <ms>]
//        [--max-cost-usd <usd>] [--soft-cap-usd <usd>] [--cost-source <path>]
//   npm run spec:run -- 033a --dry-run
//   node .project/scripts/run-spec.mjs 013 --live --workspace %TEMP%\\ws
//
// spec 051 (Autonomous Spec Chain, минимальный) добавляет в этот скрипт две
// компоненты: риск-скоринг задач плана (ACTION_RISK + пороги 50/80, `risk_score`
// каждой задачи и `maxRiskScore` плана — вход условия STOP B) и бюджет прогона
// (soft/hard-капы в USD, warn 50% / downgrade pro→flash 80% / kill 100% с
// evidence `.project/drafts/spec-<id>-budget.json` и записью в `alerts.md`).
//
// Коды выхода (по образцу archive-team.mjs):
//   0 — успех: dry-run-отчёт либо реальный прогон со status=ok;
//   1 — провал реального прогона или неожиданная ошибка ввода-вывода (в т.ч.
//       отсутствует handoff-шаблон templates/mas/*);
//   2 — ошибка использования/ввода (нет spec-id, неизвестный флаг, спека не найдена);
//   3 — прогон не стартовал по предусловию: не выполнено precondition пути H2
//       (нет dsh CLI / нет профиля / плагин не резолвится) — `status:
//       precondition-missing`; ЛИБО бюджет исчерпан (spec 051) — `status:
//       budget-exceeded`, запись в alerts.md. Различать по `result.status`.
//
// ШАБЛОНЫ (spec 033a, п. «Что делаем 3»): перед запуском реального прогона
// templates/mas/TASK.md и templates/mas/SESSION.md копируются в каталог команды
// `<workspace>/.agent-teams/<teamId>/` (пути — от корня репозитория, копирование
// идемпотентно, отсутствие шаблона — понятная ошибка с точным путём). В --dry-run
// копирование не выполняется: печатается только план.
//
// СПЕКА (spec 035, fix spec-resolution): каталог спек жёстко привязан к корню репо
// (`SPECS_DIR`), а cwd вложенного агента = `--workspace`, поэтому перед реальным
// прогоном файл спеки материализуется в `<workspace>/.project/specs/<file>.md`
// (вариант A). В /agent-teams-промпт идёт `.project/specs/<file>.md` — путь,
// который существует относительно cwd вложенного агента. При workspace = корень
// репо целевой путь совпадает с исходным: копирование пропускается, текст промпта
// прежний. В --dry-run копирование не выполняется (печатается только план).
//
// `--live` — алиас не-dry-run (явный реальный прогон); одиночный `--dry-run`
// по-прежнему даёт dry-run.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень репозитория (скрипт лежит в `<repo>/.project/scripts/`). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Каталог спек. */
export const SPECS_DIR = path.join(REPO_ROOT, '.project', 'specs');

/**
 * Каталог спеки внутри workspace (относительно `<workspace>`) — ровно тот путь,
 * который подставляется в /agent-teams-промпт и существует относительно cwd
 * вложенного агента (spec 035, вариант A).
 */
export const WORKSPACE_SPECS_DIR = path.join('.project', 'specs');

/** Канонический путь истории прогонов (выбран капитаном для spec 033a). */
export const HISTORY_PATH = path.join(REPO_ROOT, '.project', 'mas-runs.json');

/** Каталог handoff-шаблонов MAS (отдельно от templates/factory — spec 033a). */
export const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates', 'mas');

/** Шаблоны, копируемые в каталог команды; порядок фиксирован для отчёта. */
export const TEMPLATE_FILES = ['TASK.md', 'SESSION.md'];

/** Имя каталога состояния команды внутри workspace (совпадает с config плагина). */
export const STATE_DIR_NAME = '.agent-teams';

/** Пакет плагина, который обязан резолвиться из профиля (precondition H2). */
export const PLUGIN_PACKAGE = '@nanmicoder/dsh-agent-teams';

/** Ведущий маркер активации протокола капитана на headless-поверхности. */
export const ACTIVATION_PREFIX = '/agent-teams';

/* --------------------------------------- Telegram-уведомления (spec 042/T2) */

/** Ядро уведомлений (spec 042/T1). */
const NOTIFY_SCRIPT = path.join(REPO_ROOT, '.project', 'scripts', 'notify.mjs');

/**
 * Fire-and-forget Telegram-уведомление (spec 042/T2). Никогда не бросает, не
 * блокирует родителя, ничего не пишет в stdout парсеров и не влияет на
 * exit-код: дочерний процесс detached + unref, его вывод не читается
 * (`stdio: 'ignore'`). Сбой Telegram не ломает прогон.
 */
function notifyFireAndForget(event, message) {
  try {
    const child = spawn(process.execPath, [NOTIFY_SCRIPT, message, '--event', event], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
      windowsHide: true,
      detached: true,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* уведомление не должно ломать прогон */
  }
}

/* ------------------------------------------- риск-скоринг задач (spec 051) */

/**
 * Веса действий (spec 051, «Что делаем 1»). Смысл шкалы: обратимое чтение дёшево,
 * необратимая публикация/удаление дорого. `git push` стоит ровно 80 — на пороге
 * HUMAN_THRESHOLD, поэтому задача с `git push` в actions всегда уходит человеку.
 */
export const ACTION_RISK = {
  read: 5,
  'git status': 5,
  edit: 30,
  'git commit': 25,
  'npm test': 20,
  'git push': 80,
  rm: 70,
  'rm -rf': 95,
  migrate: 60,
};

/** Ниже AUTO_THRESHOLD — `auto`; 50…79 — `auto-review`; ≥ 80 — `stop` (spec 051). */
export const AUTO_THRESHOLD = 50;

/** Порог STOP-решения: max risk задачи ≥ 80 → STOP к человеку (spec 051). */
export const HUMAN_THRESHOLD = 80;

/**
 * Инференс actions по тексту задачи. Паттерны намеренно «командные»
 * (`git push`, `rm -rf`), а не словарные: фраза «push не выполняется» — это
 * ограничение задачи, а не действие, и риск ею поднимать нельзя. Явное поле
 * `actions:` в задаче всегда имеет приоритет над инференсом.
 */
const ACTION_PATTERNS = [
  { action: 'rm -rf', re: /rm\s+-rf/i },
  { action: 'git push', re: /git\s+push/i },
  { action: 'rm', re: /\brm\s+[-\w.*/]/i },
  { action: 'migrate', re: /\bmigrat|\bmigration|миграц/i },
  { action: 'git commit', re: /git\s+(commit|add)\b/i },
  { action: 'npm test', re: /npm\s+run\s+(test|typecheck|build)|test:run|test:e2e|playwright|vitest/i },
  { action: 'edit', re: /\bedit\b|\bwrite\b|правк[аиу]|обнов(ить|ление)|\.mjs\b|\.ts\b|\.md\b/i },
  { action: 'read', re: /\bread\b|read-only|recon|чтение|инспек/i },
];

/** Инференс actions по тексту; пусто → `read` (минимальный риск, но не ноль). */
export function inferActions(text) {
  const source = String(text ?? '');
  const found = [];
  for (const { action, re } of ACTION_PATTERNS) {
    if (re.test(source)) found.push(action);
  }
  return found.length === 0 ? ['read'] : found;
}

/** Вес одного action; неизвестный action считается как `read`. */
export function actionRisk(action) {
  const key = String(action ?? '').trim().toLowerCase();
  return typeof ACTION_RISK[key] === 'number' ? ACTION_RISK[key] : ACTION_RISK.read;
}

/**
 * Risk задачи = максимум по actions: «преобладающий» трактуется как худшее
 * действие (spec 051). Среднее занижало бы риск — одна `rm -rf` в задаче с
 * десятком чтений всё равно необратима.
 */
export function riskScoreOf(actions) {
  const list = Array.isArray(actions) && actions.length > 0 ? actions : ['read'];
  return list.reduce((max, action) => Math.max(max, actionRisk(action)), 0);
}

/** Классификация риска: `auto` | `auto-review` | `stop`. */
export function classifyRisk(score) {
  if (score >= HUMAN_THRESHOLD) return 'stop';
  if (score >= AUTO_THRESHOLD) return 'auto-review';
  return 'auto';
}

/**
 * Провалидировать DAG плана: зависимости ссылаются на существующие id и не
 * образуют циклов. Возвращает `{valid, problems}`.
 */
export function validateDag(tasks) {
  const problems = [];
  const ids = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    if (!task.id) problems.push('задача без id');
    for (const dep of task.dependencies) {
      if (!ids.has(dep)) problems.push(`${task.id}: неизвестная зависимость ${dep}`);
      if (dep === task.id) problems.push(`${task.id}: зависимость на себя`);
    }
  }
  const state = new Map();
  const visit = (id, stack) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'active') {
      problems.push(`цикл: ${[...stack, id].join(' → ')}`);
      return;
    }
    state.set(id, 'active');
    const task = tasks.find((t) => t.id === id);
    for (const dep of task?.dependencies ?? []) visit(dep, [...stack, id]);
    state.set(id, 'done');
  };
  for (const task of tasks) visit(task.id, []);
  return { valid: problems.length === 0, problems };
}

/**
 * Условие авто-approve STOP B (spec 051): DAG валиден, задачи есть и
 * max risk < AUTO_THRESHOLD. Лог-строка при auto:
 * `auto-approve STOP B | DAG valid | max-risk:N`.
 */
export function stopBDecision(maxRiskScore, dag, tasksCount) {
  const hasTasks = Number(tasksCount) > 0;
  const auto = dag.valid === true && hasTasks && maxRiskScore < AUTO_THRESHOLD;
  return {
    auto,
    log: `auto-approve STOP B | DAG valid | max-risk:${maxRiskScore}`,
    reason: auto
      ? `DAG валиден, задач ${tasksCount}, max-risk ${maxRiskScore} < ${AUTO_THRESHOLD}`
      : !hasTasks
        ? 'в декомпозиции спеки нет задач'
        : !dag.valid
          ? `DAG невалиден: ${dag.problems.join('; ')}`
          : `max-risk ${maxRiskScore} ≥ ${AUTO_THRESHOLD}`,
  };
}

/** План риск-скоринга: задачи с `risk_score` + максимум + решения (STOP B). */
export function scorePlanTasks(tasks) {
  const scored = tasks.map((task) => {
    const risk = riskScoreOf(task.actions);
    return { ...task, risk_score: risk, risk_decision: classifyRisk(risk) };
  });
  const maxRiskScore = scored.reduce((max, task) => Math.max(max, task.risk_score), 0);
  const dag = validateDag(scored);
  return {
    tasks: scored,
    maxRiskScore,
    riskDecision: classifyRisk(maxRiskScore),
    dag,
    stopB: stopBDecision(maxRiskScore, dag, scored.length),
  };
}

/* ------------------------------------------------- бюджет прогона (spec 051) */

/** Hard-кап по умолчанию (USD). */
export const DEFAULT_MAX_COST_USD = 5.0;

/** Soft-кап по умолчанию (USD): он же линия warn 50% от hard-капа. */
export const DEFAULT_SOFT_CAP_USD = 2.5;

/** Источник стоимости по умолчанию: история MAS-прогонов. */
export const DEFAULT_COST_SOURCE = path.join('.project', 'mas-runs.json');

/** Оценка цены: ~$0.30 за 1M токенов (blended-оценка, не тариф провайдера). */
export const USD_PER_1K_TOKENS = 0.0003;

/** Fallback-оценка одного LLM-вызова, когда `tokens` неизвестны (spec 051). */
export const TOKENS_PER_LLM_CALL = 500;

/** Доли hard-капа: 50% — warn, 80% — downgrade pro→flash, 100% — kill (exit 3). */
export const BUDGET_WARN_RATIO = 0.5;
export const BUDGET_DOWNGRADE_RATIO = 0.8;
export const BUDGET_KILL_RATIO = 1.0;

/**
 * Оценка числа LLM-вызовов последнего прогона для fallback-бюджета: явные счётчики
 * (`tokens.calls` / `llmCalls` / `report.llmCalls`) → длина `tasks[]` → сводка
 * `tasks.completed + tasks.failed + tasks.cancelled` (в истории репозитория
 * `tasks` — именно сводка-объект, а не массив).
 */
export function countLlmCalls(record) {
  if (record === null || typeof record !== 'object') return 0;
  const candidates = [record?.tokens?.calls, record?.llmCalls, record?.report?.llmCalls];
  for (const value of candidates) {
    if (Number.isFinite(Number(value))) return Number(value);
  }
  const tasks = record.tasks;
  if (Array.isArray(tasks)) return tasks.length;
  if (tasks !== null && typeof tasks === 'object') {
    const total =
      (Number(tasks.completed) || 0) + (Number(tasks.failed) || 0) + (Number(tasks.cancelled) || 0);
    if (total > 0) return total;
  }
  return 0;
}

/**
 * Прочитать стоимость последнего прогона из cost-source: поле `tokens.total`
 * последней записи `runs[]`. `tokens: null` (сегодня так у всех 18 записей
 * `.project/mas-runs.json`) → `estimated: true` и fallback по числу LLM-вызовов
 * × TOKENS_PER_LLM_CALL (см. countLlmCalls; нечитаемый источник — тоже
 * `estimated: true` с нулём).
 * @param {string} costSource - путь (абсолютный или от корня репозитория).
 */
export async function readCostSource(costSource) {
  const abs = path.isAbsolute(costSource) ? costSource : path.join(REPO_ROOT, costSource);
  const relPath = relativePosix(abs);
  const empty = {
    path: abs,
    relPath,
    ok: false,
    runs: 0,
    spec: null,
    tokens: null,
    llmCalls: null,
    estimated: true,
    reason: null,
  };
  let raw;
  try {
    raw = await fsp.readFile(abs, 'utf8');
  } catch (error) {
    return { ...empty, reason: `не читается (${errorCodeOf(error)})` };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...empty, reason: 'не разбирается как JSON' };
  }
  const runs = Array.isArray(parsed?.runs) ? parsed.runs : Array.isArray(parsed) ? parsed : [];
  const last = runs.length > 0 ? runs[runs.length - 1] : null;
  const totalRaw = last?.tokens?.total;
  const total = Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : null;
  return {
    path: abs,
    relPath,
    ok: true,
    runs: runs.length,
    spec: last?.spec ?? null,
    tokens: total,
    llmCalls: countLlmCalls(last),
    estimated: total === null,
    reason: total === null ? 'tokens: null — оценка по числу LLM-вызовов' : null,
  };
}

/** Округлить USD до 6 знаков (оценки малы, 4 знаков не хватает). */
function roundUsd(value) {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Свести бюджет: потрачено (оценка), остаток и статус
 * (`ok` | `warn` | `downgrade` | `kill`). Доли считаются от hard-капа; soft-кап
 * добавляет независимую линию warn. Побочных эффектов нет.
 * @param {{costSource: object, maxCostUsd: number, softCapUsd: number, specId: string}} input
 */
export function resolveBudget(input) {
  const maxCostUsd = Number(input.maxCostUsd) > 0 ? Number(input.maxCostUsd) : DEFAULT_MAX_COST_USD;
  const softCapUsd =
    Number.isFinite(Number(input.softCapUsd)) && Number(input.softCapUsd) >= 0
      ? Number(input.softCapUsd)
      : DEFAULT_SOFT_CAP_USD;
  const source = input.costSource;
  const estimated = source.tokens === null;
  const tokens = estimated ? (Number(source.llmCalls) || 0) * TOKENS_PER_LLM_CALL : Number(source.tokens);
  const spentUsd = roundUsd((tokens / 1000) * USD_PER_1K_TOKENS);
  const remainingUsd = roundUsd(Math.max(0, maxCostUsd - spentUsd));
  const ratio = maxCostUsd > 0 ? spentUsd / maxCostUsd : 0;

  let status = 'ok';
  if (ratio >= BUDGET_KILL_RATIO) status = 'kill';
  else if (ratio >= BUDGET_DOWNGRADE_RATIO) status = 'downgrade';
  else if (ratio >= BUDGET_WARN_RATIO || (softCapUsd > 0 && spentUsd >= softCapUsd)) status = 'warn';

  const warnings = [];
  if (estimated) {
    warnings.push(
      `[budget: tokens неизвестны — оценка ${tokens} токенов по ${Number(source.llmCalls) || 0} LLM-вызовам × ${TOKENS_PER_LLM_CALL}]`,
    );
  }
  const percent = Math.round(ratio * 100);
  if (status === 'warn') {
    warnings.push(`[budget: ${percent}% hard-капа израсходовано — warn]`);
  }
  if (status === 'downgrade') {
    warnings.push(`[budget: ${percent}% hard-капа — downgrade pro → flash]`);
  }
  if (status === 'kill') {
    warnings.push(`[budget: ${percent}% hard-капа — kill, прогон не стартует (exit 3)]`);
  }

  return {
    specId: input.specId,
    status,
    spentUsd,
    remainingUsd,
    ratio,
    percent,
    tokens,
    estimated,
    llmCalls: source.llmCalls ?? null,
    maxCostUsd,
    softCapUsd,
    downgrade: status === 'downgrade' || status === 'kill' ? 'pro → flash' : null,
    source: {
      path: source.relPath,
      ok: source.ok,
      runs: source.runs,
      spec: source.spec,
      reason: source.reason,
    },
    warnings,
  };
}

/** Evidence бюджета: `.project/drafts/spec-<id>-budget.json`. */
export async function writeBudgetEvidence(root, budget) {
  const file = path.join(root, '.project', 'drafts', `spec-${budget.specId}-budget.json`);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(
    file,
    `${JSON.stringify(
      {
        tool: 'run-spec.mjs',
        spec: budget.specId,
        generatedAt: new Date().toISOString(),
        status: budget.status,
        spent: budget.spentUsd,
        remaining: budget.remainingUsd,
        ratio: budget.ratio,
        percent: budget.percent,
        tokens: budget.tokens,
        estimated: budget.estimated,
        llmCalls: budget.llmCalls,
        caps: { maxCostUsd: budget.maxCostUsd, softCapUsd: budget.softCapUsd },
        downgrade: budget.downgrade,
        costSource: budget.source,
        warnings: budget.warnings,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  return file;
}

/** Дописать запись в `docs/memory/alerts.md` (append-only, LF, каталог создаётся). */
export async function appendAlert(root, entry) {
  const file = path.join(root, 'docs', 'memory', 'alerts.md');
  let current = '';
  try {
    current = await fsp.readFile(file, 'utf8');
  } catch {
    current = '';
  }
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const glue = current === '' || current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  const block = `## ${entry.date} | ${entry.kind} | ${entry.title}\n\n${entry.body}\n`;
  await fsp.appendFile(file, glue + block, 'utf8');
  return file;
}

const DEFAULTS = {
  dryRun: false,
  json: false,
  profile: 'mas',
  workspace: REPO_ROOT,
  timeoutMs: 30 * 60 * 1000,
  specId: null,
  maxCostUsd: DEFAULT_MAX_COST_USD,
  softCapUsd: DEFAULT_SOFT_CAP_USD,
  costSource: DEFAULT_COST_SOURCE,
};

const USAGE = [
  'usage: node .project/scripts/run-spec.mjs <spec-id> [--dry-run|--live] [--json]',
  '       [--profile <name>] [--workspace <dir>] [--timeout-ms <ms>]',
  '       [--max-cost-usd <usd>] [--soft-cap-usd <usd>] [--cost-source <path>]',
  '',
  'MAS-прогон по спеке через CLI-путь к dsh-agent-teams (spec 033a, вердикт t0: PATH: H2).',
  'Риск-скоринг задач и бюджет прогона — spec 051.',
  '',
  'Аргументы:',
  '  <spec-id>            идентификатор спеки в .project/specs (например 033a)',
  '',
  'Флаги:',
  '  --dry-run            только отчёт: команда не запускается, шаблоны не копируются,',
  '                       .project/mas-runs.json не пишется',
  '  --live               алиас не-dry-run: явный реальный прогон (обратное к --dry-run)',
  '  --json               печатать отчёт в виде JSON',
  '  --profile <name>     DSH-профиль с плагином agent-teams (по умолчанию mas)',
  '  --workspace <dir>    рабочая директория прогона (по умолчанию корень репозитория)',
  '  --timeout-ms <ms>    предел ожидания реального прогона (по умолчанию 1800000)',
  '  --max-cost-usd <usd> hard-кап стоимости прогона (по умолчанию 5.00): 100% → kill, exit 3',
  '  --soft-cap-usd <usd> soft-кап (по умолчанию 2.50): достигнут → warn',
  '  --cost-source <path> источник стоимости последнего прогона',
  '                       (по умолчанию .project/mas-runs.json, поле tokens.total)',
  '  -h, --help           эта справка',
  '',
  'Перед реальным прогоном templates/mas/{TASK,SESSION}.md копируются в',
  '<workspace>/.agent-teams/<teamId>/, а файл спеки — в <workspace>/.project/specs/.',
].join('\n');

// ---------------------------------------------------------------------------
// Разбор аргументов
// ---------------------------------------------------------------------------

/**
 * Разбор argv. Возвращает `{ ok: true, options }` либо `{ ok: false, error, exitCode }`.
 * @param {string[]} argv - аргументы без `node` и имени скрипта.
 */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [flag, inline] = arg.startsWith('--') ? arg.split('=', 2) : [arg, undefined];
    const takeValue = () => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };
    if (arg === '-h' || flag === '--help') return { ok: false, error: 'help', exitCode: 0 };
    if (!arg.startsWith('--')) {
      if (options.specId !== null) {
        return { ok: false, error: `лишний аргумент: ${arg}`, exitCode: 2 };
      }
      options.specId = arg;
      continue;
    }
    switch (flag) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--live':
        // Алиас не-dry-run (spec 035): явный реальный прогон.
        options.dryRun = false;
        break;
      case '--json':
        options.json = true;
        break;
      case '--profile':
      case '--workspace': {
        const raw = takeValue();
        if (raw === undefined || raw.trim() === '') {
          return { ok: false, error: `флаг ${flag} требует значение`, exitCode: 2 };
        }
        if (flag === '--profile') options.profile = raw.trim();
        else options.workspace = path.resolve(raw.trim());
        break;
      }
      case '--timeout-ms': {
        const raw = takeValue();
        const value = Number(raw);
        if (raw === undefined || !Number.isFinite(value) || value <= 0) {
          return { ok: false, error: 'флаг --timeout-ms требует положительное число', exitCode: 2 };
        }
        options.timeoutMs = value;
        break;
      }
      case '--max-cost-usd':
      case '--soft-cap-usd': {
        const raw = takeValue();
        const value = Number(raw);
        const positive = flag === '--max-cost-usd' ? value > 0 : value >= 0;
        if (raw === undefined || !Number.isFinite(value) || !positive) {
          return {
            ok: false,
            error:
              flag === '--max-cost-usd'
                ? 'флаг --max-cost-usd требует положительное число'
                : 'флаг --soft-cap-usd требует неотрицательное число',
            exitCode: 2,
          };
        }
        if (flag === '--max-cost-usd') options.maxCostUsd = value;
        else options.softCapUsd = value;
        break;
      }
      case '--cost-source': {
        const raw = takeValue();
        if (raw === undefined || raw.trim() === '') {
          return { ok: false, error: 'флаг --cost-source требует значение', exitCode: 2 };
        }
        options.costSource = raw.trim();
        break;
      }
      default:
        return { ok: false, error: `неизвестный флаг: ${flag}`, exitCode: 2 };
    }
  }
  if (options.specId === null || options.specId.trim() === '') {
    return { ok: false, error: 'не задан spec-id', exitCode: 2 };
  }
  options.specId = options.specId.trim();
  return { ok: true, options };
}

// ---------------------------------------------------------------------------
// Спека
// ---------------------------------------------------------------------------

/**
 * Найти файл спеки по идентификатору. Точное `<id>.md` выигрывает у префиксного
 * совпадения; несколько префиксных совпадений — ошибка ввода (неоднозначность).
 * @param {string} specsDir - каталог спек.
 * @param {string} specIdRaw - `<id>` (можно с `.md`).
 */
export async function resolveSpec(specsDir, specIdRaw) {
  const id = specIdRaw.replace(/\.md$/i, '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    return { ok: false, error: `недопустимый spec-id: ${specIdRaw}`, exitCode: 2 };
  }
  let entries;
  try {
    entries = await fsp.readdir(specsDir, { withFileTypes: true });
  } catch (error) {
    return { ok: false, error: `каталог спек недоступен: ${specsDir} (${errorCodeOf(error)})`, exitCode: 1 };
  }
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase() !== 'readme.md');
  const exact = files.find((name) => name === `${id}.md`);
  let picked = exact;
  if (picked === undefined) {
    const prefixed = files.filter((name) => name.startsWith(`${id}-`));
    if (prefixed.length === 0) {
      return {
        ok: false,
        error: `спека "${id}" не найдена в ${specsDir}`,
        hint: `доступны: ${files.map((name) => name.replace(/\.md$/, '')).join(', ')}`,
        exitCode: 2,
      };
    }
    if (prefixed.length > 1) {
      return {
        ok: false,
        error: `spec-id "${id}" неоднозначен: ${prefixed.join(', ')}`,
        hint: 'укажите более длинный идентификатор',
        exitCode: 2,
      };
    }
    picked = prefixed[0];
  }
  const specPath = path.join(specsDir, picked);
  let raw;
  try {
    raw = await fsp.readFile(specPath, 'utf8');
  } catch (error) {
    return { ok: false, error: `спека не читается: ${picked} (${errorCodeOf(error)})`, exitCode: 1 };
  }
  const parsed = parseSpec(raw);
  return {
    ok: true,
    spec: {
      specId: id,
      file: picked,
      slug: parsed.slug,
      fmId: parsed.fmId,
      type: parsed.type,
      status: parsed.status,
      title: parsed.title,
      goals: parsed.goals,
      // Задачи «## Декомпозиции» обязаны доехать до плана: без этого поля
      // риск-скоринг видел пустой список и STOP B всегда оставался ручным.
      tasks: parsed.tasks,
      path: specPath,
      relativePath: path.relative(REPO_ROOT, specPath).split(path.sep).join('/'),
      bytes: Buffer.byteLength(raw, 'utf8'),
    },
  };
}

/**
 * Материализовать файл спеки внутри workspace (spec 035, вариант A): вложенный
 * агент запускается с `cwd = --workspace`, поэтому относительный путь спеки должен
 * существовать именно там. Копия идемпотентна (перезапись байтами исходника);
 * если целевой путь совпадает с исходным (workspace = корень репо) — записи нет.
 * @param {string} workspace - рабочая директория прогона.
 * @param {{file: string, path: string, relativePath: string, bytes: number}} spec
 * @returns {Promise<{ok: boolean, path: string, relativePath: string, copied: boolean, bytes: number|null, error: string|null}>}
 */
export async function materializeSpec(workspace, spec) {
  const target = path.join(workspace, WORKSPACE_SPECS_DIR, spec.file);
  const relativePath = path.relative(workspace, target).split(path.sep).join('/');
  if (path.resolve(target) === path.resolve(spec.path)) {
    return { ok: true, path: target, relativePath, copied: false, bytes: spec.bytes, error: null };
  }
  try {
    const bytes = await fsp.readFile(spec.path);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, bytes);
    const written = await fsp.readFile(target);
    if (!written.equals(bytes)) {
      return {
        ok: false,
        path: target,
        relativePath,
        copied: false,
        bytes: bytes.length,
        error: `копия спеки ${target} не совпала с исходником побайтово`,
      };
    }
    return { ok: true, path: target, relativePath, copied: true, bytes: bytes.length, error: null };
  } catch (error) {
    return {
      ok: false,
      path: target,
      relativePath,
      copied: false,
      bytes: null,
      error: `спека не материализована в workspace: ${target} (${errorCodeOf(error)})`,
    };
  }
}

/**
 * Разбор секции `## Декомпозиция` (spec 051): пункты нумерованного списка →
 * `{id, subject, assignee, dependencies, actions}`. Поддерживаются оба формата
 * репозитория: сегменты в бэктиках (`` `id: t1` `subject: …` ``, спеки 049/051)
 * и свободный текст `id: t1, subject: …, assignee: builder, dependencies: []`
 * (спеки 040/042). `actions` берётся из явного поля `actions:`; если его нет —
 * выводится инференсом по тексту задачи (см. inferActions).
 * @param {string[]} lines - строки спеки (уже разбитые по переводам строки).
 */
export function parseDecompositionTasks(lines) {
  const section = [];
  let inside = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      // `\b` после кириллицы в JS не матчится («я» — не \w): секция искалась бы
      // вечно пустой (класс дефекта из docs/memory/alerts.md 2026-10-01).
      inside = /^##\s+Декомпозиция(?=\s|$)/.test(line);
      continue;
    }
    if (inside) section.push(line);
  }

  const items = [];
  let current = null;
  let closed = false;
  for (const line of section) {
    if (!closed && /^\s*\d+\.\s/.test(line)) {
      if (current !== null) items.push(current);
      current = line.replace(/^\s*\d+\.\s/, '').trim();
      continue;
    }
    // Продолжением считается только строка с отступом: иначе буллет-блок после
    // списка («Write-скоупы», «Оговорки») приклеивался бы к последней задаче и
    // ломал бы её dependencies (проверено на spec 040).
    if (!closed && current !== null && /^[ \t]+\S/.test(line)) {
      current += ` ${line.trim()}`;
      continue;
    }
    if (line.trim() !== '') {
      // Проза ДО списка (вводная строка секции) список не закрывает: закрытие
      // наступает только после того, как список уже начался.
      const started = current !== null || items.length > 0;
      if (current !== null) items.push(current);
      current = null;
      if (started) closed = true;
    }
  }
  if (current !== null) items.push(current);

  const tasks = [];
  for (const item of items) {
    const fields = {};
    const ticks = [...item.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    const segments =
      ticks.length > 0 && ticks.some((tick) => /^\s*id\s*:/.test(tick))
        ? ticks
        : item.split(/,(?=\s*[A-Za-zа-яА-Я_]+\s*:)/);
    for (const segment of segments) {
      const match = /^\s*([A-Za-zа-яА-Я_]+)\s*:\s*(.*)$/.exec(String(segment).trim());
      if (match === null) continue;
      fields[match[1].toLowerCase()] = match[2].trim().replace(/[`;]+$/, '').trim();
    }
    if (fields.id === undefined || fields.id === '') continue;
    const actions =
      fields.actions === undefined || fields.actions === ''
        ? inferActions(`${fields.subject ?? ''} ${fields.id}`)
        : fields.actions
            .split(',')
            .map((action) => action.trim())
            .filter(Boolean);
    tasks.push({
      id: fields.id,
      subject: fields.subject ?? '',
      assignee: fields.assignee ?? null,
      dependencies: (fields.dependencies ?? '')
        .replace(/[[\]]/g, ' ')
        .split(',')
        .map((dep) => dep.trim())
        .filter((dep) => dep !== ''),
      actions,
    });
  }
  return tasks;
}

/**
 * Разбор markdown-спеки: front-matter, заголовок первого уровня, список целей из
 * секции «## Цель», задачи из «## Декомпозиция». Зависимостей нет, парсер
 * намеренно минимальный.
 * @param {string} raw - содержимое файла.
 */
export function parseSpec(raw) {
  const lines = raw.split(/\r?\n/);
  const fm = {};
  if (lines[0] !== undefined && lines[0].trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === '---') break;
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (match !== null) fm[match[1]] = match[2].trim();
    }
  }
  let title = '';
  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      break;
    }
  }
  const goals = [];
  let inGoals = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      // См. parseDecompositionTasks: `\b` после кириллицы не работает, из-за чего
      // цели спеки не попадали в задание MAS (дефект найден при spec 051).
      inGoals = /^##\s+Цель(?=\s|$)/.test(line);
      continue;
    }
    if (!inGoals) continue;
    const match = /^\s*(?:\d+\.|[-*])\s+(.*)$/.exec(line);
    if (match !== null && match[1].trim() !== '') goals.push(match[1].trim());
  }
  const tasks = parseDecompositionTasks(lines);
  return {
    fmId: fm['id'] ?? null,
    slug: fm['slug'] ?? null,
    type: fm['type'] ?? null,
    status: fm['status'] ?? null,
    title,
    goals,
    tasks,
  };
}

/**
 * Идентификатор каталога команды: `spec-<basename файла>` (например
 * `spec-033a-mas-autonomy-spike` — та же конвенция, что у уже существующих
 * команд в `.agent-teams/`). Это лишь подсказка: имя команды выбирает
 * модель-капитан, поэтому сбор результата умеет искать команду по диску
 * (см. collectTeam).
 * @param {{specId: string, slug: string|null, file: string}} spec
 */
export function teamIdFor(spec) {
  const base = spec.file.replace(/\.md$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-');
  return sanitizeKey(`spec-${base}`);
}

/** Ключ каталога в конвенции плагина (`sanitizeKey` из lib/state.js). */
export function sanitizeKey(name) {
  return String(name).trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '') || 'team';
}

/**
 * Текст задачи для one-shot прогона: ведущий `/agent-teams` + цель из спеки.
 * Детерминирован (никаких вызовов модели здесь) и ограничен по длине.
 * `spec.relativePath` — путь спеки, существующий относительно cwd вложенного
 * агента (= `--workspace`), см. materializeSpec (spec 035).
 * @param {{specId: string, slug: string|null, title: string, goals: string[], relativePath: string}} spec
 * @param {string} teamId - ожидаемое имя команды.
 */
export function buildTaskText(spec, teamId) {
  const goals = spec.goals.slice(0, 6).map((goal) => goal.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const title = spec.title.replace(/\s+/g, ' ').trim();
  const head = title === ''
    ? `Спека ${spec.specId}${spec.slug === null ? '' : ` (${spec.slug})`}.`
    : title.includes(spec.specId)
      ? `${title}.`
      : `Спека ${spec.specId}${spec.slug === null ? '' : ` (${spec.slug})`}: ${title}.`;
  const body = goals.length === 0 ? '' : ` Цели: ${goals.join('; ')}.`;
  const tail = ` Спека: ${spec.relativePath}. Ожидаемое имя команды: ${teamId}.`;
  const text = `${ACTIVATION_PREFIX} ${head}${body}${tail}`;
  return text.length <= 1500 ? text : `${text.slice(0, 1497)}...`;
}

// ---------------------------------------------------------------------------
// DEEPSEEK_API_KEY: источник (fix alert 2026-09-30, process gap)
// ---------------------------------------------------------------------------

/** Имя переменной окружения, которую ждёт дочерний процесс dsh. */
const API_KEY_VAR = 'DEEPSEEK_API_KEY';

/** Область системного окружения для чтения ключа на Windows. */
const API_KEY_SCOPE = 'User';

/** Подсказка «как выставить ключ в текущей сессии» (одна строка, копируется целиком). */
export const API_KEY_EXPORT_HINT = `$env:${API_KEY_VAR} = [Environment]::GetEnvironmentVariable('${API_KEY_VAR}','${API_KEY_SCOPE}')`;

/**
 * Прочитать DEEPSEEK_API_KEY из User-scope (только Windows) через PowerShell.
 * Аргументы передаются массивом — без shell-интерполяции. Любая ошибка или
 * таймаут → `{ key: null }` (проверка preflight сама покажет причину).
 * @returns {{key: string|null}}
 */
export function resolveApiKeyFromSystem() {
  if (process.platform !== 'win32') return { key: null };
  try {
    const res = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-Command', `[Environment]::GetEnvironmentVariable('${API_KEY_VAR}','${API_KEY_SCOPE}')`],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    );
    const raw = (res.stdout ?? '').trim();
    if (res.status === 0 && raw !== '') return { key: raw };
  } catch {
    /* fall through: ключ считается отсутствующим */
  }
  return { key: null };
}

/**
 * Нормализовать результат чтения ключа: `{ key, source }`, где
 * `source: 'env' | 'user-scope' | 'missing'`. Побочных эффектов нет — значение
 * уже прочитано (env имеет приоритет над системным окружением).
 * @param {{key: string|null|undefined}} [entry] - результат resolveApiKeyFromSystem().
 * @returns {{key: string|null, source: 'env'|'user-scope'|'missing'}}
 */
export function resolveApiKey(entry) {
  const envKey = process.env[API_KEY_VAR];
  if (typeof envKey === 'string' && envKey.trim() !== '') return { key: envKey.trim(), source: 'env' };
  const raw = typeof entry?.key === 'string' ? entry.key.trim() : '';
  if (raw !== '') return { key: raw, source: 'user-scope' };
  return { key: null, source: 'missing' };
}

// ---------------------------------------------------------------------------
// Precondition пути H2
// ---------------------------------------------------------------------------

/** Домашний каталог DSH (совпадает с env `DSH_HOME`). */
export function dshHome() {
  return process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : path.join(os.homedir(), '.dsh');
}

/** Каталог профиля: `$DSH_HOME/profiles/<name>`. */
export function profileDirOf(profile) {
  return path.join(dshHome(), 'profiles', profile);
}

/**
 * Найти исполняемый вход `dsh`: сначала `node <global>/node_modules/@deepseek-ai/dsh/lib/bin.js`
 * (детерминированно и без `.cmd`/shell-обёрток Windows), затем PATH.
 * @returns {{command: string, argvPrefix: string[], label: string}|null}
 */
export function locateDsh() {
  const binRel = path.join('node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  const roots = [];
  if (process.platform === 'win32' && process.env.APPDATA) roots.push(path.join(process.env.APPDATA, 'npm'));
  if (process.env.npm_config_prefix) roots.push(process.env.npm_config_prefix);
  roots.push(path.join(os.homedir(), '.npm-global'));
  roots.push('/usr/local');
  roots.push('/usr');
  for (const root of roots) {
    const bin = path.join(root, binRel);
    if (existsSync(bin)) {
      return { command: process.execPath, argvPrefix: [bin], label: `node ${bin}` };
    }
  }
  const onPath = findOnPath('dsh');
  if (onPath !== null) return { command: onPath, argvPrefix: [], label: onPath };
  return null;
}

/** Поиск файла в PATH (с учётом PATHEXT на Windows). */
export function findOnPath(name) {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter((dir) => dir !== '');
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((ext) => ext !== '')
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Проверить precondition пути H2. Ничего не меняет: только чтение каталогов и
 * один прогон `dsh --version` (он не создаёт команд и не поднимает сервер).
 * @param {{profile: string, workspace: string}} input
 * @param {{key: string|null|undefined}} [apiKeyEntry] - уже прочитанное системное
 *   значение (resolveApiKeyFromSystem), чтобы preflight не дёргал PowerShell дважды.
 * @returns {{checks: object[], ok: boolean, dsh: object|null, apiKey: object}}
 */
export function preflight(input, apiKeyEntry) {
  const checks = [];
  const apiKey =
    resolveApiKey(apiKeyEntry);
  const dsh = locateDsh();
  if (dsh === null) {
    checks.push({
      name: 'dsh CLI',
      ok: false,
      detail: 'не найден: ни global npm-каталог, ни PATH',
      fix: 'установить @deepseek-ai/dsh (npm i -g @deepseek-ai/dsh)',
    });
  } else {
    const probe = spawnSync(dsh.command, [...dsh.argvPrefix, '--version'], {
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    });
    const version = (probe.stdout ?? '').trim();
    const ok = probe.status === 0 && version !== '';
    checks.push({
      name: 'dsh CLI',
      ok,
      detail: ok
        ? `${dsh.label} --version → ${version}`
        : `запуск ${dsh.label} --version не удался (status=${probe.status}, error=${probe.error?.code ?? 'none'})`,
      fix: 'проверить установку/вызов dsh вручную',
    });
  }

  const profileDir = profileDirOf(input.profile);
  const profileExists = existsSync(profileDir);
  checks.push({
    name: `профиль ${input.profile}`,
    ok: profileExists,
    detail: profileExists ? profileDir : `нет каталога ${profileDir}`,
    fix: `dsh --profile ${input.profile} --from-default-profile headless`,
  });

  let pluginResolved = null;
  let pluginDetail = '';
  if (profileExists) {
    try {
      const require = createRequire(path.join(profileDir, 'package.json'));
      pluginResolved = require.resolve(PLUGIN_PACKAGE);
      pluginDetail = pluginResolved;
    } catch (error) {
      pluginDetail = `${PLUGIN_PACKAGE} не резолвится из профиля (${errorCodeOf(error)})`;
    }
  } else {
    pluginDetail = `профиль отсутствует — резолв ${PLUGIN_PACKAGE} невозможен`;
  }
  checks.push({
    name: `плагин ${PLUGIN_PACKAGE}`,
    ok: pluginResolved !== null,
    detail: pluginDetail,
    fix: `dsh plugin --profile ${input.profile} add ${PLUGIN_PACKAGE}`,
  });

  const workspaceExists = existsSync(input.workspace);
  checks.push({
    name: 'workspace',
    ok: workspaceExists,
    detail: workspaceExists ? input.workspace : `нет каталога ${input.workspace}`,
    fix: 'указать существующий --workspace',
  });

  const stateRoot = path.join(input.workspace, STATE_DIR_NAME);
  checks.push({
    name: `каталог состояния ${STATE_DIR_NAME}`,
    ok: true,
    optional: true,
    detail: existsSync(stateRoot) ? stateRoot : `${stateRoot} (будет создан плагином при прогоне)`,
    fix: null,
  });

  const missingTemplates = TEMPLATE_FILES.filter((name) => !existsSync(path.join(TEMPLATES_DIR, name)));
  checks.push({
    name: 'шаблоны templates/mas',
    ok: missingTemplates.length === 0,
    detail: missingTemplates.length === 0
      ? `${path.relative(REPO_ROOT, TEMPLATES_DIR).split(path.sep).join('/')}/${TEMPLATE_FILES.join(', ')}`
      : `нет файлов: ${missingTemplates.join(', ')} (каталог ${TEMPLATES_DIR})`,
    fix: 'восстановить templates/mas/{TASK,SESSION}.md (spec 033a, «Что делаем 3»)',
  });

  checks.push({
    name: API_KEY_VAR,
    ok: apiKey.source !== 'missing',
    detail:
      apiKey.source === 'env'
        ? 'из env'
        : apiKey.source === 'user-scope'
          ? 'из User-scope (Windows)'
          : `missing — выполнить: ${API_KEY_EXPORT_HINT}`,
    fix: apiKey.source === 'missing' ? API_KEY_EXPORT_HINT : null,
  });

  return { checks, ok: checks.every((check) => check.ok || check.optional === true), dsh, apiKey };
}

// ---------------------------------------------------------------------------
// Handoff-шаблоны (spec 033a, «Что делаем 3»)
// ---------------------------------------------------------------------------

/**
 * Скопировать `templates/mas/{TASK,SESSION}.md` в каталог команды
 * `<workspace>/.agent-teams/<teamId>/`. Идемпотентно: файлы-копии побайтово
 * равны шаблонам (перезапись теми же байтами), отсутствие шаблона — понятная
 * ошибка без частичной записи.
 * @param {string} workspace - рабочая директория прогона.
 * @param {string} teamId - id каталога команды.
 * @returns {Promise<{ok: boolean, dir: string, files: object[], missing: string[], error: string|null}>}
 */
export async function stageTemplates(workspace, teamId) {
  const dir = path.join(workspace, STATE_DIR_NAME, teamId);
  const sources = TEMPLATE_FILES.map((name) => ({ name, source: path.join(TEMPLATES_DIR, name) }));
  const missing = sources.filter((item) => !existsSync(item.source)).map((item) => item.source);
  if (missing.length > 0) {
    return {
      ok: false,
      dir,
      files: [],
      missing,
      error: `шаблон(ы) не найдены: ${missing.join(', ')} — ожидаются в ${TEMPLATES_DIR}`,
    };
  }
  await fsp.mkdir(dir, { recursive: true });
  const files = [];
  for (const item of sources) {
    const bytes = await fsp.readFile(item.source);
    const target = path.join(dir, item.name);
    await fsp.writeFile(target, bytes);
    const written = await fsp.readFile(target);
    const equal = written.equals(bytes);
    files.push({
      name: item.name,
      source: path.relative(REPO_ROOT, item.source).split(path.sep).join('/'),
      target,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex').slice(0, 16),
      lastByte: written.length === 0 ? null : written[written.length - 1],
      equal,
    });
    if (!equal) {
      return { ok: false, dir, files, missing: [], error: `копия ${target} не совпала с шаблоном побайтово` };
    }
  }
  return { ok: true, dir, files, missing: [], error: null };
}

// ---------------------------------------------------------------------------
// Сбор результата с диска (путь H3 — read-канал)
// ---------------------------------------------------------------------------

/** Прочитать `team.json` команды по подсказанному id. */
export async function readTeamHint(workspace, teamId) {
  const file = path.join(workspace, STATE_DIR_NAME, teamId, 'team.json');
  try {
    const team = JSON.parse(await fsp.readFile(file, 'utf8'));
    return { found: true, via: 'team-id', file, team };
  } catch {
    return { found: false, via: 'team-id', file, team: null };
  }
}

/**
 * Найти команду по диску: подсказанный id, затем самая свежая команда, созданная
 * не раньше `sinceMs` (имя команды выбирает модель, поэтому id — только подсказка).
 * @param {string} workspace
 * @param {string} teamId
 * @param {number} sinceMs - момент старта прогона (мс).
 */
export async function collectTeam(workspace, teamId, sinceMs) {
  const hint = await readTeamHint(workspace, teamId);
  if (hint.found) return { ...hint, inbox: await inboxFiles(workspace, teamId) };
  const root = path.join(workspace, STATE_DIR_NAME);
  let entries;
  try {
    entries = await fsp.readdir(root, { withFileTypes: true });
  } catch {
    return { found: false, via: 'scan', file: null, team: null, inbox: [], scanned: root };
  }
  let newest = null;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'archive' || entry.name.startsWith('.')) continue;
    const file = path.join(root, entry.name, 'team.json');
    let team;
    try {
      team = JSON.parse(await fsp.readFile(file, 'utf8'));
    } catch {
      continue;
    }
    const createdAt = Number.isFinite(team?.createdAt) ? team.createdAt : 0;
    if (createdAt < sinceMs - 5_000) continue;
    if (newest === null || createdAt > newest.createdAt) {
      newest = { found: true, via: 'scan', file, team, createdAt, dirName: entry.name };
    }
  }
  if (newest === null) return { found: false, via: 'scan', file: null, team: null, inbox: [], scanned: root };
  return { ...newest, inbox: await inboxFiles(workspace, newest.dirName) };
}

/** Список файлов входящих сообщений команды (`inbox/*.jsonl`). */
async function inboxFiles(workspace, teamId) {
  const dir = path.join(workspace, STATE_DIR_NAME, teamId, 'inbox');
  try {
    const names = await fsp.readdir(dir);
    return names.filter((name) => name.endsWith('.jsonl')).sort();
  } catch {
    return [];
  }
}

/** Краткая сводка состояния команды для отчёта. */
export function summarizeTeam(team) {
  const members = Array.isArray(team?.members) ? team.members : [];
  const tasks = Array.isArray(team?.tasks) ? team.tasks : [];
  return {
    id: team?.id ?? null,
    name: team?.name ?? null,
    phase: team?.phase ?? null,
    halted: team?.halted === true,
    members: members.map((member) => ({ name: member?.name ?? '', role: member?.role ?? null, status: member?.status ?? null })),
    tasks: tasks.map((task) => ({
      id: task?.id ?? '',
      subject: task?.subject ?? '',
      status: task?.status ?? null,
      assignee: task?.assignee ?? null,
      dependencies: Array.isArray(task?.dependencies) ? task.dependencies : [],
    })),
  };
}

// ---------------------------------------------------------------------------
// История прогонов
// ---------------------------------------------------------------------------

/**
 * Прочитать историю. Отсутствующий файл — пустая история; нечитаемый/битый файл —
 * ошибка (молча перезаписывать историю запрещено).
 * @param {string} historyPath
 */
export async function readHistory(historyPath) {
  let raw;
  try {
    raw = await fsp.readFile(historyPath, 'utf8');
  } catch (error) {
    if (errorCodeOf(error) === 'ENOENT') return { version: 1, runs: [] };
    throw new Error(`история не читается: ${historyPath} (${errorCodeOf(error)})`);
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new Error(`история ${historyPath} не разбирается как JSON — запись отменена, файл не изменён`);
  }
  if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.runs)) {
    throw new Error(`история ${historyPath} имеет неожидаемый формат (нужен объект с массивом runs) — запись отменена`);
  }
  return { version: Number.isSafeInteger(doc.version) ? doc.version : 1, runs: doc.runs };
}

/**
 * Добавить одну запись прогона. Запись атомарная (tmp + rename), предыдущие
 * записи сохраняются — повторный прогон файл не ломает.
 * @param {string} historyPath
 * @param {object} record - `{ spec, startedAt, finishedAt, status, report }`.
 */
export async function appendRunRecord(historyPath, record) {
  const doc = await readHistory(historyPath);
  doc.version = 1;
  doc.runs.push(record);
  const temporary = `${historyPath}.tmp-${process.pid}`;
  await fsp.mkdir(path.dirname(historyPath), { recursive: true });
  await fsp.writeFile(temporary, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  await fsp.rename(temporary, historyPath);
  return { path: historyPath, total: doc.runs.length };
}

// ---------------------------------------------------------------------------
// Прогон
// ---------------------------------------------------------------------------

/**
 * Полный сценарий. Никогда не бросает на ожидаемых состояниях: возвращает
 * `{ exitCode, report }` для печати и для тестов.
 * @param {object} options - разобранные опции (`parseArgs().options`).
 */
export async function runSpec(options) {
  const startedAtMs = Date.now();
  const report = {
    tool: 'run-spec',
    spec: options.specId,
    path: 'H2',
    pathDetail: `CLI one-shot: dsh --profile <p> "${ACTIVATION_PREFIX} <цель>"`,
    mode: options.dryRun ? 'dry-run' : 'run',
    profile: options.profile,
    workspace: options.workspace,
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: null,
    steps: [],
    precondition: [],
    plan: null,
    result: { status: 'failed', reason: null },
    history: null,
  };

  const resolved = await resolveSpec(SPECS_DIR, options.specId);
  if (!resolved.ok) {
    report.steps.push({ name: 'resolve-spec', status: 'failed', detail: resolved.error });
    report.result = { status: 'usage-error', reason: resolved.error, hint: resolved.hint ?? null };
    report.finishedAt = new Date().toISOString();
    return { exitCode: resolved.exitCode, report };
  }
  const spec = resolved.spec;
  report.spec = spec.specId;
  report.specFile = spec.relativePath;
  report.specTitle = spec.title;
  report.steps.push({
    name: 'resolve-spec',
    status: 'ok',
    detail: `${spec.relativePath} (${spec.bytes} Б, type=${spec.type ?? '—'}, status=${spec.status ?? '—'})`,
  });

  const teamId = teamIdFor(spec);
  // spec 035 (вариант A): cwd вложенного агента = workspace, поэтому спека
  // материализуется внутрь workspace, а в промпт идёт путь, существующий там.
  const workspaceSpecPath = path.join(options.workspace, WORKSPACE_SPECS_DIR, spec.file);
  const specPromptPath = path.relative(options.workspace, workspaceSpecPath).split(path.sep).join('/');
  const taskText = buildTaskText({ ...spec, relativePath: specPromptPath }, teamId);
  const apiKeyEntry = resolveApiKeyFromSystem();
  const pre =
    preflight({ profile: options.profile, workspace: options.workspace }, apiKeyEntry);
  report.precondition = pre.checks;
  report.steps.push({
    name: 'preflight',
    status: pre.ok ? 'ok' : 'failed',
    detail: pre.ok
      ? 'precondition пути H2 выполнено'
      : `не выполнено: ${pre.checks.filter((check) => !check.ok && check.optional !== true).map((check) => check.name).join(', ')}`,
  });

  const command = pre.dsh === null ? null : { command: pre.dsh.command, argv: [...pre.dsh.argvPrefix, '--profile', options.profile, taskText] };
  // Риск-скоринг задач плана (spec 051): risk_score по преобладающему action,
  // максимум по плану и готовое решение STOP B для Шага 3 скилла.
  const risk = scorePlanTasks(spec.tasks ?? []);
  report.plan = {
    teamIdHint: teamId,
    stateDir: path.join(options.workspace, STATE_DIR_NAME, teamId),
    specPathInWorkspace: workspaceSpecPath,
    specPromptPath,
    taskText,
    command,
    cwd: options.workspace,
    timeoutMs: options.timeoutMs,
    tasks: risk.tasks,
    maxRiskScore: risk.maxRiskScore,
    riskDecision: risk.riskDecision,
    dag: risk.dag,
    stopB: risk.stopB,
  };
  report.steps.push({ name: 'plan', status: 'ok', detail: command === null ? 'команда не построена: dsh не найден' : renderCommand(command) });
  report.steps.push({
    name: 'risk',
    status: risk.stopB.auto ? 'auto-approve' : 'stop',
    detail:
      `задач: ${risk.tasks.length}, max-risk: ${risk.maxRiskScore} (${risk.riskDecision}), DAG: ${risk.dag.valid ? 'valid' : 'invalid'}` +
      ` — ${risk.stopB.auto ? risk.stopB.log : `STOP B: ${risk.stopB.reason}`}`,
  });

  /** Дозаписать запись прогона в историю (единственная запись этого скрипта). */
  const recordHistory = async () => {
    try {
      const history = await appendRunRecord(HISTORY_PATH, toRecord(report, options));
      report.history = history;
      report.steps.push({ name: 'history', status: 'recorded', detail: `${HISTORY_PATH} (записей: ${history.total})` });
    } catch (error) {
      report.steps.push({ name: 'history', status: 'failed', detail: String(error.message) });
    }
  };

  /* Бюджет прогона (spec 051): читается всегда, side effects — только в прогоне. */
  const costSource = await readCostSource(options.costSource);
  const budget = resolveBudget({
    costSource,
    maxCostUsd: options.maxCostUsd,
    softCapUsd: options.softCapUsd,
    specId: spec.specId,
  });
  report.budget = budget;
  report.steps.push({
    name: 'budget',
    status: budget.status === 'ok' ? 'ok' : budget.status,
    detail:
      `источник ${costSource.relPath}${costSource.ok ? ` (записей: ${costSource.runs}, spec: ${costSource.spec ?? '—'})` : ` — ${costSource.reason}`}` +
      `; ${budget.estimated ? 'оценка' : 'факт'} ${budget.tokens} токенов ≈ $${budget.spentUsd}` +
      ` из $${budget.maxCostUsd} (${budget.percent}%) — ${budget.status}`,
  });
  for (const warning of budget.warnings) {
    report.steps.push({ name: 'budget-warn', status: 'warn', detail: warning });
  }
  if (!options.dryRun) {
    report.budgetEvidence = relativePosix(await writeBudgetEvidence(REPO_ROOT, budget));
    if (budget.status === 'kill') {
      await appendAlert(REPO_ROOT, {
        date: new Date().toISOString().slice(0, 10),
        kind: 'budget',
        title: `spec-${spec.specId}: kill по hard-капу (${budget.percent}% от $${budget.maxCostUsd})`,
        body:
          `Бюджет прогона исчерпан: ${budget.estimated ? 'оценка' : 'факт'} ${budget.tokens} токенов ≈ $${budget.spentUsd} ` +
          `при hard-капе $${budget.maxCostUsd} (soft $${budget.softCapUsd}), источник — ${costSource.relPath}. ` +
          `Прогон не стартовал, exit 3 (spec 051). Evidence: \`${report.budgetEvidence}\`. Не блокер для других спек; ` +
          `поднять кап — только решением капитана новым флагом \`--max-cost-usd\`.`,
      });
      report.result = {
        status: 'budget-exceeded',
        reason: `бюджет прогона исчерпан (${budget.percent}% hard-капа $${budget.maxCostUsd}) — kill, exit 3`,
      };
      report.finishedAt = new Date().toISOString();
      await recordHistory();
      return { exitCode: 3, report };
    }
  }

  if (options.dryRun) {
    report.steps.push({
      name: 'materialize-spec',
      status: 'skipped',
      detail: `dry-run: спека не копируется; план: ${spec.relativePath} → ${workspaceSpecPath} (путь в промпте: ${specPromptPath})`,
    });
  } else {
    const materialized = await materializeSpec(options.workspace, spec);
    report.specMaterialized = {
      source: spec.relativePath,
      target: materialized.path,
      relativePath: materialized.relativePath,
      copied: materialized.copied,
      bytes: materialized.bytes,
    };
    report.steps.push({
      name: 'materialize-spec',
      status: materialized.ok ? 'ok' : 'failed',
      detail: materialized.ok
        ? materialized.copied
          ? `${spec.relativePath} → ${materialized.path} (${materialized.bytes} Б, путь в промпте: ${materialized.relativePath})`
          : `workspace = корень репо: копирование не нужно, спека уже на месте (${materialized.relativePath})`
        : materialized.error,
    });
    if (!materialized.ok) {
      report.result = { status: 'failed', reason: materialized.error };
      report.finishedAt = new Date().toISOString();
      await recordHistory();
      return { exitCode: 1, report };
    }
  }

  if (options.dryRun) {
    report.steps.push({
      name: 'stage-templates',
      status: 'skipped',
      detail: `dry-run: копирование не выполняется; план: ${TEMPLATE_FILES.map((name) => `${relativePosix(path.join(TEMPLATES_DIR, name))} → ${path.join(report.plan.stateDir, name)}`).join('; ')}`,
    });
  } else {
    const staged = await stageTemplates(options.workspace, teamId);
    report.templates = {
      dir: staged.dir,
      source: relativePosix(TEMPLATES_DIR),
      files: staged.files.map((file) => ({
        name: file.name,
        source: file.source,
        target: file.target,
        bytes: file.bytes,
        sha256: file.sha256,
        lastByte: file.lastByte,
        equal: file.equal,
      })),
    };
    report.steps.push({
      name: 'stage-templates',
      status: staged.ok ? 'ok' : 'failed',
      detail: staged.ok
        ? staged.files
          .map((file) => `${file.source} → ${file.target} (${file.bytes} Б, sha256:${file.sha256}, байт-в-байт: ${file.equal})`)
          .join('; ')
        : staged.error,
    });
    if (!staged.ok) {
      report.result = { status: 'failed', reason: staged.error };
      report.finishedAt = new Date().toISOString();
      await recordHistory();
      return { exitCode: 1, report };
    }
  }

  if (!pre.ok) {
    report.steps.push({
      name: 'execute',
      status: options.dryRun ? 'skipped' : 'failed',
      detail: options.dryRun
        ? 'dry-run: precondition не выполнено, команда не запускалась'
        : 'реальный прогон не стартовал: precondition не выполнено',
    });
    report.steps.push({ name: 'collect', status: 'skipped', detail: options.dryRun ? 'dry-run' : 'прогон не стартовал' });
    if (options.dryRun) {
      report.steps.push({ name: 'history', status: 'skipped', detail: 'dry-run: .project/mas-runs.json не изменяется' });
      report.result = {
        status: 'dry-run',
        reason: 'side effects не выполнялись: команда не создана, .project/mas-runs.json не изменён',
        preconditionMissing: pre.checks.filter((check) => !check.ok && check.optional !== true).map((check) => check.name),
      };
      report.finishedAt = new Date().toISOString();
      return { exitCode: 0, report };
    }
    report.result = {
      status: 'precondition-missing',
      reason: `путь H2 недоступен: ${pre.checks.filter((check) => !check.ok && check.optional !== true).map((check) => `${check.name} (${check.fix})`).join('; ')}`,
    };
    report.finishedAt = new Date().toISOString();
    await recordHistory();
    return { exitCode: 3, report };
  }

  if (options.dryRun) {
    report.steps.push({ name: 'execute', status: 'skipped', detail: `dry-run: команда не запускалась (${renderCommand(command)})` });
    report.steps.push({ name: 'collect', status: 'skipped', detail: 'dry-run' });
    report.steps.push({ name: 'history', status: 'skipped', detail: 'dry-run: .project/mas-runs.json не изменяется' });
    report.result = {
      status: 'dry-run',
      reason: 'side effects не выполнялись: команда не создана, .project/mas-runs.json не изменён',
    };
    report.finishedAt = new Date().toISOString();
    return { exitCode: 0, report };
  }

  // Реальный старт прогона (dry-run и ранние failure-возвраты сюда не доходят).
  notifyFireAndForget('mas_started', `⏳ Спека ${options.specId}: прогон команды запущен. Делать ничего не нужно.`);

  const execution = executeRun(command, options, pre.apiKey);
  report.steps.push({ name: 'execute', status: execution.ok ? 'ok' : 'failed', detail: execution.detail });
  report.execution = execution.evidence;

  const collected = await collectTeam(options.workspace, teamId, startedAtMs);
  if (collected.found) {
    report.steps.push({ name: 'collect', status: 'ok', detail: `${collected.via}: ${collected.file}` });
    report.team = { source: collected.via, file: collected.file, inbox: collected.inbox, state: summarizeTeam(collected.team) };
  } else {
    report.steps.push({
      name: 'collect',
      status: 'failed',
      detail: `team.json не найден (проверены ${report.plan.stateDir} и свежие команды в ${path.join(options.workspace, STATE_DIR_NAME)})`,
    });
  }

  const ok = execution.ok && collected.found;
  report.result = {
    status: ok ? 'ok' : 'failed',
    reason: ok
      ? 'команда создана, состояние прочитано с диска'
      : execution.ok
        ? 'прогон завершился, но команда на диске не найдена (модель не вызвала agent_teams_create)'
        : `прогон завершился неуспешно: ${execution.detail}`,
  };
  report.finishedAt = new Date().toISOString();
  await recordHistory();
  // Терминальная точка после старта (единственная): mas_started уже отправлен.
  notifyFireAndForget(
    'mas_finished',
    report.result.status === 'ok'
      ? `✅ Спека ${options.specId}: прогон завершён успешно. Дальше — приёмка отчёта.`
      : `⚠️ Спека ${options.specId}: прогон завершён с ошибкой. Нужен разбор.`,
  );

  return { exitCode: ok ? 0 : 1, report };
}

/** Запись истории: ровно поля spec/startedAt/finishedAt/status/report. */
export function toRecord(report, options) {
  return {
    spec: report.spec,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    status: report.result.status,
    report: { ...report, mode: options.dryRun ? 'dry-run' : 'run' },
  };
}

/** Синхронный запуск one-shot прогона с ограничением времени. */
export function executeRun(command, options, apiKey) {
  const key = apiKey ?? { key: null, source: 'missing' };
  const startedAtMs = Date.now();
  // Harness-процесс не наследует User-scope переменные (alert 2026-09-30):
  // если ключ не пришёл из env, он пробрасывается в дочерний процесс явно.
  const childEnv = { ...process.env };
  if (key.source === 'user-scope' && key.key) childEnv[API_KEY_VAR] = key.key;
  const probe = spawnSync(command.command, command.argv, {
    cwd: options.workspace,
    env: childEnv,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsedMs = Date.now() - startedAtMs;
  const spawnError = probe.error === undefined ? null : probe.error;
  const timedOut = spawnError !== null && spawnError.code === 'ETIMEDOUT';
  const status = probe.status;
  const evidence = {
    exitCode: status,
    signal: probe.signal ?? null,
    elapsedMs,
    timedOut,
    stdoutTail: tail(probe.stdout ?? '', 4_000),
    stderrTail: tail(probe.stderr ?? '', 4_000),
    error: spawnError === null ? null : `${spawnError.code ?? 'ERROR'}: ${spawnError.message}`,
  };
  const ok = !timedOut && spawnError === null && status === 0;
  let detail;
  if (timedOut) detail = `таймаут ${options.timeoutMs} мс — процесс прерван`;
  else if (spawnError !== null) detail = `ошибка запуска: ${evidence.error}`;
  else detail = `exit=${status}, ${elapsedMs} мс`;
  return { ok, exitCode: status, elapsedMs, detail, evidence };
}

/** Последние `limit` символов строки. */
function tail(text, limit) {
  const trimmed = String(text);
  return trimmed.length <= limit ? trimmed : `…${trimmed.slice(trimmed.length - limit)}`;
}

/** Путь относительно корня репозитория в POSIX-виде. */
function relativePosix(target) {
  return path.relative(REPO_ROOT, target).split(path.sep).join('/');
}

/** Печать команды в виде, пригодном для копирования. */
export function renderCommand(command) {
  const quote = (value) => (/[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value);
  return [quote(command.command), ...command.argv.map(quote)].join(' ');
}

// ---------------------------------------------------------------------------
// Печать
// ---------------------------------------------------------------------------

/** Текстовый отчёт для человека. */
export function renderReport(report) {
  const lines = [];
  lines.push(`run-spec — MAS-прогон по спеке (путь к dsh-agent-teams из t0: PATH: ${report.path})`);
  lines.push(`путь: ${report.pathDetail}`);
  lines.push(`режим: ${report.mode}`);
  lines.push(`spec: ${report.spec}${report.specFile === undefined ? '' : ` (${report.specFile})`}`);
  if (report.specTitle !== undefined) lines.push(`заголовок: ${report.specTitle}`);
  lines.push(`profile: ${report.profile}`);
  lines.push(`workspace: ${report.workspace}`);
  if (report.plan !== null) {
    lines.push(`team id (подсказка): ${report.plan.teamIdHint}`);
    lines.push(`state dir: ${report.plan.stateDir}`);
  }
  if (report.plan !== null && Array.isArray(report.plan.tasks)) {
    lines.push(
      `риск-скоринг (spec 051): задач ${report.plan.tasks.length}, max-risk ${report.plan.maxRiskScore} (${report.plan.riskDecision}), DAG ${report.plan.dag.valid ? 'valid' : 'invalid'}`,
    );
    for (const task of report.plan.tasks) {
      const deps = task.dependencies.length > 0 ? ` · deps: ${task.dependencies.join(', ')}` : '';
      lines.push(
        `  ${task.id}: risk ${task.risk_score} (${task.risk_decision}) · actions: ${task.actions.join(', ')}${deps}`,
      );
    }
    lines.push(`  STOP B: ${report.plan.stopB.auto ? `auto-approve — ${report.plan.stopB.log}` : `STOP — ${report.plan.stopB.reason}`}`);
  }
  if (report.budget !== undefined) {
    lines.push(
      `бюджет: ${report.budget.status} — ${report.budget.estimated ? 'оценка' : 'факт'} ${report.budget.tokens} токенов ≈ $${report.budget.spentUsd}, остаток $${report.budget.remainingUsd} (hard $${report.budget.maxCostUsd}, soft $${report.budget.softCapUsd})`,
    );
    if (report.budgetEvidence !== undefined) lines.push(`evidence бюджета: ${report.budgetEvidence}`);
  }
  lines.push('');
  lines.push('precondition:');
  for (const check of report.precondition) {
    const mark = check.ok ? 'ok  ' : check.optional === true ? 'info' : 'FAIL';
    lines.push(`  [${mark}] ${check.name}: ${check.detail}`);
    if (!check.ok && check.fix !== null && check.fix !== undefined) lines.push(`         fix: ${check.fix}`);
  }
  lines.push('');
  lines.push('шаги:');
  for (const [index, step] of report.steps.entries()) {
    lines.push(`  ${index + 1}. ${step.name} — ${step.status}: ${step.detail}`);
  }
  if (report.plan !== null && report.plan.command !== null) {
    lines.push('');
    lines.push('команда:');
    lines.push(`  ${renderCommand(report.plan.command)}`);
  }
  if (report.templates !== undefined) {
    lines.push('');
    lines.push(`handoff-шаблоны (${report.templates.source}) → ${report.templates.dir}:`);
    for (const file of report.templates.files) {
      lines.push(`  ${file.name}: ${file.bytes} Б, sha256:${file.sha256}, финальный байт:${file.lastByte}, байт-в-байт: ${file.equal}`);
    }
  }
  if (report.team !== undefined) {
    lines.push('');
    lines.push(`команда на диске (${report.team.source}): ${report.team.state.name ?? '—'} [${report.team.state.id ?? '—'}], phase=${report.team.state.phase ?? '—'}`);
    lines.push(`  членов: ${report.team.state.members.length}, задач: ${report.team.state.tasks.length}, ящиков: ${report.team.inbox.length}`);
  }
  if (report.execution !== undefined) {
    lines.push('');
    lines.push(`прогон: exit=${report.execution.exitCode}, ${report.execution.elapsedMs} мс${report.execution.timedOut ? ', таймаут' : ''}`);
    if (report.execution.stderrTail !== '') lines.push(`  stderr (tail): ${report.execution.stderrTail.split('\n').slice(-6).join('\n    ')}`);
  }
  lines.push('');
  lines.push(`результат: ${report.result.status} — ${report.result.reason}`);
  if (report.result.hint !== undefined && report.result.hint !== null) lines.push(`подсказка: ${report.result.hint}`);
  if (report.history !== null) lines.push(`история: ${report.history.path} (записей: ${report.history.total})`);
  return lines.join('\n');
}

/** Код ошибки из исключения (агрегаты/ENOENT и т.п.). */
function errorCodeOf(error) {
  const code = error !== undefined && error !== null && typeof error === 'object' ? error.code : undefined;
  return typeof code === 'string' ? code : 'UNKNOWN';
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    if (parsed.error === 'help') {
      process.stdout.write(`${USAGE}\n`);
      process.exitCode = 0;
    } else {
      process.stderr.write(`${parsed.error}\n\n${USAGE}\n`);
      process.exitCode = parsed.exitCode;
    }
    return;
  }
  let outcome;
  try {
    outcome = await runSpec(parsed.options);
  } catch (error) {
    process.stderr.write(`ошибка: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
    return;
  }
  const stream = outcome.exitCode === 0 ? process.stdout : process.stderr;
  stream.write(
    parsed.options.json
      ? `${JSON.stringify(outcome.report, null, 2)}\n`
      : `${renderReport(outcome.report)}\n`,
  );
  process.exitCode = outcome.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
