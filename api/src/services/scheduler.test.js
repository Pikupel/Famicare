import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db.js';
import { checkScheduledEvents } from './scheduler.js';

test('scheduler rolls back staged logs and notifications when persistence fails', async () => {
  const originalData = db.data;
  const originalWrite = db.write;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const scheduledAt = new Date(Date.now() - 35 * 60 * 1000);
  const parts = Object.fromEntries(formatter.formatToParts(scheduledAt).map(part => [part.type, part.value]));
  const scheduledTime = `${parts.hour}:${parts.minute}`;

  db.data = {
    ...structuredClone(originalData),
    users: [{ id: 'scheduler-patient', role: 'elderly', timezone: 'Europe/Istanbul' }],
    profiles: [{ id: 'scheduler-profile', linkedUserId: 'scheduler-patient', caregiverId: null }],
    medications: [{ id: 'scheduler-med', profileId: 'scheduler-profile', name: 'Test', times: [scheduledTime], isActive: true }],
    medicationLogs: [], notifications: [], appointments: [], pushDeliveries: [],
  };
  db.write = async () => { throw new Error('simulated persistence failure'); };

  try {
    await assert.rejects(checkScheduledEvents(), /simulated persistence failure/);
    assert.equal(db.data.medicationLogs.length, 0);
    assert.equal(db.data.notifications.length, 0);
  } finally {
    db.data = originalData;
    db.write = originalWrite;
  }
});
