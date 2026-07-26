import { Router } from 'express';
import { db, uuid } from '../db.js';

const router = Router();
const ADMIN_KEY = process.env.ADMIN_KEY || 'famicare-admin-2026';

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Yetkisiz erişim' });
  next();
}

router.use(requireAdmin);

import { pgReady } from '../db-pg.js';

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
    pgConnected: pgReady || false,
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

// Force import drugs from Excel (manual trigger)
router.post('/import-drugs', async (req, res) => {
  try {
    const { execa } = await import('execa');
    await execa('node', ['src/scripts/import-drugs.js'], { cwd: process.cwd() });
    res.json({ success: true, message: 'Import başlatıldı' });
  } catch {
    // Fallback: directly run the import
    try {
      await import('../scripts/import-drugs.js');
      res.json({ success: true, message: 'Import tamamlandı' });
    } catch (e) {
      res.status(500).json({ error: 'Import başarısız: ' + e.message });
    }
  }
});

// Run RxNav matching
router.post('/match-rxnav', async (req, res) => {
  let matched = 0, failed = 0;
  const drugs = (db.data.drugReferences || []).filter(d => d.durum === 'aktif' && !d.rxcui);
  for (const drug of drugs.slice(0, 50)) { // Limit to 50 per request
    try {
      const resp = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drug.atc_adi)}`);
      const data = await resp.json();
      if (data.idGroup?.rxnormId?.[0]) {
        drug.rxcui = data.idGroup.rxnormId[0];
        matched++;
      } else {
        failed++;
      }
    } catch { failed++; }
  }
  await db.write();
  res.json({ matched, failed, remaining: drugs.length - matched - failed });
});

// List all profiles
router.get('/profiles', (req, res) => {
  res.json(db.data.profiles.map(p => ({ id: p.id, name: p.name, caregiverId: p.caregiverId, linkedUserId: p.linkedUserId, inviteCode: p.inviteCode })));
});

// Delete a user by ID (cascade)
router.delete('/users/:id', async (req, res) => {
  const user = db.data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const uid = req.params.id;
  db.data.users = db.data.users.filter(u => u.id !== uid);
  db.data.notifications = db.data.notifications.filter(n => n.userId !== uid);
  // Also delete related profiles and their children
  const userProfiles = db.data.profiles.filter(p => p.caregiverId === uid || p.linkedUserId === uid);
  for (const p of userProfiles) {
    db.data.medications = db.data.medications.filter(m => m.profileId !== p.id);
    db.data.medicationLogs = db.data.medicationLogs.filter(l => l.profileId !== p.id);
    db.data.appointments = db.data.appointments.filter(a => a.profileId !== p.id);
    db.data.healthRecords = db.data.healthRecords.filter(r => r.profileId !== p.id);
  }
  db.data.profiles = db.data.profiles.filter(p => p.caregiverId !== uid && p.linkedUserId !== uid);
  await db.write();
  res.json({ success: true, deletedName: user.name });
});

// Update a profile by ID
router.patch('/profiles/:id', async (req, res) => {
  const { name } = req.body;
  const idx = db.data.profiles.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Profil bulunamadı' });
  if (name) db.data.profiles[idx].name = name;
  await db.write();
  res.json(db.data.profiles[idx]);
});

// Delete a profile by ID (cascade)
router.delete('/profiles/:id', async (req, res) => {
  const profile = db.data.profiles.find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
  const pid = req.params.id;
  db.data.profiles = db.data.profiles.filter(p => p.id !== pid);
  db.data.medications = db.data.medications.filter(m => m.profileId !== pid);
  db.data.medicationLogs = db.data.medicationLogs.filter(l => l.profileId !== pid);
  db.data.appointments = db.data.appointments.filter(a => a.profileId !== pid);
  db.data.healthRecords = db.data.healthRecords.filter(r => r.profileId !== pid);
  await db.write();
  res.json({ success: true, deletedName: profile.name });
});

// Send test push to all users
router.post('/test-push', async (req, res) => {
  const { sendPush } = await import('../services/push.js');
  const results = [];
  for (const user of db.data.users) {
    try { await sendPush(user.id, '🔔 Test Bildirimi', 'Famicare push notification çalışıyor! ✅'); results.push(`${user.name}: gönderildi`); } catch { results.push(`${user.name}: hata`); }
  }
  res.json({ results });
});

// Clear all data
router.post('/clear-all', async (req, res) => {
  db.data.users = [];
  db.data.profiles = [];
  db.data.medications = [];
  db.data.medicationLogs = [];
  db.data.appointments = [];
  db.data.healthRecords = [];
  db.data.notifications = [];
  db.data.emergencies = [];
  await db.write();
  res.json({ success: true, message: 'Tüm veriler temizlendi' });
});

export default router;
