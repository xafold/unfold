import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const u = await import(pathToFileURL(join(homedir(), ".claude/skills/unfold/kit/concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const W = 820;
const H = 352;
const R = 20;
const N = m.NODES.length;
const run = m.dijkstra(N, m.EDGES, m.SOURCE);
const LAST = run.steps.length - 1;

// Colour identity: what the algorithm knows about a node or an edge right now.
const HUE = { cur: "blue", tent: "yellow", final: "green", keep: "red" };

// ---- Graph: fixed hand layout, no crossings ----
const POS = [[40, 170], [180, 60], [180, 280], [320, 110], [320, 280], [450, 195]];
const DIST_AT = [[0, -36], [0, -36], [0, 37], [0, -36], [0, 37], [0, -36]];
const SRC_AT = [[0, 38, "middle"], [-31, 4, "end"], [-31, 4, "end"], [31, 4, "start"], [31, 4, "start"], [0, 40, "middle"]];
const r1 = (v) => Math.round(v * 10) / 10;
const toward = ([x1, y1], [x2, y2], by) => {
  const L = Math.hypot(x2 - x1, y2 - y1);
  return [r1(x1 + ((x2 - x1) * by) / L), r1(y1 + ((y2 - y1) * by) / L)];
};

const edges = m.EDGES.map(([a, b, w], e) => {
  const [x1, y1] = POS[a];
  const [x2, y2] = POS[b];
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    `<g class="el-edge" data-e="${e}"><path class="el-line" d="M${x1} ${y1}L${x2} ${y2}"/>` +
    `<g class="el-w" transform="translate(${mx} ${my})"><rect x="-11" y="-9" width="22" height="18" rx="4"/><text>${w}</text></g></g>`
  );
});
// One relax arrow per edge and direction, hidden until that relax runs. It runs beside the edge, not on it.
const arrows = m.EDGES.flatMap(([a, b], e) =>
  [[a, b], [b, a]].map(([p, q]) => {
    const [x1, y1] = POS[p];
    const [x2, y2] = POS[q];
    const L = Math.hypot(x2 - x1, y2 - y1);
    const off = [(-(y2 - y1) / L) * 13, ((x2 - x1) / L) * 13];
    const from = toward(POS[p], POS[q], R + 4).map((v, i) => r1(v + off[i]));
    const to = toward(POS[q], POS[p], R + 3).map((v, i) => r1(v + off[i]));
    return `<g class="el-ar" id="ar-${e}-${p}">${u.arrow(from, to, { hue: HUE.cur, head: 7, width: 2.2 })}</g>`;
  }),
);
const nodes = m.NODES.map((name, k) => {
  const [x, y] = POS[k];
  const [dx, dy] = DIST_AT[k];
  const [sx, sy, anchor] = SRC_AT[k];
  return (
    `<g class="el-node" data-i="${k}" transform="translate(${x} ${y})">` +
    `<circle class="el-ring" r="${R + 5}"/><circle class="el-disc" r="${R}"/><text class="el-name">${name}</text>` +
    `<g class="el-dist" transform="translate(${dx} ${dy})"><text class="el-dv">∞</text><g class="el-was"><text y="${dy < 0 ? -18 : 18}">was 4</text></g></g>` +
    `<g class="el-src"><text x="${sx}" y="${sy}" text-anchor="${anchor}">source</text></g></g>`
  );
});

// ---- Side: the arrays d[] and prev[], and the priority queue ----
const COL = { name: 14, d: 84, prev: 146, state: 206 };
const ROW0 = 34;
const ROWH = 27;
const head =
  `<text class="el-th" x="${COL.name}" y="12">node</text><text class="el-th" x="${COL.d}" y="12">d</text>` +
  `<text class="el-th" x="${COL.prev}" y="12">prev</text><text class="el-th el-left" x="${COL.state - 14}" y="12">state</text>` +
  `<path class="el-rule" d="M0 22H300"/>`;
const rows = m.NODES.map(
  (name, k) =>
    `<g class="el-row" data-i="${k}" transform="translate(0 ${ROW0 + k * ROWH})"><rect class="el-row-bg" x="0" y="-12" width="300" height="24" rx="4"/>` +
    `<text class="el-rn" x="${COL.name}">${name}</text><text class="el-rd" x="${COL.d}">∞</text><text class="el-rp" x="${COL.prev}">–</text>` +
    `<text class="el-rs" x="${COL.state - 14}">not reached</text></g>`,
).join("");
const QY = 236;
const queueBox =
  `<text class="el-th el-left" x="0" y="${QY - 14}">taken</text><text class="el-th el-left" x="62" y="${QY - 14}">priority queue, smallest d first</text>` +
  `<rect class="el-slot" x="-3" y="${QY - 3}" width="50" height="30" rx="6"/><rect class="el-slot" x="57" y="${QY - 3}" width="245" height="30" rx="6"/>`;
const chips = m.NODES.map((name, k) => `<g class="el-q" data-i="${k}" style="transform:translate(0px,${QY}px);opacity:0">${u.chip(`${name} ∞`, 0, 0, { w: 44, h: 24, rx: 5 })}</g>`).join("");

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "Dijkstra's shortest path algorithm on a graph of 6 nodes and 9 weighted edges, with the distance table, the prev table and the priority queue.",
  body: [`<g class="el-graph">${edges.join("")}${arrows.join("")}${nodes.join("")}</g>`, `<g class="el-side">${head}${rows}${queueBox}${chips}</g>`],
});

// ---- Scenes ----
const d = (v, hue = HUE.tent) => `${u.mi("d", hue)}<mo stretchy="false">(</mo><mi>${v}</mi><mo stretchy="false">)</mo>`;
const w = `<mi>w</mi><mo stretchy="false">(</mo>${u.mi("u", HUE.cur)}<mo>,</mo><mi>v</mi><mo stretchy="false">)</mo>`;
const sp = `<mspace width="1em"/>`;
const scenes = [
  {
    name: "Graph",
    math: `${d("s", HUE.final)}<mo>=</mo><mn>0</mn>${sp}${d("v")}<mo>=</mo><mi>∞</mi><mspace width=".4em"/><mtext>for every other</mtext><mspace width=".3em"/><mi>v</mi>`,
    say: `Dijkstra finds the cheapest path from the <b>source</b> to every node. Each edge weight is the cost to cross that edge.`,
  },
  {
    name: "Relax",
    math: `${d("v")}<mo>←</mo><mi>min</mi><mo stretchy="false">(</mo>${d("v")}<mo>,</mo><mspace width=".3em"/>${d("u", HUE.cur)}<mo>+</mo>${w}<mo stretchy="false">)</mo>`,
    say: `The loop takes the source and <b data-hue="blue">relaxes</b> each of its edges. A relax keeps the smaller of the old <b data-hue="yellow">d</b> and the cost through u.`,
  },
  {
    name: "Closest",
    math: `${u.mi("u", HUE.cur)}<mo>=</mo><munder><mi>argmin</mi><mrow><mi>v</mi><mo>∈</mo>${u.mi("Q", HUE.tent)}</mrow></munder><mspace width=".25em"/>${d("v")}`,
    say: `Next the loop takes the queued node with the smallest d and marks it <b data-hue="green">final</b>. No later path can cost less, because no weight is negative.`,
  },
  {
    name: "Improve",
    math: `${d("u", HUE.cur)}<mo>+</mo>${w}<mo>&lt;</mo>${d("v")}${sp}<mo>⇒</mo>${sp}${u.mi("prev", "")}<mo stretchy="false">(</mo><mi>v</mi><mo stretchy="false">)</mo><mo>←</mo>${u.mi("u", HUE.cur)}`,
    say: `A relax from the new node can lower a d that is not final yet. A path with more edges can still cost less.`,
  },
  {
    name: "Repeat",
    math: `<mtext>while</mtext><mspace width=".4em"/>${u.mi("Q", HUE.tent)}<mo>≠</mo><mi>∅</mi><mo>:</mo>${sp}${u.mi("u", HUE.cur)}<mo>←</mo><mtext>extract-min</mtext><mo stretchy="false">(</mo>${u.mi("Q", HUE.tent)}<mo stretchy="false">)</mo>`,
    say: `The loop repeats the same two moves until the queue is empty. A relax that finds <b data-hue="red">no cheaper path</b> keeps the old d.`,
  },
  {
    name: "Tree",
    math: `${d("v", HUE.final)}<mo>=</mo>${u.mi("d", HUE.final)}<mo stretchy="false">(</mo><mi>prev</mi><mo stretchy="false">(</mo><mi>v</mi><mo stretchy="false">)</mo><mo stretchy="false">)</mo><mo>+</mo><mi>w</mi><mo stretchy="false">(</mo><mi>prev</mi><mo stretchy="false">(</mo><mi>v</mi><mo stretchy="false">)</mo><mo>,</mo><mi>v</mi><mo stretchy="false">)</mo>`,
    say: `Every <b data-hue="green">final</b> d is a shortest distance. Follow prev back from any node to read its path.`,
  },
];

const css = [
  `.el-side{transform:translate(512px,40px)}`,
  `.u-stage[data-narrow] .el-graph{transform:translate(0,4px) scale(.84)}`,
  `.u-stage[data-narrow] .el-side{transform:translate(50px,300px)}`,
  `.el-graph,.el-side{transition:transform .5s var(--anatomy-ease)}`,
  `.el-line{stroke:var(--anatomy-lo);stroke-width:1.3;fill:none;transition:stroke .35s,stroke-width .35s,opacity .4s}`,
  `.el-edge[data-tree="tent"] .el-line{stroke:var(--unfold-yellow);stroke-width:2.4}`,
  `.el-edge[data-tree="final"] .el-line{stroke:var(--unfold-green);stroke-width:2.4}`,
  `.el-edge[data-path] .el-line{stroke-width:5}`,
  `.el-edge{transition:opacity .5s}`,
  `.u-stage[data-scene="5"] .el-edge:not([data-tree]){opacity:.28}`,
  `.el-w rect{fill:var(--anatomy-card);stroke:var(--anatomy-faint);stroke-width:.8}`,
  `.el-w text{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:middle;dominant-baseline:central}`,
  `.el-edge[data-on] .el-w rect{stroke:var(--unfold-blue)}`,
  `.el-ar{opacity:0;transition:opacity .3s}`,
  `.el-ar[data-on]{opacity:1}`,
  `.el-ar[data-new] .u-arrow-line{animation:u-draw .6s var(--anatomy-ease) backwards}`,
  `.el-ar[data-new] .u-arrow-head{animation:u-fade .3s .45s backwards}`,
  `.el-disc{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1.3;transition:fill .35s,stroke .35s,stroke-width .35s}`,
  `.el-node[data-state="queue"] .el-disc{stroke:var(--unfold-yellow);stroke-width:2}`,
  `.el-node[data-state="done"] .el-disc{stroke:var(--unfold-green);stroke-width:2;fill:color-mix(in srgb,var(--unfold-green) 22%,var(--anatomy-card))}`,
  `.el-node[data-cur] .el-disc{stroke:var(--unfold-blue);stroke-width:3.5}`,
  `.el-ring{fill:none;stroke:var(--anatomy-mid);stroke-width:1;stroke-dasharray:3 3;opacity:0}`,
  `.el-node[data-source] .el-ring{opacity:1}`,
  `.el-node[data-focus] .el-ring{opacity:1;stroke:var(--anatomy-strong);stroke-dasharray:none;stroke-width:1.4}`,
  `.el-node{cursor:pointer}`,
  `.el-name{font:600 16px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}`,
  `.el-dist text{font:600 15px var(--anatomy-mono);text-anchor:middle;dominant-baseline:central;font-variant-numeric:tabular-nums}`,
  `.el-dv{fill:var(--anatomy-muted)}`,
  `.el-node[data-state="queue"] .el-dv{fill:var(--unfold-yellow)}`,
  `.el-node[data-state="done"] .el-dv{fill:var(--unfold-green)}`,
  `.el-was{opacity:0;transition:opacity .3s}`,
  `.el-was text{font:500 12px var(--anatomy-mono)!important;fill:var(--anatomy-muted)}`,
  `.el-node[data-was] .el-was{opacity:1}`,
  `.el-node[data-was="keep"] .el-was text{fill:var(--unfold-red)}`,
  `.el-src{opacity:0;transition:opacity .3s}.el-node[data-source] .el-src{opacity:1}`,
  `.el-src text{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.el-th{font:500 11px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-left{text-anchor:start}`,
  `.el-rule{stroke:var(--anatomy-faint);stroke-width:.8}`,
  `.el-row text{font:500 13px var(--anatomy-mono);text-anchor:middle;dominant-baseline:central;fill:var(--anatomy-muted);font-variant-numeric:tabular-nums}`,
  `.el-row .el-rn{fill:var(--anatomy-strong)}`,
  `.el-row .el-rs{text-anchor:start;font-size:12px}`,
  `.el-row-bg{fill:transparent;stroke:none;transition:fill .3s}`,
  `.el-row[data-state="queue"] :is(.el-rd,.el-rs){fill:var(--unfold-yellow)}`,
  `.el-row[data-state="done"] :is(.el-rd,.el-rs){fill:var(--unfold-green)}`,
  `.el-row[data-state] .el-rp{fill:var(--anatomy-text)}`,
  `.el-row[data-cur] .el-row-bg{fill:color-mix(in srgb,var(--unfold-blue) 16%,transparent)}`,
  `.el-row[data-cur] .el-rs{fill:var(--unfold-blue)}`,
  `.el-row[data-focus] .el-row-bg{stroke:var(--anatomy-strong);stroke-width:1}`,
  `.el-row[data-hit] .el-rd{fill:var(--unfold-blue)}`,
  `.el-row[data-hit="keep"] .el-rd{fill:var(--unfold-red)}`,
  `.el-row{cursor:pointer}`,
  `.el-slot{fill:none;stroke:var(--anatomy-faint);stroke-width:.8;stroke-dasharray:3 3}`,
  `.el-q{transition:transform .6s var(--anatomy-ease),opacity .4s var(--anatomy-ease)}`,
  `.el-q .u-chip rect{fill:color-mix(in srgb,var(--hue,var(--anatomy-mid)) 16%,var(--anatomy-card))}`,
  `.el-q .u-chip text{fill:var(--anatomy-strong);font-size:12px}`,
  `.u-ctl select{padding:4px 6px;border:0;border-radius:6px;background:var(--anatomy-card);color:var(--anatomy-text);font:12px var(--anatomy-mono);box-shadow:0 0 0 1px var(--anatomy-faint)}`,
  `.el-pick{display:inline-flex;align-items:center;gap:4px;color:var(--anatomy-muted);font:11px var(--anatomy-mono)}`,
  `.el-pick button{padding:5px 8px}`,
  `@container (max-width:520px){.u-controls{gap:8px 10px}}`,
  `.u-stage[data-narrow] .el-w text{font-size:14px}.u-stage[data-narrow] .el-w rect{x:-13px;y:-10px;width:26px;height:20px}.u-stage[data-narrow] :is(.el-src,.el-was) text{font-size:13px!important}`,
].join("\n");

const key = u.keyHtml([
  { hue: HUE.cur, label: "node taken now, edge relaxed" },
  { hue: HUE.tent, label: "d in queue (may still drop)" },
  { hue: HUE.final, label: "final d, shortest" },
  { hue: HUE.keep, label: "no cheaper path" },
  { hue: "ink", label: "thick line: best path to target" },
]);

const edgeName = ([a, b]) => `${m.NODES[a]}–${m.NODES[b]}`;
const controls =
  `<span class="el-pick">source ${m.NODES.map((n, k) => `<button type="button" data-src="${k}" aria-pressed="${k === m.SOURCE}">${n}</button>`).join("")}</span>` +
  `<label>edge <select id="el-edge">${m.EDGES.map((e, i) => `<option value="${i}">${edgeName(e)}</option>`).join("")}</select></label>` +
  `<label>weight <input type="number" id="el-wt" min="${m.W_MIN}" max="${m.W_MAX}" step="1" value="${m.EDGES[0][2]}"></label>` +
  `<button type="button" id="el-reset">reset</button>`;

const stage = u.stageHtml({
  dwell: 7000,
  scenes,
  svg,
  label: "Dijkstra explainer. Left and right arrows change the scene. Comma and period step through the run. Up and down arrows pick the target node.",
  css,
  key,
  time: { steps: LAST + 1 },
  controls,
  narrow: [400, 572],
});

const live = `
${u.modelScript([m.dijkstra, m.sceneRanges], { NODES: m.NODES, EDGES0: m.EDGES, SOURCE0: m.SOURCE, W_MIN: m.W_MIN, W_MAX: m.W_MAX })}
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const QY = ${QY};
let edges = EDGES0.map((e) => e.slice());
let source = SOURCE0;
let focus = 1;
let run, ranges, step = 0, crossing = false;
const $ = (s) => root.querySelector(s);
const all = (s) => root.querySelectorAll(s);
const nodeEl = [...all(".el-node")];
const rowEl = [...all(".el-row")];
const chipEl = [...all(".el-q")];
const edgeEl = [...all(".el-edge")];
const ev = (x) => (x === null ? "\\u221e" : String(x));
const edgeOf = (a, b) => edges.findIndex(([p, q]) => (p === a && q === b) || (p === b && q === a));
function recompute() {
  run = dijkstra(NODES.length, edges, source);
  ranges = sceneRanges(run.steps);
}
function pathTo(s, v) {
  const out = [v];
  while (s.prev[out[0]] >= 0) out.unshift(s.prev[out[0]]);
  return s.d[v] === null ? [] : out;
}
function say(s, t) {
  const N = (k) => NODES[k];
  if (UNFOLD.scene() === 5) {
    const p = pathTo(s, focus);
    const ws = p.slice(1).map((v, i) => edges[edgeOf(p[i], v)][2]);
    return "shortest path to " + N(focus) + ": " + p.map(N).join("\\u2013") + (ws.length > 1 ? " = " + ws.join(" + ") + " = " + s.d[focus] : ws.length ? " = " + s.d[focus] : ", the source itself, d = 0");
  }
  const head = "step " + t + " \\u00b7 ";
  if (s.kind === "init") return head + "d(" + N(s.u) + ") = 0, every other d = \\u221e";
  if (s.kind === "pop") return head + "take " + N(s.u) + ": smallest d in the queue (" + s.d[s.u] + "), now final";
  const a = "relax " + N(s.u) + "\\u2013" + N(s.v) + ": " + s.d[s.u] + " + " + s.w + " = " + s.cand;
  if (s.outcome === "keep") return head + a + " \\u2265 " + s.before + ", so d(" + N(s.v) + ") stays " + s.before;
  return head + a + " < " + ev(s.before) + ", so d(" + N(s.v) + ") = " + s.cand + ", prev(" + N(s.v) + ") = " + N(s.u);
}
function show(t) {
  step = Math.max(0, Math.min(run.steps.length - 1, t));
  const s = run.steps[step];
  const tree = UNFOLD.scene() === 5;
  const cur = s.kind === "init" || tree ? -1 : s.u;
  // Every relax since the last pop stays drawn, so a scene's resting frame shows all of u's edges.
  let p = step;
  while (p > 0 && run.steps[p].kind === "relax") p--;
  const batch = tree ? [] : run.steps.slice(p + 1, step + 1);
  const state = (k) => (s.done[k] ? "done" : s.d[k] === null ? "far" : "queue");
  const path = pathTo(s, focus);
  const onPath = new Set(path.slice(1).map((v, i) => edgeOf(path[i], v)));
  nodeEl.forEach((el, k) => {
    el.dataset.state = state(k);
    el.toggleAttribute("data-cur", k === cur);
    el.toggleAttribute("data-source", k === source);
    el.toggleAttribute("data-focus", k === focus);
    el.querySelector(".el-dv").textContent = ev(s.d[k]);
    const r = batch.find((x) => x.v === k && x.outcome !== "set");
    if (r) el.dataset.was = r.outcome; else el.removeAttribute("data-was");
    if (r) el.querySelector(".el-was text").textContent = r.outcome === "lower" ? "was " + r.before : "via " + NODES[r.u] + ": " + r.cand;
  });
  rowEl.forEach((el, k) => {
    el.dataset.state = state(k);
    el.toggleAttribute("data-cur", k === cur);
    el.toggleAttribute("data-focus", k === focus);
    if (s.kind === "relax" && s.v === k) el.dataset.hit = s.outcome; else el.removeAttribute("data-hit");
    el.querySelector(".el-rd").textContent = ev(s.d[k]);
    el.querySelector(".el-rp").textContent = s.prev[k] >= 0 ? NODES[s.prev[k]] : "\\u2013";
    el.querySelector(".el-rs").textContent = k === cur ? "taken now" : { done: "final", queue: "in queue", far: "not reached" }[state(k)];
  });
  edgeEl.forEach((el, e) => {
    const [a, b] = edges[e];
    const v = s.prev[b] === a ? b : s.prev[a] === b ? a : -1;
    if (v >= 0) el.dataset.tree = s.done[v] ? "final" : "tent"; else el.removeAttribute("data-tree");
    el.toggleAttribute("data-path", onPath.has(e));
    el.toggleAttribute("data-on", s.kind === "relax" && s.e === e);
    el.querySelector(".el-w text").textContent = edges[e][2];
  });
  const on = new Map(batch.map((r) => ["ar-" + r.e + "-" + r.u, r]));
  all(".el-ar").forEach((el) => {
    const r = on.get(el.id);
    const fresh = r === s && !el.hasAttribute("data-new");
    el.toggleAttribute("data-on", !!r);
    if (r !== s) el.removeAttribute("data-new");
    if (!r) return;
    el.querySelector(".u-arrow").dataset.hue = r.outcome === "keep" ? "red" : "blue";
    if (fresh) (void el.getBoundingClientRect(), el.setAttribute("data-new", ""));
  });
  chipEl.forEach((el, k) => {
    const at = s.queue.indexOf(k);
    const c = el.querySelector(".u-chip");
    let x = 62 + (at < 0 ? s.queue.length : at) * 48, o = 0;
    if (at >= 0) o = 1;
    if (k === cur) (x = 0), (o = 1);
    else if (s.done[k]) x = 0;
    el.style.transform = "translate(" + x + "px," + QY + "px)";
    el.style.opacity = o;
    c.dataset.hue = k === cur ? "blue" : "yellow";
    c.querySelector("text").textContent = NODES[k] + " " + ev(s.d[k]);
  });
  UNFOLD.timeAt(step);
  const text = say(s, step);
  if (readout.textContent !== text) readout.textContent = text;
}
function stepTo(t) {
  show(t);
  const sc = UNFOLD.scene();
  const [a, b] = ranges[sc];
  if (step < a || step > b) {
    crossing = true;
    UNFOLD.go(ranges.findIndex((r) => step >= r[0] && step <= r[1]));
    crossing = false;
  }
  UNFOLD.pause();
}
root.addEventListener("unfold:scene", (e) => {
  if (!crossing) show(ranges[e.detail.scene][0]);
});
for (let sc = 0; sc < 6; sc++) UNFOLD.beat(sc, 1500, (n) => { const [a, b] = ranges[sc]; show(n < 0 ? b : Math.min(a + n, b)); }, 900);
UNFOLD.onTime(stepTo);
const pick = (k) => {
  focus = (k + NODES.length) % NODES.length;
  UNFOLD.pause();
  show(step);
};
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: focus - 1, ArrowDown: focus + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  pick(to);
});
root.addEventListener("click", (e) => {
  const n = e.target.closest(".el-node,.el-row");
  if (n) pick(Number(n.dataset.i));
});
// Live inputs: the source and any edge weight. The page reruns the model's own dijkstra().
const sel = $("#el-edge"), wt = $("#el-wt");
const redo = () => {
  UNFOLD.pause();
  recompute();
  const [a, b] = ranges[UNFOLD.scene()];
  show(UNFOLD.scene() === 0 ? a : b);
};
all("[data-src]").forEach((b) => b.addEventListener("click", () => {
  source = Number(b.dataset.src);
  all("[data-src]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  redo();
}));
sel.addEventListener("change", () => (wt.value = edges[Number(sel.value)][2]));
wt.addEventListener("input", () => {
  const v = Number(wt.value);
  if (wt.value === "" || !Number.isFinite(v)) return;
  edges[Number(sel.value)][2] = Math.round(Math.max(W_MIN, Math.min(W_MAX, v)));
  redo();
});
wt.addEventListener("change", () => (wt.value = edges[Number(sel.value)][2]));
$("#el-reset").addEventListener("click", () => {
  edges = EDGES0.map((e) => e.slice());
  wt.value = edges[Number(sel.value)][2];
  redo();
});
recompute();
show(0);
`;

// ---- Notes under the card ----
const neg =
  `<svg viewBox="0 0 520 120" role="img" aria-label="A graph where a negative weight breaks Dijkstra">` +
  `<style>.n-l{stroke:var(--anatomy-lo);stroke-width:1.3}.n-c{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1.3}.n-t{font:600 13px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}.n-w{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:middle;dominant-baseline:central}.n-s{font:11px var(--anatomy-mono);fill:var(--anatomy-muted)}</style>` +
  `<path class="n-l" d="M40 60L160 20M40 60L160 100M160 100L160 20"/>` +
  `<rect x="88" y="22" width="20" height="16" rx="3" fill="var(--anatomy-card)"/><text class="n-w" x="98" y="30">2</text>` +
  `<rect x="88" y="82" width="20" height="16" rx="3" fill="var(--anatomy-card)"/><text class="n-w" x="98" y="90">3</text>` +
  `<rect x="164" y="52" width="26" height="16" rx="3" fill="var(--anatomy-card)"/><text class="n-w" x="177" y="60" style="fill:var(--unfold-red)">−2</text>` +
  `<circle class="n-c" cx="40" cy="60" r="15"/><text class="n-t" x="40" y="60">s</text>` +
  `<circle class="n-c" cx="160" cy="20" r="15" style="stroke:var(--unfold-green)"/><text class="n-t" x="160" y="20">a</text>` +
  `<circle class="n-c" cx="160" cy="100" r="15"/><text class="n-t" x="160" y="100">b</text>` +
  `<text class="n-s" x="230" y="24">Dijkstra: a is final with d = 2</text>` +
  `<text class="n-s" x="230" y="60" style="fill:var(--unfold-red)">true shortest: s–b–a = 3 + (−2) = 1</text>` +
  `<text class="n-s" x="230" y="96">use Bellman-Ford for negative weights</text></svg>`;

const notes = u.notesHtml([
  {
    title: "Cost of the queue",
    html: `<p>The figure keeps the queue sorted, so it reads like the array version. Real code uses a binary heap.</p>`,
    table: {
      head: ["queue", "extract-min", "lower a d", "whole run"],
      rows: [
        ["array scan", "O(V)", "O(1)", "O(V²)"],
        ["binary heap", "O(log V)", "O(log V)", "O((V + E) log V)"],
        ["Fibonacci heap", "O(log V) amortized", "O(1) amortized", "O(E + V log V)"],
      ],
    },
  },
  {
    title: "Negative weights break it",
    html: `<p>A final d is safe only if no edge can make a longer path cheaper.</p>${neg}`,
  },
  {
    title: "Variants you will meet",
    table: {
      head: ["variant", "what changes"],
      rows: [
        ["lazy deletion", "push a new queue entry on each lower, skip stale entries on pop (Python <code>heapq</code>)"],
        ["early stop", "stop when the target node is taken, its d is already final"],
        ["directed graph", "relax only the edges that leave u"],
        ["A*", "order the queue by d(v) + h(v), an estimate of the rest"],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["source", "the start node, d = 0"],
        ["d(v)", "cheapest cost to v found so far"],
        ["relax", "check if the path through u is cheaper for v"],
        ["final", "taken from the queue, d cannot drop again"],
        ["prev(v)", "the node before v on its best path"],
        ["priority queue", "nodes with a known d, smallest d first"],
      ],
    },
  },
]);

const body = iso.plateHtml({
  fig: "Fig 1",
  title: "Dijkstra's shortest path",
  hint: "← → scene · , . step · ↑ ↓ target",
  readout: "step 0 · d(A) = 0, every other d = ∞",
  caption:
    "An undirected graph with 6 nodes and 9 edges. The weights were chosen by hand, so the run lowers some distances and keeps one. Every d, prev and queue entry comes from a model of the algorithm, checked against networkx. Ties in the queue go to the earlier letter.",
  body: stage,
}) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "page-light.html" : "page.html");
const title = "Dijkstra's shortest path";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
