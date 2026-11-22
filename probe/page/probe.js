// TV probe: runs all measurements automatically and shows/sends the results.
import { measureCodecs, measureCapabilities, checkHdrFields } from './codecs.js';
import { withTimeout, serverAddresses, measureNetwork } from './network.js';
import { VARIANTS, KEY_INSTRUCTION, playbackMethods, shouldSendImmediately } from './playback.js';

window.probeStarted = true;

const output = document.getElementById('output');
const addresses = serverAddresses(new URLSearchParams(location.search).get('server'));
const report = { version: 1, ua: navigator.userAgent, time: '', pageOrigin: location.origin, device: {}, codecs: [], capabilities: [], hdrFields: '', network: [], playback: [], keys: [] };

function section(title) {
  const s = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = title;
  s.appendChild(h);
  output.appendChild(s);
  return s;
}

function line(target, status, text) {
  const r = document.createElement('div');
  r.className = 'line';
  const mark = document.createElement('span');
  mark.className = status === true ? 'ok' : status === false ? 'nok' : 'info';
  mark.textContent = status === true ? '✓' : status === false ? '✗' : '•';
  const t = document.createElement('span');
  t.textContent = text;
  r.append(mark, t);
  target.appendChild(r);
  return r;
}

const errorText = (e) => String(e && e.message ? e.message : e);

async function measureDevice() {
  const s = section('Device');
  const mm = (q) => { try { return window.matchMedia(q).matches; } catch (e) { return null; } };
  const d = {
    screen: `${screen.width}×${screen.height}`,
    pixelRatio: window.devicePixelRatio,
    viewport: `${innerWidth}×${innerHeight}`,
    hdrScreen: mm('(dynamic-range: high)'),
    hdrVideo: mm('(video-dynamic-range: high)'),
  };
  report.device = d;
  const ua = line(s, null, navigator.userAgent);
  ua.classList.add('small');
  line(s, null, `Screen ${d.screen}, pixel ratio ${d.pixelRatio}, viewport ${d.viewport}`);
  line(s, d.hdrScreen, `HDR screen (dynamic-range: high): ${d.hdrScreen}`);
  line(s, d.hdrVideo, `HDR video (video-dynamic-range: high): ${d.hdrVideo}`);
  d.lnaPermission = 'not available';
  try {
    if (navigator.permissions && navigator.permissions.query) {
      d.lnaPermission = (await navigator.permissions.query({ name: 'local-network-access' })).state;
    }
  } catch (e) {
    d.lnaPermission = `unknown (${errorText(e)})`;
  }
  line(s, null, `Local network permission (local-network-access): ${d.lnaPermission}`);
}

function measureCodecSection() {
  const s = section('Codecs (MediaSource)');
  if (typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported) {
    line(s, false, 'No MediaSource');
    report.codecs = measureCodecs(() => false);
    return;
  }
  report.codecs = measureCodecs((m) => MediaSource.isTypeSupported(m));
  for (const c of report.codecs) line(s, c.supported, c.name);
}

async function measureCapabilitySection() {
  const s = section('Capabilities (decodingInfo)');
  if (!navigator.mediaCapabilities || !navigator.mediaCapabilities.decodingInfo) {
    line(s, false, 'No navigator.mediaCapabilities');
    return;
  }
  report.capabilities = await measureCapabilities((c) => navigator.mediaCapabilities.decodingInfo(c));
  for (const c of report.capabilities) {
    line(s, c.supported, c.error ? `${c.name}: error ${c.error}` : `${c.name}: supported ${c.supported}, smooth ${c.smooth}, power efficient ${c.powerEfficient}`);
  }
  report.hdrFields = await checkHdrFields((c) => navigator.mediaCapabilities.decodingInfo(c));
  line(s, report.hdrFields === 'respected', `HDR fields are read: ${report.hdrFields}${report.hdrFields === 'ignored' ? ' (HDR result above is not reliable)' : ''}`);
}

async function measureNetworkSection() {
  const s = section('Network');
  if (!addresses) {
    line(s, false, 'No server given (?server=192-168-2-6)');
    return;
  }
  report.network = await measureNetwork(addresses, (u, o) => fetch(u, o));
  for (const n of report.network) {
    line(s, n.ok, `${n.name}: ${n.ok ? `HTTP ${n.status}` : n.error} (${n.ms} ms)`);
  }
}

function play(name, source, s, method) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  s.appendChild(video);
  let hls = null;
  const result = { name, ok: false, method, resolution: '', error: undefined };

  const done = new Promise((resolve, reject) => {
    video.addEventListener('timeupdate', () => { if (video.currentTime > 2) resolve(); });
    video.addEventListener('error', () => reject(new Error(`video error ${video.error ? video.error.code : '?'}`)));
    if (method === 'native') {
      video.src = source;
    } else {
      hls = new window.Hls();
      hls.on(window.Hls.Events.ERROR, (_e, d) => { if (d.fatal) reject(new Error(`hls.js: ${d.type} ${d.details}`)); });
      hls.loadSource(source);
      hls.attachMedia(video);
    }
    const p = video.play();
    if (p && p.catch) p.catch((e) => reject(e));
  });

  return withTimeout(done, 15000, name)
    .then(() => { result.ok = true; })
    .catch((e) => { result.error = errorText(e); })
    .then(() => {
      result.resolution = `${video.videoWidth}×${video.videoHeight}`;
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      return result;
    });
}

// hls.js loads async; wait at most 10 s for it so a hanging CDN does not block the probe.
function waitForHls() {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (window.Hls || window.hlsFailed || Date.now() - start > 10000) return resolve(Boolean(window.Hls));
      setTimeout(check, 200);
    };
    check();
  });
}

async function measurePlayback() {
  const s = section('Playback (HLS, fMP4)');
  if (!addresses) {
    line(s, false, 'Skipped: no server');
    return;
  }
  const hlsLoaded = await waitForHls();
  const nativeCan = Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl'));
  const hlsCan = hlsLoaded && window.Hls.isSupported();
  report.hlsJs = hlsLoaded ? (hlsCan ? 'loaded, MSE supported' : 'loaded, MSE not supported') : 'not loaded';
  line(s, hlsCan, `hls.js: ${report.hlsJs} · native HLS: ${nativeCan ? 'yes' : 'no'}`);
  const methods = playbackMethods(nativeCan, hlsCan);
  if (methods.length === 0) {
    line(s, false, 'No way to play HLS');
    return;
  }
  for (const name of VARIANTS) {
    for (const method of methods) {
      const busy = line(s, null, `${name} (${method}): running…`);
      const u = await play(name, `${addresses.https}/media/${name}/index.m3u8`, s, method);
      report.playback.push(u);
      busy.remove();
      line(s, u.ok, u.ok ? `${name} (${method}): plays, ${u.resolution}` : `${name} (${method}): ${u.error}`);
    }
  }
}

const reportLine = document.createElement('div');
reportLine.id = 'report';

async function sendReport() {
  reportLine.textContent = 'Report: sending…';
  if (!addresses) {
    reportLine.textContent = 'Report not sent: no server given';
    return;
  }
  report.time = new Date().toISOString();
  try {
    const r = await withTimeout(fetch(`${addresses.https}/report`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report),
    }), 5000, 'report');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    reportLine.textContent = `Report saved as ${j.saved}`;
  } catch (e) {
    reportLine.textContent = `Report not sent: ${errorText(e)}`;
  }
}

function keysSection() {
  const s = section('Keys');
  line(s, null, KEY_INSTRUCTION);
  const list = document.createElement('div');
  s.appendChild(list);
  let pending = null;
  document.addEventListener('keydown', (e) => {
    e.preventDefault();
    report.keys.push({ key: e.key, code: e.code, keyCode: e.keyCode });
    if (report.keys.length > 50) report.keys.shift();
    list.textContent = '';
    for (const k of report.keys.slice(-12).reverse()) line(list, null, `key "${k.key}" · code "${k.code}" · keyCode ${k.keyCode}`);
    clearTimeout(pending);
    if (shouldSendImmediately(e.key)) sendReport();
    else pending = setTimeout(sendReport, 1000);
  });
}

async function start() {
  await measureDevice();
  measureCodecSection();
  await measureCapabilitySection();
  await measureNetworkSection();
  await measurePlayback();
  keysSection();
  output.appendChild(reportLine);
  await sendReport();
}

start().catch((e) => {
  reportLine.textContent = `Probe aborted: ${errorText(e)}`;
  output.appendChild(reportLine);
});
