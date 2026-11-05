import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const UNFOLD_DIR = process.env.UNFOLD_DIR ?? join(homedir(), ".claude", "skills", "unfold");
const u = await import(pathToFileURL(join(UNFOLD_DIR, "kit", "concept-kit.mjs")).href);

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const W = 820;
const H = 316;
const NARROW = { w: 420, h: 598, right: { x: 65, y: 330 } };
const WIDE_RIGHT = { x: 480, y: 36 };
const START_RATE = 1;
const N = 5;

// ---- Left: the loss curve, the point w and its trail ----
const PL = { x: 40, y: 26, w: 360, h: 250, xr: [-4, 10], yr: [0, 50] };
const plot = u.plot({
  ...PL,
  f: (w) => (w - m.TARGET) ** 2,
  xTicks: [-4, -2, 0, 2, 4, 6, 8, 10],
  yTicks: [],
  xName: "w",
  yName: "L",
  xHue: "blue",
  yHue: "yellow",
  hue: "yellow",
});
const OY = PL.y + PL.h;
// ponytail: the kit puts y tick labels on the x = 0 axis and its CSS centres them on it, so both plots draw
// their own L labels, right-aligned at the left edge.
const Y_TICKS = [10, 20, 30, 40, 50];
const yAxis = (P, at) =>
  `<path class="u-plot-grid" d="${Y_TICKS.map((v) => `M${P.x} ${at(P.xr[0], v)[1]}H${P.x + P.w}`).join("")}"/>` +
  Y_TICKS.map((v) => `<text class="u-tick-label" x="${P.x - 8}" y="${at(P.xr[0], v)[1]}" style="text-anchor:end">${v}</text>`).join("");
const STEP_Y = OY + 28;

const trails = m.RUNS.map((run, k) => {
  const pts = run.rows.map((r) => plot.at(r.w, r.L));
  const segs = pts.slice(1).map((b, i) => {
    const a = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return len < 3 ? "" : `<g class="el-seg" data-t="${i + 1}">${u.arrow(a, b, { hue: "green", head: Math.min(5, len * 0.4) })}</g>`;
  });
  const dots = pts.map(([x, y], t) => `<circle class="el-dot" data-hue="blue" data-t="${t}" cx="${x}" cy="${y}" r="2.6"/>`);
  return `<g class="el-run" data-k="${k}">${segs.join("")}${dots.join("")}</g>`;
}).join("");

const [bx, by] = plot.at(m.W0, m.RUNS[0].rows[0].L);
const live = [
  `<path id="guide" class="el-guide" data-hue="blue" d="M${bx} ${by}V${OY}"/>`,
  `<path id="wtick" class="el-wtick" data-hue="blue" d="M0 ${OY + 1}l-4 7h8z" style="transform:translateX(${bx}px)"/>`,
  `<g id="hstep" class="el-hstep" data-hue="green"><path class="el-hline" d="M${bx} ${STEP_Y}H${bx}"/><path class="el-hhead" d="M${bx} ${STEP_Y}l0 0z"/></g>`,
  `<path id="tangent" class="el-tangent" data-hue="red" d="M${bx} ${by}L${bx} ${by}"/>`,
  `<g id="glab" class="el-glab" data-hue="red" style="transform:translate(${bx}px,${by}px)"><text x="0" y="0">L′ = −6.00</text></g>`,
  `<g id="ball" class="el-ball" data-hue="blue" style="transform:translate(${bx}px,${by}px)"><circle r="6"/></g>`,
].join("");

// ---- Right: the iteration table (scenes 1-4) and the loss over steps (scene 5) ----
const CELL = [62, 22];
const ROW0 = 14;
const COLS = [
  { id: "colW", key: "w", hue: "blue", name: "w" },
  { id: "colG", key: "g", hue: "red", name: "L′(w)" },
  { id: "colS", key: "step", hue: "green", name: "η·L′" },
  { id: "colL", key: "L", hue: "yellow", name: "L(w)" },
];
const colMax = (run, key) => Math.max(1e-9, ...run.rows.map((r) => Math.abs(r[key])));
const startRun = m.RUNS[START_RATE];
const grids = COLS.map((c) =>
  `<g class="u-move" id="${c.id}"><g transform="translate(0 ${ROW0})">${u.cellGrid({ id: `grid-${c.key}`, values: startRun.rows.map((r) => [r[c.key]]), hue: c.hue, cell: CELL, places: 2, name: c.name, dims: false, max: colMax(startRun, c.key) })}</g></g>`,
).join("");
const tcol = startRun.rows.map((r) => `<g class="el-trow" data-r="${r.t}"><text class="el-tnum" x="12" y="${ROW0 + r.t * CELL[1] + CELL[1] / 2}">${r.t}</text></g>`).join("");
const table = `<g class="u-move" id="table"><text class="el-thead" x="12" y="${ROW0 - 7}">t</text>${tcol}${grids}</g>`;

// Column x per scene: w and L first, then the slope, then the step slides in between.
const X = { colW: 30, colG: 96, colS: 162, colL: 228 };
const colCss = [
  u.placeCss("#table", u.states(N, { 0: {}, 1: {}, 2: {}, 3: {} })),
  u.placeCss("#colW", u.states(N, { 0: { x: X.colW }, 1: { x: X.colW }, 2: { x: X.colW }, 3: { x: X.colW } })),
  u.placeCss("#colG", u.states(N, { 1: { x: X.colG }, 2: { x: X.colG }, 3: { x: X.colG } })),
  u.placeCss("#colS", u.states(N, { 2: { x: X.colS }, 3: { x: X.colS } })),
  u.placeCss("#colL", u.states(N, { 0: { x: X.colG }, 1: { x: X.colS }, 2: { x: X.colL }, 3: { x: X.colL } })),
];

const P2 = { x: 30, y: 4, w: 250, h: 236, xr: [0, m.STEPS], yr: [0, 50] };
const lplot = u.plot({ ...P2, xTicks: [0, 2, 4, 6, 8], yTicks: [], xName: "t", yName: "L", yHue: "yellow" });
const DASH = ["2 3", "", "7 4"];
const lines = m.RUNS.map((run, k) => {
  const pts = run.rows.map((r) => lplot.at(r.t, r.L));
  const segs = pts.slice(1).map((b, i) => `<path class="el-lseg" data-t="${i + 1}" d="M${pts[i][0]} ${pts[i][1]}L${b[0]} ${b[1]}"${DASH[k] ? ` stroke-dasharray="${DASH[k]}"` : ""}/>`);
  const dots = pts.map(([x, y], t) => `<circle class="el-ldot" data-t="${t}" cx="${x}" cy="${y}" r="2.4"/>`);
  return `<g class="el-lrun" data-k="${k}" data-hue="yellow">${segs.join("")}${dots.join("")}</g>`;
}).join("");
const legend = m.RUNS.map((run, k) => {
  const y = P2.y + 16 + k * 18;
  return `<g class="el-lrun el-legend" data-k="${k}" data-hue="yellow"><path class="el-lseg" d="M${P2.x + 14} ${y}h22"${DASH[k] ? ` stroke-dasharray="${DASH[k]}"` : ""}/><text x="${P2.x + 42}" y="${y}">η = ${run.eta} · ${run.name}</text></g>`;
}).join("");
const lossPlot = `<g class="u-move" id="lossplot">${yAxis(P2, lplot.at)}${lplot.svg}${lines}${legend}</g>`;
const right = `<g class="el-right">${table}${lossPlot}</g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "Gradient descent on the loss L(w) = (w − 3)², starting at w = 0: the curve, the point w, the tangent slope, the steps, a table of every iteration, and a plot of the loss over steps for three learning rates.",
  body: [yAxis(PL, plot.at), plot.svg, trails, live, right],
});

// ---- Scenes ----
const w = u.mi("w", "blue");
const L = u.mi("L", "yellow");
const Lp = u.prime("L", "red");
const eta = u.mi("η", "green");
const wt = u.msub("w", "t", "blue");
const wt1 = `<msub>${w}<mrow><mi>t</mi><mo>+</mo><mn>1</mn></mrow></msub>`;
const update = `${wt1}<mo>=</mo>${wt}<mo>−</mo>${eta}<mo>&#x2062;</mo>${Lp}<mo>(</mo>${wt}<mo>)</mo>`;
const scenes = [
  {
    name: "Loss",
    math: `${L}<mo>(</mo>${w}<mo>)</mo><mo>=</mo><msup><mrow><mo>(</mo>${w}<mo>−</mo><mn>3</mn><mo>)</mo></mrow><mn>2</mn></msup>`,
    say: `The <b data-hue="yellow">loss</b> L(w) scores one parameter <b data-hue="blue">w</b>. Its lowest point is at w = 3. The algorithm cannot see the whole curve. It only knows where it stands: w₀ = 0, with a loss of 9.`,
  },
  {
    name: "Slope",
    math: `${Lp}<mo>(</mo>${w}<mo>)</mo><mo>=</mo><mn>2</mn><mo>(</mo>${w}<mo>−</mo><mn>3</mn><mo>)</mo>`,
    say: `The <b data-hue="red">slope</b> L′(w) tells which way is uphill. At w₀ = 0 it is −6, so the curve falls to the right. To go downhill, move against the slope.`,
  },
  {
    name: "One step",
    math: update,
    say: `One update subtracts the <b data-hue="green">step</b> η·L′ from w. The learning rate η sets how far one step goes. The new row in the table is w₁ and its loss.`,
  },
  {
    name: "Repeat",
    math: `${update}<mspace width="1em"/><mi>t</mi><mo>=</mo><mn>0</mn><mo>,</mo><mo>…</mo><mo>,</mo><mn>7</mn>`,
    say: `Repeat the same rule. Near the bottom the slope is small, so the steps get small too. Try each rate below: too small crawls, about right lands on 3, and too big jumps further out each time.`,
  },
  {
    name: "Compare",
    math: `<mo>(</mo>${wt1}<mo>−</mo><mn>3</mn><mo>)</mo><mo>=</mo><mo>(</mo><mn>1</mn><mo>−</mo><mn>2</mn>${eta}<mo>)</mo><mo>(</mo>${wt}<mo>−</mo><mn>3</mn><mo>)</mo>`,
    say: `For this loss, each step multiplies the distance to 3 by 1 − 2η. A factor of 0.9 is slow and 0.4 is fast. A factor of −1.1 flips sides and grows, so the <b data-hue="yellow">loss</b> goes up.`,
  },
];

const css = [
  `.el-right{transform:translate(${WIDE_RIGHT.x}px,${WIDE_RIGHT.y}px)}`,
  `.u-stage[data-narrow] .el-right{transform:translate(${NARROW.right.x}px,${NARROW.right.y}px)}`,
  `.u-stage[data-narrow] .u-num{display:inline;font-size:12px}`,
  `.u-stage[data-narrow] .u-tick-label{font-size:11px}`,
  `.el-guide{fill:none;stroke:var(--hue);stroke-width:.9;stroke-dasharray:2 3;opacity:.7;transition:d .6s var(--anatomy-ease)}`,
  `.el-wtick{fill:var(--hue);transition:transform .6s var(--anatomy-ease)}`,
  `.el-ball{transition:transform .6s var(--anatomy-ease)}`,
  `.el-ball circle{fill:var(--hue);stroke:var(--anatomy-card);stroke-width:2}`,
  `.el-tangent{fill:none;stroke:var(--hue);stroke-width:1.6;stroke-linecap:round;transition:d .6s var(--anatomy-ease),opacity .4s}`,
  `.el-glab{transition:transform .6s var(--anatomy-ease),opacity .4s}`,
  `.el-glab text{font:500 11px var(--anatomy-mono);fill:var(--hue);dominant-baseline:central}`,
  `.el-hstep{color:var(--hue);transition:opacity .4s}`,
  `.el-hline{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;transition:d .6s var(--anatomy-ease)}`,
  `.el-hhead{fill:currentColor;transition:d .6s var(--anatomy-ease)}`,
  `:is(#tangent,#glab,#hstep){opacity:0}`,
  `.u-stage:is([data-scene="1"],[data-scene="2"],[data-scene="3"]) :is(#tangent,#glab){opacity:1}`,
  `.u-stage:is([data-scene="2"],[data-scene="3"]) #hstep[data-on]{opacity:1}`,
  `.el-run{opacity:0;transition:opacity .5s}`,
  ...m.RUNS.map((_, k) => `.u-stage:is([data-scene="2"],[data-scene="3"])[data-rate="${k}"] .el-run[data-k="${k}"]{opacity:1}`),
  `.u-stage[data-scene="4"] .el-run{opacity:.2}`,
  ...m.RUNS.map((_, k) => `.u-stage[data-scene="4"][data-rate="${k}"] :is(.el-run,.el-lrun)[data-k="${k}"]{opacity:1}`),
  `.el-dot{fill:var(--hue)}`,
  `:is(.el-seg,.el-dot,.el-lseg,.el-ldot,.el-trow){transition:opacity .35s}`,
  `[data-later]:is(.el-seg,.el-dot,.el-lseg,.el-ldot,.el-trow){opacity:0}`,
  `.el-lrun{opacity:.35;transition:opacity .4s}`,
  `.el-lseg{fill:none;stroke:var(--hue);stroke-width:1.6;stroke-linecap:round}`,
  `.el-ldot{fill:var(--hue)}`,
  `.el-legend text{font:11px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.el-tnum,.el-thead{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-thead{font-style:italic}`,
  `.el-rates{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}`,
  `.el-rates button[aria-pressed="true"]{color:var(--unfold-green);box-shadow:0 0 0 1px var(--unfold-green)}`,
  ...colCss,
  u.placeCss("#lossplot", u.states(N, { 4: {} })),
  u.revealCss(2, "#colS", { kind: "fade", delay: 250 }),
].join("\n");

const key = u.keyHtml(
  [
    { hue: "blue", label: "parameter w" },
    { hue: "yellow", label: "loss L(w)" },
    { hue: "red", label: "slope L′(w)" },
    { hue: "green", label: "step η·L′" },
  ],
  { signs: true },
);
const picker = `<div class="el-rates" role="group" aria-label="Learning rate">${m.RUNS.map((r, k) => `<button type="button" data-rate="${k}" aria-pressed="${k === START_RATE}">η = ${r.eta} · ${r.name}</button>`).join("")}</div>`;
const stage = u
  .stageHtml({
    dwell: 9000,
    scenes,
    svg,
    label: "Gradient descent explainer. Left and right arrows change the scene. Up and down arrows change the learning rate. Comma and period step through the iterations.",
    css,
    key,
    controls: picker,
    time: { steps: m.STEPS + 1, label: "step", scenes: [3, 4] },
    narrow: [NARROW.w, NARROW.h],
  })
  .replace('class="u-stage"', `class="u-stage" data-rate="${START_RATE}"`);

// ---- Page script: one draw() from (scene, rate, t) ----
const DATA = m.RUNS.map((r) => ({ eta: r.eta, name: r.name, factor: r.factor, rows: r.rows, max: Object.fromEntries(COLS.map((c) => [c.key, colMax(r, c.key)])) }));
const script = `
const RUNS = ${JSON.stringify(DATA)};
const COLS = ${JSON.stringify(COLS.map((c) => c.key))};
const PL = ${JSON.stringify(PL)};
const OY = ${OY}, STEP_Y = ${STEP_Y}, LAST = ${m.STEPS};
const sx = (v) => PL.x + ((v - PL.xr[0]) / (PL.xr[1] - PL.xr[0])) * PL.w;
const sy = (v) => PL.y + PL.h - ((v - PL.yr[0]) / (PL.yr[1] - PL.yr[0])) * PL.h;
const root = UNFOLD.stage;
const $ = (s) => root.querySelector(s);
const readout = document.querySelector("[data-readout]");
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => String(n).split("").map((d) => SUB[d]).join("");
const f2 = (v) => fmt(v, 2);
const paren = (v) => (v < 0 ? "(" + f2(v) + ")" : f2(v));
let rate = ${START_RATE};
let t = 0;
let crossing = false;
const setD = (el, d) => (CSS.supports("d", 'path("M0 0")') ? (el.style.d = 'path("' + d + '")') : el.setAttribute("d", d));

function draw() {
  const scene = UNFOLD.scene();
  const run = RUNS[rate];
  const row = run.rows[t];
  root.dataset.rate = rate;
  const x = sx(row.w), y = sy(row.L);
  $("#ball").style.transform = "translate(" + x + "px," + y + "px)";
  $("#wtick").style.transform = "translateX(" + x + "px)";
  setD($("#guide"), "M" + x + " " + y + "V" + OY);
  // Tangent: about 120 px long on screen, through the point, with the true slope.
  const kx = PL.w / (PL.xr[1] - PL.xr[0]), ky = PL.h / (PL.yr[1] - PL.yr[0]);
  // Each half stops at the plot's L range, so it never covers the tick labels.
  const dw = 60 / Math.hypot(kx, ky * row.g);
  const room = (dir) => (row.g * dir === 0 ? dw : Math.min(dw, ((row.g * dir < 0 ? row.L - PL.yr[0] : PL.yr[1] - row.L) / Math.abs(row.g))));
  const dl = room(-1), dr = room(1);
  const ax = sx(row.w - dl), ay = sy(row.L - row.g * dl), bx = sx(row.w + dr), by = sy(row.L + row.g * dr);
  setD($("#tangent"), "M" + ax + " " + ay + "L" + bx + " " + by);
  // The label sits on the inside of the curve, toward the minimum, where there is no curve to cover.
  $("#glab").style.transform = "translate(" + (row.w > 3 ? x - 84 : x + 10) + "px," + (y - 16) + "px)";
  $("#glab text").textContent = "L′ = " + f2(row.g);
  // The step along the w axis, from the previous w to this one.
  const hs = $("#hstep");
  const prev = t ? run.rows[t - 1].w : row.w;
  const x0 = sx(prev), dir = Math.sign(x - x0), len = Math.abs(x - x0);
  hs.toggleAttribute("data-on", len > 2);
  if (len > 2) {
    const head = Math.min(6, len * 0.45);
    setD(hs.querySelector(".el-hline"), "M" + x0 + " " + STEP_Y + "H" + (x - dir * head));
    setD(hs.querySelector(".el-hhead"), "M" + x + " " + STEP_Y + "L" + (x - dir * head) + " " + (STEP_Y - 4) + "L" + (x - dir * head) + " " + (STEP_Y + 4) + "Z");
  }
  root.querySelectorAll("[data-t]").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.t) > t));
  // The table: this run's values, rows up to t.
  COLS.forEach((key) => setGrid($("#grid-" + key), run.rows.map((r) => [r[key]]), run.max[key]));
  showRows($("#table"), t);
  root.querySelectorAll(".el-trow").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.r) > t));
  mark($("#table"), t);
  root.querySelectorAll(".el-rates [data-rate]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.rate) === rate)));
  UNFOLD.timeAt(t);
  let text;
  if (scene === 0) text = "w₀ = 0.00 · L(w₀) = (0.00 − 3)² = 9.00";
  else if (scene === 1) text = "L′(w₀) = 2 × (0.00 − 3) = −6.00 · negative, so downhill is to the right";
  else if (scene === 4) text = "η = " + run.eta + " · distance to 3 × " + f2(run.factor) + " per step · t = " + t + ": w = " + f2(row.w) + ", L = " + f2(row.L);
  else if (t === 0) text = "η = " + run.eta + " · t = 0 · w₀ = 0.00, L′ = −6.00, L = 9.00";
  else {
    const p = run.rows[t - 1];
    text = "η·L′ = " + run.eta + " × " + paren(p.g) + " = " + f2(p.step) + " · w" + sub(t) + " = " + f2(p.w) + " − " + paren(p.step) + " = " + f2(row.w) + " · L = " + f2(row.L);
  }
  if (readout.textContent !== text) readout.textContent = text;
}

function setT(n) {
  t = Math.max(0, Math.min(LAST, n));
  draw();
}
const START = [0, 0, 1, 0, 0];
root.addEventListener("unfold:scene", (e) => {
  if (!crossing) setT(START[e.detail.scene]);
});
// Stepping by hand in scenes 1-3 moves to "Repeat", which owns the steps.
UNFOLD.onTime((n) => {
  if (UNFOLD.scene() < 3) {
    crossing = true;
    UNFOLD.go(3);
    crossing = false;
  }
  setT(n);
});
UNFOLD.beat(3, 700, (n) => setT(n < 0 ? LAST : n), 900);
UNFOLD.beat(4, 600, (n) => setT(n < 0 ? LAST : n), 700);
function pickRate(k) {
  rate = (k + RUNS.length) % RUNS.length;
  UNFOLD.pause();
  if (UNFOLD.scene() < 2) {
    crossing = true;
    UNFOLD.go(3);
    crossing = false;
  }
  // A new rate shows its whole run; the step control steps back through it.
  setT(UNFOLD.scene() === 2 ? 1 : LAST);
}
root.querySelector(".el-rates").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rate]");
  if (b) pickRate(Number(b.dataset.rate));
});
root.addEventListener("keydown", (e) => {
  const by = { ArrowUp: -1, ArrowDown: 1 }[e.key];
  if (by === undefined) return;
  e.preventDefault();
  pickRate(rate + by);
});
draw();
`;

const notes = u.notesHtml([
  {
    title: "Why the factor is 1 − 2η",
    html: `<p>Put the slope into the update rule: <code>w − η·2(w − 3) − 3 = (1 − 2η)(w − 3)</code>. So the distance to the minimum is multiplied by the same number at every step. The size of that number decides what happens.</p>`,
    table: {
      head: ["Learning rate η", "Factor 1 − 2η", "What happens"],
      rows: [
        ["0 < η < 0.5", "between 0 and 1", "w moves toward 3 from one side. A small η means many steps."],
        ["η = 0.5", "0", "w lands on 3 in one step. This only works because the loss is an exact parabola."],
        ["0.5 < η < 1", "between −1 and 0", "w jumps over 3 every step, but the jumps shrink. It still converges."],
        ["η = 1", "−1", "w bounces between 0 and 6 forever."],
        ["η > 1", "below −1", "w jumps over 3 and lands further away each time. The loss grows."],
      ],
    },
  },
  {
    title: "The general rule",
    html: `<p>The limit of 1 comes from the curvature. Here the second derivative is <code>L″ = 2</code>, and a step is stable only when <code>η &lt; 2 / L″</code>. A steeper valley needs a smaller learning rate. In a real model, the curvature differs per direction. The steepest direction sets the largest safe rate, and the flattest direction then moves slowly.</p>`,
  },
  {
    title: "What this figure leaves out",
    html: `<ul>
<li><b>Many parameters.</b> A real model has millions of parameters. L′ becomes the gradient vector ∇L, but each parameter follows the same rule.</li>
<li><b>Noisy gradients.</b> Stochastic gradient descent estimates the gradient from a small batch of data, so each step is a little wrong.</li>
<li><b>Curves that are not parabolas.</b> A real loss can have flat regions, saddle points and several minima. The rule only sees the local slope.</li>
<li><b>Better update rules.</b> Learning-rate schedules, momentum and Adam change the step size during training.</li>
</ul>`,
  },
  {
    title: "Terms",
    html: `<ul>
<li><b>Parameter (w):</b> the number the model learns.</li>
<li><b>Loss (L):</b> one number that says how wrong the model is. Lower is better.</li>
<li><b>Slope or gradient (L′):</b> how fast the loss changes when w changes. Its sign points uphill.</li>
<li><b>Learning rate (η):</b> the number that scales each step.</li>
<li><b>Converge / diverge:</b> the steps settle at the minimum, or they move further away.</li>
</ul>`,
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Gradient descent",
    hint: "← → scene · ↑ ↓ rate · , . step",
    readout: "w₀ = 0.00 · L(w₀) = (0.00 − 3)² = 9.00",
    caption:
      "The loss L(w) = (w − 3)², the start w₀ = 0 and the three learning rates were chosen by hand to show each case. Every printed value is computed, rounded to 2 decimals (half away from zero), and each step uses the rounded values of the step before, so each row can be redone by hand.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "gradient-descent-light.html" : "gradient-descent.html");
const title = "Gradient descent";
const html = artifact > 0 ? u.artifactHtml({ title, body, script }) : u.pageHtml({ title, theme, body, script });
writeFileSync(file, html);
console.log("wrote", file);
