// M2.9 batch 1 orchestration helper (untracked, never committed).
// Subcommands:
//   verify <writer-output.yaml>                 structural checks + bank cross-checks
//   mkqc   <writer-output.yaml> <qc-input.yaml> build writer_to_qc contract input
//   integrate <writer-output.yaml> <ids-csv>    append accepted ids to bank + _order.json
// Exit code 0 = all checks passed.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = 'C:/Users/Alexey Udotov/LinuxExam';
const BANK_DIR = path.join(ROOT, 'src/data/questions');
const EXPECTED_IDS = ['et_008', 'et_009', 'et_010', 'et_011', 'et_012', 'et_013'];
const SEMVER_KEYS = [
  'added_at',
  'pipeline_version',
  'verified_rhel',
  'verified_at',
  'source',
  'reference',
  'status',
];

let failures = 0;
const ok = (cond, label, detail = '') => {
  if (!cond) failures += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);
};

const readYaml = (p) => yaml.load(fs.readFileSync(p, 'utf8'));
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');

function loadBank() {
  const topics = fs
    .readdirSync(BANK_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort();
  const byTopic = {};
  for (const f of topics) byTopic[f.replace(/\.json$/, '')] = readJson(path.join(BANK_DIR, f));
  return { topics, byTopic };
}

function verify(p) {
  const doc = readYaml(p);
  const { byTopic } = loadBank();
  const existing = Object.values(byTopic).flat();

  console.log('--- writer output ---');
  ok(doc.status === 'OK', 'status == OK', String(doc.status));
  ok(doc.goal_invariant_check === true, 'goal_invariant_check == true');
  ok(doc.topic === 'essential_tools', 'topic == essential_tools');
  ok(Array.isArray(doc.questions), 'questions is array');
  const qs = doc.questions || [];
  ok(qs.length === 6, 'questions count == 6', String(qs.length));

  const ids = qs.map((q) => q.id);
  ok(new Set(ids).size === ids.length, 'ids unique', ids.join(','));
  ok(
    [...ids].sort().join(',') === [...EXPECTED_IDS].sort().join(','),
    'id set == {et_008..et_013}',
    [...ids].sort().join(','),
  );

  const positions = [0, 0, 0, 0];
  const subtopics = [];
  let easy = 0;
  let medium = 0;
  for (const q of qs) {
    const tag = q.id;
    ok(Array.isArray(q.options) && q.options.length === 4, `${tag}: 4 options`);
    const correct = (q.options || []).filter((o) => o.correct === true).length;
    ok(correct === 1, `${tag}: exactly 1 correct`, String(correct));
    const texts = (q.options || []).map((o) => o.text);
    ok(new Set(texts).size === texts.length, `${tag}: option texts unique`);
    ok(typeof q.explanation === 'string' && q.explanation.length >= 200, `${tag}: explanation >= 200 chars`, String((q.explanation || '').length));
    ok(q.topic === 'essential_tools', `${tag}: topic field`);
    ok(q.objective_domain === '1', `${tag}: objective_domain == "1"`, String(q.objective_domain));
    ok(q.difficulty === 'easy' || q.difficulty === 'medium', `${tag}: difficulty enum`, q.difficulty);
    if (q.difficulty === 'easy') easy += 1;
    if (q.difficulty === 'medium') medium += 1;
    ok(typeof q.subtopic === 'string' && q.subtopic.includes(': '), `${tag}: subtopic "<cmd>: <aspect>"`, q.subtopic);
    subtopics.push(q.subtopic);
    const m = q._meta || {};
    ok(
      SEMVER_KEYS.every((k) => typeof m[k] === 'string' && m[k].length > 0),
      `${tag}: _meta keys complete`,
      Object.keys(m).join('|'),
    );
    ok(/^man /.test(String(m.reference || '')), `${tag}: _meta.reference man-page`, m.reference);
    ok(m.status === 'active', `${tag}: _meta.status active`);
    positions[(q.options || []).findIndex((o) => o.correct === true)] += 1;
  }
  ok(new Set(subtopics).size === subtopics.length, 'subtopics unique in batch', subtopics.join(' | '));
  ok(easy >= 2 && medium >= 2, 'difficulty mix >=2 easy & >=2 medium', `easy=${easy} medium=${medium}`);
  ok(positions.every((c) => c <= 3), 'no correct position used > 3 times', positions.join(','));
  console.log(`INFO positions(0..3) = ${positions.join(',')}`);

  const ev = doc.evidence || [];
  ok(ev.length === 6, 'evidence entries == 6', String(ev.length));
  ok(
    [...ev.map((e) => e.question_id)].sort().join(',') === [...EXPECTED_IDS].sort().join(','),
    'evidence covers every id',
  );
  ok(ev.every((e) => typeof e.reference === 'string' && e.reference.length > 0), 'evidence references non-empty');
  ok(ev.every((e) => typeof e.note === 'string' && e.note.length > 0), 'evidence notes non-empty');

  console.log('--- cross-check vs existing bank (166 questions) ---');
  const existingIds = new Set(existing.map((q) => q.id));
  const existingSubt = new Set(existing.map((q) => q.subtopic));
  const existingTexts = new Set(existing.map((q) => q.question.trim().toLowerCase()));
  const existingOpts = new Set(existing.flatMap((q) => q.options.map((o) => o.text.trim().toLowerCase())));
  for (const q of qs) {
    ok(!existingIds.has(q.id), `${q.id}: id not present in bank`);
    ok(!existingSubt.has(q.subtopic), `${q.id}: subtopic not reused`, q.subtopic);
    ok(!existingTexts.has(q.question.trim().toLowerCase()), `${q.id}: question text not duplicated`);
    const clash = q.options.filter((o) => existingOpts.has(o.text.trim().toLowerCase())).map((o) => o.text);
    console.log(`INFO ${q.id}: option texts also present elsewhere in bank = ${clash.length}`);
  }
  console.log(failures === 0 ? '\nRESULT: ALL CHECKS PASS' : `\nRESULT: ${failures} FAILURES`);
  return failures;
}

function mkqc(writerPath, outPath) {
  const doc = readYaml(writerPath);
  const qs = doc.questions || [];
  const manPages = [...new Set(qs.map((q) => q._meta.reference))];
  const qcInput = {
    contract: 'writer_to_qc',
    batch_id: doc.batch_id,
    topic: doc.topic,
    subtopic: null,
    batch_size: qs.length,
    from_role: 'content-writer',
    to_role: 'qc-auditor',
    created_at: '2026-09-26',
    orchestrator_note:
      'Батч M2.9 №1 (essential_tools). QC верифицирует независимо, не доверяя evidence Writer. Капитан запретил WSL: man-верификация — по знанию man-страниц RHEL/Rocky 9 (и, если доступен web, по man7.org / Red Hat docs), без live-прогонов; неуверенность помечать явно.',
    questions: qs,
    evidence: {
      man_pages: manPages,
      distractor_runs: qs.map((q) => ({
        question_id: q.id,
        syntactic_distractor: q.options.find((o) => o.correct !== true && /(-Q\b|-q\b|-max-depth\b|-x\b|ssh-copyid)/.test(o.text))
          ? q.options.find((o) => o.correct !== true && /(-Q\b|-q\b|-max-depth\b|-x\b|ssh-copyid)/.test(o.text)).text
          : null,
        expected: 'exit != 0 (invalid option / command not found)',
        verified: 'not_run (WSL запрещён капитаном)',
      })),
      cosine_result: {
        status: 'not_run',
        reason: 'intra-batch cosine не входит в гейты M2.9 batch1; QC вправе перепроверить сам (node tools/cosine.cjs --intra-batch)',
      },
      qc_result: {
        status: 'baseline',
        tool: 'npm run qc',
        baseline_total: 166,
        baseline_fails: 0,
        baseline_warns: 15,
      },
    },
    goal_invariant:
      'Банк 300+ качественных MCQ-вопросов для RHCSA EX200 (RU), пригодных для монетизации через Telegram-бота; формат строго 4 опции / ровно 1 correct; каждый вопрос проверяем по man-странице RHEL 9; ноль дублей внутри банка.',
    writer_report: {
      status: doc.status,
      notes: doc.notes,
      flagged_uncertainties: [
        'несуществующие ключи-дистракторы: grep -Q, man -q, sort -x, find -max-depth, ssh-copyid — live-прогон не делался (WSL запрещён)',
        'et_012 (ssh-copy-id): objective_domain="1" — по EX200 «Access remote systems using SSH» входит в objective 1, граница с running_systems',
        'et_009 reference указан как man man (man -k документирован также в apropos(1))',
      ],
    },
    required_output: {
      path: '.project/drafts/m2.9-batch1-qc-output.yaml',
      structure: [
        'batch_id: string (== входной)',
        'verdict: PASS | FAIL (агрегат по батчу)',
        'questions: список per-question объектов: {question_id, verdict: "accept"|"reject", passes: {fact_check, objective, language, beginner_view, skeptic_view: "pass"|"fail", ...}, hard_blocker_reason: string|null, issues: [string]}',
        'issues: список объектов {question_id, severity: CRITICAL|SUBSTANTIAL|MINOR, pass: fact-check|objective|language|beginner-view|skeptic-view, description}',
        'evidence_verified: {qc_rerun: [строки с командами и кодами возврата], man_recheck: [строки: страница/ключ/вывод]}',
        'goal_invariant_check: boolean',
        'notes: string',
      ],
      rules: [
        'hard blocker ставится ТОЛЬКО по проходам fact-check и objective; language/beginner-view/skeptic-view — advisory',
        'per-question verdict = reject только при hard blocker; иначе accept',
        'reject без hard_blocker_reason запрещён',
        'ratification by re-execution: QC сам запускает npm run qc, npm run shuffle-bank:check, npm run typecheck и приводит коды возврата',
      ],
    },
    authority: 'Финальное решение accept/reject по каждому вопросу принимает Orchestrator; QC возвращает вердикты и evidence.',
    next_step:
      'Оркестратор считает N_accepted, интегрирует accepted в банк (et_008..et_007+N), обновляет _order.json, _topics.json, guard-тест, PLAN.md, state.json, коммит + push.',
  };
  if (typeof qcInput.subtopic !== 'string') {
    qcInput.subtopic = 'shell, grep, find, xargs, sort, stat, tar, man, ssh';
  }
  fs.writeFileSync(outPath, yaml.dump(qcInput, { lineWidth: -1, noRefs: true, quotingType: '"' }), 'utf8');
  console.log(`qc-input written: ${outPath} (${fs.statSync(outPath).size} bytes, ${qs.length} questions)`);
  return 0;
}

function integrate(writerPath, idsCsv) {
  const accepted = idsCsv.split(',').map((s) => s.trim()).filter(Boolean);
  const doc = readYaml(writerPath);
  const qs = (doc.questions || []).filter((q) => accepted.includes(q.id));
  ok(qs.length === accepted.length, 'every accepted id found in writer output', `${qs.length}/${accepted.length}`);
  if (failures > 0) return failures;

  const bankPath = path.join(BANK_DIR, 'essential_tools.json');
  const orderPath = path.join(BANK_DIR, '_order.json');
  const bank = readJson(bankPath);
  const order = readJson(orderPath);

  const bankIds = new Set(bank.map((q) => q.id));
  const orderIds = new Set(order);
  for (const q of qs) {
    ok(!bankIds.has(q.id), `rerun-guard: ${q.id} absent from bank`);
    ok(!orderIds.has(q.id), `rerun-guard: ${q.id} absent from _order.json`);
  }
  if (failures > 0) return failures;

  const before = { bank: bank.length, order: order.length, bytesBank: fs.statSync(bankPath).size };
  for (const q of qs) bank.push(q);
  for (const q of qs) order.push(q.id);
  writeJson(bankPath, bank);
  writeJson(orderPath, order);

  console.log(
    `INFO bank ${before.bank} -> ${bank.length}; _order.json ${before.order} -> ${order.length}; appended ids: ${qs
      .map((q) => q.id)
      .join(',')}`,
  );
  console.log(`INFO appended ids in bank order: ${bank.slice(before.bank).map((q) => q.id).join(',')}`);
  console.log(`RESULT: INTEGRATED ${qs.length} questions`);
  return 0;
}

const [cmd, a1, a2] = process.argv.slice(2);
let code = 1;
if (cmd === 'verify') code = verify(a1);
else if (cmd === 'mkqc') code = mkqc(a1, a2);
else if (cmd === 'integrate') code = integrate(a1, a2);
else {
  console.error('usage: verify|mkqc|integrate');
  code = 2;
}
process.exit(code === 0 ? 0 : 1);
