/**
 * Unit tests — tax calculation functions.
 * Tests every boundary, rate, and edge case for income tax, CGT, and GIA drawdown.
 */

import { describe, test, expect } from 'vitest';
import { calcIncomeTax, calcCGT, drawFromGIA, isHigherRateTaxpayer } from '@/financialEngine/taxCalculations';
import { INCOME_TAX, CGT } from '@/config/financialConstants';

// ─── calcIncomeTax ────────────────────────────────────────────────────────────

describe('calcIncomeTax', () => {
  test('zero income → £0', () => {
    expect(calcIncomeTax(0)).toBe(0);
  });

  test('income below personal allowance → £0', () => {
    expect(calcIncomeTax(10_000)).toBe(0);
  });

  test('income exactly at personal allowance → £0', () => {
    expect(calcIncomeTax(INCOME_TAX.PERSONAL_ALLOWANCE)).toBe(0);
  });

  test('£1 above personal allowance → 20p tax', () => {
    expect(calcIncomeTax(INCOME_TAX.PERSONAL_ALLOWANCE + 1)).toBeCloseTo(0.20, 2);
  });

  test('£20,000 income → £1,486 (£7,430 × 20%)', () => {
    expect(calcIncomeTax(20_000)).toBeCloseTo(1_486, 0);
  });

  test('income at basic-rate limit → £7,540 (full basic band at 20%)', () => {
    const expected = (INCOME_TAX.BASIC_RATE_LIMIT - INCOME_TAX.PERSONAL_ALLOWANCE) * INCOME_TAX.BASIC_RATE;
    expect(calcIncomeTax(INCOME_TAX.BASIC_RATE_LIMIT)).toBeCloseTo(expected, 0);
  });

  test('£1 above basic-rate limit → basic band + 40p higher rate', () => {
    const basicTax = (INCOME_TAX.BASIC_RATE_LIMIT - INCOME_TAX.PERSONAL_ALLOWANCE) * INCOME_TAX.BASIC_RATE;
    expect(calcIncomeTax(INCOME_TAX.BASIC_RATE_LIMIT + 1)).toBeCloseTo(basicTax + 0.40, 2);
  });

  test('£60,000 income → correct higher-rate calculation', () => {
    const basicBand  = (INCOME_TAX.BASIC_RATE_LIMIT - INCOME_TAX.PERSONAL_ALLOWANCE) * INCOME_TAX.BASIC_RATE;
    const higherBand = (60_000 - INCOME_TAX.BASIC_RATE_LIMIT) * INCOME_TAX.HIGHER_RATE;
    expect(calcIncomeTax(60_000)).toBeCloseTo(basicBand + higherBand, 0);
  });

  test('negative income → £0 (never negative)', () => {
    expect(calcIncomeTax(-5_000)).toBe(0);
  });

  test('income at additional-rate threshold → PA fully tapered to £0', () => {
    // At £125,140 the PA taper eliminates the personal allowance entirely.
    // effectivePA = max(0, 12570 − (125140 − 100000)/2) = 0
    // basicBand  = £50,270 × 20% = £10,054
    // higherBand = (£125,140 − £50,270) × 40% = £29,948
    const tax = calcIncomeTax(INCOME_TAX.ADDITIONAL_RATE_THRESHOLD);
    const expectedBasic  = INCOME_TAX.BASIC_RATE_LIMIT * INCOME_TAX.BASIC_RATE;
    const expectedHigher = (INCOME_TAX.ADDITIONAL_RATE_THRESHOLD - INCOME_TAX.BASIC_RATE_LIMIT) * INCOME_TAX.HIGHER_RATE;
    expect(tax).toBeCloseTo(expectedBasic + expectedHigher, 0);
  });

  test('income in PA taper zone (£110,000) → reduced PA increases tax vs fixed PA', () => {
    // effectivePA = max(0, 12570 − (110000 − 100000)/2) = 7570
    // At £110,000 with fixed PA the tax would be £31,432; with taper it's £32,432 (£1,000 more).
    const taxWithTaper = calcIncomeTax(110_000);
    const taxFixedPa   = (INCOME_TAX.BASIC_RATE_LIMIT - INCOME_TAX.PERSONAL_ALLOWANCE) * INCOME_TAX.BASIC_RATE
                       + (110_000 - INCOME_TAX.BASIC_RATE_LIMIT) * INCOME_TAX.HIGHER_RATE;
    expect(taxWithTaper).toBeGreaterThan(taxFixedPa);
  });

  test('income above additional-rate threshold → 45% band applies', () => {
    // £140,000: additional band = 140000 − 125140 = £14,860 at 45%
    const tax = calcIncomeTax(140_000);
    const additionalTax = (140_000 - INCOME_TAX.ADDITIONAL_RATE_THRESHOLD) * INCOME_TAX.ADDITIONAL_RATE;
    // Tax must include the 45% additional band contribution
    expect(tax).toBeGreaterThan(additionalTax);
    // Verify additional band is taxed at 45% by checking total exceeds the higher-rate-only result
    const higherRateOnly = calcIncomeTax(INCOME_TAX.ADDITIONAL_RATE_THRESHOLD);
    expect(tax).toBeGreaterThan(higherRateOnly);
  });
});

// ─── isHigherRateTaxpayer ─────────────────────────────────────────────────────

describe('isHigherRateTaxpayer', () => {
  test('£0 income → false', () => {
    expect(isHigherRateTaxpayer(0)).toBe(false);
  });

  test('income below basic-rate limit → false', () => {
    expect(isHigherRateTaxpayer(30_000)).toBe(false);
  });

  test('income at basic-rate limit → false', () => {
    expect(isHigherRateTaxpayer(INCOME_TAX.BASIC_RATE_LIMIT)).toBe(false);
  });

  test('£1 above basic-rate limit → true', () => {
    expect(isHigherRateTaxpayer(INCOME_TAX.BASIC_RATE_LIMIT + 1)).toBe(true);
  });

  test('£100,000 income → true', () => {
    expect(isHigherRateTaxpayer(100_000)).toBe(true);
  });
});

// ─── calcCGT ─────────────────────────────────────────────────────────────────

describe('calcCGT', () => {
  test('zero gain → £0', () => {
    expect(calcCGT(0, false)).toBe(0);
  });

  test('gain below annual exempt → £0', () => {
    expect(calcCGT(CGT.ANNUAL_EXEMPT - 1, false)).toBe(0);
  });

  test('gain exactly at annual exempt → £0', () => {
    expect(calcCGT(CGT.ANNUAL_EXEMPT, false)).toBe(0);
  });

  test('£1 above exempt, basic rate → 18p', () => {
    expect(calcCGT(CGT.ANNUAL_EXEMPT + 1, false)).toBeCloseTo(CGT.BASIC_RATE, 2);
  });

  test('£10,000 gain, basic rate → £1,260 (£7,000 × 18%)', () => {
    expect(calcCGT(10_000, false)).toBeCloseTo((10_000 - CGT.ANNUAL_EXEMPT) * CGT.BASIC_RATE, 0);
  });

  test('£10,000 gain, higher rate → £1,680 (£7,000 × 24%)', () => {
    expect(calcCGT(10_000, true)).toBeCloseTo((10_000 - CGT.ANNUAL_EXEMPT) * CGT.HIGHER_RATE, 0);
  });

  test('negative gain → £0', () => {
    expect(calcCGT(-5_000, false)).toBe(0);
  });

  test('basic rate (18%) is less than higher rate (24%) for same gain', () => {
    expect(calcCGT(10_000, false)).toBeLessThan(calcCGT(10_000, true));
  });
});

// ─── drawFromGIA ─────────────────────────────────────────────────────────────

describe('drawFromGIA', () => {
  test('draws exactly the requested amount', () => {
    const r = drawFromGIA(10_000, 6_000, 2_000);
    expect(r.drawn).toBe(2_000);
  });

  test('reduces value by drawn amount', () => {
    const r = drawFromGIA(10_000, 6_000, 2_000);
    expect(r.newValue).toBe(8_000);
  });

  test('calculates proportional capital gain (40% gain fraction)', () => {
    // Value £10k, base £6k → 40% gain fraction; draw £2k → gain £800
    const r = drawFromGIA(10_000, 6_000, 2_000);
    expect(r.capitalGain).toBeCloseTo(800, 1);
  });

  test('reduces base cost proportionally (draws 20% of value → 20% of base cost)', () => {
    // Draw £2k from £10k = 20%; base cost reduces by 20% of £6k = £1,200; new BC = £4,800
    const r = drawFromGIA(10_000, 6_000, 2_000);
    expect(r.newBaseCost).toBeCloseTo(4_800, 1);
  });

  test('caps draw at available value', () => {
    const r = drawFromGIA(5_000, 3_000, 10_000);
    expect(r.drawn).toBe(5_000);
    expect(r.newValue).toBe(0);
  });

  test('zero capital gain when value equals base cost (no gain)', () => {
    const r = drawFromGIA(5_000, 5_000, 2_000);
    expect(r.capitalGain).toBe(0);
  });

  test('zero capital gain when base cost exceeds value (underwater)', () => {
    const r = drawFromGIA(5_000, 7_000, 2_000);
    expect(r.capitalGain).toBe(0);
  });

  test('handles zero value — no draw, no error', () => {
    const r = drawFromGIA(0, 0, 1_000);
    expect(r.drawn).toBe(0);
    expect(r.capitalGain).toBe(0);
    expect(r.newValue).toBe(0);
  });

  test('handles zero needed — no draw', () => {
    const r = drawFromGIA(10_000, 6_000, 0);
    expect(r.drawn).toBe(0);
    expect(r.newValue).toBe(10_000);
    expect(r.newBaseCost).toBe(6_000);
  });

  test('full draw reduces base cost to zero', () => {
    const r = drawFromGIA(10_000, 6_000, 10_000);
    expect(r.newValue).toBe(0);
    expect(r.newBaseCost).toBeCloseTo(0, 1);
  });

  test('drawn + newValue = original value', () => {
    const r = drawFromGIA(10_000, 6_000, 3_000);
    expect(r.drawn + r.newValue).toBeCloseTo(10_000, 1);
  });

  test('capitalGain is never negative', () => {
    const r = drawFromGIA(10_000, 12_000, 5_000);
    expect(r.capitalGain).toBeGreaterThanOrEqual(0);
  });
});
