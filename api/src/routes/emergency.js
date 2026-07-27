import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireProfileAccess, canManageRecord, requireRole } from '../middleware/access.js';
import { sendPush } from '../services/push.js';

const router = Router();

router.post('/', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, 'elderly')) return;
  const { profileId, locationLat, locationLng } = req.body;
  const linkedProfile = db.data.profiles.find(p => p.linkedUserId === req.user.id);
  const targetProfileId = profileId === req.user.id && linkedProfile ? linkedProfile.id : (profileId || linkedProfile?.id || req.user.id);
  const profile = requireProfileAccess(req, res, targetProfileId);
  if (!profile) return;
  const emergency = {
    id: uuid(), profileId: targetProfileId,
    status: 'active', triggeredBy: req.user.id,
    locationLat: locationLat || null, locationLng: locationLng || null,
    notifiedAt: new Date().toISOString(), resolvedAt: null, resolvedBy: null, note: '',
    createdAt: new Date().toISOString(),
  };
  db.data.emergencies.push(emergency);
  const caregiverId = profile.caregiverId;
  if (caregiverId) {
    const title = '🆘 Acil yardım isteği';
    const body = `${req.user.name || 'Yakınınız'} yardım istedi. Durumu hemen kontrol edin; gerekiyorsa 112’yi arayın.`;
    db.data.notifications.push({ id: uuid(), userId: caregiverId, type: 'emergency', title, body, data: { type: 'emergency', emergencyId: emergency.id, profileId: targetProfileId }, isRead: false, createdAt: new Date().toISOString() });
    await sendPush(caregiverId, title, body, { type: 'emergency', emergencyId: emergency.id });
  }
  await db.write();
  res.status(201).json(emergency);
});

router.get('/', authMiddleware, (req, res) => {
  const accessibleIds = new Set([req.user.id, ...db.data.profiles.filter(p => p.caregiverId === req.user.id || p.linkedUserId === req.user.id).map(p => p.id)]);
  const emergencies = db.data.emergencies.filter(e => accessibleIds.has(e.profileId));
  res.json(emergencies);
});

router.put('/:id', authMiddleware, async (req, res) => {
  if (!requireRole(req, res, 'caregiver')) return;
  const { status, note } = req.body;
  if (status && !['active', 'acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Geçersiz acil durum statüsü' });
  }
  const { record } = canManageRecord(req.user, 'emergencies', req.params.id);
  if (!record) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  const idx = db.data.emergencies.findIndex(e => e.id === req.params.id);
  db.data.emergencies[idx].status = status || db.data.emergencies[idx].status;
  db.data.emergencies[idx].note = note || db.data.emergencies[idx].note;
  if (status === 'resolved') db.data.emergencies[idx].resolvedAt = new Date().toISOString();
  await db.write();
  res.json(db.data.emergencies[idx]);
});

export default router;
