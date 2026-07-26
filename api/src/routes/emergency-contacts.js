import { Router } from 'express';
import { db, uuid } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const contacts = db.data.emergencyContacts?.filter(c => c.userId === req.user.id) || [];
  res.json(contacts);
});

router.post('/', async (req, res) => {
  const { name, phone, relationship } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'İsim ve telefon gerekli' });
  if (!db.data.emergencyContacts) db.data.emergencyContacts = [];
  const contact = { id: uuid(), userId: req.user.id, name, phone, relationship: relationship || 'diğer' };
  db.data.emergencyContacts.push(contact);
  await db.write();
  res.status(201).json(contact);
});

router.delete('/:id', async (req, res) => {
  if (db.data.emergencyContacts) {
    const exists = db.data.emergencyContacts.some(c => c.id === req.params.id && c.userId === req.user.id);
    if (!exists) return res.status(404).json({ error: 'Kişi bulunamadı' });
    db.data.emergencyContacts = db.data.emergencyContacts.filter(c => !(c.id === req.params.id && c.userId === req.user.id));
    await db.write();
  }
  res.json({ success: true });
});

export default router;
