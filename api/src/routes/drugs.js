import { Router } from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';

// Search drugs by name from TITCK catalog
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return res.json([]);

  const results = db.data.drugReferences
    .filter(d => {
      if (d.durum === 'pasif') return false; // Only search active
      return d.ilac_adi?.toLowerCase().includes(q);
    })
    .slice(0, 20)
    .map(d => ({
      id: d.barkod,
      ilac_adi: d.ilac_adi,
      barkod: d.barkod,
      atc_kodu: d.atc_kodu,
      atc_adi: d.atc_adi,
      firma_adi: d.firma_adi,
      recete_turu: d.recete_turu,
      durum: d.durum,
      rxcui: d.rxcui || null,
    }));

  res.json(results);
});

// Get interaction check between a drug and user's active medications
router.get('/interactions', async (req, res) => {
  const { rxcui } = req.query;
  if (!rxcui) return res.json([]);

  // Get all user's medications that have rxcui
  const userMeds = db.data.medications.filter(m => m.profileId === req.user.id);
  const drugRefs = db.data.drugReferences.filter(d => d.rxcui && userMeds.some(um => um.drugRefId === d.barkod));

  const interactions = [];
  for (const ref of drugRefs) {
    if (ref.rxcui === rxcui) continue; // Skip self
    try {
      const resp = await fetch(`${RXNAV_BASE}/interaction/list.json?rxcuis=${rxcui}+${ref.rxcui}`);
      const data = await resp.json();
      if (data?.fullInteractionTypeGroup) {
        for (const group of data.fullInteractionTypeGroup) {
          for (const type of group.fullInteractionType || []) {
            for (const interaction of type.interactionPair || []) {
              interactions.push({
                ilac1: interaction.interactionConcept?.[0]?.minConceptItem?.name || 'Bilinmeyen',
                ilac2: interaction.interactionConcept?.[1]?.minConceptItem?.name || 'Bilinmeyen',
                aciklama: interaction.description || 'Etkileşim bulundu',
                seviye: interaction.severity || 'Belirtilmemiş',
              });
            }
          }
        }
      }
    } catch {}
  }

  res.json(interactions);
});

// Get drug by barcode
router.get('/barcode/:barcode', (req, res) => {
  const drug = db.data.drugReferences.find(d => d.barkod === req.params.barcode);
  if (!drug) return res.status(404).json({ error: 'Bulunamadı' });
  res.json(drug);
});

export default router;
