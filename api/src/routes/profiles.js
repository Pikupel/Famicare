import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const inviteAttempts = {}; // phone -> { count, blockUntil }

function generateInviteCode() {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function checkBruteForce(phone) {
  const now = Date.now();
  const record = inviteAttempts[phone];
  if (record && record.blockUntil > now) {
    const remaining = Math.ceil((record.blockUntil - now) / 60000);
    return { blocked: true, remainingMinutes: remaining };
  }
  if (!record) inviteAttempts[phone] = { count: 0, blockUntil: 0 };
  return { blocked: false };
}

function recordAttempt(phone, success) {
  if (success) {
    delete inviteAttempts[phone];
    return;
  }
  inviteAttempts[phone].count++;
  if (inviteAttempts[phone].count >= 5) {
    inviteAttempts[phone].blockUntil = Date.now() + 15 * 60 * 1000;
    inviteAttempts[phone].count = 0;
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
  const { name, birthDate, relationship, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'İsim gerekli' });
  const inviteCode = generateInviteCode();
  const profile = {
    id: uuid(), caregiverId: req.user.id, name, birthDate: birthDate || '',
    relationship: relationship || 'other', phone: phone || '',
    inviteCode, linkedUserId: null,
    isActive: true, createdAt: new Date().toISOString(),
  };
  db.data.profiles.push(profile);
  await db.write();
  res.status(201).json(profile);
});

router.post('/accept', async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) return res.status(400).json({ error: 'Davet kodu gerekli' });

  const check = checkBruteForce(inviteCode);
  if (check.blocked) {
    return res.status(429).json({ error: `Çok fazla hatalı deneme. ${check.remainingMinutes} dakika bekleyin.` });
  }

  const profile = db.data.profiles.find(p => p.inviteCode === inviteCode && !p.linkedUserId);
  if (!profile) {
    recordAttempt(inviteCode, false);
    return res.status(404).json({ error: 'Geçersiz kod' });
  }

  recordAttempt(inviteCode, true);
  profile.linkedUserId = req.user.id;
  await db.write();
  const caregiver = db.data.users.find(u => u.id === profile.caregiverId);
  res.json({ success: true, profile, caregiverName: caregiver?.name || 'Yakın' });
});

router.post('/disconnect', async (req, res) => {
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
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = db.data.medicationLogs.filter(l => l.profileId === profile.id && l.date === today);
  res.json({ ...profile, medications, todayLogs });
});

router.delete('/:id', async (req, res) => {
  db.data.profiles = db.data.profiles.filter(p => p.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

export default router;
