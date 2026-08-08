import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '../db.js';

const ENTITLEMENT_ID = process.env.REVENUECAT_ENTITLEMENT_ID || 'premium';
const processingEventIds = new Set();

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''));
  const right = Buffer.from(String(rightValue || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyRevenueCatWebhook(req) {
  const authSecret = process.env.REVENUECAT_WEBHOOK_AUTH;
  const signingSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  if (!authSecret && !signingSecret) return false;

  if (authSecret && !safeEqual(req.headers.authorization, authSecret)) return false;
  if (signingSecret) {
    const signatureHeader = String(req.headers['x-revenuecat-webhook-signature'] || '');
    const fields = Object.fromEntries(signatureHeader.split(',').map(part => part.trim().split('=', 2)));
    const timestamp = Number(fields.t);
    if (!timestamp || !fields.v1 || Math.abs(Date.now() / 1000 - timestamp) > 300 || !req.rawBody) return false;
    const expected = createHmac('sha256', signingSecret)
      .update(`${timestamp}.`)
      .update(req.rawBody)
      .digest('hex');
    if (!safeEqual(fields.v1, expected)) return false;
  }
  return true;
}

export async function fetchRevenueCatSubscription(userId) {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) throw new Error('RevenueCat sunucu API anahtarı yapılandırılmamış');
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`RevenueCat doğrulaması başarısız (${response.status})`);
  const payload = await response.json();
  const entitlement = payload?.subscriber?.entitlements?.[ENTITLEMENT_ID];
  const expiresAt = entitlement?.expires_date || null;
  const active = Boolean(entitlement) && (!expiresAt || new Date(expiresAt) > new Date());
  return {
    active,
    productId: entitlement?.product_identifier || null,
    expiresAt: active ? (expiresAt || 'lifetime') : null,
  };
}

export async function syncRevenueCatSubscription(userId) {
  const user = db.data.users.find(item => item.id === userId);
  if (!user) return null;
  const subscription = await fetchRevenueCatSubscription(userId);
  user.subscription = subscription.active ? 'premium' : null;
  user.subscriptionProductId = subscription.productId;
  user.subscriptionExpiresAt = subscription.expiresAt;
  user.subscriptionVerifiedAt = new Date().toISOString();
  await db.write();
  return subscription;
}

export async function processRevenueCatWebhook(payload) {
  const event = payload?.event;
  if (!event?.id || !event?.type) throw new Error('Geçersiz RevenueCat webhook gövdesi');
  if (!db.data.revenueCatWebhookEvents) db.data.revenueCatWebhookEvents = [];
  if (db.data.revenueCatWebhookEvents.some(item => item.id === event.id)) return { duplicate: true };
  if (processingEventIds.has(event.id)) return { duplicate: true };
  processingEventIds.add(event.id);

  try {
    const candidateIds = [event.app_user_id, event.original_app_user_id, ...(event.aliases || [])].filter(Boolean);
    const user = db.data.users.find(item => candidateIds.includes(item.id));
    let subscription = null;
    if (user && event.type !== 'TEST') subscription = await syncRevenueCatSubscription(user.id);
    db.data.revenueCatWebhookEvents.unshift({
      id: event.id,
      type: event.type,
      userId: user?.id || null,
      receivedAt: new Date().toISOString(),
    });
    db.data.revenueCatWebhookEvents = db.data.revenueCatWebhookEvents.slice(0, 2000);
    await db.write();
    return { duplicate: false, userId: user?.id || null, subscription };
  } finally {
    processingEventIds.delete(event.id);
  }
}
