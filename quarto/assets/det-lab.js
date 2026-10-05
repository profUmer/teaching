/*
 * det-lab.js - a 3x3 determinant, expanded along the first row one element
 * at a time, with numbers; and the cofactor matrix, one cell at a time.
 *
 * Each Next adds one term: the element of row 1 is picked and its row and
 * column are blocked out, leaving the 2x2 that goes in its brackets. The
 * next term's sign comes in with it, so the line always ends saying more
 * is coming.
 * A last step puts "= det" on the end.
 *
 * mountCofactorLab does the same blocking for all nine positions, filling the
 * cofactor matrix beside A as it goes: block out a row and column, work out
 * the 2x2 that is left, and flip its sign on the checkerboard's minus cells.
 * mountCofactorTransposeLab then turns that matrix's rows into columns.
 *
 * Like matmul-lab.js this is plain DOM, no canvas, reusing lab-matrix-grid's
 * brackets and the mm-* highlight colours.
 */

import { button, fmt } from './lab-core.js';

// det = 3(18) - 2(1) + 1(-7) = 45: the middle element is not 0, so the flip
// shows, and one 2x2 comes out negative, so the brackets get used.
const DEFAULT_A = [3, 2, 1, 1, 4, 2, 2, 1, 5];

export function mountDetLab(el, opts = {}) {
  const { a = DEFAULT_A, aLabel = 'A' } = opts;

  el.classList.add('lab', 'lab-det');

  const eqn = document.createElement('div');
  eqn.className = 'mm-equation';
  el.appendChild(eqn);

  name(eqn, `${aLabel} =`);
  const mA = grid(eqn, 3, a.map((v) => fmt(v)));

  const formula = document.createElement('div');
  formula.className = 'mm-step det-formula';
  el.appendChild(formula);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  el.appendChild(buttons);

  // The 2x2 left once row 0 and column `col` are blocked out, row-major.
  const leftOver = (col) => [1, 2].flatMap((r) => [0, 1, 2].filter((c) => c !== col).map((c) => a[r * 3 + c]));

  // One term per element of row 1; the middle one's sign is flipped.
  const terms = [0, 1, 2].map((col) => {
    const [p, q, r, s] = leftOver(col);
    return {
      x: a[col],
      sign: col === 1 ? -1 : 1,
      cross: `${paren(p)}×${paren(s)} − ${paren(q)}×${paren(r)}`,   // [p q; r s] -> ps - qr
      minor: p * s - q * r,
    };
  });
  const det = terms.reduce((sum, t) => sum + t.sign * t.x * t.minor, 0);

  let step = -1;   // -1 = not started; 0..2 = the term just added; 3 = the answer

  const signHtml = (sign) => (sign < 0 ? '−' : '+');

  function render() {
    blockOut(mA.cells, step >= 0 && step < 3 ? 0 : -1, step);

    // The terms so far. The newest is highlighted the way the matrix is: its
    // element red, the 2x2 it multiplies blue. Each but the last brings the
    // next term's sign with it, so the line always ends saying more is coming.
    const shown = terms.slice(0, Math.min(step + 1, 3)).map((t, i) => {
      const now = i === step;
      const next = terms[i + 1] ? ` ${signHtml(terms[i + 1].sign)}` : '';
      return ` <span class="${now ? 'mm-hl-a' : ''}">${paren(t.x)}</span>` +
        `<span class="${now ? 'mm-hl-b' : ''}">(${t.cross})</span>${next}`;
    });
    const answer = step === 3 ? ` = <strong>${fmt(det)}</strong>` : '';
    formula.innerHTML = `determinant(${aLabel}) =${shown.join('')}${answer}`;
  }

  function goto(n) {
    step = Math.max(-1, Math.min(3, n));
    render();
  }

  button(buttons, 'Prev', () => goto(step - 1));
  button(buttons, 'Next', () => goto(step + 1));
  button(buttons, 'Reset', () => goto(-1));

  goto(-1);
}

/* ======================================================= cofactor matrix */

// The cofactor of the element at (row, col): block out its row and column,
// take ps - qr of the 2x2 left over, and flip the sign where row + col is odd.
export function mountCofactorLab(el, opts = {}) {
  const { a = DEFAULT_A, aLabel = 'A', cLabel = `cofactor(${aLabel})` } = opts;

  el.classList.add('lab', 'lab-det');

  const eqn = document.createElement('div');
  eqn.className = 'mm-equation';
  el.appendChild(eqn);

  name(eqn, `${aLabel} =`);
  const mA = grid(eqn, 3, a.map((v) => fmt(v)));
  const gap = document.createElement('span');
  gap.className = 'det-gap';
  eqn.appendChild(gap);
  name(eqn, `${cLabel} =`);
  const mC = grid(eqn, 3, a.map(() => ' '));

  const formula = document.createElement('div');
  formula.className = 'mm-step det-formula';
  el.appendChild(formula);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  el.appendChild(buttons);

  const cells = cofactors(a);

  let step = -1;   // -1 = not started; 0..8 = the cell just filled, row by row

  function render() {
    const c = cells[step];
    blockOut(mA.cells, c ? c.row : -1, c ? c.col : -1);
    // The picked element shows its checkerboard sign in place of its value:
    // the sign is all a cofactor takes from that position.
    mA.cells.forEach((cell, i) => {
      cell.textContent = i === step ? (cells[i].sign < 0 ? '−' : '+') : fmt(a[i]);
    });
    mC.cells.forEach((cell, i) => {
      // a no-break space keeps an unfilled row its height, so the brackets
      // do not grow as the matrix fills
      cell.textContent = i <= step ? fmt(cells[i].value) : ' ';
      cell.classList.toggle('mm-hl-c', i === step);   // green: the answer, as below
    });

    // Coloured to match A: the sign red, the 2x2's part blue, so "+(ei − hf)"
    // or "−(bi − hc)". The plus is written out too, since it came from A.
    if (!c) { formula.innerHTML = '&nbsp;'; return; }
    const sign = `<span class="mm-hl-a">${c.sign < 0 ? '−' : '+'}</span>`;
    formula.innerHTML = `${sign}<span class="mm-hl-b">(${c.cross})</span>` +
      ` = <span class="mm-hl-c">${fmt(c.value)}</span>`;
  }

  function goto(n) {
    step = Math.max(-1, Math.min(8, n));
    render();
  }

  button(buttons, 'Prev', () => goto(step - 1));
  button(buttons, 'Next', () => goto(step + 1));
  button(buttons, 'Reset', () => goto(-1));

  goto(-1);
}

/* =========================================== transposing the cofactors === */

// cofactor(A) beside cofactor(A)^T, which fills one column per Next: row r
// of the cofactor matrix (blue) becomes column r of its transpose (green).
// The last step carries the translation's row into the right-hand column.
export function mountCofactorTransposeLab(el, opts = {}) {
  const { a = DEFAULT_A, aLabel = 'A' } = opts;
  const cLabel = `cofactor(${aLabel})`;

  el.classList.add('lab', 'lab-det');

  const eqn = document.createElement('div');
  eqn.className = 'mm-equation';
  el.appendChild(eqn);

  const values = cofactors(a).map((c) => c.value);
  name(eqn, `${cLabel} =`);
  const mC = grid(eqn, 3, values.map((v) => fmt(v)));
  const gap = document.createElement('span');
  gap.className = 'det-gap';
  eqn.appendChild(gap);
  name(eqn, `${cLabel}ᵀ =`);
  const mT = grid(eqn, 3, values.map(() => ' '));

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  el.appendChild(buttons);

  let step = -1;   // -1 = not started; 0..2 = the row just turned into a column

  function render() {
    mC.cells.forEach((cell, i) => cell.classList.toggle('mm-hl-b', Math.floor(i / 3) === step));
    mT.cells.forEach((cell, i) => {
      const r = Math.floor(i / 3), c = i % 3;
      // transpose: (r, c) of the result is (c, r) of the cofactor matrix
      cell.textContent = c <= step ? fmt(values[c * 3 + r]) : ' ';
      cell.classList.toggle('mm-hl-c', c === step);
    });
  }

  function goto(n) {
    step = Math.max(-1, Math.min(2, n));
    render();
  }

  button(buttons, 'Prev', () => goto(step - 1));
  button(buttons, 'Next', () => goto(step + 1));
  button(buttons, 'Reset', () => goto(-1));

  goto(-1);
}

/* ======================================================= worked inverse === */

/* The whole of A^-1 = 1/determinant(A) x cofactor(A)^T, one step per Next,
   in the same style as the three labs above, for transform-lab.js's
   data-inverse-steps panel. Above the line, A and each result, moved up on
   the Next after it is finished; below it, two matrix slots and a working
   line. Each part opens on its name alone, "determinant(A) =", or its name
   and an empty matrix, "cofactor(A) = ( )", where it will fill in. Once the
   cofactors are above the line they are not written out again below it:
   the transpose and A^-1 pick out the cells they use up there instead.

     0-4     determinant(A): its name, a first-row term at a time, its value
     5-14    cofactor(A): its name, then a cell at a time
     15-18   cofactor(A)^T: its name, then a row into a column at a time
     19-28   A^-1: its name, then a cell of cofactor(A)^T over the determinant
     29      A^-1 on its own, the working cleared away

   update(m) swaps in a new A (the sliders moved) and redraws the same step. */
const TRANSPOSE = [0, 3, 6, 1, 4, 7, 2, 5, 8];
const STEPS = { det: 0, cof: 5, tr: 15, div: 19, last: 29 };   // where each part opens

export function workedInverse(parent, { aLabel = 'A' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'det-worked';
  parent.appendChild(wrap);

  // What is known so far, above the line: "A = ( )  cofactor(A) = ( )", with
  // "determinant(A) = 2" under A, the cofactors swapped for their transpose
  // once done. The determinant's line is always there, blank until it is
  // known, so the buttons below do not jump when it appears.
  const summary = document.createElement('div');
  summary.className = 'mm-equation det-summary';
  wrap.appendChild(summary);
  const sumA = document.createElement('div');
  sumA.className = 'det-col';
  summary.appendChild(sumA);
  const sumARow = document.createElement('div');
  sumARow.className = 'mm-equation';
  sumA.appendChild(sumARow);
  name(sumARow, `${aLabel} =`);
  const sumM = grid(sumARow, 3, Array(9).fill('\u00a0'));
  const sumDet = name(sumA, '\u00a0');
  const sumGap = document.createElement('span');
  sumGap.className = 'det-gap';
  summary.appendChild(sumGap);
  // built the same way as A's column, with a blank line under it, so the
  // two matrices line up
  const sumCRow = document.createElement('div');
  sumCRow.className = 'det-col';
  summary.appendChild(sumCRow);
  const sumCEqn = document.createElement('div');
  sumCEqn.className = 'mm-equation';
  sumCRow.appendChild(sumCEqn);
  const sumNameC = name(sumCEqn, '');
  const sumC = grid(sumCEqn, 3, Array(9).fill('\u00a0'));
  name(sumCRow, '\u00a0');

  const eqn = document.createElement('div');
  eqn.className = 'mm-equation';
  wrap.appendChild(eqn);
  const blank = Array(9).fill('\u00a0');
  const nameL = name(eqn, '');
  const L = grid(eqn, 3, blank);
  const gap = document.createElement('span');
  gap.className = 'det-gap';
  eqn.appendChild(gap);
  const nameR = name(eqn, '');
  const R = grid(eqn, 3, blank);

  const formula = document.createElement('div');
  formula.className = 'mm-step det-formula';
  wrap.appendChild(formula);

  const buttons = document.createElement('div');
  buttons.className = 'lab-buttons';
  wrap.appendChild(buttons);

  let m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let step = 0;

  const hl = (cls, html) => `<span class="${cls}">${html}</span>`;
  // a stacked fraction, numerator over a rule over denominator, as \frac{}{} writes it
  const frac = (num, den) => `<span class="det-frac"><span>${num}</span><span>${den}</span></span>`;
  const signOf = (sign) => (sign < 0 ? '−' : '+');

  function fill(slot, label, values) {
    slot.name.textContent = label;
    slot.cells.forEach((cell, i) => {
      cell.classList.remove('mm-hl-a', 'mm-hl-b', 'mm-hl-c', 'det-out');
      cell.textContent = values[i] === undefined ? '\u00a0' : fmt(values[i]);
    });
  }

  function render() {
    const cof = cofactors(m);
    const cv = cof.map((c) => c.value);
    const det = m[0] * cv[0] + m[1] * cv[1] + m[2] * cv[2];   // along the first row
    const cT = TRANSPOSE.map((i) => cv[i]);
    const A = `${aLabel}`;
    const singular = Math.abs(det) < 1e-9;

    // each part's first step is its name and an empty matrix
    const start = step >= STEPS.div ? STEPS.div : step >= STEPS.tr ? STEPS.tr : step >= STEPS.cof ? STEPS.cof : STEPS.det;
    const k = step - start - 1;   // -1 = the part has just opened
    const dividing = step >= STEPS.div && k >= 0 && k < 9 && !singular;

    // above the line: A, then each result once the next part has opened.
    // While A^-1 is worked, the determinant (red) and the cell of the
    // transpose (blue) being divided are picked out up here.
    sumM.cells.forEach((cell, i) => { cell.textContent = fmt(m[i]); });
    sumDet.innerHTML = step >= STEPS.cof
      ? `determinant(${A}) = ${dividing ? hl('mm-hl-a', fmt(det)) : fmt(det)}`
      : '&nbsp;';
    const sumCof = step >= STEPS.tr;
    if (sumCof) {
      const tr = step >= STEPS.div;
      fill({ name: sumNameC, cells: sumC.cells }, tr ? `cofactor(${A})ᵀ =` : `cofactor(${A}) =`, tr ? cT : cv);
    }
    for (const n of [sumGap, sumCRow]) n.style.display = sumCof ? '' : 'none';

    const left = { name: nameL, cells: L.cells };
    const right = { name: nameR, cells: R.cells };
    let showLeft = true;      // false: hidden, but keeping its space
    let leftGone = false;     // true: not there at all, the result centred
    let showRight = true;
    let html = '&nbsp;';

    if (step < STEPS.cof) {
      // determinant: its name, a first-row term per step, each bringing the
      // next sign, then its value (k = 0..2 a term, 3 the value)
      fill(left, `${A} =`, m);
      showRight = false;
      showLeft = k >= 0;
      blockOut(L.cells, k >= 0 && k < 3 ? 0 : -1, k);
      const terms = [0, 1, 2].slice(0, Math.min(k + 1, 3)).map((col) => {
        const now = col === k;
        const next = col < 2 ? ` ${signOf(col === 0 ? -1 : 1)}` : '';
        // each term is one unbreakable piece, so a long line wraps between terms
        return ` ${hl('det-term', `${hl(now ? 'mm-hl-a' : '', paren(m[col]))}${hl(now ? 'mm-hl-b' : '', `(${cof[col].cross})`)}${next}`)}`;
      });
      html = `determinant(${A}) =${terms.join('')}` + (k === 3 ? ` = ${hl('mm-hl-c', fmt(det))}` : '');
    } else if (step < STEPS.tr) {
      // cofactor: opens on "cofactor(A) = ( )", then a cell per step, its
      // sign in place of the element
      fill(left, `${A} =`, m);
      fill(right, `cofactor(${A}) =`, cv.slice(0, k + 1));
      showLeft = k >= 0;
      if (k >= 0) {
        const c = cof[k];
        blockOut(L.cells, c.row, c.col);
        L.cells[k].textContent = signOf(c.sign);
        R.cells[k].classList.add('mm-hl-c');
        html = `${hl('mm-hl-a', signOf(c.sign))}${hl('mm-hl-b', `(${c.cross})`)} = ${hl('mm-hl-c', fmt(c.value))}`;
      }
    } else if (step < STEPS.div) {
      // transpose: opens on "cofactor(A)^T = ( )", then a row of the
      // cofactors above the line becomes a column here, no words needed
      leftGone = true;
      fill(right, `cofactor(${A})ᵀ =`, cT.map((v, i) => (i % 3 <= k ? v : undefined)));
      sumC.cells.forEach((cell, i) => cell.classList.toggle('mm-hl-b', Math.floor(i / 3) === k));
      R.cells.forEach((cell, i) => cell.classList.toggle('mm-hl-c', i % 3 === k));
    } else if (singular) {
      leftGone = true;
      fill(right, `${A}⁻¹ =`, k >= 0 ? Array(9).fill(NaN) : []);
      if (k >= 0) html = `determinant(${A}) = 0, so ${A} has no inverse`;
    } else {
      // A^-1: opens on "A^-1 = ( )", then a cell of the transpose above the
      // line per step, divided by the determinant; the last Next clears the
      // working away and leaves A^-1 on its own
      leftGone = true;
      fill(right, `${A}⁻¹ =`, cT.slice(0, k + 1).map((v) => v / det));
      if (dividing) {
        sumC.cells[k].classList.add('mm-hl-b');
        R.cells[k].classList.add('mm-hl-c');
        html = `${frac(hl('mm-hl-b', fmt(cT[k])), hl('mm-hl-a', fmt(det)))} = ${hl('mm-hl-c', fmt(cT[k] / det))}`;
      }
    }

    for (const n of [gap, nameR, R.wrap]) n.style.display = showRight ? '' : 'none';
    for (const n of [nameL, L.wrap, gap]) if (leftGone) n.style.display = 'none';
    for (const n of [nameL, L.wrap]) if (!leftGone) n.style.display = '';
    // hidden rather than removed, so the working line and buttons stay put
    for (const n of [nameL, L.wrap]) n.style.visibility = showLeft ? '' : 'hidden';
    formula.innerHTML = html;
  }

  function goto(n) {
    step = Math.max(0, Math.min(STEPS.last, n));
    render();
  }

  button(buttons, 'Prev', () => goto(step - 1));
  button(buttons, 'Next', () => goto(step + 1));
  button(buttons, 'Reset', () => goto(0));

  return { update(next) { m = next; render(); } };
}

/* ================================================================ shared === */

// All nine cofactors of A, row by row: block out each element's row and
// column, take ps - qr of the 2x2 left over, flip the sign where row + col
// is odd. Exported for transform-lab.js's worked inverse.
export function cofactors(a) {
  return a.map((_, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    const keep = (k, skip) => [0, 1, 2].filter((x) => x !== skip).includes(k);
    const left = a.filter((_, j) => keep(Math.floor(j / 3), row) && keep(j % 3, col));
    const [p, q, r, s] = left;
    const sign = (row + col) % 2 ? -1 : 1;
    return {
      row, col, sign,
      cross: `${paren(p)}×${paren(s)} − ${paren(q)}×${paren(r)}`,   // [p q; r s] -> ps - qr
      value: sign * (p * s - q * r),
    };
  });
}

// Picks the element at (row, col) in red, greys out the rest of its row and
// column, and turns the 2x2 left over blue. row = -1 clears it all.
function blockOut(cells, row, col) {
  cells.forEach((cell, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    cell.classList.remove('mm-hl-a', 'mm-hl-b', 'det-out');
    if (row < 0) return;
    if (r === row && c === col) cell.classList.add('mm-hl-a');
    else if (r === row || c === col) cell.classList.add('det-out');
    else cell.classList.add('mm-hl-b');
  });
}

// "A =", written beside its matrix as the slides write it.
function name(parent, text) {
  const s = document.createElement('span');
  s.className = 'det-name';
  s.textContent = text;
  parent.appendChild(s);
  return s;
}

// A bracketed square grid, as matmul-lab.js's matrixBlock builds one, less
// its caption: the name goes beside it instead.
function grid(parent, n, values) {
  const wrap = document.createElement('div');
  wrap.className = 'lab-matrix mm-matrix';
  const g = document.createElement('div');
  g.className = 'lab-matrix-grid';
  g.style.gridTemplateColumns = `repeat(${n}, minmax(1.6em, auto))`;
  const cells = values.map((v) => {
    const cell = document.createElement('span');
    cell.textContent = v;
    g.appendChild(cell);
    return cell;
  });
  wrap.append(g);
  parent.appendChild(wrap);
  return { wrap, cells };
}

// Negatives in brackets, as matmul-lab.js writes them: 4×(−1), not 4×−1,
// and − (−1)(...), not − -1(...).
function paren(v) {
  return v < 0 ? `(${fmt(v)})` : fmt(v);
}
