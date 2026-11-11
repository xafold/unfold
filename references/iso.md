# The iso layer (`kit/iso.mjs`)

`kit/iso.mjs` draws the card, the page, the iso camera and solid blocks. `concept-kit.mjs` re-exports it as `iso`. It is adapted from the anatomy skill (see `THIRD_PARTY_NOTICES.md`).

The examples use only the functions below. The file has more (cylinders, ticks, wires, dot grids). Read its source before you use one of those.

## Camera

| Function | What it does |
|---|---|
| `fitProjection(points, width, height, { pad, headroom, azimuth, elevation })` | Returns a projection that fits the 3D `points` into a `width` x `height` box. Defaults: azimuth 45, elevation 30, pad 24. |
| `iso([x, y, z], projection)` | Projects one 3D point to `[sx, sy]` on the screen. |
| `depthOf([x, y, z], projection)` | Depth toward the viewer. Sort solids by it, far first (painter's order). |
| `boxCorners({ x, y, w, d }, z0, z1)` | The 8 corners of a box. Pass them to `fitProjection`. |
| `topMatrix(at, z, projection, along)` | An SVG `matrix(...)` that lays flat content (text, a grid) on the top face of a block at height `z`. |

## Solids

| Function | What it does |
|---|---|
| `slabOf(plan, z, height, projection)` | A block with a rounded plan `{ x, y, w, d, r }`. Returns path data `{ fill, outline, crease, top, shades }` for `solidSvg`. |
| `haloOf(plan, z, height, projection)` | The outline fill of the same block, for a halo behind it. |
| `solidSvg(paths, { tone, crease, halo, lit, flat, className, inner })` | Draws the faces with the four-tone shading. `tone` is `"hi"`, `"mid"` or `"lo"`. |

## Card and page

| Function | What it does |
|---|---|
| `figureSvg({ width, height, label, body, className })` | The `<svg>` of the drawing. `label` is its accessible name. |
| `plateHtml({ fig, title, hint, readout, keys, caption, body })` | The card: `Fig n` top left, title top right, hint bottom left, live readout (`[data-readout]`) bottom right. |
| `pageHtml({ title, theme, body, script, width })` | A full page with the base CSS. `width` is the widest size in px, or `"fill"` for the whole window. Use `concept-kit.mjs`'s `pageHtml`, which adds the unfold CSS and runtime and fills the window by default. |
| `ISO_CSS` | The base CSS. |

## Tokens

Theme tokens are CSS variables with the `--u-` prefix. The main ones: `--u-page`, `--u-card`, `--u-text`, `--u-strong`, `--u-muted`, `--u-faint`, `--u-hi`, `--u-mid`, `--u-lo`, `--u-mono`, `--u-ease`. Each has a dark and a light value. The concept hues are separate: `--unfold-blue`, `--unfold-yellow` and so on (`references/style.md`).
