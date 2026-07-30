import { db, uuid, pgPool } from '../db.js';
import { sendPush, checkPushReceipts } from './push.js';

const CHECK_INTERVAL = 5 * 60 * 1000;
let intervalId = null;
let isRunning = false;

export function startScheduler() {
  if (intervalId) return;
  checkScheduledEvents().catch(error => console.error('Scheduler:', error.message));
  intervalId = setInterval(() => {
    if (isRunning) return;
    checkScheduledEvents().catch(error => console.error('Scheduler:', error.message));
  }, CHECK_INTERVAL);
}

export function stopScheduler() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
}

function localParts(date, timezone = 'Europe/Istanbul') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function isMedicationActive(medication, date) {
  if (medication.isActive === false) return false;
  if (!medication.endDate) return true;
  const normalized = /^\d{2}\.\d{2}\.\d{4}$/.test(medication.endDate)
    ? medication.endDate.split('.').reverse().join('-')
    : medication.endDate;
  return normalized >= date;
}

async function checkScheduledEvents() {
  if (isRunning) return;
  isRunning = true;
  let lockClient = null;
  const now = new Date();
  if (pgPool) {
    lockClient = await pgPool.connect();
    const lock = await lockClient.query('SELECT pg_try_advisory_lock(734221) AS acquired');
    if (!lock.rows[0]?.acquired) {
      lockClient.release();
      isRunning = false;
      return;
    }
  }

  try {
  for (const medication of db.data.medications) {
    const profile = db.data.profiles.find(p => p.id === medication.profileId);
    const patient = db.data.users.find(u => u.id === (profile?.linkedUserId || medication.profileId));
    const timezone = patient?.timezone || 'Europe/Istanbul';
    const local = localParts(now, timezone);
    if (!medication.times?.length || !isMedicationActive(medication, local.date)) continue;

    for (const scheduledTime of medication.times) {
      const [hour, minute] = scheduledTime.split(':').map(Number);
      const elapsed = local.minutes - (hour * 60 + minute);
      if (elapsed < 30 || elapsed > 240) continue;

      const log = db.data.medicationLogs.find(l =>
        l.medicationId === medication.id && l.date === local.date && l.scheduledTime === scheduledTime
      );
      if (['taken', 'caregiver_marked'].includes(log?.status)) continue;
      if (log?.status === 'postponed' && elapsed < 45) continue;

      const doseKey = `${medication.id}:${local.date}:${scheduledTime}`;
      if (db.data.notifications.some(n => n.doseKey === doseKey && n.type === 'missed_dose')) continue;

      if (!log) {
        db.data.medicationLogs.push({
          id: uuid(), medicationId: medication.id, profileId: medication.profileId,
          scheduledTime, date: local.date, status: 'unresponded',
          takenAt: null, confirmedBy: 'system', changedBy: 'system',
        });
      }

      if (patient) {
        db.data.notifications.push({
          id: uuid(), userId: patient.id, type: 'missed_dose', doseKey,
          title: '⚠️ Doz Kaçırıldı', body: `${medication.name} - ${scheduledTime} dozunu almadınız.`,
          data: { medicationId: medication.id, scheduledTime },
          isRead: false, createdAt: now.toISOString(),
        });
      }

      if (profile?.caregiverId) {
        const patientName = patient?.name || profile.name || 'Yakınınız';
        const notification = {
          id: uuid(), userId: profile.caregiverId, type: 'missed_dose', doseKey,
          title: `⚠️ ${patientName} ilacını almadı`, body: `${medication.name} - ${scheduledTime}`,
          data: { medicationId: medication.id, scheduledTime, profileId: medication.profileId },
          isRead: false, createdAt: now.toISOString(),
        };
        db.data.notifications.push(notification);
        await sendPush(notification.userId, notification.title, notification.body, { doseKey, type: 'missed_dose' });
      }
    }
  }

    await checkAppointmentReminders(now);
    await checkPushReceipts();
    await db.write();
  } finally {
    if (lockClient) {
      await lockClient.query('SELECT pg_advisory_unlock(734221)').catch((e) => console.error('Scheduler: unlock hatası', e.message));
      lockClient.release();
    }
    isRunning = false;
  }
}

async function checkAppointmentReminders(now) {
  for (const appointment of db.data.appointments) {
    if (appointment.status === 'cancelled' || !appointment.date || !appointment.time) continue;
    const target = new Date(`${appointment.date}T${appointment.time}:00+03:00`);
    const hoursUntil = (target.getTime() - now.getTime()) / 3600000;
    if (hoursUntil <= 0 || hoursUntil > 25) continue;
    const reminderKey = `appointment:${appointment.id}:24h`;
    if (db.data.notifications.some(n => n.reminderKey === reminderKey)) continue;
    const profile = db.data.profiles.find(p => p.id === appointment.profileId);
    const recipients = [profile?.linkedUserId, profile?.caregiverId, appointment.profileId]
      .filter(userId => userId && db.data.users.some(user => user.id === userId));
    for (const userId of new Set(recipients)) {
      const notification = {
        id: uuid(), userId, type: 'appointment', reminderKey,
        title: '🏥 Yarın randevunuz var',
        body: `${appointment.title} • ${appointment.time}${appointment.location ? ` • ${appointment.location}` : ''}`,
        data: { appointmentId: appointment.id, profileId: appointment.profileId },
        isRead: false, createdAt: now.toISOString(),
      };
      db.data.notifications.push(notification);
      await sendPush(userId, notification.title, notification.body, { type: 'appointment', appointmentId: appointment.id });
    }
  }
}
