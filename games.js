/* Baby Sounds: toddler games (about 2 years). No reading, no failing, no timers. */
(() => {
'use strict';
const A = window.__bsAudio;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const el = () => A.lang() === 'el';
const T = (en, gr) => (el() ? gr : en);

/* ---------- speech + timers owned by the current game ---------- */
let lastSay = 0;
function say(en, gr, { gap = 0, pitch = 1.6, rate = 0.82 } = {}) {
  const now = performance.now();
  if (gap && now - lastSay < gap) return;
  lastSay = now; A.speak(T(en, gr), { pitch, rate });
}
const timers = new Set();
function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
function clearTimers() { for (const id of timers) clearTimeout(id); timers.clear(); }

/* ---------- data ---------- */
const COLORS = [
  { id: 'red', hex: '#e53935', en: 'Red', gr: 'Κόκκινο' },
  { id: 'blue', hex: '#1e88e5', en: 'Blue', gr: 'Μπλε' },
  { id: 'yellow', hex: '#fdd835', en: 'Yellow', gr: 'Κίτρινο' },
  { id: 'green', hex: '#43a047', en: 'Green', gr: 'Πράσινο' },
  { id: 'orange', hex: '#fb8c00', en: 'Orange', gr: 'Πορτοκαλί' },
  { id: 'purple', hex: '#8e24aa', en: 'Purple', gr: 'Μωβ' },
  { id: 'pink', hex: '#ec407a', en: 'Pink', gr: 'Ροζ' },
];
const ANIMALS = [
  { id: 'cow', e: '🐮', en: 'Cow', gr: 'Αγελάδα', art: 'η', sEn: 'Moooo!', sGr: 'Μουουού!' },
  { id: 'dog', e: '🐶', en: 'Dog', gr: 'Σκυλάκι', art: 'το', sEn: 'Woof woof!', sGr: 'Γαβ γαβ!' },
  { id: 'cat', e: '🐱', en: 'Cat', gr: 'Γατούλα', art: 'η', sEn: 'Meow!', sGr: 'Νιάου!' },
  { id: 'duck', e: '🦆', en: 'Duck', gr: 'Παπάκι', art: 'το', sEn: 'Quack quack!', sGr: 'Πα πα πα!' },
  { id: 'sheep', e: '🐑', en: 'Sheep', gr: 'Προβατάκι', art: 'το', sEn: 'Baaa!', sGr: 'Μπεεε!' },
  { id: 'lion', e: '🦁', en: 'Lion', gr: 'Λιοντάρι', art: 'το', sEn: 'Roar!', sGr: 'Γρρρ!' },
  { id: 'pig', e: '🐷', en: 'Pig', gr: 'Γουρουνάκι', art: 'το', sEn: 'Oink oink!', sGr: 'Οινκ οινκ!' },
  { id: 'frog', e: '🐸', en: 'Frog', gr: 'Βατραχάκι', art: 'το', sEn: 'Ribbit!', sGr: 'Κουάξ κουάξ!' },
];
const NUM = { en: ['One', 'Two', 'Three', 'Four', 'Five'], gr: ['Ένα', 'Δύο', 'Τρία', 'Τέσσερα', 'Πέντε'] };

/* ---------- sound helpers ---------- */
function ramp(p, pts, t) { p.setValueAtTime(pts[0][1], t + pts[0][0]); for (const [dt, v] of pts.slice(1)) p.linearRampToValueAtTime(v, t + dt); }
function synth(o) {
  const c = A.ensure(); if (!c) return;
  const t = c.currentTime + (o.at || 0), d = o.d, v = o.v || 0.3;
  const osc = c.createOscillator(); osc.type = o.type || 'sawtooth'; ramp(osc.frequency, o.f, t);
  const f = c.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.Q.value = o.q || 1; ramp(f.frequency, o.ff || [[0, 2000]], t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.a || 0.03));
  g.gain.setValueAtTime(v, t + d * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  osc.connect(f); f.connect(g);
  let out = g;
  if (o.trem) {
    const tg = c.createGain(), l = c.createOscillator(), lg = c.createGain();
    tg.gain.value = 1 - o.trem[1]; l.frequency.value = o.trem[0]; lg.gain.value = o.trem[1];
    l.connect(lg); lg.connect(tg.gain); g.connect(tg); out = tg; l.start(t); A.track(l, t + d + 0.05);
  }
  if (o.vib) {
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
    l.connect(lg); lg.connect(osc.frequency); l.start(t); A.track(l, t + d + 0.05);
  }
  if (o.noise) {
    const s = c.createBufferSource(), ng = c.createGain(); s.buffer = A.noise(); s.loop = true; ng.gain.value = o.noise;
    s.connect(ng); ng.connect(f); s.start(t); A.track(s, t + d + 0.05);
  }
  out.connect(A.master()); osc.start(t); A.track(osc, t + d + 0.05);
}
const ANIMAL_SOUND = {
  cow: () => synth({ f: [[0, 105], [0.3, 118], [1.1, 92]], ff: [[0, 300], [0.35, 950], [1.2, 400]], q: 4, d: 1.3, v: 0.4, vib: [5, 2] }),
  dog: () => [0, 0.28].forEach((at) => synth({ at, f: [[0, 520], [0.12, 320]], ff: [[0, 1800], [0.12, 700]], q: 2, d: 0.16, v: 0.45, noise: 0.4 })),
  cat: () => synth({ f: [[0, 520], [0.25, 780], [0.75, 560]], ft: 'bandpass', ff: [[0, 800], [0.25, 1800], [0.75, 900]], q: 3, d: 0.85, v: 0.55, vib: [6, 10] }),
  duck: () => [0, 0.2, 0.4].forEach((at) => synth({ at, type: 'square', f: [[0, 330], [0.1, 260]], ft: 'bandpass', ff: [[0, 1300], [0.1, 900]], q: 5, d: 0.14, v: 0.5 })),
  sheep: () => synth({ f: [[0, 320], [0.8, 300]], ft: 'bandpass', ff: [[0, 900], [0.8, 1100]], q: 3, d: 0.9, v: 0.5, trem: [22, 0.45] }),
  lion: () => synth({ f: [[0, 95], [0.5, 120], [1.4, 80]], ff: [[0, 250], [0.5, 900], [1.4, 300]], q: 2, d: 1.5, v: 0.45, noise: 0.7, vib: [9, 6] }),
  pig: () => [0, 0.26].forEach((at) => synth({ at, type: 'square', f: [[0, 170], [0.18, 120]], ff: [[0, 700], [0.18, 400]], q: 6, d: 0.2, v: 0.4, noise: 0.3 })),
  frog: () => [0, 0.35].forEach((at) => synth({ at, type: 'square', f: [[0, 180], [0.2, 160]], ff: [[0, 900], [0.2, 900]], q: 3, d: 0.25, v: 0.4, trem: [35, 0.5] })),
};
function popSound() {
  synth({ type: 'sine', f: [[0, 900], [0.06, 220]], ff: [[0, 4000], [0.06, 4000]], d: 0.09, v: 0.5, a: 0.003, noise: 0.5 });
}
function yay() {
  const c = A.ensure(); if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => A.tone(f, c.currentTime + i * 0.11, 0.25, 0.22));
  A.chime(1568, 0.45);
}
function boop() { const c = A.ensure(); if (c) A.tone(196, c.currentTime, 0.25, 0.18, 'sine'); }
function rustle() { A.ensure(); A.rattle(); }

/* ---------- confetti / stars overlay ---------- */
const fx = $('#fx'), fc = fx.getContext('2d');
let parts = [], fxRaf = 0, fxLast = 0;
function sizeFx() { const d = Math.min(devicePixelRatio || 1, 2); fx.width = innerWidth * d; fx.height = innerHeight * d; fc.setTransform(d, 0, 0, d, 0, 0); }
function burst(x, y, colors = COLORS.map((c) => c.hex), n = 32) {
  if (!fxRaf) sizeFx();
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(180, 520);
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 250, rot: rand(0, 6), vr: rand(-8, 8),
      s: rand(7, 14), c: pick(colors), star: Math.random() < 0.35, life: rand(1.1, 1.8), age: 0 });
  }
  if (!fxRaf) { fxLast = 0; fxRaf = requestAnimationFrame(fxFrame); }
}
function burstAt(node, colors) { const r = node.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, colors); }
function star(ctx, s) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; const a = (i * Math.PI) / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
function fxFrame(now) {
  const dt = Math.min(0.05, (now - (fxLast || now)) / 1000); fxLast = now;
  fc.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => (p.age += dt) < p.life);
  for (const p of parts) {
    p.vy += 900 * dt; p.vx *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    fc.save(); fc.globalAlpha = Math.min(1, (p.life - p.age) * 2); fc.translate(p.x, p.y); fc.rotate(p.rot); fc.fillStyle = p.c;
    if (p.star) star(fc, p.s); else fc.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
    fc.restore();
  }
  if (parts.length) fxRaf = requestAnimationFrame(fxFrame); else { fxRaf = 0; fc.clearRect(0, 0, innerWidth, innerHeight); }
}

/* ---------- shared canvas helper ---------- */
function makeCanvas(host) {
  const cv = document.createElement('canvas'); cv.className = 'gcv'; host.append(cv);
  const g = cv.getContext('2d'); const st = { cv, g, W: 0, H: 0, D: 1 };
  st.size = () => { const r = cv.getBoundingClientRect(); st.D = Math.min(devicePixelRatio || 1, 3); st.W = r.width; st.H = r.height; cv.width = Math.round(r.width * st.D); cv.height = Math.round(r.height * st.D); g.setTransform(st.D, 0, 0, st.D, 0, 0); };
  st.size(); return st;
}
function bounceEl(node, cls = 'boing') { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }

const SHAPES = {
  circle: '<circle cx="50" cy="50" r="44"/>',
  square: '<rect x="8" y="8" width="84" height="84" rx="16"/>',
  star: '<path d="M50 4l13 29 31 3-23 21 7 31-28-16-28 16 7-31L6 36l31-3z"/>',
  heart: '<path d="M50 90S8 62 8 34A21 21 0 0 1 50 24a21 21 0 0 1 42 10c0 28-42 56-42 56z"/>',
  triangle: '<path d="M50 6l46 84H4z" stroke-linejoin="round"/>',
};

/* =====================================================================
   GAMES
   ===================================================================== */
const GAMES = [
  { id: 'balloons', icon: '🎈', en: 'Balloons', gr: 'Μπαλόνια', bg: '#bfe6ff', intro: ['Pop the balloons!', 'Σκάσε τα μπαλόνια!'], mount: balloons },
  { id: 'animals', icon: '🐮', en: 'Animals', gr: 'Ζωάκια', bg: '#d8f5c8', intro: ['Animals!', 'Ζωάκια!'], mount: animals },
  { id: 'colours', icon: '🔴', en: 'Colours', gr: 'Χρώματα', bg: '#ffe0e6', intro: ['', ''], mount: colours },
  { id: 'paint', icon: '🖍️', en: 'Paint', gr: 'Ζωγραφική', bg: '#fff1b8', intro: ['Let\u2019s paint!', 'Ας ζωγραφίσουμε!'], mount: paint },
  { id: 'count', icon: '🍎', en: 'Count 1-5', gr: 'Μετράμε', bg: '#ffe2c4', intro: ['', ''], mount: counting },
  { id: 'peekaboo', icon: '🌳', en: 'Hide & seek', gr: 'Κρυφτό', bg: '#e3d9ff', intro: ['', ''], mount: hideSeek },
];

/* 1. Balloons: tap to pop, hear the colour */
function balloons(host) {
  host.classList.add('sky');
  const c = makeCanvas(host), { cv, g } = c; let bs = [], raf = 0, last = 0;
  const N = 6;
  function spawn(y) {
    const col = pick(COLORS), r = rand(44, 60) * Math.min(1.3, Math.max(1, c.W / 420));
    bs.push({ x: rand(r, c.W - r), y: y ?? c.H + r * 1.6, r, col, vy: rand(38, 62), ph: rand(0, 6) });
  }
  for (let i = 0; i < N; i++) spawn(rand(c.H * 0.25, c.H * 1.1));
  function draw(b, t) {
    const x = b.x + Math.sin(t / 900 + b.ph) * 10, y = b.y, r = b.r;
    g.strokeStyle = 'rgba(70,60,40,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + r);
    g.quadraticCurveTo(x + 10, y + r * 1.6, x - 4, y + r * 2.3); g.stroke();
    g.fillStyle = b.col.hex; g.beginPath(); g.ellipse(x, y, r * 0.86, r, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x, y + r - 2); g.lineTo(x - 7, y + r + 9); g.lineTo(x + 7, y + r + 9); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(x - r * 0.32, y - r * 0.38, r * 0.16, r * 0.28, -0.5, 0, 7); g.fill();
    b.drawX = x;
  }
  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    g.clearRect(0, 0, c.W, c.H);
    for (const b of bs) b.y -= b.vy * dt;
    bs = bs.filter((b) => b.y > -b.r * 2.5);
    while (bs.length < N) spawn();
    for (const b of bs) draw(b, t);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  const onResize = () => c.size(); window.addEventListener('resize', onResize);
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i], dx = (x - (b.drawX ?? b.x)) / 0.86, dy = y - b.y;
      if (dx * dx + dy * dy < b.r * b.r * 1.5) {
        bs.splice(i, 1); popSound(); burst(e.clientX, e.clientY, [b.col.hex, '#fff', b.col.hex]);
        say(b.col.en + '!', b.col.gr + '!', { gap: 450 });
        return;
      }
    }
    boop();
  });
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
}

/* 2. Animals: tap an animal, hear its sound and name */
function animals(host) {
  const list = ANIMALS.slice(0, 6);
  host.innerHTML = `<div class="animal-grid">${list.map((a) => `<button class="animal" data-a="${a.id}" type="button"><span>${a.e}</span></button>`).join('')}</div>`;
  $$('.animal', host).forEach((b) => b.addEventListener('pointerdown', () => {
    const a = ANIMALS.find((x) => x.id === b.dataset.a);
    bounceEl(b); A.ensure(); ANIMAL_SOUND[a.id]();
    later(() => say(`${a.en}! ${a.sEn}`, `${a.gr}! ${a.sGr}`), a.id === 'cow' || a.id === 'lion' ? 1200 : 800);
    burstAt(b, ['#fdd835', '#fff', '#ffb300']);
  }));
}

/* 3. Colours: "Find the red one!" with three big shapes; every tap gets kind feedback */
function colours(host) {
  host.innerHTML = `<div class="find">
    <button class="find-prompt" type="button"><span class="swatch"></span><span class="ptext"></span><span aria-hidden="true">🔊</span></button>
    <div class="choices"></div></div>`;
  const prompt = $('.find-prompt', host), choices = $('.choices', host);
  let target, busy = false;
  const ask = () => say(`Find ${target.en.toLowerCase()}!`, `Βρες το ${target.gr.toLowerCase()}!`);
  function round() {
    busy = false;
    const opts = shuffle(COLORS).slice(0, 3); target = pick(opts);
    $('.swatch', prompt).style.background = target.hex;
    $('.ptext', prompt).textContent = T(`Find ${target.en.toLowerCase()}`, `Βρες το ${target.gr.toLowerCase()}`);
    const shapes = shuffle(Object.keys(SHAPES));
    choices.innerHTML = opts.map((o, i) => `<button class="choice" type="button" data-c="${o.id}" aria-label="${o.en}">
      <svg viewBox="0 0 100 100" fill="${o.hex}" stroke="#222" stroke-width="3">${SHAPES[shapes[i]]}</svg></button>`).join('');
    $$('.choice', choices).forEach((b) => b.addEventListener('pointerdown', () => pickIt(b)));
    later(ask, 350);
  }
  function pickIt(b) {
    if (busy) return;
    const c = COLORS.find((x) => x.id === b.dataset.c);
    if (c === target) {
      busy = true; bounceEl(b); yay(); burstAt(b, [c.hex, '#fdd835', '#fff']);
      say(`Yes! ${c.en}! Well done!`, `Ναι! ${c.gr}! Μπράβο!`);
      later(round, 2400);
    } else {
      bounceEl(b, 'wiggle'); boop();
      say(`That's ${c.en.toLowerCase()}! Where's ${target.en.toLowerCase()}?`, `Αυτό είναι ${c.gr.toLowerCase()}! Πού είναι το ${target.gr.toLowerCase()};`);
    }
  }
  prompt.addEventListener('pointerdown', () => { bounceEl(prompt); ask(); });
  round();
}

/* 4. Paint: finger painting with big colour buttons */
function paint(host) {
  host.innerHTML = `<div class="paint"><div class="paper"></div><div class="palette">
    ${COLORS.slice(0, 6).map((c, i) => `<button type="button" class="sw${i === 0 ? ' on' : ''}" data-c="${c.id}" style="background:${c.hex}" aria-label="${c.en}"></button>`).join('')}
    <button type="button" class="sw rainbow" data-c="rainbow" aria-label="Rainbow"></button>
    <button type="button" class="sw clear" aria-label="Clear">✨</button></div></div>`;
  const c = makeCanvas($('.paper', host)), { cv, g } = c;
  let colour = COLORS[0].hex, rainbow = false, hue = 0, lastNote = 0;
  const pts = new Map();
  g.lineCap = 'round'; g.lineJoin = 'round';
  function note(y) {
    const now = performance.now(); if (now - lastNote < 140) return; lastNote = now;
    const ctx = A.ensure(); if (!ctx) return;
    const i = Math.max(0, Math.min(A.PENTA.length - 1, Math.floor((1 - y / c.H) * A.PENTA.length)));
    A.tone(A.PENTA[i], ctx.currentTime, 0.18, 0.08, 'sine');
  }
  function dot(x, y, px, py) {
    const w = Math.max(16, Math.min(c.W, c.H) * 0.05);
    g.strokeStyle = rainbow ? `hsl(${(hue += 4) % 360},90%,55%)` : colour; g.lineWidth = w;
    g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
  }
  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    try { cv.setPointerCapture(e.pointerId); } catch {}
    pts.set(e.pointerId, [x, y]); dot(x, y, x, y + 0.01); note(y);
  });
  cv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    dot(x, y, p[0], p[1]); pts.set(e.pointerId, [x, y]); note(y);
  });
  const end = (e) => pts.delete(e.pointerId);
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $$('.sw', host).forEach((b) => b.addEventListener('pointerdown', () => {
    bounceEl(b);
    if (b.classList.contains('clear')) {
      g.clearRect(0, 0, c.W, c.H); A.ensure(); A.bubbles(); burstAt(b);
      say('All clean!', 'Καθαρό!'); return;
    }
    $$('.sw', host).forEach((s) => s.classList.toggle('on', s === b));
    rainbow = b.dataset.c === 'rainbow';
    if (rainbow) { say('Rainbow!', 'Ουράνιο τόξο!', { gap: 300 }); return; }
    const col = COLORS.find((x) => x.id === b.dataset.c); colour = col.hex;
    A.ensure(); A.chime(880); say(col.en + '!', col.gr + '!', { gap: 300 });
  }));
}

/* 5. Counting 1-5: tap each thing to count it */
function counting(host) {
  host.innerHTML = '<div class="count"><div class="count-num" aria-live="polite"></div><div class="count-items"></div></div>';
  const numEl = $('.count-num', host), items = $('.count-items', host);
  const THINGS = ['🍎', '⭐', '🐟', '🌸', '🚗', '🎈', '🐥', '🍌', '🦋'];
  let n = 3, done = 0, prevN = 0;
  function round() {
    do { n = 1 + Math.floor(Math.random() * 5); } while (n === prevN || n === 1 && Math.random() < 0.6);
    prevN = n; done = 0; numEl.textContent = ''; items.dataset.n = n;
    const thing = pick(THINGS);
    items.innerHTML = Array.from({ length: n }, () => `<button class="thing" type="button"><span>${thing}</span><b></b></button>`).join('');
    $$('.thing', items).forEach((b) => b.addEventListener('pointerdown', () => tap(b)));
    later(() => say('Let\u2019s count!', 'Πάμε να μετρήσουμε!'), 300);
  }
  function tap(b) {
    if (b.classList.contains('counted')) { bounceEl(b); return; }
    if (done >= n) return;
    done++; b.classList.add('counted'); $('b', b).textContent = done; bounceEl(b);
    numEl.textContent = done; bounceEl(numEl);
    const ctx = A.ensure(); if (ctx) A.tone(A.PENTA[done + 2], ctx.currentTime, 0.3, 0.22);
    say(NUM.en[done - 1] + '!', NUM.gr[done - 1] + '!', { rate: 0.85 });
    if (done === n) {
      later(() => { yay(); burstAt(numEl); say(`${NUM.en[n - 1]}! Yaaay!`, `${NUM.gr[n - 1]}! Μπράβο!`); }, 800);
      later(round, 3200);
    }
  }
  round();
}

/* 6. Hide & seek: an animal hides behind one of three bushes */
function hideSeek(host) {
  host.innerHTML = `<div class="hide"><div class="sun"></div><div class="bushes">${[0, 1, 2].map((i) => `
    <button class="bush" type="button" data-i="${i}" aria-label="Bush ${i + 1}"><span class="critter"></span>
      <svg viewBox="0 0 120 90" aria-hidden="true"><g fill="#2e7d32"><circle cx="30" cy="58" r="28"/><circle cx="60" cy="42" r="34"/><circle cx="92" cy="58" r="27"/></g>
      <g fill="#43a047"><circle cx="40" cy="50" r="18"/><circle cx="70" cy="34" r="16"/><circle cx="90" cy="54" r="14"/></g>
      <circle cx="50" cy="30" r="5" fill="#e53935"/><circle cx="84" cy="44" r="5" fill="#e53935"/><circle cx="24" cy="54" r="5" fill="#e53935"/></g></svg></button>`).join('')}</div></div>`;
  const bushes = $$('.bush', host);
  let hidden = 0, animal = ANIMALS[0], found = false, hintT = 0;
  function round() {
    found = false;
    bushes.forEach((b) => { b.classList.remove('found'); $('.critter', b).textContent = ''; });
    hidden = Math.floor(Math.random() * 3); animal = pick(ANIMALS.filter((a) => a !== animal));
    $('.critter', bushes[hidden]).textContent = animal.e;
    later(() => say(`Where's the ${animal.en.toLowerCase()}?`, `Πού είναι ${animal.art} ${animal.gr.toLowerCase()};`), 300);
    clearInterval(hintT);
    hintT = setInterval(() => { if (!found) bounceEl(bushes[hidden], 'rustle'); }, 5000);
  }
  bushes.forEach((b) => b.addEventListener('pointerdown', () => {
    if (found) return;
    bounceEl(b, 'rustle'); rustle();
    if (+b.dataset.i === hidden) {
      found = true; b.classList.add('found');
      later(() => { ANIMAL_SOUND[animal.id](); burstAt(b, ['#fdd835', '#fff', '#43a047']); }, 250);
      later(() => say(`Peekaboo! ${animal.en}!`, `Κούκου! ${animal.gr}!`), 1000);
      later(round, 3800);
    } else {
      say('Not here!', 'Όχι εδώ!', { gap: 900 });
    }
  }));
  round();
  return () => clearInterval(hintT);
}

/* =====================================================================
   MENU, NAVIGATION, TODDLER LOCK
   ===================================================================== */
const view = $('#games'), menu = $('#game-menu'), area = $('#game-area'), title = $('#games-title');
let current = null, cleanup = null;

menu.innerHTML = GAMES.map((gm) => `<button class="game-tile" type="button" data-game="${gm.id}" style="--tile:${gm.bg}">
  <span class="gt-icon" aria-hidden="true">${gm.icon}</span><span class="gt-name" data-en="${gm.en}" data-gr="${gm.gr}">${gm.en}</span></button>`).join('');
function syncNames() {
  $$('.gt-name', menu).forEach((s) => { s.textContent = el() ? s.dataset.gr : s.dataset.en; });
  title.textContent = current ? (el() ? current.gr : current.en) : T('Games', 'Παιχνίδια');
}
$$('.game-tile', menu).forEach((b) => b.addEventListener('click', () => start(GAMES.find((g) => g.id === b.dataset.game))));
$$('#games [data-lang]').forEach((b) => b.addEventListener('click', () => setTimeout(syncNames, 0)));

function start(gm) {
  stopGame(); A.ensure();
  current = gm; area.className = 'game-area g-' + gm.id; area.style.setProperty('--tile', gm.bg);
  menu.hidden = true; area.hidden = false; syncNames();
  cleanup = gm.mount(area) || null;
  if (gm.intro[0]) later(() => say(gm.intro[0], gm.intro[1]), 150);
}
function stopGame() {
  clearTimers(); if (cleanup) cleanup(); cleanup = null;
  A.stopAll(); area.innerHTML = ''; area.className = 'game-area'; parts = [];
}
function toMenu() { stopGame(); current = null; area.hidden = true; menu.hidden = false; syncNames(); }

/* Back needs a 1-second press-and-hold so little fingers can't leave by accident. */
const back = $('#games-back'), tip = $('#hold-tip');
let holdT = 0, tipT = 0;
const HOLD_MS = 1000;
function cancelHold() { clearTimeout(holdT); holdT = 0; back.classList.remove('holding'); }
back.addEventListener('pointerdown', (e) => {
  e.preventDefault(); back.classList.add('holding');
  holdT = setTimeout(() => {
    cancelHold();
    if (current) toMenu(); else if (history.length > 1 && location.hash) history.back(); else location.hash = '';
  }, HOLD_MS);
});
back.addEventListener('pointerup', () => {
  if (holdT) { tip.hidden = false; clearTimeout(tipT); tipT = setTimeout(() => { tip.hidden = true; }, 2500); }
  cancelHold();
});
back.addEventListener('pointerleave', cancelHold);
back.addEventListener('pointercancel', cancelHold);
back.addEventListener('click', (e) => e.preventDefault());

window.__games = {
  enter() { toMenu(); },
  leave() { stopGame(); current = null; },
  get current() { return current ? current.id : null; },
  start(id) { start(GAMES.find((g) => g.id === id)); },
};
if (document.body.dataset.view === 'games') toMenu();
syncNames();
})();
