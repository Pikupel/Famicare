import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/profile/:profileId', (req, res) => {
  const profile = db.data.profiles.find(p => p.id === req.params.profileId && p.caregiverId === req.user.id);
  const isOwner = req.params.profileId === req.user.id;
  if (!profile && !isOwner) return res.status(404).json({ error: 'Erişim izniniz yok' });
  const medications = db.data.medications.filter(m => m.profileId === req.params.profileId);
  res.json(medications);
});

router.post('/', async (req, res) => {
  if (!req.body.profileId || !req.body.name) return res.status(400).json({ error: 'Profil ID ve ilaç adı gerekli' });
  const { profileId, name, dosage, instructions, times, endDate, stockTotal, purpose } = req.body;
  const medication = {
    id: uuid(), profileId, name, dosage: dosage || '', instructions: instructions || '',
    times: times || ['09:00'], repeatInterval: 15, endDate: endDate || '',
    purpose: purpose || '',
    stockTotal: stockTotal ? Number(stockTotal) : null,
    stockRefillDate: null,
    isActive: true, createdAt: new Date().toISOString(),
  };
  db.data.medications.push(medication);
  await db.write();
  res.status(201).json(medication);
});

router.post('/:id/log', async (req, res) => {
  const { status, confirmedBy } = req.body;
  const medication = db.data.medications.find(m => m.id === req.params.id);
  if (!medication) return res.status(404).json({ error: 'İlaç bulunamadı' });
  const now = new Date();
  const log = {
    id: uuid(), medicationId: medication.id, profileId: medication.profileId,
    scheduledTime: now.toTimeString().slice(0, 5), date: now.toISOString().split('T')[0],
    status: status || 'taken', takenAt: now.toISOString(),
    confirmedBy: confirmedBy || 'elderly',
  };
  db.data.medicationLogs.push(log);
  await db.write();
  res.status(201).json(log);
});

router.get('/profile/:profileId/logs', (req, res) => {
  const { range } = req.query;
  let logs = db.data.medicationLogs.filter(l => l.profileId === req.params.profileId);
  if (range === '90d') {
    const d = new Date(); d.setDate(d.getDate() - 90);
    logs = logs.filter(l => new Date(l.date) >= d);
  }
  res.json(logs);
});

router.get('/:id/logs', (req, res) => {
  const { date, range } = req.query;
  let logs = db.data.medicationLogs.filter(l => l.medicationId === req.params.id);
  if (date) logs = logs.filter(l => l.date === date);
  if (range === '7d') {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    logs = logs.filter(l => new Date(l.date) >= weekAgo);
  }
  res.json(logs);
});

router.patch('/:id', async (req, res) => {
  const { name, dosage, instructions, times } = req.body;
  const idx = db.data.medications.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'İlaç bulunamadı' });
  if (name) db.data.medications[idx].name = name;
  if (dosage) db.data.medications[idx].dosage = dosage;
  if (instructions) db.data.medications[idx].instructions = instructions;
  if (times) db.data.medications[idx].times = times;
  if (purpose !== undefined) db.data.medications[idx].purpose = purpose;
  await db.write();
  res.json(db.data.medications[idx]);
});

router.post('/:id/refill', async (req, res) => {
  const { stockTotal } = req.body;
  const idx = db.data.medications.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'İlaç bulunamadı' });
  db.data.medications[idx].stockTotal = stockTotal ? Number(stockTotal) : db.data.medications[idx].stockTotal;
  db.data.medications[idx].stockRefillDate = new Date().toISOString();
  await db.write();
  res.json(db.data.medications[idx]);
});

router.delete('/:id', async (req, res) => {
  db.data.medications = db.data.medications.filter(m => m.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

export default router;
