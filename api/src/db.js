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
  lastImportDate: '', inviteAttempts: {}, adminAuditLogs: [], adminBackups: [],
};

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);
const writeJson = db.write.bind(db);

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
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT, name TEXT, role TEXT, fcm_token TEXT, pin_hash TEXT, timezone TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, caregiver_id TEXT, name TEXT, birth_date TEXT, relationship TEXT, phone TEXT, invite_code TEXT, linked_user_id TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY, profile_id TEXT, name TEXT, dosage TEXT, instructions TEXT, times TEXT, end_date TEXT, purpose TEXT, stock_total INT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS medication_logs (id TEXT PRIMARY KEY, medication_id TEXT, profile_id TEXT, scheduled_time TEXT, date TEXT, status TEXT, taken_at TIMESTAMPTZ, confirmed_by TEXT, changed_by TEXT);
    CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY, profile_id TEXT, title TEXT, location TEXT, doctor_name TEXT, date TEXT, time TEXT, notes TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS health_records (id TEXT PRIMARY KEY, profile_id TEXT, record_type TEXT, value_data JSONB DEFAULT '{}', measured_at TIMESTAMPTZ DEFAULT NOW(), recorded_by TEXT);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, body TEXT, is_read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS emergencies (id TEXT PRIMARY KEY, profile_id TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS emergency_contacts (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, phone TEXT, relationship TEXT);
    CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
  `);

  const state = await pgPool.query(`SELECT data FROM app_state WHERE id = 'primary'`);
  if (state.rows[0]?.data) {
    db.data = { ...defaultData, ...state.rows[0].data };
    await writeJson();
    return;
  }

  // Sync FROM PostgreSQL TO JSON (PostgreSQL is source of truth when available)
  await syncFromPg('users', 'id', 'phone', 'name', 'role', 'fcm_token');
  await syncFromPg('profiles', 'id', 'caregiver_id', 'name', 'birth_date', 'relationship', 'phone', 'invite_code', 'linked_user_id');
  await syncFromPg('medications', 'id', 'profile_id', 'name', 'dosage', 'instructions', 'times', 'end_date', 'purpose', 'stock_total');
  await syncFromPg('medication_logs', 'id', 'medication_id', 'profile_id', 'scheduled_time', 'date', 'status', 'taken_at', 'confirmed_by', 'changed_by');
  await syncFromPg('appointments', 'id', 'profile_id', 'title', 'location', 'doctor_name', 'date', 'time', 'notes', 'status');
  await syncFromPg('health_records', 'id', 'profile_id', 'record_type', 'value_data', 'measured_at', 'recorded_by');
  await syncFromPg('notifications', 'id', 'user_id', 'type', 'title', 'body', 'is_read');
  await persistSnapshot();
  console.log('📦 PostgreSQL → JSON senkronizasyon tamam');
}

async function persistSnapshot() {
  if (!pgPool) return;
  await pgPool.query(
    `INSERT INTO app_state (id, data, updated_at) VALUES ('primary', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(db.data)]
  );
}

db.write = async function writeAll() {
  await writeJson();
  if (pgPool) await persistSnapshot();
};

const TABLE_TO_KEY = {
  users: 'users', profiles: 'profiles', medications: 'medications',
  medication_logs: 'medicationLogs', appointments: 'appointments',
  health_records: 'healthRecords', notifications: 'notifications',
  emergencies: 'emergencies', emergency_contacts: 'emergencyContacts',
};

const SNAKE_TO_CAMEL = {
  caregiver_id: 'caregiverId', linked_user_id: 'linkedUserId', profile_id: 'profileId',
  medication_id: 'medicationId', scheduled_time: 'scheduledTime', taken_at: 'takenAt',
  confirmed_by: 'confirmedBy', changed_by: 'changedBy', doctor_name: 'doctorName',
  record_type: 'recordType', value_data: 'valueData', measured_at: 'measuredAt',
  recorded_by: 'recordedBy', is_read: 'isRead', fcm_token: 'fcmToken',
  created_at: 'createdAt', birth_date: 'birthDate', invite_code: 'inviteCode',
  is_active: 'isActive', end_date: 'endDate', stock_total: 'stockTotal',
  stock_refill_date: 'stockRefillDate', user_id: 'userId',
};

const SYNC_TABLES = ['users', 'profiles', 'medications', 'medication_logs', 'appointments', 'health_records', 'notifications'];

async function syncFromPg(table, ...columns) {
  try {
    const result = await pgPool.query(`SELECT * FROM ${table}`);
    const items = result.rows.map(row => {
      const obj = {};
      for (const col of columns) {
        const jsKey = SNAKE_TO_CAMEL[col] || col;
        obj[jsKey] = row[col] !== null && row[col] !== undefined ? row[col] : '';
      }
      return obj;
    });
    const key = TABLE_TO_KEY[table] || table;
    db.data[key] = items;
    console.log(`  📥 ${table}: ${items.length} kayıt senkronize edildi`);
  } catch (e) {
    console.log(`  ⚠️ ${table} senkronizasyon hatası: ${e.message}`);
  }
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
