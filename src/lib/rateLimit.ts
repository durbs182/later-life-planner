type RateLimitState = { count: number; resetAt: number };

const store = new Map<string, RateLimitState>();
const MAX_KEYS = 5000;

function cleanup(now: number) {
  if (store.size <= MAX_KEYS) return;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
  // If still large, evict oldest resetAt entries.
  if (store.size > MAX_KEYS) {
    const entries = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toRemove = store.size - MAX_KEYS;
    for (let i = 0; i < toRemove; i++) store.delete(entries[i][0]);
  }
}

export function rateLimit(
  key: string,
  opts: { windowMs: number; max: number },
): { ok: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  cleanup(now);
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: opts.max - 1, resetInMs: opts.windowMs };
  }
  if (current.count >= opts.max) {
    return { ok: false, remaining: 0, resetInMs: current.resetAt - now };
  }
  current.count += 1;
  store.set(key, current);
  return { ok: true, remaining: opts.max - current.count, resetInMs: current.resetAt - now };
}
