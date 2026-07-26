import pg from 'pg';
import { db, uuid } from './db.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

let pgReady = false;

export async function initPg() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  PostgreSQL bağlantısı yok, JSON DB kullanılacak');
    return false;
  }
  try {
    await pool.query('SELECT 1');
    pgReady = true;
    console.log('✅ PostgreSQL bağlantısı başarılı');
    await migrate();
    return true;
  } catch (e) {
    console.log('⚠️  PostgreSQL bağlantı hatası, JSON DB kullanılacak:', e.message);
    return false;
  }
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, phone TEXT UNIQUE, name TEXT, role TEXT,
      fcm_token TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY, caregiver_id TEXT, name TEXT, birth_date TEXT,
      relationship TEXT, phone TEXT, invite_code TEXT, linked_user_id TEXT,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY, profile_id TEXT, name TEXT, dosage TEXT,
      instructions TEXT, times TEXT, end_date TEXT, purpose TEXT,
      stock_total INT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS medication_logs (
      id TEXT PRIMARY KEY, medication_id TEXT, profile_id TEXT,
      scheduled_time TEXT, date TEXT, status TEXT,
      taken_at TIMESTAMPTZ, confirmed_by TEXT, changed_by TEXT
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY, profile_id TEXT, title TEXT, location TEXT,
      doctor_name TEXT, date TEXT, time TEXT, notes TEXT, status TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS health_records (
      id TEXT PRIMARY KEY, profile_id TEXT, record_type TEXT,
      value_data JSONB DEFAULT '{}', measured_at TIMESTAMPTZ DEFAULT NOW(),
      recorded_by TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, body TEXT,
      is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS emergencies (
      id TEXT PRIMARY KEY, profile_id TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('📦 PostgreSQL tabloları oluşturuldu');
}

export async function pgQuery(text, params) {
  if (!pgReady) return null;
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (e) {
    console.error('PostgreSQL sorgu hatası:', e.message);
    return null;
  }
}

export { pgReady, pool };
