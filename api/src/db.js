import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import { mkdirSync } from 'fs';
import { isHostedRuntime, isProductionRuntime } from './utils/environment.js';

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
  revenueCatWebhookEvents: [],
};

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);
const catalogFile = join(dirname(file), 'drug-catalog.local.json');
const catalogDb = new Low(new JSONFile(catalogFile), { drugReferences: [] });
const catalogBackupDb = new Low(new JSONFile(join(dirname(file), 'drug-catalog-backups.local.json')), { backups: [] });
const rawWriteJson = db.write.bind(db);

let pgPool = null;

export async function initDb() {
  if (isHostedRuntime() && !process.env.DATABASE_URL) {
    throw new Error('Railway ortamında DATABASE_URL zorunludur; geçici dosya veritabanıyla API başlatılmadı');
  }
  await db.read();
  if (!db.data) db.data = defaultData;
  await catalogDb.read();
  await catalogBackupDb.read();
  if (!catalogDb.data) catalogDb.data = { drugReferences: [] };
  if (!catalogBackupDb.data) catalogBackupDb.data = { backups: [] };
  if (!catalogDb.data.drugReferences.length && db.data.drugReferences?.length) {
    catalogDb.data.drugReferences = db.data.drugReferences;
    await catalogDb.write();
  }
  db.data = { ...defaultData, ...db.data, drugReferences: catalogDb.data.drugReferences || [] };
  await migrateEmbeddedCatalogBackups();
  await writeStateJson();

  if (process.env.DATABASE_URL) {
    try {
      pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
      await pgPool.query('SELECT 1');
      await migratePg();
      console.log('✅ PostgreSQL bağlantısı başarılı');
    } catch (e) {
      console.log('⚠️ PostgreSQL bağlanamadı:', e.message);
      if (pgPool) await pgPool.end().catch((e) => console.error('db: pgPool.end failed', e.message));
      pgPool = null;
      if (isProductionRuntime()) {
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
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, body TEXT, is_read BOOLEAN DEFAULT false, dose_key TEXT, reminder_key TEXT, data JSONB DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS emergencies (id TEXT PRIMARY KEY, profile_id TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS emergency_contacts (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, phone TEXT, relationship TEXT);
    CREATE TABLE IF NOT EXISTS app_state (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS drug_catalog (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS drug_catalog_backups (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
  `);

  const state = await pgPool.query(`SELECT data FROM app_state WHERE id = 'primary'`);
  if (state.rows[0]?.data) {
    const legacyCatalog = state.rows[0].data.drugReferences || [];
    const catalog = await pgPool.query(`SELECT data FROM drug_catalog WHERE id = 'primary'`);
    db.data = { ...defaultData, ...state.rows[0].data, drugReferences: catalog.rows[0]?.data || legacyCatalog };
    if (!catalog.rows[0] && legacyCatalog.length) await persistDrugCatalog();
    await migrateEmbeddedCatalogBackups();
    await persistSnapshot();
    await writeStateJson();
    await writeCatalogJson();
    return;
  }

  // Sync FROM PostgreSQL TO JSON (PostgreSQL is source of truth when available)
  await syncFromPg('users', 'id', 'phone', 'name', 'role', 'fcm_token', 'pin_hash', 'timezone', 'created_at');
  await syncFromPg('profiles', 'id', 'caregiver_id', 'name', 'birth_date', 'relationship', 'phone', 'invite_code', 'linked_user_id', 'is_active', 'created_at');
  await syncFromPg('medications', 'id', 'profile_id', 'name', 'dosage', 'instructions', 'times', 'end_date', 'purpose', 'stock_total', 'is_active', 'created_at');
  await syncFromPg('medication_logs', 'id', 'medication_id', 'profile_id', 'scheduled_time', 'date', 'status', 'taken_at', 'confirmed_by', 'changed_by');
  await syncFromPg('appointments', 'id', 'profile_id', 'title', 'location', 'doctor_name', 'date', 'time', 'notes', 'status');
  await syncFromPg('health_records', 'id', 'profile_id', 'record_type', 'value_data', 'measured_at', 'recorded_by');
  await syncFromPg('notifications', 'id', 'user_id', 'type', 'title', 'body', 'is_read', 'dose_key', 'reminder_key', 'data');
  await persistSnapshot();
  console.log('📦 PostgreSQL → JSON senkronizasyon tamam');
}

async function persistSnapshot(queryable = pgPool) {
  if (!queryable) return;
  const snapshot = createStateSnapshot();
  await queryable.query(
    `INSERT INTO app_state (id, data, updated_at) VALUES ('primary', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(snapshot)]
  );
}

export function createStateSnapshot() {
  const { drugReferences: ignoredCatalog, ...state } = db.data;
  return state;
}

async function writeStateJson() {
  const fullData = db.data;
  db.data = createStateSnapshot();
  try {
    await rawWriteJson();
  } finally {
    db.data = fullData;
  }
}

async function writeCatalogJson() {
  catalogDb.data = { drugReferences: db.data.drugReferences || [] };
  await catalogDb.write();
}

export async function persistDrugCatalog(queryable = pgPool) {
  await writeCatalogJson();
  if (!queryable) return;
  await queryable.query(
    `INSERT INTO drug_catalog (id, data, updated_at) VALUES ('primary', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [JSON.stringify(db.data.drugReferences || [])]
  );
}

export async function createDrugCatalogBackup(id) {
  const data = structuredClone(db.data.drugReferences || []);
  catalogBackupDb.data.backups = [{ id, data }, ...(catalogBackupDb.data.backups || []).filter(item => item.id !== id)].slice(0, 3);
  await catalogBackupDb.write();
  if (pgPool) {
    await pgPool.query(
      `INSERT INTO drug_catalog_backups (id, data, created_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, created_at = NOW()`,
      [id, JSON.stringify(data)]
    );
  }
}

async function migrateEmbeddedCatalogBackups() {
  let changed = false;
  for (const backup of db.data.adminBackups || []) {
    if (!backup.data?.drugReferences) continue;
    const catalogData = backup.data.drugReferences;
    catalogBackupDb.data.backups = [{ id: backup.id, data: catalogData }, ...(catalogBackupDb.data.backups || []).filter(item => item.id !== backup.id)].slice(0, 3);
    if (pgPool) {
      await pgPool.query(
        `INSERT INTO drug_catalog_backups (id, data, created_at) VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (id) DO NOTHING`,
        [backup.id, JSON.stringify(catalogData), backup.createdAt || new Date().toISOString()]
      );
    }
    backup.kind = 'drug-catalog';
    delete backup.data.drugReferences;
    changed = true;
  }
  if (changed) await catalogBackupDb.write();
}

export async function restoreDrugCatalogBackup(id) {
  let data;
  if (pgPool) {
    const result = await pgPool.query('SELECT data FROM drug_catalog_backups WHERE id = $1', [id]);
    data = result.rows[0]?.data;
  } else {
    data = catalogBackupDb.data.backups?.find(item => item.id === id)?.data;
  }
  if (!data) return false;
  db.data.drugReferences = structuredClone(data);
  await persistDrugCatalog();
  return true;
}

db.write = async function writeAll() {
  await writeStateJson();
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
  dose_key: 'doseKey', reminder_key: 'reminderKey',
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


async function executeRelationalDeletes(client, { userIds = [], profileIds = [], clearAll = false } = {}) {
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
}

async function mutateAndPersistDeletion(mutator) {
  const previousData = structuredClone(db.data);
  try {
    const deletion = mutator();
    if (!deletion) return null;
    if (!pgPool) {
      await db.write();
      return deletion;
    }
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await executeRelationalDeletes(client, deletion);
      await persistSnapshot(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch((e) => console.error('db: ROLLBACK failed', e.message));
      throw error;
    } finally {
      client.release();
    }
    await writeStateJson();
    return deletion;
  } catch (error) {
    db.data = previousData;
    throw error;
  }
}

export { db, uuidv4 as uuid, mutateAndPersistDeletion, pgPool };
