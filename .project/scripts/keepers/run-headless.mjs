// run-headless.mjs — запуск dsh --profile headless с промптом из файла.
//
// Зачем отдельный файл: в PowerShell 5.1 вывод dsh нельзя собирать средствами
// PowerShell (как `| Out-File`, так и `2>>`) — при $ErrorActionPreference = "Stop"
// нативный stderr завершает скрипт, а dsh пишет туда reasoning и вердикт
// sync:check. Редирект делает cmd, а промпт передаётся файлом, чтобы не зависеть
// от кавычек и кодировки командной строки.
//
// Использование: node run-headless.mjs <prompt-file> <dsh-bin>

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [, , promptFile, dshBin] = process.argv;
if (!promptFile || !dshBin) {
  process.stderr.write('usage: node run-headless.mjs <prompt-file> <dsh-bin>\n');
  process.exit(2);
}

const prompt = fs.readFileSync(promptFile, 'utf8').replace(/^\uFEFF/, '');
const res = spawnSync(process.execPath, [dshBin, '--profile', 'headless', prompt], {
  stdio: 'inherit',
});
process.exit(res.status === null ? 1 : res.status);
