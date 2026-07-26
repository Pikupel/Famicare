import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendPush, sendPushToCaregivers } from '../services/push.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const notifications = db.data.notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(notifications);
});

router.post('/', async (req, res) => {
  const { type, title, body } = req.body;
  const notification = {
    id: uuid(), userId: req.user.id, type: type || 'system',
    title: title || '', body: body || '',
    isRead: false, createdAt: new Date().toISOString(),
  };
  db.data.notifications.push(notification);

  // If missed_dose, also notify caregiver + push
  if (type === 'missed_dose') {
    const profiles = db.data.profiles.filter(p => p.linkedUserId === req.user.id);
    for (const profile of profiles) {
      const cgId = profile.caregiverId;
      if (cgId && cgId !== req.user.id) {
        const notifBody = `${req.user.name || 'Yakınınız'} ${(title || 'ilacını')} zamanında almadı.`;
        db.data.notifications.push({
          id: uuid(), userId: cgId, type: 'missed_dose',
          title: `⚠️ ${req.user.name || 'Bir yakınınız'} ilacını almadı`,
          body: notifBody,
          isRead: false, createdAt: new Date().toISOString(),
        });
        sendPush(cgId, title || '⚠️ Doz Kaçırıldı', notifBody);
      }
    }
  }

  // Send push to target user
  if (notification.userId !== req.user.id) {
    sendPush(notification.userId, title, body);
  }

  await db.write();
  res.status(201).json(notification);
});

router.put('/:id/read', async (req, res) => {
  const idx = db.data.notifications.findIndex(n => n.id === req.params.id && n.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Bildirim bulunamadı' });
  db.data.notifications[idx].isRead = true;
  await db.write();
  res.json(db.data.notifications[idx]);
});

export default router;
