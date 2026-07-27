import { db } from '../db.js';

function removeUserFromData(data, userId) {
  const user = (data.users || []).find(item => item.id === userId);
  if (!user) return null;
  const ownedProfiles = (data.profiles || []).filter(profile => profile.caregiverId === userId);
  const profileIds = new Set([userId, ...ownedProfiles.map(profile => profile.id)]);

  data.users = (data.users || []).filter(item => item.id !== userId);
  data.notifications = (data.notifications || []).filter(item => item.userId !== userId);
  data.emergencyContacts = (data.emergencyContacts || []).filter(item => item.userId !== userId);
  data.medications = (data.medications || []).filter(item => !profileIds.has(item.profileId));
  data.medicationLogs = (data.medicationLogs || []).filter(item => !profileIds.has(item.profileId));
  data.appointments = (data.appointments || []).filter(item => !profileIds.has(item.profileId));
  data.healthRecords = (data.healthRecords || []).filter(item => !profileIds.has(item.profileId));
  data.emergencies = (data.emergencies || []).filter(item => !profileIds.has(item.profileId));
  data.profiles = (data.profiles || []).filter(profile => profile.caregiverId !== userId);
  for (const profile of data.profiles.filter(item => item.linkedUserId === userId)) profile.linkedUserId = null;

  return { user, profileIds: [...profileIds] };
}

export function removeUserFromState(userId) {
  const result = removeUserFromData(db.data, userId);
  if (!result) return null;
  for (const backup of db.data.adminBackups || []) {
    if (backup.data) removeUserFromData(backup.data, userId);
  }
  const removedIds = new Set([userId, ...result.profileIds]);
  db.data.adminAuditLogs = (db.data.adminAuditLogs || []).filter(log => !removedIds.has(log.resourceId));
  return result;
}
