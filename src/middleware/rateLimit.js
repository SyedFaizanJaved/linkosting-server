// ponytail: in-memory fixed-window limiter — fine for the single Render
// instance; move buckets to Postgres/Redis if this ever runs on >1 instance.

const buckets = new Map(); // "<name>:<key>" -> { count, resetAt, strikes, blockedUntil }
const MAX_BLOCK_MS = 60 * 60_000;

const envInt = (name, dflt) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : dflt;
};

export function resetRateLimits() { buckets.clear(); }

function tooMany(res, msLeft) {
  res.set('Retry-After', String(Math.ceil(msLeft / 1000)));
  return res.status(429).json({ error: 'too many requests — try again later' });
}

// Fixed-window counter per key. With backoff:true a violation blocks the key
// for windowMs * 2^(strikes-1) (capped at 1h), doubling on each consecutive
// violated window — escalating delay, never a hard lockout. A quiet gap of a
// full window-length after a violated window clears the strikes.
export function makeLimiter({ name, keys, maxEnv, maxDefault, windowEnv, windowDefault, backoff = false }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const max = envInt(maxEnv, maxDefault);
    const windowMs = envInt(windowEnv, windowDefault);
    if (buckets.size > 50_000) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now && (b.blockedUntil || 0) <= now) buckets.delete(k);
      }
    }
    for (const rawKey of keys(req)) {
      const key = `${name}:${rawKey}`;
      let b = buckets.get(key);
      if (b && b.blockedUntil > now) return tooMany(res, b.blockedUntil - now);
      if (!b || b.resetAt <= now) {
        // Carry strikes only if the last window was violated AND we're still
        // within one window-length of its expiry; a longer quiet gap cools down.
        const carry = b && b.count > max && now < b.resetAt + windowMs ? b.strikes : 0;
        b = { count: 0, resetAt: now + windowMs, strikes: carry, blockedUntil: 0 };
        buckets.set(key, b);
      }
      b.count += 1;
      if (b.count > max) {
        if (backoff) {
          b.strikes += 1;
          b.blockedUntil = now + Math.min(windowMs * 2 ** (b.strikes - 1), MAX_BLOCK_MS);
        } else {
          b.blockedUntil = b.resetAt;
        }
        return tooMany(res, b.blockedUntil - now);
      }
    }
    next();
  };
}

// Strict: login/register/forgot/reset. Per-IP AND per-account so a botnet
// can't brute one account and one IP can't spray many accounts.
export const authLimiter = makeLimiter({
  name: 'auth',
  maxEnv: 'RL_AUTH_MAX', maxDefault: 10,
  windowEnv: 'RL_AUTH_WINDOW_MS', windowDefault: 15 * 60_000,
  backoff: true,
  keys: req => {
    const k = [`ip:${req.ip}`];
    const email = req.body?.email;
    if (typeof email === 'string' && email.trim()) k.push(`acct:${email.trim().toLowerCase()}`);
    return k;
  },
});

// Moderate: unauthenticated public endpoints (auth/status, linkedin/callback).
export const publicLimiter = makeLimiter({
  name: 'public',
  maxEnv: 'RL_PUBLIC_MAX', maxDefault: 60,
  windowEnv: 'RL_PUBLIC_WINDOW_MS', windowDefault: 60_000,
  keys: req => [`ip:${req.ip}`],
});

// Loose: everything else (authenticated dashboard traffic). Keyed by IP —
// auth middleware hasn't run yet, and per-IP is enough at this ceiling.
export const apiLimiter = makeLimiter({
  name: 'api',
  maxEnv: 'RL_API_MAX', maxDefault: 300,
  windowEnv: 'RL_API_WINDOW_MS', windowDefault: 60_000,
  keys: req => [`ip:${req.ip}`],
});
