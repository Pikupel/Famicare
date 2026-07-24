import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  const { profileId, locationLat, locationLng } = req.body;
  const emergency = {
    id: uuid(), profileId: profileId || req.user.id,
    status: 'active', triggeredBy: 'elderly',
    locationLat: locationLat || null, locationLng: locationLng || null,
    notifiedAt: new Date().toISOString(), resolvedAt: null, resolvedBy: null, note: '',
    createdAt: new Date().toISOString(),
  };
  db.data.emergencies.push(emergency);
  await db.write();
  res.status(201).json(emergency);
});

router.get('/', authMiddleware, (req, res) => {
  const emergencies = db.data.emergencies.filter(e => e.profileId === req.user.id);
  res.json(emergencies);
});

router.put('/:id', authMiddleware, async (req, res) => {
  const { status, note } = req.body;
  const idx = db.data.emergencies.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  db.data.emergencies[idx].status = status || db.data.emergencies[idx].status;
  db.data.emergencies[idx].note = note || db.data.emergencies[idx].note;
  if (status === 'resolved') db.data.emergencies[idx].resolvedAt = new Date().toISOString();
  await db.write();
  res.json(db.data.emergencies[idx]);
});

export default router;
