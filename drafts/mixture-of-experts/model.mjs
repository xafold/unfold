// One sparse mixture-of-experts layer on a 5-token sentence. Pure: every number the figure shows comes from here.
// The weights are small and set by hand so the pattern is easy to read. The arithmetic is the real thing.
// Row-vector convention: a token is a row x (1×3). Scores h = x·W_R (1×4), one per expert. Expert i gives x·W_E[i].

export const TOKENS = ["is", "7", "+", "2", "odd"];
export const D = 3;
export const E = 4;
export const KS = [1, 2, 4]; // the k values the page offers: top-1, top-2, all 4 (dense)
export const K0 = 2;

export const X = [
  [0.8, 0.1, -0.2],
  [-0.1, 0.9, 0.0],
  [0.0, 0.3, 0.9],
  [0.1, 0.9, 0.0],
  [0.8, 0.6, -0.2],
];

// The router: column j is what expert j looks for.
export const W_R = [
  [2.5, -0.5, 0.0, 0.8],
  [-0.5, 2.5, 0.5, 0.8],
  [-0.5, 0.0, 2.5, 0.8],
];

// Four experts. Each is one 3×3 linear layer here (a real expert is a small two-layer network).
export const W_E = [
  [[0.9, 0.2, -0.4], [0.1, 0.3, 0.0], [-0.3, 0.0, 0.5]],
  [[0.2, -0.5, 0.1], [0.8, 0.6, -0.2], [0.0, 0.3, 0.4]],
  [[0.4, 0.0, 0.3], [-0.2, 0.5, 0.1], [0.1, -0.6, 1.0]],
  [[0.5, 0.5, 0.0], [0.0, 0.5, 0.5], [0.5, 0.0, 0.5]],
];

// Named function declarations, so build.mjs can ship them into the page (kit modelScript).
export function roundTo(v, places) { return Math.round(v * 10 ** places) / 10 ** places; }
export function vecmat(x, W) { return W[0].map((_, j) => x.reduce((sum, v, k) => sum + v * W[k][j], 0)); }
// The k largest scores. A tie goes to the expert with the lower number.
export function topK(h, k) {
  return h.map((v, j) => [v, j]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, k).map(([, j]) => j).sort((a, b) => a - b);
}
export function softmax(row) {
  const top = Math.max(...row);
  const e = row.map((v) => (v === -Infinity ? 0 : Math.exp(v - top)));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / total);
}
// One token through the layer. It computes from the rounded values it prints, so the screen adds up by hand.
// yi[j] is null for an expert that does not run.
export function route(x, k) {
  const h = vecmat(x, W_R).map((v) => roundTo(v, 1));
  const keep = topK(h, k);
  const hk = h.map((v, j) => (keep.includes(j) ? v : -Infinity));
  const g = softmax(hk).map((v) => roundTo(v, 2));
  const yi = W_E.map((W, j) => (keep.includes(j) ? vecmat(x, W).map((v) => roundTo(v, 1)) : null));
  const part = yi.map((row, j) => (row ? row.map((v) => roundTo(g[j] * v, 2)) : null));
  const y = [0, 1, 2].map((c) => roundTo(part.reduce((sum, row) => sum + (row ? row[c] : 0), 0), 2));
  return { h, keep, hk, g, yi, part, y };
}
// Every token. load[j] counts the tokens that run expert j.
export function layer(X, k) {
  const rows = X.map((x) => route(x, k));
  const load = W_E.map((_, j) => rows.filter((r) => r.keep.includes(j)).length);
  return { rows, load, H: rows.map((r) => r.h), HK: rows.map((r) => r.hk), G: rows.map((r) => r.g), Y: rows.map((r) => r.y) };
}
export const L0 = layer(X, K0);

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  const check = (X, k, what) => {
    const L = layer(X, k);
    L.rows.forEach((r, i) => {
      assert(r.keep.length === k, `${what}: token ${i} keeps exactly ${k} experts`);
      // Each printed weight is rounded to 0.01, so a printed row can miss 1 by up to 0.005 per kept expert.
      assert(Math.abs(r.g.reduce((a, b) => a + b, 0) - 1) <= 0.005 * k + 1e-9, `${what}: weights of token ${i} add up to 1`);
      r.g.forEach((v, j) => {
        assert(r.keep.includes(j) || v === 0, `${what}: a dropped expert has weight 0`);
        assert((r.yi[j] === null) === !r.keep.includes(j), `${what}: only kept experts run`);
      });
      const low = Math.min(...r.keep.map((j) => r.h[j]));
      r.h.forEach((v, j) => assert(r.keep.includes(j) || v <= low, `${what}: no dropped score beats a kept score`));
    });
    assert(L.load.reduce((a, b) => a + b, 0) === k * X.length, `${what}: expert runs = k × tokens`);
    return L;
  };
  for (const k of KS) check(X, k, `model X, k=${k}`);
  // The page lets the reader edit x in [-1, 1] at one decimal. The same rules must hold for any such X.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let n = 0; n < 300; n++) check(X.map((row) => row.map(() => Math.round(rand() * 10) / 10)), KS[n % 3], `random X ${n}`);
  // What the narration says about the starting numbers.
  const r7 = L0.rows[1], r2 = L0.rows[3], rodd = L0.rows[4];
  assert(r7.keep.join() === "1,3" && r2.keep.join() === "1,3", `"7" and "2" both keep experts 2 and 4`);
  assert(L0.rows[0].keep.join() === "0,3", `"is" keeps experts 1 and 4`);
  assert(L0.rows[2].keep.join() === "2,3", `"+" keeps experts 3 and 4`);
  assert(rodd.keep.join() === "0,1", `"odd" keeps experts 1 and 2`);
  assert(L0.load.join() === "2,3,1,4", "load per expert at k = 2");
  // No preset token has a tie between a kept and a dropped score, for any offered k.
  for (const k of KS) layer(X, k).rows.forEach((r, i) => assert(Math.min(...r.keep.map((j) => r.h[j])) > Math.max(-9, ...r.h.filter((_, j) => !r.keep.includes(j))), `no tie for token ${i}, k=${k}`));
  const row = (v, p = 1) => v.map((n) => (n === -Infinity ? "-inf" : n.toFixed(p)).padStart(7)).join("");
  for (const k of KS) {
    const L = layer(X, k);
    console.log(`\nk = ${k}   load per expert: ${L.load.join(" ")}`);
    L.rows.forEach((r, i) => {
      console.log(`${TOKENS[i].padEnd(4)} h ${row(r.h)}   g ${row(r.g, 2)}   y ${row(r.y, 2)}`);
      if (k === K0) r.yi.forEach((v, j) => v && console.log(`       E${j + 1} out ${row(v)}  x ${r.g[j].toFixed(2)} = ${row(r.part[j], 2)}`));
    });
  }
  console.log("model ok");
}
