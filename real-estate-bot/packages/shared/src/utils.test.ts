import { normalizeScore, calculateWeightedScore, calculatePriceScore, calculateTransportScore } from './utils';
import { PreferenceWeights, MatchBreakdown, CommutePoint } from './types';

describe('shared/utils', () => {
  test('normalizeScore basic and inverse', () => {
    expect(normalizeScore(5, 0, 10)).toBeCloseTo(5);
    expect(normalizeScore(10, 0, 10)).toBeCloseTo(10);
    expect(normalizeScore(0, 0, 10, true)).toBeCloseTo(10);
  });

  test('calculateWeightedScore averages only present factors', () => {
    const weights: PreferenceWeights = { price: 5, transport: 5 };
    const breakdown: MatchBreakdown = { price: 10, transport: 0 };
    expect(calculateWeightedScore(weights, breakdown)).toBeCloseTo(5);
  });

  test('calculatePriceScore respects budget', () => {
    expect(calculatePriceScore(9000000, 5000000, 10000000)).toBe(10);
    expect(calculatePriceScore(12000000, 5000000, 10000000)).toBeLessThan(10);
  });

  test('calculateTransportScore improves when closer', () => {
    const points: CommutePoint[] = [
      { name: 'Work', lat: 55.75, lng: 37.61, timeImportance: 10 },
    ];
    const far = calculateTransportScore(55.55, 37.2, points, 'public');
    const near = calculateTransportScore(55.76, 37.62, points, 'public');
    expect(near).toBeGreaterThan(far);
  });
});