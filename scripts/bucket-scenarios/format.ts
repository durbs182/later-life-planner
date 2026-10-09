/**
 * Plain-text table renderers for the bucket-ladder scenario harness.
 *
 * Output is markdown-flavoured so the same string can be printed to a terminal
 * or saved to a .md report with --out. All numbers are £, rounded to whole pounds.
 */

import type { YearlyProjection, PlannerState } from '@/models/types';
import { getAssetDepletionAge } from '@/financialEngine/projectionEngine';
import { calculateBucketTargets } from '@/financialEngine/bucketLadderEngine';

const COMPACT_K = 1000;
const COMPACT_M = 1_000_000;

function gbp(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '£0';
  const abs = Math.abs(value);
  if (abs >= COMPACT_M) return `£${(value / COMPACT_M).toFixed(2)}m`;
  if (abs >= COMPACT_K) return `£${(value / COMPACT_K).toFixed(1)}k`;
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

function pad(str: string, width: number, align: 'l' | 'r' = 'l'): string {
  if (str.length >= width) return str;
  return align === 'l' ? str.padEnd(width) : str.padStart(width);
}

// ─── Single-scenario year-by-year table ──────────────────────────────────────

export interface RenderSingleArgs {
  fixtureLabel: string;
  scenarioLabel: string;
  scenarioDescription: string;
  state: PlannerState;
  projections: YearlyProjection[];
  /** Cap row count so terminals don't drown. */
  maxRows?: number;
}

export function renderSingle(args: RenderSingleArgs): string {
  const { fixtureLabel, scenarioLabel, scenarioDescription, state, projections } = args;
  const maxRows = args.maxRows ?? projections.length;
  const ladder = state.bucketLadderConfig?.enabled;

  const lines: string[] = [];
  lines.push(`# ${scenarioLabel}`);
  lines.push('');
  lines.push(`Fixture: **${fixtureLabel}**`);
  lines.push(`Bucket ladder: **${ladder ? 'enabled' : 'disabled'}**`);
  lines.push(`Scenario: ${scenarioDescription}`);
  lines.push('');

  const headers = [
    pad('Year',     6, 'l'),
    pad('Age',      4, 'r'),
    pad('Spend',    8, 'r'),
    pad('B1 Cash',  10, 'r'),
    pad('B2 Inc',   10, 'r'),
    pad('B3 Grow',  10, 'r'),
    pad('Drew',     8, 'r'),
    pad('Tax',      8, 'r'),
    pad('Rebal',    6, 'r'),
    pad('Total',    10, 'r'),
  ];
  lines.push(headers.join('  '));
  lines.push('-'.repeat(headers.join('  ').length));

  for (const p of projections.slice(0, maxRows)) {
    const drew = (p.dcDrawdown ?? 0) + (p.isaDrawdown ?? 0) + (p.giaDrawdown ?? 0) + (p.cashDrawdown ?? 0);
    const rebalCount = p.rebalanceActions?.length ?? 0;
    const row = [
      pad(String(2026 + p.yearIndex), 6, 'l'),
      pad(String(p.p1Age),            4, 'r'),
      pad(gbp(p.spending),            8, 'r'),
      pad(gbp(p.bucketValues?.cash   ?? 0), 10, 'r'),
      pad(gbp(p.bucketValues?.income ?? 0), 10, 'r'),
      pad(gbp(p.bucketValues?.growth ?? 0), 10, 'r'),
      pad(gbp(drew),                  8, 'r'),
      pad(gbp(p.totalTaxPaid),        8, 'r'),
      pad(String(rebalCount),         6, 'r'),
      pad(gbp(p.totalAssets),         10, 'r'),
    ];
    lines.push(row.join('  '));
  }
  lines.push('');

  // Summary block
  const depletion = getAssetDepletionAge(projections);
  const totalTax = projections.reduce((s, p) => s + p.totalTaxPaid, 0);
  const totalRebals = projections.reduce((s, p) => s + (p.rebalanceActions?.length ?? 0), 0);
  const maxDraw = projections.reduce((m, p) => Math.max(m,
    (p.dcDrawdown ?? 0) + (p.isaDrawdown ?? 0) + (p.giaDrawdown ?? 0) + (p.cashDrawdown ?? 0),
  ), 0);

  let avgBucketUse: string = 'N/A';
  if (ladder) {
    const ladderConfig = state.bucketLadderConfig;
    const yearsWithCashTarget = projections.filter((p) => p.bucketValues && p.spending > 0);
    if (yearsWithCashTarget.length > 0) {
      const ratios = yearsWithCashTarget.map((p) => {
        const target = calculateBucketTargets(p.spending, ladderConfig);
        return target.cash > 0 ? (p.bucketValues!.cash / target.cash) * 100 : 0;
      });
      const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      avgBucketUse = `${avg.toFixed(0)}% of target`;
    }
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Depletion age:        **${depletion ?? 'no depletion within horizon'}**`);
  lines.push(`- Life expectancy:      ${state.assumptions.lifeExpectancy}`);
  lines.push(`- Total tax paid:       ${gbp(totalTax)}`);
  lines.push(`- Total rebalances:     ${totalRebals}`);
  lines.push(`- Max single drawdown:  ${gbp(maxDraw)}`);
  lines.push(`- Avg B1 utilisation:   ${avgBucketUse}`);
  lines.push('');

  // Rebalance log (only if any fired)
  if (totalRebals > 0) {
    lines.push('## Rebalance log');
    lines.push('');
    lines.push(`${pad('Year', 6)}  ${pad('Age', 4, 'r')}  ${pad('Action', 40)}  ${pad('Amount', 10, 'r')}`);
    lines.push('-'.repeat(70));
    for (const p of projections) {
      if (!p.rebalanceActions || p.rebalanceActions.length === 0) continue;
      for (const a of p.rebalanceActions) {
        const action = `${a.fromBucket} → ${a.toBucket}`;
        lines.push(`${pad(String(2026 + p.yearIndex), 6)}  ${pad(String(p.p1Age), 4, 'r')}  ${pad(action, 40)}  ${pad(gbp(a.amount), 10, 'r')}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Comparison table across scenarios ────────────────────────────────────────

export interface ScenarioResult {
  id: string;
  label: string;
  projections: YearlyProjection[];
}

export function renderComparison(fixtureLabel: string, results: ScenarioResult[]): string {
  const lines: string[] = [];
  lines.push(`# Scenario Comparison`);
  lines.push('');
  lines.push(`Fixture: **${fixtureLabel}**`);
  lines.push('');

  const rows = results.map((r) => {
    const depletion = getAssetDepletionAge(r.projections);
    const totalTax = r.projections.reduce((s, p) => s + p.totalTaxPaid, 0);
    const at85 = r.projections.find((p) => p.p1Age === 85)?.totalAssets ?? 0;
    const totalRebals = r.projections.reduce((s, p) => s + (p.rebalanceActions?.length ?? 0), 0);
    const horizonEndTotal = r.projections[r.projections.length - 1]?.totalAssets ?? 0;
    return {
      id: r.id, label: r.label, depletion, totalTax, at85, totalRebals, horizonEndTotal,
    };
  });

  const widthLabel = Math.max(20, ...rows.map((r) => r.label.length)) + 2;
  const header = [
    pad('Metric', 28),
    ...rows.map((r) => pad(r.label, widthLabel, 'r')),
  ].join('  ');
  lines.push(header);
  lines.push('-'.repeat(header.length));

  const metricRow = (label: string, values: string[]): string =>
    [pad(label, 28), ...values.map((v) => pad(v, widthLabel, 'r'))].join('  ');

  lines.push(metricRow('Depletion age',
    rows.map((r) => r.depletion === null ? 'no depletion' : String(r.depletion)),
  ));
  lines.push(metricRow('Portfolio at 85',
    rows.map((r) => gbp(r.at85)),
  ));
  lines.push(metricRow('Portfolio at end of horizon',
    rows.map((r) => gbp(r.horizonEndTotal)),
  ));
  lines.push(metricRow('Total tax paid',
    rows.map((r) => gbp(r.totalTax)),
  ));
  lines.push(metricRow('Total rebalances',
    rows.map((r) => String(r.totalRebals)),
  ));
  lines.push('');

  return lines.join('\n');
}
