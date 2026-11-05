import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const W = 820;
const H = 390;
const DY = -34; // flat scenes sit this far up, so the drawing has no empty band
const CW = 32;
const CH = 20;
const QUERY = 2; // "sat": the tour shows this row

// Colour identity, held in every scene, in the math and in the key.
const HUE = { X: "ink", Q: "blue", K: "yellow", V: "red", S: "purple", A: "green", O: "teal" };

// ---- Scene 1: the whole head as tensor blocks (iso camera from the anatomy kit) ----
const BLOCKS = {
  X: { at: [0, 0, 0], values: m.X },
  Q: { at: [90, -80, 0], values: m.Q },
  K: { at: [90, 0, 0], values: m.K },
  V: { at: [90, 80, 0], values: m.V },
  A: { at: [170, -40, 0], values: m.A },
  O: { at: [290, 40, 0], values: m.O },
};
const corners = Object.values(BLOCKS).flatMap(({ at, values }) => iso.boxCorners({ x: at[0], y: at[1], w: values[0].length * 10, d: values.length * 10, r: 0 }, 0, 3));
const P = iso.fitProjection([...corners, [-40, 0, 0], [-40, 60, 0], [0, -14, 0]], W, H, { pad: 40, azimuth: 60 });
const at = (p) => iso.iso(p, P);
const mid = (name, side) => {
  const { at: [x, y], values } = BLOCKS[name];
  const w = values[0].length * 10;
  const d = values.length * 10;
  return at(side === "in" ? [x, y + d / 2, 1.5] : [x + w, y + d / 2, 1.5]);
};

function overview() {
  const order = Object.entries(BLOCKS).sort(([, a], [, b]) => iso.depthOf(a.at, P) - iso.depthOf(b.at, P));
  // Pipeline stage of each block and link: the entrance and the travelling values follow it.
  const STAGE = { X: 0, Q: 1, K: 1, V: 1, A: 2, O: 3 };
  const links = [["X", "Q"], ["X", "K"], ["X", "V"], ["Q", "A"], ["K", "A"], ["A", "O"], ["V", "O"]];
  const flow = links.map(([a, b]) => `<g style="--r:${STAGE[a]}">${u.arrow(mid(a, "out"), mid(b, "in"), { hue: HUE[b], bend: 0 })}</g>`);
  const pulses = links.map(([a, b]) => u.pulseSvg(mid(a, "out"), mid(b, "in"), { hue: HUE[b], begin: 1.6 + Math.min(STAGE[a], 2) * 0.9 }));
  const blocks = order.map(([name, { at: pos, values }]) => {
    const w = values[0].length * 10;
    return (
      `<g class="u-rise" data-block="${name}" style="--r:${STAGE[name]}">` +
      u.tensorBlock(P, { at: pos, values, hue: HUE[name] }) +
      `<g data-hue="${HUE[name]}">${u.floorText(P, [pos[0], pos[1] - 5], 3, name, { size: 11 })}</g>` +
      u.floorText(P, [pos[0] + 11, pos[1] - 5], 3,`${values.length}×${w / 10}`, { size: 6, cls: "u-floor-label" }) +
      `</g>`
    );
  });
  const words = m.TOKENS.map((t, r) => `<g class="u-word" data-i="${r}">${u.floorText(P, [-5, r * 10 + 7], 0, t, { size: 5, cls: "u-floor-label", anchor: "end" })}</g>`);
  return `<g class="u-move" id="gIso">${flow.join("")}${words.join("")}${blocks.join("")}${pulses.join("")}</g>`;
}

// ---- Flat scenes: real matrices with real numbers ----
const rowChips = `<g class="u-move" id="gRows">${m.TOKENS.map((t, i) => u.chip(t, 0, i * CH + 2, { w: 48, i })).join("")}</g>`;
const colChips = `<g class="u-move" id="gCols">${m.TOKENS.map((t, i) => u.chip(t, i * CW + 1, 0, { w: CW - 2 })).join("")}</g>`;
const grid = (id, values, hue, extra = {}) => `<g class="u-move" id="${id}">${u.cellGrid({ id: `${id}-grid`, values, hue, cell: [CW, CH], ...extra })}</g>`;

const contrib = (i) => m.V.map((row, j) => row.map((v) => Math.round(m.A[i][j] * v * 100) / 100));
const sumOf = (i) => [contrib(i).reduce((acc, row) => acc.map((v, k) => v + row[k]), [0, 0, 0]).map((v) => Math.round(v * 100) / 100)];
const weights = `<g class="u-move" id="gWeights">${m.V.map((_, j) => `<g class="u-wrow" style="--r:${j}"><text class="u-weight" data-j="${j}" x="0" y="${j * CH + CH / 2}">× ${u.fmt(m.A[QUERY][j], 2)}</text></g>`).join("")}</g>`;
const sumArrow = `<g class="u-move" id="gSumArrow">${[0, 1, 2, 3, 4, 5].map((i) => `<g class="u-sum-arrow" data-i="${i}">${u.arrow([6, 4], [-100, 40 + i * CH], { hue: "teal", bend: -18 })}</g>`).join("")}</g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "One causal self-attention head on the sentence 'the cat sat on the mat', shown in six scenes from the whole head down to the numbers.",
  body: [
    overview(),
    grid("gX", m.X, HUE.X, { name: "X" }),
    grid("gWQ", m.W_Q, HUE.Q, { name: "W<tspan baseline-shift='sub' font-size='11'>Q</tspan>" }),
    grid("gWK", m.W_K, HUE.K, { name: "W<tspan baseline-shift='sub' font-size='11'>K</tspan>" }),
    grid("gWV", m.W_V, HUE.V, { name: "W<tspan baseline-shift='sub' font-size='11'>V</tspan>" }),
    grid("gQ", m.Q, HUE.Q, { name: "Q" }),
    grid("gK", m.K, HUE.K, { name: "K", transposeIn: [3, 4] }),
    grid("gV", m.V, HUE.V, { name: "V" }),
    grid("gS", m.S, HUE.S, { name: "S" }),
    grid("gA", m.A, HUE.A, { name: "A", places: 2, max: 1 }),
    grid("gC", contrib(QUERY), HUE.V, { name: "a·v", places: 2, max: 1 }),
    grid("gSum", sumOf(QUERY), HUE.O, { name: "Σ", places: 2, max: 1 }),
    grid("gO", m.O, HUE.O, { name: "O", max: 1 }),
    weights,
    sumArrow,
    rowChips,
    colChips,
    `<g class="u-move" id="gBars">${u.bars({ id: "bars", values: m.A[QUERY], labels: m.TOKENS, hue: HUE.A })}</g>`,
  ],
});

// Where each element stands in each scene. null = hidden (fades where it last stood).
const N = 6;
const at6 = (list) => Array.from({ length: N }, (_, i) => (i in list ? { ...list[i], y: list[i].y + (i ? DY : 0) } : null));
const css = [
  u.placeCss("#gIso", at6({ 0: { x: 0, y: 0 }, 1: { x: -260, y: -60, s: 1.8, o: 0 } })),
  u.placeCss("#gRows", at6({ 1: { x: 330, y: 158 }, 2: { x: 100, y: 200 }, 3: { x: 210, y: 220 }, 4: { x: 150, y: 220 }, 5: { x: 110, y: 248 } })),
  u.placeCss("#gX", at6({ 1: { x: 400, y: 160 }, 2: { x: 170, y: 202 } })),
  u.placeCss("#gWQ", at6({ 2: { x: 350, y: 92 } })),
  u.placeCss("#gWK", at6({ 2: { x: 480, y: 92 } })),
  u.placeCss("#gWV", at6({ 2: { x: 610, y: 92 } })),
  u.placeCss("#gQ", at6({ 2: { x: 350, y: 202 }, 3: { x: 276, y: 222 }, 4: { x: 216, y: 222, o: 0.3 } })),
  u.placeCss("#gK", at6({ 2: { x: 480, y: 202 }, 3: { x: 390, y: 140 }, 4: { x: 330, y: 140, o: 0.3 } })),
  u.placeCss("#gV", at6({ 2: { x: 610, y: 202 }, 5: { x: 400, y: 50 } })),
  u.placeCss("#gCols", at6({ 3: { x: 390, y: 98 }, 4: { x: 330, y: 98 }, 5: { x: 176, y: 206 } })),
  u.placeCss("#gS", at6({ 3: { x: 390, y: 222 } })),
  u.placeCss("#gA", at6({ 4: { x: 330, y: 222 }, 5: { x: 176, y: 246 } })),
  u.placeCss("#gBars", at6({ 4: { x: 600, y: 222 } })),
  u.placeCss("#gC", at6({ 5: { x: 600, y: 50 } })),
  u.placeCss("#gWeights", at6({ 5: { x: 548, y: 50 } })),
  u.placeCss("#gSum", at6({ 5: { x: 600, y: 196 } })),
  u.placeCss("#gSumArrow", at6({ 5: { x: 600, y: 216 } })),
  u.placeCss("#gO", at6({ 5: { x: 400, y: 246 } })),
  ".u-weight{font:500 10px var(--anatomy-mono);fill:var(--unfold-green);dominant-baseline:central;text-anchor:middle}",
  ".u-sum-arrow{opacity:0;transition:opacity .4s}.u-sum-arrow[data-on]{opacity:1}",
  "#gS .u-cell,#gA .u-cell{cursor:crosshair}",
  // Entrances: each scene builds its result in the order it is computed.
  u.revealCss(0, "#gIso .u-rise", { kind: "rise", delay: 150, stepR: 260, dur: 600 }),
  u.revealCss(0, "#gIso .u-arrow-line", { kind: "draw", delay: 450, stepR: 260, dur: 550 }),
  u.revealCss(0, "#gIso .u-arrow-head", { kind: "fade", delay: 900, stepR: 260 }),
  u.revealCss(1, "#gX", { kind: "cells", delay: 450, stepR: 90, stepC: 35 }),
  u.revealCss(2, ":is(#gWQ,#gWK,#gWV)", { kind: "cells", delay: 300, stepR: 50, stepC: 20 }),
  u.revealCss(2, "#gQ", { kind: "cells", delay: 800, stepR: 110, stepC: 30 }),
  u.revealCss(2, "#gK", { kind: "cells", delay: 950, stepR: 110, stepC: 30 }),
  u.revealCss(2, "#gV", { kind: "cells", delay: 1100, stepR: 110, stepC: 30 }),
  u.revealCss(3, "#gS .u-cell", { kind: "fade", delay: 1000, stepR: 90, stepC: 30 }),
  u.revealCss(4, "#gA", { kind: "cells", delay: 450, stepR: 90, stepC: 30 }),
  u.revealCss(4, "#bars .u-bar-fill", { kind: "grow", delay: 900, stepC: 90, dur: 650 }),
  u.revealCss(4, "#bars .u-bar", { kind: "fade", delay: 900, stepC: 90 }),
  u.revealCss(5, "#gWeights .u-wrow", { kind: "fade", delay: 800, stepR: 220 }),
  u.revealCss(5, "#gC", { kind: "cells", delay: 900, stepR: 220, stepC: 40 }),
  u.revealCss(5, "#gSum", { kind: "cells", delay: 2400, stepC: 70 }),
  u.revealCss(5, "#gSumArrow .u-arrow-line", { kind: "draw", delay: 2700, dur: 500 }),
  u.revealCss(5, "#gSumArrow .u-arrow-head", { kind: "fade", delay: 3100 }),
  u.revealCss(5, "#gO .u-mark", { kind: "fade", delay: 3100 }),
  "#gV .u-cell{transition:transform .9s var(--anatomy-ease),opacity .4s}.u-stage[data-scene=\"5\"] #gV .u-cell{opacity:var(--w,1)}",
].join("\n");

// Beats: what each cue in script.md lights while the voice says that line. A rule applies only in its scene and
// only while the voice speaks (data-speaking), so the full scene shows when the narration ends or the voice is off.
const DIM = "opacity:.15";
const QUIET = "opacity:.3";
const LIT = "stroke:var(--anatomy-strong);stroke-width:2;stroke-opacity:1";
const MASK = "stroke:var(--unfold-red);stroke-width:1.6;stroke-dasharray:none;stroke-opacity:1";
const cellAt = (g, r, c) => `${g} .u-cell[data-r="${r}"][data-c="${c}"]`;
const notCell = (g, r, c) => `${g} .u-cell:not([data-r="${r}"][data-c="${c}"])`;
const pairs = (test) => [0, 1, 2, 3, 4, 5].flatMap((r) => [0, 1, 2, 3, 4, 5].filter((c) => test(r, c)).map((c) => [r, c]));
const upper = (g) => pairs((r, c) => c > r).map(([r, c]) => `${cellAt(g, r, c)}>.u-cell-bg`).join(",");
const lower = (g) => pairs((r, c) => c <= r).map(([r, c]) => cellAt(g, r, c)).join(",");
const CUES = {
  0: {
    words: [["#gIso .u-word text", "fill:var(--anatomy-strong)"], ["#gIso [data-block]:not([data-block='X'])", QUIET]],
    sat: [["#gIso .u-word[data-i='2'] text", "fill:var(--unfold-blue);font-weight:700"], ["#gIso .u-word:not([data-i='2'])", QUIET], ["#gIso [data-block]:not([data-block='X'])", QUIET]],
    flow: [["#gIso .u-arrow", "--w:2.4"]],
  },
  1: {
    rows: [["#gX .u-mark", "opacity:.6"]],
    the: [["#gX .u-mark:is([data-r='0'],[data-r='4'])", "opacity:1"], ["#gX .u-mark:not([data-r='0'],[data-r='4'])", "opacity:0"], ["#gX .u-cell:not([data-r='0'],[data-r='4'])", QUIET], ["#gRows .u-chip:not([data-i='0'],[data-i='4'])", QUIET]],
  },
  2: {
    w: [["#gQ,#gK,#gV", DIM]],
    qkv: [["#gWQ,#gWK,#gWV,#gX,#gRows", DIM]],
    q: [["#gWQ,#gWK,#gWV,#gX,#gRows,#gK,#gV", DIM]],
    k: [["#gWQ,#gWK,#gWV,#gX,#gRows,#gQ,#gV", DIM]],
    v: [["#gWQ,#gWK,#gWV,#gX,#gRows,#gQ,#gK", DIM]],
  },
  3: {
    qk: [["#gS", DIM], ["#gQ .u-cell[data-r='2']>.u-cell-bg,#gK .u-cell[data-r='1']>.u-cell-bg", LIT], ["#gQ .u-cell:not([data-r='2']),#gK .u-cell:not([data-r='1'])", QUIET]],
    s: [["#gQ,#gK", QUIET]],
    satcat: [["#gQ,#gK", QUIET], [`${cellAt("#gS", 2, 1)}>.u-cell-bg`, LIT], [notCell("#gS", 2, 1), QUIET]],
    mask: [["#gQ,#gK", QUIET], ["#gS .u-cell[data-masked]>.u-cell-bg", MASK], ["#gS .u-cell:not([data-masked])", QUIET]],
  },
  4: {
    a: [["#gQ,#gK", DIM], ["#gBars", QUIET]],
    row: [["#gQ,#gK", DIM], ["#gA .u-mark[data-r='2']", "opacity:1"], ["#gA .u-cell:not([data-r='2'])", QUIET]],
    satcat: [["#gQ,#gK", DIM], [`${cellAt("#gA", 2, 1)}>.u-cell-bg`, LIT], [notCell("#gA", 2, 1), QUIET], ["#bars .u-bar:not([data-i='1'])", QUIET]],
    mask: [["#gQ,#gK", DIM], [upper("#gA"), MASK], [lower("#gA"), QUIET]],
  },
  5: {
    weigh: [["#gO,#gSum,#gSumArrow", DIM]],
    cat: [["#gO,#gSum,#gSumArrow", DIM], ["#gC .u-cell:not([data-r='1']),#gV .u-cell:not([data-r='1'])", QUIET], ["#gWeights .u-wrow:not(:nth-child(2))", QUIET], ["#gC .u-mark[data-r='1']", "opacity:1"]],
    sum: [["#gC,#gWeights,#gV", DIM], ["#gO .u-mark[data-r='2']", "opacity:1"]],
  },
};
const cueCss = Object.entries(CUES)
  .flatMap(([scene, cues]) =>
    Object.entries(cues).flatMap(([cue, rules]) =>
      rules.map(([sel, style]) => `${sel.split(/,(?![^(]*\))/).map((x) => `.u-stage[data-speaking][data-scene="${scene}"][data-cue="${cue}"] ${x.trim()}`).join(",")}{${style}}`),
    ),
  )
  .join("\n");

// Equations: MathML, coloured by the same identity hues.
const mi = (name, hue = HUE[name]) => `<mi data-hue="${hue}">${name}</mi>`;
const sub = (base, s, hue) => `<msub><mi data-hue="${hue}">${base}</mi><mi>${s}</mi></msub>`;
const frac = (top, bottom) => `<mfrac>${top}</mfrac>`.replace("</mfrac>", `${bottom}</mfrac>`);
const scoreMath = `${mi("S")}<mo>=</mo>${frac(`<mrow>${mi("Q")}<msup>${mi("K")}<mi>T</mi></msup></mrow>`, `<msqrt><msub><mi>d</mi><mi>k</mi></msub></msqrt>`)}<mo>+</mo><mtext>mask</mtext>`;

// The narration is in script.md: one section per scene.
const script = u.readScript(join(HERE, "script.md"));
const scenes = [
  {
    name: "Overview",
    math: `${mi("O")}<mo>=</mo><mi>softmax</mi><mo>(</mo>${frac(`<mrow>${mi("Q")}<msup>${mi("K")}<mi>T</mi></msup></mrow>`, `<msqrt><msub><mi>d</mi><mi>k</mi></msub></msqrt>`)}<mo>)</mo>${mi("V")}`,
  },
  {
    name: "Embed",
    math: `${sub("x", "i", HUE.X)}<mo>∈</mo><msup><mi>ℝ</mi><mn>4</mn></msup>`,
  },
  {
    name: "Project",
    math: `${mi("Q")}<mo>=</mo>${mi("X")}${sub("W", "Q", HUE.Q)}<mspace width="1em"/>${mi("K")}<mo>=</mo>${mi("X")}${sub("W", "K", HUE.K)}<mspace width="1em"/>${mi("V")}<mo>=</mo>${mi("X")}${sub("W", "V", HUE.V)}`,
  },
  {
    name: "Score",
    math: scoreMath,
  },
  {
    name: "Softmax",
    math: `${mi("A")}<mo>=</mo><mi>softmax</mi><mo>(</mo>${mi("S")}<mo>)</mo>`,
  },
  {
    name: "Mix",
    math: `${sub("o", "i", HUE.O)}<mo>=</mo><munder><mo>∑</mo><mi>j</mi></munder>${sub("a", "ij", HUE.A)}${sub("v", "j", HUE.V)}`,
  },
].map((scene, i) => ({ ...scene, ...script[i] }));

const key = u.keyHtml([
  { hue: HUE.X, label: "X input" },
  { hue: HUE.Q, label: "Q query" },
  { hue: HUE.K, label: "K key" },
  { hue: HUE.V, label: "V value" },
  { hue: HUE.S, label: "S score" },
  { hue: HUE.A, label: "A weight" },
  { hue: HUE.O, label: "O output" },
], { signs: true });

// A live input: the picked token's row of X. The page recomputes the head with model.mjs's own head(X).
const fields = [0, 1, 2, 3].map((k) => `<input type="number" min="-1" max="1" step="0.1" data-k="${k}" aria-label="Value ${k + 1} of the picked token's row of X">`).join("");
const controls = `<label>x <span data-xtok>“sat”</span></label>${fields}<button type="button" data-reset>model X</button>`;
const stage = u.stageHtml({ audio: await u.narrate(scenes, { dir: join(HERE, "voice"), provider: "gemini", model: "gemini-3.1-flash-tts-preview", voice: "Kore" }), dwell: 8000, scenes, svg, label: "Attention head explainer. Left and right arrows change the scene. Up and down arrows pick the query token. The number fields edit its row of X.", css: css + "\n" + cueCss, key, controls, controlScenes: [1, 2, 3, 4, 5] });

const live = `
${u.modelScript([m.matmul, m.transpose, m.round, m.masked, m.softmax, m.head], { W_Q: m.W_Q, W_K: m.W_K, W_V: m.W_V, SCALE: m.SCALE, X0: m.X })}
const M = { TOKENS: ${JSON.stringify(m.TOKENS)}, X: X0.map((row) => [...row]), ...head(X0) };
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const $ = (id) => root.querySelector("#" + id);
const tok = (i) => "\\u201c" + M.TOKENS[i] + "\\u201d";
const vec = (row, p = 1) => "[" + row.map((v) => fmt(v, p)).join(", ") + "]";
let query = ${QUERY};
let probe = null;
const contrib = (i) => M.V.map((row, j) => row.map((v) => Math.round(M.A[i][j] * v * 100) / 100));
const strongest = (i) => M.A[i].reduce((best, v, j) => (v > M.A[i][best] ? j : best), 0);
function say() {
  const s = UNFOLD.scene();
  const i = query;
  const j = strongest(i);
  let text = "";
  if (s === 0) text = "6 tokens \\u00b7 d_model 4 \\u00b7 d_k 3";
  if (s === 1) text = tok(i) + " \\u2192 " + vec(M.X[i]);
  if (s === 2) text = "q" + " " + tok(i) + " = " + vec(M.Q[i]);
  if (s === 3) {
    const [a, b] = probe ?? scan ?? [i, j];
    text = b > a ? tok(a) + " cannot see " + tok(b) + " \\u00b7 \\u2212\\u221e"
      : "q\\u00b7k / \\u221a3 = (" + M.Q[a].map((q, k) => fmt(q) + "\\u00d7" + fmt(M.K[b][k])).join(" + ") + ") / 1.73 = " + fmt(M.S[a][b]);
  }
  if (s === 4) text = tok(i) + " gives " + fmt(M.A[i][j], 2) + " of its attention to " + tok(j);
  if (s === 5) text = "o " + tok(i) + " = " + vec(M.O[i]);
  if (readout.textContent !== text) readout.textContent = text;
}
const fields = [...root.querySelectorAll("[data-k]")];
let typing = null; // the field the reader is typing in: pick() leaves its text alone until "change"
function pick(i) {
  query = Math.max(0, Math.min(M.TOKENS.length - 1, i));
  root.querySelector("[data-xtok]").textContent = tok(query);
  fields.forEach((f) => f !== typing && (f.value = M.X[query][+f.dataset.k].toFixed(1)));
  for (const id of ["gX-grid", "gQ-grid", "gS-grid", "gA-grid", "gO-grid"]) mark($(id), query);
  mark($("gRows"), query, ".u-chip");
  mark($("gSumArrow"), query, ".u-sum-arrow");
  setBars($("bars"), M.A[query]);
  setGrid($("gC-grid"), contrib(query));
  const sum = [contrib(query).reduce((acc, row) => acc.map((v, k) => v + row[k]), [0, 0, 0]).map((v) => Math.round(v * 100) / 100)];
  setGrid($("gSum-grid"), sum);
  const top = Math.max(...M.A[query]);
  $("gV-grid").querySelectorAll(".u-cell").forEach((cell) => cell.style.setProperty("--w", (0.15 + 0.85 * M.A[query][+cell.dataset.r] / top).toFixed(2)));
  root.querySelectorAll(".u-weight").forEach((t) => {
    const w = M.A[query][+t.dataset.j];
    t.textContent = "\\u00d7 " + fmt(w, 2);
    t.style.opacity = w > 0 ? 1 : 0.3;
  });
  say();
}
// Score scene: sweep the keys one at a time for the selected query, then hold on the result.
let scan = null;
const lightCells = (list) => {
  root.querySelectorAll("[data-hl]").forEach((el) => el.removeAttribute("data-hl"));
  list.forEach((el) => el && el.setAttribute("data-hl", ""));
};
UNFOLD.beat(3, 950, (n) => {
  const j = n < 0 ? -1 : n % (query + 2);
  scan = j >= 0 && j <= query ? [query, j] : null;
  lightCells(scan ? [...$("gK-grid").querySelectorAll('.u-cell[data-r="' + j + '"]'), $("gS-grid").querySelector('.u-cell[data-r="' + query + '"][data-c="' + j + '"]')] : []);
  say();
}, 1500);
root.addEventListener("unfold:scene", () => {
  scan = null;
  lightCells([]);
  say();
});
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: query - 1, ArrowDown: query + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  UNFOLD.pause();
  pick(to);
});
root.addEventListener("click", (e) => {
  const chipEl = e.target.closest("#gRows .u-chip");
  const cell = e.target.closest(".u-cell");
  if (chipEl) pick(+chipEl.dataset.i);
  else if (cell && cell.closest("#gX,#gQ,#gS,#gA,#gO")) pick(+cell.dataset.r);
  else return;
  UNFOLD.pause();
});
root.addEventListener("pointerover", (e) => {
  const cell = e.target.closest("#gS .u-cell");
  probe = cell ? [+cell.dataset.r, +cell.dataset.c] : null;
  if (UNFOLD.scene() === 3) say();
});
// The reader's own X: same head(X) as the build, then every grid, block face and bar is redrawn.
const faceMax = (values) => Math.max(1e-9, ...values.flat().filter(Number.isFinite).map(Math.abs));
function recompute() {
  Object.assign(M, head(M.X));
  for (const k of ["X", "Q", "K", "V", "S", "A", "O"]) {
    setGrid($("g" + k + "-grid"), M[k]);
    const face = root.querySelector('[data-block="' + k + '"] .u-face');
    if (!face) continue;
    const values = M[k].flat();
    const top = faceMax(values);
    face.querySelectorAll("rect").forEach((rect, n) => {
      const look = cellLook(values[n], top);
      rect.toggleAttribute("data-masked", look.masked);
      rect.toggleAttribute("data-neg", look.neg);
      rect.style.setProperty("--a", look.alpha.toFixed(2));
    });
  }
  pick(query);
}
const ctl = root.querySelector(".u-ctl");
ctl.addEventListener("input", (e) => {
  const f = e.target.closest("[data-k]");
  const v = f && f.value !== "" ? Number(f.value) : NaN;
  if (!Number.isFinite(v)) return;
  UNFOLD.pause();
  M.X[query][+f.dataset.k] = Math.max(-1, Math.min(1, Math.round(v * 10) / 10));
  typing = f;
  recompute();
  typing = null;
});
ctl.addEventListener("change", () => pick(query));
ctl.querySelector("[data-reset]").addEventListener("click", () => {
  UNFOLD.pause();
  M.X = X0.map((row) => [...row]);
  recompute();
});
pick(query);
`;

const body = iso.plateHtml({
  fig: "Fig 1",
  title: "One attention head",
  hint: "← → scene · ↑ ↓ token",
  readout: "6 tokens · d_model 4 · d_k 3",
  caption:
    "A causal self-attention head with d_model = 4 and d_k = 3. The weights are small and set by hand so the pattern is easy to read. Every other number is computed from them, and the printed values add up by hand. The number fields change the picked token's row of X. The page then runs the same code as the model again.",
  body: stage,
});

// --artifact <file>: one page for a claude.ai Artifact, which follows the viewer's theme.
const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "attention-head-light.html" : "attention-head.html");
const html = artifact > 0 ? u.artifactHtml({ title: "One attention head", body, script: live }) : u.pageHtml({ title: "One attention head", theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
