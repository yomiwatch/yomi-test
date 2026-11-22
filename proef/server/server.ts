// Proefserver: serveert testvideo's en de testpagina, beantwoordt /ping
// (met CORS en Private Network Access) en ontvangt rapporten.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { valideerRapport, bestandsnaam } from './rapport.ts';

const MAX_BODY = 1_048_576;

const TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.mp4': 'video/mp4',
  '.m4s': 'video/iso.segment',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};

type Opties = { mediaMap: string, paginaMap: string, resultatenMap: string, log?: (m: string) => void };

export function maakHandler(opties: Opties): (req: IncomingMessage, res: ServerResponse) => void {
  const log = opties.log ?? (() => {});
  // PNA-preflights per herkomst; een rapport krijgt alleen die van zijn eigen herkomst en wist ze daarna.
  let preflights: { origin: string, tijd: string, pad: string }[] = [];
  const vanHerkomst = (origin: string) => preflights.filter((p) => p.origin === origin);

  const json = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const serveer = (res: ServerResponse, map: string, rest: string): void => {
    let rel: string;
    try { rel = decodeURIComponent(rest); } catch { return json(res, 404, { fout: 'niet gevonden' }); }
    const basis = path.resolve(map);
    const doel = path.resolve(basis, '.' + path.sep + rel);
    if (!doel.startsWith(basis + path.sep)) return json(res, 404, { fout: 'niet gevonden' });
    fs.stat(doel, (err, st) => {
      if (err || !st.isFile()) return json(res, 404, { fout: 'niet gevonden' });
      res.writeHead(200, {
        'content-type': TYPES[path.extname(doel)] ?? 'application/octet-stream',
        'content-length': st.size,
        'cache-control': 'no-store',
      });
      fs.createReadStream(doel).on('error', () => res.destroy()).pipe(res);
    });
  };

  const ontvangRapport = (req: IncomingMessage, res: ServerResponse, origin: string): void => {
    const delen: Buffer[] = [];
    let grootte = 0;
    let teGroot = false;
    req.on('data', (d: Buffer) => {
      grootte += d.length;
      if (grootte > MAX_BODY) { teGroot = true; return; }
      delen.push(d);
    });
    req.on('end', () => {
      if (teGroot) return json(res, 413, { fout: 'rapport te groot' });
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(delen).toString('utf8')); } catch { return json(res, 400, { fout: 'geen geldige JSON' }); }
      const rapport = valideerRapport(data);
      if (!rapport) return json(res, 400, { fout: 'ongeldig rapport' });
      const naam = bestandsnaam(new Date(), rapport.ua);
      const pnaPreflights = vanHerkomst(origin);
      preflights = preflights.filter((p) => p.origin !== origin);
      const opslag = { ...rapport, herkomst: origin, pnaGezien: pnaPreflights.length > 0, pnaPreflights };
      fs.writeFile(path.join(opties.resultatenMap, naam), JSON.stringify(opslag, null, 2), (err) => {
        if (err) return json(res, 500, { fout: 'opslaan mislukt' });
        log(`rapport opgeslagen: ${naam}`);
        json(res, 201, { opgeslagen: naam });
      });
    });
  };

  return (req, res) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '-';
    res.setHeader('Access-Control-Allow-Origin', origin === '-' ? '*' : origin);
    req.on('error', () => {});
    res.setHeader('Vary', 'Origin');
    const pad = (req.url ?? '/').split('?')[0];
    log(`${req.method} ${pad} (origin: ${origin})`);

    if (req.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Max-Age': '0',
      };
      if (req.headers['access-control-request-private-network'] === 'true') {
        headers['Access-Control-Allow-Private-Network'] = 'true';
        preflights.push({ origin, tijd: new Date().toISOString(), pad });
        log('PNA-preflight ontvangen');
      }
      res.writeHead(204, headers);
      res.end();
      return;
    }
    if (req.method === 'GET' && pad === '/ping') return json(res, 200, { ok: true, pnaGezien: vanHerkomst(origin).length > 0 });
    if (req.method === 'POST' && pad === '/rapport') return ontvangRapport(req, res, origin);
    if (req.method === 'GET' && pad.startsWith('/media/')) return serveer(res, opties.mediaMap, pad.slice('/media/'.length));
    if (req.method === 'GET' && pad.startsWith('/pagina/')) return serveer(res, opties.paginaMap, pad.slice('/pagina/'.length));
    json(res, 404, { fout: 'niet gevonden' });
  };
}

function lanAdressen(): string[] {
  return Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a!.address);
}

if (import.meta.main) {
  const hier = path.dirname(fileURLToPath(import.meta.url));
  const proef = path.resolve(hier, '..');
  const resultatenMap = path.join(proef, 'resultaten');
  fs.mkdirSync(resultatenMap, { recursive: true });
  const handler = maakHandler({
    mediaMap: path.join(proef, 'media', 'uit'),
    paginaMap: path.join(proef, 'pagina'),
    resultatenMap,
    log: (m) => console.log(`${new Date().toISOString()} ${m}`),
  });
  const cert = { cert: fs.readFileSync(path.join(proef, 'certs', 'fullchain.pem')), key: fs.readFileSync(path.join(proef, 'certs', 'privkey.pem')) };
  https.createServer(cert, handler).listen(8443, '0.0.0.0');
  http.createServer(handler).listen(8080, '0.0.0.0');
  for (const ip of lanAdressen()) {
    const s = ip.replaceAll('.', '-');
    console.log(`https://${s}.local-ip.sh:8443/pagina/index.html?server=${s}`);
    console.log(`  http://${ip}:8080/ping`);
  }
}
