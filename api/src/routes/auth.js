import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, uuid, deleteRelationalData, pgPool } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import { removeUserFromState } from '../services/user-deletion.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, role, pin } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!phone || !name || !['caregiver', 'elderly'].includes(role) || !/^\d{4,6}$/.test(pin || '')) {
    return res.status(400).json({ error: 'Telefon, isim, geçerli rol ve 4-6 haneli PIN gerekli' });
  }
  const existing = db.data.users.find(u => u.phone === phone);
  if (existing) {
    return res.status(409).json({ error: 'Bu telefon zaten kayıtlı' });
  }
  const pinHash = await bcrypt.hash(pin, 12);
  const user = { id: uuid(), phone, name, role, pinHash, timezone: 'Europe/Istanbul', createdAt: new Date().toISOString() };
  db.data.users.push(user);
  // Profile will be created manually by caregiver via add-profile screen
  await db.write();
  const token = generateToken(user);
  res.status(201).json({ user: { id: user.id, name: user.name, role: user.role, phone: user.phone }, token });
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
  const token = generateToken(user);
  res.json({ user: { id: user.id, name: user.name, role: user.role, phone: user.phone }, token });
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
  const deletion = removeUserFromState(user.id);
  await db.write();
  await deleteRelationalData({ userIds: [user.id], profileIds: deletion.profileIds });
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
