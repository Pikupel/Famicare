export function findActiveDrugs(drugs, rawQuery, limit = 20) {
  const query = String(rawQuery || '').trim().toLocaleLowerCase('tr-TR');
  if (query.length < 2) return [];
  return (drugs || [])
    .filter(drug => drug.durum !== 'pasif' && drug.ilac_adi?.toLocaleLowerCase('tr-TR').includes(query))
    .slice(0, limit);
}
