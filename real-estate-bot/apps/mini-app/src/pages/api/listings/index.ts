import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@real-estate-bot/database';
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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { tgId: BigInt(userData.user.id) },
      include: {
        recommendations: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            listing: true
          }
        },
        preferences: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform recommendations to listings with match scores
    const listings = (user.recommendations as any[]).map((rec: any) => ({
      ...rec.listing,
      matchScore: rec.score,
      matchExplanation: rec.explanation,
      // Mock listing data if needed (temporary)
      images: rec.listing.images || [
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?w=800&h=600&fit=crop'
      ],
      features: rec.listing.features || [
        'Евроремонт',
        'Закрытая территория',
        'Детская площадка'
      ]
    }));

    res.status(200).json({ 
      listings,
      total: listings.length,
      user: {
        id: user.id,
        name: user.firstName,
        preferences: (user as any).preferences?.[0]
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}