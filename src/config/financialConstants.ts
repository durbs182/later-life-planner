/**
 * Central configuration for all UK financial constants and assumptions.
 *
 * RULE: No financial value should be hardcoded in any component or engine.
 *       All values are defined here with source, reason, and adjustability notes.
 *
 * Update this file to keep the entire app in sync with HMRC/DWP changes.
 */

// ─── UK Income Tax 2024/25 ────────────────────────────────────────────────────
// Source: HMRC — https://www.gov.uk/income-tax-rates
// User-adjustable: No (HMRC-defined). Update annually.

export const INCOME_TAX = {
  /** Personal allowance: income below this is tax-free. */
  PERSONAL_ALLOWANCE: 12_570,
  /** Top of basic-rate band. Income between personal allowance and this is taxed at BASIC_RATE. */
  BASIC_RATE_LIMIT: 50_270,
  /** Income tax rate on income within the basic-rate band. */
  BASIC_RATE: 0.20,
  /** Income tax rate on income above the basic-rate limit. */
  HIGHER_RATE: 0.40,
  /** Additional-rate threshold. */
  ADDITIONAL_RATE_THRESHOLD: 125_140,
  /** Additional-rate tax rate. */
  ADDITIONAL_RATE: 0.45,
} as const;

// ─── Capital Gains Tax ────────────────────────────────────────────────────────
// Source: HMRC — https://www.gov.uk/capital-gains-tax/rates
// Rates on non-property assets raised in Autumn Budget 30 Oct 2024.
// Annual exempt cut from £6,000 (2023/24) to £3,000 (2024/25).
// User-adjustable: No (HMRC-defined). Update annually.

export const CGT = {
  /** Annual exempt amount per person. Gains below this are not taxed. */
  ANNUAL_EXEMPT: 3_000,
  /** CGT rate for basic-rate taxpayers on non-property assets (from 30 Oct 2024). */
  BASIC_RATE: 0.18,
  /** CGT rate for higher-rate taxpayers on non-property assets (from 30 Oct 2024). */
  HIGHER_RATE: 0.24,
  /** CGT rate for basic-rate taxpayers on residential property gains. */
  PROPERTY_BASIC_RATE: 0.18,
  /** CGT rate for higher-rate taxpayers on residential property gains. */
  PROPERTY_HIGHER_RATE: 0.24,
} as const;

// ─── State Pension 2024/25 ───────────────────────────────────────────────────
// Source: DWP — https://www.gov.uk/new-state-pension
// User-adjustable: Yes — users input their own personal forecast.

export const STATE_PENSION = {
  /** Full new State Pension weekly amount 2024/25 (after triple lock). */
  FULL_NEW_WEEKLY: 221.20,
  /** Years of National Insurance needed for the full new State Pension. */
  QUALIFYING_YEARS_FULL: 35,
  /** Minimum NI years to receive any new State Pension. */
  MIN_QUALIFYING_YEARS: 10,
  /** Current State Pension age. Rising to 67 between 2026–2028. */
  DEFAULT_AGE: 67,
} as const;

// ─── UK Retirement Living Standards (RLSS) 2024 ──────────────────────────────
// Source: Pensions and Lifetime Savings Association (PLSA) — https://www.retirementlivingstandards.org.uk
// User-adjustable: These are starting templates only; users customise category amounts.

export const RLSS = {
  single: {
    minimum:     { annual: 13_400, label: 'Minimum',     emoji: '🏠', description: 'Covers basic needs with a little flexibility' },
    moderate:    { annual: 31_700, label: 'Moderate',    emoji: '🌿', description: 'More financial security and comfort' },
    comfortable: { annual: 43_900, label: 'Comfortable', emoji: '⭐', description: 'More freedom and some luxuries' },
  },
  couple: {
    minimum:     { annual: 21_600, label: 'Minimum',     emoji: '🏠', description: 'Covers basic needs with a little flexibility' },
    moderate:    { annual: 43_900, label: 'Moderate',    emoji: '🌿', description: 'More financial security and comfort' },
    comfortable: { annual: 60_600, label: 'Comfortable', emoji: '⭐', description: 'More freedom and some luxuries' },
  },
} as const;

// ─── DC Pension: UFPLS rules ──────────────────────────────────────────────────
// Source: HMRC pension rules
// The app uses a pure UFPLS (Uncrystallised Funds Pension Lump Sum) strategy.
// No upfront PCLS lump sum is taken at crystallisation — each withdrawal spreads
// the 25% tax-free entitlement across the drawdown period, leaving the full pot
// invested and tax-sheltered for longer.

export const PENSION_RULES = {
  /**
   * Fraction of each UFPLS withdrawal that is tax-free.
   * Source: HMRC — 25% of each Uncrystallised Funds Pension Lump Sum is tax-free.
   * The remaining 75% is taxable as income in the year of withdrawal.
   * Before State Pension age, the 75% taxable portion can often be absorbed
   * by the personal allowance, making early UFPLS draws highly tax-efficient.
   */
  UFPLS_TAX_FREE_FRACTION: 0.25,
  /**
   * Lifetime Lump Sum Allowance (LSA) — the maximum total tax-free cash a person
   * can take from all pension schemes in their lifetime.
   * Source: HMRC Finance Act 2024 — the LSA replaced the Lifetime Allowance.
   * £268,275 = 25% of the former standard Lifetime Allowance (£1,073,100).
   * The 25% tax-free UFPLS portion of each withdrawal accumulates against this limit.
   * Once the LSA is exhausted, subsequent DC withdrawals are fully taxable.
   * Update annually if HMRC revises the LSA figure.
   */
  PCLS_LUMP_SUM_ALLOWANCE: 268_275,
  /** Minimum age at which DC pension can be accessed (rising to 57 in 2028). */
  MIN_ACCESS_AGE: 55,
} as const;

// ─── Default projection assumptions ─────────────────────────────────────────
// User-adjustable: Yes — displayed in Step 3 and overrideable via env vars.
// Source: UK long-run market averages and OBR inflation forecasts.

export const DEFAULT_ASSUMPTIONS = {
  /**
   * Expected annual nominal investment return.
   * Source: long-run UK equity average ~7%; net of charges ~4–5%.
   * Override via env: NEXT_PUBLIC_INVESTMENT_RETURN
   */
  INVESTMENT_GROWTH: parseFloat(process.env.NEXT_PUBLIC_INVESTMENT_RETURN ?? '4'),

  /**
   * Expected annual CPI inflation rate.
   * Source: Bank of England 2% target; historical average ~2.5%.
   * Override via env: NEXT_PUBLIC_DEFAULT_INFLATION
   */
  INFLATION: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_INFLATION ?? '2.5'),

  /**
   * Default planning horizon (life expectancy).
   * Source: ONS UK life expectancy at 65; planning to 95 is prudent.
   * User-adjustable in Step 1.
   */
  LIFE_EXPECTANCY: parseInt(process.env.NEXT_PUBLIC_DEFAULT_LIFE_EXPECTANCY ?? '95'),

  /**
   * Default primary user age when no age is stored.
   */
  DEFAULT_AGE: 57,

  /**
   * Default financial independence age — the age from which work becomes a choice.
   * Life stages (Go-Go Years, Slo-Go Years, No-Go Years) start from this age.
   * Everything before this is the building phase, still fully modelled in projections.
   */
  FI_AGE: 65,
} as const;

// ─── Care Reserve ────────────────────────────────────────────────────────────
// An optional earmarked capital reserve for late-life care costs.
// Excluded from the normal drawdown waterfall; grows at the portfolio growth rate.

export const CARE_RESERVE = {
  /**
   * Default suggested amount.
   * Source: UK care home costs average c.£35k–£50k/yr; a £100k reserve
   * covers roughly 2–3 years of residential care (Laing Buisson 2024 estimates).
   */
  DEFAULT_AMOUNT: 100_000,
  /** Maximum slider value. */
  MAX_AMOUNT: 500_000,
} as const;

// ─── Withdrawal order ─────────────────────────────────────────────────────────
// The app follows this UK tax-efficient ordering.
// Source: Standard UK financial planning practice.

export const WITHDRAWAL_ORDER = [
  'personal_allowance', // Guaranteed income fills personal allowance first
  'cgt_allowance',      // Use CGT exempt amount on GIA disposals
  'isa',                // ISA — fully tax-free at any time
  'gia',                // GIA — CGT on gains above annual exempt
  'cash',               // Cash savings — no tax on withdrawal
  'ufpls',              // DC pension via UFPLS — 25% tax-free per withdrawal, 75% taxable income
] as const;

export type WithdrawalStep = typeof WITHDRAWAL_ORDER[number];
