/**
 * Core lifetime projection engine.
 *
 * Calculates year-by-year income, spending, asset drawdowns, and tax
 * from the current age to life expectancy.
 *
 * Architecture notes:
 * - All financial constants imported from /config/financialConstants
 * - Tax calculations delegated to /financialEngine/taxCalculations
 * - No React imports — this module is pure TypeScript
 * - Exported helpers (formatCurrency, etc.) are used by UI components
 *
 * DC Pension drawdown model — UFPLS (Uncrystallised Funds Pension Lump Sum):
 *   The engine uses a pure UFPLS strategy. No upfront PCLS lump sum is taken
 *   at crystallisation. Instead, each DC pension withdrawal is 25% tax-free
 *   and 75% taxable, spread naturally over the drawdown period.
 *
 *   Rationale:
 *   - Leaves the full pension pot invested (tax-free growth environment) for longer.
 *   - Before the State Pension starts, the 75% taxable UFPLS portion can be
 *     absorbed within the personal allowance (£12,570), making early draws
 *     highly tax-efficient or completely tax-free.
 *   - Avoids a large one-off lump sum being parked in cash where it earns less
 *     and loses the pension's tax-free growth wrapper.
 *
 *   LSA tracking:
 *   The Lump Sum Allowance (£268,275 per person) limits the total tax-free cash
 *   taken from pensions in a lifetime (Finance Act 2024). The 25% tax-free
 *   portion of each UFPLS withdrawal accumulates against the LSA. Once the LSA
 *   is exhausted, subsequent DC withdrawals become fully taxable.
 *
 * Joint GIA:
 *   When a GIA has owner = 'joint', capital gains are split equally
 *   between both persons for CGT purposes, allowing each person's
 *   annual CGT exempt amount (£3,000) to be used efficiently.
 */

import type {
  PlannerState, YearlyProjection, LifeStage, Person, GIAAsset,
  PersonIncomeSources, PersonAssets, SimulationResult,
  GamificationMetrics, RebalanceAction,
} from '@/models/types';
import { CGT, PENSION_RULES, RLSS, CURRENT_TAX_YEAR_START, GAP_PERIOD_NET_SALARY_FACTOR } from '@/config/financialConstants';
import { getSnapshotForYear } from '@/config/taxRuleSnapshot';
import { calcIncomeTax, calcCGT, drawFromGIA, isHigherRateTaxpayer } from './taxCalculations';
import {
  resolvePotBucketSplit, blendGrowthRateForPot,
  calculateBucketTargets, calculateRebalancingActions,
  type BucketTriple, type PotLike,
} from './bucketLadderEngine';

/**
 * Optional parameters for calculateProjections.
 *
 * `growthShockYear` / `growthShockPercent`: inject a one-off downward shock at
 * the start of year N. Used by runSorrStressTest. When the bucket ladder is
 * enabled, the shock applies only to the growth-bucket portion of each pot;
 * when disabled, it applies to whole pot values (proxy for an equity-heavy
 * portfolio). Cash savings are never shocked.
 */
export interface ProjectionOptions {
  growthShockYear?: number;
  growthShockPercent?: number;
}

// ─── Per-year working state for the drawdown waterfall ──────────────────────

/** Mutable pot balances threaded through the per-year simulation. */
interface DrawBalances {
  p1Isa: number; p1GiaV: number; p1GiaBC: number; p1Cash: number; p1Dc: number;
  p2Isa: number; p2GiaV: number; p2GiaBC: number; p2Cash: number; p2Dc: number;
  jointGiaV: number; jointGiaBC: number;
  p1LifetimePcls: number; p2LifetimePcls: number;
}

/** Per-iteration draw accumulators (reset each gross-up pass). */
interface DrawAmounts {
  p1IsaD: number; p1GiaD: number; p1GiaCG: number; p1CashD: number; p1DcD: number; p1DcTaxFree: number;
  p2IsaD: number; p2GiaD: number; p2GiaCG: number; p2CashD: number; p2DcD: number; p2DcTaxFree: number;
  jointGiaD: number; jointGiaCG: number;
}

interface DrawTaxes {
  totalIncome: number;
  totalTaxPaid: number;
  incomeTaxPaid: number;
  totalCgtPaid: number;
  p1IncomeTax: number; p2IncomeTax: number;
  p1CgtPaid: number; p2CgtPaid: number;
}

interface WaterfallContext {
  preDrawSnap: DrawBalances;
  spending: number;
  fixedIncome: number;
  mode: 'single' | 'couple';
  householdFiStarted: boolean;
  p2Age: number | null;
  yearSnapshot: ReturnType<typeof getSnapshotForYear>;
  yearPensionLsa: number;
  yearUfplsFrac: number;
  calendarYear: number;
  spExempt: boolean;
  p1TaxableFixed: number;
  p2TaxableFixed: number;
  p1BedIsaCg: number;
  p2IndivBedIsaCg: number;
  p2BedIsaCg: number;
  p1Inc: { sp: number; db: number; ptw: number; other: number; rent: number };
  p2Inc: { sp: number; db: number; ptw: number; other: number; rent: number };
  p2RentEffective: number;
  dc1Enabled: boolean;
  dc2Enabled: boolean;
}

interface WaterfallResult {
  balances: DrawBalances;
  draws: DrawAmounts;
  totals: DrawTaxes;
}

interface BucketSnapshotInputs {
  bucketLadder: NonNullable<PlannerState['bucketLadderConfig']>;
  mode: 'single' | 'couple';
  spending: number;
  yearIndex: number;
  prevGrowthBucketValue: number;
  pots: Array<{ currentValue: number; def: PotLike; enabled: boolean }>;
  /** Combined cash savings to add to Bucket 1 (already filtered for enabled+mode). */
  cashSavings: number;
}

interface BucketSnapshotResult {
  bucketValues: NonNullable<YearlyProjection['bucketValues']>;
  rebalanceActions: RebalanceAction[] | undefined;
}

/**
 * Compute end-of-year bucket balances + rebalance actions for the projection.
 *
 * Extracted from calculateProjections so the main loop stays focused on the
 * tax/drawdown waterfall. Rebalance actions are advisory only in Stage A —
 * they don't mutate underlying pot allocations during the simulation.
 */
function computeBucketSnapshot(inputs: BucketSnapshotInputs): BucketSnapshotResult {
  const { bucketLadder, spending, yearIndex, prevGrowthBucketValue, pots, cashSavings } = inputs;

  const acc: BucketTriple = { cash: cashSavings, income: 0, growth: 0 };
  for (const pot of pots) {
    if (!pot.enabled || pot.currentValue <= 0) continue;
    const split = resolvePotBucketSplit({
      holdings: pot.def.holdings,
      allocation: pot.def.allocation,
      totalValue: pot.currentValue,
    });
    acc.cash += split.cash;
    acc.income += split.income;
    acc.growth += split.growth;
  }

  const bucketValues = {
    cash: Math.max(0, acc.cash),
    income: Math.max(0, acc.income),
    growth: Math.max(0, acc.growth),
    total: Math.max(0, acc.cash + acc.income + acc.growth),
  };

  const targets = calculateBucketTargets(spending, bucketLadder);
  const growthChangePctLastYear = yearIndex > 0 && prevGrowthBucketValue > 0
    ? ((bucketValues.growth - prevGrowthBucketValue) / prevGrowthBucketValue) * 100
    : undefined;

  const actions = calculateRebalancingActions({
    buckets: { cash: bucketValues.cash, income: bucketValues.income, growth: bucketValues.growth },
    targets,
    config: bucketLadder,
    growthChangePctLastYear,
    trigger: bucketLadder.rebalanceTrigger,
  });

  return {
    bucketValues,
    rebalanceActions: actions.length > 0 ? actions : undefined,
  };
}

// ─── Per-person income aggregator ────────────────────────────────────────────

function personIncome(
  src: PersonIncomeSources,
  assets: PersonAssets,
  personAge: number,
  yearIndex: number,
  inflRate: number,
): { sp: number; db: number; ptw: number; other: number; rent: number } {
  // Inflation factor from year 0 (today) — consistent with spending inflation.
  // Income amounts are entered in today's money; nominal values grow from now.
  const inflFactor = Math.pow(1 + inflRate / 100, yearIndex);

  // State Pension — in today's money, grows with inflation from year 0
  const sp = src.statePension.enabled && personAge >= src.statePension.startAge
    ? src.statePension.weeklyAmount * 52 * inflFactor : 0;

  // DB Pension — in today's money, grows with inflation from year 0
  const db = src.dbPension.enabled && personAge >= src.dbPension.startAge
    ? src.dbPension.annualIncome * inflFactor : 0;

  // Annuity — in today's money, grows with inflation from year 0
  const annuity = src.annuity?.enabled && personAge >= (src.annuity?.startAge ?? 999)
    ? src.annuity.annualIncome * inflFactor : 0;

  // Part-time work — not inflation-linked (nominal income)
  const ptw = src.partTimeWork.enabled && personAge < src.partTimeWork.stopAge
    ? src.partTimeWork.annualIncome : 0;

  // Other income (trusts, gifts, etc.) — not inflation-linked
  const otherBase = src.otherIncome.enabled &&
    personAge >= src.otherIncome.startAge &&
    (src.otherIncome.stopAge === 0 || personAge < src.otherIncome.stopAge)
    ? src.otherIncome.annualAmount : 0;

  // Property rental income — runs for durationYears from year 0
  // For joint property, both persons can have the same property; only count once (handled at call site)
  const rent = assets.property.enabled &&
    assets.property.annualRent > 0 &&
    yearIndex < assets.property.durationYears
    ? assets.property.annualRent : 0;

  return { sp, db, ptw, other: otherBase + annuity, rent };
}

// ─── Stage lookup ─────────────────────────────────────────────────────────────

function getStageForAge(stages: LifeStage[], age: number): LifeStage {
  return (
    stages.find(s => age >= s.startAge && age <= s.endAge) ??
    // Pre-FI working years use the first stage's spending as a baseline
    (age < stages[0].startAge ? stages[0] : stages[stages.length - 1])
  );
}

function getAnnualDcContribution(
  dcPension: PersonIncomeSources['dcPension'],
  yearIndex: number,
  inflationRate: number,
): number {
  const inflFactor = Math.pow(1 + inflationRate / 100, yearIndex);
  const workplaceSalary = Math.max(0, dcPension.workplaceSalary ?? 0);
  const workplaceContributionPercent = Math.max(0, dcPension.workplaceContributionPercent ?? 0);
  const sippContributionAnnualGross = Math.max(0, dcPension.sippContributionAnnualGross ?? 0);

  const workplaceContribution = workplaceSalary > 0 && workplaceContributionPercent > 0
    ? workplaceSalary * inflFactor * (workplaceContributionPercent / 100)
    : 0;
  const sippContribution = sippContributionAnnualGross > 0
    ? sippContributionAnnualGross * inflFactor
    : 0;

  return workplaceContribution + sippContribution;
}

// ─── Main projection loop ─────────────────────────────────────────────────────

export function calculateProjections(state: PlannerState, options?: ProjectionOptions): YearlyProjection[] {
  const { person1, person2, lifeStages, spendingCategories, assumptions, mode, fiAge, jointGia } = state;
  const { lifeExpectancy, inflation, investmentGrowth } = assumptions;
  const drawdownStrategy = state.drawdownStrategy ?? 'standard-ufpls';
  const isPclsBedIsa = drawdownStrategy === 'pcls-bed-isa';

  // Bucket ladder feature flag. When disabled (the default), this whole module
  // behaves exactly as before — same per-pot growth rates, no bucket tracking,
  // no rebalance actions, no shock injection.
  const bucketLadder = state.bucketLadderConfig;
  const ladderEnabled = Boolean(bucketLadder?.enabled);

  // Resolve person2's FI age: user-specified, else preserve original household behaviour
  // by computing the age person2 would be when person1 reaches fiAge. This ensures
  // existing couple plans (where p2FiAge was never stored) continue to produce identical
  // projections to before this field was introduced.
  const p2FiAge = state.p2FiAge ??
    (mode === 'couple' ? person2.currentAge + (fiAge - person1.currentAge) : fiAge);

  // Resolve the PCLS crystallisation age: user-specified (≥ current age and NMPA), else fiAge.
  // NMPA is 55 before calendar year 2028, rising to 57 from 2028 onwards.
  const rawPclsAge = state.pclsAge ?? fiAge;
  const pclsCalendarYear = CURRENT_TAX_YEAR_START + (rawPclsAge - person1.currentAge);
  const nmpa = pclsCalendarYear >= PENSION_RULES.NMPA_RISE_YEAR
    ? PENSION_RULES.MIN_ACCESS_AGE_POST_2028
    : PENSION_RULES.MIN_ACCESS_AGE;
  // Prevent the crystallisation event from being scheduled in the past.
  const resolvedPclsAge = Math.max(rawPclsAge, nmpa, person1.currentAge);

  // ── Initialise asset balances ──────────────────────────────────────────────
  let p1Isa   = person1.assets.isaInvestments.enabled     ? person1.assets.isaInvestments.totalValue     : 0;
  let p1GiaV  = person1.assets.generalInvestments.enabled ? person1.assets.generalInvestments.totalValue : 0;
  let p1GiaBC = person1.assets.generalInvestments.enabled ? person1.assets.generalInvestments.baseCost   : 0;
  let p1Cash  = person1.assets.cashSavings.enabled        ? person1.assets.cashSavings.totalValue        : 0;
  let p1Dc    = person1.incomeSources.dcPension.enabled   ? person1.incomeSources.dcPension.totalValue   : 0;

  let p2Isa   = (mode === 'couple' && person2.assets.isaInvestments.enabled)     ? person2.assets.isaInvestments.totalValue     : 0;
  let p2GiaV  = (mode === 'couple' && person2.assets.generalInvestments.enabled) ? person2.assets.generalInvestments.totalValue : 0;
  let p2GiaBC = (mode === 'couple' && person2.assets.generalInvestments.enabled) ? person2.assets.generalInvestments.baseCost   : 0;
  let p2Cash  = (mode === 'couple' && person2.assets.cashSavings.enabled)        ? person2.assets.cashSavings.totalValue        : 0;
  let p2Dc    = (mode === 'couple' && person2.incomeSources.dcPension.enabled)   ? person2.incomeSources.dcPension.totalValue   : 0;

  // ── Joint GIA (top-level shared asset, couple mode only) ─────────────────
  let jointGiaV  = (mode === 'couple' && jointGia.enabled) ? jointGia.totalValue : 0;
  let jointGiaBC = (mode === 'couple' && jointGia.enabled) ? jointGia.baseCost   : 0;

  // ── Per-asset growth rates (fall back to global investmentGrowth) ──────────
  // When the bucket ladder is enabled, each pot's flat growth rate is replaced
  // with a value-weighted blend derived from its holdings or quick-mode allocation
  // (see blendGrowthRateForPot). Pots with no allocation info fall back to the
  // pot's existing growthRate — preserving today's output for plans that haven't
  // opted in to itemising their assets.
  const p1IsaRate    = person1.assets.isaInvestments.growthRate     ?? investmentGrowth;
  const p1GiaRate    = person1.assets.generalInvestments.growthRate ?? investmentGrowth;
  const p1DcRate     = person1.incomeSources.dcPension.growthRate   ?? investmentGrowth;
  const p2IsaRate    = person2.assets.isaInvestments.growthRate     ?? investmentGrowth;
  const p2GiaRate    = person2.assets.generalInvestments.growthRate ?? investmentGrowth;
  const p2DcRate     = person2.incomeSources.dcPension.growthRate   ?? investmentGrowth;
  const jointGiaRate = jointGia.growthRate ?? investmentGrowth;

  const p1IsaG = (ladderEnabled
    ? blendGrowthRateForPot(person1.assets.isaInvestments, p1IsaRate)
    : p1IsaRate) / 100;
  const p1GiaG = (ladderEnabled
    ? blendGrowthRateForPot(person1.assets.generalInvestments, p1GiaRate)
    : p1GiaRate) / 100;
  const p1DcG = (ladderEnabled
    ? blendGrowthRateForPot(person1.incomeSources.dcPension, p1DcRate)
    : p1DcRate) / 100;
  const p2IsaG = (ladderEnabled
    ? blendGrowthRateForPot(person2.assets.isaInvestments, p2IsaRate)
    : p2IsaRate) / 100;
  const p2GiaG = (ladderEnabled
    ? blendGrowthRateForPot(person2.assets.generalInvestments, p2GiaRate)
    : p2GiaRate) / 100;
  const p2DcG = (ladderEnabled
    ? blendGrowthRateForPot(person2.incomeSources.dcPension, p2DcRate)
    : p2DcRate) / 100;
  const jointGiaG = (ladderEnabled
    ? blendGrowthRateForPot(jointGia, jointGiaRate)
    : jointGiaRate) / 100;

  // ── Care Reserve — earmarked capital, invested but not drawn for spending ─
  // Grows at the portfolio investment growth rate each year.
  // Never enters the drawdown waterfall; tracked separately in projections.
  let careReserveBalance = (state.careReserve?.enabled && state.careReserve.amount > 0)
    ? state.careReserve.amount : 0;

  // ── Lifetime tax-free UFPLS tracking — accumulates against the LSA ─────
  // The LSA (£268,275 per person) caps total tax-free cash from pensions.
  // Each year's DC withdrawal contributes 25% tax-free to this running total.
  // Once the LSA is exhausted, DC withdrawals become fully taxable.
  let p1LifetimePcls = 0;
  let p2LifetimePcls = 0;

  const maxYears   = lifeExpectancy - person1.currentAge;
  const projections: YearlyProjection[] = [];

  // Track prior-year growth bucket value so we can compute the % change and feed
  // it to calculateRebalancingActions (drives the SORR-pause behaviour).
  let prevGrowthBucketValue = 0;

  for (let y = 0; y <= maxYears; y++) {
    const p1Age      = person1.currentAge + y;
    const p2Age      = mode === 'couple' ? person2.currentAge + y : null;
    const inflFactor = Math.pow(1 + inflation / 100, y);
    const householdFiStarted = p1Age >= fiAge;

    // Calendar year for this simulation iteration — used to look up the correct
    // HMRC tax rule snapshot (income tax bands, CGT rates, pension LSA).
    const calendarYear   = CURRENT_TAX_YEAR_START + y;
    const yearSnapshot   = getSnapshotForYear(calendarYear);
    const yearPensionLsa = yearSnapshot.pension.lsa;
    const yearUfplsFrac  = yearSnapshot.pension.ufplsTaxFreeFraction;

    // ── Spending (inflation-adjusted from today's £) ───────────────────────
    const stage       = getStageForAge(lifeStages, p1Age);
    const baseSpend   = spendingCategories.reduce((s, c) => s + (c.amounts[stage.id] ?? 0), 0) * inflFactor;
    const eventSpend  = (state.plannedEvents ?? [])
      .filter((e) => e.p1Age === p1Age)
      .reduce((s, e) => s + (e.inflationLinked ? e.amount * inflFactor : e.amount), 0);

    // During the gap period P1 has retired but P2 is still working — use gapSpending
    // as the spending target if the user has set one, otherwise fall back to baseSpend.
    const inGapPeriod = householdFiStarted && mode === 'couple' && p2Age !== null && p2Age < p2FiAge;
    const gapSpendTarget = state.gapSpending !== undefined
      ? state.gapSpending * inflFactor
      : baseSpend;
    const spending    = (inGapPeriod ? gapSpendTarget : baseSpend) + eventSpend;

    // ── Fixed income ──────────────────────────────────────────────────────
    const p1Inc = personIncome(person1.incomeSources, person1.assets, p1Age, y, inflation);
    const p2Inc = mode === 'couple' && p2Age !== null
      ? personIncome(person2.incomeSources, person2.assets, p2Age, y, inflation)
      : { sp: 0, db: 0, ptw: 0, other: 0, rent: 0 };

    // For joint property: avoid double-counting rent — use only person1's rent figure
    const jointPropP1 = person1.assets.property.owner === 'joint';
    const p2RentEffective = jointPropP1 ? 0 : p2Inc.rent; // already counted in p1Inc.rent

    const fixedIncome = p1Inc.sp + p1Inc.db + p1Inc.ptw + p1Inc.other + p1Inc.rent
                      + p2Inc.sp + p2Inc.db + p2Inc.ptw + p2Inc.other + p2RentEffective
                      + (inGapPeriod
                          ? Math.max(0, (person2.incomeSources.dcPension.workplaceSalary ?? 0) * inflFactor * GAP_PERIOD_NET_SALARY_FACTOR)
                          : 0);
    const p2GapSalary = inGapPeriod
      ? Math.max(0, (person2.incomeSources.dcPension.workplaceSalary ?? 0) * inflFactor * GAP_PERIOD_NET_SALARY_FACTOR)
      : 0;

    // ── Shock injection + growth + contributions (extracted helpers) ─────
    const p2FiStarted = mode === 'couple' && p2Age !== null ? p2Age >= p2FiAge : true;
    const yearBal: YearBalances = {
      p1Isa, p1GiaV, p1GiaBC, p1Cash, p1Dc, p1LifetimePcls,
      p2Isa, p2GiaV, p2GiaBC, p2Cash, p2Dc, p2LifetimePcls,
      jointGiaV, jointGiaBC,
      careReserveBalance,
    };
    if (options?.growthShockYear === y && options?.growthShockPercent && options.growthShockPercent > 0) {
      applyGrowthShockToBalances(yearBal, {
        shockFrac: options.growthShockPercent / 100,
        ladderEnabled,
        person1, person2, jointGia,
      });
    }
    applyAssetGrowth(yearBal, {
      p1IsaG, p1GiaG, p1DcG, p2IsaG, p2GiaG, p2DcG, jointGiaG,
      careReserveGrowth: investmentGrowth / 100,
    });
    applyAnnualContributions(yearBal, {
      state, mode, householdFiStarted, p2FiStarted,
      yearIndex: y, inflation, inflFactor,
    });
    ({
      p1Isa, p1GiaV, p1GiaBC, p1Cash, p1Dc, p1LifetimePcls,
      p2Isa, p2GiaV, p2GiaBC, p2Cash, p2Dc, p2LifetimePcls,
      jointGiaV, jointGiaBC,
      careReserveBalance,
    } = yearBal);

    // ── DC pension source handles ─────────────────────────────────────────
    const dc1 = person1.incomeSources.dcPension;
    const dc2 = person2.incomeSources.dcPension;

    // ── Taxable fixed income per person (constant regardless of draw amounts) ──
    const p1TaxableFixed = p1Inc.sp + p1Inc.db + p1Inc.ptw + p1Inc.other + p1Inc.rent;
    const p2TaxableFixed = p2Inc.sp + p2Inc.db + p2Inc.ptw + p2Inc.other + p2RentEffective;
    const spExempt = assumptions.statePensionSoleIncomeExempt ?? true;

    // ── PCLS + Bed & ISA strategy — pre-waterfall adjustments (extracted helpers) ─
    // Modify asset balances BEFORE the gross-up snapshot so the changes are
    // permanent for the year and not repeated on each gross-up iteration.
    const bedIsaBalances: BedIsaBalances = {
      p1Isa, p1GiaV, p1GiaBC, p1Dc, p1LifetimePcls,
      p2Isa, p2GiaV, p2GiaBC,
      jointGiaV, jointGiaBC,
    };
    const pclsResult = isPclsBedIsa
      ? applyPclsCrystallisation(bedIsaBalances, {
          mode, p1Age, resolvedPclsAge,
          dc1Enabled: dc1.enabled,
          yearPensionLsa, yearUfplsFrac,
          isaAnnualAllowance: yearSnapshot.isaAnnualAllowance,
        })
      : { p1PclsEvent: 0, p1IsaAllowanceUsed: 0, p2IsaAllowanceUsed: 0 };
    const bedIsaTransfers = applyAnnualBedIsa(bedIsaBalances, {
      mode, p2Age, householdFiStarted,
      isaAnnualAllowance: yearSnapshot.isaAnnualAllowance,
      initialAllowanceUsed: { p1: pclsResult.p1IsaAllowanceUsed, p2: pclsResult.p2IsaAllowanceUsed },
    });
    // Sync back to outer let-vars (Stage A keeps the existing variable shape).
    p1Isa = bedIsaBalances.p1Isa; p1GiaV = bedIsaBalances.p1GiaV; p1GiaBC = bedIsaBalances.p1GiaBC;
    p1Dc  = bedIsaBalances.p1Dc;  p1LifetimePcls = bedIsaBalances.p1LifetimePcls;
    p2Isa = bedIsaBalances.p2Isa; p2GiaV = bedIsaBalances.p2GiaV; p2GiaBC = bedIsaBalances.p2GiaBC;
    jointGiaV = bedIsaBalances.jointGiaV; jointGiaBC = bedIsaBalances.jointGiaBC;
    const p1PclsEvent = pclsResult.p1PclsEvent;
    const {
      p1IndivBedIsaTransfer, p1JointBedIsaTransfer, p1BedIsaCg,
      p2IndivBedIsaTransfer, p2JointBedIsaTransfer, p2IndivBedIsaCg, p2BedIsaCg,
    } = bedIsaTransfers;

    // ── Save asset state after growth (and after PCLS/B&I), before drawdown ──
    // Needed to restore between gross-up iterations.
    const preDrawSnap = {
      p1Isa, p1GiaV, p1GiaBC, p1Cash, p1Dc,
      p2Isa, p2GiaV, p2GiaBC, p2Cash, p2Dc,
      jointGiaV, jointGiaBC,
      p1LifetimePcls, p2LifetimePcls,
    };

    // ── Drawdown gross-up iteration (extracted to helper for testability) ─
    const drawResult = runGrossUpWaterfall({
      preDrawSnap,
      spending, fixedIncome,
      mode, householdFiStarted, p2Age,
      yearSnapshot, yearPensionLsa, yearUfplsFrac,
      calendarYear, spExempt,
      p1TaxableFixed, p2TaxableFixed,
      p1BedIsaCg, p2IndivBedIsaCg, p2BedIsaCg,
      p1Inc, p2Inc, p2RentEffective,
      dc1Enabled: dc1.enabled,
      dc2Enabled: dc2.enabled,
    });
    ({ p1Isa, p1GiaV, p1GiaBC, p1Cash, p1Dc,
       p2Isa, p2GiaV, p2GiaBC, p2Cash, p2Dc,
       jointGiaV, jointGiaBC,
       p1LifetimePcls, p2LifetimePcls } = drawResult.balances);
    const {
      p1IsaD, p1GiaD, p1GiaCG, p1CashD, p1DcD, p1DcTaxFree,
      p2IsaD, p2GiaD, p2GiaCG, p2CashD, p2DcD, p2DcTaxFree,
      jointGiaD,
    } = drawResult.draws;
    const {
      totalIncome, totalTaxPaid, incomeTaxPaid, totalCgtPaid,
      p1IncomeTax, p2IncomeTax, p1CgtPaid, p2CgtPaid,
    } = drawResult.totals;

    const netIncome = totalIncome - totalTaxPaid;

    const clamp = (v: number) => Math.max(0, v);

    // ── Bucket ladder bookkeeping (only when enabled; see helper below) ──
    const bucketSnapshot = ladderEnabled && bucketLadder
      ? computeBucketSnapshot({
          bucketLadder, mode, spending, yearIndex: y,
          prevGrowthBucketValue,
          pots: [
            { currentValue: p1Isa,  def: person1.assets.isaInvestments,     enabled: person1.assets.isaInvestments.enabled },
            { currentValue: p1GiaV, def: person1.assets.generalInvestments, enabled: person1.assets.generalInvestments.enabled },
            { currentValue: p1Dc,   def: person1.incomeSources.dcPension,   enabled: person1.incomeSources.dcPension.enabled },
            { currentValue: p2Isa,  def: person2.assets.isaInvestments,     enabled: person2.assets.isaInvestments.enabled },
            { currentValue: p2GiaV, def: person2.assets.generalInvestments, enabled: person2.assets.generalInvestments.enabled },
            { currentValue: p2Dc,   def: person2.incomeSources.dcPension,   enabled: person2.incomeSources.dcPension.enabled },
            { currentValue: jointGiaV, def: jointGia, enabled: jointGia.enabled },
          ],
          cashSavings:
            p1Cash + (mode === 'couple' ? p2Cash : 0),
        })
      : null;
    const bucketValuesOut = bucketSnapshot?.bucketValues;
    const rebalanceActionsOut = bucketSnapshot?.rebalanceActions;
    if (bucketSnapshot) prevGrowthBucketValue = bucketSnapshot.bucketValues.growth;

    projections.push({
      yearIndex: y,
      p1Age, p2Age,
      lifeStage: stage.label,
      spending,

      p1StatePension: p1Inc.sp, p1DbPension: p1Inc.db, p1PartTimeWork: p1Inc.ptw,
      p1OtherIncome: p1Inc.other, p1PropertyRent: p1Inc.rent,
      p2StatePension: p2Inc.sp, p2DbPension: p2Inc.db, p2PartTimeWork: p2Inc.ptw,
      p2OtherIncome: p2Inc.other, p2PropertyRent: p2RentEffective,
      p2GapSalary: Math.round(p2GapSalary),

      p1IsaDrawdown: p1IsaD, p1GiaDrawdown: p1GiaD, p1CashDrawdown: p1CashD, p1DcDrawdown: p1DcD,
      p2IsaDrawdown: p2IsaD, p2GiaDrawdown: p2GiaD, p2CashDrawdown: p2CashD, p2DcDrawdown: p2DcD,

      isaDrawdown:  p1IsaD  + p2IsaD,
      giaDrawdown:  p1GiaD  + p2GiaD + jointGiaD,
      cashDrawdown: p1CashD + p2CashD,
      dcDrawdown:   p1DcD   + p2DcD,
      dcTaxFreeDrawdown: p1DcTaxFree + p2DcTaxFree,
      propertyRent: p1Inc.rent + p2RentEffective,

      p1CapitalGain: p1GiaCG, p2CapitalGain: p2GiaCG,
      p1CgtPaid, p2CgtPaid, totalCgtPaid,
      p1IncomeTax, p2IncomeTax, incomeTaxPaid,

      totalIncome, totalTaxPaid, netIncome,
      gap: totalIncome - spending,

      p1IsaBalance:  clamp(p1Isa),  p1GiaValue: clamp(p1GiaV), p1GiaBaseCost: clamp(p1GiaBC),
      p1CashBalance: clamp(p1Cash), p1DcBalance: clamp(p1Dc),
      p2IsaBalance:  clamp(p2Isa),  p2GiaValue: clamp(p2GiaV), p2GiaBaseCost: clamp(p2GiaBC),
      p2CashBalance: clamp(p2Cash), p2DcBalance: clamp(p2Dc),
      jointGiaValue: clamp(jointGiaV), jointGiaBaseCost: clamp(jointGiaBC),
      // totalAssets excludes care reserve — depletion logic should only fire when
      // spendable assets are exhausted, not earmarked capital.
      totalAssets: clamp(p1Isa) + clamp(p1GiaV) + clamp(p1Cash) + clamp(p1Dc)
                 + clamp(p2Isa) + clamp(p2GiaV) + clamp(p2Cash) + clamp(p2Dc)
                 + clamp(jointGiaV),
      // Care reserve tracked separately — earmarked, never drawn for spending.
      careReserveBalance: Math.round(careReserveBalance),

      // PCLS + Bed & ISA strategy tracking (zero in standard-ufpls mode)
      p1PclsEvent: Math.round(p1PclsEvent),
      p1IndivBedIsaTransfer: Math.round(p1IndivBedIsaTransfer),
      p1JointBedIsaTransfer: Math.round(p1JointBedIsaTransfer),
      p1BedIsaTransfer:      Math.round(p1IndivBedIsaTransfer) + Math.round(p1JointBedIsaTransfer),
      p2IndivBedIsaTransfer: Math.round(p2IndivBedIsaTransfer),
      p2JointBedIsaTransfer: Math.round(p2JointBedIsaTransfer),
      p2BedIsaTransfer:      Math.round(p2IndivBedIsaTransfer) + Math.round(p2JointBedIsaTransfer),
      plannedEventSpend:     Math.round(eventSpend),

      bucketValues:     bucketValuesOut,
      rebalanceActions: rebalanceActionsOut,
    });
  }

  return projections;
}

// ─── Per-year balance helpers ────────────────────────────────────────────────

/** All mutable per-year pot balances + care reserve. */
interface YearBalances extends DrawBalances {
  careReserveBalance: number;
}

interface GrowthRates {
  p1IsaG: number; p1GiaG: number; p1DcG: number;
  p2IsaG: number; p2GiaG: number; p2DcG: number;
  jointGiaG: number;
  careReserveGrowth: number;
}

/** Apply a market shock to growth-bucket exposure (or whole pots when ladder disabled). */
function applyGrowthShockToBalances(
  b: YearBalances,
  ctx: { shockFrac: number; ladderEnabled: boolean; person1: Person; person2: Person; jointGia: GIAAsset },
): void {
  const shock = (currentValue: number, potDef: PotLike): number => {
    if (currentValue <= 0) return currentValue;
    if (!ctx.ladderEnabled) return currentValue * (1 - ctx.shockFrac);
    const split = resolvePotBucketSplit({
      holdings: potDef.holdings,
      allocation: potDef.allocation,
      totalValue: currentValue,
    });
    return Math.max(0, currentValue - split.growth * ctx.shockFrac);
  };
  b.p1Isa     = shock(b.p1Isa,     ctx.person1.assets.isaInvestments);
  b.p1GiaV    = shock(b.p1GiaV,    ctx.person1.assets.generalInvestments);
  b.p1Dc      = shock(b.p1Dc,      ctx.person1.incomeSources.dcPension);
  b.p2Isa     = shock(b.p2Isa,     ctx.person2.assets.isaInvestments);
  b.p2GiaV    = shock(b.p2GiaV,    ctx.person2.assets.generalInvestments);
  b.p2Dc      = shock(b.p2Dc,      ctx.person2.incomeSources.dcPension);
  b.jointGiaV = shock(b.jointGiaV, ctx.jointGia);
}

/** Apply per-pot annual growth (1+r) plus care-reserve growth. */
function applyAssetGrowth(b: YearBalances, r: GrowthRates): void {
  if (b.p1Isa            > 0) b.p1Isa            *= (1 + r.p1IsaG);
  if (b.p1GiaV           > 0) b.p1GiaV           *= (1 + r.p1GiaG);
  if (b.p1Dc             > 0) b.p1Dc             *= (1 + r.p1DcG);
  if (b.p2Isa            > 0) b.p2Isa            *= (1 + r.p2IsaG);
  if (b.p2GiaV           > 0) b.p2GiaV           *= (1 + r.p2GiaG);
  if (b.p2Dc             > 0) b.p2Dc             *= (1 + r.p2DcG);
  if (b.jointGiaV        > 0) b.jointGiaV        *= (1 + r.jointGiaG);
  if (b.careReserveBalance > 0) b.careReserveBalance *= (1 + r.careReserveGrowth);
}

/**
 * Apply pre-FI annual contributions: DC (workplace + SIPP), ISA, and GIA per
 * person, plus the joint GIA. Each contributes only while the relevant person
 * is still pre-FI; the joint GIA continues while either person is pre-FI.
 */
function applyAnnualContributions(
  b: YearBalances,
  ctx: {
    state: PlannerState;
    mode: 'single' | 'couple';
    householdFiStarted: boolean;
    p2FiStarted: boolean;
    yearIndex: number;
    inflation: number;
    inflFactor: number;
  },
): void {
  const { state, mode, householdFiStarted, p2FiStarted, yearIndex, inflation, inflFactor } = ctx;
  const { person1, person2, jointGia } = state;

  if (!householdFiStarted) {
    applyPersonPreFiContributions(b, 'p1', person1, yearIndex, inflation, inflFactor);
  }
  if (!p2FiStarted && mode === 'couple') {
    applyPersonPreFiContributions(b, 'p2', person2, yearIndex, inflation, inflFactor);
  }
  // Joint GIA contributions continue while either person is pre-FI.
  if ((!householdFiStarted || !p2FiStarted) && mode === 'couple' && jointGia.enabled) {
    const jointGiaContrib = (jointGia.annualContribution ?? 0) * inflFactor;
    if (jointGiaContrib > 0) { b.jointGiaV += jointGiaContrib; b.jointGiaBC += jointGiaContrib; }
  }
}

function applyPersonPreFiContributions(
  b: YearBalances, who: 'p1' | 'p2', person: Person,
  yearIndex: number, inflation: number, inflFactor: number,
): void {
  const dcKey: 'p1Dc' | 'p2Dc' = who === 'p1' ? 'p1Dc' : 'p2Dc';
  const isaKey: 'p1Isa' | 'p2Isa' = who === 'p1' ? 'p1Isa' : 'p2Isa';
  const giaKey: 'p1GiaV' | 'p2GiaV' = who === 'p1' ? 'p1GiaV' : 'p2GiaV';
  const bcKey:  'p1GiaBC' | 'p2GiaBC' = who === 'p1' ? 'p1GiaBC' : 'p2GiaBC';

  if (person.incomeSources.dcPension.enabled) {
    b[dcKey] += getAnnualDcContribution(person.incomeSources.dcPension, yearIndex, inflation);
  }
  const isaContrib = person.assets.isaInvestments.enabled
    ? (person.assets.isaInvestments.annualContribution ?? 0) * inflFactor
    : 0;
  if (isaContrib > 0) b[isaKey] += isaContrib;

  const giaContrib = person.assets.generalInvestments.enabled
    ? (person.assets.generalInvestments.annualContribution ?? 0) * inflFactor
    : 0;
  if (giaContrib > 0) { b[giaKey] += giaContrib; b[bcKey] += giaContrib; }
}

// ─── PCLS + Bed & ISA helpers ────────────────────────────────────────────────

/** Subset of pot balances touched by the PCLS and Bed & ISA steps. Mutated in place. */
interface BedIsaBalances {
  p1Isa: number; p1GiaV: number; p1GiaBC: number; p1Dc: number; p1LifetimePcls: number;
  p2Isa: number; p2GiaV: number; p2GiaBC: number;
  jointGiaV: number; jointGiaBC: number;
}

interface BedIsaTransfers {
  p1IndivBedIsaTransfer: number;
  p1JointBedIsaTransfer: number;
  p1BedIsaCg: number;
  p2IndivBedIsaTransfer: number;
  p2JointBedIsaTransfer: number;
  p2IndivBedIsaCg: number;
  /** Total joint-GIA Bed & ISA gain (split 50/50 between persons for CGT). */
  p2BedIsaCg: number;
}

/**
 * PCLS crystallisation event (pcls-bed-isa strategy only).
 * Takes person1's maximum tax-free lump sum at `resolvedPclsAge`, reinvests
 * into ISA wrappers first then GIA. Mutates balances and returns the event
 * amount + ISA allowance usage.
 */
function applyPclsCrystallisation(
  b: BedIsaBalances,
  ctx: {
    mode: 'single' | 'couple';
    p1Age: number;
    resolvedPclsAge: number;
    dc1Enabled: boolean;
    yearPensionLsa: number;
    yearUfplsFrac: number;
    isaAnnualAllowance: number;
  },
): { p1PclsEvent: number; p1IsaAllowanceUsed: number; p2IsaAllowanceUsed: number } {
  if (ctx.p1Age !== ctx.resolvedPclsAge || b.p1Dc <= 0 || !ctx.dc1Enabled) {
    return { p1PclsEvent: 0, p1IsaAllowanceUsed: 0, p2IsaAllowanceUsed: 0 };
  }
  const remainingPensionLsa = Math.max(0, ctx.yearPensionLsa - b.p1LifetimePcls);
  const pclsAmount = Math.min(b.p1Dc * ctx.yearUfplsFrac, remainingPensionLsa);
  if (pclsAmount <= 0) {
    return { p1PclsEvent: 0, p1IsaAllowanceUsed: 0, p2IsaAllowanceUsed: 0 };
  }

  b.p1Dc -= pclsAmount;
  b.p1LifetimePcls = Math.min(ctx.yearPensionLsa, b.p1LifetimePcls + pclsAmount);

  const p1ToIsa = Math.min(pclsAmount, ctx.isaAnnualAllowance);
  const afterP1Isa = pclsAmount - p1ToIsa;
  const p2ToIsa = ctx.mode === 'couple' && afterP1Isa > 0
    ? Math.min(afterP1Isa, ctx.isaAnnualAllowance)
    : 0;
  const toGia = afterP1Isa - p2ToIsa;

  b.p1Isa += p1ToIsa;
  if (p2ToIsa > 0) b.p2Isa += p2ToIsa;
  if (toGia > 0) {
    if (ctx.mode === 'couple') { b.jointGiaV += toGia; b.jointGiaBC += toGia; }
    else                       { b.p1GiaV    += toGia; b.p1GiaBC    += toGia; }
  }
  return { p1PclsEvent: pclsAmount, p1IsaAllowanceUsed: p1ToIsa, p2IsaAllowanceUsed: p2ToIsa };
}

/**
 * Annual Bed & ISA — all strategies, FI years only.
 * Shelters GIA assets into ISA wrappers up to each person's remaining annual
 * allowance (already reduced by any PCLS reinvestment above). Mutates balances
 * and returns transfer + capital-gain totals for CGT calculation downstream.
 */
function applyAnnualBedIsa(
  b: BedIsaBalances,
  ctx: {
    mode: 'single' | 'couple';
    p2Age: number | null;
    householdFiStarted: boolean;
    isaAnnualAllowance: number;
    initialAllowanceUsed: { p1: number; p2: number };
  },
): BedIsaTransfers {
  const transfers: BedIsaTransfers = {
    p1IndivBedIsaTransfer: 0, p1JointBedIsaTransfer: 0, p1BedIsaCg: 0,
    p2IndivBedIsaTransfer: 0, p2JointBedIsaTransfer: 0, p2IndivBedIsaCg: 0, p2BedIsaCg: 0,
  };
  if (!ctx.householdFiStarted) return transfers;

  const used = { p1: ctx.initialAllowanceUsed.p1, p2: ctx.initialAllowanceUsed.p2 };

  // p1 individual GIA → p1 ISA
  transferIndivGiaToIsa(b, transfers, used, ctx.isaAnnualAllowance, 'p1');

  // p2 individual GIA → p2 ISA (couple only)
  if (ctx.mode === 'couple') {
    transferIndivGiaToIsa(b, transfers, used, ctx.isaAnnualAllowance, 'p2');
  }

  // joint GIA → p1 ISA
  transferJointGiaToIsa(b, transfers, used, ctx.isaAnnualAllowance, 'p1');

  // joint GIA → p2 ISA (couple only)
  if (ctx.mode === 'couple' && ctx.p2Age !== null) {
    transferJointGiaToIsa(b, transfers, used, ctx.isaAnnualAllowance, 'p2');
  }
  return transfers;
}

function transferIndivGiaToIsa(
  b: BedIsaBalances, t: BedIsaTransfers, used: { p1: number; p2: number },
  isaAnnualAllowance: number, who: 'p1' | 'p2',
): void {
  const giaKey: 'p1GiaV' | 'p2GiaV' = who === 'p1' ? 'p1GiaV' : 'p2GiaV';
  const bcKey:  'p1GiaBC' | 'p2GiaBC' = who === 'p1' ? 'p1GiaBC' : 'p2GiaBC';
  const isaKey: 'p1Isa' | 'p2Isa' = who === 'p1' ? 'p1Isa' : 'p2Isa';

  const allowance = isaAnnualAllowance - used[who];
  if (b[giaKey] <= 0 || allowance <= 0) return;
  const biAmount = Math.min(b[giaKey], allowance);
  if (biAmount <= 0) return;

  const r = drawFromGIA(b[giaKey], b[bcKey], biAmount);
  if (who === 'p1') {
    t.p1IndivBedIsaTransfer += r.drawn;
    t.p1BedIsaCg            += r.capitalGain;
  } else {
    t.p2IndivBedIsaTransfer += r.drawn;
    t.p2IndivBedIsaCg       += r.capitalGain;
  }
  b[giaKey] = r.newValue;
  b[bcKey]  = r.newBaseCost;
  b[isaKey] += r.drawn;
  used[who] += r.drawn;
}

function transferJointGiaToIsa(
  b: BedIsaBalances, t: BedIsaTransfers, used: { p1: number; p2: number },
  isaAnnualAllowance: number, who: 'p1' | 'p2',
): void {
  const isaKey: 'p1Isa' | 'p2Isa' = who === 'p1' ? 'p1Isa' : 'p2Isa';
  const allowance = isaAnnualAllowance - used[who];
  if (b.jointGiaV <= 0 || allowance <= 0) return;
  const biAmount = Math.min(b.jointGiaV, allowance);
  if (biAmount <= 0) return;

  const r = drawFromGIA(b.jointGiaV, b.jointGiaBC, biAmount);
  if (who === 'p1') t.p1JointBedIsaTransfer += r.drawn;
  else              t.p2JointBedIsaTransfer += r.drawn;
  // Joint disposal CG splits 50/50 — stored on the legacy p2BedIsaCg field
  // (the consumer in computeIterationTaxes halves it for each person).
  t.p2BedIsaCg += r.capitalGain;
  b.jointGiaV   = r.newValue;
  b.jointGiaBC  = r.newBaseCost;
  b[isaKey]    += r.drawn;
  used[who]    += r.drawn;
}

// ─── Drawdown waterfall helpers ──────────────────────────────────────────────

/**
 * Run the gross-up drawdown waterfall for a single simulation year.
 *
 * Iterates up to 4 passes: each pass restores asset balances to the pre-draw
 * snapshot, executes the 6-step waterfall to cover `grossTarget`, computes tax
 * on the resulting income, then re-targets to `spending + tax` for the next
 * pass. Converges when `|newTarget − grossTarget| < 1` (1 £).
 *
 * Extracted from calculateProjections to keep the per-year loop readable.
 * The function mutates a local Balances object internally and returns the
 * final state — no external mutation.
 */
function runGrossUpWaterfall(ctx: WaterfallContext): WaterfallResult {
  let balances: DrawBalances = { ...ctx.preDrawSnap };
  let draws: DrawAmounts = emptyDraws();
  let totals: DrawTaxes = emptyTotals();
  let grossTarget = ctx.spending;

  for (let grossIter = 0; grossIter < 4; grossIter++) {
    balances = { ...ctx.preDrawSnap };
    draws = emptyDraws();
    const remainingAfterWaterfall = runWaterfallSteps(balances, draws, ctx, grossTarget - ctx.fixedIncome);
    if (remainingAfterWaterfall < 0) {
      // Surplus (fixed income exceeded gross target) — park in P1 cash.
      balances.p1Cash += -remainingAfterWaterfall;
    }
    totals = computeIterationTaxes(balances, draws, ctx);
    const newTarget = ctx.spending + totals.totalTaxPaid;
    if (Math.abs(newTarget - grossTarget) < 1) break;
    grossTarget = newTarget;
  }

  return { balances, draws, totals };
}

function emptyDraws(): DrawAmounts {
  return {
    p1IsaD: 0, p1GiaD: 0, p1GiaCG: 0, p1CashD: 0, p1DcD: 0, p1DcTaxFree: 0,
    p2IsaD: 0, p2GiaD: 0, p2GiaCG: 0, p2CashD: 0, p2DcD: 0, p2DcTaxFree: 0,
    jointGiaD: 0, jointGiaCG: 0,
  };
}

function emptyTotals(): DrawTaxes {
  return {
    totalIncome: 0, totalTaxPaid: 0, incomeTaxPaid: 0, totalCgtPaid: 0,
    p1IncomeTax: 0, p2IncomeTax: 0, p1CgtPaid: 0, p2CgtPaid: 0,
  };
}

/** Run all 6 waterfall steps. Returns the remaining gap (can be negative = surplus). */
function runWaterfallSteps(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, initialRemaining: number): number {
  if (initialRemaining <= 0) return initialRemaining;
  let remaining = initialRemaining;
  remaining = stepDcWithinAllowance(b, d, ctx, remaining);
  remaining = stepGiaWithinCgtBudget(b, d, ctx, remaining);
  remaining = stepIsaDrawdown(b, d, ctx, remaining);
  remaining = stepGiaRemaining(b, d, ctx, remaining);
  remaining = stepCashDrawdown(b, d, ctx, remaining);
  remaining = stepDcAboveAllowance(b, d, ctx, remaining);
  return remaining;
}

/**
 * Step 1: DC pension (UFPLS) up to personal allowance headroom.
 * Each UFPLS draw is 75% taxable; drawing within the headroom keeps effective
 * income tax at 0% and leaves the pension growing tax-free for longer.
 */
function stepDcWithinAllowance(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number): number {
  if (!ctx.householdFiStarted) return remaining;

  remaining = drawDcWithinHeadroom(b, d, ctx, remaining, 'p1');
  if (remaining > 0 && ctx.mode === 'couple' && ctx.p2Age !== null) {
    remaining = drawDcWithinHeadroom(b, d, ctx, remaining, 'p2');
  }
  return remaining;
}

function drawDcWithinHeadroom(
  b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number, who: 'p1' | 'p2',
): number {
  const dcBalance = who === 'p1' ? b.p1Dc : b.p2Dc;
  const enabled = who === 'p1' ? ctx.dc1Enabled : ctx.dc2Enabled;
  if (dcBalance <= 0 || !enabled) return remaining;

  const taxableFixed = who === 'p1' ? ctx.p1TaxableFixed : ctx.p2TaxableFixed;
  const headroom = Math.max(0, ctx.yearSnapshot.incomeTaxBands.personalAllowance - taxableFixed);
  const maxWithinAllowance = headroom / (1 - ctx.yearUfplsFrac);
  const amount = Math.min(maxWithinAllowance, dcBalance, remaining);
  if (amount <= 0) return remaining;

  applyDcDrawdown(b, d, ctx, who, amount);
  return remaining - amount;
}

function applyDcDrawdown(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, who: 'p1' | 'p2', amount: number): void {
  const remainingLsaKey = who === 'p1' ? 'p1LifetimePcls' : 'p2LifetimePcls';
  const dcBalKey: 'p1Dc' | 'p2Dc' = who === 'p1' ? 'p1Dc' : 'p2Dc';
  const drawnKey: 'p1DcD' | 'p2DcD' = who === 'p1' ? 'p1DcD' : 'p2DcD';
  const taxFreeKey: 'p1DcTaxFree' | 'p2DcTaxFree' = who === 'p1' ? 'p1DcTaxFree' : 'p2DcTaxFree';

  d[drawnKey] += amount;
  b[dcBalKey] -= amount;
  const remainingLsa = Math.max(0, ctx.yearPensionLsa - b[remainingLsaKey]);
  const tf = Math.min(amount * ctx.yearUfplsFrac, remainingLsa);
  d[taxFreeKey] += tf;
  b[remainingLsaKey] += tf;
}

/**
 * Step 2: GIA within per-person CGT budget (individual then joint).
 * Crystallises gains up to each person's annual CGT exempt amount — uses the
 * "use it or lose it" allowance to step up base cost at zero tax cost.
 */
function stepGiaWithinCgtBudget(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number): number {
  if (!ctx.householdFiStarted || remaining <= 0) return remaining;

  // Bed & ISA transfers earlier in the year may have consumed part of the
  // exempt — subtract those gains so we don't double-spend the allowance.
  const biJointGainEach = ctx.p2BedIsaCg / 2;
  let p1CgBudget = Math.max(0, CGT.ANNUAL_EXEMPT - ctx.p1BedIsaCg - biJointGainEach);
  let p2CgBudget = ctx.mode === 'couple'
    ? Math.max(0, CGT.ANNUAL_EXEMPT - ctx.p2IndivBedIsaCg - biJointGainEach)
    : 0;

  if (b.p1GiaV > 0) {
    const consumed = drawGiaBoundedByBudget(b, d, 'p1', remaining, p1CgBudget);
    p1CgBudget -= consumed.gain;
    remaining -= consumed.drawn;
  }
  if (remaining > 0 && b.p2GiaV > 0 && ctx.p2Age !== null) {
    const consumed = drawGiaBoundedByBudget(b, d, 'p2', remaining, p2CgBudget);
    p2CgBudget -= consumed.gain;
    remaining -= consumed.drawn;
  }
  if (remaining > 0 && b.jointGiaV > 0) {
    // Joint GIA gains split 50/50 — cap by whichever person has less budget.
    const effectiveBudget = ctx.mode === 'couple' ? Math.min(p1CgBudget, p2CgBudget) * 2 : p1CgBudget;
    const consumed = drawGiaBoundedByBudget(b, d, 'joint', remaining, effectiveBudget);
    remaining -= consumed.drawn;
  }
  return remaining;
}

/** Map a GIA owner to the corresponding DrawBalances / DrawAmounts field names. */
const GIA_KEYS = {
  p1:    { v: 'p1GiaV',    bc: 'p1GiaBC',    d: 'p1GiaD',    cg: 'p1GiaCG'    },
  p2:    { v: 'p2GiaV',    bc: 'p2GiaBC',    d: 'p2GiaD',    cg: 'p2GiaCG'    },
  joint: { v: 'jointGiaV', bc: 'jointGiaBC', d: 'jointGiaD', cg: 'jointGiaCG' },
} as const;

function drawGiaBoundedByBudget(
  b: DrawBalances, d: DrawAmounts, who: 'p1' | 'p2' | 'joint', remaining: number, cgBudget: number,
): { drawn: number; gain: number } {
  const { v: giaKey, bc: bcKey, d: drawnKey, cg: cgKey } = GIA_KEYS[who];

  const value = b[giaKey];
  const baseCost = b[bcKey];
  const gainFrac = value > baseCost ? (value - baseCost) / value : 0;
  const maxForCgt = gainFrac > 0 ? cgBudget / gainFrac : value;
  const amount = Math.min(maxForCgt, value, remaining);
  if (amount <= 0) return { drawn: 0, gain: 0 };

  const r = drawFromGIA(value, baseCost, amount);
  d[drawnKey] += r.drawn;
  d[cgKey]    += r.capitalGain;
  b[giaKey]    = r.newValue;
  b[bcKey]     = r.newBaseCost;
  return { drawn: r.drawn, gain: r.capitalGain };
}

/** Step 3: ISA (tax-free, after CGT-budget GIA slice). */
function stepIsaDrawdown(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number): number {
  if (!ctx.householdFiStarted || remaining <= 0) return remaining;

  if (b.p1Isa > 0) {
    const amount = Math.min(b.p1Isa, remaining);
    d.p1IsaD = amount; b.p1Isa -= amount; remaining -= amount;
  }
  if (remaining > 0 && b.p2Isa > 0 && ctx.p2Age !== null) {
    const amount = Math.min(b.p2Isa, remaining);
    d.p2IsaD = amount; b.p2Isa -= amount; remaining -= amount;
  }
  return remaining;
}

/** Step 4: GIA remaining (gains above CGT allowance — taxable). */
function stepGiaRemaining(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number): number {
  if (!ctx.householdFiStarted || remaining <= 0) return remaining;

  if (b.p1GiaV > 0) {
    const r = drawFromGIA(b.p1GiaV, b.p1GiaBC, remaining);
    d.p1GiaD += r.drawn; d.p1GiaCG += r.capitalGain;
    b.p1GiaV = r.newValue; b.p1GiaBC = r.newBaseCost;
    remaining -= r.drawn;
  }
  if (remaining > 0 && b.p2GiaV > 0 && ctx.p2Age !== null) {
    const r = drawFromGIA(b.p2GiaV, b.p2GiaBC, remaining);
    d.p2GiaD += r.drawn; d.p2GiaCG += r.capitalGain;
    b.p2GiaV = r.newValue; b.p2GiaBC = r.newBaseCost;
    remaining -= r.drawn;
  }
  if (remaining > 0 && b.jointGiaV > 0) {
    const r = drawFromGIA(b.jointGiaV, b.jointGiaBC, remaining);
    d.jointGiaD += r.drawn; d.jointGiaCG += r.capitalGain;
    b.jointGiaV = r.newValue; b.jointGiaBC = r.newBaseCost;
    remaining -= r.drawn;
  }
  return remaining;
}

/** Step 5: Cash savings (tax-free withdrawal). */
function stepCashDrawdown(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number): number {
  if (!ctx.householdFiStarted || remaining <= 0) return remaining;

  if (b.p1Cash > 0) {
    const amount = Math.min(b.p1Cash, remaining);
    d.p1CashD = amount; b.p1Cash -= amount; remaining -= amount;
  }
  if (remaining > 0 && b.p2Cash > 0 && ctx.p2Age !== null) {
    const amount = Math.min(b.p2Cash, remaining);
    d.p2CashD = amount; b.p2Cash -= amount; remaining -= amount;
  }
  return remaining;
}

/**
 * Step 6: DC pension above the personal allowance — taxable at marginal rate.
 * For couples with DC available on both sides, split equally to avoid pushing
 * one person into higher-rate tax while the other's basic-rate band is unused.
 */
function stepDcAboveAllowance(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number): number {
  if (!ctx.householdFiStarted || remaining <= 0) return remaining;

  const p1Avail = b.p1Dc > 0 && ctx.dc1Enabled ? b.p1Dc : 0;
  const p2Avail = ctx.mode === 'couple' && ctx.p2Age !== null && b.p2Dc > 0 && ctx.dc2Enabled ? b.p2Dc : 0;

  if (p1Avail > 0 && p2Avail > 0 && ctx.mode === 'couple') {
    return splitDcDrawAcrossCouple(b, d, ctx, remaining, p1Avail, p2Avail);
  }
  if (p1Avail > 0) {
    const amount = Math.min(p1Avail, remaining);
    applyDcDrawdown(b, d, ctx, 'p1', amount);
    remaining -= amount;
  }
  if (remaining > 0 && p2Avail > 0) {
    const amount = Math.min(p2Avail, remaining);
    applyDcDrawdown(b, d, ctx, 'p2', amount);
    remaining -= amount;
  }
  return remaining;
}

function splitDcDrawAcrossCouple(
  b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext, remaining: number,
  p1Avail: number, p2Avail: number,
): number {
  const half = remaining / 2;
  const p1Draw = Math.min(p1Avail, half);
  const p2Draw = Math.min(p2Avail, half);
  const leftover = Math.max(0, remaining - p1Draw - p2Draw);
  const p1Extra = leftover > 0 ? Math.min(p1Avail - p1Draw, leftover) : 0;
  const p2Extra = leftover > 0 ? Math.min(p2Avail - p2Draw, leftover - p1Extra) : 0;
  const p1Total = p1Draw + p1Extra;
  const p2Total = p2Draw + p2Extra;

  if (p1Total > 0) applyDcDrawdown(b, d, ctx, 'p1', p1Total);
  if (p2Total > 0) applyDcDrawdown(b, d, ctx, 'p2', p2Total);
  return remaining - p1Total - p2Total;
}

/** Compute per-iteration tax + capital gains tax totals. */
function computeIterationTaxes(b: DrawBalances, d: DrawAmounts, ctx: WaterfallContext): DrawTaxes {
  const totalIncome = ctx.fixedIncome
    + d.p1IsaD + d.p1GiaD + d.p1CashD + d.p1DcD
    + d.p2IsaD + d.p2GiaD + d.p2CashD + d.p2DcD
    + d.jointGiaD;

  const jointGainEach = d.jointGiaCG / 2;
  const p1OtherTaxable = ctx.p1Inc.db + ctx.p1Inc.ptw + ctx.p1Inc.other + ctx.p1Inc.rent + (d.p1DcD - d.p1DcTaxFree);
  const p2OtherTaxable = ctx.p2Inc.db + ctx.p2Inc.ptw + ctx.p2Inc.other + ctx.p2RentEffective + (d.p2DcD - d.p2DcTaxFree);
  const p1SpTaxable = ctx.spExempt && p1OtherTaxable === 0 ? 0 : ctx.p1Inc.sp;
  const p2SpTaxable = ctx.spExempt && p2OtherTaxable === 0 ? 0 : ctx.p2Inc.sp;
  const p1TaxBasis = p1SpTaxable + p1OtherTaxable;
  const p2TaxBasis = p2SpTaxable + p2OtherTaxable;
  const p1IncomeTax = calcIncomeTax(p1TaxBasis, ctx.calendarYear);
  const p2IncomeTax = calcIncomeTax(p2TaxBasis, ctx.calendarYear);
  const incomeTaxPaid = p1IncomeTax + p2IncomeTax;

  // Bed & ISA joint GIA gains follow the same 50/50 CGT split as other joint disposals.
  const jointBedIsaGainEach = ctx.p2BedIsaCg / 2;
  const p1TotalCG = d.p1GiaCG + jointGainEach + ctx.p1BedIsaCg + jointBedIsaGainEach;
  const p2TotalCG = d.p2GiaCG + jointGainEach + ctx.p2IndivBedIsaCg + jointBedIsaGainEach;
  const p1CgtPaid = calcCGT(p1TotalCG, isHigherRateTaxpayer(p1TaxBasis, ctx.calendarYear), ctx.calendarYear);
  const p2CgtPaid = calcCGT(p2TotalCG, isHigherRateTaxpayer(p2TaxBasis, ctx.calendarYear), ctx.calendarYear);
  const totalCgtPaid = p1CgtPaid + p2CgtPaid;
  const totalTaxPaid = incomeTaxPaid + totalCgtPaid;

  return {
    totalIncome, totalTaxPaid, incomeTaxPaid, totalCgtPaid,
    p1IncomeTax, p2IncomeTax, p1CgtPaid, p2CgtPaid,
  };
}

// ─── SORR stress test ─────────────────────────────────────────────────────────

/** Result of the SORR (sequence-of-returns risk) stress comparison. */
export interface SorrComparison {
  standardDepletionAge: number | null;
  ladderDepletionAge: number | null;
  /** Positive = ladder lasts longer than the standard waterfall under the same shock. */
  yearsSaved: number;
  /** Difference in total portfolio value at age 85 (£) — ladder − standard. */
  portfolioAtAge85Delta: number;
  /** The shock parameters used for both passes. */
  shockYear: number;
  shockPercent: number;
}

/**
 * Run two projection passes with an identical shock to compare:
 *   Pass A: standard waterfall, no ladder — shock applied to whole pot values.
 *   Pass B: bucket ladder enabled — shock applied only to growth-bucket portion.
 *
 * Both passes use the user's actual allocations (if set) so the comparison is
 * grounded in their real portfolio shape. Returns depletion ages and a £ delta
 * at age 85 (clamped to plan horizon).
 */
export function runSorrStressTest(
  state: PlannerState,
  shockYear: number,
  shockPercent: number,
): SorrComparison {
  const baseConfig = state.bucketLadderConfig;
  const standardState: PlannerState = {
    ...state,
    bucketLadderConfig: { ...baseConfig, enabled: false },
  };
  const ladderState: PlannerState = {
    ...state,
    bucketLadderConfig: { ...baseConfig, enabled: true },
  };

  const standardProj = calculateProjections(standardState, { growthShockYear: shockYear, growthShockPercent: shockPercent });
  const ladderProj   = calculateProjections(ladderState,   { growthShockYear: shockYear, growthShockPercent: shockPercent });

  const standardDepletion = getAssetDepletionAge(standardProj);
  const ladderDepletion   = getAssetDepletionAge(ladderProj);

  const at85Standard = standardProj.find(p => p.p1Age === 85)?.totalAssets ?? 0;
  const at85Ladder   = ladderProj.find(p => p.p1Age === 85)?.totalAssets ?? 0;

  return {
    standardDepletionAge: standardDepletion,
    ladderDepletionAge:   ladderDepletion,
    yearsSaved:
      (ladderDepletion ?? state.assumptions.lifeExpectancy)
      - (standardDepletion ?? state.assumptions.lifeExpectancy),
    portfolioAtAge85Delta: at85Ladder - at85Standard,
    shockYear,
    shockPercent,
  };
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function getStageTotals(
  state: PlannerState,
  stageId: string,
): { tier: string; total: number }[] {
  const tiers = ['essential', 'moderate', 'aspirational', 'variable'] as const;
  return tiers.map(tier => ({
    tier,
    total: state.spendingCategories
      .filter(c => c.tier === tier)
      .reduce((s, c) => s + (c.amounts[stageId] ?? 0), 0),
  }));
}

export function getStageTotalSpending(state: PlannerState, stageId: string): number {
  return state.spendingCategories.reduce((s, c) => s + (c.amounts[stageId] ?? 0), 0);
}

export function getAssetDepletionAge(projections: YearlyProjection[]): number | null {
  const found = projections.find(p => p.totalAssets <= 0);
  return found ? found.p1Age : null;
}

export function getTotalUnrealisedGain(state: PlannerState): number {
  const p1 = state.person1.assets.generalInvestments;
  const p2 = state.mode === 'couple' ? state.person2.assets.generalInvestments : null;
  const joint = state.mode === 'couple' ? state.jointGia : null;
  const p1Gain    = p1.enabled    ? Math.max(0, p1.totalValue    - p1.baseCost)    : 0;
  const p2Gain    = p2?.enabled   ? Math.max(0, p2.totalValue    - p2.baseCost)    : 0;
  const jointGain = joint?.enabled ? Math.max(0, joint.totalValue - joint.baseCost) : 0;
  return p1Gain + p2Gain + jointGain;
}

/**
 * Determine the highest RLSS standard the household can sustain to life expectancy.
 * "Sustain" = assets never depleted across the full projection.
 *
 * Income is deflated back to today's money before averaging so it can be compared
 * directly against the real-money RLSS thresholds. Without deflation, later years'
 * inflated nominal figures would systematically overstate the achievable standard.
 */
export function getSustainableRlssLevel(
  projections: YearlyProjection[],
  mode: 'single' | 'couple',
  inflation = 2.5,
): import('@/models/types').RlssStandard | null {
  const lastTotal = projections[projections.length - 1]?.totalAssets ?? 0;
  if (lastTotal <= 0) return null;

  // Deflate each year's nominal net income to today's money, then average.
  const realAvgIncome = projections.reduce((s, p) => {
    const inflFactor = Math.pow(1 + inflation / 100, p.yearIndex);
    return s + p.netIncome / inflFactor;
  }, 0) / projections.length;

  const standards = RLSS[mode];

  if (realAvgIncome >= standards.comfortable.annual) return 'comfortable';
  if (realAvgIncome >= standards.moderate.annual)    return 'moderate';
  if (realAvgIncome >= standards.minimum.annual)     return 'minimum';
  return null;
}

/**
 * Calculate gamification metrics for dashboard display.
 *
 * incomeStabilityScore:  average % of spending covered by guaranteed income across the full
 *                        post-FI projection. Using the average avoids a misleading 0% when
 *                        state pension or DB pension starts after the FI age.
 * spendingConfidenceScore: % of years in the projection where the plan is fully funded.
 * fundedGoalsCount: number of aspirational/lifestyle spending categories with non-zero amounts.
 */
export function calculateGamificationMetrics(state: PlannerState, projections?: YearlyProjection[]): GamificationMetrics {
  const resolvedProjections = projections ?? calculateProjections(state);
  const firstStageId = state.lifeStages[0]?.id ?? 'go-go';

  // Restrict to post-FI years only
  const postFiYears = resolvedProjections.filter(p => p.p1Age >= state.fiAge);
  const planYears = postFiYears.length > 0 ? postFiYears : resolvedProjections;

  // Income stability: average guaranteed income / average spending across all post-FI years.
  // This correctly reflects state pension and DB pension even when they start after FI age.
  const totalGuaranteed = planYears.reduce((sum, p) =>
    sum + (p.p1StatePension ?? 0) + (p.p1DbPension ?? 0)
        + (p.p2StatePension ?? 0) + (p.p2DbPension ?? 0)
        + (p.p1OtherIncome  ?? 0) + (p.p2OtherIncome  ?? 0), 0);
  const totalSpending = planYears.reduce((sum, p) => sum + (p.spending ?? 0), 0);
  const incomeStabilityScore = totalSpending > 0
    ? Math.min(100, Math.round((totalGuaranteed / totalSpending) * 100))
    : 0;

  // Spending confidence: funded years / total years
  const fundedYears = resolvedProjections.filter(p => p.totalAssets > 0).length;
  const spendingConfidenceScore = Math.round((fundedYears / resolvedProjections.length) * 100);

  // Funded goals: active-stage categories with amount > 0
  const goalTiers: Array<'moderate' | 'aspirational'> = ['moderate', 'aspirational'];
  const goalCats = state.spendingCategories.filter(c => goalTiers.includes(c.tier as 'moderate' | 'aspirational'));
  const fundedGoalsCount = goalCats.filter(c => (c.amounts[firstStageId] ?? 0) > 0).length;

  return {
    incomeStabilityScore,
    spendingConfidenceScore,
    fundedGoalsCount,
    totalGoalsCount: goalCats.length,
  };
}

/** Format a number as £ currency. compact=true gives £12.3k / £1.9m style. */
export function formatCurrency(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '£0';
  if (compact && Math.abs(value) >= 1_000_000) return '£' + (value / 1_000_000).toFixed(1) + 'm';
  if (compact && Math.abs(value) >= 1000) return '£' + (value / 1000).toFixed(1) + 'k';
  return '£' + Math.round(value).toLocaleString('en-GB');
}

/** Run the full simulation and return a SimulationResult summary. */
export function runSimulation(state: PlannerState): SimulationResult {
  const projections = calculateProjections(state);
  return {
    projections,
    depletionAge:         getAssetDepletionAge(projections),
    lifetimeTaxPaid:      projections.reduce((s, p) => s + p.totalTaxPaid, 0),
    lifetimeCGT:          projections.reduce((s, p) => s + p.totalCgtPaid, 0),
    sustainableRlssLevel: getSustainableRlssLevel(projections, state.mode, state.assumptions.inflation),
  };
}
