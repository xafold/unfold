// The NFA for a(b|c)*d and its set simulation (Thompson's algorithm). Pure: every set, edge and
// verdict the figure shows comes from here. The NFA uses the compact form of Thompson's construction
// (split states, as in Russ Cox's "Regular Expression Matching Can Be Simple And Fast").

export const REGEX = "a(b|c)*d";
export const INPUT = "abcbd";
export const ACCEPT = 7;
export const N = 8;

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

const sorted = (set) => [...set].sort((x, y) => x - y);

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
  return { set: sorted(seen), used };
}

// δ(S, x): states reached from S by one edge labelled x. Also the edges that fired and the states that died.
export function move(set, x) {
  const fired = EDGES.filter((e) => e.sym === x && set.includes(e.from));
  const out = sorted(new Set(fired.map((e) => e.to)));
  // "died": no edge for x and not reached again (state 5 has no c edge, but 4 -c-> 5 keeps it in S).
  const died = set.filter((s) => !fired.some((e) => e.from === s) && !out.includes(s));
  return { set: out, fired: fired.map((e) => e.id), died };
}

const fmtSet = (s) => `{${s.join(",")}}`;

// One step per action: start, then for each symbol a move step and a closure step.
export function run(input = INPUT) {
  const steps = [];
  const start = closure([0]);
  steps.push({ kind: "start", pos: -1, set: start.set, before: [0], edges: start.used, died: [], text: `start · ε-closure({0}) = ${fmtSet(start.set)}` });
  let cur = start.set;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const m = move(cur, x);
    const who = m.fired.map((id) => EDGES.find((e) => e.id === id)).map((e) => `${e.from}→${e.to}`).join(", ");
    steps.push({ kind: "move", pos: i, sym: x, set: m.set, before: cur, edges: m.fired, died: m.died, text: `read ${x} · δ(${fmtSet(cur)}, ${x}) = ${fmtSet(m.set)} · ${who ? `edge ${who} reads ${x}` : `no edge reads ${x}`}` });
    const c = closure(m.set);
    const added = c.set.filter((s) => !m.set.includes(s));
    steps.push({ kind: "closure", pos: i, sym: x, set: c.set, before: m.set, edges: c.used, died: [], text: `ε-closure(${fmtSet(m.set)}) = ${fmtSet(c.set)}${added.length ? ` · adds ${added.join(", ")}` : " · adds nothing"}` });
    cur = c.set;
  }
  const match = cur.includes(ACCEPT);
  steps.at(-1).text += match ? ` · input ends, ${ACCEPT} ∈ S: match` : cur.length ? ` · input ends, ${ACCEPT} ∉ S: no match` : " · S is empty: no match";
  return { steps, match };
}

export const TRACE = run();
export const STEPS = TRACE.steps;

// Subset construction: each distinct reachable set is one DFA state (∅ is the dead state).
export function dfaSets(alphabet = "abcd") {
  const key = (s) => s.join(",");
  const found = new Map([[key(closure([0]).set), closure([0]).set]]);
  const todo = [closure([0]).set];
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
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  const real = new RegExp(`^${REGEX}$`);
  // Check the set simulation against the JavaScript regex engine on every string over {a,b,c,d} up to length 6.
  let checked = 0;
  const all = (n) => (n === 0 ? [""] : all(n - 1).flatMap((w) => ["", ..."abcd"].filter(Boolean).map((x) => w + x)));
  for (let n = 0; n <= 6; n++) for (const w of all(n)) (assert(run(w).match === real.test(w), `NFA and RegExp agree on "${w}"`), checked++);
  assert(TRACE.match, "abcbd matches");
  assert(STEPS.length === 1 + 2 * INPUT.length, "one start step, then a move and a closure per symbol");
  assert(fmtSet(STEPS[2].set) === "{1,2,3,4,6}", "after a, the machine is in five states");
  assert(STEPS[3].died.join() === "1,2,4,6", "on b, only state 3 has an edge");
  assert(STEPS[5].died.join() === "1,2,3,6", "on c, state 5 is reached again by 4 -c-> 5, so it is not dropped");
  assert(STEPS.at(-1).set.join() === "7", "after d, only the accept state is left");
  const dfa = dfaSets();
  for (const s of STEPS) console.log(s.kind.padEnd(7), (s.sym ?? "").padEnd(2), fmtSet(s.set).padEnd(16), s.text);
  for (const o of OTHERS) console.log(o.input.padEnd(6), o.sets.map(fmtSet).join(" "), o.match);
  console.log("DFA states:", dfa.map(fmtSet).join(" "));
  console.log(`checked ${checked} strings against RegExp`);
  console.log("model ok");
}
