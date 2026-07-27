import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { db } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import profileRoutes from './profiles.js';

const app = express();
app.use(express.json());
app.use('/api/v1/profiles', profileRoutes);

const originalWrite = db.write;
const originalData = db.data;

test.before(() => {
  db.data = {
    ...structuredClone(originalData),
    users: [
      { id: 'caregiver', role: 'caregiver', phone: '905550000001' },
      { id: 'elderly', role: 'elderly', phone: '905550000002' },
    ],
    profiles: [],
    inviteAttempts: {},
  };
  db.write = async () => {};
});

test.after(() => {
  db.data = originalData;
  db.write = originalWrite;
});

test('only caregivers can create followed profiles', async () => {
  const elderly = db.data.users.find(user => user.id === 'elderly');
  const response = await request(app)
    .post('/api/v1/profiles')
    .set('Authorization', `Bearer ${generateToken(elderly)}`)
    .send({ name: 'Yetkisiz profil' });
  assert.equal(response.status, 403);
});

test('only elderly accounts can accept a patient invitation', async () => {
  const caregiver = db.data.users.find(user => user.id === 'caregiver');
  const response = await request(app)
    .post('/api/v1/profiles/accept')
    .set('Authorization', `Bearer ${generateToken(caregiver)}`)
    .send({ inviteCode: '12345678' });
  assert.equal(response.status, 403);
});
