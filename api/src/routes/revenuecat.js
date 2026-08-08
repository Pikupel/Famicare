import { Router } from 'express';
import { processRevenueCatWebhook, verifyRevenueCatWebhook } from '../services/revenuecat.js';

const router = Router();

router.post('/', async (req, res) => {
  if (!verifyRevenueCatWebhook(req)) return res.status(401).json({ error: 'Webhook doğrulaması başarısız' });
  try {
    const result = await processRevenueCatWebhook(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[REVENUECAT] Webhook işlenemedi:', error.message);
    res.status(503).json({ error: 'Webhook işlenemedi' });
  }
});

export default router;
