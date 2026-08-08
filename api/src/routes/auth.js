import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, uuid, mutateAndPersistDeletion, pgPool } from '../db.js';
import { removeUserFromState } from '../services/user-deletion.js';
import { createSession, rotateSession, revokeSession, revokeUserSessions } from '../services/sessions.js';
import { requestPhoneVerification, consumePhoneVerification } from '../services/phone-verification.js';
import { isUnsafeRegistrationAllowed } from '../utils/environment.js';

const router = Router();
const isUnverifiedRegistrationEnabled = isUnsafeRegistrationAllowed;

const verificationAttempts = new Map();
function checkVerificationRate(req, res) {
  const ip = req.ip || 'unknown';
  const record = verificationAttempts.get(ip);
  if (record && record.blockUntil > Date.now()) {
    res.status(429).json({ error: 'Çok fazla doğrulama isteği. Lütfen 15 dakika bekleyin.' });
    return false;
  }
  const count = (record?.count || 0) + 1;
  if (count > 5) {
    verificationAttempts.set(ip, { count: 0, blockUntil: Date.now() + 15 * 60 * 1000 });
    res.status(429).json({ error: 'Çok fazla doğrulama isteği. Lütfen 15 dakika bekleyin.' });
    return false;
  }
  verificationAttempts.set(ip, { count, blockUntil: 0 });
  return true;
}

const registrationAttempts = new Map();
function checkRegistrationRate(req, res) {
  const ip = req.ip || 'unknown';
  const record = registrationAttempts.get(ip);
  if (record && record.blockUntil > Date.now()) {
    res.status(429).json({ error: 'Çok fazla kayıt denemesi. Lütfen 1 saat bekleyin.' });
    return false;
  }
  const count = (record?.count || 0) + 1;
  if (count > 10) {
    registrationAttempts.set(ip, { count: 0, blockUntil: Date.now() + 60 * 60 * 1000 });
    res.status(429).json({ error: 'Çok fazla kayıt denemesi. Lütfen 1 saat bekleyin.' });
    return false;
  }
  registrationAttempts.set(ip, { count, blockUntil: 0 });
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of verificationAttempts) { if (r.blockUntil && r.blockUntil < now) verificationAttempts.delete(ip); }
  for (const [ip, r] of registrationAttempts) { if (r.blockUntil && r.blockUntil < now) registrationAttempts.delete(ip); }
}, 30 * 60 * 1000).unref();

router.post('/register', async (req, res) => {
  if (!checkRegistrationRate(req, res)) return;
  const { name, role, pin } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!phone || !name || !['caregiver', 'elderly'].includes(role) || !/^\d{4,6}$/.test(pin || '')) {
    return res.status(400).json({ error: 'Telefon, isim, geçerli rol ve 4-6 haneli PIN gerekli' });
  }
  const existing = db.data.users.find(u => u.phone === phone);
  if (existing) {
    return res.status(409).json({ error: 'Bu telefon zaten kayıtlı' });
  }
  if (!isUnverifiedRegistrationEnabled() && !await consumePhoneVerification(req.body.verificationId, phone, req.body.verificationCode)) {
    return res.status(401).json({ error: 'Telefon doğrulama kodu geçersiz veya süresi dolmuş' });
  }
  const pinHash = await bcrypt.hash(pin, 12);
  const user = { id: uuid(), phone, name, role, pinHash, timezone: 'Europe/Istanbul', createdAt: new Date().toISOString() };
  db.data.users.push(user);
  // Profile will be created manually by caregiver via add-profile screen
  await db.write();
  const session = await createSession(user);
  res.status(201).json({ user: { id: user.id, name: user.name, role: user.role, phone: user.phone }, ...session });
});

router.post('/request-verification', async (req, res) => {
  if (!checkVerificationRate(req, res)) return;
  const phone = normalizePhone(req.body?.phone);
  if (isUnverifiedRegistrationEnabled() && phone && !db.data.users.some(user => user.phone === phone)) {
    return res.json({ verificationRequired: false });
  }
  if (!phone) return res.status(400).json({ error: 'Geçerli telefon numarası gerekli' });
  if (db.data.users.some(user => user.phone === phone)) return res.status(409).json({ error: 'Bu telefon zaten kayıtlı' });
  try {
    res.json(await requestPhoneVerification(phone));
  } catch (error) {
    res.status(503).json({ error: error.message || 'Doğrulama kodu gönderilemedi' });
  }
});

router.post('/login', async (req, res) => {
  const { role, pin } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!phone || !pin) return res.status(400).json({ error: 'Telefon ve PIN gerekli' });
  const user = db.data.users.find(u => u.phone === phone);
  if (!user) return res.status(401).json({ error: 'Telefon veya PIN hatalı' });
  if (user.loginBlockedUntil && new Date(user.loginBlockedUntil) > new Date()) {
    return res.status(429).json({ error: 'Çok fazla hatalı deneme. Lütfen daha sonra tekrar deneyin.' });
  }
  if (role && user.role !== role) return res.status(403).json({ error: 'Bu hesap farklı bir rolle kaydedilmiş' });
  if (!user.pinHash) {
    return res.status(428).json({ error: 'Bu eski hesabın güvenli PIN geçişi gerekiyor. Destek üzerinden PIN sıfırlayın.' });
  }
  const validPin = await bcrypt.compare(pin, user.pinHash);
  if (!validPin) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.loginBlockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      user.failedLoginAttempts = 0;
    }
    await db.write();
    return res.status(401).json({ error: 'Telefon veya PIN hatalı' });
  }
  user.failedLoginAttempts = 0;
  user.loginBlockedUntil = null;
  await db.write();
  const session = await createSession(user);
  res.json({ user: { id: user.id, name: user.name, role: user.role, phone: user.phone }, ...session });
});

router.post('/refresh', async (req, res) => {
  const session = await rotateSession(req.body?.refreshToken);
  if (!session) return res.status(401).json({ error: 'Oturum yenilenemedi' });
  res.json(session);
});

router.post('/logout', async (req, res) => {
  await revokeSession(req.body?.refreshToken);
  res.json({ success: true });
});

router.post('/delete-account', async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const pin = String(req.body?.pin || '');
  if (req.body?.confirmation !== 'HESABIMI SİL' || !phone || !/^\d{4,6}$/.test(pin)) {
    return res.status(400).json({ error: 'Telefon, PIN ve HESABIMI SİL onayı gereklidir' });
  }
  if (process.env.DATABASE_URL && !pgPool) return res.status(503).json({ error: 'Kalıcı veritabanına ulaşılamıyor. Hesap silinmedi.' });
  const user = db.data.users.find(item => item.phone === phone);
  if (user?.loginBlockedUntil && new Date(user.loginBlockedUntil) > new Date()) {
    return res.status(429).json({ error: 'Çok fazla hatalı deneme. Lütfen daha sonra tekrar deneyin.' });
  }
  if (!user || !user.pinHash || !await bcrypt.compare(pin, user.pinHash)) {
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.loginBlockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        user.failedLoginAttempts = 0;
      }
      await db.write();
    }
    return res.status(401).json({ error: 'Telefon veya PIN hatalı' });
  }
  await mutateAndPersistDeletion(() => {
    const deletion = removeUserFromState(user.id);
    if (!deletion) return null;
    revokeUserSessions(user.id);
    return { ...deletion, userIds: [user.id], profileIds: deletion.profileIds };
  });
  res.json({ success: true });
});

export default router;

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) return `90${digits.slice(1)}`;
  if (digits.length === 10) return `90${digits}`;
  if (digits.length === 12 && digits.startsWith('90')) return digits;
  return '';
}
