# CV — Kei Ichikawa

This folder contains the CV source and the rendered PDF, laid out in the
Friggeri CV style.

## Files

- **`cv.html`** — editable source. Open in any text editor to update content
  (profile, education, publications, talks, awards, service, work). The visual
  design is embedded in a single `<style>` block near the top, so no external
  stylesheet is needed.
- **`cv.pdf`** — rendered output. Linked from `index.html` as the public CV.
- **`README.md`** — this file.

## Regenerate the PDF (macOS)

Edit `cv.html`, then run:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=cv.pdf \
  --virtual-time-budget=10000 \
  "file://$(pwd)/cv.html"
```

The resulting `cv.pdf` uses A4 page size with 18 mm margins (defined inside
`cv.html` via `@page`).

## Editing notes

- Letter size. Page 1 has a full-width dark grey band with the name
  (first name UltraLight, last name Regular) and a right-aligned `contact`
  sidebar; the body column starts 6.1 cm from the left edge.
- Section headings are lowercase with the first three letters wrapped in
  `<span class="c">`; the accent colour cycles blue → red → orange → green →
  purple → brown by section order.
- Papers / talks use `<div class="entry">` (title / authors / *venue*, year);
  education and positions use `.entrylist` (date + bold title + detail).

## Fonts

Helvetica Neue only (UltraLight, Regular, Light, Light Italic, Condensed Bold,
Bold Italic), picked by PostScript name via `@font-face { src: local(...) }`.
These fonts ship with macOS, so render on a Mac; CI uses a `macos-latest`
runner for the same reason. On other systems it falls back to Helvetica/Arial.
