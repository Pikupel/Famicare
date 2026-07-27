import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import authRouter from './auth.js';

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRouter);

test('web account deletion requires the correct PIN and deletes associated data', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  const userId = 'web-delete-user';
  const profileId = 'web-delete-profile';
  db.data = {
    ...structuredClone(originalData),
    users: [{ id: userId, phone: '905551112233', pinHash: bcrypt.hashSync('2468', 4) }],
    profiles: [{ id: profileId, caregiverId: userId }],
    medications: [{ id: 'web-delete-med', profileId }],
    medicationLogs: [], appointments: [], healthRecords: [], emergencies: [],
    emergencyContacts: [], notifications: [], adminBackups: [], adminAuditLogs: [],
  };
  db.write = async () => {};

  try {
    const rejected = await request(app).post('/api/v1/auth/delete-account').send({
      phone: '0555 111 22 33', pin: '1111', confirmation: 'HESABIMI SİL',
    });
    assert.equal(rejected.status, 401);
    assert.equal(db.data.users.length, 1);

    const deleted = await request(app).post('/api/v1/auth/delete-account').send({
      phone: '0555 111 22 33', pin: '2468', confirmation: 'HESABIMI SİL',
    });
    assert.equal(deleted.status, 200);
    assert.equal(db.data.users.length, 0);
    assert.equal(db.data.profiles.length, 0);
    assert.equal(db.data.medications.length, 0);
  } finally {
    db.data = originalData;
    db.write = originalWrite;
  }
});

test('explicit test mode allows registration without SMS verification', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  const originalSetting = process.env.ALLOW_UNVERIFIED_REGISTRATION;
  db.data = {
    ...structuredClone(originalData),
    users: [], profiles: [], phoneVerifications: [], authSessions: [],
  };
  db.write = async () => {};
  process.env.ALLOW_UNVERIFIED_REGISTRATION = 'true';

  try {
    const verification = await request(app).post('/api/v1/auth/request-verification').send({
      phone: '0555 444 33 22',
    });
    assert.equal(verification.status, 200);
    assert.equal(verification.body.verificationRequired, false);

    const registered = await request(app).post('/api/v1/auth/register').send({
      phone: '0555 444 33 22',
      name: 'APK Test Kullanıcısı',
      role: 'elderly',
      pin: '2468',
    });
    assert.equal(registered.status, 201);
    assert.equal(db.data.users.length, 1);
  } finally {
    if (originalSetting === undefined) delete process.env.ALLOW_UNVERIFIED_REGISTRATION;
    else process.env.ALLOW_UNVERIFIED_REGISTRATION = originalSetting;
    db.data = originalData;
    db.write = originalWrite;
  }
});

test('registration requires a valid phone verification code', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  db.data = {
    ...structuredClone(originalData),
    users: [], profiles: [], phoneVerifications: [], authSessions: [],
  };
  db.write = async () => {};
  try {
    const rejected = await request(app).post('/api/v1/auth/register').send({
      phone: '0555 333 22 11', name: 'Yeni Kullanıcı', role: 'elderly', pin: '2468',
    });
    assert.equal(rejected.status, 401);

    const verification = await request(app).post('/api/v1/auth/request-verification').send({
      phone: '0555 333 22 11',
    });
    assert.equal(verification.status, 200);
    assert.equal(typeof verification.body.devCode, 'string');

    const registered = await request(app).post('/api/v1/auth/register').send({
      phone: '0555 333 22 11',
      name: 'Yeni Kullanıcı',
      role: 'elderly',
      pin: '2468',
      verificationId: verification.body.verificationId,
      verificationCode: verification.body.devCode,
    });
    assert.equal(registered.status, 201);
    assert.equal(db.data.users.length, 1);
    assert.equal(typeof registered.body.refreshToken, 'string');
  } finally {
    db.data = originalData;
    db.write = originalWrite;
  }
});
