import ExcelJS from 'exceljs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..');
const DB_PATH = join(DATA_DIR, 'db.json');

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
if (files.length === 0) { console.error('❌ Excel bulunamadı'); process.exit(1); }

const FILE = join(DATA_DIR, files[0]);
console.log(`📄 ${files[0]}`);

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(FILE);

function parseSheet(sheetName, durum) {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) { console.log(`  ⏭️ ${sheetName} bulunamadı`); return []; }
  const raw = [];
  sheet.eachRow({ includeEmpty: false }, row => raw.push(row.values.slice(1)));
  const rows = raw.slice(2).filter(r => r[0] && String(r[0]).trim());
  console.log(`  📊 ${sheetName}: ${rows.length} satır`);
  return rows.map(r => ({
    ilac_adi: String(r[0] || '').trim(),
    barkod: String(r[1] || '').trim(),
    atc_kodu: String(r[2] || '').trim(),
    atc_adi: String(r[3] || '').trim(),
    firma_adi: String(r[4] || '').trim(),
    recete_turu: String(r[5] || '').trim(),
    durum: durum,
    aciklama: String(r[6] || '').trim(),
  })).filter(d => d.ilac_adi && d.barkod);
}

// Read existing db
let db = { drugReferences: [], lastImportDate: '' };
if (fs.existsSync(DB_PATH)) {
  db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  if (!db.drugReferences) db.drugReferences = [];
}

const aktif = parseSheet('AKTİF ÜRÜNLER LİSTESİ', 'aktif');
const pasif = parseSheet('PASİF ÜRÜNLER LİSTESİ', 'pasif');

// Build barkod → index map for upsert
const existingMap = new Map();
db.drugReferences.forEach((d, i) => {
  if (d.barkod) existingMap.set(d.barkod, i);
});

let added = 0, updated = 0, deactivated = 0;

// Upsert aktif
for (const drug of aktif) {
  const existing = existingMap.get(drug.barkod);
  if (existing !== undefined) {
    db.drugReferences[existing] = { ...db.drugReferences[existing], ...drug, son_guncelleme: new Date().toISOString() };
    updated++;
  } else {
    db.drugReferences.push({ ...drug, son_guncelleme: new Date().toISOString(), rxcui: null });
    existingMap.set(drug.barkod, db.drugReferences.length - 1);
    added++;
  }
}

// Upsert pasif (mark as pasif)
for (const drug of pasif) {
  const existing = existingMap.get(drug.barkod);
  if (existing !== undefined) {
    db.drugReferences[existing].durum = 'pasif';
    deactivated++;
  } else {
    db.drugReferences.push({ ...drug, son_guncelleme: new Date().toISOString(), rxcui: null });
  }
}

db.lastImportDate = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`\n✅ İşlem tamam: +${added} yeni, ${updated} güncellendi, ${deactivated} pasif`);
console.log(`📦 Toplam: ${db.drugReferences.length} kayıt`);
