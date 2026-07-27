import { db } from '../db.js';

function removeUserFromData(data, userId) {
  const user = (data.users || []).find(item => item.id === userId);
  if (!user) return null;
  const ownedProfiles = (data.profiles || []).filter(profile => profile.caregiverId === userId);
  const linkedProfiles = (data.profiles || []).filter(profile => profile.linkedUserId === userId);
  const profileIds = new Set([userId, ...ownedProfiles.map(profile => profile.id), ...linkedProfiles.map(profile => profile.id)]);

  data.users = (data.users || []).filter(item => item.id !== userId);
  data.notifications = (data.notifications || []).filter(item => item.userId !== userId);
  data.emergencyContacts = (data.emergencyContacts || []).filter(item => item.userId !== userId);
  data.authSessions = (data.authSessions || []).filter(item => item.userId !== userId);
  data.pushDeliveries = (data.pushDeliveries || []).filter(item => item.userId !== userId);
  data.phoneVerifications = (data.phoneVerifications || []).filter(item => item.phone !== user.phone);
  data.medications = (data.medications || []).filter(item => !profileIds.has(item.profileId));
  data.medicationLogs = (data.medicationLogs || []).filter(item => !profileIds.has(item.profileId));
  data.appointments = (data.appointments || []).filter(item => !profileIds.has(item.profileId));
  data.healthRecords = (data.healthRecords || []).filter(item => !profileIds.has(item.profileId));
  data.emergencies = (data.emergencies || []).filter(item => !profileIds.has(item.profileId));
  data.profiles = (data.profiles || []).filter(profile => profile.caregiverId !== userId && profile.linkedUserId !== userId);

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
