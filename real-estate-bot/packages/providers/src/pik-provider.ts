import { PartnerListingsProvider, PartnerConfig } from './partner-base';
import { Listing, QueryDTO } from '@real-estate-bot/shared';

interface PIKListing {
  id: string;
  complex: {
    name: string;
    address: string;
    metro: string[];
    coordinates: { lat: number; lng: number };
  };
  layouts: Array<{
    id: string;
    rooms: number;
    area: number;
    floor: number;
    price: number;
    status: string;
    images: string[];
  }>;
}

export class PIKProvider extends PartnerListingsProvider {
  constructor(config: PartnerConfig) {
    super(
      'pik_partner',
      {
        ...config,
        baseUrl: config.baseUrl || 'https://api.pik.ru/v2',
        commissionRate: config.commissionRate ?? 3
      },
      ['district', 'rooms', 'priceMin', 'priceMax', 'areaMin', 'areaMax']
    );
  }

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    try {
      // Формируем запрос к API ПИК
      const params: any = {
        partner_id: this.config.partnerId,
        city: 'moscow',
        status: 'on_sale'
      };

      const filters = query.filters || ({} as any);
      const districts = query.geo?.districts || [];

      if (districts.length > 0) params.district = districts;
      if (filters.rooms) params.rooms = filters.rooms.join(',');
      if (query.budget?.min) params.price_min = query.budget.min;
      if (query.budget?.max) params.price_max = query.budget.max;
      if (filters.areaMin) params.area_min = filters.areaMin;
      if (filters.areaMax) params.area_max = filters.areaMax;

      const response = await this.client.get('/complexes/search', { params });
      const complexes: PIKListing[] = response.data.data || [];

      const listings: Listing[] = [];
      for (const complex of complexes) {
        for (const layout of complex.layouts) {
          if (layout.status !== 'on_sale') continue;

          const listing: Listing = {
            id: `pik_${layout.id}`,
            title: `${layout.rooms}-комн. квартира в ${complex.complex.name}`,
            address: complex.complex.address,
            lat: complex.complex.coordinates.lat,
            lng: complex.complex.coordinates.lng,
            price: layout.price,
            rooms: layout.rooms,
            area: layout.area,
            floor: layout.floor,
            totalFloors: undefined as any,
            photos: layout.images,
            provider: 'pik_partner',
            description: `Новая квартира от ПИК. ${complex.complex.name}. Этаж ${layout.floor}.`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          listings.push(this.enrichListingWithPartnerData(listing));
        }
      }

      return listings;
    } catch (error) {
      console.error('PIK API error:', error);
      return [];
    }
  }

  async getListing(id: string): Promise<Listing | null> {
    if (!id.startsWith('pik_')) return null;
    const layoutId = id.replace('pik_', '');

    try {
      const response = await this.client.get(`/layouts/${layoutId}`, {
        params: { partner_id: this.config.partnerId }
      });
      const data = response.data.data;
      if (!data) return null;

      const listing: Listing = {
        id,
        title: `${data.rooms}-комн. квартира в ${data.complex.name}`,
        address: data.complex.address,
        lat: data.complex.coordinates.lat,
        lng: data.complex.coordinates.lng,
        price: data.price,
        rooms: data.rooms,
        area: data.area,
        floor: data.floor,
        totalFloors: data.floors_total,
        photos: data.images,
        provider: 'pik_partner',
        description: data.description || `Квартира в новом доме от ПИК.`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return this.enrichListingWithPartnerData(listing);
    } catch (error) {
      console.error('PIK API error:', error);
      return null;
    }
  }
}