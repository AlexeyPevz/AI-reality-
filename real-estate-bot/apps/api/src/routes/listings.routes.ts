import { Router } from 'express';
import { prisma } from '@real-estate-bot/database';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Get listing by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    // Map DB listing to shared Listing type shape
    const mapped = {
      id: listing.id,
      title: listing.title,
      address: listing.address,
      lat: (listing.coordinates as any)?.lat || 0,
      lng: (listing.coordinates as any)?.lng || 0,
      price: listing.price,
      rooms: listing.rooms,
      area: listing.area,
      floor: listing.floor || 0,
      totalFloors: listing.floors || 0,
      stage: undefined as any,
      photos: listing.images || [],
      provider: listing.provider,
      description: listing.description || undefined,
    };

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;