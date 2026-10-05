/*
 * transform-lab3d.js - the 3D sibling of transform-lab.js: the same sliders,
 * draggable order chips, Play button and matrix readout, but for 4x4
 * homogeneous matrices acting on [x, y, z, 1].
 *
 * Still Canvas 2D, not three.js (PLAN.md 2.1). The shape is the 2D lab's house
 * pushed out one unit along z, a dozen vertices, so a hand-written
 * perspective projection and painter's-algorithm face sort are all the "3D
 * engine" this needs - and both are a few lines the class can read.
 *
 * Dragging the canvas orbits the camera. That is a *view* change, not a
 * transform: the matrix readout does not move when you do it, which is itself
 * worth pointing out on the slide.
 *
 * Stages: 'rotate' (one angle, with an x/y/z axis picker), 'rotateX',
 * 'rotateY', 'rotateZ' (a fixed axis each, for the slide showing rotations
 * about different axes do not commute), 'scale' and 'translate'.
 */

import { C, runLoop, slider, button, matrixPanel, orderChips, fmt } from './lab-core.js';
import { makeStage2D, stroke, fillShape, disc, columnVector, label, css } from './draw2d.js';

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------- 4x4 homogeneous matrix helpers */
/* Row-major arrays of 16, column-vector convention (v' = M v), as the slides
   write it - the 3x3 helpers in transform-lab.js with one more row and column. */

const M4 = {
  identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],

  mul(a, b) {
    const o = new Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[r * 4 + k] * b[k * 4 + c];
        o[r * 4 + c] = s;
      }
    }
    return o;
  },

  rotation(axis, theta) {
    const s = Math.sin(theta), c = Math.cos(theta);
    switch (axis) {
      case 'x': return [1, 0, 0, 0,  0, c, -s, 0,  0, s, c, 0,  0, 0, 0, 1];
      case 'y': return [c, 0, s, 0,  0, 1, 0, 0,  -s, 0, c, 0,  0, 0, 0, 1];
      default:  return [c, -s, 0, 0,  s, c, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];
    }
  },

  scale: (kx, ky, kz) => [kx, 0, 0, 0,  0, ky, 0, 0,  0, 0, kz, 0,  0, 0, 0, 1],

  translation: (dx, dy, dz) => [1, 0, 0, dx,  0, 1, 0, dy,  0, 0, 1, dz,  0, 0, 0, 1],

  apply(m, p) {
    return [
      m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[3],
      m[4] * p[0] + m[5] * p[1] + m[6] * p[2] + m[7],
      m[8] * p[0] + m[9] * p[1] + m[10] * p[2] + m[11],
    ];
  },
};

/* ------------------------------------------------------------------ shape --- */

/* transform-lab.js's house outline, front face at z = 1 and back at z = 0, so
   the 2D picture is still what you see looking straight down -z. */
const OUTLINE = [[0, 0], [1.6, 0], [1.6, 1.1], [0.8, 1.8], [0, 1.1]];
const DEPTH = 1;

const VERTS = [
  ...OUTLINE.map(([x, y]) => [x, y, 0]),
  ...OUTLINE.map(([x, y]) => [x, y, DEPTH]),
];
const N = OUTLINE.length;
const FACES = [
  [...Array(N).keys()],                       // back
  [...Array(N).keys()].map((i) => i + N),     // front
  ...OUTLINE.map((_, i) => {                   // walls and roof
    const j = (i + 1) % N;
    return [i, j, j + N, i + N];
  }),
];
const EDGES = [
  ...OUTLINE.map((_, i) => [i, (i + 1) % N]),
  ...OUTLINE.map((_, i) => [i + N, ((i + 1) % N) + N]),
  ...OUTLINE.map((_, i) => [i, i + N]),
];

const AXIS_COLOUR = { x: C.basisX, y: C.basisY, z: C.result };

const STAGE_LABEL = {
  rotate: 'Rotate', rotateX: 'Rotate X', rotateY: 'Rotate Y', rotateZ: 'Rotate Z',
  scale: 'Scale', translate: 'Translate',
};

/* ================================================================= 3D lab === */

export function mountLab3D(el, opts = {}) {
  const {
    stages: stageNames = ['rotate', 'translate'],
    view = 4.5,
    showMatrix = true,
    allowReorder = true,
    axisPick = true,
    theta = 30, thetaX = 90, thetaY = 90, thetaZ = 90,
    kx = 1.5, ky = 1.5, kz = 1.5,
    dx = 2, dy = 0, dz = 0,
    yaw = -32, pitch = 22,
  } = opts;

  el.classList.add('lab', 'lab-3d');
  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const panel = document.createElement('div');
  panel.className = 'lab-panel';
  el.append(stageEl, panel);

  /* makeStage2D supplies the canvas, its sizing and devicePixelRatio handling;
     its begin() (a flat grid) is not used - paint() lays down a floor instead. */
  const stage = makeStage2D(stageEl, { view });
  const { ctx, canvas } = stage;

  /* Screen-space sizes, in the same "view units" as data-view. */
  const W = {
    grid: 0.012 * view, axis: 0.02 * view, ghost: 0.009 * view, outline: 0.013 * view,
    dot: 0.026 * view, text: 0.07 * view, labelGap: 0.24 * view, hint: 0.06 * view,
  };
  const GRID = Math.min(4, Math.round(view));   // floor half-width, kept on screen when zoomed in
  const LIFT = 0.24;   // origin offset below centre, as a fraction of half-height

  /* --- camera -------------------------------------------------------------- */
  /* An orbit camera: turn the world by yaw about y, tip it by pitch about x,
     then divide by distance. f = D keeps a point at the origin's depth at one
     view unit per world unit, so data-view means much what it does in 2D. */
  const D = 20;
  const cam = { yaw: rad(yaw), pitch: rad(pitch) };

  function project(p) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const x1 = cy * p[0] + sy * p[2];
    const z1 = -sy * p[0] + cy * p[2];
    const y2 = cp * p[1] - sp * z1;
    const z2 = sp * p[1] + cp * z1;
    const k = D / Math.max(D - z2, 0.5);
    return [x1 * k, y2 * k, z2];
  }

  /* --- animation state ----------------------------------------------------- */
  let progress = stageNames.length;
  let animating = false;
  let animStart = 0;
  let dirty = true;
  let mounted = false;
  let display = null;

  function invalidate() {
    dirty = true;
    if (mounted) { rebuild(); paint(); dirty = false; }
  }

  function play() {
    animating = true;
    animStart = performance.now();
  }

  /* --- controls ------------------------------------------------------------ */
  /* multOrder / order exactly as in transform-lab.js: chips show
     multiplication order, the maths uses application order (its reverse). */
  let multOrder = stageNames.slice().reverse();
  let order = multOrder.slice().reverse();
  let axis = ['x', 'y', 'z'].includes(opts.axis) ? opts.axis : 'y';
  const sliders = {};
  const controls = document.createElement('div');
  controls.className = 'lab-controls';
  panel.appendChild(controls);

  const angle = { min: -360, max: 360, step: 1, format: (v) => `${v}°` };
  if (stageNames.includes('rotate')) {
    sliders.theta = slider(controls, { ...angle, label: '&theta;', value: theta }, () => invalidate());
  }
  for (const [stageKey, key, sub, value] of [
    ['rotateX', 'thetaX', 'x', thetaX], ['rotateY', 'thetaY', 'y', thetaY], ['rotateZ', 'thetaZ', 'z', thetaZ],
  ]) {
    if (stageNames.includes(stageKey)) {
      sliders[key] = slider(controls, { ...angle, label: `&theta;<sub>${sub}</sub>`, value }, () => invalidate());
    }
  }
  if (stageNames.includes('scale')) {
    const k = { min: -3, max: 3, step: 0.1 };
    sliders.kx = slider(controls, { ...k, label: 'scale<sub>x</sub>', value: kx }, () => invalidate());
    sliders.ky = slider(controls, { ...k, label: 'scale<sub>y</sub>', value: ky }, () => invalidate());
    sliders.kz = slider(controls, { ...k, label: 'scale<sub>z</sub>', value: kz }, () => invalidate());
  }
  if (stageNames.includes('translate')) {
    const d = { min: -4, max: 4, step: 0.1 };
    sliders.dx = slider(controls, { ...d, label: '&Delta;x', value: dx }, () => invalidate());
    sliders.dy = slider(controls, { ...d, label: '&Delta;y', value: dy }, () => invalidate());
    sliders.dz = slider(controls, { ...d, label: '&Delta;z', value: dz }, () => invalidate());
  }

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  panel.appendChild(buttons);

  // The rotation axis for a plain 'rotate' stage, as three toggle buttons on
  // the same row as Play so the panel stays short enough for a 4x4 readout.
  const axisButtons = {};
  if (stageNames.includes('rotate') && axisPick) {
    const tag = document.createElement('span');
    tag.className = 'lab-axis-tag';
    tag.textContent = 'axis';
    buttons.appendChild(tag);
    for (const a of ['x', 'y', 'z']) {
      axisButtons[a] = button(buttons, a, () => {
        axis = a;
        syncAxisButtons();
        invalidate();
        play();
      });
      axisButtons[a].classList.add('lab-axis-button');
    }
  }
  function syncAxisButtons() {
    for (const [a, b] of Object.entries(axisButtons)) b.classList.toggle('is-on', a === axis);
  }
  syncAxisButtons();

  button(buttons, 'Play', () => play());
  button(buttons, 'Reset view', () => {
    cam.yaw = rad(yaw); cam.pitch = rad(pitch);
    invalidate();
  });

  const showOrder = allowReorder && stageNames.length > 1;
  if (showOrder) {
    orderChips(panel, multOrder, (key) => STAGE_LABEL[key], () => {
      order = multOrder.slice().reverse();
      invalidate();
      play();
    });
  }

  const mp = showMatrix ? matrixPanel(panel) : null;

  mounted = true;

  /* --- stage maths --------------------------------------------------------- */
  function stageMatrix(name, u = 1) {
    const s = (key) => sliders[key].get();
    switch (name) {
      case 'rotate':    return M4.rotation(axis, rad(s('theta')) * u);
      case 'rotateX':   return M4.rotation('x', rad(s('thetaX')) * u);
      case 'rotateY':   return M4.rotation('y', rad(s('thetaY')) * u);
      case 'rotateZ':   return M4.rotation('z', rad(s('thetaZ')) * u);
      case 'scale':     return M4.scale(1 + (s('kx') - 1) * u, 1 + (s('ky') - 1) * u, 1 + (s('kz') - 1) * u);
      case 'translate': return M4.translation(s('dx') * u, s('dy') * u, s('dz') * u);
      default:          return M4.identity();
    }
  }

  function composed(p = order.length) {
    let m = M4.identity();
    for (let i = 0; i < order.length; i++) {
      const u = clamp(p - i, 0, 1);
      if (u <= 0) break;
      m = M4.mul(stageMatrix(order[i], u), m);
    }
    return m;
  }

  // Only used when there is no chip row to spell the product out instead.
  function symbolLabel() {
    const name = {
      rotate: `Rotation Matrix about ${axis}`,
      rotateX: 'Rotation about x', rotateY: 'Rotation about y', rotateZ: 'Rotation about z',
      scale: 'Scale Matrix', translate: 'Translate Matrix',
    };
    return multOrder.map((s) => name[s]).join(' · ') + '  =';
  }

  function rebuild() {
    const m = composed(progress);
    display = {
      moved: VERTS.map((p) => M4.apply(m, p)),
      o:  M4.apply(m, [0, 0, 0]),
      ex: M4.apply(m, [1, 0, 0]),
      ey: M4.apply(m, [0, 1, 0]),
      ez: M4.apply(m, [0, 0, 1]),
    };
    if (mp) mp.update(composed(), showOrder ? '' : symbolLabel());
  }

  /* --- drawing ------------------------------------------------------------- */

  /* Clears the canvas and sets a y-up transform in view units centred on the
     canvas - makeStage2D's world transform, without its flat grid. */
  function begin() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.height / (2 * view);
    // the origin sits a little below centre: the house stands up off the floor
    ctx.setTransform(k, 0, 0, -k, canvas.width / 2, canvas.height * (0.5 + LIFT / 2));
  }

  const seg = (a, b, width) => stroke(ctx, [project(a).slice(0, 2), project(b).slice(0, 2)], width);

  function floor() {
    ctx.strokeStyle = css(C.grid);
    for (let i = -GRID; i <= GRID; i++) {
      seg([i, 0, -GRID], [i, 0, GRID], W.grid);
      seg([-GRID, 0, i], [GRID, 0, i], W.grid);
    }
    // negative halves grey, positive halves in the axis colour, then a letter
    const ends = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    for (const [a, e] of Object.entries(ends)) {
      // y stands up off the floor, so it has less room above it than x and z do
      const len = a === 'y' ? Math.min(GRID + 0.6, view * 0.95) : GRID + 0.6;
      const tip = e.map((v) => v * len);
      const highlighted = stageNames.includes('rotate') && a === axis;
      // no negative y: below the floor it only runs off the bottom of the stage
      if (a !== 'y') {
        ctx.strokeStyle = css(highlighted ? C.aux : C.axis);
        seg(e.map((v) => -v * GRID), [0, 0, 0], highlighted ? W.axis * 2.2 : W.axis);
      }
      ctx.strokeStyle = css(highlighted ? C.aux : AXIS_COLOUR[a]);
      seg([0, 0, 0], tip, highlighted ? W.axis * 2.2 : W.axis * 1.3);
      ctx.fillStyle = css(AXIS_COLOUR[a]);
      label(ctx, project(e.map((v) => v * (len + 0.35))).slice(0, 2), a, W.text * 1.1, 'center');
    }
  }

  // Lambert-ish shading so the faces read as a solid: lit faces pale, faces
  // turned away from the light a deeper red. abs() because a negative scale
  // flips every face's winding, and the shading should not care.
  const LIGHT = (() => { const l = [0.35, 0.85, 0.55]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
  const BASE = [0x8d, 0x1b, 0x1b];
  function faceFill(pts3) {
    const [a, b, c] = pts3;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    const lit = len < 1e-9 ? 0.4 : Math.abs(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / len;
    const t = 0.18 + 0.5 * (1 - lit);   // how far from white toward the base red
    const rgb = BASE.map((ch) => Math.round(255 + (ch - 255) * t));
    return `rgb(${rgb.join(',')})`;
  }

  const alignOf = (u) => (u > 0.3 ? 'left' : u < -0.3 ? 'right' : 'center');

  // A tracked vertex and its [x, y, z, 1], pushed outward on screen from the
  // transformed origin, turned by `skew` so the three labels fan apart - the
  // same placement rule as transform-lab.js's vertexMark.
  function vertexMark(p, colour, skew) {
    const s = project(p), o = project(display.o);
    ctx.fillStyle = css(colour);
    disc(ctx, s, W.dot);
    const dx = s[0] - o[0], dy = s[1] - o[1];
    const len = Math.hypot(dx, dy) || 1;
    const c = Math.cos(skew), sn = Math.sin(skew);
    const ux = (dx * c - dy * sn) / len, uy = (dx * sn + dy * c) / len;
    const at = [s[0] + ux * W.labelGap, s[1] + uy * W.labelGap];
    // a white halo, since in 3D a label often lands over the shape's own faces
    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowBlur = 6;
    columnVector(ctx, at, [fmt(p[0]), fmt(p[1]), fmt(p[2]), '1'], W.text, alignOf(ux));
    ctx.restore();
  }

  function paint() {
    begin();
    if (!display) return;

    floor();

    ctx.strokeStyle = css(C.ghost);
    for (const [i, j] of EDGES) seg(VERTS[i], VERTS[j], W.ghost);

    // painter's algorithm: the house is convex, so sorting whole faces by
    // their mean depth is enough - farthest first
    const proj = display.moved.map(project);
    const faces = FACES
      .map((f) => ({ f, depth: f.reduce((s, i) => s + proj[i][2], 0) / f.length }))
      .sort((a, b) => a.depth - b.depth);
    for (const { f } of faces) {
      const pts = f.map((i) => proj[i].slice(0, 2));
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = faceFill(f.map((i) => display.moved[i]));
      fillShape(ctx, pts);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = css(C.shape);
      stroke(ctx, pts, W.outline, true);
    }

    vertexMark(display.ex, C.basisX, rad(-60));
    vertexMark(display.ey, C.basisY, rad(40));
    vertexMark(display.ez, C.result, rad(-30));

    ctx.fillStyle = '#9aa3ab';
    const halfW = view * (canvas.width / canvas.height);
    label(ctx, [-halfW + 0.1 * view, view * (1 + LIFT) - 0.1 * view], 'drag to orbit the camera', W.hint, 'left');
  }

  /* --- orbit --------------------------------------------------------------- */
  /* Any drag on the canvas turns the camera; there are no handles to hit. */
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
    invalidate();
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

  function frame() {
    if (animating) {
      const t = (performance.now() - animStart) / 900;
      progress = Math.min(t, order.length);
      if (progress >= order.length) animating = false;
      dirty = true;
    }
    if (!dirty) return;
    rebuild();
    paint();
    dirty = false;
  }

  function resize() {
    if (!stage.resize()) return;
    dirty = true;
    frame();   // see transform-lab.js: ?print-pdf never makes a slide "visible"
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();

  runLoop(el, frame);

  return { play };
}
