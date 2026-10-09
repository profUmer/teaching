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
 *                                  A (n steps, however many b_i there are) -
 *                                  the point-vs-direction slide, so Next
 *                                  builds T x pos and T x dir together and
 *                                  the two answers can be read off in step.
 *   mountMatmulLab(el, { ms })     a chain like T x R x S, multiplied right
 *                                  to left: R x S = RS cell by cell, then
 *                                  T x RS = TRS, one equation stacked under
 *                                  the last - the Model Matrix slide.
 *
 * A is square, n x n, with n read from its length (9 -> 3x3, 16 -> 4x4). B
 * (or each b_i) has n rows and need not be a single column: bCols is read
 * from its own length (/ n).
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
  if (Array.isArray(opts.ms)) mountChain(el, opts);
  else if (Array.isArray(opts.bs)) mountMulti(el, opts);
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

  const n = sizeOf(a);                      // A is n x n
  const bCols = Math.round(b.length / n);   // B and C are n x bCols
  const totalSteps = n * bCols;

  el.classList.add('lab', 'lab-matmul');

  const eqn = document.createElement('div');
  eqn.className = 'mm-equation';
  el.appendChild(eqn);

  const mA = matrixBlock(eqn, aLabel, n, n);
  op(eqn, '×');
  const mB = matrixBlock(eqn, bLabel, n, bCols);
  op(eqn, '=');
  const mC = matrixBlock(eqn, cLabel, n, bCols);

  fillCells(mA.cells, a);
  fillCells(mB.cells, b);

  const stepEl = document.createElement('div');
  stepEl.className = 'mm-step';
  el.appendChild(stepEl);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  el.appendChild(buttons);

  const atA = (r, c) => mA.cells[r * n + c];
  const atB = (r, c) => mB.cells[r * bCols + c];
  const atC = (r, c) => mC.cells[r * bCols + c];

  // Linear step index -> (row, col), in whichever order was asked for.
  function indexFor(i) {
    return order === 'col'
      ? { row: i % n, col: Math.floor(i / n) }
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
    for (let k = 0; k < n; k++) sum += a[row * n + k] * b[k * bCols + col];
    return sum;
  }

  function render() {
    clearHighlights();
    if (step < 0) {
      stepEl.innerHTML = `Hit <strong>Next</strong> to start the dumptruck`;
      return;
    }
    const { row, col } = indexFor(step);
    for (let k = 0; k < n; k++) {
      atA(row, k).classList.add('mm-hl-a');
      atB(k, col).classList.add('mm-hl-b');
    }
    atC(row, col).classList.add('mm-hl-c');

    const terms = [];
    for (let k = 0; k < n; k++) {
      const av = a[row * n + k], bv = b[k * bCols + col];
      terms.push(`<span class="mm-a">${paren(av)}</span>&times;<span class="mm-b">${paren(bv)}</span>`);
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
// Prev/Next/Reset that steps through A's n rows - so Next reveals row r of
// every b_i's answer at once, and the two (or more) results build up and can
// be compared side by side rather than one fully worked before the next.
function mountMulti(el, opts) {
  const {
    a = DEFAULT_A,
    aLabel = 'A',
    bs,
  } = opts;

  const n = sizeOf(a);

  el.classList.add('lab', 'lab-matmul', 'lab-matmul-multi');

  const rows = bs.map(({ b, bLabel = 'B', cLabel }) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'mm-multi-row';
    el.appendChild(rowEl);

    const eqn = document.createElement('div');
    eqn.className = 'mm-equation';
    rowEl.appendChild(eqn);

    const mA = matrixBlock(eqn, aLabel, n, n);
    op(eqn, '×');
    const mB = matrixBlock(eqn, bLabel, n, 1);
    op(eqn, '=');
    const mC = matrixBlock(eqn, cLabel || aLabel + bLabel, n, 1);

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
    for (let k = 0; k < n; k++) sum += a[row * n + k] * r.b[k];
    return sum;
  }

  let step = -1;   // -1 = not started; 0..n-1 = the row of A just applied to every b_i

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
      for (let k = 0; k < n; k++) {
        r.mA.cells[step * n + k].classList.add('mm-hl-a');
        r.mB.cells[k].classList.add('mm-hl-b');
      }
      r.mC.cells[step].classList.add('mm-hl-c');

      const terms = [];
      for (let k = 0; k < n; k++) {
        terms.push(`<span class="mm-a">${paren(a[step * n + k])}</span>&times;<span class="mm-b">${paren(r.b[k])}</span>`);
      }
      r.stepEl.innerHTML = `${terms.join(' + ')} = <strong>${fmt(dot(r, step))}</strong>`;
    }
  }

  function goto(to) {
    step = Math.max(-1, Math.min(n - 1, to));
    for (const r of rows) {
      for (let i = 0; i < n; i++) r.mC.cells[i].textContent = i <= step ? fmt(dot(r, i)) : '';
    }
    render();
  }

  button(buttons, 'Prev', () => goto(step - 1));
  button(buttons, 'Next', () => goto(step + 1));
  button(buttons, 'Reset', () => goto(-1));

  goto(-1);
}

/* ================================================== chain T x R x S ... === */

// A product of several n x n matrices, multiplied right to left the way it
// is applied: with ms = [T, R, S], first R x S = RS, then T x RS = TRS. Each
// product is its own equation, stacked under the last, and Next fills one
// cell at a time - all of the first product, then all of the next. The
// left-hand side of each later equation is the previous result, filling in
// as that result does, so the chain reads as one long dumptruck.
function mountChain(el, opts) {
  const { ms } = opts;
  const n = sizeOf(ms[0].m);
  const cells = n * n;

  el.classList.add('lab', 'lab-matmul', 'lab-matmul-multi', 'lab-matmul-chain');

  // products[j] is ms[i] x (everything to its right), i from the second-last
  // factor down to the first.
  const products = [];
  let right = ms[ms.length - 1].m;
  let rightLabel = ms[ms.length - 1].label;
  for (let i = ms.length - 2; i >= 0; i--) {
    const a = ms[i].m;
    const b = right;
    const c = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        let sum = 0;
        for (let k = 0; k < n; k++) sum += a[row * n + k] * b[k * n + col];
        c.push(sum);
      }
    }
    const cLabel = ms[i].label + rightLabel;

    const rowEl = document.createElement('div');
    rowEl.className = 'mm-multi-row';
    el.appendChild(rowEl);
    const eqn = document.createElement('div');
    eqn.className = 'mm-equation';
    rowEl.appendChild(eqn);
    const mA = matrixBlock(eqn, ms[i].label, n, n);
    op(eqn, '×');
    const mB = matrixBlock(eqn, rightLabel, n, n);
    op(eqn, '=');
    const mC = matrixBlock(eqn, cLabel, n, n);
    fillCells(mA.cells, a);

    products.push({ a, b, c, mA, mB, mC });
    right = c;
    rightLabel = cLabel;
  }

  const stepEl = document.createElement('div');
  stepEl.className = 'mm-step';
  el.appendChild(stepEl);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  el.appendChild(buttons);

  const totalSteps = products.length * cells;
  let step = -1;   // -1 = not started; else the cell just computed, counted across every product

  function render() {
    for (const p of products) {
      for (const cell of [...p.mA.cells, ...p.mB.cells, ...p.mC.cells]) {
        cell.classList.remove('mm-hl-a', 'mm-hl-b', 'mm-hl-c');
      }
    }
    if (step < 0) {
      stepEl.innerHTML = `Hit <strong>Next</strong> to start the dumptruck`;
      return;
    }
    const p = products[Math.floor(step / cells)];
    const i = step % cells;
    const row = Math.floor(i / n), col = i % n;
    const terms = [];
    for (let k = 0; k < n; k++) {
      p.mA.cells[row * n + k].classList.add('mm-hl-a');
      p.mB.cells[k * n + col].classList.add('mm-hl-b');
      terms.push(`<span class="mm-a">${paren(p.a[row * n + k])}</span>&times;<span class="mm-b">${paren(p.b[k * n + col])}</span>`);
    }
    p.mC.cells[i].classList.add('mm-hl-c');
    stepEl.innerHTML = `${terms.join(' + ')} = <strong>${fmt(p.c[i])}</strong>`;
  }

  // Fills every result cell through the current step and blanks the rest.
  // The first product's right-hand factor is given; each later one is the
  // product before it, so it shows exactly what that product has filled.
  function goto(to) {
    step = Math.max(-1, Math.min(totalSteps - 1, to));
    products.forEach((p, j) => {
      for (let i = 0; i < cells; i++) {
        const done = j * cells + i <= step;
        p.mC.cells[i].textContent = done ? fmt(p.c[i]) : '';
        p.mB.cells[i].textContent = j === 0 ? fmt(p.b[i]) : products[j - 1].mC.cells[i].textContent;
      }
    });
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

// A square matrix's side, from its row-major values: 9 -> 3, 16 -> 4.
function sizeOf(m) {
  return Math.round(Math.sqrt(m.length));
}

// A bracketed rows x cols grid, built the same way matrixPanel() in
// lab-core.js is, but with a fixed cell count (this matrix's size never
// changes once mounted) and returning the cells directly so steps can
// highlight and fill them individually. A single column vector is cols=1.
function matrixBlock(parent, label, rows, cols) {
  const wrap = document.createElement('div');
  wrap.className = 'lab-matrix mm-matrix';
  const caption = document.createElement('div');
  caption.className = 'lab-matrix-caption';
  caption.textContent = label;
  const grid = document.createElement('div');
  grid.className = 'lab-matrix-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(2.6em, auto))`;
  const cells = [];
  for (let i = 0; i < rows * cols; i++) {
    const cell = document.createElement('span');
    grid.appendChild(cell);
    cells.push(cell);
  }
  wrap.append(caption, grid);
  parent.appendChild(wrap);
  return { cells };
}

// A negative factor reads as "+ -1×1" otherwise; the deck's own algebra
// slides (e.g. "1(4)+(-3)(-1)+5(2)") wrap negatives in parens instead.
function paren(v) {
  const s = fmt(v);
  return v < 0 ? `(${s})` : s;
}

function fillCells(cells, values) {
  values.forEach((v, i) => { cells[i].textContent = fmt(v); });
}
