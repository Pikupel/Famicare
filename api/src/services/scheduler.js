import { db, uuid } from '../db.js';
import { sendPush } from './push.js';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
let intervalId = null;

export function startScheduler() {
  if (intervalId) return;
  console.log('⏰ Scheduler başlatıldı (5 dk aralık)');
  checkMissedDoses();
  intervalId = setInterval(checkMissedDoses, CHECK_INTERVAL);
}

export function stopScheduler() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

async function checkMissedDoses() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const medication of db.data.medications) {
    if (!medication.times?.length) continue;
    if (!medication.profileId) continue;

    const profile = db.data.profiles.find(p => p.id === medication.profileId);
    if (!profile) continue;

    // Get the first time of day for this medication
    const [h, m] = medication.times[0].split(':').map(Number);
    const medMinutes = h * 60 + m;

    // Check if the medication time has passed by more than 30 min but less than 90 min
    const minutesSince = currentMinutes - medMinutes;
    if (minutesSince < 30 || minutesSince > 90) continue;

    // Check if already resolved today (taken, caregiver_marked, or caregiver override)
    const today = now.toISOString().split('T')[0];
    const todayLog = db.data.medicationLogs.find(
      l => l.medicationId === medication.id && l.date === today
    );
    if (todayLog && (todayLog.status === 'taken' || todayLog.status === 'caregiver_marked')) continue;

    // For postponed doses, use shorter interval
    const escalationMinutes = todayLog?.status === 'postponed' ? 60 : 30;
    if (minutesSince < escalationMinutes) continue;

    // Check if already notified for this time
    const timeLabel = medication.times[0];
    const alreadyNotified = db.data.notifications.some(
      n => n.type === 'missed_dose' && n.body?.includes(medication.name) && n.body?.includes(timeLabel) && n.createdAt?.startsWith(today)
    );
    if (alreadyNotified) continue;

    // Auto-create unresponded log if none exists
    if (!todayLog) {
      db.data.medicationLogs.push({
        id: uuid(), medicationId: medication.id, profileId: medication.profileId,
        scheduledTime: medication.times[0], date: today, status: 'unresponded',
        takenAt: now.toISOString(), confirmedBy: 'system',
        changedBy: 'system',
      });
    }

    console.log(`⚠️ Kaçırılan doz: ${medication.name} (${profile.name})`);

    // Create notification for the patient
    if (profile.linkedUserId) {
      db.data.notifications.push({
        id: uuid(), userId: profile.linkedUserId, type: 'missed_dose',
        title: '⚠️ Doz Kaçırıldı', body: `${medication.name} - ${medication.times[0]} ilacınızı almadınız.`,
        isRead: false, createdAt: now.toISOString(),
      });
    }

    // Create notification + push for the caregiver
    const caregiverId = profile.caregiverId;
    if (caregiverId) {
      const patientUser = db.data.users.find(u => u.id === profile.linkedUserId || u.id === medication.profileId);
      const patientName = patientUser?.name || profile.name || 'Bir yakınınız';

      db.data.notifications.push({
        id: uuid(), userId: caregiverId, type: 'missed_dose',
        title: `⚠️ ${patientName} ilacını almadı`,
        body: `${medication.name} - ${medication.times[0]}`,
        isRead: false, createdAt: now.toISOString(),
      });

      await sendPush(caregiverId, `⚠️ ${patientName} ilacını almadı`, `${medication.name} - ${medication.times[0]}`);
    }
  }

  await db.write();
}
