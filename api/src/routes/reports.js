import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import { requireProfileAccess } from '../middleware/access.js';
import { requireSubscription } from '../middleware/subscription.js';
import { localDate, getUserTimezone } from '../utils/date.js';

const router = Router();
router.use(authMiddleware);
router.use(requireSubscription);

router.get('/adherence', async (req, res) => {
  const userId = String(req.query.profileId || req.user.id);
  const profile = requireProfileAccess(req, res, userId);
  if (!profile) return;
  const patient = db.data.users.find(user => user.id === (profile.linkedUserId || req.user.id));
  const today = localDate(new Date(), getUserTimezone(patient));
  const medications = db.data.medications.filter(m => m.profileId === profile.id);
  const logs = db.data.medicationLogs.filter(l => l.profileId === profile.id);

  // Calculate stats
  const totalDoses = medications.reduce((s, m) => s + (m.times?.length || 0), 0);
  const todayTaken = logs.filter(l => l.date === today && ['taken', 'caregiver_marked'].includes(l.status)).length;
  const adherence = totalDoses > 0 ? Math.min(100, Math.round((todayTaken / totalDoses) * 100)) : 0;

  // Generate PDF
  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=famicare-rapor-${today}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('Famicare Sağlık Raporu', { align: 'center' });
  const subject = profile.self ? req.user : db.data.profiles.find(p => p.id === profile.id);
  doc.fontSize(12).font('Helvetica').text(`Hasta: ${subject?.name || 'Belirtilmemiş'}`, { align: 'center' });
  doc.text(`Tarih: ${new Date(today).toLocaleDateString('tr-TR')}`, { align: 'center' });
  doc.moveDown(2);

  // Summary
  doc.fontSize(16).font('Helvetica-Bold').text('Özet', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica');
  doc.text(`Toplam ilaç: ${medications.length}`);
  doc.text(`Bugünkü doz: ${totalDoses}`);
  doc.text(`Alınan doz: ${todayTaken}`);
  doc.text(`Kaçırılan doz: ${totalDoses - todayTaken}`);
  doc.text(`Uyum oranı: %${adherence}`);
  doc.moveDown(1.5);

  // Medication list
  doc.fontSize(16).font('Helvetica-Bold').text('İlaç Listesi', { underline: true });
  doc.moveDown(0.5);
  medications.forEach(m => {
    doc.fontSize(12).font('Helvetica-Bold').text(`${m.name}`, { continued: true });
    doc.font('Helvetica').text(`  • ${m.dosage || ''} • ${m.times?.join(', ') || ''}`);
  });

  // Recent health records
  const healthRecords = db.data.healthRecords
    .filter(r => r.profileId === profile.id)
    .sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))
    .slice(0, 10);

  if (healthRecords.length > 0) {
    doc.moveDown(1.5);
    doc.fontSize(16).font('Helvetica-Bold').text('Son Sağlık Ölçümleri', { underline: true });
    doc.moveDown(0.5);
    healthRecords.forEach(r => {
      const type = r.recordType === 'blood_pressure' ? 'Tansiyon' : r.recordType === 'blood_sugar' ? 'Şeker' : 'Kilo';
      const val = r.valueData ? JSON.stringify(r.valueData) : '';
      doc.fontSize(12).font('Helvetica').text(`${type}: ${val} (${new Date(r.measuredAt).toLocaleDateString('tr-TR')})`);
    });
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(10).font('Helvetica').text('Bu rapor Famicare tarafından otomatik oluşturulmuştur. Tıbbi tavsiye yerine geçmez.', { align: 'center', color: 'gray' });

  doc.end();
});

export default router;
