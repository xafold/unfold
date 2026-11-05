import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const UNFOLD_DIR = process.env.UNFOLD_DIR ?? join(homedir(), ".claude", "skills", "unfold");
const u = await import(pathToFileURL(join(UNFOLD_DIR, "kit", "concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const { NFA, STEPS, INPUT, REGEX } = m;
const LAST = STEPS.length - 1;
const R = 17; // state radius
const BEND = 200; // the loop's back edge and the skip edge bow this far

// Two layouts of one graph: wide (left to right) and narrow (top to bottom, for phones).
// A state's column is its distance from the start; the two branches of b|c sit on rows -1 and +1.
const ROW = Object.fromEntries(NFA.edges.filter((e) => e.sym && e.sym !== "a" && e.sym !== "d").flatMap((e, k) => [[e.from, k ? 1 : -1], [e.to, k ? 1 : -1]]));
const LAYOUT = {
  wide: { W: 820, H: 438, at: (s) => [60 + NFA.col[s] * 78, 180 + (ROW[s] ?? 0) * 54], sign: 1, tape: [328, 4], matrix: [266, 330] },
  narrow: { W: 400, H: 826, at: (s) => [200 + (ROW[s] ?? 0) * 64, 104 + NFA.col[s] * 60], sign: -1, tape: [118, 4], matrix: [62, 722] },
};
const BENT = (e) => (e.back || NFA.col[e.to] - NFA.col[e.from] > 2 ? BEND : 0);

const r1 = (v) => Math.round(v * 10) / 10;
const unit = ([x, y]) => {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
};

// One edge: the control point as the kit's arrow computes it, ends moved to the circle outlines.
function edgeGeom(L, e) {
  const [x1, y1] = L.at(e.from);
  const [x2, y2] = L.at(e.to);
  const bend = BENT(e) * L.sign;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = [-(y2 - y1) / len, (x2 - x1) / len];
  const c = [(x1 + x2) / 2 + n[0] * bend, (y1 + y2) / 2 + n[1] * bend];
  const a = unit([c[0] - x1, c[1] - y1]);
  const b = unit([c[0] - x2, c[1] - y2]);
  const p = [x1 + a[0] * R, y1 + a[1] * R];
  const q = [x2 + b[0] * (R + 1), y2 + b[1] * (R + 1)];
  const mid = [0.25 * x1 + 0.5 * c[0] + 0.25 * x2, 0.25 * y1 + 0.5 * c[1] + 0.25 * y2];
  return { p, q, bend: bend * (Math.hypot(q[0] - p[0], q[1] - p[1]) / len), n, mid, len };
}

function graph(name) {
  const L = LAYOUT[name];
  const out = [];
  // The pieces of the regex, outlined (scene 1 only). Each box holds its states and the curves between them.
  const OUTLINE = ["a", "b|c", "(b|c)*", "d"];
  for (const text of OUTLINE) {
    const f = NFA.frags.find((f) => f.text === text);
    if (!f) throw new Error("no fragment " + text);
    const pts = f.states.flatMap((s) => {
      const [x, y] = L.at(s);
      return [[x - R, y - R], [x + R, y + R]];
    });
    for (const e of NFA.edges) if (f.states.includes(e.from) && f.states.includes(e.to)) pts.push(edgeGeom(L, e).mid);
    const pad = 10;
    const x0 = Math.min(...pts.map((p) => p[0])) - pad;
    const y0 = Math.min(...pts.map((p) => p[1])) - pad;
    const x1 = Math.max(...pts.map((p) => p[0])) + pad;
    const y1 = Math.max(...pts.map((p) => p[1])) + pad;
    out.push(`<g class="fr"><rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(x1 - x0)}" height="${r1(y1 - y0)}" rx="8"/><text x="${r1(x0)}" y="${r1(y0 - 6)}">${text}</text></g>`);
  }
  const frags = `<g class="frags">${out.join("")}</g>`;

  const edges = NFA.edges
    .map((e) => {
      const g = edgeGeom(L, e);
      const eps = e.sym === null;
      const look = u.arrow(g.p, g.q, { bend: g.bend, head: 6 });
      const dash = eps ? ` style="--dash:${(4 / g.len).toFixed(4)} ${(3.5 / g.len).toFixed(4)}"` : "";
      let label = "";
      if (!eps) {
        const side = g.n[1] < -0.5 || g.n[0] < -0.5 ? -1 : 1;
        const [lx, ly] = [g.mid[0] - side * g.n[0] * 12 * L.sign, g.mid[1] - side * g.n[1] * 12 * L.sign];
        label = `<text class="ed-sym" x="${r1(lx)}" y="${r1(ly)}">${e.sym}</text>`;
      }
      return `<g class="ed${eps ? " ed-eps" : ""}" data-e="${e.k}"${dash}><g class="ed-base">${look}</g><g class="ed-lit">${look}</g>${label}</g>`;
    })
    .join("");

  const states = Array.from({ length: NFA.n }, (_, s) => {
    const [x, y] = L.at(s);
    const ring = s === NFA.accept ? `<circle class="st-ring" cx="${x}" cy="${y}" r="${R + 4}"/>` : "";
    return `<g class="st${s === NFA.accept ? " st-acc" : ""}" data-s="${s}">${ring}<circle class="st-body" cx="${x}" cy="${y}" r="${R}"/><text x="${x}" y="${y}">${s}</text></g>`;
  }).join("");

  const [sx, sy] = L.at(NFA.start);
  const start = name === "wide" ? u.arrow([sx - R - 30, sy], [sx - R - 1, sy], { head: 6 }) : u.arrow([sx, sy - R - 30], [sx, sy - R - 1], { head: 6 });
  const startLabel = name === "wide" ? `<text class="el-small" x="${sx - R - 30}" y="${sy - 10}">start</text>` : `<text class="el-small" x="${sx + 8}" y="${sy - R - 22}">start</text>`;
  return `<g class="g-${name}">${frags}<g class="g-start">${start}${startLabel}</g>${edges}${states}</g>`;
}

// The input tape: one chip per symbol, and a cursor under the next symbol to read.
const CHIP = 28;
const GAP = 6;
const tape =
  `<g class="el-tape"><text class="el-label" x="-10" y="12" text-anchor="end">input</text>` +
  [...INPUT].map((c, k) => `<g class="tp" data-p="${k}">${u.chip(c, k * (CHIP + GAP), 0, { w: CHIP, h: 24, rx: 4 })}</g>`).join("") +
  `<path class="tp-cursor" d="M${CHIP / 2} 29l-5 7h10z"/></g>`;

// The trace: one row per set S0..S5, one column per state. A filled cell = that state is in the set.
const CW = 24;
const CH = 15;
const SET_ROWS = STEPS.filter((s) => s.kind !== "move");
const matrix =
  `<g class="el-matrix"><text class="el-label" x="0" y="-22">active set after each symbol</text>` +
  Array.from({ length: NFA.n }, (_, c) => `<text class="mx-head" x="${c * CW + CW / 2}" y="-7">${c}</text>`).join("") +
  SET_ROWS.map(
    (s, r) =>
      `<g class="mx-row" data-r="${r}" data-t="${STEPS.indexOf(s)}">` +
      `<rect class="mx-hit" x="-64" y="${r * CH}" width="${NFA.n * CW + 64}" height="${CH}"/>` +
      (s.sym ? `<text class="mx-sym" x="-46" y="${r * CH + CH / 2}">${s.sym}</text>` : "") +
      `<text class="mx-name" x="-10" y="${r * CH + CH / 2}">S${r}</text>` +
      Array.from({ length: NFA.n }, (_, c) => `<rect class="mx-cell${c === NFA.accept ? " mx-acc" : ""}" data-c="${c}"${s.set.includes(c) ? " data-in" : ""} x="${c * CW + 1}" y="${r * CH + 1}" width="${CW - 2}" height="${CH - 2}" rx="2"/>`).join("") +
      `</g>`,
  ).join("") +
  `<rect class="mx-mark" x="-2" y="-1" width="${NFA.n * CW + 4}" height="${CH + 2}" rx="3"/></g>`;

const W = LAYOUT.wide.W;
const svg = iso.figureSvg({
  width: W,
  height: LAYOUT.wide.H,
  label: `The NFA for ${REGEX} built by Thompson's construction: 12 numbered states, symbol edges and dashed ε edges. Above it, the input tape abcbd; below it, the set of active states after each symbol.`,
  body: [graph("wide"), graph("narrow"), tape, matrix],
});

// ---- Scenes ----
const hue = (h, text) => `<span data-hue="${h}">${text}</span>`;
const S = (k) => `<msub><mi data-hue="blue">S</mi>${typeof k === "number" ? `<mn>${k}</mn>` : k}</msub>`;
const set = (list) => `<mrow data-hue="blue"><mo>{</mo>${list.map((v) => `<mn>${v}</mn>`).join("<mo>,</mo>")}<mo>}</mo></mrow>`;
const eclose = `<mi data-hue="purple">ε-closure</mi>`;
const sym = (c) => `<mi data-hue="yellow">${c}</mi>`;
const eps = NFA.edges.filter((e) => e.sym === null).length;
const s1 = STEPS[2];
const scenes = [
  {
    name: "Compile",
    rule: `${REGEX} → ${NFA.n} states · ${NFA.edges.length - eps} symbol edges · ${eps} ${hue("purple", "ε edges")}`,
    say: `Thompson's construction turns each piece of the regex into a small graph with one way in and one way out, then joins the pieces. A dashed <b data-hue="purple">ε edge</b> can be followed without reading any input.`,
  },
  {
    name: "Move",
    math: `<mi>move</mi><mo>(</mo>${S(0)}<mo>,</mo>${sym("a")}<mo>)</mo><mo>=</mo>${set(STEPS[1].set)}`,
    say: `The matcher keeps a <b data-hue="blue">set of states</b>, not one state. It starts in {0}. Reading <b data-hue="yellow">a</b> follows only the edges labelled a, so {0} becomes {1}.`,
  },
  {
    name: "ε-closure",
    math: `${S(1)}<mo>=</mo>${eclose}<mo>(</mo>${set(s1.seed)}<mo>)</mo><mo>=</mo>${set(s1.set)}`,
    say: `Then it follows every <b data-hue="purple">ε edge</b>, wave by wave, until no new state is reached. From state 1 that gives ${s1.set.length} states. The NFA is in all of them at once.`,
  },
  {
    name: "Repeat",
    math: `${S(`<mrow><mi>i</mi><mo>+</mo><mn>1</mn></mrow>`)}<mo>=</mo>${eclose}<mo>(</mo><mi>move</mi><mo>(</mo>${S("<mi>i</mi>")}<mo>,</mo><msub>${sym("x")}<mrow><mi>i</mi><mo>+</mo><mn>1</mn></mrow></msub><mo>)</mo><mo>)</mo>`,
    say: `Each symbol repeats the same two steps. A state whose edge needs another symbol <b data-hue="red">dies</b>. The set never holds more than ${NFA.n} states, so the work per symbol has a fixed limit.`,
  },
  {
    name: "Accept",
    math: `<mn data-hue="green">${NFA.accept}</mn><mo>∈</mo>${S(SET_ROWS.length - 1)}<mspace width="0.6em"/><mo>⇒</mo><mspace width="0.6em"/><mtext>match</mtext>`,
    say: `Reading <b data-hue="yellow">d</b> leaves only state ${NFA.accept}. The input is used up and the <b data-hue="green">accept state</b> is in the set, so "${INPUT}" matches.`,
  },
];
const RANGES = [[0, 0], [0, 1], [2, 2], [3, LAST - 2], [LAST - 1, LAST]];

const css = `
.u-stage .iso-svg{overflow:visible}
.g-narrow{display:none}
.u-stage[data-narrow] .g-narrow{display:inline}
.u-stage[data-narrow] .g-wide{display:none}
.el-tape{transform:translate(${LAYOUT.wide.tape[0]}px,${LAYOUT.wide.tape[1]}px)}
.u-stage[data-narrow] .el-tape{transform:translate(${LAYOUT.narrow.tape[0]}px,${LAYOUT.narrow.tape[1]}px)}
.el-matrix{transform:translate(${LAYOUT.wide.matrix[0]}px,${LAYOUT.wide.matrix[1]}px)}
.u-stage[data-narrow] .el-matrix{transform:translate(${LAYOUT.narrow.matrix[0]}px,${LAYOUT.narrow.matrix[1]}px)}
.el-label{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.06em;text-transform:uppercase;dominant-baseline:central}
.el-small{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted)}
.frags{opacity:0;transition:opacity .6s var(--anatomy-ease)}
.u-stage[data-scene="0"] .frags{opacity:1}
.fr rect{fill:var(--anatomy-faint);fill-opacity:.08;stroke:var(--anatomy-mid);stroke-width:.8;stroke-dasharray:3 3}
.fr text{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text)}
.ed .u-arrow{color:var(--anatomy-mid)}
.ed-eps .ed-base .u-arrow{color:var(--unfold-purple);opacity:.6}
.ed-eps .ed-base .u-arrow-line{stroke-dasharray:var(--dash)}
.ed-lit{opacity:0;transition:opacity .25s}
.ed-lit .u-arrow{--w:2.4}
.ed[data-lit] .ed-lit{opacity:1;transition-delay:calc(var(--d,0) * 260ms)}
.ed[data-lit] .ed-lit .u-arrow-line{animation:u-draw .3s var(--anatomy-ease) backwards;animation-delay:calc(var(--d,0) * 260ms)}
.ed[data-lit] .ed-lit .u-arrow-head{animation:u-fade .3s backwards;animation-delay:calc(var(--d,0) * 260ms + 200ms)}
.ed[data-lit="sym"] .ed-lit .u-arrow{color:var(--unfold-yellow)}
.ed[data-lit="eps"] .ed-lit .u-arrow{color:var(--unfold-purple)}
.ed-sym{font:600 13px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:middle;dominant-baseline:central;transition:fill .3s}
.ed[data-lit="sym"] .ed-sym{fill:var(--unfold-yellow)}
.st-body{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1.2;transition:fill .3s,stroke .3s;transition-delay:calc(var(--d,0) * 260ms + 200ms)}
.st-ring{fill:none;stroke:var(--anatomy-mid);stroke-width:1.2;transition:stroke .3s}
.st text{font:500 12px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central;transition:fill .3s}
.st[data-on] .st-body{fill:color-mix(in srgb,var(--unfold-blue) 30%,var(--anatomy-card));stroke:var(--unfold-blue);stroke-width:2}
.st[data-on] text,.st[data-src] text,.st[data-dead] text{fill:var(--anatomy-strong)}
.st[data-src] .st-body{fill:color-mix(in srgb,var(--unfold-blue) 10%,var(--anatomy-card));stroke:var(--unfold-blue);stroke-dasharray:3 2}
.st[data-dead] .st-body{fill:color-mix(in srgb,var(--unfold-red) 16%,var(--anatomy-card));stroke:var(--unfold-red);stroke-width:1.6}
.st-acc[data-on] .st-body{fill:color-mix(in srgb,var(--unfold-green) 34%,var(--anatomy-card));stroke:var(--unfold-green)}
.st-acc[data-on] .st-ring{stroke:var(--unfold-green)}
.tp .u-chip rect{transition:fill .3s,stroke .3s,opacity .3s}
.tp .u-chip text{font-size:13px}
.tp{transition:opacity .3s}
.tp[data-done]{opacity:.35}
.tp[data-read] .u-chip rect{fill:color-mix(in srgb,var(--unfold-yellow) 22%,var(--anatomy-card));stroke:var(--unfold-yellow)}
.tp[data-read] .u-chip text{fill:var(--unfold-yellow)}
.tp[data-p]{cursor:pointer}
.tp-cursor{fill:var(--unfold-yellow);transition:transform .45s var(--anatomy-ease),opacity .3s}
.mx-head{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle}
.mx-name{font:italic 600 13px var(--unfold-serif);fill:var(--unfold-blue);text-anchor:end;dominant-baseline:central}
.mx-sym{font:600 12px var(--anatomy-mono);fill:var(--unfold-yellow);text-anchor:middle;dominant-baseline:central}
.mx-hit{fill:transparent;cursor:pointer}
.mx-cell{fill:var(--anatomy-faint);fill-opacity:.25;pointer-events:none}
.mx-cell[data-in]{fill:var(--unfold-blue);fill-opacity:.85}
.mx-acc[data-in]{fill:var(--unfold-green)}
.mx-row{transition:opacity .35s}
.mx-row[data-later]{opacity:0}
.mx-mark{fill:none;stroke:var(--anatomy-strong);stroke-width:1.2;transition:transform .4s var(--anatomy-ease);pointer-events:none}
`;

const key = u.keyHtml([
  { hue: "blue", label: "active set S" },
  { hue: "yellow", label: "symbol read, symbol edge" },
  { hue: "purple", label: "ε edge (no input)" },
  { hue: "red", label: "state that dies" },
  { hue: "green", label: "accept state" },
]);

const stage = u.stageHtml({
  dwell: 9500,
  scenes,
  svg,
  label: `NFA matching explainer. Left and right arrows change the scene. Comma and period, or up and down, step through the input.`,
  css,
  key,
  time: { steps: LAST + 1, scenes: [1, 2, 3, 4] },
  narrow: [LAYOUT.narrow.W, LAYOUT.narrow.H],
});

// ---- Live: every look per step comes from the model's trace ----
const arrowText = (e) => `${e.from} -${e.sym}-> ${e.to}`;
const say = (s, t) => {
  const row = SET_ROWS.indexOf(s);
  if (s.kind === "start") return `S0 = ε-closure({${NFA.start}}) = {${s.set}} · state ${NFA.start} has no ε edges`;
  if (s.kind === "move")
    return `read ${s.sym} · move(S${s.i - 1}, ${s.sym}) = {${s.set}} · ${s.taken.map((k) => arrowText(NFA.edges[k])).join(", ")}${s.dead.length ? ` · ${s.dead.join(" and ")} die` : ""}`;
  const waves = Math.max(0, ...s.added.map((a) => a.depth));
  const base = `S${row} = ε-closure({${s.seed}}) = {${s.set}}`;
  if (t === LAST) return `${base} · ${NFA.accept} ∈ S${row}, so "${INPUT}" matches`;
  return `${base} · ${s.added.length} states added in ${waves} ε waves`;
};
const DATA = STEPS.map((s, t) => ({
  kind: s.kind,
  pos: s.pos,
  set: s.set,
  src: s.src ?? [],
  dead: s.dead ?? [],
  taken: s.taken ?? [],
  added: s.added ?? [],
  row: s.kind === "move" ? SET_ROWS.indexOf(STEPS[t - 1]) : SET_ROWS.indexOf(s),
  say: say(s, t),
}));

const live = `
const DATA = ${JSON.stringify(DATA)};
const RANGES = ${JSON.stringify(RANGES)};
const LAST = ${LAST};
const ACCEPT = ${NFA.accept};
const LEN = ${INPUT.length};
const PITCH = ${CHIP + GAP};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const all = (sel) => root.querySelectorAll(sel);
let step = 0;
let crossing = false;
function show(t) {
  step = Math.max(0, Math.min(LAST, t));
  const s = DATA[step];
  const depth = new Map(s.added.map((a) => [a.state, a.depth]));
  all(".st").forEach((el) => {
    const k = Number(el.dataset.s);
    el.style.setProperty("--d", s.kind === "move" ? 0 : depth.get(k) ?? 0);
    el.toggleAttribute("data-on", s.set.includes(k));
    el.toggleAttribute("data-src", s.src.includes(k));
    el.toggleAttribute("data-dead", s.dead.includes(k));
  });
  const lit = new Map(s.kind === "move" ? s.taken.map((k) => [k, ["sym", 0]]) : s.added.map((a) => [a.edge, ["eps", a.depth - 1]]));
  all(".ed").forEach((el) => {
    const hit = lit.get(Number(el.dataset.e));
    if (hit) {
      el.style.setProperty("--d", hit[1]);
      if (el.dataset.lit !== hit[0]) el.dataset.lit = hit[0];
    } else el.removeAttribute("data-lit");
  });
  const consumed = s.pos;
  all(".tp").forEach((el) => {
    const p = Number(el.dataset.p);
    el.toggleAttribute("data-done", p < consumed);
    el.toggleAttribute("data-read", s.kind === "move" && p === s.pos);
  });
  const cursor = root.querySelector(".tp-cursor");
  cursor.style.transform = "translateX(" + Math.min(consumed, LEN - 1) * PITCH + "px)";
  cursor.style.opacity = consumed >= LEN ? 0 : 1;
  all(".mx-row").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.r) > s.row));
  root.querySelector(".mx-mark").style.transform = "translateY(" + s.row * ${CH} + "px)";
  UNFOLD.timeAt(step);
  if (readout.textContent !== s.say) readout.textContent = s.say;
}
// Stepping by hand moves to the scene that owns the step.
function stepTo(t) {
  show(t);
  const sc = UNFOLD.scene();
  const [a, b] = RANGES[sc];
  if (sc === 0 || step < a || step > b) {
    crossing = true;
    UNFOLD.go(RANGES.findIndex((r, i) => i > 0 && step >= r[0] && step <= r[1]));
    crossing = false;
  }
  UNFOLD.pause();
}
root.addEventListener("unfold:scene", (e) => {
  if (!crossing) show(RANGES[e.detail.scene][0]);
});
RANGES.forEach(([a, b], sc) => UNFOLD.beat(sc, 1400, (n) => show(n < 0 ? b : Math.min(a + n, b)), 900));
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  stepTo(to);
});
root.addEventListener("click", (e) => {
  const row = e.target.closest(".mx-row");
  if (row) return stepTo(Number(row.dataset.t));
  const chip = e.target.closest(".tp");
  if (chip) stepTo(2 * Number(chip.dataset.p) + 1);
});
show(0);
`;

const code = (t) => `<code>${t}</code>`;
const rows = (list) => list.map(([a, b]) => [code(a), b]);
const notes = u.notesHtml([
  {
    title: "Why a set of states",
    html:
      `<p>An NFA can be in several states at once. The matcher does not guess a path and back up when the guess is wrong. It carries every possible path forward together, as one set. Each symbol touches each state and edge at most once, so the time is <b>O(n·m)</b> for n states and m input symbols. Here that is ${NFA.n} states and ${INPUT.length} symbols.</p>` +
      `<p>Most regex engines in standard libraries (JavaScript, Python <code>re</code>, Java, PCRE) backtrack instead. They try one path at a time. On some patterns, for example <code>(a*)*b</code> against a long run of a, that takes exponential time. RE2, Go's <code>regexp</code> and Rust's <code>regex</code> crate promise linear time. They use this set simulation, or automata built from it, and so they do not support backreferences.</p>`,
  },
  {
    title: "From the NFA to a DFA",
    html: `<p>Each distinct set is one state of a DFA (the subset construction). This run meets ${m.DISTINCT} distinct sets: ${[...new Set(m.SETS.map((s) => s.join(",")))].map((s) => code(`{${s}}`)).join(", ")}. A full subset construction over the alphabet {a, b, c, d} also finds ${m.DFA.length} sets, plus the empty set where every path has died. A DFA does one table lookup per symbol, but on some regexes it needs exponentially many states, so engines often build it lazily, one set at a time.</p>`,
  },
  {
    title: "Other inputs",
    table: {
      head: ["input", "result", "why"],
      rows: [
        [code("abcb"), m.matches("abcb") ? "match" : "no match", `It ends in ${code(`{${m.run(NFA, "abcb").at(-1).set}}`)}. State ${NFA.accept} is not in the set.`],
        [code("ad"), m.matches("ad") ? "match" : "no match", `The ε edge 2 -> 9 skips the loop, so (b|c)* repeats zero times.`],
        [code("abcbdd"), m.matches("abcbdd") ? "match" : "no match", `After the first d the set is {${NFA.accept}}. State ${NFA.accept} has no edges, so the second d leaves an empty set.`],
      ],
    },
  },
  {
    title: "What the figure leaves out",
    html: `<ul><li>The whole input must match, as with <code>^${REGEX}$</code>. To find a match anywhere in a text, the matcher adds state 0 back into the set before each symbol.</li><li>Capture groups. A Pike VM, a variant of this simulation, gives each state in the set the positions where its groups started.</li><li>Real engines do not store the states that have only ε edges (1, 2, 3, 8 and 9 here). They keep only the states that read a symbol, plus the accept state. The figure keeps them all, as the textbook construction does.</li></ul>`,
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: rows([
        ["NFA", "Nondeterministic finite automaton: states and labelled edges, where one state can have several edges for the same input, or ε edges."],
        ["ε edge", "An edge the matcher may follow without reading a symbol."],
        ["move(S, x)", "The states reached from set S by one edge labelled x."],
        ["ε-closure(S)", "S plus every state reached from S by ε edges only."],
        ["Thompson's construction", "Builds an NFA from a regex, one small fragment per piece, joined by ε edges (Ken Thompson, 1968)."],
      ]),
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Matching a regex with an NFA",
    hint: "← → scene · , . step",
    readout: DATA[0].say,
    caption: `The NFA is the real output of Thompson's construction for ${REGEX}, with its states numbered left to right. Every set comes from simulating it. model.mjs checks the simulation against JavaScript's RegExp on all 21,845 strings over {a, b, c, d} up to length 7. The input "${INPUT}" was chosen by hand so that it uses both branches of b|c.`,
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const title = "Matching a regex with an NFA";
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "nfa-match-light.html" : "nfa-match.html");
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
