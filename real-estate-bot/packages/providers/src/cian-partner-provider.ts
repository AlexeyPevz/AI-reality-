import { AllInOneProvider, AllInOneConfig } from './all-in-one-base';
import { Listing, QueryDTO, Lead } from '@real-estate-bot/shared';

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
    address?: Array<{
      fullName: string;
      type: string;
    }>;
    highways?: Array<{
      name: string;
      distanceKm: number;
    }>;
    undergrounds?: Array<{
      name: string;
      lineColor: string;
      time: number;
      transportType: 'walk' | 'transport';
    }>;
  };
  photos?: Array<{
    fullUrl: string;
    thumbnailUrl: string;
  }>;
  description?: string;
  phones?: Array<{
    countryCode: string;
    number: string;
  }>;
}

export class CianPartnerProvider extends AllInOneProvider {
  constructor(config: AllInOneConfig) {
    super({
      ...config,
      name: 'cian_partner',
      baseURL: 'https://partners.cian.ru/api/v2',
      supportsFilters: ['price', 'rooms', 'area', 'location', 'metro', 'propertyType'],
      commissionRate: 0.01, // 1% от сделки
      leadWebhookUrl: 'https://partners.cian.ru/api/v2/leads/submit',
      leadPricing: {
        base: 2000,      // Базовая цена
        qualified: 4000,  // С верифицированным телефоном
        exclusive: 7000   // Премиум лид (готов к покупке)
      },
      leadRequirements: {
        minBudget: 2500000, // Минимум 2.5 млн
        regions: ['Москва', 'Санкт-Петербург', 'МО', 'Екатеринбург', 'Новосибирск'],
        propertyTypes: ['new', 'secondary']
      }
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
    const params: any = {
      deal_type: 'sale',
      offer_type: ['flat'],
      region: 1, // Москва по умолчанию
      page: 1,
      limit: 30,
      sort: 'price_asc'
    };

    // Цена
    if (query.priceMin) params.price_min = query.priceMin;
    if (query.priceMax) params.price_max = query.priceMax;

    // Комнаты
    if (query.rooms && query.rooms.length > 0) {
      params.room = query.rooms.map(r => r === 4 ? '4+' : r.toString());
    }

    // Площадь
    if (query.areaMin) params.total_area_min = query.areaMin;
    if (query.areaMax) params.total_area_max = query.areaMax;

    // Метро
    if (query.metroIds && query.metroIds.length > 0) {
      params.underground = query.metroIds;
    }

    // Районы
    if (query.districts && query.districts.length > 0) {
      params.district = query.districts;
    }

    // Тип недвижимости
    if (query.propertyType === 'new') {
      params.object_type = ['newobject'];
    } else if (query.propertyType === 'secondary') {
      params.object_type = ['secondary'];
    }

    // Точки маршрута
    if (query.commutePoint) {
      params.engine_version = 2;
      params.polygon = {
        type: 'commute',
        coordinates: query.commutePoint.coordinates,
        commute_time: query.commutePoint.time
      };
    }

    return params;
  }

  private transformToListing(offer: CianOffer): Listing {
    const metro = offer.geo.undergrounds?.[0];
    
    const listing: Listing = {
      id: `cian_${offer.cianId}`,
      title: this.generateTitle(offer),
      price: offer.bargainTerms.price,
      address: offer.geo.userInput,
      district: this.extractDistrict(offer),
      metro: metro?.name,
      metroDistance: metro ? {
        minutes: metro.time,
        transport: metro.transportType === 'walk' ? 'foot' : 'transport'
      } : undefined,
      rooms: offer.roomsCount || 0,
      area: offer.totalArea || 0,
      floor: offer.floorNumber,
      floors: offer.building?.floorsCount,
      description: offer.description || '',
      images: offer.photos?.slice(0, 5).map(p => p.fullUrl) || [],
      url: offer.fullUrl,
      source: 'cian',
      coordinates: offer.geo.coordinates ? {
        lat: offer.geo.coordinates.lat,
        lng: offer.geo.coordinates.lng
      } : undefined,
      features: this.extractFeatures(offer),
      publishedAt: new Date(),
      
      // Партнерские данные
      partnerData: {
        partnerId: this.config.partnerId,
        partnerName: 'ЦИАН Партнер',
        commission: offer.bargainTerms.price * (this.config.commissionRate || 0.01),
        estimatedLeadRevenue: this.estimateLeadPriceForListing({
          price: offer.bargainTerms.price
        } as Listing),
        leadProgramActive: true,
        mortgageAvailable: offer.bargainTerms.mortgageAllowed
      }
    };

    // Добавляем партнерскую ссылку
    return this.enrichListing(listing);
  }

  private generateTitle(offer: CianOffer): string {
    const type = offer.category.includes('flat') ? 'Квартира' : 'Дом';
    const rooms = offer.roomsCount ? `${offer.roomsCount}-комн. ` : '';
    const area = offer.totalArea ? `, ${offer.totalArea} м²` : '';
    return `${rooms}${type}${area}`;
  }

  private extractDistrict(offer: CianOffer): string {
    const districtAddress = offer.geo.address?.find(
      addr => addr.type === 'district' || addr.type === 'quarter'
    );
    return districtAddress?.fullName || '';
  }

  private extractFeatures(offer: CianOffer): string[] {
    const features: string[] = [];
    
    if (offer.floorNumber && offer.building?.floorsCount) {
      features.push(`${offer.floorNumber}/${offer.building.floorsCount} этаж`);
    }
    
    if (offer.building?.buildYear) {
      features.push(`${offer.building.buildYear} год постройки`);
    }
    
    if (offer.bargainTerms.mortgageAllowed) {
      features.push('Возможна ипотека');
    }
    
    const metro = offer.geo.undergrounds?.[0];
    if (metro) {
      features.push(`${metro.time} мин до м. ${metro.name}`);
    }

    return features;
  }

  // Специфичная подготовка лида для ЦИАН
  protected prepareLead(lead: Lead): any {
    const baseLead = super.prepareLead(lead);
    
    return {
      ...baseLead,
      // ЦИАН специфичные поля
      partner_code: this.config.partnerId,
      api_version: 'v2',
      
      // Категоризация лида для ЦИАН
      lead_category: this.categorizeLeadForCian(lead),
      
      // Регион в формате ЦИАН
      region_id: this.mapLocationToCianRegion(lead.locations[0]),
      
      // Дополнительная информация
      extra_data: {
        has_mortgage_approval: false,
        viewing_requested: lead.engagementScore > 70,
        urgency: lead.quality === 'hot' ? 'high' : 'normal',
        preferred_contact_time: '10:00-20:00',
        source_campaign: 'telegram_bot_smart_realty'
      }
    };
  }

  private categorizeLeadForCian(lead: Lead): string {
    if (lead.purpose === 'invest') {
      return 'investor';
    } else if (lead.budget.max && lead.budget.max > 15000000) {
      return 'premium';
    } else if (lead.type === 'new') {
      return 'newbuilding';
    } else {
      return 'standard';
    }
  }

  private mapLocationToCianRegion(location: string): number {
    const regionMap: Record<string, number> = {
      'москва': 1,
      'санкт-петербург': 2,
      'московская область': 4593,
      'екатеринбург': 4743,
      'новосибирск': 4897,
      'нижний новгород': 4884,
      'казань': 4777,
      'челябинск': 5002,
      'омск': 4914,
      'самара': 4935,
      'ростов-на-дону': 4926,
      'уфа': 4985,
      'красноярск': 4827,
      'пермь': 4916,
      'воронеж': 4701
    };

    const normalized = location.toLowerCase();
    
    for (const [key, regionId] of Object.entries(regionMap)) {
      if (normalized.includes(key)) {
        return regionId;
      }
    }

    return 1; // Москва по умолчанию
  }

  // Метод для вывода заработанных средств
  async requestPayout(amount: number): Promise<{
    success: boolean;
    transactionId?: string;
    message?: string;
  }> {
    try {
      const response = await this.makeRequest('/partner/payout', {
        method: 'POST',
        data: {
          amount: amount,
          currency: 'RUB',
          method: 'bank_transfer'
        }
      });

      return {
        success: true,
        transactionId: response.data.transaction_id,
        message: response.data.message
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payout failed'
      };
    }
  }

  // Получение детальной статистики
  async getDetailedStats(period: 'day' | 'week' | 'month' = 'month'): Promise<{
    leads: {
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
    };
    revenue: {
      total: number;
      pending: number;
      paid: number;
    };
    conversion: {
      leadToView: number;
      viewToDeal: number;
    };
    topRegions: Array<{
      name: string;
      leads: number;
      revenue: number;
    }>;
  }> {
    try {
      const response = await this.makeRequest(`/partner/stats/detailed?period=${period}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get detailed stats:', error);
      return {
        leads: { total: 0, accepted: 0, rejected: 0, pending: 0 },
        revenue: { total: 0, pending: 0, paid: 0 },
        conversion: { leadToView: 0, viewToDeal: 0 },
        topRegions: []
      };
    }
  }
}