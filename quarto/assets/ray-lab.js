/*
 * ray-lab.js - the ray intersection quadratics, for Game Physics 3's Ray
 * Intersections deck. Three shapes:
 *
 *   <div class="lab-mount" data-lab="ray-sphere"></div>
 *   <div class="lab-mount" data-lab="ray-cylinder"></div>
 *   <div class="lab-mount" data-lab="ray-capped"></div>
 *
 * ray-capped is the cylinder with its end caps: the slides' checks, in order,
 * after the infinite cylinder's quadratic. P is where the ray first meets the
 * infinite cylinder. If P is outside the plane of cap A (AP . AB < 0), and
 * the ray heads toward A (D . AB > 0), the ray meets that plane at
 * t = -AS . AB / D . AB, at Q = S + tD, and hits cap A if |AQ| <= r; the same
 * for B with A and B swapped. If P is outside neither plane, P is the hit.
 * With D along the axis (a = 0) there is no P: straight to the cap it heads for.
 * The readout gives each check's value, green when it passes and red when it
 * fails, then where it hits (P or Q), and the view the plane being checked,
 * P on a very faint infinite cylinder, Q and the hit.
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
 * The 3D view is Canvas 2D with an orbit camera (orbit3d.js, shared with
 * the cross product lab; PLAN.md 2.1): drag to orbit, scroll to zoom. The
 * black dots drag instead - S, D's tip, C (or A and B) and the end of the
 * radius line - across the screen (orbit3d.js's handles), and the sliders
 * follow, kept to their range and step. The ray is
 * drawn solid for t >= 0 and as a faint dashed line for t < 0, behind the
 * start - the quadratic counts hits on that half too, which is why a shape
 * behind the ray still gives a positive discriminant. Anything the shape
 * hides is drawn dashed under it, found with the shape's own quadratic: a
 * point is hidden if the line from the eye to it enters the shape first.
 * The cylinder is infinite, so like the ray it is drawn only as far as a
 * cube around the scene.
 */

import { C, slider, button, valuePanel, fmt } from './lab-core.js';
import { stroke, dashed, arrow, disc, fillShape, label, css } from './draw2d.js';
import { makeOrbitView } from './orbit3d.js';

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

const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const scale = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
const along = (p, d, t) => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];
const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
const mid = (p, q) => scale(add(p, q), 0.5);

/* The cylinder and the capped cylinder share the axis and quadratic. */
const tube = (kind) => kind === 'cylinder' || kind === 'capped';

/* The cylinder's axis direction, AB normalised - null when A and B coincide,
   which leaves the axis, and so every coefficient, undefined. */
function axisOf(st) {
  const ab = sub(st.B, st.A);
  const l = len(ab);
  return l < 1e-9 ? null : scale(ab, 1 / l);
}

/* The infinite cylinder's a, b, c for the ray S + tD - the slide's. */
function tubeCoefficients(st, S, D) {
  const n = axisOf(st);
  if (!n) return [NaN, NaN, NaN];   // fmt shows these as a dash
  const AS = sub(S, st.A);
  const Dn = dot(D, n), ASn = dot(AS, n);
  return [dot(D, D) - Dn * Dn, 2 * dot(AS, D) - 2 * Dn * ASn, dot(AS, AS) - ASn * ASn - st.r * st.r];
}

/*
 * The capped cylinder, as the slides do it, for the ray S + tD. Returns each
 * value the checks reach (the rest stay undefined) and the verdict: 'capA',
 * 'capB', 'side' or 'miss', with hitT and hitAt for a hit.
 *
 * Once P is outside a cap's plane, failing that cap's checks is a miss, not
 * the side: the ray then either heads away from the cylinder's length or
 * leaves the infinite cylinder before it reaches the plane.
 */
function cappedHit(st, S, D) {
  const h = { verdict: 'miss' };
  const n = axisOf(st);
  if (!n) return h;
  const [a, b, c] = tubeCoefficients(st, S, D);
  const AB = sub(st.B, st.A);
  if (Math.abs(a) < 1e-9) {
    // D along the axis: the quadratic does not apply and there is no P, but
    // the ray can still meet a cap - go straight to the one it heads for
    if (dot(D, D) < 1e-12) return h;
    h.cap = dot(D, AB) > 0 ? 'A' : 'B';
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return h;
    h.tP = (-b - Math.sqrt(disc)) / (2 * a);
    h.P = along(S, D, h.tP);
    h.apab = dot(sub(h.P, st.A), AB);
    if (h.apab >= 0) h.bpba = dot(sub(h.P, st.B), scale(AB, -1));
    h.cap = h.apab < 0 ? 'A' : h.bpba < 0 ? 'B' : null;
    if (!h.cap) return Object.assign(h, { verdict: 'side', hitT: h.tP, hitAt: h.P });
  }
  const X = st[h.cap], XY = h.cap === 'A' ? AB : scale(AB, -1);
  h.dxy = dot(D, XY);
  if (h.dxy <= 0) return h;
  h.t = -dot(sub(S, X), XY) / h.dxy;
  h.Q = along(S, D, h.t);
  h.xq = len(sub(h.Q, X));
  if (h.xq <= st.r) Object.assign(h, { verdict: `cap${h.cap}`, hitT: h.t, hitAt: h.Q });
  return h;
}

const VERDICT = {
  capA: 'Hits end cap A at Q',
  capB: 'Hits end cap B at Q',
  side: 'Hits the side at P',
  miss: 'Misses',
  none: '–',
};

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
    coefficients: (st) => tubeCoefficients(st, st.S, st.D),
    centre: (st) => mid(st.A, st.B),
  },

  // the end caps: the same sliders and quadratic, and the checks after it
  capped: {
    groups: [
      { title: `End cap centre ${V('A')}`, vec: 'A' },
      { title: `End cap centre ${V('B')}, radius <i>r</i>`, vec: 'B', radius: true },
    ],
    coefficients: (st) => tubeCoefficients(st, st.S, st.D),
    centre: (st) => mid(st.A, st.B),
  },
};

/* The capped readout: the discriminant, then each check the slides make, its
   value green if it passes, red if not, a dash if it was never reached. The
   rows after the first two name the cap P is outside of. */
function cappedRows(h, st, discRow) {
  const X = h.cap ?? 'A', Y = X === 'A' ? 'B' : 'A';
  const at = h.cap ? 'Q' : 'P';
  const check = (v, ok) => (v === undefined
    ? ['–', 'ray-check ray-skip']
    : [fmt(v), `ray-check ${ok ? 'ray-pass' : 'ray-fail'}`]);
  return [
    discRow,
    [`${V('AP')} · ${V('AB')} < 0`, ...check(h.apab, h.apab < 0)],
    [`${V('BP')} · ${V('BA')} < 0`, ...check(h.bpba, h.bpba < 0)],
    [`${V('D')} · ${V(X + Y)} > 0`, ...check(h.dxy, h.dxy > 0)],
    ['<i>t</i>', h.t === undefined ? '–' : fmt(h.t), `ray-check${h.t === undefined ? ' ray-skip' : ''}`],
    [`‖${V(X + 'Q')}‖ ≤ <i>r</i>`, ...check(h.xq, h.xq <= st.r)],
    // where it hits: P on the side, Q on a cap
    [`${V(at)} =`, h.hitAt ? `(${h.hitAt.map((x) => fmt(x)).join(', ')})` : '–',
      `ray-check ray-point ${h.hitAt ? 'ray-pass' : 'ray-skip'}`],
  ];
}

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
  const sliders = {};   // S, D, C, A, B: [x, y, z]; r - so a drag can move them
  function xyz(parent, letter, vecArr, range) {
    sliders[letter] = ['x', 'y', 'z'].map((axis, i) =>
      slider(parent, { label: `${letter}<sub>${axis}</sub>`, ...range, value: vecArr[i], format: one },
        (v) => { vecArr[i] = v; update(); }));
  }

  /* A dragged dot sets its sliders, kept to their range and step, and the
     sliders redraw everything from there. D's dot is its tip, S + D; the
     radius dot sets r to its distance from C, or from the cylinder's axis. */
  const snap = (v, { min, max }) => Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;
  const setTo = (sl, v) => { if (v !== sl.get()) sl.set(v); };
  function onDrag(key, p) {
    if (key === 'D') sliders.D.forEach((sl, i) => setTo(sl, snap(p[i] - st.S[i], DIR)));
    else if (key === 'r') {
      let off = sub(p, tube(kind) ? st.A : st.C);
      const n = tube(kind) && axisOf(st);
      if (n) off = sub(off, scale(n, dot(off, n)));
      setTo(sliders.r, snap(len(off), RAD));
    } else sliders[key].forEach((sl, i) => setTo(sl, snap(p[i], POS)));
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
  // the capped lab's answer, under its checks
  const verdict = document.createElement('div');
  if (kind === 'capped') {
    verdict.className = 'ray-verdict';
    out.appendChild(verdict);
  }
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
    // a = 0 with D along the axis puts nothing on the view: the greyed
    // discriminant says enough, and the capped lab's readout goes straight
    // to the end caps instead (cappedHit).
    st.note = null;
    const flat = Number.isNaN(a) || Math.abs(a) < 1e-9;
    if (Number.isNaN(a)) st.note = 'A and B must be different points';
    else if (flat && dot(st.D, st.D) < 1e-12) st.note = 'D = 0: the ray has no direction';
    const sign = flat ? 'ray-none'
      : Math.abs(d) < 5e-3 ? 'ray-zero' : d < 0 ? 'ray-neg' : 'ray-pos';

    const discRow = [`discriminant = <i>b</i><sup>2</sup> − 4<i>ac</i>`, fmt(d), `ray-disc ${sign}`];
    if (kind === 'capped') {
      // A = B or D = 0: nothing to check
      st.hit = st.note ? { verdict: 'none' } : cappedHit(st, st.S, st.D);
      values.update(cappedRows(st.hit, st, discRow));
      verdict.textContent = VERDICT[st.hit.verdict];
      const v = st.hit.verdict;
      verdict.className = `ray-verdict is-${v === 'miss' || v === 'none' ? v : 'hit'}`;
      el.dataset.verdict = v;   // for the self-test
    } else {
      values.update([
        [shape.keys[0], fmt(a)],
        [shape.keys[1], fmt(b)],
        [shape.keys[2], fmt(c)],
        discRow,
      ]);
    }
    el.dataset.disc = sign.slice(4);   // neg | zero | pos | none, for the self-test
    scene.paint();
  }

  const scene = makeScene(stageEl, st, opts, mid(st.S, shape.centre(st)), onDrag);
  button(buttons, 'Reset view', () => scene.reset());

  xyz(group(`Ray start ${V('S')}`), 'S', st.S, POS);
  xyz(group(`Ray direction ${V('D')}`), 'D', st.D, DIR);
  for (const g of shape.groups) {
    const controls = group(g.title);
    xyz(controls, g.vec, st[g.vec], POS);
    if (g.radius) sliders.r = slider(controls, { label: '<i>r</i>', ...RAD, value: st.r, format: one }, (v) => { st.r = v; update(); });
  }

  el.appendChild(row);
  built = true;
  update();
}

/* ============================================================== 3D view === */

const RAY = 0x8d1b1b;      // the deck's dark red: the ray and D
const BALL = C.accentB;    // the sphere or cylinder

/* Two unit vectors perpendicular to n and to each other - the plane of a
   ring around the cylinder's axis. */
function perpBasis(n) {
  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const p = cross(n, helper);
  const p1 = scale(p, 1 / len(p));
  return [p1, cross(n, p1)];
}

function makeScene(stageEl, st, opts, target, onDrag) {
  // The camera orbits `target`, halfway between the starting S and the
  // shape's centre, so the opening picture is framed on the ray and the shape
  // rather than on the origin. Fixed from then on: a target that followed the
  // sliders would make a moving shape look as if it were standing still.
  // The eye sits 45 from it (orbit3d.js's default), far enough to stay
  // outside any shape the sliders allow.
  const view = makeOrbitView(stageEl, {
    yaw: opts.yaw, pitch: opts.pitch, view: opts.view, target,
    handles: () => grips().map(([, p]) => p),
    onDrag: (i, p) => onDrag(grips()[i][0], p),
  }, paint);
  const { ctx, xy, project } = view;

  /* The dots that drag, in a fixed order - S, D's tip, the shape's points,
     the end of the radius line - so the first wins where two coincide. */
  function grips() {
    const g = [['S', st.S], ['D', add(st.S, st.D)]];
    if (tube(st.kind)) g.push(['A', st.A], ['B', st.B]);
    else g.push(['C', st.C]);
    const end = radiusEnd();
    if (end) g.push(['r', end]);
    return g;
  }

  /* Where the radius line ends: out from C, or from A square to the axis,
     toward the viewer's right. null with no axis (A = B). */
  function radiusEnd() {
    const right = view.axes.right;
    if (!tube(st.kind)) return along(st.C, right, st.r);
    const n = axisOf(st);
    if (!n) return null;
    let side = sub(right, scale(n, dot(right, n)));
    side = len(side) < 1e-6 ? perpBasis(n)[0] : scale(side, 1 / len(side));
    return along(st.A, side, st.r);
  }
  const BOX = 12;    // the ray and the cylinder are drawn only inside this cube - both are infinite
  const GRID = 10;   // floor half-width, matching the sliders' range
  let axes = null;   // the camera's axes and eye for this frame (orbit3d.js)

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
    if (!tube(st.kind)) { geo = null; return; }
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
    if (st.kind === 'capped') {
      // the slides' own checks, from the eye: hidden if it hits on the way
      if (!geo.n) return false;
      const h = cappedHit(st, axes.eye, d);
      return h.hitT !== undefined && h.hitT > 0 && h.hitT < 1 - 1e-6;
    }
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

  /* The sphere: its shadow, the far half of its equator seen through it, a
     translucent ball lit from the upper left, the near half, and r. */
  function drawSphere(W) {
    const { C: Cc, r } = st;
    if (r <= 0) {
      ctx.fillStyle = css(C.handle);
      disc(ctx, xy(Cc), W.dot);
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
    const edge = radiusEnd();
    ctx.strokeStyle = ctx.fillStyle = css(C.handle);
    stroke(ctx, [xy(Cc), xy(edge)], W.thin);
    disc(ctx, xy(Cc), W.dot);
    disc(ctx, xy(edge), W.dot);
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
      disc(ctx, xy(A), W.dot);
      disc(ctx, xy(B), W.dot);
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

    body(W, n, along(A, n, span[0]), along(A, n, span[1]));
    ctx.strokeStyle = css(BALL);
    for (const rg of rings) drawRuns(rg, true, { width: W.thin });

    // the radius, out from A across the near face toward the viewer's right
    const edge = radiusEnd();
    ctx.strokeStyle = ctx.fillStyle = css(C.handle);
    stroke(ctx, [xy(A), xy(edge)], W.thin);
    disc(ctx, xy(edge), W.dot);
    label(ctx, xy(mid(A, edge)), 'r', W.text, 'center', W.text * 0.6);
    endLabels();
  }

  /* The silhouette. Seen from the eye, a cylinder's outline is two straight
     lines parallel to its axis, where the planes through the eye touch it.
     With e the eye's offset from the axis (at distance d), they sit at r w,
     for w = (r/d) e^ +- sqrt(1 - r^2/d^2) (n x e^). null with the eye inside. */
  function silhouette(n) {
    const { A, r } = st;
    const eA = sub(axes.eye, A);
    const e = sub(eA, scale(n, dot(eA, n)));
    const d = len(e);
    if (d <= r + 1e-6) return null;
    const eh = scale(e, 1 / d);
    const m = cross(n, eh);
    const k = r / d, q = Math.sqrt(1 - k * k);
    return [add(scale(eh, k * r), scale(m, q * r)), add(scale(eh, k * r), scale(m, -q * r))];
  }

  /* The translucent body between P0 and P1 on the axis, shaded across its
     width: darker at the edges, a highlight off-centre. */
  function body(W, n, P0, P1) {
    const sil = silhouette(n);
    if (!sil) return;
    const [wp, wm] = sil;
    const edgeP = [xy(add(P0, wp)), xy(add(P1, wp))];
    const edgeM = [xy(add(P1, wm)), xy(add(P0, wm))];
    const M = mid(P0, P1);
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

  /* The capped cylinder: the infinite one it is cut from, very faint;
     the plane of the cap being checked; the body between A and B; and the
     caps - a cap turned toward the eye drawn filled over the body, the other
     only as its ring, the far half seen through. */
  function drawCapped(W) {
    const { A, B, r } = st;
    const { n, span } = geo;
    const endLabels = () => {
      ctx.fillStyle = css(C.handle);
      label(ctx, xy(A), 'A', W.text, 'right', W.text * 0.6, true);
      label(ctx, xy(B), 'B', W.text, 'right', W.text * 0.6, true);
    };
    const ends = () => {
      ctx.fillStyle = css(C.handle);
      disc(ctx, xy(A), W.dot);
      disc(ctx, xy(B), W.dot);
    };
    if (!n) { ends(); endLabels(); return; }

    if (r <= 0) { ends(); endLabels(); return; }
    // the infinite cylinder P lies on, as far as the cube: very faint, and
    // hiding nothing (hidden() sees only the capped one)
    if (span) {
      ctx.globalAlpha = 0.15;
      body(W, n, along(A, n, span[0]), along(A, n, span[1]));
      ctx.globalAlpha = 1;
    }

    const [p1, p2] = perpBasis(n);
    // the plane of the cap being checked, a square about it
    const cap = st.hit && st.hit.cap;
    if (cap) {
      const X = st[cap], h = r + 1.2;
      const corner = (i, j) => xy(add(X, add(scale(p1, i * h), scale(p2, j * h))));
      const square = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      ctx.fillStyle = 'rgba(212, 160, 23, 0.12)';
      fillShape(ctx, square);
      ctx.strokeStyle = css(C.aux);
      ctx.globalAlpha = 0.7;
      stroke(ctx, square, W.thin, true);
      ctx.globalAlpha = 1;
    }

    const rings = { A: ring(A, p1, p2, r), B: ring(B, p1, p2, r) };
    // a cap faces the eye if the eye is on its outer side: -n at A, +n at B
    const facing = { A: dot(sub(axes.eye, A), n) < 0, B: dot(sub(axes.eye, B), n) > 0 };
    ctx.strokeStyle = css(BALL);
    ctx.globalAlpha = 0.35;
    for (const k of ['A', 'B']) if (!facing[k]) drawRuns(rings[k], false, { width: W.thin, dash: W.dash * 0.6 });
    ctx.globalAlpha = 1;

    body(W, n, A, B);
    for (const k of ['A', 'B']) {
      ctx.strokeStyle = css(BALL);
      if (!facing[k]) { drawRuns(rings[k], true, { width: W.thin }); continue; }
      const X = st[k], pts = [];
      for (let i = 0; i < 64; i++) {
        const u = (i / 64) * Math.PI * 2;
        pts.push(xy(add(X, add(scale(p1, r * Math.cos(u)), scale(p2, r * Math.sin(u))))));
      }
      ctx.fillStyle = 'rgba(120, 170, 215, 0.75)';
      fillShape(ctx, pts);
      stroke(ctx, pts, W.thin * 1.3, true);
    }

    // the radius, out from A toward the viewer's right, then A and B on top
    const edge = radiusEnd();
    ctx.strokeStyle = ctx.fillStyle = css(C.handle);
    stroke(ctx, [xy(A), xy(edge)], W.thin);
    disc(ctx, xy(edge), W.dot);
    label(ctx, xy(mid(A, edge)), 'r', W.text, 'center', W.text * 0.6);
    ends();
    endLabels();
  }

  /* Where the checks got to: P on the infinite cylinder (a ring), Q on the
     cap's plane with the line from the cap's centre - green within r, red
     beyond - and the hit, if any, as a green dot. Drawn last, over all. */
  function drawChecks(W) {
    const h = st.hit;
    if (!h || !(h.P || h.Q)) return;
    const ok = css(C.result), bad = css(C.accentA);
    if (h.Q) {
      ctx.strokeStyle = h.xq <= st.r ? ok : bad;
      dashed(ctx, [xy(st[h.cap]), xy(h.Q)], W.thin * 1.4, W.dash * 0.7);
    }
    // no P when D runs along the axis
    if (h.P) {
      ctx.strokeStyle = css(C.handle);
      ctx.lineWidth = W.thin * 1.4;
      ctx.beginPath();
      const pp = xy(h.P);
      ctx.arc(pp[0], pp[1], W.dot * 1.1, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (h.hitAt) {
      ctx.fillStyle = ok;
      disc(ctx, xy(h.hitAt), W.dot * 1.3);
    }
    if (h.Q && h.Q !== h.hitAt) {
      ctx.fillStyle = bad;
      disc(ctx, xy(h.Q), W.dot);
    }
    ctx.fillStyle = css(C.handle);
    if (h.P) label(ctx, xy(h.P), 'P', W.text, 'left', W.text * 0.75, true);
    if (h.Q) {
      ctx.fillStyle = h.xq <= st.r ? ok : bad;
      label(ctx, xy(h.Q), 'Q', W.text * 0.9, 'left', W.text * 0.75, true);   // above-right: A's label is up-left
    }
  }

  function paint() {
    const W = view.begin();
    axes = view.axes;
    prepare();
    const { S, D, r } = st;
    const cylinder = tube(st.kind);

    view.floor(W, GRID);

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
      disc(ctx, xy(along(S, D, 1)), W.dot);   // D's tip, to drag
    }

    // under the shape: whatever it hides
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#9aa3ab';
    drawRuns(back, true, BACK);
    ctx.strokeStyle = css(RAY);
    drawRuns(fwd, true, FWD_HIDDEN);
    ctx.globalAlpha = 1;
    if (sHidden) startAndDirection();

    if (st.kind === 'capped') drawCapped(W);
    else if (cylinder) drawCylinder(W);
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

    if (st.kind === 'capped') drawChecks(W);

    view.corner(W, 'drag a dot to move it · drag elsewhere to orbit · scroll to zoom');
    // why the discriminant is greyed out, when it is (see update())
    if (st.note) view.corner(W, st.note, 1, C.accentA, W.hint * 1.15);
  }

  return { paint: view.repaint, reset: view.reset };
}
