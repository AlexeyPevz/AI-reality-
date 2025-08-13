import { Listing, QueryDTO } from '@real-estate-bot/shared';
import { BaseListingsProvider } from './base';

interface CianConfig {
  baseURL: string;
  apiKey: string;
}

export class CianSourceProvider extends BaseListingsProvider {
  constructor(private cfg: CianConfig) {
    super('cian_source', cfg.baseURL, ['rooms', 'price', 'area', 'propertyType', 'dealType']);
    this.client.defaults.headers['Authorization'] = `Bearer ${cfg.apiKey}`;
  }

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    const params: any = {
      city: query.geo.city,
      price_min: query.budget.min,
      price_max: query.budget.max,
      rooms: query.filters.rooms?.join(',') || undefined,
      area_min: query.filters.areaMin,
      area_max: query.filters.areaMax,
      property_type: query.filters.propertyType,
      deal_type: query.dealType,
      limit: 100,
    };
    const resp = await this.client.get('/listings/search', { params });
    const items: any[] = resp.data?.items || [];
    return items.map((it) => this.normalizeItem(it));
  }

  async getListing(id: string): Promise<Listing | null> {
    try {
      const resp = await this.client.get(`/listings/${id}`);
      const it = resp.data;
      if (!it) return null;
      return this.normalizeItem(it);
    } catch {
      return null;
    }
  }

  private normalizeItem(it: any): Listing {
    const l: Listing = {
      id: String(it.id),
      title: it.title || `${it.rooms || ''}-комн. ${it.area || ''} м²`,
      address: it.address || '',
      lat: it.geo?.lat || 0,
      lng: it.geo?.lng || 0,
      price: this.normalizePrice(it.price_rub ?? it.price),
      rooms: this.normalizeRooms(it.rooms),
      area: this.normalizeArea(it.area_total ?? it.area),
      floor: it.floor || 0,
      totalFloors: it.floors_total || 0,
      year: it.year || undefined,
      photos: (it.images || []).slice(0, 5),
      provider: 'cian_source',
      partnerDeeplinkTemplate: it.url,
      description: it.description || '',
      hasParking: Boolean(it.parking),
      isNewBuilding: it.property_type === 'new',
      dealType: it.deal_type || undefined,
      propertyType: it.property_type || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { ensureListingShape } = require('@real-estate-bot/shared');
    return ensureListingShape(l, 'cian_source');
  }
}