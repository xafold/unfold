// Truth model: Dijkstra's algorithm on a small undirected weighted graph, recorded one step at a time.
// The queue uses lazy deletion, as with Python's heapq: an entry is never changed. A lower d pushes a new entry,
// and the old entry goes stale. A popped stale entry is skipped.
// A step is "init", "pop" (take the smallest entry, its node is final), "skip" (a stale entry) or "relax" (one edge).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export const NODES = ["A", "B", "C", "D", "E", "F"];
// [from, to, weight] by node index. Weights chosen by hand so the run shows one lowered and one kept distance.
export const EDGES = [
  [0, 1, 4], [0, 2, 2], [1, 2, 1], [1, 3, 5], [2, 3, 5],
  [2, 4, 10], [3, 4, 2], [3, 5, 6], [4, 5, 3],
];
export const SOURCE = 0;
export const W_MIN = 1;
export const W_MAX = 20;

// The pseudocode the figure shows, and the line each kind of step runs (0-based).
export const CODE = [
  "d[v] = ∞ for every v;  d[s] = 0",
  "push (0, s) into Q",
  "while Q is not empty:",
  "  (k, u) = pop the smallest k from Q",
  "  if u is final: skip   # stale entry",
  "  mark u final",
  "  for each edge (u, v, w), v not final:",
  "    if d[u] + w < d[v]:",
  "      d[v] = d[u] + w;  prev[v] = u",
  "      push (d[v], v) into Q",
];

// The pseudocode line a step runs.
export function codeLine(step) {
  if (step.kind === "init") return 1;
  if (step.kind === "skip") return 4;
  if (step.kind === "pop") return 5;
  return step.outcome === "keep" ? 7 : 8;
}

// d holds null for infinity, so a step survives JSON. entries[id] = { k, v } is every queue entry ever pushed.
// A step's queue lists entry ids, smallest k first (ties by node), and stale lists the ids in it that are stale.
export function dijkstra(n, edges, source) {
  const d = Array(n).fill(null);
  const prev = Array(n).fill(-1);
  const done = Array(n).fill(false);
  const nbrs = Array.from({ length: n }, () => []);
  edges.forEach(([a, b, w], e) => {
    nbrs[a].push({ v: b, w, e });
    nbrs[b].push({ v: a, w, e });
  });
  for (const list of nbrs) list.sort((x, y) => x.v - y.v);
  const entries = [];
  let queue = [];
  const push = (v) => {
    entries.push({ k: d[v], v });
    queue.push(entries.length - 1);
    queue.sort((i, j) => entries[i].k - entries[j].k || entries[i].v - entries[j].v);
    return entries.length - 1;
  };
  const snap = (extra) => ({
    ...extra,
    d: d.slice(),
    prev: prev.slice(),
    done: done.slice(),
    queue: queue.slice(),
    stale: queue.filter((i) => done[entries[i].v] || entries[i].k > d[entries[i].v]),
  });
  d[source] = 0;
  push(source);
  const steps = [snap({ kind: "init", u: source })];
  while (queue.length) {
    const id = queue.shift();
    const { k, v: u } = entries[id];
    if (done[u]) {
      steps.push(snap({ kind: "skip", u, id, k }));
      continue;
    }
    done[u] = true;
    steps.push(snap({ kind: "pop", u, id, k }));
    for (const { v, w, e } of nbrs[u]) {
      if (done[v]) continue;
      const before = d[v];
      const cand = d[u] + w;
      const outcome = before === null ? "set" : cand < before ? "lower" : "keep";
      let pushed = -1;
      if (outcome !== "keep") {
        d[v] = cand;
        prev[v] = u;
        pushed = push(v);
      }
      steps.push(snap({ kind: "relax", u, v, w, e, before, cand, outcome, pushed }));
    }
  }
  return { steps, entries, d: d.slice(), prev: prev.slice() };
}

// Step ranges per scene, from the trace: start, first pop and its edges, second pop, its edges, the rest, the tree.
export function sceneRanges(steps) {
  const pops = steps.map((s, i) => (s.kind === "pop" ? i : -1)).filter((i) => i >= 0);
  const last = steps.length - 1;
  return [[0, 0], [pops[0], pops[1] - 1], [pops[1], pops[1]], [pops[1] + 1, pops[2] - 1], [pops[2], last], [last, last]];
}

// An independent check: Floyd-Warshall on the same graph.
function allPairs(n, edges) {
  const D = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : Infinity)));
  for (const [a, b, w] of edges) D[a][b] = D[b][a] = Math.min(D[a][b], w);
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i][j] = Math.min(D[i][j], D[i][k] + D[k][j]);
  return D;
}

export let QUEUE_MAX = 0;
function check(edges) {
  const n = NODES.length;
  const D = allPairs(n, edges);
  for (let s = 0; s < n; s++) {
    const { steps, entries, d, prev } = dijkstra(n, edges, s);
    assert.deepEqual(d, D[s], "distances match Floyd-Warshall");
    const relax = steps.filter((x) => x.kind === "relax");
    const lowers = relax.filter((x) => x.outcome === "lower").length;
    assert.equal(relax.length, edges.length, "one relax per edge");
    assert.equal(steps.filter((x) => x.kind === "skip").length, lowers, "each lowered d leaves one stale entry, skipped later");
    assert.equal(entries.length, n + lowers, "one entry per node, plus one per lower");
    const pops = steps.filter((x) => x.kind === "pop");
    assert.equal(pops.length, n);
    pops.forEach((p, i) => {
      assert.equal(p.k, d[p.u], "a popped fresh entry holds the final d");
      if (i) assert.ok(p.k >= pops[i - 1].k, "pops come in order of distance");
    });
    for (const x of steps) {
      if (x.kind === "skip") assert.ok(x.done[x.u] && x.k > x.d[x.u], "a skipped entry is stale: its node is final with a smaller d");
      for (const id of x.queue) assert.equal(x.stale.includes(id), x.done[entries[id].v] || entries[id].k > x.d[entries[id].v]);
      QUEUE_MAX = Math.max(QUEUE_MAX, x.queue.length);
    }
    const [, r1, , r3] = sceneRanges(steps);
    assert.ok(r1[1] > r1[0] && r3[1] >= r3[0], "scenes 2 and 4 hold at least one step");
    for (let v = 0; v < n; v++) {
      if (v === s) continue;
      const [, , w] = edges.find(([a, b]) => (a === v && b === prev[v]) || (b === v && a === prev[v]));
      assert.equal(d[prev[v]] + w, d[v], "d(v) = d(prev v) + w");
    }
  }
}

const preset = dijkstra(NODES.length, EDGES, SOURCE);
assert.deepEqual(preset.d, [0, 3, 2, 7, 9, 12]);
assert.deepEqual(preset.prev.map((p) => NODES[p] ?? "-"), ["-", "C", "A", "C", "D", "E"]);
const outcomes = preset.steps.filter((s) => s.kind === "relax").map((s) => s.outcome);
assert.ok(outcomes.includes("lower") && outcomes.includes("keep"), "the preset shows a lowered and a kept distance");
assert.ok(preset.steps.some((s) => s.kind === "skip"), "the preset shows a stale entry skipped");
// Scene 4 (Improve) ends on a lowered d, so its resting frame shows the "was 4" label and the struck-through entry.
const r = sceneRanges(preset.steps);
const improve = preset.steps.slice(r[3][0], r[3][1] + 1);
assert.ok(improve.some((s) => s.outcome === "lower") && preset.steps[r[3][1]].stale.length === 1);
check(EDGES);

// Random weights in the range the page allows (seeded).
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let t = 0; t < 400; t++) check(EDGES.map(([a, b]) => [a, b, W_MIN + Math.floor(rand() * (W_MAX - W_MIN + 1))]));
assert.ok(QUEUE_MAX <= EDGES.length, "the queue never holds more entries than the drawing has room for");

// A real tool: networkx's Dijkstra on the preset, from every source. Skipped with a message when networkx is missing.
let nx = "";
try {
  nx = execFileSync("python3", ["-c", `
import json, networkx as nx
G = nx.Graph()
G.add_weighted_edges_from(${JSON.stringify(EDGES)})
print(json.dumps([[nx.single_source_dijkstra_path_length(G, s)[v] for v in range(${NODES.length})] for s in range(${NODES.length})]))
`], { stdio: ["ignore", "pipe", "ignore"] }).toString();
} catch {
  console.log("networkx not found: the networkx check is skipped");
}
if (nx) JSON.parse(nx).forEach((row, s) => assert.deepEqual(dijkstra(NODES.length, EDGES, s).d, row, "matches networkx"));

if (import.meta.url === `file://${process.argv[1]}`) {
  const E = (i) => `${NODES[preset.entries[i].v]}${preset.entries[i].k}`;
  for (const [i, s] of preset.steps.entries()) {
    const dd = s.d.map((x, k) => `${NODES[k]}${x ?? "∞"}${s.done[k] ? "*" : ""}`).join(" ");
    const what = s.kind === "relax" ? `relax ${NODES[s.u]}-${NODES[s.v]} ${s.d[s.u]}+${s.w}=${s.cand} vs ${s.before ?? "∞"} ${s.outcome}` : `${s.kind} ${NODES[s.u]}`;
    const q = s.queue.map((id) => (s.stale.includes(id) ? `~${E(id)}~` : E(id))).join(" ");
    console.log(String(i).padStart(2), `L${codeLine(s) + 1}`, what.padEnd(32), dd, " Q:", q);
  }
  console.log("ranges", JSON.stringify(sceneRanges(preset.steps)), "queue max", QUEUE_MAX);
  console.log("model ok");
}
