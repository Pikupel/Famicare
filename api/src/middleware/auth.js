import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET üretim ortamında zorunludur');
}
const effectiveSecret = JWT_SECRET || 'famicare-local-development-only';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone },
    effectiveSecret,
    { expiresIn: '30d' }
  );
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, effectiveSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz token' });
  }
}
