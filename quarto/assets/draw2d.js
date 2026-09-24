/*
 * draw2d.js - Canvas 2D drawing for the flat labs.
 *
 * The 2D demos draw a grid, arrows and dashed construction lines, all of which
 * Canvas 2D does natively: ctx.lineWidth and ctx.setLineDash do what WebGL
 * needed ~110 lines of hand-built triangle strokes for, because it will not
 * stroke a line with a width, and immediate mode means there is no geometry to
 * allocate, upload, or dispose.
 *
 * The world -> pixel transform is the one the students write in
 * Scene0::OnCreate: a scale with a negative y, because pixel y grows downward,
 * then a translate to slide the origin into place. metresToPixelsMatrix, as a
 * single setTransform.
 *
 * See PLAN.md 2.1 for why the 2D labs left three.js.
 */

import { C } from './lab-core.js';

/* lab-core.js's palette stores colours as numbers, from when they were fed to
   three.js materials; this turns one into a CSS colour. */
export const css = (n) => '#' + n.toString(16).padStart(6, '0');

/* ------------------------------------------------------------------ stage --- */

/*
 * A 2D stage with grid and axes. `view` is the half-height in world units and
 * the half-width follows the aspect ratio, with (cx, cy) at the centre of the
 * canvas.
 */
export function makeStage2D(stageEl, { view = 4, cx = 0, cy = 0, step = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'lab-canvas';
  stageEl.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let scale = 1;              // CSS pixels per world unit
  let cssW = 0, cssH = 0, dpr = 1;

  /* slides.css already sizes .lab-canvas to fill the stage, so only the backing
     store is set here. */
  function resize() {
    cssW = stageEl.clientWidth;
    cssH = stageEl.clientHeight;
    if (!cssW || !cssH) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = cssH / (2 * view);
    return true;
  }

  function applyTransform() {
    ctx.setTransform(
      scale * dpr, 0,                              // x scales
      0, -scale * dpr,                             // y scales and flips
      (cssW / 2 - cx * scale) * dpr,               // then slide the origin
      (cssH / 2 + cy * scale) * dpr,
    );
  }

  const halfWidth = () => view * (cssW / cssH);

  /* Clears the frame and lays down grid and axes. Everything else paints on top. */
  function begin() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyTransform();

    const halfW = halfWidth();
    ctx.lineCap = 'butt';

    ctx.strokeStyle = css(C.grid);
    // one CSS pixel at any zoom. A single *device* pixel, which is what the
    // WebGL LineSegments drew, is too faint to read off a projector.
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (let x = Math.ceil((cx - halfW) / step) * step; x <= cx + halfW; x += step) {
      ctx.moveTo(x, cy - view); ctx.lineTo(x, cy + view);
    }
    for (let y = Math.ceil((cy - view) / step) * step; y <= cy + view; y += step) {
      ctx.moveTo(cx - halfW, y); ctx.lineTo(cx + halfW, y);
    }
    ctx.stroke();

    ctx.strokeStyle = css(C.axis);
    ctx.lineWidth = view * 0.009;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, 0); ctx.lineTo(cx + halfW, 0);
    ctx.moveTo(0, cy - view); ctx.lineTo(0, cy + view);
    ctx.stroke();
  }

  /* The exact inverse of applyTransform. lab-selftest.html's drag() computes
     screen coordinates from this same mapping, so keep the two in step. */
  function toWorld(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -(((clientY - r.top) / r.height) * 2 - 1);
    return [cx + nx * view * (r.width / r.height), cy + ny * view];
  }

  // world units per CSS pixel, for hit tolerances that feel the same at any zoom
  const unitsPerPixel = () => (view * 2) / (stageEl.clientHeight || 1);

  return { canvas, ctx, begin, resize, toWorld, unitsPerPixel, view, cx, cy };
}

/* ------------------------------------------------------------- primitives --- */
/* All widths are in world units, because the transform is already applied. */

function trace(ctx, points, closed) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  if (closed) ctx.closePath();
}

export function stroke(ctx, points, width, closed = false) {
  if (points.length < 2) return;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  trace(ctx, points, closed);
  ctx.stroke();
}

export function dashed(ctx, points, width, dash) {
  ctx.setLineDash([dash, dash]);
  stroke(ctx, points, width);
  ctx.setLineDash([]);
}

/* Shaft plus a triangular head. The proportions match arrowGeometry so a
   converted mode draws the same picture it did on the WebGL path. */
export function arrow(ctx, from, to, width, headScale = 1) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;

  const ux = dx / len, uy = dy / len;
  const headLen = Math.min(width * 4.6 * headScale, len * 0.45);
  const headHalf = headLen * 0.42;
  const neck = [to[0] - ux * headLen, to[1] - uy * headLen];

  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  trace(ctx, [from, neck], false);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(neck[0] - uy * headHalf, neck[1] + ux * headHalf);
  ctx.lineTo(to[0], to[1]);
  ctx.lineTo(neck[0] + uy * headHalf, neck[1] - ux * headHalf);
  ctx.closePath();
  ctx.fill();
}

export function disc(ctx, centre, r) {
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], r, 0, Math.PI * 2);
  ctx.fill();
}

/* Angles are the maths convention; the stage transform has already flipped y,
   so a1 < a0 is the sweep that needs the anticlockwise flag. */
export function arc(ctx, centre, r, a0, a1, width) {
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], r, a0, a1, a1 < a0);
  ctx.stroke();
}

export function fillShape(ctx, points) {
  if (points.length < 3) return;
  trace(ctx, points, true);
  ctx.fill();
}

/*
 * A short label at a world position - "A" beside a point, and nothing longer.
 *
 * `size` is in world units like every other width here, so a label scales with
 * the stage instead of needing the pixel scale plumbed through, and `dy`
 * offsets *upward* in world terms.
 *
 * Drawn in device pixels against the identity transform, not in the ambient
 * (tiny) world-unit space the rest of this file draws in: at this stage's
 * usual zoom, a world-unit font size is a fraction of a CSS pixel before the
 * transform blows it back up, and Firefox - unlike Chromium - silently
 * rasterises nothing for a declared ctx.font size below roughly 0.4px,
 * transform or no transform. Converting the point and size to device pixels
 * first sidesteps that rather than depending on a declared size nobody
 * would write on purpose.
 */
const LABEL_FONT = 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';

/* World point -> {px, py, scale} in device pixels, against the current
   transform. Shared by label() and columnVector() below. */
function toDevice(ctx, at) {
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b);   // uniform scale - all this ever sets
  return {
    px: m.a * at[0] + m.c * at[1] + m.e,
    py: m.b * at[0] + m.d * at[1] + m.f,
    scale,
  };
}

export function label(ctx, at, text, size, align = 'left', dy = 0) {
  const { px, py, scale } = toDevice(ctx, at);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `600 ${size * scale}px ${LABEL_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, px, py - dy * scale);
  ctx.restore();
}

/*
 * A column vector at a world position: each string in `values` stacked
 * vertically between a pair of round parentheses - values ['0.87', '0.5', '1']
 * reads the way the slides write \begin{pmatrix} x \\ y \\ 1 \end{pmatrix},
 * rather than the row [0.87, 0.5, 1] a plain label() would give it, and with
 * curved rather than square brackets to match that same \pmatrix (not
 * \bmatrix) notation.
 *
 * `at` is the vertical centre of the stack. `align` picks which side of `at`
 * the block sits on - 'left' grows it rightward, 'right' leftward, 'center'
 * splits it either way - matching label()'s textAlign convention generalised
 * to a block instead of one line. `dy` offsets upward in world units, as
 * label()'s does.
 *
 * Same device-pixel technique as label(), for the same reason: a font size
 * declared in this stage's tiny world-unit space is a fraction of a CSS
 * pixel before the zoom transform blows it back up, and Firefox silently
 * rasterises nothing below roughly a 0.4px declared size.
 */
export function columnVector(ctx, at, values, size, align = 'left', dy = 0) {
  const { px, py, scale } = toDevice(ctx, at);
  const cy = py - dy * scale;

  const fontPx = size * scale;
  const lineH = fontPx * 1.2;
  const padX = fontPx * 0.5;      // extra room for the curve to bulge into
  const bulge = fontPx * 0.22;
  const barW = Math.max(1, fontPx * 0.09);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `600 ${fontPx}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let colW = 0;
  for (const v of values) colW = Math.max(colW, ctx.measureText(v).width);
  const blockW = colW + padX * 2;

  const left = align === 'left' ? px : align === 'right' ? px - blockW : px - blockW / 2;
  const midX = left + blockW / 2;
  const top = cy - (lineH * (values.length - 1)) / 2;
  const barTop = top - lineH * 0.55;
  const barBottom = top + lineH * (values.length - 1) + lineH * 0.55;
  const midY = (barTop + barBottom) / 2;

  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = barW;
  ctx.lineCap = 'round';

  // "(" - the curve bulges away from the numbers, further left at its middle
  ctx.beginPath();
  ctx.moveTo(left, barTop);
  ctx.quadraticCurveTo(left - bulge, midY, left, barBottom);
  ctx.stroke();

  // ")" - mirrored, bulging further right
  ctx.beginPath();
  ctx.moveTo(left + blockW, barTop);
  ctx.quadraticCurveTo(left + blockW + bulge, midY, left + blockW, barBottom);
  ctx.stroke();

  values.forEach((v, i) => ctx.fillText(v, midX, top + i * lineH));
  ctx.restore();
}

/* ---------------------------------------------------------------- painter --- */

/*
 * Layers, back to front: construction lines under vectors under handles, which
 * are drawn last on top of everything.
 */
const LAYERS = [
  { name: 'aux',    color: C.aux,     alpha: 0.9 },
  { name: 'ghost',  color: C.ghost,   alpha: 1 },
  { name: 'fill',   color: C.result,  alpha: 0.12, isFill: true },
  { name: 'a',      color: C.accentA, alpha: 1 },
  { name: 'b',      color: C.accentB, alpha: 1 },
  { name: 'result', color: C.result,  alpha: 1 },
  // last, so a label sits over the arrows but still under the handle discs
  { name: 'label',  color: C.handle,  alpha: 1 },
];

/*
 * Paints one display list - the {shapes, fill, values} object a mode's draw()
 * returns. Keeping draw() declarative is what let the renderer be swapped
 * underneath it without touching a single mode.
 */
export function paint(stage, display, handles, W) {
  if (!display) return;
  const { ctx } = stage;

  for (const layer of LAYERS) {
    ctx.globalAlpha = layer.alpha;
    ctx.strokeStyle = ctx.fillStyle = css(layer.color);

    if (layer.isFill) {
      if (display.fill) fillShape(ctx, display.fill);
      continue;
    }
    for (const d of display.shapes) {
      if (d.layer === layer.name) drawShape(ctx, d, W);
    }
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = css(C.handle);
  for (const h of handles) disc(ctx, [h.x, h.y], W.handle);
}

function drawShape(ctx, d, W) {
  switch (d.kind) {
    case 'arrow':  return arrow(ctx, d.from, d.to, d.width ?? W.arrow, d.headScale);
    case 'line':   return stroke(ctx, d.points, d.width ?? W.line, d.closed);
    case 'dashed': return dashed(ctx, d.points, d.width ?? W.thin, W.dash);
    case 'arc':    return arc(ctx, d.centre, d.r, d.a0, d.a1, d.width ?? W.thin);
    case 'text':   return label(ctx, d.at, d.text, d.size ?? W.text, d.align, d.dy);
  }
}
