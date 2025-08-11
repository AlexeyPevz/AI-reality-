import { BaseListingsProvider } from './base';
import { Listing, QueryDTO } from '@real-estate-bot/shared';
import { createHash } from 'crypto';

export interface PartnerConfig {
  partnerId: string;
  apiKey?: string;
  secretKey?: string;
  baseUrl: string;
  commissionRate?: number; // Процент комиссии
  cookieLifetime?: number; // Время жизни cookie в днях
}

export interface PartnerLink {
  url: string;
  utmParams: Record<string, string>;
  trackingId: string;
}

export abstract class PartnerListingsProvider extends BaseListingsProvider {
  protected config: PartnerConfig;

  constructor(
    name: string,
    config: PartnerConfig,
    supportsFilters: string[]
  ) {
    super(name, config.baseUrl, supportsFilters);
    this.config = config;
  }

  // Генерация партнерской ссылки
  protected generatePartnerLink(listing: Listing, userId?: string): string {
    const trackingId = this.generateTrackingId(listing.id, userId);
    
    const baseUrl = listing.url || `${this.config.baseUrl}/property/${listing.id}`;
    const url = new URL(baseUrl);
    
    // Добавляем партнерские параметры
    url.searchParams.set('partner_id', this.config.partnerId);
    url.searchParams.set('tracking_id', trackingId);
    
    // UTM метки для отслеживания
    url.searchParams.set('utm_source', 'realestate_bot');
    url.searchParams.set('utm_medium', 'telegram');
    url.searchParams.set('utm_campaign', listing.type || 'general');
    url.searchParams.set('utm_content', listing.id);
    
    if (userId) {
      url.searchParams.set('utm_term', this.hashUserId(userId));
    }

    return url.toString();
  }

  // Генерация уникального ID для трекинга
  private generateTrackingId(listingId: string, userId?: string): string {
    const timestamp = Date.now();
    const data = `${this.config.partnerId}-${listingId}-${userId || 'anonymous'}-${timestamp}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  // Хеширование userId для приватности
  private hashUserId(userId: string): string {
    return createHash('sha256')
      .update(userId + this.config.secretKey)
      .digest('hex')
      .substring(0, 8);
  }

  // Обогащение листинга партнерскими данными
  protected enrichListingWithPartnerData(listing: Listing, userId?: string): Listing {
    return {
      ...listing,
      partnerLink: this.generatePartnerLink(listing, userId),
      source: this.name,
      partnerId: this.config.partnerId,
      // Потенциальная комиссия
      potentialCommission: this.config.commissionRate 
        ? listing.price * (this.config.commissionRate / 100)
        : undefined
    };
  }

  // Трекинг клика по объявлению
  async trackClick(listingId: string, userId: string): Promise<void> {
    // Здесь можно отправить событие в партнерскую систему
    try {
      await this.client.post('/tracking/click', {
        partner_id: this.config.partnerId,
        listing_id: listingId,
        user_hash: this.hashUserId(userId),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }

  // Проверка статуса конверсии
  async checkConversionStatus(trackingId: string): Promise<{
    status: 'pending' | 'approved' | 'rejected';
    amount?: number;
    date?: Date;
  }> {
    try {
      const response = await this.client.get(`/tracking/conversion/${trackingId}`);
      return response.data;
    } catch (error) {
      return { status: 'pending' };
    }
  }
}