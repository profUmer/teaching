/*
 * lab-mount.js - turns a table of modes into a mounted, draggable 2D lab.
 *
 * Every flat lab needs the same scaffolding: a stage, a panel, dragging,
 * resize, and a run loop. The per-topic files supply only the modes -
 * vector-lab.js for Game Math 1, motion-lab.js for Game Physics 1.
 *
 * A mode is a factory `(stage, ctx) => ({ handles, draw, reset?, buttons? })`
 * where `draw()` returns a display list for draw2d.js to paint. That
 * declarative seam is the reason a renderer swap was a refactor rather than a
 * rewrite (PLAN.md 2.1), and it is what lets a mode be moved between files
 * without touching it.
 *
 * This file exists because the second course arrived, not because a split was
 * planned in advance. The *other* seam PLAN.md 2.1 step 4 describes - pulling
 * the renderer out from under lab-core.js - is still open, deliberately: every
 * lab so far is quasi-static (recompute on drag or on a slider), so runLoop has
 * not yet been asked to host a time-stepping simulation. The first integrator
 * lab in eqnsOfMotion is what answers that, and it should not be guessed here.
 */

import { makeDraggable, runLoop, button, valuePanel } from './lab-core.js';
import { makeStage2D, paint } from './draw2d.js';

/*
 * Mounts one lab into `el`.
 *
 *   modes   the mode table to pick from
 *   mode    which one
 *   kind    a css hook: .lab-vector / .lab-motion, alongside .lab-<mode>
 *   view    half-height of the stage in world units; cx/cy centre it
 *   step    grid spacing, dp decimal places in the readout
 */
export function mountLab(el, { modes, mode, kind, view, cx = 0, cy = 0, step = 1, dp = 2, ...rest }) {
  el.classList.add('lab', `lab-${kind}`, `lab-${mode}`);

  const stageEl = document.createElement('div');
  stageEl.className = 'lab-stage';
  const panel = document.createElement('div');
  panel.className = 'lab-panel';
  el.append(stageEl, panel);

  // World-space sizes derived from the view, so a lab working in Peggle pixels
  // draws the same weight of arrow as one working in unit coordinates.
  const s = view / 4;
  const W = {
    thin: 0.03 * s, line: 0.05 * s, arrow: 0.06 * s,
    dash: 0.16 * s, handle: 0.11 * s, text: 0.34 * s,
  };

  const stage = makeStage2D(stageEl, { view, cx, cy, step });
  const { controls, vp, buttons } = makePanel(panel);

  // The mode may add sliders during construction, and a slider's oninput needs
  // to trigger a rebuild that does not exist yet. Hence the indirection.
  let rebuild = () => {};
  const M = modes[mode](stage, { s, W, dp, controls, onInput: () => rebuild(), ...rest });

  // Only give the sliders a row if the mode actually made some, otherwise the
  // panel's flex gap leaves a hole above the readout.
  if (controls.children.length) panel.prepend(controls);

  // Immediate mode: rebuild only recomputes, frame redraws the whole stage.
  let display = null;
  rebuild = () => { display = M.draw(); vp.update(display.values); };
  const frame = () => { stage.begin(); paint(stage, display, M.handles, W); };

  wire(el, stageEl, stage, M, buttons, rebuild, frame);
}

/* Somewhere to hang sliders, the readout panel and the row of buttons. */
function makePanel(panel) {
  const controls = document.createElement('div');
  controls.className = 'lab-controls';

  const vp = valuePanel(panel);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  panel.appendChild(buttons);

  return { controls, vp, buttons };
}

/* Controls, dragging, resize and the run loop. */
function wire(el, stageEl, stage, M, buttons, rebuild, frame) {
  makeDraggable(stage, M.handles, rebuild);

  if (M.reset) {
    button(buttons, 'Reset', () => { M.reset(); rebuild(); });
  }
  for (const b of M.buttons || []) {
    const el2 = button(buttons, b.label(), () => { b.click(); el2.textContent = b.label(); rebuild(); });
  }

  function resize() {
    if (!stage.resize()) return;
    rebuild();
    // Render immediately rather than waiting on the animation loop: reveal's
    // ?print-pdf mode lays every slide out at once without them ever becoming
    // "visible", and a canvas that never drew exports as an empty box.
    frame();
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();
  rebuild();

  runLoop(el, frame);
}
