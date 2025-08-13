import { QueryDTO, Listing } from '@real-estate-bot/shared';
import { BaseListingsProvider } from './base';

// Mock provider for testing and development
export class MockListingsProvider extends BaseListingsProvider {
  private mockListings: Listing[] = [];

  constructor() {
    super(
      'mock',
      'https://api.mock.local',
      ['rooms', 'price', 'area', 'newBuilding', 'parking'],
      'https://example.com/property/{id}?utm_source=bot'
    );
    
    // Generate mock data
    this.generateMockListings();
    // align linkTemplate for partner redirects via API
    this.linkTemplate = this.linkTemplate || '';

  }

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    let filtered = [...this.mockListings];

    // Filter by budget
    if (query.budget.min) {
      filtered = filtered.filter(l => l.price >= query.budget.min!);
    }
    if (query.budget.max) {
      filtered = filtered.filter(l => l.price <= query.budget.max!);
    }

    // Filter by rooms
    if (query.filters.rooms && query.filters.rooms.length > 0) {
      filtered = filtered.filter(l => query.filters.rooms!.includes(l.rooms));
    }

    // Filter by area
    if (query.filters.areaMin) {
      filtered = filtered.filter(l => l.area >= query.filters.areaMin!);
    }
    if (query.filters.areaMax) {
      filtered = filtered.filter(l => l.area <= query.filters.areaMax!);
    }

    // Filter by new building
    if (query.filters.newBuilding !== undefined) {
      filtered = filtered.filter(l => l.isNewBuilding === query.filters.newBuilding);
    }

    // Filter by parking
    if (query.filters.parking !== undefined) {
      filtered = filtered.filter(l => l.hasParking === query.filters.parking);
    }

    // Add partner links
    return filtered.map(listing => ({
      ...listing,
      partnerDeeplinkTemplate: this.generatePartnerLink(listing),
    }));
  }

  async getListing(id: string): Promise<Listing | null> {
    const listing = this.mockListings.find(l => l.id === id);
    if (!listing) return null;
    
    return {
      ...listing,
      partnerDeeplinkTemplate: this.generatePartnerLink(listing),
    };
  }

  private generateMockListings() {
    const districts = ['Центр', 'Север', 'Юг', 'Запад', 'Восток'];
    const developers = ['ПИК', 'Самолет', 'ЛСР', 'Setl Group', 'Главстрой'];
    const stages = ['котлован', 'фундамент', 'каркас', 'фасад', 'отделка', 'сдан'];

    for (let i = 0; i < 100; i++) {
      const isNew = Math.random() > 0.5;
      const rooms = Math.floor(Math.random() * 4) + 1;
      const area = rooms * 20 + Math.random() * 30;
      const pricePerMeter = 150000 + Math.random() * 100000;
      
      this.mockListings.push({
        id: `mock-${i}`,
        title: `${rooms}-комнатная квартира, ${Math.floor(area)} м²`,
        address: `ул. Примерная, д. ${i + 1}, ${districts[i % districts.length]}`,
        lat: 55.7558 + (Math.random() - 0.5) * 0.2,
        lng: 37.6173 + (Math.random() - 0.5) * 0.3,
        price: Math.floor(area * pricePerMeter),
        rooms,
        area: Math.floor(area),
        floor: Math.floor(Math.random() * 20) + 1,
        totalFloors: 25,
        year: isNew ? 2024 + Math.floor(Math.random() * 3) : 2010 + Math.floor(Math.random() * 10),
        stage: isNew ? stages[Math.floor(Math.random() * stages.length)] : undefined,
        photos: [
          `https://picsum.photos/seed/${i}/800/600`,
          `https://picsum.photos/seed/${i + 1000}/800/600`,
        ],
        provider: 'mock',
        description: `Отличная квартира в ${districts[i % districts.length]}. ${isNew ? 'Новостройка' : 'Вторичка'}.`,
        hasParking: Math.random() > 0.6,
        isNewBuilding: isNew,
        developer: isNew ? developers[i % developers.length] : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}