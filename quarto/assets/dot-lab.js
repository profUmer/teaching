/*
 * dot-lab.js - the dot product, for Game Math 1's Vector Operations deck.
 *
 *   <div class="lab-mount" data-lab="dot-product"></div>
 *
 * The companion to the cross product lab, laid out the same way: sliders for
 * A and B, then a flat 2D view of both from the origin with the angle between
 * them, and A projected onto B drawn as the slide does it - a dashed drop from
 * A's tip square onto B's direction, and a green arrow from the origin to
 * where it lands, labelled (A . B^) B^. The black dots at A's and B's tips can
 * be dragged too, and the sliders follow.
 *
 * Beside the view, the values only, each in its drawing's colour: A, B, the
 * angle, A . B, A . B^ and (A . B^) B^. A button switches to B projected onto
 * A and back: A . B stays put, but the projection does not.
 *
 * (vector-lab.js's drag-based `dot` mode, used by vectors.qmd, is the older
 * take on the same idea, with the arithmetic in its readout.)
 */

import { C, slider, button, fmt, makeDraggable } from './lab-core.js';
import { makeStage2D, stroke, dashed, arrow, arc, disc, label, css } from './draw2d.js';

// Each slider spans what the view shows: about ±10 across the slide's wide
// stage, ±5.5 up and down.
const RANGES = [{ min: -10, max: 10, step: 0.1 }, { min: -5, max: 5, step: 0.1 }];
const VIEW = 5.5;   // half-height of the view, so a ±5 y fits

const one = (v) => v.toFixed(1);
const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
const len = (p) => Math.hypot(p[0], p[1]);
const scale = (p, k) => [p[0] * k, p[1] * k];
const deg = (r) => (r * 180) / Math.PI;

/* An arrow over a letter, as \vec draws it, and a hat, as \hat does - in CSS,
   since the combining marks render as a box in the theme's font. */
const V = (s) => `<span class="ray-vec">${s}</span>`;
const H = (s) => `<span class="dot-hat">${s}</span>`;
/* Coloured to match the drawing: A red, B blue. */
const tint = (html, colour) => `<span style="color: ${css(colour)}">${html}</span>`;
const LETTER = { A: C.accentA, B: C.accentB };
const Vc = (s) => tint(V(s), LETTER[s]);
const Hc = (s) => tint(H(s), LETTER[s]);

export function mountDotLab(el, opts = {}) {
  el.classList.add('lab', 'lab-ray', 'lab-dot-product');

  const A = [...(opts.vecA ?? [2, 3])].slice(0, 2);
  const B = [...(opts.vecB ?? [4, 1])].slice(0, 2);
  let swapped = false;   // B along A rather than A along B
  // [the vector projected, the one it lands on, their letters]
  const order = () => (swapped ? [B, A, 'B', 'A'] : [A, B, 'A', 'B']);

  const inputs = document.createElement('div');
  inputs.className = 'ray-inputs';
  inputs.style.setProperty('--ray-cols', 2);
  el.appendChild(inputs);

  const sliders = {};   // A: [x, y], B: [x, y], so a drag can move them
  function group(letter, vecArr) {
    const g = document.createElement('div');
    g.className = `ray-group vec-${letter.toLowerCase()}`;   // in its arrow's colour
    const h = document.createElement('div');
    h.className = 'ray-group-title';
    h.innerHTML = `Vector ${V(letter)}`;
    const controls = document.createElement('div');
    controls.className = 'lab-controls';
    g.append(h, controls);
    inputs.appendChild(g);
    sliders[letter] = ['x', 'y'].map((axis, i) =>
      slider(controls, { label: `${letter}<sub>${axis}</sub>`, ...RANGES[i], value: vecArr[i], format: one },
        (v) => { vecArr[i] = v; update(); }));
  }

  // The view on the left; the values and the button on the right.
  const row = document.createElement('div');
  row.className = 'ray-row';
  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const out = document.createElement('div');
  out.className = 'ray-out cross-out';
  row.append(stageEl, out);

  // one row each: name, then value
  const components = document.createElement('div');
  components.className = 'cross-components';
  const rowFor = (colour) => {
    const name = document.createElement('span');
    name.className = 'cross-name';
    const value = document.createElement('span');
    value.className = 'cross-vector';
    if (colour !== undefined) value.style.color = css(colour);
    components.append(name, value);
    return { name, value };
  };
  const shown = {
    a: rowFor(C.accentA),
    b: rowFor(C.accentB),
    angle: rowFor(C.aux),
    dot: rowFor(),
    along: rowFor(C.result),
    proj: rowFor(C.result),
  };
  shown.a.name.innerHTML = `${Vc('A')} =`;
  shown.b.name.innerHTML = `${Vc('B')} =`;
  shown.angle.name.innerHTML = `${tint('<i>θ</i>', C.aux)} =`;
  shown.dot.name.innerHTML = `${Vc('A')} · ${Vc('B')} =`;
  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  out.append(components, buttons);

  // Labelled with what it switches to.
  const swap = button(buttons, '', () => { swapped = !swapped; swapLabel(); update(); });
  swap.classList.add('dot-swap');
  const swapLabel = () => {
    const [, , p1, q1] = order();
    swap.innerHTML = `Show ${V(q1)} along ${V(p1)}`;
  };
  swapLabel();

  const angleOf = () => {
    const l = len(A) * len(B);
    return l > 1e-9 ? deg(Math.acos(Math.max(-1, Math.min(1, dot(A, B) / l)))) : NaN;
  };
  const alongOf = () => {
    const [P, Q] = order();
    return len(Q) > 1e-9 ? dot(P, Q) / len(Q) : NaN;
  };
  // (P . Q^) Q^, where P lands on Q's direction
  const projection = () => {
    const [P, Q] = order();
    return scale(Q, dot(P, Q) / dot(Q, Q));
  };

  let built = false;
  function update() {
    if (!built) return;
    const [, , p1, q1] = order();
    const comps = (v) => `(${v.map((x) => fmt(x)).join(', ')})`;
    const theta = angleOf(), along = alongOf();
    shown.a.value.textContent = comps(A);
    shown.b.value.textContent = comps(B);
    shown.angle.value.textContent = Number.isNaN(theta) ? '–' : `${fmt(theta, 1)}°`;
    shown.dot.value.textContent = fmt(dot(A, B));
    shown.along.name.innerHTML = `${Vc(p1)} · ${Hc(q1)} =`;
    shown.along.value.textContent = fmt(along);
    // the green arrow's name, all in its green
    shown.proj.name.innerHTML = `${tint(`(${V(p1)} · ${H(q1)})${H(q1)}`, C.result)} =`;
    shown.proj.value.textContent = Number.isNaN(along) ? '–' : comps(projection());
    // for the self-test
    el.dataset.dot = fmt(dot(A, B));
    el.dataset.along = fmt(along);
    el.dataset.angle = Number.isNaN(theta) ? '–' : fmt(theta, 1);
    tips.forEach((h, i) => { [h.x, h.y] = [A, B][i]; });
    repaint();
  }

  /* --- the view ------------------------------------------------------------ */
  const stage = makeStage2D(stageEl, { view: VIEW });
  const { ctx } = stage;
  const s = VIEW / 4;
  const W = { thin: 0.03 * s, line: 0.05 * s, arrow: 0.06 * s, dash: 0.16 * s, text: 0.34 * s, handle: 0.11 * s };

  // Dragging a tip sets that vector's sliders, kept to their range and step,
  // and the sliders redraw everything from there.
  const snap = (v, { min, max }) => Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;
  const tips = [{ x: A[0], y: A[1] }, { x: B[0], y: B[1] }];
  makeDraggable(stage, tips, () => {
    // read every tip first: each set() redraws, which puts the tips back on
    // the vectors' current values
    const to = tips.map((h) => [snap(h.x, RANGES[0]), snap(h.y, RANGES[1])]);
    to.forEach((v, i) => sliders['AB'[i]].forEach((sl, k) => { if (v[k] !== sl.get()) sl.set(v[k]); }));
    update();   // back onto the slider grid even when nothing changed
  });

  function repaint() {
    if (!built || !stage.resize()) return;
    stage.begin();
    const O = [0, 0];
    const [P, Q] = order();
    const lq = len(Q);

    if (lq > 1e-9) {
      const qh = scale(Q, 1 / lq);
      const along = dot(P, qh);
      const foot = scale(qh, along);

      // the drop from P's tip, square onto Q's direction
      ctx.strokeStyle = '#9aa3ab';
      if (len([P[0] - foot[0], P[1] - foot[1]]) > 1e-6) {
        dashed(ctx, [P, foot], W.thin, W.dash);
        // a right-angle mark where it lands, on the side towards the origin
        // and towards P
        const m = 0.3;
        const back = Math.abs(along) > 1e-6 ? scale(qh, -Math.sign(along) * m) : scale(qh, m);
        const up = [P[0] - foot[0], P[1] - foot[1]];
        const uph = scale(up, m / len(up));
        stroke(ctx, [
          [foot[0] + back[0], foot[1] + back[1]],
          [foot[0] + back[0] + uph[0], foot[1] + back[1] + uph[1]],
          [foot[0] + uph[0], foot[1] + uph[1]],
        ], W.thin);
      }
    }

    // the angle between A and B, the short way round
    const la = len(A), lb = len(B);
    if (la > 1e-6 && lb > 1e-6) {
      const a0 = Math.atan2(B[1], B[0]);
      let sweep = Math.atan2(A[1], A[0]) - a0;
      if (sweep > Math.PI) sweep -= 2 * Math.PI;
      if (sweep < -Math.PI) sweep += 2 * Math.PI;
      const r = Math.min(0.8, 0.45 * Math.min(la, lb));
      ctx.strokeStyle = ctx.fillStyle = css(C.aux);
      arc(ctx, O, r, a0, a0 + sweep, W.line);
      if (Math.abs(sweep) > 0.25) {
        const mid = a0 + sweep / 2, rt = r + 0.45;
        label(ctx, [Math.cos(mid) * rt, Math.sin(mid) * rt], 'θ', W.text, 'center', 0, true);
      }
    }

    // A and B, then P's length along Q on top, narrower so Q shows either side
    ctx.strokeStyle = ctx.fillStyle = css(C.accentA);
    arrow(ctx, O, A, W.arrow);
    ctx.strokeStyle = ctx.fillStyle = css(C.accentB);
    arrow(ctx, O, B, W.arrow);
    let projLabel = null;
    if (lq > 1e-9) {
      const proj = projection();
      ctx.strokeStyle = ctx.fillStyle = css(C.result);
      arrow(ctx, O, proj, W.arrow * 0.7, 1.4);
      // named halfway along, on the side away from P and its dashed drop
      if (len(proj) > 0.6) {
        const n = [-Q[1] / lq, Q[0] / lq];
        const away = dot(P, n) > 0 ? -1 : 1;
        const off = W.text * 1.3;
        projLabel = [proj[0] / 2 + away * n[0] * off, proj[1] / 2 + away * n[1] * off];
      }
    }
    ctx.fillStyle = css(C.handle);
    disc(ctx, O, W.arrow * 1.1);
    // the handles: a black dot on each tip
    for (const v of [A, B]) if (len(v) > 1e-6) disc(ctx, v, W.handle);

    // labels last, beyond each tip
    for (const [v, colour, text] of [[A, C.accentA, 'A'], [B, C.accentB, 'B']]) {
      const l = len(v);
      if (l < 1e-6) continue;
      ctx.fillStyle = css(colour);
      const at = [v[0] + (v[0] / l) * W.text * 0.9, v[1] + (v[1] / l) * W.text * 0.9];
      label(ctx, at, text, W.text, v[0] > 0.3 * l ? 'left' : v[0] < -0.3 * l ? 'right' : 'center', 0, true);
    }
    if (projLabel) {
      const [, , p1, q1] = order();
      ctx.fillStyle = css(C.result);
      // a combining circumflex for the hat: the canvas draws in the system
      // font, which has one, unlike the theme's
      const hat = q1 + String.fromCharCode(0x302);
      label(ctx, projLabel, `(${p1} · ${hat})${hat}`, W.text, 'center', 0, true);
    }
  }

  new ResizeObserver(repaint).observe(stageEl);

  group('A', A);
  group('B', B);
  el.appendChild(row);
  built = true;
  update();
}
