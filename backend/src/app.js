import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import attendanceRoutes from './routes/attendance.js';
import geofenceRoutes from './routes/geofence.js';
import leaveRoutes from './routes/leave.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();

// CORS middleware — must run before anything that can short-circuit the
// request (rate limiter, auth, etc.), otherwise blocked/errored responses
// go out without CORS headers and the browser reports a misleading
// "CORS policy" error instead of the real cause (e.g. a 429).
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  })
);

// Security middleware
app.use(helmet());

// Rate limiting — much higher in development so active testing doesn't trip it;
// keep this tight in production.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 5000,
});
app.use(limiter);

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/geofence', geofenceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
