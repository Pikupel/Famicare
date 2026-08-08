import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { findActiveDrugs } from '../utils/drug-search.js';

const router = Router();
router.use(authMiddleware);

router.get('/search', (req, res) => {
  res.json(findActiveDrugs(db.data.drugReferences, req.query.q, 20)
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
