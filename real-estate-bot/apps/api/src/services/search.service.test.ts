import * as providers from '@real-estate-bot/providers';
import { searchAndScoreListings } from './search.service';

jest.mock('@real-estate-bot/providers');
jest.mock('@real-estate-bot/database', () => ({
  prisma: {
    recommendation: { create: jest.fn(async () => ({})) },
    listing: { upsert: jest.fn(async ({ create }) => ({ id: `db-${create.externalId}` })) },
  },
}));

describe('search.service', () => {
  test('scores and sorts listings from provider', async () => {
    (providers as any).ProviderFactory = {
      getDefault: () => ({
        name: 'mock',
        searchListings: async () => ([
          { id: '1', title: 'A', address: '', lat: 55, lng: 37, price: 9000000, rooms: 1, area: 30, floor: 5, totalFloors: 10, photos: [], provider: 'mock', createdAt: new Date(), updatedAt: new Date() },
          { id: '2', title: 'B', address: '', lat: 55, lng: 37, price: 12000000, rooms: 2, area: 45, floor: 10, totalFloors: 20, photos: [], provider: 'mock', createdAt: new Date(), updatedAt: new Date() },
        ]),
      }),
    };

    const prefs: any = {
      id: 'p1', userId: 'u1', mode: 'life',
      budgetMin: 5000000, budgetMax: 10000000,
      weights: { price: 10, transport: 0 },
      locations: [], commutePoints: [], rooms: [],
      createdAt: new Date(), updatedAt: new Date(),
    };

    const results = await searchAndScoreListings(prefs);
    expect(results.length).toBe(2);
    expect(results[0].matchScore).toBeGreaterThanOrEqual(results[1].matchScore);
  });
});