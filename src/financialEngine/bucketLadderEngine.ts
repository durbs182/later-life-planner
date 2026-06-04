/**
 * Cash Flow Ladder (bucket strategy) engine — pure functions.
 *
 * Sequence-of-returns risk (SORR) protection: hold defensive buckets so a crash
 * in early retirement doesn't force selling growth assets at depressed prices.
 *
 *   Bucket 1 — Cash    (1–2 yrs spending): cash, money market, ultra-short gilts
 *   Bucket 2 — Income  (3–7 yrs spending): bonds, gilts, precious metals, REITs, alternatives
 *   Bucket 3 — Growth  (8+ yrs):           equities, equity funds, growth alternatives
 *
 * Asset-type allocation is captured *within each pot* (see PotHolding /
 * PotAllocation on the pot interfaces) so a SIPP can mix all five asset types.
 *
 * All functions in this module are pure and side-effect free. The projection
 * engine consumes them per-year when bucketLadderConfig.enabled is true.
 *
 * See docs/cash-flow-ladder-design.md for the full design and validation harness.
 */

import type {
  PlannerState, ISAAsset, GIAAsset, PotHolding, PotAllocation, MixedAllocation,
  RebalanceAction, BucketLadderConfig, RebalanceTrigger, DCPensionSource,
  AssetType, BucketKey,
} from '@/models/types';
import { ASSET_TYPE_GROWTH, BUCKET_LADDER } from '@/config/financialConstants';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Value split across the three buckets in £. */
export interface BucketTriple {
  cash: number;
  income: number;
  growth: number;
}

export interface BucketValues extends BucketTriple {
  total: number;
}

export interface BucketTargets {
  /** Target £ value in Bucket 1 — `annualSpending × cashBufferYears`. */
  cash: number;
  /** Target £ value in Bucket 2 — `annualSpending × incomeBufferYears`. */
  income: number;
  // Bucket 3 has no explicit target — it holds the remainder.
}

/** Per-bucket effective growth rates (%), after applying any config overrides. */
export interface BucketGrowthRates {
  cash: number;
  income: number;
  growth: number;
}

/**
 * A single year's bucket snapshot — produced by the projection engine and fed
 * into post-hoc analysis like calculateRefillSchedule.
 */
export interface BucketYearSnapshot {
  year: number;
  age: number;
  cash: number;
  income: number;
  growth: number;
  /** Annual spending target for the year (£). */
  spending: number;
}

/** A single refill event in the dashboard "Refilling schedule" table. */
export interface RefillEvent {
  year: number;
  age: number;
  fromBucket: BucketKey;
  toBucket: BucketKey;
  amount: number;
  reason: string;
}

/** Pot-shaped types that can carry holdings/allocation metadata. */
type Allocable = (DCPensionSource | ISAAsset | GIAAsset) & {
  enabled: boolean;
  totalValue: number;
};

// ─── Asset-type → bucket mapping ──────────────────────────────────────────────

/**
 * Maps each concrete asset type to its bucket.
 * 'mixed' is intentionally absent — it's split via MixedAllocation in bucketSplitForMixed.
 */
export const ASSET_TYPE_TO_BUCKET: Record<Exclude<AssetType, 'mixed'>, BucketKey> = {
  cash: 'cash',
  bonds: 'income',
  preciousMetals: 'income',
  alternatives: 'income',
  equities: 'growth',
};

// ─── Per-pot resolution ───────────────────────────────────────────────────────

/**
 * Split a pot's value across the three buckets. Resolution order:
 *   1. If `holdings` is set and non-empty: sum each holding into its bucket.
 *      A 'mixed' holding is split via its mixedAllocation.
 *   2. Else if `allocation` is set: use the quick-mode percentages.
 *   3. Else: legacy default — entire pot value sits in the growth bucket.
 *      (This preserves existing behaviour for plans created before the ladder.)
 */
export function resolvePotBucketSplit(pot: Allocable | null | undefined): BucketTriple {
  if (!pot || !pot.totalValue || pot.totalValue <= 0) {
    return zeroTriple();
  }
  if (pot.holdings && pot.holdings.length > 0) {
    return resolveFromHoldings(pot.holdings);
  }
  if (pot.allocation) {
    return resolveFromAllocation(pot.totalValue, pot.allocation);
  }
  return { cash: 0, income: 0, growth: pot.totalValue };
}

function resolveFromHoldings(holdings: PotHolding[]): BucketTriple {
  const split = zeroTriple();
  for (const h of holdings) {
    if (!h || !Number.isFinite(h.value) || h.value <= 0) continue;
    if (h.assetType === 'mixed' && h.mixedAllocation) {
      const m = bucketSplitForMixed(h.value, h.mixedAllocation);
      addInto(split, m);
      continue;
    }
    const bucket = ASSET_TYPE_TO_BUCKET[h.assetType as Exclude<AssetType, 'mixed'>];
    if (bucket) split[bucket] += h.value;
  }
  return split;
}

function resolveFromAllocation(totalValue: number, allocation: PotAllocation): BucketTriple {
  const incomePct = allocation.bondsPercent + allocation.preciousMetalsPercent + allocation.alternativesPercent;
  return {
    cash: (totalValue * allocation.cashPercent) / 100,
    income: (totalValue * incomePct) / 100,
    growth: (totalValue * allocation.equitiesPercent) / 100,
  };
}

function bucketSplitForMixed(value: number, mixed: MixedAllocation): BucketTriple {
  const incomePct = mixed.bondsPercent + mixed.preciousMetalsPercent + mixed.alternativesPercent;
  return {
    cash: (value * mixed.cashPercent) / 100,
    income: (value * incomePct) / 100,
    growth: (value * mixed.equitiesPercent) / 100,
  };
}

// ─── Whole-household aggregation ──────────────────────────────────────────────

/**
 * Aggregate buckets across both persons + joint GIA, including cash savings.
 * Cash savings sit entirely in Bucket 1 — they are implicitly 100% cash.
 */
export function calculateBucketValues(state: PlannerState): BucketValues {
  const totals = zeroTriple();

  // Investment pots — each is split via resolvePotBucketSplit.
  const pots: Allocable[] = [
    state.person1.incomeSources.dcPension as Allocable,
    state.person1.assets.isaInvestments as Allocable,
    state.person1.assets.generalInvestments as Allocable,
    state.jointGia as Allocable,
  ];
  if (state.mode === 'couple') {
    pots.push(state.person2.incomeSources.dcPension as Allocable);
    pots.push(state.person2.assets.isaInvestments as Allocable);
    pots.push(state.person2.assets.generalInvestments as Allocable);
  }
  for (const pot of pots) {
    if (!pot || !pot.enabled) continue;
    addInto(totals, resolvePotBucketSplit(pot));
  }

  // Cash savings → Bucket 1.
  if (state.person1.assets.cashSavings?.enabled) {
    totals.cash += state.person1.assets.cashSavings.totalValue;
  }
  if (state.mode === 'couple' && state.person2.assets.cashSavings?.enabled) {
    totals.cash += state.person2.assets.cashSavings.totalValue;
  }

  return { ...totals, total: totals.cash + totals.income + totals.growth };
}

// ─── Targets ──────────────────────────────────────────────────────────────────

/** Target sizes for Buckets 1 and 2; Bucket 3 holds the remainder. */
export function calculateBucketTargets(
  annualSpending: number,
  config: BucketLadderConfig,
): BucketTargets {
  return {
    cash: Math.max(0, annualSpending) * Math.max(0, config.cashBufferYears),
    income: Math.max(0, annualSpending) * Math.max(0, config.incomeBufferYears),
  };
}

// ─── Effective growth rates (config override falls back to defaults) ─────────

/** Resolve effective per-bucket growth rates, applying user overrides where set. */
export function effectiveBucketGrowthRates(config: BucketLadderConfig): BucketGrowthRates {
  return {
    cash: config.cashGrowthRate > 0 ? config.cashGrowthRate : BUCKET_LADDER.DEFAULT_CASH_GROWTH,
    income: config.incomeGrowthRate > 0 ? config.incomeGrowthRate : BUCKET_LADDER.DEFAULT_INCOME_GROWTH,
    growth: config.growthGrowthRate > 0 ? config.growthGrowthRate : BUCKET_LADDER.DEFAULT_GROWTH_GROWTH,
  };
}

// ─── Per-pot blended growth rate ──────────────────────────────────────────────

/**
 * Blend a pot's growth rate from its holdings (or quick allocation) and the
 * per-asset-type default rates. Used by the projection engine when the ladder
 * is enabled to differentiate growth across asset types within a single pot.
 *
 * Returns the blended annual rate as a % (e.g. 5.2 = 5.2% p.a.).
 * Returns the pot's existing flat rate as fallback when no allocation info
 * is set — preserving today's behaviour.
 */
export function blendGrowthRateForPot(pot: Allocable, fallbackRate: number): number {
  if (!pot || !pot.totalValue || pot.totalValue <= 0) return fallbackRate;

  if (pot.holdings && pot.holdings.length > 0) {
    return blendFromHoldings(pot.holdings, pot.totalValue, fallbackRate);
  }
  if (pot.allocation) {
    return blendFromAllocation(pot.allocation);
  }
  return fallbackRate;
}

function blendFromHoldings(holdings: PotHolding[], potTotal: number, fallbackRate: number): number {
  let weightedRate = 0;
  let countedValue = 0;
  for (const h of holdings) {
    if (!h || !Number.isFinite(h.value) || h.value <= 0) continue;
    const holdingRate = h.assetType === 'mixed' && h.mixedAllocation
      ? blendFromAllocation(h.mixedAllocation)
      : (ASSET_TYPE_GROWTH[h.assetType as keyof typeof ASSET_TYPE_GROWTH] ?? fallbackRate);
    weightedRate += h.value * holdingRate;
    countedValue += h.value;
  }
  if (countedValue <= 0) return fallbackRate;
  return weightedRate / countedValue;
}

function blendFromAllocation(allocation: PotAllocation | MixedAllocation): number {
  return (
    allocation.cashPercent * ASSET_TYPE_GROWTH.cash +
    allocation.bondsPercent * ASSET_TYPE_GROWTH.bonds +
    allocation.preciousMetalsPercent * ASSET_TYPE_GROWTH.preciousMetals +
    allocation.alternativesPercent * ASSET_TYPE_GROWTH.alternatives +
    allocation.equitiesPercent * ASSET_TYPE_GROWTH.equities
  ) / 100;
}

// ─── Rebalancing decision (point-in-time) ─────────────────────────────────────

export interface RebalanceArgs {
  buckets: BucketTriple;
  targets: BucketTargets;
  config: BucketLadderConfig;
  /** Per-cent change in growth bucket vs prior year (negative = drop). Omit in year 1. */
  growthChangePctLastYear?: number;
  /** What's firing the call — controls the rebalance reason text and gating. */
  trigger: RebalanceTrigger;
}

/**
 * Given a point-in-time view of buckets vs targets, return the moves required
 * to bring buckets back toward target.
 *
 * Drift is `(current − target) / target`; only buckets drifting beyond the
 * configured threshold are touched. Refills from growth are paused if growth
 * fell by more than `pauseRebalanceAfterEquityDropPercent` last year — the
 * core SORR protection.
 *
 * Trigger semantics:
 *  - 'onWithdrawal': fire whenever any drift exists (default during drawdown)
 *  - 'annual':       fire once per year regardless of drift
 *  - 'threshold':    fire only when drift exceeds rebalanceThresholdPercent
 *  - 'off':          return []
 */
export function calculateRebalancingActions(args: RebalanceArgs): RebalanceAction[] {
  if (args.trigger === 'off' || !args.config.enabled) return [];

  const { buckets, targets, config, growthChangePctLastYear, trigger } = args;
  const actions: RebalanceAction[] = [];

  const cashDrift = driftFraction(buckets.cash, targets.cash);
  const incomeDrift = driftFraction(buckets.income, targets.income);

  const driftLimit = config.rebalanceThresholdPercent / 100;
  const growthCrashThreshold = -config.pauseRebalanceAfterEquityDropPercent;
  const growthCrashed = typeof growthChangePctLastYear === 'number'
    && growthChangePctLastYear < growthCrashThreshold;

  // Cash bucket under target → pull from income, then growth (paused if crashed).
  if (cashDrift < 0 && (trigger !== 'threshold' || Math.abs(cashDrift) >= driftLimit)) {
    const cashShortfall = Math.max(0, targets.cash - buckets.cash);
    if (cashShortfall > 0) {
      const remainingIncome = Math.max(0, buckets.income);
      const fromIncome = Math.min(cashShortfall, remainingIncome);
      if (fromIncome > 0) {
        actions.push({
          fromBucket: 'income', toBucket: 'cash', amount: fromIncome,
          reason: cashDriftReason(trigger, cashDrift),
          trigger,
        });
      }
      const stillNeeded = cashShortfall - fromIncome;
      if (stillNeeded > 0) {
        if (growthCrashed) {
          actions.push({
            fromBucket: 'growth', toBucket: 'cash', amount: 0,
            reason: `Refill from growth paused — growth bucket fell ${growthChangePctLastYear?.toFixed(1)}% last year`,
            trigger: 'pauseAfterDrop',
          });
        } else {
          const fromGrowth = Math.min(stillNeeded, Math.max(0, buckets.growth));
          if (fromGrowth > 0) {
            actions.push({
              fromBucket: 'growth', toBucket: 'cash', amount: fromGrowth,
              reason: 'Cash refill — income bucket insufficient',
              trigger,
            });
          }
        }
      }
    }
  }

  // Income bucket under target → pull from growth (also paused if growth crashed).
  if (incomeDrift < 0 && (trigger !== 'threshold' || Math.abs(incomeDrift) >= driftLimit)) {
    const incomeShortfall = Math.max(0, targets.income - buckets.income);
    if (incomeShortfall > 0) {
      if (growthCrashed) {
        actions.push({
          fromBucket: 'growth', toBucket: 'income', amount: 0,
          reason: `Refill from growth paused — growth bucket fell ${growthChangePctLastYear?.toFixed(1)}% last year`,
          trigger: 'pauseAfterDrop',
        });
      } else {
        const fromGrowth = Math.min(incomeShortfall, Math.max(0, buckets.growth));
        if (fromGrowth > 0) {
          actions.push({
            fromBucket: 'growth', toBucket: 'income', amount: fromGrowth,
            reason: incomeDriftReason(trigger, incomeDrift),
            trigger,
          });
        }
      }
    }
  }

  // Cash surplus beyond threshold → spill into income (don't starve longer-dated buckets).
  if (cashDrift > driftLimit && targets.cash > 0) {
    const surplus = buckets.cash - targets.cash;
    if (surplus > 0) {
      actions.push({
        fromBucket: 'cash', toBucket: 'income', amount: surplus,
        reason: `Cash bucket ${(cashDrift * 100).toFixed(1)}% over target — surplus moved to income`,
        trigger,
      });
    }
  }

  // Income surplus beyond threshold → spill into growth.
  if (incomeDrift > driftLimit && targets.income > 0) {
    const surplus = buckets.income - targets.income;
    if (surplus > 0) {
      actions.push({
        fromBucket: 'income', toBucket: 'growth', amount: surplus,
        reason: `Income bucket ${(incomeDrift * 100).toFixed(1)}% over target — surplus moved to growth`,
        trigger,
      });
    }
  }

  return actions;
}

// ─── Post-hoc refill schedule ─────────────────────────────────────────────────

/**
 * Walk a sequence of bucket snapshots and emit a refill schedule for the UI.
 * A refill fires when Bucket 1 dips below CASH_REFILL_TRIGGER_MONTHS of spending.
 *
 * This is a *reporting* helper — the engine applies refills inline during the
 * projection loop. This function reconstructs what those refills should look like
 * from snapshots alone, useful for dashboards and the scenario harness output.
 */
export function calculateRefillSchedule(
  snapshots: BucketYearSnapshot[],
  config: BucketLadderConfig,
): RefillEvent[] {
  const events: RefillEvent[] = [];
  const refillTriggerFraction = BUCKET_LADDER.CASH_REFILL_TRIGGER_MONTHS / 12;
  let prevGrowth = 0;

  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    const trigger = s.spending * refillTriggerFraction;

    if (s.cash < trigger) {
      const cashTarget = s.spending * config.cashBufferYears;
      let needed = Math.max(0, cashTarget - s.cash);
      let availableIncome = s.income;
      let availableGrowth = s.growth;

      if (availableIncome > 0 && needed > 0) {
        const fromIncome = Math.min(needed, availableIncome);
        events.push({
          year: s.year, age: s.age,
          fromBucket: 'income', toBucket: 'cash', amount: fromIncome,
          reason: 'Cash bucket below 6-month floor',
        });
        availableIncome -= fromIncome;
        needed -= fromIncome;
      }

      if (needed > 0) {
        const growthChangePct = i > 0 && prevGrowth > 0
          ? ((s.growth - prevGrowth) / prevGrowth) * 100
          : 0;
        const crashed = i > 0 && growthChangePct < -config.pauseRebalanceAfterEquityDropPercent;
        if (crashed) {
          events.push({
            year: s.year, age: s.age,
            fromBucket: 'growth', toBucket: 'cash', amount: 0,
            reason: `Refill from growth paused — growth bucket fell ${growthChangePct.toFixed(1)}% last year`,
          });
        } else if (availableGrowth > 0) {
          const fromGrowth = Math.min(needed, availableGrowth);
          events.push({
            year: s.year, age: s.age,
            fromBucket: 'growth', toBucket: 'cash', amount: fromGrowth,
            reason: 'Cash refill — income bucket insufficient',
          });
        }
      }
    }

    prevGrowth = s.growth;
  }

  return events;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function zeroTriple(): BucketTriple {
  return { cash: 0, income: 0, growth: 0 };
}

function addInto(target: BucketTriple, addend: BucketTriple): void {
  target.cash += addend.cash;
  target.income += addend.income;
  target.growth += addend.growth;
}

function driftFraction(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return (current - target) / target;
}

function cashDriftReason(trigger: RebalanceTrigger, drift: number): string {
  if (trigger === 'threshold') return `Cash bucket ${(drift * 100).toFixed(1)}% below target — drift threshold breached`;
  if (trigger === 'annual') return 'Annual rebalance — cash bucket under target';
  return 'Cash bucket under target after withdrawal';
}

function incomeDriftReason(trigger: RebalanceTrigger, drift: number): string {
  if (trigger === 'threshold') return `Income bucket ${(drift * 100).toFixed(1)}% below target — drift threshold breached`;
  if (trigger === 'annual') return 'Annual rebalance — income bucket under target';
  return 'Income bucket under target after withdrawal';
}
