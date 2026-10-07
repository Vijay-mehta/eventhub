import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import eventRoutes from './modules/events/event.routes';
import bookingRoutes from './modules/bookings/booking.routes';
import adminRoutes from './modules/admin/admin.routes';
import { openapi } from './docs/openapi';

export const app = express();
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

const v1 = express.Router();
v1.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
v1.use('/auth', authRoutes);
v1.use('/events', eventRoutes);
v1.use('/bookings', bookingRoutes);
v1.use('/admin', adminRoutes);

app.use('/api/v1', v1);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.get('/api/docs.json', (_req, res) => res.json(openapi));

app.use(notFound);
app.use(errorHandler);
