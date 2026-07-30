import { db, uuid } from '../db.js';

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
    const response = await res.json();
    if (response.data?.status === 'error') {
      console.error('[PUSH] Error:', response.data.message);
      if (response.data.message?.includes('Invalid')) {
        user.fcmToken = null;
        db.data.notifications.push({
          id: uuid(), userId, type: 'system',
          title: 'Bildirimler çalışmıyor',
          body: 'Cihaz bildirim izniniz kaldırılmış veya süresi dolmuş. Uygulamayı açıp ana sayfayı ziyaret ederek bildirimleri yeniden etkinleştirin.',
          data: { url: user.role === 'caregiver' ? '/caregiver' : '/home' },
          isRead: false, createdAt: new Date().toISOString(),
        });
        await db.write();
      }
      const deliveryResult = { success: false, reason: response.data.message || 'push_error' };
      await recordDelivery({ userId, status: 'failed', ...deliveryResult });
      return deliveryResult;
    }
    const deliveryResult = { success: true, ticketId: response.data?.id || null };
    await recordDelivery({ userId, status: 'ticket_received', ...deliveryResult });
    return deliveryResult;
  } catch (err) {
    console.error('[PUSH] Failed:', err.message);
    const deliveryResult = { success: false, reason: err.message };
    await recordDelivery({ userId, status: 'failed', ...deliveryResult });
    return deliveryResult;
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
