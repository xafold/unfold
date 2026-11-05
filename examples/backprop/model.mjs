// A 2-2-1 network: two inputs, two sigmoid hidden units, one linear output, squared-error loss.
// Every number the figure shows comes from net(). Weights are set by hand so the values stay readable.
// Each step is computed from the rounded (3 places) values of the step before, so the screen adds up by hand.

export const P0 = {
  W: [[0.6, -0.4], [-0.3, 0.8]], // W[j][k]: input k -> hidden j
  b: [0.1, -0.2],
  v: [0.9, -0.5], // hidden j -> output
  c: 0.2,
};
export const X0 = [1.0, 0.5];
export const Y0 = 1.0;
export const ETA0 = 0.2;

export function r3(v) { return Math.round(v * 1000) / 1000 + 0; }
export function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

// Forward and backward pass, rounded per step. g* are gradients of the loss L.
export function net(p, x, y) {
  const z = p.W.map((row, j) => r3(row[0] * x[0] + row[1] * x[1] + p.b[j]));
  const h = z.map((zj) => r3(sigmoid(zj)));
  const yhat = r3(p.v[0] * h[0] + p.v[1] * h[1] + p.c);
  const L = r3(0.5 * (yhat - y) ** 2);
  const gy = r3(yhat - y);
  const gv = h.map((hj) => r3(gy * hj));
  const gc = gy;
  const gh = p.v.map((vj) => r3(gy * vj));
  const s = h.map((hj) => r3(hj * (1 - hj))); // sigma'(z) = h (1 - h): the local slope
  const gz = gh.map((g, j) => r3(g * s[j]));
  const gW = gz.map((g) => x.map((xk) => r3(g * xk)));
  const gb = [...gz];
  const gx = x.map((_, k) => r3(gz[0] * p.W[0][k] + gz[1] * p.W[1][k]));
  return { x, y, z, h, yhat, L, gy, gv, gc, gh, s, gz, gW, gb, gx };
}

// One gradient-descent step on every weight and bias: p - eta * grad, then the loss again.
export function step(p, f, eta) {
  const q = {
    W: p.W.map((row, j) => row.map((w, k) => r3(w - eta * f.gW[j][k]))),
    b: p.b.map((b, j) => r3(b - eta * f.gb[j])),
    v: p.v.map((v, j) => r3(v - eta * f.gv[j])),
    c: r3(p.c - eta * f.gc),
  };
  return { q, after: net(q, f.x, f.y) };
}

// Full precision loss, for the finite-difference check only.
export function lossExact(p, x, y) {
  const h = p.W.map((row, j) => sigmoid(row[0] * x[0] + row[1] * x[1] + p.b[j]));
  return 0.5 * (p.v[0] * h[0] + p.v[1] * h[1] + p.c - y) ** 2;
}
export function flatP(p) { return [p.W[0][0], p.W[0][1], p.W[1][0], p.W[1][1], p.b[0], p.b[1], p.v[0], p.v[1], p.c]; }
export function unflatP(a) { return { W: [[a[0], a[1]], [a[2], a[3]]], b: [a[4], a[5]], v: [a[6], a[7]], c: a[8] }; }
export const NAMES = ["w11", "w12", "w21", "w22", "b1", "b2", "v1", "v2", "c"];
export function gradFlat(f) { return [f.gW[0][0], f.gW[0][1], f.gW[1][0], f.gW[1][1], f.gb[0], f.gb[1], f.gv[0], f.gv[1], f.gc]; }
// Central finite differences: move one weight by +-eps, measure the loss. Independent of backprop.
export function numericGrad(p, x, y, eps = 1e-6) {
  const a = flatP(p);
  return a.map((_, i) => {
    const up = [...a]; up[i] += eps;
    const dn = [...a]; dn[i] -= eps;
    return (lossExact(unflatP(up), x, y) - lossExact(unflatP(dn), x, y)) / (2 * eps);
  });
}

export const F = net(P0, X0, Y0);
export const S = step(P0, F, ETA0);
export const NUM = numericGrad(P0, X0, Y0);


// Real tool: PyTorch autograd on the same network, full precision. Returns null when torch is missing.
import { spawnSync } from "node:child_process";
export function torchCheck() {
  const py = `
import torch, json
W=torch.tensor(${JSON.stringify(P0.W)},dtype=torch.float64,requires_grad=True)
b=torch.tensor(${JSON.stringify(P0.b)},dtype=torch.float64,requires_grad=True)
v=torch.tensor(${JSON.stringify(P0.v)},dtype=torch.float64,requires_grad=True)
c=torch.tensor(${P0.c},dtype=torch.float64,requires_grad=True)
x=torch.tensor(${JSON.stringify(X0)},dtype=torch.float64)
L=0.5*((v@torch.sigmoid(W@x+b)+c-${Y0})**2)
L.backward()
print(json.dumps([*W.grad.flatten().tolist(),*b.grad.tolist(),*v.grad.tolist(),c.grad.item(),L.item(),torch.__version__]))`;
  const run = spawnSync("python3", ["-c", py], { encoding: "utf8" });
  if (run.status !== 0) return null;
  const out = JSON.parse(run.stdout);
  const version = out.pop();
  const L = out.pop();
  return { grads: out, L, version };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  // The page lets the reader set x1, x2, y in [-2, 2] at 0.1, and eta in [0.1, 0.8] at 0.1.
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const check = (x, y, eta, what) => {
    const f = net(P0, x, y);
    const num = numericGrad(P0, x, y);
    // Rounding each step to 3 places moves a gradient by at most a few thousandths.
    gradFlat(f).forEach((g, i) => assert(Math.abs(g - num[i]) <= 0.004, `${what}: ${NAMES[i]} backprop ${g} vs numeric ${num[i].toFixed(5)}`));
    const { after } = step(P0, f, eta);
    // A small step lowers the loss (the scene sentence says so for a small step only).
    if (eta <= 0.5 && f.L >= 0.01) assert(after.L < f.L, `${what}: eta ${eta} lowers L ${f.L} -> ${after.L}`);
  };
  check(X0, Y0, ETA0, "preset");
  for (let n = 0; n < 400; n++) {
    const x = [Math.round(rand() * 20) / 10, Math.round(rand() * 20) / 10];
    const y = Math.round(rand() * 20) / 10;
    check(x, y, Math.max(0.1, Math.round(Math.abs(rand()) * 8) / 10), `random ${n}`);
  }
  // The step button: from any weights the reader reached, repeated steps on any allowed x, y, eta never raise
  // the loss, and 60 steps halve it or bring it to 0.001 or less. The reader may change x, y, eta between runs.
  for (let n = 0; n < 300; n++) {
    let p = P0;
    for (let run = 0; run < 4; run++) {
      const x = [Math.round(rand() * 20) / 10, Math.round(rand() * 20) / 10];
      const y = Math.round(rand() * 20) / 10;
      const eta = Math.max(1, Math.round(Math.abs(rand()) * 8)) / 10;
      let f = net(p, x, y);
      const L0 = f.L;
      for (let k = 0; k < 60; k++) {
        const s = step(p, f, eta);
        assert(s.after.L <= f.L, `train ${n}.${run} step ${k}: eta ${eta} raises L ${f.L} -> ${s.after.L}`);
        p = s.q; f = s.after;
      }
      assert(f.L <= 0.001 || f.L <= L0 / 2, `train ${n}.${run}: eta ${eta} L ${L0} -> ${f.L} after 60 steps`);
      // Finite differences stay within the rounding error at every weight the reader can reach.
      numericGrad(p, x, y).forEach((g, i) => assert(Math.abs(g - gradFlat(f)[i]) <= 0.004, `train ${n}.${run}: ${NAMES[i]} numeric ${g}`));
    }
  }
  const tc = torchCheck();
  if (tc) {
    gradFlat(F).forEach((g, i) => assert(Math.abs(g - tc.grads[i]) <= 0.002, `torch ${NAMES[i]} ${g} vs ${tc.grads[i]}`));
    assert(Math.abs(F.L - tc.L) <= 0.002, `torch L ${F.L} vs ${tc.L}`);
    console.log(`torch ${tc.version} autograd agrees:`, tc.grads.map((v) => v.toFixed(4)).join(" "));
  } else console.log("torch missing: autograd check skipped");
  console.log("z", F.z, "h", F.h, "yhat", F.yhat, "L", F.L);
  console.log("gy", F.gy, "gv", F.gv, "gh", F.gh, "s", F.s, "gz", F.gz, "gW", JSON.stringify(F.gW), "gx", F.gx);
  console.log("numeric", NUM.map((v) => v.toFixed(4)).join(" "));
  console.log("after step eta", ETA0, JSON.stringify(S.q), "L", F.L, "->", S.after.L);
  console.log("model ok");
}
