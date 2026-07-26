import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolveDatabasePath(value, fallback) {
  if (!value) return fallback;
  return path.resolve(process.env.INIT_CWD || process.cwd(), value);
}

export function createSqliteRunner(database) {
  return function runSql(sql, { readonly = true } = {}) {
    return new Promise((resolve, reject) => {
      if (!existsSync(database)) {
        reject(new Error(`SQLite 数据库不存在：${database}。请先运行 data:process。`));
        return;
      }

      // A WAL database may need to create its -shm file even for reads. Using
      // query_only keeps the SQL constrained without blocking WAL initialization.
      const child = spawn('sqlite3', ['-json', database], { stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', (error) => reject(new Error(`无法启动 sqlite3：${error.message}`)));
      child.on('close', (code) => {
        if (code !== 0) {
          const detail = stderr.trim() || `sqlite3 退出码：${code}`;
          reject(new Error(`SQLite 无法访问数据库 ${database}：${detail}`));
          return;
        }
        try {
          resolve(stdout.trim() ? JSON.parse(stdout) : []);
        } catch (error) {
          reject(new Error(`SQLite 返回了无效 JSON：${error instanceof Error ? error.message : String(error)}`));
        }
      });
      child.stdin.end(`${readonly ? 'PRAGMA query_only = ON;\n' : ''}${sql};\n`);
    });
  };
}
