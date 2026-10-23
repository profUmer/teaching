/*
 * bullet-lab.js - bullet hell patterns, for Game Math 1's Bullet Hell deck.
 *
 *   <div class="lab-mount" data-lab="bullets" data-pattern="radial"></div>
 *
 * An emitter near the top fires white dots in one of the patterns below, and
 * a red heart (Undertale's soul) starts at the bottom of the box. Click the
 * box and the arrow keys move it. A bullet that reaches the heart is gone.
 * data-pattern="composite" has no pattern of its own, but a button for each
 * of the others, which adds it to the box (or takes it out again).
 * Plain dots on purpose: the pattern is the maths, not the artwork.
 *
 * The patterns follow npaka's write-up of Shooting Game Algorithm Maniacs
 * (linked on the deck's first slide), whose one formula is
 *
 *   angle = base angle + i * even angle + sin(t) * fluctuation
 *
 * and most patterns here are that line with different terms switched on.
 *
 * This is the first lab that time-steps rather than recomputing on a drag:
 * runLoop calls frame() every animation frame while the slide is visible, and
 * frame() advances the simulation by the real time since the last one.
 *
 * A pattern is { rate, sliders, fire(S), info?(S), draw?(S), step?(S, dt),
 * busy?(S) }; while busy is true a firing that comes due waits.
 * rate is the slider for how many times a second fire runs, labelled for
 * what one firing is (a ring, a fan, a bullet). fire spawns bullets with
 * S.shoot; angles are radians, 0 = right, -PI/2 = straight down. S is the
 * pattern's layer: its slider values (o) and how many times it has fired
 * (shot), and through it the shared clock (time), bullets and heart.
 */

import { slider, button, runLoop, valuePanel, fmt } from './lab-core.js';
import { makeStage2D, disc, stroke, dashed, label } from './draw2d.js';

const DOWN = -Math.PI / 2;
const TAU = 2 * Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const whole = (v) => v.toFixed(0);
const one = (v) => v.toFixed(1);
const between = (lo, hi) => lo + Math.random() * (hi - lo);
/* θ in the readout, in a serif: the code font's θ reads as a slashed zero. */
const TH = '<i class="bl-theta">θ</i>';

const VIEW = 4;            // half-height of the box in world units
const EMITTER = [0, 2.6];
const HEART_Y = -3;
const BULLET_R = 0.09;
const HEART_R = 0.17;
const EMITTER_GREY = '#555';
const HEART_SPEED = 4;   // world units per second, while an arrow key is held

/* The direction from p to the heart, as an angle: atan2(dy, dx). */
const aimAt = (S, p = EMITTER) => Math.atan2(S.heart[1] - p[1], S.heart[0] - p[0]);

/* Angle `have` turned toward `want`, the shortest way round, by at most `max`. */
function turnToward(have, want, max) {
  const d = Math.atan2(Math.sin(want - have), Math.cos(want - have));
  return have + Math.max(-max, Math.min(max, d));
}

/* A ring of n evenly spaced angles, the first at `base`. */
const ring = (n, base = 0) => Array.from({ length: n }, (_, i) => base + (TAU * i) / n);

const PATTERNS = {
  /* A ring of n bullets, 360/n degrees apart. */
  radial: {
    sliders: [
      { key: 'n', label: 'Bullets per ring', min: 4, max: 40, step: 1, value: 16, format: whole },
    ],
    rate: { label: 'Rings per second', min: 0.2, max: 4, value: 1.2 },
    fire: (S) => ring(S.o.n).forEach((a) => S.shoot(a, 1.5)),
    info: (S) => [['Angle between bullets', `360° / ${S.o.n} = ${fmt(360 / S.o.n, 1)}°`]],
  },

  /* One bullet per shot per arm, the firing angle turning every shot. */
  spiral: {
    sliders: [
      { key: 'turn', label: 'Turn per shot (°)', min: 0, max: 60, step: 1, value: 17, format: whole },
      { key: 'arms', label: 'Arms', min: 1, max: 4, step: 1, value: 1, format: whole },
    ],
    rate: { label: 'Bullets per second', min: 2, max: 40, value: 16 },
    fire: (S) => ring(S.o.arms, rad(S.shot * S.o.turn)).forEach((a) => S.shoot(a, 1.8)),
    info: (S) => [['Angle', `shot × ${S.o.turn}°`]],
  },

  /* n bullets spread evenly across one arc, centred on straight down. */
  fan: {
    sliders: [
      { key: 'n', label: 'Bullets per fan', min: 2, max: 15, step: 1, value: 7, format: whole },
      { key: 'spread', label: 'Spread (°)', min: 10, max: 180, step: 1, value: 60, format: whole },
    ],
    rate: { label: 'Fans per second', min: 0.2, max: 4, value: 1.4 },
    fire: (S) => {
      for (let i = 0; i < S.o.n; i++) S.shoot(DOWN + rad(S.o.spread) * (i / (S.o.n - 1) - 0.5), 2);
    },
    info: (S) => [['Angle between bullets', `${S.o.spread}° / ${S.o.n - 1} = ${fmt(S.o.spread / (S.o.n - 1), 1)}°`]],
  },

  /* A stream aimed at where the heart is now - atan2 of the vector from the
     emitter to the heart - with an optional random scatter. */
  aimed: {
    sliders: [
      { key: 'scatter', label: 'Scatter (± °)', min: 0, max: 30, step: 1, value: 0, format: whole },
    ],
    rate: { label: 'Bullets per second', min: 1, max: 15, value: 4 },
    fire: (S) => {
      S.shoot(aimAt(S) + rad(between(-S.o.scatter, S.o.scatter)), 3);
    },
    draw: (S) => {
      S.ctx.strokeStyle = EMITTER_GREY;
      dashed(S.ctx, [EMITTER, S.heart], 0.02, 0.12);
    },
    info: (S) => {
      const dx = S.heart[0] - EMITTER[0], dy = S.heart[1] - EMITTER[1];
      return [['Angle', `atan2(${fmt(dy, 1)}, ${fmt(dx, 1)}) = ${fmt(deg(Math.atan2(dy, dx)), 1)}°`]];
    },
  },

  /* A curtain: whole rows of bullets, each bent into the same sine wave,
     y = row + A sin(2π x / wavelength), falling together at a steady speed -
     a wall to slip through rather than shots to dodge. A row's n bullets are
     spread evenly across the box, from a little past either side. */
  waves: {
    rate: { label: 'Rows per second', min: 0.2, max: 1, value: 0.6 },
    sliders: [
      { key: 'amp', label: 'Amplitude', min: 0, max: 0.8, step: 0.05, value: 0.3, format: (v) => v.toFixed(2) },
      { key: 'length', label: 'Wavelength', min: 1, max: 8, step: 0.5, value: 3, format: one },
      { key: 'n', label: 'Bullets per wave', min: 5, max: 60, step: 1, value: 33, format: whole },
    ],
    fire: (S) => {
      const k = TAU / S.o.length, edge = S.halfW + 0.5;
      for (let i = 0; i < S.o.n; i++) {
        const x = -edge + (2 * edge * i) / (S.o.n - 1);
        // start above the box, clear of the wave
        S.shoot(DOWN, 1, { from: [x, VIEW + 1 + S.o.amp * Math.sin(k * x)] });
      }
    },
    emitters: [],
    info: (S) => [['Each bullet', `y = row + ${S.o.amp.toFixed(2)} sin(2π x / ${one(S.o.length)})`]],
  },

  /* A lattice: rows of evenly spaced bullets marching in together. Rotate the
     direction they march and the grid turns into diamonds. */
  grids: {
    sliders: [
      { key: 'gap', label: 'Gap', min: 0.6, max: 2, step: 0.1, value: 1, format: one },
      { key: 'turn', label: 'Rotate (°)', min: 0, max: 45, step: 1, value: 0, format: whole },
    ],
    rate: { label: 'Rows per second', min: 0.3, max: 3, value: 1.2 },
    fire: (S) => {
      // fast enough that each row has moved one gap when the next arrives
      const speed = S.o.rate * S.o.gap;
      const a = DOWN + rad(S.o.turn);
      const d = [Math.cos(a), Math.sin(a)], side = [-d[1], d[0]];
      const R = VIEW + 1;   // start just outside the box, upstream
      const K = Math.ceil((S.halfW + VIEW) / S.o.gap);   // wide enough to cover the box at any angle
      for (let k = -K; k <= K; k++) {
        const from = [-d[0] * R + side[0] * k * S.o.gap, -d[1] * R + side[1] * k * S.o.gap];
        S.shoot(a, speed, { from });
      }
    },
    emitters: [],
    info: (S) => [['Row direction', `−90° + ${S.o.turn}°`]],
  },

  /* A flower: one ring, but each bullet's speed depends on its angle, so the
     ring stretches into petals: speed = base × (0.4 + 0.6 |cos(k θ / 2)|). */
  floral: {
    sliders: [
      { key: 'petals', label: 'Petals', min: 3, max: 8, step: 1, value: 5, format: whole },
      { key: 'n', label: 'Bullets per flower', min: 12, max: 120, step: 1, value: 72, format: whole },
      { key: 'spin', label: 'Turn per flower (°)', min: 0, max: 36, step: 1, value: 12, format: whole },
    ],
    rate: { label: 'Flowers per second', min: 0.2, max: 3, value: 0.7 },
    fire: (S) => {
      const base = rad(S.shot * S.o.spin);
      for (const a of ring(S.o.n, base)) {
        S.shoot(a, 1.6 * (0.4 + 0.6 * Math.abs(Math.cos((S.o.petals * (a - base)) / 2))));
      }
    },
    info: (S) => [['Speed', `1.6 × (0.4 + 0.6 |cos(${S.o.petals}${TH} / 2)|)`]],
  },

  /* A ring that appears around the heart - after a warning circle - and
     closes in on it, then out the other side. It has two gaps, right and
     left: the bullets cross over at the centre, so the far side's bullets
     come back out through the side you slipped out of, and only the gap
     opposite the first lets you past them too. */
  rings: {
    sliders: [
      { key: 'n', label: 'Bullets per ring', min: 12, max: 40, step: 1, value: 28, format: whole },
      { key: 'gap', label: 'Gap (bullets)', min: 0, max: 6, step: 1, value: 3, format: whole },
    ],
    rate: { label: 'Rings per second', min: 0.1, max: 1.5, value: 0.4 },
    fire: (S) => {
      const c = [...S.heart], R = 2.4;
      S.warn({ c, r: R }, 0.7, () => {
        for (const a of ring(S.o.n)) {
          // how many bullets round from the nearer gap, at 0° or 180°
          const off = Math.min(a % Math.PI, Math.PI - (a % Math.PI)) / (TAU / S.o.n);
          if (off < S.o.gap / 2 - 1e-9) continue;
          const dir = [Math.cos(a), Math.sin(a)];
          S.shoot(a + Math.PI, 1.4, { from: [c[0] + dir[0] * R, c[1] + dir[1] * R] });
        }
      });
    },
    emitters: [],
    info: () => [['Each bullet', `starts at centre + R(cos ${TH}, sin ${TH}), moves toward the centre`]],
  },

  /* A star traced out by bullets, each moving away from the centre at a speed
     proportional to its distance, so the star grows without changing shape.
     The n bullets are spaced evenly along its outline. */
  stars: {
    sliders: [
      { key: 'points', label: 'Points', min: 3, max: 8, step: 1, value: 5, format: whole },
      { key: 'inner', label: 'Inner radius', min: 0.2, max: 1, step: 0.05, value: 0.4, format: (v) => v.toFixed(2) },
      { key: 'n', label: 'Bullets per shape', min: 10, max: 120, step: 1, value: 60, format: whole },
    ],
    rate: { label: 'Stars per second', min: 0.2, max: 3, value: 0.7 },
    fire: (S) => {
      // vertices alternate outer (1) and inner radius, a point straight down;
      // inner = cos(180°/points) is a plain polygon
      const verts = ring(2 * S.o.points, DOWN).map((a, i) => {
        const r = i % 2 ? S.o.inner : 1;
        return [r * Math.cos(a), r * Math.sin(a)];
      });
      const edges = verts.map((p, i) => [p, verts[(i + 1) % verts.length]]);
      const lengths = edges.map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]));
      const gap = lengths.reduce((a, b) => a + b) / S.o.n;
      // walk round the outline, a bullet every `gap` along it
      let e = 0, along = 0;
      for (let j = 0; j < S.o.n; j++) {
        while (e < edges.length - 1 && along > lengths[e]) { along -= lengths[e]; e++; }
        const [p, q] = edges[e], t = along / lengths[e];
        const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
        S.shoot(Math.atan2(y, x), 1.7 * Math.hypot(x, y));
        along += gap;
      }
    },
    info: (S) => [['Vertices', `${2 * S.o.points}, alternating radius 1 and ${S.o.inner.toFixed(2)}`]],
  },

  /* Two spirals turning opposite ways, from either side, whose streams cross. */
  intersections: {
    sliders: [
      { key: 'turn', label: 'Turn per shot (°)', min: 2, max: 40, step: 1, value: 11, format: whole },
    ],
    rate: { label: 'Bullets per second (each side)', min: 2, max: 30, value: 14 },
    fire: (S) => {
      S.shoot(rad(S.shot * S.o.turn), 1.6, { from: [-2.5, EMITTER[1]] });
      S.shoot(Math.PI - rad(S.shot * S.o.turn), 1.6, { from: [2.5, EMITTER[1]] });
    },
    emitters: [[-2.5, EMITTER[1]], [2.5, EMITTER[1]]],
    info: (S) => [['Left angle', `+shot × ${S.o.turn}°`], ['Right angle', `180° − shot × ${S.o.turn}°`]],
  },

  /* Drops released at random along the top, accelerated down by gravity and
     pushed sideways by the wind: v += a dt, p += v dt, every frame. */
  rain: {
    sliders: [
      { key: 'g', label: 'Gravity', min: 0.2, max: 4, step: 0.1, value: 1.5, format: one },
      { key: 'wind', label: 'Wind', min: -1.5, max: 1.5, step: 0.1, value: 0, format: one },
    ],
    rate: { label: 'Drops per second', min: 1, max: 40, value: 12 },
    fire: (S) => S.shoot(DOWN, 0.2, { from: [between(-S.halfW - 1, S.halfW + 1), VIEW + 0.2], vx: S.o.wind, ay: -S.o.g }),
    emitters: [],
    info: (S) => [['Acceleration', `(0, −${S.o.g.toFixed(1)})`]],
  },

  /* Sparks, or stardust: "rather than completely random, it looks beautiful
     if you give the angle, speed and density a certain range or bias." Each
     burst flies out in all directions from the emitter: `count` bullets (the
     density), evenly spaced round the circle, but each one's angle knocked
     off its place by up to the angle range and its speed random within the
     speed range. Drag slows them and they fade, as sparks do. */
  particles: {
    rate: { label: 'Bursts per second', min: 0.2, max: 4, value: 1.1 },
    sliders: [
      { key: 'count', label: 'Density (bullets)', min: 4, max: 80, step: 1, value: 40, format: whole },
      { key: 'scatter', label: 'Angle range (± °)', min: 0, max: 45, step: 1, value: 8, format: whole },
      { key: 'vary', label: 'Speed range (±)', min: 0, max: 1, step: 0.05, value: 0.5, format: (v) => v.toFixed(2) },
    ],
    fire: (S) => {
      // a fresh turn each burst, so the bursts do not line up
      for (const a of ring(S.o.count, between(0, TAU))) {
        const speed = 2 * (1 + S.o.vary * between(-1, 1));
        S.shoot(a + rad(between(-S.o.scatter, S.o.scatter)), speed, { ay: -0.4, drag: 0.4, life: 3.5 });
      }
    },
    info: (S) => [['Angle', `360° × i / ${S.o.count} ± ${S.o.scatter}°`], ['Speed', `2 × (1 ± ${S.o.vary.toFixed(2)})`]],
  },

  /* Bullets that turn toward the heart, but by at most `turn` degrees per
     second and only for their first two seconds - a loose homing, which the
     write-up prefers to a perfect one. */
  homing: {
    sliders: [
      { key: 'turn', label: 'Turn rate (°/s)', min: 0, max: 180, step: 5, value: 45, format: whole },
    ],
    rate: { label: 'Volleys per second', min: 0.2, max: 5, value: 2 },
    fire: (S) => ring(8, rad(S.shot * 11)).forEach((a) => S.shoot(a, 1.4, { homing: true })),
    step: (S, dt) => {
      const max = rad(S.o.turn) * dt;
      for (const b of S.bullets) {
        if (!b.homing || b.age > 2) continue;
        const a = turnToward(Math.atan2(b.vy, b.vx), Math.atan2(S.heart[1] - b.y, S.heart[0] - b.x), max);
        const v = Math.hypot(b.vx, b.vy);
        b.vx = v * Math.cos(a); b.vy = v * Math.sin(a);
      }
    },
    info: (S) => [['Turn each frame', `at most ${S.o.turn}° × dt, for 2 s`]],
  },

  /* Lasers: a thin warning line aimed at the heart, then the beam, which
     sweeps after the heart - turning toward it, but no faster than the sweep
     speed, so it can be outrun. The readout is the heart's distance from the
     line, which is what a game would test against the beam's width. */
  lasers: {
    sliders: [
      { key: 'warn', label: 'Warning (s)', min: 0.2, max: 1.5, step: 0.1, value: 0.8, format: one },
      { key: 'sweep', label: 'Sweep speed (°/s)', min: 0, max: 30, step: 1, value: 30, format: whole },
    ],
    // A laser lasts its warning plus a 1.5 s beam (up to 3 s), so one is
    // still on when the next comes due at any but the slowest rate; busy
    // holds that one back until the box is clear: one laser at a time.
    rate: { label: 'Lasers per second', min: 0.1, max: 0.5, value: 0.4 },
    busy: (S) => S.lasers.length > 0,
    fire: (S) => {
      S.lasers.push({ a: aimAt(S), born: S.time, warn: S.o.warn, beam: 1.5 });
    },
    step: (S, dt) => {
      S.laserDist = null;
      for (const L of S.lasers) {
        if (S.time - L.born < L.warn) continue;
        L.a = turnToward(L.a, aimAt(S), rad(S.o.sweep) * dt);
        // distance from the heart to the line: |cross(d, heart - emitter)|
        const hx = S.heart[0] - EMITTER[0], hy = S.heart[1] - EMITTER[1];
        S.laserDist = Math.abs(Math.cos(L.a) * hy - Math.sin(L.a) * hx);
      }
      S.lasers = S.lasers.filter((L) => S.time - L.born < L.warn + L.beam);
    },
    draw: (S) => {
      for (const L of S.lasers) {
        const end = [EMITTER[0] + 20 * Math.cos(L.a), EMITTER[1] + 20 * Math.sin(L.a)];
        const firing = S.time - L.born >= L.warn;
        S.ctx.strokeStyle = firing ? '#ffffff' : EMITTER_GREY;
        stroke(S.ctx, [EMITTER, end], firing ? 0.24 : 0.025);
      }
    },
    info: (S) => [['Heart to beam', `|d × (heart − emitter)| = ${S.laserDist == null ? '–' : fmt(S.laserDist, 2)}`]],
  },
};

/* Composite has no pattern of its own: a button per pattern above adds it to
   the box (click again to take it out), so any mix can be built up live. No
   sliders - a dozen patterns' worth would bury it. Each pattern starts as its
   own slide's demo does: labs.js hands over those demos' data-values as
   opts.parts, { pattern: { key: value } }. */
const COMPOSITE_PARTS = [
  ['radial', 'Radial'], ['spiral', 'Spiral'], ['fan', 'Fan'], ['aimed', 'Aimed'],
  ['waves', 'Waves'], ['grids', 'Grids'], ['floral', 'Floral'], ['rings', 'Rings'],
  ['stars', 'Stars'], ['intersections', 'Intersections'], ['rain', 'Rain'],
  ['particles', 'Particles'], ['homing', 'Homing'], ['lasers', 'Lasers'],
];

/* A pattern's settings as its sliders start them: the slider defaults, with
   any of `set` (a data-values) over the top, held within each slider's range. */
const defaults = (P, set = {}) => Object.fromEntries([{ key: 'rate', ...P.rate }, ...P.sliders]
  .map((s) => [s.key, Math.min(s.max, Math.max(s.min, set[s.key] ?? s.value))]));

export function mountBulletLab(el, opts = {}) {
  const composite = opts.pattern === 'composite';
  const P = PATTERNS[opts.pattern] ?? PATTERNS.radial;
  el.classList.add('lab', 'lab-bullets');

  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const panel = document.createElement('div');
  panel.className = 'lab-panel';
  el.append(stageEl, panel);

  const stage = makeStage2D(stageEl, { view: VIEW, grid: false });
  const { ctx } = stage;
  const halfW = () => VIEW * (stageEl.clientWidth / (stageEl.clientHeight || 1));

  // data-heart-x: where the heart starts
  const S = { ctx, heart: [opts.heartX ?? 0, HEART_Y], bullets: [], warnings: [], time: 0 };

  /* Each pattern in the box is a layer: its own settings, shot count, clock
     and lasers, with everything else (the bullets, the heart, the time) read
     through to S. A pattern is handed its layer as S, so it never knows
     whether it is alone or one of several. */
  const layer = (P, o) => ({ __proto__: S, P, o, shot: 0, clock: Infinity, lasers: [], laserDist: null });
  const layers = [];

  // The formulas under the sliders, only with data-readout="true" (the deck
  // shows sliders alone). One follows a slider at once, not on the next
  // frame, so it is right even when no frames run, as in the self-test.
  let vp = null;
  const readout = () => {
    if (!vp) return;   // off, or the sliders firing once as they are built
    if (composite) {
      const names = COMPOSITE_PARTS.filter(([k]) => layers.some((L) => L.P === PATTERNS[k])).map(([, n]) => n);
      vp.update([['In the box', names.length ? names.join(' + ') : 'nothing yet']]);
    } else {
      vp.update(P.info ? P.info(layers[0]) : []);
    }
  };

  const controls = document.createElement('div');
  controls.className = composite ? 'lab-buttons bl-parts' : 'lab-controls';
  panel.appendChild(controls);
  if (composite) {
    for (const [key, name] of COMPOSITE_PARTS) {
      const b = button(controls, name, () => {
        const at = layers.findIndex((L) => L.P === PATTERNS[key]);
        if (at >= 0) layers.splice(at, 1);
        else layers.push(layer(PATTERNS[key], defaults(PATTERNS[key], opts.parts?.[key])));
        b.classList.toggle('is-on', at < 0);
        readout();
      });
    }
  } else {
    const L = layer(P, {});
    layers.push(L);
    for (const sl of [{ key: 'rate', step: 0.1, format: one, ...P.rate }, ...P.sliders]) {
      // data-values="rate=2, n=24" starts a slider off its default; the range
      // input keeps the value between the slider's min and max
      const value = opts.values?.[sl.key] ?? sl.value;
      slider(controls, { ...sl, value }, (v) => { L.o[sl.key] = v; readout(); });
    }
  }

  let last;
  function reset() {
    Object.assign(S, { bullets: [], warnings: [], time: 0, heart: [opts.heartX ?? 0, HEART_Y] });
    for (const L of layers) Object.assign(L, { shot: 0, clock: Infinity, lasers: [], laserDist: null });
    last = null;
  }

  if (opts.readout) vp = valuePanel(panel);
  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  panel.appendChild(buttons);
  button(buttons, 'Reset', () => { reset(); readout(); });
  readout();

  S.shoot = (angle, speed, { from = EMITTER, vx = 0, ay = 0, homing = false, drag = 0, life = 20 } = {}) => {
    S.bullets.push({
      x: from[0], y: from[1],
      vx: speed * Math.cos(angle) + vx, vy: speed * Math.sin(angle),
      ay, homing, drag, life, age: 0,
    });
  };
  S.warn = (circle, seconds, then) => S.warnings.push({ ...circle, until: S.time + seconds, then });

  /* The arrow keys move the heart, but only while the box has focus (click
     it; Esc or a click elsewhere lets go). Every letter is already taken -
     reveal.js has h/j/k/l, the deck's menu b, c, d, e, f, m, o, r and s - and
     the arrows only change slide when the keydown reaches the document, which
     stopPropagation here prevents. */
  stageEl.tabIndex = 0;
  const held = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
  // focus can outlive the slide (space or the menu moves on); let go then
  const onSlide = () => !el.closest('.reveal') || !!el.closest('section.present');
  stageEl.addEventListener('keydown', (e) => {
    if (!onSlide()) { stageEl.blur(); return; }
    if (e.key in held) held[e.key] = true;
    else if (e.key === 'Escape') stageEl.blur();
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  stageEl.addEventListener('keyup', (e) => { if (e.key in held) held[e.key] = false; });
  stageEl.addEventListener('blur', () => { for (const k in held) held[k] = false; });

  function step(dt) {
    S.time += dt;
    S.halfW = halfW();
    const dx = (held.ArrowRight ? 1 : 0) - (held.ArrowLeft ? 1 : 0);
    const dy = (held.ArrowUp ? 1 : 0) - (held.ArrowDown ? 1 : 0);
    // the same speed on a diagonal as straight: (dx, dy) normalised
    const k = dx && dy ? Math.SQRT1_2 : 1;
    S.heart[0] = Math.max(-S.halfW + 0.3, Math.min(S.halfW - 0.3, S.heart[0] + dx * k * HEART_SPEED * dt));
    S.heart[1] = Math.max(-VIEW + 0.3, Math.min(VIEW - 0.3, S.heart[1] + dy * k * HEART_SPEED * dt));
    if (dx || dy) readout();

    for (const L of layers) {
      L.clock += dt;
      // a while, not an if: at a high rate one frame can be due several shots
      const every = 1 / L.o.rate;
      if (L.clock === Infinity) L.clock = every;   // fire on the first frame
      while (L.clock >= every) {
        // still busy with the last one (a laser): wait, and fire once it is done
        if (L.P.busy?.(L)) { L.clock = every; break; }
        L.clock -= every;
        L.P.fire(L);
        L.shot++;
      }
    }
    for (const w of S.warnings) if (S.time >= w.until) w.then();
    S.warnings = S.warnings.filter((w) => S.time < w.until);
    for (const L of layers) if (L.P.step) L.P.step(L, dt);

    for (const b of S.bullets) {
      if (b.drag) { const f = Math.exp(-b.drag * dt); b.vx *= f; b.vy *= f; }
      b.vy += b.ay * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.age += dt;
    }
    // Gone once outside the box and still heading away from it - so a bullet
    // that starts outside and is on its way in (grids, rings, rain) is kept.
    S.bullets = S.bullets.filter((b) => b.age < b.life &&
      !((Math.abs(b.x) > S.halfW + 0.3 || Math.abs(b.y) > VIEW + 0.3) && b.x * b.vx + b.y * b.vy > 0));

    // a bullet that reaches the heart is gone
    S.bullets = S.bullets.filter((b) => Math.hypot(b.x - S.heart[0], b.y - S.heart[1]) > BULLET_R + HEART_R);
  }

  /* Undertale's soul: the classic heart curve, scaled to radius r. */
  function heartShape(at, r) {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * TAU;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      ctx[i ? 'lineTo' : 'moveTo'](at[0] + (x / 16) * r, at[1] + (y / 16) * r);
    }
    ctx.fill();
  }

  /* Runs only on the slide being shown, and starts over on arriving at it.
     reveal.js keeps the slides either side laid out (just transparent), so
     runLoop alone would have them already mid-pattern when you get there. */
  let away = true;
  function frame() {
    if (!stageEl.clientHeight) return;   // not laid out yet: no width to keep the heart in
    const here = onSlide();
    if (here && away) reset();
    away = !here;
    const now = performance.now() / 1000;
    // capped, so a stalled frame does not jump the simulation
    if (here && last != null) step(Math.min(now - last, 0.05));
    last = here ? now : null;

    // Undertale's battle box: black, white bullets, a red heart.
    stage.begin();
    ctx.fillStyle = '#000';
    ctx.fillRect(-50, -VIEW, 100, 2 * VIEW);

    ctx.strokeStyle = EMITTER_GREY;   // the rings' warning circle, like the aim and laser warning lines
    for (const w of S.warnings) {
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.arc(w.c[0], w.c[1], w.r, 0, TAU);
      ctx.stroke();
    }
    for (const L of layers) if (L.P.draw) L.P.draw(L);

    ctx.fillStyle = EMITTER_GREY;
    for (const L of layers) for (const e of L.P.emitters ?? [EMITTER]) disc(ctx, e, 0.13);
    ctx.fillStyle = '#fff';
    for (const b of S.bullets) disc(ctx, [b.x, b.y], BULLET_R);
    ctx.fillStyle = '#8a8f96';
    if (document.activeElement !== stageEl) label(ctx, [0, -VIEW + 0.3], 'click here, then the arrow keys to move', 0.3, 'center');
    ctx.fillStyle = '#e00000';
    heartShape(S.heart, HEART_R * 1.3);
    readout();
  }

  new ResizeObserver(() => { if (stage.resize()) frame(); }).observe(stageEl);
  stage.resize();
  frame();
  runLoop(el, frame);
}
