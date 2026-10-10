/**
 * PCLS crystallisation timing for the `pcls-bed-isa` drawdown strategy.
 *
 * Shared by projectionEngine and withdrawalOptimizer so both fire the
 * crystallisation event for each person in the same simulation year.
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

export interface PclsAges {
  p1: number;
  /** Null in single mode. */
  p2: number | null;
}

/**
 * Person 1 crystallises at `pclsAge` (default `fiAge`). Person 2 crystallises
 * in the same tax year, or later if they have not yet reached their own
 * minimum pension age. Both are clamped so the event is never in the past.
 */
export function resolvePclsAges(state: PlannerState): PclsAges {
  const { person1, person2, mode } = state;
  const p1 = resolveCrystallisationAge(state.pclsAge ?? state.fiAge, person1.currentAge);
  if (mode !== 'couple') return { p1, p2: null };

  const p2Candidate = person2.currentAge + (p1 - person1.currentAge);
  return { p1, p2: resolveCrystallisationAge(p2Candidate, person2.currentAge) };
}
