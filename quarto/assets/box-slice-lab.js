/*
 * box-slice-lab.js - cutting a box in two, for the Unity deck's 3D slice.
 *
 *   <div class="lab-mount" data-lab="box-slice"></div>
 *
 * Follows BoxCut's Block.Cut and BoxSlicer.Slice (UnityCourse/saber-course-
 * materials/tests/CutBox) a step at a time, with Prev / Next / Reset, in the
 * same order as the card's lab (slice-lab.js):
 *
 *   1. the cut in world space, as the slides build it: Slice Line = H v T,
 *      the blade from hilt H to tip T, and Slice Plane = Slice Line v S, the
 *      line swept along the swipe S
 *   2. into the box's model space - animated, so the box turns square - by
 *      the sandwich M (Slice Plane) M^-1, M the motor from world to model
 *      space. That is right for a box that is only moved and rotated, which
 *      the slides ask for (no scaling); Block.Cut's way, H and T moved as
 *      points and S as a direction and then joined, also copes with a
 *      stretched box. The self-test checks the two agree
 *   3. each corner's side: its distance to the cut, PMath.distance (positive on
 *      the normal's side, "above"), drawn as a grey drop
 *   4. one Next per face of the box, in BoxSlicer's order (right, left, front,
 *      back, top, bottom): the face is split exactly as the card is - corner
 *      by corner, and a crossing is the meet of the cut with the edge's line,
 *      new vertex = Slice Plane ^ (V_i v V_j) - with its part above in green, below in red, and
 *      the one edge it gives the cut face
 *   5. the cut face (the cap): one triangle from the centre to each edge. The
 *      edges are never put in order; each face’s winding points them the
 *      right way round
 *   6. the two halves back in world space, still together, then pushed apart
 *      along the world-space normal
 *
 * Coordinates are Unity's (x right, y up, z forward: left-handed). The view
 * is orbit3d.js, which is right-handed, so every point is drawn with z
 * flipped: the picture is what Unity's Scene view would show. The box stays
 * where data-box puts it, with a slider for its yaw. Sliders for H, T and
 * S; the black dots on H, T and the tip of S drag too, and the sliders follow. The blade is drawn as a
 * lightsaber: its hilt behind H, the blade glowing from H to T, and fading
 * copies of the blade behind it along -S, the way it swung in.
 *
 * The geometry is Math3d.cs's, formula for formula: points are x e032 +
 * y e013 + z e021 + w e123, planes a e1 + b e2 + c e3 + d e0 and lines
 * DualQuats; join is !(!a ^ !b) and the meet of a plane and a line is Math3d's
 * Plane3d ^ DualQuat. So the plane and the points on screen are the ones
 * Unity works out.
 */

import { C, slider, button, runLoop, fmt } from './lab-core.js';
import { stroke, dashed, arrow, disc, fillShape, label, css } from './draw2d.js';
import { makeOrbitView } from './orbit3d.js';

const EPS = 1e-5;                       // BoxSlicer: a corner this close to the cut counts as above
const PUSH = 0.45;                      // how far apart the halves end up
const SPEED = 1.4;                      // animation, in transitions per second
const SLEN = 0.9;                       // how long S is drawn
const SWING = 1.6;                      // the last step's swing, in seconds
const REACH = 0.3;                      // how far clear of the box the swing starts and ends
const HILT = 1.0;                       // how long the lightsaber's hilt is drawn, behind H

const GREY = '#9aa3ab';
const ABOVE = css(C.result);            // on the normal's side
const BELOW = css(C.accentA);
const CUT = css(C.accentB);
const EDGE = css(C.aux);
const FACE_TEXT = '#8a6500';             // the face being split, named: a dark yellow, to go with its outline
const CAP = '#178a72';                  // the cut face's edges and centre: a dark mint
const BOX = [176, 124, 84];             // a mint Aero: milk chocolate outside...
const MINT = [170, 232, 196];           // ...and mint green inside, on the cut face

const rad = (d) => (d * Math.PI) / 180;
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const mul = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
const unit = (p) => mul(p, 1 / (len(p) || 1));
const smooth = (t) => t * t * (3 - 2 * t);
// Unity's turn about y by a (Quaternion.Euler(0, a, 0)): x goes toward -z
const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];

/* --- Math3d.cs, formula for formula ---------------------------------------
   Vec4 [x, y, z, w]; Plane3d [e1, e2, e3, e0]; DualQuat
   [real, e23, e31, e12, e01, e02, e03, e0123]. */
const dualPoint = (v) => [v[0], v[1], v[2], v[3]];                  // !Vec4 -> Plane3d
const dualLine = (q) => [q[7], q[4], q[5], q[6], q[1], q[2], q[3], q[0]];
const meetPlanes = (a, b) => [0,                                     // Plane3d ^ Plane3d -> line
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
  a[3] * b[0] - a[0] * b[3], a[3] * b[1] - a[1] * b[3], a[3] * b[2] - a[2] * b[3], 0];
const meetPlaneLine = ([e1, e2, e3, e0], q) => [                     // Plane3d ^ DualQuat -> Vec4
  -e0 * q[1] + e2 * q[6] - e3 * q[5],
  -e0 * q[2] - e1 * q[6] + e3 * q[4],
  -e0 * q[3] + e1 * q[5] - e2 * q[4],
  e1 * q[1] + e2 * q[2] + e3 * q[3]];
const joinPoints = (a, b) => dualLine(meetPlanes(dualPoint(a), dualPoint(b)));       // a & b
const joinLinePoint = (q, v) => dualPoint(meetPlaneLine(dualPoint(v), dualLine(q))); // q & v
const normalize = (p) => { const m = Math.hypot(p[0], p[1], p[2]); return p.map((v) => v / m); };

/* The sandwich M X M^-1 needs a motor times a plane, which Math3d has no
   operator for, so here is the whole geometric product of 3D PGA: a
   multivector is 16 numbers, one per basis blade, the blade's bits saying which
   of e0, e1, e2, e3 it holds (e0 squares to 0, the rest to 1). Math3d's
   DualQuat and Plane3d go in and out through their named parts; e31 is -e13. */
function gp(a, b) {
  const out = new Array(16).fill(0);
  for (let i = 0; i < 16; i++) {
    if (!a[i]) continue;
    for (let j = 0; j < 16; j++) {
      if (!b[j] || (i & j & 1)) continue;          // e0 e0 = 0
      let swaps = 0;                                // reorder the factors into canonical order
      for (let k = i >> 1; k; k >>= 1) swaps += popcount(k & j);
      out[i ^ j] += (swaps & 1 ? -1 : 1) * a[i] * b[j];
    }
  }
  return out;
}
const popcount = (x) => { let c = 0; for (; x; x &= x - 1) c++; return c; };
// DualQuat [real, e23, e31, e12, e01, e02, e03, e0123] and Plane3d [e1, e2, e3, e0]
const DQ_BLADES = [[0, 1], [12, 1], [10, -1], [6, 1], [3, 1], [5, 1], [9, 1], [15, 1]];
const PL_BLADES = [[2, 1], [4, 1], [8, 1], [1, 1]];
const toMv = (vals, blades) => { const m = new Array(16).fill(0); blades.forEach(([b, sg], i) => { m[b] += sg * vals[i]; }); return m; };
const fromMv = (m, blades) => blades.map(([b, sg]) => sg * m[b]);
const dqMul = (a, b) => fromMv(gp(toMv(a, DQ_BLADES), toMv(b, DQ_BLADES)), DQ_BLADES);
// DQMath.translate, DQMath.rotate(angleDeg, axis) and DQMath.inverse
const translate = (t) => [1, 0, 0, 0, -t[0] / 2, -t[1] / 2, -t[2] / 2, 0];
const rotate = (deg, [x, y, z]) => {
  const h = (deg * Math.PI) / 360, c = Math.cos(h), sn = Math.sin(h);
  return [c, -x * sn, -y * sn, -z * sn, 0, 0, 0, 0];
};
const inverse = (q) => [q[0], -q[1], -q[2], -q[3], -q[4], -q[5], -q[6], q[7]];
// M P M^-1, for a normalised motor M (so M^-1 is its reverse): a plane
const sandwich = (m, plane) =>
  fromMv(gp(gp(toMv(m, DQ_BLADES), toMv(plane, PL_BLADES)), toMv(inverse(m), DQ_BLADES)), PL_BLADES);
const distance = (p, pl) => pl[0] * p[0] + pl[1] * p[1] + pl[2] * p[2] + pl[3];      // PMath.distance
const pos4 = (p) => [p[0], p[1], p[2], 1];
const dir4 = (p) => [p[0], p[1], p[2], 0];

/* --- the box, as BoxSlicer's face table ---------------------------------- */
/* Each face from its two flat directions u and v: normal u x v, corners
   centre + (-u - v)/2, (u - v)/2, (u + v)/2, (-u + v)/2. */
const R = [1, 0, 0], L = [-1, 0, 0], U = [0, 1, 0], D = [0, -1, 0], F = [0, 0, 1], B = [0, 0, -1];
const FACES = [
  ['right', '+x', B, U], ['left', '−x', F, U], ['front', '+z', R, U],
  ['back', '−z', L, U], ['top', '+y', R, B], ['bottom', '−y', R, F],
].map(([name, axis, u, v]) => {
  const n = cross(u, v), c = mul(n, 0.5);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => add(c, add(mul(u, s / 2), mul(v, t / 2))));
  return { name, axis, n, corners };
});
/* Names for the 8 corners, for the picture only (BoxSlicer never numbers
   them): 0-3 round the bottom, 4-7 the same round the top. */
const CORNERS = [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]
  .map((p) => mul(p, 0.5));
const cornerId = (p) => CORNERS.findIndex((q) => len(sub(p, q)) < 1e-9);

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const xName = (k) => `new\u00a0${k}`;   // non-breaking: never split over a line
// (the long form below, too)   // the points the cut adds: new vertex 1, 2, ... ("new 1" for short)
const longName = (x) => (x.name.startsWith('new\u00a0') ? `new vertex\u00a0${x.name.slice(4)}` : `corner ${x.name}`);

/* BoxSlicer.Slice, one event per face so the lab can step through them. */
function slice(cut) {
  const pl = normalize(cut);
  const names = new Map();                   // a crossing's name, by its box edge (picture only)
  const faces = FACES.map((face) => {
    const up = [], down = [], crossings = [];
    let goingDown = null, goingUp = null;
    const d = face.corners.map((p) => distance(p, pl));
    for (let k = 0; k < 4; k++) {
      const a = face.corners[k], b = face.corners[(k + 1) % 4];
      const da = d[k], db = d[(k + 1) % 4];
      const aUp = da >= -EPS, bUp = db >= -EPS;
      const ia = cornerId(a), ib = cornerId(b);
      (aUp ? up : down).push({ p: a, name: String(ia) });
      if (aUp === bUp) continue;
      const m = meetPlaneLine(pl, joinPoints(pos4(a), pos4(b)));
      const snap = Math.abs(da) <= EPS ? ia : Math.abs(db) <= EPS ? ib : null;
      const p = snap !== null ? CORNERS[snap] : [m[0] / m[3], m[1] / m[3], m[2] / m[3]];
      const key = Math.min(ia, ib) * 8 + Math.max(ia, ib);
      if (!names.has(key)) names.set(key, snap !== null ? String(snap) : xName(names.size + 1));
      const x = { p, name: names.get(key), meet: m, snap, ends: [ia, ib], isCross: true };
      up.push(x); down.push(x); crossings.push(x);
      if (aUp) goingDown = x; else goingUp = x;
    }
    // the part above runs goingDown -> goingUp along the cut, so the half
    // above's cap runs back the other way: goingUp -> goingDown
    const capEdge = crossings.length ? { from: goingUp, to: goingDown } : null;
    return { ...face, d, up, down, crossings, capEdge };
  });
  const edges = faces.filter((f) => f.capEdge).map((f) => f.capEdge);
  let centre = [0, 0, 0];
  edges.forEach((e) => { centre = add(centre, add(e.from.p, e.to.p)); });
  if (edges.length) centre = mul(centre, 1 / (2 * edges.length));
  return { pl, faces, edges, centre, missed: edges.length === 0 };
}

/* The two halves as lists of polygons in model space, with their outward
   normals: each face's part, then the cap's triangles. */
function halves(s) {
  const n = [s.pl[0], s.pl[1], s.pl[2]];
  const above = [], below = [];
  for (const f of s.faces) {
    if (f.up.length >= 3) above.push({ pts: f.up.map((q) => q.p), n: f.n });
    if (f.down.length >= 3) below.push({ pts: f.down.map((q) => q.p), n: f.n });
  }
  for (const e of s.edges) {
    above.push({ pts: [s.centre, e.from.p, e.to.p], n: mul(n, -1), cap: true });
    below.push({ pts: [s.centre, e.to.p, e.from.p], n, cap: true });
  }
  return { above, below };
}

/* Volume from the polygons (divergence theorem): a check that each half is
   closed and wound outward. Unity's front face is clockwise, so a front-facing
   triangle a, b, c has outward normal (b - a) x (c - a), and each triangle
   adds a . (b x c) / 6. */
function volume(polys) {
  let v = 0;
  for (const { pts } of polys) {
    for (let i = 1; i < pts.length - 1; i++) v += dot(pts[0], cross(pts[i], pts[i + 1])) / 6;
  }
  return v;
}

export function mountBoxSliceLab(el, opts = {}) {
  el.classList.add('lab', 'lab-ray', 'lab-slice', 'lab-box-slice');

  const box = [...(opts.box ?? [0, 0, 25])];         // x, z and yaw in degrees: only yaw has a slider
  // By default a clean vertical cut through the box's centre: the blade level
  // above the box, along x, swiped straight down - the plane z = 0
  const H = [...(opts.hilt ?? [-2, 0.8, 0])];
  const T = [...(opts.tip ?? [2, 0.8, 0])];
  const S = [...(opts.swipe ?? [0, -1, 0])];

  /* --- the steps --------------------------------------------------------- */
  const SIDES = 2;
  const FIRST_FACE = 3;
  const CAP_STEP = FIRST_FACE + FACES.length;
  const WORLD = CAP_STEP + 1;
  const LAST = WORLD + 1;
  let step = 0;
  let space = 0, spaceTo = 0;               // 0 world, 1 model
  let apart = 0, apartTo = 0;               // 0 together, 1 pushed apart
  let swing = 0;                            // the last step: the saber's swing through the block, 0 to 1
  const targets = () => {
    spaceTo = step >= 1 && step < WORLD ? 1 : 0;
    apartTo = step === LAST ? 1 : 0;
  };

  /* --- layout, as slice-lab.js -------------------------------------------- */
  const inputs = document.createElement('div');
  inputs.className = 'ray-inputs';
  inputs.style.setProperty('--ray-cols', 4);
  el.appendChild(inputs);

  const I = (s) => `<i>${s}</i>`;
  const sliders = {};
  // the sliders set arr[from], arr[from + 1], ...
  function group(key, title, cls, specs, arr, from = 0) {
    const g = document.createElement('div');
    g.className = `ray-group ${cls}`;
    const h = document.createElement('div');
    h.className = 'ray-group-title';
    h.innerHTML = title;
    const controls = document.createElement('div');
    controls.className = 'lab-controls';
    g.append(h, controls);
    inputs.appendChild(g);
    sliders[key] = specs.map((s, i) =>
      slider(controls, { ...s, value: arr[from + i] }, (v) => { arr[from + i] = v; update(); }));
  }
  const one = (v) => v.toFixed(1);
  const xyz = (min, max) => ['x', 'y', 'z'].map((a) => ({ label: a, min, max, step: 0.1, format: one }));

  const row = document.createElement('div');
  row.className = 'ray-row';
  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const out = document.createElement('div');
  out.className = 'ray-out slice-out';
  row.append(stageEl, out);

  const caption = document.createElement('div');
  caption.className = 'slice-caption';
  const working = document.createElement('div');
  working.className = 'slice-working box-working';
  const listBox = document.createElement('div');
  listBox.className = 'cross-components slice-lists';
  const listRow = (name, colour, where) => {
    const n = document.createElement('span');
    n.className = 'cross-name';
    n.style.color = colour;
    n.textContent = name;
    const v = document.createElement('span');
    v.className = 'cross-vector';
    const list = document.createElement('b');
    list.style.color = colour;
    v.append(`This face’s part ${where} the cut: `, list);
    listBox.append(n, v);
    return list;
  };
  const listA = listRow('▲', ABOVE, 'above');
  const listB = listRow('▼', BELOW, 'below');
  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  out.append(caption, working, listBox, buttons);

  const go = (s) => { step = Math.max(0, Math.min(LAST, s)); targets(); update(); };
  button(buttons, 'Prev', () => go(step - 1));
  button(buttons, 'Next', () => go(step + 1));
  button(buttons, 'Reset', () => go(0));
  button(buttons, 'Reset view', () => view.reset());
  // The working (the multivectors, distances and meets) is hidden until asked
  // for, so the steps read as pictures and captions first
  let showMath = false;
  // under the caption, where it stays put whether the working shows or not
  const mathRow = document.createElement('div');
  mathRow.className = 'box-math-row';
  caption.after(mathRow);
  const mathButton = button(mathRow, 'Show math', () => setMath(!showMath));
  function setMath(on) {
    showMath = on;
    working.style.display = on ? '' : 'none';
    mathButton.textContent = on ? 'Hide math' : 'Show math';
  }
  setMath(false);

  /* --- the maths, from the sliders ---------------------------------------- */
  let geo = null;
  function solve() {
    const th = rad(box[2]), pos = [box[0], 0, box[1]];
    // the slides: Slice Line = H v T, Slice Plane = Slice Line v S, in world space
    const world = joinLinePoint(joinPoints(pos4(H), pos4(T)), dir4(S));
    // then into the box's model space by the sandwich with M, the motor from
    // world to model space: the inverse of the box's own, translate * rotate.
    // Right for a box that is only moved and rotated (no scale)
    const M = inverse(dqMul(translate(pos), rotate(box[2], [0, 1, 0])));
    const model = sandwich(M, world);
    const nWorld = unit([world[0], world[1], world[2]]);
    const s = slice(model);
    // for the self-test: the same plane the other way, Block.Cut's - H, T and S
    // moved into model space first, then joined
    const Hm = rotY(sub(H, pos), -th), Tm = rotY(sub(T, pos), -th), Sm = rotY(S, -th);
    const joined = joinLinePoint(joinPoints(pos4(Hm), pos4(Tm)), dir4(Sm));
    // (Hm and Tm also lay out the plane's rectangle along the blade, in model space)
    geo = { th, pos, M, model, joined, world, nWorld, Hm, Tm, s, halves: halves(s) };
  }

  const tint = (html, colour) => `<span style="color:${colour}">${html}</span>`;
  const above = tint('above', ABOVE), below = tint('below', BELOW);
  function describe() {
    const { s } = geo;
    if (step === 0) return `The cut: the blade from hilt ${I('H')} to tip ${I('T')} is the slice line, `
      + `and swept along the swipe ${I('S')} it makes the slice plane`;
    if (step === 1) return `Into the box’s model space with the sandwich: `
      + `<span class="slice-nowrap">${I('M')} (slice plane) ${I('M')}<sup>−1</sup></span>`;
    if (step === SIDES) return `Each corner’s side of the cut: <code>PMath.distance(vertex, planeModelSpace)</code>, `
      + `${above} on the normal’s side, ${below} the rest`;
    if (step < CAP_STEP) {
      const f = s.faces[step - FIRST_FACE];
      const k = step - FIRST_FACE + 1;
      // the face's corners by the numbers on the picture
      const which = `Face ${k} of 6, ${tint(f.name, FACE_TEXT)}, corners ${f.corners.map(cornerId).join(', ')}`;
      if (!f.crossings.length) {
        return `${which}: all four are ${f.up.length ? above : below}, so the whole face goes to that half`;
      }
      return `${which}: split like the card. It gives the cut face one edge, `
        + `${tint(f.capEdge.from.name, EDGE)} → ${tint(f.capEdge.to.name, EDGE)}`;
    }
    if (s.missed) return 'The cut misses the box: every corner is on one side, so there is nothing to split';
    if (step === CAP_STEP) return `The cut face: one triangle from the centre to each of its ${s.edges.length} edges. `
      + 'They are never sorted: each face\'s winding already points its edge the right way round';
    if (step === WORLD) return 'Back in world space';
    return `Push the half ${above} along the normal, the half ${below} the other way`;
  }

  // a multivector as Math3d writes it: '' for the real part, else the basis
  const coef = (v) => Math.abs(v).toFixed(2);
  // terms that round to 0.00 are left out, so a motor's eight parts fit
  const mv = (vs, bases) => {
    const terms = vs.map((v, i) => [v, bases[i]]).filter(([v]) => Math.abs(v) >= 0.005);
    if (!terms.length) return '0';
    return terms.map(([v, base], k) => {
      const term = coef(v) + (base === '' ? '' : `&thinsp;e<sub>${base}</sub>`);
      return (k === 0 ? (v < 0 ? '−' : '') : (v < 0 ? ' − ' : ' + ')) + term;
    }).join('');
  };
  const PT = ['032', '013', '021', '123'], PL = ['1', '2', '3', '0'];
  const DQ = ['', '23', '31', '12', '01', '02', '03', '0123'];
  const rowOf = (lhs, rhs) => `<div class="slice-pga">${lhs} = ${rhs}</div>`;
  const n = (v) => fmt(v).replace('-', '−');
  const dName = (i) => `d${SUB[i]}`;
  function workingFor() {
    const { s } = geo;
    const nm = (x, sub) => (sub ? `${I(x)}<sub>${sub}</sub>` : I(x));
    if (step === 0) {
      return rowOf(nm('H'), mv(pos4(H), PT)) + rowOf(nm('T'), mv(pos4(T), PT)) + rowOf(nm('S'), mv(dir4(S), PT))
        + `<div class="slice-prose">Slice Line = ${I('H')} ∨ ${I('T')}, Slice Plane = Slice Line ∨ ${I('S')}</div>`
        + rowOf('Slice Plane', mv(geo.world, PL));
    }
    if (step === 1) {
      return rowOf(nm('M'), mv(geo.M, DQ))
        + rowOf('Slice Plane, world', mv(geo.world, PL)) + rowOf('Slice Plane, model', mv(geo.model, PL));
    }
    if (step === SIDES) {
      const ds = CORNERS.map((p, i) => {
        const d = distance(p, s.pl);
        return tint(`${dName(i)} = ${n(d)}`, d >= -EPS ? ABOVE : BELOW);
      });
      return rowOf('Slice Plane, normalised', mv(s.pl, PL))
        + `<div class="box-ds">${ds.map((d) => `<span>${d}</span>`).join('')}</div>`;
    }
    if (step < CAP_STEP) {
      const f = s.faces[step - FIRST_FACE];
      const ids = f.corners.map(cornerId);
      let html = `<div class="box-ds">${ids.map((id, k) =>
        `<span>${tint(`${dName(id)} = ${n(f.d[k])}`, f.d[k] >= -EPS ? ABOVE : BELOW)}</span>`).join('')}</div>`;
      for (const x of f.crossings) {
        const [i, j] = x.ends;
        if (x.snap !== null) {
          html += `<div class="slice-prose">Corner ${x.snap} is on the cut, so it is the crossing itself</div>`;
          continue;
        }
        html += `<div class="slice-pga">${tint(longName(x), EDGE)} = Slice Plane ∧ (${nm('V')}<sub>${i}</sub> ∨ ${nm('V')}<sub>${j}</sub>)</div>`
          + `<div class="slice-pga box-indent">= ${mv(x.meet, PT)}</div>`;
      }
      return html;
    }
    if (s.missed) return '';
    if (step === CAP_STEP) {
      const c = s.centre.map((v) => n(v)).join(', ');
      return `<div>centre = (${c})</div>`
        + `<div class="slice-prose">Edges, as the faces gave them: ${s.edges.map((e) =>
          `${tint(e.from.name, EDGE)}→${tint(e.to.name, EDGE)}`).join(', ')}</div>`;
    }
    if (step === WORLD) {
      return '<div class="slice-prose">Each face keeps its own flat UV map, so no UV is ever lerped.</div>'
        + `<div>${tint(`above: ${geo.halves.above.length} polygons`, ABOVE)}&emsp;${tint(`below: ${geo.halves.below.length}`, BELOW)}</div>`;
    }
    return '';
  }

  function update() {
    if (!built) return;
    solve();
    caption.innerHTML = describe();
    working.innerHTML = workingFor();
    const onFace = step >= FIRST_FACE && step < CAP_STEP;
    const f = onFace ? geo.s.faces[step - FIRST_FACE] : null;
    const names = (l) => (l.length ? l.map((q) => q.name).join(', ') : '–');
    listA.textContent = f ? names(f.up) : '';
    listB.textContent = f ? names(f.down) : '';
    listBox.style.visibility = onFace ? '' : 'hidden';
    // for the self-test
    const { s } = geo;
    el.dataset.step = String(step);
    el.dataset.model = s.pl.map((v) => v.toFixed(2)).join(' ');
    el.dataset.joined = normalize(geo.joined).map((v) => v.toFixed(2)).join(' ');   // Block.Cut's way, to compare
    el.dataset.above = String(CORNERS.filter((p) => distance(p, s.pl) >= -EPS).length);
    el.dataset.capEdges = s.edges.length ? s.edges.map((e) => `${e.from.name}>${e.to.name}`).join(', ') : '–';
    el.dataset.volumes = `${volume(geo.halves.above).toFixed(4)} ${volume(geo.halves.below).toFixed(4)}`;
    el.dataset.faceUp = f ? names(f.up) : '';
    el.dataset.faceDown = f ? names(f.down) : '';
    dirty = true;
  }

  /* --- the view ----------------------------------------------------------- */
  // World to view: R(-th m)(p - pos m), m going 0 (world) to 1 (model); then z
  // flipped for orbit3d's right-handed frame
  const m = () => smooth(space);
  const flip = ([x, y, z]) => [x, y, -z];
  const toView = (p) => flip(rotY(sub(p, mul(geo.pos, m())), -geo.th * m()));
  const fromView = (q) => add(rotY(flip(q), geo.th * m()), mul(geo.pos, m()));
  const dirToView = (d) => flip(rotY(d, -geo.th * m()));
  const modelToWorld = (q, off = [0, 0, 0]) => add(add(rotY(q, geo.th), geo.pos), off);
  const modelToView = (q, off) => toView(modelToWorld(q, off));
  const bladeMid = () => mul(add(H, T), 0.5);
  const sTip = () => add(T, mul(unit(S), SLEN));       // S drawn from the tip: it is the tip's swing

  /* The last step swings the saber through the block. Measured along S, it
     goes from just clear of the box on the -S side (moved there in the first
     quarter) to just clear of it on the +S side. The halves part once the
     blade's middle is past the box's. Everywhere else it sits on the cut.
     Returns the blade's offset and how far the halves have parted (0 to 1). */
  function swingAt() {
    if (step !== LAST) return { off: [0, 0, 0], parted: 0 };
    const su = unit(S);
    const along = (p) => dot(p, su);
    const box = CORNERS.map((q) => along(modelToWorld(q)));
    const [c0, c1] = [Math.min(...box), Math.max(...box)];
    const [b0, b1] = [Math.min(along(H), along(T)), Math.max(along(H), along(T))];
    const o0 = c0 - REACH - b1, o1 = c1 + REACH - b0;   // the blade wholly before the box, then wholly past it
    const wind = 0.25;
    if (swing < wind) return { off: mul(su, o0 * smooth(swing / wind)), parted: 0 };
    const o = o0 + (o1 - o0) * smooth((swing - wind) / (1 - wind));
    const middle = (c0 + c1) / 2 - (b0 + b1) / 2;            // the offset that has the two middles level
    return { off: mul(su, o), parted: Math.min(1, Math.max(0, (o - middle) / (o1 - middle))) };
  }
  const snap = (v, lo, hi) => Math.round(Math.min(hi, Math.max(lo, v)) * 10) / 10;
  const view = makeOrbitView(stageEl, {
    yaw: opts.yaw ?? -38, pitch: opts.pitch ?? 24, view: opts.view ?? 1.7, target: [0, 0, 0], lift: 0.05,
    handles: () => { const { off } = swingAt(); return [H, T, sTip()].map((p) => toView(add(p, off))); },
    onDrag: (i, q) => {
      const w = sub(fromView(q), swingAt().off);   // the dots move with the swing
      if (i === 0) H.forEach((_, k) => sliders.hilt[k].set(snap(w[k], -2.5, 2.5)));
      else if (i === 1) T.forEach((_, k) => sliders.tip[k].set(snap(w[k], -2.5, 2.5)));
      else {
        const d = unit(sub(w, T));
        S.forEach((_, k) => sliders.swipe[k].set(snap(d[k], -1, 1)));
      }
      update();
    },
  }, repaint);
  const { ctx } = view;

  const xy = (p) => view.xy(p);
  const depth = (p) => dot(sub(p, view.target), view.axes.back);
  const shadeRgb = (nView, base, lo = 0.62) => {
    const light = unit(add(add(view.axes.back, mul(view.axes.up, 0.7)), mul(view.axes.right, -0.3)));
    const k = lo + (1 - lo) * Math.max(0, dot(unit(nView), light));
    return base.map((c) => c * k);
  };
  const shade = (nView, base, lo) => rgbOf(shadeRgb(nView, base, lo));

  const rgbOf = (rgb) => `rgb(${rgb.map(Math.round).join(',')})`;

  /* Polygons in view space, far ones first: painter's algorithm, as
     transform-lab3d.js does it. */
  function paintPolys(polys) {
    polys.map((p) => ({ ...p, z: p.pts.reduce((a, q) => a + depth(q), 0) / p.pts.length }))
      .sort((a, b) => a.z - b.z)
      .forEach((p) => {
        ctx.globalAlpha = p.alpha ?? 1;
        if (p.fill) { ctx.fillStyle = p.fill; fillShape(ctx, p.pts.map(xy)); }
        ctx.globalAlpha = 1;
        if (p.line) { ctx.strokeStyle = p.line; stroke(ctx, p.pts.map(xy), p.width, !p.open); }
      });
  }

  /* A blade from a to b (view space): a wide faint glow, the blade in the
     cut's blue, and a pale core. */
  /* On the last step the saber swings through the block, and the halves hide
     what is behind them: these are the halves' faces turned to the camera,
     each { pts, n } in view space. null on every other step, where the saber
     is always drawn over everything so it can be seen. */
  let occluders = null;
  function hiddenAt(p) {
    const eye = view.axes.eye, d = sub(p, eye);
    for (const { pts, n } of occluders) {
      const dn = dot(d, n);
      if (Math.abs(dn) < 1e-9) continue;
      const t = dot(sub(pts[0], eye), n) / dn;          // where the line from the eye meets the face's plane
      if (!(t > 0 && t < 1 - 1e-6)) continue;           // not between the eye and p
      const hit = add(eye, mul(d, t));
      let pos = 0, neg = 0;                             // inside the (convex) face: on one side of every edge
      for (let i = 0; i < pts.length; i++) {
        const c = dot(cross(sub(pts[(i + 1) % pts.length], pts[i]), sub(hit, pts[i])), n);
        if (c > 1e-9) pos++; else if (c < -1e-9) neg++;
      }
      if (!(pos && neg)) return true;
    }
    return false;
  }
  /* The parts of the segment a to b (view space) that are not hidden. */
  function visibleRuns(a, b, n = 80) {
    if (!occluders) return [[a, b]];
    const out = [];
    let start = null, prev = null;
    for (let i = 0; i <= n; i++) {
      const p = add(a, mul(sub(b, a), i / n));
      const shown = !hiddenAt(p);
      if (shown && !start) start = p;
      if (!shown && start) { if (start !== prev) out.push([start, prev]); start = null; }
      prev = p;
    }
    if (start && start !== prev) out.push([start, prev]);
    return out;
  }

  function blade(W, a, b, alpha) {
    for (const [p, q] of visibleRuns(a, b)) {
      const pts = [xy(p), xy(q)];
      ctx.strokeStyle = CUT;
      ctx.globalAlpha = alpha * 0.2;
      stroke(ctx, pts, W.ray * 4.6);
      ctx.globalAlpha = alpha * 0.9;
      stroke(ctx, pts, W.ray * 2.2);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#e6f2ff';
      stroke(ctx, pts, W.ray * 0.8);
    }
  }

  /* The lightsaber, moved by `off`: fading copies of the blade behind it
     along -S, the way it swung in (except on the last step, where it really swings); then its hilt, behind H, a dark grip with
     ridges and a silver emitter at H; then the blade itself, H to T. */
  function saber(W, alpha, off) {
    const h = add(H, off), t = add(T, off);            // the blade where the swing has it
    const back = mul(unit(S), -1);
    // the trail shows the swipe on the still steps; on the last, the swing itself does
    if (step !== LAST) {
      [[0.54, 0.08], [0.36, 0.14], [0.18, 0.22]].forEach(([k, a]) =>
        blade(W, toView(add(h, mul(back, k))), toView(add(t, mul(back, k))), alpha * a));
    }

    const along = unit(sub(t, h));
    const atV = (k) => toView(add(h, mul(along, -k)));         // k behind H, along the hilt
    const at = (k) => xy(atV(k));
    const [b0, e0] = [at(HILT), at(HILT * 0.25)];
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'butt';
    const part = (from, to, colour, width) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      for (const [p, q] of visibleRuns(atV(from), atV(to), 24)) {
        ctx.beginPath(); ctx.moveTo(...xy(p)); ctx.lineTo(...xy(q)); ctx.stroke();
      }
    };
    part(HILT, HILT * 0.25, '#2b2f33', W.ray * 4.4);          // the grip
    part(HILT * 0.25, 0, '#a9b1b9', W.ray * 5.2);             // the emitter
    // ridges across the grip, square to it on screen
    const dx = e0[0] - b0[0], dy = e0[1] - b0[1], l = Math.hypot(dx, dy) || 1;
    const px = (-dy / l) * W.ray * 2.2, py = (dx / l) * W.ray * 2.2;
    ctx.strokeStyle = '#6c757d';
    ctx.lineWidth = W.thin;
    for (const u of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
      if (occluders && hiddenAt(atV(HILT - HILT * 0.75 * u))) continue;   // a ridge behind a half
      const c = [b0[0] + dx * u, b0[1] + dy * u];
      ctx.beginPath(); ctx.moveTo(c[0] - px, c[1] - py); ctx.lineTo(c[0] + px, c[1] + py); ctx.stroke();
    }
    ctx.lineCap = 'round';
    blade(W, toView(h), toView(t), alpha);
    ctx.globalAlpha = 1;
  }

  function repaint() {
    if (!built || !geo) return;
    const W = view.begin();
    const { s } = geo;
    const face = step >= FIRST_FACE && step < CAP_STEP ? step - FIRST_FACE : -1;
    const done = (k) => step >= CAP_STEP || k <= face;
    const split = step >= WORLD && !s.missed;
    occluders = null;   // set while the halves are drawn, on the last step

    // the floor, faint, under everything, fixed to the view
    ctx.strokeStyle = css(C.grid);
    for (let i = -3; i <= 3; i++) {
      stroke(ctx, [xy([i, -1.25, -3]), xy([i, -1.25, 3])], W.grid);
      stroke(ctx, [xy([-3, -1.25, i]), xy([3, -1.25, i])], W.grid);
    }

    // the cut plane, as a translucent rectangle with its edges along the
    // blade and square to it: as long as the blade, and wide enough to take
    // in the whole box, with a margin
    const nM = [s.pl[0], s.pl[1], s.pl[2]];
    let planeAt = null;   // where P's label goes, drawn last so the box can't hide it
    if (!split) {
      const o = geo.Hm;                                   // in model space, like the plane
      const a = unit(sub(geo.Tm, geo.Hm)), b = cross(nM, a);
      const us = [0, len(sub(geo.Tm, geo.Hm))], vs = [0];
      for (const p of CORNERS) { us.push(dot(sub(p, o), a)); vs.push(dot(sub(p, o), b)); }
      const [u0, u1] = [Math.min(...us) - 0.15, Math.max(...us) + 0.15];
      const [v0, v1] = [Math.min(...vs) - 0.3, Math.max(...vs) + 0.3];
      const sq = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => modelToView(add(o, add(mul(a, u), mul(b, v)))));
      ctx.fillStyle = CUT;
      ctx.globalAlpha = 0.12;
      fillShape(ctx, sq.map(xy));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = CUT;
      dashed(ctx, [...sq, sq[0]].map(xy), W.thin, W.dash);
      // P's label inside one of the long edges, a quarter of the way along
      // from H's end - clear of the box, T and S - on whichever side of the
      // blade sits farther, on screen, from the box's centre
      const centre = xy(modelToView([0, 0, 0]));
      const u = u0 + (u1 - u0) * 0.22;
      planeAt = [v0 + 0.22, v1 - 0.22].map((v) => xy(modelToView(add(o, add(mul(a, u), mul(b, v))))))
        .reduce((best, q) => (Math.hypot(q[0] - centre[0], q[1] - centre[1])
          > Math.hypot(best[0] - centre[0], best[1] - centre[1]) ? q : best));
    }

    if (split) {
      // the two halves, solid, pushed apart along the world-space normal.
      // Each is closed and convex, so only the polygons facing the camera are
      // drawn (back-face culling), and within a half those never overlap. So
      // no sorting: the half on the far side of the cut goes down first and
      // the near one over it - which hides the far half's cut face while the
      // two are still together. Sorted all together instead, that cut face
      // would show through the near half.
      const k = smooth(apart) * PUSH;
      const aboveNear = dot(dirToView(geo.nWorld), view.axes.back) > 0;
      const halfList = [[geo.halves.above, 1, ABOVE], [geo.halves.below, -1, BELOW]];
      if (aboveNear) halfList.reverse();
      occluders = step === LAST ? [] : null;
      for (const [list, sign, colour] of halfList) {
        const polys = [];
        const off = mul(geo.nWorld, sign * k);
        for (const p of list) {
          const nv = dirToView(rotY(p.n, geo.th));
          if (dot(nv, view.axes.back) <= 0) continue;
          const pts = p.pts.map((q) => modelToView(q, off));
          if (occluders) occluders.push({ pts, n: unit(nv) });
          if (p.cap) {
            // mint; each triangle outlined in its own fill, which hides the seams between them
            const fill = shade(nv, MINT, 0.9);
            polys.push({ pts, fill, line: fill, width: W.thin * 0.6 });
          } else {
            polys.push({ pts, fill: shade(nv, BOX), line: colour, width: W.thin * 1.4 });
          }
        }
        paintPolys(polys);
      }
    } else {
      const polys = [];
      FACES.forEach((f, k) => {
        const ev = s.faces[k];
        const nv = dirToView(rotY(f.n, geo.th));
        if (step >= FIRST_FACE && done(k)) {
          // this face's parts: above in green, below in red - strong for the
          // face being split now, faded for the ones split before it
          const now = k === face || step >= CAP_STEP;
          for (const [part, colour] of [[ev.up, ABOVE], [ev.down, BELOW]]) {
            if (part.length < 3) continue;
            polys.push({ pts: part.map((q) => modelToView(q.p)), fill: colour, alpha: now ? 0.4 : 0.12,
              line: colour, width: now ? W.thin : W.thin * 0.5 });
          }
        } else {
          polys.push({ pts: f.corners.map((q) => modelToView(q)), fill: shade(nv, BOX), alpha: step >= SIDES ? 0.35 : 0.85,
            line: '#22282e', width: W.thin * 0.8 });
        }
      });
      paintPolys(polys);

      // this face, outlined in yellow
      if (face >= 0) {
        ctx.strokeStyle = EDGE;
        ctx.globalAlpha = 0.9;
        stroke(ctx, FACES[face].corners.map((q) => xy(modelToView(q))), W.ray * 1.6, true);
        ctx.globalAlpha = 1;
      }
      // the cap's edges so far, each from the face that gave it, as arrows
      const capEdges = s.faces.filter((f, k) => f.capEdge && (step >= CAP_STEP || k <= face)).map((f) => f.capEdge);
      if (step === CAP_STEP && !s.missed) {
        const c = modelToView(s.centre);
        for (const e of capEdges) {
          ctx.fillStyle = rgbOf(MINT);
          ctx.globalAlpha = 0.8;
          fillShape(ctx, [c, modelToView(e.from.p), modelToView(e.to.p)].map(xy));
          ctx.globalAlpha = 1;
          ctx.strokeStyle = CAP;
          dashed(ctx, [xy(c), xy(modelToView(e.from.p))], W.thin, W.dash);
        }
        ctx.fillStyle = CAP;
        disc(ctx, xy(c), W.dot);
      }
      ctx.strokeStyle = ctx.fillStyle = CAP;
      for (const e of capEdges) {
        const a = xy(modelToView(e.from.p)), b = xy(modelToView(e.to.p));
        const shrink = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
        arrow(ctx, shrink(a, b, 0.08), shrink(a, b, 0.92), W.arrow * 0.7);
      }

      // the sides: a grey drop from each corner onto the cut
      if (step === SIDES) {
        ctx.strokeStyle = GREY;
        CORNERS.forEach((p) => {
          const d = distance(p, s.pl);
          dashed(ctx, [xy(modelToView(p)), xy(modelToView(sub(p, mul(nM, d))))], W.thin, W.dash);
        });
      }

      // the corners, and the crossings found so far
      CORNERS.forEach((p, i) => {
        const d = distance(p, s.pl);
        ctx.fillStyle = step >= SIDES ? (d >= -EPS ? ABOVE : BELOW) : '#22282e';
        disc(ctx, xy(modelToView(p)), W.dot * 0.9);
        // the corners' names, except on the cap, where the crossings matter
        if (step !== CAP_STEP) label(ctx, xy(modelToView(mul(p, 1.3))), String(i), W.text * 0.85, 'center', 0, true);
      });
      const seen = new Set();
      s.faces.forEach((f, k) => {
        if (!(step >= CAP_STEP || k <= face)) return;
        for (const x of f.crossings) {
          if (seen.has(x.name) || x.snap !== null) continue;
          seen.add(x.name);
          ctx.fillStyle = EDGE;
          disc(ctx, xy(modelToView(x.p)), W.dot * 1.05);
          ctx.fillStyle = '#22282e';
          label(ctx, xy(modelToView(mul(x.p, 1.22))), x.name, W.text * 0.85, 'center', 0, true);
        }
      });
    }

    // the face being split, named on it, over everything but P
    if (face >= 0 && !split) {
      const f = FACES[face];
      ctx.fillStyle = FACE_TEXT;
      label(ctx, xy(modelToView(mul(f.n, 0.5))), f.name, W.text, 'center', 0, true);
    }
    if (planeAt) {
      ctx.fillStyle = CUT;
      label(ctx, planeAt, 'Slice Plane', W.text * 0.9, 'center', 0, true);
    }

    // the lightsaber, H to T, and the swipe S from the tip: faded once the
    // corners' sides are known, so the faces can be seen through it
    // (the normal starts on the blade near the tip: on the plane, clear of the box)
    // On the last step it is swinging through the block, so it is shown in full.
    const { off } = swingAt();
    const h = toView(add(H, off)), t = toView(add(T, off)), tip = toView(add(sTip(), off));
    const mid = toView(add(H, mul(sub(T, H), 0.85)));
    const fade = step > SIDES && step !== LAST ? 0.35 : 1;
    saber(W, fade, off);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = ctx.fillStyle = CUT;
    arrow(ctx, xy(t), xy(tip), W.arrow);
    ctx.globalAlpha = 1;
    // the plane's normal, once the sides matter: in the plane's blue, so it is
    // not taken for one of the cut face's (dark mint) edge arrows
    if (step >= SIDES && step < WORLD) {
      const nv = dirToView(geo.nWorld);
      ctx.strokeStyle = ctx.fillStyle = CUT;
      arrow(ctx, xy(mid), xy(add(mid, mul(nv, 0.7))), W.arrow * 0.8);
    }
    ctx.fillStyle = css(C.handle);
    for (const p of [h, t, tip]) disc(ctx, xy(p), W.dot * 1.2);
    ctx.fillStyle = CUT;
    const nudge = (p, k = 0.2) => xy(add(p, [0, k, 0]));
    label(ctx, nudge(h, -0.22), 'H', W.text, 'center', 0, true);
    label(ctx, nudge(t), 'T', W.text, 'center', 0, true);
    label(ctx, nudge(tip), 'S', W.text, 'center', 0, true);

    // no drag / orbit / zoom hint here: just which space the view is in
    view.corner(W, space > 0.5 ? 'model space' : 'world space', 0, '#55606b', W.hint * 1.2);
  }

  /* --- running: animate, and start over on arriving at the slide ---------- */
  const onSlide = () => !el.closest('.reveal') || !!el.closest('section.present');
  let away = !!el.closest('.reveal'), last = null, dirty = true;
  function frame(t) {
    const here = onSlide();
    if (here && away) { step = 0; targets(); space = spaceTo; apart = apartTo; swing = 0; setMath(false); update(); }
    away = !here;
    const now = (t ?? performance.now()) / 1000;
    const dt = last == null ? 0 : Math.max(0, Math.min(now - last, 0.05));
    last = now;
    const toward = (v, to) => (v < to ? Math.min(to, v + SPEED * dt) : Math.max(to, v - SPEED * dt));
    if (step === LAST) {
      // the swing, and the halves parting behind the blade
      if (swing < 1) {
        swing = Math.min(1, swing + dt / SWING);
        apart = swingAt().parted;
        dirty = true;
      }
    } else if (swing) {
      swing = 0;   // left the last step: the saber goes straight back to the cut
      dirty = true;
    }
    if (space !== spaceTo || (step !== LAST && apart !== apartTo)) {
      space = toward(space, spaceTo);
      if (step !== LAST) apart = toward(apart, apartTo);
      dirty = true;
    }
    if (dirty) { dirty = false; view.repaint(); }
  }

  let built = false;
  // only the box's yaw: enough for the move into model space to show a turn
  group('box', 'Box', 'slice-card', [{ label: 'yaw', min: -180, max: 180, step: 1, format: (v) => `${v.toFixed(0)}°` }], box, 2);
  group('hilt', `Hilt ${I('H')}`, 'slice-cut', xyz(-2.5, 2.5), H);
  group('tip', `Tip ${I('T')}`, 'slice-cut', xyz(-2.5, 2.5), T);
  group('swipe', `Swipe ${I('S')}`, 'slice-cut', xyz(-1, 1), S);
  el.appendChild(row);
  built = true;
  targets();
  update();
  runLoop(el, frame);
}
