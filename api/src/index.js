import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { initPg } from './db-pg.js';
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
import adminRoutes from './routes/admin.js';
import meRoutes from './routes/me.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/profiles', profileRoutes);
app.use('/api/v1/medications', medicationRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.get('/api/v1/ping', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/emergency', emergencyRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/drugs', drugRoutes);
app.use('/api/v1/me', meRoutes);
app.use('/admin', express.static(join(__dirname, 'admin')));
app.use('/api/v1/emergency-contacts', emergencyContactRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

await initDb();
await initPg();
startScheduler();
app.listen(PORT, () => {
  console.log(`Famicare API running on http://localhost:${PORT}`);
});
