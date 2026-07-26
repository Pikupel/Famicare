import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { generateSecret, generateURI } from 'otplib';

const username = process.env.ADMIN_SETUP_USERNAME || 'admin';
const password = process.env.ADMIN_SETUP_PASSWORD || randomBytes(18).toString('base64url');
const passwordHash = await bcrypt.hash(password, 12);
const totpSecret = generateSecret();
const sessionSecret = randomBytes(48).toString('base64url');
const authenticatorUri = generateURI({
  issuer: 'Famicare Admin',
  label: username,
  secret: totpSecret,
});

console.log('Railway ortam değişkenleri:');
console.log(`ADMIN_USERNAME=${username}`);
console.log(`ADMIN_PASSWORD_HASH=${passwordHash}`);
console.log(`ADMIN_TOTP_SECRET=${totpSecret}`);
console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
console.log('');
console.log(`İlk giriş şifresi: ${password}`);
console.log(`Authenticator kurulum URI: ${authenticatorUri}`);
console.log('');
console.log('Bu çıktıyı güvenli bir parola yöneticisine kaydedin ve terminal geçmişini temizleyin.');
