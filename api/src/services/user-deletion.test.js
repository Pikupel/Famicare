import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db.js';
import { removeUserFromState } from './user-deletion.js';

test('account deletion removes user data from current state and retained admin backups', () => {
  const originalData = db.data;
  const userId = 'privacy-delete-user';
  const profileId = 'privacy-delete-profile';
  const state = {
    users: [{ id: userId, name: 'Test' }],
    profiles: [{ id: profileId, caregiverId: userId }],
    medications: [{ id: 'med', profileId }],
    medicationLogs: [{ id: 'log', profileId }],
    appointments: [{ id: 'appointment', profileId }],
    healthRecords: [{ id: 'health', profileId }],
    emergencies: [{ id: 'emergency', profileId }],
    emergencyContacts: [{ id: 'contact', userId }],
    notifications: [{ id: 'notification', userId }],
    adminAuditLogs: [{ id: 'audit', resourceId: userId }],
    adminBackups: [{
      id: 'backup',
      data: {
        users: [{ id: userId }],
        profiles: [{ id: profileId, caregiverId: userId }],
        medications: [{ id: 'backup-med', profileId }],
      },
    }],
  };
  db.data = state;
  try {
    const result = removeUserFromState(userId);
    assert.deepEqual(result.profileIds.sort(), [profileId, userId].sort());
    assert.equal(db.data.users.length, 0);
    assert.equal(db.data.profiles.length, 0);
    assert.equal(db.data.medications.length, 0);
    assert.equal(db.data.healthRecords.length, 0);
    assert.equal(db.data.adminAuditLogs.length, 0);
    assert.equal(db.data.adminBackups[0].data.users.length, 0);
    assert.equal(db.data.adminBackups[0].data.profiles.length, 0);
    assert.equal(db.data.adminBackups[0].data.medications.length, 0);
  } finally {
    db.data = originalData;
  }
});

test('linked patient deletion also removes the shared health profile and dependent data', () => {
  const originalData = db.data;
  db.data = {
    users: [{ id: 'patient' }, { id: 'caregiver' }],
    profiles: [{ id: 'shared', caregiverId: 'caregiver', linkedUserId: 'patient' }],
    medications: [{ id: 'med', profileId: 'shared' }],
    medicationLogs: [{ id: 'log', profileId: 'shared' }],
    appointments: [{ id: 'appointment', profileId: 'shared' }],
    healthRecords: [{ id: 'health', profileId: 'shared' }],
    emergencies: [{ id: 'emergency', profileId: 'shared' }],
    emergencyContacts: [], notifications: [], authSessions: [], pushDeliveries: [],
    adminAuditLogs: [], adminBackups: [],
  };
  try {
    const result = removeUserFromState('patient');
    assert.equal(result.profileIds.includes('shared'), true);
    assert.equal(db.data.users.some(user => user.id === 'caregiver'), true);
    assert.equal(db.data.profiles.length, 0);
    assert.equal(db.data.medications.length, 0);
    assert.equal(db.data.medicationLogs.length, 0);
    assert.equal(db.data.healthRecords.length, 0);
  } finally {
    db.data = originalData;
  }
});
