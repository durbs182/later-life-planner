# Local Codex Parallel Orchestration

This repo can support multiple local Codex workers, but only when the work is split into clean ownership boundaries. The safe pattern is separate git worktrees, one prompt per worker, and one final integrator pass.

The script at `scripts/codex-parallel.sh` is a small launcher around `codex exec`. It is intentionally simple:

- one manifest row per worker
- one git worktree per worker branch
- one prompt file per worker
- one results folder per run under `.codex-orchestrator/`

## When to use it

Use parallel workers for tasks that are mostly independent:

- tests vs implementation
- UI copy/layout vs financial engine work
- review/audit vs coding
- docs vs source changes

Do not use it for a tightly-coupled refactor that touches the same files or depends on one unresolved design decision. In that case, the merge overhead outweighs the parallelism.

## Manifest format

The launcher expects a tab-separated file with five columns:

```text
name<TAB>branch<TAB>worktree<TAB>prompt_file<TAB>owned_paths
```

Example:

```text
tests	codex/example-tests	../later-life-planner-tests	docs/operations/codex-prompts/tests-agent.md	tests
ui	codex/example-ui	../later-life-planner-ui	docs/operations/codex-prompts/ui-agent.md	src/app,src/components
```

Notes:

- `worktree` and `prompt_file` can be absolute paths or paths relative to the repo root.
- `owned_paths` is a prompt-level contract, not hard filesystem isolation.
- The example manifest is stored at `docs/operations/codex-parallel.example.tsv`.

## Prompt contract

Each worker should get a narrow brief and explicit ownership. The launcher prepends shared rules, but the prompt file still needs a concrete task. The example prompt files in `docs/operations/codex-prompts/` are placeholders and intentionally stop without making changes until you replace `REPLACE_ME`.

Good worker prompts include:

- exact objective
- allowed write scope
- explicit forbidden areas
- required verification
- what to report back to the integrator

## Run it

Make the script executable once:

```bash
chmod +x scripts/codex-parallel.sh
```

Then launch a run:

```bash
scripts/codex-parallel.sh docs/operations/codex-parallel.example.tsv spike-1
```

Artifacts land in:

```text
.codex-orchestrator/runs/spike-1/
  logs/
  prompts/
  results/
  summary.tsv
```

You can optionally override the model:

```bash
CODEX_MODEL=o3 scripts/codex-parallel.sh docs/operations/codex-parallel.example.tsv
```

## Suggested coordination workflow

1. Write one prompt file per worker with real task text.
2. Give each worker a branch and a worktree outside the main checkout.
3. Keep file ownership explicit in the manifest.
4. Let workers finish independently.
5. Review each worktree diff and result file.
6. Merge or cherry-pick into one integration branch.
7. Run the full verification only after integration.

The parent or integrator should still enforce the final quality bar. Because `owned_paths` is only expressed in the prompt, a worker can still drift if the prompt is weak.
