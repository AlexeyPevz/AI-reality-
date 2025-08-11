import { ListingsProvider } from '@real-estate-bot/shared';
import { MockListingsProvider } from './mock';
import { PIKProvider } from './pik-provider';
import { DomClickProvider } from './domclick-provider';
import { YandexRealtyProvider } from './yandex-realty-provider';
import { CianPartnerProvider } from './cian-partner-provider';
import { AllInOneProvider } from './all-in-one-base';
import { AggregatingProvider } from './aggregator';
import { AvitoProvider } from './avito-provider';

export * from './base';
export * from './partner-base';
export * from './all-in-one-base';
export * from './mock';
export * from './pik-provider';
export * from './domclick-provider';
export * from './yandex-realty-provider';
export * from './cian-partner-provider';
export * from './avito-provider';

// Provider factory
export class ProviderFactory {
  private static providers: Map<string, ListingsProvider> = new Map();

  static {
    // Register default providers
    this.register(new MockListingsProvider());

    // Avito (via proxy)
    if (process.env.AVITO_BASE_URL && process.env.AVITO_API_KEY) {
      const { AvitoProvider } = require('./avito-provider');
      this.register(new AvitoProvider({
        baseURL: process.env.AVITO_BASE_URL,
        apiKey: process.env.AVITO_API_KEY,
      }));
    }

    // Register partner providers if configured
    if (process.env.PIK_PARTNER_ID && process.env.PIK_API_KEY) {
      this.register(new PIKProvider({
        partnerId: process.env.PIK_PARTNER_ID,
        apiKey: process.env.PIK_API_KEY,
        secretKey: process.env.PIK_SECRET_KEY
      }));
    }

    if (process.env.DOMCLICK_PARTNER_ID && process.env.DOMCLICK_API_KEY) {
      this.register(new DomClickProvider({
        partnerId: process.env.DOMCLICK_PARTNER_ID,
        apiKey: process.env.DOMCLICK_API_KEY,
        secretKey: process.env.DOMCLICK_SECRET_KEY
      }));
    }

    // Register All-in-One providers (база объектов + лиды)
    if (process.env.YANDEX_REALTY_PARTNER_ID && process.env.YANDEX_REALTY_API_KEY) {
      this.register(new YandexRealtyProvider({
        partnerId: process.env.YANDEX_REALTY_PARTNER_ID,
        apiKey: process.env.YANDEX_REALTY_API_KEY,
        secretKey: process.env.YANDEX_REALTY_SECRET_KEY || '',
        leadWebhookUrl: process.env.YANDEX_REALTY_LEAD_WEBHOOK || 'https://realty-partners.yandex.ru/api/v1/leads',
        leadPricing: {
          base: Number(process.env.YANDEX_LEAD_PRICE_BASE) || 1500,
          qualified: Number(process.env.YANDEX_LEAD_PRICE_QUALIFIED) || 3000,
          exclusive: Number(process.env.YANDEX_LEAD_PRICE_EXCLUSIVE) || 5000
        }
      }));
    }

    if (process.env.CIAN_PARTNER_ID && process.env.CIAN_PARTNER_API_KEY) {
      this.register(new CianPartnerProvider({
        partnerId: process.env.CIAN_PARTNER_ID,
        apiKey: process.env.CIAN_PARTNER_API_KEY,
        secretKey: process.env.CIAN_PARTNER_SECRET_KEY || '',
        leadWebhookUrl: process.env.CIAN_LEAD_WEBHOOK || 'https://partners.cian.ru/api/v2/leads/submit',
        leadPricing: {
          base: Number(process.env.CIAN_LEAD_PRICE_BASE) || 2000,
          qualified: Number(process.env.CIAN_LEAD_PRICE_QUALIFIED) || 4000,
          exclusive: Number(process.env.CIAN_LEAD_PRICE_EXCLUSIVE) || 7000
        }
      }));
    }
  }

  static register(provider: ListingsProvider): void {
    this.providers.set(provider.name, provider);
  }

  static get(name: string): ListingsProvider | undefined {
    return this.providers.get(name);
  }

  static getAll(): ListingsProvider[] {
    return Array.from(this.providers.values());
  }

  static getDefault(): ListingsProvider {
    // Aggregate all registered providers except mock when possible
    const providers = this.getAll().filter(p => p.name !== 'mock');
    if (providers.length > 0) {
      return new AggregatingProvider(providers);
    }
    return this.providers.get('mock')!;
  }

  static getPartnerProviders(): ListingsProvider[] {
    return this.getAll().filter(p =>
      p.name !== 'mock' && 'trackClick' in p
    );
  }

  static getAllInOneProviders(): AllInOneProvider[] {
    return this.getAll().filter(p =>
      p instanceof AllInOneProvider
    ) as AllInOneProvider[];
  }
}