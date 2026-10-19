/*
 * ray-lab.js - the ray-sphere quadratic, for Game Physics 3's Ray
 * Intersections deck.
 *
 *   <div class="lab-mount" data-lab="ray-sphere"></div>
 *
 * Sliders for the ray's start S and direction D, and the sphere's centre C
 * and radius r, all in 3D. Below them, a 3D view of the ray and the sphere
 * beside the slide's three coefficients and the discriminant:
 *
 *   a = D . D
 *   b = 2 D . (S - C)
 *   c = (S - C) . (S - C) - r^2
 *   discriminant = b^2 - 4ac
 *
 * The discriminant is coloured by its sign (red below zero, amber at zero,
 * green above) so "how many hits" can be read at a glance without the lab
 * solving for t - that step stays on the slide. The picture marks no hit
 * points either: the ray is simply seen to pass through, graze or miss.
 *
 * The defaults are a ray down the x-axis at a unit sphere 5 along it:
 * a = 1, b = -10, c = 24, discriminant 4 (two hits, t = 4 and 6). Moving
 * C_y to 1 makes it a tangent (discriminant 0). lab-selftest.html pins both.
 *
 * The 3D view is Canvas 2D with a hand-written orbit camera, like
 * transform-lab3d.js (PLAN.md 2.1): drag to orbit, scroll to zoom. The ray is
 * drawn solid for t >= 0 and as a faint dashed line for t < 0, behind the
 * start - the quadratic counts hits on that half too, which is why a sphere
 * behind the ray still gives a positive discriminant. Anything the sphere
 * hides is drawn dashed under it, found with the same quadratic: a point is
 * hidden if the line from the eye to it enters the sphere first.
 */

import { C, slider, button, valuePanel, fmt } from './lab-core.js';
import { makeStage2D, stroke, dashed, arrow, disc, fillShape, label, css } from './draw2d.js';

const DEFAULTS = {
  start: [0, 0, 0],
  dir: [1, 0, 0],
  centre: [5, 0, 0],
  radius: 1,
};

const POS = { min: -10, max: 10, step: 0.1 };
const DIR = { min: -5, max: 5, step: 0.1 };
const RAD = { min: 0, max: 10, step: 0.1 };

const one = (v) => v.toFixed(1);

/* An arrow over a letter, as \vec draws it. A combining U+20D7 renders as a
   box in the theme's UI font (TUTORIAL.md §10), hence CSS instead. */
const V = (letter) => `<span class="ray-vec">${letter}</span>`;

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const along = (p, d, t) => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];

export function mountRayLab(el, opts = {}) {
  el.classList.add('lab', 'lab-ray');

  // One object the sliders write into and the scene reads from.
  const st = {
    S: [...(opts.start ?? DEFAULTS.start)],
    D: [...(opts.dir ?? DEFAULTS.dir)],
    C: [...(opts.centre ?? DEFAULTS.centre)],
    r: opts.radius ?? DEFAULTS.radius,
  };

  const inputs = document.createElement('div');
  inputs.className = 'ray-inputs';
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
    const { S, D, C: Cc, r } = st;
    const SC = sub(S, Cc);
    const a = dot(D, D);
    const b = 2 * dot(D, SC);
    const c = dot(SC, SC) - r * r;
    const d = b * b - 4 * a * c;
    const sign = Math.abs(d) < 5e-3 ? 'ray-zero' : d < 0 ? 'ray-neg' : 'ray-pos';

    values.update([
      [`<i>a</i> = ${V('D')}<sup>2</sup>`, fmt(a)],
      [`<i>b</i> = 2${V('D')} · (${V('S')} − ${V('C')})`, fmt(b)],
      [`<i>c</i> = (${V('S')} − ${V('C')})<sup>2</sup> − <i>r</i><sup>2</sup>`, fmt(c)],
      [`discriminant = <i>b</i><sup>2</sup> − 4<i>ac</i>`, fmt(d), `ray-disc ${sign}`],
    ]);
    el.dataset.disc = sign.slice(4);   // neg | zero | pos, for the self-test
    scene.paint();
  }

  const scene = makeScene(stageEl, st, opts);
  button(buttons, 'Reset view', () => scene.reset());

  xyz(group(`Ray start ${V('S')}`), 'S', st.S, POS);
  xyz(group(`Ray direction ${V('D')}`), 'D', st.D, DIR);
  const sphere = group(`Sphere centre ${V('C')}, radius <i>r</i>`);
  xyz(sphere, 'C', st.C, POS);
  slider(sphere, { label: '<i>r</i>', ...RAD, value: st.r, format: one }, (v) => { st.r = v; update(); });

  el.appendChild(row);
  built = true;
  update();
}

/* ============================================================== 3D view === */

const RAY = 0x8d1b1b;      // the deck's dark red: the ray and D
const BALL = C.accentB;    // the sphere
const AXIS_COLOUR = { x: C.basisX, y: C.basisY, z: C.result };

function makeScene(stageEl, st, opts) {
  const yaw0 = opts.yaw ?? -32;
  const pitch0 = opts.pitch ?? 22;
  const view0 = opts.view ?? 3.5;

  /* makeStage2D supplies the canvas, its sizing and devicePixelRatio
     handling; its flat grid is not used - paint() lays down a floor. */
  const stage = makeStage2D(stageEl, { view: view0 });
  const { ctx, canvas } = stage;

  const cam = { yaw: rad(yaw0), pitch: rad(pitch0), view: view0 };
  // The camera orbits the point halfway between the starting S and C, so the
  // opening picture is framed on the ray and the sphere rather than on the
  // origin. Fixed from then on: a target that followed the sliders would
  // make a moving sphere look as if it were standing still.
  const target = st.S.map((v, i) => (v + st.C[i]) / 2);
  const DIST = 45;   // eye distance from the target; far enough to stay outside any sphere the sliders allow
  const BOX = 12;    // the ray is drawn only inside this cube - it is infinite
  const GRID = 10;   // floor half-width, matching the sliders' range
  const LIFT = 0.2;  // origin offset below centre, as a fraction of half-height

  /* --- camera -------------------------------------------------------------- */
  /* An orbit camera, as in transform-lab3d.js: turn the world by yaw about y,
     tip it by pitch about x, then divide by depth. `right`, `up` and `back`
     are the camera's axes in world space (the rows of that rotation), so the
     eye sits at target + DIST * back. */
  let B = null;
  function basis() {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    B = {
      right: [cy, 0, sy],
      up: [sp * sy, cp, -sp * cy],
      back: [-cp * sy, sp, cp * cy],
    };
    B.eye = B.back.map((v, i) => target[i] + v * DIST);
  }

  // -> [screen x, screen y, perspective scale at that depth]
  function project(p) {
    const q = sub(p, target);
    const k = DIST / Math.max(DIST - dot(q, B.back), 0.5);
    return [dot(q, B.right) * k, dot(q, B.up) * k, k];
  }
  const xy = (p) => project(p).slice(0, 2);

  /* --- occlusion ----------------------------------------------------------- */
  /* Is P behind the sphere? Cast a ray from the eye to P and solve the slide's
     own quadratic: hidden if it enters the sphere before reaching P. The eye
     is never inside the sphere: the target and C are at most 34.7 apart
     (both within the sliders' cube), and 45 - 34.7 is more than the
     largest radius. */
  function hidden(P) {
    if (st.r <= 0) return false;
    const d = sub(P, B.eye), f = sub(B.eye, st.C);
    const a = dot(d, d), b = 2 * dot(d, f), c = dot(f, f) - st.r * st.r;
    const disc2 = b * b - 4 * a * c;
    if (disc2 <= 0 || a < 1e-12) return false;
    const s = (-b - Math.sqrt(disc2)) / (2 * a);
    return s > 0 && s < 1 - 1e-6;
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

  /* Where the line S + tD is inside the cube |x|, |y|, |z| <= BOX - the slab
     test. null if D is zero or the line misses the cube. */
  function clipLine(S, D) {
    let t0 = -Infinity, t1 = Infinity;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(D[i]) < 1e-9) {
        if (Math.abs(S[i]) > BOX) return null;
        continue;
      }
      let a = (-BOX - S[i]) / D[i], b = (BOX - S[i]) / D[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    return t0 < t1 ? [t0, t1] : null;
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
      const len = a === 'y' ? GRID * 0.6 : GRID + 0.6;
      if (a !== 'y') {
        ctx.strokeStyle = css(C.axis);
        seg(e.map((v) => -v * GRID), [0, 0, 0], W.axis);
      }
      ctx.strokeStyle = css(AXIS_COLOUR[a]);
      seg([0, 0, 0], e.map((v) => v * len), W.axis * 1.3);
      ctx.fillStyle = css(AXIS_COLOUR[a]);
      label(ctx, xy(e.map((v) => v * (len + 0.5))), a, W.text, 'center');
    }
  }

  /* Draws a set of runs: those matching `which` only, so the hidden parts
     can go down before the sphere and the visible ones after it. */
  function drawRuns(list, which, style) {
    for (const run of list) {
      if (run.flag !== which || run.pts.length < 2) continue;
      if (style.dash) dashed(ctx, run.pts, style.width, style.dash);
      else stroke(ctx, run.pts, style.width);
    }
  }

  function paint() {
    if (!canvas.width || !canvas.height) return;
    basis();
    begin();
    const v = cam.view;
    const W = {
      grid: 0.006 * v, axis: 0.011 * v, ray: 0.016 * v, arrow: 0.028 * v, thin: 0.009 * v,
      dot: 0.03 * v, text: 0.105 * v, dash: 0.035 * v, hint: 0.075 * v,
    };
    const { S, D, C: Cc, r } = st;

    floor(W);

    // the sphere's shadow on the floor, and dashed stalks down to it from C
    // and S, so their heights can be read
    if (r > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
      const ring = [];
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        ring.push(xy([Cc[0] + r * Math.cos(a), 0, Cc[2] + r * Math.sin(a)]));
      }
      fillShape(ctx, ring);
    }
    ctx.strokeStyle = '#9aa3ab';
    for (const P of [Cc, S]) {
      if (Math.abs(P[1]) > 1e-6) dashed(ctx, [xy(P), xy([P[0], 0, P[2]])], W.thin, W.dash);
    }

    // the ray, split at S into t < 0 and t >= 0, each split again by the
    // sphere into hidden and visible runs
    const span = clipLine(S, D);
    const back = span && span[0] < 0 ? runs((u) => along(S, D, span[0] * (1 - u)), 120, hidden) : [];
    const fwd = span && span[1] > 0 ? runs((u) => along(S, D, span[1] * u), 240, hidden) : [];
    const sHidden = hidden(S);
    const hasD = dot(D, D) > 1e-12;

    const BACK_HIDDEN = { width: W.thin, dash: W.dash };
    const BACK_SHOWN = { width: W.thin, dash: W.dash };
    const FWD_HIDDEN = { width: W.ray, dash: W.dash * 1.4 };
    const FWD_SHOWN = { width: W.ray };

    function startAndDirection() {
      ctx.strokeStyle = ctx.fillStyle = css(RAY);
      if (hasD) arrow(ctx, xy(S), xy(along(S, D, 1)), W.arrow);
      ctx.fillStyle = css(C.handle);
      disc(ctx, xy(S), W.dot);
    }

    // under the sphere: whatever it hides
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#9aa3ab';
    drawRuns(back, true, BACK_HIDDEN);
    ctx.strokeStyle = css(RAY);
    drawRuns(fwd, true, FWD_HIDDEN);
    ctx.globalAlpha = 1;
    if (sHidden) startAndDirection();

    if (r > 0) {
      const pc = project(Cc);
      const rs = r * pc[2];

      // the far half of the equator, seen through the sphere
      const equator = runs((u) => {
        const a = u * Math.PI * 2;
        return [Cc[0] + r * Math.cos(a), Cc[1], Cc[2] + r * Math.sin(a)];
      }, 96, (Q) => dot(sub(Q, Cc), sub(B.eye, Q)) > 0);   // facing the eye?
      ctx.strokeStyle = css(BALL);
      ctx.globalAlpha = 0.35;
      drawRuns(equator, false, { width: W.thin, dash: W.dash * 0.6 });

      // a translucent ball, lit from the upper left
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
      const edge = along(Cc, B.right, r);
      ctx.strokeStyle = ctx.fillStyle = css(C.handle);
      stroke(ctx, [xy(Cc), xy(edge)], W.thin);
      disc(ctx, xy(Cc), W.dot * 0.8);
      // no halo here: on the ball it would read as a white box
      label(ctx, xy(along(Cc, B.right, r / 2)), 'r', W.text, 'center', W.text * 0.6);
      label(ctx, xy(Cc), 'C', W.text, 'right', W.text * 0.6);
    } else {
      ctx.fillStyle = css(BALL);
      disc(ctx, xy(Cc), W.dot * 0.8);
      label(ctx, xy(Cc), 'C', W.text, 'right', W.text * 0.75, true);
    }

    // over the sphere: whatever it does not hide
    ctx.strokeStyle = '#9aa3ab';
    drawRuns(back, false, BACK_SHOWN);
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
    label(ctx, [-halfW + 0.1 * v, v * (1 + LIFT) - 0.1 * v], 'drag to orbit · scroll to zoom', W.hint, 'left');
  }

  /* --- orbit and zoom ------------------------------------------------------ */
  /* Neither touches the readout: moving the camera changes the picture, not
     the ray or the sphere. */
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
