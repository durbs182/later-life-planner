# Bucket-ladder scenario harness

Run the cash flow ladder engine against a real or example portfolio **without
enabling the feature in the running app**. Use this to validate whether the
ladder model produces sensible outputs against your actual holdings before any
UI work is done.

The same engine code that the UI will eventually consume powers these scenarios
— no throwaway scaffolding.

## Quick start

```bash
# List available scenarios
npm run scenarios -- --list

# Run a single scenario against the committed example
npm run scenarios -- \
  --fixture scripts/bucket-scenarios/examples/sample-portfolio.json \
  --scenario ladder-default

# Compare baseline vs ladder vs SORR shock side-by-side
npm run scenarios -- \
  --fixture scripts/bucket-scenarios/examples/sample-portfolio.json \
  --compare baseline,ladder-default,sorr-shock-year2,sorr-shock-year2-baseline

# Save output to a markdown report
npm run scenarios -- \
  --fixture my-portfolio.json --scenario ladder-default \
  --out reports/$(date +%F)-ladder-default.md
```

## Fixture format

A fixture is a JSON snapshot of (part of) `PlannerState`. The loader deep-merges
it onto `createDefaultState()` so you only specify the fields that matter. See
`scripts/bucket-scenarios/examples/sample-portfolio.json` for a complete example.

Minimum useful fixture:

```jsonc
{
  "label": "My portfolio — 2026 baseline",
  "annualSpending": 42000,
  "mode": "single",
  "fiAge": 60,
  "person1": {
    "currentAge": 60,
    "assets": {
      "isaInvestments": {
        "enabled": true,
        "totalValue": 100000,
        "growthRate": 5,
        "allocation": {
          "cashPercent": 0,
          "bondsPercent": 30,
          "preciousMetalsPercent": 0,
          "alternativesPercent": 0,
          "equitiesPercent": 70
        }
      }
    }
  }
}
```

### Holdings vs quick allocation

Each pot accepts either of:

- **`allocation`** — quick mode: 5 percentages summing to 100.
- **`holdings`** — detailed mode: list of `{ id, name, value, assetType, mixedAllocation? }`.
  A 'mixed' holding (e.g. a 60/40 fund) needs a `mixedAllocation` sub-split.

If both are set, `holdings` wins. If neither is set, the pot defaults to 100%
growth bucket (legacy behaviour — matches the existing waterfall output).

### Personal portfolios

Files under `scripts/bucket-scenarios/fixtures/` are git-ignored so real
portfolio data never lands in the repo. Drop your own fixture there:

```bash
cp scripts/bucket-scenarios/examples/sample-portfolio.json \
   scripts/bucket-scenarios/fixtures/my-plan.json
# Edit my-plan.json with your real values, then:
npm run scenarios -- --fixture scripts/bucket-scenarios/fixtures/my-plan.json --scenario ladder-default
```

## Scenarios

| ID | What it tests |
|----|---------------|
| `baseline` | Current production behaviour — bucket ladder disabled |
| `ladder-default` | 2 yrs cash / 5 yrs income; rebalance on each withdrawal |
| `ladder-annual` | Same buffers, rebalance once per year |
| `ladder-threshold` | Rebalance only when drift > 10% |
| `ladder-no-rebalance` | Ladder enabled, no rebalance — see drift |
| `sorr-shock-year2` | Ladder + 30% growth shock in year 2 |
| `sorr-shock-year2-baseline` | No ladder + 30% whole-pot shock in year 2 (comparison) |
| `sorr-shock-year5` | Ladder + 30% growth shock in year 5 |
| `extended-cash-buffer` | Ladder with 3 yr cash / 7 yr income |

## Output format

### Single scenario (`--scenario`)

Year-by-year markdown table:

```
Year    Age  Spend    B1 Cash    B2 Inc     B3 Grow    Drew    Tax    Rebal   Total
2026    60   £42.0k   £45.0k     £130.0k    £415.0k    £42.0k  £4.0k  0       £590.0k
2027    61   £43.1k   £30.0k     £135.0k    £430.0k    £43.1k  £4.2k  1       £595.0k
…
```

Followed by:
- Summary block (depletion age, total tax, max drawdown, average B1 utilisation)
- Rebalance log (one row per rebalance action)

### Comparison (`--compare`)

Side-by-side metric table:

```
Metric                       baseline      ladder-default   sorr-shock-year2   sorr-shock-year2-baseline
Depletion age                87            92               90                 85
Portfolio at 85              £42.0k        £180.0k          £128.0k            £8.0k
Total tax paid               £162.2k       £148.4k          £151.0k            £130.0k
Total rebalances             0             24               21                 0
```

## Decision gate (Stage A → Stage B)

After running the harness against your real portfolio, ask:

- Do bucket aggregations match your mental model? Spot-check 3+ pots.
- Does `ladder-default` extend depletion age by ≥ 2 years vs `baseline` under SORR shock?
- Is rebalance frequency under `onWithdrawal` reasonable (≤ ~2 per year)?
- Do mixed-fund allocations produce expected splits?

If yes — proceed to Stage B UI work (Step 3 inputs + dashboard panel).
If no — iterate on the engine in Phase 2/3 before any UI.

See `docs/cash-flow-ladder-design.md` for the full design.
