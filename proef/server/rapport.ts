import { createHash } from 'node:crypto';

export type Rapport = { versie: 1, ua: string, tijd: string, [k: string]: unknown };

export function valideerRapport(x: unknown): Rapport | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  if (r.versie !== 1) return null;
  if (typeof r.ua !== 'string' || r.ua.length === 0 || r.ua.length > 1000) return null;
  if (typeof r.tijd !== 'string') return null;
  return r as Rapport;
}

const twee = (n: number): string => String(n).padStart(2, '0');

export function bestandsnaam(nu: Date, ua: string): string {
  const datum = `${nu.getUTCFullYear()}-${twee(nu.getUTCMonth() + 1)}-${twee(nu.getUTCDate())}`;
  const tijd = `${twee(nu.getUTCHours())}${twee(nu.getUTCMinutes())}`;
  const hash = createHash('sha1').update(ua).digest('hex').slice(0, 8);
  return `${datum}-${tijd}-${hash}.json`;
}
