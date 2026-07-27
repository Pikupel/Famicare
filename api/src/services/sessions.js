import { createHash, randomBytes } from 'crypto';
import { db, uuid } from '../db.js';
import { generateToken } from '../middleware/auth.js';

const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');

export async function createSession(user) {
  const id = uuid();
  const secret = randomBytes(32).toString('base64url');
  const session = {
    id,
    userId: user.id,
    refreshHash: hash(secret),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + REFRESH_LIFETIME_MS).toISOString(),
    revokedAt: null,
  };
  if (!db.data.authSessions) db.data.authSessions = [];
  db.data.authSessions = db.data.authSessions.filter(item =>
    !item.revokedAt && new Date(item.expiresAt) > new Date()
  ).slice(-5000);
  db.data.authSessions.push(session);
  await db.write();
  return { token: generateToken(user, id), refreshToken: `${id}.${secret}` };
}

export async function rotateSession(refreshToken) {
  const [id, secret] = String(refreshToken || '').split('.');
  const session = db.data.authSessions?.find(item => item.id === id);
  if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date() || hash(secret || '') !== session.refreshHash) {
    return null;
  }
  const user = db.data.users.find(item => item.id === session.userId);
  if (!user) return null;
  const nextSecret = randomBytes(32).toString('base64url');
  session.refreshHash = hash(nextSecret);
  session.rotatedAt = new Date().toISOString();
  await db.write();
  return { token: generateToken(user, session.id), refreshToken: `${session.id}.${nextSecret}` };
}

export async function revokeSession(refreshToken) {
  const [id, secret] = String(refreshToken || '').split('.');
  const session = db.data.authSessions?.find(item => item.id === id);
  if (!session || hash(secret || '') !== session.refreshHash) return;
  session.revokedAt = new Date().toISOString();
  await db.write();
}

export function revokeUserSessions(userId) {
  for (const session of db.data.authSessions || []) {
    if (session.userId === userId && !session.revokedAt) session.revokedAt = new Date().toISOString();
  }
}
