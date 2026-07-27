import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireProfileAccess, canManageRecord } from '../middleware/access.js';

const router = Router();
router.use(authMiddleware);

router.get('/profile/:profileId', (req, res) => {
  const profile = requireProfileAccess(req, res, req.params.profileId);
  if (!profile) return;
  const { type } = req.query;
  let records = db.data.healthRecords.filter(r => r.profileId === profile.id);
  if (type) records = records.filter(r => r.recordType === type);
  records.sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt));
  res.json(records);
});

router.post('/', async (req, res) => {
  const { profileId, recordType, valueData, measuredAt } = req.body;
  if (!profileId || !recordType) return res.status(400).json({ error: 'Profil ID ve tip gerekli' });
  const profile = requireProfileAccess(req, res, profileId);
  if (!profile) return;
  if (!['blood_pressure', 'blood_sugar', 'weight'].includes(recordType)) return res.status(400).json({ error: 'Geçersiz ölçüm tipi' });
  const validationError = validateHealthValue(recordType, valueData);
  if (validationError) return res.status(400).json({ error: validationError });
  const record = {
    id: uuid(), profileId: profile.id, recordType, valueData: valueData || {},
    measuredAt: measuredAt && !Number.isNaN(Date.parse(measuredAt)) ? new Date(measuredAt).toISOString() : new Date().toISOString(),
    recordedBy: req.user.id,
  };
  db.data.healthRecords.push(record);
  await db.write();
  res.status(201).json(record);
});

router.patch('/:id', async (req, res) => {
  const { valueData } = req.body;
  const { record } = canManageRecord(req.user, 'healthRecords', req.params.id);
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  const validationError = validateHealthValue(record.recordType, valueData);
  if (validationError) return res.status(400).json({ error: validationError });
  const idx = db.data.healthRecords.findIndex(r => r.id === req.params.id);
  db.data.healthRecords[idx].valueData = valueData || db.data.healthRecords[idx].valueData;
  await db.write();
  res.json(db.data.healthRecords[idx]);
});

router.delete('/:id', async (req, res) => {
  const { record } = canManageRecord(req.user, 'healthRecords', req.params.id);
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  db.data.healthRecords = db.data.healthRecords.filter(r => r.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

function validateHealthValue(type, value = {}) {
  const number = key => Number(value?.[key]);
  if (type === 'blood_pressure') {
    if (number('systolic') < 50 || number('systolic') > 260 || number('diastolic') < 30 || number('diastolic') > 160) return 'Tansiyon değeri geçerli aralıkta değil';
    if (number('systolic') <= number('diastolic')) return 'Büyük tansiyon küçük tansiyondan yüksek olmalıdır';
  }
  if (type === 'blood_sugar' && (number('sugar') < 20 || number('sugar') > 700)) return 'Kan şekeri değeri geçerli aralıkta değil';
  if (type === 'weight' && (number('weight') < 2 || number('weight') > 500)) return 'Kilo değeri geçerli aralıkta değil';
  return null;
}

export default router;
