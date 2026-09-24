/*
 * motion-lab.js - draggable demos for Game Physics 1's Motion deck.
 *
 * Two modes:
 *
 *   motion  two positions A and B, and what falls out of them - displacement,
 *           distance, and (over a time t) velocity and speed
 *   accel   an initial and a final velocity, and the acceleration between them
 *
 * `motion` takes a `show` level so the same lab can appear on four consecutive
 * slides revealing one more quantity each time: position -> displacement ->
 * velocity. It replaces six near-identical graphing-tool screenshots in the
 * Beamer original, which is the same trick the "Vectors in Action" flipbook
 * plays in the Math Review deck.
 *
 * The defaults reproduce the deck's worked example exactly - A = [1, 2],
 * B = [-1, 1], t = 2 s, giving displacement [-2, -1], distance 2.24 m,
 * velocity [-1, -0.5] m/s and speed 1.12 m/s - so the numbers on screen are the
 * numbers on the neighbouring slides. lab-selftest.html pins all of them.
 *
 * Both modes are quasi-static: they recompute on a drag or a slider, never on a
 * clock. The first genuinely time-stepping lab belongs in eqnsOfMotion, and it
 * is the one that settles the runLoop question in PLAN.md 2.1 step 4.
 */

import { fmt, vec, slider } from './lab-core.js';
import { mountLab } from './lab-mount.js';

/* Framing per mode. `accel` works in metres per second, where the worked
   example runs to 62.5, so it needs a much wider world than the position
   modes - everything else scales off `view` on its own. */
const GEOM = {
  motion: { view: 2.8, cx: 0, cy: 0.3, step: 1, dp: 2 },
  accel:  { view: 30, cx: 32, cy: 12, step: 10, dp: 2 },
};

export function mountMotionLab(el, opts = {}) {
  const mode = opts.mode || 'motion';
  const g = GEOM[mode] || GEOM.motion;

  mountLab(el, {
    modes: MODES,
    mode,
    kind: 'motion',
    view: opts.view ?? g.view,
    cx: opts.cx ?? g.cx,
    cy: opts.cy ?? g.cy,
    step: opts.step ?? g.step,
    dp: opts.dp ?? g.dp,
    show: opts.show || 'velocity',
    t: opts.t,
  });
}

const norm = (x, y) => Math.hypot(x, y);

/* Units are spelled out in the readout because this is a physics deck: a bare
   [-1, -0.5] is not an answer, [-1, -0.5] m/s is. &sup2; rather than <sup>2</sup>
   so the digit does not end up in the readout's text and confuse a reader -
   human or the self-test's number scraper. */
const M = (v) => `${v}&nbsp;m`;
const MS = (v) => `${v}&nbsp;m/s`;

/* A non-breaking space, so "10.0 s" does not wrap inside the slider's narrow
   value column. */
const secs = (v) => `${v.toFixed(1)} s`;

/* Which way a label should run so it reads away from the point it names.
   Near-vertical offsets get centred rather than pushed to one side. */
const alignOf = (u) => (u > 0.3 ? 'left' : u < -0.3 ? 'right' : 'center');

const MODES = {

  /* ---- position, displacement, distance, velocity, speed ----------------- */
  motion(stage, { s, W, dp, controls, onInput, show = 'velocity', t: t0 }) {
    const start = { a: { x: 1, y: 2 }, b: { x: -1, y: 1 } };
    const A = { x: start.a.x, y: start.a.y };
    const B = { x: start.b.x, y: start.b.y };

    const showB = show !== 'position';
    const showV = show === 'velocity';

    let t = t0 ?? 2;
    if (showV) {
      slider(controls, {
        label: 't', min: 0.5, max: 5, step: 0.5, value: t,
        format: secs,
      }, (v) => { t = v; onInput(); });
    }

    // label offsets, in world units, so a label clears its handle at any zoom
    const lx = 0.2 * s, ly = 0.28 * s, off = 0.45 * s;

    return {
      handles: showB ? [A, B] : [A],
      reset: () => {
        A.x = start.a.x; A.y = start.a.y;
        B.x = start.b.x; B.y = start.b.y;
      },
      draw() {
        const dx = B.x - A.x, dy = B.y - A.y;
        const dist = norm(dx, dy);

        const shapes = [];
        const values = [];

        if (!showB) {
          // How a point is defined: drop it onto both axes.
          shapes.push(
            { layer: 'aux', kind: 'dashed', points: [[A.x, 0], [A.x, A.y]] },
            { layer: 'aux', kind: 'dashed', points: [[0, A.y], [A.x, A.y]] },
          );
          values.push(
            ['x', M(fmt(A.x, dp))],
            ['y', M(fmt(A.y, dp))],
            ['A = [x, y]', M(vec(A.x, A.y, dp)), 'is-key'],
          );
        } else {
          // The right triangle the distance comes out of - run along x, then up
          // y. Pythagoras is the next slide, and this is its picture.
          shapes.push(
            { layer: 'aux', kind: 'dashed', points: [[A.x, A.y], [B.x, A.y]] },
            { layer: 'aux', kind: 'dashed', points: [[B.x, A.y], [B.x, B.y]] },
            { layer: 'b', kind: 'arrow', from: [A.x, A.y], to: [B.x, B.y] },
          );
          values.push(
            ['A', M(vec(A.x, A.y, dp))],
            ['B', M(vec(B.x, B.y, dp))],
            ['change in x', M(fmt(dx, dp))],
            ['change in y', M(fmt(dy, dp))],
            ['displacement = B &minus; A', M(vec(dx, dy, dp)), 'is-key'],
            ['distance = &radic;(&Delta;x&sup2; + &Delta;y&sup2;)', M(fmt(dist, dp)), 'is-key'],
          );
        }

        if (showV) {
          const vx = dx / t, vy = dy / t;
          // Velocity is displacement scaled, so it lies exactly along the
          // displacement arrow and the two heads would collide. Nudge it
          // sideways - the same "draw it somewhere else to show the
          // relationship" move the add lab makes with its tip-to-tail ghost.
          const off = dist > 1e-6 ? [(-dy / dist) * 0.22 * s, (dx / dist) * 0.22 * s] : [0, 0];
          shapes.push({
            layer: 'result', kind: 'arrow',
            from: [A.x + off[0], A.y + off[1]],
            to: [A.x + vx + off[0], A.y + vy + off[1]],
          });
          values.push(
            ['time t', `${fmt(t, 1)}&nbsp;s`],
            ['velocity = displacement / t', MS(vec(vx, vy, dp)), 'is-key'],
            ['speed = distance / t', MS(fmt(dist / t, dp)), 'is-key'],
          );
        }

        // A goes behind the tail and B beyond the head, along the arrow's own
        // direction, so neither label can end up sitting under the arrowhead.
        if (!showB) {
          shapes.push({ layer: 'label', kind: 'text', at: [A.x + lx, A.y + ly], text: 'A' });
        } else {
          const ux = dist > 1e-6 ? dx / dist : 1;
          const uy = dist > 1e-6 ? dy / dist : 0;
          shapes.push(
            { layer: 'label', kind: 'text', at: [A.x - ux * off, A.y - uy * off], text: 'A', align: alignOf(-ux) },
            { layer: 'label', kind: 'text', at: [B.x + ux * off, B.y + uy * off], text: 'B', align: alignOf(ux) },
          );
        }

        return { shapes, values };
      },
    };
  },

  /* ---- acceleration as the rate of change of velocity -------------------- */
  accel(stage, { s, W, dp, controls, onInput, t: t0 }) {
    // the deck's example: from rest to [62.5, 22.0] m/s in 10.0 s
    const start = { vi: { x: 0, y: 0 }, vf: { x: 62.5, y: 22 } };
    const Vi = { x: start.vi.x, y: start.vi.y };
    const Vf = { x: start.vf.x, y: start.vf.y };

    let t = t0 ?? 10;
    slider(controls, {
      label: 't', min: 1, max: 10, step: 0.5, value: t,
      format: secs,
    }, (v) => { t = v; onInput(); });

    const off = 0.5 * s;

    return {
      handles: [Vi, Vf],
      reset: () => {
        Vi.x = start.vi.x; Vi.y = start.vi.y;
        Vf.x = start.vf.x; Vf.y = start.vf.y;
      },
      draw() {
        const dvx = Vf.x - Vi.x, dvy = Vf.y - Vi.y;
        const ax = dvx / t, ay = dvy / t;

        // Both labels sit on the same side of the change-in-velocity line, so
        // they clear the arrowheads and the short acceleration arrow that
        // otherwise runs straight through "v initial".
        const dvLen = norm(dvx, dvy);
        const px = dvLen > 1e-6 ? -dvy / dvLen : 0;
        const py = dvLen > 1e-6 ? dvx / dvLen : 1;

        return {
          shapes: [
            { layer: 'b', kind: 'arrow', from: [0, 0], to: [Vi.x, Vi.y] },
            { layer: 'a', kind: 'arrow', from: [0, 0], to: [Vf.x, Vf.y] },
            // the change laid tip-to-tail from v_i, which is what "change in
            // velocity" means before it is divided by anything
            { layer: 'ghost', kind: 'arrow', from: [Vi.x, Vi.y], to: [Vf.x, Vf.y] },
            // true scale, deliberately: at t = 10 the acceleration arrow is a
            // tenth of the change, and winding t down to 1 grows it to match.
            // That *is* the lesson, so it must not be drawn scaled up.
            { layer: 'result', kind: 'arrow', from: [0, 0], to: [ax, ay] },
            { layer: 'label', kind: 'text', at: [Vi.x + px * off, Vi.y + py * off], text: 'v initial', align: alignOf(px) },
            { layer: 'label', kind: 'text', at: [Vf.x + px * off, Vf.y + py * off], text: 'v final', align: alignOf(px) },
          ],
          values: [
            ['initial velocity', MS(vec(Vi.x, Vi.y, dp))],
            ['final velocity', MS(vec(Vf.x, Vf.y, dp))],
            ['change in velocity &Delta;v', MS(vec(dvx, dvy, dp)), 'is-key'],
            ['time t', `${fmt(t, 1)}&nbsp;s`],
            ['a = &Delta;v / t', `${vec(ax, ay, dp)}&nbsp;m/s&sup2;`, 'is-key'],
          ],
        };
      },
    };
  },
};
