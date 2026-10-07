import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectMongo, pool, redis } from '../config/db';
import { EventModel } from '../modules/events/event.model';

const DAY = 86400000;
const at = (days: number, hour = 19) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/450`;

const concerts = [
  ['Arijit Singh Live', 'Arijit Singh', 'Jaipur', 'Sawai Mansingh Stadium', 2500],
  ['Coldplay Tribute Night', 'The Cold Tribute', 'Delhi', 'Jawaharlal Nehru Stadium', 1800],
  ['Sufi Evenings', 'Nooran Sisters', 'Jaipur', 'Jawahar Kala Kendra', 1200],
  ['Prateek Kuhad Acoustic', 'Prateek Kuhad', 'Mumbai', 'NCPA', 2000],
  ['Rajasthan Folk Fest', 'Mame Khan', 'Jodhpur', 'Mehrangarh Fort', 900],
  ['Jazz Under The Stars', 'Louis Banks Quartet', 'Bengaluru', 'Phoenix Arena', 1500],
  ['Electronic Beats Night', 'DJ Nucleya', 'Pune', 'Sunburn Arena', 2200],
];
const workshops = [
  ['React Performance Masterclass', 'Dan Reed', 'Bengaluru', 'Tech Hub', 1500],
  ['Node.js Scalability Workshop', 'Priya Nair', 'Jaipur', 'Innovation Lab', 1200],
  ['UX Design Sprint', 'Aman Kapoor', 'Delhi', 'Design Studio', 1000],
  ['Intro to Machine Learning', 'Dr. Meera Iyer', 'Hyderabad', 'IIIT Campus', 800],
  ['Photography Bootcamp', 'Raghu Rai Jr.', 'Jaipur', 'Albert Hall Lawn', 700],
  ['TypeScript Deep Dive', 'Sara Khan', 'Pune', 'Code Garage', 900],
];
const conferences = [
  ['Rajasthan Tech Summit', ['Satya R.', 'Nidhi Gupta'], 'Jaipur', 'JECC', 3500],
  ['AI Everywhere Conference', ['Andrew P.', 'Lakshmi V.'], 'Bengaluru', 'KTPO Convention', 5000],
  ['Startup Founders Meet', ['Kunal S.', 'Ritu M.'], 'Mumbai', 'Jio World Centre', 2500],
  ['DevOps Days India', ['Gaurav T.', 'Neha B.'], 'Hyderabad', 'HICC', 3000],
  ['Product Management Summit', ['Anita D.', 'Rohan J.'], 'Delhi', 'Taj Palace', 2800],
];
const sports = [
  ['Rajasthan Royals vs Mumbai Indians', ['RR', 'MI'], 'Jaipur', 'SMS Stadium', 1500],
  ['Pro Kabaddi: Jaipur Pink Panthers', ['JPP', 'PKP'], 'Jaipur', 'SMS Indoor', 600],
  ['City Marathon 10K', ['Open'], 'Delhi', 'India Gate', 500],
  ['ISL Football Derby', ['FCG', 'MBSG'], 'Kolkata', 'Salt Lake Stadium', 1100],
  ['Badminton Open Finals', ['Singles', 'Doubles'], 'Hyderabad', 'Gachibowli Stadium', 800],
];

(async () => {
  await connectMongo();
  await pool.query('TRUNCATE payments, bookings, refresh_tokens, audit_logs, event_inventory, users RESTART IDENTITY CASCADE');
  await EventModel.deleteMany({});
  await redis.flushdb();

  const mk = (name: string, email: string, pw: string, role: string) =>
    bcrypt.hash(pw, 10).then((h) =>
      pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4)', [name, email, h, role]));
  await mk('Admin', 'admin@eventhub.com', 'Admin@123', 'admin');
  await mk('Test User One', 'user1@eventhub.com', 'User@123', 'user');
  await mk('Test User Two', 'user2@eventhub.com', 'User@123', 'user');

  const docs: any[] = [];
  let n = 0;
  const lorem = (t: string) => `${t} - an unforgettable experience. Book early, seats are limited. Doors open one hour before the start.`;
  for (const [t, artist, city, venue, price] of concerts)
    docs.push({ title: t, category: 'concert', city, venue, price, details: { artist, genre: 'Live music' }, seed: ++n });
  for (const [t, speaker, city, venue, price] of workshops)
    docs.push({ title: t, category: 'workshop', city, venue, price, details: { speaker, durationHours: 6, level: 'Intermediate' }, seed: ++n });
  for (const [t, speakers, city, venue, price] of conferences)
    docs.push({ title: t, category: 'conference', city, venue, price, details: { speakers, tracks: 3 }, seed: ++n });
  for (const [t, teams, city, venue, price] of sports)
    docs.push({ title: t, category: 'sports', city, venue, price, details: { teams, sport: 'Mixed' }, seed: ++n });

  const created = [];
  for (const [i, d] of docs.entries()) {
    const { seed, ...rest } = d;
    created.push(
      await EventModel.create({
        ...rest,
        description: lorem(d.title),
        date: at(3 + i * 2, 10 + (i % 10)),
        totalSeats: [50, 100, 200, 500][i % 4],
        imageUrl: img(`eh${seed}`),
      })
    );
  }
  // Demo events for edge cases: tiny capacity (race-condition test) and < 24h away (cancel-rule test)
  created.push(await EventModel.create({ title: 'Last Seat Showdown', description: lorem('Only 1 seat, try booking it from two users at once'), category: 'workshop', city: 'Jaipur', venue: 'Demo Hall', price: 100, totalSeats: 1, date: at(10), details: { speaker: 'Demo' } }));
  created.push(await EventModel.create({ title: 'Tomorrow Morning Meetup (cancel locked)', description: lorem('Starts in under 24 hours'), category: 'conference', city: 'Jaipur', venue: 'Demo Hall', price: 200, totalSeats: 30, date: new Date(Date.now() + 12 * 3600000), details: { speakers: ['Demo'] } }));

  for (const e of created)
    await pool.query(
      `INSERT INTO event_inventory (event_id,title,event_date,price_cents,total_seats,available_seats) VALUES ($1,$2,$3,$4,$5,$5)`,
      [String(e._id), e.title, e.date, Math.round(e.price * 100), e.totalSeats]
    );

  console.log(`Seeded ${created.length} events, 1 admin, 2 users`);
  console.log('admin@eventhub.com / Admin@123   |   user1@eventhub.com / User@123');
  await pool.end();
  await mongoose.disconnect();
  redis.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
