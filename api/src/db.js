import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '..', 'db.json');

const defaultData = {
  users: [], profiles: [], medications: [], medicationLogs: [],
  appointments: [], healthRecords: [], emergencies: [],
  emergencyContacts: [], notifications: [], drugReferences: [],
  lastImportDate: '',
};

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

let pgPool = null;

export async function initDb() {
  await db.read();
  if (!db.data) db.data = defaultData;
  await db.write();

  if (process.env.DATABASE_URL) {
    try {
      pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
      await pgPool.query('SELECT 1');
      await migratePg();
      console.log('✅ PostgreSQL bağlantısı başarılı');
    } catch (e) {
      console.log('⚠️ PostgreSQL bağlanamadı:', e.message);
    }
  }
}

async function migratePg() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT, name TEXT, role TEXT, fcm_token TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, caregiver_id TEXT, name TEXT, birth_date TEXT, relationship TEXT, phone TEXT, invite_code TEXT, linked_user_id TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY, profile_id TEXT, name TEXT, dosage TEXT, instructions TEXT, times TEXT, end_date TEXT, purpose TEXT, stock_total INT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS medication_logs (id TEXT PRIMARY KEY, medication_id TEXT, profile_id TEXT, scheduled_time TEXT, date TEXT, status TEXT, taken_at TIMESTAMPTZ, confirmed_by TEXT, changed_by TEXT);
    CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, profile_id TEXT, title TEXT, location TEXT, doctor_name TEXT, date TEXT, time TEXT, notes TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS health_records (id TEXT PRIMARY KEY, profile_id TEXT, record_type TEXT, value_data JSONB DEFAULT '{}', measured_at TIMESTAMPTZ DEFAULT NOW(), recorded_by TEXT);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, body TEXT, is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS emergencies (id TEXT PRIMARY KEY, profile_id TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS emergency_contacts (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, phone TEXT, relationship TEXT);
  `);
}

// Sync wrapper: writes to JSON + PostgreSQL
async function writeToDb(collection, id, data) {
  // JSON write
  const idx = db.data[collection].findIndex(item => item.id === id);
  if (idx >= 0) db.data[collection][idx] = data;
  else db.data[collection].push(data);
  await db.write();

  // PostgreSQL write
  if (!pgPool) return;
  try {
    const tableName = collection;
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const columns = keys.join(', ');
    await pgPool.query(
      `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}`,
      values
    );
  } catch {}
}

async function deleteFromDb(collection, id) {
  db.data[collection] = db.data[collection].filter(item => item.id !== id);
  await db.write();
  if (!pgPool) return;
  try { await pgPool.query(`DELETE FROM ${collection} WHERE id = $1`, [id]); } catch {}
}

export { db, uuidv4 as uuid, writeToDb, deleteFromDb, pgPool };
