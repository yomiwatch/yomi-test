// Netwerk-metingen en time-outs voor de tv-proef.

/**
 * @template T
 * @param {Promise<T>} p
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
export function metTimeout(p, ms, label) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`time-out: ${label}`)), ms);
  });
  return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

/** @param {string|null} serverParam */
export function serverAdressen(serverParam) {
  if (!serverParam || !/^\d{1,3}(-\d{1,3}){3}$/.test(serverParam)) return null;
  return {
    https: `https://${serverParam}.local-ip.sh:8443`,
    http: `http://${serverParam.split('-').join('.')}:8080`,
  };
}

/**
 * @param {{https: string, http: string}} adressen
 * @param {typeof fetch} fetchFn
 * @param {number} [timeoutMs]
 */
export async function meetNetwerk(adressen, fetchFn, timeoutMs = 5000) {
  const gevallen = [
    { naam: 'LAN https (local-ip.sh)', url: `${adressen.https}/ping` },
    { naam: 'LAN http (verwacht geblokkeerd)', url: `${adressen.http}/ping` },
    { naam: 'Eigen herkomst (controle)', url: './ok.txt' },
  ];
  const uit = [];
  for (const g of gevallen) {
    const start = Date.now();
    try {
      const r = await metTimeout(fetchFn(g.url, { mode: 'cors', cache: 'no-store' }), timeoutMs, g.naam);
      uit.push({ naam: g.naam, url: g.url, ok: r.ok, status: r.status, ms: Date.now() - start });
    } catch (e) {
      uit.push({ naam: g.naam, url: g.url, ok: false, ms: Date.now() - start, fout: String(e && e.message ? e.message : e) });
    }
  }
  return uit;
}
