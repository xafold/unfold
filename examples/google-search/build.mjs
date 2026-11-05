import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const light = process.argv.includes("--light");
const theme = light ? "light" : "auto";

const W = 820;
const H = 462;
const N = m.PAGES.length;
const run = m.search(m.LINKS, m.QUERY);
const VOCAB = [...new Set(m.PAGES.flatMap((p) => m.tokenize(p.text)))].sort();

// Colour identity.
const HUE = { cur: "blue", front: "yellow", query: "teal", text: "purple", link: "green", score: "gold" };

// ---- Left: the web as a graph. Each page is a box, each link an arrow. ----
const POS = [[200, 178], [70, 58], [330, 58], [70, 302], [330, 302], [200, 404]];
const LABEL_AT = [[46, 0, "start"], [0, -32, "middle"], [0, -32, "middle"], [0, 34, "middle"], [0, 34, "middle"], [0, 34, "middle"]];
const BW = 38;
const BH = 17;
const r1 = (v) => Math.round(v * 10) / 10;
// Where the line from a's centre to b's centre leaves a's box, plus a gap.
function exit([x1, y1], [x2, y2], gap) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.min((BW + gap) / Math.abs(dx || 1e-9), (BH + gap) / Math.abs(dy || 1e-9));
  return [x1 + dx * t, y1 + dy * t];
}
const edges = m.LINKS.map(([a, b], e) => {
  const both = m.LINKS.some(([p, q]) => p === b && q === a);
  const [x1, y1] = POS[a];
  const [x2, y2] = POS[b];
  const L = Math.hypot(x2 - x1, y2 - y1);
  const off = both ? [(-(y2 - y1) / L) * 5, ((x2 - x1) / L) * 5] : [0, 0];
  const A = [x1 + off[0], y1 + off[1]];
  const Bp = [x2 + off[0], y2 + off[1]];
  const from = exit(A, Bp, 2).map(r1);
  const to = exit(Bp, A, 3).map(r1);
  return (
    `<g class="el-edge" data-e="${e}">${u.arrow(from, to, { head: 7, width: 1.4 })}` +
    `<path class="el-ghost" d="M${from[0]} ${from[1]}L${to[0]} ${to[1]}"/>` +
    `<path class="el-hit" d="M${from[0]} ${from[1]}L${to[0]} ${to[1]}"/></g>`
  );
});
const nodes = m.PAGES.map((p, k) => {
  const [x, y] = POS[k];
  return (
    `<g class="el-node" data-i="${k}" transform="translate(${x} ${y})">` +
    `<g class="el-body"><rect class="el-ring" x="${-BW - 4}" y="${-BH - 4}" width="${2 * BW + 8}" height="${2 * BH + 8}" rx="9"/>` +
    `<rect class="el-box" x="${-BW}" y="${-BH}" width="${2 * BW}" height="${2 * BH}" rx="6"/><text class="el-name">${p.name}</text></g>` +
    `<g class="el-valg" transform="translate(${LABEL_AT[k][0]} ${LABEL_AT[k][1]})"><text class="el-val" text-anchor="${LABEL_AT[k][2]}"></text></g></g>`
  );
});

// ---- Right column: one panel per chapter, then the pseudocode. ----
const SIDE_X = 430;
const th = (x, y, t, cls = "") => `<text class="el-th ${cls}" x="${x}" y="${y}">${t}</text>`;

// Crawl: the frontier queue and the fetched list, with one chip per page that moves between them.
const crawlPanel =
  th(0, 10, "frontier: pages to fetch, first in, first out", "el-left") +
  `<rect class="el-slot" x="0" y="20" width="376" height="32" rx="6"/>` +
  th(0, 76, "fetched, in order", "el-left") +
  `<rect class="el-slot" x="0" y="86" width="376" height="32" rx="6"/>` +
  m.PAGES.map((p, k) => `<g class="el-cc" data-i="${k}" style="transform:translate(6px,24px);opacity:0">${u.chip(p.name, 0, 0, { w: 56, h: 24, rx: 5 })}</g>`).join("");

// Index: one row per word, with up to 6 posting chips "page count".
const IX_Y0 = 32;
const IX_H = 17.6;
const indexPanel =
  th(0, 10, "word", "el-left") + th(62, 10, "posting list: page and count", "el-left") +
  VOCAB.map(
    (w, r) =>
      `<g class="el-ix" data-w="${w}" transform="translate(0 ${r1(IX_Y0 + r * IX_H)})"><rect class="el-ix-bg" x="-4" y="-8.5" width="384" height="17" rx="3"/><text class="el-word">${w}</text>` +
      Array.from({ length: N }, (_, j) => `<g class="el-post" data-j="${j}">${u.chip("", 60 + j * 53, -7.5, { w: 50, h: 15, rx: 3 })}</g>`).join("") +
      `</g>`,
  ).join("");

// Text score: a table with one row per hit, one column per query word.
const TC = [114, 182, 250, 318];
const scorePanel =
  th(0, 10, "page", "el-left") + th(60, 10, "len") +
  TC.map((x, k) => `<text class="el-th el-term" data-k="${k}" x="${x}" y="10"></text>`).join("") +
  th(364, 10, "text", "el-txt") +
  `<text class="el-th el-left" x="0" y="32">idf</text>` +
  TC.map((x, k) => `<text class="el-idf" data-k="${k}" x="${x}" y="32"></text>`).join("") +
  `<path class="el-rule" d="M0 44H380"/>` +
  Array.from(
    { length: N },
    (_, i) =>
      `<g class="el-sr" data-r="${i}" transform="translate(0 ${62 + i * 28})"><rect class="el-sr-bg" x="-4" y="-12" width="388" height="24" rx="4"/>` +
      `<text class="el-sn" x="0"></text><text class="el-sl" x="60"></text>` +
      TC.map((x, k) => `<text class="el-sp" data-k="${k}" x="${x}"></text>`).join("") +
      `<text class="el-st" x="364"></text></g>`,
  ).join("") +
  `<text class="el-th el-left el-legend" x="0" y="232">each cell: tf → idf × tf part</text>` +
  `<text class="el-none" x="190" y="90">no page holds a query word</text>`;

// PageRank: one bar per page, the direct solve beside it, and the biggest move of each round.
const PR_X = 62;
const PR_W = 210;
const PR_MAX = 0.5;
const prPanel =
  th(0, 10, "page", "el-left") + th(PR_X, 10, "pr after this round", "el-left el-lnk") + th(350, 10, "solve") +
  m.PAGES.map(
    (p, k) =>
      `<g class="el-pr" data-i="${k}" transform="translate(0 ${34 + k * 26})"><rect class="el-pr-bg" x="-4" y="-11" width="388" height="22" rx="4"/><text class="el-pn" x="0">${p.name}</text>` +
      `<rect class="el-bar" x="${PR_X}" y="-7" width="0" height="14" rx="2"/><text class="el-pv" x="${PR_X + 6}"></text><text class="el-px" x="350"></text></g>`,
  ).join("") +
  th(0, 204, "biggest move per round", "el-left") +
  `<path class="el-rule" d="M0 254H380"/>` +
  Array.from({ length: 40 }, (_, i) => `<rect class="el-dl" data-i="${i}" x="${i * 9.5}" y="254" width="7" height="0"/>`).join("") +
  `<text class="el-dlv" x="380" y="204"></text>`;

// Rank: the results page. One group per page, moved to its rank.
const rankPanel = th(22, 6, "text × link = final score", "el-left") + m.PAGES.map(
  (p, k) =>
    `<g class="el-res" data-i="${k}" style="transform:translate(0px,${20 + k * 44}px);opacity:0"><text class="el-rk" x="0" y="14"></text>` +
    `<text class="el-rt" x="22" y="10">${p.title}</text><text class="el-ru" x="22" y="25">${p.url}</text><text class="el-rs" x="22" y="39"></text></g>`,
).join("");

const code = u.codeLines(m.CODE, { id: "el-code", y: 0, w: 380, lineH: 16, hue: HUE.cur });

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "A web of 6 pages with their links, and the steps of a search engine: crawl, index, look up, text score, PageRank and the final ranking.",
  body: [
    `<g class="el-graph">${edges.join("")}${nodes.join("")}</g>`,
    `<g class="el-side">` +
      `<g class="el-p el-p0">${crawlPanel}</g><g class="el-p el-p12">${indexPanel}</g><g class="el-p el-p3">${scorePanel}</g>` +
      `<g class="el-p el-p4">${prPanel}</g><g class="el-p el-p5">${rankPanel}</g></g>`,
    `<g class="el-codeg">${code}</g>`,
  ],
});

// ---- Scenes ----
const sp = `<mspace width=".6em"/>`;
const pr = (x, hue = HUE.link) => `${u.mi("pr", hue)}${u.mo("(")}<mi>${x}</mi>${u.mo(")")}`;
const text = (x) => `${u.mi("text", HUE.text)}${u.mo("(")}<mi>${x}</mi>${u.mo(")")}`;
const scenes = [
  {
    name: "Crawl",
    rule: `fetch the first page in the <span data-hue="yellow">frontier</span>, then add its new links to the end`,
    voice: `How does a search engine know which pages exist? At first, it knows one page. A crawler fetches it, reads its links, and queues each new page in the frontier. A page that no fetched page links to is never found. Click a link to remove it, and watch the crawl change.`,
  },
  {
    name: "Index",
    rule: `index[word] = list of (page, count)`,
    voice: `Next, each fetched page goes into an inverted index. For every word, the index keeps a posting list: the pages that hold the word, with a count. When you search later, the engine reads these lists, not the pages.`,
  },
  {
    name: "Look up",
    math: `${u.mi("hits", HUE.query)}<mo>=</mo><munder><mo>⋃</mo><mrow><mi>w</mi><mo>∈</mo>${u.mi("query", HUE.query)}</mrow></munder><mspace width=".25em"/><mi>index</mi>${u.mo("(")}${u.mi("w", HUE.query)}${u.mo(")")}`,
    voice: `Now type a query in the box. Each query word picks one row of the index. Every page in those rows is a hit. But which hit should come first?`,
  },
  {
    name: "Text score",
    math:
      `${text("p")}<mo>=</mo><munder><mo>∑</mo>${u.mi("w", HUE.query)}</munder><mspace width=".2em"/><mi>idf</mi>${u.mo("(")}${u.mi("w", HUE.query)}${u.mo(")")}<mo>·</mo>` +
      u.mfrac(`<mi>tf</mi><mo>·</mo><mo>(</mo><msub><mi>k</mi><mn>1</mn></msub><mo>+</mo><mn>1</mn><mo>)</mo>`, `<mi>tf</mi><mo>+</mo><msub><mi>k</mi><mn>1</mn></msub><mo>·</mo><mo>(</mo><mn>1</mn><mo>−</mo><mi>b</mi><mo>+</mo><mi>b</mi><mo>·</mo><mfrac><mi>len</mi><mi>avg</mi></mfrac><mo>)</mo>`),
    voice: `BM25 gives each hit a text score. A rare word counts more, through its idf. A repeated word helps less and less, so five times best is not five times better. With the query best cafe, the stuffed blog still wins here.`,
  },
  {
    name: "PageRank",
    math: `${pr("p")}<mo>=</mo>${u.mfrac(`<mn>1</mn><mo>−</mo><mi>d</mi>`, `<mi>N</mi>`)}<mo>+</mo><mi>d</mi><munder><mo>∑</mo><mrow><mi>q</mi><mo>→</mo><mi>p</mi></mrow></munder>${u.mfrac(pr("q"), `<mi>out</mi>${u.mo("(")}<mi>q</mi>${u.mo(")")}`)}${sp}<mi>d</mi><mo>=</mo><mn>0.85</mn>`,
    voice: `So the engine also asks which pages other pages point to. PageRank starts every page with the same rank. In each round, a page splits its rank evenly across its links. After a few rounds, the numbers stop moving. Click a page to see where its rank comes from.`,
  },
  {
    name: "Rank",
    math: `${u.mi("score", HUE.score)}${u.mo("(")}<mi>p</mi>${u.mo(")")}<mo>=</mo>${text("p")}<mo>·</mo><mi>N</mi><mo>·</mo>${pr("p")}`,
    voice: `The final score multiplies the text score by the link score. A link score of 1 means an average page. With best cafe, the real cafe now beats the stuffed blog. Real Google mixes hundreds of signals like these with learned models.`,
  },
];

// Narrow layout: the graph on top, then the panel of the scene, then the code.
const PH = [126, 270, 270, 240, 262, 286];
const NG = 0.8;
const NSIDE = 374;
const nCode = PH.map((h) => NSIDE + h + 14);
const nH = nCode.map((y) => y + 166);

const fade = `transition:opacity var(--u-fade,.5s) var(--anatomy-ease) var(--u-fade-at,.22s)`;
const css = [
  `.el-side{transform:translate(${SIDE_X}px,4px)}.el-codeg{transform:translate(${SIDE_X}px,298px)}`,
  `.u-stage[data-narrow] .el-graph{transform:translate(${(400 - 400 * NG) / 2}px,4px) scale(${NG})}`,
  `.u-stage[data-narrow] .el-side{transform:translate(10px,${NSIDE}px)}`,
  ...nCode.map((y, i) => `.u-stage[data-narrow][data-scene="${i}"] .el-codeg{transform:translate(10px,${y}px)}`),
  `.el-graph,.el-side,.el-codeg{transition:transform .5s var(--anatomy-ease)}`,
  `.el-p{opacity:0;pointer-events:none;--u-fade:.22s;--u-fade-at:0s;${fade}}`,
  ...[[0, "el-p0"], [1, "el-p12"], [2, "el-p12"], [3, "el-p3"], [4, "el-p4"], [5, "el-p5"]].map(([i, c]) => `.u-stage[data-scene="${i}"] .${c}{opacity:1;pointer-events:auto;--u-fade:.5s;--u-fade-at:.22s}`),
  // Graph
  `.el-edge .u-arrow{transition:opacity .35s,color .35s}`,
  `.el-ghost{fill:none;stroke:var(--anatomy-lo);stroke-width:1;stroke-dasharray:3 4;opacity:0;transition:opacity .35s}`,
  `.el-edge[data-off] .u-arrow{opacity:0}.el-edge[data-off] .el-ghost{opacity:.8}`,
  `.el-edge[data-on] .u-arrow{color:var(--unfold-blue);--w:2.4}`,
  `.el-edge[data-in] .u-arrow{color:var(--unfold-green);--w:2.4}`,
  `.el-edge[data-dim] .u-arrow{opacity:.3}`,
  `.el-hit{stroke:transparent;stroke-width:14;fill:none;cursor:pointer}`,
  `.el-edge:hover .el-ghost{opacity:1}.el-edge:hover .u-arrow{--w:2.4}`,
  `.el-node{cursor:pointer;transition:opacity .4s}`,
  `.el-body{transform:scale(var(--s,1));transition:transform .6s var(--anatomy-ease)}`,
  `.el-box{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1.3;transition:fill .35s,stroke .35s,stroke-width .35s}`,
  `.el-name{font:600 13px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}`,
  `.el-ring{fill:none;stroke:var(--anatomy-strong);stroke-width:1.2;opacity:0;transition:opacity .3s}`,
  `.el-node[data-focus] .el-ring{opacity:1}`,
  `.el-node[data-st="unknown"] .el-box,.el-node[data-st="wait"] .el-box{stroke-dasharray:4 3;stroke:var(--anatomy-lo)}`,
  `.el-node[data-st="unknown"] .el-name,.el-node[data-st="wait"] .el-name{fill:var(--anatomy-muted)}`,
  `.el-node[data-st="missing"]{opacity:.45}.el-node[data-st="missing"] .el-box{stroke-dasharray:4 3}`,
  `.el-node[data-st="front"] .el-box{stroke:var(--unfold-yellow);stroke-width:2}`,
  `.el-node[data-st="hit"] .el-box{stroke:var(--unfold-teal);stroke-width:2;fill:color-mix(in srgb,var(--unfold-teal) 14%,var(--anatomy-card))}`,
  `.el-node[data-st="link"] .el-box{stroke:var(--unfold-green);stroke-width:2;fill:color-mix(in srgb,var(--unfold-green) 16%,var(--anatomy-card))}`,
  `.el-node[data-st="miss"]{opacity:.4}`,
  `.el-node[data-cur] .el-box{stroke:var(--unfold-blue);stroke-width:3.2}`,
  `.el-val{font:600 12px var(--anatomy-mono);dominant-baseline:central;fill:var(--anatomy-muted);font-variant-numeric:tabular-nums}`,
  // Panels
  `.el-th{font:500 11px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-left{text-anchor:start}.el-lnk{fill:var(--unfold-green)}.el-txt{fill:var(--unfold-purple)}`,
  `.el-rule{stroke:var(--anatomy-faint);stroke-width:.8}`,
  `.el-slot{fill:none;stroke:var(--anatomy-faint);stroke-width:.8;stroke-dasharray:3 3}`,
  `.el-cc{transition:transform .6s var(--anatomy-ease),opacity .4s}`,
  `.el-cc .u-chip text{font-size:12px}`,
  `.el-cc .u-chip rect{fill:color-mix(in srgb,var(--hue,var(--anatomy-mid)) 14%,var(--anatomy-card))}`,
  `.el-word{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.el-ix{transition:opacity .35s}.el-ix-bg{fill:transparent;transition:fill .3s}`,
  `.el-ix[data-empty] .el-word{fill:var(--anatomy-lo)}`,
  `.u-stage[data-scene="2"] .el-ix:not([data-q]){opacity:.28}`,
  `.el-ix[data-q] .el-word{fill:var(--unfold-teal);font-weight:700}`,
  `.el-ix[data-q] .el-ix-bg{fill:color-mix(in srgb,var(--unfold-teal) 12%,transparent)}`,
  `.el-post{transition:opacity .3s}.el-post[hidden]{display:none}`,
  `.el-post .u-chip text{font-size:10.5px}`,
  `.el-post .u-chip[data-hue] rect{fill:color-mix(in srgb,var(--hue) 16%,var(--anatomy-card))}`,
  `.el-term{fill:var(--unfold-teal);font-weight:700}`,
  `.el-idf,.el-sl,.el-sp,.el-st,.el-pv,.el-px,.el-sn,.el-pn{font:500 12px var(--anatomy-mono);dominant-baseline:central;font-variant-numeric:tabular-nums}`,
  `.el-idf,.el-sl,.el-sp,.el-st,.el-px{text-anchor:middle}`,
  `.el-idf{fill:var(--anatomy-muted)}.el-sn,.el-pn{fill:var(--anatomy-strong)}.el-sl,.el-sp{fill:var(--anatomy-text)}`,
  `.el-st{fill:var(--unfold-purple);font-weight:700}`,
  `.el-sr{transition:opacity .3s}.el-sr[data-wait]{opacity:.3}.el-sr[hidden]{display:none}`,
  `.el-sr-bg,.el-pr-bg{fill:transparent;stroke:none;transition:fill .3s}`,
  `.el-sr[data-cur] .el-sr-bg{fill:color-mix(in srgb,var(--unfold-blue) 16%,transparent)}`,
  `.el-sr[data-focus] .el-sr-bg,.el-pr[data-focus] .el-pr-bg{stroke:var(--anatomy-strong);stroke-width:1}`,
  `.el-none{font:12px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;opacity:0}.el-p3[data-none] .el-none{opacity:1}`,
  `.el-bar{fill:var(--unfold-green);fill-opacity:.75;transition:width .45s var(--anatomy-ease)}`,
  `.el-pv{fill:var(--anatomy-strong);transition:transform .45s var(--anatomy-ease)}.el-px{fill:var(--anatomy-muted)}`,
  `.el-pr[data-missing]{opacity:.35}`,
  `.el-dl{fill:var(--unfold-green);fill-opacity:.6;transition:height .3s,y .3s}`,
  `.el-dlv{font:500 11px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:end;dominant-baseline:central}`,
  `.el-res{transition:transform .7s var(--anatomy-ease),opacity .4s}`,
  `.el-rk{font:700 15px var(--anatomy-mono);fill:var(--unfold-gold)}`,
  `.el-rt{font:600 14px var(--anatomy-sans,system-ui);fill:var(--anatomy-strong);dominant-baseline:central}`,
  `.el-ru{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.el-rs{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.el-rs tspan[data-c="text"]{fill:var(--unfold-purple)}.el-rs tspan[data-c="link"]{fill:var(--unfold-green)}.el-rs tspan[data-c="score"]{fill:var(--unfold-gold);font-weight:700}`,
  `.el-res[data-focus] .el-rt{text-decoration:underline}`,
  // Controls
  `.u-ctl label{display:inline-flex;align-items:center;gap:6px;color:var(--anatomy-muted);font:11px var(--anatomy-mono)}`,
  `.u-ctl input[type=text]{width:150px}`,
  // Narrow: larger type in the panels and the code
  `.u-stage[data-narrow] :is(.el-idf,.el-sl,.el-sp,.el-st,.el-pv,.el-px,.el-sn,.el-pn,.el-word,.el-rs){font-size:13.5px}`,
  `.u-stage[data-narrow] .el-th{font-size:12.5px}.u-stage[data-narrow] .el-post .u-chip text{font-size:11.5px}`,
  `.u-stage[data-narrow] .u-line-text{font-size:12px}.u-stage[data-narrow] .el-val{font-size:14px}.u-stage[data-narrow] .el-name{font-size:14.5px}`,
].join("\n");

const key = u.keyHtml([
  { hue: HUE.cur, label: "now" },
  { hue: HUE.front, label: "frontier" },
  { hue: HUE.query, label: "query word, hit" },
  { hue: HUE.text, label: "text score" },
  { hue: HUE.link, label: "link score" },
  { hue: HUE.score, label: "final score" },
]);

const PRESETS = ["best cafe", "brew coffee", "green tea"];
const controls =
  `<label data-scenes="2 3 5">query <input type="text" id="el-q" maxlength="40" value="${m.QUERY}" spellcheck="false" autocomplete="off"></label>` +
  `<span data-scenes="2 3 5">${PRESETS.map((q) => `<button type="button" data-q="${q}">${q}</button>`).join("")}</span>` +
  `<button type="button" id="el-reset">reset</button>`;

const stage = u.stageHtml({
  audio: await u.narrate(scenes, { dir: join(HERE, "voice") }),
  dwell: 7000,
  scenes,
  svg,
  label: "Search engine explainer. Click a link arrow to remove or restore it. Click a page to focus it. Type a query in the field. Left and right arrows change the chapter. Comma and period step through the run.",
  css,
  key,
  time: { steps: run.steps.length },
  controls,
  narrow: [400, nH],
});

const live = `
${u.modelScript([m.round, m.tokenize, m.queryTerms, m.crawl, m.buildIndex, m.bm25, m.pagerank, m.solvePagerank, m.rank, m.search, m.codeLine], { PAGES: m.PAGES, LINKS0: m.LINKS, SEED: m.SEED, QUERY0: m.QUERY, STOP: m.STOP, K1: m.K1, B: m.B, DAMP: m.DAMP, TOL: m.TOL, MAX_TERMS: m.MAX_TERMS, VOCAB, PR_X, PR_W, PR_MAX })}
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const $ = (s) => root.querySelector(s);
const all = (s) => [...root.querySelectorAll(s)];
const NAME = (p) => PAGES[p].name;
const f2 = (v) => v.toFixed(2), f3 = (v) => v.toFixed(3);
let on = LINKS0.map(() => true);
let query = QUERY0;
let focus = 4;
let R, step = 0, crossing = false;
const nodeEl = all(".el-node"), edgeEl = all(".el-edge"), ccEl = all(".el-cc"), ixEl = all(".el-ix");
const srEl = all(".el-sr"), prEl = all(".el-pr"), resEl = all(".el-res"), dlEl = all(".el-dl");
const codeEl = $("#el-code");
const links = () => LINKS0.filter((_, e) => on[e]);
const chapter = (t) => R.ranges.findIndex(([a, b]) => t >= a && t <= b);
function recompute() { R = search(links(), query); }
// The PageRank values after the round shown at step t (round 0 before the PR chapter).
const prAt = (t) => { const s = R.steps[Math.max(t, R.ranges[4][0])]; return s.kind === "pr" ? s.pr : R.P.pr; };
function setVal(k, text, hue) {
  const el = nodeEl[k].querySelector(".el-val");
  el.textContent = text;
  el.style.fill = hue ? "var(--unfold-" + hue + ")" : "";
}
function say(s, t, ch) {
  const head = "step " + t + " \\u00b7 ";
  if (s.kind === "seed") return head + "frontier = [" + NAME(s.page) + "], the seed page";
  if (s.kind === "fetch") return head + "fetch " + NAME(s.page) + ": links to " + (s.out.map(NAME).join(", ") || "nothing") + (s.added.length ? " \\u00b7 new: " + s.added.map(NAME).join(", ") : " \\u00b7 nothing new");
  if (s.kind === "index") {
    const words = Object.entries(s.index).filter(([, l]) => l.some(([p]) => p === s.page)).map(([w, l]) => w + " " + l.find(([p]) => p === s.page)[1]);
    return head + "index " + NAME(s.page) + ": " + words.join(", ");
  }
  if (s.kind === "lookup") return head + "look up \\u201c" + s.term + "\\u201d: " + (s.postings.length ? s.postings.map(([p, n]) => NAME(p) + " " + n).join(", ") : "no page has it");
  if (s.kind === "hits") return head + (R.terms.length ? "hits: " + (s.hits.map(NAME).join(", ") || "none") : "the query has no words to look up");
  if (s.kind === "score") {
    const x = R.bm.scores.find((y) => y.page === s.page);
    if (!x) return head + "no hits, so nothing to score";
    return head + NAME(x.page) + ": " + x.parts.filter((p) => p.tf).map((p) => p.w + " " + f2(R.bm.idf[p.w]) + "\\u00d7" + f2(p.tfp) + "=" + f2(p.part)).join(" + ") + " = " + f2(x.text);
  }
  if (s.kind === "pr") {
    if (s.iter === 0) return head + "round 0 \\u00b7 every pr = 1/" + R.fetched.length + " = " + f3(1 / R.fetched.length);
    if (!R.fetched.includes(focus)) return head + "round " + s.iter + " \\u00b7 " + NAME(focus) + " was never crawled";
    const before = R.steps[t - 1].pr;
    const ins = links().filter(([a, b]) => b === focus && R.fetched.includes(a)).map(([a]) => f3(before[a]) + "/" + R.P.out[a]);
    const n = R.fetched.length;
    // A page with no links out spreads its rank over all n pages.
    const sink = R.fetched.filter((q) => !R.P.out[q]).reduce((a, q) => a + before[q], 0);
    if (sink) ins.push(f3(sink) + "/" + n);
    return head + "round " + s.iter + " \\u00b7 pr(" + NAME(focus) + ") = " + f3((1 - DAMP) / n) + " + " + DAMP + "\\u00b7(" + (ins.join(" + ") || "0") + ") = " + f3(s.pr[focus]);
  }
  const x = R.results.find((y) => y.page === focus) || R.results[0];
  if (!x) return "no hits, so the results page is empty";
  return NAME(x.page) + ": text " + f2(x.text) + " \\u00d7 link " + f2(x.link) + " = " + f2(x.score) + " \\u00b7 link = " + R.fetched.length + " \\u00d7 pr " + f3(R.P.pr[x.page]);
}
function show(t) {
  step = Math.max(0, Math.min(R.steps.length - 1, t));
  const s = R.steps[step];
  const ch = chapter(step);
  const crawled = (k) => R.fetched.includes(k);
  // Crawl state at this step: the last crawl step at or before it.
  const cs = R.steps[Math.min(step, R.ranges[0][1])];
  const terms = ch === 2 ? R.terms.slice(0, s.kind === "hits" ? R.terms.length : s.upto + 1) : R.terms;
  const hitSet = new Set(ch === 2 && s.kind !== "hits" ? terms.flatMap((w) => (R.index[w] || []).map(([p]) => p)) : R.bm.hits);
  const prv = prAt(step);
  const maxPr = Math.max(...R.fetched.map((p) => prv[p]));
  const scored = ch === 3 ? R.bm.scores.slice(0, s.upto + 1) : R.bm.scores;
  const rankOf = new Map(R.results.map((x, i) => [x.page, i]));
  nodeEl.forEach((el, k) => {
    let st = "", val = "", hue = "", cur = false, sc = 1;
    if (ch === 0) {
      const fi = cs.fetched.indexOf(k);
      st = fi >= 0 ? "" : cs.frontier.includes(k) ? "front" : "unknown";
      val = fi >= 0 ? "#" + (fi + 1) : st === "front" ? "queued" : step === R.ranges[0][1] ? "not found" : "";
      hue = st === "front" ? "yellow" : "";
      cur = s.kind === "fetch" && s.page === k;
    } else if (!crawled(k)) {
      st = "missing"; val = "not found";
    } else if (ch === 1) {
      const done = R.fetched.indexOf(k) <= R.fetched.indexOf(s.page);
      st = done ? "" : "wait";
      val = done ? tokenize(PAGES[k].text).length + " words" : "";
      cur = s.page === k;
    } else if (ch === 2) {
      st = hitSet.has(k) ? "hit" : "miss"; val = hitSet.has(k) ? "hit" : "";
      hue = "teal";
    } else if (ch === 3) {
      const x = scored.find((y) => y.page === k);
      st = hitSet.has(k) ? "hit" : "miss"; val = x ? f2(x.text) : "";
      hue = "purple"; cur = s.page === k;
    } else if (ch === 4) {
      st = "link"; val = f3(prv[k]); hue = "green";
      sc = 0.62 + 0.62 * (prv[k] / maxPr);
    } else {
      const r = rankOf.get(k);
      st = r === undefined ? "miss" : "hit"; val = r === undefined ? "" : "#" + (r + 1) + " \\u00b7 " + f2(R.results[r].score);
      hue = "gold";
    }
    el.dataset.st = st;
    el.toggleAttribute("data-cur", cur);
    el.toggleAttribute("data-focus", k === focus && ch >= 3);
    el.style.setProperty("--s", sc);
    setVal(k, val, hue);
  });
  edgeEl.forEach((el, e) => {
    const [a, b] = LINKS0[e];
    el.toggleAttribute("data-off", !on[e]);
    el.toggleAttribute("data-on", on[e] && ch === 0 && s.kind === "fetch" && s.page === a);
    el.toggleAttribute("data-in", on[e] && ch === 4 && b === focus && crawled(a) && s.iter > 0);
    el.toggleAttribute("data-dim", ch === 4 && s.iter > 0 && b !== focus);
  });
  // Crawl chips
  ccEl.forEach((el, k) => {
    const fi = cs.fetched.indexOf(k), qi = cs.frontier.indexOf(k);
    const x = 6 + (fi >= 0 ? fi : qi >= 0 ? qi : cs.frontier.length) * 61;
    el.style.transform = "translate(" + x + "px," + (fi >= 0 ? 90 : 24) + "px)";
    el.style.opacity = fi >= 0 || qi >= 0 ? 1 : 0;
    el.querySelector(".u-chip").dataset.hue = s.kind === "fetch" && s.page === k ? "blue" : qi >= 0 ? "yellow" : "ink";
  });
  // Index rows
  const index = ch === 1 ? s.index : R.index;
  ixEl.forEach((el) => {
    const w = el.dataset.w, list = index[w] || [];
    el.toggleAttribute("data-empty", !list.length);
    el.toggleAttribute("data-q", ch === 2 && terms.includes(w));
    el.querySelectorAll(".el-post").forEach((pe, j) => {
      pe.toggleAttribute("hidden", j >= list.length);
      if (j >= list.length) return;
      const [p, n] = list[j];
      pe.querySelector("text").textContent = NAME(p) + " " + n;
      const c = pe.querySelector(".u-chip");
      const hue = ch === 1 && p === s.page ? "blue" : ch === 2 && terms.includes(w) ? "teal" : "";
      if (hue) c.dataset.hue = hue; else c.removeAttribute("data-hue");
    });
  });
  // Text score table
  root.querySelectorAll(".el-term").forEach((el, k) => (el.textContent = R.terms[k] || ""));
  root.querySelectorAll(".el-idf").forEach((el, k) => (el.textContent = R.terms[k] ? f2(R.bm.idf[R.terms[k]]) : ""));
  $(".el-p3").toggleAttribute("data-none", !R.bm.scores.length);
  $(".el-legend").setAttribute("y", 62 + Math.max(1, R.bm.scores.length) * 28 + 6);
  srEl.forEach((el, i) => {
    const x = R.bm.scores[i];
    el.toggleAttribute("hidden", !x);
    if (!x) return;
    el.querySelector(".el-sn").textContent = NAME(x.page);
    el.querySelector(".el-sl").textContent = x.len;
    el.querySelectorAll(".el-sp").forEach((c, k) => {
      const p = x.parts[k];
      c.textContent = !p ? "" : p.tf ? p.tf + "\\u2192" + f2(p.part) : "\\u2013";
    });
    const done = ch !== 3 || i <= s.upto;
    el.querySelector(".el-st").textContent = done ? f2(x.text) : "";
    el.toggleAttribute("data-wait", !done);
    el.toggleAttribute("data-cur", ch === 3 && s.page === x.page);
    el.toggleAttribute("data-focus", x.page === focus);
  });
  // PageRank table and the history of moves
  prEl.forEach((el, k) => {
    const c = crawled(k);
    el.toggleAttribute("data-missing", !c);
    el.toggleAttribute("data-focus", k === focus);
    const w = c ? (PR_W * prv[k]) / PR_MAX : 0;
    el.querySelector(".el-bar").setAttribute("width", Math.min(PR_W, w).toFixed(1));
    const pv = el.querySelector(".el-pv");
    pv.textContent = c ? f3(prv[k]) : "not crawled";
    pv.style.transform = "translateX(" + (c ? Math.min(PR_W, w) : 0).toFixed(1) + "px)";
    el.querySelector(".el-px").textContent = c ? f3(R.exact[k]) : "";
  });
  const it = ch === 4 ? s.iter : ch > 4 ? R.P.iters.length - 1 : 0;
  const deltas = R.P.iters.slice(1).map((x) => x.delta);
  const dmax = Math.max(1e-9, ...deltas);
  dlEl.forEach((el, i) => {
    const h = i < it && i < deltas.length ? Math.max(1, (40 * deltas[i]) / dmax) : 0;
    el.setAttribute("height", h.toFixed(1));
    el.setAttribute("y", (254 - h).toFixed(1));
  });
  $(".el-dlv").textContent = it ? "round " + it + ": " + deltas[it - 1].toFixed(4) + (deltas[it - 1] < TOL ? " < 0.001, stop" : "") : "round 0: start";
  // Results page
  resEl.forEach((el, k) => {
    const r = rankOf.get(k);
    el.style.opacity = r === undefined ? 0 : 1;
    el.style.transform = "translate(0px," + (20 + (r === undefined ? 5 : r) * 44) + "px)";
    el.toggleAttribute("data-focus", k === focus);
    if (r === undefined) return;
    const x = R.results[r];
    el.querySelector(".el-rk").textContent = r + 1;
    el.querySelector(".el-rs").innerHTML = '<tspan data-c="text">' + f2(x.text) + "</tspan> \\u00d7 " + '<tspan data-c="link">' + f2(x.link) + "</tspan> = " + '<tspan data-c="score">' + f2(x.score) + "</tspan>";
  });
  mark(codeEl, codeLine(s), ".u-line");
  UNFOLD.timeAt(step, R.steps.length);
  const text = say(s, step, ch);
  if (readout.textContent !== text) readout.textContent = text;
}
function stepTo(t) {
  show(t);
  const ch = chapter(step);
  if (ch !== UNFOLD.scene()) {
    crossing = true;
    UNFOLD.go(ch);
    crossing = false;
  }
  UNFOLD.pause();
}
root.addEventListener("unfold:scene", (e) => {
  if (!crossing) show(R.ranges[e.detail.scene][0]);
});
recompute();
root.addEventListener("unfold:layout", () => show(step));
const SPEED = [1100, 800, 1300, 1300, 650, 1500];
for (let sc = 0; sc < 6; sc++)
  UNFOLD.beat(sc, SPEED[sc], (n) => { const [a, b] = R.ranges[sc]; show(n < 0 ? b : Math.min(a + n, b)); }, 700, () => R.ranges[sc][1] - R.ranges[sc][0] + 1);
UNFOLD.onTime(stepTo);
// Live inputs: links, the query and the focus page. Each one reruns the model's own search().
const qEl = $("#el-q");
function redo() {
  UNFOLD.pause();
  recompute();
  show(R.ranges[UNFOLD.scene()][1]);
}
root.addEventListener("click", (e) => {
  const node = e.target.closest(".el-node");
  if (node) {
    UNFOLD.pause();
    focus = Number(node.dataset.i);
    return show(step);
  }
  const edge = e.target.closest(".el-edge");
  if (edge) {
    const i = Number(edge.dataset.e);
    on[i] = !on[i];
    return redo();
  }
  const pre = e.target.closest("[data-q]");
  if (pre && pre.tagName === "BUTTON") {
    query = pre.dataset.q;
    qEl.value = query;
    return redo();
  }
});
qEl.addEventListener("input", () => {
  query = qEl.value.slice(0, 40);
  redo();
});
$("#el-reset").addEventListener("click", () => {
  on = LINKS0.map(() => true);
  query = QUERY0;
  qEl.value = query;
  focus = 4;
  UNFOLD.pause();
  recompute();
  stepTo(0);
});
show(0);
`;

// ---- Notes under the card ----
const tfRows = [1, 2, 3, 5, 10, 50].map((tf) => [String(tf), m.round((tf * (m.K1 + 1)) / (tf + m.K1), 2).toFixed(2)]);
const notes = u.notesHtml([
  {
    title: "What real Google adds",
    html: `<p>Google does not publish its full ranking system. This table lists what Google documents in general terms.</p>`,
    table: {
      head: ["part", "this figure", "real Google"],
      rows: [
        ["crawl", "6 pages, breadth-first from one seed", "billions of URLs, sitemaps, robots.txt rules, revisit schedules, JavaScript rendering"],
        ["index", "one posting list per word", "word positions, compressed lists, split over many machines"],
        ["query", "exact words, any word is a hit", "spelling fixes, synonyms, meaning from neural models such as BERT"],
        ["text score", "BM25", "many text signals, combined by learned models"],
        ["link score", "PageRank, d = 0.85", "one signal among many, with spam and link-scheme checks"],
        ["final score", "text × N·pr", "hundreds of signals: freshness, location, page quality, and more"],
      ],
    },
  },
  {
    title: "Why repeats help less",
    html: `<p>For a page of average length, the BM25 tf part grows slowly and never passes k₁ + 1 = 2.2.</p>`,
    table: { head: ["tf (times the word appears)", "tf part"], rows: tfRows },
  },
  {
    title: "Checks",
    html: `<p>PageRank for the 6 pages with all 14 links, from three methods.</p>`,
    table: {
      head: ["page", "power iteration", "direct solve", "networkx"],
      rows: run.fetched.map((p) => [m.PAGES[p].name, m.round(run.P.pr[p], 3).toFixed(3), m.round(run.exact[p], 3).toFixed(3), m.NETWORKX ? m.NETWORKX[p].toFixed(3) : "not run"]),
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["crawler", "a program that fetches pages and follows their links"],
        ["frontier", "the queue of found pages not fetched yet"],
        ["inverted index", "for each word, the pages that hold it"],
        ["posting list", "one word's row in the index: page and count"],
        ["tf", "how many times a word appears in a page"],
        ["idf", "how rare a word is across all pages"],
        ["BM25", "a text score from tf, idf and page length"],
        ["PageRank", "a link score: rank flows along links"],
        ["d", "damping: the share of rank that follows links"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "How a search engine ranks pages",
    hint: "click a link: remove · a page: focus",
    readout: "step 0 · frontier = [home], the seed page",
    caption:
      "Six made-up pages, with texts and links chosen by hand. The blog repeats “best” and few pages link to it. BM25 rounds each value, so the sums add up by hand. PageRank runs in full precision and shows 3 places. It matches a direct solve and networkx, checked on 2026-11-04.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, light ? "google-search-light.html" : "google-search.html");
const title = "How a search engine ranks pages";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
