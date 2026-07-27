import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getLinkedProfileForUser } from '../middleware/access.js';
import { localDate, getUserTimezone } from '../utils/date.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const profiles = db.data.profiles.filter(p => p.caregiverId === req.user.id);
  const dashboardData = profiles.map(profile => {
    const patient = db.data.users.find(user => user.id === profile.linkedUserId);
    const today = localDate(new Date(), getUserTimezone(patient));
    const medications = db.data.medications.filter(m => m.profileId === profile.id);
    const todayLogs = db.data.medicationLogs.filter(l => l.profileId === profile.id && l.date === today);
    const totalDoses = medications.reduce((sum, m) => sum + (m.times?.length || 0), 0);
    const takenDoses = todayLogs.filter(l => ['taken', 'caregiver_marked'].includes(l.status)).length;
    return {
      profile,
      medicationCount: medications.length, takenDoses, totalDoses,
      adherence: totalDoses > 0 ? Math.min(100, Math.round((takenDoses / totalDoses) * 100)) : 0,
    };
  });

  if (req.user.role === 'elderly') {
    const linkedProfile = getLinkedProfileForUser(req.user.id);
    const activeProfileId = linkedProfile?.id || req.user.id;
    const today = localDate(new Date(), getUserTimezone(req.user));
    const myMeds = db.data.medications.filter(m => m.profileId === activeProfileId);
    const myLogs = db.data.medicationLogs.filter(l => l.profileId === activeProfileId && l.date === today);
    const myTotal = myMeds.reduce((s, m) => s + (m.times?.length || 0), 0);
    const myTaken = myLogs.filter(l => ['taken', 'caregiver_marked'].includes(l.status)).length;
    dashboardData.push({
      profile: { ...(linkedProfile || {}), id: activeProfileId, name: linkedProfile?.name || req.user.name, relationship: 'kendim' },
      medicationCount: myMeds.length, takenDoses: myTaken, totalDoses: myTotal,
      adherence: myTotal > 0 ? Math.round((myTaken / myTotal) * 100) : 0,
    });
  }

  res.json(dashboardData);
});

export default router;
