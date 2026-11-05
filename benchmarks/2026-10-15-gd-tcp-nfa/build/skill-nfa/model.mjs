// Truth model: parse a regex, build its NFA with Thompson's construction, and simulate it on an input
// the way Thompson's algorithm does (one set of states, move on a symbol, then follow every ε edge).
// Every state, edge and set the figure shows comes from here. `node model.mjs` checks it against RegExp.
// ponytail: the parser knows literals, |, *, and parentheses only; add + ? and classes when a figure needs them.

export const REGEX = "a(b|c)*d";
export const INPUT = "abcbd";

// Recursive descent: alt := cat ('|' cat)*, cat := star+, star := atom '*'*, atom := char | '(' alt ')'.
export function parse(src) {
  let i = 0;
  const alt = () => {
    let node = cat();
    while (src[i] === "|") (i++, (node = { op: "alt", a: node, b: cat() }));
    return node;
  };
  const cat = () => {
    let node = star();
    while (i < src.length && src[i] !== "|" && src[i] !== ")") node = { op: "cat", a: node, b: star() };
    return node;
  };
  const star = () => {
    let node = atom();
    while (src[i] === "*") (i++, (node = { op: "star", a: node }));
    return node;
  };
  const atom = () => {
    if (src[i] === "(") {
      i++;
      const node = alt();
      if (src[i++] !== ")") throw new Error("missing )");
      return { op: "group", a: node };
    }
    return { op: "char", c: src[i++] };
  };
  const tree = alt();
  if (i !== src.length) throw new Error("unexpected " + src[i]);
  return tree;
}

const show = (n) => ({ char: () => n.c, group: () => `(${show(n.a)})`, star: () => `${show(n.a)}*`, cat: () => show(n.a) + show(n.b), alt: () => `${show(n.a)}|${show(n.b)}` })[n.op]();

// Thompson's construction. Each fragment has one start and one end state. `frags` records which states
// each sub-regex owns, so the figure can outline it.
export function thompson(tree) {
  let count = 0;
  const edges = [];
  const frags = [];
  const state = () => count++;
  const edge = (from, to, sym = null) => edges.push({ from, to, sym });
  const build = (n) => {
    const first = count;
    let f;
    if (n.op === "char") {
      f = { s: state(), e: state() };
      edge(f.s, f.e, n.c);
    } else if (n.op === "group") return build(n.a);
    else if (n.op === "cat") {
      const a = build(n.a);
      const b = build(n.b);
      edge(a.e, b.s);
      f = { s: a.s, e: b.e };
    } else if (n.op === "alt") {
      f = { s: state() };
      const a = build(n.a);
      const b = build(n.b);
      f.e = state();
      edge(f.s, a.s), edge(f.s, b.s), edge(a.e, f.e), edge(b.e, f.e);
    } else if (n.op === "star") {
      f = { s: state() };
      const a = build(n.a);
      f.e = state();
      edge(f.s, a.s), edge(f.s, f.e), edge(a.e, a.s), edge(a.e, f.e);
    }
    if (n.op !== "cat") frags.push({ text: show(n), states: range(first, count) });
    return f;
  };
  const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
  const f = build(tree);
  return { n: count, edges, start: f.s, accept: f.e, frags };
}

// Renumber states in reading order: by column (the longest path from the start, ignoring the loop's back
// edge), then by creation order. The numbers then grow left to right, top to bottom, in the drawing.
// The automaton itself does not change. `col` is kept for the layout, `back` marks the back edge.
function renumber(nfa) {
  const back = new Set();
  const onStack = new Set();
  const seen = new Set();
  const dfs = (s) => {
    seen.add(s), onStack.add(s);
    for (const e of nfa.edges.filter((e) => e.from === s)) {
      if (onStack.has(e.to)) back.add(e);
      else if (!seen.has(e.to)) dfs(e.to);
    }
    onStack.delete(s);
  };
  dfs(nfa.start);
  const col = new Map([[nfa.start, 0]]);
  const depth = (s) => {
    if (!col.has(s)) col.set(s, Math.max(...nfa.edges.filter((e) => e.to === s && !back.has(e)).map((e) => depth(e.from) + 1)));
    return col.get(s);
  };
  const order = Array.from({ length: nfa.n }, (_, s) => s).sort((a, b) => depth(a) - depth(b) || a - b);
  const id = new Map(order.map((s, k) => [s, k]));
  return {
    n: nfa.n,
    start: id.get(nfa.start),
    accept: id.get(nfa.accept),
    col: order.map((s) => col.get(s)),
    edges: nfa.edges.map((e) => ({ from: id.get(e.from), to: id.get(e.to), sym: e.sym, back: back.has(e) })),
    frags: nfa.frags.map((f) => ({ text: f.text, states: f.states.map((s) => id.get(s)).sort((a, b) => a - b) })),
  };
}

export const NFA = renumber(thompson(parse(REGEX)));
NFA.edges.forEach((e, k) => (e.k = k));

const sorted = (set) => [...set].sort((a, b) => a - b);

// ε-closure by breadth-first search. Returns the closed set and how each new state was reached:
// [{ state, edge, depth }], depth = number of ε edges from the seed set.
export function closure(nfa, seed) {
  const set = new Set(seed);
  const added = [];
  let wave = [...seed];
  for (let depth = 1; wave.length; depth++) {
    const next = [];
    for (const s of wave)
      for (const e of nfa.edges)
        if (e.from === s && e.sym === null && !set.has(e.to)) {
          set.add(e.to);
          next.push(e.to);
          added.push({ state: e.to, edge: e.k, depth });
        }
    wave = next;
  }
  return { set: sorted(set), added };
}

// Every step of the run. kind "start": S0 = ε-closure({start}). Per symbol: a "move" step (only edges
// labelled with the symbol fire; states without one die), then a "close" step.
export function run(nfa, input) {
  const steps = [];
  let first = closure(nfa, [nfa.start]);
  steps.push({ kind: "start", pos: 0, set: first.set, seed: [nfa.start], added: first.added, i: 0 });
  let set = first.set;
  [...input].forEach((sym, pos) => {
    const taken = nfa.edges.filter((e) => e.sym === sym && set.includes(e.from));
    const moved = sorted(new Set(taken.map((e) => e.to)));
    // A state "dies" when its only way on needs another symbol. States with only ε edges (and the accept
    // state) have nothing to read; they already did their work in the closure.
    const symbolic = (s) => nfa.edges.some((e) => e.from === s && e.sym !== null);
    const dead = set.filter((s) => symbolic(s) && !taken.some((e) => e.from === s));
    const idle = set.filter((s) => !symbolic(s));
    const src = sorted(new Set(taken.map((e) => e.from)));
    steps.push({ kind: "move", pos, sym, from: set, set: moved, taken: taken.map((e) => e.k), src, dead, idle, i: pos + 1 });
    const c = closure(nfa, moved);
    steps.push({ kind: "close", pos: pos + 1, sym, seed: moved, set: c.set, added: c.added, i: pos + 1 });
    set = c.set;
  });
  const last = steps.at(-1);
  last.match = set.includes(nfa.accept);
  return steps;
}

export const STEPS = run(NFA, INPUT);
export const SETS = STEPS.filter((s) => s.kind !== "move").map((s) => s.set); // S0 … S5
export const matches = (input) => run(NFA, input).at(-1).match;

// Subset construction: every set of states the matcher can ever hold is one DFA state.
export function dfaSets(nfa, alphabet = "abcd") {
  const key = (set) => set.join(",");
  const todo = [closure(nfa, [nfa.start]).set];
  const found = new Map([[key(todo[0]), todo[0]]]);
  while (todo.length) {
    const set = todo.pop();
    for (const sym of alphabet) {
      const moved = nfa.edges.filter((e) => e.sym === sym && set.includes(e.from)).map((e) => e.to);
      if (!moved.length) continue;
      const next = closure(nfa, moved).set;
      if (!found.has(key(next))) (found.set(key(next), next), todo.push(next));
    }
  }
  return [...found.values()];
}
export const DFA = dfaSets(NFA);
export const DISTINCT = new Set(SETS.map((s) => s.join(","))).size;

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => {
    if (!ok) (console.error("FAIL", what), process.exit(1));
  };
  const eps = NFA.edges.filter((e) => e.sym === null).length;
  assert(NFA.n === 12 && eps === 10 && NFA.edges.length === 14, `12 states, 4 symbol edges, 10 ε edges (got ${NFA.n}, ${NFA.edges.length - eps}, ${eps})`);
  assert(NFA.start === 0 && NFA.accept === NFA.n - 1, "start is 0 and accept is last");
  // Against the real engine: every string over {a,b,c,d} up to length 7.
  const re = new RegExp(`^(?:${REGEX})$`);
  let checked = 0;
  const all = (prefix, left) => {
    assert(matches(prefix) === re.test(prefix), `"${prefix}" agrees with RegExp`);
    checked++;
    if (left) for (const c of "abcd") all(prefix + c, left - 1);
  };
  all("", 7);
  assert(STEPS.at(-1).match, `"${INPUT}" matches`);
  assert(!matches("abcb") && matches("ad") && !matches("abcbdd"), "abcb and abcbdd fail, ad matches");
  assert(DISTINCT === 5 && DFA.length === 5, `5 distinct sets in the run, 5 DFA states (got ${DISTINCT}, ${DFA.length})`);
  assert(STEPS.every((s) => s.kind !== "move" || s.taken.length > 0), "no step kills every state on this input");
  for (const e of NFA.edges) console.log(`  ${String(e.from).padStart(2)} -${e.sym ?? "ε"}-> ${e.to}`);
  for (const f of NFA.frags) console.log(`  fragment ${f.text.padEnd(8)} states ${f.states.join(",")}`);
  for (const s of STEPS)
    console.log(
      s.kind.padEnd(5),
      (s.sym ?? "").padEnd(1),
      `{${s.set.join(",")}}`.padEnd(22),
      s.kind === "move" ? `dead {${s.dead.join(",")}} idle {${s.idle.join(",")}}` : `added ${s.added.map((a) => `${a.state}@${a.depth}`).join(" ")}`,
    );
  console.log(`checked ${checked} strings against RegExp`);
  console.log("model ok");
}
