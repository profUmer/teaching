/*
 * lab-core.js - shared plumbing for the interactive slide demos.
 *
 * Everything here is deliberately framework-free: a lab is a <div> in a .qmd,
 * and these helpers turn it into a canvas with a control panel. The per-topic
 * labs live in transform-lab.js and vector-lab.js and draw through draw2d.js;
 * labs.js wires them to the markup.
 */

/* ------------------------------------------------------------------ colours */

export const C = {
  grid:      0xdfe3e8,
  axis:      0x6c757d,   // dark enough to read from the back of a lecture room
  ghost:     0xc3c8ce,
  shape:     0x8d1b1b,   // beamer "beaver" dark red, to match the old decks
  shapeFill: 0x8d1b1b,
  basisX:    0xc0392b,
  basisY:    0x1f6fb2,
  accentA:   0xc0392b,   // first draggable vector
  accentB:   0x1f6fb2,   // second draggable vector
  result:    0x1d7a4c,   // derived / resulting vector
  aux:       0xd4a017,   // construction lines
  handle:    0x22282e,
};

/* -------------------------------------------------------------- run loop --- */

/* Runs `frame` only while `el` is actually on screen. reveal.js hides inactive
   slides, so this also stops labs on other slides from burning cycles. */
export function runLoop(el, frame) {
  let visible = false;
  let raf = null;

  const tick = () => {
    raf = visible ? requestAnimationFrame(tick) : null;
    frame();
  };

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && raf === null) tick();
  }, { threshold: 0.01 });
  io.observe(el);

  return () => { visible = false; if (raf) cancelAnimationFrame(raf); io.disconnect(); };
}

/* ---------------------------------------------------------------- dragging --- */
/*
 * Pointer dragging for a set of world-space handles. Handles are plain
 * {x, y} objects mutated in place, so the lab just reads them each frame.
 */
export function makeDraggable(stage, handles, onChange) {
  const el = stage.canvas;
  let active = null;

  function pick(clientX, clientY) {
    const [wx, wy] = stage.toWorld(clientX, clientY);
    const tol = stage.unitsPerPixel() * 22;
    let best = null, bestD = Infinity;
    for (const h of handles) {
      const d = Math.hypot(h.x - wx, h.y - wy);
      if (d < tol && d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  el.addEventListener('pointerdown', (e) => {
    const h = pick(e.clientX, e.clientY);
    if (!h) return;
    active = h;
    // Capture is a nicety (it keeps the drag alive past the canvas edge), not a
    // requirement. Synthetic events have no real pointer to capture, so this
    // throws under test; never let that break an actual drag.
    try { el.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    el.classList.add('grabbing');
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (!active) {
      el.classList.toggle('over-handle', !!pick(e.clientX, e.clientY));
      return;
    }
    const [wx, wy] = stage.toWorld(e.clientX, e.clientY);
    active.x = wx; active.y = wy;
    if (active.constrain) active.constrain(active);
    onChange();
    e.preventDefault();
  });

  const release = (e) => {
    if (!active) return;
    active = null;
    el.classList.remove('grabbing');
    if (e.pointerId !== undefined && el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}

/* --------------------------------------------------------------- controls --- */

export function slider(parent, { label, min, max, step, value, format }, onInput) {
  const row = document.createElement('label');
  row.className = 'lab-slider';

  const name = document.createElement('span');
  name.className = 'lab-slider-name';
  name.innerHTML = label;

  const input = document.createElement('input');
  Object.assign(input, { type: 'range', min, max, step, value });

  // A typed number rather than a plain span: dragging is fast for a rough
  // position, typing is what you want for an exact one (theta = 90.00, not
  // whatever the thumb landed on). Reset to plain text so it still reads as
  // a label, not a form field, until focused (see .lab-slider-value:focus).
  const out = document.createElement('input');
  out.type = 'text';
  out.className = 'lab-slider-value';
  out.inputMode = 'decimal';
  out.autocomplete = 'off';
  out.spellcheck = false;
  out.size = 4;   // an <input>'s default (20) would otherwise widen the grid track

  const display = (v) => (format ? format(v) : v.toFixed(2));

  const sync = () => {
    const v = parseFloat(input.value);
    out.value = display(v);
    onInput(v);
  };
  input.addEventListener('input', sync);

  // Typing commits on blur (Enter just blurs) rather than per keystroke, so a
  // value mid-edit like "-" or "12." is not clobbered or clamped while it is
  // still being typed.
  function commitTyped() {
    const parsed = parseFloat(out.value);
    if (Number.isFinite(parsed)) {
      input.value = Math.min(max, Math.max(min, parsed));
      sync();
    } else {
      out.value = display(parseFloat(input.value));   // invalid text: revert
    }
  }
  out.addEventListener('blur', commitTyped);
  out.addEventListener('focus', () => out.select());
  out.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); out.blur(); }
    else if (e.key === 'Escape') { out.value = display(parseFloat(input.value)); out.blur(); }
  });

  row.append(name, input, out);
  parent.appendChild(row);
  sync();
  return { input, sync, get: () => parseFloat(input.value), set: (v) => { input.value = v; sync(); } };
}

export function button(parent, text, onClick) {
  const b = document.createElement('button');
  b.className = 'lab-button';
  b.type = 'button';
  b.textContent = text;
  b.addEventListener('click', onClick);
  parent.appendChild(b);
  return b;
}

/*
 * A row of words that can be dragged left-to-right to reorder, ending in "=" -
 * meant to sit directly above a matrixPanel so it reads as the equation the
 * matrix is the answer to. `items` is mutated in place: index 0 is whichever
 * word is currently leftmost, i.e. this is left-to-right *multiplication*
 * order, not application order - the caller decides what that means.
 * `label(key)` supplies each chip's text; `onChange(items)` fires once, after
 * a drop that actually changed the order.
 *
 * Pointer-based, like the canvas handles in makeDraggable: no HTML5
 * drag-and-drop, so touch and mouse behave the same and there is no
 * OS-level drag ghost to fight with. Unlike a canvas handle, a dropped chip
 * snaps into the nearest slot rather than tracking continuously, since a
 * ranking has no position between two slots to mean anything.
 */
export function orderChips(parent, items, label, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'lab-order';
  parent.appendChild(wrap);

  function render() {
    wrap.innerHTML = '';
    items.forEach((key, i) => {
      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'lab-order-sep';
        sep.textContent = '×';
        sep.setAttribute('aria-hidden', 'true');
        wrap.appendChild(sep);
      }
      const chip = document.createElement('span');
      chip.className = 'lab-order-chip';
      chip.textContent = label(key);
      chip.tabIndex = 0;
      chip.addEventListener('pointerdown', (e) => beginDrag(e, chip));
      wrap.appendChild(chip);
    });
    const eq = document.createElement('span');
    eq.className = 'lab-order-eq';
    eq.textContent = '=';
    wrap.appendChild(eq);
  }

  function beginDrag(e, chip) {
    if (items.length < 2) return;
    e.preventDefault();
    const chips = [...wrap.querySelectorAll('.lab-order-chip')];
    const startIdx = chips.indexOf(chip);
    const startX = e.clientX;
    const wrapLeft = wrap.getBoundingClientRect().left;
    // Slot centres in wrap-local coordinates, measured once before anything
    // moves - only the dragged chip is transformed during the drag, so its
    // neighbours' centres stay put until the reorder below rebuilds them.
    const centres = chips.map((c) => {
      const r = c.getBoundingClientRect();
      return (r.left + r.right) / 2 - wrapLeft;
    });

    chip.classList.add('dragging');
    // As in makeDraggable: capture is a nicety, not a requirement, and a
    // synthetic pointer (as the self-test uses) has nothing real to capture.
    try { chip.setPointerCapture(e.pointerId); } catch { /* not capturable */ }

    function move(ev) {
      chip.style.transform = `translateX(${ev.clientX - startX}px)`;
    }
    function end(ev) {
      if (chip.hasPointerCapture?.(ev.pointerId)) chip.releasePointerCapture(ev.pointerId);
      chip.removeEventListener('pointermove', move);
      chip.removeEventListener('pointerup', end);
      chip.removeEventListener('pointercancel', end);
      chip.classList.remove('dragging');
      chip.style.transform = '';

      const dropX = centres[startIdx] + (ev.clientX - startX);
      let target = startIdx, best = Infinity;
      centres.forEach((cx, i) => {
        const d = Math.abs(cx - dropX);
        if (d < best) { best = d; target = i; }
      });
      if (target !== startIdx) {
        items.splice(target, 0, items.splice(startIdx, 1)[0]);
        render();
        onChange(items);
      }
    }
    chip.addEventListener('pointermove', move);
    chip.addEventListener('pointerup', end);
    chip.addEventListener('pointercancel', end);
  }

  render();
  return { refresh: render };
}

export function fmt(v, dp = 2) {
  if (Math.abs(v) < 5e-3) return '0';
  return (Math.round(v * 10 ** dp) / 10 ** dp).toFixed(dp).replace(/\.?0+$/, '') || '0';
}

export function matrixPanel(parent) {
  const wrap = document.createElement('div');
  wrap.className = 'lab-matrix';
  const caption = document.createElement('div');
  caption.className = 'lab-matrix-caption';
  const grid = document.createElement('div');
  grid.className = 'lab-matrix-grid';
  const cells = [];
  wrap.append(caption, grid);
  parent.appendChild(wrap);
  return {
    // cells are grown to fit, so the same panel serves the 3x3 and 4x4 labs
    update(m, label) {
      caption.textContent = label;
      while (cells.length < m.length) {
        const c = document.createElement('span');
        grid.appendChild(c);
        cells.push(c);
      }
      for (let i = 0; i < m.length; i++) cells[i].textContent = fmt(m[i]);
    },
  };
}

/*
 * A labelled list of derived values - the worked-example steps beside a lab.
 * Rows are given as [html label, html value, optional css class].
 */
export function valuePanel(parent) {
  const wrap = document.createElement('div');
  wrap.className = 'lab-values';
  parent.appendChild(wrap);
  let built = 0;
  const rows = [];
  return {
    update(items) {
      while (built < items.length) {
        const row = document.createElement('div');
        row.className = 'lab-value-row';
        const k = document.createElement('span');
        k.className = 'lab-value-key';
        const v = document.createElement('span');
        v.className = 'lab-value-num';
        row.append(k, v);
        wrap.appendChild(row);
        rows.push({ row, k, v });
        built++;
      }
      rows.forEach((r, i) => {
        const item = items[i];
        r.row.hidden = !item;
        if (!item) return;
        r.k.innerHTML = item[0];
        r.v.innerHTML = item[1];
        r.row.className = 'lab-value-row' + (item[2] ? ' ' + item[2] : '');
      });
    },
  };
}

/* Formats a 2-vector the way the slides write it. */
export function vec(x, y, dp = 2) {
  return `[${fmt(x, dp)}, ${fmt(y, dp)}]`;
}
