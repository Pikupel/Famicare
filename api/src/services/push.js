import { db } from '../db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPush(userId, title, body) {
  const user = db.data.users.find(u => u.id === userId);
  if (!user || !user.fcmToken) {
    console.log(`[PUSH] No token for user ${userId}`);
    return;
  }

  const message = {
    to: user.fcmToken,
    sound: 'default',
    title: title || 'Famicare',
    body: body || '',
    priority: 'high',
    channelId: 'missed_dose',
  };

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    const data = await res.json();
    if (data.data?.status === 'error') {
      console.error('[PUSH] Error:', data.data.message);
      // If invalid token, clear it
      if (data.data.message?.includes('Invalid')) {
        user.fcmToken = null;
        await db.write();
      }
    }
  } catch (err) {
    console.error('[PUSH] Failed:', err.message);
  }
}

export async function sendPushToCaregivers(profileId, title, body) {
  const profile = db.data.profiles.find(p => p.id === profileId);
  if (!profile || !profile.caregiverId) return;
  await sendPush(profile.caregiverId, title, body);
}
