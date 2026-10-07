import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export interface AuthUser {
  id: string;
  role: 'user' | 'admin';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  // Browser: httpOnly cookie. Tools like curl/Postman may still send "Authorization: Bearer <jwt>".
  const header = req.headers.authorization;
  const token: string | undefined = req.cookies?.accessToken ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Missing access token');
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; role: AuthUser['role'] };
    req.user = { id: p.sub, role: p.role };
    next();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token');
  }
};

export const requireRole =
  (role: AuthUser['role']): RequestHandler =>
  (req, _res, next) => {
    if (req.user?.role !== role) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this resource');
    next();
  };
