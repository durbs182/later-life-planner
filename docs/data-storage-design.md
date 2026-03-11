# Data Storage & Security Design

## Overview

User financial data (pensions, ISAs, GIAs, income projections) is sensitive. The storage design
ensures that even direct access to the database returns only encrypted ciphertext — no plaintext
financial values are ever visible outside the user's own browser session.

**Auth**: Clerk (unchanged from `auth-implementation-prompt.md`)
**Database**: Azure Cosmos DB (NoSQL, serverless tier) — replaces Supabase from the auth doc
**Encryption**: AES-GCM 256-bit client-side via Web Crypto API

---

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Database breach or insider access | Client-side encryption — DB contains only ciphertext |
| Network interception | TLS / HTTPS enforced, HSTS header |
| Unauthorised access to another user's data | `userId` always taken from verified Clerk JWT, never from request body |
| XSS stealing in-memory key | Content Security Policy header, short session lifetime |
| Brute force / enumeration | Rate limiting on all API routes |
| Plaintext leaking into logs | Financial values never present server-side to log |

---

## Architecture

```
Browser
├── Zustand store (plaintext, in-memory only)
├── Web Crypto API
│   ├── deriveKey(password, salt) → CryptoKey          [PBKDF2 / HKDF]
│   ├── encrypt(plaintext, key, iv) → ciphertext        [AES-GCM 256-bit]
│   └── decrypt(ciphertext, key, iv) → plaintext
└── fetch PUT /api/data  →  { iv, ciphertext }          [never plaintext]

Next.js API Routes (server)
├── Validate Clerk JWT on every request
├── Extract userId from JWT claim (never from body)
├── Pass { userId, iv, ciphertext, updatedAt } to Cosmos DB
└── Return { iv, ciphertext } to browser on GET

Azure Cosmos DB
└── Container: user-plans
    └── Document: { id: userId, iv, ciphertext, updatedAt, schemaVersion }
        — no financial values visible at rest
```

The server is a **pass-through** for encrypted blobs. It enforces auth and ownership but cannot
read the contents of what it stores.

---

## Encryption

### Algorithm

- **AES-GCM 256-bit** via the browser's native Web Crypto API (no third-party crypto library)
- A fresh random **96-bit IV** is generated for every `encrypt()` call
- The IV is stored alongside the ciphertext (it is not secret, but must be unique per operation)

### Key Derivation

Two options depending on the auth flow chosen during implementation:

#### Option A — Password-based (full E2EE, recommended if Clerk password auth is used)

```
key = PBKDF2(
  password  = user's password,
  salt      = userId (from Clerk),   // unique per user, not secret
  iterations = 310,000,             // OWASP 2024 recommendation for SHA-256
  hash      = SHA-256,
  keyLength = 256 bits
)
```

- Key is derived entirely in the browser — never sent to the server
- If the user forgets their password, their data is unrecoverable (by design)
- Offer a **recovery key** (random 24-word phrase shown at signup) as a backup decryption path

#### Option B — OAuth / social login (pragmatic, slightly weaker E2EE guarantee)

```
1. On first login: generate random 256-bit data key in browser
2. POST key to /api/key-wrap → server wraps it via Azure Key Vault
3. Store wrapped key in Cosmos DB alongside ciphertext
4. On subsequent logins: GET /api/key-wrap → server unwraps via AKV → browser receives key
5. Browser decrypts data with unwrapped key
```

- Protects against DB breach (wrapped key is useless without AKV access)
- Server *could* intercept the unwrapped key in transit (weaker than Option A)
- Appropriate for most users; full E2EE requires Option A

#### Recommended: Offer both

- Default to Option B for OAuth users (convenience)
- Let users set a local passphrase to upgrade to Option A (full E2EE)

---

## Data Model

### Cosmos DB

- **Database**: `later-life-planner`
- **Container**: `user-plans`
- **Partition key**: `/id` (= Clerk userId — ensures each user's document is isolated)
- **Throughput**: Serverless (pay per request, no minimum cost)

### Document schema

```jsonc
{
  "id": "user_2abc123xyz",          // Clerk userId — partition key, used for lookup only
  "schemaVersion": 1,               // plaintext — for future migrations
  "iv": "base64-encoded-96-bit-iv", // plaintext — required for decryption, not secret
  "ciphertext": "base64-encoded...", // AES-GCM encrypted blob of the full Zustand state
  "updatedAt": "2026-03-11T14:00:00Z", // plaintext — for cross-device sync conflict detection
  "_ts": 1741701600                 // Cosmos DB auto-managed timestamp
}
```

### Encrypted payload (inside ciphertext — never visible server-side)

```jsonc
{
  "pensions": [...],
  "isas": [...],
  "gias": [...],
  "dbPensions": [...],
  "incomes": [...],
  "expenses": [...],
  "lifestyle": { ... },
  "partner": { ... }
}
```

Only non-sensitive structural metadata (schema version, timestamps) is stored in plaintext.

---

## API Routes

Two routes only — the server is intentionally a thin pass-through.

### `GET /api/data`

```
Headers: Authorization: Bearer <Clerk JWT>

Response 200:
{
  "iv": "base64...",
  "ciphertext": "base64...",
  "updatedAt": "2026-03-11T14:00:00Z"
}

Response 404: user has no stored plan yet
Response 401: missing or invalid JWT
```

### `PUT /api/data`

```
Headers: Authorization: Bearer <Clerk JWT>
Body:
{
  "iv": "base64...",         // new IV generated client-side for this save
  "ciphertext": "base64..."  // freshly encrypted Zustand state
}

Response 200: { "updatedAt": "..." }
Response 401: missing or invalid JWT
```

Both routes must:
- Verify the Clerk JWT and extract `userId` from the `sub` claim
- Never accept `userId` from the request body
- Rate limit: max 60 requests/minute per user

---

## Cross-Device Sync

Data is a single encrypted blob per user. Last-write-wins is acceptable for a personal planner
(no collaboration required):

1. On app load: fetch blob from `/api/data`, decrypt, hydrate Zustand store
2. On any store change: debounce 1.5s, then encrypt full store and PUT to `/api/data`
3. On conflict (two devices writing simultaneously): `updatedAt` timestamps can be compared;
   the fresher write wins — consider prompting the user if the gap is significant

No merge logic is needed since financial plans are edited by one person.

---

## Security Checklist

### Encryption
- [ ] AES-GCM 256-bit only — no weaker modes (ECB, CBC without HMAC)
- [ ] Fresh random IV per encryption call — never reuse IV with same key
- [ ] Key derived via PBKDF2 (310k iterations) or HKDF — never use raw password as key
- [ ] Plaintext never leaves browser — only ciphertext sent to API

### Transport
- [ ] HTTPS enforced on ACA ingress
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains` header
- [ ] `Content-Security-Policy` header to mitigate XSS

### API
- [ ] Every route validates Clerk JWT before any DB operation
- [ ] `userId` sourced from JWT `sub` claim only
- [ ] Rate limiting: 60 req/min per user
- [ ] No financial data written to application logs

### Cosmos DB
- [ ] Cosmos DB encryption at rest enabled by default (AES-256, Microsoft-managed keys)
- [ ] Network access restricted to ACA egress IP / VNet (not public internet)
- [ ] Connection string stored in Azure Key Vault, referenced as a secret in ACA env vars
- [ ] Principle of least privilege: app identity has `Cosmos DB Built-in Data Contributor` only

### Key Vault (Option B)
- [ ] AKV access via Managed Identity (no credentials in code or env vars)
- [ ] Key operations logged in AKV audit log
- [ ] Key rotation supported without data loss (re-wrap data key, not re-encrypt all data)

---

## Azure Infrastructure Changes

The following additions are needed to the existing resource group `rg-later-life-planner`:

```
rg-later-life-planner
├── ca-later-life-planner          (existing — ACA app)
├── acrblackdog69llp               (existing — Container Registry)
├── [NEW] cosmos-later-life-planner  — Cosmos DB account, serverless, uksouth
│   └── Database: later-life-planner
│       └── Container: user-plans (partition key: /id)
└── [NEW] kv-later-life-planner    — Key Vault (Option B only)
```

**Estimated cost**: Cosmos DB serverless at low usage (< 1M RU/month) = ~$0.25/month.

---

## Implementation Order

1. **Cosmos DB provisioning** — `az cosmosdb create` + database + container
2. **`src/lib/cosmos.ts`** — thin client wrapper (read/write document by userId)
3. **`src/lib/crypto.ts`** — `encrypt`, `decrypt`, `deriveKey` using Web Crypto API
4. **`/api/data` routes** — GET and PUT with Clerk JWT validation
5. **`src/hooks/usePlanSync.ts`** — load on auth, debounced save on store change (replaces Supabase sync from auth doc)
6. **Option B key wrapping** — `/api/key-wrap` + AKV integration (if OAuth auth chosen)
7. **Recovery key UX** — show at first save, allow re-download from settings

---

## What Changes vs the Auth Document

The `auth-implementation-prompt.md` specified Clerk + Supabase. This design replaces Supabase with
Cosmos DB and adds a client-side encryption layer. Everything Clerk-related in that document is
unchanged. The sync hook (`usePlanSync.ts`) is the same concept but talks to `/api/data` (Cosmos DB
backed) instead of Supabase directly, and the data it saves/loads is always ciphertext.
