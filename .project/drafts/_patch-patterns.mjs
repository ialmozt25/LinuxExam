import fs from 'node:fs';

const Y = '.project/checklists/ui-ux.yaml';
const lines = fs.readFileSync(Y, 'utf8').split('\n');

const TYPO_NEW = "      pattern: 'fontSize:\\s*\\W?(?:[0-9]|1[0-5])px'";
const SPACE_THRESH_NEW = '    threshold: padding/margin >= 16px % 8 == 0; gap — только 4px-сетка';
const SPACE_NEW = "      pattern: '(?:padding|margin)[A-Za-z]*:[^:]*[^0-9\\n](?<value>1[6-9]|[2-9][0-9]|[0-9]{3,})px'";

const done = [];
let curId = null;
for (let i = 0; i < lines.length; i += 1) {
  const idm = /^ {2}- id: (\S+)$/.exec(lines[i]);
  if (idm) { curId = idm[1]; continue; }
  if (curId === 'TYPO-001' && /^ {6}pattern: 'fontSize:/.test(lines[i]) && lines[i] !== TYPO_NEW) {
    lines[i] = TYPO_NEW; done.push('TYPO-001'); continue;
  }
  if (curId === 'SPACE-002' && lines[i] !== SPACE_THRESH_NEW && /^ {4}threshold: (\(padding\|margin\|gap\)|padding\/margin)/.test(lines[i])) {
    lines[i] = SPACE_THRESH_NEW; done.push('SPACE-002 threshold'); continue;
  }
  if (curId === 'SPACE-002' && /^ {6}pattern: '\(\?:padding\|margin/.test(lines[i]) && lines[i] !== SPACE_NEW) {
    lines[i] = SPACE_NEW; done.push('SPACE-002 pattern');
  }
}
fs.writeFileSync(Y, lines.join('\n'), 'utf8');
console.log(done.length ? `  применено: ${done.join(', ')}` : '  всё уже применено');

const t = fs.readFileSync(Y, 'utf8');
const typo = /- id: TYPO-001[\s\S]*?pattern: '([^']+)'/.exec(t)[1];
const space2 = /- id: SPACE-002[\s\S]*?pattern: '([^']+)'/.exec(t)[1];

const verify = (label, pattern, cases) => {
  const re = new RegExp(pattern);
  let bad = 0;
  console.log(`${label}: ${JSON.stringify(pattern)}`);
  for (const [s, want] of cases) {
    const m = re.exec(s);
    const ok = (m !== null) === want;
    if (!ok) { bad += 1; console.log(`  ОШИБКА ${JSON.stringify(s)} -> ${m ? JSON.stringify(m[0]) : 'null'}, ожидалось ${want}`); }
    else console.log(`  ok  ${JSON.stringify(s)} -> ${m ? JSON.stringify(m[0]) : 'null'}`);
  }
  return bad;
};

let bad = 0;
bad += verify('TYPO-001', typo, [
  ["          fontSize: '14px',", true],
  ["            fontSize: '13px',", true],
  ["            fontSize: '12px',", true],
  // Единица `px` обязательна: без неё значение неотличимо от префикса
  // («fontSize: 14,» — это 14px-префикс `1[0-5]` без единицы). Такой хардкод
  // ловит TYPO-006/strict-слой, а критерий остаётся про единицу.
  ['            fontSize: 14,', false],
  ['            fontSize: 15,', false],
  ['            fontSize: 10,', false],
  ['            fontSize: 12,', false],
  ["            fontSize: '12px',", true],
  ["            fontSize: '16px',", false],
  ['            fontSize: 24,', false],
  ["            fontSize: '19px',", false],
]);
bad += verify('SPACE-002', space2, [
  ["            padding: '16px',", true],
  ["            padding: '24px',", true],
  ["            padding: '12px',", false],
  ['            padding: 16,', false],
  ["            margin: '32px',", true],
  ["            gap: '4px',", false],
]);
console.log(bad === 0 ? 'приёмка правки: OK' : `приёмка правки: ${bad} ошибок`);
process.exit(bad === 0 ? 0 : 1);
