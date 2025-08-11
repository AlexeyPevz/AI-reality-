import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma, bigIntToNumber } from '@real-estate-bot/database';
import { config } from '../config';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      telegramId?: number;
    }
  }
}

export async function authenticateTelegram(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const initData = req.headers['x-telegram-init-data'] as string;
    
    if (!initData) {
      return res.status(401).json({ error: 'Missing Telegram init data' });
    }

    // Parse init data
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Sort parameters
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Verify hash
    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    if (hash !== calculatedHash) {
      return res.status(401).json({ error: 'Invalid init data' });
    }

    // Parse user data
    const userParam = params.get('user');
    if (!userParam) {
      return res.status(401).json({ error: 'User data not found' });
    }

    const userData = JSON.parse(userParam);
    const telegramId = userData.id;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { tgId: BigInt(telegramId) },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          tgId: BigInt(telegramId),
        },
      });
         }
 
     // Admin check (optional)
     const adminIds = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
 
     // Set user data in request
     req.userId = user.id;
     req.telegramId = bigIntToNumber(user.tgId)!;
     (req as any).isAdmin = adminIds.includes(String(telegramId));
 
     next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Optional auth middleware (for public endpoints)
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const initData = req.headers['x-telegram-init-data'] as string;
  
  if (initData) {
    return authenticateTelegram(req, res, next);
  }
  
  next();
}