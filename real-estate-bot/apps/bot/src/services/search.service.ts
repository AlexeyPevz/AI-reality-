import { prisma, Preferences, ListingCache } from '@real-estate-bot/database';
import { 
  QueryDTO, 
  Listing, 
  MatchResult, 
  MatchBreakdown,
  calculateWeightedScore,
  calculateTransportScore,
  calculatePriceScore,
  normalizeScore
} from '@real-estate-bot/shared';
import { ProviderFactory } from '@real-estate-bot/providers';

export async function searchAndScoreListings(preferences: Preferences): Promise<MatchResult[]> {
  // Build query from preferences
  const query: QueryDTO = {
    mode: preferences.mode as 'life' | 'invest',
    budget: {
      min: preferences.budgetMin || undefined,
      max: preferences.budgetMax || undefined,
    },
    geo: {
      city: 'Москва', // Default for MVP
      districts: preferences.locations,
      commutePoints: preferences.commutePoints as any[],
    },
    filters: {
      rooms: preferences.rooms.length > 0 ? preferences.rooms : undefined,
      areaMin: preferences.areaMin || undefined,
      areaMax: preferences.areaMax || undefined,
      newBuilding: preferences.newBuilding || undefined,
      parking: preferences.parkingRequired || undefined,
      schoolsImportance: preferences.weights.schools || undefined,
      parksImportance: preferences.weights.parks || undefined,
      noiseTolerance: preferences.weights.noise || undefined,
    },
    weights: preferences.weights as any,
  };

  // Get provider and search
  const provider = ProviderFactory.getDefault();
  const listings = await provider.searchListings(query);

  // Cache listings
  const cachedListings = await cacheListings(listings, provider.name);

  // Score each listing
  const results: MatchResult[] = [];
  
  for (const listing of cachedListings) {
    const breakdown = calculateBreakdown(listing, preferences);
    const matchScore = calculateWeightedScore(preferences.weights as any, breakdown);
    const explanation = await generateExplanation(listing, breakdown, preferences);

    results.push({
      listingId: listing.id,
      listing,
      matchScore,
      breakdown,
      explanation,
    });

    // Save recommendation
    await prisma.recommendation.create({
      data: {
        userId: preferences.userId,
        listingId: listing.id,
        matchScore,
        breakdown,
        explanation,
      },
    });
  }

  // Sort by match score descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  // Return top 10
  return results.slice(0, 10);
}

async function cacheListings(listings: Listing[], provider: string): Promise<Listing[]> {
  const cached: Listing[] = [];

  for (const listing of listings) {
    // Upsert listing cache
    const cachedListing = await prisma.listingCache.upsert({
      where: {
        provider_externalId: {
          provider,
          externalId: listing.id,
        },
      },
      create: {
        provider,
        externalId: listing.id,
        raw: listing as any,
        normalized: listing as any,
      },
      update: {
        raw: listing as any,
        normalized: listing as any,
        updatedAt: new Date(),
      },
    });

    cached.push({
      ...listing,
      id: cachedListing.id,
    });
  }

  return cached;
}

function calculateBreakdown(listing: Listing, preferences: Preferences): MatchBreakdown {
  const breakdown: MatchBreakdown = {};

  // Price score
  if (preferences.weights.price) {
    breakdown.price = calculatePriceScore(
      listing.price,
      preferences.budgetMin || undefined,
      preferences.budgetMax || undefined
    );
  }

  // Transport score
  if (preferences.weights.transport && preferences.commutePoints.length > 0) {
    breakdown.transport = calculateTransportScore(
      listing.lat,
      listing.lng,
      preferences.commutePoints as any[],
      preferences.transportMode as any
    );
  }

  // Parking score
  if (preferences.weights.parking) {
    breakdown.parking = listing.hasParking ? 10 : 
                       preferences.parkingRequired ? 0 : 5;
  }

  // Mock scores for other factors (in production, would use real data)
  if (preferences.weights.schools) {
    breakdown.schools = 5 + Math.random() * 5; // Mock
  }

  if (preferences.weights.parks) {
    breakdown.parks = 5 + Math.random() * 5; // Mock
  }

  if (preferences.weights.noise) {
    breakdown.noise = 5 + Math.random() * 5; // Mock
  }

  if (preferences.weights.ecology) {
    breakdown.ecology = 5 + Math.random() * 5; // Mock
  }

  if (preferences.weights.metro) {
    breakdown.metro = 5 + Math.random() * 5; // Mock
  }

  // Investment factors
  if (preferences.weights.liquidity) {
    breakdown.liquidity = listing.isNewBuilding ? 8 : 6; // Simple heuristic
  }

  if (preferences.weights.constructionStage && listing.stage) {
    const stageScores: Record<string, number> = {
      'котлован': 3,
      'фундамент': 4,
      'каркас': 5,
      'фасад': 7,
      'отделка': 8,
      'сдан': 10,
    };
    breakdown.constructionStage = stageScores[listing.stage] || 5;
  }

  if (preferences.weights.infrastructure) {
    breakdown.infrastructure = 5 + Math.random() * 5; // Mock
  }

  return breakdown;
}

async function generateExplanation(
  listing: Listing,
  breakdown: MatchBreakdown,
  preferences: Preferences
): Promise<string> {
  // Simple rule-based explanation for MVP
  // In production, would use LLM for natural language generation
  
  const highScoreFactors: string[] = [];
  const lowScoreFactors: string[] = [];

  for (const [factor, score] of Object.entries(breakdown)) {
    if (score !== undefined && score !== null) {
      if (score >= 8) {
        highScoreFactors.push(getFactorDescription(factor, score, true));
      } else if (score <= 4) {
        lowScoreFactors.push(getFactorDescription(factor, score, false));
      }
    }
  }

  let explanation = '';

  if (highScoreFactors.length > 0) {
    explanation += `✅ Преимущества: ${highScoreFactors.join(', ')}.`;
  }

  if (lowScoreFactors.length > 0) {
    if (explanation) explanation += '\n\n';
    explanation += `⚠️ Недостатки: ${lowScoreFactors.join(', ')}.`;
  }

  if (!explanation) {
    explanation = 'Объект имеет средние показатели по всем критериям.';
  }

  return explanation;
}

function getFactorDescription(factor: string, score: number, isPositive: boolean): string {
  const descriptions: Record<string, { positive: string; negative: string }> = {
    transport: {
      positive: 'отличная транспортная доступность',
      negative: 'далеко от ключевых точек',
    },
    price: {
      positive: 'хорошая цена',
      negative: 'цена выше бюджета',
    },
    schools: {
      positive: 'рядом школы и детские сады',
      negative: 'мало образовательных учреждений',
    },
    parks: {
      positive: 'много зеленых зон',
      negative: 'мало парков поблизости',
    },
    parking: {
      positive: 'есть парковка',
      negative: 'нет парковки',
    },
    liquidity: {
      positive: 'высокая ликвидность',
      negative: 'низкая ликвидность',
    },
  };

  const desc = descriptions[factor];
  if (!desc) return factor;

  return isPositive ? desc.positive : desc.negative;
}