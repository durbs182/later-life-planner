import { describe, test, expect } from 'vitest';
import { calculateProjections } from '@/financialEngine/projectionEngine';
import { optimizeWithdrawals } from '@/financialEngine/withdrawalOptimizer';
import { maxUfplsWithinHeadroom } from '@/financialEngine/taxCalculations';
import {
  allocateLumpSums,
  resolveCrystallisationAge,
  resolvePclsAges,
} from '@/financialEngine/pclsCrystallisation';
import { bareState, bareCoupleState } from '../fixtures/states';
import { withFullLumpSum, withSpending } from '../fixtures/helpers';
import type { PlannerState } from '@/models/types';

const LSA = 268_275;
const PA = 12_570;
const ISA = 20_000;

function singleState(dcValue: number, spending = 30_000): PlannerState {
  const base = bareState(60);
  return withSpending({
    ...base,
    fiAge: 60,
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

function coupleState(
  p1Dc: number,
  p2Dc: number,
  { p1Age = 60, p2Age = 60, spending = 40_000, p2FiAge }: {
    p1Age?: number; p2Age?: number; spending?: number; p2FiAge?: number;
  } = {},
): PlannerState {
  const base = bareCoupleState(p1Age, p2Age);
  return withSpending({
    ...base,
    fiAge: p1Age,
    p2FiAge,
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
  test('null for anyone who has not opted in', () => {
    expect(resolvePclsAges(coupleState(400_000, 200_000))).toEqual({ p1: null, p2: null });
  });

  test('single mode never resolves a person 2 age', () => {
    const state = withFullLumpSum(singleState(400_000), { p1: true, p2: true });
    expect(resolvePclsAges(state)).toEqual({ p1: 60, p2: null });
  });

  test('null when the person has no DC pension', () => {
    const base = withFullLumpSum(singleState(400_000), { p1: true });
    const dcPension = { ...base.person1.incomeSources.dcPension, enabled: false };
    const state = { ...base, person1: { ...base.person1, incomeSources: { ...base.person1.incomeSources, dcPension } } };
    expect(resolvePclsAges(state).p1).toBeNull();
  });

  test('each person defaults to their own FI age', () => {
    const state = withFullLumpSum(
      coupleState(400_000, 200_000, { p1Age: 60, p2Age: 58, p2FiAge: 63 }),
      { p1: true, p2: true },
    );
    expect(resolvePclsAges(state)).toEqual({ p1: 60, p2: 63 });
  });

  test('each person can set their own age', () => {
    const state = withFullLumpSum(coupleState(400_000, 200_000), { p1: { age: 62 }, p2: { age: 66 } });
    expect(resolvePclsAges(state)).toEqual({ p1: 62, p2: 66 });
  });

  test('a person below minimum pension age is deferred', () => {
    const state = withFullLumpSum(coupleState(400_000, 200_000, { p1Age: 60, p2Age: 52 }), { p2: { age: 52 } });
    expect(resolvePclsAges(state)).toEqual({ p1: null, p2: 57 });
  });
});

describe('allocateLumpSums', () => {
  test('each lump sum fills its own ISA before the partner\'s', () => {
    // Both large: each fills own £20k; nothing spare to share.
    expect(allocateLumpSums(100_000, 50_000, ISA, ISA)).toEqual({ p1Isa: ISA, p2Isa: ISA, gia: 110_000 });
  });

  test('excess uses the partner\'s spare allowance', () => {
    // p2 lump sum is small, so p1's excess takes the rest of p2's allowance.
    expect(allocateLumpSums(100_000, 5_000, ISA, ISA)).toEqual({ p1Isa: ISA, p2Isa: ISA, gia: 65_000 });
  });

  test('single mode passes zero partner capacity', () => {
    expect(allocateLumpSums(100_000, 0, ISA, 0)).toEqual({ p1Isa: ISA, p2Isa: 0, gia: 80_000 });
  });

  test('respects allowance already used this year', () => {
    expect(allocateLumpSums(30_000, 0, 5_000, 0)).toEqual({ p1Isa: 5_000, p2Isa: 0, gia: 25_000 });
  });
});

describe('calculateProjections — full lump sum (single)', () => {
  test.each([
    ['below the LSA cap', 400_000],
    ['above the LSA cap', 1_200_000],
  ])('pot %s: every later DC draw is fully taxable', (_label, dcValue) => {
    const projections = calculateProjections(withFullLumpSum(singleState(dcValue), { p1: true }));
    const eventIdx = projections.findIndex(p => p.p1PclsEvent > 0);
    expect(eventIdx).toBe(0);

    const dcRows = projections.slice(eventIdx).filter(p => p.p1DcDrawdown > 0);
    expect(dcRows.length).toBeGreaterThan(0);
    dcRows.forEach(p => expect(p.dcTaxFreeDrawdown).toBe(0));
  });

  test('DC draw sized to the personal allowance does not overshoot it', () => {
    const projections = calculateProjections(withFullLumpSum(singleState(400_000), { p1: true }));
    // Before the fix the waterfall drew PA / 0.75 = £16,760, putting £4,190 above the allowance.
    expect(projections[0].p1DcDrawdown).toBeLessThanOrEqual(PA + 1);
  });

  test('without the lump sum each draw keeps its 25% tax-free portion', () => {
    const first = calculateProjections(singleState(400_000))[0];
    expect(first.p1PclsEvent).toBe(0);
    expect(first.dcTaxFreeDrawdown).toBeCloseTo(first.p1DcDrawdown * 0.25, 0);
  });
});

describe('calculateProjections — full lump sum is independent per person', () => {
  test('only the person who opts in takes a lump sum', () => {
    const projections = calculateProjections(withFullLumpSum(coupleState(400_000, 200_000), { p2: true }));
    expect(projections.every(p => p.p1PclsEvent === 0)).toBe(true);
    expect(projections.filter(p => p.p2PclsEvent > 0)).toHaveLength(1);
    expect(projections[0].p2PclsEvent).toBeCloseTo(50_000, -2);
  });

  test('the partner who did not opt in still gets 25% tax-free on their draws', () => {
    // Only p2 opts in; spending high enough that both draw DC.
    const projections = calculateProjections(
      withFullLumpSum(coupleState(400_000, 200_000, { spending: 60_000 }), { p2: true }),
    );
    const bothDraw = projections.filter(p => p.p1DcDrawdown > 0 && p.p2DcDrawdown > 0);
    expect(bothDraw.length).toBeGreaterThan(0);
    // dcTaxFreeDrawdown is household-wide; all of it must come from p1's 25%.
    bothDraw.forEach(p => expect(p.dcTaxFreeDrawdown).toBeCloseTo(p.p1DcDrawdown * 0.25, 0));
  });

  test('each person takes it at their own age', () => {
    const projections = calculateProjections(
      withFullLumpSum(coupleState(400_000, 200_000), { p1: { age: 62 }, p2: { age: 66 } }),
    );
    const p1Event = projections.filter(p => p.p1PclsEvent > 0);
    const p2Event = projections.filter(p => p.p2PclsEvent > 0);
    expect(p1Event.map(p => p.p1Age)).toEqual([62]);
    expect(p2Event.map(p => p.p2Age)).toEqual([66]);
  });

  test('after both lump sums, neither partner gets tax-free DC', () => {
    const projections = calculateProjections(
      withFullLumpSum(coupleState(400_000, 200_000), { p1: true, p2: true }),
    );
    const dcRows = projections.filter(p => p.p1DcDrawdown > 0 || p.p2DcDrawdown > 0);
    expect(dcRows.length).toBeGreaterThan(0);
    dcRows.forEach(p => expect(p.dcTaxFreeDrawdown).toBe(0));
  });

  test('same-year lump sums each fill their own ISA, remainder to joint GIA', () => {
    // p1 £100k + p2 £50k = £150k. £20k into each ISA, £110k into the joint GIA.
    const state = withSpending(withFullLumpSum(coupleState(400_000, 200_000), { p1: true, p2: true }), 0);
    const eventRow = calculateProjections(state)[0];
    expect(eventRow.p1IsaBalance).toBeCloseTo(ISA, -2);
    expect(eventRow.p2IsaBalance).toBeCloseTo(ISA, -2);
    expect(eventRow.jointGiaValue).toBeCloseTo(110_000, -2);
    expect(eventRow.jointGiaBaseCost).toBeCloseTo(eventRow.jointGiaValue, -2);
  });
});

describe('optimizeWithdrawals — full lump sum', () => {
  test('single: no tax-free DC after an at-FI lump sum from a pot below the LSA cap', () => {
    const result = optimizeWithdrawals(withFullLumpSum(singleState(400_000), { p1: true }));
    const dcYears = result.yearRecords.filter(r => r.winner.drawdowns.p1Dc > 0);
    expect(dcYears.length).toBeGreaterThan(0);
    dcYears.forEach(r => expect(r.winner.drawdowns.p1DcTaxFree).toBe(0));
  });

  test('couple: only the partner who opted in loses tax-free DC', () => {
    const result = optimizeWithdrawals(
      withFullLumpSum(coupleState(400_000, 200_000, { spending: 60_000 }), { p2: true }),
    );
    const p1Years = result.yearRecords.filter(r => r.winner.drawdowns.p1Dc > 0);
    const p2Years = result.yearRecords.filter(r => r.winner.drawdowns.p2Dc > 0);
    expect(p1Years.length).toBeGreaterThan(0);
    expect(p2Years.length).toBeGreaterThan(0);
    p1Years.forEach(r => expect(r.winner.drawdowns.p1DcTaxFree).toBeGreaterThan(0));
    p2Years.forEach(r => expect(r.winner.drawdowns.p2DcTaxFree).toBe(0));
  });

  test('couple: a pre-FI lump sum for person 2 seeds their LSA as used', () => {
    // p2 takes it at 57, while p1 is 56 — before p1's FI age of 60.
    const state = withFullLumpSum(
      coupleState(400_000, 200_000, { p1Age: 55, p2Age: 56, spending: 60_000, p2FiAge: 61 }),
      { p2: { age: 57 } },
    );
    const result = optimizeWithdrawals({ ...state, fiAge: 60 });
    const p2DcYears = result.yearRecords.filter(r => r.winner.drawdowns.p2Dc > 0);
    expect(p2DcYears.length).toBeGreaterThan(0);
    p2DcYears.forEach(r => expect(r.winner.drawdowns.p2DcTaxFree).toBe(0));
  });
});
