// One causal self-attention head on a 6-token sentence. Pure: every number the figure shows comes from here.
// The weights are small and set by hand so the pattern is easy to read. The arithmetic is the real thing.

export const TOKENS = ["the", "cat", "sat", "on", "the", "mat"];
export const D_MODEL = 4;
export const D_K = 3;

// Token embedding plus a small position term, so the two "the" rows differ.
export const X = [
  [0.2, -0.3, 0.9, 0.0],
  [0.9, 0.1, -0.2, 0.3],
  [-0.2, 0.9, 0.1, -0.3],
  [0.0, -0.2, 0.3, 0.9],
  [0.3, -0.3, 0.8, 0.2],
  [0.8, -0.1, 0.0, 0.4],
];

export const W_Q = [
  [0.2, 0.4, 0.6],
  [2.0, -0.3, 0.4],
  [-0.4, 1.4, 0.2],
  [0.6, -0.2, 1.5],
];
export const W_K = [
  [2.0, 0.1, 0.5],
  [-0.2, 0.3, 1.1],
  [0.0, 1.0, -0.4],
  [-0.3, -0.5, 0.9],
];
export const W_V = [
  [0.9, 0.0, -0.3],
  [-0.2, 1.0, 0.1],
  [0.1, -0.4, 0.8],
  [0.3, 0.6, 0.6],
];

// Named function declarations, so build.mjs can ship them into the page (kit modelScript): a reader's own X
// is recomputed in the page by this same code.
export function matmul(a, b) { return a.map((row) => b[0].map((_, j) => row.reduce((sum, v, k) => sum + v * b[k][j], 0))); }
export function transpose(m) { return m[0].map((_, j) => m.map((row) => row[j])); }
export function round(m, places) { return m.map((row) => row.map((v) => (v === -Infinity ? v : Math.round(v * 10 ** places) / 10 ** places))); }
export function masked(i, j) { return j > i; }
export function softmax(row) {
  const top = Math.max(...row);
  const e = row.map((v) => (v === -Infinity ? 0 : Math.exp(v - top)));
  const total = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / total);
}
export const SCALE = Math.sqrt(D_K);

// The whole head for one input X. It computes from the rounded values it prints, so the arithmetic on screen checks out by hand.
export function head(X) {
  const Q = round(matmul(X, W_Q), 1);
  const K = round(matmul(X, W_K), 1);
  const V = round(matmul(X, W_V), 1);
  const S = round(matmul(Q, transpose(K)).map((row, i) => row.map((v, j) => (masked(i, j) ? -Infinity : v / SCALE))), 1);
  const A = round(S.map(softmax), 2);
  return { Q, K, V, S, A, O: round(matmul(A, V), 1) };
}
export const { Q, K, V, S, A, O } = head(X);

export const strongest = (i) => A[i].reduce((best, v, j) => (v > A[i][best] ? j : best), 0);

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  const check = (A, what) => {
    A.forEach((row, i) => {
      // Each printed weight is rounded to 0.01, so a printed row can miss 1 by up to 0.005 per cell.
      assert(Math.abs(row.reduce((a, b) => a + b, 0) - 1) <= 0.005 * row.length + 1e-9, `${what}: row ${i} of A sums to 1`);
      row.forEach((v, j) => masked(i, j) && assert(v === 0, `${what}: A[${i}][${j}] is masked to 0`));
    });
    assert(A[0][0] === 1, `${what}: the first token can only attend to itself`);
  };
  check(A, "model X");
  // The page lets the reader edit X in [-1, 1] at one decimal. The same rules must hold for any such X.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let n = 0; n < 200; n++) check(head(X.map((row) => row.map(() => Math.round(rand() * 10) / 10))).A, `random X ${n}`);
  const table = (name, m) => console.log(name + "\n" + m.map((r) => r.map((v) => String(v).padStart(6)).join("")).join("\n"));
  table("Q", Q); table("K", K); table("V", V); table("S", S); table("A", A); table("O", O);
  console.log(TOKENS.map((t, i) => `${t} -> ${TOKENS[strongest(i)]} (${A[i][strongest(i)]})`).join("\n"));
  console.log("model ok");
}
