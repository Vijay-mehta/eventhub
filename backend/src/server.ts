import { app } from './app';
import { env } from './config/env';
import { connectMongo, pool, redis } from './config/db';
import { releaseExpiredHolds } from './modules/bookings/booking.service';

async function main() {
  await connectMongo();
  await pool.query('SELECT 1');
  await redis.ping();

  const server = app.listen(env.PORT, () => {
    console.log(`API:  http://localhost:${env.PORT}/api/v1`);
    console.log(`Docs: http://localhost:${env.PORT}/api/docs`);
  });

  // Background job: give seats back when a 5-minute hold lapses
  setInterval(() => releaseExpiredHolds().catch((e) => console.error('sweeper', e)), 15_000);

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Failed to start', e);
  process.exit(1);
});
