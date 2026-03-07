/**
 * Unit tests for the financial engine.
 *
 * Run with: npm test
 * Uses Node.js built-in test runner (node:test) via ts-node.
 *
 * Tests cover:
 *   - Tax calculations (income tax, CGT)
 *   - GIA drawdown with proportional CGT
 *   - Projection engine (income, spending, asset depletion)
 *   - PCLS model
 *   - Joint GIA CGT splitting
 *   - Edge cases
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calcIncomeTax, calcCGT, drawFromGIA, isHigherRateTaxpayer } from '../src/financialEngine/taxCalculations';
import {
  calculateProjections, getStageTotalSpending, getAssetDepletionAge,
  getSustainableRlssLevel, formatCurrency,
} from '../src/financialEngine/projectionEngine';
import { createDefaultState, createMockDemoState, buildDefaultCategories } from '../src/lib/mockData';
import type { PlannerState } from '../src/models/types';
import { INCOME_TAX, CGT } from '../src/config/financialConstants';

// ─── Tax calculations ──────────────────────────────────────────────────────────

describe('calcIncomeTax', () => {
  it('returns 0 for income at or below personal allowance', () => {
    assert.equal(calcIncomeTax(0), 0);
    assert.equal(calcIncomeTax(INCOME_TAX.PERSONAL_ALLOWANCE), 0);
    assert.equal(calcIncomeTax(12_000), 0);
  });

  it('taxes basic-rate income at 20%', () => {
    // £20,000 income: £20,000 - £12,570 = £7,430 taxable at 20% = £1,486
    const tax = calcIncomeTax(20_000);
    assert.ok(Math.abs(tax - 1486) < 1, `Expected ~£1,486 got £${tax}`);
  });

  it('applies higher rate above basic-rate limit', () => {
    const basicBand  = (INCOME_TAX.BASIC_RATE_LIMIT - INCOME_TAX.PERSONAL_ALLOWANCE) * INCOME_TAX.BASIC_RATE;
    const higherBand = (60_000 - INCOME_TAX.BASIC_RATE_LIMIT) * INCOME_TAX.HIGHER_RATE;
    const expected   = basicBand + higherBand;
    assert.ok(Math.abs(calcIncomeTax(60_000) - expected) < 1);
  });

  it('never returns negative tax', () => {
    assert.equal(calcIncomeTax(-5_000), 0);
  });
});

describe('isHigherRateTaxpayer', () => {
  it('returns false for basic-rate incomes', () => {
    assert.equal(isHigherRateTaxpayer(30_000), false);
    assert.equal(isHigherRateTaxpayer(INCOME_TAX.BASIC_RATE_LIMIT), false);
  });

  it('returns true for higher-rate incomes', () => {
    assert.equal(isHigherRateTaxpayer(60_000), true);
    assert.equal(isHigherRateTaxpayer(INCOME_TAX.BASIC_RATE_LIMIT + 1), true);
  });
});

describe('calcCGT', () => {
  it('returns 0 for gains at or below annual exempt amount', () => {
    assert.equal(calcCGT(0, false), 0);
    assert.equal(calcCGT(CGT.ANNUAL_EXEMPT, false), 0);
    assert.equal(calcCGT(2_000, true), 0);
  });

  it('applies basic rate for non-higher-rate taxpayers', () => {
    const gain        = 10_000;
    const taxableGain = gain - CGT.ANNUAL_EXEMPT;
    assert.ok(Math.abs(calcCGT(gain, false) - taxableGain * CGT.BASIC_RATE) < 1);
  });

  it('applies higher rate for higher-rate taxpayers', () => {
    const gain        = 10_000;
    const taxableGain = gain - CGT.ANNUAL_EXEMPT;
    assert.ok(Math.abs(calcCGT(gain, true) - taxableGain * CGT.HIGHER_RATE) < 1);
  });

  it('never returns negative CGT', () => {
    assert.equal(calcCGT(-5_000, false), 0);
  });
});

// ─── GIA drawdown ─────────────────────────────────────────────────────────────

describe('drawFromGIA', () => {
  it('draws the correct amount and reduces value', () => {
    const r = drawFromGIA(10_000, 6_000, 2_000);
    assert.equal(r.drawn, 2_000);
    assert.equal(r.newValue, 8_000);
  });

  it('calculates proportional capital gain correctly', () => {
    // Value=£10k, base=£6k, gain fraction=40%; draw £2k → gain £800
    const r = drawFromGIA(10_000, 6_000, 2_000);
    assert.ok(Math.abs(r.capitalGain - 800) < 1);
  });

  it('reduces base cost proportionally', () => {
    // Proportion drawn=20%; new base cost=£6k × 80%=£4,800
    const r = drawFromGIA(10_000, 6_000, 2_000);
    assert.ok(Math.abs(r.newBaseCost - 4_800) < 1);
  });

  it('caps drawdown at available value', () => {
    const r = drawFromGIA(5_000, 3_000, 10_000);
    assert.equal(r.drawn, 5_000);
    assert.equal(r.newValue, 0);
  });

  it('returns zero capital gain when value equals base cost', () => {
    const r = drawFromGIA(5_000, 5_000, 2_000);
    assert.equal(r.capitalGain, 0);
  });

  it('handles zero value gracefully', () => {
    const r = drawFromGIA(0, 0, 1_000);
    assert.equal(r.drawn, 0);
    assert.equal(r.capitalGain, 0);
  });
});

// ─── Projection engine ────────────────────────────────────────────────────────

describe('calculateProjections', () => {
  it('produces a row for every year from current age to life expectancy', () => {
    const state       = createDefaultState(57);
    const projections = calculateProjections(state);
    assert.equal(projections.length, 95 - 57 + 1);
  });

  it('starts at current age', () => {
    const state = createDefaultState(60);
    assert.equal(calculateProjections(state)[0].p1Age, 60);
  });

  it('ends at life expectancy', () => {
    const state       = createDefaultState(57);
    const projections = calculateProjections(state);
    assert.equal(projections[projections.length - 1].p1Age, 95);
  });

  it('spending is inflation-adjusted over time', () => {
    const state       = createDefaultState(57);
    const projections = calculateProjections(state);
    assert.ok(projections[10].spending > projections[0].spending);
  });

  it('total income is never negative', () => {
    const projections = calculateProjections(createMockDemoState());
    projections.forEach(p => assert.ok(p.totalIncome >= 0));
  });

  it('total tax is never negative', () => {
    const projections = calculateProjections(createMockDemoState());
    projections.forEach(p => assert.ok(p.totalTaxPaid >= 0));
  });

  it('net income equals total income minus total tax', () => {
    const projections = calculateProjections(createMockDemoState());
    projections.forEach(p => {
      assert.ok(Math.abs(p.netIncome - (p.totalIncome - p.totalTaxPaid)) < 0.01);
    });
  });

  it('returns null p2Age for single mode', () => {
    const state = createDefaultState(57);
    assert.equal(state.mode, 'single');
    assert.equal(calculateProjections(state)[0].p2Age, null);
  });

  it('returns correct p2Age for couple mode', () => {
    const state = createMockDemoState();
    assert.equal(state.mode, 'couple');
    assert.equal(calculateProjections(state)[0].p2Age, 55);
  });
});

// ─── PCLS model ───────────────────────────────────────────────────────────────

describe('PCLS', () => {
  it('reduces DC balance in crystallisation year', () => {
    const base = createDefaultState(64);
    const state: PlannerState = {
      ...base,
      person1: {
        ...base.person1,
        incomeSources: {
          ...base.person1.incomeSources,
          statePension: { enabled: false, weeklyAmount: 0, startAge: 67 },
          dcPension: { enabled: true, totalValue: 100_000, drawdownAge: 65, growthRate: 0 },
        },
      },
    };
    const projections = calculateProjections(state);
    const yearAtCrystallisation = projections.find(p => p.p1Age === 65);
    assert.ok(yearAtCrystallisation !== undefined);
    // Balance should be below starting value after PCLS
    assert.ok((yearAtCrystallisation?.p1DcBalance ?? 100_000) < 100_000);
  });
});

// ─── Joint GIA ────────────────────────────────────────────────────────────────

describe('Joint GIA', () => {
  it('joint ownership produces equal or lower CGT than single-owner', () => {
    const base = createDefaultState(60);
    const sharedAssets = {
      ...base.person1.assets,
      isaInvestments:     { enabled: false, totalValue: 0, growthRate: 4 },
      generalInvestments: { enabled: true, totalValue: 50_000, baseCost: 20_000, growthRate: 0, owner: 'joint' as const },
    };

    const stateJoint: PlannerState = {
      ...base,
      mode: 'couple',
      person1: { ...base.person1, assets: sharedAssets },
    };
    const stateP1: PlannerState = {
      ...stateJoint,
      person1: { ...stateJoint.person1, assets: { ...sharedAssets, generalInvestments: { ...sharedAssets.generalInvestments, owner: 'p1' as const } } },
    };

    const cgtJoint = calculateProjections(stateJoint).reduce((s, p) => s + p.totalCgtPaid, 0);
    const cgtP1    = calculateProjections(stateP1).reduce((s, p) => s + p.totalCgtPaid, 0);
    assert.ok(cgtJoint <= cgtP1, `Joint CGT £${cgtJoint} should be <= P1-only CGT £${cgtP1}`);
  });
});

// ─── getStageTotalSpending ────────────────────────────────────────────────────

describe('getStageTotalSpending', () => {
  it('returns the sum of all category amounts for the given stage', () => {
    const state    = createDefaultState(57);
    const total    = getStageTotalSpending(state, 'active');
    const expected = state.spendingCategories.reduce((s, c) => s + (c.amounts['active'] ?? 0), 0);
    assert.equal(total, expected);
  });

  it('returns 0 for an unknown stage', () => {
    assert.equal(getStageTotalSpending(createDefaultState(57), 'nonexistent'), 0);
  });
});

// ─── getAssetDepletionAge ─────────────────────────────────────────────────────

describe('getAssetDepletionAge', () => {
  it('returns an age when plan runs out of assets', () => {
    const base = createDefaultState(57);
    const state: PlannerState = {
      ...base,
      person1: {
        ...base.person1,
        assets: {
          cashSavings:        { enabled: true, totalValue: 10_000 },
          isaInvestments:     { enabled: false, totalValue: 0, growthRate: 4 },
          generalInvestments: { enabled: false, totalValue: 0, baseCost: 0, growthRate: 4, owner: 'p1' },
          property:           { enabled: false, propertyValue: 0, baseCost: 0, annualRent: 0, durationYears: 0, owner: 'p1' },
        },
        incomeSources: {
          ...base.person1.incomeSources,
          statePension: { enabled: false, weeklyAmount: 0, startAge: 67 },
          dcPension:    { enabled: false, totalValue: 0, drawdownAge: 65, growthRate: 4 },
        },
      },
    };
    const result = getAssetDepletionAge(calculateProjections(state));
    assert.ok(result !== null);
    if (result !== null) assert.ok(result >= 57);
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats with £ and comma separator', () => {
    assert.equal(formatCurrency(1_234_567), '£1,234,567');
  });

  it('formats compact (k) when value >= 1000 and compact=true', () => {
    assert.equal(formatCurrency(44_300, true), '£44.3k');
    assert.equal(formatCurrency(1_500, true),  '£1.5k');
  });

  it('does not use compact form for values < 1000', () => {
    assert.equal(formatCurrency(500, true), '£500');
  });

  it('rounds to nearest integer in non-compact mode', () => {
    assert.equal(formatCurrency(1_234.7), '£1,235');
  });
});
