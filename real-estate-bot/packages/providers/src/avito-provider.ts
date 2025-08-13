import { ListingsProvider, QueryDTO, Listing } from '@real-estate-bot/shared';
import { BaseListingsProvider } from './base';

interface AvitoConfig {
  baseURL: string;
  apiKey: string;
}

export class AvitoProvider extends BaseListingsProvider {
  constructor(private cfg: AvitoConfig) {
    super('avito', cfg.baseURL, ['rooms', 'price', 'area', 'newBuilding', 'parking', 'propertyType', 'dealType']);
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
      new_building: query.filters.newBuilding,
      parking: query.filters.parking,
      limit: 100,
    };

    const resp = await this.client.get('/search', { params });
    const items: any[] = resp.data?.items || [];

    return items.map((it) => this.normalizeItem(it));
  }

  async getListing(id: string): Promise<Listing | null> {
    try {
      const resp = await this.client.get(`/items/${id}`);
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
      lat: it.location?.lat || 0,
      lng: it.location?.lng || 0,
      price: this.normalizePrice(it.price),
      rooms: this.normalizeRooms(it.rooms),
      area: this.normalizeArea(it.area),
      floor: it.floor || 0,
      totalFloors: it.floors || 0,
      year: it.year || undefined,
      stage: undefined,
      photos: (it.images || []).map((i: any) => i.url).slice(0, 5),
      provider: 'avito',
      partnerDeeplinkTemplate: it.url,
      description: it.description || '',
      hasParking: it.parking || false,
      isNewBuilding: it.property_type === 'new',
      developer: undefined,
      dealType: it.deal_type || undefined,
      propertyType: it.property_type || undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { ensureListingShape } = require('@real-estate-bot/shared');
    return ensureListingShape(l, 'avito');
  }
}