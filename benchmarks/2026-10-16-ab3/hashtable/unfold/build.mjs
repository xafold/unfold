import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const u = await import(pathToFileURL(join(homedir(), ".claude/skills/unfold/kit/concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
// A docs page follows the reader's system theme. --light writes the light page for the checks and the shots.
const theme = process.argv.includes("--light") ? "light" : "auto";

const W = 820;
const H = 446;
const run = m.hashRun(m.PRESET);
const ranges = m.sceneRanges(run);
const MAX_PUTS = 16;

// Colour identity.
const HUE = { key: "blue", index: "yellow", chain: "red", load: "gold", split: "purple" };

// ---- Left: the bucket array, top to bottom, with chains to the right ----
const Y0 = 30; // first row edge
const TH = 352; // rows share this height: 4 rows of 88, 8 of 44, 16 of 22
const CHIP = { x: 104, w: 50, h: 18, pitch: 62 };
const head =
  `<text class="el-th" x="20" y="12" text-anchor="end">i</text><text class="el-th" x="58" y="12" text-anchor="end">bits</text>` +
  `<text class="el-th" x="66" y="12">table[i] and its chain, oldest node first</text>`;
const rows = Array.from(
  { length: m.MAX_CAP },
  (_, k) =>
    `<g class="el-row" data-k="${k}" style="transform:translate(0px,${Y0 + 44 * (k % 4) + 22}px);opacity:${k < m.CAP0 ? 1 : 0}">` +
    `<rect class="el-row-bg" x="0" y="-10" width="470" height="20" rx="4"/>` +
    `<text class="el-ri" x="20">${k}</text><text class="el-rb" x="58">${k.toString(2).padStart(2, "0")}</text>` +
    `<rect class="el-slot" x="66" y="-8" width="26" height="16" rx="3"/><path class="el-null" d="M71 5L87 -5"/>` +
    `<text class="el-note" x="120">·</text></g>`,
).join("");
// One node per key. The page moves it to its bucket and chain place. Its pointer arrow comes from the left.
const nodes = Array.from(
  { length: m.MAX_KEYS },
  (_, id) =>
    `<g class="el-node" data-id="${id}" style="transform:translate(${CHIP.x}px,${Y0}px);opacity:0">` +
    `<path class="el-ptr" d="M-12 9H-4"/><path class="el-ptr-head" d="M0 9L-5 6V12Z"/>` +
    u.chip("", 0, 0, { w: CHIP.w, h: CHIP.h, rx: 4, i: id }) +
    `</g>`,
).join("");
const LOAD_Y = 404;
const loadBar =
  `<g class="el-load" data-hue="${HUE.load}" transform="translate(0 ${LOAD_Y})">` +
  `<text class="el-load-t" x="0" y="0">load α = size / n</text>` +
  `<rect class="el-bar-bg" x="0" y="12" width="470" height="10" rx="3"/><rect class="el-bar" x="0" y="12" width="0" height="10" rx="3"/>` +
  `<path class="el-tick" d="M${470 * m.LOAD} 8V26"/><text class="el-tick-t" x="${470 * m.LOAD}" y="38">0.75: grow above</text>` +
  `<text class="el-tick-t" x="0" y="38" text-anchor="start">0</text><text class="el-tick-t" x="470" y="38" text-anchor="end">1</text></g>`;

// ---- Right: the hash of the focus key, bit by bit; the code; the load history ----
const BITS = 27; // 5 letters keep hashCode below 2^27
const BX = 312; // x of bit 0 (right end)
const BP = 8.6;
const bitX = (b) => Math.round((BX - b * BP) * 10) / 10;
const bitRow = (cls, y, label) =>
  `<g class="el-bits ${cls}" transform="translate(0 ${y})"><text class="el-bl" x="0">${label}</text>` +
  Array.from({ length: BITS }, (_, b) => `<g class="el-bit" data-b="${b}"><rect x="${bitX(b) - 4}" y="-8" width="8.2" height="16" rx="2"/><text x="${bitX(b)}">0</text></g>`).join("") +
  `</g>`;
const hashPanel =
  `<g class="el-hash">` +
  `<text class="el-th" x="0" y="8" id="el-what">put</text>` +
  `<g id="el-kchip">${u.chip("cat", 54, -2, { w: 50, h: 20, rx: 4, hue: HUE.key })}</g>` +
  `<text class="el-hc" x="114" y="8" id="el-hc">hashCode = 98262</text>` +
  bitRow("el-b0", 34, "hashCode") +
  bitRow("el-b1", 52, "h >>> 16") +
  `<path class="el-xor" d="M78 62H316"/>` +
  bitRow("el-b2", 72, "h = xor") +
  `<g transform="translate(0 100)"><text class="el-iline" id="el-iline" x="0">i = h mod n</text></g>` +
  `</g>`;
const CODE_Y = 122;
const code = u.codeLines(m.CODE, { id: "el-code", y: CODE_Y, w: 320, lineH: 17.5, hue: HUE.key });
const CH = { x: 34, y: 344, w: 274, h: 72 };
const chart = u.plot({ id: "el-chart", x: CH.x, y: CH.y, w: CH.w, h: CH.h, xr: [0, MAX_PUTS], yr: [0, 1], xTicks: [0, 4, 8, 12, 16], yTicks: [0, 1], xName: "", yName: "" });
const chartSvg =
  `<g class="el-chartbox" data-hue="${HUE.load}">` +
  `<text class="el-th" x="0" y="${CH.y - 12}">load after each put</text>` +
  chart.svg +
  `<path class="el-thr" d="M${CH.x} ${chart.sy(0.75)}H${CH.x + CH.w}"/><text class="u-tick-label" x="${CH.x - 7}" y="${chart.sy(0.75) + 3.5}" text-anchor="end">0.75</text>` +
  `<polyline class="el-hist" points=""/><circle class="el-now" r="3.5" cx="${CH.x}" cy="${chart.sy(0)}"/>` +
  [0, 1].map((j) => `<g class="el-drop" data-j="${j}" style="opacity:0"><path d=""/><text x="0" y="0">copy 4</text></g>`).join("") +
  `<text class="el-th" x="${CH.x + CH.w}" y="${CH.y + CH.h + 28}" text-anchor="end">puts</text></g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "A hash table with chaining: a bucket array with chains of keys, the bits of the hash of one key, the put code, and the load history.",
  body: [`<g class="el-left">${head}${rows}${nodes}${loadBar}</g>`, `<g class="el-right">${hashPanel}${code}${chartSvg}</g>`],
});

// ---- Scenes: chapters of one run ----
const L = (name, v, places = 0) => u.mn(v, { live: name, places });
const k = (name) => `<mtext data-live="${name}">cat</mtext>`;
const hOf = (name, hue = HUE.key) => `${u.mi("h", hue)}${u.mo("(")}${k(name)}${u.mo(")")}`;
const MOD = `<mo lspace=".3em" rspace=".3em">mod</mo>`;
const s0 = run[1];
const scenes = [
  {
    name: "Hash",
    math: `${u.mi("h", HUE.key)}<mo>=</mo><mi>hashCode</mi>${u.mo("(")}${u.mi("k", HUE.key)}${u.mo(")")}<mo>⊕</mo>${u.mo("(")}<mi>hashCode</mi>${u.mo("(")}${u.mi("k", HUE.key)}${u.mo(")")}<mo>≫</mo><mn>16</mn>${u.mo(")")}<mo>=</mo>${L("h0", s0.h0)}<mo>⊕</mo>${L("hs", s0.h0 >>> 16)}<mo>=</mo>${L("h", s0.h)}`,
    say: `A hash function turns the <b data-hue="blue">key</b> into a number h. The last bits of h pick the <b data-hue="yellow">bucket</b>, so a key always lands in the same place.`,
  },
  {
    name: "Store",
    math: `${u.mi("i", HUE.index)}<mo>=</mo>${u.mi("h", HUE.key)}${MOD}<mi>n</mi><mo>=</mo>${L("h", s0.h)}${MOD}${L("n", 4)}<mo>=</mo>${u.mn(s0.i, { live: "i", places: 0, hue: HUE.index })}`,
    say: `A new key goes into the empty <b data-hue="yellow">bucket</b> at index i. A lookup computes the same i and goes straight there.`,
  },
  {
    name: "Collide",
    math: `${hOf("k")}${MOD}${L("n", 4)}<mo>=</mo>${hOf("kB", "")}${MOD}${L("n", 4)}<mo>=</mo>${u.mn(3, { live: "i", places: 0, hue: HUE.index })}`,
    say: `Two keys can get the same index. The new node then joins the end of the bucket's <b data-hue="red">chain</b>, and a lookup checks each key in it.`,
  },
  {
    name: "Full",
    math: `${u.mi("α", HUE.load)}<mo>=</mo><mfrac><mi>size</mi><mi>n</mi></mfrac><mo>=</mo><mfrac>${L("size", 4)}${L("n", 4)}</mfrac><mo>=</mo>${u.mn(1, { live: "load", places: 2, hue: HUE.load })}<mo data-live="cmp">&gt;</mo><mn>0.75</mn>`,
    say: `The <b data-hue="gold">load</b> α is the number of keys per bucket. When it passes 0.75, chains get long, so the table must grow.`,
  },
  {
    name: "Grow",
    math: `${prime("i")}<mo>=</mo>${u.mi("h", HUE.key)}${MOD}<mn>2</mn><mi>n</mi><mo>=</mo>${L("h", 0)}${MOD}${L("n2", 8)}<mo>=</mo>${u.mn(7, { live: "i2", places: 0, hue: HUE.index })}`,
    say: `The table doubles and copies every node to an array of 2n buckets. One more bit of h decides: the node stays at i or <b data-hue="purple">moves to i + n</b>.`,
  },
  {
    name: "Repeat",
    math: `<mfrac><mtext>nodes copied</mtext><mtext>puts</mtext></mfrac><mo>=</mo><mfrac>${L("copies", 11)}${L("puts", 7)}</mfrac><mo>=</mo>${u.mn(1.57, { live: "ratio", places: 2, hue: HUE.load })}`,
    say: `Each resize copies all keys, but resizes come less often as the table doubles. So a put does O(1) work on average.`,
  },
];
function prime(name) {
  return `<msup>${u.mi(name, HUE.index)}<mo>′</mo></msup>`;
}

const css = [
  `.el-right{transform:translate(500px,6px)}`,
  `.el-left,.el-right{transition:transform .5s var(--anatomy-ease)}`,
  `.u-stage[data-narrow] .el-right{transform:translate(12px,458px) scale(1.16)}`,
  `.u-stage[data-narrow] :is(.el-row-bg,.el-bar-bg){width:400px}`,
  `.el-th{font:500 11px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.el-row{transition:transform .8s var(--anatomy-ease),opacity .45s var(--anatomy-ease)}`,
  `.el-row text{font:500 12px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central;text-anchor:end;font-variant-numeric:tabular-nums}`,
  `.el-row .el-ri{fill:var(--anatomy-text)}`,
  `.el-row-bg{fill:transparent;transition:fill .3s}`,
  `.el-row[data-focus] .el-row-bg{fill:color-mix(in srgb,var(--unfold-yellow) 14%,transparent)}`,
  `.el-row[data-focus] :is(.el-ri,.el-rb){fill:var(--unfold-yellow)}`,
  `.el-slot{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:.9}`,
  `.el-row[data-focus] .el-slot{stroke:var(--unfold-yellow);stroke-width:1.6}`,
  `.el-null{stroke:var(--anatomy-lo);stroke-width:1;transition:opacity .3s}`,
  `.el-row[data-full] .el-null{opacity:0}`,
  `.el-row .el-note{text-anchor:start;font-size:11.5px;transition:opacity .3s}`,
  `.el-note[data-kind="chain"]{fill:var(--unfold-red)}`,
  `.el-note[data-kind="key"]{fill:var(--unfold-blue)}`,
  `.el-note[data-kind="split"]{fill:var(--unfold-purple)}`,
  `.el-note[data-kind="found"]{fill:var(--anatomy-strong)}`,
  `.el-node{transition:transform .8s var(--anatomy-ease),opacity .45s var(--anatomy-ease)}`,
  `.el-ptr{stroke:var(--anatomy-mid);stroke-width:1.1}.el-ptr-head{fill:var(--anatomy-mid)}`,
  `.el-node .u-chip text{font-size:12px;fill:var(--anatomy-strong)}`,
  `.el-node .u-chip rect{fill:var(--anatomy-card);stroke:var(--anatomy-mid)}`,
  `.el-node[data-hue] .u-chip rect{stroke:var(--hue);stroke-width:1.8;fill:color-mix(in srgb,var(--hue) 16%,var(--anatomy-card))}`,
  `.el-node[data-hue] :is(.el-ptr){stroke:var(--hue)}.el-node[data-hue] .el-ptr-head{fill:var(--hue)}`,
  `.el-node[data-cmp] .u-chip rect{stroke-dasharray:3 2;stroke:var(--anatomy-text)}`,
  `.el-node[data-found] .u-chip rect{stroke:var(--anatomy-strong);stroke-width:2.2}`,
  `.el-node:hover .u-chip rect{stroke-width:2.2}`,
  `.el-load-t{font:500 12px var(--anatomy-mono);fill:var(--hue);dominant-baseline:central}`,
  `.el-bar-bg{fill:none;stroke:var(--anatomy-faint);stroke-width:.8}`,
  `.el-bar{fill:color-mix(in srgb,var(--hue) 55%,transparent);transition:width .6s var(--anatomy-ease)}`,
  `.el-load[data-over] .el-bar{fill:var(--hue)}`,
  `.el-tick{stroke:var(--anatomy-strong);stroke-width:1.4;stroke-dasharray:3 2}`,
  `.el-tick-t{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-hc{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.el-bl{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.el-bit text{font:500 11px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:middle;dominant-baseline:central}`,
  `.el-bit rect{fill:transparent;stroke:none}`,
  `.el-bit[data-off] text{fill:var(--anatomy-lo)}`,
  `.el-bit[data-blank]{opacity:0}`,
  `.el-b2 .el-bit[data-idx] rect{fill:color-mix(in srgb,var(--unfold-yellow) 26%,transparent);stroke:var(--unfold-yellow);stroke-width:.8}`,
  `.el-b2 .el-bit[data-idx] text{fill:var(--anatomy-strong)}`,
  `.el-b2 .el-bit[data-split] rect{fill:color-mix(in srgb,var(--unfold-purple) 30%,transparent);stroke:var(--unfold-purple);stroke-width:1.2}`,
  `.el-b0 .el-bit[data-mix] text,.el-b1 .el-bit:not([data-blank]) text{fill:var(--unfold-blue)}`,
  `.el-xor{stroke:var(--anatomy-mid);stroke-width:.8}`,
  `.el-iline{font:500 13px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.el-iline .t-i{fill:var(--unfold-yellow);font-weight:700}.el-iline .t-s{fill:var(--unfold-purple);font-weight:700}`,
  `#el-kchip .u-chip rect{fill:color-mix(in srgb,var(--unfold-blue) 16%,var(--anatomy-card));stroke-width:1.6}#el-kchip .u-chip text{font-size:12px}`,
  `.el-thr{stroke:var(--anatomy-strong);stroke-width:1;stroke-dasharray:3 2}`,
  `.el-hist{fill:none;stroke:var(--hue);stroke-width:1.8;stroke-linejoin:round}`,
  `.el-now{fill:var(--hue)}`,
  `.el-drop{transition:opacity .3s}.el-drop text{font:11px var(--anatomy-mono);fill:var(--unfold-purple);text-anchor:start;dominant-baseline:central}.el-drop path{stroke:var(--unfold-purple);stroke-width:2.6;fill:none}`,
  `.el-chartbox .u-tick-label{font-size:10px}`,
  `.u-ctl input[type=text]{width:9ch}`,
  `.u-stage[data-narrow] .el-row text{font-size:13px}.u-stage[data-narrow] .el-th{font-size:12px}.u-stage[data-narrow] .el-node .u-chip text{font-size:13px}`,
].join("\n");

const key = u.keyHtml([
  { hue: HUE.key, label: "key now" },
  { hue: HUE.index, label: "index bits, bucket" },
  { hue: HUE.chain, label: "collision" },
  { hue: HUE.load, label: "load α" },
  { hue: HUE.split, label: "split bit, moved node" },
]);

const controls =
  `<label>key <input type="text" id="el-key" maxlength="${m.KEY_MAX_LEN}" placeholder="fox" autocomplete="off" spellcheck="false"></label>` +
  `<button type="button" id="el-put">insert</button><button type="button" id="el-get">look up</button><button type="button" id="el-reset">reset</button>`;

const stage = u.stageHtml({
  dwell: 7000,
  scenes,
  svg,
  label: "Hash table explainer. Type a key and press insert, or click a key in the table to look it up. Left and right arrows change the scene. Comma and period step through the run.",
  css,
  key,
  time: { steps: run.length },
  controls,
  narrow: [400, 970],
});

const live = `
${u.modelScript([m.hashCode, m.spread, m.validKey, m.hashRun, m.sceneRanges, m.lookup, m.codeLine], { CAP0: m.CAP0, LOAD: m.LOAD, MAX_KEYS: m.MAX_KEYS, MAX_CAP: m.MAX_CAP, KEY_MAX_LEN: m.KEY_MAX_LEN, PRESET: m.PRESET, MAX_PUTS, Y0, TH, CHIP, BITS, CH })}
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const $ = (s) => root.querySelector(s);
const all = (s) => [...root.querySelectorAll(s)];
const rowEl = all(".el-row"), nodeEl = all(".el-node"), codeEl = $("#el-code"), chartEl = $("#el-chart");
const field = $("#el-key");
let keys = PRESET.slice(), run, ranges, ids, step = 0, focus = null, crossing = false, timer = 0, notice = "";
const q = (s) => "\\u201c" + s + "\\u201d";
function recompute() {
  run = hashRun(keys);
  ranges = sceneRanges(run);
  ids = [...new Set(keys)];
}
const rowY = (k, n) => Y0 + (TH / n) * (k + 0.5);
const putsAt = (t) => run.slice(1, t + 1).filter((s) => s.kind !== "resize").length;
function where(table, key) {
  for (let i = 0; i < table.length; i++) { const p = table[i].indexOf(key); if (p >= 0) return [i, p]; }
  return null;
}
function bits(row, v, opts = {}) {
  const top = Math.max(0, 31 - Math.clz32(v));
  row.querySelectorAll(".el-bit").forEach((el) => {
    const b = Number(el.dataset.b);
    el.querySelector("text").textContent = (v >>> b) & 1;
    el.toggleAttribute("data-blank", b > top && !(opts.idx > b));
    el.toggleAttribute("data-off", !((v >>> b) & 1));
    el.toggleAttribute("data-idx", b < (opts.idx ?? 0));
    el.toggleAttribute("data-split", b === opts.split);
    el.toggleAttribute("data-mix", b >= 16);
  });
}
function show(t) {
  step = Math.max(0, Math.min(run.length - 1, t));
  const s = run[step], n = s.n, narrow = UNFOLD.narrow();
  const sc = UNFOLD.scene();
  const lookingUp = focus !== null;
  const firstMoved = s.kind === "resize" ? (s.moved.find((x) => x.to !== x.from) ?? s.moved[0]).key : null;
  const fk = focus ?? firstMoved ?? s.key ?? keys[0];
  const f = lookup(s.table, fk);
  const resize = s.kind === "resize";
  const old = resize ? s.old : n;
  const fromOf = new Map(resize ? s.moved.map((x) => [x.key, x.from]) : []);
  // Buckets: n rows share the height. A row that is new after a resize slides out of its twin i - n.
  rowEl.forEach((el, k) => {
    const on = k < n;
    el.style.transform = "translate(0px," + rowY(on ? k : k % n, n) + "px)";
    el.style.opacity = on ? 1 : 0;
    el.querySelector(".el-rb").textContent = k.toString(2).padStart(Math.log2(n), "0").slice(-Math.log2(n));
    el.toggleAttribute("data-focus", on && f.i === k);
    el.toggleAttribute("data-full", on && s.table[k].length > 0);
    const note = el.querySelector(".el-note");
    let text = "", kind = "";
    const len = on ? s.table[k].length : 0;
    if (lookingUp && f.i === k) {
      text = f.found ? "found: " + f.compares + (f.compares > 1 ? " compares" : " compare") : len ? "absent: " + f.compares + (f.compares > 1 ? " compares" : " compare") : "empty: absent";
      kind = "found";
    } else if (!lookingUp && on && (s.kind === "put" || s.kind === "dup") && s.i === k) {
      text = s.kind === "dup" ? "stored already" : s.pos > 0 ? "collision: chain of " + len : "was empty";
      kind = s.kind === "put" && s.pos > 0 ? "chain" : "key";
    } else if (!lookingUp && resize && on && len) {
      const movers = s.table[k].filter((x) => fromOf.get(x) !== k);
      text = movers.length ? "+" + old + ", from " + (k - old) : "stays";
      kind = movers.length ? "split" : "";
    }
    note.textContent = text;
    note.dataset.kind = kind;
    const pitch = Math.min(CHIP.pitch, ((narrow ? 400 : 470) - CHIP.x - 70) / Math.max(1, len));
    note.setAttribute("x", CHIP.x + Math.max(len, 0) * pitch + 2);
  });
  // Nodes: one per distinct key, placed in its bucket's chain. A key not stored yet fades in where it will go.
  nodeEl.forEach((el, id) => {
    const key = ids[id];
    if (key === undefined) return (el.style.opacity = 0);
    let at = where(s.table, key);
    const later = !at;
    if (later) {
      const h = spread(hashCode(key)), i = h & (n - 1);
      at = [i, s.table[i].length];
    }
    const [b, p] = at;
    const len = s.table[b].length + (later ? 1 : 0);
    const pitch = Math.min(CHIP.pitch, ((narrow ? 400 : 470) - CHIP.x - 70) / Math.max(1, len));
    el.style.transform = "translate(" + (CHIP.x + p * pitch) + "px," + (rowY(b, n) - CHIP.h / 2) + "px)";
    el.style.opacity = later ? 0 : 1;
    el.querySelector(".u-chip text").textContent = key;
    let hue = "";
    if (!lookingUp && key === s.key && (s.kind === "put" || s.kind === "dup")) hue = s.pos > 0 && s.kind === "put" ? "red" : "blue";
    if (!lookingUp && resize && fromOf.has(key) && fromOf.get(key) !== b) hue = "purple";
    if (lookingUp && key === fk) hue = "blue";
    if (hue) el.dataset.hue = hue; else el.removeAttribute("data-hue");
    el.toggleAttribute("data-cmp", lookingUp && b === f.i && (f.found ? p < f.compares - 1 : true));
    el.toggleAttribute("data-found", lookingUp && key === fk);
  });
  // The hash of the focus key, bit by bit. The index bits are the last log2(n) bits of h.
  const h0 = hashCode(fk), h = spread(h0), lg = Math.log2(n);
  $("#el-what").textContent = lookingUp ? "look up" : s.kind === "init" ? "next" : resize ? "move" : "put";
  $("#el-kchip text").textContent = fk;
  $("#el-hc").textContent = "hashCode = " + h0;
  bits($(".el-b0"), h0);
  bits($(".el-b1"), h0 >>> 16);
  bits($(".el-b2"), h, { idx: lg, split: resize ? Math.log2(old) : undefined });
  const iEl = $("#el-iline");
  const was = resize ? h & (old - 1) : -1;
  iEl.innerHTML = "i = " + h + " mod " + n + " = <tspan class='t-i'>" + f.i + "</tspan>" +
    (resize ? (f.i === was ? " <tspan class='t-s'>stays</tspan>" : " = " + was + " <tspan class='t-s'>+ " + old + "</tspan>") : "");
  // Load: the bar under the table, and the history in the chart.
  const load = $(".el-load");
  load.querySelector(".el-bar").setAttribute("width", Math.min(1, s.load) * (narrow ? 400 : 470));
  load.toggleAttribute("data-over", s.load > LOAD);
  load.querySelector(".el-load-t").textContent = "load \\u03b1 = size / n = " + s.size + " / " + n + " = " + s.load.toFixed(2) + (s.load > LOAD ? " > 0.75: grow" : "");
  $(".el-load .el-tick").setAttribute("d", "M" + (narrow ? 300 : 352.5) + " 8V26");
  $(".el-load .el-tick-t").setAttribute("x", narrow ? 300 : 352.5);
  load.querySelectorAll(".el-tick-t")[2].setAttribute("x", narrow ? 400 : 470);
  const pts = run.slice(0, step + 1).map((r, j) => plotAt(chartEl, Math.min(MAX_PUTS, putsAt(j)), r.load));
  $(".el-hist").setAttribute("points", pts.map((p) => p.join(",")).join(" "));
  const [cx, cy] = pts[pts.length - 1];
  $(".el-now").setAttribute("cx", cx);
  $(".el-now").setAttribute("cy", cy);
  const drops = run.slice(0, step + 1).map((r, j) => [r, j]).filter(([r]) => r.kind === "resize");
  all(".el-drop").forEach((el, j) => {
    const d = drops[j];
    el.style.opacity = d ? 1 : 0;
    if (!d) return;
    const [x, y] = plotAt(chartEl, putsAt(d[1]), d[0].load);
    const top = plotAt(chartEl, putsAt(d[1]), run[d[1] - 1].load)[1];
    el.querySelector("path").setAttribute("d", "M" + x + " " + top + "V" + y);
    const label = el.querySelector("text");
    label.setAttribute("x", x + 5);
    label.setAttribute("y", Math.max(top - 5, CH.y + 6));
    label.textContent = "copy " + d[0].size;
  });
  mark(codeEl, lookingUp ? -1 : codeLine(s), ".u-line");
  // The equation bar follows the same state.
  const other = s.table[f.i].find((x) => x !== fk) ?? fk;
  const puts = putsAt(step);
  setLive({
    h0, hs: h0 >>> 16, h, n, i: f.i, k: fk, kB: other,
    size: s.size, load: s.load, cmp: s.load > LOAD ? ">" : "\\u2264",
    n2: 2 * old, i2: h & (2 * old - 1), copies: s.moves, puts, ratio: puts ? s.moves / puts : 0,
  });
  UNFOLD.timeAt(step, run.length);
  const text = notice || say(s, f, fk);
  if (readout.textContent !== text) readout.textContent = text;
}
function say(s, f, fk) {
  const head = "step " + step + " \\u00b7 ";
  if (focus !== null) return "look up " + q(fk) + ": " + f.h + " mod " + s.n + " = " + f.i + ", " + (f.found ? "found after " : "absent after ") + f.compares + (f.compares === 1 ? " compare" : " compares");
  if (s.kind === "init") return head + "empty table: " + s.n + " buckets, grows above 0.75 \\u00d7 " + s.n + " = " + 0.75 * s.n + " keys";
  if (s.kind === "resize") {
    const mv = s.moved.filter((x) => x.to !== x.from).length;
    return head + "resize " + s.old + " \\u2192 " + s.n + ": copied " + s.size + " nodes, " + mv + " moved to i + " + s.old;
  }
  const base = head + "put " + q(s.key) + ": " + s.h + " mod " + s.n + " = " + s.i;
  if (s.kind === "dup") return base + ", stored already, size stays " + s.size;
  if (s.full) return head + "put " + q(s.key) + ": size " + s.size + " > 0.75 \\u00d7 " + s.n + " = " + 0.75 * s.n + ", so resize next";
  return base + (s.pos ? ", after " + q(s.table[s.i][s.pos - 1]) + ": collision" : ", bucket was empty");
}
function stepTo(t, keepFocus) {
  if (!keepFocus) focus = null;
  notice = "";
  show(t);
  const sc = UNFOLD.scene();
  const [a, b] = ranges[sc];
  if (step < a || step > b) {
    crossing = true;
    UNFOLD.go(ranges.findIndex((r) => step >= r[0] && step <= r[1]));
    crossing = false;
    show(step);
  }
}
root.addEventListener("unfold:scene", (e) => {
  if (crossing) return;
  focus = null;
  notice = "";
  show(ranges[e.detail.scene][0]);
});
root.addEventListener("unfold:layout", () => show(step));
recompute();
for (let sc = 0; sc < 6; sc++)
  UNFOLD.beat(sc, 1600, (j) => { const [a, b] = ranges[sc]; focus = null; show(j < 0 ? b : Math.min(a + j, b)); }, 900, () => ranges[sc][1] - ranges[sc][0] + 1);
UNFOLD.onTime((t) => { clearTimeout(timer); stepTo(t); });
// The verb: insert the reader's key into the current table. The model's own hashRun() runs again on all keys.
const readKey = () => field.value.trim().toLowerCase();
function insert() {
  UNFOLD.pause();
  clearTimeout(timer);
  const key = readKey();
  focus = null;
  if (!validKey(key)) { notice = "a key here is 1 to " + KEY_MAX_LEN + " letters a to z"; return show(step); }
  const size = run[run.length - 1].size;
  const puts = putsAt(run.length - 1);
  if (puts >= MAX_PUTS || (size >= MAX_KEYS && !keys.includes(key))) { notice = "this figure stops at " + MAX_KEYS + " keys: press reset"; return show(step); }
  notice = "";
  keys.push(key);
  recompute();
  let t = run.length - 1;
  const grows = run[t].kind === "resize";
  if (grows) t--;
  stepTo(t);
  UNFOLD.pause();
  // A put that passes 0.75 shows first. The resize after it follows, so the reader sees both.
  if (grows) timer = setTimeout(() => { stepTo(t + 1); UNFOLD.pause(); }, 1600);
  field.select();
}
function find(key) {
  UNFOLD.pause();
  if (!validKey(key)) { notice = "a key here is 1 to " + KEY_MAX_LEN + " letters a to z"; return show(step); }
  notice = "";
  focus = key;
  show(step);
}
$("#el-put").addEventListener("click", insert);
$("#el-get").addEventListener("click", () => find(readKey()));
field.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); insert(); } });
field.addEventListener("input", () => { const v = field.value.toLowerCase().replace(/[^a-z]/g, ""); if (v !== field.value) field.value = v; });
$("#el-reset").addEventListener("click", () => {
  UNFOLD.pause();
  clearTimeout(timer);
  keys = PRESET.slice();
  recompute();
  focus = null;
  notice = "";
  stepTo(run.length - 1);
  UNFOLD.pause();
});
// Click a key in the table to look it up. Click it again to clear the lookup.
root.addEventListener("click", (e) => {
  const node = e.target.closest(".el-node");
  if (!node) return;
  const key = ids[Number(node.dataset.id)];
  if (focus === key) { focus = null; UNFOLD.pause(); return show(step); }
  field.value = key;
  find(key);
});
show(0);
`;

// ---- Notes under the card ----
const kinds = u.notesHtml([
  {
    title: "Growth at real sizes",
    html: `<p>Copies per put stay near 2 at every size, so the whole cost of growing is O(1) per put on average.</p>`,
    table: {
      head: ["puts", "buckets n", "resizes", "nodes copied", "copies per put", "load α"],
      rows: m.GROWTH.map((g) => [g.puts.toLocaleString("en-US"), g.n.toLocaleString("en-US"), g.resizes, g.moves.toLocaleString("en-US"), g.perPut.toFixed(2), g.load.toFixed(2)]),
    },
  },
  {
    title: "Other hash tables",
    html: `<p>The figure follows Java's HashMap. Other languages store collisions in other ways. We ran the real tool for the Java row only.</p>`,
    table: {
      head: ["table", "collisions", "grows when", "checked"],
      rows: [
        ["Java <code>HashMap</code>", "chain per bucket. A chain of 8 or more becomes a red-black tree when n ≥ 64", "α &gt; 0.75, to 2n", "yes, Java 21"],
        ["Python <code>dict</code>", "open addressing: probe other slots by a fixed sequence", "about 2/3 full", "no"],
        ["C++ <code>unordered_map</code>", "chain per bucket", "α &gt; <code>max_load_factor</code> (1.0)", "no"],
        ["Go <code>map</code> (1.24 and later)", "Swiss table: groups of 8 slots, probe by group", "7/8 full", "no"],
        ["Rust <code>HashMap</code>", "Swiss table (hashbrown)", "7/8 full", "no"],
      ],
    },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["topic", "in Java"],
      rows: [
        ["remove", "unlinks the node from its chain. The table never shrinks."],
        ["same key again", "put replaces the value. The figure stores keys only."],
        ["bad hash codes", "many equal hashCode values make one long chain. Java then uses a tree."],
        ["first table", "<code>new HashMap&lt;&gt;()</code> starts at 16 buckets. The figure starts at 4."],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["key", "the value you store and look up"],
        ["hashCode", "a 32-bit number computed from the key"],
        ["h", "hashCode with its high 16 bits mixed in by xor"],
        ["bucket", "one slot of the array, holds a chain"],
        ["n", "number of buckets, always a power of 2"],
        ["i", "bucket index, h mod n, the last log₂ n bits of h"],
        ["chain", "linked list of the nodes in one bucket"],
        ["collision", "two keys with the same index i"],
        ["load α", "keys per bucket, size / n"],
        ["resize", "copy all nodes to a new array of 2n buckets"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Hash table: store, collide, grow",
    hint: "type a key, press insert · click a key to look it up",
    readout: "step 0 · empty table: 4 buckets, grows above 0.75 × 4 = 3 keys",
    caption: `The rules of Java's HashMap: 4 buckets to start, load factor 0.75, new nodes at the chain end. The 7 first keys were chosen by hand. Java 21 ran the same puts, and its own HashMap held the same buckets after every put.`,
    body: stage,
  }) + kinds;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "page-light.html" : "page.html");
const title = "Hash table: store, collide, grow";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
