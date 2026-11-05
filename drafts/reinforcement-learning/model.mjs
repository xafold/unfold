// Q-learning on a 4 x 3 grid world. Every number the figure shows comes from step() and replay().
// Cells are numbered r * 4 + c, row 0 at the top. Moves are deterministic. A move into the wall or the edge stays put.
// The run repeats until it converges, so it is computed in full precision. The page prints rounded values.

export const COLS = 4, ROWS = 3;
export const START = 8, GOAL = 3, PIT = 7, WALL = 5;
export const ACTS = ["up", "right", "down", "left"];
export const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
export const P0 = { alpha: 0.5, gamma: 0.9, eps: 0.2 };
export const SEED = 24;
export const EPISODES = 30; // the preset run
export const MAXEP = 200, MAXH = 4000; // guards: steps per episode, steps per run

// mulberry32: one uniform number in [0, 1) and the next seed. Pure, so a replay gives the same run.
export function rnd(seed) {
  const s = (seed + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { u: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: s };
}

export function isTerminal(s) { return s === GOAL || s === PIT; }

// The environment: next cell and reward for action a in cell s.
export function envStep(s, a) {
  const r = Math.floor(s / COLS) + DR[a], c = (s % COLS) + DC[a];
  const n = r * COLS + c;
  const next = r < 0 || r >= ROWS || c < 0 || c >= COLS || n === WALL ? s : n;
  return { next, r: next === GOAL ? 1 : next === PIT ? -1 : 0, done: isTerminal(next) };
}

export function bestActs(row) {
  const m = Math.max(...row);
  return row.map((q, a) => (q === m ? a : -1)).filter((a) => a >= 0);
}

// epsilon-greedy: with probability eps a random action, else the best action (a tie picks at random).
export function choose(Q, s, eps, seed) {
  const d1 = rnd(seed), d2 = rnd(d1.seed);
  const explore = d1.u < eps;
  const pool = explore ? [0, 1, 2, 3] : bestActs(Q[s]);
  return { a: pool[Math.floor(d2.u * pool.length)], explore, tie: !explore && pool.length > 1, seed: d2.seed };
}

export function init(seed) {
  return { pos: START, Q: Array.from({ length: COLS * ROWS }, () => [0, 0, 0, 0]), seed, ep: 1, n: 0, done: false, last: null };
}

// One time step: pick an action (act >= 0 is the reader's own), move, and apply the Q-learning update.
// After a terminal cell, the next step starts a new episode from START.
export function step(st, act, P) {
  const s = st.done ? START : st.pos;
  const ep = st.done ? st.ep + 1 : st.ep;
  const n = st.done ? 0 : st.n;
  let a = act, explore = false, tie = false, seed = st.seed;
  if (a < 0) ({ a, explore, tie, seed } = choose(st.Q, s, P.eps, seed));
  const { next, r, done } = envStep(s, a);
  const old = st.Q[s][a];
  const best = done ? 0 : Math.max(...st.Q[next]);
  const target = r + P.gamma * best;
  const nw = old + P.alpha * (target - old);
  const Q = st.Q.map((row, i) => (i === s ? row.map((q, j) => (j === a ? nw : q)) : row));
  return { pos: next, Q, seed, ep, n: n + 1, done, last: { s, a, r, next, done, own: act >= 0, explore, tie, old, best, target, nw } };
}

// A run from a plan: an action 0-3 (the reader's), -1 (one policy step) or -2 (policy steps until the episode ends).
export function replay(P, plan, seed, cap = MAXH) {
  const H = [init(seed)];
  for (const p of plan) {
    if (H.length > cap) break;
    if (p === -2) {
      let k = 0;
      do H.push(step(H[H.length - 1], -1, P));
      while (!H[H.length - 1].done && ++k < MAXEP);
    } else H.push(step(H[H.length - 1], p, P));
  }
  return H;
}

// The plan that gives H back step by step, so a new step can branch from step t.
export function planAt(H, t) {
  return H.slice(1, t + 1).map((h) => (h.last.own ? h.last.a : -1));
}

// Discounted return from each step of the episode that holds step t: G = r + gamma G'.
export function returns(H, t, gamma) {
  let a = t, b = t;
  while (a > 1 && !H[a - 1].done) a--;
  while (b < H.length - 1 && !H[b].done) b++;
  const steps = [];
  for (let i = a; i <= b; i++) steps.push({ t: i, s: H[i].last.s, r: H[i].last.r });
  let G = 0;
  for (let i = steps.length - 1; i >= 0; i--) steps[i].G = G = steps[i].r + gamma * G;
  return { from: a, to: b, done: H[b].done, steps };
}

// Episode lengths and end rewards up to step t.
export function history(H, t) {
  const eps = [];
  for (let i = 1; i <= t; i++) if (H[i].done) eps.push({ ep: H[i].ep, len: H[i].n, r: H[i].last.r, t: i });
  return eps;
}

// Value iteration on the same world: the exact Q*, for the check in the Policy scene.
export function qStar(gamma) {
  let Q = Array.from({ length: COLS * ROWS }, () => [0, 0, 0, 0]);
  for (let k = 0; k < 200; k++)
    Q = Q.map((row, s) => (isTerminal(s) || s === WALL ? row : row.map((_, a) => {
      const e = envStep(s, a);
      return e.r + (e.done ? 0 : gamma * Math.max(...Q[e.next]));
    })));
  return Q;
}

export const STATES = Array.from({ length: COLS * ROWS }, (_, s) => s).filter((s) => s !== WALL && !isTerminal(s));
export const PRESET = Array.from({ length: EPISODES }, () => -2);

// ---- Checks ----
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
export const H0 = replay(P0, PRESET, SEED);
export const EP1 = H0.findIndex((h) => h.done);

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const sh = (s) => `(${Math.floor(s / COLS)},${s % COLS})`;
  // The environment
  ok(envStep(START, 3).next === START && envStep(START, 2).next === START, "edge keeps the agent");
  ok(envStep(4, 1).next === 4 && envStep(9, 0).next === 9, "wall keeps the agent");
  ok(envStep(2, 1).r === 1 && envStep(2, 1).done && envStep(6, 1).r === -1, "goal +1, pit -1");
  // Value iteration: the shortest path from START has 5 moves, so V*(START) = gamma^4.
  const QS = qStar(0.9);
  ok(near(Math.max(...QS[START]), 0.9 ** 4), "V*(start) = 0.9^4");
  ok(near(QS[2][1], 1) && near(QS[6][0], 0.9) && near(QS[6][1], -1), "Q* by hand near the goal");
  // The preset run
  ok(EP1 > 1, "episode 1 needs more than one step");
  ok(H0[EP1].last.r === 1, "episode 1 ends at the goal");
  for (let i = 1; i < EP1; i++) ok(H0[i].Q.flat().every((q) => q === 0), "no Q changes before the first reward");
  ok(near(H0[EP1].last.nw, P0.alpha * 1), "first update: Q = 0 + alpha (1 + gamma 0 - 0)");
  const R1 = returns(H0, EP1, P0.gamma);
  ok(R1.steps.length === EP1 && near(R1.steps[0].G, P0.gamma ** (EP1 - 1)), "G_0 = gamma^(len-1)");
  for (let i = 0; i + 1 < R1.steps.length; i++) ok(near(R1.steps[i].G, R1.steps[i].r + P0.gamma * R1.steps[i + 1].G), "G = r + gamma G'");
  // Every step: the update rule, and the replay of the step-by-step plan gives the same run.
  for (let i = 1; i < H0.length; i++) {
    const L = H0[i].last, prev = H0[i - 1];
    ok(near(L.nw, L.old + P0.alpha * (L.target - L.old)), "update rule");
    ok(L.old === prev.Q[L.s][L.a], "old value from the state before");
  }
  const H1 = replay(P0, planAt(H0, H0.length - 1), SEED);
  ok(H1.length === H0.length && H1.every((h, i) => h.pos === H0[i].pos && h.seed === H0[i].seed), "planAt replays the run");
  // A branch: the reader's own action at step 3 keeps steps 0-3 and changes what comes after.
  const B = replay(P0, [...planAt(H0, 3), 1], SEED);
  ok(B.length === 5 && B.slice(0, 4).every((h, i) => h.pos === H0[i].pos) && B[4].last.own, "branch at step 3");
  // Many inputs in the allowed range: Q stays in [-1, 1], and a long run learns an optimal greedy policy.
  let seed = 12345;
  const draw = (lo, hi) => { const d = rnd(seed); seed = d.seed; return lo + d.u * (hi - lo); };
  for (let k = 0; k < 40; k++) {
    const P = { alpha: Math.round(draw(0.1, 1) * 100) / 100, gamma: Math.round(draw(0.5, 0.99) * 100) / 100, eps: Math.round(draw(0.05, 0.5) * 100) / 100 };
    const H = replay(P, Array.from({ length: 5000 }, () => -2), k + 1, 1e7);
    const Q = H[H.length - 1].Q, QX = qStar(P.gamma);
    ok(Q.flat().every((q) => q >= -1 - 1e-9 && q <= 1 + 1e-9), "Q in [-1, 1]");
    // Follow the greedy policy from START. It must take the shortest path (5 moves), and Q must equal Q* on it.
    // ponytail: cells off the greedy path are visited only by exploration, so they may not have converged yet.
    let s = START, moves = 0;
    while (!isTerminal(s) && moves < 20) {
      const a = bestActs(Q[s])[0];
      ok(bestActs(QX[s].map((q) => Math.round(q * 1e9))).includes(a), `optimal greedy action in ${sh(s)} for ${JSON.stringify(P)}`);
      ok(Math.abs(Q[s][a] - QX[s][a]) < 1e-3, `Q near Q* in ${sh(s)} for ${JSON.stringify(P)}`);
      s = envStep(s, a).next;
      moves++;
    }
    ok(s === GOAL && moves === 5, `greedy path reaches the goal in 5 moves for ${JSON.stringify(P)}`);
  }
  // Print the preset run
  const hist = history(H0, H0.length - 1);
  console.log("episode 1 ends at step", EP1, "path", R1.steps.map((x) => sh(x.s) + ACTS[H0[x.t].last.a][0]).join(" "));
  console.log("episode lengths", hist.map((e) => e.len + (e.r < 0 ? "x" : "")).join(" "), "steps", H0.length - 1);
  const QL = H0[H0.length - 1].Q;
  const agree = STATES.filter((s) => bestActs(QS[s].map((q) => Math.round(q * 1e9))).includes(bestActs(QL[s])[0]));
  console.log("after", EPISODES, "episodes: greedy optimal in", agree.length, "of", STATES.length);
  for (const s of STATES) console.log(sh(s), "maxQ", Math.max(...QL[s]).toFixed(3), "V*", Math.max(...QS[s]).toFixed(3), ACTS[bestActs(QL[s])[0]]);
  console.log("model ok");
}
