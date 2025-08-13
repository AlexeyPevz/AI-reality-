import { prisma } from '@real-estate-bot/database';
import type { Preferences } from '@real-estate-bot/shared';
import { 
  QueryDTO, 
  Listing, 
  MatchResult, 
  MatchBreakdown,
  calculateWeightedScore,
  calculateTransportScore,
  calculatePriceScore,
} from '@real-estate-bot/shared';
import { ProviderFactory } from '@real-estate-bot/providers';
import { llmService } from './llm.service';

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
      rooms: preferences.rooms && preferences.rooms.length > 0 ? preferences.rooms : undefined,
      areaMin: preferences.areaMin || undefined,
      areaMax: preferences.areaMax || undefined,
      newBuilding: preferences.newBuilding || undefined,
      parking: preferences.parkingRequired || undefined,
      schoolsImportance: (preferences.weights as any)?.schools || undefined,
      parksImportance: (preferences.weights as any)?.parks || undefined,
      noiseTolerance: (preferences.weights as any)?.noise || undefined,
      propertyType: (preferences as any).propertyType || undefined,
      // rent-specific
      rentDepositMax: (preferences as any).rentDeposit || undefined,
      rentPeriod: (preferences as any).rentPeriod || undefined,
      furnished: (preferences as any).furnished || undefined,
      petsAllowed: (preferences as any).petsAllowed || undefined,
      utilitiesIncluded: (preferences as any).utilitiesIncluded || undefined,
    },
    weights: preferences.weights as any,
    dealType: (preferences as any).dealType || 'sale',
  };

  // Get provider and search
  const provider = ProviderFactory.getDefault();
  const listings = await provider.searchListings(query);

  // Enrich and cache listings
  const cachedListings = await cacheListings(listings, provider.name);
  // set dealType/propertyType if not present
  cachedListings.forEach(l => {
    if (!(l as any).dealType) (l as any).dealType = (preferences as any).dealType || 'sale';
    if (!(l as any).propertyType) (l as any).propertyType = (preferences as any).propertyType === 'any' ? undefined : (preferences as any).propertyType;
    // align image field for Mini App
    (l as any).images = (l as any).photos || [];
  });

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
      score: matchScore,
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
    const dbListing = await prisma.listing.upsert({
      where: {
        provider_externalId: {
          provider,
          externalId: listing.id,
        },
      },
      create: {
        provider,
        externalId: listing.id,
        title: listing.title,
        price: listing.price,
        address: listing.address,
        district: undefined,
        metro: undefined,
        metroDistance: undefined,
        rooms: listing.rooms,
        area: listing.area,
        floor: listing.floor || 0,
        floors: listing.totalFloors || 0,
        description: listing.description || '',
        images: listing.photos || [],
        url: listing.partnerDeeplinkTemplate || '',
        source: provider,
        coordinates: { lat: listing.lat, lng: listing.lng } as any,
        features: [],
        partnerData: undefined,
        publishedAt: new Date(),
      },
      update: {
        title: listing.title,
        price: listing.price,
        address: listing.address,
        rooms: listing.rooms,
        area: listing.area,
        floor: listing.floor || 0,
        floors: listing.totalFloors || 0,
        description: listing.description || '',
        images: listing.photos || [],
        url: listing.partnerDeeplinkTemplate || '',
        coordinates: { lat: listing.lat, lng: listing.lng } as any,
        updatedAt: new Date(),
      },
    });

    cached.push({
      ...listing,
      id: dbListing.id,
    });
  }

  return cached;
}

function calculateBreakdown(listing: Listing, preferences: Preferences): MatchBreakdown {
  const breakdown: MatchBreakdown = {};
  const weights = preferences.weights as any;

  // Price score
  if (weights?.price) {
    breakdown.price = calculatePriceScore(
      listing.price,
      preferences.budgetMin || undefined,
      preferences.budgetMax || undefined
    );
  }

  // Transport score
  if (weights?.transport && preferences.commutePoints.length > 0) {
    breakdown.transport = calculateTransportScore(
      listing.lat,
      listing.lng,
      preferences.commutePoints as any[],
      preferences.transportMode as any
    );
  }

  // Parking score
  if (weights?.parking) {
    breakdown.parking = listing.hasParking ? 10 : 
                       preferences.parkingRequired ? 0 : 5;
  }

  // Enrichment-based factors (schools, parks, metro) — mocked in bot
  if (weights?.schools) breakdown.schools = 5 + Math.random() * 5;
  if (weights?.parks) breakdown.parks = 5 + Math.random() * 5;
  if (weights?.metro) breakdown.metro = 5 + Math.random() * 5;

  // Still mock noise/ecology until implemented
  if (weights?.noise) {
    breakdown.noise = 5 + Math.random() * 5;
  }
  if (weights?.ecology) {
    breakdown.ecology = 5 + Math.random() * 5;
  }

  // Investment factors
  if (weights?.liquidity) {
    breakdown.liquidity = listing.isNewBuilding ? 8 : 6; // Simple heuristic
  }

  if (weights?.constructionStage && listing.stage) {
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

  if (weights?.infrastructure) {
    breakdown.infrastructure = 5 + Math.random() * 5; // Mock
  }

  return breakdown;
}

async function generateExplanation(
  listing: Listing,
  breakdown: MatchBreakdown,
  preferences: Preferences
): Promise<string> {
  try {
    // Try to use LLM for natural explanation
    const explanation = await llmService.explainMatch(
      listing,
      preferences,
      breakdown,
      calculateWeightedScore(preferences.weights as any, breakdown)
    );
    return explanation;
  } catch (error) {
    console.error('LLM explanation error, falling back to rule-based:', error);
    
    // Fallback to rule-based explanation
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
}

function getFactorDescription(factor: string, _score: number, isPositive: boolean): string {
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