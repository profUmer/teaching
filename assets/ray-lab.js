/*
 * ray-lab.js - the ray intersection quadratics, for Game Physics 3's Ray
 * Intersections deck. Two shapes:
 *
 *   <div class="lab-mount" data-lab="ray-sphere"></div>
 *   <div class="lab-mount" data-lab="ray-cylinder"></div>
 *
 * Sliders for the ray's start S and direction D, and the shape: a sphere's
 * centre C and radius r, or an infinitely long cylinder through the end cap
 * centres A and B with radius r. Below them, a 3D view of the ray and the
 * shape beside the slide's three coefficients and the discriminant:
 *
 *   sphere     a = D . D
 *              b = 2 D . (S - C)
 *              c = (S - C) . (S - C) - r^2
 *
 *   cylinder   a = D . D - (D . n)^2                    n = AB normalised,
 *              b = 2 AS . D - 2 (D . n)(n . AS)         AS = S - A
 *              c = AS . AS - (AS . n)^2 - r^2
 *
 *   discriminant = b^2 - 4ac
 *
 * The discriminant is coloured by its sign (red below zero, amber at zero,
 * green above) so "how many hits" can be read at a glance without the lab
 * solving for t - that step stays on the slide. The picture marks no hit
 * points either: the ray is simply seen to pass through, graze or miss.
 *
 * The defaults are a ray down the x-axis at a unit sphere, or a unit
 * cylinder standing upright, 5 along it: a = 1, b = -10, c = 24,
 * discriminant 4 (two hits, t = 4 and 6) for both. For the sphere, moving
 * C_y to 1 makes it a tangent; for the cylinder, tilting D along the axis
 * (D_y) changes nothing, since only the part of D across the axis counts.
 * lab-selftest.html pins these.
 *
 * The 3D view is Canvas 2D with a hand-written orbit camera, like
 * transform-lab3d.js (PLAN.md 2.1): drag to orbit, scroll to zoom. The ray is
 * drawn solid for t >= 0 and as a faint dashed line for t < 0, behind the
 * start - the quadratic counts hits on that half too, which is why a shape
 * behind the ray still gives a positive discriminant. Anything the shape
 * hides is drawn dashed under it, found with the shape's own quadratic: a
 * point is hidden if the line from the eye to it enters the shape first.
 * The cylinder is infinite, so like the ray it is drawn only as far as a
 * cube around the scene.
 */

import { C, slider, button, valuePanel, fmt } from './lab-core.js';
import { makeStage2D, stroke, dashed, arrow, disc, fillShape, label, css } from './draw2d.js';

const DEFAULTS = {
  start: [0, 0, 0],
  dir: [1, 0, 0],
  centre: [5, 0, 0],
  endA: [5, 0, 0],
  endB: [5, 3, 0],
  radius: 1,
};

const POS = { min: -10, max: 10, step: 0.1 };
const DIR = { min: -5, max: 5, step: 0.1 };
const RAD = { min: 0, max: 10, step: 0.1 };

const one = (v) => v.toFixed(1);

/* An arrow over one letter or two, as \vec and \overrightarrow draw it, and a
   hat over two, as \widehat does. Combining marks (U+20D7, U+0302) render as
   boxes in the theme's UI font (TUTORIAL.md §10), hence CSS instead. */
const V = (s) => `<span class="ray-vec${s.length > 1 ? ' ray-wide' : ''}">${s}</span>`;
const H = (s) => `<span class="ray-hat">${s}</span>`;

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const scale = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
const along = (p, d, t) => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
const mid = (p, q) => scale(add(p, q), 0.5);

/* The cylinder's axis direction, AB normalised - null when A and B coincide,
   which leaves the axis, and so every coefficient, undefined. */
function axisOf(st) {
  const ab = sub(st.B, st.A);
  const l = len(ab);
  return l < 1e-9 ? null : scale(ab, 1 / l);
}

/* ------------------------------------------------------------------ shapes --- */
/* What differs between the two: the sliders beyond S and D, the readout's
   formulas, and the coefficients themselves. Drawing is in makeScene. */

const SHAPES = {
  sphere: {
    groups: [
      { title: `Sphere centre ${V('C')}, radius <i>r</i>`, vec: 'C', radius: true },
    ],
    keys: [
      `<i>a</i> = ${V('D')}<sup>2</sup>`,
      `<i>b</i> = 2${V('D')} · (${V('S')} − ${V('C')})`,
      `<i>c</i> = (${V('S')} − ${V('C')})<sup>2</sup> − <i>r</i><sup>2</sup>`,
    ],
    coefficients({ S, D, C: Cc, r }) {
      const SC = sub(S, Cc);
      return [dot(D, D), 2 * dot(D, SC), dot(SC, SC) - r * r];
    },
    centre: (st) => st.C,
  },

  cylinder: {
    groups: [
      { title: `End cap centre ${V('A')}`, vec: 'A' },
      { title: `End cap centre ${V('B')}, radius <i>r</i>`, vec: 'B', radius: true },
    ],
    keys: [
      `<i>a</i> = ${V('D')}<sup>2</sup> − (${V('D')} · ${H('AB')})<sup>2</sup>`,
      `<i>b</i> = 2${V('AS')} · ${V('D')} − 2${V('D')} · ${H('AB')}(${H('AB')} · ${V('AS')})`,
      `<i>c</i> = ${V('AS')}<sup>2</sup> − (${V('AS')} · ${H('AB')})<sup>2</sup> − <i>r</i><sup>2</sup>`,
    ],
    coefficients(st) {
      const n = axisOf(st);
      if (!n) return [NaN, NaN, NaN];   // fmt shows these as a dash
      const { S, D, A, r } = st;
      const AS = sub(S, A);
      const Dn = dot(D, n), ASn = dot(AS, n);
      return [dot(D, D) - Dn * Dn, 2 * dot(AS, D) - 2 * Dn * ASn, dot(AS, AS) - ASn * ASn - r * r];
    },
    centre: (st) => mid(st.A, st.B),
  },
};

export function mountRayLab(el, opts = {}) {
  const kind = SHAPES[opts.shape] ? opts.shape : 'sphere';
  const shape = SHAPES[kind];
  el.classList.add('lab', 'lab-ray', `lab-ray-${kind}`);

  // One object the sliders write into and the scene reads from.
  const st = {
    kind,
    S: [...(opts.start ?? DEFAULTS.start)],
    D: [...(opts.dir ?? DEFAULTS.dir)],
    C: [...(opts.centre ?? DEFAULTS.centre)],
    A: [...(opts.endA ?? DEFAULTS.endA)],
    B: [...(opts.endB ?? DEFAULTS.endB)],
    r: opts.radius ?? DEFAULTS.radius,
  };

  const inputs = document.createElement('div');
  inputs.className = 'ray-inputs';
  inputs.style.setProperty('--ray-cols', 2 + shape.groups.length);
  el.appendChild(inputs);

  function group(title) {
    const g = document.createElement('div');
    g.className = 'ray-group';
    const h = document.createElement('div');
    h.className = 'ray-group-title';
    h.innerHTML = title;
    const controls = document.createElement('div');
    controls.className = 'lab-controls';
    g.append(h, controls);
    inputs.appendChild(g);
    return controls;
  }

  // One slider per component. The names carry the vector's letter as well as
  // the axis (S<sub>x</sub>, not just x) so each is unique on the slide - and
  // so the self-test can find it by name.
  function xyz(parent, letter, vecArr, range) {
    ['x', 'y', 'z'].forEach((axis, i) => {
      slider(parent, { label: `${letter}<sub>${axis}</sub>`, ...range, value: vecArr[i], format: one },
        (v) => { vecArr[i] = v; update(); });
    });
  }

  // The 3D view on the left, the readout on the right.
  const row = document.createElement('div');
  row.className = 'ray-row';
  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const out = document.createElement('div');
  out.className = 'ray-out';
  row.append(stageEl, out);
  const values = valuePanel(out);
  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  out.appendChild(buttons);

  // Sliders call onInput as they are built, before the panel and the scene
  // would otherwise exist - so those come first in code, last on the page.
  let built = false;
  function update() {
    if (!built) return;
    const [a, b, c] = shape.coefficients(st);
    const d = b * b - 4 * a * c;

    // When a = 0 the discriminant still computes - to 0, since b is 0 too -
    // but the quadratic formula divides by 2a, so "one hit" would be wrong.
    // Grey it out and say why in the view instead.
    st.note = null;
    if (Number.isNaN(a)) st.note = 'A and B must be different points';
    else if (Math.abs(a) < 1e-9) {
      st.note = dot(st.D, st.D) < 1e-12
        ? 'D = 0: the ray has no direction'
        : 'a = 0: D is parallel to the axis, and the quadratic formula divides by 2a';
    }
    const sign = st.note ? 'ray-none'
      : Math.abs(d) < 5e-3 ? 'ray-zero' : d < 0 ? 'ray-neg' : 'ray-pos';

    values.update([
      [shape.keys[0], fmt(a)],
      [shape.keys[1], fmt(b)],
      [shape.keys[2], fmt(c)],
      [`discriminant = <i>b</i><sup>2</sup> − 4<i>ac</i>`, fmt(d), `ray-disc ${sign}`],
    ]);
    el.dataset.disc = sign.slice(4);   // neg | zero | pos | none, for the self-test
    scene.paint();
  }

  const scene = makeScene(stageEl, st, opts, mid(st.S, shape.centre(st)));
  button(buttons, 'Reset view', () => scene.reset());

  xyz(group(`Ray start ${V('S')}`), 'S', st.S, POS);
  xyz(group(`Ray direction ${V('D')}`), 'D', st.D, DIR);
  for (const g of shape.groups) {
    const controls = group(g.title);
    xyz(controls, g.vec, st[g.vec], POS);
    if (g.radius) slider(controls, { label: '<i>r</i>', ...RAD, value: st.r, format: one }, (v) => { st.r = v; update(); });
  }

  el.appendChild(row);
  built = true;
  update();
}

/* ============================================================== 3D view === */

const RAY = 0x8d1b1b;      // the deck's dark red: the ray and D
const BALL = C.accentB;    // the sphere or cylinder
const AXIS_COLOUR = { x: C.basisX, y: C.basisY, z: C.result };

/* Two unit vectors perpendicular to n and to each other - the plane of a
   ring around the cylinder's axis. */
function perpBasis(n) {
  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const p = cross(n, helper);
  const p1 = scale(p, 1 / len(p));
  return [p1, cross(n, p1)];
}

function makeScene(stageEl, st, opts, target) {
  const yaw0 = opts.yaw ?? -32;
  const pitch0 = opts.pitch ?? 22;
  const view0 = opts.view ?? 3.5;

  /* makeStage2D supplies the canvas, its sizing and devicePixelRatio
     handling; its flat grid is not used - paint() lays down a floor. */
  const stage = makeStage2D(stageEl, { view: view0 });
  const { ctx, canvas } = stage;

  const cam = { yaw: rad(yaw0), pitch: rad(pitch0), view: view0 };
  // The camera orbits `target`, halfway between the starting S and the
  // shape's centre, so the opening picture is framed on the ray and the shape
  // rather than on the origin. Fixed from then on: a target that followed the
  // sliders would make a moving shape look as if it were standing still.
  const DIST = 45;   // eye distance from the target; far enough to stay outside any shape the sliders allow
  const BOX = 12;    // the ray and the cylinder are drawn only inside this cube - both are infinite
  const GRID = 10;   // floor half-width, matching the sliders' range
  const LIFT = 0.2;  // origin offset below centre, as a fraction of half-height

  /* --- camera -------------------------------------------------------------- */
  /* An orbit camera, as in transform-lab3d.js: turn the world by yaw about y,
     tip it by pitch about x, then divide by depth. `right`, `up` and `back`
     are the camera's axes in world space (the rows of that rotation), so the
     eye sits at target + DIST * back. */
  let axes = null;
  function basis() {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    axes = {
      right: [cy, 0, sy],
      up: [sp * sy, cp, -sp * cy],
      back: [-cp * sy, sp, cp * cy],
    };
    axes.eye = add(target, scale(axes.back, DIST));
  }

  // -> [screen x, screen y, perspective scale at that depth]
  function project(p) {
    const q = sub(p, target);
    const k = DIST / Math.max(DIST - dot(q, axes.back), 0.5);
    return [dot(q, axes.right) * k, dot(q, axes.up) * k, k];
  }
  const xy = (p) => project(p).slice(0, 2);

  /* Where the line P + tD is inside the cube |x|, |y|, |z| <= BOX - the slab
     test. null if D is zero or the line misses the cube. */
  function clipLine(P, D) {
    let t0 = -Infinity, t1 = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(D[i]) < 1e-9) {
        if (Math.abs(P[i]) > BOX) return null;
        continue;
      }
      let a = (-BOX - P[i]) / D[i], b = (BOX - P[i]) / D[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    return t0 < t1 ? [t0, t1] : null;
  }

  /* The shape's geometry for this frame, worked out once per paint. */
  let geo = null;
  function prepare() {
    if (st.kind !== 'cylinder') { geo = null; return; }
    const n = axisOf(st);
    geo = { n, span: n && clipLine(st.A, n) };
  }

  /* --- occlusion ----------------------------------------------------------- */
  /* Is P behind the shape? Cast a ray from the eye to P and solve the shape's
     own quadratic - the one on the slide, with S = eye and D = P - eye:
     hidden if it enters the shape before reaching P. The eye is never inside
     either shape: the target and any point the sliders reach are at most
     34.7 apart, and 45 - 34.7 is more than the largest radius. */
  function hidden(P) {
    if (st.r <= 0) return false;
    const d = sub(P, axes.eye);
    let a, b, c, f;
    if (st.kind === 'cylinder') {
      if (!geo.span) return false;
      const n = geo.n;
      f = sub(axes.eye, st.A);
      const dn = dot(d, n), fn = dot(f, n);
      a = dot(d, d) - dn * dn;
      b = 2 * dot(f, d) - 2 * dn * fn;
      c = dot(f, f) - fn * fn - st.r * st.r;
    } else {
      f = sub(axes.eye, st.C);
      a = dot(d, d);
      b = 2 * dot(d, f);
      c = dot(f, f) - st.r * st.r;
    }
    const disc2 = b * b - 4 * a * c;
    if (disc2 <= 0 || a < 1e-12) return false;
    const s = (-b - Math.sqrt(disc2)) / (2 * a);
    if (!(s > 0 && s < 1 - 1e-6)) return false;
    if (st.kind !== 'cylinder') return true;
    // only the part of the cylinder that is drawn can hide anything
    const axial = dot(sub(along(axes.eye, d, s), st.A), geo.n);
    return axial >= geo.span[0] && axial <= geo.span[1];
  }

  /* Samples a curve and splits it into runs by `flag`, each run a screen
     polyline. Consecutive runs share an end point, so there is no gap. */
  function runs(pointAt, n, flag) {
    const list = [];
    let cur = null;
    for (let i = 0; i <= n; i++) {
      const P = pointAt(i / n);
      const f = flag(P);
      const q = xy(P);
      if (!cur || cur.flag !== f) {
        cur = { flag: f, pts: cur ? [cur.pts[cur.pts.length - 1]] : [] };
        list.push(cur);
      }
      cur.pts.push(q);
    }
    return list;
  }

  /* Draws a set of runs: those matching `which` only, so the hidden parts
     can go down before the shape and the visible ones after it. */
  function drawRuns(list, which, style) {
    for (const run of list) {
      if (run.flag !== which || run.pts.length < 2) continue;
      if (style.dash) dashed(ctx, run.pts, style.width, style.dash);
      else stroke(ctx, run.pts, style.width);
    }
  }

  /* A circle of radius r about `centre`, in the plane of p1 and p2, split
     into the half facing the eye and the half turned away. */
  function ring(centre, p1, p2, r) {
    return runs((u) => {
      const a = u * Math.PI * 2;
      return add(centre, add(scale(p1, r * Math.cos(a)), scale(p2, r * Math.sin(a))));
    }, 96, (Q) => dot(sub(Q, centre), sub(axes.eye, Q)) > 0);
  }

  /* --- drawing ------------------------------------------------------------- */

  /* A y-up transform in view units centred on the canvas, as in
     transform-lab3d.js. */
  function begin() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.height / (2 * cam.view);
    ctx.setTransform(k, 0, 0, -k, canvas.width / 2, canvas.height * (0.5 + LIFT / 2));
  }

  function floor(W) {
    const seg = (a, b, width) => stroke(ctx, [xy(a), xy(b)], width);
    ctx.strokeStyle = css(C.grid);
    for (let i = -GRID; i <= GRID; i++) {
      seg([i, 0, -GRID], [i, 0, GRID], W.grid);
      seg([-GRID, 0, i], [GRID, 0, i], W.grid);
    }
    // negative halves grey, positive halves in the axis colour, then a letter
    for (const [a, e] of Object.entries({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] })) {
      const l = a === 'y' ? GRID * 0.6 : GRID + 0.6;
      if (a !== 'y') {
        ctx.strokeStyle = css(C.axis);
        seg(e.map((v) => -v * GRID), [0, 0, 0], W.axis);
      }
      ctx.strokeStyle = css(AXIS_COLOUR[a]);
      seg([0, 0, 0], e.map((v) => v * l), W.axis * 1.3);
      ctx.fillStyle = css(AXIS_COLOUR[a]);
      label(ctx, xy(e.map((v) => v * (l + 0.5))), a, W.text, 'center');
    }
  }

  /* The sphere: its shadow, the far half of its equator seen through it, a
     translucent ball lit from the upper left, the near half, and r. */
  function drawSphere(W) {
    const { C: Cc, r } = st;
    if (r <= 0) {
      ctx.fillStyle = css(BALL);
      disc(ctx, xy(Cc), W.dot * 0.8);
      label(ctx, xy(Cc), 'C', W.text, 'right', W.text * 0.6);
      return;
    }
    const pc = project(Cc);
    const rs = r * pc[2];

    const equator = ring(Cc, [1, 0, 0], [0, 0, 1], r);
    ctx.strokeStyle = css(BALL);
    ctx.globalAlpha = 0.35;
    drawRuns(equator, false, { width: W.thin, dash: W.dash * 0.6 });

    const g = ctx.createRadialGradient(pc[0] - rs * 0.35, pc[1] + rs * 0.4, rs * 0.05, pc[0], pc[1], rs);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(0.55, 'rgba(110, 160, 210, 0.55)');
    g.addColorStop(1, 'rgba(31, 111, 178, 0.7)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    disc(ctx, [pc[0], pc[1]], rs);
    ctx.strokeStyle = css(BALL);
    ctx.beginPath();
    ctx.arc(pc[0], pc[1], rs, 0, Math.PI * 2);
    ctx.lineWidth = W.thin * 1.3;
    ctx.stroke();
    drawRuns(equator, true, { width: W.thin });

    // the radius, drawn across the face of the ball toward the viewer's right
    const edge = along(Cc, axes.right, r);
    ctx.strokeStyle = ctx.fillStyle = css(C.handle);
    stroke(ctx, [xy(Cc), xy(edge)], W.thin);
    disc(ctx, xy(Cc), W.dot * 0.8);
    // no halo here: on the ball it would read as a white box
    label(ctx, xy(along(Cc, axes.right, r / 2)), 'r', W.text, 'center', W.text * 0.6);
    label(ctx, xy(Cc), 'C', W.text, 'right', W.text * 0.6);
  }

  /* The cylinder: its axis through A and B (inside it, so seen through it),
     the far halves of a ring at A and at B, a translucent body between its
     two silhouette lines, then the near halves and r. Drawn only as far as
     the axis stays inside the cube - it is infinite. */
  function drawCylinder(W) {
    const { A, B, r } = st;
    const ends = () => {
      ctx.fillStyle = css(C.handle);
      disc(ctx, xy(A), W.dot * 0.8);
      disc(ctx, xy(B), W.dot * 0.8);
    };
    const endLabels = () => {
      ctx.fillStyle = css(C.handle);
      label(ctx, xy(A), 'A', W.text, 'right', W.text * 0.6);
      label(ctx, xy(B), 'B', W.text, 'right', W.text * 0.6);
    };

    const { n, span } = geo;
    if (!n) {   // A = B: no axis to draw; paint() says so in the corner
      ends();
      endLabels();
      return;
    }

    ctx.strokeStyle = css(BALL);
    if (span) {
      ctx.globalAlpha = 0.5;
      dashed(ctx, [xy(along(A, n, span[0])), xy(along(A, n, span[1]))], W.thin, W.dash);
      ctx.globalAlpha = 1;
    }
    if (r <= 0 || !span) {
      ends();
      endLabels();
      return;
    }

    const [p1, p2] = perpBasis(n);
    const rings = [ring(A, p1, p2, r), ring(B, p1, p2, r)];
    ctx.strokeStyle = css(BALL);
    ctx.globalAlpha = 0.35;
    for (const rg of rings) drawRuns(rg, false, { width: W.thin, dash: W.dash * 0.6 });
    ctx.globalAlpha = 1;
    ends();   // on the axis, inside the cylinder: under the body

    /* The silhouette. Seen from the eye, a cylinder's outline is two straight
       lines parallel to its axis, where the planes through the eye touch it.
       With e the eye's offset from the axis (at distance d), they sit at
       r w, for w = (r/d) e^ +- sqrt(1 - r^2/d^2) (n x e^). */
    const eA = sub(axes.eye, A);
    const e = sub(eA, scale(n, dot(eA, n)));
    const d = len(e);
    if (d > r + 1e-6) {
      const eh = scale(e, 1 / d);
      const m = cross(n, eh);
      const k = r / d, q = Math.sqrt(1 - k * k);
      const wp = add(scale(eh, k * r), scale(m, q * r));
      const wm = add(scale(eh, k * r), scale(m, -q * r));
      const P0 = along(A, n, span[0]), P1 = along(A, n, span[1]);
      const edgeP = [xy(add(P0, wp)), xy(add(P1, wp))];
      const edgeM = [xy(add(P1, wm)), xy(add(P0, wm))];

      // shaded across its width: darker at the edges, a highlight off-centre
      const M = along(A, n, (span[0] + span[1]) / 2);
      const g0 = xy(add(M, wp)), g1 = xy(add(M, wm));
      const g = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
      g.addColorStop(0, 'rgba(31, 111, 178, 0.7)');
      g.addColorStop(0.32, 'rgba(255, 255, 255, 0.8)');
      g.addColorStop(0.7, 'rgba(110, 160, 210, 0.55)');
      g.addColorStop(1, 'rgba(31, 111, 178, 0.7)');
      ctx.fillStyle = g;
      fillShape(ctx, [...edgeP, ...edgeM]);
      ctx.strokeStyle = css(BALL);
      stroke(ctx, edgeP, W.thin * 1.3);
      stroke(ctx, edgeM, W.thin * 1.3);
    }
    ctx.strokeStyle = css(BALL);
    for (const rg of rings) drawRuns(rg, true, { width: W.thin });

    // the radius, out from A across the near face toward the viewer's right
    let side = sub(axes.right, scale(n, dot(axes.right, n)));
    side = len(side) < 1e-6 ? p1 : scale(side, 1 / len(side));
    ctx.strokeStyle = ctx.fillStyle = css(C.handle);
    stroke(ctx, [xy(A), xy(along(A, side, r))], W.thin);
    label(ctx, xy(along(A, side, r / 2)), 'r', W.text, 'center', W.text * 0.6);
    endLabels();
  }

  function paint() {
    if (!canvas.width || !canvas.height) return;
    basis();
    prepare();
    begin();
    const v = cam.view;
    const W = {
      grid: 0.006 * v, axis: 0.011 * v, ray: 0.016 * v, arrow: 0.028 * v, thin: 0.009 * v,
      dot: 0.03 * v, text: 0.105 * v, dash: 0.035 * v, hint: 0.075 * v,
    };
    const { S, D, r } = st;
    const cylinder = st.kind === 'cylinder';

    floor(W);

    // the sphere's shadow on the floor, and dashed stalks down to it from the
    // shape's points and S, so their heights can be read
    if (!cylinder && r > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
      const shadow = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        shadow.push(xy([st.C[0] + r * Math.cos(a), 0, st.C[2] + r * Math.sin(a)]));
      }
      fillShape(ctx, shadow);
    }
    ctx.strokeStyle = '#9aa3ab';
    for (const P of cylinder ? [st.A, st.B, S] : [st.C, S]) {
      if (Math.abs(P[1]) > 1e-6) dashed(ctx, [xy(P), xy([P[0], 0, P[2]])], W.thin, W.dash);
    }

    // the ray, split at S into t < 0 and t >= 0, each split again by the
    // shape into hidden and visible runs
    const span = clipLine(S, D);
    const back = span && span[0] < 0 ? runs((u) => along(S, D, span[0] * (1 - u)), 120, hidden) : [];
    const fwd = span && span[1] > 0 ? runs((u) => along(S, D, span[1] * u), 240, hidden) : [];
    const sHidden = hidden(S);
    const hasD = dot(D, D) > 1e-12;

    const BACK = { width: W.thin, dash: W.dash };
    const FWD_HIDDEN = { width: W.ray, dash: W.dash * 1.4 };
    const FWD_SHOWN = { width: W.ray };

    function startAndDirection() {
      ctx.strokeStyle = ctx.fillStyle = css(RAY);
      if (hasD) arrow(ctx, xy(S), xy(along(S, D, 1)), W.arrow);
      ctx.fillStyle = css(C.handle);
      disc(ctx, xy(S), W.dot);
    }

    // under the shape: whatever it hides
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#9aa3ab';
    drawRuns(back, true, BACK);
    ctx.strokeStyle = css(RAY);
    drawRuns(fwd, true, FWD_HIDDEN);
    ctx.globalAlpha = 1;
    if (sHidden) startAndDirection();

    if (cylinder) drawCylinder(W);
    else drawSphere(W);

    // over the shape: whatever it does not hide
    ctx.strokeStyle = '#9aa3ab';
    drawRuns(back, false, BACK);
    ctx.strokeStyle = css(RAY);
    drawRuns(fwd, false, FWD_SHOWN);
    if (!sHidden) startAndDirection();

    // labels last, so nothing strikes through them
    ctx.fillStyle = css(C.handle);
    label(ctx, xy(S), 'S', W.text, 'right', -W.text * 0.75, true);
    if (hasD) {
      ctx.fillStyle = css(RAY);
      label(ctx, xy(along(S, D, 0.5)), 'D', W.text, 'center', W.text * 0.8, true);
    }

    ctx.fillStyle = '#9aa3ab';
    const halfW = v * (canvas.width / canvas.height);
    const top = v * (1 + LIFT) - 0.1 * v;
    label(ctx, [-halfW + 0.1 * v, top], 'drag to orbit · scroll to zoom', W.hint, 'left');
    // why the discriminant is greyed out, when it is (see update())
    if (st.note) {
      ctx.fillStyle = css(C.accentA);
      label(ctx, [-halfW + 0.1 * v, top - W.hint * 1.8], st.note, W.hint * 1.15, 'left', 0, true);
    }
  }

  /* --- orbit and zoom ------------------------------------------------------ */
  /* Neither touches the readout: moving the camera changes the picture, not
     the ray or the shape. */
  let orbit = null;
  canvas.addEventListener('pointerdown', (e) => {
    orbit = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    canvas.classList.add('grabbing');
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!orbit) return;
    cam.yaw = orbit.yaw + rad((e.clientX - orbit.x) * 0.4);
    cam.pitch = clamp(orbit.pitch + rad((e.clientY - orbit.y) * 0.4), rad(-85), rad(85));
    paint();
    e.preventDefault();
  });
  const release = (e) => {
    if (!orbit) return;
    orbit = null;
    canvas.classList.remove('grabbing');
    if (e.pointerId !== undefined && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();   // zoom the picture, not scroll the page
    cam.view = clamp(cam.view * Math.exp(e.deltaY * 0.0015), 2, 14);
    paint();
  }, { passive: false });

  function reset() {
    cam.yaw = rad(yaw0);
    cam.pitch = rad(pitch0);
    cam.view = view0;
    paint();
  }

  // Quasi-static, like the motion labs: repaint on a slider, a drag, or a
  // resize (which is also how a slide becoming visible, or ?print-pdf, shows up).
  new ResizeObserver(() => { if (stage.resize()) paint(); }).observe(stageEl);
  stage.resize();

  return { paint, reset };
}
