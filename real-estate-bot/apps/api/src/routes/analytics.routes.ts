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
      res.status(400).json({ error: 'listingId is required' });
      return;
    }

    // Get or create session ID (kept for client, but not persisted in Click)
    const sessionId = req.headers['x-session-id'] as string || generateSessionId();

    // Create click record
    const click = await prisma.click.create({
      data: {
        userId: req.userId!,
        listingId,
        url: `/listing/${listingId}`,
        source: 'api',
      },
    });

    res.json({ 
      success: true,
      sessionId,
      clickId: click.id,
    });
    return;
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Metrics dashboard (basic)
router.get('/metrics', authenticateTelegram, async (req, res) => {
  try {
    const [users, listings, recs, clicks, subs] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.recommendation.count(),
      prisma.click.count(),
      prisma.subscription.count(),
    ]);

    const topListings = await prisma.recommendation.findMany({
      select: { listingId: true, score: true },
      orderBy: { score: 'desc' },
      take: 5
    });

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newUsers24h = await prisma.user.count({ where: { createdAt: { gte: last24h } } });

    if (!(req as any).isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json({
      totals: { users, listings, recommendations: recs, clicks, subscriptions: subs },
      newUsers24h,
      topRecommendations: topListings,
    });
    return;
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;