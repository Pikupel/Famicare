import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const notifications = db.data.notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(notifications);
});

router.put('/:id/read', async (req, res) => {
  const idx = db.data.notifications.findIndex(n => n.id === req.params.id && n.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Bildirim bulunamadı' });
  db.data.notifications[idx].isRead = true;
  await db.write();
  res.json(db.data.notifications[idx]);
});

export default router;
