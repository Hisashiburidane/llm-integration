import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['scripts/query-server.mjs'], { stdio: 'inherit', env: process.env }),
  spawn('vite', ['--host', '127.0.0.1'], { stdio: 'inherit', env: process.env })
];

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  children.forEach((child) => child.kill('SIGTERM'));
  setTimeout(() => process.exit(code), 250);
}

children.forEach((child) => child.on('exit', (code, signal) => {
  if (!closing && (code ?? 0) !== 0) {
    console.error(`[dashboard-dev] child exited with ${signal || code}`);
    shutdown(code || 1);
  }
}));

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
