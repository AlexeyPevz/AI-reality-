import { ListingsProvider, QueryDTO, Listing } from '@real-estate-bot/shared';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export abstract class BaseListingsProvider implements ListingsProvider {
  protected client: AxiosInstance;
  
  constructor(
    public name: string,
    baseURL: string,
    public supportsFilters: string[],
    public linkTemplate?: string
  ) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'RealEstateBot/1.0',
      },
    });
  }

  abstract searchListings(query: QueryDTO): Promise<Listing[]>;
  abstract getListing(id: string): Promise<Listing | null>;

  protected generatePartnerLink(listing: Listing): string | undefined {
    if (!this.linkTemplate) return undefined;
    
    return this.linkTemplate
      .replace('{id}', listing.id)
      .replace('{provider}', this.name);
  }

  protected async makeRequest<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
    return this.client.request<T>({ url, ...config });
  }

  protected normalizePrice(price: any): number {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      return parseFloat(price.replace(/[^\d.]/g, ''));
    }
    return 0;
  }

  protected normalizeArea(area: any): number {
    if (typeof area === 'number') return area;
    if (typeof area === 'string') {
      return parseFloat(area.replace(/[^\d.]/g, ''));
    }
    return 0;
  }

  protected normalizeRooms(rooms: any): number {
    if (typeof rooms === 'number') return rooms;
    if (typeof rooms === 'string') {
      const match = rooms.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    }
    return 0;
  }
}