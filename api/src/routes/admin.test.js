import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { db } from '../db.js';
import bcrypt from 'bcryptjs';
import { generate as generateTotp } from 'otplib';

process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('test-admin-password', 4);
process.env.ADMIN_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
process.env.ADMIN_SESSION_SECRET = 'test-session-secret-with-sufficient-length';
const { default: adminRouter } = await import('./admin.js');

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRouter);

const originalWrite = db.write;
const originalAuditLogs = db.data.adminAuditLogs;

test.before(() => {
  db.write = async () => {};
  db.data.adminAuditLogs = [];
});

test.after(() => {
  db.write = originalWrite;
  db.data.adminAuditLogs = originalAuditLogs;
});

test('admin endpoints reject requests without a session', async () => {
  const response = await request(app).get('/api/v1/admin/stats');
  assert.equal(response.status, 401);
});

test('wrong credentials cannot create a session', async () => {
  const response = await request(app).post('/api/v1/admin/session').send({
    username: 'test-admin', password: 'wrong-password', totp: '000000',
  });
  assert.equal(response.status, 401);
  assert.equal(response.body.token, undefined);
});

test('valid admin session can read stats', async () => {
  const totp = await generateTotp({ secret: process.env.ADMIN_TOTP_SECRET });
  const login = await request(app).post('/api/v1/admin/session').send({
    username: 'test-admin', password: 'test-admin-password', totp,
  });
  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, 'string');

  const stats = await request(app)
    .get('/api/v1/admin/stats')
    .set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(stats.status, 200);
  assert.equal(typeof stats.body.users, 'number');
});

test('destructive operations require the exact confirmation phrase', async () => {
  const totp = await generateTotp({ secret: process.env.ADMIN_TOTP_SECRET });
  const login = await request(app).post('/api/v1/admin/session').send({
    username: 'test-admin', password: 'test-admin-password', totp,
  });
  const response = await request(app)
    .post('/api/v1/admin/clear-all')
    .set('Authorization', `Bearer ${login.body.token}`)
    .send({ confirmation: 'yanlış' });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /TÜM VERİYİ SİL/);
});
