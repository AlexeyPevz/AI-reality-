import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@real-estate-bot/database';
import { leadService } from '@/../../bot/src/services/lead.service';
import { leadDistribution } from '@/../../bot/src/services/lead-distribution.service';
import { verifyTelegramWebAppData } from '@/lib/telegram';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

    const { listingId } = req.body;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { tgId: userData.user.id.toString() }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate or update lead
    const lead = await leadService.createOrUpdateLead(user.id);

    // Track interest in specific listing
    if (listingId) {
      await prisma.click.create({
        data: {
          userId: user.id,
          listingId,
          url: `/listing/${listingId}`,
          source: 'mini_app_contact'
        }
      });
    }

    // Try to distribute lead to partners
    let distributionResult = null;
    if (lead.quality === 'hot' || lead.quality === 'warm') {
      // Distribute to regular buyers
      distributionResult = await leadDistribution.distributeLead(lead);
      
      // Also distribute to All-in-One providers
      const allInOneResult = await leadDistribution.distributeToAllInOneProviders(lead);
      
      if (allInOneResult.distributed) {
        distributionResult = {
          ...distributionResult,
          allInOne: allInOneResult
        };
      }
    }

    res.status(200).json({
      success: true,
      lead: {
        id: lead.id,
        quality: lead.quality,
        score: lead.score
      },
      distribution: distributionResult,
      message: distributionResult?.distributed 
        ? 'Ваша заявка отправлена партнерам. С вами свяжутся в ближайшее время.'
        : 'Спасибо за интерес! Мы сохранили вашу заявку.'
    });
  } catch (error) {
    console.error('Error generating lead:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}