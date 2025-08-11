import { Router } from 'express';
import { prisma } from '@real-estate-bot/database';
import { optionalAuth } from '../middleware/auth';

const router = Router();

function getOfferUrl(type: string): string | null {
  const map: Record<string, string | undefined> = {
    mortgage: process.env.MORTGAGE_OFFER_URL,
    insurance: process.env.INSURANCE_OFFER_URL,
    legal: process.env.LEGAL_CHECK_OFFER_URL,
    rent: process.env.RENT_PARTNER_OFFER_URL,
  };
  return map[type] || null;
}

router.get('/redirect', optionalAuth, async (req, res) => {
  try {
    const type = (req.query.type as string) || '';
    const listingId = (req.query.listingId as string) || '';
    const tgUid = req.query.uid as string | undefined;

    const target = getOfferUrl(type);
    if (!type || !target) return res.status(400).send('Invalid offer type');

    let userId = req.userId;
    if (!userId && tgUid) {
      const u = await prisma.user.findUnique({ where: { tgId: BigInt(tgUid) } });
      if (u) userId = u.id;
    }

    // Build redirect with UTM
    const url = new URL(target);
    url.searchParams.set('utm_source', 'real_estate_bot');
    url.searchParams.set('utm_medium', req.query.medium as string || 'bot');
    url.searchParams.set('utm_campaign', `offer_${type}`);
    if (listingId) url.searchParams.set('listing_id', listingId);

    // Log click
    await prisma.click.create({
      data: {
        userId: userId || 'anonymous',
        listingId: listingId || 'offer',
        url: url.toString(),
        source: (req.query.source as string) || 'bot',
      }
    });

    return res.redirect(url.toString());
  } catch (e) {
    console.error('Offer redirect error', e);
    return res.status(500).send('Internal error');
  }
});

export default router;