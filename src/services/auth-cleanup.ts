import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const CACHE_PREFIX = 'famicare_cache_';

export async function clearLocalUserData() {
  const tasks: Promise<unknown>[] = [];
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    tasks.push(...scheduled
      .filter(notification => notification.identifier.startsWith('med_'))
      .map(notification => Notifications.cancelScheduledNotificationAsync(notification.identifier)));
  } catch (error) {
    console.warn('[auth-cleanup] Scheduled notifications could not be listed:', error);
  }
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
    if (cacheKeys.length) tasks.push(AsyncStorage.multiRemove(cacheKeys));
  } catch (error) {
    console.warn('[auth-cleanup] Cache keys could not be listed:', error);
  }
  try {
    const { useSubscriptionStore } = await import('../stores/useSubscriptionStore');
    useSubscriptionStore.getState().reset();
  } catch (error) {
    console.warn('[auth-cleanup] Subscription state could not be reset:', error);
  }
  await Promise.allSettled(tasks);
}
