import test from 'node:test';
import assert from 'node:assert/strict';
import { db, initDb, mutateAndPersistDeletion, createStateSnapshot } from './db.js';

test('hosted Railway runtime refuses to start without PostgreSQL', async () => {
  const oldRailway = process.env.RAILWAY_ENVIRONMENT;
  const oldDatabaseUrl = process.env.DATABASE_URL;
  process.env.RAILWAY_ENVIRONMENT = 'production-id';
  delete process.env.DATABASE_URL;
  try {
    await assert.rejects(initDb(), /DATABASE_URL zorunludur/);
  } finally {
    if (oldRailway === undefined) delete process.env.RAILWAY_ENVIRONMENT; else process.env.RAILWAY_ENVIRONMENT = oldRailway;
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldDatabaseUrl;
  }
});

test('large drug catalog is excluded from the frequently-written application snapshot', () => {
  const originalData = db.data;
  db.data = { ...structuredClone(originalData), drugReferences: [{ barkod: '123', ilac_adi: 'Test' }] };
  try {
    const snapshot = createStateSnapshot();
    assert.equal(Object.hasOwn(snapshot, 'drugReferences'), false);
  } finally {
    db.data = originalData;
  }
});

test('failed deletion persistence restores the previous in-memory state', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  db.data = { ...structuredClone(originalData), users: [{ id: 'rollback-user' }] };
  db.write = async () => { throw new Error('simulated persistence failure'); };

  try {
    await assert.rejects(
      mutateAndPersistDeletion(() => {
        db.data.users = [];
        return { userIds: ['rollback-user'] };
      }),
      /simulated persistence failure/,
    );
    assert.equal(db.data.users.length, 1);
    assert.equal(db.data.users[0].id, 'rollback-user');
  } finally {
    db.data = originalData;
    db.write = originalWrite;
  }
});
