import { AllInOneProvider, AllInOneConfig } from './all-in-one-base';
import { Listing, QueryDTO } from '@real-estate-bot/shared';

interface YandexRealtyListing {
  offerId: string;
  type: 'sell' | 'rent';
  category: 'apartment' | 'house' | 'room' | 'lot' | 'commercial';
  location: {
    address: string;
    geocoderAddress: string;
    district: string;
    metro?: {
      name: string;
      timeToMetro: number;
      transportType: 'walk' | 'transport';
    };
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  price: {
    value: number;
    currency: 'RUB' | 'USD' | 'EUR';
    period?: 'month' | 'day';
  };
  area: {
    value: number;
    unit: 'sq. m';
  };
  rooms?: number;
  floor?: number;
  floorsTotal?: number;
  images: string[];
  description: string;
  url: string;
  partnerId?: string;
}

export class YandexRealtyProvider extends AllInOneProvider {
  constructor(config: AllInOneConfig & { name?: string; baseURL?: string; supportsFilters?: string[] }) {
    super({
      ...config,
      name: config.name || 'yandex_realty',
      baseURL: config.baseURL || 'https://realty-partners.yandex.ru/api/v1',
      supportsFilters: config.supportsFilters || ['price', 'rooms', 'area', 'location', 'propertyType'],
      commissionRate: config.commissionRate ?? 0.005,
      leadWebhookUrl: config.leadWebhookUrl || 'https://realty-partners.yandex.ru/api/v1/leads',
      leadPricing: config.leadPricing,
      leadRequirements: config.leadRequirements
    });
  }

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    try {
      const params = this.buildSearchParams(query);
      const response = await this.makeRequest('/offers/search', {
        method: 'POST',
        data: params
      });

      return response.data.offers.map((item: YandexRealtyListing) =>
        this.transformToListing(item)
      );
    } catch (error) {
      console.error('Yandex Realty search error:', error);
      return [];
    }
  }

  async getListing(id: string): Promise<Listing | null> {
    try {
      const response = await this.makeRequest(`/offers/${id}`);
      return this.transformToListing(response.data);
    } catch (error) {
      console.error('Yandex Realty get listing error:', error);
      return null;
    }
  }

  private buildSearchParams(query: QueryDTO): any {
    const filters = query.filters || ({} as any);
    const params: any = {
      type: query.dealType === 'rent' ? 'rent' : 'sell',
      category: ['apartment', 'house'],
      rgid: 587795, // Москва по умолчанию
      page: 1,
      pageSize: 20
    };

    // Цена
    if (query.budget?.min) params.priceMin = query.budget.min;
    if (query.budget?.max) params.priceMax = query.budget.max;

    // Комнаты
    if (filters.rooms && filters.rooms.length > 0) {
      params.roomsTotal = filters.rooms;
    }

    // Площадь
    if (filters.areaMin) params.areaMin = filters.areaMin;
    if (filters.areaMax) params.areaMax = filters.areaMax;

    // Локация (районы)
    if (query.geo?.districts && query.geo.districts.length > 0) {
      params.district = query.geo.districts;
    }

    // Тип недвижимости
    if (filters.propertyType === 'new') {
      params.newFlat = true;
    }

    return params;
  }

  private transformToListing(item: YandexRealtyListing): Listing {
    const listing: Listing = {
      id: `yandex_${item.offerId}`,
      title: this.generateTitle(item),
      price: item.price.value,
      address: item.location.address,
      lat: item.location.coordinates.latitude,
      lng: item.location.coordinates.longitude,
      rooms: item.rooms || 0,
      area: item.area.value,
      floor: item.floor || 0,
      totalFloors: item.floorsTotal || 0,
      description: item.description,
      photos: item.images.slice(0, 5),
      provider: 'yandex_realty',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.enrichListing(listing);
  }

  private generateTitle(item: YandexRealtyListing): string {
    const type = item.category === 'apartment' ? 'Квартира' : 'Дом';
    const rooms = item.rooms ? `${item.rooms}-комн. ` : '';
    return `${rooms}${type}, ${item.area.value} м²`;
  }
}