// Gradient descent on one weight. Pure: every number the figure prints comes from here.
// Loss L(w) = (w - 3)^2, slope L'(w) = 2(w - 3), update w <- w - eta * L'(w), start w = 1.
// The runs are computed in full precision and only printed rounded (a converging process: rounding each
// step could stop it early at a false w = 3.000).
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The unfold kit, found by its install path (set UNFOLD_DIR to use another checkout).
export const UNFOLD_DIR = process.env.UNFOLD_DIR ?? join(homedir(), ".claude", "skills", "unfold");
export const u = await import(pathToFileURL(join(UNFOLD_DIR, "kit", "concept-kit.mjs")).href);
const { fmt } = u;

export const TARGET = 3;
export const W0 = 1;
export const STEPS = 6;
export const loss = (w) => (w - TARGET) ** 2;
export const grad = (w) => 2 * (w - TARGET);

// eta = k / 20 for k = 1..21 (0.05 to 1.05). k/20 keeps 0.25 exact in binary.
export const ETAS = Array.from({ length: 21 }, (_, i) => (i + 1) / 20);
export const PRESET = { small: 0.05, right: 0.25, big: 1.05 };

export function run(eta) {
  const rows = [];
  let w = W0;
  for (let t = 0; t <= STEPS; t++) {
    const g = grad(w);
    rows.push({ t, w, g, step: -eta * g, L: loss(w), gap: w - TARGET });
    w = w - eta * g;
  }
  return rows;
}

// Printed form. 3 places, but a value that is not exactly at its limit never prints as the limit:
// w near 3 gets more places, and a tiny slope, step or loss switches to e-notation.
export function wText(w) {
  let places = 3;
  while (w !== TARGET && Number(w.toFixed(places)) === TARGET && places < 10) places++;
  return fmt(w, places);
}
export function numText(v) {
  if (v === 0 || Math.abs(v) >= 0.0005) return fmt(v, 3);
  return v.toExponential(1).replace("-", "−").replace("e-", "e−");
}
export const rowText = (r) => ({ w: wText(r.w), g: numText(r.g), step: numText(r.step), L: numText(r.L), gap: numText(r.gap) });

// What happens to the gap w - 3: each step multiplies it by 1 - 2*eta.
export const factor = (eta) => 1 - 2 * eta;
export function verdict(eta) {
  const f = factor(eta);
  if (f > 0) return "moves toward 3 from one side";
  if (Math.abs(f) < 1e-12) return "lands on 3 in one step";
  if (f > -1) return "jumps past 3, but each gap is smaller";
  if (Math.abs(f + 1) < 1e-12) return "bounces between 1 and 5 forever";
  return "jumps past 3 and lands further away each time";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const close = (a, b) => Math.abs(a - b) < 1e-12;
  const ok = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  const right = run(PRESET.right);
  ok(right.map((r) => r.w).join() === [1, 2, 2.5, 2.75, 2.875, 2.9375, 2.96875].join(), "eta 0.25 halves the gap");
  const small = run(PRESET.small);
  ok(close(small[1].w, 1.2) && close(small[2].w, 1.38) && close(small[3].w, 1.542), "eta 0.05 first steps");
  const big = run(PRESET.big);
  ok(close(big[1].w, 5.2) && close(big[2].w, 0.58), "eta 1.05 first steps");

  for (const [name, rows, dir] of [["small", small, -1], ["right", right, -1], ["big", big, 1]])
    rows.slice(1).forEach((r, i) => ok(Math.sign(r.L - rows[i].L) === dir, `${name}: loss ${dir < 0 ? "falls" : "grows"} every step`));
  ok(run(1.0).every((r) => close(r.L, 4)), "eta 1.0 keeps the loss at 4");

  // The printed path never stops before the exact one: no printed 3 / 0 unless the exact value is 3 / 0.
  for (const eta of ETAS)
    for (const r of run(eta)) {
      const p = rowText(r);
      ok(Number(p.w) !== TARGET || r.w === TARGET, `eta ${eta} t ${r.t}: w ${r.w} prints as 3`);
      for (const k of ["g", "step", "L"]) ok(Number(p[k].replace("−", "-")) !== 0 || r[k] === 0, `eta ${eta} t ${r.t}: ${k} prints as 0`);
      ok(p.w.length <= 9, `eta ${eta}: w text fits its cell (${p.w})`);
      ok(Math.abs(r.w - 3) <= 4 && r.L <= 13, `eta ${eta}: stays on the chart`);
    }
  ok(close(run(0.5)[1].w, 3), "eta 0.5 lands on 3 in one step");

  for (const [name, eta] of Object.entries(PRESET)) {
    console.log(`\neta = ${eta} (${name}), gap x ${fmt(factor(eta), 2)} per step: ${verdict(eta)}`);
    console.log("t   w          L'(w)      -eta*L'    L(w)");
    for (const r of run(eta)) {
      const p = rowText(r);
      console.log(`${r.t}   ${p.w.padEnd(10)} ${p.g.padEnd(10)} ${p.step.padEnd(10)} ${p.L}`);
    }
  }
  console.log("\nmodel ok");
}
