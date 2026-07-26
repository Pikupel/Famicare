import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

export async function setupNotifications() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('medication', {
        name: 'İlaç Hatırlatma',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 500, 200, 500],
      });
      await Notifications.setNotificationChannelAsync('missed_dose', {
        name: 'Kaçırılan Doz',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 1000, 500, 1000],
      });
    }

    // Get Expo push token and save to backend
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.patch('/me', { fcmToken: tokenData.data });
    return true;
  } catch {
    return false;
  }
}

export async function sendTestNotification() {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Test Bildirimi',
        body: 'Famicare push notification çalışıyor! ✅',
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { type: 'date', date: new Date(Date.now() + 2000) } as any,
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleMedicationReminder(medId: string, name: string, timeString: string) {
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
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { medicationId: medId, type: 'medication_reminder' },
      },
      trigger: { date: trigger, type: 'date' } as any,
    });

    const r10 = new Date(trigger.getTime() + 600000);
    const r30 = new Date(trigger.getTime() + 1800000);
    await Notifications.scheduleNotificationAsync({
      identifier: medId + '_10',
      content: { title: '⚠️ İlaç Hatırlatma', body: `${name} ilacınızı almadınız.`, sound: 'default', priority: Notifications.AndroidNotificationPriority.HIGH, data: { medicationId: medId, type: 'missed_dose' } },
      trigger: { date: r10, type: 'date' } as any,
    });
    await Notifications.scheduleNotificationAsync({
      identifier: medId + '_30',
      content: { title: '🔴 İlaç Alınmadı', body: `${name} ilacınızı almayı unuttunuz!`, sound: 'default', priority: Notifications.AndroidNotificationPriority.MAX, data: { medicationId: medId, type: 'missed_dose' } },
      trigger: { date: r30, type: 'date' } as any,
    });
  } catch {}
}

export async function cancelAllReminders() {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
}
