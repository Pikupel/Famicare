import { db } from '../db.js';

export function getLinkedProfileForUser(userId) {
  return db.data.profiles.find(
    profile => profile.linkedUserId === userId && profile.isActive !== false
  ) || null;
}

export function resolveProfileId(user, requestedProfileId) {
  if (!user || !requestedProfileId) return null;
  if (requestedProfileId === user.id) {
    return getLinkedProfileForUser(user.id)?.id || user.id;
  }
  return requestedProfileId;
}

export function getAccessibleProfile(user, profileId) {
  if (!user || !profileId) return null;
  const resolvedProfileId = resolveProfileId(user, profileId);

  if (user.id === resolvedProfileId) {
    return { id: user.id, linkedUserId: user.id, caregiverId: null, self: true };
  }

  const profile = db.data.profiles.find(p => p.id === resolvedProfileId && p.isActive !== false);
  if (!profile) return null;
  if (profile.caregiverId === user.id || profile.linkedUserId === user.id) return profile;
  return null;
}

export function requireProfileAccess(req, res, profileId, options = {}) {
  const profile = getAccessibleProfile(req.user, profileId);
  if (!profile) {
    res.status(403).json({ error: 'Bu profile erişim izniniz yok' });
    return null;
  }
  if (options.caregiverOnly && profile.caregiverId !== req.user.id) {
    res.status(403).json({ error: 'Bu işlem yalnızca bağlı yakın tarafından yapılabilir' });
    return null;
  }
  return profile;
}

export function requireRole(req, res, role) {
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(req.user?.role)) {
    res.status(403).json({ error: 'Bu işlem hesap rolünüz için kullanılamaz' });
    return false;
  }
  return true;
}

export function canManageRecord(user, collection, recordId, options = {}) {
  const record = db.data[collection]?.find(item => item.id === recordId);
  if (!record) return { record: null, profile: null };
  const profileId = options.userOwned ? record.userId : record.profileId;
  if (options.userOwned) {
    return record.userId === user.id ? { record, profile: { id: user.id } } : { record: null, profile: null };
  }
  const profile = getAccessibleProfile(user, profileId);
  return profile ? { record, profile } : { record: null, profile: null };
}
