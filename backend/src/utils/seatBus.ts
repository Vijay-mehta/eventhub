import { EventEmitter } from 'events';
import { pool } from '../config/db';

/** Bonus: live seat updates via SSE. In-process bus (single instance; use Redis pub/sub to scale out). */
export const seatBus = new EventEmitter();
seatBus.setMaxListeners(0);

export async function emitSeats(eventId: string) {
  const r = await pool.query('SELECT available_seats FROM event_inventory WHERE event_id=$1', [eventId]);
  if (r.rowCount) seatBus.emit(`seats:${eventId}`, r.rows[0].available_seats);
}
