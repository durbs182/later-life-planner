/**
 * Full tax-free lump sum (PCLS) timing and reinvestment.
 *
 * Shared by projectionEngine and withdrawalOptimizer so both fire each person's
 * lump sum in the same simulation year and reinvest it the same way. Each
 * person's lump sum is independent: their own on/off switch and age.
 */

import { CURRENT_TAX_YEAR_START, PENSION_RULES } from '@/config/financialConstants';
import type { PlannerState } from '@/models/types';

function nmpaForCalendarYear(calendarYear: number): number {
  return calendarYear >= PENSION_RULES.NMPA_RISE_YEAR
    ? PENSION_RULES.MIN_ACCESS_AGE_POST_2028
    : PENSION_RULES.MIN_ACCESS_AGE;
}

/**
 * Earliest age ≥ `rawAge` (and ≥ `currentAge`) at which the person has reached
 * the minimum pension age. Steps year by year because deferring to 55 can land
 * in 2028 or later, when the minimum becomes 57.
 */
export function resolveCrystallisationAge(rawAge: number, currentAge: number): number {
  let age = Math.max(rawAge, currentAge);
  while (age < nmpaForCalendarYear(CURRENT_TAX_YEAR_START + (age - currentAge))) age++;
  return age;
}

/**
 * Person 2's FI age. When unset, the age person 2 will be when person 1 reaches
 * `fiAge`, so the household retires together.
 */
export function resolveP2FiAge(state: PlannerState): number {
  return state.p2FiAge ?? (
    state.mode === 'couple'
      ? state.person2.currentAge + (state.fiAge - state.person1.currentAge)
      : state.fiAge
  );
}

export interface PclsAges {
  /** Null when the person has no DC pension or has not opted in. */
  p1: number | null;
  p2: number | null;
}

export function resolvePclsAges(state: PlannerState): PclsAges {
  const { person1, person2, mode } = state;
  const dc1 = person1.incomeSources.dcPension;
  const dc2 = person2.incomeSources.dcPension;

  const p1 = dc1.enabled && dc1.fullLumpSum?.enabled
    ? resolveCrystallisationAge(dc1.fullLumpSum.age ?? state.fiAge, person1.currentAge)
    : null;
  const p2 = mode === 'couple' && dc2.enabled && dc2.fullLumpSum?.enabled
    ? resolveCrystallisationAge(dc2.fullLumpSum.age ?? resolveP2FiAge(state), person2.currentAge)
    : null;
  return { p1, p2 };
}

export interface LumpSumAllocation {
  p1Isa: number;
  p2Isa: number;
  /** Joint GIA in couple mode, person 1's GIA when single. */
  gia: number;
}

/**
 * Splits this year's lump sums across ISA allowances. Each person's lump sum
 * fills their own ISA first, so one partner's lump sum never takes the other's
 * allowance ahead of that partner's own lump sum in the same year. Any excess
 * then uses the partner's spare allowance, and the rest goes to the GIA.
 */
export function allocateLumpSums(
  p1Lump: number,
  p2Lump: number,
  p1IsaCapacity: number,
  p2IsaCapacity: number,
): LumpSumAllocation {
  const p1Own = Math.min(p1Lump, Math.max(0, p1IsaCapacity));
  const p2Own = Math.min(p2Lump, Math.max(0, p2IsaCapacity));
  const p1ToP2 = Math.min(p1Lump - p1Own, Math.max(0, p2IsaCapacity - p2Own));
  const p2ToP1 = Math.min(p2Lump - p2Own, Math.max(0, p1IsaCapacity - p1Own));
  return {
    p1Isa: p1Own + p2ToP1,
    p2Isa: p2Own + p1ToP2,
    gia: p1Lump + p2Lump - p1Own - p2Own - p1ToP2 - p2ToP1,
  };
}
