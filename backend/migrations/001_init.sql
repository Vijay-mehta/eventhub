-- EventHub PostgreSQL schema (bookings domain)
-- Events themselves live in MongoDB; event_inventory is the SQL-side projection
-- that owns seat counts so booking can be transactional.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS event_inventory (
  event_id        VARCHAR(24) PRIMARY KEY,           -- MongoDB ObjectId as string
  title           VARCHAR(200) NOT NULL,
  event_date      TIMESTAMPTZ NOT NULL,
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  total_seats     INTEGER NOT NULL CHECK (total_seats > 0),
  available_seats INTEGER NOT NULL,
  CONSTRAINT seats_in_range CHECK (available_seats >= 0 AND available_seats <= total_seats)
);

CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  event_id        VARCHAR(24) NOT NULL REFERENCES event_inventory(event_id),
  quantity        INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 10),
  total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
  status          VARCHAR(10) NOT NULL CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','EXPIRED')),
  hold_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_event_status ON bookings(event_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_pending_expiry ON bookings(hold_expires_at) WHERE status = 'PENDING';
-- A user can only have one active hold per event (prevents seat hoarding)
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_per_user_event
  ON bookings(user_id, event_id) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status      VARCHAR(10) NOT NULL CHECK (status IN ('SUCCESS','FAILED','REFUNDED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  entity     VARCHAR(30) NOT NULL,
  entity_id  VARCHAR(40),
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
