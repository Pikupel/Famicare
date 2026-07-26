import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db.js';
import { getAccessibleProfile, canManageRecord } from './access.js';

const originalProfiles = db.data.profiles;
const originalHealth = db.data.healthRecords;

test.beforeEach(() => {
  db.data.profiles = [{
    id: 'profile-1', caregiverId: 'caregiver-1', linkedUserId: 'patient-1', isActive: true,
  }];
  db.data.healthRecords = [{ id: 'health-1', profileId: 'profile-1' }];
});

test.after(() => {
  db.data.profiles = originalProfiles;
  db.data.healthRecords = originalHealth;
});

test('caregiver and linked patient can access a profile', () => {
  assert.equal(getAccessibleProfile({ id: 'caregiver-1' }, 'profile-1')?.id, 'profile-1');
  assert.equal(getAccessibleProfile({ id: 'patient-1' }, 'profile-1')?.id, 'profile-1');
});

test('unrelated users cannot access health records', () => {
  assert.equal(getAccessibleProfile({ id: 'attacker' }, 'profile-1'), null);
  assert.equal(canManageRecord({ id: 'attacker' }, 'healthRecords', 'health-1').record, null);
});

test('users can access records stored under their own id', () => {
  assert.equal(getAccessibleProfile({ id: 'patient-1' }, 'patient-1')?.self, true);
});
