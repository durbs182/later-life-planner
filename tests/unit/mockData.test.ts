/**
 * Unit tests — mock data factory functions.
 * Tests createDefaultState, buildDefaultLifeStages, ageFromDOB, dobFromAge,
 * and buildCategoriesForRlss.
 */

import { describe, test, expect } from 'vitest';
import {
  createDefaultState,
  buildDefaultLifeStages,
  ageFromDOB,
  dobFromAge,
  buildCategoriesForRlss,
} from '@/lib/mockData';
import { RLSS, DEFAULT_ASSUMPTIONS } from '@/config/financialConstants';

// ─── createDefaultState ───────────────────────────────────────────────────────

describe('createDefaultState', () => {
  test('returns an object with mode single', () => {
    expect(createDefaultState(57).mode).toBe('single');
  });

  test('person1.currentAge matches the argument', () => {
    expect(createDefaultState(62).person1.currentAge).toBe(62);
  });

  test('fiAge defaults to FI_AGE constant when person is younger', () => {
    const state = createDefaultState(50);
    expect(state.fiAge).toBe(DEFAULT_ASSUMPTIONS.FI_AGE);
  });

  test('fiAge equals currentAge when person is already at or past FI_AGE', () => {
    const age = DEFAULT_ASSUMPTIONS.FI_AGE + 5;
    expect(createDefaultState(age).fiAge).toBe(age);
  });

  test('has exactly three life stages', () => {
    expect(createDefaultState(57).lifeStages).toHaveLength(3);
  });

  test('life stage IDs are go-go, slo-go, no-go', () => {
    const ids = createDefaultState(57).lifeStages.map(s => s.id);
    expect(ids).toEqual(['go-go', 'slo-go', 'no-go']);
  });

  test('has non-empty spending categories', () => {
    expect(createDefaultState(57).spendingCategories.length).toBeGreaterThan(0);
  });

  test('assumptions object has required keys', () => {
    const a = createDefaultState(57).assumptions;
    expect(typeof a.investmentGrowth).toBe('number');
    expect(typeof a.inflation).toBe('number');
    expect(typeof a.lifeExpectancy).toBe('number');
  });

  test('person1 has incomeSources and assets', () => {
    const p = createDefaultState(57).person1;
    expect(p.incomeSources).toBeDefined();
    expect(p.assets).toBeDefined();
  });

  test('jointGia is present', () => {
    expect(createDefaultState(57).jointGia).toBeDefined();
  });
});

// ─── buildDefaultLifeStages ───────────────────────────────────────────────────

describe('buildDefaultLifeStages', () => {
  test('Go-Go stage starts at fiAge', () => {
    const fiAge = 60;
    const stages = buildDefaultLifeStages(fiAge, 90);
    expect(stages[0].startAge).toBe(fiAge);
  });

  test('Go-Go end age < Slo-Go start age (no gap)', () => {
    const stages = buildDefaultLifeStages(60, 90);
    expect(stages[1].startAge).toBe(stages[0].endAge + 1);
  });

  test('Slo-Go end age < No-Go start age (no gap)', () => {
    const stages = buildDefaultLifeStages(60, 90);
    expect(stages[2].startAge).toBe(stages[1].endAge + 1);
  });

  test('No-Go stage ends at lifeExpectancy', () => {
    const le = 90;
    const stages = buildDefaultLifeStages(60, le);
    expect(stages[2].endAge).toBe(le);
  });

  test('stages have correct IDs', () => {
    const ids = buildDefaultLifeStages(65, 90).map(s => s.id);
    expect(ids).toEqual(['go-go', 'slo-go', 'no-go']);
  });

  test('stages span is consistent across different fiAges', () => {
    for (const fiAge of [55, 60, 65, 70]) {
      const stages = buildDefaultLifeStages(fiAge, 95);
      expect(stages[0].startAge).toBe(fiAge);
      expect(stages[2].endAge).toBe(95);
    }
  });
});

// ─── ageFromDOB / dobFromAge ──────────────────────────────────────────────────

describe('ageFromDOB', () => {
  test('round-trip: ageFromDOB(dobFromAge(57)) ≈ 57', () => {
    const dob = dobFromAge(57);
    const age = ageFromDOB(dob);
    // Allow ±1 because Jan 1 DOB and current date may straddle birthday
    expect(Math.abs(age - 57)).toBeLessThanOrEqual(1);
  });

  test('returns fallback for empty string', () => {
    expect(ageFromDOB('', 50)).toBe(50);
  });

  test('returns fallback for invalid DOB string', () => {
    expect(ageFromDOB('not-a-date', 45)).toBe(45);
  });

  test('returns fallback for future DOB (negative age)', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 10);
    const futureDob = futureDate.toISOString().slice(0, 10);
    // Age would be negative — clamped to fallback
    expect(ageFromDOB(futureDob, 99)).toBe(99);
  });

  test('returns 0 for a DOB set to today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const age = ageFromDOB(today);
    expect(age).toBe(0);
  });
});

describe('dobFromAge', () => {
  test('returns an ISO-format date string (YYYY-MM-DD)', () => {
    const dob = dobFromAge(40);
    expect(dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('year encoded in result is (currentYear - age)', () => {
    const currentYear = new Date().getFullYear();
    const age = 35;
    const dob = dobFromAge(age);
    const year = parseInt(dob.slice(0, 4));
    expect(year).toBe(currentYear - age);
  });
});

// ─── buildCategoriesForRlss ───────────────────────────────────────────────────

describe('buildCategoriesForRlss', () => {
  test('go-go total matches the RLSS minimum single target exactly', () => {
    const cats = buildCategoriesForRlss('minimum', 'single');
    const total = cats.reduce((s, c) => s + (c.amounts['go-go'] ?? 0), 0);
    expect(total).toBe(RLSS.single.minimum.annual);
  });

  test('go-go total matches the RLSS moderate single target exactly', () => {
    const cats = buildCategoriesForRlss('moderate', 'single');
    const total = cats.reduce((s, c) => s + (c.amounts['go-go'] ?? 0), 0);
    expect(total).toBe(RLSS.single.moderate.annual);
  });

  test('go-go total matches the RLSS comfortable couple target exactly', () => {
    const cats = buildCategoriesForRlss('comfortable', 'couple');
    const total = cats.reduce((s, c) => s + (c.amounts['go-go'] ?? 0), 0);
    expect(total).toBe(RLSS.couple.comfortable.annual);
  });

  test('returns same number of categories for all standards', () => {
    const counts = ['minimum', 'moderate', 'comfortable'].map(
      std => buildCategoriesForRlss(std as 'minimum', 'single').length,
    );
    expect(new Set(counts).size).toBe(1); // all the same
  });

  test('all amounts are non-negative', () => {
    const cats = buildCategoriesForRlss('moderate', 'couple');
    cats.forEach(c => {
      Object.values(c.amounts).forEach(v => expect(v).toBeGreaterThanOrEqual(0));
    });
  });

  test('couple amounts are higher than single amounts for same standard', () => {
    const singleTotal = buildCategoriesForRlss('comfortable', 'single')
      .reduce((s, c) => s + (c.amounts['go-go'] ?? 0), 0);
    const coupleTotal = buildCategoriesForRlss('comfortable', 'couple')
      .reduce((s, c) => s + (c.amounts['go-go'] ?? 0), 0);
    expect(coupleTotal).toBeGreaterThan(singleTotal);
  });
});
