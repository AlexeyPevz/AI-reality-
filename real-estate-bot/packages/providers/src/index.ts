import { ListingsProvider } from '@real-estate-bot/shared';
import { MockListingsProvider } from './mock';
import { AggregatingProvider } from './aggregator';
import { AvitoProvider } from './avito-provider';
import { CianSourceProvider } from './cian-source-provider';
import { YandexSourceProvider } from './yandex-source-provider';
import { DomClickSourceProvider } from './domclick-source-provider';

export * from './base';
export * from './mock';
export * from './avito-provider';
export * from './cian-source-provider';
export * from './yandex-source-provider';
export * from './domclick-source-provider';

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
}