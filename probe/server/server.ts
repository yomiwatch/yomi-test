// Probe server: serves test videos and the test page, answers /ping
// (with CORS and Private Network Access) and receives reports.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateReport, fileName } from './report.ts';

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

type Options = { mediaDir: string, pageDir: string, resultsDir: string, log?: (m: string) => void };

export function createHandler(options: Options): (req: IncomingMessage, res: ServerResponse) => void {
  const log = options.log ?? (() => {});
  // PNA preflights per origin; a report only gets those of its own origin and clears them afterwards.
  let preflights: { origin: string, time: string, path: string }[] = [];
  const fromOrigin = (origin: string) => preflights.filter((p) => p.origin === origin);

  const json = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const serve = (res: ServerResponse, dir: string, rest: string): void => {
    let rel: string;
    try { rel = decodeURIComponent(rest); } catch { return json(res, 404, { error: 'not found' }); }
    const base = path.resolve(dir);
    const target = path.resolve(base, '.' + path.sep + rel);
    if (!target.startsWith(base + path.sep)) return json(res, 404, { error: 'not found' });
    fs.stat(target, (err, st) => {
      if (err || !st.isFile()) return json(res, 404, { error: 'not found' });
      res.writeHead(200, {
        'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream',
        'content-length': st.size,
        'cache-control': 'no-store',
      });
      fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
    });
  };

  const receiveReport = (req: IncomingMessage, res: ServerResponse, origin: string): void => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (d: Buffer) => {
      size += d.length;
      if (size > MAX_BODY) { tooLarge = true; return; }
      chunks.push(d);
    });
    req.on('end', () => {
      if (tooLarge) return json(res, 413, { error: 'report too large' });
      let data: unknown;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: 'invalid JSON' }); }
      const report = validateReport(data);
      if (!report) return json(res, 400, { error: 'invalid report' });
      const name = fileName(new Date(), report.ua);
      const pnaPreflights = fromOrigin(origin);
      preflights = preflights.filter((p) => p.origin !== origin);
      const stored = { ...report, origin, pnaSeen: pnaPreflights.length > 0, pnaPreflights };
      fs.writeFile(path.join(options.resultsDir, name), JSON.stringify(stored, null, 2), (err) => {
        if (err) return json(res, 500, { error: 'saving failed' });
        log(`report saved: ${name}`);
        json(res, 201, { saved: name });
      });
    });
  };

  return (req, res) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '-';
    res.setHeader('Access-Control-Allow-Origin', origin === '-' ? '*' : origin);
    req.on('error', () => {});
    res.setHeader('Vary', 'Origin');
    const urlPath = (req.url ?? '/').split('?')[0];
    log(`${req.method} ${urlPath} (origin: ${origin})`);

    if (req.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Max-Age': '0',
      };
      if (req.headers['access-control-request-private-network'] === 'true') {
        headers['Access-Control-Allow-Private-Network'] = 'true';
        preflights.push({ origin, time: new Date().toISOString(), path: urlPath });
        log('PNA preflight received');
      }
      res.writeHead(204, headers);
      res.end();
      return;
    }
    if (req.method === 'GET' && urlPath === '/ping') return json(res, 200, { ok: true, pnaSeen: fromOrigin(origin).length > 0 });
    if (req.method === 'POST' && urlPath === '/report') return receiveReport(req, res, origin);
    if (req.method === 'GET' && urlPath.startsWith('/media/')) return serve(res, options.mediaDir, urlPath.slice('/media/'.length));
    if (req.method === 'GET' && urlPath.startsWith('/page/')) return serve(res, options.pageDir, urlPath.slice('/page/'.length));
    json(res, 404, { error: 'not found' });
  };
}

function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a!.address);
}

if (import.meta.main) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const probe = path.resolve(here, '..');
  const resultsDir = path.join(probe, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const handler = createHandler({
    mediaDir: path.join(probe, 'media', 'out'),
    pageDir: path.join(probe, 'page'),
    resultsDir,
    log: (m) => console.log(`${new Date().toISOString()} ${m}`),
  });
  const cert = { cert: fs.readFileSync(path.join(probe, 'certs', 'fullchain.pem')), key: fs.readFileSync(path.join(probe, 'certs', 'privkey.pem')) };
  https.createServer(cert, handler).listen(8443, '0.0.0.0');
  http.createServer(handler).listen(8080, '0.0.0.0');
  for (const ip of lanAddresses()) {
    const s = ip.replaceAll('.', '-');
    console.log(`https://${s}.local-ip.sh:8443/page/index.html?server=${s}`);
    console.log(`  http://${ip}:8080/ping`);
  }
}
