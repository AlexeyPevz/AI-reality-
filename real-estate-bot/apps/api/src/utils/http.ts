import axios, { AxiosRequestConfig } from 'axios';

let tokens = 0;
let lastRefill = Date.now();
const rpm = parseInt(process.env.ENRICHMENT_RPM || '60');

function takeToken(): boolean {
  const now = Date.now();
  const minutes = (now - lastRefill) / 60000;
  const refill = Math.floor(minutes * rpm);
  if (refill > 0) {
    tokens = Math.min(rpm, tokens + refill);
    lastRefill = now;
  }
  if (tokens > 0) {
    tokens -= 1;
    return true;
  }
  if (tokens === 0 && (now - lastRefill) > 60000) {
    tokens = rpm - 1;
    lastRefill = now;
    return true;
  }
  return false;
}

async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  let attempts = 0;
  while (!takeToken()) {
    attempts++;
    await new Promise(r => setTimeout(r, Math.min(500 * attempts, 2000)));
  }
  return fn();
}

export async function getWithRetry<T = any>(url: string, config?: AxiosRequestConfig, retries = 3): Promise<T> {
  let attempt = 0;
  let lastError: any = null;
  while (attempt <= retries) {
    try {
      return await withRateLimit(async () => {
        const r = await axios.get<T>(url, config);
        return r.data as T;
      });
    } catch (e: any) {
      lastError = e;
      const status = e?.response?.status;
      if (status && status < 500 && status !== 429) break;
      await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 8000)));
      attempt++;
    }
  }
  throw lastError;
}

export async function postWithRetry<T = any>(url: string, data?: any, config?: AxiosRequestConfig, retries = 3): Promise<T> {
  let attempt = 0;
  let lastError: any = null;
  while (attempt <= retries) {
    try {
      return await withRateLimit(async () => {
        const r = await axios.post<T>(url, data, config);
        return r.data as T;
      });
    } catch (e: any) {
      lastError = e;
      const status = e?.response?.status;
      if (status && status < 500 && status !== 429) break;
      await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 8000)));
      attempt++;
    }
  }
  throw lastError;
}