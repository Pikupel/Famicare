import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createTitckPreview } from './titck-import.js';

function addSheet(workbook, name, status) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(['Başlık']);
  sheet.addRow(['Dönem']);
  sheet.addRow(['İlaç Adı', 'Barkod', 'ATC Kodu', 'ATC Adı', 'Firma Adı', 'Reçete Türü', 'Durumu', 'Açıklama']);
  for (let index = 0; index < 101; index++) {
    sheet.addRow([
      `${status} ilaç ${index}`,
      String(8600000000000 + index + (status === 'Pasif' ? 1000 : 0)),
      'A10BA02',
      'metformin',
      'Test Firma',
      'Normal',
      status,
      '',
    ]);
  }
}

test('TİTCK importer rejects non-official URLs', async () => {
  await assert.rejects(() => createTitckPreview('https://example.com/list.xlsx'), /titck\.gov\.tr/);
});

test('TİTCK importer validates and previews the official workbook shape', async () => {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, 'AKTİF ÜRÜNLER LİSTESİ', 'Aktif');
  addSheet(workbook, 'PASİF ÜRÜNLER LİSTESİ', 'Pasif');
  const bytes = await workbook.xlsx.writeBuffer();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(bytes, {
    status: 200,
    headers: { 'content-length': String(bytes.byteLength) },
  });
  try {
    const preview = await createTitckPreview('https://titck.gov.tr/list.xlsx');
    assert.equal(preview.active, 101);
    assert.equal(preview.passive, 101);
    assert.equal(preview.total, 202);
    assert.equal(preview.added, 202);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
