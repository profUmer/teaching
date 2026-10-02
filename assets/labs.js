/*
 * labs.js - turns markup into interactive demos.
 *
 * Slides declare a lab with a div and nothing else:
 *
 *   <div class="lab-mount" data-lab="2d" data-stages="rotate,translate"></div>
 *   <div class="lab-mount" data-lab="reflect" data-preset="peggle"></div>
 *
 * This is the only module the decks load; it dispatches to transform-lab.js
 * (2D matrix transforms), transform-lab3d.js (the 4x4 versions), vector-lab.js (2D vector demos), motion-lab.js
 * (kinematics), matmul-lab.js (step-by-step 3x3 multiplication) or
 * det-lab.js (a 3x3 determinant, one first-row element at a time, and the
 * cofactor matrix, one cell at a time, and its transpose, one row at a time)
 * or quat-lab.js (two reflections making a rotation, for the quaternion decks). Keeping
 * one entry point means one scan of the document and no chance of two
 * modules both claiming the same div.
 */

import { mountLab2D } from './transform-lab.js';
import { mountLab3D } from './transform-lab3d.js';
import { mountVectorLab } from './vector-lab.js';
import { mountMotionLab } from './motion-lab.js';
import { mountMatmulLab } from './matmul-lab.js';
import { mountDetLab, mountCofactorLab, mountCofactorTransposeLab } from './det-lab.js';
import { mountQuatLab } from './quat-lab.js';

const VECTOR_MODES = new Set(['polar', 'add', 'dot', 'reflect']);
const MOTION_MODES = new Set(['motion', 'accel']);
const QUAT_MODES = new Set(['planes', 'parallel']);

const NUMERIC = ['view', 'cx', 'cy', 'step', 'dp', 'theta', 'kx', 'ky', 'dx', 'dy', 't',
                 'kz', 'dz', 'thetaX', 'thetaY', 'thetaZ', 'yaw', 'pitch', 'd'];

function optionsFrom(el) {
  const opts = {};
  for (const key of NUMERIC) {
    if (el.dataset[key] !== undefined) opts[key] = parseFloat(el.dataset[key]);
  }
  if (el.dataset.stages) opts.stages = el.dataset.stages.split(',').map((s) => s.trim());
  if (el.dataset.shape) opts.shape = el.dataset.shape;
  if (el.dataset.dots !== undefined) opts.dots = el.dataset.dots;
  if (el.dataset.preset) opts.preset = el.dataset.preset;
  if (el.dataset.axis) opts.axis = el.dataset.axis;
  if (el.dataset.axisPick === 'false') opts.axisPick = false;
  if (el.dataset.show) opts.show = el.dataset.show;
  if (el.dataset.matrix === 'false') opts.showMatrix = false;
  if (el.dataset.reorder === 'false') opts.allowReorder = false;
  if (el.dataset.inverse === 'true') opts.inverse = true;
  if (el.dataset.inverse === 'transpose') opts.inverse = 'transpose';
  if (el.dataset.inverseSteps === 'true') opts.inverseSteps = true;
  if (el.dataset.a) opts.a = el.dataset.a.split(',').map(Number);
  if (el.dataset.b) opts.b = el.dataset.b.split(',').map(Number);
  if (el.dataset.aLabel) opts.aLabel = el.dataset.aLabel;
  if (el.dataset.bLabel) opts.bLabel = el.dataset.bLabel;
  if (el.dataset.cLabel) opts.cLabel = el.dataset.cLabel;
  if (el.dataset.order) opts.order = el.dataset.order;
  // Several vectors stepped in lock-step (matmul-lab.js's mountMulti):
  // data-bs="2,1,1;2,1,0" is two 3x1 columns, semicolon between them;
  // data-bs-labels / data-cs-labels pair up with them by position.
  if (el.dataset.bs) {
    const groups = el.dataset.bs.split(';').map((g) => g.split(',').map(Number));
    const bLabels = (el.dataset.bsLabels || '').split(',');
    const cLabels = (el.dataset.csLabels || '').split(',');
    opts.bs = groups.map((b, i) => ({ b, bLabel: bLabels[i], cLabel: cLabels[i] }));
  }
  return opts;
}

// The elements this page actually mounted. Not the data-mounted attribute:
// reveal.js can hand back a copy of a mounted lab (see watchSlides) that
// carries the attribute and a canvas but none of the code behind them.
const mounted = new WeakSet();

function boot() {
  document.querySelectorAll('.lab-mount').forEach((el) => {
    if (mounted.has(el)) return;
    mounted.add(el);
    el.textContent = '';                 // drop a dead copy's canvas and panels
    el.classList.remove('lab-failed');
    el.setAttribute('data-mounted', '1');
    const kind = el.dataset.lab || '2d';
    const opts = optionsFrom(el);

    try {
      if (VECTOR_MODES.has(kind)) mountVectorLab(el, { ...opts, mode: kind });
      else if (MOTION_MODES.has(kind)) mountMotionLab(el, { ...opts, mode: kind });
      else if (QUAT_MODES.has(kind)) mountQuatLab(el, { ...opts, mode: kind });
      else if (kind === 'matmul') mountMatmulLab(el, opts);
      else if (kind === 'det') mountDetLab(el, opts);
      else if (kind === 'cofactor') mountCofactorLab(el, opts);
      else if (kind === 'cofactor-transpose') mountCofactorTransposeLab(el, opts);
      else if (kind === '3d') mountLab3D(el, opts);
      else mountLab2D(el, opts);
    } catch (err) {
      // One broken lab should not take down the rest of the deck mid-lecture.
      console.error(`lab "${kind}" failed to mount`, err);
      el.classList.add('lab-failed');
    }
  });
}

/*
 * reveal.js 5 switches to its scroll view below 435 px (a phone in portrait,
 * or 'r' from the menu). On the way in it saves the slides as an HTML string;
 * on the way out it restores them with innerHTML. That rebuild leaves every
 * lab a lifeless copy and, if the string was saved before MathJax finished,
 * every equation raw LaTeX. So when the slides are rebuilt, mount the copies
 * and typeset whatever math is still raw.
 */
function watchSlides() {
  const slides = document.querySelector('.reveal .slides');
  if (!slides) return;
  new MutationObserver(() => {
    boot();
    const raw = slides.querySelector('span.math:not(:has(mjx-container))');
    if (raw && window.MathJax?.typesetPromise) {
      MathJax.typesetPromise([slides]).catch((err) => console.error('MathJax retypeset failed', err));
    }
  }).observe(slides, { childList: true });
}

function start() {
  boot();
  watchSlides();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
