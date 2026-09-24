/*
 * vector-lab.js - draggable 2D vector demos for the Math Review deck.
 *
 * One mount, four modes, all sharing the same stage and drag handling:
 *
 *   polar    a vector and its r-angle-theta form, with the right triangle
 *   add      tip-to-tail addition and subtraction
 *   dot      the dot product and the projection onto a normalised vector
 *   reflect  the non-axis-aligned collision, following the deck's five steps
 *
 * The reflect mode deliberately works in the same pixel-ish coordinates as the
 * Peggle worked example, so the numbers on screen match the numbers on the
 * neighbouring slides.
 *
 * draw() returns a display list of plain shape descriptions and draw2d.js
 * paints it. That seam is what made moving off three.js a refactor rather than
 * a rewrite - see PLAN.md 2.1. The stage, panel and drag plumbing live in
 * lab-mount.js, which Game Physics 1's labs share.
 */

import { fmt, vec } from './lab-core.js';
import { mountLab } from './lab-mount.js';

const PRESETS = {
  // v_i = [50, 10], boundary (50,25) -> (200,250): the Peggle slide
  peggle: { view: 165, cx: 125, cy: 130, step: 25, dp: 3 },
};

export function mountVectorLab(el, opts = {}) {
  const mode = opts.mode || 'polar';
  const preset = PRESETS[opts.preset] || {};

  mountLab(el, {
    modes: MODES,
    mode,
    kind: 'vector',
    view: opts.view ?? preset.view ?? 5,
    cx: opts.cx ?? preset.cx ?? 0,
    cy: opts.cy ?? preset.cy ?? 0,
    step: opts.step ?? preset.step ?? 1,
    dp: opts.dp ?? preset.dp ?? 2,
  });
}

/* ------------------------------------------------------------------ modes --- */

const deg = (r) => (r * 180) / Math.PI;
const norm = (x, y) => Math.hypot(x, y);

const MODES = {

  /* ---- a vector in rectangular and polar form ---------------------------- */
  polar(stage, { s, W, dp }) {
    const start = { x: 2, y: 3 };
    const V = { x: start.x, y: start.y };

    return {
      handles: [V],
      reset: () => { V.x = start.x; V.y = start.y; },
      draw() {
        const r = norm(V.x, V.y);
        let th = Math.atan2(V.y, V.x);
        const thDisplay = ((deg(th) % 360) + 360) % 360;

        const shapes = [
          { layer: 'aux', kind: 'dashed', points: [[V.x, 0], [V.x, V.y]] },
          { layer: 'aux', kind: 'dashed', points: [[0, 0], [V.x, 0]] },
          { layer: 'result', kind: 'arrow', from: [0, 0], to: [V.x, V.y] },
        ];
        if (r > 0.3 * s) {
          shapes.push({ layer: 'a', kind: 'arc', centre: [0, 0], r: 0.9 * s, a0: 0, a1: th });
        }

        return {
          shapes,
          values: [
            ['a', fmt(V.x, dp)],
            ['b', fmt(V.y, dp)],
            ['[a, b]', vec(V.x, V.y, dp), 'is-key'],
            ['r = &radic;(a&sup2; + b&sup2;)', fmt(r, dp)],
            ['&theta; = tan<sup>-1</sup>(b / a)', `${fmt(thDisplay, 1)}&deg;`],
            ['r &ang; &theta;', `${fmt(r, dp)} &ang; ${fmt(thDisplay, 1)}&deg;`, 'is-key'],
          ],
        };
      },
    };
  },

  /* ---- tip-to-tail addition and subtraction ------------------------------ */
  add(stage, { s, W, dp }) {
    const start = { a: { x: 3, y: 1 }, b: { x: -1, y: 2.5 } };
    const A = { x: start.a.x, y: start.a.y };
    const B = { x: start.b.x, y: start.b.y };
    let subtract = false;

    return {
      handles: [A, B],
      reset: () => { A.x = start.a.x; A.y = start.a.y; B.x = start.b.x; B.y = start.b.y; },
      buttons: [{
        label: () => (subtract ? 'A − B' : 'A + B'),
        click: () => { subtract = !subtract; },
      }],
      draw() {
        const bx = subtract ? -B.x : -0 + B.x;
        const by = subtract ? -B.y : B.y;
        const sx = A.x + (subtract ? -B.x : B.x);
        const sy = A.y + (subtract ? -B.y : B.y);

        return {
          fill: [[0, 0], [A.x, A.y], [sx, sy]],
          shapes: [
            { layer: 'a', kind: 'arrow', from: [0, 0], to: [A.x, A.y] },
            { layer: 'b', kind: 'arrow', from: [0, 0], to: [B.x, B.y] },
            // the same B laid tip-to-tail from A, which is the whole idea
            { layer: 'ghost', kind: 'arrow', from: [A.x, A.y], to: [A.x + bx, A.y + by] },
            { layer: 'result', kind: 'arrow', from: [0, 0], to: [sx, sy] },
          ],
          values: [
            ['A', vec(A.x, A.y, dp)],
            ['B', vec(B.x, B.y, dp)],
            [subtract ? 'A<sub>x</sub> &minus; B<sub>x</sub>' : 'A<sub>x</sub> + B<sub>x</sub>', fmt(sx, dp)],
            [subtract ? 'A<sub>y</sub> &minus; B<sub>y</sub>' : 'A<sub>y</sub> + B<sub>y</sub>', fmt(sy, dp)],
            [subtract ? 'A &minus; B' : 'A + B', vec(sx, sy, dp), 'is-key'],
          ],
        };
      },
    };
  },

  /* ---- dot product and projection onto a normalised vector --------------- */
  dot(stage, { s, W, dp }) {
    const start = { a: { x: 2, y: 2.6 }, b: { x: 3.4, y: 0.6 } };
    const A = { x: start.a.x, y: start.a.y };
    const B = { x: start.b.x, y: start.b.y };

    return {
      handles: [A, B],
      reset: () => { A.x = start.a.x; A.y = start.a.y; B.x = start.b.x; B.y = start.b.y; },
      draw() {
        const rb = norm(B.x, B.y) || 1e-6;
        const ux = B.x / rb, uy = B.y / rb;          // B-hat
        const projLen = A.x * ux + A.y * uy;          // A . B-hat
        const px = ux * projLen, py = uy * projLen;
        const dotAB = A.x * B.x + A.y * B.y;
        const ra = norm(A.x, A.y);
        const cos = ra * rb > 1e-9 ? dotAB / (ra * rb) : 0;
        const ang = deg(Math.acos(Math.max(-1, Math.min(1, cos))));

        return {
          shapes: [
            { layer: 'a', kind: 'arrow', from: [0, 0], to: [A.x, A.y] },
            { layer: 'b', kind: 'arrow', from: [0, 0], to: [B.x, B.y] },
            // unit vector along B, then A dropped perpendicularly onto it
            { layer: 'ghost', kind: 'line', points: [[0, 0], [ux, uy]], width: W.line * 1.6 },
            { layer: 'aux', kind: 'dashed', points: [[A.x, A.y], [px, py]] },
            { layer: 'result', kind: 'arrow', from: [0, 0], to: [px, py], width: W.arrow * 1.15 },
          ],
          values: [
            ['A', vec(A.x, A.y, dp)],
            ['B', vec(B.x, B.y, dp)],
            ['A &middot; B = x<sub>1</sub>x<sub>2</sub> + y<sub>1</sub>y<sub>2</sub>', fmt(dotAB, dp), 'is-key'],
            ['|A|', fmt(ra, dp)],
            ['|B|', fmt(rb, dp)],
            ['&theta;', `${fmt(ang, 1)}&deg;`],
            ['B / |B|', vec(ux, uy, dp)],
            ['projection A &middot; (B / |B|)', fmt(projLen, dp), 'is-key'],
          ],
        };
      },
    };
  },

  /* ---- the non-axis-aligned collision ------------------------------------ */
  reflect(stage, { s, W, dp }) {
    // the Peggle slide: boundary (50,25) -> (200,250), v_i = [50, 10]
    const start = { p1: { x: 50, y: 25 }, p2: { x: 200, y: 250 }, v: { x: 75, y: 127.5 } };
    const P1 = { x: start.p1.x, y: start.p1.y };
    const P2 = { x: start.p2.x, y: start.p2.y };
    const S = { x: start.v.x, y: start.v.y };   // where the ball comes from

    return {
      handles: [P1, P2, S],
      reset: () => {
        P1.x = start.p1.x; P1.y = start.p1.y;
        P2.x = start.p2.x; P2.y = start.p2.y;
        S.x = start.v.x; S.y = start.v.y;
      },
      draw() {
        const Mx = (P1.x + P2.x) / 2, My = (P1.y + P2.y) / 2;   // impact point
        const Bx = P2.x - P1.x, By = P2.y - P1.y;
        const Nx = By, Ny = -Bx;
        const nLen = norm(Nx, Ny) || 1e-6;
        const nhx = Nx / nLen, nhy = Ny / nLen;

        const vx = Mx - S.x, vy = My - S.y;                      // v_i
        const dotv = -vx * nhx + -vy * nhy;                      // -v_i . N-hat
        const Px = dotv * nhx, Py = dotv * nhy;
        const fx = vx + 2 * Px, fy = vy + 2 * Py;                // v_f

        const nDraw = 0.42 * view(stage);                        // N-hat is unit length
        return {
          shapes: [
            { layer: 'ghost', kind: 'line', points: [[P1.x, P1.y], [P2.x, P2.y]], width: W.line * 1.5 },
            { layer: 'aux', kind: 'arrow', from: [Mx, My], to: [Mx + nhx * nDraw, My + nhy * nDraw] },
            { layer: 'aux', kind: 'dashed', points: [[Mx, My], [Mx + Px, My + Py]] },
            { layer: 'b', kind: 'arrow', from: [S.x, S.y], to: [Mx, My] },
            { layer: 'result', kind: 'arrow', from: [Mx, My], to: [Mx + fx, My + fy] },
          ],
          // Vector arrows and hats are spelled out rather than set with
          // combining marks (U+20D7 / U+0302), which render as tofu boxes in
          // the theme's UI font.
          values: [
            ['v<sub>i</sub>', vec(vx, vy, 1), 'is-key'],
            ['1. B = [&Delta;x, &Delta;y]', vec(Bx, By, 1)],
            ['2. N = [&Delta;y, &minus;&Delta;x]', vec(Nx, Ny, 1)],
            ['3. |N|', fmt(nLen, 1)],
            ['&nbsp;&nbsp;&nbsp;&nbsp;N / |N|', vec(nhx, nhy, dp)],
            ['4. &minus;v<sub>i</sub> &middot; (N / |N|)', fmt(dotv, dp)],
            ['&nbsp;&nbsp;&nbsp;&nbsp;P', vec(Px, Py, dp)],
            ['5. v<sub>f</sub> = v<sub>i</sub> + 2P', vec(fx, fy, 1), 'is-key'],
          ],
        };
      },
    };
  },
};

function view(stage) { return stage.view; }
