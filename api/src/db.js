import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = process.env.LOCAL_DB_PATH
  ? join(process.cwd(), process.env.LOCAL_DB_PATH)
  : join(__dirname, '..', 'data', 'db.local.json');
mkdirSync(dirname(file), { recursive: true });

const defaultData = {
  users: [], profiles: [], medications: [], medicationLogs: [],
  appointments: [], healthRecords: [], emergencies: [],
  emergencyContacts: [], notifications: [], drugReferences: [],
  lastImportDate: '', inviteAttempts: {}, adminAuditLogs: [], adminBackups: [],
  pushDeliveries: [],
  authSessions: [],
  phoneVerifications: [],
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
      if (pgPool) await pgPool.end().catch(() => {});
      pgPool = null;
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Kalıcı PostgreSQL veritabanına bağlanılamadı; veri kaybını önlemek için API başlatılmadı');
      }
    }
  }
  await migrateLinkedProfileRecords();
}

async function migrateLinkedProfileRecords() {
  let changed = false;
  for (const profile of db.data.profiles.filter(item => item.linkedUserId && item.id !== item.linkedUserId)) {
    const oldId = profile.linkedUserId;
    for (const key of ['medications', 'medicationLogs', 'appointments', 'healthRecords', 'emergencies']) {
      for (const record of db.data[key] || []) {
        if (record.profileId === oldId) {
          record.profileId = profile.id;
          changed = true;
        }
      }
    }
  }
  for (const record of db.data.healthRecords || []) {
    if (!['caregiver', 'elderly'].includes(record.recordedBy)) continue;
    const profile = db.data.profiles.find(item => item.id === record.profileId);
    const resolvedUserId = record.recordedBy === 'caregiver'
      ? profile?.caregiverId
      : profile?.linkedUserId || record.profileId;
    if (resolvedUserId) {
      record.recordedBy = resolvedUserId;
      changed = true;
    }
  }
  for (const medication of db.data.medications || []) {
    if (medication.packageCapacity == null && medication.stockTotal != null) {
      medication.packageCapacity = Number(medication.stockTotal);
      changed = true;
    }
    if (!Number.isFinite(Number(medication.unitsPerDose)) || Number(medication.unitsPerDose) <= 0) {
      medication.unitsPerDose = 1;
      changed = true;
    }
  }
  if (changed) {
    await db.write();
    console.log('[MIGRATION] Linked-user records consolidated under profile ids');
  }
}

export async function consolidateUserRecordsIntoProfile(userId, profileId) {
  if (!userId || !profileId || userId === profileId) return false;
  let changed = false;
  for (const key of ['medications', 'medicationLogs', 'appointments', 'healthRecords', 'emergencies']) {
    for (const record of db.data[key] || []) {
      if (record.profileId === userId) {
        record.profileId = profileId;
        changed = true;
      }
    }
  }
  if (changed) await db.write();
  return changed;
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
  await syncFromPg('users', 'id', 'phone', 'name', 'role', 'fcm_token', 'pin_hash', 'timezone', 'created_at');
  await syncFromPg('profiles', 'id', 'caregiver_id', 'name', 'birth_date', 'relationship', 'phone', 'invite_code', 'linked_user_id', 'is_active', 'created_at');
  await syncFromPg('medications', 'id', 'profile_id', 'name', 'dosage', 'instructions', 'times', 'end_date', 'purpose', 'stock_total', 'is_active', 'created_at');
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
  pin_hash: 'pinHash', timezone: 'timezone',
  created_at: 'createdAt', birth_date: 'birthDate', invite_code: 'inviteCode',
  is_active: 'isActive', end_date: 'endDate', stock_total: 'stockTotal',
  stock_refill_date: 'stockRefillDate', user_id: 'userId',
};

async function syncFromPg(table, ...columns) {
  try {
    const result = await pgPool.query(`SELECT * FROM ${table}`);
    const items = result.rows.map(row => {
      const obj = {};
      for (const col of columns) {
        const jsKey = SNAKE_TO_CAMEL[col] || col;
        let value = row[col] !== null && row[col] !== undefined ? row[col] : '';
        if (col === 'times' && typeof value === 'string') {
          try { value = JSON.parse(value); } catch { value = value.split(',').map(item => item.trim()).filter(Boolean); }
        }
        obj[jsKey] = value;
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


async function deleteRelationalData({ userIds = [], profileIds = [], clearAll = false } = {}) {
  if (!pgPool) return;
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    if (clearAll) {
      for (const table of ['medication_logs', 'medications', 'appointments', 'health_records', 'notifications', 'emergencies', 'emergency_contacts', 'profiles', 'users']) {
        await client.query(`DELETE FROM ${table}`);
      }
    } else {
      const uniqueUsers = [...new Set(userIds.filter(Boolean))];
      const uniqueProfiles = [...new Set(profileIds.filter(Boolean))];
      if (uniqueProfiles.length) {
        for (const table of ['medication_logs', 'medications', 'appointments', 'health_records', 'emergencies']) {
          await client.query(`DELETE FROM ${table} WHERE profile_id = ANY($1::text[])`, [uniqueProfiles]);
        }
        await client.query('DELETE FROM profiles WHERE id = ANY($1::text[])', [uniqueProfiles]);
      }
      if (uniqueUsers.length) {
        await client.query('DELETE FROM notifications WHERE user_id = ANY($1::text[])', [uniqueUsers]);
        await client.query('DELETE FROM emergency_contacts WHERE user_id = ANY($1::text[])', [uniqueUsers]);
        await client.query('UPDATE profiles SET linked_user_id = NULL WHERE linked_user_id = ANY($1::text[])', [uniqueUsers]);
        await client.query('DELETE FROM users WHERE id = ANY($1::text[])', [uniqueUsers]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export { db, uuidv4 as uuid, deleteRelationalData, pgPool };
