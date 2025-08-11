import { AllInOneProvider, AllInOneConfig } from './all-in-one-base';
import { Listing, QueryDTO, Lead } from '@real-estate-bot/shared';

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
  constructor(config: AllInOneConfig) {
    super({
      ...config,
      name: 'yandex_realty',
      baseURL: 'https://realty-partners.yandex.ru/api/v1',
      supportsFilters: ['price', 'rooms', 'area', 'location', 'propertyType'],
      commissionRate: 0.005, // 0.5% от сделки через партнерскую ссылку
      leadWebhookUrl: 'https://realty-partners.yandex.ru/api/v1/leads',
      leadPricing: {
        base: 1500,      // Базовая цена за лид
        qualified: 3000,  // С подтвержденным телефоном
        exclusive: 5000   // Эксклюзивный горячий лид
      },
      leadRequirements: {
        minBudget: 3000000, // Минимум 3 млн
        regions: ['Москва', 'Санкт-Петербург', 'МО', 'ЛО'],
        propertyTypes: ['new', 'secondary']
      }
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
    const params: any = {
      type: 'sell',
      category: ['apartment', 'house'],
      rgid: 587795, // Москва по умолчанию
      page: 1,
      pageSize: 20
    };

    // Цена
    if (query.priceMin) params.priceMin = query.priceMin;
    if (query.priceMax) params.priceMax = query.priceMax;

    // Комнаты
    if (query.rooms && query.rooms.length > 0) {
      params.roomsTotal = query.rooms;
    }

    // Площадь
    if (query.areaMin) params.areaMin = query.areaMin;
    if (query.areaMax) params.areaMax = query.areaMax;

    // Локация (районы)
    if (query.districts && query.districts.length > 0) {
      // Конвертируем районы в rgid Яндекса
      params.district = query.districts;
    }

    // Тип недвижимости
    if (query.propertyType === 'new') {
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
      district: item.location.district,
      metro: item.location.metro?.name,
      metroDistance: item.location.metro ? {
        minutes: item.location.metro.timeToMetro,
        transport: item.location.metro.transportType === 'walk' ? 'foot' : 'transport'
      } : undefined,
      rooms: item.rooms || 0,
      area: item.area.value,
      floor: item.floor,
      floors: item.floorsTotal,
      description: item.description,
      images: item.images.slice(0, 5),
      url: item.url,
      source: 'yandex_realty',
      coordinates: {
        lat: item.location.coordinates.latitude,
        lng: item.location.coordinates.longitude
      },
      features: this.extractFeatures(item),
      publishedAt: new Date(),
      
      // Партнерские данные
      partnerData: {
        partnerId: this.config.partnerId,
        partnerName: 'Яндекс.Недвижимость',
        commission: item.price.value * (this.config.commissionRate || 0.005),
        estimatedLeadRevenue: this.estimateLeadPriceForListing({
          price: item.price.value
        } as Listing)
      }
    };

    // Генерируем партнерскую ссылку
    return this.enrichListing(listing);
  }

  private generateTitle(item: YandexRealtyListing): string {
    const type = item.category === 'apartment' ? 'Квартира' : 'Дом';
    const rooms = item.rooms ? `${item.rooms}-комн. ` : '';
    return `${rooms}${type}, ${item.area.value} м²`;
  }

  private extractFeatures(item: YandexRealtyListing): string[] {
    const features: string[] = [];
    
    if (item.floor && item.floorsTotal) {
      features.push(`${item.floor}/${item.floorsTotal} этаж`);
    }
    
    if (item.location.metro) {
      features.push(`${item.location.metro.timeToMetro} мин до метро`);
    }

    return features;
  }

  // Переопределяем метод отправки лида для Яндекса
  protected prepareLead(lead: Lead): any {
    const baseLead = super.prepareLead(lead);
    
    // Добавляем специфичные для Яндекса поля
    return {
      ...baseLead,
      partner_id: this.config.partnerId,
      source_type: 'telegram_bot',
      lead_type: lead.purpose === 'invest' ? 'investment' : 'personal',
      
      // Яндекс требует указание региона
      region: this.mapLocationToYandexRegion(lead.locations[0]),
      
      // Дополнительные метрики для Яндекса
      user_metrics: {
        session_duration: lead.engagementScore,
        pages_viewed: lead.viewedListings.length,
        searches_made: lead.searchesCount,
        has_telegram: true
      }
    };
  }

  private mapLocationToYandexRegion(location: string): number {
    // Маппинг локаций на rgid Яндекса
    const regionMap: Record<string, number> = {
      'москва': 587795,
      'санкт-петербург': 417899,
      'московская область': 587654,
      'ленинградская область': 417901,
      'новосибирск': 580460,
      'екатеринбург': 559252,
      'нижний новгород': 580425,
      'казань': 577153,
      'челябинск': 565150,
      'омск': 580045
    };

    const normalized = location.toLowerCase();
    
    for (const [key, rgid] of Object.entries(regionMap)) {
      if (normalized.includes(key)) {
        return rgid;
      }
    }

    return 587795; // Москва по умолчанию
  }

  // Метод для получения актуальных цен на лиды
  async getLeadPricing(): Promise<{
    regions: Array<{
      name: string;
      rgid: number;
      pricing: {
        base: number;
        qualified: number;
        exclusive: number;
      };
    }>;
  }> {
    try {
      const response = await this.makeRequest('/partners/lead-pricing');
      return response.data;
    } catch (error) {
      // Возвращаем дефолтные цены
      return {
        regions: [{
          name: 'Москва',
          rgid: 587795,
          pricing: this.leadConfig.leadPricing
        }]
      };
    }
  }

  // Проверка баланса и статистики
  async getPartnerStats(): Promise<{
    balance: number;
    leadsSubmitted: number;
    leadsAccepted: number;
    totalEarned: number;
    pendingPayment: number;
  }> {
    try {
      const response = await this.makeRequest('/partners/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to get partner stats:', error);
      return {
        balance: 0,
        leadsSubmitted: 0,
        leadsAccepted: 0,
        totalEarned: 0,
        pendingPayment: 0
      };
    }
  }
}