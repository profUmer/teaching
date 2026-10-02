/*
 * quat-lab.js - demos for Game Math 2's quaternion decks.
 *
 * Two modes, one idea - a pair of reflections:
 *
 *   planes    two reflections make a rotation. A point is mirrored in plane 1,
 *           then in plane 2; the result is the original turned by twice the
 *           angle between the planes. That factor of two is why a quaternion
 *           carries cos(theta/2) and sin(theta/2): a unit quaternion is the
 *           pair of planes, and the planes sit at theta/2.
 *
 *   parallel  the same with parallel planes: two reflections make a
 *             translation, by twice the distance between the planes. That is
 *             the t/2 in a dual quaternion's translation part.
 *
 * Both planes contain the rotation axis, which points out of the screen, so
 * they are drawn edge-on as lines through the origin. Seen that way it is a
 * flat diagram, which is why this is Canvas 2D like the other labs rather than
 * a 3D scene (PLAN.md 2.1).
 *
 * Deliberately bare: no grid, no axes, no readout. Plane 1 is fixed, the
 * slider sets where plane 2 is (the angle, or the distance, to it), and the two
 * numbers that matter are written on the diagram. The initial position can be
 * dragged, and Play animates the two reflections and then the motion they add
 * up to.
 *
 * With no readout to scrape, the lab publishes its numbers on the canvas as
 * data attributes (data-half, data-turned or data-moved, data-p2, data-playing)
 * for lab-selftest.html.
 */

import { slider } from './lab-core.js';
import { mountLab } from './lab-mount.js';

/* Framing per mode: the parallel planes' view sits a little high and right,
   since the translation carries the point up and the labels run right. */
const GEOM = {
  planes:   { view: 3.2, cx: 0, cy: 0 },
  parallel: { view: 3.4, cx: 0.8, cy: 0.4 },
};

export function mountQuatLab(el, opts = {}) {
  const mode = opts.mode || 'planes';
  const g = GEOM[mode] || GEOM.planes;
  mountLab(el, {
    modes: MODES,
    mode,
    kind: 'quat',
    view: opts.view ?? g.view,
    cx: opts.cx ?? g.cx,
    cy: opts.cy ?? g.cy,
    grid: false,
    theta: opts.theta,
    d: opts.d,
  });
}

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/* Reflection in a line through the origin at angle phi:
   p' = 2(p.d)d - p, d = (cos phi, sin phi). In 3D that is the reflection in
   the plane holding d and the out-of-screen axis. */
function reflect([x, y], phi) {
  const dx = Math.cos(phi), dy = Math.sin(phi);
  const k = 2 * (x * dx + y * dy);
  return [k * dx - x, k * dy - y];
}

/* Play, for both modes: three steps of SEG seconds - first reflection, second
   reflection, then the motion the pair adds up to. Runs its own rAF loop,
   rebuilding every tick, and nothing at all when idle. step(k) is how far
   through step k it is, 0 -> 1 and eased; all 1 when idle, so the full
   picture shows whenever nothing is playing. */
const SEG = 1.2;
function player(onInput) {
  let anim = null;                                // { t0, u } while playing
  function tick(now) {
    if (!anim) return;
    anim.u = (now - anim.t0) / 1000;
    if (anim.u >= 3 * SEG) anim = null;
    onInput();
    if (anim) requestAnimationFrame(tick);
  }
  return {
    play() {
      const running = !!anim;
      anim = { t0: performance.now(), u: 0 };
      if (!running) requestAnimationFrame(tick);
    },
    playing: () => !!anim,
    step(k) {
      const u = anim ? anim.u : Infinity;
      const x = Math.min(1, Math.max(0, (u - k * SEG) / SEG));
      return x * x * (3 - 2 * x);
    },
  };
}

const lerp = (A, B, k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];

const MODES = {

  /* ---- two reflections = one rotation by twice the angle ----------------- */
  planes(stage, { s, W, controls, onInput, theta }) {
    // P down and to the left, at -110 degrees. Its first reflection is then at
    // +110, and the second sweeps -110 -> +70 as the planes open 0 -> 90, so
    // the three dots never land on each other anywhere on the slider.
    const P = { x: 2.3 * Math.cos(rad(-110)), y: 2.3 * Math.sin(rad(-110)) };

    let half = Math.min(90, (theta ?? 60) / 2);   // degrees, the angle between the planes
    slider(controls, {
      label: 'Angle between planes', min: 0, max: 90, step: 1, value: half,
      format: (v) => `${v.toFixed(0)}°`,
    }, (v) => { half = v; onInput(); });

    // Play: the dot crosses plane 1, then plane 2, then the theta arc sweeps
    // from start to finish - the two reflections were one rotation all along
    const anim = player(onInput);

    return {
      handles: [P],
      buttons: [{ label: () => 'Play', click: anim.play }],
      draw() {
        const a = rad(half);
        const p0 = [P.x, P.y];
        const p1 = reflect(p0, 0);         // plane 1 is the horizontal
        const p2 = reflect(p1, a);

        const s1 = anim.step(0), s2 = anim.step(1), s3 = anim.step(2);

        const at = (phi, r) => [r * Math.cos(phi), r * Math.sin(phi)];
        // whole degrees; not lab-core's fmt, which strips the 0 off 30
        const dg = (v) => `${Math.round(v)}°`;
        // a point's name, pushed radially outward and reading away from it
        const name = (q, text, layer) => {
          const ang = Math.atan2(q[1], q[0]);
          const c = Math.cos(ang);
          return { layer, kind: 'text', at: at(ang, Math.hypot(q[0], q[1]) + 0.35), text,
                   align: c > 0.3 ? 'left' : c < -0.3 ? 'right' : 'center' };
        };

        // edge-on planes: long enough to leave the stage at any aspect ratio
        const L = 4 * stage.view;
        const r = Math.hypot(P.x, P.y);
        const ang0 = Math.atan2(P.y, P.x);

        const shapes = [
          { layer: 'a', kind: 'line', points: [[-L, 0], [L, 0]], width: W.line * 1.4 },
          { layer: 'b', kind: 'line', points: [at(a, -L), at(a, L)], width: W.line * 1.4 },
          { layer: 'a', kind: 'text', at: [1.3 * stage.view, 0], text: 'plane 1', align: 'left', dy: 0.35 * s },
          { layer: 'b', kind: 'text', at: at(a, 0.7 * stage.view), text: 'plane 2', align: 'left', dy: 0.35 * s },

          // the angle between the planes
          { layer: 'label', kind: 'arc', centre: [0, 0], r: 0.7, a0: 0, a1: a, width: W.line },
          { layer: 'label', kind: 'text', at: at(a / 2, 1.05), text: `θ/2 = ${dg(half)}`, align: 'left' },

          name(p0, 'Initial Position', 'label'),
        ];

        // the rotation itself: P swung round the axis by theta onto P''
        if (half > 0 && s3 > 0) {
          shapes.push(
            { layer: 'ghost', kind: 'line', points: [[0, 0], p0], width: W.thin },
            { layer: 'label', kind: 'arc', centre: [0, 0], r, a0: ang0, a1: ang0 + 2 * a * s3, width: W.line },
          );
        }
        if (half > 0 && s3 >= 1) {
          shapes.push(
            { layer: 'ghost', kind: 'line', points: [[0, 0], p2], width: W.thin },
            { layer: 'label', kind: 'text', at: at(ang0 + a, r + 0.55), text: `θ = ${dg(2 * half)}`, align: 'center' },
          );
        }

        if (s1 >= 1) shapes.push({ layer: 'a', kind: 'dot', at: p1 }, name(p1, 'First Reflection', 'a'));
        if (s2 >= 1) shapes.push({ layer: 'b', kind: 'dot', at: p2 }, name(p2, 'Second Reflection', 'b'));
        // the dot in flight, straight across the mirror
        if (s1 > 0 && s1 < 1) shapes.push({ layer: 'a', kind: 'dot', at: lerp(p0, p1, s1) });
        if (s2 > 0 && s2 < 1) shapes.push({ layer: 'b', kind: 'dot', at: lerp(p1, p2, s2) });

        // Measured, not 2 * half: the angle P actually turned through.
        let turned = deg(Math.atan2(p2[1], p2[0]) - ang0);
        turned = ((turned % 360) + 360) % 360;
        if (turned > 359.95 || (turned < 0.05 && half > 90)) turned = 360;
        Object.assign(stage.canvas.dataset, {
          playing: anim.playing() ? '1' : '0',
          half: half.toFixed(3), turned: turned.toFixed(3), p2: `${p2[0].toFixed(3)},${p2[1].toFixed(3)}`,
        });

        return { shapes, values: [] };
      },
    };
  },

  /* ---- two reflections in parallel planes = a translation by twice the gap */
  parallel(stage, { W, controls, onInput, d: d0 }) {
    // Plane 1 is the horizontal y = 0, as in the rotation demo, and plane 2
    // is the horizontal y = d. P starts where it does there, at -110 degrees,
    // so the two slides read as the same picture with plane 2 slid up instead
    // of turned.
    const P = { x: 2.3 * Math.cos(rad(-110)), y: 2.3 * Math.sin(rad(-110)) };

    let d = Math.min(2.5, Math.max(0, d0 ?? 1.5));
    slider(controls, {
      label: 'Distance between planes', min: 0, max: 2.5, step: 0.1, value: d,
      format: (v) => v.toFixed(1),
    }, (v) => { d = v; onInput(); });

    // Play: across plane 1, across plane 2, then the translation arrow grows
    const anim = player(onInput);

    return {
      handles: [P],
      buttons: [{ label: () => 'Play', click: anim.play }],
      draw() {
        const p0 = [P.x, P.y];
        const p1 = [P.x, -P.y];            // mirror in y = 0
        const p2 = [P.x, 2 * d - p1[1]];   // then in y = d
        const s1 = anim.step(0), s2 = anim.step(1), s3 = anim.step(2);

        const num = (v) => v.toFixed(1);
        // names to the right of the dots. The second reflection passes the
        // first when plane 2 passes it, so there it steps aside vertically.
        const name = (q, text, layer, dy = 0) => (
          { layer, kind: 'text', halo: true, at: [q[0] + 0.3, q[1] + dy], text, align: 'left' });
        const gap = p2[1] - p1[1];
        const dy2 = Math.abs(gap) < 0.45 ? (gap < 0 ? -1 : 1) * (0.45 - Math.abs(gap)) : 0;

        const L = 4 * stage.view;
        const xd = 2.6;                    // the t/2 dimension line, right of the dots
        const xt = P.x - 0.8;              // the t arrow, left of the dots

        const shapes = [
          { layer: 'a', kind: 'line', points: [[-L, 0], [L, 0]], width: W.line * 1.4 },
          { layer: 'b', kind: 'line', points: [[-L, d], [L, d]], width: W.line * 1.4 },
          { layer: 'a', kind: 'text', halo: true, at: [4.2, -0.3], text: 'plane 1', align: 'left' },
          { layer: 'b', kind: 'text', halo: true, at: [4.2, d + 0.3], text: 'plane 2', align: 'left' },
          name(p0, 'Initial Position', 'label'),
        ];

        // the distance between the planes, arrowed both ways from the middle
        if (d > 0) {
          shapes.push(
            { layer: 'label', kind: 'arrow', from: [xd, d / 2], to: [xd, 0], width: W.thin * 1.4 },
            { layer: 'label', kind: 'arrow', from: [xd, d / 2], to: [xd, d], width: W.thin * 1.4 },
          );
        }
        shapes.push({ layer: 'label', kind: 'text', halo: true, at: [xd + 0.2, d / 2], text: `t/2 = ${num(d)}`, align: 'left' });

        // the translation itself: P slid straight up by t onto P''
        if (d > 0 && s3 > 0) {
          shapes.push(
            { layer: 'ghost', kind: 'line', points: [p0, [xt, p0[1]]], width: W.thin },
            { layer: 'label', kind: 'arrow', from: [xt, p0[1]], to: [xt, p0[1] + 2 * d * s3], width: W.line },
          );
        }
        if (d > 0 && s3 >= 1) {
          shapes.push(
            { layer: 'ghost', kind: 'line', points: [p2, [xt, p2[1]]], width: W.thin },
            { layer: 'label', kind: 'text', halo: true, at: [xt - 0.2, p0[1] + d], text: `t = ${num(2 * d)}`, align: 'right' },
          );
        }

        if (s1 >= 1) shapes.push({ layer: 'a', kind: 'dot', at: p1 }, name(p1, 'First Reflection', 'a'));
        if (s2 >= 1) shapes.push({ layer: 'b', kind: 'dot', at: p2 }, name(p2, 'Second Reflection', 'b', dy2));
        // the dot in flight, straight across the mirror
        if (s1 > 0 && s1 < 1) shapes.push({ layer: 'a', kind: 'dot', at: lerp(p0, p1, s1) });
        if (s2 > 0 && s2 < 1) shapes.push({ layer: 'b', kind: 'dot', at: lerp(p1, p2, s2) });

        // Measured, not 2 * d: how far P actually moved.
        Object.assign(stage.canvas.dataset, {
          playing: anim.playing() ? '1' : '0',
          half: d.toFixed(3), moved: (p2[1] - p0[1]).toFixed(3),
          p2: `${p2[0].toFixed(3)},${p2[1].toFixed(3)}`,
        });

        return { shapes, values: [] };
      },
    };
  },
};
