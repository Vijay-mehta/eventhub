import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate, requireRole } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { audit } from '../../utils/audit';
import { seatBus } from '../../utils/seatBus';
import { eventBody, eventUpdateBody, listQuery, createEvent, deleteEvent, getEvent, listEvents, updateEvent } from './event.service';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { items, meta } = await listEvents(listQuery.parse(req.query));
    res.json({ success: true, data: items, meta });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getEvent(req.params.id) });
  })
);

// Bonus: Server-Sent Events stream of live seat counts for one event
router.get(
  '/:id/stream',
  asyncHandler(async (req, res) => {
    const ev = await getEvent(req.params.id);
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    const send = (n: number) => res.write(`data: ${JSON.stringify({ availableSeats: n })}\n\n`);
    send(ev.availableSeats);
    const channel = `seats:${ev.id}`;
    seatBus.on(channel, send);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => {
      clearInterval(ping);
      seatBus.off(channel, send);
    });
  })
);

router.post(
  '/',
  authenticate,
  requireRole('admin'),
  validateBody(eventBody),
  asyncHandler(async (req, res) => {
    const ev = await createEvent(req.body);
    await audit(req.user!.id, 'EVENT_CREATED', 'event', ev.id, { title: ev.title });
    res.status(201).json({ success: true, data: ev });
  })
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  validateBody(eventUpdateBody),
  asyncHandler(async (req, res) => {
    const ev = await updateEvent(req.params.id, req.body);
    await audit(req.user!.id, 'EVENT_UPDATED', 'event', ev.id, req.body);
    res.json({ success: true, data: ev });
  })
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await deleteEvent(req.params.id);
    await audit(req.user!.id, 'EVENT_DELETED', 'event', req.params.id);
    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;
