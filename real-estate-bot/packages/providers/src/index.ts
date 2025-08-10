import { ListingsProvider } from '@real-estate-bot/shared';
import { MockListingsProvider } from './mock';
import { PIKProvider } from './pik-provider';
import { DomClickProvider } from './domclick-provider';

export * from './base';
export * from './partner-base';
export * from './mock';
export * from './pik-provider';
export * from './domclick-provider';

// Provider factory
export class ProviderFactory {
  private static providers: Map<string, ListingsProvider> = new Map();

  static {
    // Register default providers
    this.register(new MockListingsProvider());
    
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
    // Return first partner provider if available, otherwise mock
    const partnerProviders = this.getPartnerProviders();
    return partnerProviders.length > 0 ? partnerProviders[0] : this.providers.get('mock')!;
  }
  
  static getPartnerProviders(): ListingsProvider[] {
    return this.getAll().filter(p => 
      p.name !== 'mock' && 'trackClick' in p
    );
  }
}