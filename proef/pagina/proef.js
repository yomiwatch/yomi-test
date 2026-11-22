// Tv-proef: draait alle metingen automatisch en toont/verstuurt de uitkomst.
import { meetCodecs, meetCapabilities, controleerHdrVelden } from './codecs.js';
import { metTimeout, serverAdressen, meetNetwerk } from './netwerk.js';
import { VARIANTEN, TOETS_INSTRUCTIE, afspeelMethoden, moetDirectVersturen } from './afspelen.js';

window.proefGestart = true;

const uitvoer = document.getElementById('uitvoer');
const adressen = serverAdressen(new URLSearchParams(location.search).get('server'));
const rapport = { versie: 1, ua: navigator.userAgent, tijd: '', herkomstPagina: location.origin, apparaat: {}, codecs: [], capabilities: [], hdrVelden: '', netwerk: [], afspelen: [], toetsen: [] };

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

async function meetApparaat() {
  const s = sectie('Apparaat');
  const mm = (q) => { try { return window.matchMedia(q).matches; } catch (e) { return null; } };
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
  a.lnaToestemming = 'niet beschikbaar';
  try {
    if (navigator.permissions && navigator.permissions.query) {
      a.lnaToestemming = (await navigator.permissions.query({ name: 'local-network-access' })).state;
    }
  } catch (e) {
    a.lnaToestemming = `onbekend (${foutTekst(e)})`;
  }
  regel(s, null, `Toestemming lokaal netwerk (local-network-access): ${a.lnaToestemming}`);
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
  rapport.hdrVelden = await controleerHdrVelden((c) => navigator.mediaCapabilities.decodingInfo(c));
  regel(s, rapport.hdrVelden === 'gerespecteerd', `HDR-velden worden gelezen: ${rapport.hdrVelden}${rapport.hdrVelden === 'genegeerd' ? ' (HDR-uitkomst hierboven is niet betrouwbaar)' : ''}`);
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

function speelAf(naam, bron, s, methode) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  s.appendChild(video);
  let hls = null;
  const uitkomst = { naam, ok: false, methode, resolutie: '', fout: undefined };

  const klaar = new Promise((resolve, reject) => {
    video.addEventListener('timeupdate', () => { if (video.currentTime > 2) resolve(); });
    video.addEventListener('error', () => reject(new Error(`video-fout ${video.error ? video.error.code : '?'}`)));
    if (methode === 'native') {
      video.src = bron;
    } else {
      hls = new window.Hls();
      hls.on(window.Hls.Events.ERROR, (_e, d) => { if (d.fatal) reject(new Error(`hls.js: ${d.type} ${d.details}`)); });
      hls.loadSource(bron);
      hls.attachMedia(video);
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

// hls.js laadt async; wacht er maximaal 10 s op zodat een hangend CDN de proef niet blokkeert.
function wachtOpHls() {
  return new Promise((resolve) => {
    const start = Date.now();
    const kijk = () => {
      if (window.Hls || window.hlsMislukt || Date.now() - start > 10000) return resolve(Boolean(window.Hls));
      setTimeout(kijk, 200);
    };
    kijk();
  });
}

async function meetAfspelen() {
  const s = sectie('Afspelen (HLS, fMP4)');
  if (!adressen) {
    regel(s, false, 'Overgeslagen: geen server');
    return;
  }
  const hlsGeladen = await wachtOpHls();
  const nativeKan = Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl'));
  const hlsKan = hlsGeladen && window.Hls.isSupported();
  rapport.hlsJs = hlsGeladen ? (hlsKan ? 'geladen, MSE ondersteund' : 'geladen, MSE niet ondersteund') : 'niet geladen';
  regel(s, hlsKan, `hls.js: ${rapport.hlsJs} · native HLS: ${nativeKan ? 'ja' : 'nee'}`);
  const methoden = afspeelMethoden(nativeKan, hlsKan);
  if (methoden.length === 0) {
    regel(s, false, 'Geen manier om HLS af te spelen');
    return;
  }
  for (const naam of VARIANTEN) {
    for (const methode of methoden) {
      const bezig = regel(s, null, `${naam} (${methode}): bezig…`);
      const u = await speelAf(naam, `${adressen.https}/media/${naam}/index.m3u8`, s, methode);
      rapport.afspelen.push(u);
      bezig.remove();
      regel(s, u.ok, u.ok ? `${naam} (${methode}): speelt, ${u.resolutie}` : `${naam} (${methode}): ${u.fout}`);
    }
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
    e.preventDefault();
    rapport.toetsen.push({ key: e.key, code: e.code, keyCode: e.keyCode });
    if (rapport.toetsen.length > 50) rapport.toetsen.shift();
    lijst.textContent = '';
    for (const t of rapport.toetsen.slice(-12).reverse()) regel(lijst, null, `key "${t.key}" · code "${t.code}" · keyCode ${t.keyCode}`);
    clearTimeout(wacht);
    if (moetDirectVersturen(e.key)) verstuurRapport();
    else wacht = setTimeout(verstuurRapport, 1000);
  });
}

async function start() {
  await meetApparaat();
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
