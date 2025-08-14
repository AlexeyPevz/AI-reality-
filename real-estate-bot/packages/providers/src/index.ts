import { ListingsProvider } from '@real-estate-bot/shared';
import { MockListingsProvider } from './mock';
import { AggregatingProvider } from './aggregator';

export * from './base';
export * from './mock';
export * from './partner-base';
export * from './all-in-one-base';

// Provider factory
export class ProviderFactory {
  private static providers: Map<string, ListingsProvider> = new Map();

  static {
    // Register default providers
    this.register(new MockListingsProvider());

    // Avito
    if (process.env.AVITO_BASE_URL && process.env.AVITO_API_KEY) {
      const { AvitoProvider } = require('./avito-provider');
      this.register(new AvitoProvider({ baseURL: process.env.AVITO_BASE_URL, apiKey: process.env.AVITO_API_KEY }));
    }

    // CIAN Source
    if (process.env.CIAN_SOURCE_BASE_URL && process.env.CIAN_SOURCE_API_KEY) {
      const { CianSourceProvider } = require('./cian-source-provider');
      this.register(new CianSourceProvider({ baseURL: process.env.CIAN_SOURCE_BASE_URL, apiKey: process.env.CIAN_SOURCE_API_KEY }));
    }

    // Yandex Source
    if (process.env.YANDEX_SOURCE_BASE_URL && process.env.YANDEX_SOURCE_API_KEY) {
      const { YandexSourceProvider } = require('./yandex-source-provider');
      this.register(new YandexSourceProvider({ baseURL: process.env.YANDEX_SOURCE_BASE_URL, apiKey: process.env.YANDEX_SOURCE_API_KEY }));
    }

    // DomClick Source
    if (process.env.DOMCLICK_SOURCE_BASE_URL && process.env.DOMCLICK_SOURCE_API_KEY) {
      const { DomClickSourceProvider } = require('./domclick-source-provider');
      this.register(new DomClickSourceProvider({ baseURL: process.env.DOMCLICK_SOURCE_BASE_URL, apiKey: process.env.DOMCLICK_SOURCE_API_KEY }));
    }

    // Register partner providers if configured
    if (process.env.PIK_PARTNER_ID && process.env.PIK_API_KEY) {
      const { PIKProvider } = require('./pik-provider');
      this.register(new PIKProvider({
        partnerId: process.env.PIK_PARTNER_ID,
        apiKey: process.env.PIK_API_KEY,
        secretKey: process.env.PIK_SECRET_KEY || '',
        baseUrl: 'https://api.pik.ru/v2',
        commissionRate: 3
      }));
    }

    if (process.env.DOMCLICK_PARTNER_ID && process.env.DOMCLICK_API_KEY) {
      const { DomClickProvider } = require('./domclick-provider');
      this.register(new DomClickProvider({
        partnerId: process.env.DOMCLICK_PARTNER_ID,
        apiKey: process.env.DOMCLICK_API_KEY,
        secretKey: process.env.DOMCLICK_SECRET_KEY || '',
        baseUrl: 'https://api.domclick.ru/v1',
        commissionRate: 0.5
      }));
    }

    // Register All-in-One providers (база объектов + лиды)
    if (process.env.YANDEX_REALTY_PARTNER_ID && process.env.YANDEX_REALTY_API_KEY) {
      const { YandexRealtyProvider } = require('./yandex-realty-provider');
      this.register(new YandexRealtyProvider({
        partnerId: process.env.YANDEX_REALTY_PARTNER_ID,
        apiKey: process.env.YANDEX_REALTY_API_KEY,
        secretKey: process.env.YANDEX_REALTY_SECRET_KEY || '',
        baseUrl: 'https://realty-partners.yandex.ru/api/v1',
        name: 'yandex_realty',
        supportsFilters: ['price', 'rooms', 'area', 'location', 'propertyType'],
        commissionRate: 0.005,
        leadWebhookUrl: 'https://realty-partners.yandex.ru/api/v1/leads',
        leadPricing: {
          base: Number(process.env.YANDEX_LEAD_PRICE_BASE) || 1500,
          qualified: Number(process.env.YANDEX_LEAD_PRICE_QUALIFIED) || 3000,
          exclusive: Number(process.env.YANDEX_LEAD_PRICE_EXCLUSIVE) || 5000
        },
        leadRequirements: {
          minBudget: 3000000,
          regions: ['Москва', 'Санкт-Петербург', 'МО', 'ЛО'],
          propertyTypes: ['new', 'secondary']
        }
      }));
    }

    if (process.env.CIAN_PARTNER_ID && process.env.CIAN_PARTNER_API_KEY) {
      const { CianPartnerProvider } = require('./cian-partner-provider');
      this.register(new CianPartnerProvider({
        partnerId: process.env.CIAN_PARTNER_ID,
        apiKey: process.env.CIAN_PARTNER_API_KEY,
        secretKey: process.env.CIAN_PARTNER_SECRET_KEY || '',
        baseUrl: 'https://partners.cian.ru/api/v2',
        name: 'cian_partner',
        supportsFilters: ['price', 'rooms', 'area', 'location', 'metro', 'propertyType'],
        commissionRate: 0.01,
        leadWebhookUrl: process.env.CIAN_LEAD_WEBHOOK || 'https://partners.cian.ru/api/v2/leads/submit',
        leadPricing: {
          base: Number(process.env.CIAN_LEAD_PRICE_BASE) || 2000,
          qualified: Number(process.env.CIAN_LEAD_PRICE_QUALIFIED) || 4000,
          exclusive: Number(process.env.CIAN_LEAD_PRICE_EXCLUSIVE) || 7000
        },
        leadRequirements: {
          minBudget: 2500000,
          regions: ['Москва', 'Санкт-Петербург', 'МО', 'Екатеринбург', 'Новосибирск'],
          propertyTypes: ['new', 'secondary']
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
}