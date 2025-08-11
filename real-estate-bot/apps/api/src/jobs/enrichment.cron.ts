import { prisma } from '@real-estate-bot/database';
import { enrichmentService } from '../services/enrichment.service';

export async function runEnrichmentJob(limit = 50) {
  const recent = await prisma.listing.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });

  for (const l of recent) {
    try {
      await enrichmentService.enrichListing({
        id: l.id,
        title: l.title,
        address: l.address,
        lat: (l.coordinates as any)?.lat || 0,
        lng: (l.coordinates as any)?.lng || 0,
        price: l.price,
        rooms: l.rooms,
        area: l.area,
        floor: l.floor || 0,
        totalFloors: l.floors || 0,
        photos: l.images || [],
        provider: l.provider,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      } as any);
    } catch {}
  }
}

if (require.main === module) {
  runEnrichmentJob().then(() => process.exit(0));
}