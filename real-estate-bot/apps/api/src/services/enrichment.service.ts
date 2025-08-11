import axios from 'axios';
import { prisma } from '@real-estate-bot/database';
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

      // Try cache first
      const cached = await prisma.listingEnrichment.findUnique({ where: { listingId: listing.id } });
      if (cached && Date.now() - new Date(cached.updatedAt).getTime() < cacheDays * 24 * 60 * 60 * 1000) {
        return cached.data as any;
      }

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

      // Prefer commercial providers if configured
      const { fetchNearbyYandex } = await import('./nearby.providers');
      const { fetchNearbyDGIS } = await import('./nearby.providers');

      const yandex = await fetchNearbyYandex(lat, lng, radius);
      const dgis = !yandex ? await fetchNearbyDGIS(lat, lng, radius) : null;

      let schoolsCount = 0, parksCount = 0; let metroDistances: number[] = [];

      if (yandex) {
        schoolsCount = yandex.schoolsCount;
        parksCount = yandex.parksCount;
        metroDistances = yandex.metroStations.map(s => s.distance);
      } else if (dgis) {
        schoolsCount = dgis.schoolsCount;
        parksCount = dgis.parksCount;
        metroDistances = dgis.metroStations.map(s => s.distance);
      }

      // Fallback to Overpass if needed
      if (!yandex && !dgis) {
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
        schoolsCount = schools.length;
        parksCount = parks.length;
        metroDistances = metro.map((m: any) => distanceMeters(lat, lng, m.lat || m.center?.lat, m.lon || m.center?.lon));
      }

      // Scoring from counts/distances
      const schoolsNearby = Math.max(0, Math.min(10, schoolsCount >= 5 ? 10 : schoolsCount * 2));
      const parksNearby = Math.max(0, Math.min(10, parksCount >= 3 ? 10 : parksCount * 3.5));

      let metroDistanceMin: number | undefined = undefined;
      if (metroDistances.length > 0) {
        metroDistanceMin = Math.min(...metroDistances);
      }

      const result: EnrichmentResult = {
        schoolsNearby,
        parksNearby,
        metroDistanceMin,
        metrics: {
          schoolsCount,
          parksCount,
          metroStations: metroDistances.length,
        }
      };

      // Save to cache
      await prisma.listingEnrichment.upsert({
        where: { listingId: listing.id },
        create: { listingId: listing.id, data: result as any },
        update: { data: result as any, updatedAt: new Date() },
      });

      return result;
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

    // Derive simple noise/ecology proxies
    // If parks score high => ecology higher; if metro very close => noise a bit higher (lower score)
    const ecologyBase = (breakdown.parks ?? 5);
    breakdown.ecology = Math.min(10, ecologyBase + 1);

    if (typeof enriched.metroDistanceMin === 'number') {
      const nearMetroPenalty = enriched.metroDistanceMin < 200 ? 2 : enriched.metroDistanceMin < 500 ? 1 : 0;
      const noiseScore = Math.max(0, 10 - nearMetroPenalty - 0.5);
      breakdown.noise = noiseScore;
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