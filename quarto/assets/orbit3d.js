/*
 * orbit3d.js - the 3D view shared by the ray and cross product labs: a
 * Canvas 2D stage with an orbit camera, a floor grid and axes. Drag to orbit,
 * scroll to zoom.
 *
 * Still Canvas 2D, not three.js (PLAN.md 2.1): the camera is two rotations
 * and a divide by depth, the same projection transform-lab3d.js writes out,
 * and every lab draws through draw2d.js on top of it.
 *
 *   const view = makeOrbitView(stageEl, opts, paint);
 *
 * `paint` is called whenever the picture must be redrawn - an orbit, a zoom,
 * a resize (which is also how a slide becoming visible, or ?print-pdf, shows
 * up). It starts with view.begin(), which clears the canvas, sets up the
 * camera for this frame and returns line widths scaled to the zoom, then
 * draws with view.xy() / view.project(). A lab also calls paint itself when
 * its own sliders change.
 */

import { C } from './lab-core.js';
import { makeStage2D, stroke, label, css } from './draw2d.js';

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];

const AXIS_COLOUR = { x: C.basisX, y: C.basisY, z: C.result };

/*
 * opts: yaw, pitch (degrees, default -32 and 22), view (half-height in world
 * units at the target's depth, default 3.5), target (the point orbited,
 * default the origin), dist (eye distance from the target, default 45 -
 * far enough that the perspective stays gentle), lift (how far below centre
 * the target sits, as a fraction of half-height, default 0.2).
 */
export function makeOrbitView(stageEl, opts, paint) {
  const yaw0 = opts.yaw ?? -32;
  const pitch0 = opts.pitch ?? 22;
  const view0 = opts.view ?? 3.5;
  const target = opts.target ?? [0, 0, 0];
  const DIST = opts.dist ?? 45;
  const LIFT = opts.lift ?? 0.2;

  /* makeStage2D supplies the canvas, its sizing and devicePixelRatio
     handling; its flat grid is not used - floor() lays down a 3D one. */
  const stage = makeStage2D(stageEl, { view: view0 });
  const { ctx, canvas } = stage;
  const cam = { yaw: rad(yaw0), pitch: rad(pitch0), view: view0 };

  /* --- camera -------------------------------------------------------------- */
  /* An orbit camera, as in transform-lab3d.js: turn the world by yaw about y,
     tip it by pitch about x, then divide by depth. `right`, `up` and `back`
     are the camera's axes in world space (the rows of that rotation), so the
     eye sits at target + DIST * back. With x right and y up, +z comes toward
     the viewer: a right-handed frame, which the cross product relies on. */
  const view = { ctx, canvas, cam, target, axes: null };

  function basis() {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const back = [-cp * sy, sp, cp * cy];
    view.axes = {
      right: [cy, 0, sy],
      up: [sp * sy, cp, -sp * cy],
      back,
      eye: [target[0] + back[0] * DIST, target[1] + back[1] * DIST, target[2] + back[2] * DIST],
    };
  }

  // -> [screen x, screen y, perspective scale at that depth]
  view.project = (p) => {
    const { right, up, back } = view.axes;
    const q = sub(p, target);
    const k = DIST / Math.max(DIST - dot(q, back), 0.5);
    return [dot(q, right) * k, dot(q, up) * k, k];
  };
  view.xy = (p) => view.project(p).slice(0, 2);

  /* Clears the canvas, sets the camera for this frame and a y-up transform in
     view units centred on the canvas, and returns line widths and text sizes
     in those units - proportional to the zoom, so constant on screen. */
  view.begin = () => {
    basis();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.height / (2 * cam.view);
    ctx.setTransform(k, 0, 0, -k, canvas.width / 2, canvas.height * (0.5 + LIFT / 2));
    const v = cam.view;
    return {
      grid: 0.006 * v, axis: 0.011 * v, ray: 0.016 * v, arrow: 0.028 * v, thin: 0.009 * v,
      dot: 0.03 * v, text: 0.105 * v, dash: 0.035 * v, hint: 0.075 * v,
    };
  };

  /* The floor grid at y = 0 out to +-grid, and the three axes - negative
     halves grey, positive halves in the axis colour (or all grey with
     coloured: false, for a lab whose own vectors use those colours). */
  view.floor = (W, grid = 10, coloured = true) => {
    const xy = view.xy;
    const seg = (a, b, width) => stroke(ctx, [xy(a), xy(b)], width);
    ctx.strokeStyle = css(C.grid);
    for (let i = -grid; i <= grid; i++) {
      seg([i, 0, -grid], [i, 0, grid], W.grid);
      seg([-grid, 0, i], [grid, 0, i], W.grid);
    }
    for (const [a, e] of Object.entries({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] })) {
      const l = a === 'y' ? grid * 0.6 : grid + 0.6;
      if (a !== 'y') {
        ctx.strokeStyle = css(C.axis);
        seg(e.map((v) => -v * grid), [0, 0, 0], W.axis);
      }
      ctx.strokeStyle = css(coloured ? AXIS_COLOUR[a] : C.axis);
      seg([0, 0, 0], e.map((v) => v * l), W.axis * 1.3);
      ctx.fillStyle = css(coloured ? AXIS_COLOUR[a] : C.axis);
      label(ctx, xy(e.map((v) => v * (l + 0.5))), a, W.text, 'center');
    }
  };

  /* A line of text in the top-left corner: line 0 is the orbit/zoom hint,
     later lines go beneath it (a lab's notes). */
  view.corner = (W, text, line = 0, colour = '#9aa3ab', size = W.hint) => {
    const v = cam.view;
    const halfW = v * (canvas.width / canvas.height);
    const top = v * (1 + LIFT) - 0.1 * v;
    ctx.fillStyle = typeof colour === 'number' ? css(colour) : colour;
    label(ctx, [-halfW + 0.1 * v, top - line * W.hint * 1.8], text, size, 'left', 0, line > 0);
  };

  view.repaint = () => { if (canvas.width && canvas.height) paint(); };

  /* --- orbit and zoom ------------------------------------------------------ */
  /* Neither changes anything a lab computes: moving the camera changes the
     picture, not the vectors. */
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
    view.repaint();
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
    cam.view = clamp(cam.view * Math.exp(e.deltaY * 0.0015), 2, 30);
    view.repaint();
  }, { passive: false });

  view.reset = () => {
    cam.yaw = rad(yaw0);
    cam.pitch = rad(pitch0);
    cam.view = view0;
    view.repaint();
  };

  // Quasi-static, like the motion labs: nothing animates, so paint only on a
  // change - including a resize, which is how a slide becoming visible shows up.
  new ResizeObserver(() => { if (stage.resize()) view.repaint(); }).observe(stageEl);
  stage.resize();

  return view;
}
