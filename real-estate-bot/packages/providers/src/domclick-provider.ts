import { PartnerListingsProvider, PartnerConfig } from './partner-base';
import { Listing, QueryDTO } from '@real-estate-bot/shared';

interface DomClickResponse {
  offers: Array<{
    id: number;
    type: 'sale' | 'rent';
    category: 'flat' | 'house' | 'room';
    address: {
      fullAddress: string;
      district: string;
      metro?: Array<{
        name: string;
        distance: number;
      }>;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
    price: {
      value: number;
      currency: string;
    };
    area: {
      value: number;
      unit: string;
    };
    roomsCount: number;
    floor: number;
    floorsCount: number;
    description: string;
    photos: string[];
    url: string;
    publishedAt: string;
    isNewBuilding: boolean;
    buildingYear?: number;
  }>;
  totalCount: number;
}

export class DomClickProvider extends PartnerListingsProvider {
  constructor(config: Omit<PartnerConfig, 'baseUrl'>) {
    super(
      'ДомКлик',
      {
        ...config,
        baseUrl: 'https://api.domclick.ru/v1',
        commissionRate: 0.5 // ДомКлик платит 0.5% от суммы сделки
      },
      ['district', 'metro', 'rooms', 'priceMin', 'priceMax', 'areaMin', 'areaMax', 'type']
    );
  }

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    try {
      const params: any = {
        api_key: this.config.apiKey,
        partner_id: this.config.partnerId,
        deal_type: 'sale',
        offer_type: query.type === 'new' ? 'primary' : 'secondary',
        region: 'moscow',
        sort: 'price',
        limit: 50
      };

      // Фильтры
      if (query.district) params.district = query.district;
      if (query.metro?.length) params.metro = query.metro.join(',');
      if (query.rooms?.length) params.rooms_count = query.rooms.join(',');
      if (query.priceMin) params.price_min = query.priceMin;
      if (query.priceMax) params.price_max = query.priceMax;
      if (query.areaMin) params.area_min = query.areaMin;
      if (query.areaMax) params.area_max = query.areaMax;

      const response = await this.client.get('/offers/search', { params });
      const data: DomClickResponse = response.data;

      return data.offers.map(offer => {
        const listing: Listing = {
          id: `domclick_${offer.id}`,
          type: offer.isNewBuilding ? 'new' : 'secondary',
          address: offer.address.fullAddress,
          district: offer.address.district,
          metro: offer.address.metro?.map(m => m.name) || [],
          coordinates: {
            lat: offer.address.coordinates.latitude,
            lng: offer.address.coordinates.longitude
          },
          price: offer.price.value,
          rooms: offer.roomsCount,
          area: offer.area.value,
          floor: offer.floor,
          floorsTotal: offer.floorsCount,
          title: this.generateTitle(offer),
          description: offer.description,
          images: offer.photos,
          url: offer.url,
          source: 'ДомКлик',
          partnerId: this.config.partnerId,
          metadata: {
            publishedAt: offer.publishedAt,
            buildingYear: offer.buildingYear,
            category: offer.category,
            metroDistance: offer.address.metro?.[0]?.distance
          }
        };

        return this.enrichListingWithPartnerData(listing);
      });
    } catch (error) {
      console.error('DomClick API error:', error);
      return [];
    }
  }

  async getListing(id: string): Promise<Listing | null> {
    if (!id.startsWith('domclick_')) return null;
    
    const offerId = id.replace('domclick_', '');
    
    try {
      const response = await this.client.get(`/offers/${offerId}`, {
        params: {
          api_key: this.config.apiKey,
          partner_id: this.config.partnerId
        }
      });
      
      const offer = response.data.offer;
      if (!offer) return null;

      const listing: Listing = {
        id: id,
        type: offer.isNewBuilding ? 'new' : 'secondary',
        address: offer.address.fullAddress,
        district: offer.address.district,
        metro: offer.address.metro?.map((m: any) => m.name) || [],
        coordinates: {
          lat: offer.address.coordinates.latitude,
          lng: offer.address.coordinates.longitude
        },
        price: offer.price.value,
        rooms: offer.roomsCount,
        area: offer.area.value,
        floor: offer.floor,
        floorsTotal: offer.floorsCount,
        title: this.generateTitle(offer),
        description: offer.description,
        images: offer.photos,
        url: offer.url,
        source: 'ДомКлик',
        partnerId: this.config.partnerId,
        metadata: {
          publishedAt: offer.publishedAt,
          buildingYear: offer.buildingYear,
          category: offer.category,
          metroDistance: offer.address.metro?.[0]?.distance,
          // Дополнительная информация
          balcony: offer.balcony,
          renovation: offer.renovation,
          parking: offer.parking,
          mortgage: offer.mortgageAvailable,
          // Информация о продавце
          sellerType: offer.sellerType,
          commission: offer.agentCommission
        }
      };

      return this.enrichListingWithPartnerData(listing);
    } catch (error) {
      console.error('DomClick API error:', error);
      return null;
    }
  }

  private generateTitle(offer: any): string {
    const roomsText = offer.roomsCount === 0 ? 'Студия' : `${offer.roomsCount}-комн квартира`;
    const typeText = offer.isNewBuilding ? 'в новостройке' : '';
    return `${roomsText} ${offer.area.value} м² ${typeText}`.trim();
  }

  // Специальные методы ДомКлик

  async getMortgageCalculation(listingId: string, initialPayment: number): Promise<any> {
    try {
      const response = await this.client.post('/mortgage/calculate', {
        offer_id: listingId.replace('domclick_', ''),
        initial_payment: initialPayment,
        partner_id: this.config.partnerId
      });
      
      return {
        monthlyPayment: response.data.monthly_payment,
        rate: response.data.rate,
        term: response.data.term,
        totalAmount: response.data.total_amount,
        programs: response.data.available_programs
      };
    } catch (error) {
      console.error('Mortgage calculation error:', error);
      return null;
    }
  }

  async getSimilarListings(listingId: string): Promise<Listing[]> {
    try {
      const response = await this.client.get(`/offers/${listingId.replace('domclick_', '')}/similar`, {
        params: {
          api_key: this.config.apiKey,
          limit: 5
        }
      });
      
      return response.data.offers.map((offer: any) => 
        this.enrichListingWithPartnerData(this.transformOffer(offer))
      );
    } catch {
      return [];
    }
  }

  private transformOffer(offer: any): Listing {
    // Вспомогательный метод для преобразования
    return {
      id: `domclick_${offer.id}`,
      type: offer.isNewBuilding ? 'new' : 'secondary',
      address: offer.address.fullAddress,
      price: offer.price.value,
      rooms: offer.roomsCount,
      area: offer.area.value,
      // ... остальные поля
    } as Listing;
  }
}