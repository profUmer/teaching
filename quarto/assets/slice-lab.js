/*
 * slice-lab.js - cutting a card in two, for the Unity deck's 2D slice.
 *
 *   <div class="lab-mount" data-lab="slice"></div>
 *
 * Follows Cut the Deck's Card.Cut and Cutter.Split (UnityCourse/sandbox/
 * CutCard) a step at a time, with Prev / Next / Reset:
 *
 *   1. the cut in world space, L = P v D, through P along D, with P, D and L
 *      written out as Math2d's multivectors (x e20 + y e01 + w e12, a e1 +
 *      b e2 + c e0)
 *   2. into the card's model space, L_model = M L_world M^-1 - animated, so
 *      the card slides to the origin and straightens and the cut goes with
 *      it - and L_model written out too
 *   3. each vertex's side: its oriented distance to the cut, drawn as a grey
 *      drop, the vertex green if it is on the normal's side (a) and red if
 *      not (b), CutBench's Gizmo colours. The lists a and b appear here
 *   4. one Next per edge, as Split walks them: the vertex goes to its side's
 *      list, and an edge that crosses the cut adds the crossing point to both.
 *      Split's du and dv are shown as d0, d1, ...: the signed distance of
 *      Vertex 0, Vertex 1, ..., so they do not read as UV coordinates
 *   5. the two halves, rotated back into world space, still together, each
 *      clipped to its own part of the card's art and its vertices labelled
 *   6. pushed apart along the normal, with the normal drawn on the cut
 *      between them
 *
 * Sliders for the card's position and angle and the cut's P and direction;
 * the black dots on P and the tip of D drag too, in either space, and the
 * sliders follow. Beside the view, the step in words and the two point lists
 * as Split builds them. The step goes back to the start on arriving at the
 * slide.
 *
 * The line and its sides are worked out as Math2d.cs does it: the join of
 * the point (Px, Py, 1) and the direction (Dx, Dy, 0) is the line
 * -Dy x + Dx y + (Px Dy - Py Dx) = 0, so its normal (-Dy, Dx) points to the
 * left of the swipe, and OrientedDist is ax + by + c over |(a, b)|.
 */

import { C, slider, button, runLoop, makeDraggable, fmt } from './lab-core.js';
import { makeStage2D, stroke, dashed, arrow, disc, fillShape, label, css } from './draw2d.js';

const VIEW = 2.7;                       // half-height of the view
const HW = 1.05, HH = 1.425;            // the card's half size: Card.Width 1.4 at 140 x 190 art, x 1.5
const EPS = 1e-5;                       // Split's "within 0.00001 counts as n's side"
const PUSH = 0.5;                       // how far apart the halves end up
const SPEED = 1.4;                      // animation, in transitions per second
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];   // PolyShape.SetCard's UVs, corner by corner

const GREY = '#9aa3ab';
const SIDE_A = css(C.result);           // on the normal's side
const SIDE_B = css(C.accentA);
const CUT = css(C.accentB);
const EDGE = css(C.aux);

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const mul = (p, k) => [p[0] * k, p[1] * k];
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const smooth = (t) => t * t * (3 - 2 * t);

/* P v D, as Math2d's join of a point and a direction: [a, b, c] for ax + by + c = 0 */
const join = (P, D) => [-D[1], D[0], P[0] * D[1] - P[1] * D[0]];
const orientedDist = (p, [a, b, c]) => (a * p[0] + b * p[1] + c) / Math.hypot(a, b);

/* Math2d's motors, [real, e01, e02, e12], and the sandwich M L reverse(M) on
   a line [e1, e2, e0], formula for formula, so the M and L_model on screen
   are the ones Card.Cut works out. */
const motorMul = ([ar, a01, a02, a12], [br, b01, b02, b12]) => [
  ar * br - a12 * b12,
  ar * b01 + a12 * b02 + a01 * br - a02 * b12,
  ar * b02 - a12 * b01 + a01 * b12 + a02 * br,
  ar * b12 + a12 * br];
const translate = (x, y) => [1, -x / 2, -y / 2, 0];
const rotate = (r) => [Math.cos(r / 2), 0, 0, -Math.sin(r / 2)];
const reverse = ([r, e01, e02, e12]) => [r, -e01, -e02, -e12];
const inverse = (m) => { const k = m[0] * m[0] + m[3] * m[3]; return reverse(m).map((v) => v / k); };
function sandwich(m, [l1, l2, l0]) {
  const [r, e01, e02, e12] = m;
  // M * L, a flector: e012 and a line
  const f = -e02 * l1 + e12 * l0 + e01 * l2;
  const [f1, f2, f0] = [r * l1 + e12 * l2, r * l2 - e12 * l1, r * l0 + e01 * l1 + e02 * l2];
  // (M * L) * reverse(M): only its line part is kept
  const [rr, r01, r02, r12] = reverse(m);
  return [f1 * rr - f2 * r12, f1 * r12 + f2 * rr, -f1 * r01 - f2 * r02 + f0 * rr - f * r12];
}

/* Cutter.Split, one event per edge so the lab can step through them. */
function split(pts, line) {
  const events = [];
  const crossNames = ['X', 'Y', 'Z', 'W'];
  let crossings = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const du = orientedDist(pts[i], line), dv = orientedDist(pts[j], line);
    const uIn = du >= -EPS, vIn = dv >= -EPS;
    let cross = null;
    if (uIn !== vIn) {
      const t = du / (du - dv);                   // where along the edge the line crosses
      cross = { p: lerp(pts[i], pts[j], t), uv: lerp(UVS[i], UVS[j], t), t, name: crossNames[crossings++] ?? '?' };
    }
    events.push({ i, j, uIn, vIn, d: du, dv, cross });
  }
  return events;
}

/* The lists a and b after the first k edges: [{p, name}] each. */
function lists(pts, events, k) {
  const a = [], b = [];
  for (const e of events.slice(0, k)) {
    (e.uIn ? a : b).push({ p: pts[e.i], name: String(e.i) });
    if (e.cross) { a.push(e.cross); b.push(e.cross); }
  }
  return { a, b };
}

/* A plain playing card, drawn once: no third-party art. */
function cardFace() {
  const w = 420, h = Math.round((w * HH) / HW);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d5d9de';
  g.lineWidth = 10;
  g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = '#22282e';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 80px Georgia, serif';
  g.fillText('A', 70, 85);
  g.font = '60px Georgia, serif';
  g.fillText('♠', 70, 160);
  g.save();
  g.translate(w - 70, h - 85);
  g.rotate(Math.PI);
  g.font = '700 80px Georgia, serif';
  g.fillText('A', 0, 0);
  g.font = '60px Georgia, serif';
  g.fillText('♠', 0, -75);
  g.restore();
  g.font = '260px Georgia, serif';
  g.fillText('♠', w / 2, h / 2 + 10);
  return c;
}

export function mountSliceLab(el, opts = {}) {
  el.classList.add('lab', 'lab-ray', 'lab-slice');

  // the card: position and angle in degrees; the cut: P and D's angle
  const card = [...(opts.card ?? [1.2, 0, 20])];
  const cut = [...(opts.cut ?? [-3, -1.5, 25])];
  const corners = [[-HW, -HH], [HW, -HH], [HW, HH], [-HW, HH]];   // PolyShape.SetCard's order

  /* --- the steps --------------------------------------------------------- */
  const EDGES = corners.length;
  const SIDES = 2;                          // the lists a and b appear from here
  const FIRST_EDGE = 3;
  const WORLD = FIRST_EDGE + EDGES;         // the halves, back in world space
  const LAST = WORLD + 1;                   // and pushed apart
  let step = 0;

  // where the animations are headed, and where they are
  let space = 0, spaceTo = 0;               // 0 world, 1 model
  let apart = 0, apartTo = 0;               // 0 together, 1 split apart
  const targets = () => {
    spaceTo = step >= 1 && step < WORLD ? 1 : 0;
    apartTo = step === LAST ? 1 : 0;
  };

  /* --- layout, as dot-lab.js ---------------------------------------------- */
  const inputs = document.createElement('div');
  inputs.className = 'ray-inputs';
  inputs.style.setProperty('--ray-cols', 2);
  el.appendChild(inputs);

  const sliders = {};
  function group(key, title, cls, specs, arr) {
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
      slider(controls, { ...s, value: arr[i] }, (v) => { arr[i] = v; update(); }));
  }
  const pos = (v) => v.toFixed(1);
  const ang = (v) => `${v.toFixed(0)}°`;

  const row = document.createElement('div');
  row.className = 'ray-row';
  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const out = document.createElement('div');
  out.className = 'ray-out slice-out';
  row.append(stageEl, out);

  const caption = document.createElement('div');
  caption.className = 'slice-caption';
  const listBox = document.createElement('div');
  listBox.className = 'cross-components slice-lists';
  // each list in a sentence: its name, a or b, in the side's colour, then
  // which side of the cut, then the vertices so far
  const listRow = (name, colour, where) => {
    const n = document.createElement('span');
    n.className = 'cross-name';
    n.style.color = colour;
    n.textContent = name;
    const v = document.createElement('span');
    v.className = 'cross-vector';
    const list = document.createElement('b');
    list.style.color = colour;
    v.append(`Shape on ${where} side of the cut contains vertices: `, list);
    listBox.append(n, v);
    return list;
  };
  const listA = listRow('a', SIDE_A, 'one');
  const listB = listRow('b', SIDE_B, 'the other');
  // the working: the line written out, or an edge's distances and its t
  const working = document.createElement('div');
  working.className = 'slice-working';
  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  out.append(caption, working, listBox, buttons);

  const go = (s) => { step = Math.max(0, Math.min(LAST, s)); targets(); update(); };
  button(buttons, 'Prev', () => go(step - 1));
  button(buttons, 'Next', () => go(step + 1));
  button(buttons, 'Reset', () => go(0));

  /* --- the maths, from the sliders ---------------------------------------- */
  let geo = null;
  function solve() {
    const c = [card[0], card[1]], th = rad(card[2]);
    const P = [cut[0], cut[1]], D = [Math.cos(rad(cut[2])), Math.sin(rad(cut[2]))];
    const world = join(P, D);
    // the sandwich with world-to-model: undo the translation, then the rotation
    const Pm = rot(sub(P, c), -th), Dm = rot(D, -th);
    // Card.Cut: modelToWorld = Translate(position) * Rotate(angle), and the
    // cut goes the other way, by its inverse
    const M = inverse(motorMul(translate(c[0], c[1]), rotate(th)));
    const model = sandwich(M, world);
    const events = split(corners, model);
    const nWorld = mul([world[0], world[1]], 1 / Math.hypot(world[0], world[1]));
    geo = { c, th, P, D, Pm, Dm, M, world, model, events, nWorld };
  }

  const I = (s) => `<i>${s}</i>`;
  const tint = (html, colour) => `<span style="color:${colour}">${html}</span>`;
  const sideName = (inA) => (inA ? tint('a', SIDE_A) : tint('b', SIDE_B));
  function describe() {
    const { events } = geo;
    if (step === 0) return `The cut ${I('L')}<sub>world</sub> = ${I('P')} ∨ ${I('D')}, in world space`;
    if (step === 1) return `Into the card's model space: <span class="slice-nowrap">${I('L')}<sub>model</sub> = ${I('M')} ${I('L')}<sub>world</sub> ${I('M')}<sup>−1</sup></span>`;
    if (step === SIDES) return `Each vertex's side of the cut: <code>OrientedDist(vertex, cut)</code>, `
      + `${sideName(true)} on the normal's side, ${sideName(false)} the rest`;
    if (step < WORLD) {
      const e = events[step - FIRST_EDGE];
      let text = `Edge ${e.i} → ${e.j}: Vertex ${e.i} goes to ${sideName(e.uIn)}`;
      if (e.cross) text += `. The edge crosses the cut, so Vertex ${e.cross.name} goes to both`;
      else text += `. Both ends are on the same side, so no crossing`;
      return text;
    }
    const { a, b } = lists(corners, events, EDGES);
    if (a.length < 3 || b.length < 3) return 'The cut misses the card: everything went to one side, so there is nothing to split';
    if (step === WORLD) return 'Back in world space';
    return `Push shape ${sideName(true)} along the normal, push shape ${sideName(false)} the other way`;
  }

  /* The working under the step. P, D, M and the lines as multivectors; on an edge,
     Split's du and dv as d with the vertex's number, each in its vertex's
     side colour, and on a crossing edge t, in the edge's yellow. */
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const dName = (i) => `d${SUB[i]}`;
  function workingFor() {
    const n = (v) => fmt(v).replace('-', '−');
    const coef = (v) => Math.abs(v).toFixed(2);
    const sign = (v) => (v < 0 ? ' − ' : ' + ');
    // a multivector, as Math2d writes them: '' for the real part, else the basis
    const mv = (vs, bases) => vs.map((v, i) => {
      const term = coef(v) + (bases[i] === '' ? '' : `&thinsp;e<sub>${bases[i]}</sub>`);
      return (i === 0 ? (v < 0 ? '−' : '') : sign(v)) + term;
    }).join('');
    const name = (n, sub) => (sub ? `${I(n)}<sub>${sub}</sub>` : I(n));
    const row = (lhs, rhs) => `<div class="slice-pga">${lhs} = ${rhs}</div>`;
    const point = (n, q, w) => row(name(n), mv([q[0], q[1], w], ['20', '01', '12']));
    const line = (sub, l) => row(name('L', sub), mv(l, ['1', '2', '0']));
    if (step === 0) return point('P', geo.P, 1) + point('D', geo.D, 0) + line('world', geo.world);
    if (step === 1) return row(I('M'), mv(geo.M, ['', '01', '02', '12'])) + line('world', geo.world) + line('model', geo.model);
    // the sides are measured against the model-space line alone
    if (step < FIRST_EDGE) return line('model', geo.model);
    if (step >= WORLD) return '';
    const e = geo.events[step - FIRST_EDGE];
    const di = tint(dName(e.i), e.uIn ? SIDE_A : SIDE_B), dj = tint(dName(e.j), e.vIn ? SIDE_A : SIDE_B);
    let html = `<div>${di} = ${tint(n(e.d), e.uIn ? SIDE_A : SIDE_B)}&emsp;&emsp;${dj} = ${tint(n(e.dv), e.vIn ? SIDE_A : SIDE_B)}</div>`;
    if (!e.cross) return html;
    html += `<div>t = ${di} / (${di} − ${dj}) = ${tint(n(e.cross.t), EDGE)}</div>`
      + `<div class="slice-prose">${e.cross.name} = Lerp from Vertex ${e.i} to Vertex ${e.j} using t</div>`;
    return html;
  }

  function update() {
    if (!built) return;
    solve();
    caption.innerHTML = describe();
    working.innerHTML = workingFor();
    const k = step >= FIRST_EDGE ? Math.min(step - FIRST_EDGE + 1, EDGES) : 0;
    const { a, b } = lists(corners, geo.events, k);
    const names = (l) => (l.length ? l.map((q) => q.name).join(', ') : '–');
    listA.textContent = names(a);
    listB.textContent = names(b);
    listBox.style.visibility = step >= SIDES ? '' : 'hidden';
    // for the self-test
    el.dataset.step = String(step);
    el.dataset.listA = names(a);
    el.dataset.listB = names(b);
    el.dataset.motor = geo.M.map((v) => v.toFixed(2)).join(' ');
    el.dataset.model = geo.model.map((v) => v.toFixed(2)).join(' ');
    placeHandles();
    dirty = true;
  }

  /* --- the view ----------------------------------------------------------- */
  const stage = makeStage2D(stageEl, { view: VIEW });
  const { ctx } = stage;
  const s = VIEW / 4;
  const W = { thin: 0.03 * s, line: 0.05 * s, thick: 0.09 * s, arrow: 0.06 * s, dash: 0.16 * s, text: 0.34 * s, handle: 0.11 * s, dot: 0.1 * s };
  const face = cardFace();
  const DLEN = 1.2;                         // how long D is drawn

  // World to view: R(-th m)(p - c m), m going 0 (world) to 1 (model)
  const viewAngle = () => -geo.th * smooth(space);
  const viewShift = () => mul(geo.c, smooth(space));
  const toView = (p) => rot(sub(p, viewShift()), viewAngle());
  const fromView = (q) => add(rot(q, -viewAngle()), viewShift());
  const dirToView = (d) => rot(d, viewAngle());
  // a model-space point, with the card (or a half) offset in world space
  const modelToView = (q, offset = [0, 0]) => toView(add(add(rot(q, geo.th), geo.c), offset));

  // P and the tip of D, in view coordinates
  const handles = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  function placeHandles() {
    const p = toView(geo.P), tip = add(p, mul(dirToView(geo.D), DLEN));
    [handles[0].x, handles[0].y] = p;
    [handles[1].x, handles[1].y] = tip;
  }
  const snap = (v, { min, max }, k = 10) => Math.round(Math.min(max, Math.max(min, v)) * k) / k;
  // A drag moves one handle; whichever is off its place is the one held.
  makeDraggable(stage, handles, () => {
    const p = toView(geo.P);
    if (Math.hypot(handles[0].x - p[0], handles[0].y - p[1]) > 1e-9) {
      const P = fromView([handles[0].x, handles[0].y]);
      sliders.cut[0].set(snap(P[0], CUT_SPECS[0]));
      sliders.cut[1].set(snap(P[1], CUT_SPECS[1]));
    } else {
      const d = rot(sub([handles[1].x, handles[1].y], p), -viewAngle());
      if (Math.hypot(d[0], d[1]) > 1e-6) sliders.cut[2].set(snap(deg(Math.atan2(d[1], d[0])), CUT_SPECS[2], 1));
    }
    update();   // back onto the slider grid even when nothing changed
  });

  function poly(points, colour, width, closed) {
    ctx.strokeStyle = colour;
    stroke(ctx, points, width, closed);
  }

  function drawFace(clip, offset, alpha) {
    const o = modelToView([0, 0], offset);
    const a = geo.th + viewAngle();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.transform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), o[0], o[1]);
    ctx.beginPath();
    clip.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1]));
    ctx.closePath();
    ctx.clip();
    ctx.scale(1, -1);
    ctx.drawImage(face, -HW, -HH, 2 * HW, 2 * HH);
    ctx.restore();
  }

  function repaint() {
    if (!built || !stage.resize()) return;
    stage.begin();
    const { events } = geo;
    const all = lists(corners, events, EDGES);
    const k = step >= FIRST_EDGE ? Math.min(step - FIRST_EDGE + 1, EDGES) : 0;
    const sofar = lists(corners, events, k);
    const halves = step >= WORLD && all.a.length >= 3 && all.b.length >= 3;
    const V = (q) => modelToView(q);
    const p = toView(geo.P), d = dirToView(geo.D);
    const nv = dirToView(geo.nWorld);

    // where a vertex's name goes: a corner's out from the card's centre, a
    // crossing's along the cut and off it, so the cut line does not run through it
    const cornerLabel = (q) => {
      const away = sub(V(q), V([0, 0])), l = Math.hypot(away[0], away[1]);
      return add(V(q), mul(away, (W.text * 0.9) / l));
    };
    const crossLabel = (q) => add(add(V(q), mul(d, W.text * 0.9)), mul(nv, -W.text * 0.6));
    const crossDot = (at, name, labelAt) => {
      ctx.fillStyle = EDGE;
      disc(ctx, at, W.dot * 1.15);
      ctx.fillStyle = '#22282e';
      label(ctx, labelAt, name, W.text, 'center', 0, true);
    };

    // the card, or its two halves: each half's offset is a world-space push
    // along the normal, a toward it and b away
    const split = smooth(apart) * PUSH;
    const halfList = [[all.a, 1, SIDE_A], [all.b, -1, SIDE_B]].map(([pts, sign, colour]) => {
      const off = mul(geo.nWorld, sign * split);
      return { pts, colour, off, shift: sub(modelToView([0, 0], off), V([0, 0])) };
    });
    if (halves) {
      for (const h of halfList) {
        const pts = h.pts.map((q) => q.p);
        drawFace(pts, h.off, 1);
        poly(pts.map((q) => modelToView(q, h.off)), h.colour, W.line, true);
      }
    } else {
      drawFace(corners, [0, 0], step >= SIDES ? 0.45 : 1);
      poly(corners.map(V), '#22282e', W.thin, true);
    }

    // the card's own axes, in grey: in model space they lie on the grid's
    if (!halves) {
      ctx.strokeStyle = ctx.fillStyle = GREY;
      arrow(ctx, V([0, 0]), V([0.7, 0]), W.thin * 1.4);
      arrow(ctx, V([0, 0]), V([0, 0.7]), W.thin * 1.4);
    }

    // the cut: a long line through P along D, P's dot and D's arrow
    ctx.strokeStyle = CUT;
    stroke(ctx, [add(p, mul(d, -40)), add(p, mul(d, 40))], W.line);
    ctx.fillStyle = CUT;
    arrow(ctx, p, add(p, mul(d, DLEN)), W.arrow);
    // its normal, in a's colour, once the sides matter: from P while walking
    // the edges, and on the cut between the halves as they part
    ctx.strokeStyle = ctx.fillStyle = SIDE_A;
    if (step >= SIDES && step < WORLD) arrow(ctx, p, add(p, mul(nv, 0.8)), W.arrow * 0.8);
    if (halves && step === LAST) {
      const xs = all.a.filter((q) => 't' in q).map((q) => V(q.p));
      const mid = mul(xs.reduce(add, [0, 0]), 1 / xs.length);
      ctx.globalAlpha = smooth(apart);
      arrow(ctx, mid, add(mid, mul(nv, 0.85 * PUSH)), W.arrow * 0.8);
      ctx.globalAlpha = 1;
    }

    // the sides: a grey drop from each vertex onto the cut
    if (step >= SIDES && step < WORLD) {
      const n = [geo.model[0], geo.model[1]];
      const nl = Math.hypot(n[0], n[1]);
      for (const e of events) {
        const q = corners[e.i];
        const foot = sub(q, mul(n, e.d / nl));
        ctx.strokeStyle = GREY;
        dashed(ctx, [V(q), V(foot)], W.thin, W.dash);
      }
    }

    // the edges walked so far: a and b as Split builds them, and this edge
    if (step >= FIRST_EDGE && step < WORLD) {
      poly(sofar.a.map((q) => V(q.p)), SIDE_A, W.line, false);
      poly(sofar.b.map((q) => V(q.p)), SIDE_B, W.line, false);
      const e = events[step - FIRST_EDGE];
      ctx.strokeStyle = EDGE;
      ctx.globalAlpha = 0.85;
      stroke(ctx, [V(corners[e.i]), V(corners[e.j])], W.thick);
      ctx.globalAlpha = 1;
      // its two drops, named for their vertices: halfway down, outside the
      // edge, and over the edge's yellow so it cannot hide them
      const n = [geo.model[0], geo.model[1]];
      const nl = Math.hypot(n[0], n[1]);
      const mid = lerp(corners[e.i], corners[e.j], 0.5);
      for (const [k, dist, inside] of [[e.i, e.d, e.uIn], [e.j, e.dv, e.vIn]]) {
        if (Math.abs(dist) < 0.15) continue;
        const q = corners[k];
        const half = sub(q, mul(n, dist / nl / 2));
        const out = sub(q, mid), ol = Math.hypot(out[0], out[1]);
        ctx.fillStyle = inside ? SIDE_A : SIDE_B;
        label(ctx, V(add(half, mul(out, W.text / ol))), dName(k), W.text * 0.9, 'center', 0, true);
      }
    }

    // the vertices and crossing points, with their names: on the halves, each
    // half carries its own copy, which sit on top of each other until they part
    if (halves) {
      for (const h of halfList) {
        for (const q of h.pts) {
          if ('t' in q) { crossDot(add(V(q.p), h.shift), q.name, add(crossLabel(q.p), h.shift)); continue; }
          ctx.fillStyle = h.colour;
          disc(ctx, add(V(q.p), h.shift), W.dot);
          label(ctx, add(cornerLabel(q.p), h.shift), q.name, W.text, 'center', 0, true);
        }
      }
    } else {
      events.forEach((e) => {
        ctx.fillStyle = step >= SIDES ? (e.uIn ? SIDE_A : SIDE_B) : '#22282e';
        disc(ctx, V(corners[e.i]), W.dot);
        label(ctx, cornerLabel(corners[e.i]), String(e.i), W.text, 'center', 0, true);
      });
      if (step >= FIRST_EDGE) {
        events.slice(0, k).forEach((e) => {
          if (e.cross) crossDot(V(e.cross.p), e.cross.name, crossLabel(e.cross.p));
        });
      }
    }

    // the handles, and their names
    ctx.fillStyle = css(C.handle);
    disc(ctx, p, W.handle);
    disc(ctx, add(p, mul(d, DLEN)), W.handle);
    ctx.fillStyle = CUT;
    label(ctx, add(p, mul([d[1], -d[0]], W.text * 1.1)), 'P', W.text, 'center', 0, true);
    label(ctx, add(add(p, mul(d, DLEN)), mul([d[1], -d[0]], W.text * 1.1)), 'D', W.text, 'center', 0, true);

    // which space we are in, top left
    ctx.fillStyle = '#55606b';
    const halfW = VIEW * (stage.canvas.width / stage.canvas.height);
    label(ctx, [-halfW + 0.2, VIEW - 0.3], space > 0.5 ? 'model space' : 'world space', W.text * 0.9, 'left', 0, true);
  }

  /* --- running: animate, and start over on arriving at the slide ---------- */
  const onSlide = () => !el.closest('.reveal') || !!el.closest('section.present');
  // off a deck (the self-test, the preview page) there is no arriving
  let away = !!el.closest('.reveal'), last = null, dirty = true;
  function frame(t) {
    const here = onSlide();
    if (here && away) { step = 0; targets(); space = spaceTo; apart = apartTo; update(); }
    away = !here;
    const now = (t ?? performance.now()) / 1000;
    const dt = last == null ? 0 : Math.max(0, Math.min(now - last, 0.05));
    last = now;
    const toward = (v, to) => (v < to ? Math.min(to, v + SPEED * dt) : Math.max(to, v - SPEED * dt));
    if (space !== spaceTo || apart !== apartTo) {
      space = toward(space, spaceTo);
      apart = toward(apart, apartTo);
      placeHandles();
      dirty = true;
    }
    if (dirty) { dirty = false; repaint(); }
  }
  new ResizeObserver(() => { dirty = true; }).observe(stageEl);

  const CARD_SPECS = [
    { label: 'x', min: -3, max: 3, step: 0.1, format: pos },
    { label: 'y', min: -1, max: 1, step: 0.1, format: pos },
    { label: 'θ', min: -180, max: 180, step: 1, format: ang },
  ];
  const CUT_SPECS = [
    { label: 'P<sub>x</sub>', min: -5, max: 5, step: 0.1, format: pos },
    { label: 'P<sub>y</sub>', min: -2.5, max: 2.5, step: 0.1, format: pos },
    { label: 'D', min: -180, max: 180, step: 1, format: ang },
  ];
  let built = false;
  group('card', 'Card', 'slice-card', CARD_SPECS, card);
  group('cut', `Cut ${I('L')} = ${I('P')} ∨ ${I('D')}`, 'slice-cut', CUT_SPECS, cut);
  el.appendChild(row);
  built = true;
  targets();
  update();
  runLoop(el, frame);
}
