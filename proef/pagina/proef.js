// Tv-proef: draait alle metingen automatisch en toont/verstuurt de uitkomst.
import { meetCodecs, meetCapabilities } from './codecs.js';
import { metTimeout, serverAdressen, meetNetwerk } from './netwerk.js';

const VARIANTEN = ['h264-1080p-aac', 'h264-1080p-ac3', 'hevc-1080p-aac', 'hevc-4k-sdr-aac', 'hevc-4k-hdr10-eac3'];
const TOETS_INSTRUCTIE = 'Druk op: pijltjes, OK, Terug, Play/Pauze, Rood, Groen, Geel, Blauw, Info';

const uitvoer = document.getElementById('uitvoer');
const adressen = serverAdressen(new URLSearchParams(location.search).get('server'));
const rapport = { versie: 1, ua: navigator.userAgent, tijd: '', apparaat: {}, codecs: [], capabilities: [], netwerk: [], afspelen: [], toetsen: [] };

function sectie(titel) {
  const s = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = titel;
  s.appendChild(h);
  uitvoer.appendChild(s);
  return s;
}

function regel(doel, status, tekst) {
  const r = document.createElement('div');
  r.className = 'regel';
  const teken = document.createElement('span');
  teken.className = status === true ? 'ok' : status === false ? 'nok' : 'info';
  teken.textContent = status === true ? '✓' : status === false ? '✗' : '•';
  const t = document.createElement('span');
  t.textContent = tekst;
  r.append(teken, t);
  doel.appendChild(r);
  return r;
}

const foutTekst = (e) => String(e && e.message ? e.message : e);

function meetApparaat() {
  const s = sectie('Apparaat');
  const mm = (q) => { try { return window.matchMedia(q).matches; } catch { return null; } };
  const a = {
    scherm: `${screen.width}×${screen.height}`,
    pixelRatio: window.devicePixelRatio,
    venster: `${innerWidth}×${innerHeight}`,
    hdrScherm: mm('(dynamic-range: high)'),
    hdrVideo: mm('(video-dynamic-range: high)'),
  };
  rapport.apparaat = a;
  const ua = regel(s, null, navigator.userAgent);
  ua.classList.add('klein');
  regel(s, null, `Scherm ${a.scherm}, pixelratio ${a.pixelRatio}, venster ${a.venster}`);
  regel(s, a.hdrScherm, `HDR-scherm (dynamic-range: high): ${a.hdrScherm}`);
  regel(s, a.hdrVideo, `HDR-video (video-dynamic-range: high): ${a.hdrVideo}`);
}

function meetCodecSectie() {
  const s = sectie('Codecs (MediaSource)');
  if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported) {
    regel(s, false, 'Geen MediaSource');
    rapport.codecs = meetCodecs(() => false);
    return;
  }
  rapport.codecs = meetCodecs((m) => MediaSource.isTypeSupported(m));
  for (const c of rapport.codecs) regel(s, c.ondersteund, c.naam);
}

async function meetCapabilitySectie() {
  const s = sectie('Capabilities (decodingInfo)');
  if (!navigator.mediaCapabilities || !navigator.mediaCapabilities.decodingInfo) {
    regel(s, false, 'Geen navigator.mediaCapabilities');
    return;
  }
  rapport.capabilities = await meetCapabilities((c) => navigator.mediaCapabilities.decodingInfo(c));
  for (const c of rapport.capabilities) {
    regel(s, c.supported, c.fout ? `${c.naam}: fout ${c.fout}` : `${c.naam}: supported ${c.supported}, smooth ${c.smooth}, zuinig ${c.powerEfficient}`);
  }
}

async function meetNetwerkSectie() {
  const s = sectie('Netwerk');
  if (!adressen) {
    regel(s, false, 'Geen server opgegeven (?server=192-168-2-6)');
    return;
  }
  rapport.netwerk = await meetNetwerk(adressen, (u, o) => fetch(u, o));
  for (const n of rapport.netwerk) {
    regel(s, n.ok, `${n.naam}: ${n.ok ? `HTTP ${n.status}` : n.fout} (${n.ms} ms)`);
  }
}

function speelAf(naam, bron, s) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  s.appendChild(video);
  let hls = null;
  const uitkomst = { naam, ok: false, methode: '', resolutie: '', fout: undefined };

  const klaar = new Promise((resolve, reject) => {
    video.addEventListener('timeupdate', () => { if (video.currentTime > 2) resolve(); });
    video.addEventListener('error', () => reject(new Error(`video-fout ${video.error ? video.error.code : '?'}`)));
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      uitkomst.methode = 'native';
      video.src = bron;
    } else if (window.Hls && window.Hls.isSupported()) {
      uitkomst.methode = 'hls.js';
      hls = new window.Hls();
      hls.on(window.Hls.Events.ERROR, (_e, d) => { if (d.fatal) reject(new Error(`hls.js: ${d.type} ${d.details}`)); });
      hls.loadSource(bron);
      hls.attachMedia(video);
    } else {
      reject(new Error(window.hlsMislukt ? 'hls.js niet geladen' : 'geen HLS-ondersteuning'));
      return;
    }
    const p = video.play();
    if (p && p.catch) p.catch((e) => reject(e));
  });

  return metTimeout(klaar, 15000, naam)
    .then(() => { uitkomst.ok = true; })
    .catch((e) => { uitkomst.fout = foutTekst(e); })
    .then(() => {
      uitkomst.resolutie = `${video.videoWidth}×${video.videoHeight}`;
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      return uitkomst;
    });
}

async function meetAfspelen() {
  const s = sectie('Afspelen (HLS, fMP4)');
  if (!adressen) {
    regel(s, false, 'Overgeslagen: geen server');
    return;
  }
  for (const naam of VARIANTEN) {
    const bezig = regel(s, null, `${naam}: bezig…`);
    const u = await speelAf(naam, `${adressen.https}/media/${naam}/index.m3u8`, s);
    rapport.afspelen.push(u);
    bezig.remove();
    regel(s, u.ok, u.ok ? `${naam}: speelt (${u.methode}, ${u.resolutie})` : `${naam}: ${u.fout}${u.methode ? ` (${u.methode})` : ''}`);
  }
}

const rapportRegel = document.createElement('div');
rapportRegel.id = 'rapport';

async function verstuurRapport() {
  rapportRegel.textContent = 'Rapport: versturen…';
  if (!adressen) {
    rapportRegel.textContent = 'Rapport niet verstuurd: geen server opgegeven';
    return;
  }
  rapport.tijd = new Date().toISOString();
  try {
    const r = await metTimeout(fetch(`${adressen.https}/rapport`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rapport),
    }), 5000, 'rapport');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    rapportRegel.textContent = `Rapport opgeslagen als ${j.opgeslagen}`;
  } catch (e) {
    rapportRegel.textContent = `Rapport niet verstuurd: ${foutTekst(e)}`;
  }
}

function toetsenSectie() {
  const s = sectie('Toetsen');
  regel(s, null, TOETS_INSTRUCTIE);
  const lijst = document.createElement('div');
  s.appendChild(lijst);
  let wacht = null;
  document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    rapport.toetsen.push({ key: e.key, code: e.code, keyCode: e.keyCode });
    if (rapport.toetsen.length > 50) rapport.toetsen.shift();
    lijst.textContent = '';
    for (const t of rapport.toetsen.slice(-12).reverse()) regel(lijst, null, `key "${t.key}" · code "${t.code}" · keyCode ${t.keyCode}`);
    clearTimeout(wacht);
    wacht = setTimeout(verstuurRapport, 1000);
  });
}

async function start() {
  meetApparaat();
  meetCodecSectie();
  await meetCapabilitySectie();
  await meetNetwerkSectie();
  await meetAfspelen();
  toetsenSectie();
  uitvoer.appendChild(rapportRegel);
  await verstuurRapport();
}

start().catch((e) => {
  rapportRegel.textContent = `Proef afgebroken: ${foutTekst(e)}`;
  uitvoer.appendChild(rapportRegel);
});
