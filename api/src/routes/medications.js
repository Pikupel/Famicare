import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireProfileAccess, canManageRecord } from '../middleware/access.js';
import { localDate, getUserTimezone, dateDaysAgo, isMedicationActiveOn } from '../utils/date.js';

const router = Router();
router.use(authMiddleware);

const stockLocks = new Map();

function acquireStockLock(medicationId) {
  return new Promise(resolve => {
    const check = () => {
      if (!stockLocks.has(medicationId)) {
        stockLocks.set(medicationId, true);
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

function releaseStockLock(medicationId) {
  stockLocks.delete(medicationId);
}

router.get('/profile/:profileId', (req, res) => {
  const profile = requireProfileAccess(req, res, req.params.profileId);
  if (!profile) return;
  const medications = db.data.medications.filter(m => m.profileId === profile.id);
  res.json(medications);
});

router.get('/profile/:profileId/today', (req, res) => {
  const profile = requireProfileAccess(req, res, req.params.profileId);
  if (!profile) return;
  const patient = db.data.users.find(user => user.id === (profile.linkedUserId || req.user.id));
  const date = localDate(new Date(), getUserTimezone(patient));
  const medications = db.data.medications.filter(
    medication => medication.profileId === profile.id && isMedicationActiveOn(medication, date)
  );
  const logs = db.data.medicationLogs.filter(log => log.profileId === profile.id && log.date === date);
  res.json({ date, medications, logs });
});

router.post('/', async (req, res) => {
  if (!req.body.profileId || !req.body.name) return res.status(400).json({ error: 'Profil ID ve ilaç adı gerekli' });
  const { profileId, name, dosage, instructions, times, endDate, stockTotal, purpose, drugRefId, unitsPerDose } = req.body;
  const profile = requireProfileAccess(req, res, profileId);
  if (!profile) return;
  if (!Array.isArray(times) || !times.length || times.some(t => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))) {
    return res.status(400).json({ error: 'En az bir geçerli ilaç saati gerekli' });
  }
  const parsedStock = stockTotal === undefined || stockTotal === null || stockTotal === '' ? null : Number(stockTotal);
  const parsedUnits = Number(unitsPerDose);
  if (parsedStock !== null && (!Number.isFinite(parsedStock) || parsedStock < 0)) return res.status(400).json({ error: 'Geçerli stok miktarı girin' });
  if (unitsPerDose !== undefined && (!Number.isFinite(parsedUnits) || parsedUnits <= 0)) return res.status(400).json({ error: 'Geçerli doz adedi girin' });
  if (endDate) {
    const normalizedEnd = /^\d{2}\.\d{2}\.\d{4}$/.test(endDate) ? endDate.split('.').reverse().join('-') : endDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedEnd) || Number.isNaN(Date.parse(`${normalizedEnd}T00:00:00Z`))) {
      return res.status(400).json({ error: 'Geçerli bitiş tarihi girin' });
    }
  }
  const medication = {
    id: uuid(), profileId: profile.id, name, dosage: dosage || '', instructions: instructions || '',
    times: times, endDate: endDate || '',
    purpose: purpose || '',
    drugRefId: drugRefId || null,
    stockTotal: parsedStock,
    packageCapacity: parsedStock,
    unitsPerDose: parsedUnits > 0 ? parsedUnits : 1,
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
  const patient = db.data.users.find(user => user.id === (profile.linkedUserId || req.user.id));
  const today = localDate(now, getUserTimezone(patient));

  const selectedTime = scheduledTime || medication.times?.[0];
  if (!medication.times?.includes(selectedTime)) return res.status(400).json({ error: 'Geçersiz doz saati' });

  // Keep de-duplication, stock mutation and persistence in one critical section.
  await acquireStockLock(medication.id);
  try {
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

  const previousStatus = existingIdx >= 0 ? db.data.medicationLogs[existingIdx].status : null;
  const completedStatuses = new Set(['taken', 'caregiver_marked']);
  const becameCompleted = !completedStatuses.has(previousStatus) && completedStatuses.has(finalStatus);
  const becameIncomplete = completedStatuses.has(previousStatus) && !completedStatuses.has(finalStatus);

  if (existingIdx >= 0) {
    db.data.medicationLogs[existingIdx] = { ...db.data.medicationLogs[existingIdx], ...logEntry, id: db.data.medicationLogs[existingIdx].id };
  } else {
    db.data.medicationLogs.push(logEntry);
  }

  if (medication.stockTotal !== null && medication.stockTotal !== '' && Number.isFinite(Number(medication.stockTotal))) {
      const currentMedication = db.data.medications.find(m => m.id === medication.id);
      if (!currentMedication) return res.status(404).json({ error: 'Medication not found' });
      const units = Number(currentMedication.unitsPerDose) > 0 ? Number(currentMedication.unitsPerDose) : 1;
      if (becameCompleted) currentMedication.stockTotal = Math.max(0, Number(currentMedication.stockTotal) - units);
      if (becameIncomplete) currentMedication.stockTotal = Number(currentMedication.stockTotal) + units;
      medication.stockTotal = currentMedication.stockTotal;
      await db.write();
  } else {
    await db.write();
  }

  res.status(existingIdx >= 0 ? 200 : 201).json({ ...logEntry, stockTotal: medication.stockTotal });
  } finally {
    releaseStockLock(medication.id);
  }
});

// Caregiver override: get pending logs for review
router.get('/profile/:profileId/pending', (req, res) => {
  const profile = requireProfileAccess(req, res, req.params.profileId, { caregiverOnly: true });
  if (!profile) return;
  const patient = db.data.users.find(user => user.id === profile.linkedUserId);
  const today = localDate(new Date(), getUserTimezone(patient));
  const logs = db.data.medicationLogs.filter(
    l => l.profileId === profile.id && l.date === today && l.status === 'unresponded'
  );
  const meds = db.data.medications.filter(m => m.profileId === profile.id);
  res.json(logs.map(l => ({ ...l, medication: meds.find(m => m.id === l.medicationId) })));
});

router.get('/profile/:profileId/logs', (req, res) => {
  const profile = requireProfileAccess(req, res, req.params.profileId);
  if (!profile) return;
  const { range } = req.query;
  let logs = db.data.medicationLogs.filter(l => l.profileId === profile.id);
  if (range === '90d') {
    const patient = db.data.users.find(user => user.id === (profile.linkedUserId || req.user.id));
    const cutoff = dateDaysAgo(90, getUserTimezone(patient));
    logs = logs.filter(l => l.date >= cutoff);
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
    const profile = requireProfileAccess(req, res, medication.profileId);
    if (!profile) return;
    const patient = db.data.users.find(user => user.id === (profile.linkedUserId || req.user.id));
    const cutoff = dateDaysAgo(7, getUserTimezone(patient));
    logs = logs.filter(l => l.date >= cutoff);
  }
  res.json(logs);
});

router.patch('/:id', async (req, res) => {
  const { name, dosage, instructions, times, purpose, endDate, isActive, stockTotal, unitsPerDose } = req.body;
  const idx = db.data.medications.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'İlaç bulunamadı' });
  if (!requireProfileAccess(req, res, db.data.medications[idx].profileId)) return;
  if (times && (!Array.isArray(times) || !times.length || times.some(t => !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)))) {
    return res.status(400).json({ error: 'Geçerli ilaç saatleri girin' });
  }
  if (endDate) {
    const normalizedEnd = /^\d{2}\.\d{2}\.\d{4}$/.test(endDate) ? endDate.split('.').reverse().join('-') : endDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedEnd) || Number.isNaN(Date.parse(`${normalizedEnd}T00:00:00Z`))) {
      return res.status(400).json({ error: 'Geçerli bitiş tarihi girin' });
    }
  }
  if (name !== undefined) db.data.medications[idx].name = name;
  if (dosage !== undefined) db.data.medications[idx].dosage = dosage;
  if (instructions !== undefined) db.data.medications[idx].instructions = instructions;
  if (times !== undefined) db.data.medications[idx].times = times;
  if (purpose !== undefined) db.data.medications[idx].purpose = purpose;
  if (endDate !== undefined) db.data.medications[idx].endDate = endDate;
  if (isActive !== undefined) db.data.medications[idx].isActive = Boolean(isActive);
  if (stockTotal !== undefined) {
    const parsedStock = Number(stockTotal);
    if (!Number.isFinite(parsedStock) || parsedStock < 0) return res.status(400).json({ error: 'Geçerli stok miktarı girin' });
    db.data.medications[idx].stockTotal = parsedStock;
  }
  if (unitsPerDose !== undefined) {
    const parsedUnits = Number(unitsPerDose);
    if (!Number.isFinite(parsedUnits) || parsedUnits <= 0) return res.status(400).json({ error: 'Geçerli doz adedi girin' });
    db.data.medications[idx].unitsPerDose = parsedUnits;
  }
  await db.write();
  res.json(db.data.medications[idx]);
});

router.post('/:id/refill', async (req, res) => {
  const { stockTotal } = req.body;
  const idx = db.data.medications.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'İlaç bulunamadı' });
  if (!requireProfileAccess(req, res, db.data.medications[idx].profileId)) return;
  const requestedTotal = Number(stockTotal);
  const refillTotal = Number.isFinite(requestedTotal) && requestedTotal > 0
    ? requestedTotal
    : Number(db.data.medications[idx].packageCapacity);
  if (!Number.isFinite(refillTotal) || refillTotal <= 0) {
    return res.status(400).json({ error: 'Yenileme miktarı gerekli' });
  }
  db.data.medications[idx].stockTotal = refillTotal;
  db.data.medications[idx].packageCapacity = refillTotal;
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
