import { enrichmentService } from './enrichment.service';

jest.mock('./nearby.providers', () => ({
  fetchNearbyYandex: jest.fn(async () => ({
    schoolsCount: 3,
    parksCount: 1,
    metroStations: [{ lat: 55.75, lng: 37.61, distance: 300 }],
  })),
  fetchNearbyDGIS: jest.fn(async () => null),
}));

describe('enrichment.service', () => {
  test('computeBreakdownPart maps distances and counts to scores', () => {
    const partial = enrichmentService.computeBreakdownPart({
      schoolsNearby: 6,
      parksNearby: 7,
      metroDistanceMin: 350,
      metrics: { schoolsCount: 3, parksCount: 1, metroStations: 1 },
    } as any);
    expect(partial.schools).toBeGreaterThan(0);
    expect(partial.parks).toBeGreaterThan(0);
    expect(partial.metro).toBeGreaterThan(0);
    expect(partial.ecology).toBeDefined();
    expect(partial.noise).toBeDefined();
  });
});