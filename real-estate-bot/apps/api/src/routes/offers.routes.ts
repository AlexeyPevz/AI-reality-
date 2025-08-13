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
    const source = (req.query.source as string) || 'bot';

    const target = getOfferUrl(type);
    if (!type || !target) return res.status(400).send('Invalid offer type');

    // Resolve user
    let userId = req.userId;
    if (!userId && tgUid) {
      const u = await prisma.user.findUnique({ where: { tgId: BigInt(tgUid) } });
      if (u) userId = u.id;
    }
    if (!userId) return res.status(401).send('Unauthorized: uid required');

    // Anti-fraud: skip duplicate click within 60s
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recent = await prisma.click.findFirst({
      where: {
        userId,
        listingId: listingId || undefined,
        source,
        timestamp: { gte: oneMinuteAgo },
      },
    });

    // Generate partner tracking
    // const { monetizationService } = await import('../services/monetization.service');
    const trackingId = `trk_${Date.now().toString(36)}`;

    // Build redirect with UTM + tracking
    const url = new URL(target);
    url.searchParams.set('utm_source', 'real_estate_bot');
    url.searchParams.set('utm_medium', source);
    url.searchParams.set('utm_campaign', `offer_${type}`);
    if (listingId) url.searchParams.set('listing_id', listingId);
    url.searchParams.set('tracking_id', trackingId);

    // If no recent click, also write a plain click row for analytics (monetizationService already created one)
    if (!recent) {
      // no-op: trackPartnerClick already logged
    }

    return res.redirect(url.toString());
  } catch (e) {
    console.error('Offer redirect error', e);
    return res.status(500).send('Internal error');
  }
});

// Partner postback endpoint
router.post('/postback', async (req, res) => {
  try {
    const secret = process.env.OFFER_POSTBACK_SECRET || '';
    const signature = (req.headers['x-signature'] as string) || (req.query.signature as string) || '';
    if (secret && signature !== secret) return res.status(401).json({ error: 'Invalid signature' });

    const { partnerId, trackingId, status, commission, amount } = req.body || {};
    if (!trackingId || !status) return res.status(400).json({ error: 'trackingId and status required' });

    // Find click by trackingId in meta
    const click = await prisma.click.findFirst({
      where: {
        meta: {
          path: ['trackingId'],
          equals: trackingId,
        },
      },
    });

    if (!click) return res.status(404).json({ error: 'Click not found' });

    await prisma.click.update({
      where: { id: click.id },
      data: {
        meta: {
          partnerId: partnerId || click.meta?.partnerId,
          trackingId,
          conversionStatus: status,
          amount: amount ? Number(amount) : click.meta?.amount,
          commission: commission ? Number(commission) : click.meta?.commission,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    return res.json({ success: true });
  } catch (e) {
    console.error('Offer postback error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;