// The NFA for a(b|c)*d and its set simulation (Thompson's algorithm). Pure: every set, edge and
// verdict the figure shows comes from here. The NFA uses the compact form of Thompson's construction
// (split states, as in Russ Cox's "Regular Expression Matching Can Be Simple And Fast").
// The page ships run, closure, move, fmtSet, sortNums and chapters with modelScript, so a typed input
// runs this same code.

export const REGEX = "a(b|c)*d";
export const INPUT = "abcbd";
export const MAXLEN = 8;
export const ACCEPT = 7;
export const N = 8;
// model.mjs checks the simulator against RegExp on every string up to CHECK_LEN over a, b, c, d, x, plus CHECK_RANDOM random ones.
export const CHECK_LEN = 6;
export const CHECK_RANDOM = 20000;

// sym null = ε edge (moves without reading input).
export const EDGES = [
  { id: "e01", from: 0, to: 1, sym: "a" },
  { id: "e12", from: 1, to: 2, sym: null },
  { id: "e16", from: 1, to: 6, sym: null },
  { id: "e23", from: 2, to: 3, sym: null },
  { id: "e24", from: 2, to: 4, sym: null },
  { id: "e35", from: 3, to: 5, sym: "b" },
  { id: "e45", from: 4, to: 5, sym: "c" },
  { id: "e51", from: 5, to: 1, sym: null },
  { id: "e67", from: 6, to: 7, sym: "d" },
];

export function sortNums(set) {
  return [...set].sort((x, y) => x - y);
}

export function fmtSet(s) {
  return "{" + s.join(",") + "}";
}

// ε-closure: every state reachable by ε edges alone. Also returns the ε edges it used.
export function closure(set) {
  const seen = new Set(set);
  const used = [];
  const todo = [...set];
  while (todo.length) {
    const s = todo.pop();
    for (const e of EDGES) {
      if (e.from !== s || e.sym !== null) continue;
      used.push(e.id);
      if (!seen.has(e.to)) (seen.add(e.to), todo.push(e.to));
    }
  }
  return { set: sortNums(seen), used };
}

// δ(S, x): states reached from S by one edge labelled x. Also the edges that fired,
// the states that had no edge for x (died), and the dead states that an edge reaches again (back).
export function move(set, x) {
  const fired = EDGES.filter((e) => e.sym === x && set.includes(e.from));
  const out = sortNums(new Set(fired.map((e) => e.to)));
  const died = set.filter((s) => !fired.some((e) => e.from === s));
  const back = died.filter((s) => out.includes(s));
  return { set: out, fired: fired.map((e) => e.id), died, back };
}

// One step per action: start, then for each symbol a move step and a closure step.
export function run(input) {
  const steps = [];
  const start = closure([0]);
  steps.push({ kind: "start", pos: -1, sym: null, set: start.set, before: [0], edges: start.used, died: [], back: [], text: "start · ε-closure({0}) = " + fmtSet(start.set) });
  let cur = start.set;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const m = move(cur, x);
    const who = m.fired.map((id) => EDGES.find((e) => e.id === id)).map((e) => e.from + "→" + e.to).join(", ");
    steps.push({ kind: "move", pos: i, sym: x, set: m.set, before: cur, edges: m.fired, died: m.died, back: m.back, text: "read " + x + " · δ(" + fmtSet(cur) + ", " + x + ") = " + fmtSet(m.set) + " · " + (who ? "edge " + who : "no edge reads " + x) });
    const c = closure(m.set);
    const added = c.set.filter((s) => !m.set.includes(s));
    steps.push({ kind: "closure", pos: i, sym: x, set: c.set, before: m.set, edges: c.used, died: [], back: [], text: "ε-closure(" + fmtSet(m.set) + ") = " + fmtSet(c.set) + (added.length ? " · adds " + added.join(", ") : " · adds nothing") });
    cur = c.set;
  }
  const match = cur.includes(ACCEPT);
  steps[steps.length - 1].text += match ? " · 7 ∈ S: match" : cur.length ? " · 7 ∉ S: no match" : " · S is empty: no match";
  return { steps, match };
}

// The scenes are chapters of one run: [first step, last step] for each scene, for a run whose last step is `last`.
// 0 overview (all), 1 build (start), 2 read the first symbol, 3 its ε-closure, 4 the middle symbols, 5 the last symbol.
export function chapters(last) {
  const c = (t) => Math.min(t, last);
  return [[0, last], [0, 0], [0, c(1)], [c(2), c(2)], [c(3), Math.max(c(3), last - 2)], [Math.max(0, last - 1), last]];
}

export const TRACE = run(INPUT);
export const STEPS = TRACE.steps;

// Subset construction: each distinct reachable set is one DFA state (∅ is the dead state).
export function dfaSets(alphabet = "abcd") {
  const key = (s) => s.join(",");
  const first = closure([0]).set;
  const found = new Map([[key(first), first]]);
  const todo = [first];
  while (todo.length) {
    const s = todo.pop();
    for (const x of alphabet) {
      const t = closure(move(s, x).set).set;
      if (!found.has(key(t))) (found.set(key(t), t), todo.push(t));
    }
  }
  return [...found.values()];
}

export const OTHERS = ["ad", "abcbd", "abcb", "abdc"].map((input) => {
  const r = run(input);
  return { input, sets: r.steps.filter((s) => s.kind !== "move").map((s) => s.set), match: r.match };
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => {
    if (!ok) (console.error("FAIL", what), process.exit(1));
  };
  const real = new RegExp(`^${REGEX}$`);
  // The rules the scene sentences state, on one input.
  const rules = (w) => {
    const { steps, match } = run(w);
    const last = steps.length - 1;
    assert(match === real.test(w), `NFA and RegExp agree on "${w}"`);
    assert(steps.length === 1 + 2 * w.length, `one start step, then a move and a closure per symbol ("${w}")`);
    for (const s of steps.filter((s) => s.kind === "move")) {
      const moved = s.before.filter((q) => EDGES.some((e) => e.from === q && e.sym === s.sym));
      assert(moved.length + s.died.length === s.before.length, `every state in S either follows an edge or dies ("${w}")`);
      assert(s.back.every((q) => s.died.includes(q) && s.set.includes(q)), `a state reached again died first ("${w}")`);
    }
    const ch = chapters(last);
    for (let t = 0; t <= last; t++) assert(ch.slice(2).some(([a, b]) => t >= a && t <= b), `step ${t} has a chapter ("${w}")`);
    assert(ch.every(([a, b]) => a >= 0 && b <= last && a <= b), `chapters stay inside the run ("${w}")`);
  };
  // Every string over {a,b,c,d,x} up to length 6 (x has no edge), then random strings up to MAXLEN over a to z.
  let checked = 0;
  const all = (n) => (n === 0 ? [""] : all(n - 1).flatMap((w) => [..."abcdx"].map((x) => w + x)));
  for (let n = 0; n <= CHECK_LEN; n++) for (const w of all(n)) (rules(w), checked++);
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed / 2 ** 31);
  for (let i = 0; i < CHECK_RANDOM; i++) {
    const len = CHECK_LEN + 1 + Math.floor(rand() * (MAXLEN - CHECK_LEN));
    const w = Array.from({ length: len }, () => {
      const pool = rand() < 0.9 ? "abcd" : "abcdefghijklmnopqrstuvwxyz";
      return pool[Math.floor(rand() * pool.length)];
    }).join("");
    (rules(w), checked++);
  }
  assert(TRACE.match, "abcbd matches");
  assert(fmtSet(STEPS[2].set) === "{1,2,3,4,6}", "after a, the machine is in five states");
  assert(STEPS[3].died.join() === "1,2,4,6", "on b, only state 3 has an edge");
  assert(STEPS[5].died.join() === "1,2,3,5,6" && STEPS[5].back.join() === "5", "on c, state 5 dies, and 4 -c-> 5 reaches it again");
  assert(STEPS.at(-1).set.join() === "7", "after d, only the accept state is left");
  const dfa = dfaSets();
  for (const s of STEPS) console.log(s.kind.padEnd(7), (s.sym ?? "").padEnd(2), fmtSet(s.set).padEnd(16), s.text);
  for (const o of OTHERS) console.log(o.input.padEnd(6), o.sets.map(fmtSet).join(" "), o.match);
  console.log("DFA states:", dfa.map(fmtSet).join(" "));
  console.log(`checked ${checked} strings against RegExp`);
  console.log("model ok");
}
