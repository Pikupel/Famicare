import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, mutateAndPersistDeletion, pgPool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { removeUserFromState } from '../services/user-deletion.js';
import { revokeUserSessions } from '../services/sessions.js';
import { syncRevenueCatSubscription } from '../services/revenuecat.js';

const router = Router();
router.use(authMiddleware);

function publicUser(user) {
  const {
    pinHash: ignoredPinHash,
    fcmToken: ignoredPushToken,
    failedLoginAttempts: ignoredFailures,
    loginBlockedUntil: ignoredBlockedUntil,
    ...safeUser
  } = user;
  return safeUser;
}

router.get('/', (req, res) => {
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.json(publicUser(user));
});

router.patch('/', async (req, res) => {
  const { name, fcmToken } = req.body;
  const idx = db.data.users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (name) db.data.users[idx].name = name;
  if (fcmToken !== undefined) db.data.users[idx].fcmToken = fcmToken || null;
  await db.write();
  res.json(publicUser(db.data.users[idx]));
});

router.post('/subscription/sync', async (req, res) => {
  try {
    const subscription = await syncRevenueCatSubscription(req.user.id);
    if (!subscription) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json(subscription);
  } catch (error) {
    res.status(503).json({ error: error.message || 'Abonelik doğrulanamadı' });
  }
});

router.delete('/', async (req, res) => {
  if (req.body?.confirmation !== 'HESABIMI SİL') return res.status(400).json({ error: 'Onay metni HESABIMI SİL olmalıdır' });
  if (process.env.DATABASE_URL && !pgPool) return res.status(503).json({ error: 'Kalıcı veritabanına ulaşılamıyor. Hesap silinmedi.' });
  const user = db.data.users.find(item => item.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (!await bcrypt.compare(String(req.body?.pin || ''), user.pinHash || '')) return res.status(401).json({ error: 'PIN hatalı' });
  await mutateAndPersistDeletion(() => {
    const deletion = removeUserFromState(user.id);
    if (!deletion) return null;
    revokeUserSessions(user.id);
    return { ...deletion, userIds: [user.id], profileIds: deletion.profileIds };
  });
  res.json({ success: true });
});

export default router;
