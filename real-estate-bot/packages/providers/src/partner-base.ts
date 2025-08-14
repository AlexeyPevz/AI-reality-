import { BaseListingsProvider } from './base';
import { Listing } from '@real-estate-bot/shared';
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

  protected generatePartnerLink(listing: Listing, userId?: string): string {
    const trackingId = this.generateTrackingId(listing.id, userId);
    const baseUrl = (listing as any).url || `${this.config.baseUrl}/property/${listing.id}`;
    const url = new URL(baseUrl);
    url.searchParams.set('partner_id', this.config.partnerId);
    url.searchParams.set('tracking_id', trackingId);
    url.searchParams.set('utm_source', 'realestate_bot');
    url.searchParams.set('utm_medium', 'telegram');
    url.searchParams.set('utm_campaign', 'listing');
    url.searchParams.set('utm_content', listing.id);
    if (userId) url.searchParams.set('utm_term', this.hashUserId(userId));
    return url.toString();
  }

  private generateTrackingId(listingId: string, userId?: string): string {
    const timestamp = Date.now();
    const data = `${this.config.partnerId}-${listingId}-${userId || 'anonymous'}-${timestamp}`;
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  private hashUserId(userId: string): string {
    return createHash('sha256')
      .update(userId + (this.config.secretKey || ''))
      .digest('hex')
      .substring(0, 8);
  }

  protected enrichListingWithPartnerData(listing: Listing, userId?: string): Listing {
    const partnerLink = this.generatePartnerLink(listing, userId);
    return {
      ...listing,
      partnerDeeplinkTemplate: partnerLink,
      provider: this.name,
    };
  }
}