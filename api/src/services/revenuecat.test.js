import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'crypto';
import { db } from '../db.js';
import { processRevenueCatWebhook, syncRevenueCatSubscription, verifyRevenueCatWebhook } from './revenuecat.js';

test('RevenueCat webhook authentication rejects missing credentials and accepts valid HMAC', () => {
  const oldAuth = process.env.REVENUECAT_WEBHOOK_AUTH;
  const oldSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  const rawBody = Buffer.from('{"event":{"id":"evt-1"}}');
  const timestamp = Math.floor(Date.now() / 1000);
  process.env.REVENUECAT_WEBHOOK_AUTH = 'Bearer webhook-secret';
  process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = 'signing-secret';
  const signature = createHmac('sha256', 'signing-secret').update(`${timestamp}.`).update(rawBody).digest('hex');
  try {
    assert.equal(verifyRevenueCatWebhook({ headers: {}, rawBody }), false);
    assert.equal(verifyRevenueCatWebhook({
      headers: {
        authorization: 'Bearer webhook-secret',
        'x-revenuecat-webhook-signature': `t=${timestamp},v1=${signature}`,
      },
      rawBody,
    }), true);
  } finally {
    if (oldAuth === undefined) delete process.env.REVENUECAT_WEBHOOK_AUTH; else process.env.REVENUECAT_WEBHOOK_AUTH = oldAuth;
    if (oldSecret === undefined) delete process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET; else process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET = oldSecret;
  }
});

test('subscription status is accepted only from RevenueCat server response', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  const originalFetch = global.fetch;
  const oldKey = process.env.REVENUECAT_SECRET_API_KEY;
  db.data = { ...structuredClone(originalData), users: [{ id: 'rc-user' }] };
  db.write = async () => {};
  process.env.REVENUECAT_SECRET_API_KEY = 'server-secret';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ subscriber: { entitlements: { premium: { expires_date: '2099-01-01T00:00:00Z', product_identifier: 'annual' } } } }),
  });
  try {
    const status = await syncRevenueCatSubscription('rc-user');
    assert.equal(status.active, true);
    assert.equal(db.data.users[0].subscription, 'premium');
    assert.equal(db.data.users[0].subscriptionProductId, 'annual');
  } finally {
    db.data = originalData;
    db.write = originalWrite;
    global.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.REVENUECAT_SECRET_API_KEY; else process.env.REVENUECAT_SECRET_API_KEY = oldKey;
  }
});

test('duplicate RevenueCat event ids are idempotent', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  db.data = { ...structuredClone(originalData), users: [], revenueCatWebhookEvents: [] };
  db.write = async () => {};
  const payload = { event: { id: 'duplicate-event', type: 'TEST', app_user_id: 'nobody' } };
  try {
    assert.equal((await processRevenueCatWebhook(payload)).duplicate, false);
    assert.equal((await processRevenueCatWebhook(payload)).duplicate, true);
    assert.equal(db.data.revenueCatWebhookEvents.length, 1);
  } finally {
    db.data = originalData;
    db.write = originalWrite;
  }
});
