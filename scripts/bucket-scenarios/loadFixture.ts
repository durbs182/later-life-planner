/**
 * Fixture loader for the bucket-ladder scenario harness.
 *
 * Reads a JSON portfolio fixture and merges it on top of createDefaultState()
 * so the user only needs to supply the fields that matter for their plan.
 * Returns a fully-populated PlannerState ready to feed into calculateProjections.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PlannerState } from '@/models/types';
import { createDefaultState, normalizePlannerState } from '@/lib/mockData';

export interface LoadedFixture {
  label: string;
  state: PlannerState;
}

interface RawFixture {
  label?: string;
  /** Annual spending target in today's £. Overrides the spending categories' sum if provided. */
  annualSpending?: number;
  /** Any subset of PlannerState fields. Deep-merged onto createDefaultState(). */
  [key: string]: unknown;
}

export function loadFixture(path: string): LoadedFixture {
  const absolute = resolve(path);
  const raw = JSON.parse(readFileSync(absolute, 'utf-8')) as RawFixture;
  const { label, annualSpending, ...overrides } = raw;

  const base = createDefaultState(
    typeof (overrides as { person1?: { currentAge?: number } }).person1?.currentAge === 'number'
      ? (overrides as { person1: { currentAge: number } }).person1.currentAge
      : undefined,
  );

  let state = deepMerge(base, overrides as Partial<PlannerState>) as PlannerState;

  // annualSpending shortcut: rescale spending categories so go-go stage sum = annualSpending.
  if (typeof annualSpending === 'number' && annualSpending > 0) {
    state = applyAnnualSpending(state, annualSpending);
  }

  // Run through the normalizer so fields like p2FiAge default correctly.
  state = normalizePlannerState(state);

  return {
    label: label ?? `Fixture: ${path}`,
    state,
  };
}

/**
 * Deep-merge plain objects. Arrays in the source replace target arrays.
 * Functions and class instances are not handled — fixtures are JSON.
 */
function deepMerge<T>(target: T, source: Partial<T> | undefined): T {
  if (!source) return target;
  if (Array.isArray(source)) return source as unknown as T;
  if (typeof source !== 'object' || source === null) return source as T;
  const result: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const existing = (target as Record<string, unknown>)[key];
    if (
      value && typeof value === 'object' && !Array.isArray(value)
      && existing && typeof existing === 'object' && !Array.isArray(existing)
    ) {
      result[key] = deepMerge(existing as object, value as object);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Rescale spending categories so the active (go-go) stage total equals the
 * provided annualSpending. Keeps the relative tier weights from createDefaultState.
 */
function applyAnnualSpending(state: PlannerState, annualSpending: number): PlannerState {
  const currentTotal = state.spendingCategories.reduce(
    (sum, cat) => sum + (cat.amounts['go-go'] ?? 0),
    0,
  );
  if (currentTotal <= 0) return state;
  const scale = annualSpending / currentTotal;
  return {
    ...state,
    spendingCategories: state.spendingCategories.map((cat) => ({
      ...cat,
      amounts: Object.fromEntries(
        Object.entries(cat.amounts).map(([k, v]) => [k, Math.round((v ?? 0) * scale)]),
      ),
    })),
  };
}
