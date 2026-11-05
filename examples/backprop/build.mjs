import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const light = process.argv.includes("--light");
// A course page: follow the reader's system theme. --light writes the light page for the checks.
const theme = light ? "light" : "auto";

const W = 820, H = 392; // wide viewBox
// Narrow viewBox (phones): the graph runs top to bottom. One height per scene, so a scene without a panel has no empty band.
const NW = 400, NH = [505, 505, 665, 680, 505, 640, 730];
const N = 7;
const f = m.F;
const nf = (v) => (Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? u.fmt(v, 1) : u.fmt(v, 3));

// A subscript as a tspan: the math font's subscript digits render badly in SVG text.
const si = (s, i) => `${s}<tspan class="bp-si" dy="4">${i}</tspan>`;
// ---- The computation graph, drawn twice: wide (left to right) and narrow (top to bottom) ----
const NODES = {
  x1: { name: si("x", 1), note: "input", hue: "ink" },
  x2: { name: si("x", 2), note: "input", hue: "ink" },
  z1: { name: si("z", 1), note: `+b ${nf(m.P0.b[0])}`, hue: "blue" },
  z2: { name: si("z", 2), note: `+b ${nf(m.P0.b[1])}`, hue: "blue" },
  h1: { name: si("h", 1), note: "σ", hue: "blue" },
  h2: { name: si("h", 2), note: "σ", hue: "blue" },
  yh: { name: "ŷ", note: `+c ${nf(m.P0.c)}`, hue: "blue" },
  L: { name: "L", note: "½(ŷ−y)²", hue: "purple" },
  y: { name: "y", note: "target", hue: "ink" },
};
const value0 = { x1: f.x[0], x2: f.x[1], z1: f.z[0], z2: f.z[1], h1: f.h[0], h2: f.h[1], yh: f.yhat, L: f.L, y: f.y };
const grad0 = { x1: f.gx[0], x2: f.gx[1], z1: f.gz[0], z2: f.gz[1], h1: f.gh[0], h2: f.gh[1], yh: f.gy, L: 1 };
// [tail, head, top label, top hue, bottom label, bottom hue, key]
const EDGES = [
  ["x1", "z1", nf(m.P0.W[0][0]), "gold", nf(f.gW[0][0]), "red", "w11"],
  ["x2", "z1", nf(m.P0.W[0][1]), "gold", nf(f.gW[0][1]), "red", "w12"],
  ["x1", "z2", nf(m.P0.W[1][0]), "gold", nf(f.gW[1][0]), "red", "w21"],
  ["x2", "z2", nf(m.P0.W[1][1]), "gold", nf(f.gW[1][1]), "red", "w22"],
  ["z1", "h1", "σ", "", nf(f.s[0]), "green", "s1"],
  ["z2", "h2", "σ", "", nf(f.s[1]), "green", "s2"],
  ["h1", "yh", nf(m.P0.v[0]), "gold", nf(f.gv[0]), "red", "v1"],
  ["h2", "yh", nf(m.P0.v[1]), "gold", nf(f.gv[1]), "red", "v2"],
  ["yh", "L", "", "", "", "", "yl"],
  ["y", "L", "", "", "", "", "tl"],
];
const T = { x: 0.32, z: 0.5, h: 0.5 }; // where on an edge its labels sit, by tail kind
const WIDE = {
  pos: { x1: [60, 90], x2: [60, 230], z1: [300, 90], z2: [300, 230], h1: [450, 90], h2: [450, 230], yh: [610, 160], L: [760, 160], y: [760, 62] },
  // where the value (blue) and the gradient (red) sit around a node: [dx, dy, anchor]
  val: (n) => (n === "L" ? [-36, -26, "end"] : [0, -30, "middle"]),
  grad: () => [0, 33, "middle"],
};
const NARROW = {
  pos: { x1: [110, 36], x2: [290, 36], z1: [110, 150], z2: [290, 150], h1: [110, 262], h2: [290, 262], yh: [200, 366], L: [200, 466], y: [330, 466] },
  val: (n) => (/2$/.test(n) || n === "y" ? [38, -7, "start"] : [-38, -7, "end"]),
  grad: (n) => (/2$/.test(n) ? [38, 10, "start"] : [-38, 10, "end"]),
};
const HW = 32, HH = 20;
const clip = ([ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.min((HW + 2) / Math.abs(dx || 1e-9), (HH + 2) / Math.abs(dy || 1e-9));
  return [ax + dx * t, ay + dy * t];
};
const text = (x, y, s, { cls, hue, anchor = "middle", n, extra = "" }) =>
  `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" style="text-anchor:${anchor}"${hue ? ` data-hue="${hue}"` : ""}${n ? ` data-n="${n}"` : ""}${extra}>${s}</text>`;

function graph(L, cls) {
  const P = L.pos;
  const edges = EDGES.map(([a, b, top, topHue, bot, botHue, key]) => {
    const A = clip(P[a], P[b]), B = clip(P[b], P[a]);
    const t = a[0] === "x" && P[a][1] !== P[b][1] && P[a][0] !== P[b][0] ? 0.22 : T[a[0]] ?? 0.5;
    const px = A[0] + (B[0] - A[0]) * t, py = A[1] + (B[1] - A[1]) * t;
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    let nx = -(B[1] - A[1]) / len, ny = (B[0] - A[0]) / len;
    if (ny > 1e-9 || (Math.abs(ny) < 1e-9 && nx > 0)) (nx = -nx), (ny = -ny);
    const side = (dx, dy) => (Math.abs(dx) > 0.6 ? (dx < 0 ? "end" : "start") : "middle");
    const lab = (s, h, sgn, c) => (s ? `<g class="${c}" data-k="${key}">${text(px + nx * 9 * sgn, py + ny * 9 * sgn + (Math.abs(ny) > 0.6 ? (sgn > 0 ? -1 : 4) : 3.5), s, { cls: "bp-elab", hue: h, anchor: side(nx * sgn, ny * sgn) })}</g>` : "");
    const hit = /^[wv]/.test(key) ? `<path class="bp-hit" d="M${A[0].toFixed(1)} ${A[1].toFixed(1)}L${B[0].toFixed(1)} ${B[1].toFixed(1)}"/>` : "";
    return `<g class="bp-edge" data-a="${a}" data-b="${b}" data-k="${key}">${hit}${u.arrow(A, B, { head: 5 })}${lab(top, topHue, 1, "bp-ew")}${lab(bot, botHue, -1, key[0] === "s" ? "bp-es" : "bp-eg")}</g>`;
  });
  const pulses = EDGES.filter(([a]) => a !== "y").flatMap(([a, b]) => {
    const stage = { x: 0, z: 1, h: 2, y: 3 }[a[0]];
    const A = clip(P[a], P[b]), B = clip(P[b], P[a]);
    return [u.pulseSvg(A, B, { hue: "blue", begin: stage * 0.8, travel: 0.75, cycle: 7 }), u.pulseSvg(B, A, { hue: "red", begin: 3.6 + (3 - stage) * 0.8, travel: 0.75, cycle: 7 })];
  });
  const nodes = Object.entries(NODES).map(([n, { name, note, hue }]) => {
    const [x, y] = P[n];
    const [vx, vy, va] = L.val(n), [gx, gy, ga] = L.grad(n);
    return (
      `<g class="bp-node" data-n="${n}" data-hue="${hue}" transform="translate(${x} ${y})">` +
      `<rect x="${-HW}" y="${-HH}" width="${HW * 2}" height="${HH * 2}" rx="9"/>` +
      text(0, -2, name, { cls: "bp-name" }) +
      text(0, 13, note, { cls: "bp-note", hue: note.startsWith("+") ? "gold" : "", extra: note.startsWith("+") ? ` data-note="${n}"` : "" }) +
      `<g class="bp-v" data-n="${n}">${text(vx, vy, nf(value0[n]), { cls: "bp-num", anchor: va, hue: n === "L" ? "purple" : n[0] === "x" || n === "y" ? "ink" : "blue" })}</g>` +
      (n === "y" ? "" : `<g class="bp-g" data-n="${n}">${text(gx, gy, nf(grad0[n]), { cls: "bp-num", anchor: ga, hue: "red" })}</g>`) +
      `</g>`
    );
  });
  // Drawn labels: the fan-out sum at the inputs.
  const sums = ["x1", "x2"].map((n) => {
    const [x, y] = P[n];
    const [gx, gy, ga] = L.grad(n);
    return `<g class="bp-sum">${text(x + gx, y + gy + 13, "adds 2 paths", { cls: "bp-tag", anchor: ga })}</g>`;
  });
  return `<g class="u-move ${cls}">${edges.join("")}<g class="bp-pulses">${pulses.join("")}</g>${nodes.join("")}${sums.join("")}</g>`;
}

// ---- Panels under the graph ----
// Scene 3: the loss as a function of the error ŷ − y, with the tangent at the current point.
const PL = { x: 0, y: 0, w: 240, h: 74, xr: [-2.2, 2.2], yr: [0, 2.4] };
const lossPlot = u.plot({ ...PL, f: (e) => 0.5 * e * e, xTicks: [-2, -1, 0, 1, 2], yTicks: [1, 2], xName: "ŷ − y", yName: "L", hue: "purple", yHue: "purple" });
const panelLoss = `<g class="u-move" id="pLoss">${lossPlot.svg}<path class="bp-tan" data-hue="red" d=""/><circle class="bp-pt" data-hue="purple" r="4"/>` +
  `<g class="bp-ptlab">${text(0, 0, "", { cls: "bp-num", hue: "red", anchor: "start", extra: ' data-lab="slope"' })}</g></g>`;

// Scene 4: σ with its slope at z_j, and the chain-rule product.
const PS = { x: 0, y: 0, w: 220, h: 80, xr: [-4, 4], yr: [0, 1] };
const sigPlot = u.plot({ ...PS, f: m.sigmoid, xTicks: [-4, -2, 0, 2, 4], yTicks: [1], xName: "z", yName: "σ(z)", hue: "", xHue: "blue" });
const chainRow = (() => {
  const items = [["gh", "red", "∂L/∂h"], ["×"], ["s", "green", "σ′(z)"], ["="], ["gz", "red", "∂L/∂z"]];
  let x = 0;
  return items.map(([k, hue, label]) => {
    if (!hue) { const s = text(x + 8, 18, k, { cls: "bp-op" }); x += 16; return s; }
    const s = `<g data-chain="${k}">${u.chip(nf(0), x, 6, { w: 70, h: 24, rx: 6, hue })}${text(x + 35, 46, label, { cls: "bp-tag", extra: ` data-chainlab="${k}"` })}</g>`;
    x += 78;
    return s;
  }).join("");
})();
const panelChain = `<g class="u-move" id="pChain">${sigPlot.svg}<path class="bp-tan" data-hue="green" d=""/><circle class="bp-pt" data-hue="blue" r="4"/>` +
  `<g class="bp-ptlab">${text(0, 0, "", { cls: "bp-num", hue: "green", anchor: "start", extra: ' data-lab="slope"' })}</g>` +
  `<g class="bp-sub" id="pChainRow">${chainRow}</g></g>`;

// Scene 6: the weight gradients as outer products (falling layout).
const CW = 50;
const gridG = (id, values, hue, name) => u.cellGrid({ id, values, hue, cell: [CW, 20], places: 3, name, dims: false, max: 0.5 });
const panelW =
  `<g class="u-move" id="pW">` +
  `<g transform="translate(70 0)">${gridG("gXt", [f.x], "ink", "xᵀ")}</g>` +
  `<g transform="translate(0 40)">${gridG("gDz", f.gz.map((v) => [v]), "red", "")}</g>` +
  text(-8, 64, "∂L/∂z", { cls: "bp-gname", anchor: "end", hue: "red" }) +
  `<g transform="translate(70 40)">${gridG("gGW", f.gW, "red", "")}</g>` +
  text(70, 98, "∂L/∂W", { cls: "bp-gname", anchor: "start", hue: "red" }) +
  `<g class="bp-sub" id="pWv"><g transform="translate(320 0)">${gridG("gHt", [f.h], "blue", "hᵀ")}</g>` +
  `<g transform="translate(250 40)">${gridG("gDy", [[f.gy]], "red", "")}</g>` +
  text(242, 54, "∂L/∂ŷ", { cls: "bp-gname", anchor: "end", hue: "red" }) +
  `<g transform="translate(320 40)">${gridG("gGv", [f.gv], "red", "")}</g>` +
  text(320, 88, "∂L/∂v", { cls: "bp-gname", anchor: "start", hue: "red" }) + `</g></g>`;

// Scene 7: the current weights, their gradients, the finite-difference check, and the weights after one more step.
const UW = 40, UL = 74, UR = 22; // cell width, row-name column, row pitch
const NAMES = [si("w", 11), si("w", 12), si("w", 21), si("w", 22), si("b", 1), si("b", 2), si("v", 1), si("v", 2), "c"];
const rowG = (id, values, hue) => u.cellGrid({ id, values: [values], hue, cell: [UW, 20], places: 3, dims: false, max: 1 });
const panelUpdate =
  `<g class="u-move" id="pUp">` +
  NAMES.map((s, i) => text(UL + i * UW + UW / 2, 4, s, { cls: "bp-colname", hue: "gold" })).join("") +
  [["w", "gold", m.flatP(m.P0), "gOld"], ["∂L/∂w", "red", m.gradFlat(f), "gGr"], ["finite diff.", "ink", m.NUM.map(m.r3), "gFd"], ["new w", "gold", m.flatP(m.S.q), "gNew"]]
    .map(([label, hue, values, id], r) => text(UL - 6, 24 + r * UR, label, { cls: "bp-rowname", anchor: "end", hue }) + `<g transform="translate(${UL} ${14 + r * UR})">${rowG(id, values, hue)}</g>`)
    .join("") +
  `</g>`;
// The loss after each gradient step the reader takes. The hollow point is the loss after one more step.
const HPW = 190, HPH = 64;
const panelHist =
  `<g class="u-move" id="pHist">` +
  `<g class="bp-hlab">${text(0, HPH + 14, "loss L after each gradient step", { cls: "bp-tag", anchor: "start" })}` +
  text(-5, 0, nf(f.L), { cls: "bp-tag", anchor: "end", extra: ' data-lab="hmax" style="dominant-baseline:central"' }) +
  text(-5, HPH, "0", { cls: "bp-tag", anchor: "end", extra: ' style="dominant-baseline:central"' }) +
  text(0, 0, "", { cls: "bp-num", hue: "purple", anchor: "start", extra: ' data-lab="hnow"' }) + `</g>` +
  `<path class="bp-axis" d="M0 0V${HPH}H${HPW}"/>` +
  `<path class="bp-hline" data-hue="purple" d=""/><path class="bp-hnext" data-hue="purple" d=""/><g class="bp-hpts" data-hue="purple"></g></g>`;

// The two passes as directions under the graph (scenes 1, 2 and 5).
const dirBand =
  `<g class="u-move" id="pDir"><g class="bp-dir" data-d="f">${u.arrow([60, 0], [760, 0], { hue: "blue", head: 7, width: 1.6 })}${text(410, -10, "forward pass: values, left to right", { cls: "bp-tag", hue: "blue" })}</g>` +
  `<g class="bp-dir" data-d="b">${u.arrow([760, 34], [60, 34], { hue: "red", head: 7, width: 1.6 })}${text(410, 24, "backward pass: gradients, right to left, same edges", { cls: "bp-tag", hue: "red" })}</g></g>`;
const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "Backpropagation on a network with 2 inputs, 2 sigmoid hidden units and 1 output, in seven scenes from the forward pass to one weight update.",
  body: [graph(WIDE, "gWide"), graph(NARROW, "gNarrow"), dirBand, panelLoss, panelChain, panelW, panelUpdate, panelHist],
});

// ---- Places per scene. Scenes 3, 4, 6, 7 have a panel under the graph. ----
const S = (map) => u.states(N, map);
// placeCss throws when every state is null, so an empty map writes nothing (the other layout hides the group).
const place = (sel, map) => (Object.keys(map).length ? u.placeCss(sel, S(map)) : "");
const both = (sel, wide, narrow) => [place(sel, wide), Object.keys(narrow).length ? place(sel, narrow).replace(/\.u-stage\[data-scene/g, ".u-stage[data-narrow][data-scene") : `.u-stage[data-narrow] ${sel}{opacity:0;pointer-events:none}`];
const gUp = { x: 0, y: -22 }, gMid = { x: 0, y: 8 };
const nUp = { x: 0, y: 0 };
const css = [
  ...both(".gWide", { 0: gMid, 1: gMid, 2: gUp, 3: gUp, 4: gMid, 5: gUp, 6: gUp }, {}),
  ...both(".gNarrow", {}, { 0: nUp, 1: nUp, 2: nUp, 3: nUp, 4: nUp, 5: nUp, 6: nUp }),
  ...both("#pLoss", { 2: { x: 250, y: 296 } }, { 2: { x: 70, y: 540 } }),
  ...both("#pChain", { 3: { x: 110, y: 300 } }, { 3: { x: 110, y: 524 } }),
  ...both("#pW", { 5: { x: 170, y: 286 } }, { 5: { x: 120, y: 534 } }),
  ...both("#pUp", { 6: { x: 50, y: 290 } }, { 6: { x: 0, y: 530, s: 0.92 } }),
  ...both("#pDir", { 0: { x: 0, y: 330 }, 1: { x: 0, y: 330 }, 4: { x: 0, y: 330 } }, {}),
  ".bp-dir{transition:opacity .5s}.u-stage[data-scene='1'] .bp-dir[data-d='b'],.u-stage[data-scene='4'] .bp-dir[data-d='f']{opacity:.15}",
  ".bp-dir .bp-tag{fill:var(--hue);font-size:12px}",
  ...both("#pHist", { 6: { x: 570, y: 310 } }, { 6: { x: 110, y: 650 } }),
  ".u-stage[data-narrow] .gWide,.u-stage:not([data-narrow]) .gNarrow{display:none}",
  // Inside a panel, the second part stacks under the first on a phone.
  ".bp-sub{transition:transform .5s var(--u-ease)}",
  "#pChainRow{transform:translate(290px,8px)}.u-stage[data-narrow] #pChainRow{transform:translate(-80px,108px)}",
  // On a phone, scene 6 shows the W part only (the matrix the edges carry), and the panels keep their numbers.
  ".u-stage[data-narrow] #pWv,.u-stage[data-narrow] .bp-sum,.u-stage[data-narrow] .gNarrow .bp-eg[data-k^='w']{display:none}",
  "@container (max-width:520px){#pW .u-num,#pUp .u-num{display:inline}}",
  "#pUp .bp-rowname[data-hue='ink']{fill:var(--u-muted)}",
  // Graph look
  ".bp-node rect{fill:var(--u-card);stroke:var(--hue);stroke-width:1.1;transition:stroke-width .3s,fill .3s}",
  ".bp-node[data-focus] rect{stroke-width:2.4}",
  ".bp-node[data-cur] rect{fill:color-mix(in srgb,var(--hue) 18%,var(--u-card))}",
  ".bp-name{font:italic 600 16px 'Latin Modern Roman','STIX Two Text',var(--unfold-serif);fill:var(--hue)}",
  ".bp-ctl{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 12px}",
  ".bp-si{font:500 10px var(--u-mono);font-style:normal}",
  ".bp-note{font:10px var(--u-mono);fill:var(--hue,var(--u-muted))}",
  ".bp-num{font:600 12px var(--u-mono);font-variant-numeric:tabular-nums;fill:var(--hue);dominant-baseline:central}",
  ".bp-elab{font:500 11px var(--u-mono);fill:var(--hue,var(--u-muted))}",
  ".bp-tag{font:10.5px var(--u-mono);fill:var(--u-muted)}",
  ".bp-op{font:16px var(--u-mono);fill:var(--u-strong);text-anchor:middle;dominant-baseline:central}",
  ".bp-gname{font:italic 600 14px 'Latin Modern Roman','STIX Two Text',var(--unfold-serif);fill:var(--hue)}",
  "#pW .u-name{font-family:'Latin Modern Roman','STIX Two Text',var(--unfold-serif)}",
  ".bp-colname{font:italic 600 12px 'Latin Modern Roman','STIX Two Text',var(--unfold-serif);fill:var(--hue)}",
  ".bp-rowname{font:11px var(--u-mono);fill:var(--hue);dominant-baseline:central}",
  "#pChain .u-chip text,#pChain .u-chip rect{font-size:12px}",
  ".bp-tan{stroke:var(--hue);stroke-width:2;fill:none;stroke-linecap:round}.bp-pt{fill:var(--hue)}",
  ".bp-v,.bp-g,.bp-eg,.bp-es,.bp-sum{opacity:0;transition:opacity .45s var(--u-ease)}",
  ".bp-v[data-on],.bp-g[data-on]{opacity:1}",
  ".bp-node[data-n^='x'] .bp-v,.bp-node[data-n='y'] .bp-v{opacity:1}",
  ".u-stage:is([data-scene='5'],[data-scene='6']) .bp-eg{opacity:1}",
  ".u-stage:is([data-scene='3'],[data-scene='4']) .bp-es{opacity:1}",
  ".u-stage:is([data-scene='4'],[data-scene='5']) .bp-sum{opacity:1}",
  ".bp-edge .u-arrow{transition:color .4s}",
  ".bp-edge[data-f] .u-arrow{color:var(--unfold-blue)}",
  ".bp-edge[data-g] .u-arrow{color:var(--unfold-red)}",
  ".bp-edge[data-focus] .u-arrow{--w:2}",
  // Click a weight: its path back to the loss lights in the Weights scene.
  ".bp-hit{stroke:transparent;stroke-width:14;fill:none;pointer-events:stroke;cursor:pointer}.bp-ew{cursor:pointer}",
  ".u-stage[data-scene='5'] .bp-edge:not([data-trace]) .u-arrow{opacity:.3}",
  ".u-stage[data-scene='5'] .bp-edge[data-trace] .u-arrow{--w:2.6}",
  ".u-stage[data-scene='5'] .bp-node[data-trace] rect{stroke-width:2.4}",
  ".u-stage[data-scene='5'] .bp-ew[data-pick] text{font-weight:800;text-decoration:underline}",
  // The loss history
  ".bp-axis{stroke:var(--u-lo);fill:none}",
  ".bp-hline{stroke:var(--hue);stroke-width:1.6;fill:none}.bp-hnext{stroke:var(--hue);stroke-width:1.4;fill:none;stroke-dasharray:3 3}",
  ".bp-hpts circle{fill:var(--hue)}.bp-hpts circle:last-child{fill:var(--u-card);stroke:var(--hue);stroke-width:1.4}",
  ".u-stage:not([data-scene='0']) .bp-pulses{display:none}",
  "@container (max-width:520px){.bp-tag{font-size:12px}}",
  // Entrances
  u.revealCss(2, "#pLoss .bp-tan", { kind: "fade", delay: 700 }),
  u.revealCss(3, "#pChain .bp-tan", { kind: "fade", delay: 600 }),
  u.revealCss(3, "#pChainRow [data-chain]", { kind: "fade", delay: 900, stepR: 350 }),
  u.revealCss(5, "#gXt,#gDz,#gHt,#gDy", { kind: "cells", delay: 300, stepR: 60 }),
  u.revealCss(5, "#gGW,#gGv", { kind: "cells", delay: 900, stepR: 160, stepC: 80 }),
  u.revealCss(6, "#gGr", { kind: "cells", delay: 300, stepC: 40 }),
  u.revealCss(6, "#gNew", { kind: "cells", delay: 900, stepC: 60 }),
].join("\n");
// ponytail: a <g> is used to set --r per chain item, so revealCss steps through them.
const css2 = `#pChainRow [data-chain="gh"]{--r:0}#pChainRow [data-chain="s"]{--r:1}#pChainRow [data-chain="gz"]{--r:2}`;

// ---- Math, coloured by identity ----
const { mo } = u;
const mi = (s, hue) => u.mi(s, hue);
const d = (inner) => `<mfrac data-hue="red"><mrow><mo>∂</mo><mi>L</mi></mrow><mrow><mo>∂</mo>${inner}</mrow></mfrac>`;
const yhat = (hue = "blue") => `<mover accent="true"><mi data-hue="${hue}">y</mi><mo>^</mo></mover>`;
const sj = (s, j, hue) => `<msub>${mi(s, hue)}<mi>${j}</mi></msub>`;
const sp = `<mspace width="1.2em"/>`;
const scenes = [
  {
    name: "Network",
    math: `${mi("L", "purple")}<mo>=</mo><mfrac><mn>1</mn><mn>2</mn></mfrac>${mo("(")}${yhat()}<mo>−</mo>${mi("y", "ink")}${mo(")")}<msup><mi></mi><mn>2</mn></msup>${sp}${yhat()}<mo>=</mo>${mi("v", "gold")}<mo>·</mo><mi>σ</mi>${mo("(")}${mi("W", "gold")}${mi("x", "ink")}<mo>+</mo>${mi("b", "gold")}${mo(")")}<mo>+</mo>${mi("c", "gold")}`,
    voice: `This network has 2 inputs, 2 sigmoid hidden units and 1 output. Backpropagation finds how the <b data-hue="purple">loss</b> changes when each <b data-hue="gold">weight</b> changes.`,
  },
  {
    name: "Forward",
    math: `${mi("z", "blue")}<mo>=</mo>${mi("W", "gold")}${mi("x", "ink")}<mo>+</mo>${mi("b", "gold")}${sp}${mi("h", "blue")}<mo>=</mo><mi>σ</mi>${mo("(")}${mi("z", "blue")}${mo(")")}${sp}${yhat()}<mo>=</mo>${mi("v", "gold")}<mo>·</mo>${mi("h", "blue")}<mo>+</mo>${mi("c", "gold")}`,
    voice: `The forward pass computes each <b data-hue="blue">value</b> from the nodes on its left. The graph keeps every value, because the backward pass needs them.`,
  },
  {
    name: "Loss",
    math: `${d(yhat(""))}<mo>=</mo>${yhat()}<mo>−</mo>${mi("y", "ink")}`,
    voice: `The <b data-hue="purple">loss</b> is half the squared error. Its slope at the output is the first <b data-hue="red">gradient</b>, and backpropagation starts there.`,
  },
  {
    name: "Chain rule",
    math: `${d(`<msub><mi>z</mi><mi>j</mi></msub>`)}<mo>=</mo>${d(`<msub><mi>h</mi><mi>j</mi></msub>`)}<mo>·</mo><msup><mi data-hue="green">σ</mi><mo data-hue="green">′</mo></msup>${mo("(")}${sj("z", "j", "blue")}${mo(")")}${sp}<msup><mi data-hue="green">σ</mi><mo data-hue="green">′</mo></msup>${mo("(")}${mi("z", "blue")}${mo(")")}<mo>=</mo>${mi("h", "blue")}${mo("(")}<mn>1</mn><mo>−</mo>${mi("h", "blue")}${mo(")")}`,
    voice: `A node multiplies the <b data-hue="red">gradient</b> that arrives from its right by its own <b data-hue="green">local slope</b>. This is the chain rule.`,
  },
  {
    name: "Backward",
    math: `${d(`<msub><mi>h</mi><mi>j</mi></msub>`)}<mo>=</mo>${d(yhat(""))}${sj("v", "j", "gold")}${sp}${d(`<msub><mi>x</mi><mi>k</mi></msub>`)}<mo>=</mo><munder><mo>∑</mo><mi>j</mi></munder>${d(`<msub><mi>z</mi><mi>j</mi></msub>`)}${sj("w", "jk", "gold")}`,
    voice: `The backward pass visits the nodes in reverse order, on the same edges. An input feeds two nodes, so it adds the two <b data-hue="red">gradients</b> that come back.`,
  },
  {
    name: "Weights",
    math: `${d(`<msub><mi>w</mi><mi>jk</mi></msub>`)}<mo>=</mo>${sj("x", "k", "ink")}${d(`<msub><mi>z</mi><mi>j</mi></msub>`)}${sp}${d(`<mi>W</mi>`)}<mo>=</mo>${d(`<mi>z</mi>`)}<msup>${mi("x", "ink")}<mi>T</mi></msup>`,
    voice: `The <b data-hue="red">gradient</b> of a <b data-hue="gold">weight</b> is the value at its tail times the gradient at its head. Click a weight to light its path to the <b data-hue="purple">loss</b>.`,
  },
  {
    name: "Update",
    math: `${mi("w", "gold")}<mo>←</mo>${mi("w", "gold")}<mo>−</mo><mi>η</mi>${d(`<mi>w</mi>`)}`,
    voice: `Gradient descent moves each <b data-hue="gold">weight</b> a small step against its <b data-hue="red">gradient</b>. Press "gradient step" again and again, and watch the <b data-hue="purple">loss</b> go down.`,
  },
];

const key = u.keyHtml([
  { hue: "ink", label: "input x, target y" },
  { hue: "blue", label: "value (forward)" },
  { hue: "red", label: "gradient ∂L/∂·" },
  { hue: "gold", label: "weight, bias" },
  { hue: "green", label: "local slope σ′" },
  { hue: "purple", label: "loss L" },
]);

const num = (k, label, min, max, v, scenes) => `<label${scenes ? ` data-scenes="${scenes}"` : ""}>${label}<input type="number" min="${min}" max="${max}" step="0.1" value="${v}" data-in="${k}" aria-label="${label}"></label>`;
const controls =
  `<div class="bp-ctl"><button type="button" data-j="0" aria-pressed="true">h₁</button><button type="button" data-j="1" aria-pressed="false">h₂</button>` +
  num("x0", "x₁", -2, 2, m.X0[0]) + num("x1", "x₂", -2, 2, m.X0[1]) + num("y", "y", -2, 2, m.Y0) + num("eta", "η", 0.1, 0.8, m.ETA0, "6") +
  `<button type="button" data-train data-scenes="6">gradient step</button><button type="button" data-reset>reset</button></div>`;
const STEPS = 15; // 0: inputs only, 1-6: forward, 7-14: backward
const stage = u.stageHtml({ audio: await u.narrate(scenes, { dir: join(HERE, "voice"), provider: "gemini", model: "gemini-3.8-flash-tts", voice: "Kore" }),
  scenes,
  svg,
  label: "Backpropagation explainer. Left and right arrows change the scene. Up and down arrows pick hidden unit 1 or 2. Comma and period step through the passes. Click a weight to trace its path.",
  css: css + css2,
  key,
  dwell: 7500,
  time: { steps: STEPS, scenes: [1, 4], label: "pass step" },
  controls,
  narrow: [NW, NH],
});

// ---- Page script: every number from the model's own net(), step() and numericGrad(), at the current weights ----
const live = `
${u.modelScript([m.r3, m.sigmoid, m.net, m.step, m.gradFlat, m.flatP, m.unflatP, m.lossExact, m.numericGrad], { P0: m.P0, X0: m.X0, Y0: m.Y0, ETA0: m.ETA0, PL, PS, HPW, HPH })}
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
// p: the current weights. hist: the loss at each weight set the gradient steps visited, from the last reset.
const M = { p: P0, x: [...X0], y: Y0, eta: ETA0, hist: [] };
const FWD = ["z1", "z2", "h1", "h2", "yh", "L"];
const BWD = ["L", "yh", "h1", "h2", "z1", "z2", "x1", "x2"];
const SUB = ["\\u2081", "\\u2082"];
const nf = (v) => (Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? fmt(v, 1) : fmt(v, 3));
const p = (v) => (v < 0 ? "(" + nf(v) + ")" : nf(v));
// The focus weight: w<j><k> (input k to hidden j) or v<j>. j is the focus hidden unit.
let fk = "w11", j = 0, t = 0;
function recompute() {
  const P = M.p;
  M.f = net(P, M.x, M.y);
  M.s = step(P, M.f, M.eta);
  if (!M.hist.length) M.hist = [M.f.L];
  const f = M.f;
  const val = { x1: f.x[0], x2: f.x[1], z1: f.z[0], z2: f.z[1], h1: f.h[0], h2: f.h[1], yh: f.yhat, L: f.L, y: f.y };
  const grad = { x1: f.gx[0], x2: f.gx[1], z1: f.gz[0], z2: f.gz[1], h1: f.gh[0], h2: f.gh[1], yh: f.gy, L: 1 };
  root.querySelectorAll(".bp-v").forEach((g) => (g.firstChild.textContent = nf(val[g.dataset.n])));
  root.querySelectorAll(".bp-g").forEach((g) => (g.firstChild.textContent = nf(grad[g.dataset.n])));
  const eg = { w11: f.gW[0][0], w12: f.gW[0][1], w21: f.gW[1][0], w22: f.gW[1][1], v1: f.gv[0], v2: f.gv[1], s1: f.s[0], s2: f.s[1] };
  root.querySelectorAll(".bp-eg,.bp-es").forEach((g) => (g.firstChild.textContent = nf(eg[g.dataset.k])));
  const ew = { w11: P.W[0][0], w12: P.W[0][1], w21: P.W[1][0], w22: P.W[1][1], v1: P.v[0], v2: P.v[1] };
  root.querySelectorAll(".bp-ew").forEach((g) => g.dataset.k in ew && (g.firstChild.textContent = nf(ew[g.dataset.k])));
  const bias = { z1: "+b " + nf(P.b[0]), z2: "+b " + nf(P.b[1]), yh: "+c " + nf(P.c) };
  root.querySelectorAll("[data-note]").forEach((el) => (el.textContent = bias[el.dataset.note]));
  const $ = (id) => root.querySelector("#" + id);
  setGrid($("gXt"), [f.x], 0.5); setGrid($("gDz"), f.gz.map((v) => [v]), 0.5); setGrid($("gGW"), f.gW, 0.5);
  setGrid($("gHt"), [f.h], 0.5); setGrid($("gDy"), [[f.gy]], 0.5); setGrid($("gGv"), [f.gv], 0.5);
  setGrid($("gOld"), [flatP(P)], 1); setGrid($("gGr"), [gradFlat(f)], 1); setGrid($("gNew"), [flatP(M.s.q)], 1);
  setGrid($("gFd"), [numericGrad(P, M.x, M.y).map(r3)], 1);
  drawHist();
  placePoint($("pLoss"), PL, f.yhat - f.y, f.L, f.gy, "slope at the point " + nf(f.gy));
  focus();
}
// The loss history: solid points for the steps taken, a dashed line to the loss after one more step.
function drawHist() {
  const g = root.querySelector("#pHist");
  const all = [...M.hist, M.s.after.L];
  const n = Math.max(10, all.length - 1);
  const top = Math.max(...all, 0.001);
  const pts = all.map((L, i) => [(i / n) * HPW, HPH - (L / top) * HPH]);
  const d = (ps) => ps.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
  g.querySelector(".bp-hline").setAttribute("d", d(pts.slice(0, -1)));
  g.querySelector(".bp-hnext").setAttribute("d", d(pts.slice(-2)));
  g.querySelector(".bp-hpts").innerHTML = pts.map((q) => '<circle r="2.6" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '"/>').join("");
  const now = g.querySelector('[data-lab="hnow"]');
  // The current loss sits above and right of its point: the line comes from the upper left and the dashed line goes down.
  const [nx, ny] = pts[pts.length - 2];
  now.setAttribute("x", (nx + 6).toFixed(1)); now.setAttribute("y", (ny - 14).toFixed(1));
  now.textContent = nf(M.hist[M.hist.length - 1]);
  g.querySelector('[data-lab="hmax"]').textContent = nf(top);
}
// A point on a plot, with its tangent (slope k) and a label.
function placePoint(panel, R, px, py, k, label) {
  const sx = (v) => R.x + ((v - R.xr[0]) / (R.xr[1] - R.xr[0])) * R.w;
  const sy = (v) => R.y + R.h - ((Math.min(R.yr[1], Math.max(R.yr[0], v)) - R.yr[0]) / (R.yr[1] - R.yr[0])) * R.h;
  const cx = Math.max(R.xr[0], Math.min(R.xr[1], px));
  const pt = panel.querySelector(".bp-pt");
  pt.setAttribute("cx", sx(cx)); pt.setAttribute("cy", sy(py));
  const dx = 0.9 / Math.sqrt(1 + k * k);
  panel.querySelector(".bp-tan").setAttribute("d", "M" + sx(cx - dx) + " " + sy(py - k * dx) + "L" + sx(cx + dx) + " " + sy(py + k * dx));
  const lab = panel.querySelector("[data-lab]");
  // The loss label sits right of the plot: beside the point it would cross the steep curve.
  // The sigmoid rises, so up and left of the point is clear of the curve and the tangent. Near the left edge
  // that space is too narrow, and the top left corner is clear instead (the curve is low there).
  // On a phone the space right of the loss plot is too narrow, so the label goes under the axis.
  let [lx, ly, anchor] = UNFOLD.narrow() ? [R.x, R.y + R.h + 34, "start"] : [R.x + R.w + 40, R.y + R.h / 2, "start"];
  if (R === PS) [lx, ly, anchor] = sx(cx) - R.x >= 96 ? [sx(cx) - 10, sy(py) - 12, "end"] : [R.x + 8, R.y + 10, "start"];
  lab.setAttribute("x", lx); lab.setAttribute("y", ly);
  lab.style.textAnchor = anchor;
  lab.textContent = label;
}
// The edges and nodes on the path from L back to the focus weight.
function trace() {
  const [a, b] = fk[0] === "w" ? ["x" + fk[2], "z" + fk[1]] : ["h" + fk[1], "yh"];
  const on = fk[0] === "w" ? [a + b, b + "h" + fk[1], "h" + fk[1] + "yh", "yhL"] : [a + b, "yhL"];
  root.querySelectorAll(".bp-edge").forEach((e) => e.toggleAttribute("data-trace", on.includes(e.dataset.a + e.dataset.b)));
  const nodes = new Set(on.join(" ").match(/x\\d|z\\d|h\\d|yh|L/g));
  root.querySelectorAll(".bp-node").forEach((n) => n.toggleAttribute("data-trace", nodes.has(n.dataset.n)));
  root.querySelectorAll(".bp-ew").forEach((g) => g.toggleAttribute("data-pick", g.dataset.k === fk));
}
function focus() {
  const f = M.f;
  root.querySelectorAll(".bp-node").forEach((n) => n.toggleAttribute("data-focus", n.dataset.n === "h" + (j + 1) || n.dataset.n === "z" + (j + 1)));
  root.querySelectorAll(".bp-edge").forEach((e) => e.toggleAttribute("data-focus", [e.dataset.a, e.dataset.b].includes("z" + (j + 1)) && e.dataset.b !== "h" + (2 - j)));
  root.querySelectorAll("[data-j]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.j === j)));
  placePoint(root.querySelector("#pChain"), PS, f.z[j], f.h[j], f.s[j], "slope " + nf(f.s[j]));
  const chain = { gh: f.gh[j], s: f.s[j], gz: f.gz[j] };
  root.querySelectorAll("[data-chain]").forEach((g) => (g.querySelector(".u-chip text").textContent = nf(chain[g.dataset.chain])));
  const labs = { gh: "∂L/∂h" + SUB[j], s: "σ′(z" + SUB[j] + ")", gz: "∂L/∂z" + SUB[j] };
  root.querySelectorAll("[data-chainlab]").forEach((el) => (el.textContent = labs[el.dataset.chainlab]));
  mark(root.querySelector("#gDz"), j); mark(root.querySelector("#gGW"), j);
  trace();
  show();
}
// Which values and gradients are on screen, from the scene and the step.
function show() {
  const s = UNFOLD.scene();
  const vOn = (n) => s >= 2 || (s === 1 && FWD.indexOf(n) < t);
  const gOn = (n) => {
    if (s < 2) return false;
    if (s === 2) return n === "L" || n === "yh";
    if (s === 3) return ["L", "yh", "h1", "h2", "z" + (j + 1)].includes(n);
    if (s === 4) return BWD.indexOf(n) <= t - 7;
    return true;
  };
  const cur = s === 1 ? FWD[t - 1] : s === 4 ? BWD[t - 7] : null;
  root.querySelectorAll(".bp-v").forEach((g) => g.toggleAttribute("data-on", vOn(g.dataset.n)));
  root.querySelectorAll(".bp-g").forEach((g) => g.toggleAttribute("data-on", gOn(g.dataset.n)));
  root.querySelectorAll(".bp-node").forEach((n) => n.toggleAttribute("data-cur", n.dataset.n === cur));
  root.querySelectorAll(".bp-edge").forEach((e) => {
    e.toggleAttribute("data-f", s === 1 && vOn(e.dataset.b) && e.dataset.a !== "y");
    e.toggleAttribute("data-g", s >= 2 && gOn(e.dataset.a));
  });
  say(s, cur);
}
function say(s, cur) {
  const f = M.f, P = M.p, J = SUB[j];
  const k = cur ? +cur.slice(-1) - 1 : 0, K = SUB[k];
  let text = "";
  if (s === 0) text = "2 inputs · 2 hidden units (sigmoid) · 1 output · 9 weights";
  if (s === 1) {
    if (!cur) text = "inputs x = [" + nf(f.x[0]) + ", " + nf(f.x[1]) + "], target y = " + nf(f.y);
    else if (cur[0] === "z") text = "z" + K + " = " + nf(P.W[k][0]) + "×" + p(f.x[0]) + " + " + nf(P.W[k][1]) + "×" + p(f.x[1]) + " + " + nf(P.b[k]) + " = " + nf(f.z[k]);
    else if (cur[0] === "h") text = "h" + K + " = σ(" + nf(f.z[k]) + ") = " + nf(f.h[k]);
    else if (cur === "yh") text = "ŷ = " + nf(P.v[0]) + "×" + p(f.h[0]) + " + " + nf(P.v[1]) + "×" + p(f.h[1]) + " + " + nf(P.c) + " = " + nf(f.yhat);
    else text = "L = ½(" + nf(f.yhat) + " − " + p(f.y) + ")² = " + nf(f.L);
  }
  if (s === 2) text = "∂L/∂ŷ = ŷ − y = " + nf(f.yhat) + " − " + p(f.y) + " = " + nf(f.gy);
  if (s === 3) text = "∂L/∂z" + J + " = " + nf(f.gh[j]) + " × " + p(f.h[j]) + " × (1 − " + nf(f.h[j]) + ") = " + nf(f.gz[j]);
  if (s === 4) {
    if (!cur) text = "backward pass: right to left, from L";
    else if (cur === "L") text = "∂L/∂L = 1";
    else if (cur === "yh") text = "∂L/∂ŷ = " + nf(f.yhat) + " − " + p(f.y) + " = " + nf(f.gy);
    else if (cur[0] === "h") text = "∂L/∂h" + K + " = " + nf(f.gy) + " × " + p(P.v[k]) + " = " + nf(f.gh[k]);
    else if (cur[0] === "z") text = "∂L/∂z" + K + " = " + nf(f.gh[k]) + " × " + p(f.s[k]) + " = " + nf(f.gz[k]);
    else text = "∂L/∂x" + K + " = " + nf(f.gz[0]) + "×" + p(P.W[0][k]) + " + " + nf(f.gz[1]) + "×" + p(P.W[1][k]) + " = " + nf(f.gx[k]);
  }
  if (s === 5) {
    const i = +fk[1] - 1, F = SUB[i];
    if (fk[0] === "w") { const c = +fk[2] - 1; text = "∂L/∂w" + F + SUB[c] + " = x" + SUB[c] + " × ∂L/∂z" + F + " = " + nf(f.x[c]) + " × " + p(f.gz[i]) + " = " + nf(f.gW[i][c]); }
    else text = "∂L/∂v" + F + " = h" + F + " × ∂L/∂ŷ = " + nf(f.h[i]) + " × " + p(f.gy) + " = " + nf(f.gv[i]);
  }
  if (s === 6) text = "gradient step " + (M.hist.length - 1) + " · η = " + nf(M.eta) + " · loss " + nf(f.L) + " → " + nf(M.s.after.L);
  if (readout.textContent !== text) readout.textContent = text;
}
const setT = (v) => { t = v; UNFOLD.timeAt(t); show(); };
UNFOLD.beat(1, 900, (n) => setT(n < 0 ? 6 : n + 1), 700, 6);
UNFOLD.beat(4, 900, (n) => setT(n < 0 ? 14 : n + 7), 700, 8);
UNFOLD.onTime((v) => {
  const want = v <= 6 ? 1 : 4;
  if (UNFOLD.scene() !== want) UNFOLD.go(want);
  setT(v);
});
root.addEventListener("unfold:scene", (e) => setT({ 0: 0, 1: 0, 2: 7, 3: 9, 4: 6 }[e.detail.scene] ?? 14));
const pickUnit = (to) => { j = to; fk = fk[0] === "w" ? "w" + (j + 1) + fk[2] : "v" + (j + 1); focus(); };
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: 0, ArrowDown: 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  UNFOLD.pause();
  pickUnit(to);
});
// Click a weight on the graph: it becomes the focus weight, and its hidden unit the focus unit.
root.querySelector("svg").addEventListener("click", (e) => {
  const edge = e.target.closest(".bp-edge");
  if (!edge || !/^[wv]/.test(edge.dataset.k)) return;
  UNFOLD.pause();
  fk = edge.dataset.k;
  j = +fk[1] - 1;
  focus();
});
const ctl = root.querySelector(".u-controls");
const fields = () => ctl.querySelectorAll("[data-in]").forEach((el) => (el.value = String({ x0: M.x[0], x1: M.x[1], y: M.y, eta: M.eta }[el.dataset.in])));
ctl.addEventListener("click", (e) => {
  const b = e.target.closest("[data-j],[data-reset],[data-train]");
  if (!b) return;
  UNFOLD.pause();
  if (b.dataset.j !== undefined) return pickUnit(+b.dataset.j);
  if (b.hasAttribute("data-train")) {
    M.p = M.s.q;
    M.hist.push(M.s.after.L);
  } else {
    M.p = P0; M.x = [...X0]; M.y = Y0; M.eta = ETA0; M.hist = [];
    fields();
  }
  recompute();
});
ctl.addEventListener("input", (e) => {
  const el = e.target.closest("[data-in]");
  const v = el && el.value !== "" ? Number(el.value) : NaN;
  if (!Number.isFinite(v)) return;
  UNFOLD.pause();
  const k = el.dataset.in;
  const clamp = (lo, hi) => Math.round(Math.max(lo, Math.min(hi, v)) * 10) / 10;
  if (k === "eta") M.eta = clamp(0.1, 0.8);
  else {
    // A new example starts a new loss history at the current weights.
    if (k === "y") M.y = clamp(-2, 2);
    else M.x[+k.slice(1)] = clamp(-2, 2);
    M.hist = [];
  }
  recompute();
});
ctl.addEventListener("change", (e) => e.target.closest("[data-in]") && fields());
root.addEventListener("unfold:layout", recompute);
recompute();
`;

const g = m.gradFlat(f);
const TC = m.torchCheck();
const notes = u.notesHtml([
  {
    title: "Check at the preset weights: backpropagation against two other methods",
    html: `<p>Finite differences move one weight by ±10⁻⁶ and measure the change in the loss. PyTorch 2.10 autograd computes the same gradients from the same network. The Update scene shows the finite differences again at the current weights.</p>`,
    table: {
      head: ["weight", "backprop (page, 3 places)", "finite difference", "PyTorch autograd"],
      rows: m.NAMES.map((n, i) => [`<code>${n}</code>`, nf(g[i]), u.fmt(m.NUM[i], 4), TC ? u.fmt(TC.grads[i], 4) : "not run"]),
    },
  },
  {
    title: "Each node's rule",
    table: {
      head: ["node", "forward", "backward (gradient sent to the left)"],
      rows: [
        ["z = Wx + b", "weighted sum", "∂L/∂w = x · ∂L/∂z, and ∂L/∂x = Σ w · ∂L/∂z"],
        ["h = σ(z)", "sigmoid", "∂L/∂z = ∂L/∂h · h(1 − h)"],
        ["ŷ = v·h + c", "weighted sum", "∂L/∂v = h · ∂L/∂ŷ, and ∂L/∂h = v · ∂L/∂ŷ"],
        ["L = ½(ŷ − y)²", "squared error", "∂L/∂ŷ = ŷ − y"],
      ],
    },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["topic", "in a real network"],
      rows: [
        ["many examples", "The gradient is the average over a batch of examples."],
        ["many layers", "The same two rules repeat, layer by layer, from the output back."],
        ["other activations", "ReLU has slope 1 or 0. tanh has slope 1 − h²."],
        ["vanishing gradients", "σ′ is at most 0.25, so a product over many sigmoid layers becomes small."],
        ["matrix form", "∂L/∂W = δ xᵀ per layer, where δ is ∂L/∂z for the whole layer."],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["forward pass", "computes every value from the inputs to the loss"],
        ["backward pass", "computes every gradient from the loss back to the inputs"],
        ["gradient ∂L/∂w", "how much L changes per small change of w"],
        ["local slope", "the derivative of one node's output with respect to its input"],
        ["chain rule", "gradient at a node = gradient from the right × local slope"],
        ["learning rate η", "the size of the gradient-descent step"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Backpropagation",
    hint: "← → scene · ↑ ↓ unit · , . pass step · click a weight",
    readout: "2 inputs · 2 hidden units (sigmoid) · 1 output · 9 weights",
    caption:
      "A 2-2-1 network with sigmoid hidden units and squared-error loss, trained on one example. We chose the start weights, inputs and target by hand so the numbers stay readable. The page rounds every value to 3 places, and each step uses the rounded values before it, so each line adds up by hand. The gradients match finite differences and PyTorch 2.10 autograd within 0.002 (checked on 2026-10-16). The fields change x, y and η (0.1 to 0.8), and the page runs the same code again. In 1,200 random runs over the allowed x, y and η, 60 gradient steps never raised the loss.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, light ? "backprop-light.html" : "backprop.html");
const html = artifact > 0 ? u.artifactHtml({ title: "Backpropagation", body, script: live }) : u.pageHtml({ title: "Backpropagation", theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
