import { ListingsProvider, QueryDTO, Listing } from '@real-estate-bot/shared';

export class AggregatingProvider implements ListingsProvider {
  name = 'aggregator';
  supportsFilters: string[] = ['rooms', 'price', 'area', 'newBuilding', 'parking', 'propertyType'];
  linkTemplate?: string | undefined;

  constructor(private providers: ListingsProvider[]) {}

  async searchListings(query: QueryDTO): Promise<Listing[]> {
    const results = await Promise.allSettled(this.providers.map(p => p.searchListings(query)));
    const all: Listing[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
    return deduplicateListings(all);
  }

  async getListing(id: string): Promise<Listing | null> {
    for (const p of this.providers) {
      try {
        const l = await p.getListing(id);
        if (l) return l;
      } catch {}
    }
    return null;
  }
}

function deduplicateListings(listings: Listing[]): Listing[] {
  const map = new Map<string, Listing>();
  for (const l of listings) {
    const key = makeKey(l);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, l);
    } else {
      // Prefer listing with more photos/description and lower price
      const better = scoreListing(l) > scoreListing(existing) ? l : existing;
      map.set(key, better);
    }
  }
  return Array.from(map.values());
}

function makeKey(l: Listing): string {
  const addr = (l.address || '').toLowerCase().replace(/\s+/g, ' ');
  const title = (l.title || '').toLowerCase().replace(/\s+/g, ' ');
  const rooms = l.rooms || 0;
  const area = Math.round(l.area || 0);
  return `${addr}|${title}|${rooms}|${area}`;
}

function scoreListing(l: Listing): number {
  const photosScore = (l.photos?.length || 0) * 0.5;
  const descScore = (l.description ? 1 : 0) * 1.5;
  const priceScore = l.price ? 100000000 / l.price : 0;
  return photosScore + descScore + priceScore;
}