/*
 * blade-lab.js - "DQ Candy Crush": simplifying a product of basis vectors,
 * such as e01123, an adjacent swap or a matching pair at a time.
 *
 * Type the indices (0-3, at most 7) and they become tiles, written as the
 * subscript of an e. Three rules, and nothing else:
 *
 *   swap two neighbours      the sign flips          e10 = -e01
 *   two matching 1s, 2s, 3s  they disappear          e11 = e22 = e33 = 1
 *   two matching 0s          the whole term is 0     e00 = 0
 *
 * Between every pair of neighbouring tiles is a button: a swap, or - once the
 * two match - a pop. The tiles follow an = sign, as what the typed term equals.
 *
 * Like det-lab.js this is plain DOM, no canvas.
 */

import { button } from './lab-core.js';

const MAX_INDICES = 7;   // as many tiles as fit across a slide

export function applyMove({ coef, idx }, move) {
  const next = [...idx];
  if (move.kind === 'swap') {
    [next[move.i], next[move.i + 1]] = [next[move.i + 1], next[move.i]];
    return { coef: -coef, idx: next };
  }
  if (idx[move.i] === '0') return { coef: 0, idx: [] };
  next.splice(move.i, 2);
  return { coef, idx: next };
}

// -e023 as HTML: a 1 only when there is no e left to carry the sign.
function termHtml({ coef, idx }) {
  if (coef === 0) return '0';
  const sign = coef < 0 ? '−' : '';
  return idx.length ? `${sign}e<sub>${idx.join('')}</sub>` : `${sign}1`;
}

export function mountBladeLab(el, opts = {}) {
  el.classList.add('lab', 'lab-blades');

  const own = document.createElement('input');
  own.className = 'bl-own';
  own.type = 'text';
  own.inputMode = 'numeric';
  own.maxLength = MAX_INDICES;
  own.spellcheck = false;
  own.value = (opts.indices || '01123').replace(/[^0-3]/g, '').slice(0, MAX_INDICES);
  own.addEventListener('keydown', (e) => e.stopPropagation());   // keep reveal.js from paging away
  own.addEventListener('input', () => {
    own.value = own.value.replace(/[^0-3]/g, '').slice(0, MAX_INDICES);
    load();
  });
  const pickRow = document.createElement('div');
  pickRow.className = 'bl-picks';
  const ownE = document.createElement('span');
  ownE.className = 'bl-own-e';
  ownE.textContent = 'e';
  // what the typed indices mean, = e0e1e1e2e3, hung off the right of the
  // box so the box stays put as it grows
  const meaning = document.createElement('span');
  meaning.className = 'bl-meaning';
  const ownWrap = document.createElement('span');
  ownWrap.className = 'bl-own-wrap';
  ownWrap.append(ownE, own, meaning);
  pickRow.appendChild(ownWrap);
  el.appendChild(pickRow);

  const board = document.createElement('div');
  board.className = 'bl-board';
  el.appendChild(board);


  // the term now, and the move that made it (for the animation)
  let state, move, before;

  function load() {
    state = { coef: 1, idx: [...own.value] };
    meaning.innerHTML = own.value ? `= ${state.idx.map((i) => `e<sub>${i}</sub>`).join('')}` : '';
    move = before = null;
    render();
  }

  function play(m) {
    before = state;
    move = m;
    state = applyMove(state, m);
    render();
  }

  function tile(parent, value, cls = '') {
    const t = document.createElement('span');
    t.className = `bl-tile bl-i${value} ${cls}`;
    t.textContent = value;
    parent.appendChild(t);
    return t;
  }

  function render() {
    board.textContent = '';
    // the term as plain text, for lab-selftest.html to read
    el.dataset.term = own.value ? termHtml(state).replace(/<\/?sub>/g, '') : '';
    if (!own.value) return;

    const eq = document.createElement('span');
    eq.className = 'bl-eq';
    eq.textContent = '=';
    board.appendChild(eq);

    const coef = document.createElement('span');
    coef.className = 'bl-coef';
    coef.textContent = state.coef === 0 ? '0' : state.coef < 0 ? '−' : '';
    if (move?.kind === 'swap' || state.coef === 0) coef.classList.add('bl-flip');
    board.appendChild(coef);

    const e = document.createElement('span');
    e.className = 'bl-e';
    e.textContent = state.coef === 0 || !state.idx.length ? (state.coef === 0 ? '' : '1') : 'e';
    board.appendChild(e);

    // the indices sit low, as the subscript of the e
    const sub = document.createElement('span');
    sub.className = 'bl-sub';
    board.appendChild(sub);

    if (state.coef === 0) {
      // 00: every tile goes, not just the pair
      before.idx.forEach((v) => tile(sub, v, 'bl-pop'));
      return;
    }

    // Rebuild the row, slotting the pair that just popped back in where it
    // was so it can be seen to go.
    const row = state.idx.map((v) => ({ v, live: true }));
    if (move?.kind === 'pop') row.splice(move.i, 0, { v: before.idx[move.i], live: false }, { v: before.idx[move.i], live: false });
    let live = -1;
    row.forEach((r) => {
      if (!r.live) { tile(sub, r.v, 'bl-pop'); return; }
      live += 1;
      const swapped = move?.kind === 'swap' && (live === move.i || live === move.i + 1);
      tile(sub, r.v, swapped ? 'bl-swapped' : '');
      // the button between this tile and the next live one
      const i = live;
      if (i + 1 < state.idx.length) {
        const match = state.idx[i] === state.idx[i + 1];
        const g = button(sub, match ? '✸' : '⇄', () => play({ kind: match ? 'pop' : 'swap', i }));
        g.className = `bl-gap ${match ? 'bl-gap-pop' : ''}`;
        g.title = match ? 'pop' : 'swap';
      }
    });
  }

  load();
}
