/**
 * UK tax calculation helpers.
 *
 * All thresholds and rates come from /config/financialConstants — never hardcoded here.
 * Each function is pure (no side effects) and unit-testable.
 */

import { INCOME_TAX, CGT } from '@/config/financialConstants';

/**
 * Calculate UK income tax for a given taxable income figure.
 * Uses 2024/25 bands from financialConstants.
 *
 * Handles:
 * - Personal allowance taper: PA reduces by £1 per £2 above £100,000, reaching £0 at £125,140.
 * - Three rate bands: basic (20%), higher (40%), additional (45% above £125,140).
 *
 * @param taxableIncome - Gross taxable income before personal allowance (£)
 * @returns Income tax due (£)
 */
export function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  // Personal allowance tapers by £1 for every £2 above PA_TAPER_THRESHOLD (£100,000),
  // reaching £0 at ADDITIONAL_RATE_THRESHOLD (£125,140).
  const effectivePA = Math.max(
    0,
    INCOME_TAX.PERSONAL_ALLOWANCE - Math.max(0, taxableIncome - INCOME_TAX.PA_TAPER_THRESHOLD) / 2,
  );

  if (taxableIncome <= effectivePA) return 0;

  const basicBand = Math.max(0, Math.min(
    taxableIncome - effectivePA,
    INCOME_TAX.BASIC_RATE_LIMIT - effectivePA,
  ));
  const higherBand = Math.max(
    0,
    Math.min(taxableIncome, INCOME_TAX.ADDITIONAL_RATE_THRESHOLD) - INCOME_TAX.BASIC_RATE_LIMIT,
  );
  const additionalBand = Math.max(0, taxableIncome - INCOME_TAX.ADDITIONAL_RATE_THRESHOLD);

  return (
    basicBand      * INCOME_TAX.BASIC_RATE +
    higherBand     * INCOME_TAX.HIGHER_RATE +
    additionalBand * INCOME_TAX.ADDITIONAL_RATE
  );
}

/**
 * Returns true if this taxable income level pushes the person into the higher-rate band.
 * Used to determine which CGT rate applies.
 */
export function isHigherRateTaxpayer(taxableIncome: number): boolean {
  return taxableIncome > INCOME_TAX.BASIC_RATE_LIMIT;
}

/**
 * Calculate CGT due on a capital gain using the proportional disposal method.
 * Annual exempt amount is applied per person.
 *
 * @param capitalGain - Total gain realised this year (£)
 * @param higherRate  - True if the person is a higher-rate taxpayer
 * @returns CGT due (£)
 */
export function calcCGT(capitalGain: number, higherRate: boolean): number {
  const taxableGain = Math.max(0, capitalGain - CGT.ANNUAL_EXEMPT);
  return taxableGain * (higherRate ? CGT.HIGHER_RATE : CGT.BASIC_RATE);
}

/**
 * Calculate the tax-free and taxable portions of a GIA disposal
 * using the proportional method (not FIFO).
 *
 * The gain fraction is spread proportionally across each £1 of value.
 * Base cost is reduced by the non-gain (capital return) portion of the withdrawal.
 *
 * @param value    - Current market value of the GIA (£)
 * @param baseCost - Purchase price / base cost (£)
 * @param needed   - Amount needed from the GIA (£)
 */
export function drawFromGIA(
  value: number,
  baseCost: number,
  needed: number,
): { drawn: number; capitalGain: number; newValue: number; newBaseCost: number } {
  if (value <= 0 || needed <= 0) {
    return { drawn: 0, capitalGain: 0, newValue: value, newBaseCost: baseCost };
  }

  const drawn          = Math.min(value, needed);
  const gainFraction   = value > baseCost ? (value - baseCost) / value : 0;
  const capitalGain    = drawn * gainFraction;
  const capitalReturn  = drawn - capitalGain;

  return {
    drawn,
    capitalGain,
    newValue:    value    - drawn,
    newBaseCost: Math.max(0, baseCost - capitalReturn),
  };
}
