# Course slides in Quarto

Migration of the LaTeX Beamer decks in `../matrices`, `../vectors` and
`../Game Physics 1` to Quarto + reveal.js, so slides can carry live interactive
demos instead of static EPS figures.

Converted and working:

| deck | course | slides | source |
| --- | --- | --- | --- |
| `matrices.qmd` | GAME 220 Game Dynamics 1 | 22 | `../matrices/main.tex` |
| `vectors.qmd` | GAME 220 Game Dynamics 1 | 39 | `../vectors/main.tex` |
| `motion.qmd` | GAME 105 Game Physics 1 | 18 | `../Game Physics 1/motion/main.tex` |

The two courses share one `assets/` and one `_quarto.yml`; `motion.qmd`
overrides only the footer in its own front matter. See [PLAN.md](PLAN.md) §4 for
where this is heading (one folder per course).

**New to this setup? Read [TUTORIAL.md](TUTORIAL.md)** — it covers creating,
presenting and sharing decks end to end. This README is the short reference.
[PLAN.md](PLAN.md) tracks project status, open decisions, and the planned
multi-course restructure.

## Prerequisites

Quarto 1.10.18 is installed. On a new machine:

```powershell
winget install --id Posit.Quarto -e
```

Nothing else is needed — Quarto bundles pandoc and reveal.js, and the labs have
no third-party dependency at all: `assets/` is 43 KB of plain JavaScript that
draws with Canvas 2D. Nothing is fetched from the network at runtime.

## Running the decks

**Do not open `matrices.html` by double-clicking it.** The lab code is ES
modules, and browsers block module scripts on `file://` under the CORS rules for
opaque origins. The slide still renders — you just get an empty gap where the
lab should be, with no visible error. The decks must be served over http.

Two ways, both fine:

```powershell
.\serve.cmd                    # serves this folder and opens the deck
quarto preview matrices.qmd    # same, plus live reload while you edit
```

`serve.cmd` is double-clickable from Explorer, which is the one to use in class.
Close the window to stop it.

To rebuild after editing a `.qmd`:

```powershell
quarto render                  # builds every *.qmd in this folder
```

Output lands beside the source (`matrices.html` + `matrices_files/`), so it sits
next to `assets/` and `figs/` and the relative paths resolve. Edits to
`assets/*.css` and `assets/*.js` are picked up on reload without re-rendering.

While presenting: `f` fullscreen, `s` speaker notes, `b` chalkboard, `o`
slide overview, `esc` to zoom out.

For a PDF handout, open `matrices.html?print-pdf` and print from Chrome with
**Background graphics** on. The labs come through as a static image at their
current slider values. Sharing the deck itself means hosting it —
`quarto publish quarto-pub` — because a self-contained single file drops the
lab JavaScript entirely. See [TUTORIAL.md](TUTORIAL.md) §8.

## Interactive labs

A lab is a `<div>` in the `.qmd`; `assets/labs.js` finds it and mounts the demo:

```html
<div class="lab-mount" data-lab="2d" data-stages="rotate,translate"
     data-theta="60" data-dx="3" data-dy="0"></div>
```

Seven kinds, set with `data-lab`:

| `data-lab` | what it is | used in |
| --- | --- | --- |
| `2d` (default) | matrix transforms: two tracked vertices, a shape, composed 3×3 | matrices |
| `matmul` | step through $A \times B$ one cell at a time, row of $A$ against column of $B$ | matrices |
| `polar` | drag a vector, read off $[a,b]$ and $r\angle\theta$ | vectors |
| `add` | tip-to-tail addition, with an A+B / A−B toggle | vectors |
| `dot` | dot product and the projection onto $\hat{B}$ | vectors |
| `reflect` | the non-axis-aligned collision, following the deck's five steps | vectors |
| `motion` | two positions, and the displacement, distance, velocity and speed between them | motion |
| `accel` | an initial and a final velocity, and $\vec{a} = \Delta\vec{v}/t$ | motion |

Options, all optional:

| attribute | applies to | meaning |
| --- | --- | --- |
| `data-stages` | `2d` | `rotate`, `scale`, `translate`, comma separated, in application order |
| `data-shape` | `2d` | `house` (default) or `square` |
| `data-theta` `data-kx` `data-ky` `data-dx` `data-dy` | `2d` | starting slider values |
| `data-reorder` | `2d` | `false` hides the draggable order row |
| `data-matrix` | `2d` | `false` hides the matrix readout |
| `data-view` | all | half-height of the viewport in world units |
| `data-cx` `data-cy` `data-step` `data-dp` | vector and motion labs | camera centre, grid spacing, decimal places |
| `data-preset` | `reflect` | `peggle` — the worked example's coordinates |
| `data-show` | `motion` | `position`, `displacement` or `velocity` (default) — how much of the picture to reveal |
| `data-t` | `motion` `accel` | starting value of the time slider |
| `data-a` | `matmul` | the left matrix $A$, 9 comma-separated numbers, row-major — always 3×3 |
| `data-b` | `matmul` | one right factor $B$: 9 numbers for a 3×3 matrix, 3 for a single column vector, 6 for two columns side by side, and so on — always 3 rows |
| `data-a-label` `data-b-label` `data-c-label` | `matmul` (with `data-b`) | captions for $A$, $B$ and the product (default `A`, `B`, `AB`) |
| `data-order` | `matmul` (with `data-b`) | `row` (default) fills the product row by row, as a hand-worked matrix product is usually written; `col` fills it column by column instead |
| `data-bs` | `matmul` | several right-hand vectors instead of one $B$, semicolon-separated 3-number groups (`"2,1,1;2,1,0"`) — each gets its own $A \times b_i = c_i$ stacked underneath the last, all sharing one **Prev**/**Next**, which advances every $b_i$'s row together |
| `data-bs-labels` `data-cs-labels` | `matmul` (with `data-bs`) | comma-separated captions for each $b_i$ and $c_i$, matched up by position |

Every slider's number is also a text box: click it to type an exact value
(Enter or click away to commit, Escape to cancel), rather than only dragging
the thumb. Out-of-range text clamps to the slider's min/max; unparsable text
reverts to the last valid value.

The `2d` lab, given more than one stage, gets a row of words above the matrix
— e.g. `Rotate × Translate =` — that can be dragged left-to-right into any
order, exactly as you'd rearrange terms in a written-out matrix product; the
matrix and the shape follow. That is what makes the order-matters slide land:
drag, then **Play**, and the same θ, scale and Δ visibly end up somewhere
else. The row reads in *multiplication* order, not application order — the
rightmost word is the first transform applied to a point, matching how `TR`
in the algebra means "rotate, then translate."

The vector and motion labs are dragged rather than sliders: the black dots are
handles. Three of them start on a printed worked example, so the readout
reproduces the slide's numbers exactly — `reflect` with `data-preset="peggle"`
gives $\hat{N} = [0.832, -0.555]$ and $v_f = [-10, 50]$; `motion` starts at
$A = [1, 2]$, $B = [-1, 1]$, $t = 2$ s for displacement $[-2, -1]$ and speed
1.12 m/s; `accel` starts from rest at $[62.5, 22]$ m/s over 10 s for
$[6.25, 2.2]$ m/s².

`motion` with `data-show` is one lab across four consecutive slides, revealing a
little more each time, which is how six graphing-tool screenshots in the Beamer
original collapsed into nothing at all — that deck ships with no figures.

`matmul` has **Next** / **Prev** / **Reset** rather than sliders or dragging
(no **Play** — each step is a row·column statement meant to be read, not an
animation to watch play out): each step highlights a row of $A$ and a column
of $B$ and spells out the arithmetic, the same "row eats column" idea as the
dumptruck slide. It is the one lab with no canvas at all — just numbers and
which of them combine — so it reuses the matrix panel's bracket-and-font
styling directly rather than drawing anything.

Two shapes. `data-a` + `data-b` is one $A \times B$, run cell by cell (nine
steps for a 3×3 $B$ — the $TS$ slide). `data-a` + `data-bs` is $A$ against
several vectors *at once*, one $A \times b_i = c_i$ stacked above the next
rather than side by side, all three steps (one per row of $A$) filling every
$b_i$'s row together — the point-vs-direction slide, so **Next** builds
$Tv_{point}$ and $Tv_{dir}$ in lock-step and the two answers land together:
$Tv_{point} \neq v_{point}$ but $Tv_{dir} = v_{dir}$, without two separate
demos or one finishing before the other starts.

Code layout: `lab-core.js` (dragging, run loop, panels) and `draw2d.js` (the
Canvas 2D drawing) → `lab-mount.js` (stage + panel + wiring, shared by every
draggable lab) → `transform-lab.js`, `vector-lab.js` and `motion-lab.js` (the
labs themselves), plus `matmul-lab.js` (DOM only, no stage) → `labs.js` (the
single entry point the decks load, which dispatches on `data-lab`).

Every lab but `matmul` draws with Canvas 2D — immediate mode, the same model as
`Scene0::Render`. There is no renderer library; see [PLAN.md](PLAN.md) §2.1 for
why, and before adding one for a future course.

Two helper pages, both needing `serve.cmd` like the decks:

- <http://localhost:8000/lab-preview.html> — every lab on one plain page, for
  tweaking without re-rendering a deck.
- <http://localhost:8000/lab-selftest.html> — drives each lab with synthetic
  pointer drags and slider moves and checks the readouts against hand-worked
  values, and confirms each lab was drawn by the renderer it should be.
  Expect `all 78 checks passed`. Run it after touching `assets/*.js`.

## Figures

`tools/eps2svg.sh` converted every EPS figure from both decks into `figs/` as
SVG — 69 files, since `humberLogo` and `dotProd` appear in both folders (run it
from Git Bash). Two quirks it works around:

- Ghostscript refuses paths containing spaces, and this tree lives under
  `OneDrive - Humber College`, so it converts inside a temp directory.
- The older `fig2dev` figures call `showpage`/`copypage`, which Ghostscript
  blocks under `-dSAFER`; those fall back from `dvisvgm` to
  `epstopdf` → `pdftocairo`.

Re-run with `FORCE=1 ./tools/eps2svg.sh ../matrices ../vectors` to rebuild.

The `.fig` sources (xfig) are still the true originals for several figures. If
one needs editing, `fig2dev -L svg` goes straight to SVG and skips EPS entirely.

**The logo is not in `figs/`.** It is `assets/humber-logo.png`, hand-placed
rather than generated, because every course uses it while `figs/` is per-course
and rebuilt by the script above. Each deck loads it as a title-slide
background:

```yaml
title-slide-attributes:
  data-background-image: assets/humber-logo.png
  data-background-size: 110px
  data-background-position: 96% 92%
```

If it ever disappears from the title slide, the path is what to check — a
missing background image does not raise an error, the slide just renders
without it.

## Beamer → Quarto mapping

| Beamer | Quarto |
| --- | --- |
| `\begin{frame}\frametitle{X}` | `## X` |
| `\section{X}` | `# X` (becomes a section slide) |
| `\pause` | `. . .` on its own line |
| `\begin{columns}` / `\begin{column}{6cm}` | `:::: {.columns}` / `::: {.column width="50%"}` |
| `\alert{x}` | `[x]{.alert}` |
| `\struc{x}` | `[x]{.struc}` |
| `\fbox{...}` around math | `\class{boxed}{...}` inside the math |
| `\includegraphics{f.eps}` | `![](figs/f.svg){width="60%"}` |
| `\degree` | `^\circ` |
| `\bi \bu ... \ei` | `-` list items |
| `\ben \bu ... \een` | `1.` list items |
| miniframes navigation | `progress: true` + the `o` overview |
| `\setbeamercovered{invisible}` | reveal.js fragment default |

The math itself carries over untouched — MathJax handles `pmatrix`, `\sqrt`,
`\angle`, `\vec`, `\hat` exactly as Beamer did. That is most of both decks, and
it is why the conversion is mechanical rather than a rewrite.

Add `{.smaller}` after a slide heading when content overflows; it is the
Quarto equivalent of shrinking a frame.

## Converting the vectors deck

Same mechanical mapping. Two things there are worth doing more than
transcribing:

- The `plane-0.eps` … `plane-14.eps` sequence is a hand-built flipbook, one EPS
  per animation step, spread over seven near-identical frames. That is one
  animated lab.
- The reflection derivation (`vectorReflectionNonAxis*`) is a natural lab:
  drag the boundary, watch `N̂`, `P`, and `v_f` update, with the Peggle example
  as the starting values.
