// dev.js — с автоподъёмом лимита
const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';

// Пытаемся поднять лимит на macOS/Linux
if (!isWindows) {
  try {
    require('child_process').execSync('ulimit -n 65535', { stdio: 'ignore' });
  } catch (e) {}
}

function run(command, args, cwd, prefix, color = '\x1b[36m') {
  const proc = spawn(command, args, { cwd, shell: true, stdio: 'pipe' });

  const log = (data, isError = false) => {
    data.toString().trim().split('\n').forEach(line => {
      if (line) console.log(`${color}[${prefix}]\x1b[0m ${isError ? '\x1b[31m' : ''}${line}\x1b[0m`);
    });
  };

  proc.stdout?.on('data', data => log(data));
  proc.stderr?.on('data', data => log(data, true));

  proc.on('close', (code) => {
    console.log(`\x1b[33m[${prefix}] Процесс завершён (код: ${code})\x1b[0m`);
  });

  return proc;
}

console.clear();
console.log('\x1b[35m╔══════════════════════════════════════╗\x1b[0m');
console.log('\x1b[35m║   FULLSTACK DEV SERVER LAUNCHING   ║\x1b[0m');
console.log('\x1b[35m╚══════════════════════════════════════╝\x1b[0m\n');

const backend = run('go', ['run', '.'], path.join(__dirname, 'backend'), 'BACKEND', '\x1b[32m');
const frontend = run('npm', ['run', 'dev', '--', '--host'], path.join(__dirname, 'frontend'), 'FRONTEND', '\x1b[34m');

process.on('SIGINT', () => {
  console.log('\n\nОстанавливаем...');
  backend.kill();
  frontend.kill();
  process.exit();
});