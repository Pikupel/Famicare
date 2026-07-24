import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/profile/:profileId', (req, res) => {
  const appointments = db.data.appointments.filter(a => a.profileId === req.params.profileId);
  res.json(appointments);
});

router.post('/', async (req, res) => {
  const { profileId, title, location, doctorName, date, time, notes } = req.body;
  if (!profileId || !title) return res.status(400).json({ error: 'Profil ID ve başlık gerekli' });
  const appointment = {
    id: uuid(), profileId, title, location: location || '', doctorName: doctorName || '',
    date: date || '', time: time || '', notes: notes || '', status: 'upcoming', createdAt: new Date().toISOString(),
  };
  db.data.appointments.push(appointment);
  await db.write();
  res.status(201).json(appointment);
});

router.put('/:id', async (req, res) => {
  const idx = db.data.appointments.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Randevu bulunamadı' });
  db.data.appointments[idx] = { ...db.data.appointments[idx], ...req.body };
  await db.write();
  res.json(db.data.appointments[idx]);
});

router.delete('/:id', async (req, res) => {
  db.data.appointments = db.data.appointments.filter(a => a.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

export default router;
