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

// Delete a profile by ID
router.delete('/profiles/:id', async (req, res) => {
  const profile = db.data.profiles.find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: 'Profil bulunamadı' });
  db.data.profiles = db.data.profiles.filter(p => p.id !== req.params.id);
  await db.write();
  res.json({ success: true, deletedName: profile.name });
});

export default router;
