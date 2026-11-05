import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const u = await import(pathToFileURL(join(homedir(), ".claude/skills/unfold/kit/concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const light = process.argv.includes("--light");
// A blog post: follow the reader's system theme. --light writes the light page for the checks and the judge.
const theme = light ? "light" : "auto";

const W = 820;
const H = 330;
const NS = 6;
const HUE = { range: "blue", mid: "yellow", t: "green", out: "red" };

// ---- Geometry (wide). Left column: the array and the ladder. Right column: target, code, result. ----
const X0 = 72; // left edge of cell 0
const CW = 28;
const CY = 52; // top of the cells
const CH = 32;
const LEVEL = 56; // tree: vertical gap per level
const ROW0 = 150; // first ladder row
const ROWH = 26;
const ROWS = m.maxProbes(m.N) + 1;
const cx = (i) => X0 + i * CW + CW / 2;

const cells = m.A.map(
  (v, i) =>
    `<g class="el-cell" data-i="${i}" style="--x:${X0 + i * CW}px;--d:${m.TREE.depth[i]}">` +
    `<rect class="el-box" x="1" y="0" width="${CW - 2}" height="${CH}" rx="4"/>` +
    `<path class="el-strike" d="M4 ${CH / 2 + 7}L${CW - 4} ${CH / 2 - 7}"/>` +
    `<text class="el-v" x="${CW / 2}" y="${CH / 2}">${v}</text>` +
    `<text class="el-ix" x="${CW / 2}" y="${CH + 12}">${i}</text>` +
    `<g class="el-ord"><text x="-6" y="${CH / 2}">1</text></g></g>`,
).join("");

// Tree links: parent bottom to child top, in tree coordinates. Shown in the tree scene only.
const links = m.TREE.parent
  .map((p, i) => {
    if (p < 0) return "";
    const y1 = CY + m.TREE.depth[p] * LEVEL + CH;
    const y2 = CY + m.TREE.depth[i] * LEVEL - 1;
    const x1 = cx(p) + (i < p ? -9 : 9);
    return `<path class="el-link" data-i="${i}" d="M${x1} ${y1}L${cx(i)} ${y2}"/>`;
  })
  .join("");
const counts = Array.from({ length: m.maxProbes(m.N) }, (_, d) => m.TREE.depth.filter((x) => x === d).length);
const tcols =
  `<text class="el-th" x="12" y="${CY - 14}">probe</text><text class="el-th" x="54" y="${CY - 14}">finds</text>` +
  counts.map((c, d) => `<g class="el-trow" data-d="${d}"><text x="12" y="${CY + d * LEVEL + CH / 2}">${d + 1}</text><text x="54" y="${CY + d * LEVEL + CH / 2}">${c}</text></g>`).join("");

const midp = `<g id="el-midp" class="el-midp" style="transform:translate(${cx(7)}px,0)"><g class="el-mlabel"><text y="${CY - 18}">35 &lt; 50</text></g><path class="el-tri" d="M-5 ${CY - 10}H5L0 ${CY - 3}Z"/></g>`;
const cutl = `<g id="el-cutl" class="el-cutl" style="transform:translate(${cx(3)}px,0)"><g><text y="${CY - 18}">all &lt; 50</text></g><path class="el-cutline" d="M-50 ${CY - 8}H50"/></g>`;
const BY = CY + CH + 25;
const bracket =
  `<path id="el-br" class="el-br" d="M${X0} ${BY - 5}V${BY}H${X0 + 16 * CW}V${BY - 5}"/>` +
  `<g class="el-lo"><text id="el-lo" x="${X0 - 4}" y="${BY}" text-anchor="end">lo</text></g><g class="el-hi"><text id="el-hi" x="${X0 + 16 * CW + 4}" y="${BY}" text-anchor="start">hi</text></g>`;
const ladderHead = `<text class="el-th" x="14" y="${ROW0 - 12}">left</text><text class="el-th" x="52" y="${ROW0 - 12}">16/2<tspan dy="-4" font-size="8">k</tspan></text>` +
  `<text class="el-th el-th-r" x="${X0 + 16 * CW}" y="${ROW0 - 12}">range after k probes</text>`;
const ladderRows = Array.from(
  { length: ROWS },
  (_, k) =>
    `<g class="el-row" data-k="${k}" transform="translate(0 ${ROW0 + k * ROWH})"><text class="el-rc" x="14" y="7">16</text><text class="el-rm" x="52" y="7">≤ ${Math.floor(m.N / 2 ** k)}</text>` +
    `<rect class="el-rbar" x="${X0}" y="0" width="${16 * CW}" height="14" rx="3"/><path class="el-rzero" d="M${X0} -2V16"/><circle class="el-rdot" cx="${cx(7)}" cy="7" r="4"/></g>`,
).join("");

// The probe count: one slot per probe the worst case needs. The run fills them as it probes.
const BUD = 314;
const budget =
  `<text class="el-th el-th-l" x="0" y="${BUD}">probes</text>` +
  Array.from({ length: m.maxProbes(m.N) }, (_, k) => `<rect class="el-slot" data-k="${k}" x="${X0 + k * 24}" y="${BUD - 8}" width="18" height="16" rx="3"/>`).join("") +
  `<text id="el-budt" class="el-budt" x="${X0 + m.maxProbes(m.N) * 24 + 8}" y="${BUD}">0 of at most 5</text>`;
const code = u.codeLines(m.CODE, { id: "el-code", y: 44, w: 256, lineH: 19, hue: HUE.mid });
const right =
  `<text class="el-th el-th-l" x="0" y="21">target</text>${u.chip("t = 50", 50, 10, { w: 70, h: 22, rx: 6, hue: HUE.t, id: "el-tchip" })}` +
  `${code}<g class="el-res"><text id="el-res" x="8" y="${44 + 19 * m.CODE.length + 22}">search(a, 50) → …</text></g>`;

// ---- Scale scene: worst-case probes against n, on a log axis, and a table of real sizes ----
const P = u.plot({ id: "el-plot", x: 60, y: 30, w: 380, h: 250, xr: [0, 9], yr: [0, 32], xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], yTicks: [0, 10, 20, 30], yName: "probes", yHue: HUE.mid, origin: [0, 0] });
let stairs = "";
for (let k = 1; k <= 30; k++) {
  const [a, y] = P.at(Math.log10(2 ** (k - 1)), k);
  const [b] = P.at(Math.min(9, Math.log10(2 ** k)), k);
  stairs += `${k === 1 ? `M${a} ${y}` : `V${y}`}H${b}`;
}
const linear = Array.from({ length: 31 }, (_, i) => P.at((Math.log10(32) * i) / 30, 10 ** ((Math.log10(32) * i) / 30))).map(([a, b], i) => `${i ? "L" : "M"}${a} ${b}`).join("");
const pow = ["1", "10", "100", "10³", "10⁴", "10⁵", "10⁶", "10⁷", "10⁸", "10⁹"];
const xlab = pow.map((s, i) => `<text class="el-xl" x="${P.at(i, 0)[0]}" y="${P.at(i, 0)[1] + 15}">${s}</text>`).join("") + `<text class="el-xname" x="${P.at(4.5, 0)[0]}" y="${P.at(0, 0)[1] + 34}">n, sorted values (log scale)</text>`;
const [lx, ly] = P.at(Math.log10(32), 32);
const plotBox =
  `<g class="el-plotbox">${P.svg}<path class="el-stairs" d="${stairs}"/><path class="el-linear" d="${linear}"/>` +
  `<g class="el-lin-l"><text x="${lx + 8}" y="${ly + 10}">linear scan: n compares</text></g>${xlab}` +
  `<g id="el-pt" class="el-pt" style="transform:translate(${P.at(9, 30).join("px,")}px)"><circle r="5"/><g class="el-pt-l"><text x="-10" y="-12">30 probes</text></g></g></g>`;
const fmtN = (n) => n.toLocaleString("en-US");
const TX = [610, 700, 812];
const tableRows = m.SCALE.map((n, i) => `<g class="el-tr" transform="translate(0 ${30 + i * 26})"><text x="${TX[0]}">${fmtN(n)}</text><text class="el-tp" x="${TX[1]}">${m.SCALE_PROBES[i]}</text><text x="${TX[2]}">${fmtN(n)}</text></g>`).join("");
const tableBox =
  `<g class="el-tablebox" transform="translate(0 40)"><text class="el-th el-th-r" x="${TX[0]}" y="0">n</text><text class="el-th el-th-r el-th-p" x="${TX[1]}" y="0">probes</text><text class="el-th el-th-r" x="${TX[2]}" y="0">linear scan</text>` +
  `<path class="el-rule" d="M508 10H816"/>${tableRows}<path class="el-rule" d="M508 ${30 + 4 * 26 - 12}H816"/>` +
  `<g class="el-tr el-you" transform="translate(0 ${30 + 4 * 26 + 6})"><text id="el-yn" x="${TX[0]}">1,000,000,000</text><text id="el-yp" class="el-tp" x="${TX[1]}">30</text><text id="el-yl" x="${TX[2]}">1,000,000,000</text></g>` +
  `<text class="el-th el-th-r" x="${TX[2]}" y="${30 + 5 * 26 + 10}">worst case, probes counted</text></g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "Binary search on a sorted array of 16 numbers: the range from lo to hi, the probe at mid, the ladder of ranges, the Python code, the probe tree and a chart of probes against n.",
  body: [
    `<g class="el-L"><g id="el-links">${links}</g><g id="el-tcols">${tcols}</g><g id="el-ladder">${ladderHead}${ladderRows}</g><g id="el-budget">${budget}</g>` +
      `<g id="el-bracket">${bracket}</g><g id="el-cutg">${cutl}</g><g id="el-midg">${midp}</g><g id="el-arr">${cells}</g></g>`,
    `<g class="el-R"><g id="el-right">${right}</g></g>`,
    `<g id="el-scale"><g class="el-S1">${plotBox}</g><g class="el-S2">${tableBox}</g></g>`,
  ],
});

// ---- Scenes ----
const lo = u.mi("lo", HUE.range);
const hi = u.mi("hi", HUE.range);
const mid = u.mi("mid", HUE.mid);
const am = `<mi>a</mi>${u.mo("[")}${mid}${u.mo("]")}`;
const tt = u.mi("t", HUE.t);
const sp = `<mspace width="1.2em"/>`;
const fl = (x) => `<mrow><mo>⌊</mo>${x}<mo>⌋</mo></mrow>`;
const log2n = (n) => `<msub><mi>log</mi><mn>2</mn></msub><mspace width=".15em"/>${n}`;
const scenes = [
  {
    name: "Sorted",
    math: `${lo}<mo>=</mo><mn>0</mn>${sp}${hi}<mo>=</mo><mi>n</mi><mo>−</mo><mn>1</mn><mo>=</mo><mn>15</mn>`,
    say: `Binary search looks for a <b data-hue="green">target t</b> in a sorted array. The <b data-hue="blue">range</b> from lo to hi holds t, if t is in the array.`,
  },
  {
    name: "Probe",
    math: `${mid}<mo>=</mo>${fl(u.mfrac(`${lo}<mo>+</mo>${hi}`, "<mn>2</mn>"))}<mo>=</mo>${fl(u.mfrac("<mn>0</mn><mo>+</mo><mn>15</mn>", "<mn>2</mn>"))}<mo>=</mo><mn>7</mn>`,
    say: `Each step <b data-hue="yellow">probes</b> the middle cell of the range. One comparison with t tells which half can still hold t.`,
  },
  {
    name: "Halve",
    math: `<mtable><mtr><mtd>${am}<mo>&lt;</mo>${tt}<mo>⇒</mo>${lo}<mo>=</mo>${mid}<mo>+</mo><mn>1</mn></mtd></mtr><mtr><mtd>${am}<mo>&gt;</mo>${tt}<mo>⇒</mo>${hi}<mo>=</mo>${mid}<mo>−</mo><mn>1</mn></mtd></mtr></mtable>`,
    say: `The array is sorted, so every cell past mid on that side is <b data-hue="red">ruled out</b> too. The range keeps at most half of its cells.`,
  },
  {
    name: "Repeat",
    math: `${hi}<mo>−</mo>${lo}<mo>+</mo><mn>1</mn><mo>≤</mo>${fl(u.mfrac("<mi>n</mi>", "<msup><mn>2</mn><mi>k</mi></msup>"))}<mspace width=".6em"/><mtext>after</mtext><mspace width=".3em"/><mi>k</mi><mspace width=".3em"/><mtext>probes</mtext>`,
    say: `The loop repeats until a[mid] = t or the range is empty. Each row of the ladder is the range after one more probe.`,
  },
  {
    name: "Tree",
    math: `<mtext>probes</mtext><mo>≤</mo>${fl(log2n("<mi>n</mi>"))}<mo>+</mo><mn>1</mn><mo>=</mo>${fl(log2n("<mn>16</mn>"))}<mo>+</mo><mn>1</mn><mo>=</mo><mn>5</mn>`,
    say: `Each probe goes one level down a tree, and 16 cells fill 5 levels. So no search needs more than 5 probes.`,
  },
  {
    name: "Scale",
    math: `<mi>n</mi><mo>=</mo>${u.mn("1,000,000,000", { live: "n" })}${sp}${fl(log2n("<mi>n</mi>"))}<mo>+</mo><mn>1</mn><mo>=</mo>${u.mn(29, { places: 0, live: "fl" })}<mo>+</mo><mn>1</mn><mo>=</mo>${u.mn(30, { places: 0, live: "p", hue: HUE.mid })}`,
    say: `Doubling n adds one level to the tree, so one more probe. A billion sorted values need at most 30 probes.`,
  },
];

const show = (scenesOn) => u.placeCss(`#${scenesOn[0]}`, u.states(NS, Object.fromEntries(scenesOn[1].map((i) => [i, { x: 0, y: 0 }]))));
const css = [
  ...[
    ["el-links", [4]],
    ["el-tcols", [4]],
    ["el-ladder", [0, 1, 2, 3]],
    ["el-budget", [0, 1, 2, 3]],
    ["el-bracket", [0, 1, 2, 3]],
    ["el-cutg", [0, 1, 2, 3]],
    ["el-midg", [0, 1, 2, 3]],
    ["el-arr", [0, 1, 2, 3, 4]],
    ["el-right", [0, 1, 2, 3]],
    ["el-scale", [5]],
  ].map(show),
  `#el-links,#el-tcols,#el-ladder,#el-budget,#el-bracket,#el-cutg,#el-midg,#el-arr,#el-right,#el-scale{transition:opacity var(--u-fade) var(--anatomy-ease) var(--u-fade-at)}`,
  // The links fade in after the cells have dropped to their levels.
  `.u-stage[data-scene="4"] #el-links{--u-fade:.5s;--u-fade-at:.75s}`,
  `.el-R{transform:translate(560px,0)}`,
  `.el-L,.el-R,.el-S1,.el-S2{transition:transform .5s var(--anatomy-ease)}`,
  // Cells: the array in scenes 1-4, the tree in scene 5 (each cell drops to its probe depth).
  `.el-cell{transform:translate(var(--x),${CY}px);transition:transform .9s var(--anatomy-ease) calc(var(--d) * 70ms);cursor:pointer}`,
  `.u-stage[data-scene="4"] .el-cell{transform:translate(var(--x),calc(${CY}px + var(--d) * ${LEVEL}px))}`,
  `.el-box{fill:color-mix(in srgb,var(--unfold-blue) 14%,var(--anatomy-card));stroke:var(--unfold-blue);stroke-width:1.2;transition:fill .3s,stroke .3s,stroke-width .3s,opacity .3s}`,
  `.el-v{font:600 14px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central;font-variant-numeric:tabular-nums;transition:fill .3s}`,
  `.el-ix{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-cell:hover .el-box{stroke-width:2.2}`,
  `.el-cell[data-out] .el-box,.el-cell[data-cut] .el-box{fill:var(--anatomy-card);stroke:var(--anatomy-faint)}`,
  `.el-cell[data-out] .el-v{fill:var(--anatomy-lo)}`,
  `.el-cell[data-cut] .el-v{fill:var(--anatomy-muted)}`,
  `.el-strike{stroke:var(--unfold-red);stroke-width:1.6;stroke-linecap:round;opacity:0;transition:opacity .3s}`,
  `.el-cell[data-cut] .el-strike{opacity:1}`,
  `.el-cell[data-mid] .el-box{fill:color-mix(in srgb,var(--unfold-yellow) 26%,var(--anatomy-card));stroke:var(--unfold-yellow);stroke-width:2.6}`,
  `.el-cell[data-found] .el-box{fill:color-mix(in srgb,var(--unfold-green) 34%,var(--anatomy-card));stroke:var(--unfold-green);stroke-width:2.6}`,
  `.u-stage[data-scene="4"] .el-box{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1}`,
  `.u-stage[data-scene="4"] .el-cell[data-path] .el-box{fill:color-mix(in srgb,var(--unfold-yellow) 22%,var(--anatomy-card));stroke:var(--unfold-yellow);stroke-width:2.4}`,
  `.u-stage[data-scene="4"] .el-cell[data-found] .el-box{fill:color-mix(in srgb,var(--unfold-green) 34%,var(--anatomy-card));stroke:var(--unfold-green);stroke-width:2.6}`,
  `.el-ord{opacity:0;transition:opacity .3s}.el-cell[data-path] .el-ord{opacity:1}`,
  `.el-ord text{font:600 11px var(--anatomy-mono);fill:var(--unfold-yellow);text-anchor:middle;dominant-baseline:central}`,
  `.el-link{stroke:var(--anatomy-lo);stroke-width:1.1;fill:none;transition:stroke .3s,stroke-width .3s}`,
  `.el-link[data-path]{stroke:var(--unfold-yellow);stroke-width:2.4}`,
  `.el-th{font:500 10.5px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-th-l{text-anchor:start}.el-th-r{text-anchor:end}`,
  `.el-trow text{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:middle;dominant-baseline:central}`,
  `.el-trow:first-of-type text{fill:var(--anatomy-text)}`,
  // The probe pointer and the ruled-out label, above the cells.
  `.el-midp,.el-cutl{transition:transform .5s var(--anatomy-ease)}`,
  `.el-mlabel,.el-cutl>g,.el-tri,.el-cutline{opacity:0;transition:opacity .25s}`,
  `.el-midp[data-on] :is(.el-mlabel,.el-tri),.el-cutl[data-on] :is(g,.el-cutline){opacity:1}`,
  `.el-midp text,.el-cutl text{font:600 12px var(--anatomy-mono);text-anchor:middle;dominant-baseline:central}`,
  `.el-midp text{fill:var(--unfold-yellow)}.el-tri{fill:var(--unfold-yellow)}`,
  `.el-midp[data-end] text{fill:var(--unfold-green)}.el-midp[data-end] .el-tri{fill:var(--unfold-green)}`,
  `.el-cutl text{fill:var(--unfold-red)}.el-cutline{stroke:var(--unfold-red);stroke-width:1.2}`,
  `.el-br{fill:none;stroke:var(--unfold-blue);stroke-width:1.6;transition:d .5s var(--anatomy-ease)}`,
  `.el-lo text,.el-hi text{font:600 10.5px var(--anatomy-mono);fill:var(--unfold-blue);dominant-baseline:central;transition:x .5s var(--anatomy-ease)}`,
    // The ladder of ranges.
  `.el-row{opacity:0;transition:opacity .35s}.el-row[data-on]{opacity:1}`,
  `.el-row text{font:500 12px var(--anatomy-mono);text-anchor:middle;dominant-baseline:central;font-variant-numeric:tabular-nums}`,
  `.el-rc{fill:var(--unfold-blue)}.el-rm{fill:var(--anatomy-muted)}`,
  `.el-rbar{fill:var(--unfold-blue);fill-opacity:.22;stroke:var(--unfold-blue);stroke-opacity:.5;stroke-width:.8;transition:x .4s var(--anatomy-ease),width .4s var(--anatomy-ease)}`,
  `.el-row[data-now] .el-rbar{fill-opacity:.38;stroke-opacity:1}`,
  `.el-rzero{stroke:var(--unfold-blue);stroke-width:1.4;stroke-dasharray:2 2;opacity:0}.el-row[data-zero] .el-rzero{opacity:1}`,
  `.el-rdot{fill:var(--unfold-yellow);opacity:0;transition:opacity .3s}.el-row[data-mid] .el-rdot{opacity:1}`,
  `.el-slot{fill:none;stroke:var(--anatomy-faint);stroke-width:1;transition:fill .3s,stroke .3s}`,
  `.el-slot[data-on]{fill:color-mix(in srgb,var(--unfold-yellow) 45%,var(--anatomy-card));stroke:var(--unfold-yellow)}`,
  `.el-budt{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.u-stage[data-narrow] .el-budt{font-size:15px}`,
  `.el-res text{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text)}`,
  `.el-res[data-done] text{fill:var(--unfold-green)}`,
  // Scale scene.
  `.el-stairs{fill:none;stroke:var(--unfold-yellow);stroke-width:2;stroke-linejoin:round}`,
  `.el-linear{fill:none;stroke:var(--anatomy-mid);stroke-width:1.4;stroke-dasharray:4 3}`,
  `.el-lin-l text{font:11px var(--anatomy-mono);fill:var(--anatomy-muted)}`,
  `#el-plot .u-tick-label[text-anchor="middle"]{display:none}`,
  `.el-xl{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-xname{font:11px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle}`,
  `.el-pt{transition:transform .25s var(--anatomy-ease)}.el-pt circle{fill:var(--unfold-yellow);stroke:var(--anatomy-card);stroke-width:1.5}`,
  `.el-pt-l text{font:600 12px var(--anatomy-mono);fill:var(--unfold-yellow);text-anchor:end}`,
  `.el-tr text{font:500 12px var(--anatomy-mono);fill:var(--anatomy-text);text-anchor:end;dominant-baseline:central;font-variant-numeric:tabular-nums}`,
  `.el-tr .el-tp,.el-th-p{fill:var(--unfold-yellow)}`,
  `.el-you text{fill:var(--anatomy-strong);font-weight:600}`,
  `.el-rule{stroke:var(--anatomy-faint);stroke-width:.8}`,
  `#el-tchip text{font-size:12px;font-weight:600}`,
  `.u-ctl input[type=number]{width:56px}`,
  `.u-ctl input[type=range]{width:150px}`,
  `.u-ctl output{font:11px var(--anatomy-mono);color:var(--anatomy-muted);min-width:11ch}`,
  // Narrow layout: the array column on top (scaled), the code under it; the chart over the table.
  `.u-stage[data-narrow] .el-L{transform:translate(1px,6px) scale(.74)}`,
  `.u-stage[data-narrow] .el-R{transform:translate(14px,260px)}`,
  `.u-stage[data-narrow] .el-v{font-size:17px}.u-stage[data-narrow] .el-ix{font-size:12.5px}`,
  `.u-stage[data-narrow] :is(.el-row text,.el-trow text){font-size:14px}.u-stage[data-narrow] .el-th{font-size:13px}`,
  `.u-stage[data-narrow] :is(.el-midp text,.el-cutl text){font-size:15px}.u-stage[data-narrow] :is(.el-lo,.el-hi) text{font-size:13px}`,
  `.u-stage[data-narrow] .el-ord text{font-size:14px}`,
  `.u-stage[data-narrow] .u-line rect{width:372px}.u-stage[data-narrow] .u-line-text{font-size:12.5px}.u-stage[data-narrow] .u-line-num{font-size:11px}`,
  `.u-stage[data-narrow] .el-S1{transform:translate(-34px,0) scale(.92)}`,
  `.u-stage[data-narrow] .el-S2{transform:translate(-496px,286px)}`,
  `.u-stage[data-narrow] :is(.el-xl,.u-tick-label){font-size:12.5px}.u-stage[data-narrow] :is(.el-xname,.el-lin-l text){font-size:13px}`,
  `.u-stage[data-narrow] .el-pt-l text{font-size:14px}`,
].join("\n");

const key = u.keyHtml([
  { hue: HUE.range, label: "range [lo, hi]" },
  { hue: HUE.mid, label: "probe at mid" },
  { hue: HUE.t, label: "target t, found" },
  { hue: HUE.out, label: "just ruled out" },
]);

const controls =
  `<label>target t <input type="number" id="el-t" min="${m.T_MIN}" max="${m.T_MAX}" step="1" value="${m.T}"></label>` +
  `<button type="button" id="el-new">new numbers</button><button type="button" id="el-reset">reset</button>` +
  `<label data-scenes="5">n <input type="range" id="el-n" min="0" max="9" step="0.05" value="9"><output id="el-nout">1,000,000,000</output></label>`;

const stage = u.stageHtml({
  dwell: 7000,
  scenes,
  svg,
  label: "Binary search explainer. Click a cell to search for its value, or type a target. Left and right arrows change the scene. Comma and period step through the run. Up and down arrows change the target by one.",
  css,
  key,
  time: { steps: m.search(m.A, m.T).length, scenes: [0, 1, 2, 3] },
  controls,
  narrow: [400, [548, 548, 548, 548, 262, 526]],
});

const live = `
${u.modelScript([m.search, m.answer, m.ladder, m.maxProbes, m.sceneRanges, m.makeArray], { N: m.N, A0: m.A, T0: m.T, T_MIN: m.T_MIN, T_MAX: m.T_MAX, DEPTH: m.TREE.depth, PARENT: m.TREE.parent })}
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const $ = (s) => root.querySelector(s);
const all = (s) => [...root.querySelectorAll(s)];
const X0 = ${X0}, CW = ${CW};
const cellEl = all(".el-cell"), rowEl = all(".el-row"), linkEl = all(".el-link");
const codeEl = $("#el-code"), midp = $("#el-midp"), cutl = $("#el-cutl");
const plotEl = $("#el-plot");
const field = $("#el-t"), slider = $("#el-n"), nout = $("#el-nout");
let arr = A0.slice(), t = T0, seed = 0;
let steps, ranges, step = 0, crossing = false, treeN = 99, nLog = 9;
const cxOf = (i) => X0 + i * CW + CW / 2;
const fmtN = (n) => n.toLocaleString("en-US");
const minus = (s) => String(s).replace("-", "\\u2212");
function recompute() {
  steps = search(arr, t);
  ranges = sceneRanges(steps);
}
function say(x, s) {
  const h = "step " + s + " \\u00b7 ";
  if (x.kind === "init") return h + "lo = 0, hi = 15: 16 cells may hold t = " + t;
  if (x.kind === "probe") return h + "mid = \\u230a(" + x.lo + " + " + x.hi + ")/2\\u230b = " + x.mid + ", compare a[" + x.mid + "] = " + x.v + " with " + t;
  if (x.kind === "cut") return h + x.v + " " + x.rel + " " + t + ", so " + (x.rel === "<" ? "lo = " + x.mid + " + 1 = " + x.lo : "hi = " + x.mid + " \\u2212 1 = " + x.hi) + ": " + Math.max(0, x.hi - x.lo + 1) + " left";
  if (x.kind === "found") return h + "a[" + x.mid + "] = " + t + ": return " + x.mid + " after " + x.probes + " probes";
  return h + "lo = " + x.lo + " > hi = " + x.hi + ": return \\u22121 after " + x.probes + " probes";
}
function show(s) {
  step = Math.max(0, Math.min(steps.length - 1, s));
  const x = steps[step];
  const tree = UNFOLD.scene() === 4;
  const last = steps[steps.length - 1];
  const path = steps.filter((y) => y.kind === "probe").map((y) => y.mid);
  const lit = path.slice(0, treeN);
  const at = answer(steps);
  cellEl.forEach((el, i) => {
    el.querySelector(".el-v").textContent = arr[i];
    const out = !tree && (i < x.lo || i > x.hi);
    const cut = !tree && x.kind === "cut" && out && i >= x.from[0] && i <= x.from[1];
    el.toggleAttribute("data-out", out && !cut);
    el.toggleAttribute("data-cut", cut);
    el.toggleAttribute("data-mid", !tree && x.kind === "probe" && i === x.mid);
    el.toggleAttribute("data-found", tree ? i === at && lit.length === path.length : x.kind === "found" && i === x.mid);
    const k = lit.indexOf(i);
    el.toggleAttribute("data-path", tree && k >= 0);
    if (k >= 0) el.querySelector(".el-ord text").textContent = k + 1;
  });
  linkEl.forEach((el) => {
    const i = Number(el.dataset.i);
    el.toggleAttribute("data-path", tree && lit.includes(i) && lit.includes(PARENT[i]));
  });
  // The probe pointer: the comparison at a probe, the result at the end.
  midp.toggleAttribute("data-on", ["probe", "found", "empty"].includes(x.kind));
  midp.toggleAttribute("data-end", x.kind !== "probe");
  if (x.kind === "probe" || x.kind === "found") {
    midp.style.transform = "translate(" + cxOf(x.mid) + "px,0)";
    midp.querySelector("text").textContent = x.kind === "found" ? "found " + t : x.v + " " + x.rel + " " + t;
  }
  if (x.kind === "empty") {
    midp.style.transform = "translate(" + (X0 + x.lo * CW) + "px,0)";
    midp.querySelector("text").textContent = "no " + t;
  }
  cutl.toggleAttribute("data-on", x.kind === "cut");
  if (x.kind === "cut") {
    const [a, b] = x.rel === "<" ? [x.from[0], x.mid] : [x.mid, x.from[1]];
    cutl.style.transform = "translate(" + (X0 + ((a + b + 1) / 2) * CW) + "px,0)";
    cutl.querySelector("text").textContent = "all " + x.rel + " " + t;
    const half = ((b - a + 1) * CW) / 2 - 3;
    cutl.querySelector(".el-cutline").setAttribute("d", "M" + -half + " ${CY - 8}H" + half);
  }
  const L = X0 + x.lo * CW, R = X0 + (x.hi + 1) * CW;
  $("#el-br").setAttribute("d", "M" + L + " ${BY - 5}V${BY}H" + Math.max(L, R) + "V${BY - 5}");
  // lo left of the bracket, hi right of it. An empty range (lo = hi + 1) swaps them, so they never overlap.
  const lo = $("#el-lo"), hi = $("#el-hi"), empty = x.lo > x.hi;
  lo.setAttribute("x", empty ? L + 7 : L - 4);
  lo.setAttribute("text-anchor", empty ? "start" : "end");
  hi.setAttribute("x", empty ? L - 7 : R + 4);
  hi.setAttribute("text-anchor", empty ? "end" : "start");
  const rows = ladder(steps, step);
  rowEl.forEach((el, k) => {
    const r = rows[k];
    el.toggleAttribute("data-on", !!r);
    if (!r) return;
    el.toggleAttribute("data-now", k === rows.length - 1);
    el.toggleAttribute("data-zero", r.size === 0);
    el.toggleAttribute("data-mid", r.mid >= 0);
    el.querySelector(".el-rc").textContent = r.size;
    const bar = el.querySelector(".el-rbar");
    bar.setAttribute("x", X0 + r.lo * CW);
    bar.setAttribute("width", r.size * CW);
    el.querySelector(".el-rzero").setAttribute("d", "M" + (X0 + r.lo * CW) + " -2V16");
    if (r.mid >= 0) el.querySelector(".el-rdot").setAttribute("cx", cxOf(r.mid));
  });
  all(".el-slot").forEach((el, k) => el.toggleAttribute("data-on", k < x.probes));
  $("#el-budt").textContent = x.probes + " of at most " + maxProbes(arr.length);
  mark(codeEl, tree ? -1 : x.line, ".u-line");
  $("#el-tchip text").textContent = "t = " + t;
  const end = x.kind === "found" || x.kind === "empty";
  $("#el-res").textContent = "search(a, " + t + ") \\u2192 " + (end ? minus(answer(steps)) : "\\u2026");
  $(".el-res").toggleAttribute("data-done", x.kind === "found");
  UNFOLD.timeAt(step, steps.length);
  let text = say(x, step);
  if (tree) text = "t = " + t + ": probes " + lit.join(" \\u2192 ") + (at >= 0 ? ", found at " + at : ", not in the array") + ", " + path.length + " of at most 5";
  if (UNFOLD.scene() === 5) text = scaleText();
  if (readout.textContent !== text) readout.textContent = text;
}
function scaleText() {
  const n = Math.max(1, Math.round(10 ** nLog));
  const p = maxProbes(n);
  return "n = " + fmtN(n) + ": \\u230alog\\u2082 n\\u230b + 1 = " + (p - 1) + " + 1 = " + p + " probes at most";
}
function renderScale() {
  const n = Math.max(1, Math.round(10 ** nLog));
  const p = maxProbes(n);
  const [px, py] = plotAt(plotEl, Math.log10(n), p);
  $("#el-pt").style.transform = "translate(" + px + "px," + py + "px)";
  $("#el-pt text").textContent = p + (p === 1 ? " probe" : " probes");
  $("#el-yn").textContent = fmtN(n);
  $("#el-yp").textContent = p;
  $("#el-yl").textContent = fmtN(n);
  nout.textContent = fmtN(n);
  setLive({ n: fmtN(n), fl: p - 1, p });
  if (UNFOLD.scene() === 5) readout.textContent = scaleText();
}
function stepTo(s) {
  show(s);
  const [a, b] = ranges[UNFOLD.scene()];
  if (step < a || step > b) {
    crossing = true;
    UNFOLD.go(ranges.findIndex((r) => step >= r[0] && step <= r[1]));
    crossing = false;
    show(step);
  }
}
root.addEventListener("unfold:scene", (e) => {
  const sc = e.detail.scene;
  if (sc === 4) treeN = 0;
  if (sc === 5) renderScale();
  if (!crossing) show(ranges[sc][0]);
});
recompute();
for (let sc = 0; sc < 4; sc++)
  UNFOLD.beat(sc, 950, (k) => { const [a, b] = ranges[sc]; show(k < 0 ? b : Math.min(a + k, b)); }, 500, () => ranges[sc][1] - ranges[sc][0] + 1);
UNFOLD.beat(4, 750, (k) => { treeN = k < 0 ? 99 : k + 1; show(steps.length - 1); }, 1100, () => steps.filter((y) => y.kind === "probe").length);
UNFOLD.beat(5, 70, (k) => { nLog = k < 0 ? 9 : Math.min(9, k * 0.25); slider.value = String(nLog); renderScale(); }, 600, 37);
UNFOLD.onTime(stepTo);
// The verb: search for the reader's target. The page reruns the model's own search().
function redo() {
  UNFOLD.pause();
  recompute();
  const sc = UNFOLD.scene();
  UNFOLD.go(sc === 4 ? 4 : 3);
}
function setTarget(v) {
  t = Math.round(Math.max(T_MIN, Math.min(T_MAX, v)));
  field.value = t;
  redo();
}
root.addEventListener("click", (e) => {
  const c = e.target.closest(".el-cell");
  if (c) setTarget(arr[Number(c.dataset.i)]);
});
root.addEventListener("keydown", (e) => {
  const by = { ArrowUp: 1, ArrowDown: -1 }[e.key];
  if (by === undefined) return;
  e.preventDefault();
  setTarget(t + by);
});
field.addEventListener("input", () => {
  const v = Number(field.value);
  if (field.value === "" || !Number.isFinite(v)) return;
  UNFOLD.pause();
  t = Math.round(Math.max(T_MIN, Math.min(T_MAX, v)));
  redo();
});
field.addEventListener("change", () => (field.value = t));
$("#el-new").addEventListener("click", () => {
  seed = (seed % 300) + 1;
  arr = makeArray(seed);
  redo();
});
$("#el-reset").addEventListener("click", () => {
  arr = A0.slice();
  t = T0;
  field.value = t;
  nLog = 9;
  slider.value = "9";
  renderScale();
  redo();
});
slider.addEventListener("input", () => {
  UNFOLD.pause();
  nLog = Number(slider.value);
  renderScale();
});
renderScale();
show(0);
`;

// ---- Notes under the card ----
const notes = u.notesHtml([
  {
    title: "Worst case by size",
    html: `<p>Each count is measured: the search ran on the worst target and counted its probes.</p>`,
    table: {
      head: ["n", "binary search", "linear scan", "⌊log₂ n⌋ + 1"],
      rows: m.SCALE.map((n, i) => [fmtN(n), String(m.SCALE_PROBES[i]), fmtN(n), `${Math.floor(Math.log2(n))} + 1 = ${m.maxProbes(n)}`]),
    },
  },
  {
    title: "Mistakes that break it",
    table: {
      head: ["mistake", "what happens"],
      rows: [
        ["<code>lo = mid</code> in place of <code>mid + 1</code>", "the range can stop shrinking, and the loop never ends"],
        ["<code>while lo &lt; hi</code> with <code>hi = mid - 1</code>", "the last candidate is never probed"],
        ["<code>(lo + hi) / 2</code> in 32-bit ints", "overflow above 2³⁰ cells, use <code>lo + (hi - lo) / 2</code>"],
        ["array not sorted", "a cut can rule out t, and the search returns −1"],
      ],
    },
  },
  {
    title: "Variants you will meet",
    table: {
      head: ["variant", "returns"],
      rows: [
        ["<code>bisect_left(a, t)</code> (Python)", "the first index with a[i] ≥ t, so duplicates give the first copy"],
        ["<code>std::lower_bound</code> (C++)", "the same index, as an iterator"],
        ["<code>Arrays.binarySearch</code> (Java)", "the index, or −(insert point) − 1 when t is missing"],
        ["search on the answer", "the first x where a yes/no test turns true"],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["target t", "the value the search looks for"],
        ["range [lo, hi]", "the cells that can still hold t"],
        ["probe", "one comparison of a[mid] with t"],
        ["mid", "the middle index, ⌊(lo + hi) / 2⌋"],
        ["ruled out", "cells that cannot hold t, because the array is sorted"],
        ["⌊x⌋", "x rounded down to a whole number"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Binary search",
    hint: "click a cell to search for it",
    readout: "step 0 · lo = 0, hi = 15: 16 cells may hold t = 50",
    caption:
      "16 distinct values chosen by hand, and t = 50 chosen so the run cuts both ways. The code panel is Python. On 2026-10-16 python3 ran its exact lines for every target from 0 to 99, and bisect gave the same answers. The worst case was measured for every size up to 600, and on a 10⁹-cell array whose values are computed on demand.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, light ? "page-light.html" : "page.html");
const title = "Binary search";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
