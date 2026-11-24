import { lookup } from 'node:dns/promises';

// Resolve the immediate Compose frontend peer. External forwarding headers
// are accepted only from this address, and Nginx overwrites them.
export function trustFrontend(resolve = lookup) {
  let peer;
  async function refresh() {
    try { peer = (await resolve('frontend', { family: 4 })).address; }
    catch { peer = undefined; }
  }
  const timer = setInterval(refresh, 60000);
  timer.unref();
  refresh();
  return address => Boolean(peer && address.replace(/^::ffff:/, '') === peer);
}

export function limitRequests(max, windowMs, now = Date.now) {
  let buckets = new Map();
  let expires = 0;
  return (req, res, next) => {
    const time = now();
    if (time >= expires) {
      buckets = new Map();
      expires = time + windowMs;
    }
    const used = buckets.get(req.ip) || 0;
    if (used >= max || (!used && buckets.size >= 16384)) {
      res.set('Retry-After', String(Math.ceil((expires - time) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    buckets.set(req.ip, used + 1);
    next();
  };
}

export function configuredLimit(key, fallback) {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Invalid limit: ' + key);
  return value;
}
