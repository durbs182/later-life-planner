// Re-export shim — all types now live in /models/types.ts
// Existing imports of '@/lib/types' continue to work unchanged.
export * from '@/models/types';

// ci-validate: full deploy test

// ci-validate: concurrency test commit 1

// ci-validate: concurrency test commit 2

// ci-validate: concurrency commit A
// ci-validate: concurrency commit B git add src/lib/types.ts

// ci-validate: concurrency commit B
