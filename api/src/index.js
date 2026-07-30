import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { startScheduler } from './services/scheduler.js';
import authRoutes from './routes/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
import profileRoutes from './routes/profiles.js';
import medicationRoutes from './routes/medications.js';
import appointmentRoutes from './routes/appointments.js';
import healthRoutes from './routes/health.js';
import emergencyRoutes from './routes/emergency.js';
import emergencyContactRoutes from './routes/emergency-contacts.js';
import drugRoutes from './routes/drugs.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import meRoutes from './routes/me.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
}
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && !allowedOrigins.length) return callback(null, true);
    callback(new Error('CORS origin reddedildi'));
  },
}));
app.use(express.json({ limit: '100kb' }));
app.disable('x-powered-by');

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/v1/ping',
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/medications', medicationRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.get('/api/v1/ping', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/emergency', emergencyRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/drugs', drugRoutes);
app.use('/api/v1/me', meRoutes);
const publicDir = join(__dirname, 'public');
app.get('/privacy', (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.sendFile(join(publicDir, 'privacy.html'));
});
app.get('/delete-account', (req, res) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.sendFile(join(publicDir, 'delete-account.html'));
});
app.get('/delete-account.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.type('application/javascript').sendFile(join(publicDir, 'delete-account.js'));
});
app.use('/admin', (req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  next();
}, express.static(join(__dirname, 'admin')));
app.use('/api/v1/emergency-contacts', emergencyContactRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

await initDb();
if (process.env.ALLOW_UNVERIFIED_REGISTRATION === 'true') {
  console.warn('[SECURITY] SMS doğrulaması devre dışı: ALLOW_UNVERIFIED_REGISTRATION=true');
}
startScheduler();
app.listen(PORT, () => {
  console.log(`Famicare API running on http://localhost:${PORT}`);
});
