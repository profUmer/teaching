/*
 * cross-lab.js - the cross product, for Game Math 1's Vector Operations deck.
 *
 *   <div class="lab-mount" data-lab="cross"></div>
 *
 * Sliders for A and B. Below them, a 3D view of A, B and A x B from the
 * origin, with the parallelogram A and B span shaded and right-angle marks
 * where A x B meets them. Beside the view, the components of A, B and the
 * product, each in its arrow's colour, and a button that switches the product
 * to B x A and back, so the arrow can be watched flipping over.
 *
 * With data-readout="true" the product is also worked out under them one
 * component at a time, the way the slide writes it (the deck leaves it off):
 *
 *   x = AyBz - AzBy
 *   y = AzBx - AxBz
 *   z = AxBy - AyBx
 *
 * The defaults lie flat in the xy plane - A = [3, 1, 0], B = [1, 2, 0] - so
 * A x B = [0, 0, 5] points straight along z: the 2D case the slide says is
 * still handy. Swapping A and B flips the sign, and parallel vectors give
 * [0, 0, 0]; lab-selftest.html pins all three.
 *
 * The view is orbit3d.js (shared with the ray labs): drag to orbit, scroll to
 * zoom. Its frame is right-handed - x right, y up, z toward the viewer - so
 * the right-hand rule reads correctly off the picture. The black dots on A's
 * and B's tips drag instead, across the screen (orbit3d.js's handles), and
 * the sliders follow.
 */

import { C, slider, button, fmt } from './lab-core.js';
import { stroke, dashed, arrow, disc, fillShape, label, css } from './draw2d.js';
import { makeOrbitView } from './orbit3d.js';

const RANGE = { min: -5, max: 5, step: 0.1 };
const GRID = 5;   // floor half-width, matching the sliders

const one = (v) => v.toFixed(1);
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const scale = (p, k) => [p[0] * k, p[1] * k, p[2] * k];
const len = (p) => Math.hypot(p[0], p[1], p[2]);
const crossOf = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/* An arrow over a letter, as \vec draws it - the CSS one the ray labs use,
   since a combining U+20D7 renders as a box in the theme's font. */
const V = (s) => `<span class="ray-vec">${s}</span>`;
/* Coloured to match the drawing: A red, B blue, the product green. */
const tint = (html, colour) => `<span style="color: ${css(colour)}">${html}</span>`;
const sub = (letter, axis) => `<i>${letter}</i><sub>${axis}</sub>`;

/* Which components each row of A x B multiplies, as on the slide. */
const ROWS = [
  { axis: 'x', p: [1, 2], q: [2, 1] },   // AyBz - AzBy
  { axis: 'y', p: [2, 0], q: [0, 2] },   // AzBx - AxBz
  { axis: 'z', p: [0, 1], q: [1, 0] },   // AxBy - AyBx
];
const AXES = 'xyz';

export function mountCrossLab(el, opts = {}) {
  el.classList.add('lab', 'lab-ray', 'lab-cross');

  const A = [...(opts.vecA ?? [3, 1, 0])];
  const B = [...(opts.vecB ?? [1, 2, 0])];
  let swapped = false;   // showing B x A rather than A x B
  // the product being shown, as [first, second, first's letter, second's]
  const order = () => (swapped ? [B, A, 'B', 'A'] : [A, B, 'A', 'B']);

  const inputs = document.createElement('div');
  inputs.className = 'ray-inputs';
  inputs.style.setProperty('--ray-cols', 2);
  el.appendChild(inputs);

  const sliders = {};   // A: [x, y, z], B: [x, y, z], so a drag can move them
  function group(title, letter, vecArr) {
    const g = document.createElement('div');
    g.className = `ray-group vec-${letter.toLowerCase()}`;   // in its arrow's colour
    const h = document.createElement('div');
    h.className = 'ray-group-title';
    h.innerHTML = title;
    const controls = document.createElement('div');
    controls.className = 'lab-controls';
    g.append(h, controls);
    inputs.appendChild(g);
    // named A<sub>x</sub> and so on, unique on the slide and findable by
    // the self-test
    sliders[letter] = ['x', 'y', 'z'].map((axis, i) =>
      slider(controls, { label: `${letter}<sub>${axis}</sub>`, ...RANGE, value: vecArr[i], format: one },
        (v) => { vecArr[i] = v; update(); }));
  }

  // The 3D view on the left; the components, the working if asked for, and
  // the buttons on the right.
  const row = document.createElement('div');
  row.className = 'ray-row';
  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const out = document.createElement('div');
  out.className = 'ray-out cross-out';
  row.append(stageEl, out);

  // A, B and the product, one row each: name, then components.
  const components = document.createElement('div');
  components.className = 'cross-components';
  const rowFor = (colour) => {
    const name = document.createElement('span');
    name.className = 'cross-name';
    const value = document.createElement('span');
    value.className = 'cross-vector';
    value.style.color = css(colour);
    components.append(name, value);
    return { name, value };
  };
  const shown = [rowFor(C.accentA), rowFor(C.accentB), rowFor(C.result)];
  shown[0].name.innerHTML = `${tint(V('A'), C.accentA)} =`;
  shown[1].name.innerHTML = `${tint(V('B'), C.accentB)} =`;
  out.appendChild(components);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';

  let cells = [];
  if (opts.readout) {
    const working = document.createElement('div');
    working.className = 'cross-working';
    cells = ROWS.map(({ axis }) => {
      const name = document.createElement('span');
      name.className = 'cross-name';
      name.innerHTML = `<i>${axis}</i> =`;
      const symbolic = document.createElement('span');
      symbolic.className = 'cross-symbolic';
      const numbers = document.createElement('span');
      numbers.className = 'cross-numbers';
      working.append(name, symbolic, numbers);
      return { symbolic, numbers };
    });
    out.appendChild(working);
  }
  out.appendChild(buttons);

  // A number as it goes into a product: in brackets, so a negative reads
  // (-1.5)(2) rather than -1.5 2.
  const f = (v) => `(${fmt(v, 1)})`;

  let built = false;
  function update() {
    if (!built) return;
    const [P, Q, p1, q1] = order();
    const c = crossOf(P, Q);
    const comps = (v) => `(${v.map((x) => fmt(x)).join(', ')})`;
    shown[0].value.textContent = comps(A);
    shown[1].value.textContent = comps(B);
    shown[2].name.innerHTML = `${tint(`${V(p1)} × ${V(q1)}`, C.result)} =`;
    shown[2].value.textContent = comps(c);
    if (cells.length) {
      ROWS.forEach(({ p, q }, i) => {
        cells[i].symbolic.innerHTML = `${sub(p1, AXES[p[0]])}${sub(q1, AXES[p[1]])} − ${sub(p1, AXES[q[0]])}${sub(q1, AXES[q[1]])}`;
        cells[i].numbers.textContent = `= ${f(P[p[0]])}${f(Q[p[1]])} − ${f(P[q[0]])}${f(Q[q[1]])} = ${fmt(c[i])}`;
      });
    }
    el.dataset.result = c.map((v) => fmt(v)).join(',');   // for the self-test
    view.repaint();
  }

  /* --- the 3D view --------------------------------------------------------- */
  // Dragging a tip sets that vector's sliders, kept to their range and step,
  // and the sliders redraw everything from there.
  const snap = (v) => Math.round(Math.min(RANGE.max, Math.max(RANGE.min, v)) * 10) / 10;
  const onDrag = (i, p) => {
    sliders['AB'[i]].forEach((sl, k) => { if (snap(p[k]) !== sl.get()) sl.set(snap(p[k])); });
  };
  const view = makeOrbitView(stageEl,
    { yaw: opts.yaw, pitch: opts.pitch, view: opts.view ?? 4, handles: () => [A, B], onDrag }, paint);
  const { ctx, xy, project } = view;
  // Labelled with the product it switches to.
  const swap = button(buttons, '', () => { swapped = !swapped; swapLabel(); update(); });
  swap.classList.add('cross-swap');
  const swapLabel = () => {
    const [, , p1, q1] = order();
    swap.innerHTML = `Show ${V(q1)} × ${V(p1)}`;
  };
  swapLabel();
  button(buttons, 'Reset view', () => view.reset());

  function paint() {
    const W = view.begin();
    const O = [0, 0, 0];
    const [P, Q, p1, q1] = order();
    const c = crossOf(P, Q);
    const product = `${p1} × ${q1}`;
    const hasC = len(c) > 1e-6;

    // grey axes: red, blue and green are A, B and A x B here
    view.floor(W, GRID, false);

    // dashed stalks from each tip down to the floor, so heights can be read
    ctx.strokeStyle = '#9aa3ab';
    for (const P of [A, B, c]) {
      if (Math.abs(P[1]) > 1e-6) dashed(ctx, [xy(P), xy([P[0], 0, P[2]])], W.thin, W.dash);
    }

    // the parallelogram A and B span - its area is |A x B|
    const AB = add(A, B);
    ctx.fillStyle = 'rgba(212, 160, 23, 0.18)';
    fillShape(ctx, [xy(O), xy(A), xy(AB), xy(B)]);
    ctx.strokeStyle = css(C.aux);
    ctx.globalAlpha = 0.8;
    dashed(ctx, [xy(A), xy(AB), xy(B)], W.thin, W.dash);
    ctx.globalAlpha = 1;

    // right-angle marks: a small square in the plane of A x B and each of
    // A and B, at the origin
    if (hasC) {
      const ch = scale(c, 1 / len(c));
      const s = 0.5;
      ctx.strokeStyle = css(C.result);
      for (const u of [A, B]) {
        if (len(u) < 1e-6) continue;
        const uh = scale(u, s / len(u));
        stroke(ctx, [xy(uh), xy(add(uh, scale(ch, s))), xy(scale(ch, s))], W.thin);
      }
    }

    // the three arrows, farthest first, so a nearer one is drawn over it
    const arrows = [
      { v: A, colour: C.accentA, text: 'A' },
      { v: B, colour: C.accentB, text: 'B' },
      { v: c, colour: C.result, text: product },
    ].filter((a) => len(a.v) > 1e-6)
      .map((a) => ({ ...a, depth: project(scale(a.v, 0.5))[2] }))
      .sort((p, q) => p.depth - q.depth);
    for (const a of arrows) {
      ctx.strokeStyle = ctx.fillStyle = css(a.colour);
      arrow(ctx, xy(O), xy(a.v), a.colour === C.result ? W.arrow * 1.25 : W.arrow);
    }
    ctx.fillStyle = css(C.handle);
    disc(ctx, xy(O), W.dot);
    // the handles: a black dot on each tip
    for (const v of [A, B]) disc(ctx, xy(v), W.dot * 1.5);

    // labels last, so no arrow strikes through them
    for (const a of arrows) {
      ctx.fillStyle = css(a.colour);
      const tip = xy(a.v), o = xy(O);
      const dx = tip[0] - o[0], dy = tip[1] - o[1], l = Math.hypot(dx, dy) || 1;
      const at = [tip[0] + (dx / l) * W.text * 0.9, tip[1] + (dy / l) * W.text * 0.9];
      label(ctx, at, a.text, W.text, dx > 0.3 * l ? 'left' : dx < -0.3 * l ? 'right' : 'center', 0, true);
    }

    view.corner(W, 'drag a dot to move it · drag elsewhere to orbit · scroll to zoom');
  }

  group(`Vector ${V('A')}`, 'A', A);
  group(`Vector ${V('B')}`, 'B', B);
  el.appendChild(row);
  built = true;
  update();
}
