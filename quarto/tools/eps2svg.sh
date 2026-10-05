#!/bin/bash
# Convert the Beamer decks' EPS figures to SVG for the Quarto/HTML slides.
#
#   ./tools/eps2svg.sh ../matrices ../vectors
#
# Output lands in figs/. Existing SVGs are skipped unless FORCE=1.
#
# Two quirks are worked around here:
#
#  1. dvisvgm shells out to Ghostscript, which refuses to read files whose path
#     contains spaces ("OneDrive - Humber College" ...), so each file is copied
#     into a space-free temp directory, converted there, and copied back.
#  2. The older fig2dev figures call `showpage`/`copypage`, which Ghostscript
#     blocks in -dSAFER mode, so dvisvgm dies on them with "invalidfileaccess".
#     Those fall back to epstopdf -> pdftocairo, which handles them fine.

set -u

here="$(cd "$(dirname "$0")/.." && pwd)"
outdir="$here/figs"
work="$(mktemp -d "${TMPDIR:-/tmp}/eps2svg.XXXXXX")"
trap 'rm -rf "$work"' EXIT

mkdir -p "$outdir"

case "$work" in
  *\ *) echo "temp dir contains spaces: $work" >&2; exit 1 ;;
esac

ok=0; fail=0; skip=0

for dir in "$@"; do
  for src in "$dir"/*.eps; do
    [ -e "$src" ] || continue
    base="$(basename "$src" .eps)"
    # -eps-converted-to.pdf leftovers from latex runs are not source figures
    case "$base" in *-eps-converted-to) continue ;; esac

    if [ -s "$outdir/$base.svg" ] && [ "${FORCE:-0}" != "1" ]; then
      skip=$((skip+1)); continue
    fi

    cp "$src" "$work/$base.eps"

    ( cd "$work" && dvisvgm -E --no-fonts --exact-bbox -o "$base.svg" "$base.eps" ) >/dev/null 2>&1
    via=dvisvgm
    if [ ! -s "$work/$base.svg" ]; then
      ( cd "$work" \
        && epstopdf --outfile="$base.pdf" "$base.eps" \
        && pdftocairo -svg "$base.pdf" "$base.svg" ) >/dev/null 2>&1
      via=epstopdf
    fi

    if [ -s "$work/$base.svg" ]; then
      cp "$work/$base.svg" "$outdir/$base.svg"
      ok=$((ok+1)); printf 'ok    %-42s (%s)\n' "$base.svg" "$via"
    else
      fail=$((fail+1)); printf 'FAIL  %s\n' "$base.eps"
    fi
    rm -f "$work/$base.eps" "$work/$base.svg" "$work/$base.pdf"
  done
done

printf '\n%d converted, %d skipped, %d failed -> %s\n' "$ok" "$skip" "$fail" "$outdir"
