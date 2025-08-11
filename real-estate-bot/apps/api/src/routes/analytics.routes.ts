import { Router } from 'express';
import { prisma } from '@real-estate-bot/database';
import { authenticateTelegram } from '../middleware/auth';
import { generateSessionId } from '@real-estate-bot/shared';

const router = Router();

// Track listing click
router.post('/click', authenticateTelegram, async (req, res) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      return res.status(400).json({ error: 'listingId is required' });
    }

    // Get or create session ID
    const sessionId = req.headers['x-session-id'] as string || generateSessionId();

    // Create click record
    const click = await prisma.click.create({
      data: {
        userId: req.userId!,
        listingId,
        sessionId,
        utmSource: req.query.utm_source as string,
        utmMedium: req.query.utm_medium as string,
        utmCampaign: req.query.utm_campaign as string,
      },
    });

    res.json({ 
      success: true,
      sessionId,
      clickId: click.id,
    });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;