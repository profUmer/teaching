/*
 * transform-lab.js - the live 2D homogeneous transform demo for the GAME 220
 * slides, driven from a <div> in the .qmd.
 *
 * mountLab2D(el, opts) draws a shape and the composed 3x3 matrix; given two or
 * three stages, the words above the matrix - "Translate x Rotate x Scale =" -
 * can be dragged left-to-right into any order, exactly as you'd rearrange
 * terms in a written-out matrix product, and the matrix and the shape follow.
 * That is what makes composition failing to commute something you watch
 * rather than take on faith. It only animates while the slide is on screen
 * (IntersectionObserver), so a deck with several labs on it stays responsive.
 *
 * Two tracked vertices - a red dot at (1, 0), a blue dot at (0, 1) - carry
 * their transformed [x, y, 1] beside them as they move. They used to be arrows
 * from the origin (the WebGL path's basis vectors), but an arrow reads as a
 * *direction*, and every slide this lab appears on is about what a transform
 * does to a *position* - the distinction the w=0 slide draws explicitly. Dots
 * with their own coordinates are the picture that matches the algebra.
 */

import { C, runLoop, slider, button, matrixPanel, orderChips, fmt } from './lab-core.js';
import { makeStage2D, stroke, fillShape, disc, columnVector, css } from './draw2d.js';

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------- 3x3 homogeneous matrix helpers */
/* Row-major arrays of 9, column-vector convention: v' = M v, exactly as the
   slides write it. */

const M3 = {
  identity: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],

  mul(a, b) {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
      }
    }
    return o;
  },

  rotation(theta) {
    const s = Math.sin(theta), c = Math.cos(theta);
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  },

  scale(kx, ky) {
    return [kx, 0, 0, 0, ky, 0, 0, 0, 1];
  },

  translation(dx, dy) {
    return [1, 0, dx, 0, 1, dy, 0, 0, 1];
  },

  apply(m, p) {
    return [
      m[0] * p[0] + m[1] * p[1] + m[2],
      m[3] * p[0] + m[4] * p[1] + m[5],
    ];
  },
};

/* ================================================================= 2D lab === */

const SHAPES = {
  // a little house - asymmetric in both axes, so rotations and reflections read clearly
  house: [[0, 0], [1.6, 0], [1.6, 1.1], [0.8, 1.8], [0, 1.1]],
  square: [[0, 0], [1, 0], [1, 1], [0, 1]],
};

const STAGE_LABEL = { rotate: 'Rotate', scale: 'Scale', translate: 'Translate' };
const STAGE_SYMBOL = { rotate: 'Rotation Matrix', scale: 'Scale Matrix', translate: 'Translate Matrix' };

export function mountLab2D(el, opts = {}) {
  const {
    stages: stageNames = ['rotate', 'translate'],
    shape = 'house',
    view = 4,
    showMatrix = true,
    allowReorder = true,
    theta = 30, kx = 1.5, ky = 1.5, dx = 2, dy = 1,
  } = opts;

  el.classList.add('lab', 'lab-2d');
  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const panel = document.createElement('div');
  panel.className = 'lab-panel';
  el.append(stageEl, panel);

  /* The stage draws grid and axes; everything below paints on top of them. */
  const stage = makeStage2D(stageEl, { view });
  const { ctx } = stage;

  const pts = SHAPES[shape] || SHAPES.house;

  /* World units - the transform is already applied when these are stroked. */
  const W = { ghost: 0.03, outline: 0.05, dot: 0.09, text: 0.28, labelGap: 0.8 };

  /* --- animation state ----------------------------------------------------- */
  /* Declared before the controls are built: creating a slider syncs it once,
     which calls invalidate() straight away. */
  let progress = stageNames.length;   // stages fully applied
  let animating = false;
  let animStart = 0;
  let dirty = true;
  let mounted = false;   // true once the controls and matrix panel exist
  let display = null;    // the transformed shape and its basis vectors

  /* Redraws straight away rather than waiting on the render loop, so moving a
     slider updates the matrix on the same tick. The loop only runs while the
     slide is on screen, and a control can be touched before the first frame. */
  function invalidate() {
    dirty = true;
    if (mounted) { rebuild(); paint(); dirty = false; }
  }

  function play() {
    animating = true;
    animStart = performance.now();
  }

  /* --- controls ------------------------------------------------------------ */
  /* `multOrder` is left-to-right *multiplication* order - what the chips show
     and what you'd write on paper, e.g. [translate, rotate, scale] reads
     "Translate x Rotate x Scale". `order`, used by the maths below, is
     application order: the reverse, because in M = T*R*S applied to a column
     vector (M v), S is the rightmost factor and so is applied first. Dragging
     a chip mutates `multOrder` in place and recomputes `order` from it. */
  let multOrder = stageNames.slice().reverse();
  let order = multOrder.slice().reverse();
  const sliders = {};
  const controls = document.createElement('div');
  controls.className = 'lab-controls';
  panel.appendChild(controls);

  if (stageNames.includes('rotate')) {
    sliders.theta = slider(controls,
      { label: '&theta;', min: -360, max: 360, step: 1, value: theta, format: (v) => `${v}°` },
      () => invalidate());
  }
  if (stageNames.includes('scale')) {
    sliders.kx = slider(controls, { label: 'scale<sub>x</sub>', min: -3, max: 3, step: 0.1, value: kx }, () => invalidate());
    sliders.ky = slider(controls, { label: 'scale<sub>y</sub>', min: -3, max: 3, step: 0.1, value: ky }, () => invalidate());
  }
  if (stageNames.includes('translate')) {
    sliders.dx = slider(controls, { label: '&Delta;x', min: -4, max: 4, step: 0.1, value: dx }, () => invalidate());
    sliders.dy = slider(controls, { label: '&Delta;y', min: -4, max: 4, step: 0.1, value: dy }, () => invalidate());
  }

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  panel.appendChild(buttons);
  button(buttons, 'Play', () => play());

  // Chips sit directly above the matrix grid, so dragging them rearranges the
  // same equation the matrix is the answer to; matrixPanel's own caption is
  // left blank below rather than duplicating that line.
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
  /* `u` in [0,1] gives the partially-applied stage, which is what makes the
     animation show the difference between orders instead of just asserting it. */
  function stageMatrix(name, u = 1) {
    switch (name) {
      case 'rotate':    return M3.rotation(rad(sliders.theta.get()) * u);
      case 'scale':     return M3.scale(1 + (sliders.kx.get() - 1) * u, 1 + (sliders.ky.get() - 1) * u);
      case 'translate': return M3.translation(sliders.dx.get() * u, sliders.dy.get() * u);
      default:          return M3.identity();
    }
  }

  // order is application order, so the composed matrix multiplies right-to-left
  function composed(progress = order.length) {
    let m = M3.identity();
    for (let i = 0; i < order.length; i++) {
      const u = clamp(progress - i, 0, 1);
      if (u <= 0) break;
      m = M3.mul(stageMatrix(order[i], u), m);
    }
    return m;
  }

  // Same text the chips spell out when they're on screen; used for the static
  // caption only when there is no chip row to say it instead (a single stage,
  // or data-reorder="false").
  function symbolLabel() {
    return multOrder.map((s) => STAGE_SYMBOL[s]).join(' · ') + '  =';
  }

  /* --- animation ----------------------------------------------------------- */
  /* Immediate mode, as in vector-lab.js: rebuild only recomputes, paint redraws
     the whole stage. */
  function rebuild() {
    const m = composed(progress);
    display = {
      moved: pts.map((p) => M3.apply(m, p)),
      o:  M3.apply(m, [0, 0]),
      ex: M3.apply(m, [1, 0]),
      ey: M3.apply(m, [0, 1]),
    };
    if (mp) mp.update(composed(), showOrder ? '' : symbolLabel());
  }

  // Which way a label should run so it reads away from the origin instead of
  // over the dot it names - same rule as motion-lab.js's alignOf, duplicated
  // rather than shared since it is one line.
  const alignOf = (u) => (u > 0.3 ? 'left' : u < -0.3 ? 'right' : 'center');

  // A dot at a transformed vertex, with its own column vector [x, y, 1] -
  // stacked, bracketed, the way the slides write it, rather than a row -
  // written beside it, offset radially outward from the transformed origin so
  // it clears the shape at any rotation instead of always sitting to one
  // fixed side. `skew` turns the outward direction a few degrees off the
  // origin-to-point ray before placing it. Both tracked points start life
  // exactly on an axis (1,0) and (0,1), which is also exactly where the
  // shape's own edges run (the house has a vertex at the origin) - without
  // this, "push it further out" pushes it straight down the shape's own
  // outline. Skewing red and blue in opposite directions fans them apart too.
  function vertexMark(p, colour, skew) {
    ctx.fillStyle = css(colour);
    disc(ctx, p, W.dot);

    const dx = p[0] - display.o[0], dy = p[1] - display.o[1];
    const len = Math.hypot(dx, dy) || 1;
    const c = Math.cos(skew), s = Math.sin(skew);
    const ux = (dx * c - dy * s) / len, uy = (dx * s + dy * c) / len;
    const at = [p[0] + ux * W.labelGap, p[1] + uy * W.labelGap];
    columnVector(ctx, at, [fmt(p[0]), fmt(p[1]), '1'], W.text, alignOf(ux));
  }

  /* Back to front: ghost, fill, outline, then the tracked vertices on top. */
  function paint() {
    stage.begin();
    if (!display) return;

    ctx.strokeStyle = css(C.ghost);
    stroke(ctx, pts, W.ghost, true);            // the shape before the transform

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = css(C.shapeFill);
    fillShape(ctx, display.moved);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = css(C.shape);
    stroke(ctx, display.moved, W.outline, true);

    vertexMark(display.ex, C.basisX, rad(-90));
    vertexMark(display.ey, C.basisY, rad(90));
  }

  function frame() {
    if (animating) {
      const t = (performance.now() - animStart) / 900;   // ~0.9s per stage
      progress = Math.min(t, order.length);
      if (progress >= order.length) animating = false;
      dirty = true;
    }
    // Canvas 2D holds the last frame, so an idle lab costs nothing to keep on
    // screen - unlike the WebGL path, which re-rendered every tick regardless.
    if (!dirty) return;
    rebuild();
    paint();
    dirty = false;
  }

  /* --- resize -------------------------------------------------------------- */
  function resize() {
    if (!stage.resize()) return;
    dirty = true;
    // Draw immediately rather than waiting on the animation loop: reveal's
    // ?print-pdf mode lays every slide out at once without them ever becoming
    // "visible", and a canvas that never drew exports as an empty box.
    frame();
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();

  runLoop(el, frame);

  return { play };
}
