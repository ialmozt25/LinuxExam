#!/usr/bin/env node
/**
 * Composes the writer_to_qc handoff for M2.9 batch 4 from the Writer's output
 * YAML, so nothing is retyped by hand (transcription errors are the classic
 * source of a QC/orchestrator disagreement).
 *
 * Usage: node .project/drafts/m2.9-batch4-make-qc-input.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';

const WRITER_OUT = process.argv[2] || '.project/drafts/m2.9-batch4-writer-output.yaml';
const QC_IN = process.argv[3] || '.project/drafts/m2.9-batch4-qc-input.yaml';
const ROUND = process.argv[4] || '1';

const doc = yaml.load(readFileSync(WRITER_OUT, 'utf8'));

const qcInput = {
  contract: 'writer_to_qc',
  batch_id: doc.batch_id,
  topic: doc.topic,
  batch_size: doc.questions.length,
  from_role: 'content-writer',
  to_role: 'qc-auditor',
  created_at: '2026-09-27',
  qc_round: Number(ROUND),
  prior_round: ROUND === '2'
    ? [
        'Раунд 1 (снапшот v1): verdict FAIL, 5 accept / 1 reject.',
        'отклонён fm_016 — HARD BLOCKER ratio: класс sentences (4/4/4/4 слова) -> порог qc.cjs 1.30 по символам,',
        'факт 1.4118 (длины 24/20/17/22). QC раунда 1 подтвердил блокер прогоном зеркала банка 189 через',
        'настоящий tools/qc.cjs: Fails 1, exit 1. Остальные 5 вопросов приняты без правок.',
        'В v2 изменён ТОЛЬКО fm_016: `rm -f -- data.log` (17) -> `rm --force -- data.log` (22), ratio 1.2000.',
        'Стем, верный ответ и explanation fm_016 не менялись; пять прочих вопросов байт-в-байт как в v1.',
        'Твоя задача — проверить v2 НЕЗАВИСИМО с нуля, не полагаясь на вывод раунда 1 и не считая его доказательством.',
      ].join(' ')
    : undefined,
  orchestrator_note: [
    'Батч M2.9 №4 (file_management, 6 вопросов fm_013..fm_018, банк 183 -> 189).',
    'Тема — канон из src/data/topics.ts:22 (key=file_management, «Управление файлами»).',
    'Проверку Оркестратора не считать доказательством: ratification by re-execution —',
    'перезапусти все проверки сам и не доверяй ни evidence Writer, ни его position_report,',
    'ни числам в manual_qc_report.',
    'WSL и live-прогоны команд RHCSA запрещены капитаном: факты сверять по знанию',
    'man-страниц RHEL/Rocky 9 (coreutils 8.32, rsync), остаточную неопределённость помечать явно.',
    'Позиция QC — adversarial, default verdict FAIL: докажи, что вопрос пригоден.',
    'Hard blockers (verdict FAIL) — только от проходов fact-check и objective;',
    'advisory (language, beginner-view, skeptic-view) фиксируются как замечания.',
  ].join(' '),
  questions: doc.questions,
  evidence: doc.evidence,
  position_report: doc.position_report,
  avoid_list: {
    note: 'Решение капитана 2026-09-27: 11 ID из spec 001 как есть, включая ds_014. ds_014 в банке отсутствует (deploy_systems = ds_001..ds_013) — намеренный no-op.',
    ids: ['ds_002', 'ds_014', 'rs_001', 'pm_014', 'pm_010', 'fs_005', 'fs_006', 'fs_013', 'ls_002', 'ls_005', 'ls_007'],
  },
  avoid_existing_subtopics_fm: [
    'fm_001..fm_012: cp/mv/ln, find (все ключи), tar/gzip/bzip2, redirection (>, >>, 2>&1, tee), locate/updatedb, xargs, file/stat/ls -l',
  ],
  forbidden_cross_topic_aspects: [
    'file_systems: tune2fs, fsck, df -i, mount -o loop, fstab, CIFS, showmount, mkfs',
    'local_storage: LVM, sfdisk, lsblk/blkid, swap, mount/findmnt',
    'text_files: sed, awk, cut, sort, uniq, tr, wc, head/tail',
    'shell_scripts: if/циклы, позиционные аргументы, $(), функции',
    'file_permissions: chmod, chown, umask, ACL, special bits, find -perm',
    'essential_tools: tar (создание и распаковка), find (-size/-maxdepth), xargs, man',
  ],
  acceptance_criteria: [
    '4 опции, ровно 1 correct: true',
    'option ratio (chars) в пределах порога tools/qc.cjs И ≤ 1.5 по DOD.md',
    'cosine против ВСЕГО банка 183 ≤ 0.85',
    'cosine внутри партии ≤ 0.85',
    'explanation ≤ 3 строк',
    'id fm_013..fm_018 уникальны и свободны',
    'тема строго file_management',
    'avoid-list соблюдён',
    'ноль смысловых дублей внутри партии и с банком (в т.ч. cross-theme)',
  ],
  qc_instructions: {
    must_re_execute: [
      'node tools/cosine.cjs --intra-batch <pending.json> — пересчитать самому',
      'node tools/cosine.cjs <pending.json> — cosine против банка, пересчитать самому',
      'структурные проверки: 4 опции / 1 correct / explanation / id',
    ],
    ratio_method: [
      'ВАЖНО: tools/qc.cjs считает option ratio в СИМВОЛАХ, но выбирает порог по классу опций,',
      'определяемому по ЧИСЛУ СЛОВ (tools/_lib/ratio.cjs, classifyOptions):',
      'все 4 опции >= 4 слов -> класс sentences -> порог FAIL 1.30 (warn 1.25);',
      'все 4 опции <= 3 слов -> класс token -> порог FAIL 2.0 (warn 1.35);',
      'иначе mixed -> порог FAIL 1.5 (warn 1.35).',
      'Прочитай tools/_lib/ratio.cjs и tools/qc.cjs сам и примени ТУ же логику.',
      'Порог 1.5 из DOD.md — внешняя граница; фактический гейт npm run qc строже.',
      'Проверяемая форма: node -e "const{checkRatio}=require(\'./tools/_lib/ratio.cjs\');..."',
    ],
    distractor_checks: [
      'Проверить, что ни один дистрактор не является вторым верным ответом при буквальном чтении условия.',
      'Проверить, что заявленные Writer-ом «несуществующие» ключи/операнды действительно не существуют в RHEL 9 (и наоборот: нет незаявленных).',
      'Проверить, что верный ответ действительно верен и однозначен.',
    ],
    pending_json_note: 'tools/cosine.cjs читает ТОЛЬКО JSON (JSON.parse). YAML ему подавать нельзя — сначала конвертируй questions в JSON-массив.',
    verdict_rules: [
      'PASS — только если НЕТ hard blocker (fact-check/objective).',
      'FAIL — при наличии hard blocker; вернуть issues с question_id, severity, pass, description.',
      'Частичный вердикт допустим: по каждому вопросу accept или reject с причиной.',
    ],
  },
  output_path: '.project/drafts/m2.9-batch4-qc-output.yaml',
  output_structure: [
    'contract: qc_to_orchestrator',
    'batch_id: m2.9-batch4-file_management',
    'verdict: PASS | FAIL',
    'per_question: [{question_id, verdict: accept|reject, reason}]',
    'issues: [{question_id, severity: CRITICAL|SUBSTANTIAL|MINOR, pass: fact-check|objective|language|beginner-view|skeptic-view, description}]',
    'evidence_verified: {qc_rerun: [...], man_recheck: [...]}',
    'cosine_rerun: {intra_max, bank_max, commands}',
    'ratio_rerun: [{id, class, char_ratio, threshold, verdict}]',
    'goal_invariant_check: true|false',
    'notes: <свободный текст>',
  ].join('\n  '),
  next_step: 'Оркестратор принимает решение (не QC): accept / rework. При rework Writer правит отклонённые вопросы, максимум 1 доп. итерация на вопрос, затем повторный QC.',
};

writeFileSync(
  QC_IN,
  yaml.dump(qcInput, { lineWidth: 1000, noRefs: true, quotingType: '"' }),
  'utf8',
);
console.log(`wrote ${QC_IN}: ${qcInput.questions.length} questions, ${qcInput.evidence.length} evidence records`);
