import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const initData = req.headers['x-init-data'] as string || '';
    const r = await axios.get(`${API_URL}/api/analytics/metrics`, { timeout: 10000, headers: { 'X-Telegram-Init-Data': initData } });
    res.status(200).json(r.data);
  } catch (error) {
    console.error('Metrics proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}