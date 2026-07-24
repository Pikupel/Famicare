import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const profiles = db.data.profiles.filter(p => p.caregiverId === req.user.id);
  const today = new Date().toISOString().split('T')[0];

  const dashboardData = profiles.map(profile => {
    const medications = db.data.medications.filter(m => m.profileId === profile.id);
    const todayLogs = db.data.medicationLogs.filter(l => l.profileId === profile.id && l.date === today);
    const totalDoses = medications.reduce((sum, m) => sum + m.times.length, 0);
    const takenDoses = todayLogs.filter(l => l.status === 'taken').length;
    return {
      profile,
      medicationCount: medications.length, takenDoses, totalDoses,
      adherence: totalDoses > 0 ? Math.min(100, Math.round((takenDoses / totalDoses) * 100)) : 0,
    };
  });

  if (req.user.role === 'elderly') {
    const myMeds = db.data.medications.filter(m => m.profileId === req.user.id);
    const myLogs = db.data.medicationLogs.filter(l => l.profileId === req.user.id && l.date === today);
    const myTotal = myMeds.reduce((s, m) => s + m.times.length, 0);
    const myTaken = myLogs.filter(l => l.status === 'taken').length;
    dashboardData.push({
      profile: { id: req.user.id, name: req.user.name, relationship: 'kendim' },
      medicationCount: myMeds.length, takenDoses: myTaken, totalDoses: myTotal,
      adherence: myTotal > 0 ? Math.round((myTaken / myTotal) * 100) : 0,
    });
  }

  res.json(dashboardData);
});

export default router;
