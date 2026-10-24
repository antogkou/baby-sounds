/* Baby Sounds: all audio is generated in the browser. No audio files, works offline. */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- settings ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('bs.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('bs.' + k, JSON.stringify(v)); } catch {} },
};
let volume = store.get('volume', 40);   // 0..100, default is deliberately modest
let lang = store.get('lang', 'en');
let timerMin = store.get('timer', 30);

/* ---------- audio core ---------- */
const media = $('#media');               // one <audio> element, reused so iOS keeps it unlocked
let ctx = null, master = null, noiseBuf = null;
const active = new Set();                // live Web Audio source nodes (play mode)

function playGain() { const v = volume / 100; return Math.pow(v, 1.2) * 1.3; }
function sleepGain() { const v = volume / 100; return Math.pow(v, 1.5); }

function ensureAudio() {
  // iOS 17+: "playback" lets sound play even with the ring/silent switch on.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = playGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}

function track(node, stopAt) {
  active.add(node);
  node.onended = () => active.delete(node);
  if (stopAt !== undefined) node.stop(stopAt);
  return node;
}
function stopAllPlay() {
  for (const n of active) { try { n.stop(); } catch {} }
  active.clear();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/* ---------- WAV encoding (for the <audio> element path) ---------- */
const SR = 32000;
function encodeWav(samples, sr, gain = 1) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0, o = 44; i < n; i++, o += 2) {
    let s = samples[i] * gain; s = s > 1 ? 1 : s < -1 ? -1 : s;
    v.setInt16(o, s * 32767, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
let silentUrl = null;
function silentLoopUrl() {
  if (!silentUrl) silentUrl = URL.createObjectURL(encodeWav(new Float32Array(SR / 2), SR));
  return silentUrl;
}

/* =====================================================================
   PLAY MODE
   ===================================================================== */
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}

function coo(base = pick([330, 392, 440, 494]), when = 0) {
  if (!ensureAudio()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
  const lg = ctx.createGain(), g = ctx.createGain(), g2 = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'sine'; o2.type = 'triangle';
  o.frequency.setValueAtTime(base * 0.85, t);
  o.frequency.exponentialRampToValueAtTime(base * 1.25, t + 0.28);
  o.frequency.exponentialRampToValueAtTime(base * 0.95, t + 0.8);
  o2.frequency.setValueAtTime(base * 1.7, t);
  o2.frequency.exponentialRampToValueAtTime(base * 2.5, t + 0.28);
  o2.frequency.exponentialRampToValueAtTime(base * 1.9, t + 0.8);
  lfo.frequency.value = 6; lg.gain.value = base * 0.02;
  lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  lp.type = 'lowpass'; lp.frequency.value = 1800;
  g2.gain.value = 0.12;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(master);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  for (const n of [o, o2, lfo]) { n.start(t); track(n, t + 0.95); }
}

function chime(base = pick(PENTA.slice(4)), when = 0) {
  if (!ensureAudio()) return;
  const t = ctx.currentTime + when;
  [[1, 0.3], [2.76, 0.12], [5.4, 0.06], [8.93, 0.03]].forEach(([r, a], i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = base * r;
    env(g, t, 0.004, a, 2.4 - i * 0.4);
    o.connect(g); g.connect(master); o.start(t); track(o, t + 2.5);
  });
}

function rattle(when = 0) {
  if (!ensureAudio()) return;
  const t0 = ctx.currentTime + when;
  for (let shake = 0; shake < 2; shake++) {
    const base = t0 + shake * 0.42;
    const grains = 9 + Math.floor(Math.random() * 6);
    for (let i = 0; i < grains; i++) {
      const t = base + i * rand(0.014, 0.03);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = rand(2800, 5200); f.Q.value = 4;
      env(g, t, 0.002, rand(0.15, 0.35) * (1 - i / grains * 0.6), 0.03);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t, Math.random() * 0.9); track(s, t + 0.05);
    }
  }
}

function bubbles(when = 0) {
  if (!ensureAudio()) return;
  for (let i = 0; i < 6; i++) {
    const t = ctx.currentTime + when + i * rand(0.09, 0.16);
    const o = ctx.createOscillator(), g = ctx.createGain(), f0 = rand(300, 600);
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + 0.09);
    env(g, t, 0.005, 0.28, 0.1);
    o.connect(g); g.connect(master); o.start(t); track(o, t + 0.13);
  }
}

function tone(freq, t, dur, vol = 0.25, type = 'triangle') {
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = type; o.frequency.value = freq; lp.type = 'lowpass'; lp.frequency.value = 2400;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(vol * 0.6, t + Math.min(0.2, dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  o.connect(lp); lp.connect(g); g.connect(master); o.start(t); track(o, t + dur + 0.3);
}

const NOTE = (n) => { // "C5" -> Hz
  const m = /^([A-G])(#|b)?(\d)$/.exec(n);
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (+m[3] + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
};
const seq = (s) => s.trim().split(/\s+/).map((x) => { const [n, d] = x.split(':'); return [n, +d]; });

// Row, Row, Row Your Boat (public domain), 6/8 feel
const ROW = seq(`C5:1.5 C5:1.5 C5:1 D5:.5 E5:1.5 E5:1 D5:.5 E5:1 F5:.5 G5:3
  C6:.5 C6:.5 C6:.5 G5:.5 G5:.5 G5:.5 E5:.5 E5:.5 E5:.5 C5:.5 C5:.5 C5:.5 G5:1 F5:.5 E5:1 D5:.5 C5:3`);

function happySong() {
  if (!ensureAudio()) return;
  let t = ctx.currentTime + 0.05; const beat = 0.3;
  for (const [n, d] of ROW) {
    tone(NOTE(n), t, d * beat * 0.9, 0.22);
    tone(NOTE(n) / 2, t, d * beat * 0.9, 0.06, 'sine');
    t += d * beat;
  }
}

/* ---------- parentese voice (Web Speech API) ---------- */
const PHRASES = {
  en: ['Hellooo, baby!', 'Who\u2019s my little one?', 'Look at youuu!', 'What a big smile!', 'Hiii, sweetie!',
       'Ooh, so pretty!', 'I love youuu!', 'Yes you are!', 'Where are your toes?', 'Good morning, sunshine!'],
  el: ['Γειά σου, μωράκι!', 'Ποιος είναι το μωράκι μου;', 'Τι όμορφο μωρό!', 'Σ\u2019 αγαπώ πολύ!',
       'Μπράβο, μωρό μου!', 'Πού είναι τα δαχτυλάκια;', 'Τι γλυκό χαμόγελο!', 'Καλημέρα, ήλιε μου!'],
};
const PEEK = { en: ['Where\u2019s the baby?', 'Peekaboo!'], el: ['Πού είναι το μωρό;', 'Κούκου! Τσα!'] };
const NOVELTY = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Eddy|Grandpa|Grandma|Reed|Rocko|Sandy|Shelley/i;
const PREFER = {
  en: ['Samantha', 'Karen', 'Moira', 'Tessa', 'Serena', 'Kate', 'Ava', 'Allison', 'Susan', 'Google US English', 'Google UK English Female', 'Microsoft Aria', 'Microsoft Jenny'],
  el: ['Melina', 'Google ελληνικά', 'Microsoft Athina'],
};
function pickVoice(code) {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith(code) && !NOVELTY.test(v.name));
  for (const p of PREFER[code]) { const v = vs.find((x) => x.name.includes(p)); if (v) return v; }
  return vs.find((v) => v.localService) || vs[0] || null;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

function speak(text, { pitch = 1.7, rate = 0.78, cancel = true } = {}) {
  if (!('speechSynthesis' in window)) return;
  if (cancel) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.lang = v ? v.lang : (lang === 'el' ? 'el-GR' : 'en-US');
  u.pitch = pitch; u.rate = rate;
  u.volume = Math.min(1, 0.35 + volume / 100);
  speechSynthesis.speak(u);
}

/* ---------- high-contrast shapes ---------- */
const canvas = $('#shapes'), g2d = canvas.getContext('2d');
const stage = $('#stage');
let W = 0, H = 0, DPR = 1, shapes = [], ripples = [], inverted = false, raf = 0, last = 0;
const TYPES = ['bullseye', 'checker', 'face', 'star', 'stripes', 'circle'];

function resize() {
  const r = stage.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = r.width; H = r.height;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  if (!shapes.length && W && H) seedShapes();
  for (const s of shapes) { s.x = Math.min(Math.max(s.x, s.r), W - s.r); s.y = Math.min(Math.max(s.y, s.r), H - s.r); }
}
function seedShapes() {
  const base = Math.min(W, H);
  shapes = TYPES.map((type, i) => {
    const r = base * rand(0.12, 0.16);
    const a = rand(0, Math.PI * 2), sp = rand(10, 22);
    // spread over a 2 x 3 grid so shapes start apart
    const cx = ((i % 2) + 0.5) * (W / 2), cy = (Math.floor(i / 2) + 0.5) * (H / 3);
    const x = Math.min(Math.max(cx + rand(-0.1, 0.1) * W, r), W - r), y = Math.min(Math.max(cy + rand(-0.05, 0.05) * H, r), H - r);
    return { type, r, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
             rot: rand(0, 6), vr: rand(-0.15, 0.15), hit: -10 };
  });
}
function colors() { return inverted ? ['#fff', '#000'] : ['#111', '#fff']; }

function drawShape(s, now) {
  const [fg, bg] = colors();
  const age = (now - s.hit) / 1000;
  const k = age < 1.5 ? 1 + 0.32 * Math.exp(-age * 4) * Math.sin(age * 16) : 1;
  const r = s.r * k;
  g2d.save(); g2d.translate(s.x, s.y); g2d.rotate(s.rot);
  const circ = (rad, col) => { g2d.beginPath(); g2d.arc(0, 0, rad, 0, Math.PI * 2); g2d.fillStyle = col; g2d.fill(); };
  switch (s.type) {
    case 'bullseye': circ(r, fg); circ(r * 0.75, bg); circ(r * 0.5, fg); circ(r * 0.25, '#e53935'); break;
    case 'circle': circ(r, '#e53935'); circ(r * 0.42, fg); break;
    case 'checker': {
      const n = 4, side = r * 1.5, c = side / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        g2d.fillStyle = (i + j) % 2 ? bg : fg; g2d.fillRect(-side / 2 + i * c, -side / 2 + j * c, c, c);
      }
      g2d.lineWidth = r * 0.08; g2d.strokeStyle = fg; g2d.strokeRect(-side / 2, -side / 2, side, side); break;
    }
    case 'star': {
      g2d.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = (i * Math.PI) / 5 - Math.PI / 2; g2d.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g2d.closePath(); g2d.fillStyle = '#e53935'; g2d.fill(); g2d.lineWidth = r * 0.08; g2d.strokeStyle = fg; g2d.lineJoin = 'round'; g2d.stroke(); break;
    }
    case 'stripes': {
      g2d.beginPath(); g2d.arc(0, 0, r, 0, Math.PI * 2); g2d.save(); g2d.clip();
      const n = 7, w = (2 * r) / n;
      for (let i = 0; i < n; i++) { g2d.fillStyle = i % 2 ? bg : fg; g2d.fillRect(-r + i * w, -r, w, 2 * r); }
      g2d.restore(); g2d.lineWidth = r * 0.06; g2d.strokeStyle = fg; g2d.stroke(); break;
    }
    case 'face': {
      g2d.rotate(-s.rot); // faces stay upright
      circ(r, bg); g2d.lineWidth = r * 0.1; g2d.strokeStyle = fg; g2d.stroke();
      g2d.fillStyle = fg;
      for (const ex of [-0.35, 0.35]) { g2d.beginPath(); g2d.arc(ex * r, -0.18 * r, r * 0.15, 0, 7); g2d.fill(); }
      g2d.beginPath(); g2d.moveTo(-0.45 * r, 0.22 * r); g2d.quadraticCurveTo(0, 0.85 * r, 0.45 * r, 0.22 * r); g2d.closePath();
      g2d.fillStyle = '#e53935'; g2d.fill(); g2d.lineWidth = r * 0.07; g2d.strokeStyle = fg; g2d.stroke(); break;
    }
  }
  g2d.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  const [fg, bg] = colors();
  g2d.setTransform(DPR, 0, 0, DPR, 0, 0);
  g2d.fillStyle = bg; g2d.fillRect(0, 0, W, H);
  for (const s of shapes) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
    if (s.x < s.r && s.vx < 0 || s.x > W - s.r && s.vx > 0) s.vx *= -1;
    if (s.y < s.r && s.vy < 0 || s.y > H - s.r && s.vy > 0) s.vy *= -1;
    const sp = Math.hypot(s.vx, s.vy); if (sp > 24) { s.vx *= 0.99; s.vy *= 0.99; }
  }
  for (const s of shapes) drawShape(s, now);
  ripples = ripples.filter((rp) => now - rp.t < 1200);
  for (const rp of ripples) {
    const a = (now - rp.t) / 1200;
    g2d.beginPath(); g2d.arc(rp.x, rp.y, 10 + a * 90, 0, 7);
    g2d.lineWidth = 8 * (1 - a); g2d.strokeStyle = a < 0.5 ? '#e53935' : fg; g2d.globalAlpha = 1 - a; g2d.stroke(); g2d.globalAlpha = 1;
  }
  raf = requestAnimationFrame(frame);
}
function startAnim() { if (!raf) { last = 0; resize(); raf = requestAnimationFrame(frame); } }
function stopAnim() { cancelAnimationFrame(raf); raf = 0; }

const SHAPE_SOUND = {
  bullseye: () => chime(), circle: () => coo(), checker: () => rattle(), star: () => bubbles(),
  stripes: () => coo(pick([494, 523, 587])), face: () => { chime(784); speak(pick(PHRASES[lang]).split(/[,!?;]/)[0] + '!'); },
};
function bounce(s) {
  s.hit = performance.now();
  const a = rand(0, Math.PI * 2); s.vx += Math.cos(a) * 30; s.vy += Math.sin(a) * 30;
}
let hinted = false;
canvas.addEventListener('pointerdown', (e) => {
  ensureAudio(); unlockMedia();
  const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (!hinted) { hinted = true; $('#play-hint').style.opacity = 0; }
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (Math.hypot(s.x - x, s.y - y) < s.r * 1.15) {
      bounce(s); shapes.push(shapes.splice(i, 1)[0]); SHAPE_SOUND[s.type](); return;
    }
  }
  ripples.push({ x, y, t: performance.now() });
  const f = PENTA[Math.min(PENTA.length - 1, Math.floor((x / W) * PENTA.length))];
  tone(f, ctx.currentTime, 0.4, 0.2, 'sine');
});

/* Play: keep a silent looping <audio> going so iOS routes sound like media */
function unlockMedia() {
  if (view !== 'play' || !media.paused) return;
  media.loop = true; media.src = silentLoopUrl(); media.play().catch(() => {});
}

let peeking = false;
function peekaboo() {
  if (peeking) return;
  ensureAudio(); unlockMedia(); peeking = true;
  const p = $('#peek'); $('#peek-q').textContent = PEEK[lang][0];
  p.classList.remove('open'); p.hidden = false;
  speak(PEEK[lang][0], { pitch: 1.3, rate: 0.7 });
  setTimeout(() => {
    p.classList.add('open'); chime(1046.5); chime(1318.5, 0.12);
    speak(PEEK[lang][1], { pitch: 2, rate: 0.85 });
  }, 1900);
  setTimeout(() => { p.hidden = true; p.classList.remove('open'); peeking = false; }, 5200);
}
$('#btn-peek').addEventListener('click', peekaboo);

$$('[data-play]').forEach((b) => b.addEventListener('click', () => {
  const a = b.dataset.play;
  if (a !== 'stop') { ensureAudio(); unlockMedia(); }
  switch (a) {
    case 'talk': speak(pick(PHRASES[lang])); if (shapes.length) bounce(pick(shapes)); break;
    case 'song': happySong(); break;
    case 'rattle': rattle(); break;
    case 'chime': chime(); chime(pick(PENTA.slice(5)), 0.25); break;
    case 'coo': coo(); coo(pick([494, 523]), 0.9); break;
    case 'pop': bubbles(); break;
    case 'invert': inverted = !inverted; stage.classList.toggle('inverted', inverted); break;
    case 'stop': stopAllPlay(); break;
  }
}));

$$('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang; store.set('lang', lang); syncLang();
  ensureAudio(); speak(lang === 'el' ? 'Γειά σου, μωράκι!' : 'Hellooo, baby!');
}));
function syncLang() { $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang))); }

/* =====================================================================
   SLEEP MODE (rendered to WAV loops and played by <audio>, so it keeps
   going with the screen locked and ignores the silent switch on iOS)
   ===================================================================== */
function crossfadeLoop(gen, secs) {
  const len = Math.round(secs * SR), xf = Math.round(0.5 * SR);
  const a = gen(len + xf), out = new Float32Array(len);
  out.set(a.subarray(0, len));
  for (let i = 0; i < xf; i++) {
    const w = (i / xf) * Math.PI / 2;
    out[i] = a[i] * Math.sin(w) + a[len + i] * Math.cos(w);
  }
  return out;
}
function normRms(b, target) {
  let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
  const k = target / Math.sqrt(s / b.length || 1);
  for (let i = 0; i < b.length; i++) { const x = b[i] * k; b[i] = x > 0.98 ? 0.98 : x < -0.98 ? -0.98 : x; }
  return b;
}
function normPeak(b, target) {
  let m = 0; for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i]));
  const k = target / (m || 1); for (let i = 0; i < b.length; i++) b[i] *= k; return b;
}
const white = (n) => { const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = Math.random() * 2 - 1; return b; };
const pink = (n) => {
  const b = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    b[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
  }
  return b;
};
const brown = (n) => { const b = new Float32Array(n); let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l; } return b; };

function wombGen(n) {
  const b = brown(n); let lp = 0;
  const beat = 60 / 72, lub = 0.0, dub = 0.3;
  for (let i = 0; i < n; i++) { lp += 0.25 * (b[i] - lp); b[i] = lp * 2.2; }
  const thump = (t0, amp, f1, f2) => {
    const s0 = Math.round(t0 * SR), L = Math.round(0.22 * SR); let ph = 0, nz = 0;
    for (let k = 0; k < L && s0 + k < n; k++) {
      const t = k / SR, f = f2 + (f1 - f2) * Math.exp(-t * 18);
      ph += (2 * Math.PI * f) / SR;
      const e = Math.exp(-t * 22) * (1 - Math.exp(-t * 300));
      nz += 0.15 * ((Math.random() * 2 - 1) - nz);
      b[s0 + k] += amp * e * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph) + 0.6 * nz);
    }
  };
  for (let t = 0; t < n / SR; t += beat) { thump(t + lub, 0.5, 120, 70); thump(t + dub, 0.32, 140, 80); }
  return b;
}
function shushGen(n) {
  const b = new Float32Array(n); let prev = 0, lp = 0; const P = 1.3;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1, hp = w - prev; prev = w; lp += 0.55 * (hp - lp);
    const p = ((i / SR) % P) / P;
    let e = p < 0.12 ? p / 0.12 : p < 0.55 ? 1 : Math.max(0.1, 1 - ((p - 0.55) / 0.35) * 0.9);
    e = e * e;
    b[i] = lp * e;
  }
  return b;
}
function wavesGen(n) {
  const src = pink(n), b = new Float32Array(n); let lp = 0; const P = 8;
  for (let i = 0; i < n; i++) {
    const p = ((i / SR) % P) / P;
    const e = 0.12 + 0.88 * Math.pow(Math.sin(Math.PI * Math.pow(p, 0.7)), 2);
    lp += (0.03 + 0.22 * e) * (src[i] - lp);
    b[i] = lp * e;
  }
  return b;
}

// Music box lullabies (public domain melodies)
const BRAHMS = seq(`E5:.5 E5:.5 G5:2 E5:.5 E5:.5 G5:2 E5:.5 G5:.5 C6:1 B5:1 A5:1 A5:1 G5:2
  D5:.5 E5:.5 F5:1 D5:1 D5:.5 E5:.5 F5:2 D5:.5 F5:.5 B5:.5 A5:.5 G5:1 B5:1 C6:2
  C5:.5 C5:.5 C6:2 A5:.5 F5:.5 G5:2 E5:.5 C5:.5 F5:1 G5:1 A5:1 G5:2
  C5:.5 C5:.5 C6:2 A5:.5 F5:.5 G5:2 E5:.5 C5:.5 F5:1 E5:.5 D5:.5 C5:3`);
const TWINKLE = seq(`C5:1 C5:1 G5:1 G5:1 A5:1 A5:1 G5:2 F5:1 F5:1 E5:1 E5:1 D5:1 D5:1 C5:2
  G5:1 G5:1 F5:1 F5:1 E5:1 E5:1 D5:2 G5:1 G5:1 F5:1 F5:1 E5:1 E5:1 D5:2
  C5:1 C5:1 G5:1 G5:1 A5:1 A5:1 G5:2 F5:1 F5:1 E5:1 E5:1 D5:1 D5:1 C5:2`);
function musicBox(notes, beat, bassEvery = 3) {
  let total = 0; for (const [, d] of notes) total += d;
  const len = Math.round((total * beat + 3) * SR), b = new Float32Array(len);
  const add = (f, t0, amp) => {
    const s0 = Math.round(t0 * SR), L = Math.min(len - s0, Math.round(2.6 * SR)), w = (2 * Math.PI * f) / SR;
    for (let k = 0; k < L; k++) {
      const t = k / SR, e = amp * Math.exp(-t * 2.2) * (1 - Math.exp(-t * 500));
      b[s0 + k] += e * (Math.sin(w * k) + 0.3 * Math.exp(-t * 6) * Math.sin(2 * w * k) + 0.1 * Math.exp(-t * 10) * Math.sin(3.01 * w * k));
    }
  };
  let t = 0.4, beats = 0;
  for (const [n, d] of notes) {
    add(NOTE(n), t, 0.5);
    if (Math.abs(beats % bassEvery) < 1e-6) add(NOTE(n) / 4, t, 0.18);
    t += d * beat; beats += d;
  }
  return normPeak(b, 0.75);
}

const BUILD = {
  white: () => normRms(crossfadeLoop(white, 20), 0.1),
  pink: () => normRms(crossfadeLoop(pink, 20), 0.13),
  brown: () => normRms(crossfadeLoop(brown, 20), 0.16),
  womb: () => normRms(crossfadeLoop(wombGen, (60 / 72) * 24), 0.16),
  shush: () => normRms(crossfadeLoop(shushGen, 1.3 * 16), 0.12),
  waves: () => normRms(crossfadeLoop(wavesGen, 32), 0.14),
  brahms: () => musicBox(BRAHMS, 0.62),
  twinkle: () => musicBox(TWINKLE, 0.6, 4),
};
const NAMES = { white: 'White noise', pink: 'Pink noise', brown: 'Brown noise', womb: 'Heartbeat', shush: 'Shushing',
  waves: 'Ocean waves', brahms: 'Brahms\u2019 Lullaby', twinkle: 'Twinkle Twinkle' };
const cache = {};

const sleep = { sound: null, base: null, url: null, endAt: 0, fading: false, tick: 0 };
const FADE_MAX = 90;

function setMedia(samples, loop, startAt = 0) {
  const url = URL.createObjectURL(encodeWav(samples, SR, sleepGain()));
  media.loop = loop; media.src = url; media.volume = 1;
  if (sleep.url) URL.revokeObjectURL(sleep.url);
  sleep.url = url;
  if (startAt > 0) media.addEventListener('loadedmetadata', () => { try { media.currentTime = startAt; } catch {} }, { once: true });
  return media.play();
}

function startSleep(name) {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  sleep.sound = name; sleep.fading = false;
  sleep.base = cache[name] || (cache[name] = BUILD[name]());
  setMedia(sleep.base, true).catch((e) => console.warn('play blocked', e.name));
  resetTimer();
  $('#now-title').textContent = NAMES[name];
  $$('[data-sound]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sound === name)));
  $('#btn-stop').disabled = false;
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: NAMES[name], artist: 'Baby Sounds',
        artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('play', () => media.play());
      navigator.mediaSession.setActionHandler('pause', () => media.pause());
      navigator.mediaSession.setActionHandler('stop', stopSleep);
    } catch {}
  }
  if (!sleep.tick) sleep.tick = setInterval(tick, 1000);
  tick();
}
function stopSleep() {
  media.pause(); media.removeAttribute('src'); media.load();
  if (sleep.url) { URL.revokeObjectURL(sleep.url); sleep.url = null; }
  sleep.sound = null; sleep.fading = false; sleep.endAt = 0;
  clearInterval(sleep.tick); sleep.tick = 0;
  $('#now-title').textContent = 'Pick a sound'; $('#now-timer').textContent = '';
  $$('[data-sound]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  $('#btn-stop').disabled = true;
}
function resetTimer(seconds) {
  const s = seconds !== undefined ? seconds : timerMin * 60;
  sleep.endAt = s > 0 ? Date.now() + s * 1000 : 0;
  if (sleep.fading && sleep.sound) { sleep.fading = false; setMedia(sleep.base, true); }
}
function beginFade(secs) {
  sleep.fading = true;
  const base = sleep.base, bl = base.length;
  const start = Math.floor(((media.currentTime || 0) * SR) % bl);
  const len = Math.max(1, Math.round(secs * SR)), out = new Float32Array(len);
  for (let i = 0; i < len; i++) { const k = 1 - i / len; out[i] = base[(start + i) % bl] * k * k; }
  setMedia(out, false).catch(() => {});
}
function fmt(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function tick() {
  if (!sleep.sound) return;
  if (!sleep.endAt) { $('#now-timer').textContent = media.paused ? 'Paused' : 'Playing, no timer'; return; }
  const left = sleep.endAt - Date.now();
  if (left <= 0 && (!sleep.fading || media.ended || left < -3000)) { stopSleep(); return; }
  if (!sleep.fading && left <= FADE_MAX * 1000) beginFade(left / 1000);
  $('#now-timer').textContent = (sleep.fading ? 'Fading out… ' : 'Stops in ') + fmt(left);
}
media.addEventListener('ended', () => { if (sleep.fading) stopSleep(); });

$$('[data-sound]').forEach((b) => b.addEventListener('click', () => {
  if (sleep.sound === b.dataset.sound && !media.paused) { stopSleep(); return; }
  startSleep(b.dataset.sound);
}));
$('#btn-stop').addEventListener('click', stopSleep);
$$('[data-timer]').forEach((b) => b.addEventListener('click', () => {
  timerMin = +b.dataset.timer; store.set('timer', timerMin); syncTimer();
  if (sleep.sound) { resetTimer(); tick(); }
}));
function syncTimer() { $$('[data-timer]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.timer === timerMin))); }

/* volume (shared) */
let volT = 0;
$$('[data-volume]').forEach((el) => el.addEventListener('input', () => {
  volume = +el.value; store.set('volume', volume);
  $$('[data-volume]').forEach((o) => { if (o !== el) o.value = volume; });
  if (master) master.gain.setTargetAtTime(playGain(), ctx.currentTime, 0.05);
  clearTimeout(volT);
  volT = setTimeout(() => {
    if (sleep.sound && !sleep.fading && !media.paused) setMedia(sleep.base, true, media.currentTime).catch(() => {});
  }, 250);
}));

/* wake lock + dimmer */
let lock = null;
async function wantLock(on) {
  if (!('wakeLock' in navigator)) { if (on) $('#wake').closest('label').append(' (not supported here)'); return; }
  try {
    if (on && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch (e) { console.warn('wake lock', e.name); }
}
$('#wake').addEventListener('change', (e) => { store.set('wake', e.target.checked); wantLock(e.target.checked); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (view === 'sleep' && $('#wake').checked) wantLock(true); tick(); }
});
$('#btn-dim').addEventListener('click', () => { $('#dimmer').hidden = false; });
$('#dimmer').addEventListener('click', () => { $('#dimmer').hidden = true; });

/* =====================================================================
   NAVIGATION
   ===================================================================== */
let view = 'home';
function show(v) {
  if (view === v) return;
  if (view === 'play') { stopAllPlay(); stopAnim(); if (!sleep.sound) media.pause(); }
  if (view === 'sleep') { stopSleep(); wantLock(false); $('#dimmer').hidden = true; }
  view = v; document.body.dataset.view = v;
  for (const id of ['home', 'play', 'sleep']) $('#' + id).hidden = id !== v;
  document.querySelector('meta[name=theme-color]').content = v === 'sleep' ? '#05070c' : '#111111';
  if (v === 'play') startAnim();
  if (v === 'sleep' && $('#wake').checked) wantLock(true);
  window.scrollTo(0, 0);
}
function route() { const h = location.hash.replace('#', ''); show(h === 'play' || h === 'sleep' ? h : 'home'); }
$('#go-play').addEventListener('click', () => { ensureAudio(); location.hash = 'play'; });
$('#go-sleep').addEventListener('click', () => { location.hash = 'sleep'; });
$$('[data-back]').forEach((b) => b.addEventListener('click', () => { if (history.length > 1 && location.hash) history.back(); else location.hash = ''; }));
window.addEventListener('hashchange', route);
window.addEventListener('resize', () => { if (view === 'play') resize(); });

/* init */
$$('[data-volume]').forEach((el) => { el.value = volume; });
$('#wake').checked = store.get('wake', true);
syncLang(); syncTimer(); route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e)));
}

/* test/debug hooks (harmless in production) */
window.__baby = {
  get activeNodes() { return active.size; },
  get mediaPlaying() { return !media.paused && !!media.src; },
  get mediaSrcKind() { return media.src ? (media.src === silentUrl ? 'silent' : 'sound') : 'none'; },
  get ctxState() { return ctx ? ctx.state : 'none'; },
  get sleep() { return { sound: sleep.sound, fading: sleep.fading, endAt: sleep.endAt, timerMin }; },
  setTimerSeconds(s) { resetTimer(s); tick(); },
};
})();
