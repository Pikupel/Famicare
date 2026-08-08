import { createHash, randomInt } from 'crypto';
import { db, uuid } from '../db.js';
import { isProductionRuntime } from '../utils/environment.js';

const hash = value => createHash('sha256').update(String(value)).digest('hex');
const TTL_MS = 10 * 60 * 1000;

export async function requestPhoneVerification(phone) {
  if (!db.data.phoneVerifications) db.data.phoneVerifications = [];
  const recent = db.data.phoneVerifications.find(item =>
    item.phone === phone && Date.now() - new Date(item.createdAt).getTime() < 60_000
  );
  if (recent) throw new Error('Yeni kod istemeden önce bir dakika bekleyin');

  const code = String(randomInt(100000, 1000000));
  const verification = {
    id: uuid(),
    phone,
    codeHash: hash(code),
    attempts: 0,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    consumedAt: null,
  };
  db.data.phoneVerifications = db.data.phoneVerifications
    .filter(item => new Date(item.expiresAt) > new Date() && !item.consumedAt)
    .slice(-1000);
  db.data.phoneVerifications.push(verification);
  await db.write();
  try {
    await sendSms(phone, `Famicare doğrulama kodunuz: ${code}. Kod 10 dakika geçerlidir.`);
  } catch (error) {
    db.data.phoneVerifications = db.data.phoneVerifications.filter(item => item.id !== verification.id);
    await db.write();
    throw error;
  }
  return { verificationId: verification.id, expiresIn: TTL_MS / 1000, devCode: isProductionRuntime() ? undefined : code };
}

export async function consumePhoneVerification(id, phone, code) {
  const verification = db.data.phoneVerifications?.find(item => item.id === id && item.phone === phone);
  if (!verification || verification.consumedAt || new Date(verification.expiresAt) <= new Date()) return false;
  verification.attempts += 1;
  if (verification.attempts > 5 || verification.codeHash !== hash(code)) {
    await db.write();
    return false;
  }
  verification.consumedAt = new Date().toISOString();
  await db.write();
  return true;
}

async function sendSms(phone, message) {
  const endpoint = process.env.SMS_WEBHOOK_URL;
  if (!endpoint) {
    if (isProductionRuntime()) throw new Error('SMS sağlayıcısı yapılandırılmamış');
    console.log(`[DEV SMS] ${phone}: ${message}`);
    return;
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ phone, message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Doğrulama SMS’i gönderilemedi');
}
