/**
 * Pre-built scenarios for the bucket-ladder validation harness.
 *
 * Each scenario produces a (state, options) pair fed to calculateProjections.
 * The same fixture portfolio runs through every scenario so the comparison
 * is apples-to-apples — only the ladder config and shock parameters differ.
 *
 * Used by scripts/bucket-scenarios/run.ts and the snapshot tests in
 * tests/scenarios/bucketLadder.scenario.test.ts.
 */

import type { PlannerState, BucketLadderConfig } from '@/models/types';
import type { ProjectionOptions } from '@/financialEngine/projectionEngine';
import { BUCKET_LADDER } from '@/config/financialConstants';

export interface ScenarioDefinition {
  /** Stable identifier used on the CLI (e.g. --scenario ladder-default). */
  id: string;
  /** Human-readable label shown in reports. */
  label: string;
  /** One-line summary of what the scenario tests. */
  description: string;
  /** Build the projection inputs from a base fixture state. */
  build: (state: PlannerState) => { state: PlannerState; options?: ProjectionOptions };
}

function withConfig(state: PlannerState, updates: Partial<BucketLadderConfig>): PlannerState {
  return {
    ...state,
    bucketLadderConfig: { ...state.bucketLadderConfig, ...updates },
  };
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'baseline',
    label: 'Baseline (no ladder)',
    description: 'Current production behaviour — bucket ladder disabled.',
    build: (state) => ({ state: withConfig(state, { enabled: false }) }),
  },
  {
    id: 'ladder-default',
    label: 'Ladder — default (on-withdrawal rebalance)',
    description: '2 yrs cash / 5 yrs income; rebalance fires on each withdrawal.',
    build: (state) => ({
      state: withConfig(state, {
        enabled: true,
        cashBufferYears: 2,
        incomeBufferYears: 5,
        rebalanceTrigger: 'onWithdrawal',
      }),
    }),
  },
  {
    id: 'ladder-annual',
    label: 'Ladder — annual rebalance',
    description: 'Same buffers as default but rebalance fires once per year.',
    build: (state) => ({
      state: withConfig(state, {
        enabled: true,
        cashBufferYears: 2,
        incomeBufferYears: 5,
        rebalanceTrigger: 'annual',
      }),
    }),
  },
  {
    id: 'ladder-threshold',
    label: 'Ladder — threshold rebalance',
    description: 'Only rebalance when a bucket drifts more than 10% from target.',
    build: (state) => ({
      state: withConfig(state, {
        enabled: true,
        cashBufferYears: 2,
        incomeBufferYears: 5,
        rebalanceTrigger: 'threshold',
        rebalanceThresholdPercent: 10,
      }),
    }),
  },
  {
    id: 'ladder-no-rebalance',
    label: 'Ladder — no rebalance',
    description: 'Ladder enabled but rebalance off — see drift over time.',
    build: (state) => ({
      state: withConfig(state, { enabled: true, rebalanceTrigger: 'off' }),
    }),
  },
  {
    id: 'sorr-shock-year2',
    label: 'SORR — ladder + 30% growth shock in year 2',
    description: 'Bucket ladder with a 30% growth-bucket shock in year 2.',
    build: (state) => ({
      state: withConfig(state, { enabled: true, rebalanceTrigger: 'onWithdrawal' }),
      options: { growthShockYear: 2, growthShockPercent: BUCKET_LADDER.SORR_EQUITY_SHOCK_PERCENT },
    }),
  },
  {
    id: 'sorr-shock-year2-baseline',
    label: 'SORR — baseline + 30% shock in year 2',
    description: 'No ladder, same 30% shock — full pot impact for comparison.',
    build: (state) => ({
      state: withConfig(state, { enabled: false }),
      options: { growthShockYear: 2, growthShockPercent: BUCKET_LADDER.SORR_EQUITY_SHOCK_PERCENT },
    }),
  },
  {
    id: 'sorr-shock-year5',
    label: 'SORR — ladder + 30% growth shock in year 5',
    description: 'Later-stage shock — tests whether ladder protection still helps.',
    build: (state) => ({
      state: withConfig(state, { enabled: true, rebalanceTrigger: 'onWithdrawal' }),
      options: { growthShockYear: 5, growthShockPercent: BUCKET_LADDER.SORR_EQUITY_SHOCK_PERCENT },
    }),
  },
  {
    id: 'extended-cash-buffer',
    label: 'Ladder — 3yr cash / 7yr income',
    description: 'More conservative buffer sizing.',
    build: (state) => ({
      state: withConfig(state, {
        enabled: true,
        cashBufferYears: 3,
        incomeBufferYears: 7,
        rebalanceTrigger: 'onWithdrawal',
      }),
    }),
  },
];

export function getScenario(id: string): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function listScenarioIds(): string[] {
  return SCENARIOS.map((s) => s.id);
}
