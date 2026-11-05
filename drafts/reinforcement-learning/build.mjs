import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";
const u = await import(pathToFileURL(join(homedir(), ".claude/skills/unfold/kit/concept-kit.mjs")).href);

const { iso, tsub } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const light = process.argv.includes("--light");
const theme = light ? "light" : "auto";
const N = 7;
const W = 820, H = 326;
const NW = 400, NH = [590, 520, 526, 500, 526, 600, 540];
const C = 88; // grid cell
const G0 = { x: 40, y: 30 }, GN = { x: 30, y: 30 }; // grid origin, wide and narrow
const PW = { x: 438, y: 20 }, PN = { x: 20, y: 324 }; // panel origin, wide and narrow
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const text = (x, y, s, cls, extra = "") => `<text class="${cls}" x="${x}" y="${y}"${extra}>${s}</text>`;
const cellName = (s) => `(${Math.floor(s / 4)},${s % 4})`;

// ---- The grid world: one group per cell, four Q triangles in each open cell ----
const TRI = [
  `M0 0L${C} 0L${C / 2} ${C / 2}Z`,
  `M${C} 0L${C} ${C}L${C / 2} ${C / 2}Z`,
  `M0 ${C}L${C} ${C}L${C / 2} ${C / 2}Z`,
  `M0 0L0 ${C}L${C / 2} ${C / 2}Z`,
];
const QPOS = [[C / 2, 15], [C - 18, C / 2], [C / 2, C - 15], [18, C / 2]];
const cells = Array.from({ length: 12 }, (_, s) => {
  const x = (s % 4) * C, y = Math.floor(s / 4) * C;
  const kind = s === m.WALL ? "wall" : s === m.GOAL ? "goal" : s === m.PIT ? "pit" : "open";
  let inner = `<rect class="rl-bg" width="${C}" height="${C}"/>`;
  if (kind === "open")
    inner +=
      TRI.map((d, a) => `<path class="rl-tri" data-a="${a}" d="${d}"/>`).join("") +
      QPOS.map(([qx, qy], a) => `<g class="rl-qv" data-a="${a}">${text(qx, qy, "0.00", "rl-q")}</g>`).join("") +
      `<g class="rl-pol"><path class="rl-parrow" d=""/>${text(C / 2, C / 2, "", "rl-tie")}</g>`;
  if (kind === "goal") inner += `<g data-hue="green">${text(C / 2, C / 2 - 4, "+1", "rl-big")}${text(C / 2, C / 2 + 18, "goal", "rl-tag")}</g>`;
  if (kind === "pit") inner += `<g data-hue="green">${text(C / 2, C / 2 - 4, "−1", "rl-big")}${text(C / 2, C / 2 + 18, "pit", "rl-tag")}</g>`;
  if (kind === "wall") inner += text(C / 2, C / 2, "wall", "rl-tag");
  return `<g class="rl-c" data-s="${s}" data-kind="${kind}" transform="translate(${x} ${y})">${inner}<rect class="rl-ring" x="2" y="2" width="${C - 4}" height="${C - 4}" rx="4"/></g>`;
}).join("");
const axes =
  [0, 1, 2, 3].map((c) => text(c * C + C / 2, -8, c, "rl-ax")).join("") +
  [0, 1, 2].map((r) => text(-10, r * C + C / 2, r, "rl-ax")).join("") +
  text(C / 2, 3 * C + 16, "start", "rl-tag rl-start");
// The four moves around the start cell (scene 2).
const moves = [0, 1, 2, 3]
  .map((a) => {
    const cx = C / 2, cy = 2 * C + C / 2, L = 40;
    return u.arrow([cx + m.DC[a] * 16, cy + m.DR[a] * 16], [cx + m.DC[a] * L, cy + m.DR[a] * L], { hue: "gold", head: 6, width: 2 });
  })
  .join("");
const grid =
  `<g class="u-move" id="grid">${cells}${axes}<g class="rl-moves">${moves}</g>` +
  `<g id="actArrow" class="u-arrow" data-hue="gold" style="--w:2.2"><path class="u-arrow-line" d=""/><path class="u-arrow-head" d=""/></g>` +
  `<g id="agentPos" class="rl-agentpos"><g class="rl-agent" data-hue="blue"><circle r="13"/>${text(0, 0, "", "rl-r")}</g></g></g>`;

// ---- Scene 1: the agent-environment loop (the canonical picture of RL) ----
const loopArrow = (id, y, from, to, hue, name) =>
  `<g id="${id}" data-hue="${hue}">${u.arrow([from, y], [to, y], { hue, head: 7, width: 1.8 })}${text(180, y - 10, name, "rl-lname")}${text(180, y + 17, "", "rl-lval", ` data-lv="${id}"`)}</g>`;
const panelLoop =
  `<g class="u-move" id="pLoop">` +
  `<g id="lpAgent" data-hue="blue"><rect class="rl-box" x="0" y="0" width="100" height="216" rx="10"/>${text(50, 30, "agent", "rl-boxname")}${text(50, 196, "uses Q", "rl-tag")}</g>` +
  `<g id="lpEnv" data-hue="ink"><rect class="rl-box" x="260" y="0" width="100" height="216" rx="10"/>${text(310, 30, "world", "rl-boxname")}${text(310, 196, "the grid", "rl-tag")}</g>` +
  loopArrow("lpAct", 66, 102, 258, "gold", `action A${tsub("t")}`) +
  loopArrow("lpState", 126, 258, 102, "blue", `state S${tsub("t+1")}`) +
  loopArrow("lpRew", 178, 258, 102, "green", `reward R${tsub("t+1")}`) +
  `</g>`;

// ---- Scene 2: one cell, zoomed: four Q values, one per move ----
const ZC = 150;
const ZPOS = [[75, 22], [122, 75], [75, 128], [28, 75]];
const panelCell =
  `<g class="u-move" id="pCell"><g class="rl-c rl-zoom" data-s="8" data-kind="open"><rect class="rl-bg" width="${ZC}" height="${ZC}"/>` +
  [`M0 0L${ZC} 0L75 75Z`, `M${ZC} 0L${ZC} ${ZC}L75 75Z`, `M0 ${ZC}L${ZC} ${ZC}L75 75Z`, `M0 0L0 ${ZC}L75 75Z`].map((d, a) => `<path class="rl-tri" data-a="${a}" d="${d}"/>`).join("") +
  ZPOS.map(([x, y], a) => `<g data-hue="gold">${text(x, y - 7, m.ACTS[a], "rl-zname")}</g><g class="rl-qv" data-a="${a}">${text(x, y + 8, "0.00", "rl-q")}</g>`).join("") +
  `</g>${text(ZC + 14, 60, "Q(s, a): one value", "rl-tag", ' style="text-anchor:start"')}${text(ZC + 14, 76, "per cell and move", "rl-tag", ' style="text-anchor:start"')}` +
  `${text(ZC + 14, 100, "the start cell (2,0)", "rl-tag", ' style="text-anchor:start"')}</g>`;

// ---- Scenes 3, 5, 6: Q-learning as pseudocode, with the line that runs lit ----
const CODE = [
  "Q(s, a) ← 0 for every cell and move",
  "for each episode:",
  "  s ← start",
  "  until s is an end cell:",
  "    a ← ε-greedy(Q, s)",
  "    s′, r ← move(s, a)",
  "    target ← r + γ · max Q(s′, ·)",
  "    Q(s, a) ← Q(s, a) + α · (target − Q(s, a))",
  "    s ← s′",
];
const panelCode = `<g class="u-move" id="pCode">${u.codeLines(CODE, { id: "code", w: 366, lineH: 20, hue: "purple" })}</g>`;

// ---- Scene 6: moves per episode, one bar each. Hollow: the episode ended in the pit. ----
const HW = 340, HH = 52;
const panelHist =
  `<g class="u-move" id="pHist"><path class="rl-axis" d="M0 0V${HH}H${HW}"/><g class="rl-hbars"></g>` +
  text(0, HH + 15, "moves per episode · hollow: ended in the pit", "rl-tag", ' style="text-anchor:start"') +
  text(-5, 4, "", "rl-tag", ' data-lab="hmax" style="text-anchor:end"') + text(-5, HH, "0", "rl-tag", ' style="text-anchor:end"') + `</g>`;

// ---- Scene 4: the return of each move of the episode, as bars ----
const RW = 330, RH = 92;
const panelReturn =
  `<g class="u-move" id="pReturn"><g data-hue="teal">${text(-8, RH / 2, "G", "rl-rowname")}</g><g data-hue="green">${text(-8, RH + 22, "r", "rl-rowname")}</g>` +
  text(-8, RH + 40, "move", "rl-rowname rl-mute") + `<path class="rl-axis" d=""/><g class="rl-steps"></g>` +
  text(0, RH + 62, "", "rl-tag", ' data-lab="rcap" style="text-anchor:start"') + `</g>`;

// ---- Scene 7: the exact answer from value iteration, as a small grid ----
const SC = 56;
const QS = m.qStar(m.P0.gamma);
const panelPolicy =
  `<g class="u-move" id="pPolicy">${text(0, -10, "exact: value iteration", "rl-tag", ' style="text-anchor:start"')}` +
  Array.from({ length: 12 }, (_, s) => {
    const x = (s % 4) * SC, y = Math.floor(s / 4) * SC;
    const kind = s === m.WALL ? "wall" : s === m.GOAL ? "goal" : s === m.PIT ? "pit" : "open";
    const lab = kind === "goal" ? "+1" : kind === "pit" ? "−1" : kind === "wall" ? "" : "";
    return `<g class="rl-c2" data-s="${s}" data-kind="${kind}" transform="translate(${x} ${y})"><rect class="rl-bg" width="${SC}" height="${SC}"/>` +
      (kind === "open" ? `<g data-hue="ink">${text(SC / 2, SC - 9, "", "rl-v")}</g><g class="u-arrow" data-hue="ink" style="--w:1.6"><path class="u-arrow-line" d=""/><path class="u-arrow-head" d=""/></g>` : "") +
      (lab ? `<g data-hue="green">${text(SC / 2, SC / 2, lab, "rl-mid")}</g>` : "") + `<rect class="rl-ring" x="2" y="2" width="${SC - 4}" height="${SC - 4}" rx="3"/></g>`;
  }).join("") +
  text(0, 3 * SC + 18, "", "rl-tag", ' data-lab="agree" style="text-anchor:start"') + text(0, 3 * SC + 34, "", "rl-tag", ' data-lab="agree2" style="text-anchor:start"') + `</g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "Q-learning on a 4 by 3 grid world, in seven scenes: the agent and world loop, the grid, a random episode, the return, the update, many episodes, and the learned policy.",
  body: [grid, panelLoop, panelCell, panelCode, panelHist, panelReturn, panelPolicy],
});

// ---- Places per scene ----
const S = (map) => u.states(N, map);
const all = (p) => Object.fromEntries(Array.from({ length: N }, (_, i) => [i, p]));
const at = (p, scenes) => Object.fromEntries(scenes.map((i) => [i, p]));
const off = (p, dy = 0) => ({ x: p.x, y: p.y + dy });
const css = [
  u.placeCss("#grid", S(all(G0)), S(all(GN))),
  u.placeCss("#pLoop", S(at(off(PW, 26), [0])), S(at(off(PN, 10), [0]))),
  u.placeCss("#pCell", S(at({ x: PW.x + 20, y: PW.y + 40 }, [1])), S(at({ x: PN.x + 20, y: PN.y + 10 }, [1]))),
  u.placeCss("#pCode", S({ 2: off(PW, 20), 4: off(PW, 20), 5: off(PW, -8) }), S({ 2: off(PN, 6), 4: off(PN, 6), 5: off(PN, 6) })),
  u.placeCss("#pHist", S(at({ x: PW.x + 26, y: PW.y + 204 }, [5])), S(at({ x: PN.x + 24, y: PN.y + 200 }, [5]))),
  u.placeCss("#pReturn", S(at({ x: PW.x + 34, y: PW.y + 60 }, [3])), S(at({ x: PN.x + 34, y: PN.y + 10 }, [3]))),
  u.placeCss("#pPolicy", S(at({ x: PW.x + 60, y: PW.y + 50 }, [6])), S(at({ x: PN.x + 64, y: PN.y + 22 }, [6]))),
  // The grid: what each scene shows
  ".rl-bg{fill:var(--anatomy-card);stroke:var(--anatomy-lo);stroke-width:1}",
  ".rl-c[data-kind='wall'] .rl-bg,.rl-c2[data-kind='wall'] .rl-bg{fill:var(--anatomy-lo);fill-opacity:.5}",
  ".rl-c[data-kind='goal'] .rl-bg,.rl-c2[data-kind='goal'] .rl-bg{fill:color-mix(in srgb,var(--unfold-green) 22%,var(--anatomy-card))}",
  ".rl-c[data-kind='pit'] .rl-bg,.rl-c2[data-kind='pit'] .rl-bg{fill:var(--anatomy-card);stroke:var(--unfold-green);stroke-dasharray:4 3}",
  ".rl-tri{fill:var(--unfold-purple);fill-opacity:0;stroke:var(--anatomy-lo);stroke-width:.6;transition:fill-opacity .35s,stroke .3s,stroke-width .3s}",
  ".rl-tri[data-neg]{fill-opacity:0!important;stroke:var(--unfold-purple);stroke-dasharray:3 2}",
  ".rl-tri[data-hit]{stroke:var(--unfold-purple);stroke-width:2.6;stroke-dasharray:none}",
  ".rl-q{font:500 10.5px var(--anatomy-mono);font-variant-numeric:tabular-nums;fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:var(--anatomy-card);stroke-width:3px;stroke-linejoin:round}",
  ".rl-qv[data-on] .rl-q{fill:var(--unfold-purple);font-weight:700}",
  ".rl-qv[data-best] .rl-q{text-decoration:underline}",
  ".rl-big{font:700 22px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;dominant-baseline:central}",
  ".rl-mid{font:700 14px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;dominant-baseline:central}",
  ".rl-tag{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}",
  ".rl-ax{font:10px var(--anatomy-mono);fill:var(--anatomy-lo);text-anchor:middle;dominant-baseline:central}",
  ".rl-ring{fill:none;stroke:transparent;stroke-width:2;pointer-events:none;transition:stroke .3s}",
  ".rl-c[data-near] .rl-ring{stroke:var(--unfold-blue);stroke-dasharray:5 4;stroke-width:1.6}",
  ".rl-c[data-near]{cursor:pointer}",
  ".u-stage[data-scene='6'] .rl-c[data-kind='open']{cursor:pointer}",
  ".rl-c[data-focus] .rl-ring,.rl-c2[data-focus] .rl-ring{stroke:var(--anatomy-strong);stroke-width:2}",
  ".rl-agentpos{transition:transform .45s var(--anatomy-ease)}",
  ".rl-agent circle{fill:var(--hue);stroke:var(--anatomy-card);stroke-width:2}",
  ".rl-r{font:700 11px var(--anatomy-mono);fill:var(--unfold-on-hot);text-anchor:middle;dominant-baseline:central}",
  ".rl-agent[data-rew] circle{stroke:var(--unfold-green);stroke-width:4}",
  "#actArrow{transition:opacity .3s}",
  ".rl-pol{opacity:0;transition:opacity .4s}.u-stage[data-scene='6'] .rl-pol{opacity:1}",
  ".rl-parrow{fill:var(--unfold-gold)}",
  ".rl-tie{font:600 11px var(--anatomy-mono);fill:var(--unfold-gold);text-anchor:middle;dominant-baseline:central}",
  ".u-stage[data-scene='6'] :is(.rl-agentpos,#actArrow){opacity:0}",
  ".u-stage:is([data-scene='0']) .rl-qv{opacity:.35}",
  ".rl-moves{opacity:0;transition:opacity .4s}.u-stage[data-scene='1'] .rl-moves{opacity:1}",
  ".u-stage[data-scene='1'] #actArrow,.u-stage[data-scene='0'] #actArrow{opacity:0}",
  ".rl-start{opacity:.9}",
  ".u-stage[data-scene='1'] #grid .rl-c[data-s='8'] .rl-qv{opacity:0}",
  ".rl-c[data-here] .rl-big{visibility:hidden}",
  // The loop
  ".rl-box{fill:color-mix(in srgb,var(--hue) 10%,var(--anatomy-card));stroke:var(--hue);stroke-width:1.4}",
  ".rl-boxname{font:600 14px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;dominant-baseline:central}",
  ".rl-lname{font:500 11.5px var(--anatomy-mono);fill:var(--hue);text-anchor:middle}",
  ".rl-lval{font:700 12px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle}",
  "#pLoop > g{transition:opacity .35s}",
  // Zoomed cell
  ".rl-zname{font:600 11px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;dominant-baseline:central}",
  ".rl-zoom .rl-q{font-size:12px}",
  // History and return bars
  ".rl-axis{stroke:var(--anatomy-lo);fill:none}",
  ".rl-hbars rect{fill:var(--anatomy-hi);stroke:var(--anatomy-hi);stroke-width:1}.rl-hbars rect[data-pit]{fill:none}",
  ".rl-hbars rect[data-now]{fill:var(--unfold-blue);stroke:var(--unfold-blue)}.rl-hbars rect[data-now][data-pit]{fill:none}",
  ".rl-rowname{font:italic 600 14px var(--unfold-serif);fill:var(--hue);text-anchor:end;dominant-baseline:central}.rl-mute{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted)}",
  ".rl-step rect{fill:var(--unfold-teal);fill-opacity:.75;stroke:var(--unfold-teal)}.rl-step rect[data-neg]{fill-opacity:0}",
  ".rl-step .rl-gv{font:600 10px var(--anatomy-mono);fill:var(--unfold-teal);text-anchor:middle}",
  ".rl-step .rl-rv{font:600 10.5px var(--anatomy-mono);fill:var(--unfold-green);text-anchor:middle;dominant-baseline:central}",
  ".rl-step .rl-mv{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}",
  ".rl-step{transition:opacity .3s}",
  // Value iteration grid
  ".rl-v{font:600 10.5px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}",
  // Code
  "#pCode .u-line-text{font-size:11.5px}",
  "@container (max-width:520px){.rl-tag{font-size:12px}#pCode .u-line-text{font-size:12px}}",
  u.revealCss(2, "#pCode .u-line", { kind: "fade", delay: 200, stepR: 60 }),
  u.revealCss(3, "#pReturn .rl-step", { kind: "fade", delay: 300, stepR: 120 }),
  u.revealCss(6, "#pPolicy .rl-c2", { kind: "fade", delay: 300, stepR: 50 }),
].join("\n");

// ---- Voice cues: what each script line talks about lights up, the rest goes quiet ----
const QUIET = "opacity:.22";
const CUES = {
  0: {
    agent: [["#lpEnv,#lpAct,#lpState,#lpRew,#grid", QUIET]],
    env: [["#lpAgent,#lpAct", QUIET]],
    back: [["#pLoop .u-arrow", "--w:2.8"]],
  },
  1: {
    grid: [["#pCell,.rl-moves", QUIET]],
    moves: [["#pCell,#grid .rl-qv", QUIET]],
    goal: [["#grid .rl-c:not([data-s='3']),#pCell,.rl-moves", QUIET]],
    pit: [["#grid .rl-c:not([data-s='7']),#pCell,.rl-moves", QUIET]],
    q: [["#grid .rl-c:not([data-s='8']),.rl-moves", QUIET]],
  },
  2: {
    walk: [["#pCode", QUIET]],
    zero: [["#grid .rl-q", "fill:var(--unfold-purple);font-weight:700"], ["#pCode .u-line:not([data-i='7'])", QUIET]],
    you: [["#grid .rl-c[data-near] .rl-ring", "stroke-width:3"], ["#pCode", QUIET]],
  },
  3: {
    last: [["#pReturn .rl-step:not(:last-child)", QUIET]],
    bars: [["#grid", QUIET]],
    first: [["#pReturn .rl-step:not(:first-child)", QUIET], ["#grid", QUIET]],
  },
  4: {
    target: [["#grid .rl-c:not([data-cur])", QUIET], ["#pCode .u-line:not([data-i='6'])", QUIET]],
    new: [["#grid .rl-tri:not([data-hit])", "fill-opacity:0"], ["#grid .rl-qv:not([data-hit])", QUIET], ["#pCode .u-line:not([data-i='7'])", QUIET]],
  },
  5: {
    spread: [["#pCode,#pHist", QUIET]],
    explore: [["#pHist,#pCode .u-line:not([data-i='4'])", QUIET]],
    hist: [["#grid,#pCode", QUIET]],
    start: [["#grid .rl-c:not([data-s='8']),#pCode,#pHist", QUIET]],
  },
  6: {
    arrows: [["#pPolicy", QUIET], ["#grid .rl-qv", QUIET]],
    check: [["#grid .rl-qv", QUIET]],
    tie: [["#grid .rl-c:not([data-tie]),#pPolicy .rl-c2:not([data-tie])", QUIET]],
  },
};
const cueCss = Object.entries(CUES)
  .flatMap(([scene, cues]) =>
    Object.entries(cues).flatMap(([cue, rules]) =>
      rules.map(([sel, style]) => `${sel.split(/,(?![^(]*\))/).map((x) => `.u-stage[data-speaking][data-scene="${scene}"][data-cue="${cue}"] ${x.trim()}`).join(",")}{${style}}`),
    ),
  )
  .join("\n");

// ---- Math, coloured by identity ----
const { mo } = u;
const mi = (s, hue) => u.mi(s, hue);
const sb = (s, i, hue) => `<msub>${mi(s, hue)}<mrow>${i}</mrow></msub>`;
const t1 = `<mi>t</mi><mo>+</mo><mn>1</mn>`;
const Qsa = (s = "s", a = "a") => `${mi("Q", "purple")}${mo("(")}${mi(s, "blue")}<mo>,</mo>${mi(a, "gold")}${mo(")")}`;
const gam = u.mn(m.P0.gamma, { places: 2, live: "gamma" });
const alp = u.mn(m.P0.alpha, { places: 2, live: "alpha" });
const eps = u.mn(m.P0.eps, { places: 2, live: "eps" });
const target = `<mtext data-hue="teal">target</mtext>`;
const maxQ = `<munder><mo>max</mo>${prime("a")}</munder>${mi("Q", "purple")}${mo("(")}${prime("s", "blue")}<mo>,</mo>${prime("a", "gold")}${mo(")")}`;
function prime(s, hue) { return u.prime(s, hue); }
const sp = `<mspace width="0.3em"/>`;
const rows = (...r) => `<mtable columnalign="left" rowspacing="0.35em">${r.map((x) => `<mtr><mtd>${x}</mtd></mtr>`).join("")}</mtable>`;
const script = u.readScript(join(HERE, "script.md"));
const scenes = [
  { name: "Loop", math: `${sb("S", "<mi>t</mi>", "blue")}<mo>→</mo>${sb("A", "<mi>t</mi>", "gold")}<mo>→</mo>${sb("R", t1, "green")}<mo>,</mo>${sb("S", t1, "blue")}` },
  { name: "World", math: `${mi("r", "green")}<mo>=</mo><mn>+1</mn>${sp}<mtext>at the goal,</mtext>${sp}${sp}<mn>−1</mn>${sp}<mtext>at the pit,</mtext>${sp}${sp}<mn>0</mn>${sp}<mtext>else</mtext>` },
  { name: "Episode", math: rows(`${mi("a", "gold")}<mo>=</mo><mtext>a random move, with probability</mtext>${sp}<mi>ε</mi><mo>=</mo>${eps}`, `${mi("a", "gold")}<mo>=</mo><munder><mo>argmax</mo>${mi("a", "gold")}</munder>${Qsa()}<mtext>,</mtext>${sp}<mtext>else</mtext>`) },
  { name: "Return", math: `${sb("G", "<mi>t</mi>", "teal")}<mo>=</mo>${sb("r", t1, "green")}<mo>+</mo><mi>γ</mi>${sb("G", t1, "teal")}<mspace width="1em"/><mi>γ</mi><mo>=</mo>${gam}` },
  { name: "Update", math: rows(`${target}<mo>=</mo>${mi("r", "green")}<mo>+</mo>${gam}<mo>·</mo>${maxQ}`, `${Qsa()}<mo>←</mo>${Qsa()}<mo>+</mo>${alp}<mo>·</mo>${mo("(")}${target}<mo>−</mo>${Qsa()}${mo(")")}`) },
  { name: "Learn", math: `${Qsa()}<mo>←</mo>${Qsa()}<mo>+</mo>${alp}<mo>·</mo>${mo("(")}${target}<mo>−</mo>${Qsa()}${mo(")")}` },
  { name: "Policy", math: rows(`<mi data-hue="gold">π</mi>${mo("(")}${mi("s", "blue")}${mo(")")}<mo>=</mo><munder><mo>argmax</mo>${mi("a", "gold")}</munder>${Qsa()}`, `<msup><mi>V</mi><mi>∗</mi></msup>${mo("(")}${mi("s", "blue")}${mo(")")}<mo>=</mo><munder><mo>max</mo>${mi("a", "gold")}</munder><msup>${mi("Q", "purple")}<mi>∗</mi></msup>${mo("(")}${mi("s", "blue")}<mo>,</mo>${mi("a", "gold")}${mo(")")}`) },
].map((scene, i) => ({ ...scene, ...script[i] }));

const key = u.keyHtml([
  { hue: "blue", label: "state s, agent" },
  { hue: "gold", label: "action a, policy" },
  { hue: "green", label: "reward r" },
  { hue: "purple", label: "Q value Q(s, a)" },
  { hue: "teal", label: "return G, target" },
]);

const num = (k, label, min, max, step, v) => `<label>${label}<input type="number" min="${min}" max="${max}" step="${step}" value="${v}" data-in="${k}" aria-label="${label}"></label>`;
const controls =
  `<div class="rl-ctl"><button type="button" data-act="-1">agent step</button><button type="button" data-act="-2">finish episode</button>` +
  `<button type="button" data-act="-3">+10 episodes</button><button type="button" data-reset>reset</button>` +
  num("alpha", "α", 0.1, 1, 0.1, m.P0.alpha) + num("gamma", "γ", 0.5, 0.99, 0.05, m.P0.gamma) + num("eps", "ε", 0, 0.5, 0.05, m.P0.eps) + `</div>`;
const audio = await u.narrate(scenes, { dir: join(HERE, "voice"), provider: "gemini", model: "gemini-3.8-flash-tts", voice: "Kore" });
const stage = u.stageHtml({
  audio,
  scenes,
  svg,
  label: "Q-learning explainer. Left and right arrows change the scene. Comma and period step through time. Click a cell next to the agent to move it there. In the Policy scene, click a cell to compare it with the exact answer.",
  css: css + "\n" + cueCss + "\n.rl-ctl{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 12px}",
  key,
  dwell: 7000,
  time: { steps: m.H0.length, scenes: [2, 4, 5, 6], label: "step" },
  controls,
  controlScenes: [2, 3, 4, 5, 6],
  narrow: [NW, NH],
});

// ---- Page script: every number from the model's own replay(), at the current step ----
const live = `
${u.modelScript([m.rnd, m.isTerminal, m.envStep, m.bestActs, m.choose, m.init, m.step, m.replay, m.planAt, m.returns, m.history, m.qStar], {
  COLS: m.COLS, ROWS: m.ROWS, START: m.START, GOAL: m.GOAL, PIT: m.PIT, WALL: m.WALL, DR: m.DR, DC: m.DC, P0: m.P0, SEED: m.SEED, EPISODES: m.EPISODES, MAXEP: m.MAXEP, MAXH: m.MAXH,
  C, SC, HW, HH, RW, RH, CODE_N: CODE.length,
})}
const ACTS = ["up", "right", "down", "left"];
const STATES = [0, 1, 2, 4, 6, 8, 9, 10, 11];
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const $ = (s) => root.querySelector(s);
const $$ = (s) => root.querySelectorAll(s);
const cn = (s) => "(" + Math.floor(s / COLS) + "," + (s % COLS) + ")";
const f2 = (v) => fmt(v, 2), f3 = (v) => fmt(v, 3);
const pr = (v) => (v < 0 ? "(" + f3(v) + ")" : f3(v));
const PRESET = Array.from({ length: EPISODES }, () => -2);
// The state: the run H (one entry per step, from step 0), the step t on screen, and the plan that made H.
let P = { ...P0 }, plan = PRESET, H = replay(P, plan, SEED), t = 0, phase = 3, focusS = START;
let QX = qStar(P.gamma);
const ep1 = () => H.findIndex((h) => h.done);
const ends = () => H.map((h, i) => (h.done ? i : -1)).filter((i) => i > 0);
const optActs = (s) => bestActs(QX[s].map((q) => Math.round(q * 1e9)));
// Which scene owns step t: 0 is the World, episode 1 before its end is the Episode, its last move is the Update.
function owner(t) {
  const e = ep1();
  if (t === 0) return 1;
  if (e < 0 || t < e) return 2;
  return t === e ? 4 : 5;
}
const center = (s) => [(s % COLS) * C + C / 2, Math.floor(s / COLS) * C + C / 2];
function arrowD(a, b, bend, head) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const cx = mx - ((b[1] - a[1]) / len) * bend, cy = my + ((b[0] - a[0]) / len) * bend;
  const tl = Math.hypot(b[0] - cx, b[1] - cy) || 1, ux = (b[0] - cx) / tl, uy = (b[1] - cy) / tl;
  const bx = b[0] - ux * head, by = b[1] - uy * head, w = head * 0.55;
  return ["M" + a[0] + " " + a[1] + "Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + bx.toFixed(1) + " " + by.toFixed(1),
    "M" + b[0] + " " + b[1] + "L" + (bx - uy * w).toFixed(1) + " " + (by + ux * w).toFixed(1) + "L" + (bx + uy * w).toFixed(1) + " " + (by - ux * w).toFixed(1) + "Z"];
}
function setArrow(g, a, b, bend, head) {
  const [d1, d2] = arrowD(a, b, bend, head);
  g.querySelector(".u-arrow-line").setAttribute("d", d1);
  g.querySelector(".u-arrow-head").setAttribute("d", d2);
}
// ---- One render for every view, from H[t] ----
function render() {
  const s = UNFOLD.scene(), st = H[t], L = st.last;
  const before = s === 4 && phase < 3 && t > 0 ? H[t - 1] : st;
  const Q = before.Q;
  // Q triangles
  $$(".rl-c[data-kind='open']").forEach((g) => {
    const c = +g.dataset.s, row = Q[c], best = bestActs(row);
    g.querySelectorAll(".rl-tri").forEach((p) => {
      const a = +p.dataset.a, q = row[a];
      p.style.fillOpacity = q > 0 ? (0.08 + 0.6 * Math.min(1, q)).toFixed(2) : 0;
      p.toggleAttribute("data-neg", q < 0);
      p.toggleAttribute("data-hit", !g.classList.contains("rl-zoom") && !!L && L.s === c && L.a === a && s >= 2 && s !== 6);
    });
    g.querySelectorAll(".rl-qv").forEach((v) => {
      const a = +v.dataset.a;
      v.firstChild.textContent = f2(row[a]);
      v.toggleAttribute("data-on", row[a] !== 0);
      v.toggleAttribute("data-best", s === 6 && best.length === 1 && best[0] === a);
      v.toggleAttribute("data-hit", !!L && L.s === c && L.a === a);
    });
    // Policy: the greedy move, or "tie" when two or more moves share the biggest Q value
    if (g.classList.contains("rl-zoom")) return;
    const tie = best.length > 1;
    g.toggleAttribute("data-tie", tie);
    g.querySelector(".rl-tie").textContent = tie ? "tie" : "";
    const [cx, cy] = [C / 2, C / 2], a = best[0];
    g.querySelector(".rl-parrow").setAttribute("d", tie ? "" : arrowHead(cx, cy, a));
  });
  // Agent, its last move, and the reward it got
  const shown = s === 4 && phase < 1 && L ? L.s : st.pos;
  const [ax, ay] = center(s < 2 ? START : shown);
  $("#agentPos").style.transform = "translate(" + ax + "px," + ay + "px)";
  const ag = $(".rl-agent");
  const rew = L && !(s === 4 && phase < 1) ? L.r : null;
  ag.querySelector("text").textContent = rew === null || s < 2 ? "" : rew > 0 ? "+1" : rew < 0 ? "−1" : "0";
  ag.toggleAttribute("data-rew", !!rew && s >= 2);
  const arr = $("#actArrow");
  if (L && s >= 2 && s !== 6 && !(s === 4 && phase < 1)) {
    const a = center(L.s), b = center(L.next);
    if (L.s === L.next) setArrow(arr, a, [a[0] + DC[L.a] * C * 0.46, a[1] + DR[L.a] * C * 0.46], 0, 7);
    else setArrow(arr, a, [b[0] - DC[L.a] * 15, b[1] - DR[L.a] * 15], 30, 8);
    arr.style.opacity = 1;
  } else arr.style.opacity = 0;
  // Cells next to the agent: click one to make that move
  const from = st.done ? START : st.pos;
  const near = s >= 2 && s !== 6 ? [0, 1, 2, 3].map((a) => envStep(from, a).next).filter((n) => n !== from) : [];
  $$(".rl-c").forEach((g) => {
    const c = +g.dataset.s;
    g.toggleAttribute("data-near", near.includes(c));
    g.toggleAttribute("data-cur", !!L && (c === L.s || c === L.next));
    g.toggleAttribute("data-focus", s === 6 && c === focusS);
    g.toggleAttribute("data-here", s >= 2 && s !== 6 && c === shown);
  });
  mark($("#code"), codeLine(s), ".u-line");
  drawLoop(); drawHist(); drawReturn(); drawPolicy();
  setLive({ alpha: P.alpha, gamma: P.gamma, eps: P.eps });
  UNFOLD.timeAt(t, H.length);
  say(s);
}
function arrowHead(cx, cy, a) {
  const dx = DC[a], dy = DR[a], L = 11, w = 8;
  const tx = cx + dx * L, ty = cy + dy * L, bx = cx - dx * 7, by = cy - dy * 7;
  return "M" + tx + " " + ty + "L" + (bx - dy * w) + " " + (by + dx * w) + "L" + (bx + dy * w) + " " + (by - dx * w) + "Z";
}
// The pseudocode line that runs in this step
function codeLine(s) {
  if (t === 0) return 0;
  if (s === 4) return [4, 5, 6, 7][phase];
  const L = H[t].last;
  return L.nw !== L.old ? 7 : 5;
}
function drawLoop() {
  const L = t > 0 ? H[t].last : H.length > 1 ? H[1].last : null;
  const k = t > 0 ? t - 1 : 0;
  const set = (id, s) => ($('[data-lv="' + id + '"]').textContent = s);
  if (!L) return;
  set("lpAct", ACTS[L.a]);
  set("lpState", cn(L.next));
  set("lpRew", L.r > 0 ? "+1" : L.r < 0 ? "−1" : "0");
}
function drawHist() {
  const g = $("#pHist .rl-hbars");
  const eps = history(H, t);
  const n = Math.max(EPISODES, eps.length), top = Math.max(10, ...eps.map((e) => e.len));
  const bw = HW / n;
  g.innerHTML = eps.map((e, i) => {
    const h = (e.len / top) * HH;
    return '<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + (HH - h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '"' + (e.r < 0 ? " data-pit" : "") + (i === eps.length - 1 ? " data-now" : "") + "/>";
  }).join("");
  $('#pHist [data-lab="hmax"]').textContent = top;
}
// The return of every move in the episode that holds step t
function drawReturn() {
  const R = returns(H, Math.max(1, Math.min(t, H.length - 1)), P.gamma);
  const g = $("#pReturn .rl-steps");
  if (H.length < 2) { g.innerHTML = ""; return; }
  const n = R.steps.length, bw = Math.min(40, RW / n), labels = n <= 12;
  const neg = R.steps.some((x) => x.G < 0), y0 = neg ? RH / 2 : RH, sc = neg ? RH / 2 : RH;
  $("#pReturn .rl-axis").setAttribute("d", "M0 " + y0 + "H" + (n * bw));
  g.innerHTML = R.steps.map((x, i) => {
    const h = Math.abs(x.G) * sc, y = x.G >= 0 ? y0 - h : y0, cx = i * bw + bw / 2;
    return '<g class="rl-step" style="--r:' + i + '"><rect x="' + (i * bw + 3).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, bw - 6).toFixed(1) + '" height="' + Math.max(0.5, h).toFixed(1) + '"' + (x.G < 0 ? " data-neg" : "") + "/>" +
      (labels ? '<text class="rl-gv" x="' + cx.toFixed(1) + '" y="' + (x.G >= 0 ? y - 5 : y + h + 12).toFixed(1) + '">' + f2(x.G) + "</text>" +
      '<text class="rl-rv" x="' + cx.toFixed(1) + '" y="' + (RH + 22) + '">' + (x.r > 0 ? "+1" : x.r < 0 ? "−1" : "0") + "</text>" +
      '<text class="rl-mv" x="' + cx.toFixed(1) + '" y="' + (RH + 40) + '">' + (i + 1) + "</text>" : "") + "</g>";
  }).join("");
  $('#pReturn [data-lab="rcap"]').textContent = "episode " + H[R.to].ep + (R.done ? " ended at move " + n : ", not ended: return so far");
}
// Learned moves against the exact moves from value iteration
function drawPolicy() {
  const Q = H[t].Q;
  let agree = 0, ties = 0;
  const differ = [];
  STATES.forEach((s) => {
    const b = bestActs(Q[s]), o = optActs(s);
    if (b.length > 1) ties++;
    else if (o.includes(b[0])) agree++;
    else differ.push(cn(s));
  });
  $$("#pPolicy .rl-c2").forEach((g) => {
    const s = +g.dataset.s;
    g.toggleAttribute("data-focus", s === focusS);
    g.toggleAttribute("data-tie", STATES.includes(s) && bestActs(Q[s]).length > 1);
    if (g.dataset.kind !== "open") return;
    g.querySelector(".rl-v").textContent = f2(Math.max(...QX[s]));
    const o = optActs(s), cx = SC / 2, cy = SC / 2 - 6;
    const paths = o.map((a) => arrowD([cx, cy], [cx + DC[a] * 18, cy + DR[a] * 18], 0, 6));
    const ar = g.querySelector(".u-arrow");
    ar.querySelector(".u-arrow-line").setAttribute("d", paths.map((p) => p[0]).join(""));
    ar.querySelector(".u-arrow-head").setAttribute("d", paths.map((p) => p[1]).join(""));
  });
  $('#pPolicy [data-lab="agree"]').textContent = "learned = exact in " + agree + " of 9 cells";
  $('#pPolicy [data-lab="agree2"]').textContent = (ties ? ties + (ties > 1 ? " ties" : " tie") : "no ties") + (differ.length ? " · differs: " + differ.join(" ") : "");
}
function how(L) { return L.own ? "your move" : L.explore ? "random (ε)" : L.tie ? "tie, picked at random" : "best move"; }
function say(s) {
  const st = H[t], L = st.last;
  let x = "";
  if (s === 0) x = L ? "step " + t + ": " + cn(L.s) + " · action " + ACTS[L.a] + " · next " + cn(L.next) + " · reward " + L.r : "step 0: the agent is at the start " + cn(START);
  if (s === 1) x = "start " + cn(START) + " · goal " + cn(GOAL) + " gives +1 · pit " + cn(PIT) + " gives −1 · else 0";
  if (s === 2) x = !L ? "episode 1 · step 0 · every Q value is 0" : "episode " + st.ep + " · move " + st.n + ": " + cn(L.s) + " " + ACTS[L.a] + " · r = " + L.r + " · " + how(L);
  if (s === 3) {
    const R = returns(H, Math.max(1, t), P.gamma), a = R.steps[0], b = R.steps[1];
    x = !a ? "no move yet" : b ? "move 1: G = r + γ·G′ = " + a.r + " + " + f2(P.gamma) + " × " + f3(b.G) + " = " + f3(a.G) : "move 1: G = r = " + a.r;
  }
  if (s === 4 && L) {
    if (phase === 0) x = "a = " + ACTS[L.a] + " in " + cn(L.s) + ": " + how(L);
    if (phase === 1) x = "move: " + cn(L.s) + " " + ACTS[L.a] + " → " + cn(L.next) + " · reward r = " + L.r;
    if (phase === 2) x = "target = " + L.r + " + " + f2(P.gamma) + " × " + f3(L.best) + " = " + f3(L.target) + (L.done ? " · " + cn(L.next) + " is an end cell" : " · best Q in " + cn(L.next));
    if (phase === 3) x = "Q = " + f3(L.old) + " + " + f2(P.alpha) + " × (" + f3(L.target) + " − " + pr(L.old) + ") = " + f3(L.nw);
  }
  if (s === 5 && L) x = "episode " + st.ep + " · move " + st.n + " · Q(" + cn(L.s) + ", " + ACTS[L.a] + "): " + f3(L.old) + " → " + f3(L.nw);
  if (s === 6) {
    const b = bestActs(st.Q[focusS]), o = optActs(focusS);
    x = cn(focusS) + ": learned " + (b.length > 1 ? "tie" : ACTS[b[0]]) + ", Q " + f3(Math.max(...st.Q[focusS])) + " · exact " + o.map((a) => ACTS[a]).join("/") + ", V* " + f3(Math.max(...QX[focusS]));
  }
  if (readout.textContent !== x) readout.textContent = x;
}
const setT = (v) => { t = Math.max(0, Math.min(H.length - 1, v)); render(); };
// The representative step of each scene, when it opens
const rep = (s) => {
  const e = ep1(), last = H.length - 1;
  if (s <= 1) return 0;
  if (s === 2) return Math.min(1, last);
  if (s === 3 || s === 4) return e > 0 ? e : last;
  return last;
};
root.addEventListener("unfold:scene", (e) => { phase = 3; setT(rep(e.detail.scene)); });
UNFOLD.beat(2, 850, (n) => setT(n < 0 ? (ep1() > 0 ? ep1() - 1 : H.length - 1) : n + 1), 900, () => Math.max(1, (ep1() > 0 ? ep1() : H.length) - 1));
UNFOLD.beat(4, 1500, (n) => { phase = n < 0 ? 3 : n; render(); }, 700, 4);
UNFOLD.beat(5, 360, (n) => { const E = ends(); setT(n < 0 ? H.length - 1 : E[n + 1] ?? H.length - 1); }, 900, () => Math.max(1, ends().length - 1));
UNFOLD.onTime((v) => {
  const cur = UNFOLD.scene(), want = cur === 6 ? 6 : owner(v);
  if (cur !== want) UNFOLD.go(want);
  phase = 3;
  setT(v);
});
// The reader's own operation: a move (0-3), one policy step (-1), finish the episode (-2), ten more episodes (-3).
function act(p) {
  UNFOLD.pause();
  plan = planAt(H, t);
  if (p === -3) plan = plan.concat(Array.from({ length: 10 }, () => -2));
  else plan.push(p);
  H = replay(P, plan, SEED);
  plan = planAt(H, H.length - 1);
  const cur = UNFOLD.scene(), nt = H.length - 1;
  const want = cur === 3 || cur === 6 ? cur : owner(nt);
  if (want !== cur) UNFOLD.go(want);
  UNFOLD.pause();
  phase = 3;
  setT(nt);
}
root.querySelector("svg").addEventListener("click", (e) => {
  const g = e.target.closest(".rl-c");
  if (!g || g.classList.contains("rl-zoom")) return;
  const c = +g.dataset.s;
  if (UNFOLD.scene() === 6) {
    if (!STATES.includes(c)) return;
    UNFOLD.pause();
    focusS = c;
    return render();
  }
  if (!g.hasAttribute("data-near")) return;
  const from = H[t].done ? START : H[t].pos;
  const a = [0, 1, 2, 3].find((k) => envStep(from, k).next === c);
  if (a !== undefined) act(a);
});
const ctl = root.querySelector(".u-controls");
const fields = () => ctl.querySelectorAll("[data-in]").forEach((el) => (el.value = String(P[el.dataset.in])));
ctl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act],[data-reset]");
  if (!b) return;
  if (b.hasAttribute("data-reset")) {
    UNFOLD.pause();
    P = { ...P0 }; QX = qStar(P.gamma); plan = PRESET; H = replay(P, plan, SEED); phase = 3; fields();
    return setT(0);
  }
  act(+b.dataset.act);
});
// A new α, γ or ε runs the same plan again with the model's own replay().
ctl.addEventListener("input", (e) => {
  const el = e.target.closest("[data-in]");
  const v = el && el.value !== "" ? Number(el.value) : NaN;
  if (!Number.isFinite(v)) return;
  UNFOLD.pause();
  const k = el.dataset.in, lim = { alpha: [0.1, 1], gamma: [0.5, 0.99], eps: [0, 0.5] }[k];
  P = { ...P, [k]: Math.round(Math.max(lim[0], Math.min(lim[1], v)) * 100) / 100 };
  QX = qStar(P.gamma);
  H = replay(P, plan, SEED);
  setT(Math.min(t, H.length - 1));
});
ctl.addEventListener("change", (e) => e.target.closest("[data-in]") && fields());
root.addEventListener("unfold:layout", render);
render();
`;

// ---- Notes under the card ----
const QL = m.H0.at(-1).Q;
const notes = u.notesHtml([
  {
    title: "Check: the preset run after 30 episodes, against value iteration",
    html: `<p>Value iteration solves the same grid exactly. A cell off the path the agent takes is visited only when it explores, so its value can still be low.</p>`,
    table: {
      head: ["cell", "learned max Q", "exact V*", "learned move", "exact move"],
      rows: m.STATES.map((s) => {
        const b = m.bestActs(QL[s]), o = m.bestActs(QS[s].map((q) => Math.round(q * 1e9)));
        return [cellName(s), u.fmt(Math.max(...QL[s]), 3), u.fmt(Math.max(...QS[s]), 3), b.length > 1 ? "tie" : m.ACTS[b[0]], o.map((a) => m.ACTS[a]).join(" or ")];
      }),
    },
  },
  {
    title: "What real problems add",
    table: {
      head: ["topic", "in practice"],
      rows: [
        ["random moves", "A move can land in more than one cell. Q then learns the average return."],
        ["huge state spaces", "A neural network replaces the table (DQN, Atari games)."],
        ["SARSA", "Uses the move it really takes next, not the best one. It learns the exploring policy."],
        ["policy gradient", "Learns the policy directly, without a Q table (REINFORCE, PPO)."],
        ["ε schedule", "ε usually starts high and goes down, so the agent explores less later."],
        ["sparse rewards", "With one reward at the end, values take many episodes to spread back."],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["agent", "the learner that picks the actions"],
        ["state s", "where the agent is: here, one cell"],
        ["action a", "one move: up, right, down or left"],
        ["reward r", "the number the world returns after a move"],
        ["episode", "one walk from the start to an end cell"],
        ["return G", "the sum of later rewards, each times γ per move of delay"],
        ["Q(s, a)", "the expected return after action a in state s"],
        ["γ (gamma)", "the discount: how much one move of delay costs"],
        ["α (alpha)", "the learning rate: how far one update moves Q"],
        ["ε (epsilon)", "how often the agent picks a random move"],
        ["policy π", "the rule that picks a move in each state"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Q-learning",
    hint: "← → scene · , . step · click a cell next to the agent",
    readout: "step 0: the agent is at the start (2,0)",
    caption:
      "A 4 by 3 grid world with moves that always go where they point. We chose the grid, the rewards, α = 0.5, γ = 0.9, ε = 0.2 and the random seed by hand. The page computes in full precision. It prints 2 places on the grid and 3 in the readout, so a hand check can differ in the last place. The learned values are checked against value iteration on the same grid. The narration speaks the numbers of the starting run. The buttons and fields run the same code again from the step on screen.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, light ? "reinforcement-learning-light.html" : "reinforcement-learning.html");
const html = artifact > 0 ? u.artifactHtml({ title: "Q-learning", body, script: live }) : u.pageHtml({ title: "Q-learning", theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
