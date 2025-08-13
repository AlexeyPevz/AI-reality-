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
  constructor(config: PartnerConfig) {
    super(
      'domclick_partner',
      {
        ...config,
        baseUrl: config.baseUrl || 'https://api.domclick.ru/v1',
        commissionRate: config.commissionRate ?? 0.5
      },
      ['rooms', 'price', 'area', 'location', 'propertyType']
    );
  }

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    try {
      const filters = query.filters || ({} as any);
      const params: any = {
        api_key: this.config.apiKey,
        partner_id: this.config.partnerId,
        deal_type: query.dealType === 'rent' ? 'rent' : 'sale',
        offer_type: filters.propertyType === 'new' ? 'primary' : 'secondary',
        region: 'moscow',
        sort: 'price',
        limit: 50
      };

      const districts = query.geo?.districts || [];
      if (districts.length) params.district = districts;
      if (filters.rooms?.length) params.rooms_count = filters.rooms.join(',');
      if (query.budget?.min) params.price_min = query.budget.min;
      if (query.budget?.max) params.price_max = query.budget.max;
      if (filters.areaMin) params.area_min = filters.areaMin;
      if (filters.areaMax) params.area_max = filters.areaMax;

      const response = await this.client.get('/offers/search', { params });
      const data: DomClickResponse = response.data;

      return data.offers.map(offer => {
        const listing: Listing = {
          id: `domclick_${offer.id}`,
          title: this.generateTitle(offer),
          address: offer.address.fullAddress,
          lat: offer.address.coordinates.latitude,
          lng: offer.address.coordinates.longitude,
          price: offer.price.value,
          rooms: offer.roomsCount,
          area: offer.area.value,
          floor: offer.floor,
          totalFloors: offer.floorsCount,
          photos: offer.photos,
          provider: 'domclick_partner',
          description: offer.description,
          createdAt: new Date(offer.publishedAt),
          updatedAt: new Date(),
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
        id,
        title: this.generateTitle(offer),
        address: offer.address.fullAddress,
        lat: offer.address.coordinates.latitude,
        lng: offer.address.coordinates.longitude,
        price: offer.price.value,
        rooms: offer.roomsCount,
        area: offer.area.value,
        floor: offer.floor,
        totalFloors: offer.floorsCount,
        photos: offer.photos,
        provider: 'domclick_partner',
        description: offer.description,
        createdAt: new Date(offer.publishedAt),
        updatedAt: new Date(),
      };

      return this.enrichListingWithPartnerData(listing);
    } catch (error) {
      console.error('DomClick API error:', error);
      return null;
    }
  }

  private generateTitle(offer: any): string {
    const roomsText = offer.roomsCount === 0 ? 'Студия' : `${offer.roomsCount}-комн. квартира`;
    const typeText = offer.isNewBuilding ? 'в новостройке' : '';
    return `${roomsText} ${offer.area.value} м² ${typeText}`.trim();
  }
}