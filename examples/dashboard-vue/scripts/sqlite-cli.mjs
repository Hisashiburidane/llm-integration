import { existsSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export function resolveDatabasePath(value, fallback) {
  if (!value) return fallback;
  return path.resolve(process.env.INIT_CWD || process.cwd(), value);
}

export function createSqliteRunner(database) {
  return async function runSql(sql, { readonly = true } = {}) {
    if (!existsSync(database)) {
      throw new Error(`SQLite 数据库不存在：${database}。请先运行 data:process。`);
    }

    let connection;
    try {
      connection = new Database(database, { readonly, fileMustExist: true });
      if (readonly) return connection.prepare(sql).all();
      connection.exec(sql);
      return [];
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`SQLite 无法访问数据库 ${database}：${detail}`);
    } finally {
      connection?.close();
    }
  };
}
