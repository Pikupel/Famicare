import ExcelJS from 'exceljs';
import { createHash, randomUUID } from 'crypto';

const MAX_FILE_SIZE = 30 * 1024 * 1024;
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const previews = new Map();

function validateSourceUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' || !['titck.gov.tr', 'www.titck.gov.tr'].includes(url.hostname)) {
    throw new Error('Yalnızca titck.gov.tr üzerindeki HTTPS dosyaları kullanılabilir');
  }
  if (!url.pathname.toLocaleLowerCase('tr-TR').endsWith('.xlsx')) throw new Error('Kaynak bir XLSX dosyası olmalıdır');
  return url;
}

function findSheet(workbook, expectedName) {
  return workbook.worksheets.find(sheet =>
    sheet.name.trim().normalize('NFKC').toLocaleUpperCase('tr-TR') === expectedName
  );
}

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseProducts(sheet, status) {
  if (!sheet) throw new Error(`${status === 'aktif' ? 'AKTİF' : 'PASİF'} ÜRÜNLER LİSTESİ bulunamadı`);
  const headers = sheet.getRow(3).values.slice(1).map(cellText);
  if (headers[0] !== 'İlaç Adı' || headers[1] !== 'Barkod' || headers[2] !== 'ATC Kodu' || headers[3] !== 'ATC Adı') {
    throw new Error(`${sheet.name} sütun yapısı beklenen TİTCK biçimiyle eşleşmiyor`);
  }
  const products = [];
  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber++) {
    const values = sheet.getRow(rowNumber).values.slice(1);
    const name = cellText(values[0]);
    const barcode = cellText(values[1]);
    if (!name || !/^\d{8,14}$/.test(barcode)) continue;
    products.push({
      ilac_adi: name, barkod: barcode, atc_kodu: cellText(values[2]), atc_adi: cellText(values[3]),
      firma_adi: cellText(values[4]), recete_turu: cellText(values[5]), durum: status,
      aciklama: cellText(values[7]),
      ingredientStatus: cellText(values[2]) && cellText(values[3]) ? 'atc_candidate' : 'unmapped',
      source: 'TITCK',
    });
  }
  return products;
}

export async function createTitckPreview(sourceUrl, currentProducts = []) {
  const now = Date.now();
  for (const [key, preview] of previews) {
    if (now - preview.createdAt > PREVIEW_TTL_MS) previews.delete(key);
  }
  if (previews.size >= 3) throw new Error('Çok fazla bekleyen önizleme var; mevcut önizlemeyi uygulayın veya süresinin dolmasını bekleyin');
  const url = validateSourceUrl(sourceUrl);
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`TİTCK dosyası indirilemedi (${response.status})`);
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_FILE_SIZE) throw new Error('TİTCK dosyası izin verilen boyutu aşıyor');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_FILE_SIZE || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error('İndirilen dosya geçerli veya izin verilen boyutta bir XLSX değil');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const active = parseProducts(findSheet(workbook, 'AKTİF ÜRÜNLER LİSTESİ'), 'aktif');
  const passive = parseProducts(findSheet(workbook, 'PASİF ÜRÜNLER LİSTESİ'), 'pasif');
  if (active.length < 100 || passive.length < 100) throw new Error('TİTCK dosyasında beklenen ürün sayısı bulunamadı');

  const currentByBarcode = new Map(currentProducts.map(product => [String(product.barkod), product]));
  const products = [...active, ...passive].map(product => {
    const existing = currentByBarcode.get(product.barkod);
    return existing ? {
      ...existing, ...product, ingredients: existing.ingredients || [],
      ingredientStatus: existing.ingredients?.length ? 'verified' : product.ingredientStatus,
    } : product;
  });
  const incomingBarcodes = new Set(products.map(product => product.barkod));
  let added = 0, updated = 0, unchanged = 0;
  for (const product of products) {
    const existing = currentByBarcode.get(product.barkod);
    if (!existing) added++;
    else if (['ilac_adi', 'atc_kodu', 'atc_adi', 'firma_adi', 'recete_turu', 'durum'].some(key => String(existing[key] || '') !== String(product[key] || ''))) updated++;
    else unchanged++;
  }
  const removed = [...currentByBarcode.keys()].filter(barcode => !incomingBarcodes.has(barcode)).length;
  const token = randomUUID();
  const preview = {
    token, sourceUrl: url.toString(), checksum: createHash('sha256').update(buffer).digest('hex'),
    products, createdAt: Date.now(),
    summary: { active: active.length, passive: passive.length, total: products.length, added, updated, unchanged, removed },
  };
  previews.set(token, preview);
  return { token, sourceUrl: preview.sourceUrl, checksum: preview.checksum, expiresIn: PREVIEW_TTL_MS / 1000, ...preview.summary };
}

export function consumeTitckPreview(token) {
  const key = String(token || '');
  const preview = previews.get(key);
  previews.delete(key);
  if (!preview || Date.now() - preview.createdAt > PREVIEW_TTL_MS) throw new Error('TİTCK önizlemesi bulunamadı veya süresi doldu');
  return preview;
}
