#!/usr/bin/env tsx
/**
 * Bucket-ladder scenario runner.
 *
 * Usage:
 *   npm run scenarios -- --fixture <path> --scenario <id> [--out <path>]
 *   npm run scenarios -- --fixture <path> --compare <id1,id2,id3> [--out <path>]
 *   npm run scenarios -- --list
 *
 * Examples:
 *   npm run scenarios -- --fixture scripts/bucket-scenarios/examples/sample-portfolio.json --scenario ladder-default
 *   npm run scenarios -- --fixture my-plan.json --compare baseline,ladder-default,sorr-shock-year2
 *
 * Fixture format: see scripts/bucket-scenarios/loadFixture.ts.
 * Real-portfolio fixtures live under scripts/bucket-scenarios/fixtures/ and are
 * git-ignored — only the committed examples ship in the repo.
 */

import { writeFileSync } from 'node:fs';
import { calculateProjections } from '@/financialEngine/projectionEngine';
import { loadFixture } from './loadFixture';
import { SCENARIOS, getScenario, listScenarioIds } from './scenarios';
import { renderSingle, renderComparison, type ScenarioResult } from './format';

interface ParsedArgs {
  fixture?: string;
  scenario?: string;
  compare?: string;
  out?: string;
  list?: boolean;
  maxRows?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    switch (key) {
      case '--fixture':  args.fixture  = next; i++; break;
      case '--scenario': args.scenario = next; i++; break;
      case '--compare':  args.compare  = next; i++; break;
      case '--out':      args.out      = next; i++; break;
      case '--max-rows': args.maxRows  = Number(next); i++; break;
      case '--list':     args.list = true; break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }
  return args;
}

function printUsage(): void {
  console.log(`Bucket-ladder scenario runner

  --fixture <path>     Path to a portfolio fixture JSON
  --scenario <id>      Run a single scenario (see --list)
  --compare <ids>      Comma-separated list of scenarios to compare
  --out <path>         Save output to file instead of stdout
  --max-rows <n>       Cap year rows in --scenario output (default: all)
  --list               List available scenarios and exit
  -h, --help           Show this help`);
}

function printScenarioList(): void {
  console.log('Available scenarios:');
  for (const s of SCENARIOS) {
    console.log(`  ${s.id.padEnd(28)} ${s.description}`);
  }
}

function emit(output: string, outPath?: string): void {
  if (outPath) {
    writeFileSync(outPath, output);
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(output);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    printScenarioList();
    return;
  }

  if (!args.fixture) {
    console.error('Error: --fixture is required (or use --list)');
    printUsage();
    process.exit(1);
  }

  const fixture = loadFixture(args.fixture);

  if (args.scenario) {
    const def = getScenario(args.scenario);
    if (!def) {
      console.error(`Unknown scenario: ${args.scenario}`);
      console.error(`Known: ${listScenarioIds().join(', ')}`);
      process.exit(1);
    }
    const { state, options } = def.build(fixture.state);
    const projections = calculateProjections(state, options);
    const output = renderSingle({
      fixtureLabel: fixture.label,
      scenarioLabel: def.label,
      scenarioDescription: def.description,
      state,
      projections,
      maxRows: args.maxRows,
    });
    emit(output, args.out);
    return;
  }

  if (args.compare) {
    const ids = args.compare.split(',').map((s) => s.trim()).filter(Boolean);
    const results: ScenarioResult[] = [];
    for (const id of ids) {
      const def = getScenario(id);
      if (!def) {
        console.error(`Unknown scenario: ${id}`);
        process.exit(1);
      }
      const { state, options } = def.build(fixture.state);
      results.push({
        id,
        label: def.label,
        projections: calculateProjections(state, options),
      });
    }
    emit(renderComparison(fixture.label, results), args.out);
    return;
  }

  console.error('Error: --scenario or --compare is required');
  printUsage();
  process.exit(1);
}

main();
