import { createHash } from 'node:crypto';

export type Report = { version: 1, ua: string, time: string, [k: string]: unknown };

export function validateReport(x: unknown): Report | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  if (r.version !== 1) return null;
  if (typeof r.ua !== 'string' || r.ua.length === 0 || r.ua.length > 1000) return null;
  if (typeof r.time !== 'string') return null;
  return r as Report;
}

const two = (n: number): string => String(n).padStart(2, '0');

export function fileName(now: Date, ua: string): string {
  const date = `${now.getUTCFullYear()}-${two(now.getUTCMonth() + 1)}-${two(now.getUTCDate())}`;
  const time = `${two(now.getUTCHours())}${two(now.getUTCMinutes())}`;
  const hash = createHash('sha1').update(ua).digest('hex').slice(0, 8);
  return `${date}-${time}-${hash}.json`;
}
