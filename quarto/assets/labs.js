/*
 * labs.js - turns markup into interactive demos.
 *
 * Slides declare a lab with a div and nothing else:
 *
 *   <div class="lab-mount" data-lab="2d" data-stages="rotate,translate"></div>
 *   <div class="lab-mount" data-lab="reflect" data-preset="peggle"></div>
 *
 * This is the only module the decks load; it dispatches to transform-lab.js
 * (matrix transforms), vector-lab.js (2D vector demos), motion-lab.js
 * (kinematics) or matmul-lab.js (step-by-step 3x3 multiplication). Keeping
 * one entry point means one scan of the document and no chance of two
 * modules both claiming the same div.
 */

import { mountLab2D } from './transform-lab.js';
import { mountVectorLab } from './vector-lab.js';
import { mountMotionLab } from './motion-lab.js';
import { mountMatmulLab } from './matmul-lab.js';

const VECTOR_MODES = new Set(['polar', 'add', 'dot', 'reflect']);
const MOTION_MODES = new Set(['motion', 'accel']);

const NUMERIC = ['view', 'cx', 'cy', 'step', 'dp', 'theta', 'kx', 'ky', 'dx', 'dy', 't'];

function optionsFrom(el) {
  const opts = {};
  for (const key of NUMERIC) {
    if (el.dataset[key] !== undefined) opts[key] = parseFloat(el.dataset[key]);
  }
  if (el.dataset.stages) opts.stages = el.dataset.stages.split(',').map((s) => s.trim());
  if (el.dataset.shape) opts.shape = el.dataset.shape;
  if (el.dataset.preset) opts.preset = el.dataset.preset;
  if (el.dataset.show) opts.show = el.dataset.show;
  if (el.dataset.matrix === 'false') opts.showMatrix = false;
  if (el.dataset.reorder === 'false') opts.allowReorder = false;
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

function boot() {
  document.querySelectorAll('.lab-mount:not([data-mounted])').forEach((el) => {
    el.setAttribute('data-mounted', '1');
    const kind = el.dataset.lab || '2d';
    const opts = optionsFrom(el);

    try {
      if (VECTOR_MODES.has(kind)) mountVectorLab(el, { ...opts, mode: kind });
      else if (MOTION_MODES.has(kind)) mountMotionLab(el, { ...opts, mode: kind });
      else if (kind === 'matmul') mountMatmulLab(el, opts);
      else mountLab2D(el, opts);
    } catch (err) {
      // One broken lab should not take down the rest of the deck mid-lecture.
      console.error(`lab "${kind}" failed to mount`, err);
      el.classList.add('lab-failed');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
