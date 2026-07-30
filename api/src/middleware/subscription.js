import { db } from '../db.js';

export function requireSubscription(req, res, next) {
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (!user.subscription || user.subscription !== 'premium') {
    return res.status(402).json({ error: 'Bu özellik premium üyelik gerektirir', requiresSubscription: true });
  }
  if (user.subscriptionExpiresAt && user.subscriptionExpiresAt !== 'lifetime') {
    if (new Date(user.subscriptionExpiresAt) < new Date()) {
      return res.status(402).json({ error: 'Premium üyeliğiniz sona ermiş', requiresSubscription: true, expired: true });
    }
  }
  next();
}
