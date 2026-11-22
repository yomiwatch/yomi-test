// Network measurements and timeouts for the TV probe.

/**
 * @template T
 * @param {Promise<T>} p
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
export function withTimeout(p, ms, label) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

/** @param {string|null} serverParam */
export function serverAddresses(serverParam) {
  if (!serverParam || !/^\d{1,3}(-\d{1,3}){3}$/.test(serverParam)) return null;
  return {
    https: `https://${serverParam}.local-ip.sh:8443`,
    http: `http://${serverParam.split('-').join('.')}:8080`,
  };
}

/**
 * @param {{https: string, http: string}} addresses
 * @param {typeof fetch} fetchFn
 * @param {number} [timeoutMs]
 */
export async function measureNetwork(addresses, fetchFn, timeoutMs = 5000) {
  const cases = [
    { name: 'LAN https (local-ip.sh)', url: `${addresses.https}/ping` },
    { name: 'LAN http (expected blocked)', url: `${addresses.http}/ping` },
    { name: 'Same origin (control)', url: './ok.txt' },
  ];
  const out = [];
  for (const c of cases) {
    const start = Date.now();
    try {
      const r = await withTimeout(fetchFn(c.url, { mode: 'cors', cache: 'no-store' }), timeoutMs, c.name);
      out.push({ name: c.name, url: c.url, ok: r.ok, status: r.status, ms: Date.now() - start });
    } catch (e) {
      out.push({ name: c.name, url: c.url, ok: false, ms: Date.now() - start, error: String(e && e.message ? e.message : e) });
    }
  }
  return out;
}
