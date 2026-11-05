import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "/home/leapfrog/.claude/skills/unfold/kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso, mi, mfrac, fmt } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const PI = Math.PI;
const W = 820;
const H = 272;
const NARROW = [400, 408];

// Colour identity
const HUE = { f: "ink", term: "blue", sum: "yellow", area: "green", over: "red" };

// ---- Main plot: two periods of the wave ----
const MAIN = { x: 30, y: 14, w: 520, h: 222, xr: [-2 * PI, 2 * PI], yr: [-1.38, 1.38] };
const main = u.plot({ ...MAIN, yTicks: [-1, 1], grid: true, xName: "x", yName: "" });
const piTicks = [-2, -1, 0, 1, 2];
const xGrid = `<path class="u-plot-grid" d="${piTicks.map((t) => `M${main.sx(t * PI)} ${MAIN.y}V${MAIN.y + MAIN.h}`).join("")}"/>`;
const xLabels = piTicks
  .filter((t) => t)
  .map((t) => `<text class="u-tick-label xlab" x="${main.sx(t * PI) + (t > 0 ? -5 : 5)}" y="${main.sy(0) + 15}" text-anchor="${t > 0 ? "end" : "start"}">${{ "-2": "−2π", "-1": "−π", 1: "π", 2: "2π" }[t]}</text>`)
  .join("");

// The square wave: flat parts solid, the jumps as thin verticals.
const fPath = (() => {
  const d = [];
  for (let a = -2; a < 2; a++) {
    const level = ((a % 2) + 2) % 2 === 0 ? 1 : -1;
    d.push(`M${main.sx(a * PI)} ${main.sy(level)}H${main.sx((a + 1) * PI)}`);
  }
  return d.join("");
})();
const fJumps = [-2, -1, 0, 1, 2].map((t) => `M${main.sx(t * PI)} ${main.sy(-1)}V${main.sy(1)}`).join("");

// Labels on the drawing, shown per scene: lab(text, x, y, scenes, hue, anchor)
const lab = (text, [x, y], scenes, hue = "", anchor = "start", cls = "") =>
  `<g class="sc lab ${cls}" data-s="${scenes.join(" ")}"${hue ? ` data-hue="${hue}"` : ""}><text x="${x}" y="${y}" text-anchor="${anchor}">${text}</text></g>`;
const [p1x, p1y] = main.at(PI / 2, 4 / PI);
const mainSvg = `<g class="lay lay-main"><g class="u-move" id="gMain">
${main.svg}${xGrid}${xLabels}
<path class="area area-up sc" data-s="4" id="areaUp" d=""/>
<path class="area area-down sc" data-s="4" id="areaDown" d=""/>
<path class="fwave" d="${fPath}"/><path class="fjump" d="${fJumps}"/>
<path class="crv sc" data-s="4" data-hue="blue" id="sink" d=""/>
<path class="crv crv-term1 sc" data-s="1 2" data-hue="blue" id="term1" d=""/>
<path class="crv crv-new sc" data-s="2 3" data-hue="blue" id="termNew" d=""/>
<path class="crv crv-prev sc" data-s="3" data-hue="yellow" id="sumPrev" d=""/>
<path class="crv crv-sum sc" data-s="2 3" data-hue="yellow" id="sum" d=""/>
<g class="sc" data-s="4"><path class="u-guide" d="M${main.sx(-PI)} ${MAIN.y + 6}V${MAIN.y + MAIN.h - 6}M${main.sx(PI)} ${MAIN.y + 6}V${MAIN.y + MAIN.h - 6}"/></g>
${lab("one period", [main.sx(-PI) + 6, MAIN.y + 4], [4], "", "start", "small")}
${lab("f(x)", main.at(-2 * PI + 0.1, 1.24), [0, 1, 2, 3], "ink")}
${lab("jump", [main.sx(0) + 6, main.sy(-0.2)], [0], "ink", "start", "small")}
${lab("height 4/π = 1.27", [p1x + 10, p1y - 6], [1], "blue", "start", "small")}
${lab("b₁ sin x", main.at(-PI / 2 + 0.3, -4 / PI - 0.12), [1], "blue", "start", "small")}
${lab("b₃ sin 3x", main.at(-PI / 2 - 0.15, 0.62), [2], "blue", "middle", "small")}
${lab("S₂", main.at(-1.82 * PI, -1.18), [2], "yellow")}
${lab("S_N", main.at(-1.82 * PI, -1.18), [3], "yellow")}
${lab("newest term", main.at(-1.5 * PI, 0.62), [3], "blue", "middle", "small")}
${lab("sin kx", main.at(-1.5 * PI, 1.12), [4], "blue", "middle", "small")}
${lab("area above", main.at(PI / 2, 1.2), [4], "green", "middle", "small")}
${lab("area below", main.at(-PI / 2, -1.25), [4], "green", "middle", "small")}
<g class="sc" data-s="0 1 2 3" id="probe"><path class="probe-line" d="M0 ${MAIN.y}V${MAIN.y + MAIN.h}"/><circle class="probe-dot" r="4"/><g class="probe-tag"><text class="probe-text" x="0" y="0"></text></g></g>
<rect class="hit" x="${MAIN.x}" y="${MAIN.y}" width="${MAIN.w}" height="${MAIN.h}"/>
</g></g>`;

// ---- Zoom plot: the first peak right of the jump at x = 0 ----
const ZOOM = { x: 30, y: 14, w: 520, h: 222, xr: [-0.25, 1.65], yr: [0.35, 1.35] };
const zoom = u.plot({ ...ZOOM, xTicks: [0, 0.5, 1, 1.5], yTicks: [0.5, 1], xName: "x", grid: true });
const trail = Array.from({ length: m.NMAX }, (_, i) => {
  const N = i + 1;
  const [x, y] = zoom.at(m.peakX(N), m.partial(N, m.peakX(N)));
  return `<circle class="trail" data-n="${N}" cx="${x}" cy="${y}" r="2.6"/>`;
}).join("");
const trailLabels = [1, 2, 3]
  .map((N) => {
    const [x, y] = zoom.at(m.peakX(N), m.partial(N, m.peakX(N)));
    return `<g class="trail-lab" data-n="${N}" data-hue="red"><text x="${x}" y="${y - 9}" text-anchor="middle">N=${N}</text></g>`;
  })
  .join("");
const [gx0, gy] = zoom.at(-0.25, m.GIBBS);
const zoomSvg = `<g class="lay lay-main"><g class="u-move" id="gZoom">
<clipPath id="zclip"><rect x="${ZOOM.x}" y="${ZOOM.y}" width="${ZOOM.w}" height="${ZOOM.h}"/></clipPath>
${zoom.svg}
<g clip-path="url(#zclip)"><path class="fwave" d="M${zoom.sx(-0.25)} ${zoom.sy(-1)}H${zoom.sx(0)}V${zoom.sy(1)}H${zoom.sx(1.65)}"/>
<path class="crv crv-sum" data-hue="yellow" id="zsum" d=""/></g>
<path class="gibbs" d="M${gx0} ${gy}H${ZOOM.x + ZOOM.w}"/>
<g data-hue="red" class="lab small"><text x="${ZOOM.x + ZOOM.w - 4}" y="${gy - 7}" text-anchor="end">limit 1.179</text></g>
<g data-hue="ink" class="lab small"><text x="${ZOOM.x + ZOOM.w - 4}" y="${zoom.sy(1) + 15}" text-anchor="end">f = 1</text></g>
<g data-hue="ink" class="lab small"><text x="${zoom.sx(0) - 6}" y="${zoom.sy(0.75)}" text-anchor="end">jump</text></g>
${trail}${trailLabels}
<path class="over" id="overBar" d=""/>
<circle class="peak" id="peakDot" r="4.5"/>
<g data-hue="red" class="lab small" id="peakTag"><text x="0" y="0"></text></g>
</g></g>`;

// ---- Spectrum: the heights b_k ----
const K = 9;
const SP = { y: 26, w: 20, h: 170, max: 1.4 };
const bk = (N) => Array.from({ length: K }, (_, i) => (i + 1 <= 2 * N - 1 ? m.coef(i + 1) : 0));
const env = Array.from({ length: 81 }, (_, i) => {
  const k = 1 + (i * (K - 1)) / 80;
  return `${i ? "L" : "M"}${((k - 1) * SP.w + SP.w / 2).toFixed(1)} ${(SP.y + SP.h - (SP.h * (4 / (PI * k))) / SP.max).toFixed(1)}`;
}).join("");
const specSvg = `<g class="lay lay-spec"><g class="u-move" id="gSpec">
<g data-hue="blue"><text class="u-name" x="0" y="${SP.y - 10}">b<tspan baseline-shift="sub" font-size="12">k</tspan></text></g>
<g class="lab small" data-hue="blue"><text x="${SP.w * 2.2}" y="${SP.y + 24}">4/(πk)</text></g>
${u.bars({ id: "spec", values: bk(m.NMAX), labels: Array.from({ length: K }, (_, i) => String(i + 1)), y: SP.y, w: SP.w, h: SP.h, hue: "blue", max: SP.max, places: 2 })}
<path class="env" d="${env}"/>
<text class="u-tick-label" x="${K * SP.w + 10}" y="${SP.y + SP.h + 12}">k</text>
</g></g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "A square wave on two periods, the sine terms and their partial sum, the bar chart of sine heights b_k, and a zoom on the overshoot next to the jump.",
  body: [mainSvg, zoomSvg, specSvg],
});

// ---- Scenes ----
const fx = mi("f", HUE.f);
const S = (sub) => `<msub>${mi("S", HUE.sum)}<mn>${sub}</mn></msub>`;
const sinT = (k) => `<mrow data-hue="blue"><mi>sin</mi><mo>&#x2061;</mo><mspace width="0.17em"/>${k === 1 ? "" : `<mn>${k}</mn>`}<mi>x</mi></mrow>`;
const four = mfrac("<mn>4</mn>", "<mi>π</mi>");
const scenes = [
  {
    name: "Square wave",
    math: `${fx}<mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo><mo>=</mo><mrow><mo>{</mo><mtable columnalign="left"><mtr><mtd><mo>+</mo><mn>1</mn></mtd><mtd><mn>0</mn><mo>&lt;</mo><mi>x</mi><mo>&lt;</mo><mi>π</mi></mtd></mtr><mtr><mtd><mo>−</mo><mn>1</mn></mtd><mtd><mo>−</mo><mi>π</mi><mo>&lt;</mo><mi>x</mi><mo>&lt;</mo><mn>0</mn></mtd></mtr></mtable></mrow>`,
    say: `A <b data-hue="ink">square wave</b> jumps between +1 and −1 and repeats every 2π. A sum of smooth sine waves can still build it.`,
  },
  {
    name: "One sine",
    math: `${S(1)}<mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo><mo>=</mo>${four}${sinT(1)}`,
    say: `The closest single <b data-hue="blue">sine</b> has height 4/π, not 1. It goes above the flat top because it rises slowly near the jumps.`,
  },
  {
    name: "Add sin 3x",
    math: `${S(2)}<mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo><mo>=</mo>${four}<mo stretchy="false">(</mo>${sinT(1)}<mo>+</mo>${mfrac("<mn>1</mn>", "<mn>3</mn>")}${sinT(3)}<mo stretchy="false">)</mo>`,
    say: `Adding <b data-hue="blue">sin 3x</b> at one third of the height lowers the middle and raises the sides. The <b data-hue="yellow">sum</b> is flatter.`,
  },
  {
    name: "More terms",
    math: `<msub>${mi("S", HUE.sum)}<mi>N</mi></msub><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo><mo>=</mo>${four}<munderover><mo>∑</mo><mrow><mi>k</mi><mo>=</mo><mn>1</mn><mo>,</mo><mn>3</mn><mo>,</mo><mn>5</mn><mo>,</mo><mo>…</mo></mrow><mrow><mn>2</mn><mi>N</mi><mo>−</mo><mn>1</mn></mrow></munderover>${mfrac("<mn>1</mn>", "<mi>k</mi>")}<mrow data-hue="blue"><mi>sin</mi><mo>&#x2061;</mo><mspace width="0.17em"/><mi>k</mi><mi>x</mi></mrow>`,
    say: `Each new <b data-hue="blue">term</b> uses the next odd frequency k, with height 4/(πk). The <b data-hue="yellow">sum</b> comes closer to the wave, except next to the jumps.`,
  },
  {
    name: "Heights",
    math: `<msub>${mi("b", HUE.term)}<mi>k</mi></msub><mo>=</mo>${mfrac("<mn>1</mn>", "<mi>π</mi>")}<msubsup><mo>∫</mo><mrow><mo>−</mo><mi>π</mi></mrow><mi>π</mi></msubsup><mrow data-hue="green"><mi>f</mi><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo><mi>sin</mi><mo>&#x2061;</mo><mspace width="0.17em"/><mi>k</mi><mi>x</mi></mrow><mspace width="0.2em"/><mi>d</mi><mi>x</mi><mo>=</mo>${mfrac("<mn>4</mn>", "<mi>π</mi><mi>k</mi>")}<mtext>&#xa0;for odd&#xa0;</mtext><mi>k</mi>`,
    say: `Each height <b data-hue="blue">b<sub>k</sub></b> is an <b data-hue="green">area</b>: the wave times sin kx, over one period. For even k, the area above equals the area below, so b<sub>k</sub> = 0.`,
  },
  {
    name: "Overshoot",
    math: `<munder><mo movablelimits="false">max</mo><mi>x</mi></munder><msub>${mi("S", HUE.sum)}<mi>N</mi></msub><mo>→</mo>${mfrac("<mn>2</mn>", "<mi>π</mi>")}<mi>Si</mi><mo stretchy="false">(</mo><mi>π</mi><mo stretchy="false">)</mo><mo>=</mo><mn data-hue="red">1.179</mn>`,
    say: `Next to the jump, the <b data-hue="yellow">sum</b> always overshoots by about 9% of the jump. More terms make the bump narrower, but not lower.`,
  },
];

const n = scenes.length;
// Zoom morph: the main plot grows around (0, 1) as the zoom plot comes in, and the reverse.
const p0 = main.at(0, 1);
const q0 = zoom.at(0, 1);
const s = 4;
const css = [
  u.placeCss("#gMain", [{}, {}, {}, {}, {}, { x: q0[0] - s * p0[0], y: q0[1] - s * p0[1], s, o: 0 }]),
  u.placeCss("#gZoom", u.states(n, { 4: { x: p0[0] - q0[0] / s, y: p0[1] - q0[1] / s, s: 1 / s, o: 0 }, 5: {} })),
  u.placeCss("#gSpec", u.states(n, { 0: { y: 12, o: 0 }, 1: {}, 2: {}, 3: {}, 4: {}, 5: {} })),
  `.sc{opacity:0;transition:opacity .5s var(--anatomy-ease)}`,
  ...Array.from({ length: n }, (_, i) => `.u-stage[data-scene="${i}"] .sc[data-s~="${i}"]{opacity:1}`),
  `.u-stage[data-scene="2"] #term1{opacity:.35}`,
  `.u-stage[data-scene="4"] .fwave,.u-stage[data-scene="4"] .fjump{opacity:.35}`,
  `.fwave{fill:none;stroke:var(--anatomy-hi);stroke-width:2.2;stroke-linecap:round;transition:opacity .5s}`,
  `.fjump{fill:none;stroke:var(--anatomy-hi);stroke-width:.8;stroke-dasharray:2 3;transition:opacity .5s}`,
  `.crv{fill:none;stroke:var(--hue);stroke-width:2;stroke-linejoin:round}`,
  `.crv-new{stroke-width:1.4}.crv-prev{stroke-width:1.2;stroke-opacity:.35}#sink{stroke-width:1.2;stroke-dasharray:4 3}`,
  `.crv-sum{stroke-width:2.4}`,
  `.area{fill:var(--unfold-green)}.area-up{fill-opacity:.5}.area-down{fill-opacity:.08;stroke:var(--unfold-green);stroke-width:1}`,
  `.lab text{font:500 12px var(--anatomy-mono);fill:var(--hue,var(--anatomy-muted))}`,
  `.lab.small text{font-size:11px}`,
  `.lab[data-hue="ink"] text{fill:var(--anatomy-hi)}`,
  `.probe-line{stroke:var(--anatomy-mid);stroke-width:.8;stroke-dasharray:3 3}`,
  `.probe-dot{fill:var(--hue,var(--anatomy-hi));stroke:var(--anatomy-card);stroke-width:1.5}`,
  `#probe[data-hue="ink"] .probe-dot{fill:var(--anatomy-hi)}`,
  `.probe-text{font:600 12px var(--anatomy-mono);fill:var(--anatomy-strong);paint-order:stroke;stroke:var(--anatomy-card);stroke-width:4px}`,
  `#probe{transition:opacity .5s,transform .35s var(--anatomy-ease)}`,
  `.hit{fill:transparent;cursor:crosshair}`,
  `.u-stage:not([data-scene="0"]):not([data-scene="1"]):not([data-scene="2"]):not([data-scene="3"]) .hit{display:none}`,
  `.gibbs{stroke:var(--unfold-red);stroke-width:1;stroke-dasharray:5 4}`,
  `.trail{fill:var(--unfold-red);opacity:.85;transition:opacity .3s}.trail[data-later],.trail-lab[data-later]{opacity:0}`,
  `.trail-lab text{font:10px var(--anatomy-mono);fill:var(--unfold-red)}.trail-lab{transition:opacity .3s}`,
  `.peak{fill:var(--unfold-yellow);stroke:var(--anatomy-card);stroke-width:1.5}`,
  `.over{stroke:var(--unfold-red);stroke-width:2.2}`,
  `#peakTag text{font-size:12px;font-weight:600;paint-order:stroke;stroke:var(--anatomy-card);stroke-width:4px}`,
  `.env{fill:none;stroke:var(--unfold-blue);stroke-width:1;stroke-dasharray:3 3;opacity:.7}`,
  `.u-bar[data-on] .u-bar-fill{fill:var(--anatomy-strong)}`,
  `.u-bar[data-zero] .u-bar-value{display:none}`,
  `.u-stage:not([data-scene="4"]) .u-bar[data-on] .u-bar-fill{fill:var(--hue)}`,
  `.u-stage[data-scene="3"] .u-bar[data-on] .u-bar-fill{fill:var(--anatomy-strong)}`,
  // layout: two columns wide, stacked narrow
  `.xlab{paint-order:stroke;stroke:var(--anatomy-card);stroke-width:4px}`,
  `.lay-spec{transform:translate(600px,14px)}.lay-main{transform:translate(0,6px)}`,
  `.u-stage[data-narrow] .lay-main{transform:translate(-14px,4px) scale(.74)}`,
  `.u-stage[data-narrow] .lay-spec{transform:translate(108px,192px)}`,
  `.u-stage[data-narrow] .lay-main .lab text,.u-stage[data-narrow] .lay-main .probe-text{font-size:16px}`,
  `.u-stage[data-narrow] .lay-main .u-tick-label{font-size:13px}`,
  `.u-stage[data-narrow] .trail-lab text{font-size:13px}.u-stage[data-narrow] #peakTag text{font-size:16px}.u-stage[data-narrow] .trail-lab:not([data-n="1"]){display:none}`,
  `.lay{transition:transform .4s}`,
  `.k-btn[aria-pressed="true"]{color:var(--anatomy-strong)}`,
].join("\n");

const key = u.keyHtml([
  { hue: "ink", label: "square wave f" },
  { hue: "blue", label: "sine term b_k sin kx" },
  { hue: "yellow", label: "partial sum S_N" },
  { hue: "green", label: "area of f · sin kx" },
  { hue: "red", label: "overshoot" },
]);

const controls = m.KPICK.map((k) => `<button type="button" class="k-btn" data-k="${k}" aria-pressed="${k === 3}">k = ${k}</button>`).join("");
const stage = u.stageHtml({
  dwell: 8000,
  scenes,
  svg,
  label: "Fourier series explainer. Left and right arrows change the scene. Up and down arrows move the probe x, pick k, or change the number of terms. Comma and period change the number of terms.",
  css,
  key,
  controls,
  controlScenes: [4],
  time: { steps: m.NMAX + 1, label: "terms", scenes: [3, 5] },
  narrow: NARROW,
});

// ---- Page script: draws from the model's own functions ----
const live = `
${u.modelScript([m.square, m.coef, m.partial, m.peakX, m.rms, m.round2, m.termsAt, m.areas], { NMAX: m.NMAX, GIBBS: m.GIBBS })}
const MAIN = ${JSON.stringify(MAIN)};
const ZOOM = ${JSON.stringify(ZOOM)};
const K = ${K};
const SCHEDULE = [1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25];
const root = UNFOLD.stage;
const $ = (s) => root.querySelector(s);
const readout = document.querySelector("[data-readout]");
const scale = (P) => ({ x: (v) => P.x + ((v - P.xr[0]) / (P.xr[1] - P.xr[0])) * P.w, y: (v) => P.y + P.h - ((v - P.yr[0]) / (P.yr[1] - P.yr[0])) * P.h });
const SM = scale(MAIN);
const SZ = scale(ZOOM);
function path(S, fn, a, b, n) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    d += (i ? "L" : "M") + S.x(x).toFixed(1) + " " + S.y(fn(x)).toFixed(1);
  }
  return d;
}
function areaPath(fn, sign) {
  const a = -Math.PI, b = Math.PI, n = 600;
  let d = "M" + SM.x(a).toFixed(1) + " " + SM.y(0).toFixed(1);
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const v = fn(x);
    d += "L" + SM.x(x).toFixed(1) + " " + SM.y(sign > 0 ? Math.max(v, 0) : Math.min(v, 0)).toFixed(1);
  }
  return d + "L" + SM.x(b).toFixed(1) + " " + SM.y(0).toFixed(1) + "Z";
}
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function piText(j, den) {
  if (j === 0) return "0";
  const g = gcd(j, den), p = j / g, q = den / g;
  const top = (p < 0 ? "−" : "") + (Math.abs(p) === 1 ? "" : Math.abs(p)) + "π";
  return q === 1 ? top : top + "/" + q;
}
const sub = (n) => String(n).replace(/\\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d]);
const signed = (v) => (v < 0 ? "(" + fmt(v, 2) + ")" : fmt(v, 2));

let N = 1;
let k = 3;
let j = 12; // probe x = j·π/24
const term = (kk) => (x) => coef(kk) * Math.sin(kk * x);
$("#term1").setAttribute("d", path(SM, term(1), MAIN.xr[0], MAIN.xr[1], 400));

function drawSums() {
  const kNew = 2 * N - 1;
  $("#termNew").setAttribute("d", path(SM, term(UNFOLD.scene() === 2 ? 3 : kNew), MAIN.xr[0], MAIN.xr[1], 1400));
  $("#sum").setAttribute("d", path(SM, (x) => partial(N, x), MAIN.xr[0], MAIN.xr[1], 1400));
  $("#sumPrev").setAttribute("d", N > 1 ? path(SM, (x) => partial(N - 1, x), MAIN.xr[0], MAIN.xr[1], 1400) : "");
  $("#zsum").setAttribute("d", path(SZ, (x) => partial(N, x), ZOOM.xr[0], ZOOM.xr[1], 900));
  const vals = Array.from({ length: K }, (_, i) => (i + 1 <= kNew ? coef(i + 1) : 0));
  const spec = $("#spec");
  setBars(spec, vals);
  spec.querySelectorAll(".u-bar").forEach((b, i) => b.toggleAttribute("data-zero", vals[i] === 0));
  // zoom: the peak, its overshoot bar, the trail of earlier peaks
  const px = peakX(N), pv = partial(N, px);
  const dot = $("#peakDot");
  dot.setAttribute("cx", SZ.x(px).toFixed(1));
  dot.setAttribute("cy", SZ.y(pv).toFixed(1));
  $("#overBar").setAttribute("d", "M" + SZ.x(px).toFixed(1) + " " + SZ.y(1).toFixed(1) + "V" + SZ.y(pv).toFixed(1));
  const tag = $("#peakTag text");
  const right = SZ.x(px) < ZOOM.x + ZOOM.w * 0.55;
  tag.setAttribute("x", (SZ.x(px) + (right ? -4 : 4)).toFixed(1));
  tag.setAttribute("y", (SZ.y(pv) - 24).toFixed(1));
  tag.setAttribute("text-anchor", right ? "start" : "end");
  tag.textContent = "N = " + N + ", peak " + fmt(pv, 3);
  root.querySelectorAll(".trail,.trail-lab").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.n) > N || Number(el.dataset.n) === N));
}

function drawK() {
  $("#sink").setAttribute("d", path(SM, (x) => Math.sin(k * x), MAIN.xr[0], MAIN.xr[1], 900));
  const g = (x) => square(x) * Math.sin(k * x);
  $("#areaUp").setAttribute("d", areaPath(g, 1));
  $("#areaDown").setAttribute("d", areaPath(g, -1));
  root.querySelectorAll(".k-btn").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.k) === k)));
}

function drawProbe() {
  const sc = UNFOLD.scene();
  const x = (j * Math.PI) / 24;
  const v = sc === 0 ? square(x) : sc === 1 ? termsAt(1, x).sum : termsAt(sc === 2 ? 2 : N, x).sum;
  const hue = sc === 0 ? "ink" : sc === 1 ? "blue" : "yellow";
  const probe = $("#probe");
  probe.setAttribute("data-hue", hue);
  probe.style.transform = "translateX(" + SM.x(x).toFixed(1) + "px)";
  const cy = SM.y(sc === 0 ? square(x) : sc === 1 ? coef(1) * Math.sin(x) : partial(sc === 2 ? 2 : N, x));
  const dot = probe.querySelector(".probe-dot");
  dot.setAttribute("cy", cy.toFixed(1));
  const t = probe.querySelector(".probe-text");
  const below = cy < MAIN.y + 30;
  t.setAttribute("x", "7");
  t.setAttribute("y", (below ? cy + 18 : cy - 9).toFixed(1));
  t.setAttribute("text-anchor", SM.x(x) > MAIN.x + MAIN.w - 50 ? "end" : "start");
  if (SM.x(x) > MAIN.x + MAIN.w - 50) t.setAttribute("x", "-7");
  t.textContent = sc === 0 ? (v > 0 ? "+1" : v < 0 ? "−1" : "0") : sc === 3 && N > 4 ? fmt(partial(N, x), 3) : fmt(v, 2);
}

function say() {
  const sc = UNFOLD.scene();
  const x = (j * Math.PI) / 24;
  const xs = "x = " + piText(j, 24);
  let text = "";
  if (sc === 0) text = xs + " · f(x) = " + (square(x) > 0 ? "+1" : square(x) < 0 ? "−1" : "0 (the midpoint of the jump)");
  else if (sc <= 3) {
    const n = sc === 1 ? 1 : sc === 2 ? 2 : N;
    const r = termsAt(n, x);
    if (n <= 4) text = xs + " · S" + sub(n) + " = " + r.terms.map((t) => fmt(t.b, 2) + "×" + signed(t.s)).join(" + ") + " = " + fmt(r.sum, 2);
    else text = xs + " · S" + sub(n) + " = " + r.terms.slice(0, 3).map((t, i) => (i ? (t.v < 0 ? " − " : " + ") + fmt(Math.abs(t.v), 2) : fmt(t.v, 2))).join("") + " + … (" + n + " terms) = " + fmt(partial(n, x), 3);
    if (sc === 3) text += " · rms error " + fmt(rms(N), 3);
  } else if (sc === 4) {
    const a = areas(k);
    text = "k = " + k + " · area above " + fmt(a.up, 2) + " − area below " + fmt(a.down, 2) + " = " + fmt(a.net, 2) + " · b" + sub(k) + " = " + fmt(a.net, 2) + " / π = " + fmt(round2(a.net) / Math.PI, 2);
  } else {
    const px = peakX(N), pv = partial(N, px);
    text = "N = " + N + " · peak at x = π/" + 2 * N + " = " + fmt(px, 3) + " · S" + sub(N) + " = " + fmt(pv, 3) + " · rms error " + fmt(rms(N), 3);
  }
  if (readout.textContent !== text) readout.textContent = text;
}

function drawAll() {
  drawSums();
  drawProbe();
  say();
  const sc = UNFOLD.scene();
  mark($("#spec"), sc === 4 ? k - 1 : sc === 3 ? 2 * N - 2 : sc === 2 ? 2 : -1, ".u-bar");
  UNFOLD.timeAt(N);
}
function setN(v) {
  N = Math.max(1, Math.min(NMAX, v));
  drawAll();
}

root.addEventListener("unfold:scene", (e) => {
  const sc = e.detail.scene;
  if (sc === 1) N = 1;
  else if (sc === 2) N = 2;
  else if (sc === 3 || sc === 5) N = 1;
  else N = NMAX;
  drawAll();
});
for (const sc of [3, 5]) UNFOLD.beat(sc, 520, (b) => setN(b < 0 ? NMAX : SCHEDULE[Math.min(b, SCHEDULE.length - 1)]), 700);
UNFOLD.onTime((t) => {
  if (UNFOLD.scene() !== 3 && UNFOLD.scene() !== 5) {
    UNFOLD.go(3);
    UNFOLD.pause();
  }
  setN(t);
});
root.querySelector(".u-ctl").addEventListener("click", (e) => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  UNFOLD.pause();
  k = Number(b.dataset.k);
  drawK();
  drawAll();
});
root.addEventListener("keydown", (e) => {
  const by = { ArrowUp: 1, ArrowDown: -1 }[e.key];
  if (by === undefined) return;
  e.preventDefault();
  UNFOLD.pause();
  const sc = UNFOLD.scene();
  if (sc <= 3) j = Math.max(-48, Math.min(48, j + by));
  else if (sc === 4) {
    k = Math.max(1, Math.min(6, k + by));
    drawK();
  } else return setN(N + by);
  drawAll();
});
$(".hit").addEventListener("click", (e) => {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(e.target.getScreenCTM().inverse());
  const x = MAIN.xr[0] + ((p.x - MAIN.x) / MAIN.w) * (MAIN.xr[1] - MAIN.xr[0]);
  UNFOLD.pause();
  j = Math.max(-48, Math.min(48, Math.round((x / Math.PI) * 24)));
  drawAll();
});
drawK();
drawAll();
`;

// ---- Notes ----
const T = m.TABLE.map((r) => [String(r.N), String(2 * r.N - 1), fmt(r.x, 3), fmt(r.peak, 3), fmt(r.rms, 3)]);
const O = m.OTHER.map((r) => [String(r.k), fmt(r.square, 3), fmt(r.saw, 3), fmt(r.tri, 3)]);
const notes = u.notesHtml([
  {
    title: "The error shrinks, the overshoot stays",
    html: `<p>The rms error goes to 0 as N grows. The peak next to the jump moves closer to the jump but stays above 1.179.</p>`,
    table: { head: ["N terms", "highest k", "peak x = π/(2N)", "peak of S_N", "rms error"], rows: T },
  },
  {
    title: "Other waves",
    html: `<p>A jump makes the heights fall like 1/k. A corner without a jump makes them fall like 1/k², so the triangle wave needs far fewer terms.</p>`,
    table: { head: ["k", "square b_k", "sawtooth b_k", "triangle b_k"], rows: [...O, ["falls like", "1/k", "1/k", "1/k²"]] },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["topic", "what happens"],
      rows: [
        ["cosine terms", "All are 0 here, because f is odd: f(−x) = −f(x)."],
        ["value at a jump", "Every S_N(0) is 0, the midpoint of −1 and +1."],
        ["kind of convergence", "Mean square: yes. Uniform: no, because of the overshoot."],
        ["complex form", "f = Σ c_k e^(ikx), with c_k = b_k / 2i and c_−k = −c_k for odd k > 0."],
        ["the limit 1.179", "(2/π)·Si(π), where Si is the sine integral. Found by Wilbraham (1848) and Gibbs (1899)."],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["harmonic", "A sine wave sin kx with a whole number frequency k."],
        ["b_k", "The height of harmonic k in the sum."],
        ["partial sum S_N", "The sum of the first N nonzero harmonics."],
        ["period", "The length after which the wave repeats: 2π here."],
        ["Gibbs overshoot", "The bump of about 9% of the jump next to each jump."],
        ["rms error", "The square root of the mean squared gap, over one period."],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "A square wave from sines",
    hint: "← → scene · ↑ ↓ pick · , . terms",
    readout: "x = π/2 · f(x) = +1",
    caption:
      "The square wave has period 2π and height ±1. Every curve, bar and number comes from a small model that computes the sums and integrals. For up to 4 terms, the readout rounds each term to 2 places and adds the rounded terms. For more terms, it prints the exact sum.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "page-light.html" : "page.html");
const title = "A square wave from sines";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
