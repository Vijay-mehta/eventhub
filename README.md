# EventHub: Event Booking Portal

A full-stack web portal where users browse events and book tickets, and admins manage events and see bookings and revenue.

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Databases:** MongoDB (events), PostgreSQL (bookings), Redis (cache, seat holds, rate limits)

> **Demo video:** ''  |  **API docs (Swagger):** `http://localhost:4000/api/docs` after you start the backend

---

## 1. What the app does

**For users**
1. Sign up and log in
2. Browse events with search, filters, sorting and pagination
3. Hold seats for 5 minutes (a countdown timer is shown)
4. Pay (mock payment) and see the booking in **My Bookings**
5. Cancel a booking, up to 24 hours before the event
6. See the seat count change live while looking at an event

**For admins**
1. Create, edit and delete events (each category has its own extra fields)
2. See stats: events, users, tickets sold, revenue
3. See the top 5 events by revenue and all recent bookings

---

## 2. Requirements checklist

Every point of the assignment, and where it is done:

| Requirement | How it is done | Where to look |
|---|---|---|
| Register / login with JWT access + refresh tokens, hashed passwords | bcrypt passwords; short-lived access token + rotating refresh token in httpOnly cookies | `backend/src/modules/auth/auth.routes.ts` |
| Role-based access (user, admin) on API and UI | `requireRole('admin')` middleware on the API; `AdminGuard` and hidden links in the UI | `backend/src/middleware/auth.ts`, `frontend/components/AdminGuard.tsx` |
| Event CRUD (admin only) with flexible fields | MongoDB `details` object holds `artist`, `speaker`, `teams`, ... per category | `backend/src/modules/events/` |
| Pagination, search, filters, sorting | One endpoint, all done in MongoDB | `event.service.ts` (`listEvents`) |
| Proper indexes + note | See [Section 6](#6-mongodb-indexes) | `event.model.ts` |
| Normalized SQL schema with FKs and constraints | 6 tables, see [Section 5](#5-database-design-postgresql) | `backend/migrations/001_init.sql` |
| No overbooking on the last seat | One atomic SQL update, see [Section 4.1](#41-no-overbooking-the-last-seat-problem) | `booking.service.ts` (`holdSeats`) |
| Cancel up to 24 h before, seats released | Checked in SQL using the database clock | `booking.service.ts` (`cancel`) |
| Mock payment (random success / failure) | About 70% success | `booking.service.ts` (`pay`) |
| One reporting query | Top 5 events by revenue | `admin.routes.ts` (`/reports/top-events`) |
| Redis: cache + invalidation | Event list and detail cached 60 s, cleared on any change | `event.service.ts` |
| Redis: 5-minute seat hold (TTL) | Redis key with `EX 300` + `hold_expires_at` in Postgres | `booking.service.ts` |
| Redis: rate limiting | Login/register 10 per minute, booking endpoints 20 per minute | `backend/src/middleware/rateLimit.ts` |
| Versioned API, validation, one error format | `/api/v1`, Zod validation, central error handler | `backend/src/middleware/errorHandler.ts` |
| Swagger / OpenAPI | Swagger UI at `/api/docs` | `backend/src/docs/openapi.ts` |
| SSR event list with SEO + dynamic detail page | Server components, `metadata` and `generateMetadata` | `frontend/app/page.tsx`, `frontend/app/events/[id]/page.tsx` |
| Booking flow with countdown, My Bookings | Hold, checkout with timer, pay, list | `frontend/app/checkout/`, `frontend/app/bookings/` |
| Admin dashboard (table + stats) | Stats cards, top-5 table, events table | `frontend/app/admin/page.tsx` |
| Responsive, loading / empty / error states, accessibility | Tailwind grid; spinner, empty and error components; labels, ARIA, skip link | `frontend/components/States.tsx` |
| **Bonus:** live seat updates | Server-Sent Events | `GET /api/v1/events/:id/stream` |
| **Bonus:** audit logs | `audit_logs` table | `backend/src/utils/audit.ts` |
| Seed script: 20+ events, 2 users, 1 admin | 25 events, 2 users, 1 admin | `backend/src/scripts/seed.ts` |

Not implemented: email notifications through a queue (see [Section 11](#11-what-i-would-improve-with-more-time)).

---

## 3. Run it on your computer

### What you need installed

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18 or newer | https://nodejs.org |
| MongoDB | 6 or 7 | Windows: MongoDB Community installer (run as a service). Mac: `brew install mongodb-community`. Linux: official apt repo |
| PostgreSQL | 14 or newer | Remember the password you set for the `postgres` user |
| Redis | 6 or newer | Windows: Memurai Developer (free) or Redis inside WSL. Mac: `brew install redis`. Linux: `apt install redis-server` |

Make sure all three databases are **running** on their default ports (MongoDB 27017, PostgreSQL 5432, Redis 6379).
Hosted free tiers also work (MongoDB Atlas, Neon, Upstash). Just paste their connection strings into `backend/.env`.

### Step 1: Backend

```bash
cd backend
cp .env.example .env        # Windows: copy .env.example .env
```

Open `backend/.env` and put your PostgreSQL password into `DATABASE_URL`:

```
DATABASE_URL=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/eventhub
```

Then run:

```bash
npm install
npm run migrate     # creates the "eventhub" database and all tables
npm run seed        # adds 25 events, 1 admin and 2 users
npm run dev         # API on http://localhost:4000
```

### Step 2: Frontend (open a second terminal)

```bash
cd frontend
cp .env.example .env.local  # Windows: copy .env.example .env.local
npm install
npm run dev                 # app on http://localhost:3000
```

Open **http://localhost:3000** (use `localhost`, not `127.0.0.1`, so cookies work).

### Test accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@eventhub.com` | `Admin@123` |
| User | `user1@eventhub.com` | `User@123` |
| User | `user2@eventhub.com` | `User@123` |

### Things worth trying

| Try this | What you will see |
|---|---|
| Open the home page while logged out | You are sent to the login page |
| Hold seats on any event, wait on the checkout page | A 5-minute countdown; after it ends the seats are released |
| Pay several times | The mock payment fails sometimes; retry before the timer ends |
| Open **"Last Seat Showdown"** (1 seat) as two users at the same moment | Only one of them gets the seat |
| Open an event in two browser windows and hold seats in one | The seat count in the other window changes live |
| Try to cancel a confirmed booking for **"Tomorrow Morning Meetup"** | Refused: it starts in under 24 hours |
| Log in as admin | Admin dashboard with stats, top 5 report, and event management |

### Environment variables

`backend/.env.example`

| Variable | Meaning |
|---|---|
| `PORT` | API port (4000) |
| `MONGO_URL` | MongoDB connection string |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Secrets used to sign tokens. Change them. |
| `CLIENT_URL` | Frontend address allowed by CORS (`http://localhost:3000`) |

`frontend/.env.example`

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | API address used by the browser |
| `API_URL` | API address used by the Next.js server when rendering pages |

No secrets are committed. Only the `.env.example` files are in the repository.

---

## 4. How the important parts work

### 4.1 No overbooking (the "last seat" problem)

**The problem:** two people click "Book" on the last seat at the same time. A naive app reads "1 seat left" for both, and sells it twice.

**The solution:** the check and the seat decrease happen in **one SQL statement**:

```sql
UPDATE event_inventory
SET available_seats = available_seats - $2
WHERE event_id = $1 AND available_seats >= $2 AND event_date > now();
```

PostgreSQL locks that row while the statement runs:

1. User A's update runs: seats go from 1 to 0.
2. User B's update **waits** for A to finish.
3. B's update re-checks `available_seats >= 1`, which is now false, so it changes **0 rows**.
4. The API answers B with `409 NOT_ENOUGH_SEATS`.

There is no gap between "check" and "update", so the race cannot happen. A database rule (`CHECK available_seats >= 0`) is a second safety net.
Tested with 5 simultaneous requests for 1 seat: exactly 1 succeeded.

### 4.2 Seat hold (5 minutes)

1. **Hold:** seats are taken immediately and a `PENDING` booking is created with `hold_expires_at = now + 5 minutes`. A Redis key `hold:<bookingId>` with a 300-second TTL is created too.
2. **Pay:** if the payment succeeds the booking becomes `CONFIRMED`. If it fails, the hold stays so the user can try again.
3. **Expiry:** a background job runs every 15 seconds. It marks expired holds as `EXPIRED` and returns their seats, in one atomic SQL statement.
4. An expired hold can never be paid, because the payment code checks the expiry itself.
5. The countdown on the page uses `secondsLeft` calculated by the **database clock**, so a wrong clock on the user's computer cannot cheat it.

PostgreSQL is the source of truth for the hold. The Redis key mirrors it, as the assignment asked.

```mermaid
stateDiagram-v2
    [*] --> PENDING: hold seats
    PENDING --> CONFIRMED: payment succeeds
    PENDING --> EXPIRED: 5 minutes pass
    PENDING --> CANCELLED: user releases seats
    CONFIRMED --> CANCELLED: cancel (at least 24 h before event)
```

### 4.3 Cancellation

Allowed only when the event is **at least 24 hours away**. In one transaction the booking becomes `CANCELLED`, the seats go back into the inventory, and the payment is marked `REFUNDED`. A pending hold can always be released.

### 4.4 Why three databases

| Store | Holds | Why this one |
|---|---|---|
| **MongoDB** | Event content (title, venue, category, `details`) | Each category has different fields (artist, speaker, teams). A document fits better than many empty SQL columns |
| **PostgreSQL** | Users, seat counts, bookings, payments | Needs transactions, constraints and row locks |
| **Redis** | Cache, seat-hold keys, rate-limit counters | Very fast, and keys expire automatically |

The two event stores are linked by id: the MongoDB `_id` is the `event_id` in PostgreSQL's `event_inventory` table. Seat counts live **only** in PostgreSQL.

### 4.5 Caching

- The event list and event detail are cached in Redis for 60 seconds.
- Only the MongoDB data is cached. **Seat counts are always read fresh** from PostgreSQL, so availability is never stale.
- When an admin creates, edits or deletes an event, the matching cache keys are deleted (using `SCAN`, which does not block Redis).

### 4.6 Authentication

| Cookie | Lifetime | Readable by JavaScript? | Purpose |
|---|---|---|---|
| `accessToken` | 15 minutes | No (httpOnly) | Sent on every API call |
| `refreshToken` | 7 days | No (httpOnly), sent only to `/api/v1/auth` | Gets a new access token |
| `eh_session` | 7 days | Yes, contains only `1` | Lets the Next.js middleware choose login page or app |

- Passwords are hashed with bcrypt.
- Refresh tokens are stored **hashed** in the database and are **single use**: every refresh replaces the old one.
- The browser sends cookies automatically. When the access cookie expires, the frontend calls `/auth/refresh` once and retries.
- **Why cookies and not localStorage:** any script injected into the page can read localStorage. It cannot read an httpOnly cookie.
- **CSRF protection:** cookies are `SameSite=Lax`, CORS allows only the frontend origin, and all changing requests need a JSON body.
- Logged-out visitors are redirected to the login page by `frontend/middleware.ts`. The real security is on the API: it checks the token and role on every request.

### 4.7 Live seat updates (bonus)

`GET /api/v1/events/:id/stream` keeps a connection open (Server-Sent Events). Whenever seats are held, released or expire, the server pushes the new count and every open event page updates without a refresh.

### 4.8 One error format

Every error from the API looks the same, so the frontend handles errors in one place:

```json
{ "success": false, "error": { "code": "NOT_ENOUGH_SEATS", "message": "Not enough seats available" } }
```

Status codes are used on purpose: 400 invalid input, 401 not logged in, 402 payment failed, 403 not allowed, 404 not found, 409 conflict (sold out), 410 hold expired, 422 cancellation window closed, 429 too many requests.

---

## 5. Database design (PostgreSQL)

```
users 1 ──< bookings >── 1 event_inventory
  │            │
  │            └──< payments
  ├──< refresh_tokens
  └──< audit_logs
```

| Table | Main columns | Key rules |
|---|---|---|
| `users` | id, name, email, password_hash, role | `email` unique; role is `user` or `admin` |
| `refresh_tokens` | user_id, token_hash, expires_at | token stored hashed; deleted with the user |
| `event_inventory` | event_id, title, event_date, price_cents, total_seats, available_seats | `CHECK (available_seats >= 0 AND available_seats <= total_seats)` |
| `bookings` | user_id, event_id, quantity, total_cents, status, hold_expires_at | status is `PENDING`, `CONFIRMED`, `CANCELLED` or `EXPIRED`; foreign keys to users and events |
| `payments` | booking_id, amount_cents, status | status is `SUCCESS`, `FAILED` or `REFUNDED` |
| `audit_logs` | user_id, action, entity, entity_id, meta | history of admin and booking actions |

Notable indexes:
- A **partial unique index** on `(user_id, event_id) WHERE status = 'PENDING'`: a user can have only one active hold per event.
- A **partial index** on `hold_expires_at WHERE status = 'PENDING'`: makes the expiry job fast.
- `(user_id, created_at DESC)` for My Bookings and `(event_id, status)` for reports.

Money is stored as whole numbers (paise) to avoid decimal rounding problems.

### The reporting query (top 5 events by revenue)

```sql
SELECT i.event_id, i.title, COUNT(b.id) AS bookings,
       SUM(b.quantity) AS tickets, SUM(b.total_cents) AS revenue_cents
FROM event_inventory i
JOIN bookings b ON b.event_id = i.event_id AND b.status = 'CONFIRMED'
GROUP BY i.event_id, i.title
ORDER BY revenue_cents DESC
LIMIT 5;
```

Only confirmed bookings count, so cancelled and expired ones never inflate revenue.

---

## 6. MongoDB indexes

| Index | Why |
|---|---|
| Text index on `title` (weight 5) and `description` | Keyword search, with title matches ranked higher |
| `{ category, date }` | The most common list: one category, ordered by date. One index serves both the filter and the sort |
| `{ date }` | Default sort and date-range filter |
| `{ price }` | Price filter and price sorting |

I did not index every field, because each extra index makes writes slower and uses memory.

---

## 7. API overview

Base URL: `http://localhost:4000/api/v1`. Full interactive docs: **http://localhost:4000/api/docs**
(log in with `POST /auth/login` inside Swagger and the browser sends the cookies automatically).

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Events (public) | `GET /events` (page, limit, q, category, from, to, minPrice, maxPrice, sort), `GET /events/:id`, `GET /events/:id/stream` |
| Events (admin) | `POST /events`, `PUT /events/:id`, `DELETE /events/:id` |
| Bookings (logged in) | `POST /bookings/hold`, `GET /bookings/me`, `GET /bookings/:id`, `POST /bookings/:id/pay`, `POST /bookings/:id/cancel` |
| Admin | `GET /admin/stats`, `GET /admin/reports/top-events`, `GET /admin/bookings`, `GET /admin/audit-logs` |
| Health | `GET /health` |

---

## 8. Project structure

```
eventhub/
├── backend/
│   ├── migrations/001_init.sql        all PostgreSQL tables, constraints, indexes
│   └── src/
│       ├── config/                    env.ts (validated settings), db.ts (databases + transaction helper)
│       ├── middleware/                auth, validation, rate limiting, error handling
│       ├── modules/
│       │   ├── auth/                  register, login, refresh, logout
│       │   ├── events/                model, service (list, cache, CRUD), routes
│       │   ├── bookings/              hold, pay, cancel, expiry job
│       │   └── admin/                 stats, top-5 report, bookings, audit logs
│       ├── docs/openapi.ts            Swagger spec
│       ├── scripts/                   migrate.ts, seed.ts
│       ├── utils/                     AppError, asyncHandler, audit, seatBus
│       ├── app.ts                     Express setup
│       └── server.ts                  start-up + expiry job
└── frontend/
    ├── app/                           pages: home, events/[id], login, register,
    │                                  checkout/[bookingId], bookings, admin
    ├── components/                    Navbar, EventCard, BookingPanel, Countdown,
    │                                  EventForm, AuthForm, AdminGuard, States
    ├── lib/                           api.ts (fetch + auto refresh), auth.tsx (login state),
    │                                  server.ts (server-side data), types, format
    └── middleware.ts                  login gate
```

---

## 9. Assumptions

- The currency is INR. Prices are stored as paise (whole numbers) in PostgreSQL and rupees in MongoDB.
- One booking holds at most 6 tickets.
- Events that have already started cannot be booked.
- The mock payment succeeds about 70% of the time. A failed attempt keeps the hold so the user can retry.
- An event that has bookings cannot be deleted (the API returns 409), to keep booking history intact.
- The frontend and API run on the same site (`localhost`), so `SameSite=Lax` cookies work.
- Only normal users can register. The admin account is created by the seed script.

## 10. Trade-offs and known limitations

- **Raw SQL instead of an ORM:** the locking and transaction logic stays visible and easy to explain.
- **MongoDB and PostgreSQL are kept in sync by the application**, not by a shared transaction. If the second write fails, the first is undone by hand.
- **Event pages are protected by a login redirect.** The `GET /events` API itself is public, because the pages are rendered on the server. Booking, admin and "my bookings" endpoints all require a login.
- **The live-seat feature uses an in-process event bus.** With several API servers it would need Redis pub/sub.
- **The expiry job runs inside the API process.** At scale it should be a separate worker.
- **Rate limits are per IP address.** Behind a proxy, `trust proxy` must be configured.
- **A hold can outlast an event that starts in under 5 minutes.** The fix is to cap `hold_expires_at` at the event's start time.
- **No automated tests yet.** I tested the booking race, cancellation rule, expiry job and cookie login by hand and with scripts.

## 11. What I would improve with more time

1. Automated tests: Jest and supertest, including a concurrency test for the last seat, run in CI
2. Email notifications for booking confirmation and cancellation through a queue (BullMQ)
3. A real payment provider with idempotency keys
4. Redis pub/sub for the live-seat feature so it works across several servers
5. Per-category validation of the `details` fields, and keyset pagination for very large lists
6. Detection of refresh-token reuse (revoke all sessions if an old token reappears)
7. An audit-log screen in the admin UI, image upload for events, and end-to-end tests with Playwright
8. A deployment pipeline (CI/CD) and hosting setup
