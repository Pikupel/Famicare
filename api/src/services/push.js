import { db } from '../db.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

async function recordDelivery(delivery) {
  if (!db.data.pushDeliveries) db.data.pushDeliveries = [];
  db.data.pushDeliveries.push({
    id: delivery.ticketId || `${Date.now()}-${Math.random()}`,
    attemptedAt: new Date().toISOString(),
    receiptCheckedAt: null,
    ...delivery,
  });
  if (db.data.pushDeliveries.length > 5000) db.data.pushDeliveries = db.data.pushDeliveries.slice(-5000);
  await db.write();
}

export async function sendPush(userId, title, body, data = {}) {
  const user = db.data.users.find(u => u.id === userId);
  if (!user || !user.fcmToken) {
    console.log(`[PUSH] No token for user ${userId}`);
    const result = { success: false, reason: 'token_missing' };
    await recordDelivery({ userId, status: 'failed', ...result });
    return result;
  }

  const message = {
    to: user.fcmToken,
    sound: 'default',
    title: title || 'Famicare',
    body: body || '',
    priority: 'high',
    channelId: 'missed_dose',
    data,
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
      const result = { success: false, reason: data.data.message || 'push_error' };
      await recordDelivery({ userId, status: 'failed', ...result });
      return result;
    }
    const result = { success: true, ticketId: data.data?.id || null };
    await recordDelivery({ userId, status: 'ticket_received', ...result });
    return result;
  } catch (err) {
    console.error('[PUSH] Failed:', err.message);
    const result = { success: false, reason: err.message };
    await recordDelivery({ userId, status: 'failed', ...result });
    return result;
  }
}

export async function checkPushReceipts() {
  const pending = (db.data.pushDeliveries || [])
    .filter(item => item.ticketId && item.status === 'ticket_received' && !item.receiptCheckedAt)
    .slice(0, 1000);
  if (!pending.length) return;
  try {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: pending.map(item => item.ticketId) }),
    });
    if (!response.ok) return;
    const payload = await response.json();
    const checkedAt = new Date().toISOString();
    for (const item of pending) {
      const receipt = payload.data?.[item.ticketId];
      if (!receipt) continue;
      item.receiptCheckedAt = checkedAt;
      item.status = receipt.status === 'ok' ? 'delivered' : 'failed';
      item.reason = receipt.message || receipt.details?.error || null;
      if (receipt.details?.error === 'DeviceNotRegistered') {
        const user = db.data.users.find(candidate => candidate.id === item.userId);
        if (user) user.fcmToken = null;
      }
    }
    await db.write();
  } catch (error) {
    console.error('[PUSH] Receipt check failed:', error.message);
  }
}
