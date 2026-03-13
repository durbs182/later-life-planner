# Storage Plan

Status: draft

This document defines persisted storage for Later-Life Planner.

It supersedes the Supabase storage direction in `docs/auth-implementation-prompt.md`.

Use this document as the storage source of truth for implementation.

## Summary

Persist each user's planner state as a single encrypted blob.

Architecture:

- Auth: Clerk
- Database: Azure Cosmos DB
- Encryption: browser-side Web Crypto
- Server role: authenticated pass-through only

## Goals

- Store user plans securely across devices
- Prevent plaintext financial data from being stored in the database
- Avoid large server-side domain logic around persistence
- Preserve the current planner domain model and sync the full plan as one document

## Non-Goals

- server-side financial calculations from persisted data
- field-level database querying
- collaborative editing
- partial document merges

## Version 1 Decision

Ship one storage mode first:

- encrypted blob persistence with Cosmos DB
- wrapped-key model for key management

Defer passphrase-based stronger E2EE to a later version.

Rationale:

- lower implementation risk
- compatible with Clerk login flows
- avoids password-handling assumptions that do not fit Clerk-managed auth

## Storage Model

Each user has one persisted planner document.

### Cosmos DB

- database: `later-life-planner`
- container: `user-plans`
- partition key: `/id`
- document id: Clerk `userId`

### Stored document

```json
{
  "id": "user_xxx",
  "schemaVersion": 1,
  "revision": 7,
  "keyVersion": 1,
  "wrappedKey": "base64...",
  "iv": "base64...",
  "ciphertext": "base64...",
  "updatedAt": "2026-03-13T12:00:00Z"
}
```

### Field meaning

- `id`: Clerk user id
- `schemaVersion`: planner data schema version
- `revision`: optimistic concurrency counter
- `keyVersion`: wrapped-key version for rotation
- `wrappedKey`: wrapped data key or key reference metadata
- `iv`: AES-GCM IV for the encrypted payload
- `ciphertext`: encrypted planner payload
- `updatedAt`: last-write timestamp

## Persisted Payload Shape

Persist only canonical planner domain data.

Do not persist:

- current wizard step
- max visited step
- disclaimer acceptance
- modal state
- transient save state
- computed projections
- chart-specific derived data

Recommended encrypted payload:

```json
{
  "mode": "single",
  "person1": {},
  "person2": {},
  "fiAge": 65,
  "lifeVision": "",
  "aspirations": [],
  "lifeStages": [],
  "spendingCategories": [],
  "assumptions": {},
  "rlssStandard": "minimum",
  "jointGia": {},
  "careReserve": {}
}
```

## Crypto Model

### Browser responsibility

The browser must:

- obtain or derive the data key
- encrypt planner state before upload
- decrypt planner state after download

### Server responsibility

The server must:

- authenticate the request
- validate payload shape
- read and write ciphertext documents
- never inspect planner plaintext

### Algorithm

Use:

- AES-GCM 256-bit
- fresh random IV per encryption
- Web Crypto API only

Recommended:

- bind stable metadata as additional authenticated data where practical:
  - `userId`
  - `schemaVersion`
  - `revision`

## Key Management

### Version 1

Use a wrapped-key model:

1. Browser generates a random data key
2. Server uses Azure Key Vault to wrap it
3. Wrapped key is stored with the encrypted document
4. On later sessions, the wrapped key is recovered and unwrapped via the authorized path

This is the pragmatic v1 model.

### Deferred Version 2

Potential future enhancement:

- user-defined encryption passphrase
- browser-derived key
- optional recovery mechanism

Do not design v1 around the user's Clerk password.

## API Contract

Create a dedicated persistence surface:

- `GET /api/data`
- `PUT /api/data`

Optional future route:

- `POST /api/migrate-local-plan`

### GET /api/data

Behavior:

- verify Clerk auth
- identify user from token only
- fetch ciphertext document by user id
- return encrypted payload fields

Response cases:

- `200`: encrypted document exists
- `404`: no document yet
- `401`: auth missing or invalid

### PUT /api/data

Request body:

```json
{
  "schemaVersion": 1,
  "baseRevision": 6,
  "iv": "base64...",
  "ciphertext": "base64..."
}
```

Behavior:

- verify Clerk auth
- identify user from token only
- validate payload shape and size
- reject stale writes if `baseRevision` is older than current revision
- write new document version

Response cases:

- `200`: save accepted, returns new `revision` and `updatedAt`
- `401`: auth missing or invalid
- `409`: write conflict
- `400`: invalid payload

## Sync Behavior

The app should sync the full encrypted plan, not field-level patches.

### Load flow

1. user is authenticated
2. fetch encrypted document
3. unwrap or recover key
4. decrypt payload
5. hydrate planner store

### Save flow

1. subscribe to canonical planner-state changes
2. debounce
3. serialize canonical payload
4. encrypt in browser
5. send `PUT /api/data`
6. update save status and revision

### Conflict handling

Use optimistic concurrency based on `revision`.

If a save conflicts:

- surface `Conflict` in the UI
- allow the user to reload the remote version
- consider future merge UX only if real demand appears

For v1, no automatic merge logic is needed.

## Migration from Current Local Persistence

Current state is stored locally via Zustand persistence.

Migration behavior:

- detect legacy local planner data after auth
- allow explicit import into the new encrypted remote store
- once imported, mark migration complete locally

Do not silently overwrite an existing remote plan.

## Validation Rules

Add explicit limits:

- maximum ciphertext payload size
- valid base64 encoding checks
- valid revision type
- valid schema version

Corruption behavior:

- show a recoverable error state
- do not wipe remote data automatically
- allow retry or support-guided recovery path later

## Implementation Components

Recommended files:

- `src/lib/crypto.ts`
- `src/lib/cosmos.ts`
- `src/hooks/usePlanSync.ts`
- `src/app/api/data/route.ts`
- `src/lib/auth/requireUser.ts` or equivalent

Store updates:

- add hydration action for canonical plan payload
- move remote sync responsibility out of raw Zustand `persist`

## Testing Plan

Add tests for:

- encrypt/decrypt round trip
- malformed ciphertext rejection
- payload validation
- authenticated GET/PUT behavior
- unauthorized access rejection
- optimistic concurrency conflict
- local migration import
- sync retry/error behavior

## Delivery Order

Recommended order:

1. shared auth helper
2. crypto helper
3. Cosmos client
4. `GET /api/data`
5. `PUT /api/data`
6. Zustand hydration action
7. sync hook
8. migration flow
9. conflict UX

## Explicit Rejections

Do not implement:

- Supabase persistence
- plaintext planner storage server-side
- persistence keyed by user id from request body
- server-side parsing of planner financial fields for normal saves
