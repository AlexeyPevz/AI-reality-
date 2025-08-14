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

function generateTrackingId(seed: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `trk_${timestamp}_${random}_${seed.substring(0, 6)}`;
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
    const trackingId = generateTrackingId(userId);

    // Build redirect with UTM + tracking
    const url = new URL(target);
    url.searchParams.set('utm_source', 'real_estate_bot');
    url.searchParams.set('utm_medium', source);
    url.searchParams.set('utm_campaign', `offer_${type}`);
    if (listingId) url.searchParams.set('listing_id', listingId);
    url.searchParams.set('tracking_id', trackingId);

    // If no recent click, write a plain click row for analytics
    if (!recent) {
      if (listingId) {
        await prisma.click.create({
          data: {
            userId,
            listingId,
            url: url.toString(),
            source,
          }
        });
      }
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

    // Accept payload from partner and acknowledge (schema does not persist conversions yet)
    // const { partnerId, trackingId, status, commission, amount } = req.body || {};

    return res.json({ success: true });
  } catch (e) {
    console.error('Offer postback error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;