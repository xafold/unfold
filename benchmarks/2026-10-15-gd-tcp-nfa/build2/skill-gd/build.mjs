import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as m from "./model.mjs";

const { u } = m;
const { iso, mi, prime } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const W = 820;
const H = 350;
const NARROW = [400, 600];
const FIRST_RUN = 3; // scenes 3..6 run 6 steps
const EXPLORE = 6;
const START_K = 15; // eta = 0.75 in the "Any eta" scene
const K = (eta) => Math.round(eta * 20);

// Colour identity: weight yellow, loss blue, slope red, learning rate and step green, gap purple.
const P = { x: 40, y: 26, w: 340, h: 262, xr: [-1, 7], yr: [0, 13] };
const plot = u.plot({ id: "plot", ...P, f: m.loss, xTicks: [-1, 0, 1, 2, 3, 4, 5, 6, 7], yTicks: [4, 8, 12], xName: "w", yName: "L", hue: "blue", xHue: "yellow", yHue: "blue" });
const AXIS = plot.sy(0);
const [minX] = plot.at(3, 0);

// Moving parts, drawn at w = 1 and moved by the page (CSS transitions on d and transform).
const r0 = m.run(m.PRESET.right);
const [px, py] = plot.at(1, 4);
const live = [
  `<g class="el-min"><path class="u-guide" d="M${minX} ${AXIS}V${plot.sy(2.3)}"/><circle cx="${minX}" cy="${AXIS}" r="2.6"/><text class="el-lab" x="${minX}" y="${plot.sy(2.7)}" text-anchor="middle">lowest loss</text></g>`,
  `<g class="el-stepviz"><path id="trail" class="el-trail" d=""/>${r0.map((_, i) => `<g class="el-dot" data-i="${i}" style="transform:translate(${px}px,${py}px)"><circle r="2.4"/></g>`).join("")}</g>`,
  `<path id="height" class="el-height" d="M${px} ${AXIS}V${py}"/>`,
  `<g id="hlab" class="el-move" style="transform:translate(${px - 6}px,${(AXIS + py) / 2}px)"><text class="el-lab el-hue" data-hue="blue" x="0" y="4" text-anchor="end">L</text></g>`,
  `<g class="el-slope"><path id="tangent" class="el-tangent" d=""/><g id="slab" class="el-move"><text class="el-lab el-hue" data-hue="red" x="0" y="0">slope</text></g></g>`,
  `<g class="el-stepviz"><g id="ghost" class="el-move" style="transform:translate(${px}px,${py}px)"><circle class="el-ghost" r="5"/></g>` +
    `<g class="el-step"><path id="sline" class="el-sline" d=""/><path id="shead" class="el-shead" d=""/><g id="slab2" class="el-move"><text class="el-lab el-hue" data-hue="green" x="0" y="0" text-anchor="middle">step</text></g></g></g>`,
  `<g class="el-gap"><path id="gap" class="el-gapline" d=""/><g id="glab" class="el-move"><text class="el-lab el-hue" data-hue="purple" x="0" y="0" text-anchor="middle"></text></g></g>`,
  `<g id="point" class="el-move" style="transform:translate(${px}px,${py}px)"><circle class="el-point" r="5"/></g>`,
  `<g id="wlab" class="el-move" style="transform:translate(${px}px,${AXIS + 30}px)"><text class="el-lab el-hue" data-hue="yellow" x="0" y="0" text-anchor="middle">w = 1.000</text></g>`,
].join("");

// ---- Iteration table: one column grid per quantity, rows t = 0..6 ----
const CELL = [72, 22];
const COLS = [
  { id: "gW", key: "w", hue: "yellow", head: `<tspan data-hue="yellow">w</tspan>`, max: 7, cls: "" },
  { id: "gG", key: "g", hue: "red", head: `<tspan data-hue="red">L′(w)</tspan>`, max: 8, cls: "col-g" },
  { id: "gS", key: "step", hue: "green", head: `<tspan data-hue="green">−η·L′</tspan>`, max: 8, cls: "col-s" },
  { id: "gL", key: "L", hue: "blue", head: `<tspan data-hue="blue">L(w)</tspan>`, max: 13, cls: "" },
];
const COL_X = (i) => 30 + i * 78;
const table = [
  `<text id="ttl" class="el-ttl" x="0" y="0">η = 0.25</text>`,
  `<text id="verdict" class="el-verdict" x="0" y="222"></text>`,
  `<text class="el-head" x="8" y="30" text-anchor="middle">t</text>`,
  r0.map((r) => `<text class="el-t" data-r="${r.t}" x="8" y="${44 + r.t * CELL[1] + 11}" text-anchor="middle">${r.t}</text>`).join(""),
  COLS.map(
    (c, i) =>
      `<g class="el-col ${c.cls}" transform="translate(${COL_X(i)} 0)"><text class="el-head el-hue" x="${CELL[0] / 2}" y="30" text-anchor="middle">${c.head}</text>` +
      `<g transform="translate(0 44)">${u.cellGrid({ id: c.id, values: r0.map((r) => [r[c.key]]), hue: c.hue, cell: CELL, max: c.max, places: 3, dims: false })}</g></g>`,
  ).join(""),
].join("");

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "Gradient descent on the loss L(w) = (w − 3)², with the weight as a point on the curve, the slope as a tangent, each step as an arrow, and a table of every step.",
  body: [`<g class="el-left">${plot.svg}${live}</g>`, `<g class="el-right">${table}</g>`],
});

// ---- Math and scenes ----
const w = mi("w", "yellow");
const wt = `<msub>${w}<mi>t</mi></msub>`;
const wt1 = `<msub>${w}<mrow><mi>t</mi><mo>+</mo><mn>1</mn></mrow></msub>`;
const Lp = (arg) => `${prime("L", "red")}<mo>(</mo>${arg}<mo>)</mo>`;
const update = (eta) => `${wt1}<mo>=</mo>${wt}<mo>−</mo>${eta}<mo>·</mo>${Lp(wt)}`;
const num = (v) => `<mn data-hue="green">${v}</mn>`;
const b = (hue, text) => `<b data-hue="${hue}">${text}</b>`;
const scenes = [
  {
    name: "Loss",
    math: `${mi("L", "blue")}<mo>(</mo>${w}<mo>)</mo><mo>=</mo><msup><mrow><mo>(</mo>${w}<mo>−</mo><mn>3</mn><mo>)</mo></mrow><mn>2</mn></msup>`,
    say: `The ${b("blue", "loss")} L measures how wrong the ${b("yellow", "weight")} w is. It is lowest at w = 3, so training must find that point.`,
  },
  {
    name: "Slope",
    math: `${Lp(w)}<mo>=</mo><mn>2</mn><mo>(</mo>${w}<mo>−</mo><mn>3</mn><mo>)</mo>`,
    say: `The ${b("red", "slope")} L′ tells which way the loss goes up. At w = 1 the slope is negative, so the loss falls to the right.`,
  },
  {
    name: "One step",
    math: update(mi("η", "green")),
    say: `Gradient descent moves w against the slope. The ${b("green", "learning rate")} η sets how far: 0.25 × 4 = 1, so w goes from 1 to 2.`,
  },
  {
    name: "Too small",
    math: update(num("0.05")),
    say: `With η = 0.05, each step closes only a tenth of the ${b("purple", "gap")} between w and 3. After 6 steps, w is still at 1.937.`,
  },
  {
    name: "About right",
    math: update(num("0.25")),
    say: `With η = 0.25, each step halves the ${b("purple", "gap")}. After 6 steps, w is at 2.969 and still moves closer to 3.`,
  },
  {
    name: "Too big",
    math: update(num("1.05")),
    say: `With η = 1.05, each step jumps past 3 and lands further away. The loss grows at every step, so w never reaches 3.`,
  },
  {
    name: "Any η",
    math: `${wt1}<mo>−</mo><mn>3</mn><mo>=</mo><mo>(</mo><mn>1</mn><mo>−</mo><mn>2</mn>${mi("η", "green")}<mo>)</mo><mrow data-hue="purple"><mo>(</mo>${wt}<mo>−</mo><mn>3</mn><mo>)</mo></mrow>`,
    say: `Each step multiplies the ${b("purple", "gap")} by 1 − 2η. The gap shrinks only when this factor is between −1 and 1.`,
  },
];

const hide = (scenesList, sel) => scenesList.map((s) => `.u-stage[data-scene="${s}"] ${sel}{opacity:0}`).join("\n");
const css = [
  `.el-lab{font:500 11px var(--anatomy-mono);fill:var(--anatomy-muted);paint-order:stroke;stroke:var(--anatomy-card);stroke-width:3px;stroke-linejoin:round}`,
  `.el-hue[data-hue],.el-hue [data-hue]{fill:var(--hue)}`,
  `.el-min circle{fill:var(--anatomy-hi)}`,
  `.el-move{transition:transform .6s var(--anatomy-ease),opacity .4s}`,
  `.el-point{fill:var(--unfold-yellow);stroke:var(--anatomy-card);stroke-width:1.5}`,
  `.el-ghost{fill:none;stroke:var(--unfold-yellow);stroke-width:1.3;stroke-dasharray:2 2}`,
  `.el-height{stroke:var(--unfold-blue);stroke-width:2.2;fill:none;transition:d .6s var(--anatomy-ease)}`,
  `.el-tangent{stroke:var(--unfold-red);stroke-width:1.6;fill:none;stroke-linecap:round;transition:d .6s var(--anatomy-ease)}`,
  `.el-trail{stroke:var(--unfold-green);stroke-width:1.2;fill:none;stroke-opacity:.7;stroke-dasharray:3 2;transition:d .6s var(--anatomy-ease)}`,
  `.el-dot{transition:transform .6s var(--anatomy-ease),opacity .4s}.el-dot circle{fill:var(--unfold-yellow);fill-opacity:.55}`,
  `.el-sline{stroke:var(--unfold-green);stroke-width:1.8;fill:none;transition:d .6s var(--anatomy-ease)}`,
  `.el-shead{fill:var(--unfold-green);transition:d .6s var(--anatomy-ease)}`,
  `.el-gapline{stroke:var(--unfold-purple);stroke-width:1.6;fill:none;transition:d .6s var(--anatomy-ease)}`,
  `:is(.el-slope,.el-stepviz,.el-gap,#hlab,.el-col,#ttl){transition:opacity .45s var(--anatomy-ease)}`,
  hide([0], ".el-slope"),
  hide([0, 1], ".el-stepviz"),
  hide([0, 1, 2, 3, 4, 5], ".el-gap"),
  hide([0], ".col-g"),
  hide([0, 1], ".col-s"),
  hide([0, 1], "#ttl"),
  hide([0, 1, 2, 3, 4, 5], "#verdict"),
  `.el-verdict{font:12px var(--anatomy-mono);fill:var(--anatomy-strong);transition:opacity .45s}`,
  `.el-ttl{font:500 12px var(--anatomy-mono);fill:var(--unfold-green)}`,
  `.el-head{font:italic 600 15px var(--unfold-serif);fill:var(--anatomy-muted)}`,
  `.el-head [data-hue]{fill:var(--hue)}`,
  `.el-t{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central;transition:opacity .3s}`,
  `.el-t[data-later]{opacity:0}`,
  `.el-right .u-num{font-size:11px}`,
  `.el-right{transform:translate(445px,60px)}`,
  `.u-stage[data-narrow] .el-right{transform:translate(32px,370px)}`,
  `.u-stage[data-narrow] .el-right .u-num{display:inline;font-size:12px}`,
  `.u-stage[data-narrow] :is(.el-lab,.u-tick-label){font-size:13px}`,
  `.el-eta{display:inline-flex;align-items:center;gap:8px;font:12px var(--anatomy-mono);color:var(--anatomy-muted);transition:opacity .4s}`,
  `.el-eta span{font:italic 600 16px var(--unfold-serif);color:var(--unfold-green)}`,
  `.el-eta input{width:140px;accent-color:var(--unfold-green)}`,
  `.el-eta output{min-width:3.2em;color:var(--anatomy-strong);font-variant-numeric:tabular-nums}`,
  `.u-stage:not([data-scene="${EXPLORE}"]) .el-eta{opacity:.5}`,
].join("\n");

const key = u.keyHtml(
  [
    { hue: "yellow", label: "weight w" },
    { hue: "blue", label: "loss L" },
    { hue: "red", label: "slope L′" },
    { hue: "green", label: "learning rate η and step" },
    { hue: "purple", label: "gap w − 3" },
  ],
  { signs: true },
);

const controls = `<label class="el-eta"><span>η</span><input type="range" min="1" max="21" step="1" value="${START_K}" aria-label="Learning rate η for the last scene"><output>${u.fmt(START_K / 20, 2)}</output></label>`;
const stage = u.stageHtml({
  scenes,
  svg,
  label: "Gradient descent explainer. Left and right arrows change the scene. Comma and period step through the 6 steps. Up and down arrows change the learning rate.",
  css,
  key,
  dwell: 10000,
  time: { steps: m.STEPS + 1, scenes: [3, 4, 5, 6] },
  controls,
  narrow: NARROW,
});

// ---- The page script: one draw(k, t) updates every view from the model's runs ----
const RUNS = Object.fromEntries(m.ETAS.map((eta) => [K(eta), m.run(eta).map((r) => ({ ...r, text: m.rowText(r) }))]));
const VERDICT = Object.fromEntries(m.ETAS.map((eta) => [K(eta), m.verdict(eta)]));
const script = `
const RUNS = ${JSON.stringify(RUNS)};
const VERDICT = ${JSON.stringify(VERDICT)};
const P = ${JSON.stringify(P)};
const AXIS = ${AXIS};
const STEPS = ${m.STEPS};
const SCENE_K = { 0: 5, 1: 5, 2: 5, 3: 1, 4: 5, 5: 21 };
const COLS = ${JSON.stringify(COLS.map(({ id, key, max }) => ({ id, key, max })))};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const slider = root.querySelector(".el-eta input");
const sliderOut = root.querySelector(".el-eta output");
const $ = (id) => root.querySelector("#" + id);
const sx = (v) => P.x + ((v - P.xr[0]) / (P.xr[1] - P.xr[0])) * P.w;
const sy = (v) => P.y + P.h - ((v - P.yr[0]) / (P.yr[1] - P.yr[0])) * P.h;
const r1 = (v) => Math.round(v * 10) / 10;
const etaText = (k) => fmt(k / 20, 2);
const setD = (el, d) => (el.style.d = 'path("' + (d || "M0 0") + '")');
const move = (el, x, y) => (el.style.transform = "translate(" + r1(x) + "px," + r1(y) + "px)");
const clampX = (x) => Math.max(P.x + 30, Math.min(P.x + P.w - 10, x));
let k = SCENE_K[0];
let exploreK = ${START_K};
let t = 0;

function draw() {
  const scene = UNFOLD.scene();
  const rows = RUNS[k];
  const r = rows[t];
  const x = sx(r.w), y = sy(r.L);
  move($("point"), x, y);
  setD($("height"), "M" + r1(x) + " " + AXIS + "V" + r1(y));
  const hlab = $("hlab");
  hlab.style.opacity = AXIS - y > 18 ? 1 : 0;
  hlab.querySelector("text").setAttribute("text-anchor", r.w <= 3 ? "end" : "start");
  move(hlab, x + (r.w <= 3 ? -6 : 6), (AXIS + y) / 2);
  move($("wlab"), clampX(x), AXIS + 30);
  $("wlab").querySelector("text").textContent = "w = " + r.text.w;

  // Tangent: direction (1, slope) in data units, 46 px each way on screen.
  const dx = P.w / (P.xr[1] - P.xr[0]), dy = -(r.g * P.h) / (P.yr[1] - P.yr[0]);
  const n = Math.hypot(dx, dy), ux = (dx / n) * 36, uy = (dy / n) * 36;
  setD($("tangent"), "M" + r1(x - ux) + " " + r1(y - uy) + "L" + r1(x + ux) + " " + r1(y + uy));
  const low = uy > 0.5 ? 1 : uy < -0.5 ? -1 : 1;
  const ex = x + low * ux, ey = y + low * uy;
  const slab = $("slab").querySelector("text");
    slab.setAttribute("text-anchor", ex >= x ? "start" : "end");
  move($("slab"), ex + (ex >= x ? 4 : -4), ey + (Math.abs(uy) > 8 ? 12 : -8));

  // The step from t to t + 1, on the w axis, and the next point as a dashed ghost.
  const next = rows[Math.min(t + 1, STEPS)];
  const showStep = t < STEPS;
  const x2 = sx(next.w), ay = AXIS - 10, dir = Math.sign(x2 - x) || 1, head = Math.min(6, Math.abs(x2 - x));
  setD($("sline"), "M" + r1(x) + " " + ay + "H" + r1(x2 - dir * head));
  setD($("shead"), "M" + r1(x2) + " " + ay + "L" + r1(x2 - dir * head) + " " + (ay - 3.5) + "L" + r1(x2 - dir * head) + " " + (ay + 3.5) + "Z");
  root.querySelector(".el-step").style.opacity = showStep ? 1 : 0;
    move($("slab2"), Math.max(P.x + 50, Math.min(P.x + P.w - 50, (x + x2) / 2)), ay - 9);
  move($("ghost"), x2, sy(next.L));
  $("ghost").style.opacity = showStep ? 1 : 0;

  // Trail through points 0..t; later points wait on point t, so the path keeps 7 points and morphs.
  const pts = rows.map((p, i) => rows[Math.min(i, t)]).map((p) => r1(sx(p.w)) + " " + r1(sy(p.L)));
  setD($("trail"), "M" + pts.join("L"));
  root.querySelectorAll(".el-dot").forEach((d) => {
    const i = Number(d.dataset.i), p = rows[Math.min(i, t)];
    move(d, sx(p.w), sy(p.L));
    d.style.opacity = i < t ? 1 : 0;
  });

  // Gap w - 3 under the w axis.
  const gx = sx(3), gy = AXIS + 44;
  setD($("gap"), "M" + r1(x) + " " + (gy - 4) + "V" + gy + "H" + r1(gx) + "V" + (gy - 4));
  $("glab").querySelector("text").textContent = "gap " + r.text.gap;
  move($("glab"), Math.max(P.x + 40, Math.min(P.x + P.w - 40, (x + gx) / 2)), gy + 13);

  // Table: rows 0..t (row 1 too in "One step"), the current row marked.
  const shown = scene === 2 ? 1 : scene < 2 ? 0 : t;
  for (const c of COLS) {
    const g = $(c.id);
    setGrid(g, rows.map((row) => [row[c.key]]), c.max);
    g.querySelectorAll(".u-num").forEach((el) => (el.textContent = rows[Number(el.parentNode.dataset.r)].text[c.key]));
    showRows(g, shown);
  }
  root.querySelectorAll(".el-t").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.r) > shown));
  mark(root, scene < 3 ? 0 : t);
  const f = 1 - 2 * (k / 20);
  $("verdict").textContent = VERDICT[k];
  $("ttl").textContent = "η = " + etaText(k) + (scene >= 3 ? " · gap × " + fmt(f, 2) + " per step" : "");

  // Readout: the arithmetic for this scene and step.
  let text;
  if (scene === 0) text = "L(1) = (1 − 3)² = 4";
  else if (scene === 1) text = "L′(1) = 2 × (1 − 3) = −4";
  else if (scene === 2) text = "w₁ = 1 − 0.25 × (−4) = 2";
  else if (t === 0) text = "t 0 · w = 1 · L = 4" + (scene === ${EXPLORE} ? " · η = " + etaText(k) + ": " + VERDICT[k] : "");
  else {
    const p = rows[t - 1].text;
    text = "t " + t + " · w = " + p.w + " − " + etaText(k) + " × (" + p.g + ") = " + r.text.w + " · L = " + r.text.L;
  }
  if (readout.textContent !== text) readout.textContent = text;
  UNFOLD.timeAt(scene >= 3 ? t : 0);
}

function setEta(next) {
  exploreK = Math.max(1, Math.min(21, next));
  slider.value = String(exploreK);
  sliderOut.textContent = etaText(exploreK);
  if (UNFOLD.scene() !== ${EXPLORE}) UNFOLD.go(${EXPLORE});
  else {
    k = exploreK;
    draw();
  }
  UNFOLD.pause();
}

root.addEventListener("unfold:scene", (e) => {
  const s = e.detail.scene;
  k = s === ${EXPLORE} ? exploreK : SCENE_K[s];
  t = 0;
  draw();
});
for (let s = ${FIRST_RUN}; s <= ${EXPLORE}; s++) UNFOLD.beat(s, 1000, (n) => ((t = n < 0 ? STEPS : Math.min(n + 1, STEPS)), draw()), 1200);
UNFOLD.onTime((to) => {
  if (UNFOLD.scene() < ${FIRST_RUN}) UNFOLD.go(${FIRST_RUN});
  t = to;
  draw();
});
slider.addEventListener("input", () => setEta(Number(slider.value)));
slider.addEventListener("keydown", (e) => e.stopPropagation());
root.addEventListener("keydown", (e) => {
  const by = { ArrowUp: 1, ArrowDown: -1 }[e.key];
  if (by === undefined) return;
  e.preventDefault();
  setEta(exploreK + by);
});
root.addEventListener("unfold:layout", draw);
draw();
`;

// ---- Notes under the card ----
const c = (text) => `<code>${text}</code>`;
const NOTE_ETAS = [0.05, 0.25, 0.5, 0.75, 1.0, 1.05];
const after = (eta) => m.rowText(m.run(eta)[m.STEPS]);
const nx = (eta) => 30 + (eta / 1.2) * 580;
const band = (a, z, alpha, label) =>
  `<rect x="${nx(a)}" y="22" width="${nx(z) - nx(a)}" height="10" fill="var(--unfold-green)" fill-opacity="${alpha}"/><text x="${(nx(a) + nx(z)) / 2}" y="52" text-anchor="middle" fill="var(--anatomy-text)" font-size="11">${label}</text>`;
const tick = (eta, label, hue = "") =>
  `<path d="M${nx(eta)} 18V36" stroke="${hue ? `var(--unfold-${hue})` : "var(--anatomy-mid)"}" stroke-width="${hue ? 2 : 1}"/><text x="${nx(eta)}" y="12" text-anchor="middle" font-size="11" fill="${hue ? `var(--unfold-${hue})` : "var(--anatomy-muted)"}">${label}</text>`;
const etaLine = `<svg viewBox="0 0 640 64" role="img" aria-label="The learning rate on a line from 0 to 1.2, with what each region does to the gap." style="font-family:var(--anatomy-mono)">
${band(0, 0.5, 0.5, "one side, smaller each step")}
${band(0.5, 1, 0.25, "jumps past 3, still shrinks")}
${band(1, 1.2, 0.08, "grows")}
<text x="12" y="31" font-size="14" font-style="italic" fill="var(--unfold-green)">η</text>${tick(0, "0")}${tick(0.05, "0.05", "green")}${tick(0.25, "0.25", "green")}${tick(0.5, "0.5")}${tick(1, "1")}${tick(1.05, "1.05", "green")}
</svg>`;

const notes = u.notesHtml([
  {
    title: "Why the learning rate decides",
    html:
      `<p>For this loss, each step multiplies the gap by 1 − 2η. So η = 0.5 lands on 3 in one step, and any η above 1 makes the gap grow.</p>` +
      etaLine +
      `<p>For a real loss, nobody knows the best η in advance, so people try several values.</p>`,
    table: {
      head: ["η", "Gap factor 1 − 2η", "w after 6 steps", "L after 6 steps", "What happens"],
      rows: NOTE_ETAS.map((eta) => [u.fmt(eta, 2), u.fmt(m.factor(eta), 2), after(eta).w, after(eta).L, m.verdict(eta)]),
    },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["Left out", "What really happens"],
      rows: [
        ["Many weights", "A model has millions of weights. The gradient holds one slope per weight, and each weight takes its own step."],
        ["Curved losses", "A real loss has hills, flat areas and more than one low point. The slope changes at a different rate in each place."],
        ["Mini-batches", `Stochastic gradient descent (SGD) computes the slope on a small sample of the data. Each step is then a little noisy.`],
        ["Changing η", "A schedule makes η smaller during training. Momentum and Adam also change the step size for each weight."],
        ["When to stop", "Training stops after a fixed number of steps, or when the loss stops falling."],
      ],
    },
  },
  {
    title: "Words used here",
    table: {
      head: ["Term", "Meaning"],
      rows: [
        ["Weight w", "the number the model learns"],
        ["Loss L(w)", "how wrong the model is with weight w"],
        ["Slope L′(w)", "how fast the loss changes as w grows. With many weights: the gradient."],
        ["Learning rate η", "the number that scales each step"],
        ["Step −η·L′(w)", "how much w changes in one update"],
        ["Gap w − 3", "how far w is from the lowest loss"],
        ["Converge", "move closer to the lowest loss at every step"],
        ["Diverge", `move further away at every step, as with ${c("η = 1.05")}`],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Gradient descent",
    hint: "← → scene · , . step · ↑ ↓ learning rate",
    readout: "L(1) = (1 − 3)² = 4",
    caption:
      "The loss (w − 3)², the start w = 1 and the learning rates were chosen by hand to keep the numbers short. The script model.mjs computes every value in full precision. The page prints 3 places, so a hand check can differ in the last digit. A value closer than 0.0005 to 3 or 0 gets more digits, so rounding never shows a false 3 or 0.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "gradient-descent-light.html" : "gradient-descent.html");
const html = artifact > 0 ? u.artifactHtml({ title: "Gradient descent", body, script }) : u.pageHtml({ title: "Gradient descent", theme, body, script });
writeFileSync(file, html);
console.log("wrote", file);
