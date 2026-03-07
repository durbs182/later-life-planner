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

// ─── Capital Gains Tax 2024/25 ────────────────────────────────────────────────
// Source: HMRC — https://www.gov.uk/capital-gains-tax/rates
// Note: Annual exempt was cut from £6,000 (2023/24) to £3,000 (2024/25).
// User-adjustable: No (HMRC-defined).

export const CGT = {
  /** Annual exempt amount per person. Gains below this are not taxed. */
  ANNUAL_EXEMPT: 3_000,
  /** CGT rate for basic-rate taxpayers on non-property assets. */
  BASIC_RATE: 0.10,
  /** CGT rate for higher-rate taxpayers on non-property assets. */
  HIGHER_RATE: 0.20,
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

// ─── DC Pension: UFPLS / PCLS rules ──────────────────────────────────────────
// Source: HMRC pension rules
// The app uses the UFPLS model for ongoing drawdown projections.

export const PENSION_RULES = {
  /**
   * Fraction of each UFPLS withdrawal that is tax-free.
   * Source: HMRC — 25% of each Uncrystallised Funds Pension Lump Sum is tax-free.
   */
  UFPLS_TAX_FREE_FRACTION: 0.25,
  /**
   * Maximum fraction of DC pot that can be taken as a one-off tax-free PCLS
   * (Pension Commencement Lump Sum) at crystallisation.
   */
  PCLS_MAX_FRACTION: 0.25,
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
   * Default financial independence / end-of-work age.
   * Life stages (Active Years, Gradual Transition, Later Years) start from this age.
   * Everything before this is modelled as working years.
   */
  FI_AGE: 65,
} as const;

// ─── Withdrawal order ─────────────────────────────────────────────────────────
// The app follows this UK tax-efficient ordering.
// Source: Standard UK financial planning practice.

export const WITHDRAWAL_ORDER = [
  'personal_allowance', // Guaranteed income fills personal allowance first
  'cgt_allowance',      // Use CGT exempt amount on GIA disposals
  'pcls',               // 25% pension tax-free lump sum at crystallisation
  'isa',                // ISA — fully tax-free at any time
  'gia',                // GIA — CGT on gains above annual exempt
  'cash',               // Cash savings — no tax on withdrawal
  'dc_pension',         // Taxable pension drawdown (75% taxable via UFPLS)
] as const;

export type WithdrawalStep = typeof WITHDRAWAL_ORDER[number];
