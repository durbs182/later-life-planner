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

/**
 * Structural shape consumed by the bucket-resolution helpers. Any pot type
 * (DCPensionSource, ISAAsset, GIAAsset, or a synthetic shock-time wrapper)
 * that carries totalValue + optional holdings/allocation satisfies this.
 */
export interface PotLike {
  totalValue: number;
  holdings?: PotHolding[];
  allocation?: PotAllocation;
}

/** Pot types that participate in household aggregation (carry `enabled`). */
type EnabledPot = DCPensionSource | ISAAsset | GIAAsset;

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
export function resolvePotBucketSplit(pot: PotLike | null | undefined): BucketTriple {
  if (!pot?.totalValue || pot.totalValue <= 0) {
    return zeroTriple();
  }
  if (pot.holdings && pot.holdings.length > 0) {
    const raw = resolveFromHoldings(pot.holdings);
    const rawTotal = raw.cash + raw.income + raw.growth;
    if (rawTotal > 0 && Number.isFinite(rawTotal)) {
      const scale = pot.totalValue / rawTotal;
      return {
        cash: raw.cash * scale,
        income: raw.income * scale,
        growth: raw.growth * scale,
      };
    }
    return zeroTriple();
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
  const pots: EnabledPot[] = [
    state.person1.incomeSources.dcPension,
    state.person1.assets.isaInvestments,
    state.person1.assets.generalInvestments,
    ...(state.mode === 'couple' ? [
      state.jointGia,
      state.person2.incomeSources.dcPension,
      state.person2.assets.isaInvestments,
      state.person2.assets.generalInvestments,
    ] : []),
  ];
  for (const pot of pots) {
    if (!pot?.enabled) continue;
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
export function blendGrowthRateForPot(pot: PotLike | null | undefined, fallbackRate: number): number {
  if (!pot?.totalValue || pot.totalValue <= 0) return fallbackRate;

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
  // existing logic
  const ctx = buildRebalanceContext(args);
  const actions: RebalanceAction[] = [];
  actions.push(...fillCashShortfall(ctx));
  // existing logic
  return actions;
export function calculateRebalancingActions(args: RebalanceArgs): RebalanceAction[] {
  if (args.trigger === 'off' || !args.config.enabled) return [];

  const driftLimit = args.config.rebalanceThresholdPercent / 100;
  const growthCrashed = typeof args.growthChangePctLastYear === 'number'
    && args.growthChangePctLastYear < -args.config.pauseRebalanceAfterEquityDropPercent;

  const b: BucketTriple = { ...args.buckets };
  const actions: RebalanceAction[] = [];

  // Cash shortfall → income first, then growth (unless paused after crash)
  const cashDrift = driftFraction(b.cash, args.targets.cash);
  if (shortfallEligible(cashDrift, args.trigger, driftLimit)) {
    const shortfall = Math.max(0, args.targets.cash - b.cash);
    const fromIncome = Math.min(shortfall, Math.max(0, b.income));
    if (fromIncome > 0) {
      actions.push({ fromBucket: 'income', toBucket: 'cash', amount: fromIncome, reason: cashDriftReason(args.trigger, cashDrift), trigger: args.trigger });
      b.income -= fromIncome; b.cash += fromIncome;
    }
    const stillNeeded = shortfall - fromIncome;
    if (stillNeeded > 0) {
      if (growthCrashed) actions.push(pauseAfterDropAction('cash', args.growthChangePctLastYear));
      else {
        const fromGrowth = Math.min(stillNeeded, Math.max(0, b.growth));
        if (fromGrowth > 0) {
          actions.push({ fromBucket: 'growth', toBucket: 'cash', amount: fromGrowth, reason: 'Cash refill — income bucket insufficient', trigger: args.trigger });
          b.growth -= fromGrowth; b.cash += fromGrowth;
        }
      }
    }
  }

  // Income shortfall → growth (unless paused after crash)
  const incomeDrift = driftFraction(b.income, args.targets.income);
  if (shortfallEligible(incomeDrift, args.trigger, driftLimit)) {
    const shortfall = Math.max(0, args.targets.income - b.income);
    if (shortfall > 0) {
      if (growthCrashed) actions.push(pauseAfterDropAction('income', args.growthChangePctLastYear));
      else {
        const fromGrowth = Math.min(shortfall, Math.max(0, b.growth));
        if (fromGrowth > 0) {
          actions.push({ fromBucket: 'growth', toBucket: 'income', amount: fromGrowth, reason: incomeDriftReason(args.trigger, incomeDrift), trigger: args.trigger });
          b.growth -= fromGrowth; b.income += fromGrowth;
        }
      }
    }
  }

  // Spill surpluses after refills so we don’t overfill a bucket.
  const cashDriftAfter = driftFraction(b.cash, args.targets.cash);
  if (cashDriftAfter > driftLimit && args.targets.cash > 0) {
    const surplus = b.cash - args.targets.cash;
    if (surplus > 0) actions.push({ fromBucket: 'cash', toBucket: 'income', amount: surplus, reason: `Cash bucket ${(cashDriftAfter * 100).toFixed(1)}% over target — surplus moved to income`, trigger: args.trigger });
  }
  const incomeDriftAfter = driftFraction(b.income, args.targets.income);
  if (incomeDriftAfter > driftLimit && args.targets.income > 0) {
    const surplus = b.income - args.targets.income;
    if (surplus > 0) actions.push({ fromBucket: 'income', toBucket: 'growth', amount: surplus, reason: `Income bucket ${(incomeDriftAfter * 100).toFixed(1)}% over target — surplus moved to growth`, trigger: args.trigger });
  }

  return actions;
}

/** True when the shortfall side should fire under the current trigger. */
function shortfallEligible(drift: number, trigger: RebalanceTrigger, driftLimit: number): boolean {
  return drift < 0 && (trigger !== 'threshold' || Math.abs(drift) >= driftLimit);
}

function fillCashShortfall(ctx: RebalanceContext): RebalanceAction[] {
  if (!shortfallEligible(ctx.cashDrift, ctx.trigger, ctx.driftLimit)) return [];
  const shortfall = Math.max(0, ctx.targets.cash - ctx.buckets.cash);
  if (shortfall <= 0) return [];

  const actions: RebalanceAction[] = [];
  const fromIncome = Math.min(shortfall, Math.max(0, ctx.buckets.income));
  if (fromIncome > 0) {
    actions.push({
      fromBucket: 'income', toBucket: 'cash', amount: fromIncome,
      reason: cashDriftReason(ctx.trigger, ctx.cashDrift),
      trigger: ctx.trigger,
    });
  }

  const stillNeeded = shortfall - fromIncome;
  if (stillNeeded <= 0) return actions;

  if (ctx.growthCrashed) {
    actions.push(pauseAfterDropAction('cash', ctx.growthChangePctLastYear));
    return actions;
  }
  const fromGrowth = Math.min(stillNeeded, Math.max(0, ctx.buckets.growth));
  if (fromGrowth > 0) {
    actions.push({
      fromBucket: 'growth', toBucket: 'cash', amount: fromGrowth,
      reason: 'Cash refill — income bucket insufficient',
      trigger: ctx.trigger,
    });
  }
  return actions;
}

function fillIncomeShortfall(ctx: RebalanceContext): RebalanceAction[] {
  if (!shortfallEligible(ctx.incomeDrift, ctx.trigger, ctx.driftLimit)) return [];
  const shortfall = Math.max(0, ctx.targets.income - ctx.buckets.income);
  if (shortfall <= 0) return [];

  if (ctx.growthCrashed) {
    return [pauseAfterDropAction('income', ctx.growthChangePctLastYear)];
  }
  const fromGrowth = Math.min(shortfall, Math.max(0, ctx.buckets.growth));
  if (fromGrowth <= 0) return [];
  return [{
    fromBucket: 'growth', toBucket: 'income', amount: fromGrowth,
    reason: incomeDriftReason(ctx.trigger, ctx.incomeDrift),
    trigger: ctx.trigger,
  }];
}

function spillCashSurplus(ctx: RebalanceContext): RebalanceAction[] {
  if (ctx.cashDrift <= ctx.driftLimit || ctx.targets.cash <= 0) return [];
  const surplus = ctx.buckets.cash - ctx.targets.cash;
  if (surplus <= 0) return [];
  return [{
    fromBucket: 'cash', toBucket: 'income', amount: surplus,
    reason: `Cash bucket ${(ctx.cashDrift * 100).toFixed(1)}% over target — surplus moved to income`,
    trigger: ctx.trigger,
  }];
}

function spillIncomeSurplus(ctx: RebalanceContext): RebalanceAction[] {
  if (ctx.incomeDrift <= ctx.driftLimit || ctx.targets.income <= 0) return [];
  const surplus = ctx.buckets.income - ctx.targets.income;
  if (surplus <= 0) return [];
  return [{
    fromBucket: 'income', toBucket: 'growth', amount: surplus,
    reason: `Income bucket ${(ctx.incomeDrift * 100).toFixed(1)}% over target — surplus moved to growth`,
    trigger: ctx.trigger,
  }];
}

function pauseAfterDropAction(toBucket: BucketKey, growthChangePct: number | undefined): RebalanceAction {
  return {
    fromBucket: 'growth', toBucket, amount: 0,
    reason: `Refill from growth paused — growth bucket fell ${growthChangePct?.toFixed(1)}% last year`,
    trigger: 'pauseAfterDrop',
  };
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
    if (s.cash < s.spending * refillTriggerFraction) {
      events.push(...refillEventsForSnapshot(s, config, i, prevGrowth));
    }
    prevGrowth = s.growth;
  }
  return events;
}

/**
 * Emit refill events for a single snapshot whose cash bucket has dipped below
 * the trigger floor. Pulls from income first, then growth — with growth pause
 * if last year's growth bucket fell more than pauseRebalanceAfterEquityDropPercent.
 */
function refillEventsForSnapshot(
  s: BucketYearSnapshot,
  config: BucketLadderConfig,
  index: number,
  prevGrowth: number,
): RefillEvent[] {
  const events: RefillEvent[] = [];
  const cashTarget = s.spending * config.cashBufferYears;
  let needed = Math.max(0, cashTarget - s.cash);
  if (needed <= 0) return events;

  if (s.income > 0) {
    const fromIncome = Math.min(needed, s.income);
    events.push({
      year: s.year, age: s.age,
      fromBucket: 'income', toBucket: 'cash', amount: fromIncome,
      reason: 'Cash bucket below 6-month floor',
    });
    needed -= fromIncome;
  }
  if (needed <= 0) return events;

  const growthChangePct = index > 0 && prevGrowth > 0
    ? ((s.growth - prevGrowth) / prevGrowth) * 100
    : 0;
  const crashed = index > 0 && growthChangePct < -config.pauseRebalanceAfterEquityDropPercent;
  if (crashed) {
    events.push({
      year: s.year, age: s.age,
      fromBucket: 'growth', toBucket: 'cash', amount: 0,
      reason: `Refill from growth paused — growth bucket fell ${growthChangePct.toFixed(1)}% last year`,
    });
  } else if (s.growth > 0) {
    events.push({
      year: s.year, age: s.age,
      fromBucket: 'growth', toBucket: 'cash', amount: Math.min(needed, s.growth),
      reason: 'Cash refill — income bucket insufficient',
    });
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
