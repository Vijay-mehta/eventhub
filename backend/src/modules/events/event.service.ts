import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { pool, redis, tx } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { CATEGORIES, EventModel } from './event.model';

export const eventBody = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10),
  category: z.enum(CATEGORIES),
  date: z.coerce.date(),
  venue: z.string().trim().min(2),
  city: z.string().trim().min(2),
  price: z.coerce.number().min(0),
  totalSeats: z.coerce.number().int().min(1).max(100000),
  imageUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  details: z.record(z.string(), z.any()).optional(),
});
export const eventUpdateBody = eventBody.partial();

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(9),
  q: z.string().trim().optional(),
  category: z.enum(CATEGORIES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['date_asc', 'date_desc', 'price_asc', 'price_desc']).default('date_asc'),
});

const TTL = 60; // seconds
const listKey = (q: object) => `events:list:${JSON.stringify(q, Object.keys(q).sort())}`;
const detailKey = (id: string) => `events:detail:${id}`;

const toDto = (d: any) => ({
  id: String(d._id),
  title: d.title,
  description: d.description,
  category: d.category,
  date: d.date,
  venue: d.venue,
  city: d.city,
  price: d.price,
  totalSeats: d.totalSeats,
  imageUrl: d.imageUrl ?? null,
  details: d.details ?? {},
});

/** Invalidate: all cached lists + (optionally) one detail. SCAN instead of KEYS so Redis is never blocked. */
export async function invalidate(id?: string) {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, found] = await redis.scan(cursor, 'MATCH', 'events:list:*', 'COUNT', 200);
    cursor = next;
    keys.push(...found);
  } while (cursor !== '0');
  if (id) keys.push(detailKey(id));
  if (keys.length) await redis.del(...keys);
}

// Seat counts change on every booking, so they are NOT cached; only the Mongo part is.
async function withAvailability<T extends { id: string }>(items: T[]) {
  if (!items.length) return items.map((i) => ({ ...i, availableSeats: 0 }));
  const r = await pool.query('SELECT event_id, available_seats FROM event_inventory WHERE event_id = ANY($1)', [
    items.map((i) => i.id),
  ]);
  const map = new Map<string, number>(r.rows.map((x) => [x.event_id, x.available_seats]));
  return items.map((i) => ({ ...i, availableSeats: map.get(i.id) ?? 0 }));
}

export async function listEvents(q: z.infer<typeof listQuery>) {
  const key = listKey(q);
  let base: { items: ReturnType<typeof toDto>[]; meta: any } | null = null;
  const cached = await redis.get(key);
  if (cached) base = JSON.parse(cached);

  if (!base) {
    const filter: Record<string, any> = {};
    if (q.q) filter.$text = { $search: q.q };
    if (q.category) filter.category = q.category;
    if (q.from || q.to) filter.date = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    if (q.minPrice !== undefined || q.maxPrice !== undefined)
      filter.price = { ...(q.minPrice !== undefined && { $gte: q.minPrice }), ...(q.maxPrice !== undefined && { $lte: q.maxPrice }) };
    const sortMap = {
      date_asc: { date: 1 },
      date_desc: { date: -1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
    } as const;
    const [docs, total] = await Promise.all([
      EventModel.find(filter)
        .sort({ ...sortMap[q.sort], _id: 1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      EventModel.countDocuments(filter),
    ]);
    base = {
      items: docs.map(toDto),
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
    };
    await redis.set(key, JSON.stringify(base), 'EX', TTL);
  }
  return { items: await withAvailability(base.items), meta: base.meta };
}

export async function getEvent(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  let dto: ReturnType<typeof toDto> | null = null;
  const cached = await redis.get(detailKey(id));
  if (cached) dto = JSON.parse(cached);
  if (!dto) {
    const doc = await EventModel.findById(id).lean();
    if (!doc) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    dto = toDto(doc);
    await redis.set(detailKey(id), JSON.stringify(dto), 'EX', TTL);
  }
  return (await withAvailability([dto]))[0];
}

const cents = (price: number) => Math.round(price * 100);

export async function createEvent(input: z.infer<typeof eventBody>) {
  const doc = await EventModel.create(input);
  const id = String(doc._id);
  try {
    await pool.query(
      `INSERT INTO event_inventory (event_id,title,event_date,price_cents,total_seats,available_seats)
       VALUES ($1,$2,$3,$4,$5,$5)`,
      [id, doc.title, doc.date, cents(doc.price), doc.totalSeats]
    );
  } catch (e) {
    await EventModel.deleteOne({ _id: doc._id }); // compensate: Mongo and Postgres are separate stores
    throw e;
  }
  await invalidate();
  return getEvent(id);
}

export async function updateEvent(id: string, input: z.infer<typeof eventUpdateBody>) {
  if (!isValidObjectId(id)) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  const existing = await EventModel.findById(id);
  if (!existing) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  const next = { ...existing.toObject(), ...input };

  await tx(async (c) => {
    const inv = await c.query('SELECT total_seats, available_seats FROM event_inventory WHERE event_id=$1 FOR UPDATE', [id]);
    if (!inv.rowCount) throw new AppError(404, 'EVENT_NOT_FOUND', 'Inventory missing');
    const { total_seats, available_seats } = inv.rows[0];
    const newAvailable = available_seats + (next.totalSeats - total_seats);
    if (newAvailable < 0)
      throw new AppError(409, 'SEATS_BELOW_BOOKED', 'Total seats cannot be lower than already booked/held seats');
    await c.query(
      `UPDATE event_inventory SET title=$2,event_date=$3,price_cents=$4,total_seats=$5,available_seats=$6 WHERE event_id=$1`,
      [id, next.title, next.date, cents(next.price), next.totalSeats, newAvailable]
    );
  });
  await EventModel.updateOne({ _id: id }, input);
  await invalidate(id);
  return getEvent(id);
}

export async function deleteEvent(id: string) {
  if (!isValidObjectId(id)) throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
  await tx(async (c) => {
    const b = await c.query('SELECT 1 FROM bookings WHERE event_id=$1 LIMIT 1', [id]);
    if (b.rowCount) throw new AppError(409, 'EVENT_HAS_BOOKINGS', 'Events with bookings cannot be deleted');
    await c.query('DELETE FROM event_inventory WHERE event_id=$1', [id]);
  });
  await EventModel.deleteOne({ _id: id });
  await invalidate(id);
}
