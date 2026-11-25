import { randomUUID } from 'node:crypto';

export function botConfig(env = process.env) {
  if (env.TURNSTILE_ENABLED !== 'true') return null;
  const { TURNSTILE_SITE_KEY: siteKey, TURNSTILE_SECRET_KEY: secret, TURNSTILE_HOSTNAME: hostname } = env;
  if (!siteKey || !secret || !hostname) throw new Error('Incomplete Turnstile configuration');
  return {siteKey, secret, hostname};
}

export async function verifyReservationToken(token, config, request = fetch) {
  if (!config) return true;
  if (typeof token !== 'string' || !token.length || token.length > 2048) return false;
  const response = await request('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', signal: AbortSignal.timeout(5000),
    body: new URLSearchParams({secret: config.secret, response: token, idempotency_key: randomUUID()}),
  });
  if (!response.ok) throw new Error('Verification service unavailable');
  const result = await response.json();
  const age = Date.now() - Date.parse(result.challenge_ts);
  return result.success === true && result.hostname === config.hostname &&
    result.action === 'reservation' && age >= -30000 && age <= 300000;
}
