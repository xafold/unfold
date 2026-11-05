// Truth model: Dijkstra's algorithm on a small undirected weighted graph, recorded one step at a time.
// A step is "init", "pop" (take the closest unvisited node, its distance is final) or "relax" (one edge).
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

// d holds null for infinity, so a step survives JSON.
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
  d[source] = 0;
  // The priority queue: unvisited nodes with a finite distance, smallest first, ties by name.
  const queue = () => d.map((x, i) => i).filter((i) => !done[i] && d[i] !== null).sort((i, j) => d[i] - d[j] || i - j);
  const snap = (extra) => ({ ...extra, d: d.slice(), prev: prev.slice(), done: done.slice(), queue: queue() });
  const steps = [snap({ kind: "init", u: source })];
  for (;;) {
    const q = queue();
    if (!q.length) break;
    const u = q[0];
    done[u] = true;
    steps.push(snap({ kind: "pop", u }));
    for (const { v, w, e } of nbrs[u]) {
      if (done[v]) continue;
      const before = d[v];
      const cand = d[u] + w;
      const outcome = before === null ? "set" : cand < before ? "lower" : "keep";
      if (outcome !== "keep") {
        d[v] = cand;
        prev[v] = u;
      }
      steps.push(snap({ kind: "relax", u, v, w, e, before, cand, outcome }));
    }
  }
  return { steps, d: d.slice(), prev: prev.slice() };
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

function check(edges) {
  const n = NODES.length;
  const D = allPairs(n, edges);
  for (let s = 0; s < n; s++) {
    const { steps, d, prev } = dijkstra(n, edges, s);
    assert.deepEqual(d, D[s], "distances match Floyd-Warshall");
    assert.equal(steps.length, 1 + n + edges.length, "one init, one pop per node, one relax per edge");
    const pops = steps.filter((x) => x.kind === "pop");
    pops.forEach((p, i) => {
      assert.equal(p.d[p.u], d[p.u], "a popped distance is final");
      if (i) assert.ok(p.d[p.u] >= pops[i - 1].d[pops[i - 1].u], "pops come in order of distance");
    });
    const [, r1, , r3] = sceneRanges(steps);
    assert.ok(r1[1] > r1[0] && r3[1] >= r3[0], "scenes 2 and 4 hold at least one relax");
    for (let v = 0; v < n; v++) {
      if (v === s) continue;
      const [a, b, w] = edges.find(([a, b]) => (a === v && b === prev[v]) || (b === v && a === prev[v]));
      assert.equal(d[prev[v]] + w, d[v], "d(v) = d(prev v) + w");
      assert.ok(a !== b);
    }
  }
}

const preset = dijkstra(NODES.length, EDGES, SOURCE);
assert.deepEqual(preset.d, [0, 3, 2, 7, 9, 12]);
assert.deepEqual(preset.prev.map((p) => NODES[p] ?? "-"), ["-", "C", "A", "C", "D", "E"]);
const outcomes = preset.steps.filter((s) => s.kind === "relax").map((s) => s.outcome);
assert.ok(outcomes.includes("lower") && outcomes.includes("keep"), "the preset shows a lowered and a kept distance");
check(EDGES);

// Random weights in the range the page allows (seeded).
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let t = 0; t < 400; t++) check(EDGES.map(([a, b]) => [a, b, W_MIN + Math.floor(rand() * (W_MAX - W_MIN + 1))]));

// A real tool: networkx's Dijkstra on the preset, from every source.
const nx = execFileSync("python3", ["-c", `
import json, networkx as nx
G = nx.Graph()
G.add_weighted_edges_from(${JSON.stringify(EDGES)})
print(json.dumps([[nx.single_source_dijkstra_path_length(G, s)[v] for v in range(${NODES.length})] for s in range(${NODES.length})]))
`]).toString();
JSON.parse(nx).forEach((row, s) => assert.deepEqual(dijkstra(NODES.length, EDGES, s).d, row, "matches networkx"));

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [i, s] of preset.steps.entries()) {
    const dd = s.d.map((x, k) => `${NODES[k]}${x ?? "∞"}${s.done[k] ? "*" : ""}`).join(" ");
    const what = s.kind === "relax" ? `relax ${NODES[s.u]}-${NODES[s.v]} ${s.d[s.u]}+${s.w}=${s.cand} vs ${s.before ?? "∞"} ${s.outcome}` : `${s.kind} ${NODES[s.u]}`;
    console.log(String(i).padStart(2), what.padEnd(34), dd, " Q:", s.queue.map((k) => NODES[k]).join(""));
  }
  console.log("ranges", JSON.stringify(sceneRanges(preset.steps)));
  console.log("model ok");
}
