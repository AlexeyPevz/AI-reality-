import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramInitData {
  user: TelegramUser;
  auth_date: string;
  query_id?: string;
  [key: string]: any;
}

// Verifies Telegram WebApp init data and returns parsed object with `user`
export function verifyTelegramWebAppData(initDataRaw: string): TelegramInitData | null {
  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return null;

    // Build data-check-string
    const entries: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') entries.push(`${key}=${value}`);
    });
    entries.sort();
    const dataCheckString = entries.join('\n');

    const botToken = process.env.BOT_TOKEN || '';
    if (!botToken) return null;

    // Secret key = HMAC-SHA256 of bot token with key "WebAppData"
    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    const userParam = params.get('user');
    if (!userParam) return null;

    const user = JSON.parse(userParam);

    return {
      user,
      auth_date: params.get('auth_date') || '',
      query_id: params.get('query_id') || undefined,
    } as TelegramInitData;
  } catch {
    return null;
  }
}