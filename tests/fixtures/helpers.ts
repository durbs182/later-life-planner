/**
 * Shared test helpers — small utilities used across multiple test suites.
 */

import type { YearlyProjection, PlannerState } from '@/models/types';
import { calculateProjections, getStageTotalSpending } from '@/financialEngine/projectionEngine';

/** Get the projection row for a given p1 age (first match). */
export function yearAt(projections: YearlyProjection[], age: number): YearlyProjection {
  const row = projections.find(p => p.p1Age === age);
  if (!row) throw new Error(`No projection row for age ${age}`);
  return row;
}

/** Sum total tax paid across a subset of projection years (by p1 age range, inclusive). */
export function taxBetween(projections: YearlyProjection[], fromAge: number, toAge: number): number {
  return projections
    .filter(p => p.p1Age >= fromAge && p.p1Age <= toAge)
    .reduce((s, p) => s + p.totalTaxPaid, 0);
}

/** Sum CGT paid across a subset of projection years. */
export function cgtBetween(projections: YearlyProjection[], fromAge: number, toAge: number): number {
  return projections
    .filter(p => p.p1Age >= fromAge && p.p1Age <= toAge)
    .reduce((s, p) => s + p.totalCgtPaid, 0);
}

/** Count years with totalTaxPaid < £0.50 (effectively zero, allowing float residuals). */
export function countTaxFreeYears(projections: YearlyProjection[]): number {
  return projections.filter(p => Math.round(p.totalTaxPaid) === 0).length;
}

/** First year where p1Age >= fiAge. */
export function firstFiYear(projections: YearlyProjection[], fiAge: number): YearlyProjection {
  const row = projections.find(p => p.p1Age >= fiAge);
  if (!row) throw new Error(`No projection row at or after fiAge ${fiAge}`);
  return row;
}

/** Run projections and return only the FI-onwards rows. */
export function fiProjections(state: PlannerState): YearlyProjection[] {
  return calculateProjections(state).filter(p => p.p1Age >= state.fiAge);
}

/**
 * Build a state with uniform spending of exactly `annualSpend` across all stages.
 * Distributes evenly across all spending categories.
 */
export function withSpending(state: PlannerState, annualSpend: number): PlannerState {
  const stageIds = state.lifeStages.map(s => s.id);
  const perCategory = annualSpend / state.spendingCategories.length;
  return {
    ...state,
    spendingCategories: state.spendingCategories.map(c => ({
      ...c,
      amounts: Object.fromEntries(stageIds.map(id => [id, perCategory])),
    })),
  };
}

/** Assert two numbers are within `tolerance` of each other. */
export function near(a: number, b: number, tolerance = 1): boolean {
  return Math.abs(a - b) <= tolerance;
}
