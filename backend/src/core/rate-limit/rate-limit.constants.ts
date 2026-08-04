export const RATE_LIMIT_DEFAULTS = {
  burst: { name: 'burst', limit: 30, ttl: 10_000 },
  sustained: { name: 'sustained', limit: 300, ttl: 60_000 },
} as const;

export const RATE_LIMIT_STORE_ENV = 'RATE_LIMIT_STORE';
export const REDIS_URL_ENV = 'REDIS_URL';

export function isMemoryRateLimitStore(): boolean {
  return process.env[RATE_LIMIT_STORE_ENV] === 'memory';
}

export function isProductionRateLimitStore(): boolean {
  return process.env.NODE_ENV === 'production';
}
