import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const url = new URL(`${API_URL}/api/offers/redirect`);
    Object.entries(req.query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const uid = req.query.uid || '';
    const redirect = `${url.toString()}${uid ? '' : `&uid=${encodeURIComponent(String(req.query.uid || ''))}`}`;
    res.redirect(redirect);
  } catch (e) {
    console.error('Offers proxy error', e);
    res.status(500).json({ error: 'Internal error' });
  }
}