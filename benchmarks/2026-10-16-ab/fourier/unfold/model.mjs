// Truth model: the Fourier sine series of a square wave of period 2π and height ±1.
// f(x) = +1 on (0, π), −1 on (−π, 0). b_k = (1/π)∫ f(x) sin(kx) dx = 4/(πk) for odd k, 0 for even k.
// Every number in the figure comes from these functions. The page ships them with modelScript.
import assert from "node:assert/strict";

export function square(x) {
  const s = Math.sin(x);
  return Math.abs(s) < 1e-12 ? 0 : Math.sign(s);
}

// Closed form of the coefficient. The model checks it against a numeric integral below.
export function coef(k) {
  return k % 2 ? 4 / (Math.PI * k) : 0;
}

// The partial sum with N nonzero terms: k = 1, 3, …, 2N − 1.
export function partial(N, x) {
  let s = 0;
  for (let j = 0; j < N; j++) s += coef(2 * j + 1) * Math.sin((2 * j + 1) * x);
  return s;
}

// First peak right of the jump at 0. For N odd terms it sits at x = π/(2N) (the derivative is sin(2Nx)/sin(x) · 2/π).
export function peakX(N) {
  return Math.PI / (2 * N);
}

// Root-mean-square error over one period, by Parseval: mean(f²) = 1, mean(S_N²) = Σ b_k² / 2.
export function rms(N) {
  let e = 1;
  for (let j = 0; j < N; j++) e -= coef(2 * j + 1) ** 2 / 2;
  return Math.sqrt(Math.max(0, e));
}

export function round2(v) {
  return Math.round(v * 100) / 100;
}

// The readout's arithmetic: each term b_k · sin(kx) rounded to 2 places, and the sum of the rounded terms.
export function termsAt(N, x) {
  const terms = [];
  for (let j = 0; j < N; j++) {
    const k = 2 * j + 1;
    const b = round2(coef(k));
    const s = round2(Math.sin(k * x));
    terms.push({ k, b, s, v: round2(b * s) });
  }
  return { terms, sum: round2(terms.reduce((a, t) => a + t.v, 0)) };
}

// The coefficient as an area: f(x)·sin(kx) over one period, split into the part above and below the axis.
export function areas(k, n = 6000) {
  const h = (2 * Math.PI) / n;
  let up = 0;
  let down = 0;
  for (let i = 0; i < n; i++) {
    const x = -Math.PI + (i + 0.5) * h;
    const v = square(x) * Math.sin(k * x) * h;
    if (v > 0) up += v;
    else down -= v;
  }
  return { up, down, net: up - down, b: (up - down) / Math.PI };
}

// Other waves for the notes table, as numeric integrals (checked against their closed forms below).
const project = (g, k, n = 20000) => {
  const h = (2 * Math.PI) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x = -Math.PI + (i + 0.5) * h;
    s += g(x) * Math.sin(k * x) * h;
  }
  return s / Math.PI;
};
const saw = (x) => x / Math.PI; // on (−π, π)
const tri = (x) => (Math.abs(x) <= Math.PI / 2 ? (2 * x) / Math.PI : Math.sign(x) * (2 - (2 * Math.abs(x)) / Math.PI));

export const NMAX = 25;
export const KPICK = [1, 2, 3, 4, 5, 6];

// ---- checks ----
for (let k = 1; k <= 12; k++) {
  const a = areas(k);
  assert.ok(Math.abs(a.b - coef(k)) < 1e-6, `b_${k}`);
}
// The sum is 0 at the jump (the midpoint of −1 and +1) and odd in x, for every N.
for (let N = 1; N <= 200; N++) {
  assert.ok(Math.abs(partial(N, 0)) < 1e-12);
  assert.ok(Math.abs(partial(N, 0.7) + partial(N, -0.7)) < 1e-12);
}
// peakX is the first maximum: scan (0, π/2) finely.
for (const N of [1, 2, 3, 5, 10, 25, 100]) {
  let best = 0;
  let bx = 0;
  const end = Math.min(Math.PI / 2, 3 * peakX(N));
  for (let i = 1; i <= 20000; i++) {
    const x = (end * i) / 20000;
    const v = partial(N, x);
    if (v > best) (best = v), (bx = x);
    if (v < best - 1e-3) break;
  }
  assert.ok(Math.abs(bx - peakX(N)) < end / 5000, `peak x N=${N}`);
}
// Gibbs: the peak falls toward (2/π)·Si(π) = 1.1790 and never goes below it; it never reaches 1.
const Si = (() => {
  let s = 0;
  const n = 100000;
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) * Math.PI) / n;
    s += (Math.sin(t) / t) * (Math.PI / n);
  }
  return s;
})();
export const GIBBS = (2 / Math.PI) * Si;
assert.ok(Math.abs(GIBBS - 1.17898) < 1e-4);
let last = Infinity;
for (let N = 1; N <= 400; N++) {
  const p = partial(N, peakX(N));
  assert.ok(p < last + 1e-12 && p > GIBBS, `peak N=${N}`);
  last = p;
}
// The rms error goes to 0 while the peak does not: Parseval checked against a numeric mean.
for (const N of [1, 3, 10]) {
  const n = 40000;
  let e = 0;
  for (let i = 0; i < n; i++) {
    const x = -Math.PI + ((i + 0.5) * 2 * Math.PI) / n;
    e += (square(x) - partial(N, x)) ** 2 / n;
  }
  assert.ok(Math.abs(Math.sqrt(e) - rms(N)) < 2e-3, `rms N=${N}`);
}
assert.ok(rms(NMAX) < rms(1) / 4);
// Other waves: sawtooth 2(−1)^(k+1)/(πk), triangle 8/(π²k²)·(−1)^((k−1)/2) for odd k.
for (let k = 1; k <= 7; k++) {
  assert.ok(Math.abs(project(saw, k) - (2 * (-1) ** (k + 1)) / (Math.PI * k)) < 1e-4, `saw ${k}`);
  const t = k % 2 ? (8 / (Math.PI ** 2 * k * k)) * (-1) ** ((k - 1) / 2) : 0;
  assert.ok(Math.abs(project(tri, k) - t) < 1e-4, `tri ${k}`);
}
// The readout at the preset probe x = π/2 adds up by hand.
assert.equal(termsAt(2, Math.PI / 2).sum, 0.85);

export const TABLE = [1, 2, 3, 5, 10, 25, 100].map((N) => ({ N, x: peakX(N), peak: partial(N, peakX(N)), rms: rms(N) }));
export const OTHER = [1, 2, 3, 4, 5].map((k) => ({ k, square: coef(k), saw: project(saw, k), tri: project(tri, k) }));

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log("k  b_k    area up  area down");
  for (const k of KPICK) {
    const a = areas(k);
    console.log(k, coef(k).toFixed(4), a.up.toFixed(3), a.down.toFixed(3));
  }
  console.log("N  peak x  peak S_N  rms");
  for (const r of TABLE) console.log(r.N, r.x.toFixed(4), r.peak.toFixed(4), r.rms.toFixed(4));
  console.log("Gibbs limit", GIBBS.toFixed(5));
  console.log("model ok");
}
