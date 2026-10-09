/**
 * Snapshot tests for the bucket-ladder scenario harness.
 *
 * For each committed example fixture × scenario combination, snapshot a small
 * summary block so any regression in engine output trips a snapshot diff.
 *
 * If a change is intentional, run `npx vitest run tests/scenarios -u` to update.
 */

import { describe, test, expect } from 'vitest';
import { resolve } from 'node:path';
import { calculateProjections, getAssetDepletionAge } from '@/financialEngine/projectionEngine';
import { SCENARIOS } from '../../scripts/bucket-scenarios/scenarios';
import { loadFixture } from '../../scripts/bucket-scenarios/loadFixture';

const SAMPLE_FIXTURE = resolve(__dirname, '../../scripts/bucket-scenarios/examples/sample-portfolio.json');

interface ScenarioSummary {
  depletionAge: number | null;
  totalTaxPaid: number;
  totalRebalances: number;
  totalAssetsAt85: number;
  totalAssetsAtHorizonEnd: number;
}

function summarise(state: ReturnType<typeof loadFixture>['state'], options?: Parameters<typeof calculateProjections>[1]): ScenarioSummary {
  const proj = calculateProjections(state, options);
  return {
    depletionAge: getAssetDepletionAge(proj),
    totalTaxPaid: Math.round(proj.reduce((s, p) => s + p.totalTaxPaid, 0)),
    totalRebalances: proj.reduce((s, p) => s + (p.rebalanceActions?.length ?? 0), 0),
    totalAssetsAt85: Math.round(proj.find((p) => p.p1Age === 85)?.totalAssets ?? 0),
    totalAssetsAtHorizonEnd: Math.round(proj[proj.length - 1]?.totalAssets ?? 0),
  };
}

describe('bucket ladder scenarios — sample portfolio', () => {
  const { state: baseState } = loadFixture(SAMPLE_FIXTURE);

  for (const scenario of SCENARIOS) {
    test(`scenario: ${scenario.id} — output snapshot`, () => {
      const { state, options } = scenario.build(baseState);
      const summary = summarise(state, options);
      expect(summary).toMatchSnapshot();
    });
  }

  test('ladder vs baseline (no shock): ladder must not perform worse at horizon end', () => {
    const baseline = SCENARIOS.find((s) => s.id === 'baseline')!.build(baseState);
    const ladder = SCENARIOS.find((s) => s.id === 'ladder-default')!.build(baseState);
    const baselineSummary = summarise(baseline.state, baseline.options);
    const ladderSummary = summarise(ladder.state, ladder.options);
    expect(ladderSummary.totalAssetsAtHorizonEnd).toBeGreaterThanOrEqual(baselineSummary.totalAssetsAtHorizonEnd - 1);
  });

  test('SORR shock: ladder beats no-ladder under the same shock', () => {
    const noLadderShock = SCENARIOS.find((s) => s.id === 'sorr-shock-year2-baseline')!.build(baseState);
    const ladderShock = SCENARIOS.find((s) => s.id === 'sorr-shock-year2')!.build(baseState);
    const noLadder = summarise(noLadderShock.state, noLadderShock.options);
    const withLadder = summarise(ladderShock.state, ladderShock.options);

    // Ladder run should retain meaningfully more capital at age 85 than no-ladder.
    expect(withLadder.totalAssetsAt85).toBeGreaterThan(noLadder.totalAssetsAt85);

    // If no-ladder depletes, ladder should depletes later (or not at all).
    if (noLadder.depletionAge !== null) {
      const ladderEndAge = withLadder.depletionAge ?? baseState.assumptions.lifeExpectancy;
      expect(ladderEndAge).toBeGreaterThan(noLadder.depletionAge);
    }
  });
});
