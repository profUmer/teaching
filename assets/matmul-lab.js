/*
 * matmul-lab.js - step-by-step matrix multiplication, row by column.
 *
 * Two shapes, both walking through the arithmetic one row at a time and
 * spelling it out the way the dumptruck slide does for a single row times a
 * single column:
 *
 *   mountMatmulLab(el, { a, b })   one A x B, cell by cell (9 steps for a
 *                                  3x3 B - the T x S slide).
 *   mountMatmulLab(el, { a, bs })  several A x b_i side by side, one above
 *                                  the other, stepped in lock-step by row of
 *                                  A (3 steps, however many b_i there are) -
 *                                  the point-vs-direction slide, so Next
 *                                  builds T x pos and T x dir together and
 *                                  the two answers can be read off in step.
 *
 * B (or each b_i) need not be a single column: bCols is read from its own
 * length (/ 3) - A is always 3x3.
 *
 * No canvas here - unlike the other labs, there is no 2D geometry to draw,
 * only numbers and which of them are being combined, so this is plain DOM,
 * reusing lab-matrix-grid's bracket-and-font styling for a consistent look.
 */

import { button, fmt } from './lab-core.js';

// scale(2, 3) multiplied on the left by translate(1, -1): T x S, matching
// the deck's TR-style convention where the left factor is applied second.
const DEFAULT_A = [1, 0, 1, 0, 1, -1, 0, 0, 1];
const DEFAULT_B = [2, 0, 0, 0, 3, 0, 0, 0, 1];

export function mountMatmulLab(el, opts = {}) {
  if (Array.isArray(opts.bs)) mountMulti(el, opts);
  else mountSingle(el, opts);
}

/* ============================================================ single A x B */

function mountSingle(el, opts) {
  const {
    a = DEFAULT_A,
    b = DEFAULT_B,
    aLabel = 'A',
    bLabel = 'B',
    cLabel = aLabel + bLabel,
    // 'row' fills C row by row, as a hand-worked matrix product is usually
    // written. 'col' fills column by column instead - clearer when B's
    // columns are independent cases rather than one matrix, e.g. finishing
    // one vector's result completely before starting the next.
    order = 'row',
  } = opts;

  const bCols = Math.round(b.length / 3);   // B and C are 3 x bCols; A is always 3x3
  const totalSteps = 3 * bCols;

  el.classList.add('lab', 'lab-matmul');

  const eqn = document.createElement('div');
  eqn.className = 'mm-equation';
  el.appendChild(eqn);

  const mA = matrixBlock(eqn, aLabel, 3);
  op(eqn, '×');
  const mB = matrixBlock(eqn, bLabel, bCols);
  op(eqn, '=');
  const mC = matrixBlock(eqn, cLabel, bCols);

  fillCells(mA.cells, a);
  fillCells(mB.cells, b);

  const stepEl = document.createElement('div');
  stepEl.className = 'mm-step';
  el.appendChild(stepEl);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  el.appendChild(buttons);

  const atA = (r, c) => mA.cells[r * 3 + c];
  const atB = (r, c) => mB.cells[r * bCols + c];
  const atC = (r, c) => mC.cells[r * bCols + c];

  // Linear step index -> (row, col), in whichever order was asked for.
  function indexFor(i) {
    return order === 'col'
      ? { row: i % 3, col: Math.floor(i / 3) }
      : { row: Math.floor(i / bCols), col: i % bCols };
  }

  let step = -1;   // -1 = not started yet; 0..totalSteps-1 = the cell just computed

  function clearHighlights() {
    for (const cell of [...mA.cells, ...mB.cells, ...mC.cells]) {
      cell.classList.remove('mm-hl-a', 'mm-hl-b', 'mm-hl-c');
    }
  }

  function dot(row, col) {
    let sum = 0;
    for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * b[k * bCols + col];
    return sum;
  }

  function render() {
    clearHighlights();
    if (step < 0) {
      stepEl.innerHTML = `Hit <strong>Next</strong> to start the dumptruck`;
      return;
    }
    const { row, col } = indexFor(step);
    for (let k = 0; k < 3; k++) {
      atA(row, k).classList.add('mm-hl-a');
      atB(k, col).classList.add('mm-hl-b');
    }
    atC(row, col).classList.add('mm-hl-c');

    const terms = [];
    for (let k = 0; k < 3; k++) {
      const av = a[row * 3 + k], bv = b[k * bCols + col];
      terms.push(`<span class="mm-a">${paren(av)}</span>&middot;<span class="mm-b">${paren(bv)}</span>`);
    }
    stepEl.innerHTML = `${terms.join(' + ')} = <strong>${fmt(dot(row, col))}</strong>`;
  }

  // Fills every C cell through the current step and blanks the rest, so
  // stepping back with Prev un-computes cells rather than leaving stale ones.
  function goto(n) {
    step = Math.max(-1, Math.min(totalSteps - 1, n));
    for (let i = 0; i < totalSteps; i++) {
      const { row, col } = indexFor(i);
      atC(row, col).textContent = i <= step ? fmt(dot(row, col)) : '';
    }
    render();
  }

  button(buttons, 'Prev', () => goto(step - 1));
  button(buttons, 'Next', () => goto(step + 1));
  button(buttons, 'Reset', () => goto(-1));

  goto(-1);
}

/* ======================================================== several A x b_i */

// Several A x b_i, one equation per b_i stacked vertically, all sharing one
// Prev/Next/Reset that steps through A's 3 rows - so Next reveals row r of
// every b_i's answer at once, and the two (or more) results build up and can
// be compared side by side rather than one fully worked before the next.
function mountMulti(el, opts) {
  const {
    a = DEFAULT_A,
    aLabel = 'A',
    bs,
  } = opts;

  el.classList.add('lab', 'lab-matmul', 'lab-matmul-multi');

  const rows = bs.map(({ b, bLabel = 'B', cLabel }) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'mm-multi-row';
    el.appendChild(rowEl);

    const eqn = document.createElement('div');
    eqn.className = 'mm-equation';
    rowEl.appendChild(eqn);

    const mA = matrixBlock(eqn, aLabel, 3);
    op(eqn, '×');
    const mB = matrixBlock(eqn, bLabel, 1);
    op(eqn, '=');
    const mC = matrixBlock(eqn, cLabel || aLabel + bLabel, 1);

    fillCells(mA.cells, a);
    fillCells(mB.cells, b);

    const stepEl = document.createElement('div');
    stepEl.className = 'mm-step';
    rowEl.appendChild(stepEl);

    return { b, mA, mB, mC, stepEl };
  });

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  el.appendChild(buttons);

  function dot(r, row) {
    let sum = 0;
    for (let k = 0; k < 3; k++) sum += a[row * 3 + k] * r.b[k];
    return sum;
  }

  let step = -1;   // -1 = not started; 0..2 = the row of A just applied to every b_i

  function clearHighlights() {
    for (const r of rows) {
      for (const cell of [...r.mA.cells, ...r.mB.cells, ...r.mC.cells]) {
        cell.classList.remove('mm-hl-a', 'mm-hl-b', 'mm-hl-c');
      }
    }
  }

  function render() {
    clearHighlights();
    for (const r of rows) {
      if (step < 0) {
        r.stepEl.innerHTML = `Hit <strong>Next</strong> to start the dumptruck`;
        continue;
      }
      for (let k = 0; k < 3; k++) {
        r.mA.cells[step * 3 + k].classList.add('mm-hl-a');
        r.mB.cells[k].classList.add('mm-hl-b');
      }
      r.mC.cells[step].classList.add('mm-hl-c');

      const terms = [];
      for (let k = 0; k < 3; k++) {
        terms.push(`<span class="mm-a">${paren(a[step * 3 + k])}</span>&middot;<span class="mm-b">${paren(r.b[k])}</span>`);
      }
      r.stepEl.innerHTML = `${terms.join(' + ')} = <strong>${fmt(dot(r, step))}</strong>`;
    }
  }

  function goto(n) {
    step = Math.max(-1, Math.min(2, n));
    for (const r of rows) {
      for (let i = 0; i < 3; i++) r.mC.cells[i].textContent = i <= step ? fmt(dot(r, i)) : '';
    }
    render();
  }

  button(buttons, 'Prev', () => goto(step - 1));
  button(buttons, 'Next', () => goto(step + 1));
  button(buttons, 'Reset', () => goto(-1));

  goto(-1);
}

/* ================================================================ shared === */

function op(parent, text) {
  const s = document.createElement('span');
  s.className = 'mm-op';
  s.textContent = text;
  parent.appendChild(s);
}

// A bracketed 3-row grid, built the same way matrixPanel() in lab-core.js is,
// but with a fixed cell count (this matrix's size never changes once mounted)
// and returning the cells directly so steps can highlight and fill them
// individually. `cols` need not be 3: a single column vector is cols=1.
function matrixBlock(parent, label, cols) {
  const wrap = document.createElement('div');
  wrap.className = 'lab-matrix mm-matrix';
  const caption = document.createElement('div');
  caption.className = 'lab-matrix-caption';
  caption.textContent = label;
  const grid = document.createElement('div');
  grid.className = 'lab-matrix-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(2.6em, auto))`;
  const cells = [];
  for (let i = 0; i < 3 * cols; i++) {
    const cell = document.createElement('span');
    grid.appendChild(cell);
    cells.push(cell);
  }
  wrap.append(caption, grid);
  parent.appendChild(wrap);
  return { cells };
}

// A negative factor reads as "+ -1·1" otherwise; the deck's own algebra
// slides (e.g. "1(4)+(-3)(-1)+5(2)") wrap negatives in parens instead.
function paren(v) {
  const s = fmt(v);
  return v < 0 ? `(${s})` : s;
}

function fillCells(cells, values) {
  values.forEach((v, i) => { cells[i].textContent = fmt(v); });
}
