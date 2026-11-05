import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// Two columns: the code on the left, the stack (or the listing, or the chart) on the right.
// Under 560 px the right column moves below the left one (the kit's `narrow` viewBox).
const W = 860;
const H = 340;
const RIGHT = { x: 460, y: 0 };
const NARROW = { w: 400, h: 700, right: { x: 0, y: 360 } };
const LAST = m.STEPS.length - 1;
const START = 0; // the language picked at load
const N = m.LANGS.length;
const RANGES = [[0, LAST], [0, 1], [2, 3], [4, 9], [10, LAST], null, null];
const CODE_SCENE = 5;
const DEPTH_SCENE = 6;
const RUN_SCENES = [1, 2, 3, 4];

// Colour identity: each function and its frame, parameters, argument values, return values.
const FN_HUE = { sum_sq: "blue", square: "purple", main: "ink" };
const ROLE_HUE = { arg: "gold", call: "purple", ret: "red" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const group = (n) => Number(n).toLocaleString("en-US");

// ---- Code panels: each whole program, tokens coloured by what they are ----
const PW = 280;
const LH = 14;
const ph = (lang) => 26 + lang.lines.length * LH;
const TOKEN = /(\bsquare\b|\bsum_sq\b|\bsumSq\b|\breturn\b|\b[abx]\b|\b[34]\b)/;
const tokenHue = (tok, isCall) => {
  if (tok === "square") return FN_HUE.square;
  if (tok === "sum_sq" || tok === "sumSq") return FN_HUE.sum_sq;
  if (tok === "return") return "red";
  if (/^[abx]$/.test(tok)) return "green";
  return isCall ? "gold" : "";
};
const codeLine = (text, isCall) =>
  text
    .split(TOKEN)
    .map((part) => {
      const hue = TOKEN.test(part) ? tokenHue(part, isCall) : "";
      return hue ? `<tspan data-hue="${hue}">${esc(part)}</tspan>` : esc(part);
    })
    .join("");
// Overview: a 3 x 2 grid (scripts on top, compiled languages below); narrow: 2 x 3 at 0.7.
const GRID = (i) => [(i % 3) * (PW + 10), 4 + (i < 3 ? 0 : Math.max(...m.LANGS.slice(0, 3).map(ph)) + 12)];
const NGRID = (i) => {
  const rows = [0, 1, 2].map((r) => Math.max(ph(m.LANGS[2 * r]), ph(m.LANGS[2 * r + 1])) * 0.7);
  return [(i % 2) * (PW * 0.7 + 8), rows.slice(0, Math.floor(i / 2)).reduce((a, h) => a + h + 10, 0)];
};
const ZOOM = { x: 0, y: 8, s: 1.4 };
const panels = m.LANGS.map((lang, i) => {
  const lines = lang.lines
    .map((text, k) => `<text class="el-num" x="8" y="${26 + k * LH}">${k + 1}</text><text class="el-code" x="26" y="${26 + k * LH}">${codeLine(text, k === lang.at[7] - 1)}</text>`)
    .join("");
  return `<g class="el-panel" id="panel-${i}" data-i="${i}"><rect class="el-panel-bg" width="${PW}" height="${ph(lang)}" rx="6"/><rect class="el-cursor" x="4" y="${26 - LH / 2}" width="${PW - 8}" height="${LH}" rx="3"/><text class="el-label" x="8" y="12">${lang.name}</text>${lines}</g>`;
}).join("");

// ---- Output (left column) ----
const OUT = { x: 0, y: 284, w: 392, h: 40 };
const output = `<g class="el-out"><rect class="el-place" x="${OUT.x}" y="${OUT.y}" width="${OUT.w}" height="${OUT.h}" rx="6"/><text class="el-label" x="${OUT.x}" y="${OUT.y - 6}">output</text></g>`;

// ---- Call stack (right column, local coordinates): frames bottom up, one slot per depth ----
const STACK = { x: 0, y: 16, w: 400, h: 316 };
const FW = 368;
const FH = 70;
const slot = (k) => [STACK.x + 16, STACK.y + STACK.h - 12 - (k + 1) * FH - k * 12];
const stackBox = `<g class="el-stackbox"><rect class="el-place" x="${STACK.x}" y="${STACK.y}" width="${STACK.w}" height="${STACK.h}" rx="6"/><text class="el-label" x="${STACK.x}" y="${STACK.y - 6}">call stack · top runs</text></g>`;

const FRAMES = {};
m.STEPS.forEach((s, t) => s.frames.forEach((f, k) => ((FRAMES[f.id] ??= { ...f, at: m.STEPS.map(() => null) }).at[t] = slot(k))));
// A frame drops in from just above its slot and leaves upward, so a push and a pop read as motion on the stack.
for (const f of Object.values(FRAMES)) {
  const first = f.at.findIndex(Boolean);
  const last = f.at.findLastIndex(Boolean);
  f.ghost = f.at.map((p, t) => p ?? [f.at[t < first ? first : last][0], f.at[t < first ? first : last][1] - 18]);
}
const EX = 150; // x of the expression column inside a frame
const ROW_Y = 52; // the parameter and expression row; chips land just above it, at CHIP_Y
const CHIP_Y = 27;
const CH = 7.2; // width of one character at 12 px mono
const frameSvg = (f) => {
  const hue = FN_HUE[f.fn];
  const params = f.vars.length
    ? f.vars.map(([name, v], i) => `<tspan x="${14 + i * 70}" data-hue="green">${name}</tspan><tspan> = </tspan><tspan data-hue="gold">${v}</tspan>`).join("")
    : `<tspan class="el-muted">no parameters</tspan>`;
  const [x, y] = f.ghost[LAST];
  return (
    `<g class="el-frame" id="fr-${f.id}" data-hue="${hue}" style="transform:translate(${x + RIGHT.x}px,${y + RIGHT.y}px);opacity:0">` +
    `<rect class="el-frame-bg" width="${FW}" height="${FH}" rx="5"/>` +
    `<text class="el-frame-name" x="14" y="20" data-fn="${f.fn}">${esc(f.fn)}</text>` +
    `<text class="el-frame-row" x="14" y="${ROW_Y}">${params}</text>` +
    `<text class="el-small el-where" x="100" y="20"></text>` +
    `<text class="el-frame-row el-expr" x="${EX}" y="${ROW_Y}"></text></g>`
  );
};
const frames = Object.values(FRAMES).map(frameSvg).join("");

// ---- Value chips: arguments travel into the new frame, return values travel back to the caller ----
// A chip lands just above the value it becomes in the frame, then fades, so it never covers text.
const chipW = (text) => 8 + 7 * text.length;
const chipAt = (c, t) => {
  if (c.frame === "console") return { xy: [OUT.x + 14, OUT.y + 11], left: true };
  const [x, y] = slot(m.STEPS[t].frames.findIndex((f) => f.id === c.frame));
  if (c.slot === "ret") return { xy: [x + FW - chipW(c.text) - 12, y + 11] };
  // The page moves an "expr" chip onto the matching value in the expression; xy is its fallback place.
  if (c.slot === "expr") return { frame: c.frame, xy: [x + EX + 56, y + CHIP_Y], land: true };
  // "a = 3": the value starts 4 characters after the name's x.
  const valueX = x + 14 + Number(c.slot.slice(1)) * 70 + 4 * CH;
  return { xy: [valueX + (CH * c.text.length) / 2 - chipW(c.text) / 2, y + CHIP_Y], land: true };
};
const CHIPS = {};
m.STEPS.forEach((s, t) => s.chips.forEach((c) => ((CHIPS[c.id] ??= { ...c, at: m.STEPS.map(() => null) }).at[t] = chipAt(c, t))));
const chips = Object.values(CHIPS)
  .map((c) => {
    const first = c.at.find(Boolean);
    const [x, y] = first.xy;
    const dx = first.left ? 0 : RIGHT.x;
    return `<g class="el-chip" id="ch-${c.id}" style="transform:translate(${x + dx}px,${y}px);opacity:0">${u.chip(c.text, 0, 0, { w: chipW(c.text), h: 16, rx: 4, hue: c.hue })}</g>`;
  })
  .join("");

// ---- Scene 6: what the compiler or VM makes of `return square(a) + square(b)` ----
const CL = 19;
const listings = m.LANGS.map((lang, i) => {
  const width = Math.max(...lang.code.lines.filter((l) => l[1] !== "gap").map((l) => l[0].length)) * 6.6 + 28;
  const rows = lang.code.lines
    .map(([text, role, note], k) => {
      const y = 44 + k * CL;
      const hue = ROLE_HUE[role];
      if (role === "gap") return `<text class="el-gap" x="12" y="${y}">${esc(text)}</text>`;
      return `<text class="el-asm" x="12" y="${y}"${hue ? ` data-hue="${hue}"` : ""}>${esc(text)}</text>${note ? `<text class="el-note" x="${width}" y="${y}">${esc(note)}</text>` : ""}`;
    })
    .join("");
  return `<g class="el-listing" id="code-${i}"><text class="el-label" x="0" y="10">${esc(lang.code.kind)} · ${esc(lang.code.tool)}</text><rect class="el-place" x="0" y="20" width="400" height="${28 + lang.code.lines.length * CL}" rx="6"/>${rows}</g>`;
}).join("");

// ---- Scene 7: how deep one recursive function got before the stack ran out (log scale) ----
const BAR = { x: 84, w: 300, from: 2, to: 6 };
const barW = (n) => ((Math.log10(n) - BAR.from) / (BAR.to - BAR.from)) * BAR.w;
const ROW = 44;
const chart =
  `<g class="el-chart"><text class="el-label" x="0" y="10">deepest call reached · log scale</text>` +
  m.LANGS.map((lang, i) => {
    const y = 40 + i * ROW;
    const w = barW(lang.depth.measured);
    return `<g class="el-row" data-i="${i}" style="--row:${i}"><text class="el-row-name" x="0" y="${y}">${lang.name}</text><rect class="el-bar" x="${BAR.x}" y="${y - 9}" width="${w.toFixed(1)}" height="18" rx="2"/><text class="el-row-value" x="${(BAR.x + w + 6).toFixed(1)}" y="${y}">${group(lang.depth.measured)}</text></g>`;
  }).join("") +
  [2, 3, 4, 5, 6].map((e) => {
    const x = BAR.x + ((e - BAR.from) / (BAR.to - BAR.from)) * BAR.w;
    return `<path class="el-tick" d="M${x} 24V${40 + N * ROW - 18}"/><text class="el-tick-label" x="${x}" y="${40 + N * ROW - 6}">${["100", "1k", "10k", "100k", "1M"][e - 2]}</text>`;
  }).join("") +
  `</g>`;
const INFO_ROWS = [
  ["stack size", "info-stack", "info-stack-note"],
  ["deepest call reached", "info-depth", "info-depth-note"],
  ["bytes per frame", "info-bytes", "info-bytes-note"],
  ["with twice the stack", "info-twice", "info-twice-note"],
  ["at the limit", "info-end", ""],
];
const info =
  `<g class="el-info"><text class="el-label" x="0" y="10">one recursive function · <tspan id="info-lang">${m.LANGS[START].name}</tspan></text>` +
  INFO_ROWS.map(([label, v, note], k) => {
    const y = 44 + k * 56;
    return `<text class="el-info-label" x="0" y="${y}">${label}</text><text class="el-info-value" id="${v}" x="0" y="${y + 24}"></text>${note ? `<text class="el-note" id="${note}" x="190" y="${y + 24}"></text>` : ""}`;
  }).join("") +
  `</g>`;
const INFO = m.LANGS.map((lang) => {
  const d = lang.depth;
  return d.bytes
    ? { "info-stack": d.stack, "info-stack-note": d.source, "info-depth": `${group(d.measured)} frames`, "info-depth-note": "measured", "info-bytes": `≈ ${d.bytes} bytes`, "info-bytes-note": `${d.stack} ÷ ${group(d.measured)}`, "info-twice": `${group(d.twice)} frames`, "info-twice-note": `${(d.twice / d.measured).toFixed(1)} × deeper`, "info-end": d.end }
    : { "info-stack": d.stack, "info-stack-note": d.source, "info-depth": `${group(d.measured)} frames`, "info-depth-note": "measured", "info-bytes": "—", "info-bytes-note": "a count, not bytes", "info-twice": `${group(d.twice)} frames`, "info-twice-note": "limit set to 2000", "info-end": d.end };
});

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "One function program in six languages and the call stack it builds: a frame per call, arguments bound to parameters, return values going back to the caller. Then what each compiler or virtual machine makes of the call, and how deep each stack can go.",
  body: [output, info, `<g class="el-right">${stackBox}${listings}${chart}</g>`, panels, `<g class="el-live">${frames}${chips}</g>`],
});

// ---- Scenes ----
const hue = (h, text) => `<span data-hue="${h}">${text}</span>`;
const fn = (name) => `<span data-hue="${FN_HUE[name]}" data-fn="${name}">${name}</span>`;
const b = (h, text) => `<b data-hue="${h}">${text}</b>`;
const bfn = (name) => `<b data-hue="${FN_HUE[name]}" data-fn="${name}">${name}</b>`;
const scenes = [
  {
    name: "Same parts",
    rule: `define ${hue("blue", "name")}(${hue("green", "parameters")}) · call ${hue("blue", "name")}(${hue("gold", "arguments")}) · get back the ${hue("red", "return")} value`,
    voice: `Six languages run one program, and each prints 25. The parts are the same: a ${b("blue", "name")}, ${b("green", "parameters")}, a body that ${b("red", "returns")} a value, and a call with ${b("gold", "arguments")}.`,
  },
  {
    name: "Call",
    rule: `${fn("sum_sq")}(${hue("gold", "3, 4")}) → new frame: ${hue("green", "a")} = ${hue("gold", "3")}, ${hue("green", "b")} = ${hue("gold", "4")}`,
    voice: `The call makes a new frame on top of the call stack. Each ${b("green", "parameter")} in the frame gets one argument: ${b("gold", "3")} and ${b("gold", "4")}.`,
  },
  {
    name: "Nested call",
    rule: `${fn("square")}(${hue("green", "a")}) → ${hue("green", "a")} is ${hue("gold", "3")} → new frame on top: ${hue("green", "x")} = ${hue("gold", "3")}`,
    voice: `${bfn("sum_sq")} calls ${bfn("square")}, which gets its own frame with its own ${b("green", "x")}. The frame below waits at the line of the call.`,
  },
  {
    name: "Return",
    rule: `${hue("red", "return")} ${hue("green", "x")} * ${hue("green", "x")} → frame removed → ${hue("red", "9")} replaces ${fn("square")}(${hue("green", "a")})`,
    voice: `${bfn("square")} returns ${b("red", "9")}, its frame is removed, and 9 replaces the call. The second call gets a new frame with ${b("green", "x")} = 4 and returns ${b("red", "16")}.`,
  },
  {
    name: "Final return",
    rule: `${hue("red", "return")} ${hue("red", "9")} + ${hue("red", "16")} → ${hue("red", "25")} → the top-level frame prints it, then ends`,
    voice: `${bfn("sum_sq")} returns ${b("red", "25")}, its frame is removed, and 25 replaces the call. The top-level frame prints 25, and then it ends too.`,
  },
  {
    name: "Below source",
    rule: `put the ${hue("gold", "arguments")} in place → ${hue("purple", "call")} → the ${hue("red", "result")} comes back`,
    voice: `C and Rust compile to machine code: the ${b("gold", "argument")} goes in a register, and ${b("purple", "call")} pushes the return address. The others compile to bytecode for a virtual machine.`,
  },
  {
    name: "Stack limit",
    rule: `deepest call ≈ stack size ÷ bytes per frame`,
    voice: `Each frame takes stack space until its call returns, so the depth has a limit. Most languages run out of bytes, but Python stops at a count: 1000 frames.`,
  },
];

const placeAt = (sel, [x, y], s = 1) => `${sel}{transform:translate(${x}px,${y}px) scale(${s})}`;
const inScenes = (list) => `:is(${list.map((i) => `[data-scene="${i}"]`).join(",")})`;
const css = [
  `.el-place{fill:var(--u-faint);fill-opacity:.12;stroke:var(--u-lo);stroke-width:.8}`,
  `.el-label{font:10.5px var(--u-mono);fill:var(--u-muted);letter-spacing:.06em;text-transform:uppercase}`,
  `.el-small{font:10px var(--u-mono);fill:var(--u-muted);dominant-baseline:central}`,
  `.el-muted{fill:var(--u-muted)}`,
  `.el-num{font:9.5px var(--u-mono);fill:var(--u-lo);dominant-baseline:central}`,
  `.el-code{font:10px var(--u-mono);fill:var(--u-text);dominant-baseline:central;white-space:pre}`,
  `.el-code tspan[data-hue],.el-frame-row tspan[data-hue]{fill:var(--hue)}`,
  `.el-panel{cursor:pointer;transform-box:view-box;transition:transform .9s var(--u-ease),opacity var(--u-fade) var(--u-ease) var(--u-fade-at)}`,
  ...m.LANGS.map((_, i) => placeAt(`#panel-${i}`, GRID(i))),
  ...m.LANGS.map((_, i) => placeAt(`.u-stage[data-narrow] #panel-${i}`, NGRID(i), 0.7)),
  `.u-stage:not([data-scene="0"]) .el-panel{opacity:0;pointer-events:none;--u-fade:.22s;--u-fade-at:0s}`,
  ...m.LANGS.map((_, i) => `.u-stage[data-lang="${i}"]${inScenes([...RUN_SCENES, CODE_SCENE])} #panel-${i}{transform:translate(${ZOOM.x}px,${ZOOM.y}px) scale(${ZOOM.s});opacity:1;pointer-events:auto;--u-fade:.5s;--u-fade-at:.22s}`),
  `.el-panel-bg{fill:var(--u-card);stroke:var(--u-lo);stroke-width:.8;transition:stroke .3s}`,
  ...m.LANGS.map((_, i) => `.u-stage[data-lang="${i}"][data-scene="0"] #panel-${i} .el-panel-bg{stroke:var(--u-strong);stroke-width:1.2}`),
  `.el-cursor{fill:var(--hue,var(--u-hi));fill-opacity:.16;stroke:var(--hue,var(--u-hi));stroke-width:.8;transition:transform .45s var(--u-ease),opacity .3s,fill .3s,stroke .3s}`,
  // Which groups each scene shows. Narrow scene 1 also previews the stack at its deepest, below the grid.
  `.el-out,.el-info,.el-stackbox,.el-live,.el-listing,.el-chart{transition:opacity var(--u-fade) var(--u-ease) var(--u-fade-at)}`,
  `.u-stage:not(${inScenes(RUN_SCENES)}) :is(.el-out,.el-stackbox,.el-live){opacity:0;--u-fade:.22s;--u-fade-at:0s}`,
  `.u-stage[data-narrow][data-scene="0"] :is(.el-stackbox,.el-live){opacity:1;--u-fade:.5s;--u-fade-at:.22s}`,
  `.el-listing{opacity:0;--u-fade:.22s;--u-fade-at:0s}`,
  ...m.LANGS.map((_, i) => `.u-stage[data-lang="${i}"][data-scene="${CODE_SCENE}"] #code-${i}{opacity:1;--u-fade:.5s;--u-fade-at:.22s}`),
  `.u-stage:not([data-scene="${DEPTH_SCENE}"]) :is(.el-info,.el-chart){opacity:0;--u-fade:.22s;--u-fade-at:0s}`,
  `.el-right{transform:translate(${RIGHT.x}px,${RIGHT.y}px)}`,
  `.u-stage[data-narrow] .el-right{transform:translate(${NARROW.right.x}px,${NARROW.right.y}px)}`,
  `.el-frame,.el-chip{transition:transform .6s var(--u-ease),opacity .4s var(--u-ease)}`,
  `.el-chip[data-landed]{opacity:0!important;transition:transform .6s var(--u-ease),opacity .35s var(--u-ease) .25s}`,
  `.el-frame-bg{fill:color-mix(in srgb,var(--hue) 10%,var(--u-card));stroke:var(--hue);stroke-width:1}`,
  `.el-frame-name{font:600 12px var(--u-mono);fill:var(--hue);dominant-baseline:central}`,
  `.el-frame-row{font:12px var(--u-mono);fill:var(--u-text);dominant-baseline:central;white-space:pre}`,
  `.el-chip .u-chip rect{fill:color-mix(in srgb,var(--hue) 22%,var(--u-card));stroke-width:1.2}`,
  `.el-chip .u-chip text{font-weight:600}`,
  `.el-asm{font:11px var(--u-mono);fill:var(--u-text);dominant-baseline:central;white-space:pre}`,
  `.el-asm[data-hue]{fill:var(--hue)}`,
  `.el-gap{font:italic 10.5px var(--u-mono);fill:var(--u-muted);dominant-baseline:central}`,
  `.el-note{font:10.5px var(--u-mono);fill:var(--u-muted);dominant-baseline:central}`,
  `.el-row-name{font:12px var(--u-mono);fill:var(--u-text);dominant-baseline:central}`,
  `.el-row-value{font:11px var(--u-mono);fill:var(--u-muted);dominant-baseline:central}`,
  `.el-bar{fill:var(--u-mid);transform-box:fill-box;transform-origin:0 50%;transition:transform .9s var(--u-ease) calc(var(--row) * 90ms),fill .3s}`,
  `.u-stage:not([data-scene="${DEPTH_SCENE}"]) .el-bar{transform:scaleX(0)}`,
  `.el-row{cursor:pointer}`,
  ...m.LANGS.map((_, i) => `.u-stage[data-lang="${i}"] .el-row[data-i="${i}"] :is(.el-row-name,.el-row-value){fill:var(--u-strong)}.u-stage[data-lang="${i}"] .el-row[data-i="${i}"] .el-bar{fill:var(--u-hi)}`),
  `.el-tick{stroke:var(--u-faint);stroke-width:.6}`,
  `.el-tick-label{font:10px var(--u-mono);fill:var(--u-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-info-label{font:10.5px var(--u-mono);fill:var(--u-muted);dominant-baseline:central}`,
  `.el-info-value{font:500 17px var(--u-mono);fill:var(--u-strong);dominant-baseline:central}`,
  `#info-end{font-size:13px}`,
  `.el-langs{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "sum_sq and its frame" },
  { hue: "purple", label: "square: its frames and calls" },
  { hue: "green", label: "parameter" },
  { hue: "gold", label: "argument value" },
  { hue: "red", label: "return value" },
]);
// The key names sum_sq the way the picked language does. No space before "and": the key row is a flex row with a gap.
const keyLive = key.replace(">sum_sq and its frame<", '><span data-fn="sum_sq">sum_sq</span>and its frame<');
const picker = `<div class="el-langs" role="group" aria-label="Language">${m.LANGS.map((l, i) => `<button type="button" data-lang="${i}" aria-pressed="${i === START}">${l.name}</button>`).join("")}</div>`;
const stage = u
  .stageHtml({ audio: await u.narrate(scenes, { dir: join(HERE, "voice") }),
    dwell: 9000,
    scenes,
    svg,
    label: "Function call explainer. Left and right arrows change the scene. Up and down arrows change the language. Comma and period step through the run.",
    css,
    key: keyLive,
    controls: picker,
    time: { steps: LAST + 1, scenes: RUN_SCENES },
    narrow: [NARROW.w, NARROW.h],
  })
  .replace('class="u-stage"', `class="u-stage" data-lang="${START}"`);

// Per step: the generic code line, the hue of the running function, every frame's expression, and its line.
const STEPDATA = m.STEPS.map((s) => ({
  line: s.frames.length ? s.line : 0,
  hue: s.frames.length ? FN_HUE[s.frames.at(-1).fn] : "",
  expr: Object.fromEntries(s.frames.map((f) => [f.id, f.expr])),
  where: Object.fromEntries(s.frames.map((f, k) => [f.id, [k === s.frames.length - 1 ? "running line " : "waits at line ", f.line]])),
  say: s.say,
}));
const HOW = {
  python: "CALL runs square in a new frame and pushes its result",
  javascript: "a0, a1 are the arguments; the result lands in the accumulator",
  ruby: "send takes self and a off the stack, then pushes the result",
  c: "System V ABI: 1st int argument in edi, the result in eax",
  java: "invokestatic moves a into local 0 of the new frame",
  rust: "here a goes in edi and the result in eax; + and * check overflow",
};
const live = `
const LANGS = ${JSON.stringify(m.LANGS.map((l) => ({ name: l.name, at: l.at, names: { sum_sq: l.names.sum_sq, square: "square", main: l.names.main }, how: HOW[l.id], info: INFO[m.LANGS.indexOf(l)], limit: l.depth.bytes ? group(l.depth.measured) + " frames in " + l.depth.stack + " ≈ " + l.depth.bytes + " bytes each" : "stops at " + group(l.depth.measured) + " frames: the limit is a count (1000)" })))};
const FRAMES = ${JSON.stringify(Object.fromEntries(Object.values(FRAMES).map((f) => [f.id, f.ghost.map((p, t) => [p[0], p[1], f.at[t] ? 1 : 0])])))};
const CHIPS = ${JSON.stringify(Object.fromEntries(Object.values(CHIPS).map((c) => [c.id, { text: c.text, w: chipW(c.text), at: c.at }])))};
const STEPS = ${JSON.stringify(STEPDATA)};
const RANGES = ${JSON.stringify(RANGES)};
const RIGHT = ${JSON.stringify(RIGHT)};
const NRIGHT = ${JSON.stringify(NARROW.right)};
const LH = ${LH};
const LAST = ${LAST};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let lang = ${START};
let step = 0;
let crossing = false;
const names = () => LANGS[lang].names;
const segs = (list) => list.map((s) => s.fn ? '<tspan data-hue="' + ({ sum_sq: "blue", square: "purple" })[s.fn] + '">' + names()[s.fn] + "</tspan>" : s.hue ? '<tspan data-hue="' + s.hue + '" data-v="' + s.t + '">' + s.t + "</tspan>" : s.t).join("");
const off = () => (UNFOLD.narrow() ? NRIGHT : RIGHT);
const move = (el, x, y) => (el.style.transform = "translate(" + x + "px," + y + "px)");
const lands = {};
function show(t) {
  step = Math.max(0, Math.min(LAST, t));
  const s = STEPS[step];
  const o = off();
  for (const [id, at] of Object.entries(FRAMES)) {
    const el = root.querySelector("#fr-" + id);
    move(el, at[step][0] + o.x, at[step][1] + o.y);
    el.style.opacity = at[step][2];
    if (s.expr[id]) el.querySelector(".el-expr").innerHTML = (id === "main" ? "" : '<tspan data-hue="red">return</tspan> ') + segs(s.expr[id]);
    if (s.where[id]) el.querySelector(".el-where").textContent = s.where[id][0] + LANGS[lang].at[s.where[id][1]];
  }
  // A chip bound for an expression lands on the value it becomes there (measured, since names differ per language).
  const claimed = new Set();
  for (const [id, c] of Object.entries(CHIPS)) {
    const el = root.querySelector("#ch-" + id);
    const p = c.at[step];
    clearTimeout(lands[id]);
    el.removeAttribute("data-landed");
    if (!p) { el.style.opacity = 0; continue; }
    let [x, y] = p.xy;
    if (p.frame) {
      const v = [...root.querySelectorAll("#fr-" + p.frame + " .el-expr [data-v]")].find((n) => n.dataset.v === c.text && !claimed.has(n));
      if (v) {
        claimed.add(v);
        x = FRAMES[p.frame][step][0] + v.getStartPositionOfChar(0).x + v.getComputedTextLength() / 2 - c.w / 2;
      }
    }
    move(el, x + (p.left ? 0 : o.x), y + (p.left ? 0 : o.y));
    el.style.opacity = 1;
    if (p.land) lands[id] = setTimeout(() => el.setAttribute("data-landed", ""), still.matches ? 0 : 650);
  }
  root.querySelectorAll(".el-panel").forEach((panel, i) => {
    const c = panel.querySelector(".el-cursor");
    const line = UNFOLD.scene() === ${CODE_SCENE} ? LANGS[i].at[5] : s.line && LANGS[i].at[s.line];
    c.style.opacity = line ? 1 : 0;
    if (line) c.style.transform = "translateY(" + (line - 1) * LH + "px)";
    const h = UNFOLD.scene() === ${CODE_SCENE} ? "blue" : s.hue;
    if (h) c.setAttribute("data-hue", h); else c.removeAttribute("data-hue");
  });
  UNFOLD.timeAt(step);
  say();
}
function say() {
  const sc = UNFOLD.scene();
  const L = LANGS[lang];
  const text = L.name + " · " + (sc === 0 ? "runs as shown and prints 25" : sc === ${CODE_SCENE} ? L.how : sc === ${DEPTH_SCENE} ? L.limit : "step " + step + " · " + STEPS[step].say.replace(/\\{(\\w+)\\}/g, (_, n) => names()[n]));
  if (readout.textContent !== text) readout.textContent = text;
}
function pick(i) {
  lang = (i + LANGS.length) % LANGS.length;
  root.dataset.lang = String(lang);
  root.querySelectorAll("[data-fn]").forEach((el) => (el.textContent = names()[el.dataset.fn]));
  root.querySelectorAll(".el-langs [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.lang) === lang)));
  for (const [id, text] of Object.entries(LANGS[lang].info)) root.querySelector("#" + id).textContent = text;
  root.querySelector("#info-lang").textContent = LANGS[lang].name;
  show(step);
}
// The overview starts at step 0 (every panel marks its call line); on a phone it previews the stack at its deepest.
const start = (scene) => (scene === 0 ? (UNFOLD.narrow() ? 4 : 0) : RANGES[scene] ? RANGES[scene][0] : step);
root.addEventListener("unfold:scene", (e) => { if (!crossing) show(start(e.detail.scene)); });
root.addEventListener("unfold:layout", () => show(UNFOLD.scene() === 0 ? start(0) : step));
[1, 2, 3, 4].forEach((s) => UNFOLD.beat(s, 1400, (n) => show(n < 0 ? RANGES[s][1] : RANGES[s][0] + n), 800, RANGES[s][1] - RANGES[s][0] + 1));
// Stepping by hand moves to the scene that owns the step.
UNFOLD.onTime((t) => {
  const owner = RANGES.findIndex((r, i) => i > 0 && r && t >= r[0] && t <= r[1]);
  if (owner !== UNFOLD.scene()) { crossing = true; UNFOLD.go(owner); crossing = false; }
  show(t);
});
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: lang - 1, ArrowDown: lang + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  UNFOLD.pause();
  pick(to);
});
root.addEventListener("click", (e) => {
  const target = e.target.closest(".el-panel, .el-row, .el-langs [data-lang]");
  if (!target) return;
  UNFOLD.pause();
  pick(Number(target.dataset.i ?? target.dataset.lang));
});
pick(lang);
`;

// ---- Reference notes under the card ----
const c = (t) => `<code>${esc(t)}</code>`;
const D = Object.fromEntries(m.LANGS.map((l) => [l.id, l.depth]));
const notes = u.notesHtml([
  {
    title: "What differs between languages",
    html: `<p>Below the source, languages differ in four ways: how the code runs, what a parameter receives, tail calls, and stack depth. Rows marked <b>checked</b> were run with the real compiler or interpreter on Linux x86-64. The other rows come from each language's documentation.</p>`,
    table: {
      head: ["Language", "Runs as", "A parameter receives", "Tail calls", "Stack limit"],
      rows: [
        ["C · checked", "machine code", "a copy of the value; pass a pointer to let the callee change the caller's variable", `not required; ${c("gcc -O2")} turned a tail call into a jump (100 million calls, no overflow)`, `the thread's stack: 8 MiB here (${c("ulimit -s")}), ${group(D.c.measured)} small frames`],
        ["C++", "machine code", `a copy, or a reference when the parameter is declared with ${c("&")}`, "not required; optimizers may do it", "as C"],
        ["Rust · checked", "machine code", `the value, moved or copied; ${c("&")} and ${c("&mut")} borrow instead`, "not guaranteed", `8 MiB on the main thread (${group(D.rust.measured)} debug frames); 2 MiB on spawned threads`],
        ["Go", "machine code; on amd64 arguments go in registers since Go 1.17", "a copy; pointers are explicit", "not done", "a goroutine stack starts at a few KiB and grows by copying, up to 1 GB on 64-bit systems"],
        ["Java · checked", "JVM bytecode, interpreted, then JIT-compiled when hot", "a copy of a primitive (int); for an object, a copy of the reference", "not done", `1 MiB per thread (${c("-Xss")}), about ${group(Math.round(D.java.measured / 1000) * 1000)} frames`],
        ["Kotlin", "JVM bytecode", "as Java", `${c("tailrec")} turns a self tail call into a loop`, "as Java"],
        ["Python · checked", "CPython bytecode in a virtual machine", "a reference to the same object, also for numbers (call by sharing)", "not done", `1000 frames (${c("sys.getrecursionlimit()")}): a count, not bytes`],
        ["JavaScript · checked", "V8 bytecode, JIT-compiled when hot", "a copy of a primitive (number, string); for an object, a reference to the same object (call by sharing)", "in the spec since ES2015 (strict mode); only Safari's engine does it", `984 KiB in V8 (${c("--stack-size")}), about ${group(Math.round(D.javascript.measured / 100) * 100)} frames`],
        ["Ruby · checked", "YARV bytecode", "a reference to the same object (call by sharing)", "off by default; a compile option turns it on", `1 MiB VM stack, about ${group(Math.round(D.ruby.measured / 100) * 100)} frames`],
        ["Perl", "an op tree, interpreted", `${c("@_")} holds aliases: changing ${c("$_[0]")} changes the caller's variable`, `not done; ${c("goto &sub")} replaces the current call by hand`, `no fixed limit; with warnings on it warns at 100 levels`],
        ["Haskell (GHC)", "machine code, lazy evaluation", "an unevaluated expression (a thunk), computed the first time it is used", "yes: tail calls compile to jumps", "the stack grows on the heap; the default limit is 80% of physical memory"],
        ["Scheme", "interpreted or compiled, by implementation", "the value; objects are shared", "required by the standard (R7RS)", "set by the implementation"],
        ["Lua", "bytecode in a register-based VM", "the value; tables are shared", `yes: the manual calls them "proper tail calls"`, `${c("LUAI_MAXSTACK")}: 1,000,000 stack slots`],
      ],
    },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["Left out", "What really happens"],
      rows: [
        ["Optimized builds", `With ${c("gcc -O2")}, main holds the constant 25 and never calls ${c("sum_sq")} (checked). JIT compilers in the JVM and V8 also inline small hot functions.`],
        ["The return address", `${c("call")} pushes the address of the next instruction. ${c("ret")} pops it and jumps there. A virtual machine keeps it in the frame. The figure shows it as "waits at line N".`],
        ["Methods", `${c("obj.f(x)")} first finds which ${c("f")} to run: a vtable in C++ and Java, an inline cache in V8, CPython and YARV. Then it is a normal call, with the object as a hidden first argument (${c("this")} or ${c("self")}).`],
        ["Closures", `A variable that an inner function uses stays alive after the outer frame is removed, so the runtime keeps it outside the stack. V8's ${c("LdaImmutableCurrentContextSlot")} in scene 6 reads ${c("square")} from such a context.`],
        ["Exceptions", `A throw removes frames from the top until a frame has a handler. The scene 7 programs catch ${c("RecursionError")}, ${c("RangeError")}, ${c("SystemStackError")} and ${c("StackOverflowError")} this way. In C and Rust a stack overflow is a signal (SIGSEGV), not an exception. C can handle it on a separate stack (${c("sigaltstack")}) but cannot continue the call. Rust prints a message and aborts.`],
        ["async functions and generators", "Their frame can pause, live on the heap, and continue later. It is not removed when the function first gives control back."],
      ],
    },
  },
  {
    title: "Words used here",
    table: {
      head: ["Term", "Meaning"],
      rows: [
        ["Parameter", `the name in the definition (${c("x")}, ${c("a")}, ${c("b")})`],
        ["Argument", `the value passed in the call (${c("3")}, ${c("4")})`],
        ["Frame (activation record)", "one call's parameters, local variables, and where to continue in the caller"],
        ["Call stack", "the frames of calls that have not returned. Only the top one runs."],
        ["Calling convention (ABI)", "where arguments and results go (registers or stack), so code from different compilers can call each other"],
        ["Stack overflow", "no room for the next frame. Scene 7 shows where each language stops."],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 4",
    title: "How a function call works",
    hint: "← → scene · ↑ ↓ language · , . step",
    readout: m.LANGS[START].name + " · runs as shown and prints 25",
    caption:
      "Every program is shown whole and was run with its real tool (python3 3.13, node 24, ruby 3.2, gcc 13, java 21, rustc 1.95). Each prints 25. Frames and values come from a small evaluator of the same program. The listings in scene 6 are real output of dis, node --print-bytecode, ruby --dump=insns, gcc -S, javap -c and rustc --emit asm. Ruby's call data and Rust's mangled name are shortened. The depths in scene 7 were measured on Linux x86-64 with default settings.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "function-call-light.html" : "function-call.html");
const html = artifact > 0 ? u.artifactHtml({ title: "How a function call works", body, script: live }) : u.pageHtml({ title: "How a function call works", theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
