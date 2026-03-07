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
 */

import type {
  PlannerState, YearlyProjection, LifeStage,
  PersonIncomeSources, PersonAssets, SimulationResult,
} from '@/models/types';
import { PENSION_RULES, RLSS } from '@/config/financialConstants';
import { calcIncomeTax, calcCGT, drawFromGIA, isHigherRateTaxpayer } from './taxCalculations';

// ─── Per-person income aggregator ────────────────────────────────────────────

function personIncome(
  src: PersonIncomeSources,
  assets: PersonAssets,
  personAge: number,
  yearIndex: number,
  inflRate: number,
): { sp: number; db: number; ptw: number; other: number; rent: number } {
  const inflFrom = (startAge: number) =>
    Math.pow(1 + inflRate / 100, Math.max(0, personAge - startAge));

  // State Pension — indexed from start age
  const sp = src.statePension.enabled && personAge >= src.statePension.startAge
    ? src.statePension.weeklyAmount * 52 * inflFrom(src.statePension.startAge) : 0;

  // DB Pension — indexed from start age
  const db = src.dbPension.enabled && personAge >= src.dbPension.startAge
    ? src.dbPension.annualIncome * inflFrom(src.dbPension.startAge) : 0;

  // Annuity — indexed from start age (combined into 'other' for chart simplicity)
  const annuity = src.annuity?.enabled && personAge >= (src.annuity?.startAge ?? 999)
    ? (src.annuity.annualIncome) * inflFrom(src.annuity.startAge) : 0;

  // Part-time work — not inflation-linked (nominal income)
  const ptw = src.partTimeWork.enabled && personAge < src.partTimeWork.stopAge
    ? src.partTimeWork.annualIncome : 0;

  // Other income (trusts, gifts, etc.) — not inflation-linked
  const otherBase = src.otherIncome.enabled &&
    personAge >= src.otherIncome.startAge &&
    (src.otherIncome.stopAge === 0 || personAge < src.otherIncome.stopAge)
    ? src.otherIncome.annualAmount : 0;

  // Property rental income — runs for durationYears from year 0
  const rent = assets.property.enabled &&
    assets.property.annualRent > 0 &&
    yearIndex < assets.property.durationYears
    ? assets.property.annualRent : 0;

  return { sp, db, ptw, other: otherBase + annuity, rent };
}

// ─── Stage lookup ─────────────────────────────────────────────────────────────

function getStageForAge(stages: LifeStage[], age: number): LifeStage {
  return stages.find(s => age >= s.startAge && age <= s.endAge) ?? stages[stages.length - 1];
}

// ─── Main projection loop ─────────────────────────────────────────────────────

export function calculateProjections(state: PlannerState): YearlyProjection[] {
  const { person1, person2, lifeStages, spendingCategories, assumptions, mode } = state;
  const { lifeExpectancy, inflation, investmentGrowth } = assumptions;

  // Initialise asset balances
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

  // Per-asset growth rates (fall back to global investmentGrowth)
  const p1IsaG  = (person1.assets.isaInvestments.growthRate     ?? investmentGrowth) / 100;
  const p1GiaG  = (person1.assets.generalInvestments.growthRate ?? investmentGrowth) / 100;
  const p1DcG   = (person1.incomeSources.dcPension.growthRate   ?? investmentGrowth) / 100;
  const p2IsaG  = (person2.assets.isaInvestments.growthRate     ?? investmentGrowth) / 100;
  const p2GiaG  = (person2.assets.generalInvestments.growthRate ?? investmentGrowth) / 100;
  const p2DcG   = (person2.incomeSources.dcPension.growthRate   ?? investmentGrowth) / 100;

  const maxYears   = lifeExpectancy - person1.currentAge;
  const projections: YearlyProjection[] = [];

  for (let y = 0; y <= maxYears; y++) {
    const p1Age     = person1.currentAge + y;
    const p2Age     = mode === 'couple' ? person2.currentAge + y : null;
    const inflFactor = Math.pow(1 + inflation / 100, y);

    // ── Spending (inflation-adjusted from today's £) ──────────────────────
    const stage    = getStageForAge(lifeStages, p1Age);
    const spending = spendingCategories.reduce((s, c) => s + (c.amounts[stage.id] ?? 0), 0) * inflFactor;

    // ── Fixed income ──────────────────────────────────────────────────────
    const p1 = personIncome(person1.incomeSources, person1.assets, p1Age, y, inflation);
    const p2 = mode === 'couple' && p2Age !== null
      ? personIncome(person2.incomeSources, person2.assets, p2Age, y, inflation)
      : { sp: 0, db: 0, ptw: 0, other: 0, rent: 0 };

    const fixedIncome = p1.sp + p1.db + p1.ptw + p1.other + p1.rent
                      + p2.sp + p2.db + p2.ptw + p2.other + p2.rent;

    // ── Asset growth (before drawdown — assets grow throughout the year) ──
    if (p1Isa  > 0) p1Isa  *= (1 + p1IsaG);
    if (p1GiaV > 0) p1GiaV *= (1 + p1GiaG);
    if (p1Dc   > 0) p1Dc   *= (1 + p1DcG);
    if (p2Isa  > 0) p2Isa  *= (1 + p2IsaG);
    if (p2GiaV > 0) p2GiaV *= (1 + p2GiaG);
    if (p2Dc   > 0) p2Dc   *= (1 + p2DcG);

    // ── Drawdown to cover gap (Priority order: P1 ISA → P2 ISA → P1 GIA → P2 GIA → P1 Cash → P2 Cash → P1 DC → P2 DC)
    let remaining = spending - fixedIncome;

    let p1IsaD = 0, p1GiaD = 0, p1GiaCG = 0, p1CashD = 0, p1DcD = 0;
    let p2IsaD = 0, p2GiaD = 0, p2GiaCG = 0, p2CashD = 0, p2DcD = 0;

    if (remaining > 0) {
      // P1 ISA — completely tax-free
      if (p1Isa > 0) { const d = Math.min(p1Isa, remaining); p1IsaD = d; p1Isa -= d; remaining -= d; }
      // P2 ISA
      if (remaining > 0 && p2Isa > 0) { const d = Math.min(p2Isa, remaining); p2IsaD = d; p2Isa -= d; remaining -= d; }
      // P1 GIA — proportional CGT
      if (remaining > 0 && p1GiaV > 0) {
        const r = drawFromGIA(p1GiaV, p1GiaBC, remaining);
        p1GiaD = r.drawn; p1GiaCG = r.capitalGain;
        p1GiaV = r.newValue; p1GiaBC = r.newBaseCost;
        remaining -= r.drawn;
      }
      // P2 GIA
      if (remaining > 0 && p2GiaV > 0) {
        const r = drawFromGIA(p2GiaV, p2GiaBC, remaining);
        p2GiaD = r.drawn; p2GiaCG = r.capitalGain;
        p2GiaV = r.newValue; p2GiaBC = r.newBaseCost;
        remaining -= r.drawn;
      }
      // P1 Cash
      if (remaining > 0 && p1Cash > 0) { const d = Math.min(p1Cash, remaining); p1CashD = d; p1Cash -= d; remaining -= d; }
      // P2 Cash
      if (remaining > 0 && p2Cash > 0) { const d = Math.min(p2Cash, remaining); p2CashD = d; p2Cash -= d; remaining -= d; }
      // P1 DC Pension
      const dc1 = person1.incomeSources.dcPension;
      if (remaining > 0 && p1Dc > 0 && dc1.enabled && p1Age >= dc1.drawdownAge) {
        const d = Math.min(p1Dc, remaining); p1DcD = d; p1Dc -= d; remaining -= d;
      }
      // P2 DC Pension
      if (remaining > 0 && mode === 'couple' && p2Age !== null) {
        const dc2 = person2.incomeSources.dcPension;
        if (p2Dc > 0 && dc2.enabled && p2Age >= dc2.drawdownAge) {
          const d = Math.min(p2Dc, remaining); p2DcD = d; p2Dc -= d; remaining -= d;
        }
      }
    } else {
      // Surplus: park in P1 cash
      p1Cash += Math.abs(remaining);
    }

    const totalIncome = fixedIncome + p1IsaD + p1GiaD + p1CashD + p1DcD
                                    + p2IsaD + p2GiaD + p2CashD + p2DcD;

    // ── Tax (per person) ──────────────────────────────────────────────────
    // Taxable income: fixed income + 75% of DC drawdown (UFPLS model)
    const taxFree = PENSION_RULES.UFPLS_TAX_FREE_FRACTION;
    const p1TaxBasis = p1.sp + p1.db + p1.ptw + p1.other + p1.rent + p1DcD * (1 - taxFree);
    const p2TaxBasis = p2.sp + p2.db + p2.ptw + p2.other + p2.rent + p2DcD * (1 - taxFree);

    const p1IncomeTax = calcIncomeTax(p1TaxBasis);
    const p2IncomeTax = calcIncomeTax(p2TaxBasis);
    const incomeTaxPaid = p1IncomeTax + p2IncomeTax;

    // CGT — assessed per person against their own exempt amount
    const p1CgtPaid = calcCGT(p1GiaCG, isHigherRateTaxpayer(p1TaxBasis));
    const p2CgtPaid = calcCGT(p2GiaCG, isHigherRateTaxpayer(p2TaxBasis));
    const totalCgtPaid  = p1CgtPaid + p2CgtPaid;
    const totalTaxPaid  = incomeTaxPaid + totalCgtPaid;
    const netIncome     = totalIncome - totalTaxPaid;

    const clamp = (v: number) => Math.max(0, v);

    projections.push({
      yearIndex: y,
      p1Age, p2Age,
      lifeStage: stage.label,
      spending,

      p1StatePension: p1.sp, p1DbPension: p1.db, p1PartTimeWork: p1.ptw,
      p1OtherIncome: p1.other, p1PropertyRent: p1.rent,
      p2StatePension: p2.sp, p2DbPension: p2.db, p2PartTimeWork: p2.ptw,
      p2OtherIncome: p2.other, p2PropertyRent: p2.rent,

      p1IsaDrawdown: p1IsaD, p1GiaDrawdown: p1GiaD, p1CashDrawdown: p1CashD, p1DcDrawdown: p1DcD,
      p2IsaDrawdown: p2IsaD, p2GiaDrawdown: p2GiaD, p2CashDrawdown: p2CashD, p2DcDrawdown: p2DcD,

      isaDrawdown:  p1IsaD  + p2IsaD,
      giaDrawdown:  p1GiaD  + p2GiaD,
      cashDrawdown: p1CashD + p2CashD,
      dcDrawdown:   p1DcD   + p2DcD,
      propertyRent: p1.rent + p2.rent,

      p1CapitalGain: p1GiaCG, p2CapitalGain: p2GiaCG,
      p1CgtPaid, p2CgtPaid, totalCgtPaid,
      p1IncomeTax, p2IncomeTax, incomeTaxPaid,

      totalIncome, totalTaxPaid, netIncome,
      gap: totalIncome - spending,

      p1IsaBalance:  clamp(p1Isa),  p1GiaValue: clamp(p1GiaV), p1GiaBaseCost: clamp(p1GiaBC),
      p1CashBalance: clamp(p1Cash), p1DcBalance: clamp(p1Dc),
      p2IsaBalance:  clamp(p2Isa),  p2GiaValue: clamp(p2GiaV), p2GiaBaseCost: clamp(p2GiaBC),
      p2CashBalance: clamp(p2Cash), p2DcBalance: clamp(p2Dc),
      totalAssets: clamp(p1Isa) + clamp(p1GiaV) + clamp(p1Cash) + clamp(p1Dc)
                 + clamp(p2Isa) + clamp(p2GiaV) + clamp(p2Cash) + clamp(p2Dc),
    });
  }

  return projections;
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
  const p1Gain = p1.enabled ? Math.max(0, p1.totalValue - p1.baseCost) : 0;
  const p2Gain = p2?.enabled ? Math.max(0, p2.totalValue - p2.baseCost) : 0;
  return p1Gain + p2Gain;
}

/**
 * Determine the highest RLSS standard the household can sustain to life expectancy.
 * "Sustain" = assets never depleted across the full projection.
 */
export function getSustainableRlssLevel(
  projections: YearlyProjection[],
  mode: 'single' | 'couple',
): import('@/models/types').RlssStandard | null {
  const lastTotal = projections[projections.length - 1]?.totalAssets ?? 0;
  if (lastTotal <= 0) return null;

  const avgAnnualIncome = projections.reduce((s, p) => s + p.netIncome, 0) / projections.length;
  const standards = RLSS[mode];

  if (avgAnnualIncome >= standards.comfortable.annual) return 'comfortable';
  if (avgAnnualIncome >= standards.moderate.annual)    return 'moderate';
  if (avgAnnualIncome >= standards.minimum.annual)     return 'minimum';
  return null;
}

/** Format a number as £ currency. compact=true gives £12.3k style. */
export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) return '£' + (value / 1000).toFixed(1) + 'k';
  return '£' + Math.round(value).toLocaleString('en-GB');
}

/** Run the full simulation and return a SimulationResult summary. */
export function runSimulation(state: PlannerState): SimulationResult {
  const projections = calculateProjections(state);
  return {
    projections,
    depletionAge:        getAssetDepletionAge(projections),
    lifetimeTaxPaid:     projections.reduce((s, p) => s + p.totalTaxPaid, 0),
    lifetimeCGT:         projections.reduce((s, p) => s + p.totalCgtPaid, 0),
    sustainableRlssLevel: getSustainableRlssLevel(projections, state.mode),
  };
}
