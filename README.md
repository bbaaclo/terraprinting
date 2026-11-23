# Design to SVG

Turns a flat jersey, uniform or logo image (PNG, JPG or WebP) into an SVG
with plain filled paths. Everything runs in the browser; images never leave
the computer.

## Run it on your computer (localhost)

Needs Node.js 20.19 or newer (the LTS download from nodejs.org is fine).

1. Open Terminal and type `cd ` (with a space), drag this folder into the
   Terminal window, and press Return.
2. Run `npm install` (first time only, takes about a minute).
3. Run `npm run dev`.
4. Open http://localhost:5173 in Chrome or Safari.

Press Control + C in Terminal to stop it.

## Smart (AI) background removal

`npm install` downloads a browser build of the BiRefNet-lite model (MIT
license, about 104 MB, one time only, from huggingface.co/clevr-tools/birefnet-lite-web,
pinned to a fixed version and checked by SHA-256) into `public/models/`. Needs Chrome
with WebGPU. If the model or WebGPU is missing, the app uses plain-color
removal instead and says why.

## Company logo

The header shows the Terra Printing logo from `public/brand-logo.png`.
Put the logo file there (a wide PNG with a transparent background works best;
it is shown 36 px tall). Without that file, a simple ribbon mark and the name
"Terra Printing" are shown instead.

## How it works

1. The browser decodes the image into pixels (`src/lib/decodeImage.js`).
2. A background worker reduces it to a few flat colors (`src/lib/quantize.js`),
   then VTracer traces each color area into paths (`src/lib/trace.worker.js`).
3. If "Remove background" is on (the default), the plain background around
   the design is made transparent before tracing (`src/lib/removeBackground.js`).
   It uses the most common color along the image edges and only removes the
   area of that color connected to the edges, so enclosed details are kept.
   If the result looks unreliable, the background is kept and the app says why.
   Soft shadows are not removed.
4. The SVG gets an explicit width, height and viewBox, and every fill is
   snapped to the palette (`src/lib/svgOutput.js`).

Trace settings live in `src/lib/traceSettings.js`.

VTracer comes from the official npm package `@visioncortex/vtracer`, which is
built for Node.js. `scripts/prepare-vtracer.mjs` runs after `npm install` and
writes a browser version into `src/vendor/vtracer/` (not committed).

## Pages

- **Home** (`#/`): Design to SVG, Customer Sizes and Projects.
- **Design to SVG** (`#/svg`): the image-to-layered-SVG tool.
- **Customer Sizes**: generate every size from one pattern (preset width and
  height per size, downloads as SVG or ZIP), body measurements and size finder (`#/sizes`), team orders with
  CSV import/export (`#/orders`), previous customers (`#/customers`).
- **Projects** (`#/projects`): stages, due dates, payment status, pickup check.

Customers, orders, projects and size charts are saved in this browser
(localStorage). Sample data loads on first run; remove it from the Home
screen. Use Export backup on Home to keep a copy.

## Status

Step 1 of 3: upload, trace, preview, download.
Next: step 2 (trace sliders), step 3 (layer groups and "Download layered SVG").
