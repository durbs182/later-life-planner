# CI/CD Validation Instructions For Claude Code

Use these instructions to validate the changes in `.github/workflows/ci-cd.yml` on branch `feat/ci-cd-guardrails`.

## Goal

Confirm these fixes work end-to-end:

1. Manual dispatch from a non-`master` branch does not deploy
2. ACA restart targets the revision created by the current deploy
3. Test-only and workflow-only changes trigger CI
4. Workflow concurrency is active
5. Images are tagged with `github.sha`
6. BuildKit caching is active

## Constraints

- Do not change application code
- If workflow edits are needed to complete validation, stop and report them instead of silently fixing them
- Capture exact workflow run URLs and relevant logs

## Validation steps

### 1. Static check

- Open `.github/workflows/ci-cd.yml`
- Confirm:
  - `concurrency` exists at workflow level
  - `changes` outputs include both `ci` and `container`
  - `test` uses `needs.changes.outputs.ci`
  - `build-and-push` only runs on `refs/heads/master`
  - `deploy` only runs on `refs/heads/master`
  - build step tags image with `${{ github.sha }}`
  - deploy step uses the `${{ github.sha }}` tag
  - deploy step captures `properties.latestRevisionName`
  - restart step uses `steps.deploy.outputs.revision`

### 2. Test-only change should run CI but not build/deploy

- Create a temporary branch from `feat/ci-cd-guardrails`
- Make a harmless change only under `tests/`, for example a comment in one test file
- Push the branch and open a PR to `master`
- Verify:
  - workflow `CI/CD` runs
  - `changes` job reports `ci=true`
  - `changes` job reports `container=false`
  - `test` job runs
  - `build-and-push` is skipped
  - `deploy` is skipped

### 3. Workflow-only change should run CI but not build/deploy

- On another temporary branch, make a harmless comment-only change in `.github/workflows/ci-cd.yml`
- Push and open a PR to `master`
- Verify:
  - `CI/CD` runs
  - `test` runs
  - `build-and-push` is skipped
  - `deploy` is skipped

### 4. Manual dispatch from non-`master` must not deploy

- From a non-`master` branch, manually trigger `CI/CD`
- Verify:
  - `changes` runs
  - `test` runs
  - `build-and-push` is skipped because branch is not `master`
  - `deploy` is skipped

### 5. Real deploy from `master`

- Merge or push a container-affecting change on `master` such as a harmless comment in `src/`
- Wait for `CI/CD` to complete
- Verify:
  - `build-and-push` runs
  - ACR receives tags for:
    - `${{ github.run_number }}`
    - `${{ github.sha }}`
    - `latest`
  - `deploy` runs
  - the deploy log prints a concrete revision name from `az containerapp update`
  - the restart step uses that same revision name

### 6. Verify BuildKit cache

- Trigger a second `master` build with minimal source change
- Inspect `build-and-push` logs
- Verify:
  - `docker buildx build` is used
  - cache restore occurs for at least some layers
  - second build is materially faster or shows cache hits

### 7. Verify concurrency

- Push two commits to the same branch in quick succession
- Verify:
  - only the latest `CI/CD` run remains active for that ref
  - the earlier run is cancelled

## Output format

Provide a short report with:

1. Pass/fail for each validation item
2. Workflow run URLs
3. ACR evidence for the `github.sha` image tag
4. The deployed ACA revision name from the successful run
5. Any remaining risks or follow-up fixes
