import mongoose from 'mongoose';
import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { env } from './env';

export const pool = new Pool({ connectionString: env.DATABASE_URL });
export const redis = new Redis(env.REDIS_URL);
export const connectMongo = () => mongoose.connect(env.MONGO_URL);

/** Run fn inside a transaction; commits on success, rolls back on any throw. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
