// Builds the unfold logo files in this folder. Run: node brand/logo.mjs
// The mark is a 3 x 3 matrix in the iso camera. Grey cells lie flat; the diagonal rises as blocks
// in the Q, K, V hues (blue, yellow, red), so a flat grid "unfolds" into structure.
// PNGs are rendered with headless Chrome (/usr/bin/google-chrome), so text uses this machine's fonts.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";

const HUE = { blue: "#58c4dd", yellow: "#f4d345", red: "#fc6255", teal: "#5cd0b3" };
const GREY_DARK = ["#3e3e3e", "#2a2a2a", "#1f1f1f"];
const GREY_LIGHT = ["#d4d4d6", "#b4b4b8", "#9a9a9f"];

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};
const C30 = Math.cos(Math.PI / 6);
const P = (x, y, z, s) => [(x - y) * C30 * s, ((x + y) * 0.5 - z) * s];
const poly = (pts, fill) => `<path d="M${pts.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join("L")}Z" fill="${fill}"/>`;

// Cell (i, j) of a 3 x 3 grid. Height in cell units. The diagonal i + j = 2 runs left to right on screen,
// so its three blocks stand side by side and rise like a bar chart.
const CELLS = [];
for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
  const diag = i + j === 2;
  CELLS.push({ i, j, h: diag ? [0.6, 1.2, 1.8][i] : 0.08, hue: diag ? ["blue", "yellow", "red"][i] : null });
}

function markSvgBody(s, greys) {
  const gap = 0.14;
  const out = [];
  for (const c of [...CELLS].sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i)) {
    const x0 = c.i + gap / 2, x1 = c.i + 1 - gap / 2, y0 = c.j + gap / 2, y1 = c.j + 1 - gap / 2, h = c.h;
    const [top, right, left] = c.hue ? [HUE[c.hue], shade(HUE[c.hue], 0.62), shade(HUE[c.hue], 0.42)] : greys;
    out.push(poly([P(x1, y0, 0, s), P(x1, y1, 0, s), P(x1, y1, h, s), P(x1, y0, h, s)], right));
    out.push(poly([P(x0, y1, 0, s), P(x1, y1, 0, s), P(x1, y1, h, s), P(x0, y1, h, s)], left));
    out.push(poly([P(x0, y0, h, s), P(x1, y0, h, s), P(x1, y1, h, s), P(x0, y1, h, s)], top));
  }
  return out.join("");
}

// Bounds of the mark at scale s, to centre it.
function bounds(s) {
  const xs = [], ys = [];
  for (const c of CELLS) for (const [x, y] of [[c.i, c.j], [c.i + 1, c.j], [c.i, c.j + 1], [c.i + 1, c.j + 1]]) for (const z of [0, c.h]) {
    const [a, b] = P(x, y, z, s); xs.push(a); ys.push(b);
  }
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
const placed = (s, cx, cy, greys) => {
  const b = bounds(s);
  return `<g transform="translate(${(cx - b.x - b.w / 2).toFixed(1)} ${(cy - b.y - b.h / 2).toFixed(1)})">${markSvgBody(s, greys)}</g>`;
};

const SERIF = `'Latin Modern Math','STIX Two Math','Cambria Math',Georgia,serif`;
const MONO = `ui-monospace,'SF Mono',Menlo,Consolas,monospace`;

const files = {
  "unfold-icon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" rx="112" fill="#131313"/>${placed(74, 256, 256, GREY_DARK)}</svg>`,
  "unfold-mark.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">${placed(60, 200, 200, GREY_DARK)}</svg>`,
  "unfold-logo-dark.svg": logo("#0b0b0b", "#e6e6e6", "#6e6e6e", GREY_DARK),
  "unfold-logo-light.svg": logo("#f2f2ef", "#18181a", "#8c8c90", GREY_LIGHT),
  "unfold-social.svg": social(),
};

function logo(bg, ink, muted, greys) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 300" width="960" height="300"><rect width="960" height="300" fill="${bg}"/>${placed(44, 160, 150, greys)}<text x="320" y="168" font-family="${SERIF}" font-style="italic" font-weight="600" font-size="118" fill="${ink}">unfold</text><text x="324" y="222" font-family="${MONO}" font-size="24" letter-spacing="1" fill="${muted}">see how the idea really works</text></svg>`;
}
function social() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 640" width="1280" height="640"><rect width="1280" height="640" fill="#0b0b0b"/><rect x="40" y="40" width="1200" height="560" rx="18" fill="#131313" stroke="#2a2a2a"/>${placed(80, 330, 320, GREY_DARK)}<text x="600" y="300" font-family="${SERIF}" font-style="italic" font-weight="600" font-size="150" fill="#e6e6e6">unfold</text><text x="606" y="370" font-family="${MONO}" font-size="28" fill="#a3a3a3">Interactive explainer figures</text><text x="606" y="412" font-family="${MONO}" font-size="28" fill="#a3a3a3">for software and math ideas</text><text x="606" y="490" font-family="${MONO}" font-size="22" fill="#6e6e6e">a Claude Code skill</text></svg>`;
}

for (const [name, svg] of Object.entries(files)) writeFileSync(join(DIR, name), svg);

// PNG renders: [svg, png, width, height]
const PNGS = [
  ["unfold-icon.svg", "unfold-icon.png", 512, 512],
  ["unfold-logo-dark.svg", "unfold-logo-dark.png", 960, 300],
  ["unfold-logo-light.svg", "unfold-logo-light.png", 960, 300],
  ["unfold-social.svg", "unfold-social.png", 1280, 640],
];
for (const [svg, png, w, h] of PNGS) {
  const run = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
    `--window-size=${w},${h}`, `--screenshot=${join(DIR, png)}`, `file://${join(DIR, svg)}`], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(`chrome failed for ${svg}: ${run.stderr}`);
}
console.log(`wrote ${Object.keys(files).length} svg and ${PNGS.length} png files in ${DIR}`);
