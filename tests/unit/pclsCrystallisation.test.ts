import { describe, test, expect } from 'vitest';
import { calculateProjections } from '@/financialEngine/projectionEngine';
import { optimizeWithdrawals } from '@/financialEngine/withdrawalOptimizer';
import { maxUfplsWithinHeadroom } from '@/financialEngine/taxCalculations';
import { resolveCrystallisationAge, resolvePclsAges } from '@/financialEngine/pclsCrystallisation';
import { bareState, bareCoupleState } from '../fixtures/states';
import { withSpending } from '../fixtures/helpers';
import type { PlannerState } from '@/models/types';

const LSA = 268_275;
const PA = 12_570;

function singlePclsState(dcValue: number, spending = 30_000): PlannerState {
  const base = bareState(60);
  return withSpending({
    ...base,
    fiAge: 60,
    drawdownStrategy: 'pcls-bed-isa',
    assumptions: { ...base.assumptions, investmentGrowth: 0, inflation: 0, lifeExpectancy: 75 },
    person1: {
      ...base.person1,
      currentAge: 60,
      incomeSources: {
        ...base.person1.incomeSources,
        dcPension: { enabled: true, totalValue: dcValue, growthRate: 0 },
      },
    },
  }, spending);
}

function couplePclsState(
  p1Dc: number,
  p2Dc: number,
  { p1Age = 60, p2Age = 60, spending = 40_000 } = {},
): PlannerState {
  const base = bareCoupleState(p1Age, p2Age);
  return withSpending({
    ...base,
    fiAge: p1Age,
    drawdownStrategy: 'pcls-bed-isa',
    assumptions: { ...base.assumptions, investmentGrowth: 0, inflation: 0, lifeExpectancy: 75 },
    person1: {
      ...base.person1,
      incomeSources: { ...base.person1.incomeSources, dcPension: { enabled: true, totalValue: p1Dc, growthRate: 0 } },
    },
    person2: {
      ...base.person2,
      incomeSources: { ...base.person2.incomeSources, dcPension: { enabled: true, totalValue: p2Dc, growthRate: 0 } },
    },
  }, spending);
}

describe('maxUfplsWithinHeadroom', () => {
  test('grosses up by the taxable fraction while LSA remains', () => {
    expect(maxUfplsWithinHeadroom(PA, LSA, 0.25)).toBeCloseTo(PA / 0.75, 6);
  });

  test('equals the headroom once the LSA is exhausted', () => {
    expect(maxUfplsWithinHeadroom(PA, 0, 0.25)).toBe(PA);
  });

  test('adds only the remaining LSA when it is smaller than the gross-up', () => {
    expect(maxUfplsWithinHeadroom(PA, 1_000, 0.25)).toBe(PA + 1_000);
  });

  test('is zero when there is no headroom', () => {
    expect(maxUfplsWithinHeadroom(0, LSA, 0.25)).toBe(0);
  });
});

describe('resolveCrystallisationAge', () => {
  test('keeps an age that is already at or above minimum pension age', () => {
    expect(resolveCrystallisationAge(60, 60)).toBe(60);
  });

  test('defers to 57 when reaching 55 would fall in 2028 or later', () => {
    // Age 53 in 2025 → 55 in 2027 is allowed; age 52 in 2025 → 55 in 2028 is not.
    expect(resolveCrystallisationAge(53, 53)).toBe(55);
    expect(resolveCrystallisationAge(52, 52)).toBe(57);
  });
});

describe('resolvePclsAges', () => {
  test('single mode has no person 2 age', () => {
    expect(resolvePclsAges(singlePclsState(400_000))).toEqual({ p1: 60, p2: null });
  });

  test('person 2 crystallises in the same tax year as person 1', () => {
    expect(resolvePclsAges(couplePclsState(400_000, 200_000, { p1Age: 62, p2Age: 60 })))
      .toEqual({ p1: 62, p2: 60 });
  });

  test('person 2 is deferred until they reach minimum pension age', () => {
    // p1 60, p2 52 in 2025 → p2 cannot crystallise until 57 (calendar 2030).
    expect(resolvePclsAges(couplePclsState(400_000, 200_000, { p1Age: 60, p2Age: 52 })))
      .toEqual({ p1: 60, p2: 57 });
  });
});

describe('calculateProjections — pcls-bed-isa: no tax-free cash after crystallisation (single)', () => {
  test.each([
    ['below the LSA cap', 400_000],
    ['above the LSA cap', 1_200_000],
  ])('pot %s: every later DC draw is fully taxable', (_label, dcValue) => {
    const projections = calculateProjections(singlePclsState(dcValue));
    const eventIdx = projections.findIndex(p => p.p1PclsEvent > 0);
    expect(eventIdx).toBe(0);

    const dcRows = projections.slice(eventIdx).filter(p => p.p1DcDrawdown > 0);
    expect(dcRows.length).toBeGreaterThan(0);
    dcRows.forEach(p => expect(p.dcTaxFreeDrawdown).toBe(0));
  });

  test('DC draw sized to the personal allowance does not overshoot it', () => {
    const projections = calculateProjections(singlePclsState(400_000));
    // Before the fix the waterfall drew PA / 0.75 = £16,760, putting £4,190 above the allowance.
    expect(projections[0].p1DcDrawdown).toBeLessThanOrEqual(PA + 1);
  });

  test('standard-ufpls keeps the 25% tax-free portion on each draw', () => {
    const state: PlannerState = { ...singlePclsState(400_000), drawdownStrategy: 'standard-ufpls' };
    const first = calculateProjections(state)[0];
    expect(first.dcTaxFreeDrawdown).toBeCloseTo(first.p1DcDrawdown * 0.25, 0);
  });
});

describe('calculateProjections — pcls-bed-isa: couple', () => {
  test('both partners crystallise in the same year', () => {
    const projections = calculateProjections(couplePclsState(400_000, 200_000));
    const eventRow = projections[0];
    expect(eventRow.p1PclsEvent).toBeCloseTo(100_000, -2);
    expect(eventRow.p2PclsEvent).toBeCloseTo(50_000, -2);
    expect(projections.slice(1).every(p => p.p1PclsEvent === 0 && p.p2PclsEvent === 0)).toBe(true);
  });

  test('neither partner gets tax-free cash on later DC draws', () => {
    const projections = calculateProjections(couplePclsState(400_000, 200_000));
    const dcRows = projections.filter(p => p.p1DcDrawdown > 0 || p.p2DcDrawdown > 0);
    expect(dcRows.length).toBeGreaterThan(0);
    dcRows.forEach(p => expect(p.dcTaxFreeDrawdown).toBe(0));
  });

  test('ISA allowances are shared across both lump sums, remainder to joint GIA', () => {
    // p1 £100k + p2 £50k = £150k. One £20k allowance each, so £110k lands in the joint GIA.
    const eventRow = calculateProjections(withSpending(couplePclsState(400_000, 200_000), 0))[0];
    expect(eventRow.p1IsaBalance).toBeCloseTo(20_000, -2);
    expect(eventRow.p2IsaBalance).toBeCloseTo(20_000, -2);
    expect(eventRow.jointGiaValue).toBeCloseTo(110_000, -2);
    expect(eventRow.jointGiaBaseCost).toBeCloseTo(eventRow.jointGiaValue, -2);
  });

  test('a younger partner crystallises later and keeps 25% tax-free draws until then', () => {
    // p1 60, p2 52 → p2 crystallises at 57, five years after p1.
    const projections = calculateProjections(couplePclsState(400_000, 200_000, { p1Age: 60, p2Age: 52 }));
    const p2Event = projections.find(p => p.p2PclsEvent > 0)!;
    expect(p2Event.p2Age).toBe(57);
    expect(projections.filter(p => p.p2PclsEvent > 0)).toHaveLength(1);

    projections
      .filter(p => p.p2Age !== null && p.p2Age >= 57 && p.p2DcDrawdown > 0)
      .forEach(p => expect(p.dcTaxFreeDrawdown).toBe(0));
  });
});

describe('optimizeWithdrawals — pcls-bed-isa', () => {
  test('single: no tax-free DC after an at-FI crystallisation of a pot below the LSA cap', () => {
    const result = optimizeWithdrawals(singlePclsState(400_000));
    const dcYears = result.yearRecords.filter(r => r.winner.drawdowns.p1Dc > 0);
    expect(dcYears.length).toBeGreaterThan(0);
    dcYears.forEach(r => expect(r.winner.drawdowns.p1DcTaxFree).toBe(0));
  });

  test('couple: neither partner gets tax-free DC after crystallisation', () => {
    const result = optimizeWithdrawals(couplePclsState(400_000, 200_000, { spending: 60_000 }));
    const dcYears = result.yearRecords.filter(r => r.winner.drawdowns.p1Dc > 0 || r.winner.drawdowns.p2Dc > 0);
    expect(dcYears.length).toBeGreaterThan(0);
    dcYears.forEach(r => {
      expect(r.winner.drawdowns.p1DcTaxFree).toBe(0);
      expect(r.winner.drawdowns.p2DcTaxFree).toBe(0);
    });
  });

  test('couple: pre-FI crystallisation for person 2 seeds their LSA as used', () => {
    // p1 crystallises at 57 and p2 at 58 in the same tax year, both before p1's FI age of 60.
    const state: PlannerState = {
      ...couplePclsState(400_000, 200_000, { p1Age: 55, p2Age: 56, spending: 60_000 }),
      fiAge: 60,
      pclsAge: 57,
    };
    const result = optimizeWithdrawals(state);
    const p2DcYears = result.yearRecords.filter(r => r.winner.drawdowns.p2Dc > 0);
    expect(p2DcYears.length).toBeGreaterThan(0);
    p2DcYears.forEach(r => expect(r.winner.drawdowns.p2DcTaxFree).toBe(0));
  });
});
