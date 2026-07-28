import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireProfileAccess, canManageRecord } from '../middleware/access.js';
import { requireSubscription } from '../middleware/subscription.js';

const router = Router();
router.use(authMiddleware);
router.use(requireSubscription);

router.get('/profile/:profileId', (req, res) => {
  const profile = requireProfileAccess(req, res, req.params.profileId);
  if (!profile) return;
  const appointments = db.data.appointments.filter(a => a.profileId === profile.id);
  res.json(appointments);
});

router.post('/', async (req, res) => {
  const { profileId, title, location, doctorName, date, time, notes } = req.body;
  if (!profileId || !title) return res.status(400).json({ error: 'Profil ID ve başlık gerekli' });
  const profile = requireProfileAccess(req, res, profileId);
  if (!profile) return;
  if (!isValidAppointment(date, time)) return res.status(400).json({ error: 'Geçerli tarih ve saat girin' });
  const appointment = {
    id: uuid(), profileId: profile.id, title, location: location || '', doctorName: doctorName || '',
    date: date || '', time: time || '', notes: notes || '', status: 'upcoming', createdAt: new Date().toISOString(),
  };
  db.data.appointments.push(appointment);
  await db.write();
  res.status(201).json(appointment);
});

router.put('/:id', async (req, res) => {
  const { record } = canManageRecord(req.user, 'appointments', req.params.id);
  if (!record) return res.status(404).json({ error: 'Randevu bulunamadı' });
  if ((req.body.date || req.body.time) && !isValidAppointment(req.body.date || record.date, req.body.time || record.time)) {
    return res.status(400).json({ error: 'Geçerli tarih ve saat girin' });
  }
  const idx = db.data.appointments.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Randevu bulunamadı' });
  const allowed = {};
  for (const key of ['title', 'location', 'doctorName', 'date', 'time', 'notes']) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }
  if (req.body.status !== undefined) {
    if (!['upcoming', 'completed', 'cancelled'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Geçersiz randevu statüsü' });
    }
    allowed.status = req.body.status;
  }
  db.data.appointments[idx] = { ...db.data.appointments[idx], ...allowed };
  await db.write();
  res.json(db.data.appointments[idx]);
});

router.delete('/:id', async (req, res) => {
  const { record } = canManageRecord(req.user, 'appointments', req.params.id);
  if (!record) return res.status(404).json({ error: 'Randevu bulunamadı' });
  db.data.appointments = db.data.appointments.filter(a => a.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

function isValidAppointment(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export default router;
