import { readdir, readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pool, getClient } from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

/**
 * Ensure the _migrations tracking table exists.
 */
async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Get the set of already-applied migration names.
 */
async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>('SELECT name FROM _migrations ORDER BY id');
  return new Set(result.rows.map((r) => r.name));
}

/**
 * Run all pending migrations in order.
 */
export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  // Read and sort migration files
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ranCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  [skip] ${file} (already applied)`);
      continue;
    }

    const filePath = resolve(MIGRATIONS_DIR, file);
    const sql = await readFile(filePath, 'utf-8');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`  [applied] ${file}`);
      ranCount++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  [FAILED] ${file}:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  if (ranCount === 0) {
    console.log('  All migrations already applied.');
  } else {
    console.log(`  ${ranCount} migration(s) applied.`);
  }
}

// Run directly if executed as a standalone script
const isMain = process.argv[1] && (
  process.argv[1].endsWith('migrate.ts') ||
  process.argv[1].endsWith('migrate.js')
);

if (isMain) {
  console.log('Running database migrations...');
  runMigrations()
    .then(() => {
      console.log('Migrations complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
