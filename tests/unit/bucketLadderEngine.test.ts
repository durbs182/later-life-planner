/**
 * Unit tests — bucket ladder engine.
 * Covers resolvePotBucketSplit (holdings / quick / legacy), calculateBucketValues
 * (household aggregation incl. couples + cash savings), calculateBucketTargets,
 * blendGrowthRateForPot, calculateRebalancingActions, calculateRefillSchedule.
 */

import { describe, test, expect } from 'vitest';
import {
  resolvePotBucketSplit,
  calculateBucketValues,
  calculateBucketTargets,
  effectiveBucketGrowthRates,
  blendGrowthRateForPot,
  calculateRebalancingActions,
  calculateRefillSchedule,
  ASSET_TYPE_TO_BUCKET,
  type BucketYearSnapshot,
} from '@/financialEngine/bucketLadderEngine';
import { createDefaultBucketLadderConfig, BUCKET_LADDER } from '@/config/financialConstants';
import { createDefaultState } from '@/lib/mockData';
import type { BucketLadderConfig, PotHolding, PotAllocation } from '@/models/types';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const defaultConfig: BucketLadderConfig = {
  ...createDefaultBucketLadderConfig(),
  enabled: true,
};

function quickAllocation(c: number, b: number, pm: number, alt: number, e: number): PotAllocation {
  return {
    cashPercent: c, bondsPercent: b, preciousMetalsPercent: pm,
    alternativesPercent: alt, equitiesPercent: e,
  };
}

// ─── resolvePotBucketSplit ────────────────────────────────────────────────────

describe('resolvePotBucketSplit', () => {
  test('returns zeros for null / zero-value pots', () => {
    expect(resolvePotBucketSplit(null)).toEqual({ cash: 0, income: 0, growth: 0 });
    expect(resolvePotBucketSplit({ enabled: true, totalValue: 0 } as any))
      .toEqual({ cash: 0, income: 0, growth: 0 });
  });

  test('legacy default: pot with no holdings or allocation → 100% growth', () => {
    const pot = { enabled: true, totalValue: 100_000 } as any;
    expect(resolvePotBucketSplit(pot)).toEqual({ cash: 0, income: 0, growth: 100_000 });
  });

  test('quick-mode allocation: 10/20/5/5/60 splits correctly across buckets', () => {
    const pot = {
      enabled: true,
      totalValue: 100_000,
      allocation: quickAllocation(10, 20, 5, 5, 60),
    } as any;
    const split = resolvePotBucketSplit(pot);
    expect(split.cash).toBe(10_000);
    // income = bonds + preciousMetals + alternatives = 20 + 5 + 5 = 30
    expect(split.income).toBe(30_000);
    expect(split.growth).toBe(60_000);
  });

  test('holdings mode: 3 holdings of different asset types aggregate correctly', () => {
    const pot = {
      enabled: true,
      totalValue: 100_000,
      holdings: [
        { id: 'h1', name: 'Equity Fund',  value: 60_000, assetType: 'equities' },
        { id: 'h2', name: 'Gilt Fund',    value: 30_000, assetType: 'bonds' },
        { id: 'h3', name: 'Gold ETC',     value: 10_000, assetType: 'preciousMetals' },
      ] as PotHolding[],
    } as any;
    const split = resolvePotBucketSplit(pot);
    expect(split.cash).toBe(0);
    expect(split.income).toBe(40_000); // bonds 30k + metals 10k
    expect(split.growth).toBe(60_000);
  });

  test('mixed-fund holding splits via mixedAllocation', () => {
    const pot = {
      enabled: true,
      totalValue: 100_000,
      holdings: [
        {
          id: 'h1', name: 'LifeStrategy 60', value: 100_000, assetType: 'mixed',
          mixedAllocation: {
            cashPercent: 0, bondsPercent: 40, preciousMetalsPercent: 0,
            alternativesPercent: 0, equitiesPercent: 60,
          },
        },
      ] as PotHolding[],
    } as any;
    const split = resolvePotBucketSplit(pot);
    expect(split.cash).toBe(0);
    expect(split.income).toBe(40_000);
    expect(split.growth).toBe(60_000);
  });

  test('mixed holding without mixedAllocation falls back to growth bucket', () => {
    const pot = {
      enabled: true,
      totalValue: 50_000,
      holdings: [
        { id: 'h1', name: 'Bad mixed', value: 50_000, assetType: 'mixed' },
      ] as PotHolding[],
    } as any;
    expect(resolvePotBucketSplit(pot)).toEqual({ cash: 0, income: 0, growth: 50_000 });
  });

  test('holdings take precedence over allocation', () => {
    const pot = {
      enabled: true,
      totalValue: 100_000,
      allocation: quickAllocation(100, 0, 0, 0, 0),
      holdings: [
        { id: 'h1', name: 'Equity', value: 100_000, assetType: 'equities' },
      ] as PotHolding[],
    } as any;
    const split = resolvePotBucketSplit(pot);
    expect(split.cash).toBe(0);
    expect(split.growth).toBe(100_000);
  });

  test('zero-value and negative-value holdings are ignored', () => {
    const pot = {
      enabled: true,
      totalValue: 50_000,
      holdings: [
        { id: 'h1', name: 'Valid',    value: 50_000, assetType: 'equities' },
        { id: 'h2', name: 'Zero',     value: 0,      assetType: 'cash' },
        { id: 'h3', name: 'Negative', value: -100,   assetType: 'bonds' },
      ] as PotHolding[],
    } as any;
    expect(resolvePotBucketSplit(pot)).toEqual({ cash: 0, income: 0, growth: 50_000 });
  });
});

// ─── ASSET_TYPE_TO_BUCKET sanity ──────────────────────────────────────────────

describe('ASSET_TYPE_TO_BUCKET', () => {
  test('precious metals and alternatives are income bucket', () => {
    expect(ASSET_TYPE_TO_BUCKET.preciousMetals).toBe('income');
    expect(ASSET_TYPE_TO_BUCKET.alternatives).toBe('income');
  });
  test('cash is cash, bonds is income, equities is growth', () => {
    expect(ASSET_TYPE_TO_BUCKET.cash).toBe('cash');
    expect(ASSET_TYPE_TO_BUCKET.bonds).toBe('income');
    expect(ASSET_TYPE_TO_BUCKET.equities).toBe('growth');
  });
});

// ─── calculateBucketValues (whole household) ──────────────────────────────────

describe('calculateBucketValues', () => {
  test('empty default state → all zero', () => {
    const state = createDefaultState();
    const v = calculateBucketValues(state);
    expect(v).toEqual({ cash: 0, income: 0, growth: 0, total: 0 });
  });

  test('cash savings flow into Bucket 1', () => {
    const state = createDefaultState();
    state.person1.assets.cashSavings = { enabled: true, totalValue: 25_000 };
    const v = calculateBucketValues(state);
    expect(v.cash).toBe(25_000);
    expect(v.total).toBe(25_000);
  });

  test('couple: P2 cash + assets only counted when mode is couple', () => {
    const state = createDefaultState();
    state.person2.assets.cashSavings = { enabled: true, totalValue: 10_000 };
    state.person2.assets.isaInvestments = {
      enabled: true, totalValue: 50_000, growthRate: 5,
      allocation: quickAllocation(0, 0, 0, 0, 100),
    };
    // Mode still 'single' — P2 should be ignored
    const single = calculateBucketValues(state);
    expect(single.cash).toBe(0);
    expect(single.growth).toBe(0);

    state.mode = 'couple';
    const couple = calculateBucketValues(state);
    expect(couple.cash).toBe(10_000);
    expect(couple.growth).toBe(50_000);
  });

  test('disabled pots are ignored', () => {
    const state = createDefaultState();
    state.person1.assets.isaInvestments = {
      enabled: false, totalValue: 100_000, growthRate: 5,
      allocation: quickAllocation(0, 0, 0, 0, 100),
    };
    expect(calculateBucketValues(state).growth).toBe(0);
  });

  test('mixed allocations across SIPP + ISA + GIA + joint GIA aggregate correctly', () => {
    const state = createDefaultState();
    state.mode = 'couple';
    state.person1.incomeSources.dcPension = {
      ...state.person1.incomeSources.dcPension,
      enabled: true,
      totalValue: 200_000,
      allocation: quickAllocation(0, 30, 0, 0, 70), // 60k income, 140k growth
    };
    state.person1.assets.isaInvestments = {
      enabled: true, totalValue: 80_000, growthRate: 5,
      allocation: quickAllocation(0, 0, 100, 0, 0), // 80k income (precious metals)
    };
    state.person1.assets.generalInvestments = {
      enabled: true, totalValue: 50_000, baseCost: 40_000, growthRate: 5,
      allocation: quickAllocation(20, 0, 0, 0, 80), // 10k cash, 40k growth
    };
    state.jointGia = {
      enabled: true, totalValue: 100_000, baseCost: 80_000, growthRate: 5,
      allocation: quickAllocation(0, 0, 0, 50, 50), // 50k income (alternatives), 50k growth
    };
    state.person1.assets.cashSavings = { enabled: true, totalValue: 15_000 };

    const v = calculateBucketValues(state);
    expect(v.cash).toBe(25_000);     // 10k from GIA cashPct + 15k cash savings
    expect(v.income).toBe(190_000);  // 60k SIPP bonds + 80k ISA metals + 50k joint alt
    expect(v.growth).toBe(230_000);  // 140k SIPP + 40k GIA + 50k joint
    expect(v.total).toBe(445_000);
  });
});

// ─── calculateBucketTargets ──────────────────────────────────────────────────

describe('calculateBucketTargets', () => {
  test('targets = spending × buffer years', () => {
    const t = calculateBucketTargets(40_000, defaultConfig);
    expect(t.cash).toBe(80_000);   // 40k × 2
    expect(t.income).toBe(200_000); // 40k × 5
  });

  test('negative spending or buffer years clamp to zero', () => {
    const t = calculateBucketTargets(-5000, {
      ...defaultConfig, cashBufferYears: -1, incomeBufferYears: -2,
    });
    expect(t.cash).toBe(0);
    expect(t.income).toBe(0);
  });
});

// ─── effectiveBucketGrowthRates ───────────────────────────────────────────────

describe('effectiveBucketGrowthRates', () => {
  test('defaults applied when overrides are 0', () => {
    const rates = effectiveBucketGrowthRates(defaultConfig);
    expect(rates.cash).toBe(BUCKET_LADDER.DEFAULT_CASH_GROWTH);
    expect(rates.income).toBe(BUCKET_LADDER.DEFAULT_INCOME_GROWTH);
    expect(rates.growth).toBe(BUCKET_LADDER.DEFAULT_GROWTH_GROWTH);
  });
  test('overrides applied when > 0', () => {
    const rates = effectiveBucketGrowthRates({
      ...defaultConfig, cashGrowthRate: 3.0, incomeGrowthRate: 5.0, growthGrowthRate: 7.5,
    });
    expect(rates).toEqual({ cash: 3.0, income: 5.0, growth: 7.5 });
  });
});

// ─── blendGrowthRateForPot ────────────────────────────────────────────────────

describe('blendGrowthRateForPot', () => {
  test('legacy default (no holdings/allocation) → returns fallback rate', () => {
    const pot = { enabled: true, totalValue: 100_000 } as any;
    expect(blendGrowthRateForPot(pot, 4.0)).toBe(4.0);
  });

  test('100% equities allocation → equities default rate', () => {
    const pot = {
      enabled: true, totalValue: 100_000,
      allocation: quickAllocation(0, 0, 0, 0, 100),
    } as any;
    expect(blendGrowthRateForPot(pot, 0)).toBe(6.0);
  });

  test('50/50 bonds-equities allocation → blended rate', () => {
    const pot = {
      enabled: true, totalValue: 100_000,
      allocation: quickAllocation(0, 50, 0, 0, 50),
    } as any;
    // (50 × 4.5 + 50 × 6.0) / 100 = 5.25
    expect(blendGrowthRateForPot(pot, 0)).toBeCloseTo(5.25, 4);
  });

  test('value-weighted blend across multiple holdings', () => {
    const pot = {
      enabled: true, totalValue: 100_000,
      holdings: [
        { id: '1', name: 'Eq',   value: 60_000, assetType: 'equities' },
        { id: '2', name: 'Bond', value: 30_000, assetType: 'bonds' },
        { id: '3', name: 'Cash', value: 10_000, assetType: 'cash' },
      ] as PotHolding[],
    } as any;
    // (60k × 6.0 + 30k × 4.5 + 10k × 4.0) / 100k = (360 + 135 + 40) / 100 = 5.35
    expect(blendGrowthRateForPot(pot, 0)).toBeCloseTo(5.35, 4);
  });
});

// ─── calculateRebalancingActions ──────────────────────────────────────────────

describe('calculateRebalancingActions', () => {
  test('trigger off → no actions', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 0, income: 0, growth: 100_000 },
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      trigger: 'off',
    });
    expect(actions).toEqual([]);
  });

  test('config disabled → no actions regardless of trigger', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 0, income: 0, growth: 100_000 },
      targets: { cash: 80_000, income: 200_000 },
      config: { ...defaultConfig, enabled: false },
      trigger: 'onWithdrawal',
    });
    expect(actions).toEqual([]);
  });

  test('cash shortfall → refill from income first', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 20_000, income: 150_000, growth: 500_000 },
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      trigger: 'onWithdrawal',
    });
    // Cash needs 60k; income has 150k → fully fill from income.
    const cashRefills = actions.filter(a => a.toBucket === 'cash');
    expect(cashRefills).toHaveLength(1);
    expect(cashRefills[0].fromBucket).toBe('income');
    expect(cashRefills[0].amount).toBe(60_000);
  });

  test('cash shortfall larger than income → spill to growth', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 10_000, income: 30_000, growth: 500_000 },
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      trigger: 'onWithdrawal',
    });
    const cashFromIncome = actions.find(a => a.toBucket === 'cash' && a.fromBucket === 'income');
    const cashFromGrowth = actions.find(a => a.toBucket === 'cash' && a.fromBucket === 'growth');
    expect(cashFromIncome?.amount).toBe(30_000); // all of income
    expect(cashFromGrowth?.amount).toBe(40_000); // remaining 40k from growth
  });

  test('SORR pause: growth dropped > threshold → no refill from growth', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 10_000, income: 5_000, growth: 350_000 }, // growth was ~450k
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig, // pause threshold 15%
      growthChangePctLastYear: -22, // crash
      trigger: 'onWithdrawal',
    });
    const pausedFromGrowth = actions.filter(a => a.fromBucket === 'growth' && a.amount === 0);
    expect(pausedFromGrowth.length).toBeGreaterThan(0);
    expect(pausedFromGrowth[0].trigger).toBe('pauseAfterDrop');
    // Should still pull what it can from income for cash refill
    const fromIncome = actions.find(a => a.toBucket === 'cash' && a.fromBucket === 'income');
    expect(fromIncome?.amount).toBe(5_000);
  });

  test('SORR pause: growth dropped within threshold → refill proceeds', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 10_000, income: 5_000, growth: 350_000 },
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      growthChangePctLastYear: -10, // within 15% pause threshold
      trigger: 'onWithdrawal',
    });
    const fromGrowth = actions.find(a => a.toBucket === 'cash' && a.fromBucket === 'growth');
    expect(fromGrowth?.amount).toBeGreaterThan(0);
  });

  test('threshold trigger: small drift below threshold → no action', () => {
    // Cash 78k vs target 80k = 2.5% drift, below default 10% threshold
    const actions = calculateRebalancingActions({
      buckets: { cash: 78_000, income: 195_000, growth: 500_000 },
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      trigger: 'threshold',
    });
    expect(actions.filter(a => a.toBucket === 'cash' || a.toBucket === 'income')).toEqual([]);
  });

  test('threshold trigger: large drift fires action', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 50_000, income: 100_000, growth: 500_000 }, // big drift
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      trigger: 'threshold',
    });
    expect(actions.length).toBeGreaterThan(0);
  });

  test('cash surplus over threshold → spill to income', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 100_000, income: 200_000, growth: 500_000 }, // cash 25% over target
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      trigger: 'onWithdrawal',
    });
    const spill = actions.find(a => a.fromBucket === 'cash' && a.toBucket === 'income');
    expect(spill?.amount).toBe(20_000);
  });

  test('income surplus over threshold → spill to growth', () => {
    const actions = calculateRebalancingActions({
      buckets: { cash: 80_000, income: 260_000, growth: 500_000 },
      targets: { cash: 80_000, income: 200_000 },
      config: defaultConfig,
      trigger: 'onWithdrawal',
    });
    const spill = actions.find(a => a.fromBucket === 'income' && a.toBucket === 'growth');
    expect(spill?.amount).toBe(60_000);
  });
});

// ─── calculateRefillSchedule ──────────────────────────────────────────────────

describe('calculateRefillSchedule', () => {
  test('no events when cash bucket stays above floor', () => {
    const snapshots: BucketYearSnapshot[] = [
      { year: 2026, age: 56, cash: 100_000, income: 200_000, growth: 500_000, spending: 40_000 },
      { year: 2027, age: 57, cash: 95_000,  income: 200_000, growth: 500_000, spending: 40_000 },
    ];
    expect(calculateRefillSchedule(snapshots, defaultConfig)).toEqual([]);
  });

  test('event fires when cash dips below 6-month floor', () => {
    const snapshots: BucketYearSnapshot[] = [
      // Floor at 40k × 0.5 = 20k. Cash 15k → trigger.
      { year: 2026, age: 56, cash: 15_000, income: 200_000, growth: 500_000, spending: 40_000 },
    ];
    const events = calculateRefillSchedule(snapshots, defaultConfig);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].fromBucket).toBe('income');
    expect(events[0].toBucket).toBe('cash');
    // Needed = 80k target - 15k current = 65k; income has plenty
    expect(events[0].amount).toBe(65_000);
  });

  test('income empty → falls back to growth refill', () => {
    const snapshots: BucketYearSnapshot[] = [
      { year: 2026, age: 56, cash: 15_000, income: 0, growth: 500_000, spending: 40_000 },
    ];
    const events = calculateRefillSchedule(snapshots, defaultConfig);
    const fromGrowth = events.find(e => e.fromBucket === 'growth');
    expect(fromGrowth?.amount).toBe(65_000);
  });

  test('growth crash last year → pause refill from growth', () => {
    const snapshots: BucketYearSnapshot[] = [
      { year: 2026, age: 56, cash: 100_000, income: 0,  growth: 500_000, spending: 40_000 },
      { year: 2027, age: 57, cash: 15_000,  income: 0,  growth: 350_000, spending: 40_000 }, // 30% drop
    ];
    const events = calculateRefillSchedule(snapshots, defaultConfig);
    const paused = events.find(e => e.amount === 0 && e.fromBucket === 'growth');
    expect(paused).toBeDefined();
    expect(paused?.reason).toContain('paused');
  });
});
