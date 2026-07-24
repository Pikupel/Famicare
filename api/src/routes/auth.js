import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, uuid } from '../db.js';
import { generateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { phone, name, role } = req.body;
  if (!phone || !name || !role) {
    return res.status(400).json({ error: 'Telefon, isim ve rol gerekli' });
  }
  const existing = db.data.users.find(u => u.phone === phone);
  if (existing) {
    return res.status(409).json({ error: 'Bu telefon zaten kayıtlı' });
  }
  const user = { id: uuid(), phone, name, role, createdAt: new Date().toISOString() };
  db.data.users.push(user);
  // Profile will be created manually by caregiver via add-profile screen
  await db.write();
  const token = generateToken(user);
  res.status(201).json({ user: { id: user.id, name: user.name, role: user.role, phone: user.phone }, token });
});

router.post('/login', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Telefon gerekli' });
  const user = db.data.users.find(u => u.phone === phone);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const token = generateToken(user);
  res.json({ user: { id: user.id, name: user.name, role: user.role, phone: user.phone }, token });
});

export default router;
