import { AllInOneProvider, AllInOneConfig } from './all-in-one-base';
import { Listing, QueryDTO } from '@real-estate-bot/shared';

interface CianOffer {
  id: number;
  cianId: number;
  fullUrl: string;
  category: 'flatSale' | 'flatRent' | 'houseSale' | 'houseRent';
  roomsCount?: number;
  totalArea?: number;
  floorNumber?: number;
  building?: {
    floorsCount?: number;
    buildYear?: number;
    materialType?: string;
  };
  bargainTerms: {
    price: number;
    currency: 'rur' | 'usd' | 'eur';
    priceType?: 'all' | 'squareMeter';
    mortgageAllowed?: boolean;
  };
  geo: {
    userInput: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  photos?: Array<{
    fullUrl: string;
    thumbnailUrl: string;
  }>;
  description?: string;
}

export class CianPartnerProvider extends AllInOneProvider {
  constructor(config: AllInOneConfig & { name?: string; baseURL?: string; supportsFilters?: string[] }) {
    super({
      ...config,
      name: config.name || 'cian_partner',
      baseURL: config.baseURL || 'https://partners.cian.ru/api/v2',
      supportsFilters: config.supportsFilters || ['price', 'rooms', 'area', 'location', 'metro', 'propertyType'],
      commissionRate: config.commissionRate ?? 0.01,
      leadWebhookUrl: config.leadWebhookUrl || 'https://partners.cian.ru/api/v2/leads/submit',
      leadPricing: config.leadPricing,
      leadRequirements: config.leadRequirements
    });
  }

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    try {
      const params = this.buildSearchParams(query);
      const response = await this.makeRequest('/export/offers', {
        method: 'POST',
        data: params
      });

      const offers = response.data.offers || [];
      return offers.map((offer: CianOffer) => this.transformToListing(offer));
    } catch (error) {
      console.error('CIAN Partner search error:', error);
      return [];
    }
  }

  async getListing(id: string): Promise<Listing | null> {
    try {
      const cianId = id.replace('cian_', '');
      const response = await this.makeRequest(`/offer/${cianId}`);
      return this.transformToListing(response.data.offer);
    } catch (error) {
      console.error('CIAN Partner get listing error:', error);
      return null;
    }
  }

  private buildSearchParams(query: QueryDTO): any {
    const filters = query.filters || ({} as any);
    const params: any = {
      deal_type: query.dealType === 'rent' ? 'rent' : 'sale',
      offer_type: ['flat'],
      region: 1, // Москва по умолчанию
      page: 1,
      limit: 30,
      sort: 'price_asc'
    };

    // Цена
    if (query.budget?.min) params.price_min = query.budget.min;
    if (query.budget?.max) params.price_max = query.budget.max;

    // Комнаты
    if (filters.rooms && filters.rooms.length > 0) {
      params.room = filters.rooms.map((r: number) => (r === 4 ? '4+' : r.toString()));
    }

    // Площадь
    if (filters.areaMin) params.total_area_min = filters.areaMin;
    if (filters.areaMax) params.total_area_max = filters.areaMax;

    return params;
  }

  private transformToListing(offer: CianOffer): Listing {
    const listing: Listing = {
      id: `cian_${offer.cianId}`,
      title: this.generateTitle(offer),
      price: offer.bargainTerms.price,
      address: offer.geo.userInput,
      lat: offer.geo.coordinates?.lat || 0,
      lng: offer.geo.coordinates?.lng || 0,
      rooms: offer.roomsCount || 0,
      area: offer.totalArea || 0,
      floor: offer.floorNumber || 0,
      totalFloors: offer.building?.floorsCount || 0,
      description: offer.description || '',
      photos: offer.photos?.slice(0, 5).map(p => p.fullUrl) || [],
      provider: 'cian_partner',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.enrichListing(listing);
  }

  private generateTitle(offer: CianOffer): string {
    const type = offer.category.includes('flat') ? 'Квартира' : 'Дом';
    const rooms = offer.roomsCount ? `${offer.roomsCount}-комн. ` : '';
    const area = offer.totalArea ? `, ${offer.totalArea} м²` : '';
    return `${rooms}${type}${area}`;
  }
}