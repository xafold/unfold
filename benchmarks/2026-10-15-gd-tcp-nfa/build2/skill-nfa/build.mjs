import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import * as m from "./model.mjs";

const u = await import(join(homedir(), ".claude", "skills", "unfold", "kit", "concept-kit.mjs"));
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const LAST = m.STEPS.length - 1;
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
  tape: [0, 390],
  set: [0, 480],
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
  tape: [40, 620],
  set: [40, 700],
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

function stateSvg(L, s) {
  const [x, y] = L.pos[s];
  const accept = s === m.ACCEPT ? `<circle class="el-accept" r="${R + 4.5}"/>` : "";
  return `<g class="el-state" data-s="${s}" transform="translate(${x} ${y})">${accept}<circle class="el-ring" r="${R}"/><text class="el-num">${s}</text></g>`;
}

function tapeSvg(L) {
  const [x, y] = L.tape;
  const chips = [...m.INPUT]
    .map((ch, i) => `<g class="el-ch" data-p="${i}" transform="translate(${x + i * 44} ${y})"><rect width="36" height="36" rx="5"/><text x="18" y="18">${ch}</text></g>`)
    .join("");
  return `<text class="el-title" x="${x}" y="${y - 12}">input</text>${chips}`;
}

function setSvg(L) {
  const [x, y] = L.set;
  return (
    `<text class="el-title" x="${x}" y="${y - 26}">states the NFA is in</text>` +
    `<text class="el-sname" x="${x}" y="${y}">S</text><text class="el-set" x="${x + 18}" y="${y}">= {0}</text>` +
    `<g class="el-verdict"><text x="${x}" y="${y + 28}">7 ∈ S at the end: match</text></g><g class="el-drop"><text x="${x}" y="${y + 28}"></text></g>`
  );
}

// Trace: one row per state, one column per step. A filled cell means the state is in S at that step.
const CW = 30;
const RH = 14;
function gridSvg(L) {
  const [x0, y] = L.grid;
  const top = y + 16;
  const head = m.STEPS.map((s, t) => {
    const text = s.kind === "move" ? s.sym : s.kind === "closure" ? "ε" : "";
    return `<text class="el-gh" data-k="${s.kind}" x="${x0 + t * CW + CW / 2}" y="${y + 4}">${text}</text>`;
  }).join("");
  const rows = Array.from({ length: m.N }, (_, s) => `<text class="el-rl" x="${x0 - 10}" y="${top + s * RH + RH / 2 - 1}">${s}</text>`).join("");
  const cells = m.STEPS.flatMap((step, t) =>
    Array.from({ length: m.N }, (_, s) => `<rect class="el-cell" data-c="${t}"${step.set.includes(s) ? " data-in" : ""} x="${x0 + t * CW + 2}" y="${top + s * RH + 1}" width="${CW - 4}" height="${RH - 3}" rx="2"/>`),
  ).join("");
  const foot = m.STEPS.map((_, t) => `<text class="el-gf" x="${x0 + t * CW + CW / 2}" y="${top + m.N * RH + 10}">${t}</text>`).join("");
  const col = `<rect class="el-col" x="${x0}" y="${y - 6}" width="${CW}" height="${m.N * RH + 38}" rx="4" style="transform:translateX(${LAST * CW}px)"/>`;
  return `<text class="el-title" x="${x0 - 18}" y="${y - 14}">trace: S at each step</text><text class="el-axis" x="${x0 - 2}" y="${top + m.N * RH + 10}" text-anchor="end" dominant-baseline="central">step</text>${col}${head}${rows}${cells}${foot}`;
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
  `<g class="${cls}">${bracketSvg(L)}${m.EDGES.map((e) => edgeSvg(L, e)).join("")}${Array.from({ length: m.N }, (_, s) => stateSvg(L, s)).join("")}${tapeSvg(L)}${setSvg(L)}${gridSvg(L)}</g>`;

const svg = iso.figureSvg({
  width: WIDE.w,
  height: WIDE.h,
  label: "An NFA for the regex a(b|c)*d with 8 states, reading the input abcbd. Active states are lit, the symbol read is marked on the input, and a trace grid shows the set of states at each step.",
  body: [draw(WIDE, "el-wide"), draw(NARROW, "el-narrow")],
});

// ---- Math ----
const mo = (t) => `<mo>${t}</mo>`;
const mn = (n, hue) => `<mn${hue ? ` data-hue="${hue}"` : ""}>${n}</mn>`;
const setM = (arr, hue = "blue") => mo("{") + arr.map((s, i) => (i ? mo(",") : "") + mn(s, hue)).join("") + mo("}");
const sym = (x) => `<mi data-hue="yellow" mathvariant="normal">${x}</mi>`;
const delta = `<mi data-hue="yellow">δ</mi>`;
const clos = `<mi data-hue="purple">ε</mi><mtext data-hue="purple">-closure</mtext>`;
const S = (sub) => (sub === undefined ? u.mi("S", "blue") : `<msub>${u.mi("S", "blue")}<mi>${sub}</mi></msub>`);
const at = (i) => m.STEPS[i].set;

const hue = (h, t) => `<span data-hue="${h}">${t}</span>`;
const scenes = [
  {
    name: "Overview",
    math: `${S("t+1")}${mo("=")}${clos}${mo("(")}${delta}${mo("(")}${S("t")}${mo(",")}<msub><mi data-hue="yellow">x</mi><mi>t</mi></msub>${mo(")")}${mo(")")}`,
    say: `An NFA can be in several states at once, so it keeps a <b data-hue="blue">set S</b>. It reads <b>abcbd</b> and matches if <b data-hue="green">accept state 7</b> is in S at the end.`,
  },
  {
    name: "Build",
    rule: `a ( b | c )* d  →  8 states · ${hue("yellow", "4 symbol edges")} · ${hue("purple", "5 ε edges")}`,
    say: `Each piece of the regex becomes a piece of the graph. The star adds two <b data-hue="purple">ε edges</b>, which move without reading input.`,
  },
  {
    name: "Read a",
    math: `${delta}${mo("(")}${setM(at(0))}${mo(",")}${sym("a")}${mo(")")}${mo("=")}${setM(at(1))}`,
    say: `A state can only follow an edge that carries the <b data-hue="yellow">symbol read</b>. The machine checks every state in S, not one path.`,
  },
  {
    name: "ε-closure",
    math: `${clos}${mo("(")}${setM(at(1))}${mo(")")}${mo("=")}${setM(at(2))}`,
    say: `Next the machine follows every <b data-hue="purple">ε edge</b> it can reach, because they read no input. This step, the ε-closure, puts it in five states at once.`,
  },
  {
    name: "Loop",
    math: `${delta}${mo("(")}${S()}${mo(",")}<mi data-hue="yellow">x</mi>${mo(")")}${mo("=")}${setM(at(3))}<mspace width="1em"/><mtext>for</mtext><mspace width="0.4em"/><mi data-hue="yellow">x</mi>${mo("=")}${sym("b")}${mo(",")}${sym("c")}${mo(",")}${sym("b")}`,
    say: `States without an edge for the symbol <b data-hue="red">drop out</b>. The ε edge from 5 back to 1 then puts the loop states back into S.`,
  },
  {
    name: "Accept",
    math: `${clos}${mo("(")}${delta}${mo("(")}${S()}${mo(",")}${sym("d")}${mo(")")}${mo(")")}${mo("=")}${setM(at(LAST))}${mo("∋")}${mn(m.ACCEPT, "green")}`,
    say: `Only state 6 can read d, so S becomes {7}. The input ends with <b data-hue="green">accept state 7</b> in S, so the regex matches.`,
  },
];

const css = [
  `.el-narrow{display:none}.u-stage[data-narrow] .el-narrow{display:inline}.u-stage[data-narrow] .el-wide{display:none}`,
  `.el-ring{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1.2;transition:fill .35s,stroke .35s,stroke-width .35s}`,
  `.el-state[data-on] .el-ring{fill:color-mix(in srgb,var(--unfold-blue) 30%,var(--anatomy-card));stroke:var(--unfold-blue);stroke-width:2.2}`,
  `.el-state[data-died] .el-ring{fill:color-mix(in srgb,var(--unfold-red) 14%,var(--anatomy-card));stroke:var(--unfold-red);stroke-dasharray:3 3;stroke-width:1.6}`,
  `.el-accept{fill:none;stroke:var(--unfold-green);stroke-width:1.4}`,
  `.el-num{font:600 14px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}`,
    `.el-edge{--c:var(--anatomy-mid)}.el-edge[data-eps]{--c:var(--unfold-purple)}`,
  `.el-line{fill:none;stroke:var(--c);stroke-width:1.2;opacity:.75;transition:stroke-width .3s,opacity .3s,stroke .3s}`,
  `.el-head{fill:var(--c);opacity:.75;transition:opacity .3s,fill .3s}`,
  `.el-edge[data-eps] :is(.el-line,.el-head){opacity:.5}`,
  `.el-edge[data-fire]:not([data-eps]){--c:var(--unfold-yellow)}`,
  `.el-edge[data-fire] .el-line{stroke-width:2.6;opacity:1}.el-edge[data-fire] .el-head{opacity:1}`,
  `.el-elabel{font:600 14px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:middle;dominant-baseline:central}`,
  `.el-edge[data-eps] .el-elabel{font:italic 600 16px var(--unfold-serif);fill:var(--unfold-purple)}`,
  `.el-edge[data-fire]:not([data-eps]) .el-elabel{fill:var(--unfold-yellow)}`,
  `.el-note{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.el-tok{fill:var(--c);filter:drop-shadow(0 0 3px var(--c))}`,
  `.el-br{fill:none;stroke:var(--anatomy-lo);stroke-width:1;transition:stroke .4s}`,
  `.el-brt{font:12px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-br,.el-brt{opacity:.45;transition:opacity .4s}.u-stage[data-scene="1"] :is(.el-br,.el-brt){opacity:1}`,
  `.u-stage[data-scene="1"] .el-brt{fill:var(--anatomy-strong)}`,
  `.el-title,.el-axis{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.06em}`,
  `.el-ch{transition:opacity .35s}.el-ch rect{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1;transition:fill .3s,stroke .3s}`,
  `.el-ch text{font:600 16px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}`,
  `.el-ch[data-done]{opacity:.35}`,
  `.el-ch[data-cur] rect{stroke:var(--unfold-yellow);stroke-width:2;fill:color-mix(in srgb,var(--unfold-yellow) 18%,var(--anatomy-card))}`,
  `.el-sname{font:italic 600 22px var(--unfold-serif);fill:var(--unfold-blue)}`,
  `.el-set{font:500 17px var(--anatomy-mono);fill:var(--unfold-blue)}`,
  `.el-verdict{opacity:0;transition:opacity .4s}.el-verdict[data-on]{opacity:1}`,
  `.el-verdict text{font:500 13px var(--anatomy-mono);fill:var(--unfold-green)}`,
  `.el-drop text{font:500 13px var(--anatomy-mono);fill:var(--unfold-red)}`,
  `.el-gh{font:600 12px var(--anatomy-mono);fill:var(--unfold-yellow);text-anchor:middle;dominant-baseline:central}`,
  `.el-gh[data-k="closure"]{font:italic 600 14px var(--unfold-serif);fill:var(--unfold-purple)}`,
  `.el-rl,.el-gf{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-cell{fill:var(--anatomy-faint);fill-opacity:.35;transition:opacity .3s}`,
  `.el-cell[data-in]{fill:var(--unfold-blue);fill-opacity:.85}`,
  `.el-cell[data-later]{opacity:0}`,
  `.el-col{fill:none;stroke:var(--anatomy-strong);stroke-width:1;opacity:.7;transition:transform .45s var(--anatomy-ease)}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "in S (active state)" },
  { hue: "yellow", label: "symbol read" },
  { hue: "purple", label: "ε edge (reads no input)" },
  { hue: "red", label: "dropped: no edge for the symbol" },
  { hue: "green", label: "accept state" },
]);

const stage = u.stageHtml({
  dwell: 10000,
  scenes,
  svg,
  label: "NFA explainer. Left and right arrows change the scene. Up and down arrows, or comma and period, step through the input.",
  css,
  key,
  time: { steps: LAST + 1 },
  narrow: [NARROW.w, NARROW.h],
});

// Scene -> the steps it owns. The overview sweeps the whole run.
const RANGES = [[0, LAST], [0, 0], [0, 1], [2, 2], [3, 8], [9, 10]];
const OWNER = m.STEPS.map((_, t) => RANGES.findIndex((r, i) => i >= 2 && t >= r[0] && t <= r[1]));
const STEPDATA = m.STEPS.map((s) => ({ kind: s.kind, sym: s.sym, pos: s.pos, set: s.set, edges: s.edges, died: s.died, text: s.text }));

const live = `
const STEPS = ${JSON.stringify(STEPDATA)};
const RANGES = ${JSON.stringify(RANGES)};
const OWNER = ${JSON.stringify(OWNER)};
const LAST = ${LAST};
const MATCH = ${m.TRACE.match};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const all = (sel) => root.querySelectorAll(sel);
let step = -1;
let crossing = false;
function show(t) {
  t = Math.max(0, Math.min(LAST, t));
  const changed = t !== step;
  step = t;
  const s = STEPS[t];
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
  all(".el-drop text").forEach((el) => (el.textContent = s.died.length ? "dropped " + s.died.join(", ") + ": no " + s.sym + " edge" : ""));
  all(".el-verdict").forEach((el) => el.toggleAttribute("data-on", t === LAST && MATCH));
  all(".el-cell").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.c) > t));
  all(".el-col").forEach((el) => (el.style.transform = "translateX(" + t * ${CW} + "px)"));
  UNFOLD.timeAt(t);
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
root.addEventListener("unfold:scene", (e) => {
  if (!crossing) show(RANGES[e.detail.scene][0]);
});
RANGES.forEach(([a, b], sc) => UNFOLD.beat(sc, sc === 0 ? 800 : 1300, (n) => show(n < 0 ? b : Math.min(a + n, b)), 700));
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  stepTo(to);
});
show(still.matches ? LAST : 0);
`;

// ---- Reference notes under the card ----
const c = (t) => `<code>${t}</code>`;
const fmtSet = (s) => `{${s.join(",")}}`;
const dfa = m.dfaSets();
const notes = u.notesHtml([
  {
    title: "Other inputs",
    html: `<p>Each row shows S at the start and after each symbol, with the ε-closure done. The same NFA and the same rule decide every row.</p>`,
    table: {
      head: ["Input", "S after each symbol", "Result"],
      rows: m.OTHERS.map((o) => [
        c(o.input),
        c(o.sets.map(fmtSet).join(" → ")),
        o.match ? "match" : o.sets.at(-1).length ? "no match: 7 is not in S at the end" : "no match: S is empty, so no state can continue",
      ]),
    },
  },
  {
    title: "Sets, backtracking and DFAs",
    html: `<p>Real engines use one of three ways to handle the choices in an NFA. For this regex, subset construction gives ${dfa.filter((s) => s.length).length} DFA states plus an empty dead state: ${c(dfa.filter((s) => s.length).map(fmtSet).join(" "))}.</p>`,
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
    caption:
      "The NFA follows Thompson's construction in the compact form with split states. The input abcbd was chosen by hand. Every set comes from a small simulator. It agrees with the JavaScript RegExp engine on all 5,461 strings over a, b, c, d up to length 6.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const title = "NFA regex matching";
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "nfa-regex-light.html" : "nfa-regex.html");
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
