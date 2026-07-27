import { Router } from 'express';
import { db, uuid, deleteRelationalData, pgPool, consolidateUserRecordsIntoProfile } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { randomInt } from 'crypto';
import { localDate, getUserTimezone } from '../utils/date.js';
import { requireRole } from '../middleware/access.js';

const router = Router();
router.use(authMiddleware);

function generateInviteCode() {
  return String(randomInt(10000000, 100000000));
}

function checkBruteForce(key) {
  const now = Date.now();
  const record = db.data.inviteAttempts?.[key];
  if (record && record.blockUntil > now) {
    const remaining = Math.ceil((record.blockUntil - now) / 60000);
    return { blocked: true, remainingMinutes: remaining };
  }
  if (!db.data.inviteAttempts) db.data.inviteAttempts = {};
  if (!record) db.data.inviteAttempts[key] = { count: 0, blockUntil: 0 };
  return { blocked: false };
}

function recordAttempt(key, success) {
  if (success) {
    delete db.data.inviteAttempts[key];
    return;
  }
  db.data.inviteAttempts[key].count++;
  if (db.data.inviteAttempts[key].count >= 5) {
    db.data.inviteAttempts[key].blockUntil = Date.now() + 15 * 60 * 1000;
    db.data.inviteAttempts[key].count = 0;
  }
}

router.get('/', (req, res) => {
  const profiles = db.data.profiles.filter(p => p.caregiverId === req.user.id);
  res.json(profiles);
});

router.get('/my-link', (req, res) => {
  const profile = db.data.profiles.find(p => p.linkedUserId === req.user.id);
  if (!profile) return res.json({ linked: false });
  const caregiver = db.data.users.find(u => u.id === profile.caregiverId);
  res.json({ linked: true, caregiverName: caregiver?.name || 'Yakın', caregiverId: profile.caregiverId, profileId: profile.id });
});

router.post('/', async (req, res) => {
  if (!requireRole(req, res, 'caregiver')) return;
  const { name, birthDate, relationship, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'İsim gerekli' });
  const inviteCode = generateInviteCode();
  const profile = {
    id: uuid(), caregiverId: req.user.id, name, birthDate: birthDate || '',
    relationship: relationship || 'other', phone: phone || '',
    inviteCode, inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), linkedUserId: null,
    isActive: true, createdAt: new Date().toISOString(),
  };
  db.data.profiles.push(profile);
  await db.write();
  res.status(201).json(profile);
});

router.post('/accept', async (req, res) => {
  if (!requireRole(req, res, 'elderly')) return;
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'Davet kodu gerekli' });

  const attemptKey = `user:${req.user.id}`;
  const check = checkBruteForce(attemptKey);
  if (check.blocked) {
    return res.status(429).json({ error: `Çok fazla hatalı deneme. ${check.remainingMinutes} dakika bekleyin.` });
  }

  const profile = db.data.profiles.find(p =>
    p.inviteCode === inviteCode && !p.linkedUserId &&
    (!p.inviteExpiresAt || new Date(p.inviteExpiresAt) > new Date())
  );
  if (!profile) {
    recordAttempt(attemptKey, false);
    await db.write();
    return res.status(404).json({ error: 'Geçersiz kod' });
  }

  recordAttempt(attemptKey, true);
  profile.linkedUserId = req.user.id;
  await db.write();
  await consolidateUserRecordsIntoProfile(req.user.id, profile.id);
  const caregiver = db.data.users.find(u => u.id === profile.caregiverId);
  res.json({ success: true, profile, caregiverName: caregiver?.name || 'Yakın' });
});

router.post('/:id/invite-code', async (req, res) => {
  const profile = db.data.profiles.find(p => p.id === req.params.id && p.caregiverId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
  profile.inviteCode = generateInviteCode();
  profile.inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await db.write();
  res.json({ inviteCode: profile.inviteCode, inviteExpiresAt: profile.inviteExpiresAt });
});

router.post('/disconnect', async (req, res) => {
  if (!requireRole(req, res, 'elderly')) return;
  const profile = db.data.profiles.find(p => p.linkedUserId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Bağlantı bulunamadı' });
  profile.linkedUserId = null;
  await db.write();
  res.json({ success: true, message: 'Bağlantı kaldırıldı' });
});

router.get('/:id', (req, res) => {
  const profile = db.data.profiles.find(p => p.id === req.params.id && p.caregiverId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
  const medications = db.data.medications.filter(m => m.profileId === profile.id);
  const subject = db.data.users.find(user => user.id === (profile.linkedUserId || req.user.id));
  const today = localDate(new Date(), getUserTimezone(subject));
  const todayLogs = db.data.medicationLogs.filter(l => l.profileId === profile.id && l.date === today);
  res.json({ ...profile, medications, todayLogs });
});

router.delete('/:id', async (req, res) => {
  const profile = db.data.profiles.find(p => p.id === req.params.id && p.caregiverId === req.user.id);
  if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
  if (process.env.DATABASE_URL && !pgPool) return res.status(503).json({ error: 'Kalıcı veritabanına ulaşılamıyor. Silme işlemi uygulanmadı.' });
  const medicationIds = db.data.medications.filter(m => m.profileId === profile.id).map(m => m.id);
  db.data.profiles = db.data.profiles.filter(p => p.id !== profile.id);
  db.data.medications = db.data.medications.filter(m => m.profileId !== profile.id);
  db.data.medicationLogs = db.data.medicationLogs.filter(l => l.profileId !== profile.id && !medicationIds.includes(l.medicationId));
  db.data.healthRecords = db.data.healthRecords.filter(r => r.profileId !== profile.id);
  db.data.appointments = db.data.appointments.filter(a => a.profileId !== profile.id);
  db.data.emergencies = db.data.emergencies.filter(e => e.profileId !== profile.id);
  await db.write();
  await deleteRelationalData({ profileIds: [profile.id] });
  res.json({ success: true });
});

export default router;
