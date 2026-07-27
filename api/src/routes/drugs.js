import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/search', (req, res) => {
  const query = String(req.query.q || '').toLocaleLowerCase('tr-TR').trim();
  if (query.length < 2) return res.json([]);
  res.json((db.data.drugReferences || [])
    .filter(drug => drug.durum !== 'pasif' && drug.ilac_adi?.toLocaleLowerCase('tr-TR').includes(query))
    .slice(0, 20)
    .map(drug => ({
      id: drug.barkod,
      ilac_adi: drug.ilac_adi,
      barkod: drug.barkod,
      atc_kodu: drug.atc_kodu,
      atc_adi: drug.atc_adi,
      firma_adi: drug.firma_adi,
      recete_turu: drug.recete_turu,
      durum: drug.durum,
      ingredientStatus: drug.ingredientStatus || 'unmapped',
      ingredients: drug.ingredients || [],
      source: drug.source || 'TITCK',
    })));
});

export default router;
