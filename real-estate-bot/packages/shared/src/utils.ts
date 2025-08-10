import { PreferenceWeights, MatchBreakdown, CommutePoint } from './types';
import { WEIGHT_MIN, WEIGHT_MAX } from './constants';

// Calculate distance between two points (Haversine formula)
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Normalize a value to 0-10 scale
export function normalizeScore(value: number, min: number, max: number, inverse = false): number {
  if (min === max) return 5;
  const normalized = (value - min) / (max - min);
  const score = inverse ? 1 - normalized : normalized;
  return Math.max(0, Math.min(10, score * 10));
}

// Calculate weighted average
export function calculateWeightedScore(
  weights: PreferenceWeights,
  breakdown: MatchBreakdown
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (weight && breakdown[key] !== undefined) {
      totalWeight += weight;
      weightedSum += weight * breakdown[key];
    }
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

// Estimate travel time (simple proxy based on distance)
export function estimateTravelTime(distance: number, mode: 'car' | 'public' | 'walk'): number {
  const speeds = {
    car: 30, // km/h average in city
    public: 25, // km/h average
    walk: 5, // km/h
  };
  return (distance / speeds[mode]) * 60; // minutes
}

// Calculate transport score based on commute points
export function calculateTransportScore(
  propertyLat: number,
  propertyLng: number,
  commutePoints: CommutePoint[],
  mode: 'car' | 'public' | 'walk' = 'public'
): number {
  if (commutePoints.length === 0) return 7; // default neutral score

  let weightedSum = 0;
  let totalImportance = 0;

  for (const point of commutePoints) {
    const distance = calculateDistance(propertyLat, propertyLng, point.lat, point.lng);
    const travelTime = estimateTravelTime(distance, mode);
    
    // Score based on travel time (10 = <15min, 0 = >90min)
    const score = normalizeScore(travelTime, 15, 90, true);
    
    weightedSum += score * point.timeImportance;
    totalImportance += point.timeImportance;
  }

  return totalImportance > 0 ? weightedSum / totalImportance : 7;
}

// Calculate price fitness score
export function calculatePriceScore(
  price: number,
  budgetMin?: number,
  budgetMax?: number
): number {
  if (!budgetMin && !budgetMax) return 7; // neutral if no budget specified

  if (budgetMin && price < budgetMin) {
    // Below budget might indicate issues
    return normalizeScore(price, budgetMin * 0.7, budgetMin);
  }

  if (budgetMax && price > budgetMax) {
    // Over budget
    return normalizeScore(price, budgetMax, budgetMax * 1.3, true);
  }

  // Within budget - best score
  return 10;
}

// Format price for display
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price);
}

// Format area
export function formatArea(area: number): string {
  return `${area} м²`;
}

// Generate session ID
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Validate weights
export function validateWeights(weights: PreferenceWeights): boolean {
  for (const value of Object.values(weights)) {
    if (value !== undefined && (value < WEIGHT_MIN || value > WEIGHT_MAX)) {
      return false;
    }
  }
  return true;
}

// Create UTM params string
export function createUTMParams(params: {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}): string {
  const utmParams = new URLSearchParams();
  
  if (params.source) utmParams.append('utm_source', params.source);
  if (params.medium) utmParams.append('utm_medium', params.medium);
  if (params.campaign) utmParams.append('utm_campaign', params.campaign);
  if (params.term) utmParams.append('utm_term', params.term);
  if (params.content) utmParams.append('utm_content', params.content);
  
  return utmParams.toString();
}