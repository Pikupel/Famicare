import { db, uuid, pgPool } from '../db.js';
import { sendPush, checkPushReceipts } from './push.js';
import { localDateTimeParts, isMedicationActiveOn } from '../utils/date.js';

const CHECK_INTERVAL = 5 * 60 * 1000;
let intervalId = null;
let isRunning = false;
const schedulerStatus = { lastStartedAt: null, lastSuccessAt: null, lastError: null };

export function getSchedulerStatus() {
  return { ...schedulerStatus, running: isRunning };
}

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

export async function checkScheduledEvents() {
  if (isRunning) return;
  isRunning = true;
  schedulerStatus.lastStartedAt = new Date().toISOString();
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
  const pendingLogs = [];
  const pendingNotifications = [];
  const pushJobs = [];
  for (const medication of db.data.medications) {
    const profile = db.data.profiles.find(p => p.id === medication.profileId);
    const patient = db.data.users.find(u => u.id === (profile?.linkedUserId || medication.profileId));
    const timezone = patient?.timezone || 'Europe/Istanbul';
    const local = localDateTimeParts(now, timezone);
    if (!medication.times?.length || !isMedicationActiveOn(medication, local.date)) continue;

    for (const scheduledTime of medication.times) {
      const [hour, minute] = scheduledTime.split(':').map(Number);
      const elapsed = local.minutes - (hour * 60 + minute);
      if (elapsed < 30 || elapsed > 240) continue;

      const log = [...db.data.medicationLogs, ...pendingLogs].find(l =>
        l.medicationId === medication.id && l.date === local.date && l.scheduledTime === scheduledTime
      );
      if (['taken', 'caregiver_marked'].includes(log?.status)) continue;
      if (log?.status === 'postponed' && elapsed < 45) continue;

      const doseKey = `${medication.id}:${local.date}:${scheduledTime}`;
      if ([...db.data.notifications, ...pendingNotifications].some(n => n.doseKey === doseKey && n.type === 'missed_dose')) continue;

      if (!log) {
        pendingLogs.push({
          id: uuid(), medicationId: medication.id, profileId: medication.profileId,
          scheduledTime, date: local.date, status: 'unresponded',
          takenAt: null, confirmedBy: 'system', changedBy: 'system',
        });
      }

      if (patient) {
        pendingNotifications.push({
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
        pendingNotifications.push(notification);
        pushJobs.push([notification.userId, notification.title, notification.body, { doseKey, type: 'missed_dose', medicationId: medication.id, scheduledTime, url: `/confirm-medication?id=${encodeURIComponent(medication.id)}&name=${encodeURIComponent(medication.name)}&time=${encodeURIComponent(scheduledTime)}` }]);
      }
    }
  }

    collectAppointmentReminders(now, pendingNotifications, pushJobs);
    db.data.medicationLogs.push(...pendingLogs);
    db.data.notifications.push(...pendingNotifications);
    try {
      await db.write();
    } catch (error) {
      const logIds = new Set(pendingLogs.map(item => item.id));
      const notificationIds = new Set(pendingNotifications.map(item => item.id));
      db.data.medicationLogs = db.data.medicationLogs.filter(item => !logIds.has(item.id));
      db.data.notifications = db.data.notifications.filter(item => !notificationIds.has(item.id));
      throw error;
    }
    await Promise.allSettled(pushJobs.map(([userId, title, body, data]) => sendPush(userId, title, body, data)));
    await checkPushReceipts();
    schedulerStatus.lastSuccessAt = new Date().toISOString();
    schedulerStatus.lastError = null;
  } catch (error) {
    schedulerStatus.lastError = { message: error.message, at: new Date().toISOString() };
    throw error;
  } finally {
    if (lockClient) {
      await lockClient.query('SELECT pg_advisory_unlock(734221)').catch((e) => console.error('Scheduler: unlock hatası', e.message));
      lockClient.release();
    }
    isRunning = false;
  }
}

function collectAppointmentReminders(now, pendingNotifications, pushJobs) {
  for (const appointment of db.data.appointments) {
    if (appointment.status === 'cancelled' || !appointment.date || !appointment.time) continue;
    const profile = db.data.profiles.find(p => p.id === appointment.profileId);
    const patient = db.data.users.find(u => u.id === (profile?.linkedUserId || appointment.profileId));
    const timezone = patient?.timezone || 'Europe/Istanbul';
    const local = localDateTimeParts(now, timezone);
    const apptHour = parseInt(appointment.time.split(':')[0]);
    const apptMinute = parseInt(appointment.time.split(':')[1]);
    const apptMinutes = apptHour * 60 + apptMinute;
    const hoursUntil = (apptMinutes - local.minutes) / 60;
    if (hoursUntil <= 0 || hoursUntil > 25) continue;
    const reminderKey = `appointment:${appointment.id}:24h`;
    if ([...db.data.notifications, ...pendingNotifications].some(n => n.reminderKey === reminderKey)) continue;
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
      pendingNotifications.push(notification);
      pushJobs.push([userId, notification.title, notification.body, { type: 'appointment', appointmentId: appointment.id, url: `/appointments?profileId=${encodeURIComponent(appointment.profileId)}` }]);
    }
  }
}
