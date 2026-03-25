import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000, // Fail fast if DB is unreachable
  allowExitOnIdle: true, // Allow process to exit even with idle connections
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
});

/**
 * Execute a parameterized query against the pool.
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Get a dedicated client from the pool for transaction use.
 * Caller MUST call client.release() when done.
 */
export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}
