import { Router } from 'express';
import { db, uuid, pgPool, deleteRelationalData } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { timingSafeEqual, randomBytes } from 'crypto';
import { verify as verifyTotp, generateSecret } from 'otplib';
import { createTitckPreview, consumeTitckPreview } from '../services/titck-import.js';
import { removeUserFromState } from '../services/user-deletion.js';
import { revokeUserSessions } from '../services/sessions.js';

const router = Router();
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !ADMIN_TOTP_SECRET || !ADMIN_SESSION_SECRET)) {
  throw new Error('ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_TOTP_SECRET ve ADMIN_SESSION_SECRET üretim ortamında zorunludur');
}
if (!ADMIN_TOTP_SECRET && !ADMIN_SESSION_SECRET) {
  console.error('[ADMIN] ADMIN_TOTP_SECRET ve ADMIN_SESSION_SECRET tanımlanmamış. Güvenli olmayan varsayılanlar kullanılıyor. Üretim öncesi tanımlayın.');
}
const effectiveAdminUsername = ADMIN_USERNAME || 'admin';
const effectiveAdminPasswordHash = ADMIN_PASSWORD_HASH || (() => { throw new Error('ADMIN_PASSWORD_HASH tanımlanmamış'); })();
const effectiveAdminTotpSecret = ADMIN_TOTP_SECRET || generateTotpFallback();
const adminSessionSecret = ADMIN_SESSION_SECRET || randomBytes(48).toString('base64url');
const adminLoginAttempts = new Map();

function sameSecret(candidate, expected) {
  const left = Buffer.from(String(candidate || ''));
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeUsername(value) {
  return String(value || '').trim().normalize('NFKC').toLocaleLowerCase('en-US');
}

function generateTotpFallback() {
  const secret = generateSecret();
  console.error('[ADMIN] ADMIN_TOTP_SECRET tanımlanmamış. Geçici secret üretildi (yeniden başlatmada değişir).');
  return secret;
}

router.post('/session', async (req, res) => {
  if (adminLoginAttempts.size > 10_000) {
    for (const [key, value] of adminLoginAttempts) {
      if (!value.blockedUntil || value.blockedUntil <= Date.now()) adminLoginAttempts.delete(key);
    }
  }
  const identifier = req.ip || req.socket.remoteAddress || 'unknown';
  const attempt = adminLoginAttempts.get(identifier);
  if (attempt?.blockedUntil > Date.now()) {
    return res.status(429).json({ error: 'Çok fazla başarısız deneme. 15 dakika bekleyin.' });
  }
  const receivedUsername = normalizeUsername(req.body?.username);
  const configuredUsername = normalizeUsername(effectiveAdminUsername);
  const usernameValid = sameSecret(receivedUsername, configuredUsername);
  const passwordValid = usernameValid && await bcrypt.compare(String(req.body?.password || ''), effectiveAdminPasswordHash);
  const totpValid = passwordValid && /^\d{6}$/.test(req.body?.totp || '')
    ? await verifyTotp({ secret: effectiveAdminTotpSecret, token: req.body.totp })
    : false;
  if (!usernameValid || !passwordValid || !totpValid) {
    console.warn('[ADMIN AUTH] Login rejected');
    const failures = (attempt?.failures || 0) + 1;
    adminLoginAttempts.set(identifier, failures >= 5
      ? { failures: 0, blockedUntil: Date.now() + 15 * 60 * 1000 }
      : { failures, blockedUntil: 0 });
    return res.status(401).json({ error: 'Kullanıcı adı, şifre veya doğrulama kodu hatalı' });
  }
  adminLoginAttempts.delete(identifier);
  const token = jwt.sign({ scope: 'admin', type: 'admin-session', sub: effectiveAdminUsername }, adminSessionSecret, { expiresIn: '15m' });
  await recordAudit(req, 'admin.login', 'session', null, {});
  res.json({ token, expiresIn: 900 });
});

function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Yönetici oturumu gerekli' });
  try {
    const payload = jwt.verify(header.slice(7), adminSessionSecret);
    if (payload.scope !== 'admin' || payload.type !== 'admin-session') throw new Error('invalid scope');
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Yönetici oturumu geçersiz veya süresi dolmuş' });
  }
}

async function recordAudit(req, action, resourceType, resourceId, details = {}) {
  if (!db.data.adminAuditLogs) db.data.adminAuditLogs = [];
  db.data.adminAuditLogs.unshift({
    id: uuid(), action, resourceType, resourceId,
    details, ip: req.ip || '', createdAt: new Date().toISOString(),
  });
  db.data.adminAuditLogs = db.data.adminAuditLogs.slice(0, 1000);
  await db.write();
}

function requireConfirmation(req, res, phrase) {
  if (req.body?.confirmation !== phrase) {
    res.status(400).json({ error: `Onay için "${phrase}" yazılmalıdır` });
    return false;
  }
  return true;
}

function requirePersistentDatabase(req, res) {
  if (process.env.DATABASE_URL && !pgPool) {
    res.status(503).json({ error: 'Kalıcı veritabanına ulaşılamıyor. Silme işlemi uygulanmadı.' });
    return false;
  }
  return true;
}

router.use(requireAdmin);

router.get('/audit-logs', (req, res) => {
  res.json((db.data.adminAuditLogs || []).slice(0, 200));
});

// Dashboard stats
router.get('/stats', (req, res) => {
  const activeDrugs = db.data.drugReferences?.filter(d => d.durum === 'aktif').length || 0;
  const totalDrugs = db.data.drugReferences?.length || 0;
  res.json({
    users: db.data.users.length,
    profiles: db.data.profiles.length,
    medications: db.data.medications.length,
    healthRecords: db.data.healthRecords.length,
    appointments: db.data.appointments.length,
    notifications: db.data.notifications.length,
    activeDrugs,
    totalDrugs,
    lastImport: db.data.lastImportDate || 'Yok',
    pgConnected: pgPool !== null,
  });
});

// List users
router.get('/users', (req, res) => {
  res.json(db.data.users.map(u => ({ id: u.id, name: u.name, phone: u.phone, role: u.role, createdAt: u.createdAt })));
});

// List medications
router.get('/medications', (req, res) => {
  res.json(db.data.medications.slice(0, 100));
});

router.get('/drugs/search', (req, res) => {
  const query = String(req.query.q || '').trim().toLocaleLowerCase('tr-TR');
  if (query.length < 2) return res.json([]);
  res.json((db.data.drugReferences || [])
    .filter(drug => drug.durum !== 'pasif' && drug.ilac_adi?.toLocaleLowerCase('tr-TR').includes(query))
    .slice(0, 50)
    .map(drug => ({
      ilac_adi: drug.ilac_adi, barkod: drug.barkod,
      atc_kodu: drug.atc_kodu, atc_adi: drug.atc_adi, durum: drug.durum,
      ingredientStatus: drug.ingredientStatus || 'unmapped',
    })));
});

router.post('/titck/preview', async (req, res) => {
  try {
    const preview = await createTitckPreview(req.body?.sourceUrl, db.data.drugReferences || []);
    await recordAudit(req, 'drugs.titck-preview', 'drugReferences', null, {
      sourceUrl: preview.sourceUrl, checksum: preview.checksum, total: preview.total,
    });
    res.json(preview);
  } catch (error) {
    res.status(400).json({ error: error.message || 'TİTCK dosyası önizlenemedi' });
  }
});

router.post('/titck/apply', async (req, res) => {
  if (!requireConfirmation(req, res, 'TİTCK LİSTESİNİ GÜNCELLE')) return;
  try {
    const preview = consumeTitckPreview(req.body?.previewToken);
    const backup = {
      id: uuid(), createdAt: new Date().toISOString(),
      data: { drugReferences: structuredClone(db.data.drugReferences || []), lastImportDate: db.data.lastImportDate },
    };
    db.data.adminBackups = [backup, ...(db.data.adminBackups || [])].slice(0, 3);
    db.data.drugReferences = preview.products;
    db.data.lastImportDate = new Date().toISOString();
    db.data.lastTitckImport = {
      sourceUrl: preview.sourceUrl, checksum: preview.checksum, importedAt: db.data.lastImportDate,
    };
    await db.write();
    await recordAudit(req, 'drugs.titck-apply', 'drugReferences', null, {
      sourceUrl: preview.sourceUrl, checksum: preview.checksum, ...preview.summary,
    });
    res.json({ success: true, ...preview.summary, importedAt: db.data.lastImportDate });
  } catch (error) {
    res.status(400).json({ error: error.message || 'TİTCK listesi uygulanamadı' });
  }
});

// List all profiles
router.get('/profiles', (req, res) => {
  res.json(db.data.profiles.map(p => ({ id: p.id, name: p.name, caregiverId: p.caregiverId, linkedUserId: p.linkedUserId, inviteCode: p.inviteCode })));
});

// Delete a user by ID (cascade)
router.delete('/users/:id', async (req, res) => {
  if (!requireConfirmation(req, res, 'KULLANICIYI SİL')) return;
  if (!requirePersistentDatabase(req, res)) return;
  const uid = req.params.id;
  const deletion = removeUserFromState(uid);
  if (!deletion) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  await db.write();
  await deleteRelationalData({ userIds: [uid], profileIds: deletion.profileIds });
  await recordAudit(req, 'user.delete', 'user', uid, { name: deletion.user.name });
  res.json({ success: true, deletedName: deletion.user.name });
});

router.patch('/users/:id/pin', async (req, res) => {
  const { pin } = req.body;
  if (!/^\d{4,6}$/.test(pin || '')) return res.status(400).json({ error: 'PIN 4-6 haneli olmalıdır' });
  const user = db.data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  user.pinHash = await bcrypt.hash(pin, 12);
  user.failedLoginAttempts = 0;
  user.loginBlockedUntil = null;
  revokeUserSessions(user.id);
  await db.write();
  await recordAudit(req, 'user.pin-reset', 'user', user.id);
  res.json({ success: true });
});

// Update a profile by ID
router.patch('/profiles/:id', async (req, res) => {
  const { name } = req.body;
  const idx = db.data.profiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Profil bulunamadı' });
  if (name) db.data.profiles[idx].name = name;
  await db.write();
  await recordAudit(req, 'profile.update', 'profile', req.params.id, { name });
  res.json(db.data.profiles[idx]);
});

// Delete a profile by ID (cascade with PostgreSQL sync)
router.delete('/profiles/:id', async (req, res) => {
  if (!requireConfirmation(req, res, 'PROFİLİ SİL')) return;
  if (!requirePersistentDatabase(req, res)) return;
  const profile = db.data.profiles.find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
  const pid = req.params.id;
  db.data.profiles = db.data.profiles.filter(p => p.id !== pid);
  db.data.medications = db.data.medications.filter(m => m.profileId !== pid);
  db.data.medicationLogs = db.data.medicationLogs.filter(l => l.profileId !== pid);
  db.data.appointments = db.data.appointments.filter(a => a.profileId !== pid);
  db.data.healthRecords = db.data.healthRecords.filter(r => r.profileId !== pid);
  db.data.emergencies = db.data.emergencies.filter(e => e.profileId !== pid);
  await db.write();
  await deleteRelationalData({ profileIds: [pid] });
  await recordAudit(req, 'profile.delete', 'profile', pid, { name: profile.name });
  res.json({ success: true, deletedName: profile.name });
});

// Send test push to all users
router.post('/test-push', async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'Test bildirimi için kullanıcı seçilmelidir' });
  const { sendPush } = await import('../services/push.js');
  const user = db.data.users.find(item => item.id === userId);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const result = await sendPush(user.id, '🔔 Test Bildirimi', 'Famicare push notification çalışıyor! ✅', { type: 'admin_test' });
  await recordAudit(req, 'push.test', 'user', user.id, { result });
  res.json({ userId: user.id, name: user.name, result });
});

// Clear all data
router.post('/clear-all', async (req, res) => {
  if (!requireConfirmation(req, res, 'TÜM VERİYİ SİL')) return;
  if (!requirePersistentDatabase(req, res)) return;
  const { adminBackups = [], adminAuditLogs = [], authSessions: ignoredSessions, pushDeliveries: ignoredPushDeliveries, ...backupData } = db.data;
  const backup = { id: uuid(), createdAt: new Date().toISOString(), data: structuredClone(backupData) };
  db.data.adminBackups = [backup, ...adminBackups].slice(0, 3);
  db.data.users = [];
  db.data.profiles = [];
  db.data.medications = [];
  db.data.medicationLogs = [];
  db.data.appointments = [];
  db.data.healthRecords = [];
  db.data.notifications = [];
  db.data.emergencies = [];
  db.data.emergencyContacts = [];
  db.data.inviteAttempts = {};
  db.data.authSessions = [];
  db.data.pushDeliveries = [];
  db.data.phoneVerifications = [];
  await db.write();
  await deleteRelationalData({ clearAll: true });
  await recordAudit(req, 'database.clear-all', 'database', 'primary', { backupId: backup.id });
  res.json({ success: true, message: 'Tüm veriler temizlendi' });
});

router.get('/backups', (req, res) => {
  res.json((db.data.adminBackups || []).map(({ id, createdAt }) => ({ id, createdAt })));
});

router.post('/backups/:id/restore', async (req, res) => {
  if (!requireConfirmation(req, res, 'YEDEĞİ GERİ YÜKLE')) return;
  const backup = (db.data.adminBackups || []).find(item => item.id === req.params.id);
  if (!backup) return res.status(404).json({ error: 'Yedek bulunamadı' });
  const backups = db.data.adminBackups;
  const auditLogs = db.data.adminAuditLogs;
  db.data = { ...db.data, ...structuredClone(backup.data), authSessions: [], pushDeliveries: [], adminBackups: backups, adminAuditLogs: auditLogs };
  await db.write();
  await recordAudit(req, 'database.restore', 'backup', backup.id);
  res.json({ success: true });
});

export default router;
