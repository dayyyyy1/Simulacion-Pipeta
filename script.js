/* =====================================================
   1. CONSTANTES
   ===================================================== */
const $ = id => document.getElementById(id);
const G = 9.81, TA = 0.5, STEP = 1.8 * Math.PI / 180, KGCM = 0.0981;
const IDS = ['mp', 'mg', 'mb', 'L', 'd', 'up', 'T', 'B'];
const UNITS = { mp: ' g', mg: ' g', mb: ' g', L: ' cm', d: ' cm', up: '°', T: ' s', B: ' mN·m·s/rad' };
let t = 0, raf = null, series = null;

/* =====================================================
   2. LEER LOS DATOS DE LOS CONTROLES
   ===================================================== */
function params() {
  const v = {};
  IDS.forEach(k => { v[k] = +$(k).value; });
  if (v.d > 2 * v.L) { v.d = 2 * v.L; $('d').value = v.d; }
  IDS.forEach(k => { $(k + '_o').textContent = v[k] + UNITS[k]; });
  const m = (v.mp + v.mg) / 1000, mb = v.mb / 1000, L = v.L / 100;
  return {
    m, mb, L, d: v.d / 100, T: v.T, B: v.B / 1000,
    up: v.up * Math.PI / 180,
    phi: 2 * Math.asin(v.d / (2 * v.L)),
    J: m * L * L + mb * L * L / 3,
    Mg: (m + mb / 2) * G * L
  };
}

/* =====================================================
   3. FÍSICA: movimiento y par de cada motor
   ===================================================== */

/* Perfil trapezoidal: acelera, velocidad constante y frena.
   Devuelve [posición, velocidad, aceleración] */
function prof(tt, D, dur) {
  const ta = Math.min(TA, dur / 3), w = D / (dur - ta), a = w / ta;
  if (tt <= 0) return [0, 0, 0];
  if (tt >= dur) return [D, 0, 0];
  if (tt < ta) return [0.5 * a * tt * tt, a * tt, a];
  if (tt < dur - ta) return [0.5 * a * ta * ta + w * (tt - ta), w, 0];
  const u = dur - tt;
  return [D - 0.5 * a * u * u, a * u, -a];
}

/* Dónde está el brazo y qué par hace cada motor en el instante tt */
function state(tt, p) {
  const t1 = 0.2 * p.T, t2 = 0.6 * p.T, t3 = 0.2 * p.T;
  let th = 0, w2 = 0, a2 = 0, ph = 0, w1 = 0, a1 = 0, name = 'En reposo sobre A';
  if (tt <= 0) { /* reposo */ }
  else if (tt < t1) { [th, w2, a2] = prof(tt, p.up, t1); name = 'El motor 2 sube el brazo'; }
  else if (tt < t1 + t2) { th = p.up; [ph, w1, a1] = prof(tt - t1, p.phi, t2); name = 'El motor 1 gira la base de A a B'; }
  else if (tt < p.T) { ph = p.phi; const q = prof(tt - t1 - t2, p.up, t3); th = p.up - q[0]; w2 = -q[1]; a2 = -q[2]; name = 'El motor 2 baja el brazo'; }
  else { ph = p.phi; name = 'La pipeta llegó a B'; }
  const c = Math.cos(th);
  return {
    th, ph, w1, w2, name,
    T1: p.J * c * c * a1 + p.B * w1,
    T2: p.J * a2 + p.B * w2 + p.Mg * c
  };
}

/* Recorre todo el movimiento y guarda los máximos */
function compute(p) {
  const N = 600, ts = [], T1 = [], T2 = [];
  let m1 = 0, m2 = 0, P1 = 0, P2 = 0;
  for (let i = 0; i <= N; i++) {
    const tt = p.T * i / N, s = state(tt, p);
    ts.push(tt); T1.push(s.T1); T2.push(s.T2);
    m1 = Math.max(m1, Math.abs(s.T1)); m2 = Math.max(m2, Math.abs(s.T2));
    P1 = Math.max(P1, Math.abs(s.T1 * s.w1)); P2 = Math.max(P2, Math.abs(s.T2 * s.w2));
  }
  const d1 = 0.6 * p.T, d2 = 0.2 * p.T;
  const w1 = p.phi / (d1 - Math.min(TA, d1 / 3)), w2 = p.up / (d2 - Math.min(TA, d2 / 3));
  return { ts, T1, T2, m1, m2, P1, P2, w1, w2 };
}

/* =====================================================
   4. MOSTRAR LOS RESULTADOS EN LA PÁGINA
   ===================================================== */
const f = (x, n) => x.toFixed(n);
const deg = r => r * 180 / Math.PI;
const rpm = w => w * 60 / (2 * Math.PI);

function pill(id, need, has) {
  const ok = need <= has, el = $(id);
  el.className = ok ? 'ok' : 'bad';
  el.textContent = (id.endsWith('1') ? 'M1 ' : 'M2 ') + (ok ? 'alcanza' : 'no alcanza');
  return ok;
}

function update() {
  const p = params(), r = compute(p);
  series = { p, r };
  $('r_T1').textContent = f(r.m1 * 1000, 2) + ' mN·m';
  $('r_T2').textContent = f(r.m2 * 1000, 1) + ' mN·m';
  $('r_F1').textContent = f(r.m1 / p.L, 4) + ' N';
  $('r_F2').textContent = f(r.m2 / p.L, 3) + ' N';
  $('r_w1').textContent = f(rpm(r.w1), 1) + ' rpm';
  $('r_w2').textContent = f(rpm(r.w2), 1) + ' rpm';
  $('r_P1').textContent = f(r.P1 * 1000, 2) + ' mW';
  $('r_P2').textContent = f(r.P2 * 1000, 1) + ' mW';
  const s1 = 2 * r.m1 / KGCM, s2 = 2 * r.m2 / KGCM;
  $('r_S1').textContent = f(s1, 3) + ' kg·cm';
  $('r_S2').textContent = f(s2, 2) + ' kg·cm';
  $('r_a1').textContent = f(deg(p.phi), 1) + '°';
  $('r_a2').textContent = f(deg(p.up), 0) + '°';
  $('r_p1').textContent = Math.round(p.phi / STEP);
  $('r_p2').textContent = Math.round(p.up / STEP);
  pill('v_a1', s1, 1.4); const a2 = pill('v_a2', s2, 1.4);
  pill('v_b1', s1, 4); const b2 = pill('v_b2', s2, 4);
  $('verdictNote').textContent = a2
    ? 'El de 1.4 kg·cm alcanza para los dos motores con estos datos.'
    : b2 ? 'El motor 2 carga el peso del brazo, así que necesita el de 4 kg·cm. Para el motor 1 basta el de 1.4 kg·cm.'
         : 'El motor 2 no alcanza ni con el de 4 kg·cm: acorta el brazo, aligéralo o usa un motor con reductor.';
  $('e_J').textContent = '= ' + f(p.m, 3) + '·' + f(p.L, 2) + '² + ⅓·' + f(p.mb, 3) + '·' + f(p.L, 2) + '² = ' + (p.J * 1000).toFixed(3) + '×10⁻³ kg·m²';
  $('e_phi').textContent = '= 2·sen⁻¹(' + f(p.d, 2) + ' / ' + f(2 * p.L, 2) + ') = ' + f(deg(p.phi), 1) + '°';
  $('e_T1').textContent = 'máximo = ' + f(r.m1 * 1000, 2) + ' mN·m';
  $('e_T2').textContent = 'máximo = ' + f(r.m2 * 1000, 1) + ' mN·m (de eso, ' + f(p.Mg * 1000, 1) + ' mN·m son solo por el peso con el brazo horizontal)';
  if (t > p.T) t = p.T;
  draw();
}

/* =====================================================
   5. DIBUJOS (vista de arriba, vista de lado y gráficas)
   ===================================================== */
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function ctxOf(id) {
  const c = $(id), dpr = window.devicePixelRatio || 1, w = c.clientWidth;
  /* La altura en CSS se guarda una sola vez: en celular, c.height cambia el atributo y se estiraba el dibujo */
  if (!c.dataset.h) c.dataset.h = c.getAttribute('height');
  const h = +c.dataset.h;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.height = h + 'px'; }
  const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
  x.font = '12px "IBM Plex Sans", sans-serif'; x.lineCap = 'round';
  return [x, w, h];
}

/* --- Brazo en 3D: proyecta (X, Y, Z) en metros a la pantalla --- */
function drawArm(p, s, C) {
  $('arm').dataset.h = $('arm').clientWidth < 600 ? 340 : 440;   // más bajito en celular
  const [x, w, h] = ctxOf('arm');
  const sc = Math.min(780, (w - 30) / 0.74), cx = w / 2 - 0.11 * sc, cy = h - 150, K = 0.5;
  const Z0 = 0.12, HANG = 0.09;                       // altura del hombro y largo de la pipeta
  const P = (X, Y, Z) => [cx + sc * X, cy + sc * Y * K - sc * Z];
  const tipAt = st => {                               // punta del brazo para un estado
    const psi = p.phi / 2 - st.ph, r = p.L * Math.cos(st.th);   // A queda al frente y B atrás
    return [r * Math.cos(psi), r * Math.sin(psi), Z0 + p.L * Math.sin(st.th)];
  };
  const cyl = (X, Y, z0, z1, r, side, top) => {
    const a = P(X, Y, z0), b = P(X, Y, z1), R = r * sc;
    x.fillStyle = side; x.beginPath(); x.ellipse(a[0], a[1], R, R * K, 0, 0, 7); x.fill();
    x.fillRect(a[0] - R, b[1], 2 * R, a[1] - b[1]);
    x.fillStyle = top; x.beginPath(); x.ellipse(b[0], b[1], R, R * K, 0, 0, 7); x.fill();
    x.strokeStyle = side; x.lineWidth = 1.5; x.stroke();
  };
  const line = (a, b, color, width) => { x.strokeStyle = color; x.lineWidth = width; x.beginPath(); x.moveTo(...P(...a)); x.lineTo(...P(...b)); x.stroke(); };

  // Mesa
  const o = P(0, 0, 0), mesa = P(0.11, 0, 0);
  x.fillStyle = C.rosa; x.beginPath(); x.ellipse(mesa[0], mesa[1], 0.36 * sc, 0.36 * sc * K, 0, 0, 7); x.fill();
  x.strokeStyle = C.line; x.lineWidth = 1.5; x.stroke();

  // Recorrido de la punta (línea punteada) y su sombra en la mesa
  x.setLineDash([4, 6]); x.strokeStyle = C.m1; x.lineWidth = 1.5; x.beginPath();
  for (let i = 0; i <= 120; i++) {
    const q = tipAt(state(p.T * i / 120, p)), e = P(q[0], q[1], q[2] - HANG);
    i ? x.lineTo(e[0], e[1]) : x.moveTo(e[0], e[1]);
  }
  x.stroke(); x.setLineDash([]);

  // Tubos A y B
  x.textAlign = 'center';
  [[-p.phi / 2, 'B'], [p.phi / 2, 'A']].forEach(([psi, n]) => {
    const X = p.L * Math.cos(psi), Y = p.L * Math.sin(psi);
    cyl(X, Y, 0, 0.045, 0.018, C.line, C.blanco);
    const q = P(X, Y, 0); x.fillStyle = C.ink; x.font = '600 14px "IBM Plex Sans", sans-serif';
    x.fillText(n, q[0] + 30, q[1] + 6); x.font = '12px "IBM Plex Sans", sans-serif';
  });

  const tip = tipAt(s);
  // Sombra del brazo
  x.globalAlpha = 0.16; line([0, 0, 0], [tip[0], tip[1], 0], C.ink, 9); x.globalAlpha = 1;

  // Sombra de la pipeta y línea guía hasta la mesa, para ver sobre qué punto está
  const piso = P(tip[0], tip[1], 0);
  x.globalAlpha = 0.3; x.fillStyle = C.ink; x.beginPath(); x.ellipse(piso[0], piso[1], 9, 4.5, 0, 0, 7); x.fill(); x.globalAlpha = 1;
  x.setLineDash([2, 4]); line([tip[0], tip[1], 0], [tip[0], tip[1], tip[2] - HANG], C.soft, 1); x.setLineDash([]);

  // Base (motor 1) y columna
  cyl(0, 0, 0, 0.032, 0.055, C.m1, C.line);
  cyl(0, 0, 0.032, Z0, 0.013, C.soft, C.soft);

  // Brazo, pinza y pipeta
  line([0, 0, Z0], tip, C.ink, 12);
  line([tip[0], tip[1], tip[2] - 0.012], [tip[0], tip[1], tip[2] - 0.066], C.m1, 9);
  line([tip[0], tip[1], tip[2] - 0.066], [tip[0], tip[1], tip[2] - HANG], C.m1, 3);
  const g = P(...tip); x.fillStyle = C.m2; x.fillRect(g[0] - 12, g[1] - 8, 24, 16);

  // Hombro (motor 2)
  const sh = P(0, 0, Z0);
  x.fillStyle = C.m2; x.beginPath(); x.arc(sh[0], sh[1], 16, 0, 7); x.fill();
  x.strokeStyle = C.ink; x.lineWidth = 1.5; x.stroke();

  // Etiquetas
  x.fillStyle = C.ink; x.textAlign = 'right';
  x.fillText('M2 hombro', sh[0] - 24, sh[1] + 4);
  x.fillText('M1 base', o[0] - 0.055 * sc - 8, o[1] - 6);
  x.textAlign = 'left'; x.fillStyle = C.soft;
  x.fillText('θ = ' + deg(s.th).toFixed(0) + '°   φ = ' + deg(s.ph).toFixed(0) + '° de ' + deg(p.phi).toFixed(0) + '°', 4, 14);
}

/* --- Señales que manda el Arduino en el instante tt --- */
function signals(tt, p) {
  const s = state(tt, p), n1 = s.ph / STEP + 1e-9, n2 = s.th / STEP + 1e-9;
  return {
    n1: Math.floor(n1), n2: Math.floor(n2),
    step1: s.w1 !== 0 && n1 % 1 < 0.5 ? 1 : 0,
    step2: s.w2 !== 0 && n2 % 1 < 0.5 ? 1 : 0,
    dir1: 1, dir2: tt >= 0.8 * p.T ? 0 : 1,
    on1: s.w1 !== 0, on2: s.w2 !== 0
  };
}

/* --- Esquemático del circuito (se dibuja en una hoja de 900 x 430) --- */
function drawCircuit(p, C) {
  const cv = $('circ'), W = 900, H = 430;
  const hh = Math.round(H * cv.clientWidth / W);
  if (+cv.dataset.h !== hh) { cv.dataset.h = hh; cv.width = 0; }
  const [x, w] = ctxOf('circ'), g = signals(t, p);
  x.scale(w / W, w / W);
  x.font = '11px "IBM Plex Mono", monospace';

  // Hoja con puntos, como la rejilla de un editor de esquemáticos
  x.fillStyle = C.crema; x.globalAlpha = 0.35; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
  x.fillStyle = C.line;
  for (let i = 15; i < W; i += 30) for (let j = 15; j < H; j += 30) x.fillRect(i, j, 1.5, 1.5);

  const wire = (pts, on) => {
    x.strokeStyle = on ? C.m1 : C.soft; x.lineWidth = on ? 3.5 : 1.5; x.lineJoin = 'round';
    x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke();
  };
  const box = (x0, y0, bw, bh, name, sub) => {
    x.fillStyle = C.blanco; x.strokeStyle = C.ink; x.lineWidth = 2;
    x.fillRect(x0, y0, bw, bh); x.strokeRect(x0, y0, bw, bh);
    x.fillStyle = C.ink; x.textAlign = 'center';
    x.font = '600 12px "IBM Plex Sans", sans-serif'; x.fillText(name, x0 + bw / 2, y0 + bh / 2 - 2);
    x.font = '11px "IBM Plex Mono", monospace'; x.fillStyle = C.soft; x.fillText(sub, x0 + bw / 2, y0 + bh / 2 + 13);
  };
  const pin = (px, py, label, side) => {
    x.fillStyle = C.ink; x.textAlign = side === 'r' ? 'right' : 'left';
    x.fillText(label, px + (side === 'r' ? -6 : 6), py + 4);
  };
  const tag = (px, py, label) => {            // terminal de alimentación
    x.textAlign = 'center'; const tw = x.measureText(label).width + 10;
    x.fillStyle = C.crema; x.strokeStyle = C.ink; x.lineWidth = 1;
    x.fillRect(px - tw / 2, py - 8, tw, 16); x.strokeRect(px - tw / 2, py - 8, tw, 16);
    x.fillStyle = C.ink; x.fillText(label, px, py + 4);
  };
  const gnd = (px, py) => {
    x.strokeStyle = C.ink; x.lineWidth = 1.5;
    [[9, 0], [6, 4], [3, 8]].forEach(([a, d]) => { x.beginPath(); x.moveTo(px - a, py + d); x.lineTo(px + a, py + d); x.stroke(); });
  };

  // Arduino
  box(30, 110, 140, 220, 'ARDUINO UNO', 'ARD1');
  pin(170, 150, 'D2', 'r'); pin(170, 180, 'D3', 'r'); pin(170, 250, 'D4', 'r'); pin(170, 280, 'D5', 'r');
  pin(30, 290, '5V', 'l'); pin(30, 315, 'GND', 'l');
  wire([[30, 290], [12, 290], [12, 270]]); tag(22, 262, '+5V');
  wire([[30, 315], [12, 315], [12, 335]]); gnd(12, 335);

  // Fuente
  box(40, 365, 120, 46, 'FUENTE', '12 V · 2 A');
  wire([[160, 378], [185, 378]]); tag(205, 378, '+12V');
  wire([[160, 398], [185, 398]]); gnd(185, 398);

  // Un driver con su motor (y0 = borde superior del driver)
  const stage = (y0, n, on, stepHigh, dirHigh, steps) => {
    box(330, y0, 140, 150, 'A4988', 'U' + n);
    pin(330, y0 + 40, 'STEP', 'l'); pin(330, y0 + 70, 'DIR', 'l'); pin(330, y0 + 100, 'VDD', 'l'); pin(330, y0 + 128, 'RST·SLP', 'l');
    ['1A', '1B', '2A', '2B'].forEach((l, i) => pin(470, y0 + 30 + i * 28, l, 'r'));
    // VMOT, capacitor y tierra
    wire([[370, y0], [370, y0 - 18], [397, y0 - 18]]); wire([[403, y0 - 18], [430, y0 - 18], [430, y0]]);
    x.strokeStyle = C.ink; x.lineWidth = 2;
    [397, 403].forEach(cx0 => { x.beginPath(); x.moveTo(cx0, y0 - 27); x.lineTo(cx0, y0 - 9); x.stroke(); });
    x.fillStyle = C.soft; x.textAlign = 'center'; x.fillText('C' + n + ' 100µF', 400, y0 - 31);
    wire([[370, y0 - 18], [345, y0 - 18]]); tag(322, y0 - 18, '+12V');
    wire([[430, y0 - 18], [452, y0 - 18]]); gnd(452, y0 - 18);
    pin(370, y0 + 10, 'VMOT', 'l'); pin(430, y0 + 10, 'GND', 'r');
    // Lógica
    wire([[330, y0 + 100], [308, y0 + 100]]); tag(288, y0 + 100, '+5V');
    wire([[330, y0 + 128], [312, y0 + 128], [312, y0 + 140], [330, y0 + 140]]);
    // Motor
    const mx = 720, my = y0 + 72, R = 52;
    for (let i = 0; i < 4; i++) {
      const yy = y0 + 30 + i * 28, dx = Math.sqrt(R * R - (yy - my) * (yy - my));
      wire([[470, yy], [mx - dx, yy]], on && ((steps + (i >> 1)) % 2 === 0));
    }
    x.fillStyle = C.blanco; x.strokeStyle = C.ink; x.lineWidth = 2;
    x.beginPath(); x.arc(mx, my, R, 0, 7); x.fill(); x.stroke();
    const ang = steps * STEP - Math.PI / 2;
    x.strokeStyle = n === 1 ? C.m1 : C.m2; x.lineWidth = 5;
    x.beginPath(); x.moveTo(mx, my); x.lineTo(mx + 38 * Math.cos(ang), my + 38 * Math.sin(ang)); x.stroke();
    x.fillStyle = C.ink; x.beginPath(); x.arc(mx, my, 6, 0, 7); x.fill();
    x.textAlign = 'left'; x.font = '600 12px "IBM Plex Sans", sans-serif';
    x.fillText('M' + n + (n === 1 ? ' · base' : ' · hombro'), mx + R + 12, my - 4);
    x.font = '11px "IBM Plex Mono", monospace'; x.fillStyle = C.soft;
    x.fillText('NEMA 17', mx + R + 12, my + 12);
    x.fillText('paso ' + steps, mx + R + 12, my + 28);
    return [stepHigh, dirHigh];
  };
  stage(40, 1, g.on1, g.step1, g.dir1, g.n1);
  stage(250, 2, g.on2, g.step2, g.dir2, g.n2);

  // Señales del Arduino a los drivers
  wire([[170, 150], [250, 150], [250, 80], [330, 80]], g.step1);
  wire([[170, 180], [270, 180], [270, 110], [330, 110]], g.on1 && g.dir1);
  wire([[170, 250], [270, 250], [270, 290], [330, 290]], g.step2);
  wire([[170, 280], [250, 280], [250, 320], [330, 320]], g.on2 && g.dir2);

  const lv = v => v ? 'HIGH' : 'LOW';
  $('sig1').textContent = 'M1: paso ' + g.n1 + ' de ' + Math.round(p.phi / STEP) + ' · STEP (D2) ' + lv(g.step1) + ' · DIR (D3) ' + lv(g.dir1);
  $('sig2').textContent = 'M2: paso ' + g.n2 + ' de ' + Math.round(p.up / STEP) + ' · STEP (D4) ' + lv(g.step2) + ' · DIR (D5) ' + lv(g.dir2);
}

/* --- Señales digitales contra el tiempo --- */
function drawLogic(p, C) {
  const [x, w, h] = ctxOf('logic'), l = 58, r = 10, rows = ['STEP 1', 'DIR 1', 'STEP 2', 'DIR 2'], keys = ['step1', 'dir1', 'step2', 'dir2'];
  const rh = (h - 26) / 4, X = v => l + (w - l - r) * v / p.T, n = Math.max(2, Math.round(w - l - r));
  const samples = []; for (let i = 0; i <= n; i++) samples.push(signals(p.T * i / n, p));
  rows.forEach((name, k) => {
    const yLow = rh * k + rh - 8, yHigh = rh * k + 10;
    x.fillStyle = C.ink; x.textAlign = 'left'; x.fillText(name, 2, yLow - 4);
    x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.moveTo(l, yLow); x.lineTo(w - r, yLow); x.stroke();
    x.strokeStyle = k < 2 ? C.m1 : C.m2; x.lineWidth = 1.5; x.beginPath();
    samples.forEach((sg, i) => { const y = sg[keys[k]] ? yHigh : yLow, xx = l + i; i ? x.lineTo(xx, y) : x.moveTo(xx, y); });
    x.stroke();
  });
  x.fillStyle = C.soft; x.textAlign = 'center';
  for (let i = 0; i <= 5; i++) x.fillText((p.T * i / 5).toFixed(0) + ' s', X(p.T * i / 5), h - 6);
  x.strokeStyle = C.ink; x.lineWidth = 1; x.beginPath(); x.moveTo(X(t), 4); x.lineTo(X(t), h - 22); x.stroke();
}

function drawChart(id, ts, ys, color, p, C) {
  const [x, w, h] = ctxOf(id), l = 54, r = 10, tp = 12, bt = 26;
  const lo = Math.min(0, ...ys), hi = Math.max(0, ...ys), span = (hi - lo) || 1;
  const X = v => l + (w - l - r) * v / p.T, Y = v => tp + (h - tp - bt) * (1 - (v - lo) / span);
  x.strokeStyle = C.line; x.lineWidth = 1; x.fillStyle = C.soft; x.textAlign = 'right';
  [lo, 0, hi].filter((v, i, a) => a.indexOf(v) === i).forEach(v => {
    x.beginPath(); x.moveTo(l, Y(v)); x.lineTo(w - r, Y(v)); x.stroke();
    x.fillText((v * 1000).toFixed(Math.abs(hi) < 0.01 ? 2 : 1), l - 6, Y(v) + 4);
  });
  x.textAlign = 'center';
  for (let i = 0; i <= 5; i++) x.fillText((p.T * i / 5).toFixed(0) + ' s', X(p.T * i / 5), h - 8);
  x.save(); x.translate(12, h / 2 - 6); x.rotate(-Math.PI / 2); x.fillText('mN·m', 0, 0); x.restore();
  x.beginPath(); ts.forEach((tt, i) => i ? x.lineTo(X(tt), Y(ys[i])) : x.moveTo(X(tt), Y(ys[i])));
  x.lineTo(X(p.T), Y(0)); x.lineTo(X(0), Y(0)); x.closePath();
  x.globalAlpha = 0.14; x.fillStyle = color; x.fill(); x.globalAlpha = 1;
  x.beginPath(); ts.forEach((tt, i) => i ? x.lineTo(X(tt), Y(ys[i])) : x.moveTo(X(tt), Y(ys[i])));
  x.strokeStyle = color; x.lineWidth = 2; x.stroke();
  const i = Math.min(ts.length - 1, Math.round(t / p.T * (ts.length - 1)));
  x.strokeStyle = C.soft; x.lineWidth = 1; x.beginPath(); x.moveTo(X(t), tp); x.lineTo(X(t), h - bt); x.stroke();
  x.fillStyle = color; x.beginPath(); x.arc(X(t), Y(ys[i]), 4.5, 0, 7); x.fill();
}

function draw() {
  if (!series) return;
  const { p, r } = series, s = state(t, p);
  const C = { ink: css('--texto'), soft: css('--texto-suave'), line: css('--lila'), m1: css('--motor1'), m2: css('--motor2'), crema: css('--crema'), rosa: css('--rosa'), blanco: css('--blanco') };
  const fase = t <= 0 || t >= p.T ? 0 : t < 0.2 * p.T ? 1 : t < 0.8 * p.T ? 2 : 3;
  [1, 2, 3].forEach(i => $('ph' + i).classList.toggle('activo', i === fase));
  drawArm(p, s, C); drawCircuit(p, C); drawLogic(p, C);
  drawChart('c1', r.ts, r.T1, C.m1, p, C); drawChart('c2', r.ts, r.T2, C.m2, p, C);
  $('clock').textContent = 't = ' + t.toFixed(1) + ' s';
  $('phase').textContent = s.name + ' · T₁ = ' + (s.T1 * 1000).toFixed(2) + ' mN·m · T₂ = ' + (s.T2 * 1000).toFixed(1) + ' mN·m';
  $('scrub').value = Math.round(1000 * t / p.T);
}

/* =====================================================
   6. ANIMACIÓN Y EVENTOS
   ===================================================== */
function stop() { if (raf) cancelAnimationFrame(raf); raf = null; $('play').textContent = '▶ Simular'; }

$('play').addEventListener('click', () => {
  if (raf) { stop(); return; }
  const p = series.p;
  if (t >= p.T) t = 0;
  const t0 = performance.now() - t * 1000;
  $('play').textContent = '❚❚ Pausar';
  const tick = now => {
    t = Math.min((now - t0) / 1000, p.T); draw();
    if (t < p.T) raf = requestAnimationFrame(tick); else stop();
  };
  raf = requestAnimationFrame(tick);
});
$('scrub').addEventListener('input', e => { stop(); t = series.p.T * e.target.value / 1000; draw(); });
IDS.forEach(k => $(k).addEventListener('input', () => { stop(); update(); }));
window.addEventListener('resize', draw);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

/* Arranque: calcula y dibuja con los valores iniciales */
update();
