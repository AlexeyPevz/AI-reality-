import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@real-estate-bot/database';
import { ProviderFactory } from '@real-estate-bot/providers';
import { verifyTelegramWebAppData } from '@/lib/telegram';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify Telegram init data
    const initData = req.headers['x-init-data'] as string;
    if (!initData) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userData = verifyTelegramWebAppData(initData);
    if (!userData) {
      return res.status(401).json({ error: 'Invalid init data' });
    }

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid listing ID' });
    }

    // Try to get listing from database first
    const savedListing = await prisma.listing.findUnique({
      where: { id }
    });

    if (savedListing) {
      // Get user's recommendation for this listing
      const user = await prisma.user.findUnique({
        where: { tgId: BigInt(userData.user.id) }
      });

      if (user) {
        const recommendation = await prisma.recommendation.findFirst({
          where: {
            userId: user.id,
            listingId: id
          }
        });

        return res.status(200).json({
          ...savedListing,
          matchScore: recommendation?.score,
          matchExplanation: recommendation?.explanation,
          images: savedListing.images || [
            'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop'
          ],
          features: savedListing.features || []
        });
      }
    }

    // If not in database, try to fetch from provider
    const provider = ProviderFactory.getDefault();
    const listing = await provider.getListing(id);

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Track view
    const user = await prisma.user.findUnique({
      where: { tgId: BigInt(userData.user.id) }
    });

    if (user && listing.partnerLink) {
      await prisma.click.create({
        data: {
          userId: user.id,
          listingId: id,
          url: listing.partnerLink,
          source: 'mini_app'
        }
      });
    }

    res.status(200).json(listing);
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}