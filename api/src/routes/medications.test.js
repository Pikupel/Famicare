import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { db } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import medicationRoutes from './medications.js';

const app = express();
app.use(express.json());
app.use('/api/v1/medications', medicationRoutes);

const original = {};
const originalWrite = db.write;

test.before(() => {
  for (const key of ['users', 'profiles', 'medications', 'medicationLogs']) original[key] = db.data[key];
  db.data.users = [{ id: 'patient', role: 'elderly', phone: '905550000000', timezone: 'Europe/Istanbul' }];
  db.data.profiles = [{ id: 'shared-profile', caregiverId: 'caregiver', linkedUserId: 'patient', isActive: true }];
  db.data.medications = [{
    id: 'med-1',
    profileId: 'shared-profile',
    name: 'Test ilacı',
    times: ['09:00'],
    stockTotal: 10,
    unitsPerDose: 1,
    isActive: true,
  }];
  db.data.medicationLogs = [];
  db.write = async () => {};
});

test.after(() => {
  for (const [key, value] of Object.entries(original)) db.data[key] = value;
  db.write = originalWrite;
});

test('linked patient user id resolves to the shared profile', async () => {
  const response = await request(app)
    .get('/api/v1/medications/profile/patient/today')
    .set('Authorization', `Bearer ${generateToken(db.data.users[0])}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.medications[0].profileId, 'shared-profile');
});

test('taking the same dose twice decrements stock only once', async () => {
  db.data.medications[0].stockTotal = 10;
  db.data.medicationLogs = [];
  const token = generateToken(db.data.users[0]);
  const first = await request(app)
    .post('/api/v1/medications/med-1/log')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'taken', scheduledTime: '09:00' });
  const second = await request(app)
    .post('/api/v1/medications/med-1/log')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'taken', scheduledTime: '09:00' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(db.data.medications[0].stockTotal, 9);
  assert.equal(db.data.medicationLogs.length, 1);
});

test('concurrent requests create one dose log and decrement stock once', async () => {
  db.data.medications[0].stockTotal = 10;
  db.data.medicationLogs = [];
  const token = generateToken(db.data.users[0]);
  const makeRequest = () => request(app)
    .post('/api/v1/medications/med-1/log')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'taken', scheduledTime: '09:00' });
  const [first, second] = await Promise.all([makeRequest(), makeRequest()]);
  assert.deepEqual([first.status, second.status].sort(), [200, 201]);
  assert.equal(db.data.medications[0].stockTotal, 9);
  assert.equal(db.data.medicationLogs.length, 1);
});

test('units per dose can be updated with validation', async () => {
  const token = generateToken(db.data.users[0]);
  const updated = await request(app)
    .patch('/api/v1/medications/med-1')
    .set('Authorization', `Bearer ${token}`)
    .send({ unitsPerDose: 2 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.unitsPerDose, 2);
  const rejected = await request(app)
    .patch('/api/v1/medications/med-1')
    .set('Authorization', `Bearer ${token}`)
    .send({ unitsPerDose: 0 });
  assert.equal(rejected.status, 400);
  assert.equal(db.data.medications[0].unitsPerDose, 2);
});
