import { Router } from 'express';
import { prisma } from '@real-estate-bot/database';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Get listing by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await prisma.listingCache.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Return normalized listing data
    res.json(listing.normalized);
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;