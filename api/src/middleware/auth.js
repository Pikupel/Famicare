import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { randomBytes } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET üretim ortamında zorunludur');
}
const effectiveSecret = JWT_SECRET || (console.warn('[AUTH] JWT_SECRET tanımlanmamış, geçici rastgele secret kullanılıyor. Yeniden başlatmada tüm token\'lar geçersiz olur.'), randomBytes(48).toString('base64url'));

export function generateToken(user, sessionId = null) {
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone, sid: sessionId },
    effectiveSecret,
    { expiresIn: '30m' }
  );
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, effectiveSecret);
    const user = db.data.users.find(item => item.id === payload.id);
    if (!user) return res.status(401).json({ error: 'Hesap artık aktif değil' });
    if (process.env.NODE_ENV === 'production' && !payload.sid) {
      return res.status(401).json({ error: 'Güvenli oturum için yeniden giriş yapın' });
    }
    if (payload.sid && !db.data.authSessions?.some(session => session.id === payload.sid && session.userId === user.id && !session.revokedAt)) {
      return res.status(401).json({ error: 'Oturum sonlandırılmış' });
    }
    req.user = { ...payload, role: user.role, phone: user.phone };
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz token' });
  }
}
