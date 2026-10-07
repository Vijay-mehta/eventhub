import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { env } from '../config/env';

/** Creates the target database if it does not exist yet, so no manual `CREATE DATABASE` is needed. */
async function ensureDatabase() {
  const url = new URL(env.DATABASE_URL);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
    console.log(`created database ${dbName}`);
  }
  await admin.end();
}

(async () => {
  await ensureDatabase();
  const { pool } = await import('../config/db'); // import after the DB exists
  const dir = path.join(__dirname, '../../migrations');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    console.log('applied', f);
  }
  await pool.end();
  (await import('../config/db')).redis.disconnect();
})().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
