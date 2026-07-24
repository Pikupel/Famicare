import { Platform } from 'react-native';
import { api } from './api';

async function getNotifications() {
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function setupNotifications() {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication', {
        name: 'İlaç Hatırlatma',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 500, 200, 500],
      });
      await Notifications.setNotificationChannelAsync('missed_dose', {
        name: 'Kaçırılan Doz',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 1000, 500, 1000],
      });
    }

    try {
      const expoToken = await Notifications.getExpoPushTokenAsync();
      try { await api.patch('/me', { fcmToken: expoToken.data }); } catch {}
    } catch {}

    return true;
  } catch {
    return false;
  }
}

export async function scheduleMedicationReminder(medId: string, name: string, timeString: string) {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try { await Notifications.cancelScheduledNotificationAsync(medId); } catch {}

  const [h, m] = timeString.split(':').map(Number);
  const now = new Date();
  const trigger = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  if (trigger <= now) trigger.setDate(trigger.getDate() + 1);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: medId,
      content: {
        title: '💊 İlaç Zamanı',
        body: `${name} - ${timeString}`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { medicationId: medId, type: 'medication_reminder' },
      },
      trigger: { type: 'date', date: trigger },
    });

    const r10 = new Date(trigger.getTime() + 600000);
    const r30 = new Date(trigger.getTime() + 1800000);
    await Notifications.scheduleNotificationAsync({
      identifier: medId + '_10',
      content: { title: '⚠️ İlaç Hatırlatma', body: `${name} ilacınızı almadınız.`, sound: 'default', priority: Notifications.AndroidNotificationPriority.HIGH, data: { medicationId: medId, type: 'missed_dose', escalation: 1 } },
      trigger: { type: 'date', date: r10 },
    });
    await Notifications.scheduleNotificationAsync({
      identifier: medId + '_30',
      content: { title: '🔴 İlaç Alınmadı', body: `${name} ilacınızı almayı unuttunuz!`, sound: 'default', priority: Notifications.AndroidNotificationPriority.MAX, data: { medicationId: medId, type: 'missed_dose', escalation: 2 } },
      trigger: { type: 'date', date: r30 },
    });
  } catch {}
}

export async function cancelAllReminders() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
}
