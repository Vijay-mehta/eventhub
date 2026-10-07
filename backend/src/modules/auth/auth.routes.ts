import { CookieOptions, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import { env } from '../../config/env';
import { pool } from '../../config/db';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { loginLimiter } from '../../middleware/rateLimit';

const router = Router();
const REFRESH_DAYS = 7;
const ACCESS_MINUTES = 15;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

type UserRow = { id: string; name: string; email: string; role: 'user' | 'admin'; password_hash?: string };
const publicUser = (u: UserRow) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// ---- Cookies -------------------------------------------------------------------------------
// accessToken  : httpOnly, 15 min, sent to every API call      (JS can NEVER read it)
// refreshToken : httpOnly, 7 days, only sent to /api/v1/auth    (JS can NEVER read it)
// eh_session   : NOT httpOnly, just the flag "1". Lets the Next.js middleware know whether to show the
//                login page or the app. It carries no secret; the API still verifies the real JWT.
const base: CookieOptions = { sameSite: 'lax', secure: env.NODE_ENV === 'production' };
const ACCESS_PATH = '/';
const REFRESH_PATH = '/api/v1/auth';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, { ...base, httpOnly: true, path: ACCESS_PATH, maxAge: ACCESS_MINUTES * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...base, httpOnly: true, path: REFRESH_PATH, maxAge: REFRESH_DAYS * 86400 * 1000 });
  res.cookie('eh_session', '1', { ...base, httpOnly: false, path: '/', maxAge: REFRESH_DAYS * 86400 * 1000 });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('accessToken', { ...base, httpOnly: true, path: ACCESS_PATH });
  res.clearCookie('refreshToken', { ...base, httpOnly: true, path: REFRESH_PATH });
  res.clearCookie('eh_session', { ...base, httpOnly: false, path: '/' });
}

async function issueTokens(user: UserRow, res: Response) {
  const accessToken = jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: `${ACCESS_MINUTES}m`,
  });
  const refreshToken = jwt.sign({ jti: randomUUID() }, env.JWT_REFRESH_SECRET, {
    subject: user.id,
    expiresIn: `${REFRESH_DAYS}d`,
  });
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2, now() + ($3 || ' days')::interval)`,
    [user.id, sha256(refreshToken), String(REFRESH_DAYS)]
  );
  setAuthCookies(res, accessToken, refreshToken);
}

router.post(
  '/register',
  loginLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const exists = await pool.query('SELECT 1 FROM users WHERE email=$1', [email]);
    if (exists.rowCount) throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'user') RETURNING id,name,email,role`,
      [name, email, hash]
    );
    await issueTokens(r.rows[0], res);
    res.status(201).json({ success: true, data: { user: publicUser(r.rows[0]) } });
  })
);

router.post(
  '/login',
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user: UserRow | undefined = r.rows[0];
    // same error for unknown email and wrong password: no account enumeration
    if (!user || !(await bcrypt.compare(password, user.password_hash!)))
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    await issueTokens(user, res);
    res.json({ success: true, data: { user: publicUser(user) } });
  })
);

// Refresh-token rotation: the old token is deleted and a new pair is issued.
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const reject = (msg: string): never => {
      clearAuthCookies(res); // session is over: also drops the eh_session flag so the UI goes to /login
      throw new AppError(401, 'UNAUTHORIZED', msg);
    };
    const token = req.cookies?.refreshToken;
    if (!token) return reject('No refresh token');
    let sub: string;
    try {
      sub = (jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string }).sub;
    } catch {
      return reject('Invalid refresh token');
    }
    const del = await pool.query(
      'DELETE FROM refresh_tokens WHERE token_hash=$1 AND expires_at > now() RETURNING user_id',
      [sha256(token)]
    );
    if (!del.rowCount) return reject('Refresh token revoked or expired');
    const u = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [sub]);
    if (!u.rowCount) return reject('User not found');
    await issueTokens(u.rows[0], res);
    res.json({ success: true, data: { user: publicUser(u.rows[0]) } });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken;
    if (token) await pool.query('DELETE FROM refresh_tokens WHERE token_hash=$1', [sha256(token)]);
    clearAuthCookies(res);
    res.json({ success: true, data: { loggedOut: true } });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const u = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [req.user!.id]);
    if (!u.rowCount) throw new AppError(401, 'UNAUTHORIZED', 'User not found');
    res.json({ success: true, data: { user: publicUser(u.rows[0]) } });
  })
);

export default router;
