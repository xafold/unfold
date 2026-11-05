// Truth model: the classic core of a web search engine on a web of 6 pages, recorded one step at a time.
// Crawl (breadth-first from a seed), build an inverted index, look up the query words, score each hit with BM25,
// compute PageRank on the crawled links by power iteration, and rank by text score times link score.
// BM25 prints rounded values and computes each next value from them, so the screen adds up by hand.
// PageRank repeats until it converges, so it runs in full precision and the page prints it rounded.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Page texts chosen by hand: "blog" repeats "best" to win on text score, and few pages link to it.
export const PAGES = [
  { name: "home", url: "coffee.example/", title: "Coffee at home", text: "A home coffee guide: brew coffee, beans and tea." },
  { name: "beans", url: "coffee.example/beans", title: "Roast your beans", text: "Coffee beans: how to roast beans at home." },
  { name: "brew", url: "coffee.example/brew", title: "French press", text: "How to brew coffee with a French press." },
  { name: "tea", url: "tea.example/", title: "Green tea", text: "Brew green tea, not coffee." },
  { name: "cafe", url: "cafe.example/", title: "Best cafe in town", text: "The best coffee cafe in town." },
  { name: "blog", url: "best-best.example/", title: "BEST coffee!!", text: "Best coffee, best cafe, best best best!" },
];
// [from, to] by page index: the links on each page.
export const LINKS = [
  [0, 1], [0, 2], [0, 3],
  [1, 0], [1, 2],
  [2, 0],
  [3, 0], [3, 4],
  [4, 2], [4, 5],
  [5, 0], [5, 1], [5, 2], [5, 4],
];
export const SEED = 0;
export const QUERY = "best cafe";
export const STOP = ["a", "an", "and", "the", "to", "at", "in", "with", "or", "how", "not", "of", "for", "is", "on", "my", "your", "i", "it"];
export const K1 = 1.2;
export const B = 0.75;
export const DAMP = 0.85;
export const TOL = 0.001;
export const MAX_TERMS = 4;

// The pseudocode the figure shows, one line per kind of step (0-based in codeLine).
export const CODE = [
  "frontier = [seed]",
  "while frontier: page = fetch(frontier.pop_first())",
  "  add its new links to frontier",
  "for page in fetched: index[word].add(page, tf)",
  "hits = pages in index[w] for any query word w",
  "text[p] = Σ idf(w) · tfpart(w, p)   # BM25",
  "pr[p] = 1/N for every page",
  "repeat: pr[p] = (1−d)/N + d · Σ pr[q] / out[q]",
  "until no pr[p] moves more than 0.001",
  "score = text · N·pr;  sort by score",
];

export function round(v, places) {
  const f = 10 ** places;
  return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f;
}

export function tokenize(text) {
  return text.toLowerCase().split(/[^a-z]+/).filter((w) => w && !STOP.includes(w));
}

export function queryTerms(q) {
  const out = [];
  for (const w of tokenize(q)) if (!out.includes(w) && out.length < MAX_TERMS) out.push(w);
  return out;
}

// Breadth-first crawl. Returns the fetch order and one step per fetch.
export function crawl(n, links, seed) {
  const frontier = [seed];
  const seen = [seed];
  const fetched = [];
  const steps = [{ kind: "seed", page: seed, frontier: frontier.slice(), fetched: [] }];
  while (frontier.length) {
    const page = frontier.shift();
    fetched.push(page);
    const out = links.filter(([a]) => a === page).map(([, b]) => b);
    const added = out.filter((b) => !seen.includes(b));
    for (const b of added) {
      seen.push(b);
      frontier.push(b);
    }
    steps.push({ kind: "fetch", page, out, added, frontier: frontier.slice(), fetched: fetched.slice() });
  }
  return { fetched, steps };
}

// index[word] = [[page, tf], …] in fetch order, for the pages fetched so far.
export function buildIndex(order) {
  const index = {};
  for (const p of order) {
    const counts = {};
    for (const w of tokenize(PAGES[p].text)) counts[w] = (counts[w] || 0) + 1;
    for (const w of Object.keys(counts)) (index[w] = index[w] || []).push([p, counts[w]]);
  }
  return index;
}

// BM25 with rounded intermediate values: idf 2 places, avg length 1 place, tf part 2, each term part 2, sum 2.
export function bm25(order, index, terms) {
  const N = order.length;
  const len = {};
  for (const p of order) len[p] = tokenize(PAGES[p].text).length;
  const avg = round(order.reduce((s, p) => s + len[p], 0) / Math.max(1, N), 1);
  const idf = {};
  for (const w of terms) {
    const nw = (index[w] || []).length;
    idf[w] = round(Math.log(1 + (N - nw + 0.5) / (nw + 0.5)), 2);
  }
  const hits = order.filter((p) => terms.some((w) => (index[w] || []).some(([q]) => q === p))).sort((a, b) => a - b);
  const scores = hits.map((p) => {
    const K = round(K1 * (1 - B + (B * len[p]) / avg), 2);
    const parts = terms.map((w) => {
      const tf = ((index[w] || []).find(([q]) => q === p) || [p, 0])[1];
      const tfp = tf ? round((tf * (K1 + 1)) / (tf + K), 2) : 0;
      return { w, tf, tfp, part: round(idf[w] * tfp, 2) };
    });
    return { page: p, len: len[p], K, parts, text: round(parts.reduce((s, x) => s + x.part, 0), 2) };
  });
  return { N, avg, idf, hits, scores };
}

// PageRank on the crawled pages and the links between them. A page with no links out spreads its rank evenly.
export function pagerank(order, links) {
  const N = order.length;
  const inside = links.filter(([a, b]) => order.includes(a) && order.includes(b));
  const out = {};
  for (const p of order) out[p] = inside.filter(([a]) => a === p).length;
  let pr = {};
  for (const p of order) pr[p] = 1 / N;
  const iters = [{ pr: { ...pr }, delta: null }];
  for (let k = 0; k < 100; k++) {
    const sink = order.filter((q) => !out[q]).reduce((s, q) => s + pr[q], 0);
    const next = {};
    for (const p of order) {
      const flow = inside.filter(([, b]) => b === p).reduce((s, [a]) => s + pr[a] / out[a], 0);
      next[p] = (1 - DAMP) / N + DAMP * (flow + sink / N);
    }
    const delta = Math.max(...order.map((p) => Math.abs(next[p] - pr[p])));
    pr = next;
    iters.push({ pr: { ...pr }, delta });
    if (delta < TOL) break;
  }
  return { out, iters, pr };
}

// An independent check: solve (I − d·M) x = (1 − d)/N directly with Gaussian elimination.
export function solvePagerank(order, links) {
  const N = order.length;
  const ix = (p) => order.indexOf(p);
  const inside = links.filter(([a, b]) => order.includes(a) && order.includes(b));
  const A = order.map((_, i) => order.map((_, j) => (i === j ? 1 : 0)));
  const rhs = order.map(() => (1 - DAMP) / N);
  for (const q of order) {
    const targets = inside.filter(([a]) => a === q).map(([, b]) => b);
    const share = targets.length ? targets : order;
    for (const p of share) A[ix(p)][ix(q)] -= DAMP / share.length;
  }
  for (let c = 0; c < N; c++) {
    let piv = c;
    for (let r = c + 1; r < N; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [rhs[c], rhs[piv]] = [rhs[piv], rhs[c]];
    for (let r = 0; r < N; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < N; k++) A[r][k] -= f * A[c][k];
      rhs[r] -= f * rhs[c];
    }
  }
  const x = {};
  order.forEach((p, i) => (x[p] = rhs[i] / A[i][i]));
  return x;
}

// Final score: text score times link score, where link = N·pr (1 = an average page), rounded to 2 places.
export function rank(scores, pr, N) {
  return scores
    .map((s) => {
      const link = round(N * round(pr[s.page], 3), 2);
      return { page: s.page, text: s.text, link, score: round(s.text * link, 2) };
    })
    .sort((a, b) => b.score - a.score || a.page - b.page);
}

// The whole run as one list of steps, with the step range of each of the 6 chapters.
export function search(links, query) {
  const n = PAGES.length;
  const terms = queryTerms(query);
  const { fetched, steps: crawlSteps } = crawl(n, links, SEED);
  const steps = crawlSteps.slice();
  const ranges = [[0, steps.length - 1]];
  fetched.forEach((p, i) => steps.push({ kind: "index", page: p, index: buildIndex(fetched.slice(0, i + 1)) }));
  ranges.push([ranges[0][1] + 1, steps.length - 1]);
  const index = buildIndex(fetched);
  const b = bm25(fetched, index, terms);
  const a = steps.length;
  terms.forEach((w, i) => steps.push({ kind: "lookup", term: w, postings: index[w] || [], upto: i }));
  steps.push({ kind: "hits", hits: b.hits });
  ranges.push([a, steps.length - 1]);
  const c = steps.length;
  if (b.scores.length) b.scores.forEach((s, i) => steps.push({ kind: "score", page: s.page, upto: i }));
  else steps.push({ kind: "score", page: -1, upto: -1 });
  ranges.push([c, steps.length - 1]);
  const P = pagerank(fetched, links);
  const d = steps.length;
  P.iters.forEach((it, k) => steps.push({ kind: "pr", iter: k, pr: it.pr, delta: it.delta, last: k === P.iters.length - 1 }));
  ranges.push([d, steps.length - 1]);
  const results = rank(b.scores, P.pr, fetched.length);
  steps.push({ kind: "rank" });
  ranges.push([steps.length - 1, steps.length - 1]);
  return { terms, fetched, index, bm: b, P, exact: solvePagerank(fetched, links), results, steps, ranges };
}

export function codeLine(s) {
  if (s.kind === "seed") return 0;
  if (s.kind === "fetch") return 1;
  if (s.kind === "index") return 3;
  if (s.kind === "lookup" || s.kind === "hits") return 4;
  if (s.kind === "score") return 5;
  if (s.kind === "pr") return s.iter === 0 ? 6 : s.last ? 8 : 7;
  return 9;
}

// ---- Checks ----
const preset = search(LINKS, QUERY);
assert.deepEqual(preset.fetched, [0, 1, 2, 3, 4, 5], "the crawl finds every page in breadth-first order");
assert.deepEqual(preset.terms, ["best", "cafe"]);
const byPage = Object.fromEntries(preset.bm.scores.map((s) => [PAGES[s.page].name, s.text]));
assert.ok(byPage.blog > byPage.cafe, "the keyword-stuffed blog wins on text score");
assert.equal(PAGES[preset.results[0].page].name, "cafe", "but the cafe wins after the link score");

function check(links, query) {
  const r = search(links, query);
  // Every chapter holds at least one step, and the chapters cover the run in order.
  r.ranges.forEach(([a, b2], i) => {
    assert.ok(b2 >= a, "chapter " + i + " has a step");
    if (i) assert.equal(a, r.ranges[i - 1][1] + 1);
  });
  assert.equal(r.ranges[5][1], r.steps.length - 1);
  // Crawl: every page reachable from the seed is fetched once.
  const reach = new Set([SEED]);
  for (let grow = true; grow; ) {
    grow = false;
    for (const [a, b2] of links) if (reach.has(a) && !reach.has(b2)) (reach.add(b2), (grow = true));
  }
  assert.deepEqual([...r.fetched].sort(), [...reach].sort());
  // Index: posting counts match a brute-force count of each page text.
  for (const [w, list] of Object.entries(r.index))
    for (const [p, tf] of list) assert.equal(tf, tokenize(PAGES[p].text).filter((x) => x === w).length);
  // BM25: each sum is the sum of its printed parts, and a hit has at least one query word.
  for (const s of r.bm.scores) {
    assert.equal(s.text, round(s.parts.reduce((t, x) => t + x.part, 0), 2));
    assert.ok(s.parts.some((x) => x.tf > 0));
  }
  // PageRank: sums to 1, matches the direct solve, and the printed values do not stop moving before the exact ones.
  const sum = r.fetched.reduce((t, p) => t + r.P.pr[p], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, "pagerank sums to 1");
  for (const p of r.fetched) assert.ok(Math.abs(r.P.pr[p] - r.exact[p]) < 0.003, "power iteration matches the direct solve");
  assert.ok(r.P.iters.length <= 40, "the PR chapter stays short enough to step through");
  // Ranking is sorted.
  for (let i = 1; i < r.results.length; i++) assert.ok(r.results[i - 1].score >= r.results[i].score);
  return r;
}
check(LINKS, QUERY);
const QUERIES = ["brew coffee", "green tea", "best cafe", "coffee", "zebra", "", "tea brew beans roast", "best best"];
for (const q of QUERIES) check(LINKS, q);
// Random link sets: the reader can remove or restore any of the 14 links (seeded).
let seed = 11;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let t = 0; t < 300; t++) check(LINKS.filter(() => rand() > 0.35), QUERIES[t % QUERIES.length]);

// A real tool: networkx's pagerank on the preset. Skipped with a message when networkx is missing.
let nx = "";
try {
  nx = execFileSync("python3", ["-c", `
import json, networkx as nx
G = nx.DiGraph()
G.add_nodes_from(range(${PAGES.length}))
G.add_edges_from(${JSON.stringify(LINKS)})
print(json.dumps(nx.pagerank(G, alpha=${DAMP}, tol=1e-12)))
`], { stdio: ["ignore", "pipe", "ignore"] }).toString();
} catch {
  console.log("networkx not found: the networkx check is skipped");
}
export const NETWORKX = nx ? Object.values(JSON.parse(nx)).map((v) => round(v, 3)) : null;
if (nx) for (const [p, v] of Object.entries(JSON.parse(nx))) assert.ok(Math.abs(preset.exact[p] - v) < 1e-6, "matches networkx");

if (import.meta.url === `file://${process.argv[1]}`) {
  const N = (p) => PAGES[p].name;
  console.log("fetch order", preset.fetched.map(N).join(" "));
  for (const [w, l] of Object.entries(preset.index).sort()) console.log(w.padEnd(7), l.map(([p, tf]) => `${N(p)}:${tf}`).join(" "));
  console.log("avg len", preset.bm.avg, "idf", JSON.stringify(preset.bm.idf));
  for (const s of preset.bm.scores) console.log(N(s.page).padEnd(6), "len", s.len, "K", s.K, s.parts.map((x) => `${x.w} tf${x.tf} ${x.tfp}→${x.part}`).join("  "), "=", s.text);
  console.log("PR iterations", preset.P.iters.length - 1, preset.fetched.map((p) => `${N(p)} ${round(preset.P.pr[p], 3)} (solve ${round(preset.exact[p], 3)})`).join("  "));
  if (NETWORKX) console.log("networkx", NETWORKX.join(" "));
  for (const r of preset.results) console.log(N(r.page).padEnd(6), r.text, "×", r.link, "=", r.score);
  console.log("steps", preset.steps.length, "ranges", JSON.stringify(preset.ranges));
  console.log("model ok");
}
