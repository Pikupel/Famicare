import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, '..', 'db.json');

const defaultData = {
  users: [],
  profiles: [],
  medications: [],
  medicationLogs: [],
  appointments: [],
  healthRecords: [],
  emergencies: [],
  emergencyContacts: [],
  notifications: [],
};

const adapter = new JSONFile(file);
const db = new Low(adapter, defaultData);

export async function initDb() {
  await db.read();
  if (!db.data) db.data = defaultData;
  await db.write();
}

export { db, uuid };
