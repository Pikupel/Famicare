import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { db } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import meRouter from './me.js';

const app = express();
app.use(express.json());
app.use('/api/v1/me', meRouter);

test('current-user response never exposes PIN hash or push token', async () => {
  const originalData = db.data;
  const user = {
    id: 'safe-me-user', phone: '905550001122', name: 'Safe User', role: 'elderly',
    pinHash: 'sensitive-hash', fcmToken: 'sensitive-push-token',
  };
  db.data = { ...structuredClone(originalData), users: [user], authSessions: [] };
  try {
    const response = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${generateToken(user)}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.name, 'Safe User');
    assert.equal(Object.hasOwn(response.body, 'pinHash'), false);
    assert.equal(Object.hasOwn(response.body, 'fcmToken'), false);
  } finally {
    db.data = originalData;
  }
});

test('client cannot grant itself premium access', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  const user = { id: 'free-user', phone: '905550001133', name: 'Free User', role: 'elderly' };
  db.data = { ...structuredClone(originalData), users: [user], authSessions: [] };
  db.write = async () => {};
  try {
    const response = await request(app)
      .patch('/api/v1/me/subscription')
      .set('Authorization', `Bearer ${generateToken(user)}`)
      .send({ isSubscribed: true, productId: 'forged' });
    assert.equal(response.status, 404);
    assert.equal(db.data.users[0].subscription, undefined);
  } finally {
    db.data = originalData;
    db.write = originalWrite;
  }
});
