// Truth model: binary search on a sorted array of 16 numbers, recorded one step at a time.
// A step is "init" (lo, hi set), "probe" (mid picked and compared), "cut" (lo or hi moved),
// "found" (return mid) or "empty" (lo > hi, return -1).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

export const N = 16;
export const T_MIN = 0;
export const T_MAX = 99;
// Chosen by hand: distinct two-digit values, so every cell fits two digits.
export const A = [3, 8, 12, 17, 21, 26, 30, 35, 41, 44, 50, 57, 63, 68, 74, 79];
// Preset target: index 10 takes 4 probes and cuts both ways (right, left, right, found).
export const T = 50;

// The code panel, line for line. model.mjs runs exactly these lines with python3.
export const CODE = [
  "def search(a, t):",
  "    lo, hi = 0, len(a) - 1",
  "    while lo <= hi:",
  "        mid = (lo + hi) // 2",
  "        if a[mid] == t:",
  "            return mid",
  "        if a[mid] < t:",
  "            lo = mid + 1",
  "        else:",
  "            hi = mid - 1",
  "    return -1",
];

// The run as steps. `line` is the 0-based code line the step runs. `probes` counts probes so far.
export function search(a, t) {
  let lo = 0;
  let hi = a.length - 1;
  let probes = 0;
  const steps = [{ kind: "init", lo, hi, mid: -1, probes, line: 1 }];
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const v = a[mid];
    probes++;
    const rel = v === t ? "=" : v < t ? "<" : ">";
    steps.push({ kind: "probe", lo, hi, mid, v, rel, probes, line: 3 });
    if (rel === "=") {
      steps.push({ kind: "found", lo, hi, mid, v, rel, probes, line: 5 });
      return steps;
    }
    // The cut keeps the old range too, so the page can label the ruled-out part.
    const from = [lo, hi];
    if (rel === "<") lo = mid + 1;
    else hi = mid - 1;
    steps.push({ kind: "cut", lo, hi, mid, v, rel, from, probes, line: rel === "<" ? 7 : 9 });
  }
  steps.push({ kind: "empty", lo, hi, mid: -1, probes, line: 10 });
  return steps;
}

// The answer of a run: the index found, or -1.
export function answer(steps) {
  const last = steps[steps.length - 1];
  return last.kind === "found" ? last.mid : -1;
}

// The ladder: one row per range the run searched, top row first. Row k is the range left after k probes.
// A row gets its mid when that probe runs. A run that does not find t ends with a row of size 0.
export function ladder(steps, s) {
  const rows = [];
  for (const x of steps.slice(0, s + 1)) {
    if (x.kind === "init" || x.kind === "cut") rows.push({ lo: x.lo, hi: x.hi, mid: -1, size: Math.max(0, x.hi - x.lo + 1) });
    if (x.kind === "probe") rows[rows.length - 1].mid = x.mid;
  }
  return rows;
}

// Worst-case probes for n sorted values: each probe leaves at most floor(c / 2) of c candidates.
// It equals floor(log2 n) + 1, the number of binary digits of n.
export function maxProbes(n) {
  let k = 0;
  for (let c = n; c > 0; c = Math.floor(c / 2)) k++;
  return k;
}

// Scene ranges (first and last step of each scene), from the run: start, first probe, first result, the rest.
// The tree and the scale scenes show the last step. A short run gives the later scenes its last step.
export function sceneRanges(steps) {
  const last = steps.length - 1;
  const c = (i) => Math.min(i, last);
  return [[0, 0], [c(1), c(1)], [c(2), c(2)], [c(3), last], [last, last], [last, last]];
}

// A new array of N distinct sorted values in 1..98, from a seed (the "new numbers" button).
export function makeArray(seed) {
  let s = seed;
  const picked = new Set();
  while (picked.size < N) {
    s = (s * 1103515245 + 12345) % 2147483648;
    picked.add(1 + (s % 98));
  }
  return [...picked].sort((x, y) => x - y);
}

// The implicit tree: the probe order turns the array into a balanced tree. depth[i] = probes to find a[i] − 1.
export function treeOf(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  const depth = [];
  const parent = [];
  for (let i = 0; i < n; i++) {
    const mids = search(a, i).filter((x) => x.kind === "probe").map((x) => x.mid);
    depth.push(mids.length - 1);
    parent.push(mids.length > 1 ? mids[mids.length - 2] : -1);
  }
  return { depth, parent };
}

// ---- Checks ----
const runs = [];
function check(a) {
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1] < a[i], "sorted, distinct");
  for (let t = T_MIN; t <= T_MAX; t++) {
    const steps = search(a, t);
    const at = answer(steps);
    assert.equal(at, a.indexOf(t), "binary search agrees with a linear scan");
    const probes = steps[steps.length - 1].probes;
    assert.ok(probes <= maxProbes(a.length), "never more than floor(log2 n) + 1 probes");
    ladder(steps, steps.length - 1).forEach((row, k) => assert.ok(row.size <= Math.floor(a.length / 2 ** k), "after k probes at most floor(n / 2^k) are left"));
    for (const x of steps) if (x.lo <= x.hi) for (let i = 0; i < a.length; i++) if (a[i] === t) assert.ok(i >= x.lo && i <= x.hi, "the target never leaves [lo, hi]");
    assert.ok(ladder(steps, steps.length - 1).length <= maxProbes(a.length) + 1, "the ladder has room for every row");
    const r = sceneRanges(steps);
    r.forEach(([p, q]) => assert.ok(p <= q && q < steps.length));
    runs.push({ a, t, at });
  }
}
check(A);
for (let seed = 1; seed <= 300; seed++) check(makeArray(seed));

const preset = search(A, T);
assert.equal(answer(preset), 10);
assert.deepEqual(preset.filter((x) => x.kind === "cut").map((x) => x.rel), ["<", ">", "<"], "the preset cuts both ways");
assert.equal(preset.filter((x) => x.kind === "probe").length, 4);

// The worst case is measured, not only the formula: every target, present or absent, for n = 1..600.
for (let n = 1; n <= 600; n++) {
  const a = Array.from({ length: n }, (_, i) => 2 * i + 1);
  let worst = 0;
  for (let t = 0; t <= 2 * n + 1; t++) worst = Math.max(worst, search(a, t).at(-1).probes);
  assert.equal(worst, maxProbes(n), "worst case = floor(log2 n) + 1");
  assert.equal(maxProbes(n), Math.floor(Math.log2(n)) + 1);
}
// Big n: an implicit array a[i] = 2i (never stored). A target past the end takes the worst path.
export const SCALE = [16, 1000, 1e6, 1e9];
export const SCALE_PROBES = SCALE.map((n) => {
  const a = new Proxy({}, { get: (_, k) => (k === "length" ? n : 2 * Number(k)) });
  const probes = search(a, 2 * n).at(-1).probes;
  assert.equal(probes, maxProbes(n));
  return probes;
});
assert.deepEqual(SCALE_PROBES, [5, 10, 20, 30]);

const tree = treeOf(N);
export const TREE = tree;
assert.deepEqual(tree.depth.map((d, i) => d + 1), tree.depth.map((_, i) => search(A, A[i]).at(-1).probes));
assert.equal(Math.max(...tree.depth) + 1, maxProbes(N));

// The real tool: python3 runs the code panel's exact lines, and bisect gives an independent answer.
let py = "";
const arrays = [A, makeArray(1), makeArray(2), makeArray(3)];
try {
  py = execFileSync("python3", ["-c", `${CODE.join("\n")}
import bisect, json
arrays = json.loads('${JSON.stringify(arrays)}')
out = []
for a in arrays:
    row = []
    for t in range(${T_MIN}, ${T_MAX + 1}):
        i = bisect.bisect_left(a, t)
        b = i if i < len(a) and a[i] == t else -1
        row.append([search(a, t), b])
    out.append(row)
print(json.dumps(out))
`], { stdio: ["ignore", "pipe", "pipe"] }).toString();
} catch {
  py = "";
  console.log("python3 not found: the python check is skipped");
}
if (py)
  JSON.parse(py).forEach((row, k) =>
    row.forEach(([got, bis], j) => {
      const t = T_MIN + j;
      assert.equal(got, answer(search(arrays[k], t)), "python runs the panel's code to the same index");
      assert.equal(bis, answer(search(arrays[k], t)), "bisect agrees");
    }),
  );

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [i, x] of preset.entries())
    console.log(String(i).padStart(2), `L${x.line + 1}`, x.kind.padEnd(6), `lo=${x.lo} hi=${x.hi}`, x.mid >= 0 ? `mid=${x.mid} a=${x.v} ${x.rel} ${T}` : "");
  console.log("ladder", ladder(preset, preset.length - 1).map((r) => r.size).join(" "));
  console.log("depth", tree.depth.join(" "));
  console.log("scale", SCALE.map((n, i) => `${n}:${SCALE_PROBES[i]}`).join(" "));
  console.log("python check", py ? "ran" : "skipped", "· runs", runs.length);
  console.log("model ok");
}
