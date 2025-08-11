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
  const buckets = new Map<string, Listing[]>();
  for (const l of listings) {
    const key = makeGeoKey(l);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(l);
  }
  const deduped: Listing[] = [];
  for (const group of buckets.values()) {
    const byAddr = new Map<string, Listing>();
    for (const l of group) {
      const k = makeAddressKey(l);
      const ex = byAddr.get(k);
      if (!ex) byAddr.set(k, l);
      else byAddr.set(k, chooseBetter(l, ex));
    }
    deduped.push(...byAddr.values());
  }
  return deduped;
}

function makeGeoKey(l: Listing): string {
  const lat = Math.round((l.lat || 0) * 200) / 200; // ~500m bucket
  const lng = Math.round((l.lng || 0) * 200) / 200;
  return `${lat},${lng}`;
}

function makeAddressKey(l: Listing): string {
  const addr = (l.address || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
  const title = (l.title || '').toLowerCase().replace(/\s+/g, ' ');
  const rooms = l.rooms || 0;
  const area = Math.round(l.area || 0);
  return `${addr}|${title}|${rooms}|${area}`;
}

function chooseBetter(a: Listing, b: Listing): Listing {
  return scoreListing(a) > scoreListing(b) ? a : b;
}

function scoreListing(l: Listing): number {
  const photosScore = (l.photos?.length || 0) * 0.5;
  const descScore = (l.description ? 1 : 0) * 1.2;
  const priceScore = l.price ? 100000000 / l.price : 0;
  return photosScore + descScore + priceScore;
}