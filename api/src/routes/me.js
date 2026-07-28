import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, deleteRelationalData, pgPool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { removeUserFromState } from '../services/user-deletion.js';
import { revokeUserSessions } from '../services/sessions.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.json(user);
});

router.patch('/', async (req, res) => {
  const { name, fcmToken } = req.body;
  const idx = db.data.users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (name) db.data.users[idx].name = name;
  if (fcmToken !== undefined) db.data.users[idx].fcmToken = fcmToken || null;
  await db.write();
  res.json(db.data.users[idx]);
});

router.patch('/subscription', async (req, res) => {
  const { isSubscribed, productId, expiresAt } = req.body;
  const idx = db.data.users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  db.data.users[idx].subscription = isSubscribed ? 'premium' : null;
  db.data.users[idx].subscriptionProductId = productId || null;
  db.data.users[idx].subscriptionExpiresAt = expiresAt || null;
  await db.write();
  res.json({ success: true, subscription: db.data.users[idx].subscription });
});

router.delete('/', async (req, res) => {
  if (req.body?.confirmation !== 'HESABIMI SİL') return res.status(400).json({ error: 'Onay metni HESABIMI SİL olmalıdır' });
  if (process.env.DATABASE_URL && !pgPool) return res.status(503).json({ error: 'Kalıcı veritabanına ulaşılamıyor. Hesap silinmedi.' });
  const user = db.data.users.find(item => item.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (!await bcrypt.compare(String(req.body?.pin || ''), user.pinHash || '')) return res.status(401).json({ error: 'PIN hatalı' });
  const deletion = removeUserFromState(user.id);
  revokeUserSessions(user.id);
  await db.write();
  await deleteRelationalData({ userIds: [user.id], profileIds: deletion.profileIds });
  res.json({ success: true });
});

export default router;
