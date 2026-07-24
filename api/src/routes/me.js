import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const user = db.data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.json(user);
});

router.patch('/', async (req, res) => {
  const { name, phone, fcmToken } = req.body;
  const idx = db.data.users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (name) db.data.users[idx].name = name;
  if (phone) db.data.users[idx].phone = phone;
  if (fcmToken) db.data.users[idx].fcmToken = fcmToken;
  await db.write();
  res.json(db.data.users[idx]);
});

export default router;
