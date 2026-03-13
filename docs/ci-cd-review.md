# CI/CD Review

Date: 2026-03-13
Workflow reviewed: `.github/workflows/ci-cd.yml`
Branch: `feat/ci-cd-guardrails`

## Implemented fixes

### 1. Manual dispatch can no longer deploy non-`master` code

Status: Fixed

What changed:
- `build-and-push` now runs only when `github.ref == 'refs/heads/master'`
- `deploy` now runs only when `github.ref == 'refs/heads/master'`
- `workflow_dispatch` still forces CI evaluation, but it no longer bypasses the production branch gate

Relevant workflow locations:
- `.github/workflows/ci-cd.yml:82`
- `.github/workflows/ci-cd.yml:119`

Why this matters:
- A manually triggered run from a feature branch can no longer push a test image into the production Container App

### 2. ACA restart now targets the deployed revision deterministically

Status: Fixed

What changed:
- The deploy step now captures `properties.latestRevisionName` from `az containerapp update`
- That revision name is stored in `steps.deploy.outputs.revision`
- The restart step uses that exact revision instead of restarting the first active revision returned by `revision list`

Relevant workflow locations:
- `.github/workflows/ci-cd.yml:128`
- `.github/workflows/ci-cd.yml:148`

Why this matters:
- The workflow restarts the revision created by the current deploy, not an arbitrary active revision

### 3. Test-only and workflow-only changes now run CI

Status: Fixed

What changed:
- Split the original single path filter into two outputs:
  - `ci`
  - `container`
- `test` now runs off the broader `ci` filter
- `build-and-push` runs only off the narrower `container` filter

New files covered by CI:
- `tests/**`
- `.github/workflows/**`
- `vitest.config.*`
- `tsconfig.test.json`

Relevant workflow locations:
- `.github/workflows/ci-cd.yml:23`
- `.github/workflows/ci-cd.yml:59`

Why this matters:
- Changes to tests and workflow logic no longer skip lint/test execution
- Container rebuilds stay limited to actual image-affecting changes

## Additional hardening implemented

### Action versions pinned to commit SHAs

Status: Fixed

Pinned actions:
- `actions/checkout`
- `actions/setup-node`
- `dorny/paths-filter`
- `azure/login`

Why this matters:
- Reduces supply-chain drift from floating tags

### Workflow concurrency added

Status: Fixed

What changed:
- Added:
  - `concurrency.group: ci-cd-${{ github.ref }}`
  - `cancel-in-progress: true`

Relevant workflow location:
- `.github/workflows/ci-cd.yml:14`

Why this matters:
- Prevents overlapping CI/CD runs for the same ref from racing each other

### Images now tagged with `github.sha`

Status: Fixed

What changed:
- Build now publishes:
  - `${{ github.run_number }}`
  - `${{ github.sha }}`
  - `latest`
- Deploy now uses the immutable `github.sha` tag

Relevant workflow locations:
- `.github/workflows/ci-cd.yml:102`
- `.github/workflows/ci-cd.yml:138`

Why this matters:
- Improves traceability, rollback, and auditability

### BuildKit cache added via `docker buildx`

Status: Fixed

What changed:
- Switched from `docker build` to `docker buildx build --push`
- Added GitHub Actions cache:
  - `--cache-from type=gha`
  - `--cache-to type=gha,mode=max`

Relevant workflow locations:
- `.github/workflows/ci-cd.yml:96`
- `.github/workflows/ci-cd.yml:105`

Why this matters:
- Improves repeat build performance, especially for unchanged dependency layers

## Remaining improvement not yet implemented

### Migrate Azure login from secret-based credentials to OIDC

Current state:
- Workflow still uses `creds: ${{ secrets.AZURE_CREDENTIALS }}`

Why it still matters:
- OIDC removes the need for a long-lived Azure credential secret and is the better production posture

## Validation performed locally

Local validation completed:
- Workflow file updated and reviewed
- Static workflow sanity checks passed:
  - YAML parse
  - required branch gates present
  - required filter split present
  - deploy uses `github.sha`
  - restart uses deploy step output revision
  - build uses BuildKit cache

Not validated locally:
- Live GitHub Actions execution
- Azure ACR push
- Azure Container Apps deploy/restart behavior

For live validation steps, see:
- `docs/ci-cd-claude-test-instructions.md`
