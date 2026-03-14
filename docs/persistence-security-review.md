# Persistence Security Review

Status: draft

This document consolidates the current security analysis for encrypted planner persistence.

It records:

- the current design and trust boundaries
- the main risks in the proposed wrapped-key implementation
- what would need to change to materially improve protection against insider access

Read alongside:

- `docs/storage-plan.md`
- `docs/security-decisions.md`
- `docs/azure-architecture.md`

## Executive Summary

The current design is reasonable for protecting planner data from plaintext exposure in Cosmos DB and from basic cross-user access mistakes.

It is not strongly resistant to insider access.

In its current form, the app runtime is expected to participate in Azure Key Vault wrap and unwrap operations. That means anyone who can control the runtime, deployment path, Key Vault permissions, or equivalent privileged Azure access can potentially recover user data.

The current design should therefore be described as:

- browser-side encryption with server-assisted key management
- protective against database compromise
- not protective against privileged operator or deployer compromise

If insider resistance becomes a core requirement, the design needs to move toward user-controlled keys with no ordinary server-side unwrap path.

## Current Design Summary

The current persistence plan is:

- Clerk for authentication
- Azure Cosmos DB for one encrypted planner document per user
- browser-side Web Crypto for encryption and decryption
- Azure Key Vault wrapped-key support for data-key management
- Azure Container Apps runtime identity for Cosmos DB and Key Vault access

The current documents describe the server as an authenticated pass-through, but the same design also requires the server or an authorized server-side path to participate in key wrap and unwrap operations.

That creates an important trust boundary:

- Cosmos DB does not hold plaintext planner data
- the app runtime and key-management path still remain trusted components

## Threat Model Framing

### Threats the current design helps with

- plaintext financial data being exposed directly from Cosmos DB
- accidental logging of raw planner data
- cross-user data access caused by trusting client-supplied identifiers
- stale write overwrites

### Threats the current design does not fully solve

- privileged insider access through the app runtime
- privileged insider access through Azure Key Vault permissions
- malicious or compromised CI/CD deployments
- browser compromise or XSS on authenticated planner routes
- metadata leakage through identifiers and timestamps

## Findings On The Current Design

### 1. The wrapped-key design is not end-to-end encryption

Severity: critical

The current plan uses browser-side encryption, but the browser is expected to obtain or recover the data key, and the server-side architecture includes Key Vault wrapping support and an authorized unwrap path.

As a result, this is not a design where only the user can decrypt data. It is a design where:

- the database stores ciphertext only
- the application and key-management path still have enough authority to help recover keys

This is the most important point to state clearly in the docs. Without that clarity, the design can be misread as stronger than it is.

### 2. The unwrap boundary is underspecified

Severity: high

The design does not yet define:

- which route or component performs unwrap
- what authorization checks gate unwrap
- how unwrap requests are rate-limited
- what audit trail is kept for wrap and unwrap operations

Without a tightly specified unwrap path, the system risks becoming a decryption oracle for anyone who can obtain valid app access or influence runtime behavior.

At minimum, any server-assisted unwrap flow would need:

- per-user authorization based only on verified Clerk identity
- narrow Key Vault permissions
- strong audit logging of wrap and unwrap events
- rate limiting and anomaly detection

### 3. AES-GCM key and nonce handling need tighter rules

Severity: high

The current plan correctly calls for AES-GCM and a fresh random IV, but it does not define a strict data-key lifecycle.

That leaves open questions such as:

- whether one DEK is reused across many saves
- how IV uniqueness is guaranteed over time
- what metadata is bound as additional authenticated data
- how key rotation is handled during long-lived planner use

The practical v1 rule should be stricter than the draft currently says:

- require a fresh random IV for every encryption operation
- make AAD mandatory, not optional
- bind at least `userId`, `schemaVersion`, `revision`, and the key identifier
- prefer a new DEK per save unless there is a strong reason not to

### 4. Browser compromise remains a dominant confidentiality risk

Severity: high

Because plaintext and usable keys exist in the browser, any XSS issue, unsafe third-party script, or compromised browser context can defeat the design before upload or after download.

This is especially important because the product handles sensitive financial planning data in an authenticated session.

The current design should therefore assume a strict frontend hardening baseline:

- strong Content Security Policy
- no inline script exceptions unless unavoidable
- no unsafe HTML rendering paths
- minimal third-party JavaScript on authenticated planner routes
- careful review of analytics and session tooling

### 5. Key rotation and recovery are not fully specified

Severity: medium

The stored document currently includes `keyVersion`, but not a complete key identifier strategy.

That creates avoidable risk around:

- rewrapping during key rotation
- interpreting older ciphertext correctly
- recovery after accidental key disablement or deletion
- auditability of which key version protected which document

The persistence metadata should include enough information to identify the exact KEK version used to wrap the DEK, not just a local integer version.

Operationally, Key Vault should use soft delete and purge protection, and the project should define a rewrap runbook before production persistence ships.

### 6. CI/CD remains inside the trust boundary

Severity: medium

The current deployment path relies on a secret-based Azure service principal in GitHub Actions.

Anyone who can misuse that credential, or who can alter the production deployment path, may be able to:

- deploy code that exfiltrates plaintext or keys
- widen Azure access permissions
- alter runtime configuration to weaken controls

That means the CI/CD system is part of the confidentiality boundary.

Moving the deploy path to GitHub OIDC improves this, but does not eliminate deploy-side trust.

### 7. Metadata leakage is accepted but should be called out explicitly

Severity: medium

Using the Clerk user id as both document id and partition key simplifies the model, but it leaks stable identity linkage into persistence metadata.

Even if ciphertext remains opaque, an insider with data-plane access can still learn:

- which users have stored plans
- when those plans were updated
- revision activity over time

This may be acceptable for v1, but it should be documented as a privacy tradeoff.

## What Insider Resistance Would Require

### Core Principle

If the goal is to protect user data from privileged operators, the normal app backend must not have a routine ability to unwrap user data keys.

That means the strongest practical change is:

- user-controlled decryption material
- browser-only decryption
- ciphertext-only storage on the server
- no standard server-side recovery path

## Recommended Product Model

The cleanest way to express the tradeoff is to split the product into two explicit modes.

### Option A: Standard Sync

This is the current wrapped-key model.

Properties:

- easiest multi-device UX
- easiest recovery story
- protects against database plaintext exposure
- does not protect against privileged runtime, Key Vault, or deploy access

### Option B: Private Vault

This is the insider-resistant mode.

Properties:

- decryption key is controlled by the user or user device
- server stores ciphertext only
- no server-side unwrap in normal operation
- stronger protection from database admins and most app-side insiders
- harder recovery and support model

If both modes are offered, they should be described honestly rather than presented as equivalent security postures.

## Recommended Insider-Resistant Design

### 1. Move to user-controlled key protection

Preferred design:

1. Browser generates a random DEK
2. Browser encrypts planner payload with AES-GCM
3. Browser protects the DEK with user-controlled material
4. Server stores only ciphertext, IV, metadata, and the browser-produced wrapped DEK

Good user-controlled key options:

- a user-defined passphrase processed in the browser with a strong password-based KDF
- a device-bound key such as a WebAuthn-backed credential used to protect the DEK
- a hybrid model that supports both

In all of these models, the application server should not have ordinary unwrap capability.

### 2. Treat recovery as a product tradeoff, not a hidden capability

If the system offers support-led recovery, then privileged operators are back inside the trust boundary.

That is acceptable only if documented clearly.

For a genuinely insider-resistant mode, recovery should be one of:

- no recovery
- user-managed recovery kit
- threshold or split-key recovery with strong governance and explicit user consent model

### 3. Harden deployment and admin paths anyway

Even with client-held keys, a malicious deployer can still ship code that steals plaintext or passphrases when users load the app.

So insider-resistant design still needs operational controls:

- migrate GitHub Actions Azure auth from long-lived secrets to OIDC federation
- require approval and just-in-time elevation for privileged Azure roles
- separate deployment authority from Key Vault and data-plane authority
- use environment-scoped deployment protections
- alert on unusual production deployments, Key Vault access, and Cosmos DB access patterns

### 4. Consider confidential-compute-assisted recovery only if recovery is mandatory

If product requirements insist on recovery or server-assisted access, the least-bad Azure pattern is not a normal unwrap API.

Instead, use confidential computing with attested key release:

- keep the standard app runtime unable to unwrap user keys directly
- release sensitive key material only to an attested confidential environment
- tightly restrict who can alter the release policy

This is operationally more complex and still not equivalent to pure client-held keys, but it is stronger than giving the normal app runtime routine unwrap capability.

### 5. Reduce metadata exposure

For stronger insider privacy, consider:

- storing a stable opaque internal document id instead of raw Clerk `userId`
- minimizing exposed activity timestamps
- keeping diagnostic metadata separate from user document storage when possible

## Inherent Limits Of A Web App

Even a better client-side encryption design has an important limit:

if an insider can deploy arbitrary JavaScript to the production app, they can likely steal plaintext or user-controlled secrets on a later visit.

That means:

- browser-only encryption can protect well against database compromise
- browser-only encryption can protect well against many storage-side insiders
- browser-only encryption cannot fully protect against malicious frontend deployments

If the requirement is to protect against deploy insiders as well, the strongest answer is not a standard web app. It is a separately controlled signed client, browser extension, or hardware-backed local application with its own release trust model.

## Practical Recommendation

If the project wants the fastest safe v1:

- keep the current wrapped-key design
- document it honestly as database-protective, not insider-resistant
- tighten unwrap, AAD, rotation, audit, logging, and CI/CD controls

If insider resistance is a real product requirement:

- make user-controlled key mode the primary design
- remove ordinary server-side unwrap
- accept the recovery and support tradeoffs explicitly
- treat deployment security as part of the confidentiality model

## Suggested Documentation Changes

The existing design docs should be updated to state explicitly:

- v1 is not end-to-end encryption
- the server and deployment path remain trusted in the wrapped-key model
- AAD is mandatory
- DEK lifecycle and KEK identification rules are part of the design, not implementation detail
- insider-resistant mode requires user-controlled keys and no ordinary server-side unwrap path

## References

### Internal references

- `docs/storage-plan.md`
- `docs/security-decisions.md`
- `docs/azure-architecture.md`

### External references

- GitHub Actions OIDC for Azure: https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure
- Azure Managed HSM security guidance: https://learn.microsoft.com/en-us/azure/key-vault/managed-hsm/secure-managed-hsm
- Azure Secure Key Release and attestation: https://learn.microsoft.com/en-us/azure/confidential-computing/concept-skr-attestation
- Azure Key Vault recovery, soft delete, and purge protection: https://learn.microsoft.com/en-us/azure/key-vault/general/key-vault-recovery
- Azure RBAC security roles: https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/security
- Microsoft Entra Privileged Identity Management deployment planning: https://learn.microsoft.com/en-us/entra/id-governance/privileged-identity-management/pim-deployment-plan
- Azure Container Apps security overview: https://learn.microsoft.com/en-us/azure/container-apps/security
- Azure Key Vault key operations: https://learn.microsoft.com/en-us/azure/key-vault/keys/about-keys-details
- Azure Key Vault key security guidance: https://learn.microsoft.com/en-us/azure/key-vault/keys/secure-keys
- OWASP Cross Site Scripting Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- NIST note on GCM and GMAC revision work: https://csrc.nist.gov/News/2024/nist-to-revise-sp-80038d-gcm-and-gmac-modes
