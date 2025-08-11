import axios from 'axios';
import { Listing, MatchBreakdown } from '@real-estate-bot/shared';

interface EnrichmentResult {
  schoolsNearby: number;
  parksNearby: number;
  metroDistanceMin?: number;
  metrics: {
    schoolsCount: number;
    parksCount: number;
    metroStations: number;
  };
}

const overpassApi = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';
const cacheDays = parseInt(process.env.ENRICHMENT_CACHE_DAYS || '7');

export const enrichmentService = {
  async enrichListing(listing: Listing): Promise<EnrichmentResult | null> {
    try {
      const { lat, lng } = listing;
      const radius = 1200; // meters

      // Overpass QL to fetch schools, parks, metro around listing
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="school"](around:${radius},${lat},${lng});
          way["leisure"="park"](around:${radius},${lat},${lng});
          relation["leisure"="park"](around:${radius},${lat},${lng});
          node["railway"="station"]["station"="subway"](around:${radius},${lat},${lng});
          node["public_transport"="station"]["subway"="yes"](around:${radius},${lat},${lng});
        );
        out center;`;

      const resp = await axios.post(overpassApi, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 15000,
      });

      const elements: any[] = resp.data?.elements || [];
      const schools = elements.filter(e => e.tags?.amenity === 'school');
      const parks = elements.filter(e => e.tags?.leisure === 'park');
      const metro = elements.filter(e =>
        (e.tags?.railway === 'station' && e.tags?.station === 'subway') ||
        (e.tags?.public_transport === 'station' && e.tags?.subway === 'yes')
      );

      // Simple scoring: more schools/parks better; metro distance mapped to score
      const schoolsNearby = Math.max(0, Math.min(10, schools.length >= 5 ? 10 : schools.length * 2));
      const parksNearby = Math.max(0, Math.min(10, parks.length >= 3 ? 10 : parks.length * 3.5));

      let metroDistanceMin: number | undefined = undefined;
      if (metro.length > 0) {
        const distances = metro.map((m) => distanceMeters(lat, lng, m.lat || m.center?.lat, m.lon || m.center?.lon));
        metroDistanceMin = Math.min(...distances);
      }

      return {
        schoolsNearby,
        parksNearby,
        metroDistanceMin,
        metrics: {
          schoolsCount: schools.length,
          parksCount: parks.length,
          metroStations: metro.length,
        }
      };
    } catch (e) {
      return null;
    }
  },

  computeBreakdownPart(enriched: EnrichmentResult): Partial<MatchBreakdown> {
    const breakdown: Partial<MatchBreakdown> = {};
    breakdown.schools = enriched.schoolsNearby;
    breakdown.parks = enriched.parksNearby;

    if (typeof enriched.metroDistanceMin === 'number') {
      // Map 0-1200m to 10-0
      const score = enriched.metroDistanceMin <= 200 ? 10
        : enriched.metroDistanceMin >= 1200 ? 0
        : 10 - ((enriched.metroDistanceMin - 200) / 1000) * 10;
      breakdown.metro = Math.max(0, Math.min(10, score));
    }

    return breakdown;
  }
};

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg: number) { return deg * Math.PI / 180; }