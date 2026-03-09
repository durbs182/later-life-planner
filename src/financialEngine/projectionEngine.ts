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
  PlannerState, YearlyProjection, LifeStage,
  PersonIncomeSources, PersonAssets, SimulationResult,
  GamificationMetrics,
} from '@/models/types';
import { PENSION_RULES, INCOME_TAX, CGT, RLSS } from '@/config/financialConstants';
import { calcIncomeTax, calcCGT, drawFromGIA, isHigherRateTaxpayer } from './taxCalculations';

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

// ─── Main projection loop ─────────────────────────────────────────────────────

export function calculateProjections(state: PlannerState): YearlyProjection[] {
  const { person1, person2, lifeStages, spendingCategories, assumptions, mode, fiAge, jointGia } = state;
  const { lifeExpectancy, inflation, investmentGrowth } = assumptions;

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
  const p1IsaG     = (person1.assets.isaInvestments.growthRate     ?? investmentGrowth) / 100;
  const p1GiaG     = (person1.assets.generalInvestments.growthRate ?? investmentGrowth) / 100;
  const p1DcG      = (person1.incomeSources.dcPension.growthRate   ?? investmentGrowth) / 100;
  const p2IsaG     = (person2.assets.isaInvestments.growthRate     ?? investmentGrowth) / 100;
  const p2GiaG     = (person2.assets.generalInvestments.growthRate ?? investmentGrowth) / 100;
  const p2DcG      = (person2.incomeSources.dcPension.growthRate   ?? investmentGrowth) / 100;
  const jointGiaG  = (jointGia.growthRate ?? investmentGrowth) / 100;

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

  for (let y = 0; y <= maxYears; y++) {
    const p1Age     = person1.currentAge + y;
    const p2Age     = mode === 'couple' ? person2.currentAge + y : null;
    const inflFactor = Math.pow(1 + inflation / 100, y);

    // ── Spending (inflation-adjusted from today's £) ───────────────────────
    const stage    = getStageForAge(lifeStages, p1Age);
    const spending = spendingCategories.reduce((s, c) => s + (c.amounts[stage.id] ?? 0), 0) * inflFactor;

    // ── Fixed income ──────────────────────────────────────────────────────
    const p1Inc = personIncome(person1.incomeSources, person1.assets, p1Age, y, inflation);
    const p2Inc = mode === 'couple' && p2Age !== null
      ? personIncome(person2.incomeSources, person2.assets, p2Age, y, inflation)
      : { sp: 0, db: 0, ptw: 0, other: 0, rent: 0 };

    // For joint property: avoid double-counting rent — use only person1's rent figure
    const jointPropP1 = person1.assets.property.owner === 'joint';
    const p2RentEffective = jointPropP1 ? 0 : p2Inc.rent; // already counted in p1Inc.rent

    const fixedIncome = p1Inc.sp + p1Inc.db + p1Inc.ptw + p1Inc.other + p1Inc.rent
                      + p2Inc.sp + p2Inc.db + p2Inc.ptw + p2Inc.other + p2RentEffective;

    // ── Asset growth (before drawdown) ────────────────────────────────────
    if (p1Isa            > 0) p1Isa            *= (1 + p1IsaG);
    if (p1GiaV           > 0) p1GiaV           *= (1 + p1GiaG);
    if (p1Dc             > 0) p1Dc             *= (1 + p1DcG);
    if (p2Isa            > 0) p2Isa            *= (1 + p2IsaG);
    if (p2GiaV           > 0) p2GiaV           *= (1 + p2GiaG);
    if (p2Dc             > 0) p2Dc             *= (1 + p2DcG);
    if (jointGiaV        > 0) jointGiaV        *= (1 + jointGiaG);
    // Care reserve grows at the global investment growth rate (it's invested within the portfolio)
    if (careReserveBalance > 0) careReserveBalance *= (1 + investmentGrowth / 100);

    // ── DC pension source handles ─────────────────────────────────────────
    const dc1 = person1.incomeSources.dcPension;
    const dc2 = person2.incomeSources.dcPension;

    // ── Per-year UFPLS tax-free tracking ──────────────────────────────────
    // Each DC withdrawal is 25% tax-free (UFPLS). The tax-free portion
    // accumulates against the LSA. Calculated in the DC drawdown section below.
    let p1DcTaxFree = 0;
    let p2DcTaxFree = 0;

    // ── Drawdown to cover gap (FI age onwards only) ───────────────────────
    // All asset drawdown is deferred until FI age. Pre-FI spending is assumed
    // to be covered by working income; entering part-time work income models
    // the transition. Post-FI priority:
    //   1. DC pension within personal allowance  (UFPLS, 0% effective tax)
    //   2. GIA within annual CGT exempt amount   (steps up base cost, tax-free)
    //   3. ISA                                   (always tax-free)
    //   4. Remaining GIA                         (CGT taxable above exempt)
    //   5. Cash                                  (tax-free withdrawal)
    //   6. DC pension above personal allowance   (income tax at marginal rate)
    let remaining = spending - fixedIncome;

    let p1IsaD = 0, p1GiaD = 0, p1GiaCG = 0, p1CashD = 0, p1DcD = 0;
    let p2IsaD = 0, p2GiaD = 0, p2GiaCG = 0, p2CashD = 0, p2DcD = 0;
    let jointGiaD = 0, jointGiaCG = 0;

    // Taxable fixed income per person — determines personal allowance headroom.
    const p1TaxableFixed = p1Inc.sp + p1Inc.db + p1Inc.ptw + p1Inc.other + p1Inc.rent;
    const p2TaxableFixed = p2Inc.sp + p2Inc.db + p2Inc.ptw + p2Inc.other + p2RentEffective;

    if (remaining > 0) {
      // ── Step 1: DC pension (UFPLS) up to personal allowance headroom ──────
      // Before drawing tax-free ISA, use any unused personal allowance capacity.
      // Each UFPLS withdrawal is 75% taxable; drawing up to the headroom keeps
      // effective income tax at 0% and leaves the pension growing tax-free for longer.
      // Only draws what is actually needed to cover spending (remaining).
      if (p1Dc > 0 && dc1.enabled && p1Age >= fiAge) {
        const p1Headroom = Math.max(0, INCOME_TAX.PERSONAL_ALLOWANCE - p1TaxableFixed);
        const maxWithinAllowance = p1Headroom / (1 - PENSION_RULES.UFPLS_TAX_FREE_FRACTION);
        const d = Math.min(maxWithinAllowance, p1Dc, remaining);
        if (d > 0) {
          p1DcD += d; p1Dc -= d; remaining -= d;
          const p1RemainingLsa = Math.max(0, PENSION_RULES.PCLS_LUMP_SUM_ALLOWANCE - p1LifetimePcls);
          const tf = Math.min(d * PENSION_RULES.UFPLS_TAX_FREE_FRACTION, p1RemainingLsa);
          p1DcTaxFree += tf; p1LifetimePcls += tf;
        }
      }
      if (mode === 'couple' && remaining > 0 && p2Age !== null && p2Dc > 0 && dc2.enabled && p2Age >= fiAge) {
        const p2Headroom = Math.max(0, INCOME_TAX.PERSONAL_ALLOWANCE - p2TaxableFixed);
        const maxWithinAllowance = p2Headroom / (1 - PENSION_RULES.UFPLS_TAX_FREE_FRACTION);
        const d = Math.min(maxWithinAllowance, p2Dc, remaining);
        if (d > 0) {
          p2DcD += d; p2Dc -= d; remaining -= d;
          const p2RemainingLsa = Math.max(0, PENSION_RULES.PCLS_LUMP_SUM_ALLOWANCE - p2LifetimePcls);
          const tf = Math.min(d * PENSION_RULES.UFPLS_TAX_FREE_FRACTION, p2RemainingLsa);
          p2DcTaxFree += tf; p2LifetimePcls += tf;
        }
      }

      // ── Step 2: GIA up to annual CGT exempt amount ────────────────────────
      // Crystallising gains within the CGT allowance (£3,000/person) is tax-free
      // and steps up the base cost — always worth doing when cash is needed.
      // GIA drawdown is deferred until FI age to preserve the tax-efficient
      // retirement waterfall — ISA/cash cover any pre-FI spending gap instead.
      if (remaining > 0 && p1GiaV > 0 && p1Age >= fiAge) {
        const gainFrac = p1GiaV > p1GiaBC ? (p1GiaV - p1GiaBC) / p1GiaV : 0;
        const maxForCgt = gainFrac > 0 ? CGT.ANNUAL_EXEMPT / gainFrac : p1GiaV;
        const d = Math.min(maxForCgt, p1GiaV, remaining);
        if (d > 0) {
          const r = drawFromGIA(p1GiaV, p1GiaBC, d);
          p1GiaD += r.drawn; p1GiaCG += r.capitalGain;
          p1GiaV = r.newValue; p1GiaBC = r.newBaseCost;
          remaining -= r.drawn;
        }
      }
      if (remaining > 0 && p2GiaV > 0 && p2Age !== null && p2Age >= fiAge) {
        const gainFrac = p2GiaV > p2GiaBC ? (p2GiaV - p2GiaBC) / p2GiaV : 0;
        const maxForCgt = gainFrac > 0 ? CGT.ANNUAL_EXEMPT / gainFrac : p2GiaV;
        const d = Math.min(maxForCgt, p2GiaV, remaining);
        if (d > 0) {
          const r = drawFromGIA(p2GiaV, p2GiaBC, d);
          p2GiaD += r.drawn; p2GiaCG += r.capitalGain;
          p2GiaV = r.newValue; p2GiaBC = r.newBaseCost;
          remaining -= r.drawn;
        }
      }
      if (remaining > 0 && jointGiaV > 0 && p1Age >= fiAge) {
        // Joint GIA gains are split 50/50, so effective CGT capacity is 2× the individual allowance
        const effectiveCgt = mode === 'couple' ? CGT.ANNUAL_EXEMPT * 2 : CGT.ANNUAL_EXEMPT;
        const gainFrac = jointGiaV > jointGiaBC ? (jointGiaV - jointGiaBC) / jointGiaV : 0;
        const maxForCgt = gainFrac > 0 ? effectiveCgt / gainFrac : jointGiaV;
        const d = Math.min(maxForCgt, jointGiaV, remaining);
        if (d > 0) {
          const r = drawFromGIA(jointGiaV, jointGiaBC, d);
          jointGiaD += r.drawn; jointGiaCG += r.capitalGain;
          jointGiaV = r.newValue; jointGiaBC = r.newBaseCost;
          remaining -= r.drawn;
        }
      }

      // ── Step 3: ISA ───────────────────────────────────────────────────────
      // Deferred until FI age — pre-FI spending is assumed covered by working
      // income, preserving the ISA wrapper for tax-efficient retirement drawdown.
      if (remaining > 0 && p1Isa > 0 && p1Age >= fiAge) {
        const d = Math.min(p1Isa, remaining); p1IsaD = d; p1Isa -= d; remaining -= d;
      }
      if (remaining > 0 && p2Isa > 0 && p2Age !== null && p2Age >= fiAge) {
        const d = Math.min(p2Isa, remaining); p2IsaD = d; p2Isa -= d; remaining -= d;
      }

      // ── Step 4: Remaining GIA (gains above CGT allowance, now taxable) ────
      if (remaining > 0 && p1GiaV > 0 && p1Age >= fiAge) {
        const r = drawFromGIA(p1GiaV, p1GiaBC, remaining);
        p1GiaD += r.drawn; p1GiaCG += r.capitalGain;
        p1GiaV = r.newValue; p1GiaBC = r.newBaseCost;
        remaining -= r.drawn;
      }
      if (remaining > 0 && p2GiaV > 0 && p2Age !== null && p2Age >= fiAge) {
        const r = drawFromGIA(p2GiaV, p2GiaBC, remaining);
        p2GiaD += r.drawn; p2GiaCG += r.capitalGain;
        p2GiaV = r.newValue; p2GiaBC = r.newBaseCost;
        remaining -= r.drawn;
      }
      if (remaining > 0 && jointGiaV > 0 && p1Age >= fiAge) {
        const r = drawFromGIA(jointGiaV, jointGiaBC, remaining);
        jointGiaD += r.drawn; jointGiaCG += r.capitalGain;
        jointGiaV = r.newValue; jointGiaBC = r.newBaseCost;
        remaining -= r.drawn;
      }

      // ── Step 5: Cash ──────────────────────────────────────────────────────
      if (remaining > 0 && p1Cash > 0 && p1Age >= fiAge) {
        const d = Math.min(p1Cash, remaining); p1CashD = d; p1Cash -= d; remaining -= d;
      }
      if (remaining > 0 && p2Cash > 0 && p2Age !== null && p2Age >= fiAge) {
        const d = Math.min(p2Cash, remaining); p2CashD = d; p2Cash -= d; remaining -= d;
      }

      // ── Step 6: DC pension — remaining gap (above personal allowance) ─────
      // This portion is taxable at marginal rate (20%+). Only reached when all
      // other sources are exhausted or the gap exceeds the personal allowance.
      if (remaining > 0 && p1Dc > 0 && dc1.enabled && p1Age >= fiAge) {
        const d = Math.min(p1Dc, remaining); p1DcD += d; p1Dc -= d; remaining -= d;
        const p1RemainingLsa = Math.max(0, PENSION_RULES.PCLS_LUMP_SUM_ALLOWANCE - p1LifetimePcls);
        const tf = Math.min(d * PENSION_RULES.UFPLS_TAX_FREE_FRACTION, p1RemainingLsa);
        p1DcTaxFree += tf; p1LifetimePcls += tf;
      }
      if (remaining > 0 && mode === 'couple' && p2Age !== null) {
        if (p2Dc > 0 && dc2.enabled && p2Age >= fiAge) {
          const d = Math.min(p2Dc, remaining); p2DcD += d; p2Dc -= d; remaining -= d;
          const p2RemainingLsa = Math.max(0, PENSION_RULES.PCLS_LUMP_SUM_ALLOWANCE - p2LifetimePcls);
          const tf = Math.min(d * PENSION_RULES.UFPLS_TAX_FREE_FRACTION, p2RemainingLsa);
          p2DcTaxFree += tf; p2LifetimePcls += tf;
        }
      }
    } else {
      // Surplus (fixed income already exceeds spending) — park in P1 cash
      p1Cash += Math.abs(remaining);
    }

    const totalIncome = fixedIncome
                      + p1IsaD + p1GiaD + p1CashD + p1DcD
                      + p2IsaD + p2GiaD + p2CashD + p2DcD
                      + jointGiaD;

    // ── Tax per person ────────────────────────────────────────────────────
    // UFPLS: each DC withdrawal is 25% tax-free (tracked per-year via p1DcTaxFree).
    // Once the LSA is exhausted, p1DcTaxFree = 0 and the full withdrawal is taxable.

    // Joint GIA: capital gain split equally between both persons' CGT allowances
    const jointGainEach = jointGiaCG / 2;

    // State Pension sole-income exemption:
    // Per UK government policy (2024), a person whose only income is the State
    // Pension will not pay income tax on it. When the assumption is enabled, we
    // exclude SP from the tax basis for any person where it is their sole taxable
    // income (i.e. all other taxable items are zero). The toggle exists because
    // the policy may change.
    const spExempt = assumptions.statePensionSoleIncomeExempt ?? true;
    const p1OtherTaxable = p1Inc.db + p1Inc.ptw + p1Inc.other + p1Inc.rent + (p1DcD - p1DcTaxFree);
    const p2OtherTaxable = p2Inc.db + p2Inc.ptw + p2Inc.other + p2RentEffective + (p2DcD - p2DcTaxFree);
    const p1SpTaxable = (spExempt && p1OtherTaxable === 0) ? 0 : p1Inc.sp;
    const p2SpTaxable = (spExempt && p2OtherTaxable === 0) ? 0 : p2Inc.sp;

    const p1TaxBasis = p1SpTaxable + p1OtherTaxable;
    const p2TaxBasis = p2SpTaxable + p2OtherTaxable;

    const p1IncomeTax = calcIncomeTax(p1TaxBasis);
    const p2IncomeTax = calcIncomeTax(p2TaxBasis);
    const incomeTaxPaid = p1IncomeTax + p2IncomeTax;

    // CGT per person: individual gain + half of joint GIA gain
    const p1TotalCG = p1GiaCG + jointGainEach;
    const p2TotalCG = p2GiaCG + jointGainEach;
    const p1CgtPaid = calcCGT(p1TotalCG, isHigherRateTaxpayer(p1TaxBasis));
    const p2CgtPaid = calcCGT(p2TotalCG, isHigherRateTaxpayer(p2TaxBasis));
    const totalCgtPaid  = p1CgtPaid + p2CgtPaid;
    const totalTaxPaid  = incomeTaxPaid + totalCgtPaid;
    const netIncome     = totalIncome - totalTaxPaid;

    const clamp = (v: number) => Math.max(0, v);

    projections.push({
      yearIndex: y,
      p1Age, p2Age,
      lifeStage: stage.label,
      spending,

      p1StatePension: p1Inc.sp, p1DbPension: p1Inc.db, p1PartTimeWork: p1Inc.ptw,
      p1OtherIncome: p1Inc.other, p1PropertyRent: p1Inc.rent,
      p2StatePension: p2Inc.sp, p2DbPension: p2Inc.db, p2PartTimeWork: p2Inc.ptw,
      p2OtherIncome: p2Inc.other, p2PropertyRent: p2RentEffective,

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
  const joint = state.mode === 'couple' ? state.jointGia : null;
  const p1Gain    = p1.enabled    ? Math.max(0, p1.totalValue    - p1.baseCost)    : 0;
  const p2Gain    = p2?.enabled   ? Math.max(0, p2.totalValue    - p2.baseCost)    : 0;
  const jointGain = joint?.enabled ? Math.max(0, joint.totalValue - joint.baseCost) : 0;
  return p1Gain + p2Gain + jointGain;
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

/**
 * Calculate gamification metrics for dashboard display.
 *
 * incomeStabilityScore:  % of Year 1 spending covered by guaranteed income (SP + DB + annuity).
 * spendingConfidenceScore: % of years in the projection where the plan is fully funded.
 * fundedGoalsCount: number of aspirational/lifestyle spending categories with non-zero amounts.
 */
export function calculateGamificationMetrics(state: PlannerState): GamificationMetrics {
  const projections = calculateProjections(state);
  // Use the FI age year as "year 1" — income and spending are only meaningful from FI age onwards.
  const firstYear = projections.find(p => p.p1Age >= state.fiAge) ?? projections[0];
  const firstStageId = state.lifeStages[0]?.id ?? 'go-go';

  // Income stability: guaranteed income / spending in year 1
  const guaranteedIncome = (firstYear?.p1StatePension ?? 0) + (firstYear?.p1DbPension ?? 0)
                         + (firstYear?.p2StatePension ?? 0) + (firstYear?.p2DbPension ?? 0)
                         + (firstYear?.p1OtherIncome  ?? 0) + (firstYear?.p2OtherIncome  ?? 0);
  const yearOneSpending  = firstYear?.spending ?? 1;
  const incomeStabilityScore = Math.min(100, Math.round((guaranteedIncome / yearOneSpending) * 100));

  // Spending confidence: funded years / total years
  const fundedYears = projections.filter(p => p.totalAssets > 0).length;
  const spendingConfidenceScore = Math.round((fundedYears / projections.length) * 100);

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
    depletionAge:         getAssetDepletionAge(projections),
    lifetimeTaxPaid:      projections.reduce((s, p) => s + p.totalTaxPaid, 0),
    lifetimeCGT:          projections.reduce((s, p) => s + p.totalCgtPaid, 0),
    sustainableRlssLevel: getSustainableRlssLevel(projections, state.mode),
  };
}
