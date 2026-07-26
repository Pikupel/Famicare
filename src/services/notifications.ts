import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import Constants from 'expo-constants';

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
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return false;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
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
  const [h, m] = timeString.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return;
  const identifier = doseNotificationId(medId, timeString);
  try { await Notifications.cancelScheduledNotificationAsync(identifier); } catch {}

  try {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: '💊 İlaç Zamanı',
        body: `${name} - ${timeString}`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { medicationId: medId, scheduledTime: timeString, type: 'medication_reminder', url: `/confirm-medication?id=${encodeURIComponent(medId)}&name=${encodeURIComponent(name)}&time=${encodeURIComponent(timeString)}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: h,
        minute: m,
        channelId: 'medication',
      },
    });
  } catch {}
}

export async function schedulePostponedReminder(medId: string, name: string, timeString: string) {
  await Notifications.scheduleNotificationAsync({
    identifier: `${doseNotificationId(medId, timeString)}_postponed`,
    content: {
      title: '⏰ Ertelenen ilaç zamanı',
      body: `${name} ilacınızı şimdi almayı unutmayın.`,
      sound: 'default',
      data: { medicationId: medId, scheduledTime: timeString, type: 'postponed' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 15 * 60,
      channelId: 'medication',
    },
  });
}

export async function cancelDoseFollowups(medId: string, timeString: string) {
  try { await Notifications.cancelScheduledNotificationAsync(`${doseNotificationId(medId, timeString)}_postponed`); } catch {}
}

function doseNotificationId(medId: string, timeString: string) {
  return `med_${medId}_${timeString.replace(':', '')}`;
}
