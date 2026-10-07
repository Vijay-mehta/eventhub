import { Router } from 'express';
import { pool } from '../../config/db';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/stats', asyncHandler(async (_req, res) => {
  const r = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM event_inventory)::int AS events,
      (SELECT COUNT(*) FROM users WHERE role='user')::int AS users,
      (SELECT COUNT(*) FROM bookings WHERE status='CONFIRMED')::int AS confirmed_bookings,
      (SELECT COALESCE(SUM(quantity),0) FROM bookings WHERE status='CONFIRMED')::int AS tickets_sold,
      (SELECT COALESCE(SUM(total_cents),0) FROM bookings WHERE status='CONFIRMED')::bigint AS revenue_cents`);
  const s = r.rows[0];
  res.json({
    success: true,
    data: {
      events: s.events,
      users: s.users,
      confirmedBookings: s.confirmed_bookings,
      ticketsSold: s.tickets_sold,
      revenue: Number(s.revenue_cents) / 100,
    },
  });
}));

// REPORTING QUERY: top 5 events by revenue (confirmed bookings only)
router.get('/reports/top-events', asyncHandler(async (_req, res) => {
  const r = await pool.query(`
    SELECT i.event_id, i.title,
           COUNT(b.id)::int                       AS bookings,
           COALESCE(SUM(b.quantity),0)::int       AS tickets,
           COALESCE(SUM(b.total_cents),0)::bigint AS revenue_cents
    FROM event_inventory i
    JOIN bookings b ON b.event_id = i.event_id AND b.status = 'CONFIRMED'
    GROUP BY i.event_id, i.title
    ORDER BY revenue_cents DESC
    LIMIT 5`);
  res.json({
    success: true,
    data: r.rows.map((x) => ({
      eventId: x.event_id,
      title: x.title,
      bookings: x.bookings,
      tickets: x.tickets,
      revenue: Number(x.revenue_cents) / 100,
    })),
  });
}));

router.get('/bookings', asyncHandler(async (_req, res) => {
  const r = await pool.query(`
    SELECT b.id, b.status, b.quantity, b.total_cents, b.created_at, u.email, i.title
    FROM bookings b JOIN users u ON u.id=b.user_id JOIN event_inventory i ON i.event_id=b.event_id
    ORDER BY b.created_at DESC LIMIT 50`);
  res.json({
    success: true,
    data: r.rows.map((x) => ({
      id: x.id, status: x.status, quantity: x.quantity, totalAmount: x.total_cents / 100,
      createdAt: x.created_at, userEmail: x.email, eventTitle: x.title,
    })),
  });
}));

router.get('/audit-logs', asyncHandler(async (_req, res) => {
  const r = await pool.query(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.meta, a.created_at, u.email
     FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 50`);
  res.json({ success: true, data: r.rows });
}));

export default router;
