import { Router } from 'express';
import { authenticateTelegram } from '../middleware/auth';
import { searchByPreferences } from '../services/search.service';

const router = Router();

// Search listings based on preferences
router.post('/', authenticateTelegram, async (req, res) => {
  try {
    const { preferencesId } = req.body;

    if (!preferencesId) {
      res.status(400).json({ error: 'preferencesId is required' });
      return;
    }

    const results = await searchByPreferences(preferencesId);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;