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
  constructor(config: Omit<PartnerConfig, 'baseUrl'>) {
    super(
      'ПИК',
      {
        ...config,
        baseUrl: 'https://api.pik.ru/v2',
        commissionRate: 3 // ПИК платит 3% комиссии
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

      if (query.district) params.district = query.district;
      if (query.rooms) params.rooms = query.rooms.join(',');
      if (query.priceMin) params.price_min = query.priceMin;
      if (query.priceMax) params.price_max = query.priceMax;
      if (query.areaMin) params.area_min = query.areaMin;
      if (query.areaMax) params.area_max = query.areaMax;

      const response = await this.client.get('/complexes/search', { params });
      const complexes: PIKListing[] = response.data.data || [];

      // Преобразуем в наш формат
      const listings: Listing[] = [];
      
      for (const complex of complexes) {
        for (const layout of complex.layouts) {
          if (layout.status !== 'on_sale') continue;

          const listing: Listing = {
            id: `pik_${layout.id}`,
            type: 'new',
            address: complex.complex.address,
            district: query.district || this.extractDistrict(complex.complex.address),
            metro: complex.complex.metro,
            coordinates: complex.complex.coordinates,
            price: layout.price,
            rooms: layout.rooms,
            area: layout.area,
            floor: layout.floor,
            title: `${layout.rooms}-комн квартира в ${complex.complex.name}`,
            description: `Новая квартира от ПИК. ${complex.complex.name}. Этаж ${layout.floor}.`,
            images: layout.images,
            url: `https://www.pik.ru/projects/${complex.id}/flats/${layout.id}`,
            source: 'ПИК',
            partnerId: this.config.partnerId,
            metadata: {
              complex: complex.complex.name,
              constructionYear: new Date().getFullYear() + 2,
              isNewBuilding: true,
              developer: 'ГК ПИК'
            }
          };

          // Обогащаем партнерскими данными
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
        id: id,
        type: 'new',
        address: data.complex.address,
        district: this.extractDistrict(data.complex.address),
        metro: data.complex.metro,
        coordinates: data.complex.coordinates,
        price: data.price,
        rooms: data.rooms,
        area: data.area,
        floor: data.floor,
        floorsTotal: data.floors_total,
        title: `${data.rooms}-комн квартира в ${data.complex.name}`,
        description: data.description || `Квартира в новом доме от ПИК.`,
        images: data.images,
        url: `https://www.pik.ru/projects/${data.complex.id}/flats/${data.id}`,
        source: 'ПИК',
        partnerId: this.config.partnerId,
        metadata: {
          complex: data.complex.name,
          section: data.section,
          finishing: data.finishing ? 'Да' : 'Нет',
          commissioning: data.commissioning_date,
          mortgage: data.mortgage_available,
          installment: data.installment_available
        }
      };

      return this.enrichListingWithPartnerData(listing);
    } catch (error) {
      console.error('PIK API error:', error);
      return null;
    }
  }

  private extractDistrict(address: string): string {
    // Простая логика извлечения района из адреса
    const districts = ['ВАО', 'ЗАО', 'САО', 'ЮАО', 'СВАО', 'СЗАО', 'ЮВАО', 'ЮЗАО', 'ЦАО'];
    for (const district of districts) {
      if (address.includes(district)) return district;
    }
    return 'Москва';
  }

  // Специальные методы для ПИК

  async getSpecialOffers(): Promise<Listing[]> {
    try {
      const response = await this.client.get('/special-offers', {
        params: { partner_id: this.config.partnerId }
      });
      
      // Преобразуем спецпредложения в листинги
      return response.data.data.map((offer: any) => 
        this.enrichListingWithPartnerData({
          ...offer,
          metadata: {
            ...offer.metadata,
            isSpecialOffer: true,
            offerType: offer.type // скидка, рассрочка, etc
          }
        })
      );
    } catch {
      return [];
    }
  }

  async getMortgagePrograms(): Promise<any[]> {
    try {
      const response = await this.client.get('/mortgage-programs', {
        params: { partner_id: this.config.partnerId }
      });
      return response.data.data;
    } catch {
      return [];
    }
  }
}