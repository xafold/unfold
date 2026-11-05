// Gradient descent on L(w) = (w - 3)^2, from w0 = 0, for three learning rates.
// Every value is rounded to 2 decimals, and the next step is computed from the rounded values,
// so each row of the table can be redone by hand.
import { fileURLToPath } from "node:url";

export const TARGET = 3;
export const W0 = 0;
export const STEPS = 8;
export const RATES = [
  { eta: 0.05, name: "too small" },
  { eta: 0.3, name: "about right" },
  { eta: 1.05, name: "too big" },
];

// Round half away from zero, so -0.255 becomes -0.26 (Math.round alone would give -0.25).
export const r2 = (v) => {
  const r = (Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-9)) / 100;
  return r === 0 ? 0 : r;
};
export const loss = (w) => r2((w - TARGET) ** 2);
export const slope = (w) => r2(2 * (w - TARGET));

// One run: rows t = 0..STEPS of { t, w, g (= L'(w)), step (= eta * g), L }.
export function run(eta) {
  const rows = [];
  let w = W0;
  for (let t = 0; t <= STEPS; t++) {
    const g = slope(w);
    const step = r2(eta * g);
    rows.push({ t, w, g, step, L: loss(w) });
    w = r2(w - step);
  }
  return rows;
}

export const RUNS = RATES.map((r) => ({ ...r, factor: r2(1 - 2 * r.eta), rows: run(r.eta) }));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const assert = (ok, msg) => {
    if (!ok) throw new Error(msg);
  };
  for (const r of RUNS) {
    console.log(`eta = ${r.eta} (${r.name}), factor 1 - 2eta = ${r.factor}`);
    console.table(r.rows);
    r.rows.forEach((row, t) => {
      assert(row.L === r2((row.w - 3) ** 2), "loss");
      assert(row.g === r2(2 * (row.w - 3)), "slope");
      if (t) assert(row.w === r2(r.rows[t - 1].w - r.rows[t - 1].step), "update");
    });
  }
  const [small, right, big] = RUNS.map((r) => r.rows.at(-1));
  assert(right.w === 3 && right.L === 0, "about right reaches the minimum");
  assert(small.L > 1, "too small is still far after 8 steps");
  assert(big.L > 40, "too big diverges");
  assert(RUNS[2].rows.every((row, t) => !t || Math.abs(row.w - 3) > Math.abs(RUNS[2].rows[t - 1].w - 3)), "too big grows each step");
  assert(r2(0.05 * -5.1) === -0.26, "round half away from zero");
  // The claims in the notes table.
  assert(run(0.5)[1].w === 3, "eta = 0.5 lands in one step");
  assert(run(1).every((row, t) => row.w === (t % 2 ? 6 : 0)), "eta = 1 bounces between 0 and 6");
  const zig = run(0.9);
  assert(zig.every((row, t) => !t || (row.w - 3) * (zig[t - 1].w - 3) < 0) && zig.at(-1).L < zig[0].L, "0.5 < eta < 1 zigzags and converges");
  console.log("model ok");
}
