import { describe, expect, test } from 'vitest';
import {
  clampDateOfBirth,
  clampFiAge,
  getFiAgeMax,
  getLifeExpectancyMin,
  getMaxSupportedDob,
  getMinSupportedDob,
  getRangeProgress,
  MAX_PLANNING_HORIZON,
  MIN_SUPPORTED_CURRENT_AGE,
  MAX_SUPPORTED_CURRENT_AGE,
  normalizePlanningBounds,
} from '@/lib/planningBounds';

describe('planningBounds', () => {
  test('life expectancy minimum keeps room for three primary life stages', () => {
    expect(getLifeExpectancyMin(MAX_SUPPORTED_CURRENT_AGE)).toBe(MAX_PLANNING_HORIZON);
  });

  test('life expectancy minimum respects the older household member', () => {
    expect(getLifeExpectancyMin(60, 92)).toBe(92);
  });

  test('FI age maximum leaves room for slo-go and no-go stages', () => {
    expect(getFiAgeMax(95)).toBe(93);
    expect(clampFiAge(94, 60, 95)).toBe(93);
  });

  test('DOB is clamped to the supported range', () => {
    expect(clampDateOfBirth('1900-01-01')).toBe(getMinSupportedDob());
    expect(clampDateOfBirth('2999-01-01')).toBe(getMaxSupportedDob());
    expect(clampDateOfBirth('not-a-date')).toBe('');
  });

  test('slider progress stays finite when the range is locked to a single value', () => {
    expect(getRangeProgress(105, 105, 105)).toBe(100);
  });

  test('normalizePlanningBounds clamps age, FI age, and planning horizon together', () => {
    expect(normalizePlanningBounds(120, 55, 120, 95)).toEqual({
      currentAge: MAX_SUPPORTED_CURRENT_AGE,
      secondaryCurrentAge: 55,
      fiAge: MAX_SUPPORTED_CURRENT_AGE,
      lifeExpectancy: MAX_PLANNING_HORIZON,
    });
  });

  test('normalizePlanningBounds raises underage users to the adult minimum', () => {
    expect(normalizePlanningBounds(12, 16, 14, 95)).toEqual({
      currentAge: MIN_SUPPORTED_CURRENT_AGE,
      secondaryCurrentAge: MIN_SUPPORTED_CURRENT_AGE,
      fiAge: MIN_SUPPORTED_CURRENT_AGE,
      lifeExpectancy: 95,
    });
  });
});
