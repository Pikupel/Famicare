import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireProfileAccess, canManageRecord } from '../middleware/access.js';

const router = Router();
router.use(authMiddleware);

router.get('/profile/:profileId', (req, res) => {
  if (!requireProfileAccess(req, res, req.params.profileId)) return;
  const medications = db.data.medications.filter(m => m.profileId === req.params.profileId);
  res.json(medications);
});

router.post('/', async (req, res) => {
  if (!req.body.profileId || !req.body.name) return res.status(400).json({ error: 'Profil ID ve ilaç adı gerekli' });
  const { profileId, name, dosage, instructions, times, endDate, stockTotal, purpose } = req.body;
  if (!requireProfileAccess(req, res, profileId)) return;
  if (!Array.isArray(times) || !times.length || times.some(t => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))) {
    return res.status(400).json({ error: 'En az bir geçerli ilaç saati gerekli' });
  }
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

const VALID_STATUSES = ['taken', 'postponed', 'unresponded', 'caregiver_marked'];

router.post('/:id/log', async (req, res) => {
  const { status, scheduledTime, caregiverOverride } = req.body;
  const medication = db.data.medications.find(m => m.id === req.params.id);
  if (!medication) return res.status(404).json({ error: 'İlaç bulunamadı' });
  const profile = requireProfileAccess(req, res, medication.profileId);
  if (!profile) return;
  if (caregiverOverride && profile.caregiverId !== req.user.id) return res.status(403).json({ error: 'Bakıcı yetkisi gerekli' });
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const selectedTime = scheduledTime || medication.times?.[0];
  if (!medication.times?.includes(selectedTime)) return res.status(400).json({ error: 'Geçersiz doz saati' });

  // Each scheduled dose has its own daily log.
  const existingIdx = db.data.medicationLogs.findIndex(
    l => l.medicationId === req.params.id && l.date === today && l.scheduledTime === selectedTime
  );

  const finalStatus = status || 'unresponded';
  if (!VALID_STATUSES.includes(finalStatus)) {
    return res.status(400).json({ error: `Geçersiz durum: ${finalStatus}` });
  }

  // Conflict rule: caregiver_marked always overrides
  if (existingIdx >= 0 && db.data.medicationLogs[existingIdx].status === 'caregiver_marked' && finalStatus !== 'caregiver_marked') {
    return res.status(403).json({ error: 'Bakıcı tarafından işaretlenmiş, değiştirilemez' });
  }

  const logEntry = {
    id: uuid(), medicationId: medication.id, profileId: medication.profileId,
    scheduledTime: selectedTime,
    date: today, status: finalStatus,
    takenAt: finalStatus === 'taken' || finalStatus === 'caregiver_marked' ? now.toISOString() : null,
    confirmedBy: req.user.id, changedBy: req.user.id,
  };

  if (existingIdx >= 0) {
    db.data.medicationLogs[existingIdx] = { ...db.data.medicationLogs[existingIdx], ...logEntry, id: db.data.medicationLogs[existingIdx].id };
  } else {
    db.data.medicationLogs.push(logEntry);
  }

  await db.write();
  res.status(201).json(logEntry);
});

// Caregiver override: get pending logs for review
router.get('/profile/:profileId/pending', (req, res) => {
  if (!requireProfileAccess(req, res, req.params.profileId, { caregiverOnly: true })) return;
  const today = new Date().toISOString().split('T')[0];
  const logs = db.data.medicationLogs.filter(
    l => l.profileId === req.params.profileId && l.date === today && l.status === 'unresponded'
  );
  const meds = db.data.medications.filter(m => m.profileId === req.params.profileId);
  res.json(logs.map(l => ({ ...l, medication: meds.find(m => m.id === l.medicationId) })));
});

router.get('/profile/:profileId/logs', (req, res) => {
  if (!requireProfileAccess(req, res, req.params.profileId)) return;
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
  const medication = db.data.medications.find(m => m.id === req.params.id);
  if (!medication || !requireProfileAccess(req, res, medication.profileId)) return;
  let logs = db.data.medicationLogs.filter(l => l.medicationId === req.params.id);
  if (date) logs = logs.filter(l => l.date === date);
  if (range === '7d') {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    logs = logs.filter(l => new Date(l.date) >= weekAgo);
  }
  res.json(logs);
});

router.patch('/:id', async (req, res) => {
  const { name, dosage, instructions, times, purpose, endDate, isActive } = req.body;
  const idx = db.data.medications.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'İlaç bulunamadı' });
  if (!requireProfileAccess(req, res, db.data.medications[idx].profileId)) return;
  if (times && (!Array.isArray(times) || !times.length || times.some(t => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)))) {
    return res.status(400).json({ error: 'Geçerli ilaç saatleri girin' });
  }
  if (name) db.data.medications[idx].name = name;
  if (dosage) db.data.medications[idx].dosage = dosage;
  if (instructions) db.data.medications[idx].instructions = instructions;
  if (times) db.data.medications[idx].times = times;
  if (purpose !== undefined) db.data.medications[idx].purpose = purpose;
  if (endDate !== undefined) db.data.medications[idx].endDate = endDate;
  if (isActive !== undefined) db.data.medications[idx].isActive = Boolean(isActive);
  await db.write();
  res.json(db.data.medications[idx]);
});

router.post('/:id/refill', async (req, res) => {
  const { stockTotal } = req.body;
  const idx = db.data.medications.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'İlaç bulunamadı' });
  if (!requireProfileAccess(req, res, db.data.medications[idx].profileId)) return;
  db.data.medications[idx].stockTotal = stockTotal ? Number(stockTotal) : db.data.medications[idx].stockTotal;
  db.data.medications[idx].stockRefillDate = new Date().toISOString();
  await db.write();
  res.json(db.data.medications[idx]);
});

router.delete('/:id', async (req, res) => {
  const { record } = canManageRecord(req.user, 'medications', req.params.id);
  if (!record) return res.status(404).json({ error: 'İlaç bulunamadı' });
  db.data.medications = db.data.medications.filter(m => m.id !== req.params.id);
  db.data.medicationLogs = db.data.medicationLogs.filter(l => l.medicationId !== req.params.id);
  await db.write();
  res.json({ success: true });
});

export default router;
