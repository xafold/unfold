import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const W = 720;
const H = 336;
const CW = 34;
const CH = 22;
const N = 6;
const FOCUS = 1; // "7": the tour shows this token
const HMAX = 3; // colour scale of the scores
const TITLE = "Mixture of experts";

// Colour identity, held in every scene, in the math and in the key. The router matrix makes scores, so it is purple.
const HUE = { X: "ink", H: "purple", G: "green", E: "yellow", Y: "teal" };
const L = m.L0;
const R = L.rows[FOCUS];
const NO = [-Infinity, -Infinity, -Infinity];
const on = (j) => R.keep.includes(j);
const cell = [CW, CH];
const grid = (id, values, hue, extra = {}, cls = "") => `<g class="u-move ${cls}" id="${id}">${u.cellGrid({ id: `${id}-grid`, values, hue, cell, keep: true, ...extra })}</g>`;
const small = (text, live) => `<tspan class="u-dims"${live ? ` data-live="${live}"` : ""}>${text}</tspan>`;
const keepText = (k) => (k === m.E ? "keep all 4" : `keep top ${k}`);

// ---- The pieces ----
const rows = `<g class="u-move" id="gRows">${m.TOKENS.map((t, i) => u.chip(t, 0, i * CH + 3, { w: 44, i })).join("")}</g>`;
const cols = `<g class="u-move" id="gCols">${m.W_E.map((_, j) => u.chip(`E${j + 1}`, j * CW + 1, 0, { w: CW - 2, hue: HUE.E })).join("")}</g>`;
// Overview layout (L0), in view box units. Scene 5 ("Experts") shows the same layout larger.
const EX = [96, 238, 380, 522];
const XF = [309, 24];
const EY = 134; // top of the expert grids in L0
const linkG = (j, body) => `<g class="moe-link" data-j="${j}"${on(j) ? "" : " data-off"}>${body}</g>`;
const router =
  `<g class="u-move" id="gRouter">${u.arrow([360, 48], [360, 57], { hue: HUE.H })}` +
  `<g class="moe-router"><rect x="288" y="58" width="144" height="22" rx="11"/><text x="360" y="69">router · <tspan data-live="keep">${keepText(m.K0)}</tspan></text></g></g>`;
const fan = `<g class="u-move" id="gFan">${EX.map((x, j) => linkG(j, u.arrow([360 + (j - 1.5) * 24, 81], [x + CW * 3 - 25, EY - 24], { hue: HUE.G }))).join("")}</g>`;
const merge = `<g class="u-move" id="gMerge">${EX.map((x, j) => linkG(j, u.arrow([x + 51, EY + 111], [340 + j * 13.3, EY + 167], { hue: HUE.Y }))).join("")}</g>`;
// Phone layout of scene 5: the experts in a column, one bus on the left.
const NY = (j) => 96 + j * 100;
const fanN =
  `<g class="u-move" id="gFanN"><path class="moe-bus" d="M38 35H20V${NY(3) + 33}"/><text class="moe-lab moe-rlab" x="152" y="35">router · <tspan data-live="keep">${keepText(m.K0)}</tspan></text>` +
  EX.map((_, j) => linkG(j, u.arrow([20, NY(j) + 33], [38, NY(j) + 33], { hue: HUE.G }) + u.arrow([145, NY(j) + 33], [197, NY(j) + 33], { hue: HUE.E }))).join("") +
  `</g>`;
const mergeN =
  `<g class="u-move" id="gMergeN"><path class="moe-bus moe-bus-y" d="M330 ${NY(0) + 33}V511"/>${u.arrow([330, 511], [305, 511], { hue: HUE.Y })}` +
  EX.map((_, j) => linkG(j, `<path class="moe-bus moe-bus-y" d="M304 ${NY(j) + 33}H330"/>`)).join("") +
  `</g>`;
const expert = (j) =>
  `<g class="u-move moe-E" id="gE${j}"><g class="moe-exp" data-j="${j}"${on(j) ? "" : " data-off"}>` +
  u.cellGrid({ id: `gE${j}-grid`, values: m.W_E[j], hue: HUE.E, cell, keep: true, max: 1, name: `E${u.tsub(String(j + 1))}`, dims: false }) +
  `<g class="moe-gate" transform="translate(${CW * 3 - 50} -23)"><rect width="50" height="16" rx="8"/><text x="25" y="8">${on(j) ? u.fmt(R.g[j], 2) : "not run"}</text></g>` +
  `</g></g>`;
const out = (j) =>
  `<g class="u-move moe-Yi" id="gY${j}"><g class="moe-down moe-link" data-j="${j}"${on(j) ? "" : " data-off"}>${u.arrow([51, -18], [51, -3], { hue: HUE.E })}</g>` +
  u.cellGrid({ id: `gY${j}-grid`, values: [R.yi[j] ?? NO], hue: HUE.E, cell, keep: true, max: 1, className: "moe-skip" }) +
  `</g>`;
const echips = `<g class="u-move" id="gEchips"><text class="u-name" x="44" y="-7">${small("expert outputs")}</text>${m.W_E.map((_, j) => u.chip(`E${j + 1}`, 0, j * CH + 3, { w: 34, hue: HUE.E })).join("")}</g>`;
const weights = `<g class="u-move" id="gWeights">${m.W_E.map((_, j) => `<g class="moe-wrow" data-j="${j}" style="--r:${j}"${on(j) ? "" : " data-off"}><text class="moe-w" x="0" y="${j * CH + CH / 2}">${on(j) ? `× ${u.fmt(R.g[j], 2)}` : "not run"}</text></g>`).join("")}</g>`;
const keepArrow =
  `<g class="u-move" id="gKeep"><g class="moe-wide">${u.arrow([0, 0], [54, 0], { hue: HUE.H })}<text class="moe-lab" x="27" y="-10" data-live="keep">${keepText(m.K0)}</text></g>` +
  `<g class="moe-narrow">${u.arrow([0, 0], [0, 26], { hue: HUE.H })}<text class="moe-lab" x="10" y="13" style="text-anchor:start" data-live="keep">${keepText(m.K0)}</text></g></g>`;
const softArrow = `<g class="u-move" id="gSoft">${u.arrow([0, 0], [46, 0], { hue: HUE.G })}<text class="moe-lab" x="23" y="-10">softmax</text></g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "One mixture-of-experts layer on the tokens 'is 7 + 2 odd', in six scenes: the router scores four experts, keeps the best two, turns the scores into weights, runs those experts, and adds their outputs.",
  body: [
    router,
    fan,
    fanN,
    mergeN,
    merge,
    grid("gX", m.X, HUE.X, { name: "X", max: 1 }),
    grid("gWR", m.W_R, HUE.H, { name: `W${u.tsub("R")}`, max: HMAX }),
    grid("gH", L.H, HUE.H, { name: "H", max: HMAX }),
    grid("gHK", L.HK, HUE.H, { name: `H${small(`${keepText(m.K0)}`, "kept").replace("<tspan", '<tspan dx="6"')}`, dims: false, max: HMAX }),
    grid("gLoad", [L.load], HUE.X, { name: small("tokens per expert"), dims: false, places: 0, max: 5 }),
    grid("gG", L.G, HUE.G, { name: "G", places: 2, max: 1 }),
    `<g class="u-move" id="gBars">${u.bars({ id: "bars", values: R.g, labels: m.W_E.map((_, j) => `E${j + 1}`), hue: HUE.G, h: 130, keep: true })}</g>`,
    grid("gXf", [m.X[FOCUS]], HUE.X, { name: `x${small(`“${m.TOKENS[FOCUS]}”`, "tok").replace("<tspan", '<tspan dx="6"')}`, dims: false, max: 1 }),
    ...m.W_E.map((_, j) => expert(j)),
    ...m.W_E.map((_, j) => out(j)),
    echips,
    weights,
    `<g class="u-move" id="gPart">${u.cellGrid({ id: "gPart-grid", values: R.part.map((p) => p ?? NO), hue: HUE.E, cell, keep: true, places: 2, max: 1, dims: false, className: "moe-skip", name: `<tspan style="fill:var(--unfold-green)">g</tspan>·y${small("weight × output").replace("<tspan", '<tspan dx="6"')}` })}<path class="u-axis" d="M-2 ${4 * CH + 5}H${3 * CW + 2}"/></g>`,
    grid("gYout", [R.y], HUE.Y, { name: "y", dims: false, places: 2, max: 1 }),
    keepArrow,
    softArrow,
    rows,
    cols,
  ],
});

// ---- Where each element stands in each scene. A frame is [ox, oy, s]; positions are local to the frame. ----
const place = (frame, [lx, ly, o]) => ({ x: frame[0] + frame[2] * lx, y: frame[1] + frame[2] * ly, s: frame[2], ...(o === undefined ? {} : { o }) });
const L0 = { gRows: [24, 14], gXf: XF, gRouter: [0, 0], gFan: [0, 0], gMerge: [0, 0], gYout: [309, EY + 170] };
EX.forEach((x, j) => { L0[`gE${j}`] = [x, EY]; L0[`gY${j}`] = [x, EY + 86]; });
const L4 = { ...L0 };
delete L4.gRows; delete L4.gMerge; delete L4.gYout;
const L4N = { gXf: [40, 24], gFanN: [0, 0] };
EX.forEach((_, j) => { L4N[`gE${j}`] = [40, NY(j)]; L4N[`gY${j}`] = [200, NY(j) + 22]; });
const L0N = { ...L4N, gMergeN: [0, 0], gYout: [200, 500] };
const L5 = { gEchips: [0, 3], gWeights: [179, 0], gPart: [212, 0], gYout: [212, 116] };
EX.forEach((_, j) => { L5[`gY${j}`] = [44, j * CH]; });
const WIDE = [
  [[0, 0, 1], L0],
  [[146, 10, 1.25], { gCols: [206, 0], gWR: [206, 44], gRows: [0, 145], gX: [56, 142], gH: [206, 142] }],
  [[91, 14, 1.35], { gRows: [0, 43], gH: [56, 40, 0.35], gKeep: [200, 95], gCols: [262, 0], gHK: [262, 40], gLoad: [262, 196] }],
  [[12, 58, 1.28], { gRows: [0, 43], gHK: [56, 40, 0.35], gSoft: [198, 95], gCols: [250, 0], gG: [250, 40], gBars: [424, 20] }],
  [[-72, 25, 1.2], L4],
  [[62, 52, 1.9], L5],
];
const NARROW_H = [640, 300, 575, 480, 580, 235];
const NARROW = [
  [[10, 0, 1.2], L0N],
  [[12, 10, 1.1], { gCols: [206, 0], gWR: [206, 44], gRows: [0, 145], gX: [56, 142], gH: [206, 142] }],
  [[65, 10, 1.4], { gCols: [56, 0], gRows: [0, 43], gH: [56, 40, 0.5], gKeep: [124, 162], gHK: [56, 216], gLoad: [56, 372] }],
  [[65, 10, 1.4], { gCols: [56, 0], gRows: [0, 43], gG: [56, 40], gBars: [64, 182] }],
  [[10, 0, 1.2], L4N],
  [[12, 40, 1.2], L5],
];
const IDS = [...new Set([...WIDE, ...NARROW].flatMap(([, map]) => Object.keys(map)))];
const statesOf = (layout, id) => layout.map(([frame, map]) => (map[id] ? place(frame, map[id]) : null));

const css = [
  ...IDS.map((id) => u.placeCss(`#${id}`, statesOf(WIDE, id), statesOf(NARROW, id))),
  ".u-stage[data-narrow] .moe-wide,.u-stage:not([data-narrow]) .moe-narrow{display:none}",
  ".moe-router rect{fill:var(--u-card);stroke:var(--unfold-purple);stroke-width:1}",
  ".moe-router text{font:500 10.5px var(--u-mono);fill:var(--unfold-purple);dominant-baseline:central;text-anchor:middle}",
  ".moe-gate rect{fill:var(--u-card);stroke:var(--unfold-green);stroke-width:.9;transition:stroke .3s}",
  ".moe-gate text,.moe-w{font:500 10px var(--u-mono);fill:var(--unfold-green);dominant-baseline:central;text-anchor:middle}",
  ".moe-exp>.u-grid{transition:opacity .4s}.moe-exp[data-off]>.u-grid{opacity:.28}",
  ".moe-exp[data-off] .moe-gate rect{stroke:var(--u-faint);stroke-dasharray:2 2}.moe-exp[data-off] .moe-gate text,.moe-wrow[data-off] .moe-w{fill:var(--u-muted)}",
  ".moe-exp{cursor:pointer}",
  ".moe-link{transition:opacity .4s}.moe-link[data-off]{opacity:.22}.moe-link[data-off] .u-arrow-line{stroke-dasharray:3 3}",
  ".moe-bus{fill:none;stroke:var(--unfold-green);stroke-width:1.1}.moe-bus-y{stroke:var(--unfold-teal)}",
  ".moe-lab.moe-rlab{text-anchor:start;fill:var(--unfold-purple)}",
  ".moe-skip .u-cell[data-masked] .u-num{display:none}",
  ".moe-lab{font:10px var(--u-mono);fill:var(--u-muted);dominant-baseline:central;text-anchor:middle}",
  ".moe-down{transition:opacity .3s}.u-stage[data-scene=\"5\"] .moe-down,.u-stage[data-narrow]:is([data-scene=\"0\"],[data-scene=\"4\"]) .moe-down{opacity:0}",
  // The overview shows the experts by colour only.
  ".u-stage[data-scene=\"0\"] .moe-exp .u-num{display:none}",
  "#gX .u-cell,#gH .u-cell,#gHK .u-cell,#gG .u-cell{cursor:pointer}",
  ".moe-ctl{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center}",
  // Entrances: each scene builds its result in the order it is computed.
  u.revealCss(0, "#gFan .u-arrow-line", { kind: "draw", delay: 300, dur: 500 }),
  u.revealCss(0, "#gFan .u-arrow-head", { kind: "fade", delay: 750 }),
  u.revealCss(0, "#gMerge .u-arrow-line", { kind: "draw", delay: 1100, dur: 500 }),
  u.revealCss(0, "#gMerge .u-arrow-head", { kind: "fade", delay: 1550 }),
  u.revealCss(1, "#gH", { kind: "cells", delay: 700, stepR: 90, stepC: 35 }),
  u.revealCss(2, "#gHK", { kind: "cells", delay: 500, stepR: 90, stepC: 35 }),
  u.revealCss(2, "#gLoad", { kind: "cells", delay: 1300, stepC: 90 }),
  u.revealCss(3, "#gG", { kind: "cells", delay: 500, stepR: 90, stepC: 35 }),
  u.revealCss(3, "#bars .u-bar-fill", { kind: "grow", delay: 900, stepC: 90, dur: 650 }),
  u.revealCss(3, "#bars .u-bar", { kind: "fade", delay: 900, stepC: 90 }),
  u.revealCss(4, ".moe-Yi .u-grid", { kind: "cells", delay: 800, stepC: 80 }),
  u.revealCss(5, "#gWeights .moe-wrow", { kind: "fade", delay: 600, stepR: 200 }),
  u.revealCss(5, "#gPart", { kind: "cells", delay: 800, stepR: 200, stepC: 40 }),
  u.revealCss(5, "#gYout", { kind: "cells", delay: 1900, stepC: 80 }),
].join("\n");

// Beats: what each cue in script.md lights while the voice says that line.
const DIM = "opacity:.15";
const QUIET = "opacity:.3";
const LIT = "stroke:var(--u-strong);stroke-width:2;stroke-opacity:1";
const MASK = "stroke:var(--unfold-red);stroke-width:1.6;stroke-dasharray:none;stroke-opacity:1";
const CUES = {
  0: {
    x: [["#gRouter,#gFan,#gMerge,#gYout,.moe-E,.moe-Yi", QUIET]],
    experts: [["#gXf,#gRows,#gRouter,#gYout,#gMerge,.moe-Yi", QUIET], [".moe-exp[data-off]>.u-grid", "opacity:1"]],
    router: [[".moe-router rect", "stroke-width:2.2"], [".moe-Yi,#gYout,#gMerge", QUIET]],
    seven: [[".moe-link:not([data-off]) .u-arrow", "--w:3.2"], [".moe-exp[data-off]", DIM]],
  },
  1: {
    x: [["#gWR,#gH,#gCols", DIM]],
    wr: [["#gX,#gRows,#gH", DIM]],
    h: [["#gX,#gRows,#gWR", QUIET]],
    seven: [["#gX,#gRows,#gWR", QUIET], [`#gH .u-cell[data-r="1"][data-c="1"]>.u-cell-bg`, LIT], [`#gH .u-cell:not([data-r="1"])`, QUIET]],
  },
  2: {
    keep: [["#gH,#gLoad", QUIET], ["#gHK .u-cell:not([data-masked])>.u-cell-bg", LIT]],
    drop: [["#gH,#gLoad", QUIET], ["#gHK .u-cell[data-masked]>.u-cell-bg", MASK], ["#gHK .u-cell:not([data-masked])", QUIET]],
    load: [["#gH,#gHK,#gRows,#gKeep", QUIET], ["#gLoad .u-cell-bg", LIT]],
  },
  3: {
    g: [["#gHK,#gBars", QUIET]],
    row: [["#gHK", DIM], [`#gG .u-cell:not([data-r="1"])`, QUIET]],
    seven: [["#gHK", DIM], [`#gG .u-cell:not([data-r="1"])`, QUIET], [`#gG .u-cell[data-r="1"]:is([data-c="1"],[data-c="3"])>.u-cell-bg`, LIT]],
    zero: [["#gBars", QUIET], ["#gHK .u-cell:not([data-masked])", QUIET], ["#gHK", "opacity:1"], ["#gHK .u-cell[data-masked]>.u-cell-bg", MASK]],
  },
  4: {
    kept: [[".moe-exp[data-off]", DIM], [".moe-link[data-off]", "opacity:.08"]],
    pair: [[".moe-exp[data-off]", DIM], [".moe-Yi .u-cell:not([data-masked])>.u-cell-bg", LIT]],
    off: [[".moe-exp:not([data-off]),#gXf,#gRouter", QUIET], [".moe-exp[data-off]>.u-grid", "opacity:.7"], [".moe-exp[data-off] .moe-gate rect", "stroke:var(--unfold-red);stroke-dasharray:none"]],
  },
  5: {
    weigh: [["#gYout", DIM], ["#gWeights .moe-w", "font-weight:700"]],
    sum: [["#gEchips,.moe-Yi,#gWeights", QUIET], ["#gYout .u-cell-bg", LIT]],
    big: [[`#gPart .u-cell:not([data-r="1"])`, QUIET], [`.moe-Yi:not(#gY1),.moe-wrow:not([data-j="1"])`, QUIET]],
  },
};
const cueCss = Object.entries(CUES)
  .flatMap(([scene, cues]) =>
    Object.entries(cues).flatMap(([cue, rules]) =>
      rules.map(([sel, style]) => `${sel.split(/,(?![^(]*\))/).map((x) => `.u-stage[data-speaking][data-scene="${scene}"][data-cue="${cue}"] ${x.trim()}`).join(",")}{${style}}`),
    ),
  )
  .join("\n");

// ---- Equations: MathML, coloured by the same identity hues. ----
const { mi, msub, mo } = u;
const x = mi("x", HUE.X);
const inT = `<mrow><mi>i</mi><mo>∈</mo><mi>T</mi></mrow>`;
const sumT = (idx = "i") => `<munder><mo>∑</mo>${inT.replaceAll("<mi>i</mi>", `<mi>${idx}</mi>`)}</munder>`;
const script = u.readScript(join(HERE, "script.md"));
const scenes = [
  { name: "Overview", math: `${mi("y", HUE.Y)}<mo>=</mo>${sumT()}${msub("g", "i", HUE.G)}<mo>·</mo>${x}${msub("E", "i", HUE.E)}` },
  { name: "Score", math: `${mi("h", HUE.H)}<mo>=</mo>${x}${msub("W", "R", HUE.H)}` },
  { name: "Top k", math: `<mi>T</mi><mo>=</mo><msub><mi>top</mi>${u.mn(m.K0, { places: 0, live: "k" })}</msub>${mo("(")}${mi("h", HUE.H)}${mo(")")}<mspace width="1.2em"/>${msub("h", "i", HUE.H)}<mo>=</mo><mo>−</mo><mi>∞</mi><mtext>&nbsp;for&nbsp;</mtext><mi>i</mi><mo>∉</mo><mi>T</mi>` },
  { name: "Weights", math: `${msub("g", "i", HUE.G)}<mo>=</mo>${u.mfrac(`<msup><mi>e</mi>${msub("h", "i", HUE.H)}</msup>`, `${sumT("j")}<msup><mi>e</mi>${msub("h", "j", HUE.H)}</msup>`)}` },
  { name: "Experts", math: `${msub("y", "i", HUE.E)}<mo>=</mo>${x}${msub("E", "i", HUE.E)}<mtext>&nbsp;for&nbsp;</mtext>${inT}` },
  { name: "Mix", math: `${mi("y", HUE.Y)}<mo>=</mo>${sumT()}${msub("g", "i", HUE.G)}${msub("y", "i", HUE.E)}` },
].map((scene, i) => ({ ...scene, ...script[i] }));

const key = u.keyHtml([
  { hue: HUE.X, label: "x token" },
  { hue: HUE.H, label: "h score (router)" },
  { hue: HUE.G, label: "g weight" },
  { hue: HUE.E, label: "E expert" },
  { hue: HUE.Y, label: "y output" },
], { signs: true });

// Live inputs: the token, its row of X, and k. The page runs model.mjs's own layer(X, k) again.
const controls =
  `<span class="moe-ctl" role="group" aria-label="Token">${m.TOKENS.map((t, i) => `<button type="button" data-tok="${i}" aria-pressed="${i === FOCUS}">${t}</button>`).join("")}</span>` +
  `<span class="moe-ctl"><label>x</label>${[0, 1, 2].map((k) => `<input type="number" min="-1" max="1" step="0.1" data-k="${k}" aria-label="Value ${k + 1} of the picked token's row of X">`).join("")}</span>` +
  `<span class="moe-ctl" role="group" aria-label="Experts per token">${m.KS.map((k) => `<button type="button" data-kk="${k}" aria-pressed="${k === m.K0}">${k === m.E ? "all 4" : `top ${k}`}</button>`).join("")}</span>` +
  `<button type="button" data-reset>start values</button>`;

const audio = await u.narrate(scenes, { dir: join(HERE, "voice"), provider: "gemini", model: process.env.MOE_TTS_MODEL ?? "gemini-3.8-flash-tts", voice: process.env.MOE_TTS_VOICE ?? "Kore" });
const stage = u.stageHtml({
  audio,
  dwell: 8000,
  scenes,
  svg,
  label: "Mixture of experts explainer. Left and right arrows change the scene. Up and down arrows pick the token. The number fields edit its row of X. The buttons set how many experts run.",
  css: css + "\n" + cueCss,
  key,
  controls,
  narrow: [400, NARROW_H],
});

const live = `
${u.modelScript([m.roundTo, m.vecmat, m.topK, m.softmax, m.route, m.layer], { W_R: m.W_R, W_E: m.W_E, X0: m.X })}
const TOKENS = ${JSON.stringify(m.TOKENS)};
const S = { focus: ${FOCUS}, k: ${m.K0}, X: X0.map((row) => [...row]), probe: null };
let L = layer(S.X, S.k);
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const $ = (id) => root.querySelector("#" + id);
const tok = (i) => "\\u201c" + TOKENS[i] + "\\u201d";
const EN = (j) => "E" + (j + 1);
const NO = [-Infinity, -Infinity, -Infinity];
let scan = null;
function say() {
  const s = UNFOLD.scene();
  const i = S.focus;
  const r = L.rows[i];
  const x = S.X[i];
  const best = r.keep.reduce((a, b) => (r.h[b] > r.h[a] ? b : a));
  const j = S.probe ?? (s === 1 ? scan : null) ?? best;
  const kept = r.keep.includes(j);
  const drop = [0, 1, 2, 3].filter((e) => !r.keep.includes(e));
  let text = "";
  if (s === 0) text = tok(i) + " \\u2192 " + r.keep.map((e) => EN(e) + " " + fmt(r.g[e], 2)).join(" \\u00b7 ") + " \\u00b7 " + S.k + " of 4 experts run";
  if (s === 1) text = "h(" + EN(j) + ") = " + x.map((v, c) => fmt(v) + "\\u00d7" + fmt(W_R[c][j])).join(" + ") + " = " + fmt(r.h[j]);
  if (s === 2) text = tok(i) + ": keep " + r.keep.map((e) => EN(e) + " " + fmt(r.h[e])).join(", ") + (drop.length ? " \\u00b7 drop " + drop.map((e) => EN(e) + " " + fmt(r.h[e])).join(", ") : "");
  if (s === 3) text = kept ? "g(" + EN(j) + ") = e^" + fmt(r.h[j]) + " / (" + r.keep.map((e) => "e^" + fmt(r.h[e])).join(" + ") + ") = " + fmt(r.g[j], 2) : "g(" + EN(j) + ") = 0 \\u00b7 the router dropped " + EN(j);
  if (s === 4) text = kept ? "first number of " + EN(j) + "\\u2019s row = " + x.map((v, c) => fmt(v) + "\\u00d7" + fmt(W_E[j][c][0])).join(" + ") + " = " + fmt(r.yi[j][0]) : EN(j) + " does not run for " + tok(i);
  if (s === 5) text = "first number of y = " + r.keep.map((e) => fmt(r.g[e], 2) + "\\u00d7" + fmt(r.yi[e][0])).join(" + ") + " = " + fmt(r.y[0], 2);
  if (readout.textContent !== text) readout.textContent = text;
}
const fields = [...root.querySelectorAll("[data-k]")];
let typing = null; // the field the reader is typing in: render() leaves its text alone until "change"
// One state, one render: every grid, bar, label, arrow and the readout is drawn from S and layer(S.X, S.k).
function render() {
  L = layer(S.X, S.k);
  const r = L.rows[S.focus];
  setGrid($("gX-grid"), S.X);
  setGrid($("gXf-grid"), [S.X[S.focus]]);
  setGrid($("gH-grid"), L.H);
  setGrid($("gHK-grid"), L.HK);
  setGrid($("gG-grid"), L.G);
  setGrid($("gLoad-grid"), [L.load]);
  setBars($("bars"), r.g);
  for (let j = 0; j < 4; j++) {
    const on = r.keep.includes(j);
    const exp = root.querySelector('.moe-exp[data-j="' + j + '"]');
    exp.toggleAttribute("data-off", !on);
    exp.querySelector(".moe-gate text").textContent = on ? fmt(r.g[j], 2) : "not run";
    root.querySelectorAll('.moe-link[data-j="' + j + '"]').forEach((el) => {
      el.toggleAttribute("data-off", !on);
      el.querySelectorAll(".u-arrow").forEach((a) => a.style.setProperty("--w", on ? (0.8 + 2 * r.g[j]).toFixed(2) : "0.8"));
    });
    setGrid($("gY" + j + "-grid"), [r.yi[j] ?? NO]);
    const w = root.querySelector('.moe-wrow[data-j="' + j + '"]');
    w.toggleAttribute("data-off", !on);
    w.querySelector("text").textContent = on ? "\\u00d7 " + fmt(r.g[j], 2) : "not run";
  }
  setGrid($("gPart-grid"), r.part.map((p) => p ?? NO));
  setGrid($("gYout-grid"), [r.y]);
  for (const id of ["gX-grid", "gH-grid", "gHK-grid", "gG-grid"]) mark($(id), S.focus);
  mark($("gRows"), S.focus, ".u-chip");
  const keep = S.k === 4 ? "keep all 4" : "keep top " + S.k;
  setLive({ tok: tok(S.focus), k: S.k, keep, kept: keep });
  root.querySelectorAll("[data-tok]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.tok === S.focus)));
  root.querySelectorAll("[data-kk]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.kk === S.k)));
  fields.forEach((f) => f !== typing && (f.value = S.X[S.focus][+f.dataset.k].toFixed(1)));
  say();
}
function pick(i, probe = null) {
  S.focus = Math.max(0, Math.min(TOKENS.length - 1, i));
  S.probe = probe;
  render();
}
// Score scene: sweep the experts one at a time for the picked token, then hold on the result.
const lightCells = (list) => {
  root.querySelectorAll("[data-hl]").forEach((el) => el.removeAttribute("data-hl"));
  list.forEach((el) => el && el.setAttribute("data-hl", ""));
};
UNFOLD.beat(1, 950, (n) => {
  scan = n < 0 ? null : n % 5 < 4 ? n % 5 : null;
  lightCells(scan === null ? [] : [...$("gWR-grid").querySelectorAll('.u-cell[data-c="' + scan + '"]'), $("gH-grid").querySelector('.u-cell[data-r="' + S.focus + '"][data-c="' + scan + '"]')]);
  say();
}, 1500);
root.addEventListener("unfold:scene", () => {
  scan = null;
  lightCells([]);
  say();
});
root.addEventListener("keydown", (e) => {
  if (e.target.closest("input,select,textarea")) return;
  const to = { ArrowUp: S.focus - 1, ArrowDown: S.focus + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  UNFOLD.pause();
  pick(to);
});
root.addEventListener("click", (e) => {
  const chipEl = e.target.closest("#gRows .u-chip");
  const cell = e.target.closest("#gX .u-cell,#gH .u-cell,#gHK .u-cell,#gG .u-cell");
  const exp = e.target.closest(".moe-exp");
  const tokB = e.target.closest("[data-tok]");
  const kB = e.target.closest("[data-kk]");
  if (chipEl) pick(+chipEl.dataset.i);
  else if (cell) pick(+cell.dataset.r, cell.closest("#gX") ? null : +cell.dataset.c);
  else if (exp) pick(S.focus, +exp.dataset.j);
  else if (tokB) pick(+tokB.dataset.tok);
  else if (kB) { S.k = +kB.dataset.kk; S.probe = null; render(); }
  else if (e.target.closest("[data-reset]")) { S.X = X0.map((row) => [...row]); S.k = ${m.K0}; S.probe = null; render(); }
  else return;
  UNFOLD.pause();
});
const ctl = root.querySelector(".u-ctl");
ctl.addEventListener("input", (e) => {
  const f = e.target.closest("[data-k]");
  const v = f && f.value !== "" ? Number(f.value) : NaN;
  if (!Number.isFinite(v)) return;
  UNFOLD.pause();
  S.X[S.focus][+f.dataset.k] = Math.max(-1, Math.min(1, Math.round(v * 10) / 10));
  S.probe = null;
  typing = f;
  render();
  typing = null;
});
ctl.addEventListener("change", () => render());
render();
`;

const th = (s) => `<b>${s}</b>`;
const notes = u.notesHtml(
  [
    {
      title: "How real models set it up",
      html: `<p>The figure uses 4 experts and keeps 2. Real layers have more experts, and each expert is far larger. The numbers below come from the papers named in each row.</p>`,
      table: {
        head: ["Model", "Experts in a layer", "Experts per token", "Source"],
        rows: [
          ["Mixture of experts, first form", "a few", "all of them (dense)", "Jacobs, Jordan, Nowlan, Hinton, 1991"],
          ["GShard", "up to 2048", "2", "Lepikhin and others, 2020"],
          ["Switch Transformer", "up to 2048", "1", "Fedus, Zoph, Shazeer, 2021"],
          ["Mixtral 8x7B", "8", "2", "Jiang and others, 2024"],
          ["DeepSeek-V3", "256, plus 1 that every token uses", "8", "DeepSeek-AI, 2024"],
        ],
      },
    },
    {
      title: "What the figure leaves out",
      table: {
        head: ["Left out", "In a real model"],
        rows: [
          ["The size of an expert", "An expert is a network with two layers and thousands of numbers per row."],
          ["Training", "The router and the experts learn together. Nobody sets the weights by hand."],
          ["Load balance", "Training adds a loss that spreads the tokens over the experts."],
          ["The rest of the block", "The output y is added to x. Attention runs before this layer."],
          ["Clean specialties", "The Mixtral paper found that the router follows syntax more than topic."],
        ],
      },
    },
    {
      title: "Terms",
      table: {
        head: ["Term", "Meaning"],
        rows: [
          [th("expert"), "one of several small networks inside a layer"],
          [th("router"), "the part that scores the experts for a token; also called the gate"],
          [th("score"), "one number per expert; a bigger score means a better fit"],
          [th("top k"), "keep the k largest scores and drop the others"],
          [th("weight"), "the share of the output that one kept expert gives"],
          [th("dense"), "every expert runs for every token"],
          [th("sparse"), "only k experts run for each token"],
          [th("load"), "how many tokens one expert gets"],
        ],
      },
    },
  ],
  { summary: "Reference: real models, what is left out, terms" },
);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: TITLE,
    hint: "← → scene · ↑ ↓ token",
    readout: "“7” → E2 0.85 · E4 0.15 · 2 of 4 experts run",
    caption:
      "One sparse mixture-of-experts layer with 4 experts and 3 numbers per token. The weights are small and set by hand so the pattern is easy to read. Each expert here is one matrix, where a real expert is a small network. Every other number is computed from the weights, and the printed values add up by hand. The buttons and the number fields run the same code as the model again.",
    body: stage,
  }) + notes;

// --artifact <file>: one page for a claude.ai Artifact, which follows the viewer's theme.
const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "mixture-of-experts-light.html" : "mixture-of-experts.html");
const html = artifact > 0 ? u.artifactHtml({ title: TITLE, body, script: live }) : u.pageHtml({ title: TITLE, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file, audio.filter(Boolean).length + " of " + scenes.length + " clips");
