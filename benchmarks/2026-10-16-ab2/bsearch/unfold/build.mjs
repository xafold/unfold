import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const u = await import(pathToFileURL(join(homedir(), ".claude/skills/unfold/kit/concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const light = process.argv.includes("--light");

const W = 820;
const H = 284;
const N = m.A.length;
const R0 = m.search(m.A, m.TARGET);
const ROWS = 5; // worst(16): the ladder never needs more rows

// Two layouts: desktop (820 wide) and narrow (400 wide, phones). The page script places everything from these.
const LAY = {
  d: { x0: 70, cw: 40, cy: 50, ch: 36, font: 15, lowY: 108, highY: 130, ladY: 178, rowH: 22, tgt: [4, 56], head: [70, 162], rowLabel: true },
  n: { x0: 16, cw: 23, cy: 60, ch: 30, font: 12, lowY: 116, highY: 138, ladY: 220, rowH: 21, tgt: [326, 182], head: [16, 198], rowLabel: false },
};
const D = LAY.d;
const cx = (i) => D.x0 + i * D.cw + D.cw / 2;

const cells = m.A.map(
  (v, i) =>
    `<g class="b-cell" data-i="${i}" data-st="in"><rect x="${D.x0 + i * D.cw + 1}" y="${D.cy}" width="${D.cw - 2}" height="${D.ch}" rx="3"/>` +
    `<text class="b-val" x="${cx(i)}" y="${D.cy + D.ch / 2}">${v}</text><text class="b-idx" x="${cx(i)}" y="${D.cy + D.ch + 12}">${i}</text></g>`,
).join("");

const pointer = (id, name, hue, y, x) =>
  `<g class="b-ptr" id="${id}" data-hue="${hue}" style="transform:translate(${x}px,${y}px)"><path d="M-5 6L0 0L5 6Z"/><rect x="-19" y="6" width="38" height="16" rx="8"/><text x="0" y="14">${name}</text></g>`;
const mid = `<g class="b-ptr b-mid" id="pMid" data-hue="gold" style="transform:translate(${cx(7)}px,0px);opacity:0"><text class="b-cmp" x="0" y="9"></text><rect x="-19" y="16" width="38" height="16" rx="8"/><text x="0" y="24">mid</text><path d="M-5 38L0 44L5 38Z"/></g>`;
const target = `<g id="tgt" data-hue="green" style="transform:translate(${D.tgt[0]}px,${D.tgt[1]}px)"><text class="b-tl" x="28" y="-6">target</text><rect width="56" height="24" rx="5"/><text class="b-tv" x="28" y="12">${m.TARGET}</text></g>`;

const ladderRows = Array.from(
  { length: ROWS },
  (_, k) =>
    `<g class="b-row" data-k="${k}" style="opacity:0"><text class="b-rk" x="${D.x0 - 10}" y="0">${k + 1}</text>` +
    `<rect class="b-bar" x="${D.x0}" y="-7" width="${N * D.cw}" height="14" rx="3"/><rect class="b-tick" x="${D.x0}" y="-7" width="${D.cw}" height="14" rx="2"/>` +
    `<text class="b-size" x="${D.x0}" y="0">16 cells</text></g>`,
).join("");
const ladder = `<g id="ladder"><text class="b-head" id="ladHead" x="${D.head[0]}" y="${D.head[1]}">range at each compare</text>${ladderRows}</g>`;

// Scene 5: how the most compares grows with n (bars on one scale, values from worst(n)).
const SB = { w: 130, h: 92, top: 30 };
const scale = `<g id="scaleG"><g id="scaleIn"><text class="b-head" x="0" y="8">most compares for n sorted cells</text>${m.SCALE.map((s, i) => {
  const h = (s.binary / 30) * SB.h;
  const x = i * (SB.w + 14);
  const n = { 16: "n = 16", 1000: "1,000", 1000000: "1 million", 1000000000: "1 billion" }[s.n];
  return `<g data-hue="purple"><rect class="b-sbar" x="${x}" y="${SB.top + SB.h - h}" width="${SB.w}" height="${h}" rx="3"/><text class="b-sval" x="${x + SB.w / 2}" y="${SB.top + SB.h - h - 7}">${s.binary}</text><text class="b-slab" x="${x + SB.w / 2}" y="${SB.top + SB.h + 15}">${n}</text></g>`;
}).join("")}<text class="b-note" x="${2 * (SB.w + 14)}" y="8">×1,000 cells: +10 compares</text></g></g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "Binary search on a sorted array of 16 numbers: low, mid and high pointers close in on the target, and a ladder shows the range halving at each compare.",
  body: [`<g id="arrG">${target}${cells}${pointer("pLow", "low", "blue", D.lowY, cx(0))}${pointer("pHigh", "high", "blue", D.highY, cx(N - 1))}${mid}<g id="drop" style="opacity:0"><path class="b-dropline" d=""/><text class="b-droptext" x="0" y="0">dropped</text></g></g>`, ladder, scale],
});

const { mi, mo } = u;
const mn = (x) => `<mn>${x}</mn>`;
const low = mi("low", "blue");
const high = mi("high", "blue");
const midM = mi("mid", "gold");
const t = mi("t", "green");
const amid = `<msub>${mi("a")}${midM}</msub>`;
const hue = (h, text) => `<b data-hue="${h}">${text}</b>`;
const scenes = [
  {
    name: "Sorted array",
    math: `<msub>${mi("a")}${mn(0)}</msub>${mo("≤")}<msub>${mi("a")}${mn(1)}</msub>${mo("≤")}${mo("⋯")}${mo("≤")}<msub>${mi("a")}${mn(15)}</msub>`,
    say: `The array is sorted from small to large. The search keeps two pointers, ${hue("blue", "low")} and ${hue("blue", "high")}, around the cells that can still hold the ${hue("green", "target")}.`,
  },
  {
    name: "Compare mid",
    math: `${midM}${mo("=")}<mrow>${mo("⌊")}${mo("(")}${low}${mo("+")}${high}${mo(")")}${mo("/")}${mn(2)}${mo("⌋")}</mrow>`,
    say: `The search reads the middle cell of the range, ${hue("gold", "mid")}, and compares it with the ${hue("green", "target")}. One compare tells which half can hold the target.`,
  },
  {
    name: "Drop a half",
    math: `<mtable columnalign="left"><mtr><mtd>${amid}${mo("&lt;")}${t}${mo("⇒")}${low}${mo("=")}${midM}${mo("+")}${mn(1)}</mtd></mtr><mtr><mtd>${amid}${mo("&gt;")}${t}${mo("⇒")}${high}${mo("=")}${midM}${mo("−")}${mn(1)}</mtd></mtr></mtable>`,
    say: `The array is sorted, so if a[mid] is too small, every cell left of it is too small. One compare drops mid and that whole half.`,
  },
  {
    name: "Close in",
    math: `<mtext>repeat while</mtext><mspace width=".4em"/>${low}${mo("≤")}${high}`,
    say: `The search repeats compare and drop until a[mid] equals the ${hue("green", "target")}. If low passes high first, no cell is left, so the target is not in the array.`,
  },
  {
    name: "Why log₂ n",
    math: `<mfrac>${mi("n")}<msup>${mn(2)}${mi("k")}</msup></mfrac>${mo("≥")}${mn(1)}${mo("⇒")}${mi("k")}${mo("≤")}<msub>${mi("log")}${mn(2)}</msub>${mi("n")}`,
    say: `Each compare leaves at most half of the range, so 16 cells need at most 5 compares. ${hue("purple", "1,000 times more cells")} add only 10 compares.`,
  },
];

const css = [
  `.b-cell rect{fill:var(--anatomy-card);stroke:var(--anatomy-lo);stroke-width:1;transition:fill .35s,stroke .35s,opacity .35s}`,
  `.b-cell{transition:opacity .4s}`,
  `.b-cell[data-st="in"] rect{fill:color-mix(in srgb,var(--unfold-blue) 14%,var(--anatomy-card));stroke:var(--unfold-blue)}`,
  `.b-cell[data-st="out"]{opacity:.32}`,
  `.b-cell[data-st="mid"] rect{fill:color-mix(in srgb,var(--unfold-gold) 22%,var(--anatomy-card));stroke:var(--unfold-gold);stroke-width:2.2}`,
  `.b-cell[data-st="hit"] rect{fill:color-mix(in srgb,var(--unfold-green) 30%,var(--anatomy-card));stroke:var(--unfold-green);stroke-width:2.4}`,
  `.b-val{font:600 15px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}`,
  `.b-idx{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.b-ptr{transition:transform .5s var(--anatomy-ease),opacity .3s}`,
  `.b-ptr path{fill:var(--hue)}`,
  `.b-ptr rect{fill:color-mix(in srgb,var(--hue) 18%,var(--anatomy-card));stroke:var(--hue)}`,
  `.b-ptr text{font:11px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;dominant-baseline:central}`,
  `.b-ptr .b-cmp{font:600 12px var(--anatomy-mono);fill:var(--anatomy-strong)}`,
  `#drop{transition:opacity .35s}`,
  `.b-dropline{fill:none;stroke:var(--anatomy-muted);stroke-width:1.2}`,
  `.b-droptext{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle}`,
  `#tgt{transition:transform .4s}`,
  `#tgt rect{fill:color-mix(in srgb,var(--hue) 22%,var(--anatomy-card));stroke:var(--hue);stroke-width:1.5}`,
  `#tgt .b-tv{font:600 15px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;dominant-baseline:central}`,
  `#tgt .b-tl{font:10px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;letter-spacing:.06em;text-transform:uppercase}`,
  `.b-head{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.06em;text-transform:uppercase}`,
  `.b-row{transition:opacity .4s}`,
  `.b-bar{fill:color-mix(in srgb,var(--unfold-blue) 22%,var(--anatomy-card));stroke:var(--unfold-blue);stroke-width:1;transition:x .5s var(--anatomy-ease),width .5s var(--anatomy-ease)}`,
  `.b-tick{fill:var(--unfold-gold);transition:x .5s var(--anatomy-ease)}`,
  `.b-row[data-hit] .b-tick{fill:var(--unfold-green)}`,
  `.b-rk{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:end;dominant-baseline:central}`,
  `.b-size{font:11px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.b-size.b-inside{fill:var(--anatomy-strong);font-weight:600}`,
  `#ladHead,.b-row{transition:opacity .4s}`,
  `.u-stage[data-scene="0"] #ladder{opacity:.25}`,
  `#arrG{transition:opacity .5s}`,
  `.u-stage[data-scene="4"] #arrG{opacity:0;pointer-events:none}`,
  `#scaleG{opacity:0;transition:opacity .5s;pointer-events:none}`,
  `.u-stage[data-scene="4"] #scaleG{opacity:1}`,
  `#scaleIn{transform:translate(152px,4px)}`,
  `.u-stage[data-narrow] #scaleIn{transform:translate(16px,8px) scale(.64)}`,
  `.b-sbar{fill:color-mix(in srgb,var(--hue) 30%,var(--anatomy-card));stroke:var(--hue);stroke-width:1.2}`,
  `.b-sval{font:600 16px var(--anatomy-mono);fill:var(--hue);text-anchor:middle}`,
  `.b-note{font:600 11px var(--anatomy-mono);fill:var(--unfold-purple);letter-spacing:.04em}`,
  `.u-stage[data-narrow] .b-note{font-size:16px}`,
  `.b-slab{font:12px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:middle}`,
  `.u-stage[data-narrow] :is(.b-sval,.b-slab){font-size:19px}`,
  `.u-stage[data-narrow] #scaleIn .b-head{font-size:17px}`,
  `.u-stage[data-narrow] .b-idx{font-size:9px}`,
  `.u-stage[data-narrow] .b-val{font-size:12px}`,
  `.u-notes .b-code{white-space:pre;font:12.5px/1.55 var(--anatomy-mono);color:var(--anatomy-text);background:var(--anatomy-card);padding:12px 14px;border-radius:6px;overflow-x:auto;box-shadow:0 0 0 1px var(--anatomy-faint)}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "range: low to high (target can be here)" },
  { hue: "gold", label: "mid (the cell compared)" },
  { hue: "green", label: "target" },
  { hue: "purple", label: "most compares" },
]);

const controls =
  `<label>target <input type="number" id="tIn" min="${m.T_MIN}" max="${m.T_MAX}" step="1" value="${m.TARGET}"></label>` +
  `<button type="button" data-t="37">37 found</button><button type="button" data-t="79">79 most compares</button><button type="button" data-t="40">40 missing</button>`;

const stage = u.stageHtml({
  dwell: 7000,
  scenes,
  svg,
  label: "Binary search explainer. Left and right arrows change the scene. Up and down arrows, or comma and period, step through the search.",
  css,
  key,
  controls,
  controlScenes: [0, 1, 2, 3, 4], // every scene: this only gives the controls the kit's row wrapper
  time: { steps: R0.steps.length, scenes: [0, 1, 2, 3] },
  narrow: [400, 316],
});

const live = `
${u.modelScript([m.search], { A: m.A, T0: m.TARGET, LAY, ROWS })}
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const field = root.querySelector("#tIn");
const cellsEl = [...root.querySelectorAll(".b-cell")];
const rowsEl = [...root.querySelectorAll(".b-row")];
const pLow = root.querySelector("#pLow"), pHigh = root.querySelector("#pHigh"), pMid = root.querySelector("#pMid");
let t = T0, R = search(A, T0), step = 0, crossing = false;
const L = () => (UNFOLD.narrow() ? LAY.n : LAY.d);
const cx = (i) => L().x0 + i * L().cw + L().cw / 2;
const last = () => R.steps.length - 1;
const sceneStep = (s) => [0, 1, Math.min(2, last()), last(), last()][s];
const ownerScene = (k) => Math.min(k, 3);
const put = (el, x, y) => (el.style.transform = "translate(" + x + "px," + y + "px)");
function setText(el, s) { if (el.textContent !== s) el.textContent = s; }
function layout() {
  const l = L();
  cellsEl.forEach((g, i) => {
    const [r, v, ix] = g.children;
    r.setAttribute("x", l.x0 + i * l.cw + 1); r.setAttribute("width", l.cw - 2); r.setAttribute("y", l.cy); r.setAttribute("height", l.ch);
    v.setAttribute("x", cx(i)); v.setAttribute("y", l.cy + l.ch / 2);
    ix.setAttribute("x", cx(i)); ix.setAttribute("y", l.cy + l.ch + 12);
  });
  put(root.querySelector("#tgt"), l.tgt[0], l.tgt[1]);
  const head = root.querySelector("#ladHead");
  head.setAttribute("x", l.head[0]); head.setAttribute("y", l.head[1]);
  rowsEl.forEach((g, k) => { g.setAttribute("transform", "translate(0 " + (l.ladY + k * l.rowH) + ")"); g.querySelector(".b-rk").style.display = l.rowLabel ? "" : "none"; });
  show(step);
}
function show(k) {
  step = Math.max(0, Math.min(last(), k));
  const s = R.steps[step], l = L();
  const done = s.phase === "found" || s.phase === "missing";
  cellsEl.forEach((g, i) => {
    let st = i >= s.lo && i <= s.hi ? "in" : "out";
    if (s.phase === "compare" && i === s.mid) st = "mid";
    if (s.phase === "found" && i === s.mid) st = "hit";
    g.dataset.st = st;
  });
  const clamp = (x) => Math.max(20, Math.min((UNFOLD.narrow() ? 400 : 820) - 20, x));
  put(pLow, clamp(cx(s.lo)), l.lowY);
  put(pHigh, clamp(cx(s.hi)), l.highY);
  const showMid = s.phase === "compare" || s.phase === "found";
  pMid.style.opacity = showMid ? 1 : 0;
  if (s.mid >= 0) put(pMid, cx(s.mid), l.cy - 44);
  setText(pMid.querySelector(".b-cmp"), showMid ? A[s.mid] + " " + (s.cmp === "=" ? "=" : s.cmp) + " " + t : "");
  rowsEl.forEach((g, k) => {
    const r = R.rows[k];
    const on = r && step >= r.step;
    g.style.opacity = on ? 1 : 0;
    if (!r) return;
    const x = l.x0 + r.lo * l.cw, w = r.size * l.cw;
    const [, bar, tick, size] = g.children;
    bar.setAttribute("x", x); bar.setAttribute("width", w);
    tick.setAttribute("x", l.x0 + r.mid * l.cw); tick.setAttribute("width", l.cw);
    g.toggleAttribute("data-hit", R.index === r.mid);
    setText(size, r.size + (r.size === 1 ? " cell" : " cells"));
    // The size label sits right of the bar, else left of it, else inside its right end.
    const right = x + w + 6, edge = UNFOLD.narrow() ? 400 : 820;
    let at = [right, "start"];
    if (edge - right < 56) at = x - 6 > 60 ? [x - 6, "end"] : [x + w - 6, "end"];
    size.setAttribute("x", at[0]); size.setAttribute("text-anchor", at[1]);
    size.classList.toggle("b-inside", at[0] === x + w - 6);
  });
  // The half this step removed: from the old low to mid, or from mid to the old high.
  const drop = root.querySelector("#drop");
  const cut = s.phase === "narrow" || s.phase === "missing";
  drop.style.opacity = cut ? 1 : 0;
  if (cut) {
    const p = R.steps[step - 1];
    const [a, b] = s.cmp === "<" ? [p.lo, s.mid] : [s.mid, p.hi];
    const x1 = l.x0 + a * l.cw + 2, x2 = l.x0 + (b + 1) * l.cw - 2, y = l.cy - 8;
    drop.querySelector("path").setAttribute("d", "M" + x1 + " " + (y + 5) + "V" + y + "H" + x2 + "V" + (y + 5));
    const tx = drop.querySelector("text");
    tx.setAttribute("x", Math.max(36, Math.min((UNFOLD.narrow() ? 400 : 820) - 36, (x1 + x2) / 2))); tx.setAttribute("y", y - 6);
    setText(tx, b - a + 1 > 2 ? "dropped " + (b - a + 1) : "dropped");
  }
  setText(root.querySelector(".b-tv"), String(t));
  UNFOLD.timeAt(step, R.steps.length);
  const text = UNFOLD.scene() === 4
    ? "16 cells: at most \\u230alog\\u2082 16\\u230b + 1 = 5 compares. Target " + t + " used " + R.compares
    : "step " + step + " \\u00b7 " + s.say;
  setText(readout, text);
}
function stepTo(k) {
  show(k);
  const owner = ownerScene(step);
  if (UNFOLD.scene() !== owner) { crossing = true; UNFOLD.go(owner); crossing = false; show(step); }
  UNFOLD.pause();
}
function setTarget(v) {
  t = v; R = search(A, t);
  show(sceneStep(UNFOLD.scene()));
}
root.addEventListener("unfold:scene", (e) => { if (!crossing) show(sceneStep(e.detail.scene)); });
root.addEventListener("unfold:layout", layout);
UNFOLD.onTime(stepTo);
UNFOLD.beat(3, 1100, (n) => show(n < 0 ? last() : Math.min(n, last())), 500, 11);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined || e.target.closest("input")) return;
  e.preventDefault();
  stepTo(to);
});
field.addEventListener("input", () => {
  UNFOLD.pause();
  const v = Number(field.value);
  if (field.value === "" || !Number.isFinite(v)) return;
  setTarget(Math.round(Math.max(${m.T_MIN}, Math.min(${m.T_MAX}, v))));
});
field.addEventListener("change", () => { field.value = String(t); });
root.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { UNFOLD.pause(); field.value = b.dataset.t; setTarget(Number(b.dataset.t)); }));
layout();
`;

const notes = u.notesHtml([
  {
    title: "The loop in code",
    html: `<div class="b-code">${m.CODE.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`,
  },
  {
    title: "How the count grows",
    table: {
      head: ["cells n", "linear search, most compares", "binary search, most compares"],
      rows: m.SCALE.map((s) => [s.n.toLocaleString("en-US"), s.linear.toLocaleString("en-US"), String(s.binary)]),
    },
    html: `<p>The binary column is ⌊log₂ n⌋ + 1. A miss leaves at most ⌊n/2⌋ cells, so each compare at least halves the range.</p>`,
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["case", "what to know"],
      rows: [
        ["Unsorted array", "The search gives wrong answers. Sort first, or use a hash table."],
        ["Repeated values", "This loop returns any matching index, not the first."],
        ["Finding the first match", "Keep searching left after a hit (lower bound)."],
        ["Integer overflow", "In C or Java, low + high can overflow. Use low + (high − low) / 2."],
        ["Half-open range", "Many libraries use [low, high). The loop test becomes low &lt; high."],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["sorted", "each value is at least the value before it"],
        ["low, high", "the first and last index the target can still be at"],
        ["mid", "the middle index of the range, rounded down"],
        ["compare", "one check of a[mid] against the target"],
        ["⌊x⌋", "x rounded down to a whole number"],
        ["log₂ n", "how many times n halves before it reaches 1"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Binary search",
    hint: "← → scene · ↑ ↓ step",
    readout: "step 0 · " + R0.steps[0].say,
    caption:
      "A sorted array of 16 values, chosen by hand. The first target is 37. Every pointer, compare and count comes from running the search on this array. The code under the figure gives the same answer for every target from 0 to 99. Type any target, or pick a preset.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, light ? "page-light.html" : "page.html");
const html =
  artifact > 0
    ? u.artifactHtml({ title: "Binary search", body, script: live })
    : u.pageHtml({ title: "Binary search", theme: light ? "light" : "auto", body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
