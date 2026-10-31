// "Bean and the shape sorter" hero animation. Built to site/assets/bean-hero.js by
// tools/build_hero.py. It replaces the CSS reliability loop only once WebGL starts,
// so the CSS loop remains the fallback without JavaScript or WebGL.
// Every frame is a pure function of time t, so the loop can be seeked for previews,
// paused, and rendered as a still for reduced motion. Secondary motion is derived
// from precomputed tables rather than simulated per frame.
import {
  ACESFilmicToneMapping, BufferAttribute, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, CircleGeometry, Color,
  ConeGeometry, CylinderGeometry, DirectionalLight, ExtrudeGeometry, Group, HemisphereLight, Matrix4, Mesh,
  MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Quaternion, QuadraticBezierCurve3, Scene, Shape, ShapeGeometry, SphereGeometry,
  TorusGeometry, TubeGeometry, Vector3, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------- maths
const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);
const v = (x, y, z) => new Vector3(x, y, z);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = (x) => clamp(x, 0, 1);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);
const io = (u) => (u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2);
const out3 = (u) => 1 - (1 - u) ** 3;
const in2 = (u) => u * u;
const back = (u) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2;
const lerpAngle = (a, b, u) => a + ((((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI) * u;
const win = (t, a, b, ri = 0.18, ro = ri) => smooth(seg(t, a, a + ri)) * (1 - smooth(seg(t, b - ro, b)));
const bump = (t, a, b) => (t > a && t < b ? Math.sin(Math.PI * seg(t, a, b)) : 0);
const ring = (t, t0, freq, damp, span = 2) => (t > t0 && t < t0 + span ? Math.exp(-damp * (t - t0)) * Math.sin(freq * (t - t0)) : 0);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const bezier = (a, b, lift, u) => {
  const c = a.clone().add(b).multiplyScalar(0.5); c.y = Math.max(a.y, b.y) + lift;
  return new QuadraticBezierCurve3(a, c, b).getPoint(u);
};
const headingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const forwardOf = (h) => v(Math.sin(h), 0, Math.cos(h));

// ---------------------------------------------------------------- the stage and the story
export const LOOP = 33;
const MACHINE_SCALE = 0.86;
const MACHINES = { pyramid: { x: -1.3, z: -1.4, ry: 0.26 }, cube: { x: 1.3, z: -1.4, ry: -0.26 } };
for (const m of Object.values(MACHINES)) {
  m.front = forwardOf(m.ry);
  m.spot = v(m.x, 0, m.z).addScaledVector(m.front, 0.9);
  m.face = Math.atan2(-m.front.x, -m.front.z);
}
const CENTER = v(0, 0, 0.1);
const CUBE_SIZE = 0.34; const PYR_H = 0.42;
const DROP1 = v(0.22, 0, 0.9);
const DROP_P = v(-0.36, 0, 0.9);
const DROP_C = v(0.4, 0, 0.9);
const approach = (spot) => spot.clone().add(v(0, 0, -0.78));
const A1 = approach(DROP1); const AP = approach(DROP_P); const AC = approach(DROP_C);
const SP = MACHINES.pyramid.spot; const SC = MACHINES.cube.spot;
const HP = MACHINES.pyramid.face; const HC = MACHINES.cube.face;
const BACKED = SP.clone().addScaledVector(MACHINES.pyramid.front, 0.32);

// Where Bean stands and faces, keyed in time. Each segment eases in and out.
const BASE_KEYS = [
  [0, CENTER, 0], [3.5, CENTER, 0], [4.3, A1, 0],
  [6.1, A1, 0], [6.5, A1, headingTo(A1, SP)], [7.8, SP, headingTo(A1, SP)], [8.2, SP, HP],
  // Bonked: a startled hop back that spins round to face the camera, then it gathers itself.
  [10.66, SP, HP], [10.98, BACKED, 0.35],
  [12.5, BACKED, 0.35], [12.8, BACKED, headingTo(BACKED, SC)], [13.95, SC, headingTo(BACKED, SC)], [14.3, SC, HC],
  [16.3, SC, HC], [16.6, SC, headingTo(SC, CENTER)], [17.2, CENTER, headingTo(SC, CENTER)], [17.5, CENTER, 0],
  [19.2, CENTER, 0], [19.35, CENTER, headingTo(CENTER, AP)], [19.65, AP, headingTo(CENTER, AP)], [19.78, AP, 0],
  [20.85, AP, 0], [21.1, AP, headingTo(AP, SP)], [22.05, SP, headingTo(AP, SP)], [22.35, SP, HP],
  [23.6, SP, HP], [23.85, SP, headingTo(SP, AC)], [25.1, AC, headingTo(SP, AC)], [25.42, AC, 0],
  [26.5, AC, 0], [26.75, AC, headingTo(AC, SC)], [27.65, SC, headingTo(AC, SC)], [27.95, SC, HC],
  [29.2, SC, HC], [29.45, SC, headingTo(SC, CENTER)], [30.2, CENTER, headingTo(SC, CENTER)], [30.45, CENTER, 0],
  [LOOP, CENTER, 0],
];
const WALK_STARTS = [3.5, 6.5, 12.8, 16.6, 19.35, 21.1, 23.85, 26.75, 29.45];
const WALK_STOPS = [4.3, 7.8, 13.95, 17.2, 19.65, 22.05, 25.1, 27.65, 30.2];

// Pickups (nudge, tilt, flick onto the head) and inserts (toss into a machine).
const PICKUPS = [{ t: 4.4, d: 1.2 }, { t: 19.85, d: 0.72 }, { t: 25.5, d: 0.72 }];
const pickupTimes = ({ t, d }) => ({
  start: t, nudge: t + 0.25 * d, tiltEnd: t + 0.5 * d, crouch: t + 0.45 * d, flick: t + 0.7 * d,
  land: t + 1.1 * d, end: t + 1.3 * d,
});
const INSERTS = [{ t: 8.3, m: 'pyramid' }, { t: 14.4, m: 'cube' }, { t: 22.4, m: 'pyramid' }, { t: 28.0, m: 'cube' }];
const insertTimes = (t) => ({ start: t, toss: t + 0.25, fly: t + 0.3, gulp: t + 0.65, end: t + 0.8 });
const SPIT = { start: 10.15, land: 10.6 };
const VERDICTS = {
  pyramid: [{ busy: [9.05, 9.8], verdict: 'error', at: 9.8, until: 11.6 }, { busy: [23.05, 23.5], verdict: 'ok', at: 23.5, until: 32.3 }],
  cube: [{ busy: [15.05, 15.6], verdict: 'ok', at: 15.6, until: 17.4 }, { busy: [28.65, 29.1], verdict: 'ok', at: 29.1, until: 32.3 }],
};
const JUMP = { crouch: 30.5, take: 30.85, land: 31.55, settle: 31.85 };
// The hand: [time, position, open (0 holding, 1 open)]. It places one shape at a time,
// lowering it close to the floor before letting go, and leaves the frame between trips.
const HAND = [
  [0, v(0.22, 4.7, 0.9), 0], [0.35, v(0.22, 4.7, 0.9), 0], [1.32, v(0.22, 1.25, 0.9), 0], [1.42, v(0.22, 1.25, 0.9), 0],
  [1.54, v(0.22, 1.27, 0.9), 1], [1.72, v(0.22, 1.34, 0.9), 1], [2.7, v(0.22, 4.7, 0.9), 1], [2.75, v(0.22, 4.7, 0.9), 0],
  [17.0, v(-0.36, 4.7, 0.9), 0], [17.8, v(-0.36, 1.12, 0.9), 0], [17.9, v(-0.36, 1.12, 0.9), 0],
  [18.02, v(-0.36, 1.14, 0.9), 1], [18.2, v(-0.36, 1.22, 0.9), 1], [18.8, v(0.0, 4.7, 0.9), 1],
  [18.85, v(0.4, 4.7, 0.9), 0], [19.48, v(0.4, 1.1, 0.9), 0], [19.56, v(0.4, 1.1, 0.9), 0],
  [19.68, v(0.4, 1.12, 0.9), 1], [19.86, v(0.4, 1.2, 0.9), 1], [20.55, v(0.4, 4.7, 0.9), 1], [20.6, v(0.4, 4.7, 0.9), 0],
  [LOOP, v(0.4, 4.7, 0.9), 0],
];
const RELEASE1 = 1.47; const RELEASE_P = 17.95; const RELEASE_C = 19.62;
// Where each stage label jumps to.
const CHIP_TIMES = [0, 3.3, 8.95, 12.45, 17.0];
const CAPTIONS = [
  [2.2, 0, 'A new task drops in.'],
  [8.95, 1, 'The agent works out what to do with it…'],
  [12.4, 2, 'Eval: wrong machine. Rejected.'],
  [17.0, 3, 'Feedback in. It corrects course: accepted.'],
  [20.3, 4, 'A harder task: two shapes at once.'],
  [29.1, 1, 'Pyramid first, then the cube…'],
  [LOOP, 2, 'Both accepted, first try.'],
];

function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0];
  for (let i = 1; i < keys.length; i += 1) {
    if (t <= keys[i][0]) {
      const [t0, p0, h0] = keys[i - 1]; const [t1, p1, h1] = keys[i];
      const u = io(seg(t, t0, t1));
      return [t, p0.clone().lerp(p1, u), typeof h0 === 'number' ? lerpAngle(h0, h1, u) : h0];
    }
  }
  return keys.at(-1);
}

// ---------------------------------------------------------------- body channels (sums of shaped pulses)
function channels(t) {
  const c = { pitch: 0, roll: 0, crouch: 0, lift: 0, squash: 1, forward: 0 };
  for (const p of PICKUPS) {
    const k = pickupTimes(p);
    c.pitch += -0.18 * bump(t, k.start, k.nudge) + 0.46 * win(t, k.nudge, k.flick, 0.08, 0.06) - 0.42 * bump(t, k.flick, k.land);
    c.forward += -0.05 * bump(t, k.start, k.nudge) + 0.1 * win(t, k.nudge, k.flick, 0.1, 0.12);
    c.crouch += 0.55 * win(t, k.crouch, k.flick + 0.04, 0.12, 0.05);
    c.squash *= 1 + 0.13 * bump(t, k.flick - 0.02, k.flick + 0.22) - 0.17 * bump(t, k.land, k.end);
    c.pitch += 0.12 * ring(t, k.land, 13, 6);
  }
  for (const { t: t0 } of INSERTS) {
    const k = insertTimes(t0);
    c.crouch += 0.4 * win(t, k.start, k.toss + 0.03, 0.15, 0.05);
    c.pitch += -0.16 * bump(t, k.start, k.toss) + 0.48 * bump(t, k.toss, k.end + 0.2);
    c.squash *= 1 + 0.1 * bump(t, k.toss, k.toss + 0.2);
  }
  // Bonk and startle.
  c.squash *= 1 - 0.24 * bump(t, SPIT.land, SPIT.land + 0.24);
  c.lift += 0.26 * bump(t, SPIT.land + 0.05, SPIT.land + 0.38);
  c.pitch += -0.22 * win(t, SPIT.land + 0.05, 11.9, 0.1, 0.4);
  c.crouch += 0.35 * win(t, SPIT.land + 0.35, 11.9, 0.15, 0.4);
  c.roll += 0.045 * win(t, 11.0, 11.8, 0.1) * Math.sin(t * 55);
  // Happy hops after an accept.
  for (const at of [15.7, 23.55, 29.15]) { c.lift += 0.18 * bump(t, at, at + 0.32); c.squash *= 1 - 0.1 * bump(t, at + 0.3, at + 0.46); }
  // The final jump.
  c.crouch += 0.75 * win(t, JUMP.crouch, JUMP.take + 0.02, 0.25, 0.05);
  c.squash *= 1 - 0.12 * win(t, JUMP.crouch, JUMP.take, 0.25, 0.05) + 0.16 * bump(t, JUMP.take, JUMP.take + 0.3) - 0.22 * bump(t, JUMP.land, JUMP.settle);
  c.lift += 0.85 * Math.sin(Math.PI * seg(t, JUMP.take, JUMP.land)) * (t > JUMP.take && t < JUMP.land ? 1 : 0);
  c.pitch += -0.2 * bump(t, JUMP.take, JUMP.land);
  // Curious tilt, and leaning into starts and overshooting stops.
  c.roll += 0.26 * win(t, 2.3, 3.5, 0.3);
  c.pitch += 0.08 * win(t, 2.3, 3.5, 0.3);
  for (const s of WALK_STARTS) c.pitch += 0.09 * bump(t, s, s + 0.45);
  for (const s of WALK_STOPS) c.pitch += 0.13 * ring(t, s - 0.05, 12, 5.5);
  c.pitch += 0.02 * Math.sin(t * 1.9);
  return c;
}

// ---------------------------------------------------------------- face channels
function face(t) {
  const f = {
    happy: Math.max(win(t, 5.75, 8.1, 0.15), win(t, 15.7, 16.6, 0.12), win(t, 20.65, 22.2), win(t, 23.55, 24.4), win(t, 26.35, 27.9), win(t, 29.15, LOOP - 0.2, 0.12)),
    scared: win(t, SPIT.land - 0.02, 12.05, 0.06, 0.3),
    curious: Math.max(win(t, 2.25, 3.55, 0.2), win(t, 18.5, 19.25, 0.15)),
    focus: Math.max(...[...PICKUPS.map((p) => win(t, p.t, pickupTimes(p).land, 0.1)), ...INSERTS.map(({ t: s }) => win(t, s, s + 0.7, 0.1))]),
    surprise: win(t, 1.5, 2.15, 0.06, 0.3),
  };
  const lookKeys = [
    [0, 0, 0], [0.7, 0.15, 0.85], [1.5, 0.15, 0.85], [1.9, 0.25, -0.75], [3.4, 0.3, -0.8], [4.2, 0, -0.9], [5.6, 0, -0.9],
    [5.9, 0, 0.75], [6.3, 0, 0.75], [6.6, -0.5, 0.1], [8.1, 0, 0.2], [8.4, 0, 0.6], [10.4, 0, 0.75], [10.7, 0, 0.0],
    [11.8, 0, 0.0], [12.1, 0, 0.8], [12.5, 0.85, 0.15], [14.1, 0, 0.2], [15.3, 0, 0.65], [16.4, 0, 0], [17.5, 0, 0.1],
    [17.6, -0.4, 0.85], [17.95, -0.5, 0.45], [18.3, -0.6, -0.7], [18.8, 0.25, 0.85], [19.45, 0.55, 0.45],
    [19.7, 0.6, -0.6], [19.9, -0.1, -0.85], [20.5, 0, -0.8],
    [20.8, 0, 0.6], [21.2, -0.4, 0.1], [22.3, 0, 0.6], [23.6, 0, 0.6], [23.9, 0.5, -0.2], [25.4, 0, -0.85],
    [26.5, 0, 0.6], [26.8, 0.4, 0.1], [27.9, 0, 0.6], [29.3, 0, 0.6], [29.6, 0, 0], [LOOP, 0, 0],
  ];
  let k = 1; while (k < lookKeys.length - 1 && lookKeys[k][0] < t) k += 1;
  const [t0, x0, y0] = lookKeys[k - 1]; const [t1, x1, y1] = lookKeys[k];
  const u = io(seg(t, t0, Math.min(t1, t0 + 0.35)));
  f.lookX = lerp(x0, x1, u); f.lookY = lerp(y0, y1, u);
  // Blinks: a slow periodic one, plus deliberate blinks on beats (after noticing, deciding, recovering).
  const blinkAt = (t0) => (t > t0 && t < t0 + 0.16 ? Math.abs((t - t0) / 0.08 - 1) : 1);
  const periodic = blinkAt(t - ((t + 0.7) % 3.4));
  const beats = Math.min(...[3.6, 8.25, 12.45, 17.35, 25.45].map(blinkAt));
  f.blink = f.scared < 0.2 && f.happy < 0.5 ? Math.min(periodic, beats) : 1;
  return f;
}

// ---------------------------------------------------------------- precomputed walking tables
const DT = 1 / 120;
const N = Math.ceil(LOOP / DT) + 1;
const TABLE = { x: new Float32Array(N), z: new Float32Array(N), h: new Float32Array(N), g: new Float32Array(N), w: new Float32Array(N) };
function basePose(t) {
  const [, p, h] = keyed(BASE_KEYS, t);
  return { x: p.x, z: p.z, h };
}
(() => {
  let previous = basePose(0); let g = 0; const speed = new Float32Array(N);
  for (let i = 0; i < N; i += 1) {
    const p = basePose(i * DT);
    const step = Math.hypot(p.x - previous.x, p.z - previous.z) + Math.abs(lerpAngle(0, p.h - previous.h, 1)) * 0.3;
    g += step;
    TABLE.x[i] = p.x; TABLE.z[i] = p.z; TABLE.h[i] = p.h; TABLE.g[i] = g;
    speed[i] = step / DT;
    previous = p;
  }
  // Zero-phase smoothing so legs start stepping slightly before the body moves and settle after.
  const a = DT / 0.14; const s = Float32Array.from(speed);
  for (let i = 1; i < N; i += 1) s[i] = s[i - 1] + a * (s[i] - s[i - 1]);
  for (let i = N - 2; i >= 0; i -= 1) s[i] = s[i + 1] + a * (s[i] - s[i + 1]);
  for (let i = 0; i < N; i += 1) TABLE.w[i] = clamp01(s[i] / 0.35);
})();
const sample = (array, t) => { const f = clamp(t / DT, 0, N - 1); const i = Math.floor(f); const j = Math.min(N - 1, i + 1); return lerp(array[i], array[j], f - i); };
const sampleAngle = (t) => { const f = clamp(t / DT, 0, N - 1); const i = Math.floor(f); const j = Math.min(N - 1, i + 1); return lerpAngle(TABLE.h[i], TABLE.h[j], f - i); };
function poseAtG(g) {
  let lo = 0; let hi = N - 1;
  if (g <= TABLE.g[0]) return { x: TABLE.x[0], z: TABLE.z[0], h: TABLE.h[0] };
  if (g >= TABLE.g[hi]) return { x: TABLE.x[hi], z: TABLE.z[hi], h: TABLE.h[hi] };
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (TABLE.g[mid] < g) lo = mid; else hi = mid; }
  const span = TABLE.g[hi] - TABLE.g[lo]; const u = span > 1e-6 ? (g - TABLE.g[lo]) / span : 0;
  return { x: lerp(TABLE.x[lo], TABLE.x[hi], u), z: lerp(TABLE.z[lo], TABLE.z[hi], u), h: lerpAngle(TABLE.h[lo], TABLE.h[hi], u) };
}

// ---------------------------------------------------------------- materials and geometry helpers
const physical = (color, roughness, extra = {}) => new MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3, ...extra });
const SHELL = physical(0xf4f4f4, 0.36, { sheen: 0.4, sheenRoughness: 0.6, sheenColor: new Color(0xffffff) });
const SOFT = physical(0xd8d8d8, 0.45);
const INK = physical(0x171717, 0.35, { clearcoat: 0.6 });
// Screens are emissive panels: they stay black from every angle; the bezel carries the form.
const SCREEN = new MeshBasicMaterial({ color: 0x0b0b0b, toneMapped: false });
const SHAPE = new MeshStandardMaterial({ color: 0x232323, roughness: 0.74, metalness: 0, envMapIntensity: 0.55 });
const LEG = physical(0xffffff, 0.36, { vertexColors: true, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new Color(0xffffff) });
const SKIN = new MeshStandardMaterial({ color: 0xdedede, roughness: 0.6, envMapIntensity: 0.7 });
const glow = (color = 0xffffff, opacity = 1) => new MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });

function panel(w, h, depth, r, material) {
  const s = new Shape(); const x = -w / 2; const y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const bevel = Math.min(0.012, depth / 3);
  const geometry = new ExtrudeGeometry(s, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  geometry.translate(0, 0, -(depth - 2 * bevel) / 2);
  return new Mesh(geometry, material);
}
function taperedTube(points, radiusAt, colorAt = () => 0xffffff, tubular = 40, radial = 18) {
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const geometry = new TubeGeometry(curve, tubular, 1, radial, false);
  const position = geometry.attributes.position; const colors = new Float32Array(position.count * 3);
  const color = new Color(); const point = new Vector3();
  for (let i = 0; i <= tubular; i += 1) {
    const u = i / tubular; const center = curve.getPointAt(u); const radius = radiusAt(u); color.set(colorAt(u));
    for (let j = 0; j <= radial; j += 1) {
      const index = i * (radial + 1) + j;
      point.fromBufferAttribute(position, index).sub(center).multiplyScalar(radius).add(center);
      position.setXYZ(index, point.x, point.y, point.z);
      colors.set([color.r, color.g, color.b], index * 3);
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
function iconShape(kind, size, material = glow()) {
  const shape = new Shape();
  if (kind === 'pyramid') { shape.moveTo(0, size * 0.6); shape.lineTo(size * 0.55, -size * 0.38); shape.lineTo(-size * 0.55, -size * 0.38); shape.closePath(); }
  else { const s = size * 0.46; shape.moveTo(-s, -s); shape.lineTo(s, -s); shape.lineTo(s, s); shape.lineTo(-s, s); shape.closePath(); }
  return new Mesh(new ShapeGeometry(shape), material);
}
function strokes(list, width = 0.05) {
  const group = new Group();
  for (const [ax, ay, bx, by] of list) {
    const length = Math.hypot(bx - ax, by - ay);
    const stroke = new Mesh(new RoundedBoxGeometry(length + width, width, 0.01, 2, width * 0.45), glow());
    stroke.position.set((ax + bx) / 2, (ay + by) / 2, 0); stroke.rotation.z = Math.atan2(by - ay, bx - ax);
    group.add(stroke);
  }
  return group;
}
const shadowed = (object) => { object.traverse((child) => { if (child.isMesh) child.castShadow = true; }); return object; };

// ---------------------------------------------------------------- Bean
// From Dushyant's drawing: a squat, wide body with generously rounded edges. Seen from
// the front it narrows slightly towards the bottom; from the side it is loaf-shaped,
// with a flatter top. The face is a goggle-shaped visor with a nose notch.
const BODY = [0.46, 0.23, 0.34]; // half-extents
const HEIGHT = 0.55;
const L1 = 0.36; const L2 = 0.62; const LEG_R = 0.07;
const STEP = 0.52; const STANCE = 0.62; const LIFT = 0.13;
const LEGS = [[-1, 1, 0], [1, 1, 0.5], [-1, -1, 0.5], [1, -1, 0]].map(([sx, sz, off]) => ({ sx, sz, off, hip: v(sx * BODY[0] * 0.92, BODY[1] * 0.3, sz * BODY[2] * 0.5), rest: v(sx * 0.66, 0, sz * 0.44) }));
const EXP = 3.6; // superellipse exponent: higher is boxier
const TAPER = 0.13; // how much narrower the bottom is than the top

// The body surface: a superellipsoid, tapered towards the bottom, its top flattened a touch.
const bodyX = (y) => BODY[0] * (1 - TAPER * clamp01((BODY[1] - y) / (2 * BODY[1])));
function frontZ(x, y) {
  const u = Math.abs(x) / bodyX(y); const w = Math.abs(y) / BODY[1];
  return BODY[2] * Math.max(0, 1 - u ** EXP - w ** EXP) ** (1 / EXP);
}
function bodyGeometry() {
  const geometry = new SphereGeometry(1, 96, 64);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const top = new Color(0xffffff); const under = new Color(0xcfcfcf); const color = new Color();
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i); const y = position.getY(i); const z = position.getZ(i);
    const s = (Math.abs(x) ** EXP + Math.abs(y) ** EXP + Math.abs(z) ** EXP) ** (1 / EXP);
    const py = (y / s) * BODY[1];
    position.setXYZ(i, (x / s) * bodyX(py), py, (z / s) * BODY[2]);
    color.copy(top).lerp(under, smooth(clamp01((-py / BODY[1] - 0.35) / 0.6)));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
const BODY_SHELL = physical(0xffffff, 0.36, { vertexColors: true, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new Color(0xffffff) });

// The goggle outline in face coordinates: a flat top, rounded outer corners and two lobes
// separated by a nose notch at the bottom.
const GOGGLE = { w: 0.64, h: 0.25, y: 0.03 };
function goggleShape(grow = 0) {
  const W = GOGGLE.w / 2 + grow; const H = GOGGLE.h / 2 + grow; const r = 0.07 + grow;
  const notchW = 0.075 - grow * 0.6; const notchH = 0.065 - grow * 0.4; const lobe = 0.095 + grow;
  const s = new Shape();
  s.moveTo(-W + r, H); s.lineTo(W - r, H); s.quadraticCurveTo(W, H, W, H - r);
  s.lineTo(W, -H + lobe); s.quadraticCurveTo(W, -H, W - lobe, -H);
  s.lineTo(notchW + 0.035, -H); s.quadraticCurveTo(notchW, -H, notchW, -H + notchH * 0.6);
  s.quadraticCurveTo(notchW * 0.6, -H + notchH, 0, -H + notchH);
  s.quadraticCurveTo(-notchW * 0.6, -H + notchH, -notchW, -H + notchH * 0.6);
  s.quadraticCurveTo(-notchW, -H, -notchW - 0.035, -H);
  s.lineTo(-W + lobe, -H); s.quadraticCurveTo(-W, -H, -W, -H + lobe);
  s.lineTo(-W, H - r); s.quadraticCurveTo(-W, H, -W + r, H);
  return s;
}
// A finely subdivided panel bent onto the body's front surface (raised by `lift`) and cut
// to `shape` with an alpha mask, so the curved face stays smooth and the outline crisp.
function conformedPanel(shape, lift, material) {
  const points = shape.getPoints(48);
  const xs = points.map((p) => p.x); const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - 0.01; const maxX = Math.max(...xs) + 0.01;
  const minY = Math.min(...ys) - 0.01; const maxY = Math.max(...ys) + 0.01;
  const w = maxX - minX; const h = maxY - minY;
  const geometry = new PlaneGeometry(w, h, 128, 48);
  geometry.translate(minX + w / 2, minY + h / 2, 0);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i); const y = position.getY(i) + GOGGLE.y;
    position.setXYZ(i, x, y, frontZ(x, y) + lift);
  }
  geometry.computeVertexNormals();
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = Math.round((1024 * h) / w);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff'; ctx.beginPath();
  points.forEach((p, i) => {
    const cx = ((p.x - minX) / w) * canvas.width; const cy = ((maxY - p.y) / h) * canvas.height;
    if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
  });
  ctx.closePath(); ctx.fill();
  const masked = material.clone();
  masked.alphaMap = new CanvasTexture(canvas); masked.alphaTest = 0.5;
  return new Mesh(geometry, masked);
}
const Z_AXIS = v(0, 0, 1);
function frontFrame(px, py, lift) {
  const y = py + GOGGLE.y; const e = 0.004;
  const point = v(px, y, frontZ(px, y) + lift);
  const normal = v(-(frontZ(px + e, y) - frontZ(px - e, y)) / (2 * e), -(frontZ(px, y + e) - frontZ(px, y - e)) / (2 * e), 1).normalize();
  return { point, normal };
}

function buildBean(scene) {
  const root = new Group(); const rig = new Group(); root.add(rig);
  rig.add(new Mesh(bodyGeometry(), BODY_SHELL));
  const faceGroup = new Group(); rig.add(faceGroup);
  faceGroup.add(conformedPanel(goggleShape(0.024), 0.005, SOFT), conformedPanel(goggleShape(), 0.011, SCREEN));
  const flat = false;
  const eyes = [-1, 1].map((side) => {
    const eye = new Mesh(new CircleGeometry(1, 40), glow());
    const pupil = new Mesh(new CircleGeometry(1, 24), glow(0x0a0a0a));
    const arc = new Mesh(new TorusGeometry(0.05, 0.016, 8, 24, Math.PI), glow());
    faceGroup.add(eye, pupil, arc);
    return { side, eye, pupil, arc };
  });
  const smile = new Mesh(new TubeGeometry(new CatmullRomCurve3([v(-0.06, 0.015, 0), v(-0.03, -0.015, 0), v(0.03, -0.015, 0), v(0.06, 0.015, 0)]), 24, 0.012, 8), glow());
  faceGroup.add(smile);
  // Place a face element at face coordinates (px, py), on the flat panel or the curved visor.
  const place = (mesh, px, py, lift) => {
    const { point, normal } = frontFrame(px, py, 0.014 + lift);
    mesh.position.copy(point); mesh.quaternion.setFromUnitVectors(Z_AXIS, normal);
  };
  shadowed(rig); faceGroup.traverse((child) => { child.castShadow = false; });
  scene.add(root);

  const thighGeometry = taperedTube([v(0, 0, 0), v(0.035, L1 * 0.5, 0), v(0, L1, 0)], (u) => LEG_R * (1.05 - 0.12 * u), undefined, 16, 18);
  const dark = new Color(0x1a1a1a); const white = new Color(0xffffff);
  const shinGeometry = taperedTube([v(0, 0, 0), v(0.1, -L2 * 0.3, 0), v(0.07, -L2 * 0.72, 0), v(0, -L2, 0)],
    (u) => LEG_R * (1 - 0.94 * u ** 0.85) + 0.004,
    (u) => (u < 0.8 ? white : u < 0.86 ? white.clone().lerp(dark, (u - 0.8) / 0.06) : dark), 44, 18);
  const legs = LEGS.map((spec) => {
    const thigh = new Mesh(thighGeometry, LEG); const shin = new Mesh(shinGeometry, LEG);
    const knee = new Mesh(new SphereGeometry(LEG_R * 1.02, 20, 14), SHELL); const hip = new Mesh(new SphereGeometry(LEG_R * 1.12, 20, 14), SOFT);
    for (const mesh of [thigh, shin]) { mesh.matrixAutoUpdate = false; }
    [thigh, shin, knee, hip].forEach((mesh) => { mesh.castShadow = true; scene.add(mesh); });
    return { ...spec, thigh, shin, knee, hipBall: hip };
  });
  return { root, rig, faceGroup, eyes, smile, legs, place, flat };
}

const basis = new Matrix4();
function orient(mesh, origin, yAxis, outward) {
  const y = yAxis.clone().normalize();
  const x = outward.clone().addScaledVector(y, -outward.dot(y)).normalize();
  const zAxis = x.clone().cross(y);
  mesh.matrix.copy(basis.makeBasis(x, y, zAxis)).setPosition(origin);
  mesh.matrixWorldNeedsUpdate = true;
}
function solveKnee(hip, foot, out) {
  const dir = foot.clone().sub(hip);
  const d = clamp(dir.length(), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.005);
  dir.normalize();
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d); const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const bend = UP.clone().addScaledVector(out, 0.55); bend.addScaledVector(dir, -bend.dot(dir)).normalize();
  return { knee: hip.clone().addScaledVector(dir, a).addScaledVector(bend, h), foot: hip.clone().addScaledVector(dir, d) };
}
const restFoot = (leg, pose) => leg.rest.clone().applyAxisAngle(UP, pose.h).add(v(pose.x, 0, pose.z));

function poseBean(bean, t) {
  const c = channels(t);
  const g = sample(TABLE.g, t); const w = sample(TABLE.w, t);
  const pose = { x: sample(TABLE.x, t), z: sample(TABLE.z, t), h: sampleAngle(t) };
  const gait = g / STEP;
  const bob = 0.022 * w * (1 - Math.cos(gait * 2 * TAU)) / 2;
  const height = HEIGHT * (1 - 0.3 * c.crouch) + c.lift - bob;
  // Leaning forward moves the body, not the planted feet.
  bean.root.position.set(pose.x + Math.sin(pose.h) * c.forward, height, pose.z + Math.cos(pose.h) * c.forward);
  bean.root.rotation.set(0, pose.h, 0);
  bean.rig.rotation.set(c.pitch, 0, c.roll + 0.05 * w * Math.sin(gait * TAU));
  bean.rig.scale.set(1 / Math.sqrt(c.squash), c.squash, 1 / Math.sqrt(c.squash));
  bean.root.updateMatrixWorld(true);

  const air = clamp01(c.lift / 0.3);
  const center = v(pose.x, 0, pose.z);
  const obstacles = groundShapes(t);
  for (const leg of bean.legs) {
    const phase = gait + leg.off; const n = Math.floor(phase); const u = phase - n;
    const plant = (m) => restFoot(leg, poseAtG((m + STANCE / 2 - leg.off) * STEP));
    let foot;
    if (u < STANCE) foot = plant(n);
    else { const s = (u - STANCE) / (1 - STANCE); foot = plant(n).lerp(plant(n + 1), io(s)); foot.y = LIFT * Math.sin(Math.PI * s); }
    foot = restFoot(leg, pose).lerp(foot, w);
    // Step around any shape lying on the floor rather than through it.
    for (const o of obstacles) {
      const dx = foot.x - o.x; const dz = foot.z - o.z; const d = Math.hypot(dx, dz); const reach = o.r + 0.09;
      if (d < reach) { const k = (reach - Math.max(d, 1e-3)) / Math.max(d, 1e-3); foot.x += dx * k; foot.z += dz * k; }
    }
    // In the air, feet tuck up towards the body.
    const tucked = restFoot(leg, pose).lerp(center, 0.32); tucked.y = height - 0.48;
    foot.lerp(tucked, air);
    const hip = bean.rig.localToWorld(leg.hip.clone());
    const outDir = foot.clone().sub(center).setY(0).normalize();
    const { knee, foot: reached } = solveKnee(hip, foot, outDir);
    orient(leg.thigh, hip, knee.clone().sub(hip), outDir);
    orient(leg.shin, knee, knee.clone().sub(reached), outDir);
    leg.knee.position.copy(knee); leg.hipBall.position.copy(hip);
  }

  const f = face(t);
  const base = [0.05, 0.06];
  for (const e of bean.eyes) {
    const curiousScale = e.side < 0 ? 1.3 : 0.78;
    const grow = 1 + 0.28 * f.scared + 0.18 * f.surprise;
    const sx = base[0] * grow * lerp(1, curiousScale, f.curious);
    const open = Math.max(0.04, f.blink * (1 - f.happy) * (1 - 0.42 * f.focus));
    const sy = base[1] * grow * lerp(1, curiousScale, f.curious) * open;
    const px = e.side * 0.15 + f.lookX * 0.04; const py = 0.01 + f.lookY * 0.032 - 0.012 * f.focus;
    const k = bean.flat ? 0.72 : 1;
    e.eye.scale.set(sx * k, sy * k, 1); bean.place(e.eye, px, py, 0.004); e.eye.visible = open > 0.05;
    const pupil = 0.02 * f.scared * k;
    e.pupil.scale.set(Math.max(1e-3, pupil), Math.max(1e-3, pupil * Math.min(1, open * 1.5)), 1); bean.place(e.pupil, px, py, 0.007); e.pupil.visible = pupil > 0.002;
    e.arc.scale.setScalar(Math.max(1e-3, f.happy * k * 0.78)); bean.place(e.arc, px, py - 0.01, 0.004); e.arc.visible = f.happy > 0.02;
  }
  bean.smile.scale.set(0.8, Math.max(1e-3, f.happy * 0.8), 1); bean.place(bean.smile, f.lookX * 0.03, -0.04 + f.lookY * 0.015, 0.004); bean.smile.visible = f.happy > 0.02;
  return { pose, c };
}
const headTop = (bean, half) => bean.rig.localToWorld(v(0, BODY[1] + half - 0.008, -0.02));

// ---------------------------------------------------------------- machines, hand, props
function buildMachine(scene, kind) {
  const m = MACHINES[kind];
  const group = new Group(); const body = new Group(); group.add(body);
  const cabinet = new Mesh(new RoundedBoxGeometry(1.0, 1.85, 0.8, 5, 0.18), SHELL); cabinet.position.y = 0.925; cabinet.receiveShadow = true;
  const display = panel(0.64, 0.48, 0.04, 0.11, SCREEN); display.position.set(0, 1.45, 0.41);
  const icon = iconShape(kind, 0.3); icon.position.set(0, 1.45, 0.432);
  const tick = strokes([[-0.11, 0.02, -0.03, -0.06], [-0.03, -0.06, 0.12, 0.11]]);
  const cross = strokes([[-0.1, -0.1, 0.1, 0.1], [-0.1, 0.1, 0.1, -0.1]]);
  for (const mark of [tick, cross]) { mark.position.set(0, 1.45, 0.432); }
  const mouth = panel(0.5, 0.3, 0.04, 0.09, SCREEN); mouth.position.set(0, 0.88, 0.41);
  const hint = iconShape(kind, 0.14, glow(0x5a5a5a)); hint.position.set(0, 0.88, 0.432);
  const lip = new Mesh(new RoundedBoxGeometry(0.56, 0.05, 0.16, 2, 0.02), SOFT); lip.position.set(0, 0.72, 0.46); lip.rotation.x = 0.25;
  const stalk = new Mesh(new CylinderGeometry(0.02, 0.02, 0.18, 10), INK); stalk.position.y = 1.94;
  const lamp = new Mesh(new SphereGeometry(0.075, 20, 14), SOFT); lamp.position.y = 2.06;
  const lampGlow = new Mesh(new SphereGeometry(0.075, 20, 14), glow(0xffffff, 1)); lampGlow.position.y = 2.06;
  const feet = [-0.38, 0.38].map((fx) => { const foot = new Mesh(new RoundedBoxGeometry(0.22, 0.06, 0.7, 2, 0.02), INK); foot.position.set(fx, 0.03, 0); return foot; });
  body.add(cabinet, display, icon, tick, cross, mouth, hint, lip, stalk, lamp, lampGlow);
  group.add(...feet);
  shadowed(group);
  group.position.set(m.x, 0, m.z); group.rotation.y = m.ry; group.scale.setScalar(MACHINE_SCALE);
  scene.add(group);
  return { kind, group, body, icon, tick, cross, lamp, lampGlow, mouth: () => group.localToWorld(v(0, 0.88, 0.46)) };
}
function poseMachine(machine, t) {
  const schedule = VERDICTS[machine.kind];
  let icon = 1; let tick = 0; let cross = 0; let lamp = 0; let shake = 0; let gulp = 0;
  for (const s of schedule) {
    if (t >= s.busy[0] && t < s.at) icon = 0.75 + 0.25 * Math.round((Math.sin((t - s.busy[0]) * 22) + 1) / 2);
    if (t >= s.at && t < s.until) {
      icon = 0; const pop = back(seg(t, s.at, s.at + 0.3)) * (1 - smooth(seg(t, s.until - 0.3, s.until)));
      if (s.verdict === 'ok') { tick = pop; lamp = pop * (0.75 + 0.25 * Math.sin(t * 6)); } else { cross = pop; }
    }
    if (t >= s.until - 0.3 && t < s.until) icon = Math.max(icon, smooth(seg(t, s.until - 0.3, s.until)));
    if (s.verdict === 'error') shake += 0.06 * ring(t, s.at, 42, 7, 0.6);
    gulp += bump(t, s.busy[0] - 0.02, s.busy[0] + 0.28);
  }
  machine.icon.scale.setScalar(Math.max(1e-3, icon)); machine.icon.visible = icon > 0.01;
  machine.tick.scale.setScalar(Math.max(1e-3, tick)); machine.tick.visible = tick > 0.01;
  machine.cross.scale.setScalar(Math.max(1e-3, cross)); machine.cross.visible = cross > 0.01;
  machine.lampGlow.visible = lamp > 0.01; machine.lampGlow.scale.setScalar(1 + 0.25 * lamp);
  machine.lamp.material = cross > 0.01 ? INK : SOFT;
  machine.body.rotation.z = shake;
  machine.body.scale.set(1 + 0.04 * gulp, 1 - 0.05 * gulp, 1 + 0.04 * gulp);
}

function buildHand(scene) {
  const group = new Group();
  const sleeve = new Mesh(new CylinderGeometry(0.24, 0.26, 3, 28), new MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 })); sleeve.position.y = 1.85;
  const cuff = new Mesh(new TorusGeometry(0.245, 0.04, 10, 32), new MeshStandardMaterial({ color: 0x3b3b3b, roughness: 0.8 })); cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.36;
  const palm = new Mesh(new RoundedBoxGeometry(0.52, 0.44, 0.22, 4, 0.1), SKIN); palm.position.y = 0.12;
  const fingers = [-0.18, -0.06, 0.06, 0.18].map((fx, i) => {
    const pivot = new Group(); pivot.position.set(fx, -0.08, 0);
    const finger = new Mesh(new CapsuleGeometry(0.052, 0.2 + (i === 1 || i === 2 ? 0.04 : 0), 6, 12), SKIN); finger.position.y = -0.14;
    pivot.add(finger); return pivot;
  });
  const thumb = new Mesh(new CapsuleGeometry(0.055, 0.16, 6, 12), SKIN); thumb.position.set(-0.3, -0.02, 0.06); thumb.rotation.z = -0.7;
  group.add(sleeve, cuff, palm, ...fingers, thumb);
  shadowed(group); scene.add(group);
  return { group, fingers };
}
function poseHand(hand, t) {
  const [, p, open] = keyed(HAND, t);
  hand.group.position.copy(p);
  hand.group.rotation.set(0.12 * Math.sin(t * 1.3), 0, 0.05 * Math.sin(t * 0.9));
  hand.fingers.forEach((finger, i) => { finger.rotation.x = lerp(0.45, -0.35, open) + 0.04 * Math.sin(t * 3 + i); });
  hand.group.visible = p.y < 4.6;
  return p;
}
function cube() { const mesh = new Mesh(new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 4, 0.05), SHAPE); mesh.castShadow = true; return mesh; }
function pyramid() {
  const geometry = new ConeGeometry(0.27, PYR_H, 4, 1); geometry.rotateY(Math.PI / 4);
  const mesh = new Mesh(geometry, SHAPE); mesh.castShadow = true; return mesh;
}
function mark(kind) {
  const group = new Group(); const material = INK;
  if (kind === '?') {
    group.add(new Mesh(new TubeGeometry(new CatmullRomCurve3([v(-0.07, 0.1, 0), v(-0.05, 0.17, 0), v(0.01, 0.2, 0), v(0.07, 0.16, 0), v(0.07, 0.09, 0), v(0.01, 0.04, 0), v(0, -0.03, 0)]), 32, 0.024, 8), material));
  } else {
    const bar = new Mesh(new CapsuleGeometry(0.028, 0.15, 4, 10), material); bar.position.y = 0.07; group.add(bar);
  }
  const dot = new Mesh(new SphereGeometry(0.03, 12, 8), material); dot.position.y = -0.11; group.add(dot);
  return group;
}

// ---------------------------------------------------------------- the shapes' journeys
// Each shape's state at time t: where it is, how it's rotated, how big it is.
function shapePlan(id) {
  if (id === 'cube1') return { size: CUBE_SIZE / 2, drop: DROP1, release: RELEASE1, holdFrom: 0, handOffset: v(0, -0.47, 0), yaw: 0.35, pickup: PICKUPS[0], inserts: [INSERTS[0], INSERTS[1]], spit: true };
  if (id === 'pyramid') return { size: PYR_H / 2, drop: DROP_P, release: RELEASE_P, holdFrom: 17.0, handOffset: v(0, -0.5, 0), yaw: 0.2, pickup: PICKUPS[1], inserts: [INSERTS[2]] };
  return { size: CUBE_SIZE / 2, drop: DROP_C, release: RELEASE_C, holdFrom: 18.86, handOffset: v(0, -0.47, 0), yaw: -0.3, pickup: PICKUPS[2], inserts: [INSERTS[3]] };
}
// A released shape falls freely from where the hand let go.
function fallTime(plan) {
  const height = keyed(HAND, plan.release)[1].y + plan.handOffset.y - plan.size;
  return Math.max(0.22, Math.sqrt((2 * height) / 9.8) * 1.15);
}
// Shapes lying on the floor at time t, as circles Bean's feet must stay out of.
function groundShapes(t) {
  const list = [];
  for (const id of ['cube1', 'pyramid', 'cube2']) {
    const plan = shapePlan(id);
    const landed = plan.release + fallTime(plan);
    if (t > landed - 0.12 && t < pickupTimes(plan.pickup).nudge + 0.05) list.push({ x: plan.drop.x, z: plan.drop.z, r: id === 'pyramid' ? 0.28 : 0.26 });
  }
  return list;
}
const yawQ = (a) => new Quaternion().setFromAxisAngle(UP, a);
function poseShape(plan, t, ctx) {
  const { bean, hand, machines } = ctx;
  const half = plan.size;
  const ground = plan.drop.clone().setY(half);
  const k = pickupTimes(plan.pickup);
  const right = v(1, 0, 0); // pickups happen facing the camera
  const first = plan.inserts[0]; const firstK = insertTimes(first.t);
  const last = plan.inserts.at(-1); const lastK = insertTimes(last.t);
  const handAt = (time) => keyed(HAND, time)[1].clone().add(plan.handOffset);
  const rigQ = () => bean.rig.getWorldQuaternion(new Quaternion());
  const onHead = () => {
    const p = headTop(bean, half);
    const q = rigQ().multiply(new Quaternion().setFromAxisAngle(v(0, 0, 1), ctx.wobble.roll)).multiply(new Quaternion().setFromAxisAngle(v(1, 0, 0), ctx.wobble.pitch));
    return { p, q, s: 1 };
  };
  const hidden = { p: ground, q: new Quaternion(), s: 0 };
  if (t < plan.holdFrom) return hidden;
  if (t < plan.release) return { p: handAt(t), q: yawQ(plan.yaw), s: 1 };
  if (t < k.nudge) {
    // Falls from the hand, lands with a squash and a small bounce.
    const from = handAt(plan.release); const fallEnd = plan.release + fallTime(plan);
    let y; let squash = 1;
    if (t < fallEnd) y = lerp(from.y, half, in2(seg(t, plan.release, fallEnd)));
    else { const u = seg(t, fallEnd, fallEnd + 0.24); y = half + 0.09 * Math.sin(Math.PI * u); squash = 1 - 0.22 * bump(t, fallEnd - 0.01, fallEnd + 0.1) - 0.08 * bump(t, fallEnd + 0.24, fallEnd + 0.32); }
    const p = from.clone().lerp(ground, seg(t, plan.release, fallEnd)); p.y = y - (1 - squash) * half;
    return { p, q: yawQ(plan.yaw + 0.25 * out3(seg(t, plan.release, fallEnd + 0.2))), s: 1, squash };
  }
  const yaw = plan.yaw + 0.25;
  const pivot = ground.clone().add(v(0, -half, half));
  const tiltAt = (time) => 0.62 * out3(seg(time, k.nudge, k.tiltEnd)) - 0.1 * bump(time, k.tiltEnd, k.flick);
  // Nudged from behind, the shape tips forward over its front-bottom edge.
  const tilted = (theta) => {
    const q = new Quaternion().setFromAxisAngle(right, theta);
    return { p: ground.clone().sub(pivot).applyQuaternion(q).add(pivot), q: q.multiply(yawQ(yaw)) };
  };
  if (t < k.flick) { const { p, q } = tilted(tiltAt(t)); return { p, q, s: 1 }; }
  if (t < k.land) {
    // The flick: an arc up and over onto the head, tumbling once.
    const theta0 = tiltAt(k.flick);
    const start = tilted(theta0); const target = headTop(bean, half);
    const u = io(seg(t, k.flick, k.land));
    const p = bezier(start.p, target, 0.85, u);
    // One backward tumble over the top, settling into the head's orientation as it lands.
    const spin = new Quaternion().setFromAxisAngle(right, theta0 - (TAU + theta0) * u).multiply(yawQ(yaw * (1 - u)));
    return { p, q: spin.slerp(onHead().q, smooth(seg(u, 0.7, 1))), s: 1 };
  }
  if (t < firstK.fly) return onHead();
  const mouthOf = (insert) => machines[insert.m].mouth();
  const toss = (insert, kk) => {
    const from = headTop(bean, half); const to = mouthOf(insert);
    const u = io(seg(t, kk.fly, kk.gulp));
    return { p: bezier(from, to, 0.55, u), q: rigQ().multiply(new Quaternion().setFromAxisAngle(v(1, 0, 0), 0.8 * u)), s: 1 - 0.3 * u };
  };
  if (t < firstK.gulp) return toss(first, firstK);
  if (plan.spit) {
    if (t < SPIT.start) return hidden;
    if (t < SPIT.land) {
      const u = seg(t, SPIT.start, SPIT.land);
      const p = bezier(machines.pyramid.mouth(), headTop(bean, half), 0.7, io(u));
      const tumble = new Quaternion().setFromAxisAngle(v(1, 0, 0.3).normalize(), TAU * u).multiply(rigQ());
      return { p, q: tumble.slerp(onHead().q, smooth(seg(u, 0.75, 1))), s: 0.7 + 0.3 * out3(u) };
    }
    if (t < lastK.fly) return onHead();
    if (t < lastK.gulp) return toss(last, lastK);
  }
  return hidden;
}

// ---------------------------------------------------------------- mount
export function mountSorter(root) {
  const canvas = root.querySelector('.gym-canvas');
  const caption = root.querySelector('.gym-caption');
  const chips = [...root.querySelectorAll('.gym-chips li')];
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { root.classList.add('gym-static'); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  scene.add(new HemisphereLight(0xffffff, 0xbdbdbd, 0.7));
  const key = new DirectionalLight(0xffffff, 2.1); key.position.set(-3, 7, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 22 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  const fill = new DirectionalLight(0xffffff, 0.45); fill.position.set(5, 3, 6);
  const rim = new DirectionalLight(0xffffff, 1.6); rim.position.set(2.5, 4, -6);
  scene.add(key, fill, rim);
  const floor = new Mesh(new CylinderGeometry(3.3, 3.3, 0.14, 96), new MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.85 }));
  floor.scale.set(1.2, 1, 0.82); floor.position.set(0, -0.07, -0.45); floor.receiveShadow = true;
  scene.add(floor);

  const bean = buildBean(scene);
  const machines = { pyramid: buildMachine(scene, 'pyramid'), cube: buildMachine(scene, 'cube') };
  const hand = buildHand(scene);
  const shapes = [['cube1', cube()], ['pyramid', pyramid()], ['cube2', cube()]].map(([id, mesh]) => { scene.add(mesh); return { plan: shapePlan(id), mesh }; });
  const question = mark('?'); const exclaim = mark('!'); scene.add(question, exclaim);
  const shocks = Array.from({ length: 5 }, () => { const s = new Mesh(new CapsuleGeometry(0.016, 0.12, 4, 8), INK); scene.add(s); return s; });
  scene.updateMatrixWorld(true);
  const confetti = Array.from({ length: 36 }, (_, i) => {
    const piece = new Mesh(new RoundedBoxGeometry(0.07, 0.07, 0.014, 1, 0.01), new MeshStandardMaterial({ color: [0x111111, 0x6a6a6a, 0xb5b5b5][i % 3], roughness: 0.7 }));
    piece.userData.seed = i + 1; scene.add(piece); return piece;
  });

  const camera = new PerspectiveCamera(27, 1, 0.1, 60);
  const camBase = v(0, 2.45, 7.2); const lookBase = v(0, 0.78, -0.4);
  let baseFov = 27;
  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const distance = camBase.distanceTo(lookBase);
    baseFov = Math.max(25, (2 * Math.atan(1.95 / (distance * camera.aspect)) * 180) / Math.PI);
    camera.fov = baseFov; camera.updateProjectionMatrix();
  }

  let shown = -1;
  function render(time) {
    const t = ((time % LOOP) + LOOP) % LOOP;
    const { pose, c } = poseBean(bean, t);
    for (const machine of Object.values(machines)) poseMachine(machine, t);
    poseHand(hand, t);

    // Camera: follows Bean a little and pushes in on the big moments.
    const push = 0.1 * win(t, 10.5, 12.3, 0.3, 0.5) + 0.08 * win(t, JUMP.crouch - 0.2, LOOP - 0.4, 0.4, 0.4);
    camera.position.set(camBase.x + 0.25 * pose.x, camBase.y - 0.15 * push, camBase.z);
    camera.lookAt(lookBase.x + 0.18 * pose.x, lookBase.y - 0.1 * push, lookBase.z);
    camera.zoom = 1 + push; camera.updateProjectionMatrix();


    // Whatever rides on Bean's head sways with its gait and rings after stops and landings.
    const g = sample(TABLE.g, t); const w = sample(TABLE.w, t);
    const wobble = {
      roll: 0.09 * w * Math.sin((g / STEP) * TAU) + 0.18 * c.roll,
      pitch: WALK_STOPS.reduce((sum, s) => sum + 0.16 * ring(t, s, 11, 4.5), 0) + WALK_STARTS.reduce((sum, s) => sum - 0.1 * ring(t, s + 0.1, 10, 5), 0)
        + PICKUPS.reduce((sum, p) => sum + 0.2 * ring(t, pickupTimes(p).land, 14, 6), 0) + 0.22 * ring(t, SPIT.land, 15, 5),
    };
    for (const shape of shapes) {
      const s = poseShape(shape.plan, t, { bean, hand, machines, wobble });
      shape.mesh.visible = s.s > 0.01;
      shape.mesh.position.copy(s.p); shape.mesh.quaternion.copy(s.q);
      const squash = s.squash ?? 1;
      shape.mesh.scale.set(s.s / Math.sqrt(squash), s.s * squash, s.s / Math.sqrt(squash));
    }

    // Thought marks and shock lines.
    const head = bean.root.position.clone().add(v(0, 0.75, 0));
    const pop = (group, a, b) => {
      const u = back(seg(t, a, a + 0.3)) * (1 - smooth(seg(t, b - 0.2, b)));
      group.visible = t > a && t < b;
      group.position.copy(head).add(v(0.28, 0.2 + 0.03 * Math.sin(t * 5), 0));
      group.quaternion.copy(camera.quaternion); group.rotateZ(0.12 * Math.sin(t * 4));
      group.scale.setScalar(Math.max(1e-3, u));
    };
    pop(question, 2.55, 3.6); pop(exclaim, 12.05, 12.75);
    const shock = win(t, SPIT.land, SPIT.land + 0.75, 0.05, 0.3);
    shocks.forEach((line, i) => {
      line.visible = shock > 0.01;
      const angle = -0.9 + i * 0.45; const r = 0.6 + 0.08 * Math.sin(t * 30 + i);
      line.position.copy(bean.root.position).add(v(Math.sin(angle) * r, 0.1 + Math.cos(angle) * r, 0.1));
      line.quaternion.copy(camera.quaternion); line.rotateZ(-angle);
      line.scale.setScalar(Math.max(1e-3, shock));
    });

    // Confetti when both are accepted.
    const burst = t - (JUMP.take + 0.1);
    confetti.forEach((piece) => {
      const s = piece.userData.seed; const from = s % 2 ? machines.pyramid : machines.cube;
      piece.visible = burst > 0 && burst < 1.9;
      if (!piece.visible) return;
      const origin = from.group.localToWorld(v(0, 1.75, 0.45));
      const angle = hash(s) * TAU; const speed = 0.5 + hash(s + 9) * 0.9; const vy = 1.5 + hash(s + 3) * 1.0;
      piece.position.set(origin.x + Math.cos(angle) * speed * burst, Math.max(0.02, origin.y + vy * burst - 3.3 * burst * burst), origin.z + Math.abs(Math.sin(angle)) * speed * burst);
      piece.rotation.set(burst * (4 + hash(s + 5) * 8), burst * 5, burst * (3 + hash(s + 7) * 6));
      piece.scale.setScalar(1 - seg(burst, 1.5, 1.9));
    });

    renderer.render(scene, camera);

    const index = CAPTIONS.findIndex(([until]) => t < until);
    if (index !== shown) {
      shown = index;
      const [, chip, text] = CAPTIONS[Math.max(0, index)];
      if (caption) {
        caption.textContent = text;
        caption.animate?.([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
      }
      chips.forEach((item, i) => item.classList.toggle('is-active', i === chip));
    }
  }

  let lastTime = 0;
  resize();
  new ResizeObserver(() => { resize(); render(lastTime); }).observe(canvas);
  // ?still renders one fixed frame (used by the site tests), as reduced motion does.
  const capture = new URLSearchParams(location.search).has('still');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  root.dataset.ready = 'true';
  // Stage labels jump to their moment in the current loop.
  chips.forEach((chip, index) => {
    chip.querySelector('button')?.addEventListener('click', () => {
      lastTime = Math.floor(lastTime / LOOP) * LOOP + CHIP_TIMES[index];
      render(lastTime);
    });
  });
  if (capture || reduced.matches) { lastTime = 31.9; render(lastTime); return render; }
  let visible = true; let previous = null;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(root);
  const frame = (now) => {
    if (previous !== null && visible && !document.hidden) { lastTime += Math.min(0.05, (now - previous) / 1000); render(lastTime); }
    previous = now; requestAnimationFrame(frame);
  };
  render(0); requestAnimationFrame(frame);
  return render;
}

const STAGES = ['Task', 'Attempt', 'Eval', 'Correct', 'Harder task'];
function boot() {
  const fallback = document.querySelector('.loop-art');
  if (!fallback) return;
  const host = document.createElement('div');
  host.className = 'gym-art';
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', 'Animation: a small robot agent is handed a cube, puts it in the pyramid machine and is rejected, corrects itself and gets it accepted, then sorts a pyramid and a cube correctly first time.');
  host.innerHTML = '<div class="loop-head"><span class="mini-label">THE RELIABILITY LOOP</span></div>'
    + '<div class="gym-stage"><canvas class="gym-canvas" aria-hidden="true"></canvas></div>'
    + '<p class="gym-caption" aria-hidden="true"></p>'
    + `<ol class="gym-chips" aria-label="Jump to a stage of the loop">${STAGES.map((name) => `<li><button type="button">${name}</button></li>`).join('')}</ol>`;
  fallback.after(host);
  let mounted = null;
  try { mounted = mountSorter(host); } catch (error) { console.warn('Hero animation unavailable', error); }
  if (mounted) fallback.hidden = true;
  else host.remove();
}
boot();
