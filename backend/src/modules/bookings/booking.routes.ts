import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { bookingLimiter } from '../../middleware/rateLimit';
import { cancel, getBooking, holdSeats, myBookings, pay } from './booking.service';

const router = Router();
router.use(authenticate);

const holdSchema = z.object({
  eventId: z.string().length(24),
  quantity: z.coerce.number().int().min(1).max(6),
});

router.post(
  '/hold',
  bookingLimiter,
  validateBody(holdSchema),
  asyncHandler(async (req, res) => {
    const b = await holdSeats(req.user!.id, req.body.eventId, req.body.quantity);
    res.status(201).json({ success: true, data: b });
  })
);

router.get('/me', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await myBookings(req.user!.id) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getBooking(req.user!.id, req.params.id) });
}));

router.post('/:id/pay', bookingLimiter, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await pay(req.user!.id, req.params.id) });
}));

router.post('/:id/cancel', bookingLimiter, asyncHandler(async (req, res) => {
  res.json({ success: true, data: await cancel(req.user!.id, req.params.id) });
}));

export default router;
