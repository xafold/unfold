// Truth model: binary search on one sorted array of 16 values, traced step by step.
// Every pointer, compare, range size and count on the page comes from search() below.
import assert from "node:assert/strict";

export const A = [3, 8, 12, 17, 21, 26, 30, 34, 37, 41, 45, 52, 58, 63, 71, 79];
export const TARGET = 37;
export const PRESETS = [37, 79, 40];
export const T_MIN = 0;
export const T_MAX = 99;

// The trace. Step 0 is the start. Each loop pass makes a "compare" step, and a "narrow" step if it did not find t.
export function search(a, t) {
  const steps = [];
  const rows = [];
  let lo = 0;
  let hi = a.length - 1;
  let k = 0;
  steps.push({ phase: "start", lo, hi, mid: -1, k, say: "low 0, high " + hi + ": all " + a.length + " cells can hold " + t });
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const v = a[mid];
    k += 1;
    rows.push({ lo, hi, mid, size: hi - lo + 1, step: steps.length });
    const cmp = v < t ? "<" : v > t ? ">" : "=";
    if (cmp === "=") {
      steps.push({ phase: "found", lo, hi, mid, k, cmp, say: "compare " + k + ": a[" + mid + "] = " + v + " is the target. Found after " + k + " compares" });
      return { steps, rows, index: mid, compares: k };
    }
    steps.push({ phase: "compare", lo, hi, mid, k, cmp, say: "compare " + k + ": mid = ⌊(" + lo + "+" + hi + ")/2⌋ = " + mid + ", a[" + mid + "] = " + v + " " + cmp + " " + t });
    if (cmp === "<") lo = mid + 1;
    else hi = mid - 1;
    const left = Math.max(0, hi - lo + 1);
    const move = cmp === "<" ? "low = " + mid + "+1 = " + lo : "high = " + mid + "−1 = " + hi;
    const end = lo > hi ? ". low > high: " + t + " is not in the array" : ": " + left + " cell" + (left === 1 ? "" : "s") + " left";
    steps.push({ phase: lo > hi ? "missing" : "narrow", lo, hi, mid, k, cmp, say: move + end });
  }
  return { steps, rows, index: -1, compares: k };
}

// Most compares any target can need in n sorted cells: the bigger half after a miss has floor(n/2) cells.
export function worst(n) {
  return n === 0 ? 0 : 1 + worst(Math.floor(n / 2));
}

export const SCALE = [16, 1000, 1e6, 1e9].map((n) => ({ n, binary: worst(n), linear: n }));

// The loop as the notes print it. It is run below and must agree with search() on every target.
export const CODE = `function binarySearch(a, t) {
  let low = 0, high = a.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (a[mid] === t) return mid;
    if (a[mid] < t) low = mid + 1;
    else high = mid - 1;
  }
  return -1;
}`;

// ---- asserts ----
const plain = new Function(CODE + "\nreturn binarySearch;")();
for (let i = 1; i < A.length; i++) assert.ok(A[i - 1] < A[i], "array is sorted with distinct values");
for (let t = T_MIN; t <= T_MAX; t++) {
  const r = search(A, t);
  assert.equal(r.index, A.indexOf(t), "finds exactly the cells that hold t");
  assert.equal(plain(A, t), r.index, "printed code agrees with the trace");
  assert.ok(r.compares <= Math.floor(Math.log2(A.length)) + 1, "at most floor(log2 n)+1 compares");
  for (let j = 1; j < r.rows.length; j++) assert.ok(r.rows[j].size <= Math.floor(r.rows[j - 1].size / 2), "each compare leaves at most half");
  assert.ok(r.steps.length <= 11, "the ladder has room for every row");
}
assert.equal(Math.max(...Array.from({ length: 100 }, (_, t) => search(A, t).compares)), worst(16), "some target needs the worst case");
// Larger arrays: the bound holds and is reached, and worst(n) = floor(log2 n) + 1.
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
for (let trial = 0; trial < 300; trial++) {
  const n = 1 + Math.floor(rand() * 5000);
  const a = Array.from({ length: n }, (_, i) => 2 * i);
  const t = Math.floor(rand() * (2 * n + 2)) - 1;
  const r = search(a, t);
  assert.equal(r.index, t >= 0 && t % 2 === 0 && t < 2 * n ? t / 2 : -1);
  assert.ok(r.compares <= worst(n));
  assert.equal(worst(n), Math.floor(Math.log2(n)) + 1);
  assert.equal(search(a, 2 * n + 5).compares, worst(n), "a target above every value takes the worst case");
}
assert.deepEqual(SCALE.map((s) => s.binary), [5, 10, 20, 30]);
for (const t of PRESETS) assert.ok(t >= T_MIN && t <= T_MAX);
assert.deepEqual(PRESETS.map((t) => [search(A, t).index, search(A, t).compares]), [[8, 4], [15, 5], [-1, 4]]);

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const t of PRESETS) {
    console.log("target", t);
    for (const s of search(A, t).steps) console.log("  ", s.phase.padEnd(8), s.say);
  }
  console.log("scale", SCALE.map((s) => `${s.n}:${s.binary}`).join(" "));
  console.log("model ok");
}
