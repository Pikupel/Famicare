import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/profile/:profileId', (req, res) => {
  const { type } = req.query;
  let records = db.data.healthRecords.filter(r => r.profileId === req.params.profileId);
  if (type) records = records.filter(r => r.recordType === type);
  records.sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
  res.json(records);
});

router.post('/', async (req, res) => {
  const { profileId, recordType, valueData } = req.body;
  if (!profileId || !recordType) return res.status(400).json({ error: 'Profil ID ve tip gerekli' });
  const record = {
    id: uuid(), profileId, recordType, valueData: valueData || {},
    measuredAt: new Date().toISOString(), recordedBy: req.user.role === 'elderly' ? 'elderly' : 'caregiver',
  };
  db.data.healthRecords.push(record);
  await db.write();
  res.status(201).json(record);
});

router.patch('/:id', async (req, res) => {
  const { valueData } = req.body;
  const idx = db.data.healthRecords.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  db.data.healthRecords[idx].valueData = valueData || db.data.healthRecords[idx].valueData;
  await db.write();
  res.json(db.data.healthRecords[idx]);
});

router.delete('/:id', async (req, res) => {
  db.data.healthRecords = db.data.healthRecords.filter(r => r.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

export default router;
