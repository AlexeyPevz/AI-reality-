import { ListingsProvider } from '@real-estate-bot/shared';
import { MockListingsProvider } from './mock';

export * from './base';
export * from './mock';

// Provider factory
export class ProviderFactory {
  private static providers: Map<string, ListingsProvider> = new Map();

  static {
    // Register default providers
    this.register(new MockListingsProvider());
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
    // Return mock provider for now
    return this.providers.get('mock')!;
  }
}