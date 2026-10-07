import { pool } from '../config/db';

/** Bonus: audit log. Never lets a logging failure break the request. */
export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  meta?: unknown
) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5)',
      [userId, action, entity, entityId ?? null, meta ? JSON.stringify(meta) : null]
    );
  } catch (e) {
    console.error('audit failed', e);
  }
}
