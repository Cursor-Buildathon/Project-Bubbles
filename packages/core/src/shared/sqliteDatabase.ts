import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

const require = createRequire(import.meta.url);
let sqlPromise: Promise<SqlJsStatic> | undefined;

export interface SqliteDatabaseHandle {
  database: Database;
  persist: () => Promise<void>;
}

export async function openSqliteDatabase(databasePath: string, schemaSql: string): Promise<SqliteDatabaseHandle> {
  const SQL = await getSql();
  await mkdir(dirname(databasePath), { recursive: true });
  const database = existsSync(databasePath) ? new SQL.Database(await readFile(databasePath)) : new SQL.Database();
  database.run(schemaSql);

  return {
    database,
    async persist() {
      await writeFile(databasePath, Buffer.from(database.export()));
    }
  };
}

function getSql() {
  sqlPromise ??= initSqlJs({
    locateFile: (file) => (file.endsWith('.wasm') ? require.resolve(`sql.js/dist/${file}`) : file)
  });

  return sqlPromise;
}
