import { pool, redis, tx } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { audit } from '../../utils/audit';
import { emitSeats, seatBus } from '../../utils/seatBus';

export const HOLD_SECONDS = 300; // 5 minutes

const SELECT = `
  SELECT b.id, b.event_id, b.quantity, b.total_cents, b.status, b.created_at, b.cancelled_at,
         i.title AS event_title, i.event_date,
         GREATEST(0, EXTRACT(EPOCH FROM (b.hold_expires_at - now())))::int AS seconds_left,
         (i.event_date - now() >= interval '24 hours') AS can_cancel
  FROM bookings b JOIN event_inventory i ON i.event_id = b.event_id`;

const map = (r: any) => ({
  id: r.id,
  eventId: r.event_id,
  eventTitle: r.event_title,
  eventDate: r.event_date,
  quantity: r.quantity,
  totalAmount: r.total_cents / 100,
  status: r.status,
  // PENDING bookings carry the remaining hold time (computed by the DB clock, so no client clock skew)
  secondsLeft: r.status === 'PENDING' ? r.seconds_left : null,
  canCancel: (r.status === 'CONFIRMED' && r.can_cancel) || r.status === 'PENDING',
  createdAt: r.created_at,
  cancelledAt: r.cancelled_at,
});

/**
 * NO OVERBOOKING: the seat decrement is ONE atomic conditional UPDATE:
 *   UPDATE ... SET available = available - n WHERE available >= n
 * Postgres takes a row lock, so two concurrent "last seat" requests are serialised: the second one
 * re-evaluates the WHERE after the first commits, matches 0 rows and gets 409. A CHECK constraint
 * (available_seats >= 0) is the last line of defence.
 * Held seats are removed from `available_seats` immediately and returned on expiry/cancel.
 */
export async function holdSeats(userId: string, eventId: string, quantity: number) {
  let booking;
  try {
    booking = await tx(async (c) => {
      const upd = await c.query(
        `UPDATE event_inventory SET available_seats = available_seats - $2
         WHERE event_id = $1 AND available_seats >= $2 AND event_date > now()
         RETURNING price_cents`,
        [eventId, quantity]
      );
      if (!upd.rowCount) {
        const ex = await c.query('SELECT event_date > now() AS upcoming FROM event_inventory WHERE event_id=$1', [eventId]);
        if (!ex.rowCount) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
        if (!ex.rows[0].upcoming) throw new AppError(409, 'EVENT_ENDED', 'This event has already started');
        throw new AppError(409, 'NOT_ENOUGH_SEATS', 'Not enough seats available');
      }
      const ins = await c.query(
        `INSERT INTO bookings (user_id,event_id,quantity,total_cents,status,hold_expires_at)
         VALUES ($1,$2,$3,$4,'PENDING', now() + ($5 || ' seconds')::interval) RETURNING id`,
        [userId, eventId, quantity, upd.rows[0].price_cents * quantity, String(HOLD_SECONDS)]
      );
      return ins.rows[0];
    });
  } catch (e: any) {
    if (e.code === '23505')
      throw new AppError(409, 'ACTIVE_HOLD_EXISTS', 'You already have an active hold for this event. Complete or cancel it first.');
    throw e;
  }
  await redis.set(`hold:${booking.id}`, userId, 'EX', HOLD_SECONDS); // Redis TTL mirrors the hold
  void emitSeats(eventId);
  return getBooking(userId, booking.id);
}

export async function getBooking(userId: string, id: string) {
  const r = await pool.query(`${SELECT} WHERE b.id = $1 AND b.user_id = $2`, [id, userId]).catch(() => null);
  if (!r?.rowCount) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  return map(r.rows[0]);
}

export async function myBookings(userId: string) {
  const r = await pool.query(`${SELECT} WHERE b.user_id = $1 ORDER BY b.created_at DESC`, [userId]);
  return r.rows.map(map);
}

/** Mock payment: ~70% success. A failed attempt is recorded but the hold stays so the user can retry until it expires. */
export async function pay(userId: string, id: string) {
  const result = await tx(async (c) => {
    const b = await c
      .query('SELECT * FROM bookings WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId])
      .catch(() => null);
    if (!b?.rowCount) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const bk = b.rows[0];
    if (bk.status !== 'PENDING') throw new AppError(409, 'INVALID_STATE', `Booking is already ${bk.status}`);
    const live = await c.query('SELECT $1::timestamptz > now() AS ok', [bk.hold_expires_at]);
    if (!live.rows[0].ok) throw new AppError(410, 'HOLD_EXPIRED', 'Your seat hold has expired');

    const success = Math.random() < 0.7;
    await c.query('INSERT INTO payments (booking_id, amount_cents, status) VALUES ($1,$2,$3)', [
      id,
      bk.total_cents,
      success ? 'SUCCESS' : 'FAILED',
    ]);
    if (success) await c.query(`UPDATE bookings SET status='CONFIRMED', hold_expires_at=NULL WHERE id=$1`, [id]);
    return { success, eventId: bk.event_id };
  });
  if (!result.success) throw new AppError(402, 'PAYMENT_FAILED', 'Payment failed. Please try again before your hold expires.');
  await redis.del(`hold:${id}`);
  await audit(userId, 'BOOKING_CONFIRMED', 'booking', id);
  return getBooking(userId, id);
}

/** Cancellation: only >= 24h before the event; seats go back to inventory in the same transaction. */
export async function cancel(userId: string, id: string) {
  const eventId = await tx(async (c) => {
    const r = await c
      .query(
        `SELECT b.*, (i.event_date - now() >= interval '24 hours') AS can_cancel
         FROM bookings b JOIN event_inventory i ON i.event_id = b.event_id
         WHERE b.id=$1 AND b.user_id=$2 FOR UPDATE OF b`,
        [id, userId]
      )
      .catch(() => null);
    if (!r?.rowCount) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    const bk = r.rows[0];
    if (!['PENDING', 'CONFIRMED'].includes(bk.status))
      throw new AppError(409, 'INVALID_STATE', `Booking is already ${bk.status}`);
    if (bk.status === 'CONFIRMED' && !bk.can_cancel)
      throw new AppError(422, 'CANCELLATION_WINDOW_CLOSED', 'Bookings can only be cancelled up to 24 hours before the event');

    await c.query(`UPDATE bookings SET status='CANCELLED', cancelled_at=now(), hold_expires_at=NULL WHERE id=$1`, [id]);
    await c.query('UPDATE event_inventory SET available_seats = available_seats + $2 WHERE event_id=$1', [bk.event_id, bk.quantity]);
    await c.query(`UPDATE payments SET status='REFUNDED' WHERE booking_id=$1 AND status='SUCCESS'`, [id]);
    return bk.event_id as string;
  });
  await redis.del(`hold:${id}`);
  void emitSeats(eventId);
  await audit(userId, 'BOOKING_CANCELLED', 'booking', id);
  return getBooking(userId, id);
}

/** Releases seats of expired holds in a single atomic statement. Runs every 15s. */
export async function releaseExpiredHolds() {
  const r = await pool.query(`
    WITH expired AS (
      UPDATE bookings SET status='EXPIRED'
      WHERE status='PENDING' AND hold_expires_at < now()
      RETURNING event_id, quantity
    ), agg AS (SELECT event_id, SUM(quantity)::int AS q FROM expired GROUP BY event_id)
    UPDATE event_inventory i SET available_seats = i.available_seats + agg.q
    FROM agg WHERE i.event_id = agg.event_id
    RETURNING i.event_id, i.available_seats`);
  for (const row of r.rows) seatBus.emit(`seats:${row.event_id}`, row.available_seats);
  return r.rowCount ?? 0;
}
