# Project status and plan

Last updated: 2026-08-05

Where the Beamer → Quarto migration stands, what is decided, and what is still
open. [README.md](README.md) is the reference for using what exists;
[TUTORIAL.md](TUTORIAL.md) is the how-to. This file is the state of play.

**Start at [§8](#8-next-actions).** It carries the settled Physics 1 conversion
queue and the migration decisions that are the only thing still blocking it.

---

## 1. Done and working

Game Math 1's two decks are converted, and Physics 1's conversion has started —
`motion`, the first deck in the queue. All three render and are verified in a
browser. See §1.1 for what is left.

| | course | slides | demos | source |
| --- | --- | --- | --- | --- |
| Matrix Transformations | GAME 220 | 22 | 3 | `matrices.qmd` ← `../matrices/main.tex` |
| Math Review | GAME 220 | 39 | 4 | `vectors.qmd` ← `../vectors/main.tex` |
| Motion | GAME 105 | 18 | 4 | `motion.qmd` ← `../Game Physics 1/motion/main.tex` |

- **Quarto 1.10.18** installed via winget. `git` 2.45.2 and `gh` 2.32.1 present.
- **69 figures** converted EPS → SVG into `figs/` by `tools/eps2svg.sh`, of
  which 25 are actually referenced by the two decks (§3.9).
- **Interactive labs**, seven kinds: `2d` (matrices); `polar`, `add`, `dot`,
  `reflect` (vectors); `motion`, `accel` (motion) — **all drawn with Canvas 2D**
  (§2.1). Code is layered `lab-core.js` + `draw2d.js` → `lab-mount.js` →
  `transform-lab.js` / `vector-lab.js` / `motion-lab.js` → `labs.js`.
- **No third-party dependency at all.** three.js is deleted (§2.1); `assets/` is
  43 KB of source plus the 23 KB logo, and the decks still need no network in
  class.
- **`serve.cmd`** for presenting; **`lab-preview.html`** for tweaking demos;
  **`lab-selftest.html`** for regression checks (56 checks, all passing).
  It can be run headlessly, which is how each renderer conversion is gated:
  `python -m http.server 8000`, then
  `chrome --headless=new --enable-unsafe-swiftshader --virtual-time-budget=25000
  --dump-dom http://127.0.0.1:8000/lab-selftest.html` and read `#summary`.
- **`index.html`** landing page, now grouped by course, **`tools/make-deploy.ps1`**
  → `_deploy.zip` (11.5 MB), **`.gitignore`** — all ready for publishing.

  **The zip grew 8.2 → 11.5 MB for one 18-slide deck**, and none of it is the
  deck. Quarto gives every `.qmd` its own `*_files/` holding a private copy of
  reveal.js, MathJax and the fonts: measured, that is **6.9 MB / 113 files
  each**, byte-identical across `matrices_files`, `vectors_files` and
  `motion_files`, and ~3.3 MB of it survives compression. So every future deck
  costs ~3.3 MB whatever is on its slides, and the seven-deck Physics 1 course
  lands the bundle near 30 MB.

  Worth fixing before publishing, but it is a packaging change — a shared
  `_libs`, or letting `quarto publish` do the deduplication — not anything to do
  with the slides. It also only bites the **zip**: on GitHub Pages the browser
  caches one copy per file path, so a student downloads it once. Filed here so
  the growth is not mistaken later for the decks themselves getting heavy.
- **Rebranded to Humber Polytechnic (2026-08-05).** New logo at
  `assets/humber-logo.png` (1501 × 501, same 3:1 as the old one, so `110px` on
  the title slide is unchanged), replacing `figs/humberLogo.svg` — which was
  never vector anyway, just a 240 × 81 base64 PNG in an SVG wrapper. The logo
  moved to `assets/` rather than `figs/` because every course uses it and
  `figs/` is per-course and machine-generated. The wording changed with it:
  `institute:` in both decks and the `index.html` byline now read *Faculty of
  Media, Creative Arts, and Design, Humber Polytechnic* — the old *School of
  Media Studies & IT* is gone — and the `_quarto.yml` footer reads *Humber
  Polytechnic*. Verified: `quarto render` clean, 34/34 self-test, title slide
  eyeballed.

Two demos deliberately reproduce the printed worked examples so the algebra and
the demo agree on screen: `polar` starts at `[2,3]` → `3.61 ∠ 56.3°`, and
`reflect` uses the Peggle coordinates → `N̂ = [0.832, -0.555]`, `v_f = [-10, 50]`.

The seven near-identical "Vectors in Action" frames are now one slide with a
fragment flipbook.

### 1.1 What is not converted, and what is being taught

**Teaching Game Math 1 and Game Physics 1 in Fall 2026.** Math 1 still needs
content work; Physics 1 is stable but has no Quarto version at all. Physics 2 is
not taught this term.

Surveyed 2026-08-05. All three sets are Beamer with the same `beaver` colour
theme, so the pipeline carries over unchanged.

| course | code | source | decks | frames | figures | size | state |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Game Math 1 | GAME 220 | `../matrices`, `../vectors` | 2 | 51 | 69 | 57 MB | **converted** → 61 slides |
| Game Physics 1 | GAME 105 | `../Game Physics 1` | 7 | 103 | 38 | 101 MB | **1 of 7 converted** → `motion`, §1.3 |
| Game Physics 2 | GAME 158 | `../Game Physics 2` | 16 | 243 | 140 | 166 MB | Beamer only |

Math 1's 69 figures are the SVGs already converted, of which only 25 are
actually referenced (§3.9). Physics 1's 38 is figures **actually referenced by
`\includegraphics`**, not files on disk — see §1.2. Physics 2's 140 is EPS +
`.fig` on disk and will shrink the same way when it is looked at properly.

**346 unconverted frames.** That is the reason §8 converts in teaching order
rather than in bulk: week 12's deck is not needed in September.

Two things the survey turned up:

- **Physics 2's syllabus is the argument in §2.1 made concrete** —
  `10integration`, `10oscillations`, `11springsPendulums`,
  `08momentumAndCoefficientOfRestitution`, `09collisionResponse`, `13drag`,
  `14lift`, `15constraints`, `08separatingAxisTheorem` are almost exactly that
  section's list of physics that reads better flat. Canvas 2D holds for this
  course without qualification.
- **Physics 2's numbering collides** in two places (two `08`, two `10`), so the
  running order needs settling before folder names are fixed in a repo. And
  `08separatingAxisTheorem` is 12 raster images to 2 EPS, so it will convert
  differently from the rest, which are vector-heavy.

### 1.2 Physics 1 after the 2026-08-05 cleanup

`../Game Physics 1` was pruned to the decks actually being taught. **10 decks →
7, 149 frames → 103.** The three folders carrying notes-to-self
(`11collisions`, `12advancedCollisions`, `13matrixTransformations`) are gone,
which settles the second of §8's old blocking questions by deletion — and
`old - 04motionIn3d` and `09momentum` went with them.

The folder numbers were stripped in the cleanup, so the running order no longer
lives in the filenames. It is recorded here instead (confirmed 2026-08-05); this
is the conversion queue in §8:

| # | folder | frames | content |
| --- | --- | --- | --- |
| 1 | `motion` | 11 | position, displacement, distance, velocity, acceleration |
| 2 | `eqnsOfMotion` | 22 | the problem-solving method; horizontal, vertical, 2D projectile |
| 3 | `newtonsLaws` | 9 | inertia, *F = ma*, weight vs mass, action–reaction |
| 4 | `forces` | 20 | normal force, friction, free-body diagrams, car motion |
| 5 | `drag` | 8 | viscous drag, laminar vs turbulent flow |
| 6 | `gravity` | 9 | universal gravitation, Cavendish, measuring Earth's mass |
| 7 | `staticCollisions` | 24 | reflection off fixed surfaces — **mostly done already, see below** |

**`staticCollisions` is already half-converted**, which the earlier survey
missed because it counted folders rather than frame titles. Those titles are
verbatim the second half of Math 1's `vectors.qmd`: *The Dot
Product*, *The Dot Product — Polar and Cartesian format*, *Normalising Vectors*,
four *Collision with Non Axis Aligned Object* frames, the worked examples, and
both Classwork/Answers pairs. **13 of its 24 frames exist as slides today**, and
the `reflect` lab with the Peggle numbers is the demo for exactly this material.
What is genuinely new is the first third — *Collisions*, *Collision with a
Stationary Object* ×2, the axis-aligned worked example, *Straight Lines — a
quick review*, *Perpendicular Lines* and its example, plus that classwork pair:
**~11 frames.** Same story in the figures: 7 of its 9 referenced EPS are already
SVGs in `figs/`; only `perp.eps` and `pool.eps` are new.

That makes the deck a *reuse* job, not a conversion job, and it raises a real
question for §3.3 and §4 — whether the shared material lives once in `math-1/`
and `physics-1/` links to it, or is duplicated so each course's deck stands
alone. Duplication is the safer default for a lecture (nobody wants to
cross-navigate mid-class), but it means two copies to keep in sync.

**Figure work for the whole course is small: 38 unique referenced figures.**
7 are already SVGs from Math 1, 7 are PNGs used as-is (`motion`'s six graph
screenshots plus `motionQ2.png`), leaving **24 EPS to convert**. That is a third
of the 78 the first survey counted, because most of what is on disk is not used.

**Each folder still carries files the decks do not reference** — confirmed, and
it matters for §3.7 rather than for conversion. Of 101.4 MB / 213 files:

| | size | note |
| --- | --- | --- |
| build output | 56.4 MB | `.ps` alone is 44 MB; plus `.dvi .aux .log .nav .out .snm .toc .fls .fdb_latexmk .synctex.gz` and 33 `*-eps-converted-to.pdf` |
| stray compiled PDFs | 5.2 MB | 11 of them, several under old names — `game220-07newtonsLaws.pdf`, `game220-11collisions2D.pdf`, `11collisions2D.pdf`, and `staticCollisions/game220finalWritten -  see question 5.pdf`, which is an **exam paper** and must not be committed |
| assignments | 4.2 MB | 4 `.docx` + `.pdf` pairs, published as PDFs (§5) |
| genuine source | **35.6 MB** | `.tex`, `.eps`, `.fig`, `.png` — 85 files |

About 23 of the source images are unreferenced (`matchStick.eps`,
`riflebullet.eps`, `shuttleLaunch.eps`, `chair.eps`, `newtonCannon.eps`,
`parachute.eps`, `derivatives1–3.eps`, `workQ1.eps`, …). They are dropped
material rather than junk, so §3.7's rule — commit source, ignore build output —
keeps them, and §3.9's rule — convert only what is referenced — skips them.

**The logo in the Beamer sources is broken in three different ways**, which is
worth knowing before anyone tries to rebuild a PDF from them: `drag`,
`eqnsOfMotion`, `forces`, `motion` and `newtonsLaws` want `../humberLogo.eps`
(nothing there), `gravity` wants it five levels up (which *does* resolve, to the
OneDrive root), and `staticCollisions` wants it four levels up (nothing there).
A stale copy sits in `drag/`. The Quarto side does not inherit any of this — see
§1 for the replacement.

**Physics 1 assignments** exist in `../Game Physics 1/Assignments`: four
`.docx` + `.pdf` pairs (Connect4, FallingFlappy, FlingingFlappy `w26`;
GravityWell `w25`). See §5 — these should be published as PDFs, not converted.
They are marked winter, so dates need a pass before a fall offering.

### 1.3 `motion` as built (2026-08-05)

Deck 1 of the §8 queue. **11 Beamer frames → 18 slides, and zero figures.**

The six PNGs it ran on were all the same graphing-tool screenshot of A = (1, 2)
and B = (−1, 1) with one more thing drawn each time — the point, then both
points, then the displacement arrow, then a distance label, then velocity, then
speed. One lab with a `data-show` level replaces all six, so the deck converted
without a single figure needing to exist. That is the same move the "Vectors in
Action" flipbook made, and it is worth looking for in every remaining deck.

| file | change |
| --- | --- |
| `motion.qmd` | new — 18 slides, 4 lab mounts, per-deck `footer:` override |
| `assets/motion-lab.js` | new — `motion` (position/displacement/velocity) and `accel` |
| `assets/lab-mount.js` | new — stage, panel, dragging, resize, run loop, lifted out of `vector-lab.js` |
| `assets/vector-lab.js` | 286 → 228 lines: mounting gone, all four modes untouched |
| `assets/draw2d.js` | `text` shape kind + `label` primitive + a `label` layer |
| `assets/labs.js` | dispatches `motion`/`accel`; passes `data-show` and `data-t` |
| `assets/slides.css` | drag cursor and `touch-action` rules extended to `.lab-motion` |
| `lab-selftest.html` | +22 checks, 34 → 56 |
| `index.html`, `tools/make-deploy.ps1` | the deck is listed and shipped |

**Both labs pin the deck's printed numbers**, as `polar` and `reflect` do:
A = [1, 2], B = [−1, 1], t = 2 s gives displacement [−2, −1], distance 2.24 m,
velocity [−1, −0.5] m/s, speed 1.12 m/s; `accel` starts from rest at
[62.5, 22] m/s over 10 s for [6.25, 2.2] m/s². All asserted in the self-test.

Three things worth carrying forward:

- **`lab-mount.js` was forced by the second consumer, not planned.** §2.1 step 4
  says to split when a real second lab arrives rather than guess a seam. What
  the second lab actually needed was the *mounting* half — stage, panel, drag,
  resize — not the renderer half. The renderer question stays open; see below.
- **The self-test still cannot see the drawing, and it mattered here.** 56/56
  green while two labels sat on top of an arrowhead and the acceleration arrow,
  and while the slider's "10.0 s" wrapped onto two lines. All three were found
  by looking at a screenshot, exactly as step 1's lesson predicted.
- **Reveal's `#/n` does not address these decks.** A `#` section becomes a
  horizontal stack with its `##` slides *vertical* inside it, so a lab slide is
  `#/2/5`, not `#/13`. Useful when screenshotting a specific slide headlessly.

**§2.1 step 4 is still open and should stay open.** Both new labs are
quasi-static — they recompute on a drag or a slider, never on a clock — so
`runLoop` was not stretched at all. `eqnsOfMotion` and its projectile motion is
still the deck that answers it.

---

## 2. Decisions made

- **Quarto + reveal.js**, not Beamer. The maths carries over untouched; the
  interactivity is the whole point.
- **Never depend on a CDN** — a lecture must not depend on classroom wifi.
  Anything third-party is vendored. (This is why three.js was vendored; §2.1
  now removes the dependency outright.)
- **Keep an algebra slide beside every lab.** The demo builds intuition, the
  algebra is what is examinable, and the algebra is what survives to a handout.
- **One shared `assets/`** for all courses, because the lab framework is real
  shared infrastructure that Math 2 and Physics 1–3 will reuse.
- **Folder names carry the subject, not the course code** (decided 2026-08-05):
  `math-1`, `math-2`, `physics-1`, `physics-2`, `physics-3`. Codes get
  renumbered; the folder name is in the URL, so a renumber would break every
  link already handed to students. Subject names also sort and scan better in a
  five-course repo.

  The counter-argument in the old §3.4 was that students search by code. That is
  still served — put the code in the **deck title and front matter**, which is
  what search indexes and what shows on screen, and keep it out of the path.
  Both benefits, no rename risk.
- **The lab maths stays an independent implementation**, deliberately *not* a
  port of the C++ `VMath`/`MatrixMath` from `Simplify/math1_f2026_draft_2`.
  Sharing one implementation would mean both sides give the same wrong answer
  when it is wrong. Two implementations agreeing on the same hand-worked numbers
  is a real check on the C++ library; that is worth more than matching names.
  To cash it in, pin the same worked examples on both sides — `lab-selftest.html`
  already asserts them in JS, so the missing half is `assert`s in the SDL project.

### 2.1 Renderer: Canvas 2D for the 2D courses

**Done as of 2026-08-05.** Game Math 1 and Game Physics 1 are entirely 2D, so
the `3d` transform lab was removed, taking three.js to zero consumers — deleted
rather than kept for one slide. The rest of this section is the reasoning, kept
because it is the standing argument for what future courses should do.

The 2D labs never really used it. They draw grids, arrows and dashed
construction lines — and because WebGL will not stroke a line with a width
(`lab-core.js:30`), roughly 110 lines (`pushQuad`, `strokeGeometry`,
`dashedGeometry`, `fromPositions`) exist purely to rebuild every stroke as pairs
of triangles. Canvas 2D does all of it with `ctx.lineWidth` and
`ctx.setLineDash`, and `layer()`'s manual `geometry.dispose()` bookkeeping and
`makeRenderer`'s `preserveDrawingBuffer` hack both disappear with it.

Two further reasons, in order of weight:

1. **It is the same drawing model the course teaches.** Canvas 2D is immediate
   mode — set a transform, draw, clear, draw again — which is `Scene0::Render`,
   not three.js's retained scene graph. The world→pixel `setTransform` in
   `draw2d.js` is literally `metresToPixelsMatrix`: a scale with a negative y,
   then a translate to put the origin back.
2. **The renderer stops being the foundation.** A black box nobody on the
   project fully understands should not be the thing every future lab is built
   on, and §4 has four more courses landing on this same `assets/`.

**A 3D course does not automatically mean three.js.** Most physics demos read
better flat — integrators, springs, restitution, impulse, friction, collision
response are all clearer as a 2D diagram with numbers beside the formula than as
a perspective scene. The genuinely 3D topics are narrow: orientation and
quaternions, projection and camera.

**Math 2 (3D ray tracing) is the strongest case for Canvas 2D, not against it.**
A ray tracer is per-pixel: compute a colour, write it to a buffer. In a browser
that is `ctx.createImageData()` / `putImageData` — a Canvas 2D context used as a
framebuffer. three.js would render the scene by *rasterization*, which is
precisely the technique the course exists to contrast with, so putting a
rasterizer on the slide would undercut the lesson. The three demo shapes that
course needs are all Canvas 2D:

- **the rendered image** — `ImageData`, per pixel, the ray tracer itself;
- **ray/sphere and ray/plane intersection** — clearest as a flat cross-section
  diagram, which is exactly the vector drawing `draw2d.js` already does;
- **camera, viewport and pixel grid setup** — 2D diagrams.

One practical caveat to plan for: a JS tracer on the main thread is slow at full
resolution. Render small (≈160×120) and let CSS scale it up, and trace
progressively so the image visibly fills in — which is better as a lecture demo
than a finished frame appearing at once. (`Simplify/rayWorkshop_w2027_draft`
exists and should be read before this course's labs are designed.)

So Canvas 2D is likely the majority of the labs across *all five* courses. Do
not re-vendor three.js until a specific lab genuinely needs an interactive
perspective scene — by then it will be several versions past the r160 currently
in `assets/`.

Target once the conversion is done — the renderer becomes a leaf, not the base:

```
assets/
  lab-core.js    run loop, drag, panel, readouts          <- no renderer, all courses
  lab-mount.js   stage + panel + wiring for a mode table  <- exists as of 2026-08-05
  draw2d.js      Canvas 2D: shapes, and ImageData for     <- Math 1 & 2, Physics 1,
                 the ray tracer                              most of Physics 2 & 3
  draw3d.js      three.js                                 <- only if a 3D lab appears
```

`lab-mount.js` was not in the original sketch. It appeared when Physics 1's
first lab needed the same stage-and-panel scaffolding vector-lab.js had grown
privately (§1.3) — which is the split step 4 asks for, arriving at the mounting
layer rather than the renderer one.

Order of work, each step gated on `lab-selftest.html` staying green (its checks
read *numbers from the readout panel*, not pixels, so they survive a renderer
swap unchanged — that is what makes this a refactor rather than a rewrite):

1. **Convert `dot` as a proof — done (2026-08-04).** See below.
2. **Convert the remaining 2D labs — done (2026-08-05).** See below.
3. **Delete three.js — done (2026-08-05).** See below.
4. Split the renderer-agnostic half of `lab-core.js` out — *after* the 2D API has
   settled from real use, or the seam will be in the wrong place. Wait for the
   first Physics 1 lab; five labs that all draw arrows on a grid are not enough
   variety to place the seam confidently. **That is now a named deck:**
   `eqnsOfMotion`, second in the queue (§8), whose projectile-motion frames are
   the first thing in either course that wants a clock.

   **The specific question step 4 has to answer: every lab so far is
   quasi-static.** The four vector labs recompute on drag; the transform lab
   animates only on a fixed 0.9 s `Play`. `runLoop` was built for exactly that.
   A physics demo — projectile motion, Euler vs Verlet, drag, restitution — is a
   *time-stepping simulation*: fixed timestep, play/pause/step/reset, divergence
   visible over time. If `lab-core.js` hosts that without contortion the seam is
   right; if it does not, the first integrator lab shows exactly where it
   belongs. Do not guess this in advance — it costs one deck to find out, and
   that deck has to be converted anyway.

#### Step 1 as built

| file | change |
| --- | --- |
| `assets/draw2d.js` | new — stage, primitives, painter (~200 lines) |
| `assets/vector-lab.js` | mount split into `mountCanvas` / `mountWebGL` + shared `wire()` |
| `assets/lab-core.js` | 2 lines — `runLoop` tolerates a null renderer; `makeDraggable` accepts either stage |

**The mode definitions were not touched.** `draw()` already returned a
declarative list of shapes, so that was the seam already sitting there —
`paint()` is simply a second consumer of it. That is why the conversion is
small, and it is the reason to convert modes one at a time rather than rewrite.

Verified: 29/29 self-test green; renderer identity confirmed per lab
(`polar: webgl | add: webgl | dot: canvas2d`) rather than inferred from the
numbers; visual A/B against the two labs still on three.js; a 2× device-pixel-
ratio run, because headless is dpr = 1 and never exercises that path; all 8 labs
in `lab-preview.html` mounting with zero `lab-failed`.

Three things to carry into step 2:

- **The self-test cannot see pixels.** Reading numbers out of the readout panel
  is exactly what lets it survive a renderer swap, and exactly why it cannot
  confirm the drawing. Every conversion needs a look at the picture too.
- **Confirm which renderer actually drew the lab.** Green checks pass either
  way. `canvas.getContext('2d')` returns null on a canvas already holding a
  WebGL context, which is a reliable discriminator to assert in a scratch page.
- **One deliberate visual change:** the grid is 1 CSS pixel rather than the 1
  device pixel the WebGL `LineSegments` drew, since a single device pixel is too
  faint on a projector. On a HiDPI screen the grid reads slightly heavier.

#### Step 2 as built

`polar`, `add` and `reflect` were the one-word edit to `CANVAS_MODES` the plan
predicted — `draw2d.js` needed no new primitives, and `arc` and `fillShape`
worked first time.

**The `2d` transform lab was the real work, and step 2 had missed it.** It is a
2D lab on three.js, so three.js could never have reached zero consumers without
it. It did not have the display-list seam the vector modes had — it wrote
geometry straight into five persistent `THREE.Mesh` layers — so it needed a
genuine port rather than a flag:

| file | change |
| --- | --- |
| `assets/vector-lab.js` | `CANVAS_MODES` now holds all four modes |
| `assets/transform-lab.js` | `mountLab2D` rewritten onto `makeStage2D`; scene/camera/mesh-layer setup (~45 lines) replaced by a `rebuild`/`paint` pair; local `rad`/`clamp` replace `THREE.MathUtils` |
| `lab-selftest.html` | +5 renderer-identity checks, 29 → 34 |

Two things worth keeping in mind:

- **`frame()` now early-returns when nothing changed.** Canvas 2D holds the last
  frame, so an idle lab costs nothing; the WebGL path re-rendered every tick
  regardless. All four state-mutating paths (sliders, order swap, Play, resize)
  set `dirty`, so there is no fifth way for the canvas to go stale.
- **The renderer check is now in the self-test, not a scratch page.** Step 1's
  lesson was that green numbers pass either way; asserting
  `canvas.getContext('2d') !== null` per lab makes a silent fallback to WebGL a
  failing check rather than something to remember to look for.

Verified: 34/34 green at dpr 1 *and* dpr 2; all 8 labs mounting in
`lab-preview.html` with zero `lab-failed`; a pixel A/B of the four vector labs
against the WebGL path — 19 of 2.34 M pixels differ by more than a third of a
channel, all stroke antialiasing; the transform lab eyeballed against its own
matrix readout; and the Play animation checked on the real clock (109 distinct
frames over ~1.8 s, settling back to the exact starting image). That last one
needs real time — headless Chrome's `--virtual-time-budget` fast-forwards
`setTimeout` but *not* `performance.now()`, which freezes `progress` at 0 and
makes the animation look broken when it is not.

#### Step 3 as built

three.js is gone. `assets/` went from **1352 KB to 43 KB** of source.

| file | change |
| --- | --- |
| `assets/three.module.js`, `assets/OrbitControls.js` | deleted |
| `assets/lab-core.js` | 430 → 213 lines: the geometry builders, `makeRenderer`, `makeScene2D` and `layer` all go; `runLoop` loses its `renderer` argument and `makeDraggable` its WebGL branch |
| `assets/transform-lab.js` | 355 → 252 lines: `mountLab3D` deleted |
| `assets/vector-lab.js` | 351 → 286 lines: `mountWebGL`, `toGeometry`, `mergeGeometries` deleted |
| `assets/head.html` | import map gone; one `<script type="module">` left |
| `assets/labs.js`, `assets/slides.css` | `3d` branch and `.lab-3d` rules gone |
| `matrices.qmd` | the "same idea in 3D" slide removed — 23 → 22 slides |
| `lab-preview.html`, `lab-selftest.html` | import maps gone; preview loses its 3D section |

**The predicted saving was wrong, and worth correcting for next time.** Step 3
said `_deploy.zip` would drop ~1.3 MB of 8.4. The *uncompressed* bundle did drop
1.31 MB, but the zip only went **8.45 → 8.19 MB**: three.js is unminified source
and compresses about 5×, so its real contribution to the download was ~0.25 MB.
The bundle is dominated by SVG figures (5.8 MB) and reveal.js's own JavaScript
and fonts, not by anything the labs pull in. Deleting three.js was worth doing
for the reasons in §2.1 — it was never going to be worth much in bytes.

Verified after deletion: 34/34 self-test green at dpr 1 and dpr 2; all 7 labs in
`lab-preview.html` with zero `lab-failed`; `quarto render` clean; zero
`importmap` or `three` references left in the rendered decks; `matrices.html`
still exports its labs through `?print-pdf`.

---

## 3. Open decisions

Nothing below is blocked on anything else — these are calls to make.

### 3.1 Move out of OneDrive?  *(recommended: yes)*

Proposed home: **`C:\dev\teaching`** — 16-character root instead of 74, no
spaces, outside OneDrive.

Reasons, in order of how concrete they are:

1. `tools/eps2svg.sh` carries a temp-directory workaround that exists *only*
   because Ghostscript refuses paths containing spaces, and the space is in
   `OneDrive - Humber College`.
2. Git inside OneDrive is a known bad pairing — `.git/` churns constantly and
   OneDrive can drop "conflicted copy" files inside it.
3. Every `quarto render` rewrites **230 files / ~16 MB**, which OneDrive
   re-uploads each time. `.gitignore` already excludes exactly that output.
4. Humber's tenant owns that OneDrive; a personal GitHub account outlives the
   role.

Honest counterweight: GitHub only protects what is **committed and pushed**.
OneDrive is continuous and needs no discipline. Mitigation is committing at the
end of each prep session.

*Not* reasons — both re-measured 2026-08-05 and fine:

- **Path length improves, it does not degrade.** Worst case today is 187 of 260;
  after the move it is **140**. The restructure does add a folder level, but the
  root shrinks from 74 characters to 15, so it nets −47. (Earlier drafts of this
  section worried it added ~14. It does; the root loses far more.)
- **0 cloud-only files**, so nothing is dehydrated.
- **No CDN dependency in the rendered decks.** Checked every external `src`/
  `href` in `matrices.html` and `vectors.html`: MathJax and reveal.js are
  vendored by Quarto. The only outbound URLs are two *content* links in
  `vectors.qmd` — a PhET page and a YouTube video. They are clickable, not
  load-time, but they are the one thing in a lecture that still needs wifi.

### 3.2 Repo layout and URL

Project repo `teaching` → `https://<user>.github.io/teaching/math-1/vectors.html`.
Using the `<user>.github.io` user-site repo instead drops the `/teaching/` and
shortens every URL handed to students — only if that slot is free.

With §3.4 settled, these paths are now stable enough to hand out: nothing in
them changes when a course is renumbered.

### 3.3 Publish the answers?

All hosting options are public and the decks contain the classwork answer
slides. If that is not wanted, split answers into a separate deck and publish
only the lecture half.

### 3.4 Course naming  *(resolved 2026-08-05 — see §2)*

Folder names are `math-1`, `physics-1`, … with no course code. Rationale in §2.

What is **still open** is the deck *titles*. `matrices.qmd` and `vectors.qmd`
are titled *GAME 220 — Game Dynamics 1*, but the course is being called *Game
Math 1*. Since the code now lives in the title rather than the path, the title
is what students search on, so it should carry both — something like
*GAME 220 · Game Math 1*. Known codes: **GAME 220** Math 1, **GAME 105**
Physics 1, **GAME 158** Physics 2 (the latter two came from the 2026-08-05
survey). Math 2 and Physics 3 codes are still unknown.

### 3.5 Git identity

`git config --global user.email` is `umer.noor@humber.ca`. Unless that address
is registered on the GitHub account, commits will not attribute to the profile —
and it dies with the job. Consider a personal address for this repo.

---

The five below were found on 2026-08-05 while checking what the migration would
actually surface. They are ordered by how hard each is to undo *after the first
push*, because git history is permanent and a public repo is a different posture
from a classroom.

### 3.6 Third-party imagery, and a licence

The LaTeX sources carry `Ogre3D_1.7_BeginnersGuide_cover.jpg`, `ogreLogo.jpg`,
`mathBook.jpg` and `humberlogo.jpg`. None are referenced by the `.qmd` decks, so
committing the sources **publishes them without displaying them**. They are 4–11
KB thumbnails in textbook-citation use, which is about as defensible as it gets,
but it is a call to make deliberately rather than discover later. Separately,
`phetVectorAddition.svg` *is* used in `vectors.qmd`; PhET is CC BY, so it needs
an attribution line.

**Physics 1 adds two that are actually displayed**, which is a different posture
from an unreferenced thumbnail: `marioIce.eps` (a Mario screenshot, illustrating
low friction) is on a `forces` slide, and `motion` runs on six PNG screenshots
(`position`, `positions`, `displacement`, `distance`, `velocity`, `speed`) whose
provenance should be checked before they are pushed to a public repo. Also in
the folders but unreferenced: `physicsEngine.png`/`.eps`, `popeyeForceDiagram.eps`,
`newtonApple.eps`, `IsaacNewton.eps`, `cavendish.eps`, `earth-moon.eps` —
mostly public-domain artwork, but worth one pass rather than a discovery later.

**The exam paper is the one that is not a judgement call.**
`staticCollisions/game220finalWritten -  see question 5.pdf` must be excluded
before commit one, not pruned afterwards — git history is permanent.

There is no LICENSE file. Suggestion: dual-license — code (`assets/`, `tools/`)
MIT, slides and figures CC BY-NC-SA — with a NOTICE carving out third-party
marks and book covers. A repo containing someone else's logo cannot be cleanly
licensed without that carve-out.

Related: if §3.3 lands on "do not publish the answers", note that GitHub Pages
from a **private** repo needs a paid plan. On a free account the realistic
options are splitting the answers into a separate unpublished deck, or paying.

### 3.7 How much of the LaTeX sources to commit

`../matrices` + `../vectors` is 55 MB, of which **21.5 MB is build output**:
`main.ps` alone is 15 MB across the two, plus compiled PDFs, 27
`*-eps-converted-to.pdf`, and `.aux/.log/.nav/.out/.snm/.toc/.synctex.gz/.dvi/
.fig.bak`. `.gitignore` currently has no LaTeX rules at all. The Physics folders
carry even more (`.fdb_latexmk`, `.fls`, and a `main-DESKTOP-NA4JN0C.log` from
another machine).

Recommendation: commit the 33.9 MB of genuine source only. One oddity worth a
look first — `matrices/rhrule.eps` is **20.2 MB by itself**, 60% of what remains,
and is not used by either Quarto deck.

Physics 1 measures the same way after its cleanup — **35.6 MB of source in
101.4 MB of folder** — with the breakdown in §1.2. Two additions to the ignore
list fall out of it: `main-DESKTOP-NA4JN0C.log` (present in `motion` and
`eqnsOfMotion`, already covered by `*.log`), and the 11 stray compiled PDFs,
which `*.pdf` cannot blanket-ignore because the four assignment PDFs *are* being
published. Ignore them by path, or move the assignment PDFs into
`physics-1/assignments/` first and ignore `*.pdf` everywhere else.

### 3.8 `.gitattributes` — and this one actually bites

New Windows repo with autocrlf on: `tools/eps2svg.sh` gets CRLF and breaks under
bash, and EPS files with binary preview sections can be corrupted by text
normalization. Needs `* text=auto`, `*.sh text eol=lf`, `*.cmd text eol=crlf`,
`*.eps binary`, `*.fig binary` — **before commit one**, or it is a re-normalize
later.

### 3.9 Prune the unused figures

**44 of the 69 SVGs in `figs/` are unreferenced** — 1.9 MB of 3.2 MB — and
`make-deploy.ps1` copies all of `figs/`, so students currently download them.
The EPS originals stay in the repo and `tools/eps2svg.sh` regenerates on demand,
so pruning to the 25 in use costs nothing.

(It was 43 of 69 before the logo swap; `humberLogo.svg` joined the unreferenced
pile when the title slides moved to `assets/humber-logo.png` — §1.)

**Expect to un-prune three of them.** `linear.svg`, `vectorReflection.svg` and
`vectorReflectionQ1.svg` are unreferenced by the Math 1 decks but *are* used by
Physics 1's `staticCollisions` (§1.2), so converting deck 7 puts them back.
That is not an argument for keeping them — regenerating is one command — just a
reason not to be surprised, and a reminder that the prune is worth re-running
after each course lands rather than treated as a one-off.

### 3.10 Where the course footer lives

`_quarto.yml` hardcodes `footer: "GAME 220 · Game Dynamics 1 · Humber
Polytechnic"` globally, along with `author`. §4's layout needs that in
per-course `_metadata.yml`.

Now that §3.4 keeps codes out of folder names, the footer and title are where
the code lives — so this is the same wording decision as the deck titles in
§3.4, and worth settling once for both.

**A second course now exercises this.** `motion.qmd` sets its own
`footer:` in a document-level `format: revealjs:` block, which overrides
`_quarto.yml` and leaves every other option (theme, css, head include) merged in
from the project. It renders correctly, so the per-course footer works today
without waiting for the `_metadata.yml` restructure — that just moves the same
override up one level.

**Half of this is now settled.** The institution wording was fixed on
2026-08-05 with the rebrand (§1): *Faculty of Media, Creative Arts, and Design,
Humber Polytechnic* in `institute:` and `index.html`, *Humber Polytechnic* in
the footer. What is still open is the course half — `GAME 220 · Game Dynamics 1`
in both the title and the footer, when the course is being called **Game
Math 1**.

---

## 4. Target structure

One repo, one Quarto project, courses as top-level folders.

```
teaching/                      <- one GitHub repo
  _quarto.yml                  <- theme, footer, revealjs defaults
  index.html                   <- landing page, all courses
  assets/                      <- lab framework + theme (SHARED, see 2.1)
  tools/                       <- eps2svg.sh, make-deploy.ps1
  lab-preview.html
  lab-selftest.html

  math-1/                      <- converted, ready to move
    _metadata.yml              <- per-course footer/title
    index.qmd
    vectors.qmd
    matrices.qmd
    figs/
  math-2/                      <- nothing yet; 3D ray tracing
  physics-1/                   <- Beamer only; 7 decks, taught Fall 2026
    _metadata.yml
    index.qmd
    motion.qmd                 <- fills in over the term, in queue order (§8)
    …                             eqnsOfMotion, newtonsLaws, forces,
    …                             drag, gravity, staticCollisions
    figs/
    assignments/               <- 4 PDFs, published as-is (§5)
  physics-2/                   <- Beamer only; 16 decks, not taught this term
  physics-3/                   <- assignment instructions exist, no slides
    index.qmd
    assignments/
```

Subject names, no course codes — §2, decided 2026-08-05. A course folder needs
no slides: `index.qmd` plus `assignments/` is a complete course, and slides can
be dropped in later without restructuring — which is exactly how `physics-1`
will fill up over the term (§8).

**Five courses, not four** — Math 2 (3D ray tracing) is now expected as well.
It does not change the structure, but it does change the renderer plan: see
§2.1, where it is the strongest argument *for* Canvas 2D rather than against.

---

## 5. Constraints the plan has to respect

All of these were tested, not assumed.

| Constraint | Detail |
| --- | --- |
| **Decks must be served over http** | `file://` blocks ES modules (CORS, opaque origin). The slide still renders with a blank gap where the lab should be and **no visible error**. Hence `serve.cmd`. |
| **Single-file HTML is not an option** | `embed-resources: true` cannot inline ES modules and **silently drops the lab JavaScript entirely** — output keeps the `lab-mount` divs and zero lab code. Chalkboard also refuses self-contained output. Sharing therefore means hosting. Note this is *not* fixed by dropping three.js (§2.1): the lab code is itself ES modules, so the constraint survives the deletion. |
| **Every deck exactly one directory deep** | Assets are referenced document-relative. In `math-1/`, `./assets/` resolves wrongly and everything breaks (theme CSS *and* labs). Changing the shared head include and `_quarto.yml` css to `../assets/` fixes it — verified byte-identical render. Deeper nesting needs a per-directory `_metadata.yml`. |
| **Subpath hosting is fine** | GitHub Pages serves from `/repo/`. Verified: renders byte-identical to root-served. |
| **Hand-written assignments should be `format: html`** | They sit two levels deep and do not need the lab framework, so they should not load the lab script at all. **Word-authored ones are different**: Physics 1's four assignments are `.docx` + `.pdf` pairs, and `.docx` is the format they will keep being edited in. Round-tripping Word ↔ `.qmd` is a maintenance trap for no student-facing gain — publish the PDFs and link them from `index.qmd`. |

---

## 6. Migration checklist

**Do this before converting Physics 1, not after.** Converting is now a
term-long activity done while teaching (§8), and restructuring the repo in week 6
is the thing to avoid. Migrating first also means repathing 2 decks instead of 9,
and every Physics 1 deck gets authored straight into its final home.

Steps 0a–0c need no decisions and can be done at any time.

- **0a.** Add LaTeX rules to `.gitignore` (§3.7) — `*.aux *.log *.nav *.out
  *.snm *.toc *.dvi *.ps *.fls *.fdb_latexmk *.synctex.gz *.bak
  *-eps-converted-to.pdf`.
- **0b.** Write `.gitattributes` (§3.8). Must exist before the first commit.
- **0c.** Prune the 44 unreferenced SVGs from `figs/` (§3.9).

1. Copy (do not move) `Slides/` to `C:\dev\teaching`, leaving OneDrive intact
   until the copy is confirmed working.
2. Bring the original sources — `.tex`, `.eps`, `.fig` — into the repo for all
   three courses, not just Math 1. They are the provenance and currently live
   only in OneDrive. Check `matrices/rhrule.eps` (20.2 MB, unused) first, and
   leave out the exam paper and the 11 stray compiled PDFs in Physics 1 (§3.6,
   §1.2).
3. Promote `quarto/` contents to the repo root; move `matrices.qmd`,
   `vectors.qmd` and `figs/` into `math-1/`, and `motion.qmd` into `physics-1/`.
4. Change `assets/head.html` and `_quarto.yml` from `./assets/` to `../assets/`,
   and move the footer/title out of `_quarto.yml` into per-course
   `_metadata.yml` (§3.10). **Three files reference `assets/`, not two** — the
   title-slide `data-background-image: assets/humber-logo.png` in each `.qmd`
   needs the same `../` (§1). A missing background image fails silently: the
   title slide renders fine, just without the logo, so check it by eye.
5. Create the other course folders with `index.qmd` stubs; drop the four Physics 1
   assignment PDFs into `physics-1/assignments/` and link them (§5).
6. `quarto render`, then confirm: all three decks render, `lab-selftest.html`
   shows **56/56**, and the PDF export still works.
7. Add LICENSE + NOTICE (§3.6). `git init`, `gh repo create`,
   `quarto publish gh-pages`.
8. Verify the live URLs, then retire the OneDrive copy.
9. Delete the temp-directory workaround in `tools/eps2svg.sh` — it exists *only*
   because of the space in `OneDrive - Humber College` (its own comment says so
   at lines 11–12) and is dead weight once the move is done. Left in place, the
   next person wonders what it is defending against.

---

## 7. Errors found in the original LaTeX

Fixed in the `.qmd`, still present in the `.tex`:

- `matrices/main.tex:432` — the symbolic `RT` matrix, row 2, column 3 reads
  `Δx cos θ + Δy sin θ`. Should be `Δx sin θ + Δy cos θ`. The numeric answer
  slide already used the correct form. Now pinned by a check in the self-test.
- `vectors/main.tex:490` — `$[2 - 3]$` should be `$[2, -3]$`.

Flagged but **not** changed, because it is a judgement call:

- `vectors.qmd` classwork answer, `5.0 ∠ 28°` → `[4.4, 2.4]`. The y-component
  is `5 sin 28° = 2.347`, which rounds to **2.3**, not 2.4.

Also worth knowing, both now in the tutorial's troubleshooting table: raw HTML
inside a `:::` div gets parsed as Markdown and every `<img>` wrapped in a `<p>`
(use a ```` ```{=html} ```` block); and combining marks (U+20D7 arrow, U+0302
hat) render as tofu boxes in the theme's UI font, so lab readouts spell out
`N / |N|` rather than `N̂`.

---

## 8. Next actions

As of 2026-08-05. Fall term is roughly four weeks out; Math 1 and Physics 1 are
both being taught.

### The conversion queue — settled 2026-08-05

Both questions that used to sit here are answered. The Physics 1 folder was
pruned to the seven decks being taught, and the order was confirmed directly
(§1.2). Nothing blocks conversion now except the migration decisions below.

| # | deck | frames | new work |
| --- | --- | --- | --- |
| 1 | `motion` | 11 | **done 2026-08-05** → 18 slides, 4 labs, zero figures (§1.3) |
| 2 | `eqnsOfMotion` | 22 | 7 EPS + 1 PNG; **the first time-stepping lab belongs here** (projectile motion) |
| 3 | `newtonsLaws` | 9 | 4 EPS |
| 4 | `forces` | 20 | 9 EPS |
| 5 | `drag` | 8 | 2 EPS |
| 6 | `gravity` | 9 | 2 EPS |
| 7 | `staticCollisions` | 24 | ~11 new frames, 2 new EPS — the rest is already in `vectors.qmd` (§1.2) |

**103 frames, of which ~90 are new, and 24 EPS to convert.** That is materially
smaller than the 149 frames / 78 figures the plan was sized against, and it is
what makes item 3 below realistic. With `motion` done, **92 frames and 24 EPS
remain** — and `motion` needed none of its 6 figures, so the 24 may yet shrink
(§1.3).

The one question the queue raises: **`staticCollisions` overlaps `vectors.qmd`
by 13 frames** — link or duplicate? See §1.2. It does not block anything until
deck 7, which is late in the term.

### Decisions blocking the migration

None are blocked on anything else, and none get easier with 7 more decks in the
pile. Roughly in the order they bite:

| | decision | note |
| --- | --- | --- |
| §3.1 | move to `C:\dev\teaching` | recommended yes; everything below assumes it |
| §3.8 | `.gitattributes` | must exist before commit one |
| §3.6 | third-party imagery + LICENSE | hardest to undo once pushed — and the exam paper in `staticCollisions/` is not optional |
| §3.7 | how much LaTeX source to commit | build output is 21.5 of 55 MB in Math 1, 56.4 of 101.4 MB in Physics 1 |
| §3.5 | git identity | `@humber.ca` will not attribute, and dies with the job |
| §3.3 | publish the answers? | interacts with §3.6 — private repo Pages needs a paid plan |
| §3.2 | repo layout and URL | project repo vs `<user>.github.io` user site |
| §3.10 | footer + deck titles | one wording decision, with the §3.4 titles |
| §3.9 | prune unused figures | no decision really, just do it |

**Settled since the last review:** §3.4 course naming — folder names are
`math-1`, `physics-1`, … with no course code (§2); the leftover deck *title*
wording is folded into §3.10. The Physics 1 conversion queue and both of its
blocking questions (above). The institution half of §3.10 — the Humber
Polytechnic rebrand is applied and rendered (§1).

### Order of work

1. **Mechanical, needs no decisions** — migration steps 0a–0c (`.gitignore`
   LaTeX rules, `.gitattributes`, prune 44 SVGs).
2. **Migrate** (§6). Before converting Physics 1, for the reason at the top of
   that section.
3. **Convert Physics 1 in teaching order, ~2 weeks ahead of delivery.** Front-load
   only the first three or four decks before term. Even at 103 frames rather
   than 149, doing the whole course in four weeks alongside improving Math 1 and
   actually preparing to teach is not realistic — and is not necessary.
   `motion` → `eqnsOfMotion` → `newtonsLaws` is 42 frames and 11 EPS, which is
   a sane pre-term target. **`motion` is done** (§1.3); `eqnsOfMotion` is next,
   and it is the big one — 22 frames, and the deck that settles §2.1 step 4.
4. **§2.1 step 4 falls out of item 3 for free.** Whichever deck brings the first
   time-stepping lab answers the `lab-core.js` seam question. Do not attempt the
   split before that.
5. **Physics 2**: not this term. The survey in §1.1 is there so it does not have
   to be redone.

### Deliberately not done

- **Math 1 content work.** Known outstanding, not itemised here — the `.qmd`
  decks are the working copy.
- **Assignments as `.qmd`.** Publish the PDFs (§5).
- **Re-vendoring any renderer.** See §2.1.
