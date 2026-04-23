# CV — Kei Ichikawa

This folder contains the CV source and the rendered PDF, styled to match the
Tatami-inspired design of the main site.

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

- Layout is driven by CSS grid in two columns: a 42 mm left "eyebrow / section
  title" rail and a right content column.
- Each publication / talk / award is a `<li class="...">` inside a
  `<ul class="items">`. Duplicate an `<li>` to add a new entry.
- The header uses a Japanese sub-name (`市川 慧`) under the Latin display name.
  Change or remove via the `.subname` element.
- Links are rendered with a hairline underline; on screen they highlight in
  indigo (`--hover`). In the printed PDF they appear as plain text with an
  underline.

## Fonts

Uses Google Fonts (Noto Serif JP for display, Noto Sans JP for body) fetched
at render time. Chrome headless waits for fonts via `virtual-time-budget`.
