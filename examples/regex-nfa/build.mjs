import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
// A figure for docs: follow the reader's system theme. --light writes the light page for the checks.
const theme = process.argv.includes("--light") ? "light" : "auto";
const LAST = m.STEPS.length - 1;
const MAXSTEPS = 1 + 2 * m.MAXLEN;
const R = 18;

// Colour identity: blue = in the set S, yellow = the symbol read, purple = ε edge, red = dropped, green = accept.
// The drawing exists twice: a wide layout (820) and a narrow one (430) where the graph runs top to bottom.
// ponytail: two copies of the drawing instead of morphing one; the script updates both through data attributes.
const WIDE = {
  w: 820,
  h: 540,
  pos: { 0: [40, 170], 1: [155, 170], 2: [270, 170], 3: [385, 105], 4: [385, 235], 5: [500, 170], 6: [640, 170], 7: [770, 170] },
  ctrl: { e51: [327.5, -90], e16: [397.5, 430] },
  label: { e01: [97, 158], e12: [212, 158], e23: [316, 126], e24: [316, 216], e35: [454, 126], e45: [454, 216], e67: [705, 158] },
  arcText: { e51: [0, -10, "loop back"], e16: [0, 16, "leave loop"] },
  brackets: [
    [22, 128, "a"],
    [140, 520, "(b|c)*"],
    [622, 790, "d"],
  ],
  bracketY: 336,
  code: [628, 20],
  tape: [0, 390],
  set: [0, 476],
  grid: [470, 380],
};
const NARROW = {
  w: 430,
  h: 930,
  pos: { 0: [200, 40], 1: [200, 120], 2: [200, 210], 3: [130, 295], 4: [270, 295], 5: [200, 380], 6: [200, 470], 7: [200, 560] },
  ctrl: { e51: [-110, 250], e16: [490, 295] },
  label: { e01: [214, 80], e12: [214, 165], e23: [150, 244], e24: [250, 244], e35: [150, 346], e45: [250, 346], e67: [214, 515] },
  arcText: { e51: [16, 0, "loop back", "start"], e16: [8, 0, "leave loop", "start"] },
  brackets: [],
  code: [252, 16],
  tape: [40, 620],
  set: [40, 704],
  grid: [60, 790],
};

const r1 = (v) => Math.round(v * 10) / 10;
const unit = ([x, y]) => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

function edgeSvg(L, e) {
  const a = L.pos[e.from];
  const b = L.pos[e.to];
  const c = L.ctrl[e.id] ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const ua = unit([c[0] - a[0], c[1] - a[1]]);
  const ub = unit([c[0] - b[0], c[1] - b[1]]);
  const p0 = [a[0] + ua[0] * R, a[1] + ua[1] * R];
  const tip = [b[0] + ub[0] * (R + 1), b[1] + ub[1] * (R + 1)];
  const head = 7;
  const base = [tip[0] + ub[0] * head, tip[1] + ub[1] * head];
  const [nx, ny] = [-ub[1], ub[0]];
  const d = `M${r1(p0[0])} ${r1(p0[1])}Q${r1(c[0])} ${r1(c[1])} ${r1(base[0])} ${r1(base[1])}`;
  const full = `M${r1(p0[0])} ${r1(p0[1])}Q${r1(c[0])} ${r1(c[1])} ${r1(tip[0])} ${r1(tip[1])}`;
  const tri = `M${r1(tip[0])} ${r1(tip[1])}L${r1(base[0] + nx * 4)} ${r1(base[1] + ny * 4)}L${r1(base[0] - nx * 4)} ${r1(base[1] - ny * 4)}Z`;
  const eps = e.sym === null;
  let text;
  if (L.ctrl[e.id]) {
    const apex = [0.25 * p0[0] + 0.5 * c[0] + 0.25 * tip[0], 0.25 * p0[1] + 0.5 * c[1] + 0.25 * tip[1]];
    const [dx, dy, words, anchor = "middle"] = L.arcText[e.id];
    const at = [apex[0] + dx, apex[1] + dy];
    const side = anchor === "middle" ? [at[0] + 12, at[1], "start"] : [at[0], at[1] + 16, "start"];
    text = `<text class="el-elabel" x="${r1(at[0])}" y="${r1(at[1])}" text-anchor="${anchor}">ε</text><text class="el-note" x="${r1(side[0])}" y="${r1(side[1])}" text-anchor="${side[2]}">${words}</text>`;
  } else {
    const [lx, ly] = L.label[e.id];
    text = `<text class="el-elabel" x="${lx}" y="${ly}">${eps ? "ε" : e.sym}</text>`;
  }
  const token = `<circle class="el-tok" r="4.5" opacity="0"><animateMotion dur="0.75s" begin="indefinite" fill="freeze" path="${full}"/><animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="0.75s" begin="indefinite" fill="freeze"/></circle>`;
  return `<g class="el-edge" data-e="${e.id}"${eps ? " data-eps" : ""}><path class="el-line" d="${d}"/><path class="el-head" d="${tri}"/>${text}${token}</g>`;
}

// The halo marks a state that died on this symbol and was reached again by another edge (5 on b or c).
function stateSvg(L, s) {
  const [x, y] = L.pos[s];
  const accept = s === m.ACCEPT ? `<circle class="el-accept" r="${R + 4.5}"/>` : "";
  return `<g class="el-state" data-s="${s}" transform="translate(${x} ${y})"><circle class="el-halo" r="${R + 8}"/>${accept}<circle class="el-ring" r="${R}"/><text class="el-num">${s}</text></g>`;
}

// The tape has MAXLEN slots. The page fills them from the reader's input and hides the rest.
function tapeSvg(L) {
  const [x, y] = L.tape;
  const chips = Array.from({ length: m.MAXLEN }, (_, i) => {
    const ch = m.INPUT[i] ?? "";
    return `<g class="el-ch" data-p="${i}"${ch ? "" : " data-gone"} transform="translate(${x + i * 44} ${y})"><rect width="36" height="36" rx="5"/><text x="18" y="18">${ch}</text></g>`;
  }).join("");
  return `<text class="el-title" x="${x}" y="${y - 12}">input (click a letter)</text>${chips}`;
}

function setSvg(L) {
  const [x, y] = L.set;
  return (
    `<text class="el-title" x="${x}" y="${y - 26}">states the NFA is in</text>` +
    `<text class="el-sname" x="${x}" y="${y}">S</text><text class="el-set" x="${x + 18}" y="${y}">= {0}</text>` +
    `<g class="el-verdict"><text class="el-v1" x="${x}" y="${y + 28}"></text><text class="el-v2" x="${x}" y="${y + 47}"></text></g>` +
    `<g class="el-drop"><text class="el-d1" x="${x}" y="${y + 28}"></text><text class="el-d2" x="${x}" y="${y + 47}"></text></g>`
  );
}

// Trace: one row per state, one column per step, MAXSTEPS columns. A filled cell means the state is in S at that step.
const CW = 20;
const RH = 14;
function gridSvg(L) {
  const [x0, y] = L.grid;
  const top = y + 16;
  const head = Array.from({ length: MAXSTEPS }, (_, t) => {
    const s = m.STEPS[t];
    const text = !s ? "" : s.kind === "move" ? s.sym : s.kind === "closure" ? "ε" : "";
    return `<text class="el-gh" data-c="${t}" data-k="${s?.kind ?? ""}" x="${x0 + t * CW + CW / 2}" y="${y + 4}">${text}</text>`;
  }).join("");
  const rows = Array.from({ length: m.N }, (_, s) => `<text class="el-rl" x="${x0 - 10}" y="${top + s * RH + RH / 2 - 1}">${s}</text>`).join("");
  const cells = Array.from({ length: MAXSTEPS }, (_, t) =>
    Array.from({ length: m.N }, (_, s) => {
      const st = m.STEPS[t];
      return `<rect class="el-cell" data-c="${t}" data-s="${s}"${st?.set.includes(s) ? " data-in" : ""}${st ? "" : " data-gone"} x="${x0 + t * CW + 2}" y="${top + s * RH + 1}" width="${CW - 4}" height="${RH - 3}" rx="2"/>`;
    }).join(""),
  ).join("");
  const foot = Array.from({ length: MAXSTEPS }, (_, t) => `<text class="el-gf" data-c="${t}"${t > LAST ? " data-gone" : ""} x="${x0 + t * CW + CW / 2}" y="${top + m.N * RH + 10}">${t}</text>`).join("");
  const col = `<rect class="el-col" x="${x0}" y="${y - 6}" width="${CW}" height="${m.N * RH + 38}" rx="4" style="transform:translateX(${LAST * CW}px)"/>`;
  return `<text class="el-title" x="${x0 - 18}" y="${y - 14}">trace: S at each step</text><text class="el-axis" x="${x0 - 2}" y="${top + m.N * RH + 10}" text-anchor="end" dominant-baseline="central">step</text>${col}${head}${rows}${cells}${foot}`;
}

// The loop the figure runs, one line per kind of step. The page lights the line of the current step.
const CODE = ["S ← ε-closure({0})", "for each symbol x:", "  S ← δ(S, x)", "  S ← ε-closure(S)", `match if ${m.ACCEPT} ∈ S`];
const LINE = { start: 0, move: 2, closure: 3 };
function codeSvg(L) {
  const [x, y] = L.code;
  return `<text class="el-title" x="${x}" y="${y - 8}">the loop</text>` + u.codeLines(CODE, { x, y, w: 178, lineH: 19, hue: "blue" });
}

function bracketSvg(L) {
  return L.brackets
    .map(([x1, x2, text]) => {
      const y = L.bracketY;
      return `<path class="el-br" d="M${x1} ${y - 5}V${y}H${x2}V${y - 5}"/><text class="el-brt" x="${(x1 + x2) / 2}" y="${y + 15}">${text}</text>`;
    })
    .join("");
}

const draw = (L, cls) =>
  `<g class="${cls}">${bracketSvg(L)}${m.EDGES.map((e) => edgeSvg(L, e)).join("")}${Array.from({ length: m.N }, (_, s) => stateSvg(L, s)).join("")}${codeSvg(L)}${tapeSvg(L)}${setSvg(L)}${gridSvg(L)}</g>`;

const svg = iso.figureSvg({
  width: WIDE.w,
  height: WIDE.h,
  label: `An NFA for the regex ${m.REGEX} with ${m.N} states, reading an input string. Active states are lit, the symbol read is marked on the input, and a trace grid shows the set of states at each step.`,
  body: [draw(WIDE, "el-wide"), draw(NARROW, "el-narrow")],
});

// ---- Math ----
// Scenes 2 to 5 show the current step's equation. Its sets and its symbol are live: the page rewrites them on every step.
const mo = u.mo;
const delta = `<mi data-hue="yellow">δ</mi>`;
const clos = `<mi data-hue="purple">ε</mi><mtext data-hue="purple">-closure</mtext>`;
const S = (sub) => (sub === undefined ? u.mi("S", "blue") : `<msub>${u.mi("S", "blue")}<mi>${sub}</mi></msub>`);
const liveSet = (name, set) => `${mo("{")}<mn data-hue="blue" data-live="${name}">${set.join(", ")}</mn>${mo("}")}`;
const s0 = m.STEPS[LAST];
const stepMath =
  `<mrow class="eq-move">${delta}${mo("(")}${liveSet("from", s0.before)}${mo(",")}<mi data-hue="yellow" mathvariant="normal" data-live="x">${s0.sym ?? ""}</mi>${mo(")")}${mo("=")}${liveSet("to", s0.set)}</mrow>` +
  `<mrow class="eq-clo">${clos}${mo("(")}${liveSet("from", s0.before)}${mo(")")}${mo("=")}${liveSet("to", s0.set)}</mrow>`;

const hue = (h, t) => `<span data-hue="${h}">${t}</span>`;
const nSym = m.EDGES.filter((e) => e.sym !== null).length;
const nEps = m.EDGES.length - nSym;
const scenes = [
  {
    name: "Overview",
    math: `${S("t+1")}${mo("=")}${clos}${mo("(")}${delta}${mo("(")}${S("t")}${mo(",")}<msub><mi data-hue="yellow">x</mi><mi>t</mi></msub>${mo(")")}${mo(")")}`,
    voice: `An NFA can be in several states at once, so it keeps a <b data-hue="blue">set S</b>. It matches if <b data-hue="green">accept state 7</b> is in S when the input ends.`,
  },
  {
    name: "Build",
    rule: `${m.REGEX.split("").join(" ").replace(" *", "*")}  →  ${m.N} states · ${hue("yellow", `${nSym} symbol edges`)} · ${hue("purple", `${nEps} ε edges`)}`,
    voice: `Each piece of the regex becomes a piece of the graph. The star adds two <b data-hue="purple">ε edges</b>, which move without reading input.`,
  },
  {
    name: "Read",
    math: stepMath,
    voice: `A state can only follow an edge that carries the <b data-hue="yellow">symbol read</b>. The machine checks every state in S, not one path.`,
  },
  {
    name: "ε-closure",
    math: stepMath,
    voice: `Next the machine follows every <b data-hue="purple">ε edge</b> it can reach, because they read no input. This step is the ε-closure.`,
  },
  {
    name: "Loop",
    math: stepMath,
    voice: `States without an edge for the symbol <b data-hue="red">drop out</b>. When 5 is in S, the ε edge from 5 to 1 adds the loop states to S again.`,
  },
  {
    name: "End",
    math: stepMath,
    voice: `After the last symbol, the machine checks S once. The input matches only if <b data-hue="green">accept state 7</b> is in S.`,
  },
];

const css = [
  `.el-narrow{display:none}.u-stage[data-narrow] .el-narrow{display:inline}.u-stage[data-narrow] .el-wide{display:none}`,
  `.u-stage[data-kind="move"] .eq-clo,.u-stage:not([data-kind="move"]) .eq-move{display:none}`,
  `.el-ring{fill:var(--u-card);stroke:var(--u-mid);stroke-width:1.2;transition:fill .35s,stroke .35s,stroke-width .35s}`,
  `.el-state[data-on] .el-ring{fill:color-mix(in srgb,var(--unfold-blue) 30%,var(--u-card));stroke:var(--unfold-blue);stroke-width:2.2}`,
  `.el-state[data-died]:not([data-on]) .el-ring{fill:color-mix(in srgb,var(--unfold-red) 14%,var(--u-card));stroke:var(--unfold-red);stroke-dasharray:3 3;stroke-width:1.6}`,
  `.el-halo{fill:none;stroke:var(--unfold-red);stroke-width:1.4;stroke-dasharray:3 3;opacity:0;transition:opacity .35s}`,
  `.el-state[data-died][data-on] .el-halo{opacity:1}`,
  `.el-accept{fill:none;stroke:var(--unfold-green);stroke-width:1.4}`,
  `.el-num{font:600 14px var(--u-mono);fill:var(--u-strong);text-anchor:middle;dominant-baseline:central}`,
  `.el-edge{--c:var(--u-mid)}.el-edge[data-eps]{--c:var(--unfold-purple)}`,
  `.el-line{fill:none;stroke:var(--c);stroke-width:1.2;opacity:.75;transition:stroke-width .3s,opacity .3s,stroke .3s}`,
  `.el-head{fill:var(--c);opacity:.75;transition:opacity .3s,fill .3s}`,
  `.el-edge[data-eps] :is(.el-line,.el-head){opacity:.5}`,
  `.el-edge[data-fire]:not([data-eps]){--c:var(--unfold-yellow)}`,
  `.el-edge[data-fire] .el-line{stroke-width:2.6;opacity:1}.el-edge[data-fire] .el-head{opacity:1}`,
  `.el-elabel{font:600 14px var(--u-mono);fill:var(--u-text);text-anchor:middle;dominant-baseline:central}`,
  `.el-edge[data-eps] .el-elabel{font:italic 600 16px var(--unfold-serif);fill:var(--unfold-purple)}`,
  `.el-edge[data-fire]:not([data-eps]) .el-elabel{fill:var(--unfold-yellow)}`,
  `.el-note{font:11px var(--u-mono);fill:var(--u-muted);dominant-baseline:central}`,
  `.el-tok{fill:var(--c);filter:drop-shadow(0 0 3px var(--c))}`,
  `.el-br{fill:none;stroke:var(--u-lo);stroke-width:1;transition:stroke .4s}`,
  `.el-brt{font:12px var(--u-mono);fill:var(--u-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-br,.el-brt{opacity:.45;transition:opacity .4s}.u-stage[data-scene="1"] :is(.el-br,.el-brt){opacity:1}`,
  `.u-stage[data-scene="1"] .el-brt{fill:var(--u-strong)}`,
  `.el-title,.el-axis{font:10.5px var(--u-mono);fill:var(--u-muted);letter-spacing:.06em}`,
  `.el-ch{cursor:pointer;transition:opacity .35s}.el-ch rect{fill:var(--u-card);stroke:var(--u-mid);stroke-width:1;transition:fill .3s,stroke .3s}`,
  `.el-ch:hover rect{stroke:var(--u-strong)}`,
  `.el-ch text{font:600 16px var(--u-mono);fill:var(--u-strong);text-anchor:middle;dominant-baseline:central}`,
  `.el-ch[data-done]{opacity:.35}.el-ch[data-gone]{display:none}`,
  `.el-ch[data-cur] rect{stroke:var(--unfold-yellow);stroke-width:2;fill:color-mix(in srgb,var(--unfold-yellow) 18%,var(--u-card))}`,
  `.el-sname{font:italic 600 22px var(--unfold-serif);fill:var(--unfold-blue)}`,
  `.el-set{font:500 17px var(--u-mono);fill:var(--unfold-blue)}`,
  `.el-verdict{opacity:0;transition:opacity .4s}.el-verdict[data-on]{opacity:1}`,
  `.el-verdict text{font:500 13px var(--u-mono)}.el-v1{fill:var(--unfold-green)}.el-verdict[data-no] .el-v1{fill:var(--unfold-red)}.el-v2{fill:var(--u-muted)}`,
  `.el-drop text{font:500 13px var(--u-mono)}.el-d1{fill:var(--unfold-red)}.el-d2{fill:var(--unfold-blue)}`,
  `.el-gh{font:600 12px var(--u-mono);fill:var(--unfold-yellow);text-anchor:middle;dominant-baseline:central}`,
  `.el-gh[data-k="closure"]{font:italic 600 14px var(--unfold-serif);fill:var(--unfold-purple)}`,
  `.el-rl,.el-gf{font:10.5px var(--u-mono);fill:var(--u-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-cell{cursor:pointer;fill:var(--u-faint);fill-opacity:.35;transition:opacity .3s}`,
  `.el-cell[data-in]{fill:var(--unfold-blue);fill-opacity:.85}`,
  `.el-cell[data-later]{opacity:0}.el-cell[data-gone],.el-gf[data-gone]{display:none}`,
  `.el-col{fill:none;stroke:var(--u-strong);stroke-width:1;opacity:.7;transition:transform .45s var(--u-ease)}`,
  `.u-controls input[data-input]{width:calc(${m.MAXLEN}ch + 16px)}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "in S (active state)" },
  { hue: "yellow", label: "symbol read" },
  { hue: "purple", label: "ε edge (reads no input)" },
  { hue: "red", label: "dropped: no edge for the symbol" },
  { hue: "green", label: "accept state" },
]);

const PRESETS = [
  [m.INPUT, "match"],
  ["abdc", "no match"],
];
const controls =
  `<label>input <input type="text" data-input value="${m.INPUT}" maxlength="${m.MAXLEN}" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Input string: up to ${m.MAXLEN} letters"></label>` +
  PRESETS.map(([w, what]) => `<button type="button" data-preset="${w}" aria-pressed="${w === m.INPUT}">${w} (${what})</button>`).join("");

const stage = u.stageHtml({ audio: await u.narrate(scenes, { dir: join(HERE, "voice") }),
  dwell: 10000,
  scenes,
  svg,
  label: "NFA explainer. Left and right arrows change the scene. Up and down arrows, or comma and period, step through the input. The text field sets the input string.",
  css,
  key,
  controls,
  time: { steps: LAST + 1 },
  narrow: [NARROW.w, NARROW.h],
});

const live = `
${u.modelScript([m.sortNums, m.fmtSet, m.closure, m.move, m.run, m.chapters], { EDGES: m.EDGES, ACCEPT: m.ACCEPT, MAXLEN: m.MAXLEN, REGEX: m.REGEX })}
const LINE = ${JSON.stringify(LINE)};
const CW = ${CW};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const field = root.querySelector("[data-input]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const all = (sel) => root.querySelectorAll(sel);
let word = "";
let STEPS = [];
let LAST = 0;
let MATCH = false;
let RANGES = [];
let OWNER = [];
let step = -1;
let crossing = false;

// A new input: run the model, then redraw the tape and the trace grid for the new run.
function setRun(w) {
  word = w;
  const r = run(w);
  STEPS = r.steps;
  MATCH = r.match;
  LAST = STEPS.length - 1;
  RANGES = chapters(LAST);
  OWNER = STEPS.map((_, t) => 2 + RANGES.slice(2).findIndex(([a, b]) => t >= a && t <= b));
  all(".el-ch").forEach((el) => {
    const p = Number(el.dataset.p);
    el.toggleAttribute("data-gone", p >= w.length);
    el.querySelector("text").textContent = w[p] ?? "";
  });
  all(".el-cell").forEach((el) => {
    const t = Number(el.dataset.c);
    el.toggleAttribute("data-gone", t > LAST);
    el.toggleAttribute("data-in", t <= LAST && STEPS[t].set.includes(Number(el.dataset.s)));
  });
  all(".el-gh").forEach((el) => {
    const s = STEPS[Number(el.dataset.c)];
    el.textContent = !s ? "" : s.kind === "move" ? s.sym : s.kind === "closure" ? "ε" : "";
    el.dataset.k = s ? s.kind : "";
  });
  all(".el-gf").forEach((el) => el.toggleAttribute("data-gone", Number(el.dataset.c) > LAST));
  // The independent check: the browser's own regex engine on the same input.
  const engine = new RegExp("^" + REGEX + "$").test(w);
  const last = STEPS[LAST].set;
  all(".el-v1").forEach((el) => (el.textContent = MATCH ? "7 ∈ S at the end: match" : last.length ? "7 ∉ S at the end: no match" : "S is empty: no match"));
  all(".el-v2").forEach((el) => (el.textContent = "JavaScript RegExp: " + (engine ? "match" : "no match") + (engine === MATCH ? ", agrees" : ", DISAGREES")));
  all(".el-verdict").forEach((el) => el.toggleAttribute("data-no", !MATCH));
  all("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === w)));
}

function show(t) {
  t = Math.max(0, Math.min(LAST, t));
  const changed = t !== step;
  step = t;
  const s = STEPS[t];
  root.dataset.kind = s.kind;
  all(".el-state").forEach((el) => {
    const k = Number(el.dataset.s);
    el.toggleAttribute("data-on", s.set.includes(k));
    el.toggleAttribute("data-died", s.died.includes(k));
  });
  all(".el-edge").forEach((el) => {
    const fire = s.edges.includes(el.dataset.e);
    el.toggleAttribute("data-fire", fire);
    if (fire && changed && !still.matches) el.querySelectorAll("animateMotion,animate").forEach((a) => a.beginElement());
  });
  all(".el-ch").forEach((el) => {
    const p = Number(el.dataset.p);
    el.toggleAttribute("data-done", p < s.pos);
    el.toggleAttribute("data-cur", p === s.pos);
  });
  all(".el-set").forEach((el) => (el.textContent = "= {" + s.set.join(", ") + "}"));
  all(".el-d1").forEach((el) => (el.textContent = s.died.length ? "dropped " + s.died.join(", ") + ": no " + s.sym + " edge" : ""));
  const via = s.back.map((q) => s.before.find((p) => EDGES.some((e) => e.from === p && e.to === q && e.sym === s.sym)) + "→" + q);
  all(".el-d2").forEach((el) => (el.textContent = s.back.length ? s.back.join(", ") + " is in S again: edge " + via.join(", ") + " reads " + s.sym : ""));
  all(".el-verdict").forEach((el) => el.toggleAttribute("data-on", t === LAST));
  all(".el-cell").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.c) > t));
  all(".el-col").forEach((el) => (el.style.transform = "translateX(" + t * CW + "px)"));
  all(".u-code").forEach((code) => {
    mark(code, LINE[s.kind], ".u-line");
    if (t === LAST) code.querySelector('.u-line[data-i="4"]').toggleAttribute("data-on", true);
  });
  setLive({ from: s.before.join(", "), to: s.set.join(", "), x: s.sym ?? "" });
  UNFOLD.timeAt(t, LAST + 1);
  const text = "step " + t + " · " + s.text;
  if (readout.textContent !== text) readout.textContent = text;
}

function stepTo(t) {
  show(t);
  const sc = UNFOLD.scene();
  const [a, b] = RANGES[sc];
  if (sc > 0 && (step < a || step > b)) {
    crossing = true;
    UNFOLD.go(OWNER[step]);
    crossing = false;
  }
  UNFOLD.pause();
}

// The reader's input: letters a to z, up to MAXLEN.
const clean = (v) => v.toLowerCase().replace(/[^a-z]/g, "").slice(0, MAXLEN);
setRun(clean(field.value));

root.addEventListener("unfold:scene", (e) => {
  if (!crossing) show(RANGES[e.detail.scene][0]);
});
// Each chapter plays its steps once. The count follows the input, so a longer input plays longer.
[0, 1, 2, 3, 4, 5].forEach((sc) =>
  UNFOLD.beat(sc, sc === 0 ? 800 : 1300, (n) => show(n < 0 ? RANGES[sc][1] : Math.min(RANGES[sc][0] + n, RANGES[sc][1])), 700, () => RANGES[sc][1] - RANGES[sc][0] + 1),
);
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  stepTo(to);
});
// Direct manipulation: a letter on the tape jumps to the step that reads it, a trace column to its step.
root.addEventListener("click", (e) => {
  const ch = e.target.closest(".el-ch");
  if (ch) return stepTo(1 + 2 * Number(ch.dataset.p));
  const cell = e.target.closest(".el-cell");
  if (cell) stepTo(Number(cell.dataset.c));
});

// The reader's input. The overview shows the verdict, a chapter shows its first step.
function useInput(w) {
  UNFOLD.pause();
  setRun(w);
  const sc = UNFOLD.scene();
  step = -1;
  show(sc === 0 ? LAST : RANGES[sc][0]);
}
field.addEventListener("input", () => {
  const w = clean(field.value);
  if (w !== word) useInput(w);
  else UNFOLD.pause();
});
field.addEventListener("change", () => (field.value = word));
all("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => {
    field.value = b.dataset.preset;
    useInput(b.dataset.preset);
  }),
);

show(still.matches ? LAST : 0);
`;

// ---- Reference notes under the card ----
const c = (t) => `<code>${t}</code>`;
const dfa = m.dfaSets();
const checked = (5 ** (m.CHECK_LEN + 1) - 1) / 4 + m.CHECK_RANDOM;
const notes = u.notesHtml([
  {
    title: "Other inputs",
    html: `<p>Each row shows S at the start and after each symbol, with the ε-closure done. The same NFA and the same rule decide every row.</p>`,
    table: {
      head: ["Input", "S after each symbol", "Result"],
      rows: m.OTHERS.map((o) => [
        c(o.input),
        c(o.sets.map(m.fmtSet).join(" → ")),
        o.match ? "match" : o.sets.at(-1).length ? "no match: 7 is not in S at the end" : "no match: S is empty, so no state can continue",
      ]),
    },
  },
  {
    title: "Sets, backtracking and DFAs",
    html: `<p>Real engines use one of three ways to handle the choices in an NFA. For this regex, subset construction gives ${dfa.filter((s) => s.length).length} DFA states plus an empty dead state: ${c(dfa.filter((s) => s.length).map(m.fmtSet).join(" "))}.</p>`,
    table: {
      head: ["Approach", "How it handles a choice", "Time for n symbols, m states", "Used by"],
      rows: [
        ["Set simulation (this figure)", "keeps every choice in S at once", "O(n·m)", "RE2, Go regexp, Rust regex (one of its engines)"],
        ["Backtracking", "tries one path, and goes back to the last choice if it fails", "exponential for some patterns, for example (a*)*b", "PCRE, Perl, Python re, JavaScript, Java"],
        ["DFA (subset construction)", "turns each reachable set into one state before it reads input", "O(n), but up to 2<sup>m</sup> states", "lex and flex; grep and RE2 build DFA states as needed"],
      ],
    },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["Left out", "What really happens"],
      rows: [
        ["Search", `The figure checks the whole input. To find a match inside a longer text, the engine adds state 0 to S before each symbol.`],
        ["Capture groups", `A Pike VM keeps the start and end of each group next to each state in S. The figure keeps only the states.`],
        ["Backreferences", `${c("(a)\\1")} needs to remember text, which no finite set of states can do. Only backtracking engines support it.`],
        ["Order of ε edges", "The order does not change match or no match. It only decides which submatch an engine reports."],
        ["Other patterns", `The graph is drawn by hand for ${c(m.REGEX)}. The input is yours to change, the pattern is fixed.`],
      ],
    },
  },
  {
    title: "Words used here",
    table: {
      head: ["Term", "Meaning"],
      rows: [
        ["NFA", "nondeterministic finite automaton: states and edges, can be in many states"],
        ["State", "a numbered circle. S holds the states the NFA is in now."],
        ["Edge", "an arrow between states, labelled with the symbol it reads"],
        ["ε edge", "an edge that the NFA follows without reading a symbol"],
        ["ε-closure", "S plus every state reachable from S by ε edges only"],
        [`δ(S, x)`, "the states reached from S by one edge that reads x"],
        ["Accept state", "a state (double ring) that means match if the input ends there"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Regex matching with an NFA",
    hint: "← → scene · ↑ ↓ step",
    readout: "step " + LAST + " · " + m.STEPS[LAST].text,
    caption: `The NFA follows Thompson's construction in the compact form with split states. The preset input ${m.INPUT} was chosen by hand, and the field under the drawing takes any input up to ${m.MAXLEN} letters. Every set comes from a small simulator. It agrees with the JavaScript RegExp engine on ${checked.toLocaleString("en-US")} test strings, and the figure checks your input with RegExp too.`,
    body: stage,
  }) + notes;

// --artifact <file>: one page for a claude.ai Artifact, which follows the viewer's theme.
const artifact = process.argv.indexOf("--artifact");
const title = "Regex matching with an NFA";
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "regex-nfa-light.html" : "regex-nfa.html");
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
