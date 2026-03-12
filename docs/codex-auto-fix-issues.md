# Codex Auto-Fix Workflow — Issues & Fixes

File: `.github/workflows/codex-auto-fix.yml`

This document lists confirmed issues found by testing the workflow. Apply all fixes to
`.github/workflows/codex-auto-fix.yml`. Do not modify any other file.

---

## Issue 1 — Wrong input names (CRITICAL: action never works)

The `openai/codex-action` uses hyphenated input names. The current workflow uses underscores,
which GitHub Actions silently ignores, so the API key is never passed and Codex exits immediately.

**Confirmed from CI log:**
```
##[warning] Unexpected input(s) 'openai_api_key', 'codex_args'
valid inputs are: 'openai-api-key', 'codex-args'
```

**Fix:** Rename both inputs in the `Run Codex` step:
- `openai_api_key` → `openai-api-key`
- `codex_args` → `codex-args`

The `sandbox_mode` config flag in `codex_args` is also redundant — the action already has a
first-class `sandbox` input. Replace `codex_args` with:
```yaml
sandbox: workspace-write
```

---

## Issue 2 — Unpinned action SHA (supply chain risk)

`openai/codex-action@main` resolves to whatever is on the `main` branch at run time.
Any commit to that branch immediately affects this workflow.

**Fix:** Pin to the SHA that was resolved in the last run:
```
openai/codex-action@dbe3d52c04f09b8b5712c97eae07e413dff25442
```

Also pin `peter-evans/create-pull-request` which is currently pinned only to a tag (`v6`):
```
peter-evans/create-pull-request@c5a7806660adbe173f04e3e038b0ccdcd758773c
```

---

## Issue 3 — Codex can weaken tests instead of fixing code

The current prompt asks Codex to "make all tests pass" without restricting which files it can
change. Codex could satisfy the prompt by deleting tests, adding `it.skip()`, or altering
assertions to match broken behaviour. The `Verify tests` step would then pass on weakened tests.

**Fix:** Update the prompt in the `Run Codex` step to explicitly forbid modifying test files:

```
You are working in a Next.js TypeScript application. The test suite (Vitest, not Jest) is
failing. Read the repository, run the test suite to identify what is broken, then implement
the minimal change to source files under src/ that makes all tests pass. Do not modify any
file under tests/ or docs/. Do not refactor unrelated code. Keep changes small and surgical.
```

---

## Issue 4 — Missing ANTHROPIC_API_KEY in verify step

The CI/CD `test` job passes `ANTHROPIC_API_KEY` as an environment variable. The `Verify tests`
step in this workflow does not. If any test ever requires it the verify step will fail even after
a valid fix, causing Codex's PR to never be created.

**Fix:** Add the env var to the `Verify tests` step:
```yaml
- name: Verify tests
  run: npm test --silent
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## Issue 5 — No concurrency limit

If CI fails on multiple commits in quick succession (e.g. a bad merge followed by a revert push),
multiple Codex runs will queue up simultaneously, burning API credits and potentially creating
duplicate PRs.

**Fix:** Add a concurrency block at the job level so only one auto-fix run executes at a time
and any in-flight run is cancelled when a newer one starts:
```yaml
jobs:
  auto-fix:
    concurrency:
      group: codex-auto-fix
      cancel-in-progress: true
```

---

## Summary of all changes to apply

| Location | Change |
|----------|--------|
| `uses: openai/codex-action@main` | Pin to `@dbe3d52c04f09b8b5712c97eae07e413dff25442` |
| `uses: peter-evans/create-pull-request@v6` | Pin to `@c5a7806660adbe173f04e3e038b0ccdcd758773c` |
| `openai_api_key:` input | Rename to `openai-api-key:` |
| `codex_args:` input | Remove; replace with `sandbox: workspace-write` |
| `prompt:` value | Replace with updated prompt that forbids modifying `tests/` |
| `Verify tests` step | Add `env: ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}` |
| `auto-fix` job | Add `concurrency: group: codex-auto-fix, cancel-in-progress: true` |
