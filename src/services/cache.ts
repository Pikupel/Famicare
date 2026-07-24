import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'famicare_cache_';

export async function cacheData(key: string, data: any) {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data, timestamp: Date.now(),
    }));
  } catch {}
}

export async function getCachedData<T>(key: string): Promise<{ data: T; age: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    return { data, age: Date.now() - timestamp };
  } catch {
    return null;
  }
}

export async function clearCache() {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
  if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
}
