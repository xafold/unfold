// unfold concept kit: cell grids, chips, arrows, bars, tensor blocks, and scenes.
// The card, page, iso camera, solids and theme tokens come from ./iso.mjs (adapted from the anatomy skill).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export * as iso from "./iso.mjs";
import * as iso from "./iso.mjs";

export const HUES = ["blue", "yellow", "red", "green", "teal", "purple", "gold"];

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r1 = (v) => Math.round(v * 10) / 10;

// "-0.7" with a true minus sign, "−∞" for a masked value.
export function fmt(value, places = 1) {
  if (value === -Infinity) return "−∞";
  const text = value.toFixed(places);
  return Number(text) === 0 ? (0).toFixed(places) : text.replace("-", "−");
}

const strength = (value, max) => (value === -Infinity ? 0 : Math.min(1, Math.abs(value) / max));
const maxOf = (values) => Math.max(1e-9, ...values.flat().filter(Number.isFinite).map(Math.abs));

// One cell's look, shared by the build (cellGrid) and the page (setGrid in the runtime).
export const CELL_LOOK = `function cellLook(value, max) {
  const masked = value === -Infinity;
  const s = masked ? 0 : Math.min(1, Math.abs(value) / max);
  return { masked, neg: !masked && value < 0, hot: !masked && value > 0 && s > 0.55, alpha: 0.1 + 0.8 * s };
}`;
const cellLook = new Function(`${CELL_LOOK}; return cellLook;`)();

// A matrix of real values. Colour = the matrix's identity hue; strength = size of the value;
// a filled cell is positive, a hollow cell is negative, a masked cell shows −∞.
// `transposeIn` lists scenes in which the cells move to their transposed places (with a short stagger).
export function cellGrid({ id, values, hue, cell = [32, 20], max, places = 1, name, dims = true, transposeIn = [], className = "", keep = false }) {
  const [cw, ch] = cell;
  const top = max ?? maxOf(values);
  const rows = values.length;
  const cols = values[0].length;
  const cells = [];
  values.forEach((row, r) =>
    row.forEach((value, c) => {
      const look = cellLook(value, top);
      const style = `--x:${c * cw}px;--y:${r * ch}px;--tx:${r * cw}px;--ty:${c * ch}px;--i:${r + c};--r:${r};--c:${c}`;
      const flags = `${look.masked ? " data-masked" : ""}${look.neg ? " data-neg" : ""}${look.hot ? " data-hot" : ""}`;
      cells.push(
        `<g class="u-cell" data-r="${r}" data-c="${c}"${flags} style="${style}">` +
          `<rect class="u-cell-bg" x=".75" y=".75" width="${cw - 1.5}" height="${ch - 1.5}" rx="2" style="--a:${look.alpha.toFixed(2)}"/>` +
          `<text class="u-num" x="${cw / 2}" y="${ch / 2}">${fmt(value, places)}</text></g>`,
      );
    }),
  );
  const marks = Array.from({ length: rows }, (_, r) => `<rect class="u-mark" data-r="${r}" style="--r:${r}" x="-2" y="${r * ch - 1}" width="${cols * cw + 4}" height="${ch + 2}" rx="3"/>`).join("");
  const label = name
    ? `<text class="u-name" x="0" y="-7">${name}${transposeIn.length ? `<tspan class="u-T">ᵀ</tspan>` : ""}${dims ? `<tspan class="u-dims" dx="6">${rows}×${cols}</tspan>` : ""}${dims && transposeIn.length ? `<tspan class="u-dims u-dims-T" dx="6">${cols}×${rows}</tspan>` : ""}</text>`
    : "";
  const t = transposeIn.length ? ` data-t=" ${transposeIn.join(" ")} "` : "";
  return `<g class="u-grid ${className}" id="${id}" data-hue="${hue}" data-max="${top}" data-places="${places}"${t}${keep ? " data-keep" : ""}>${label}${marks}${cells.join("")}</g>`;
}

// A word or token as a small rounded chip. `data-i` lets the page pick it.
// `rx` defaults to a pill; pass a small rx for a square key cell. `id` names it for placeCss.
export function chip(text, x, y, { w = 52, h = 16, rx = h / 2, hue = "", i, id, className = "" } = {}) {
  const pick = `${i === undefined ? "" : ` data-i="${i}"`}${id ? ` id="${id}"` : ""}`;
  return `<g class="u-chip ${className}"${pick}${hue ? ` data-hue="${hue}"` : ""} transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="${rx}"/><text x="${w / 2}" y="${h / 2}">${esc(text)}</text></g>`;
}

// A link whose shape changes per scene: ds[i] is its path in scene i, or null when it does not exist there.
// The runtime sets it on each scene change (a CSS "d" transition where the browser has one, so the link
// follows nodes that move with placeCss; otherwise it snaps). Draw links before the nodes they join.
export function morphPath(ds, { id, hue = "", className = "u-link" } = {}) {
  const first = ds.find(Boolean) ?? "";
  return `<path class="${className}" pathLength="1"${id ? ` id="${id}"` : ""}${hue ? ` data-hue="${hue}"` : ""} d="${first}" data-ds='${JSON.stringify(ds)}'${ds[0] ? "" : " data-off"}/>`;
}

// An arrow that ends on a real target. `bend` bows it sideways, in px. The head is a filled path, not a marker.
export function arrow([x1, y1], [x2, y2], { hue = "", bend = 0, head = 5, id, width, className = "" } = {}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  const tx = x2 - cx;
  const ty = y2 - cy;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const d = `M${r1(x1)} ${r1(y1)}Q${r1(cx)} ${r1(cy)} ${r1(bx)} ${r1(by)}`;
  const tip = `M${r1(x2)} ${r1(y2)}L${r1(bx - uy * head * 0.55)} ${r1(by + ux * head * 0.55)}L${r1(bx + uy * head * 0.55)} ${r1(by - ux * head * 0.55)}Z`;
  const extra = `${id ? ` id="${id}"` : ""}${hue ? ` data-hue="${hue}"` : ""}${width ? ` style="--w:${width}"` : ""}`;
  return `<g class="u-arrow${className ? ` ${className}` : ""}"${extra}><path class="u-arrow-line" pathLength="1" d="${d}"/><path class="u-arrow-head" d="${tip}"/></g>`;
}

// Swimlanes for a sequence in time: one row per actor (a stack, a queue, a server), time left to right.
// L = { id, names, hues, x, y, w, laneH, labelW, from, to, ticks } is shared with span(), so both use one scale.
// `ticks` is the gap between time marks (0 for none). The "now" line moves with showSpans(lanesEl, t).
const laneScale = ({ x = 0, y = 0, w, laneH = 24, labelW = 96, from = 0, to }) => ({ x0: x + labelW, px: (w - labelW) / (to - from), from, to, y, laneH });
export function lanes(L) {
  const { id, names, hues = [], w, labelW = 96, ticks = 1 } = L;
  const { x0, px, from, to, y, laneH } = laneScale(L);
  const height = names.length * laneH;
  const rows = names
    .map((name, i) => `<g class="u-lane" data-i="${i}"${hues[i] ? ` data-hue="${hues[i]}"` : ""}><rect class="u-lane-bg" x="${x0}" y="${y + i * laneH}" width="${w - labelW}" height="${laneH}"/><text class="u-lane-name" x="${x0 - 10}" y="${y + i * laneH + laneH / 2}">${esc(name)}</text></g>`)
    .join("");
  const marks = [];
  for (let t = from; ticks && t <= to + 1e-9; t += ticks) {
    const tx = r1(x0 + (t - from) * px);
    marks.push(`<path class="u-tick" d="M${tx} ${y}V${y + height + 3}"/><text class="u-tick-label" x="${tx}" y="${y + height + 12}">${r1(t)}</text>`);
  }
  return `<g class="u-lanes" id="${id}" data-x0="${x0}" data-px="${px}" data-from="${from}">${rows}${marks.join("")}<path class="u-now" d="M${x0} ${y - 4}V${y + height + 4}"/></g>`;
}

// A bar in lane `lane` from time `from` to `to`, with a short label. showSpans grows it up to "now".
export function span(L, { lane, from, to, text = "", hue = "", id }) {
  const { x0, px, from: start, y, laneH } = laneScale(L);
  const width = (to - from) * px;
  const need = text.length * 6.2 + 10;
  return (
    `<g class="u-span"${id ? ` id="${id}"` : ""}${hue ? ` data-hue="${hue}"` : ""} data-from="${from}" data-to="${to}" data-need="${r1(need)}" transform="translate(${r1(x0 + (from - start) * px)} ${y + lane * laneH})">` +
    `<rect class="u-span-bar" x="0.5" y="4" width="${r1(width - 1)}" height="${laneH - 8}" rx="3"/>` +
    (text ? `<g class="u-span-label"><text x="6" y="${laneH / 2}">${esc(text)}</text></g>` : "") +
    `</g>`
  );
}

// A small bar chart for a distribution (probabilities, counts). Heights move with CSS when the page calls setBars.
export function bars({ id, values, labels = [], x = 0, y = 0, w = 30, h = 120, hue, max = 1, places = 2, keep = false }) {
  const items = values
    .map((v, i) => {
      const share = Math.max(0, Math.min(1, v / max));
      return (
        `<g class="u-bar" data-i="${i}" transform="translate(${i * w} 0)" style="--v:${share.toFixed(3)};--c:${i}">` +
        `<rect class="u-bar-fill" x="4" y="0" width="${w - 8}" height="${h}"/>` +
        `<text class="u-bar-value" x="${w / 2}" y="${h - h * share - 6}">${fmt(v, places)}</text>` +
        (labels[i] !== undefined ? `<text class="u-bar-label" x="${w / 2}" y="${h + 12}">${esc(labels[i])}</text>` : "") +
        `</g>`
      );
    })
    .join("");
  return `<g class="u-bars" id="${id}" data-hue="${hue}" data-h="${h}" data-max="${max}" data-places="${places}"${keep ? " data-keep" : ""} transform="translate(${x} ${y})"><path class="u-axis" d="M0 ${h}H${values.length * w}"/>${items}</g>`;
}

// A matrix as a solid block in the anatomy iso camera, with its real values coloured on the top face.
// Rows run along y, columns along x. Use it for the big picture (Welch Labs style tensors); zoom to cellGrid for numbers.
export function tensorBlock(P, { at = [0, 0, 0], values, hue, cell = 10, height = 3, max }) {
  const [x0, y0, z0] = at;
  const rows = values.length;
  const cols = values[0].length;
  const top = max ?? maxOf(values);
  const plan = { x: x0, y: y0, w: cols * cell, d: rows * cell, r: 1 };
  const out = [`<path class="iso-halo" d="${iso.haloOf(plan, z0, height, P)}"/>`, iso.solidSvg(iso.slabOf(plan, z0, height, P, 3, 0.4), { tone: "mid" })];
  const face = values
    .map((row, r) =>
      row
        .map((value, c) => {
          const look = cellLook(value, top);
          const flags = `${look.masked ? " data-masked" : ""}${look.neg ? " data-neg" : ""}`;
          return `<rect class="u-cell-bg"${flags} x="${c * cell + 0.8}" y="${r * cell + 0.8}" width="${cell - 1.6}" height="${cell - 1.6}" rx="0.8" style="--a:${look.alpha.toFixed(2)}"/>`;
        })
        .join(""),
    )
    .join("");
  out.push(`<g class="u-face" data-hue="${hue}" transform="${iso.topMatrix([x0, y0], z0 + height, P)}">${face}</g>`);
  return out.join("");
}

// Text lying on the floor (or any top face) in the iso camera.
export const floorText = (P, at, z, text, { size = 6, cls = "u-floor-text", anchor = "start" } = {}) =>
  `<text class="${cls}" transform="${iso.topMatrix(at, z, P)}" font-size="${size}" text-anchor="${anchor}">${esc(text)}</text>`;

// A value travelling along a straight link, on a loop (SVG SMIL, so it needs no script).
// `begin` and `travel` are seconds inside one `cycle`; stagger `begin` by pipeline stage.
export function pulseSvg([x1, y1], [x2, y2], { hue = "", begin = 0, travel = 0.9, cycle = 3.6, r = 2.4 } = {}) {
  const t = (travel / cycle).toFixed(3);
  const timing = `dur="${cycle}s" begin="${begin}s" repeatCount="indefinite"`;
  return (
    `<circle class="u-pulse" r="${r}"${hue ? ` data-hue="${hue}"` : ""} opacity="0">` +
    `<animateMotion ${timing} path="M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}" keyPoints="0;1;1" keyTimes="0;${t};1" calcMode="linear"/>` +
    `<animate attributeName="opacity" ${timing} values="0;1;1;0;0" keyTimes="0;0.02;${(t * 0.85).toFixed(3)};${t};1"/></circle>`
  );
}

// Play an entrance each time a scene starts: "cells" (a grid), "pop", "fade", "rise" (blocks), "grow" (bars), "draw" (arrows).
// The delay grows with --r and --c, which cellGrid and bars set, so a grid fills row by row.
// The resting state is always visible: under reduced motion the animation is off and the element simply shows.
// kind "cells" takes a grid selector: each cell group fades in and its colour box pops.
// Never animate a <text> itself: Chrome can stop painting SVG text after an animation on it ends.
export function revealCss(scene, selector, { kind = "pop", delay = 0, stepR = 0, stepC = 0, dur = 450 } = {}) {
  if (kind === "cells")
    return [
      revealCss(scene, `${selector} .u-cell-bg`, { kind: "pop", delay, stepR, stepC, dur }),
      revealCss(scene, `${selector} .u-cell`, { kind: "fade", delay, stepR, stepC, dur }),
      revealCss(scene, `${selector} .u-mark`, { kind: "fade", delay: delay + dur / 2, stepR, dur }),
    ].join("\n");
  return `.u-stage[data-scene="${scene}"] ${selector}{animation:u-${kind} ${dur}ms var(--u-ease) backwards;animation-delay:calc(${delay}ms + var(--r, 0) * ${stepR}ms + var(--c, 0) * ${stepC}ms)}`;
}

// A full per-scene list from a sparse map: states(6, { 2: {x, y}, 3: {x, y, o: 0.3} }) -> [null, null, {...}, {...}, null, null].
export const states = (n, map) => Array.from({ length: n }, (_, i) => map[i] ?? null);

// Per-scene place of a movable element: CSS rules, so scene changes are native CSS transitions.
// states[i] is {x, y, s, o} or null (hidden; it fades out where it last stood).
// narrow: a second list for the narrow layout (stageHtml narrow); its rules apply while the stage has data-narrow.
export function placeCss(selector, states, narrow) {
  const known = states.map((state, i) => state ?? states.slice(0, i).reverse().find(Boolean) ?? states.slice(i).find(Boolean) ?? {});
  const wide = states
    .map((state, i) => {
      const { x = 0, y = 0, s = 1, o = 1 } = known[i];
      const show = state ? o : 0;
      // Leaving: fade out fast, at once. Arriving: fade in after the leavers are gone, so two scenes never overlap.
      const fade = show > 0 ? "--u-fade:.5s;--u-fade-at:.22s" : "--u-fade:.22s;--u-fade-at:0s";
      return `.u-stage[data-scene="${i}"] ${selector}{transform:translate(${x}px,${y}px) scale(${s});opacity:${show};pointer-events:${show > 0 ? "auto" : "none"};${fade}}`;
    })
    .join("\n");
  return narrow ? wide + "\n" + placeCss(selector, narrow).replaceAll(".u-stage[data-scene=", ".u-stage[data-narrow][data-scene=") : wide;
}

// The stage: equation bar (MathML), the drawing, one sentence per scene, and the scene stepper.
// A topic with no real math passes `rule` instead of `math`: one line of HTML in code type (the loop's rule, a protocol step).
// time: { steps, label, scenes } adds a step control under the drawing (back, a scrubber, next; "," and "." keys).
// The page listens with UNFOLD.onTime(fn) and reports its step with UNFOLD.timeAt(t). `scenes` lists the scenes that
// have steps; in the others the control is dimmed but still works. controls: HTML put beside it (a picker, a slider,
// number fields). controlScenes lists the scenes that use `controls`: in the others they are dimmed, and an input
// there moves to the first listed scene.
// Any element inside `controls` may carry its own data-scenes="2 3" (one slider of several); it then works the same way.
// narrow: [w, h] is a second viewBox the drawing switches to when the stage is under 560 px wide; the stage then
// carries data-narrow, so `.u-stage[data-narrow] …` CSS can move groups to a narrow layout. h may be a list with one
// height per scene, so a scene with fewer rows has no empty band.
// voice: each scene's narration (HTML like `say`). The page speaks it when the scene opens, with the clip in
// audio[i] (from narrate()) or else the browser's own voice. With voice off, the narration shows as text instead.
// say: an optional short line that stays on screen. With voice, keep it to the event in a few words, or leave it out.
export function stageHtml({ scenes, svg, label, css = "", key = "", dwell = 6500, time, controls = "", controlScenes, narrow, audio = [] }) {
  const n = scenes.length;
  const eq = scenes.map((s, i) => `<div class="u-at" data-at="${i}">${s.math ? `<math display="block">${s.math}</math>` : s.rule ? `<code class="u-rule">${s.rule}</code>` : ""}</div>`).join("");
  const say = scenes.some((s) => s.say) ? `<div class="u-say" aria-live="polite">${scenes.map((s, i) => `<p class="u-at" data-at="${i}">${s.say ?? ""}</p>`).join("")}</div>` : "";
  const voiced = scenes.some((s) => s.voice);
  const beatsOf = (s, i) =>
    s.beats?.length > 1 ? ` data-cues="${s.beats.map((b) => b.cue).join("|")}" data-chars="${s.beats.map((b) => b.text.length).join(" ")}"${audio[i]?.beats ? ` data-beats="${audio[i].beats.join(" ")}"` : ""}` : "";
  const cc = voiced ? `<div class="u-cc">${scenes.map((s, i) => `<p class="u-at" data-at="${i}"${audio[i]?.src ? ` data-audio="${audio[i].src}"` : ""}${beatsOf(s, i)}>${s.voice ?? ""}</p>`).join("")}</div>` : "";
  const play = `<button type="button" class="u-play" aria-pressed="false"><span>▶</span>Play</button>` + (voiced ? `<button type="button" class="u-voice" aria-pressed="true" hidden><span>♪</span>Voice</button>` : "");
  const steps = play + scenes.map((s, i) => `<button type="button" data-go="${i}"${i === 0 ? ' aria-current="step"' : ""}><span>${i + 1}</span>${esc(s.name)}</button>`).join("");
  const name = time?.label ?? "step";
  const timer = time
    ? `<div class="u-time" data-label="${esc(name)}"><button type="button" data-step="-1" aria-label="Previous ${esc(name)}">‹</button>` +
      `<input type="range" min="0" max="${time.steps - 1}" value="0" aria-label="${esc(name)}"><button type="button" data-step="1" aria-label="Next ${esc(name)}">›</button>` +
      `<output>${esc(name)} 0 / ${time.steps - 1}</output></div>`
    : "";
  const ctl = controls ? `<div class="u-ctl"${controlScenes ? ` data-scenes="${controlScenes.join(" ")}"` : ""}>${controls}</div>` : "";
  const below = controls || timer ? `<div class="u-controls">${ctl}${timer}</div>` : "";
  const hs = narrow && [narrow[1]].flat();
  const box = narrow ? ` data-narrow-box="0 0 ${narrow[0]} ${Math.max(...hs)}"${hs.length > 1 ? ` data-narrow-h="${hs.join(" ")}"` : ""}` : "";
  const dim = time?.scenes ? `.u-stage:not(:is(${time.scenes.map((i) => `[data-scene="${i}"]`).join(",")})) .u-time{opacity:.4}` : "";
  return (
    `<style>${sceneCss(n)}${dim}${css}</style>` +
    `<div class="u-stage" tabindex="0" role="group" aria-roledescription="explainer" aria-label="${esc(label)}" data-scene="0" data-count="${n}" data-dwell="${dwell}"${box}>` +
    `<div class="u-eq" aria-live="polite">${eq}</div>${svg}${below}${say}${cc}<nav class="u-steps" aria-label="Scenes">${steps}</nav>${key}</div>`
  );
}

function sceneCss(n) {
  const rules = [];
  for (let i = 0; i < n; i++) {
    rules.push(`.u-stage[data-scene="${i}"] .u-at[data-at="${i}"]{opacity:1;visibility:visible;transition:opacity .4s var(--u-ease) .2s,visibility 0s .2s}`);
    rules.push(`.u-stage[data-scene="${i}"] .u-grid[data-t~="${i}"] .u-cell{transform:translate(var(--tx),var(--ty))}`);
    rules.push(`.u-stage[data-scene="${i}"] .u-grid[data-t~="${i}"] :is(.u-T,.u-dims-T){display:inline}`);
    rules.push(`.u-stage[data-scene="${i}"] .u-grid[data-t~="${i}"] .u-dims:not(.u-dims-T),.u-stage[data-scene="${i}"] .u-grid[data-t~="${i}"] .u-mark{display:none}`);
  }
  return rules.join("\n");
}

// Page-side runtime: scene stepping, keys, the tour (starts paused; Play runs it once to the last scene), reduced motion,
// plus setGrid / setBars / mark for live values.
// Listen for "unfold:scene" on the stage to react to scene changes.
function runtime() {
  const stage = document.querySelector(".u-stage");
  const count = Number(stage.dataset.count);
  const dwell = Number(stage.dataset.dwell);
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let scene = 0;
  let visible = false;
  let playing = false;
  let held = false;
  let next = 0;
  const beats = [];
  const total = (b) => (typeof b.count === "function" ? b.count() : b.count);
  // Voice: a scene's narration plays when the scene opens, from its recorded clip (data-audio) or else the browser's
  // own voice, which reads the current text, live numbers included. Voice off shows the narration as text.
  // The tour waits until the narration ends. A replay of the same scene (go(scene())) does not restart it.
  const cc = stage.querySelector(".u-cc");
  const voiceBtn = stage.querySelector(".u-voice");
  const synth = window.speechSynthesis;
  const clips = !!cc?.querySelector("[data-audio]");
  let voiceOn = !!cc && (clips || !!synth);
  let speaking = false;
  let spoken = -1;
  let talk = 0;
  let clip = null;
  let audio = null;
  const recorded = [...(cc?.children ?? [])].map((p) => p.textContent.trim());
  // ponytail: name heuristic. Neural and online voices (Edge "Natural", Chrome "Google", Apple "Premium") sound human.
  const bestVoice = () => {
    const en = synth.getVoices().filter((v) => v.lang.startsWith("en"));
    return en.find((v) => /natural|neural|online/i.test(v.name)) ?? en.find((v) => /google|premium|enhanced|siri/i.test(v.name)) ?? en.find((v) => v.default) ?? en[0] ?? null;
  };
  // Beats: while the voice says line k of the script, the stage has data-speaking and data-cue="<cue of line k>".
  // The build's CSS lights what that line talks about. When the narration ends, both go and the full scene shows.
  let timers = [];
  const quiet = () => {
    timers.forEach(clearTimeout);
    timers = [];
    stage.removeAttribute("data-speaking");
    delete stage.dataset.cue;
  };
  const followBeats = (p, total) => {
    const cues = p.dataset.cues?.split("|");
    if (!cues) return;
    let times = p.dataset.beats?.split(" ").map(Number);
    if (!times) {
      // No times from the build (the browser's voice): spread the beats by text length.
      const chars = p.dataset.chars.split(" ").map(Number);
      const sum = chars.reduce((a, b) => a + b, 0);
      times = chars.map((_, k) => (total * chars.slice(0, k).reduce((a, b) => a + b, 0)) / sum);
    }
    stage.toggleAttribute("data-speaking", true);
    times.forEach((t, k) => timers.push(setTimeout(() => (stage.dataset.cue = cues[k]), t * 1000)));
  };
  const hush = () => {
    talk++;
    speaking = false;
    spoken = -1;
    clip?.stop();
    clip = null;
    synth?.cancel();
    quiet();
  };
  const speak = () => {
    if (!voiceOn || spoken === scene) return;
    // Browsers play no sound before the reader's first click. Wait for it: Play and the scene buttons start the voice.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    hush();
    spoken = scene;
    const p = cc.querySelector(`[data-at="${scene}"]`);
    const text = p?.textContent.trim();
    if (!text) return;
    const token = talk;
    const end = () => {
      if (token !== talk || !speaking) return;
      speaking = false;
      quiet();
      next = performance.now() + 900;
    };
    speaking = true;
    // The clip was recorded from the build's text. After an input changes a live number, the browser reads the new text.
    // Web Audio decodes the clip from the page itself, so a sandbox that blocks data: media URLs (a file preview,
    // an Artifact) still plays it.
    if (p.dataset.audio && text === recorded[scene] && window.AudioContext) {
      audio ??= new AudioContext();
      audio.resume();
      const bytes = Uint8Array.from(atob(p.dataset.audio.split(",")[1]), (c) => c.charCodeAt(0));
      audio.decodeAudioData(bytes.buffer).then((buffer) => {
        if (token !== talk) return;
        clip = audio.createBufferSource();
        clip.buffer = buffer;
        clip.connect(audio.destination);
        clip.onended = end;
        clip.start();
        followBeats(p, buffer.duration);
      }, end);
    } else if (synth) {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = bestVoice();
      u.rate = 0.95;
      u.onend = u.onerror = end;
      synth.speak(u);
      // ponytail: a browser voice may never report its end, so the tour stops waiting after 0.6 s a word.
      setTimeout(end, 3000 + text.split(/\s+/).length * 600);
      followBeats(p, text.length / 14);
    } else end();
  };
  const setVoice = (on) => {
    voiceOn = on;
    stage.toggleAttribute("data-voice", on);
    voiceBtn?.setAttribute("aria-pressed", String(on));
    on ? speak() : hush();
  };
  if (voiceBtn && voiceOn) voiceBtn.hidden = false;
  stage.toggleAttribute("data-voice", voiceOn);
  voiceBtn?.addEventListener("click", () => setVoice(!voiceOn));
  const go = (i, by = "user") => {
    scene = Math.max(0, Math.min(count - 1, i));
    stage.dataset.scene = String(scene);
    stage.querySelectorAll("[data-go]").forEach((b) => (Number(b.dataset.go) === scene ? b.setAttribute("aria-current", "step") : b.removeAttribute("aria-current")));
    stage.querySelectorAll("[data-ds]").forEach((el) => {
      const d = JSON.parse(el.dataset.ds)[scene];
      el.toggleAttribute("data-off", !d);
      if (!d) return;
      if (CSS.supports("d", 'path("M0 0")')) el.style.d = `path("${d}")`;
      else el.setAttribute("d", d);
    });
    scope();
    fit();
    stage.dispatchEvent(new CustomEvent("unfold:scene", { detail: { scene, by } }));
    if (by === "user") setPlaying(false);
    held = false;
    next = performance.now() + dwell;
    if (scene !== spoken) speak();
    for (const b of beats) {
      b.n = 0;
      b.at = performance.now() + b.wait - b.ms;
      if (still.matches && b.scene === scene) b.fn(-1);
    }
    setBusy();
  };
  // data-busy is on the stage while a counted sweep of this scene still runs. The tour and shoot.mjs wait for it.
  // A sweep is done one `ms` after its last call, so the last step has time to move. The tour then holds that
  // last step for `hold` ms before the next scene, so the reader sees the result.
  const hold = 1800;
  const setBusy = (now = performance.now()) => {
    const busy = !held && !still.matches && beats.some((b) => b.scene === scene && total(b) && (b.n < total(b) || now - b.at < b.ms));
    if (busy === stage.hasAttribute("data-busy")) return;
    stage.toggleAttribute("data-busy", busy);
    if (!busy) next = Math.max(next, now + hold);
  };
  // The tour runs only after the reader presses Play, and stops at the last scene or at any input.
  const playBtn = stage.querySelector(".u-play");
  const setPlaying = (on) => {
    playing = on;
    playBtn.setAttribute("aria-pressed", String(on));
    playBtn.firstChild.textContent = on ? "❚❚" : "▶";
    playBtn.lastChild.textContent = on ? "Pause" : "Play";
  };
  playBtn.addEventListener("click", () => {
    if (playing) {
      hush();
      return setPlaying(false);
    }
    if (scene === count - 1) go(0, "tour");
    next = performance.now() + dwell;
    setPlaying(true);
    // A clip that the browser blocked before this click plays now.
    if (!speaking) (spoken = -1), speak();
  });
  const tour = (now) => {
    if (playing && visible && now > next && !speaking && !stage.hasAttribute("data-busy")) scene === count - 1 ? setPlaying(false) : go(scene + 1, "tour");
    for (const b of beats) {
      if (b.scene === scene && visible && !held && !still.matches && now - b.at >= b.ms && !(total(b) && b.n >= total(b))) {
        b.at = now;
        b.fn(b.n++);
      }
    }
    setBusy(now);
    requestAnimationFrame(tour);
  };
  stage.querySelector(".u-steps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) go(Number(b.dataset.go));
  });
  stage.addEventListener("keydown", (e) => {
    const to = { ArrowRight: scene + 1, ArrowLeft: scene - 1, Home: 0, End: count - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    go(to);
  });
  // Time by hand: the step control and the "," and "." keys call the page's onTime(t). Its keys stay inside it.
  const timer = stage.querySelector(".u-time");
  let onTime = () => {};
  const range = timer?.querySelector("input");
  // onTime first: it may call go(), which releases the sweeps. pause() after it holds them again.
  const byHand = (t) => {
    onTime(Math.max(0, Math.min(Number(range.max), t)));
    pause();
  };
  if (timer) {
    range.addEventListener("input", () => byHand(Number(range.value)));
    timer.addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (b) byHand(Number(range.value) + Number(b.dataset.step));
    });
    stage.addEventListener("keydown", (e) => {
      const by = { ",": -1, ".": 1 }[e.key];
      if (by === undefined) return;
      e.preventDefault();
      byHand(Number(range.value) + by);
    });
  }
  // Keys typed in a control (a scrubber, a number field) stay in it: no scene or focus change.
  stage.querySelectorAll(".u-controls :is(input,select,textarea)").forEach((el) => el.addEventListener("keydown", (e) => e.stopPropagation()));
  // A scene-scoped control (stageHtml controlScenes, or any element in the controls with data-scenes) is dimmed
  // in the other scenes, and an input there moves to the first scene that uses it.
  const ownersOf = (el) => el.dataset.scenes.trim().split(/\s+/).map(Number);
  function scope() {
    stage.querySelectorAll(".u-controls [data-scenes]").forEach((el) => el.toggleAttribute("data-idle", !ownersOf(el).includes(scene)));
  }
  const toOwner = (e) => {
    const el = e.target.closest(".u-controls [data-scenes]");
    if (el && !ownersOf(el).includes(scene)) go(ownersOf(el)[0]);
  };
  // Capture phase: the move runs before the page's own handler, so a preset applied on scene entry
  // does not overwrite what the reader just set.
  const panel = stage.querySelector(".u-controls");
  panel?.addEventListener("input", toOwner, true);
  panel?.addEventListener("click", (e) => e.target.closest("button") && toOwner(e), true);
  // timeAt(t, steps): show step t. Pass steps when the run's length changed (a live input made a longer trace).
  const timeAt = (t, steps) => {
    if (!timer) return;
    if (steps) range.max = String(steps - 1);
    range.value = String(t);
    timer.querySelector("output").textContent = `${timer.dataset.label} ${t} / ${range.max}`;
  };
  // Narrow layout: below 560 px the drawing takes its second viewBox and the stage gets data-narrow.
  // With one narrow height per scene (data-narrow-h), the viewBox follows the scene.
  const svg = stage.querySelector("svg");
  const wide = svg?.getAttribute("viewBox");
  const heights = stage.dataset.narrowH?.split(" ");
  function fit() {
    if (!stage.dataset.narrowBox) return;
    const box = stage.dataset.narrowBox.split(" ");
    if (heights) box[3] = heights[scene] ?? box[3];
    svg.setAttribute("viewBox", stage.hasAttribute("data-narrow") ? box.join(" ") : wide);
  }
  if (stage.dataset.narrowBox)
    new ResizeObserver(([entry]) => {
      const on = entry.contentRect.width < 560;
      if (on === stage.hasAttribute("data-narrow")) return;
      stage.toggleAttribute("data-narrow", on);
      fit();
      stage.dispatchEvent(new CustomEvent("unfold:layout", { detail: { narrow: on } }));
    }).observe(stage);
  scope();
  new IntersectionObserver((entries) => (visible = entries[entries.length - 1].isIntersecting), { rootMargin: "120px 0px" }).observe(stage);
  next = performance.now() + dwell;
  requestAnimationFrame(tour);
  // beat(scene, ms, fn, wait, count): call fn(0), fn(1), … every ms while that scene shows, starting `wait` ms after it opens.
  // With count, it stops after fn(count - 1) and the stage loses data-busy. Without it, the sweep never ends (a loop).
  // count may be a function, read on every frame, for a run whose length a live input changes.
  // Under reduced motion fn(-1) is called once instead: show the resting state.
  const beat = (sceneIndex, ms, fn, wait = 1000, count = 0) => {
    // No setBusy() here: the next frame runs it, so a count function may read data the page sets up after this call.
    beats.push({ scene: sceneIndex, ms, fn, wait, count, n: 0, at: performance.now() + wait - ms });
    // The scene open at load had no go() after this beat existed: show its resting state too, after the page script ran.
    requestAnimationFrame(() => still.matches && scene === sceneIndex && fn(-1));
  };
  // pause(): the user took control. The tour stops, and the sweeps hold until the scene changes.
  const pause = () => {
    setPlaying(false);
    held = true;
    setBusy();
  };
  return { stage, go, beat, pause, scene: () => scene, onTime: (fn) => (onTime = fn), timeAt, narrow: () => stage.hasAttribute("data-narrow") };
}

// max: a new scale for these values (for example a different run per scene); default the build's.
function setGrid(grid, values, max = Number(grid.dataset.max)) {
  const places = Number(grid.dataset.places);
  grid.querySelectorAll(".u-cell").forEach((cell) => {
    const value = values[Number(cell.dataset.r)][Number(cell.dataset.c)];
    const look = cellLook(value, max);
    cell.toggleAttribute("data-masked", look.masked);
    cell.toggleAttribute("data-neg", look.neg);
    cell.toggleAttribute("data-hot", look.hot);
    cell.querySelector(".u-cell-bg").style.setProperty("--a", look.alpha.toFixed(2));
    cell.querySelector(".u-num").textContent = fmt(value, places);
  });
}

// Show rows 0..t of a grid and hide the rows not computed yet (iterations, steps, a table that fills).
function showRows(grid, t) {
  grid.querySelectorAll(".u-cell,.u-mark").forEach((el) => el.toggleAttribute("data-later", Number(el.dataset.r) > t));
}

// max: a new top of the scale (a loss that shrinks); it is kept for the next call.
function setBars(group, values, max = Number(group.dataset.max)) {
  const h = Number(group.dataset.h);
  group.dataset.max = String(max);
  const places = Number(group.dataset.places);
  group.querySelectorAll(".u-bar").forEach((bar) => {
    const v = values[Number(bar.dataset.i)] ?? 0;
    const share = Math.max(0, Math.min(1, v / max));
    bar.style.setProperty("--v", share.toFixed(3));
    const text = bar.querySelector(".u-bar-value");
    text.setAttribute("y", String(h - h * share - 6));
    text.textContent = fmt(v, places);
  });
}

// Fill every span in a lanes figure up to time t, and move the "now" line there.
function showSpans(root, t) {
  const box = root.querySelector(".u-lanes");
  const px = Number(box.dataset.px);
  box.querySelector(".u-now").style.transform = `translateX(${(t - Number(box.dataset.from)) * px}px)`;
  root.querySelectorAll(".u-span").forEach((el) => {
    const from = Number(el.dataset.from);
    const to = Number(el.dataset.to);
    const v = Math.max(0, Math.min(1, (t - from) / (to - from)));
    el.style.setProperty("--v", v.toFixed(3));
    el.toggleAttribute("data-labeled", v * (to - from) * px >= Number(el.dataset.need));
  });
}

// Write live values into every [data-live="name"] element: numbers in the equation bar (mn), labels, readout spans.
// A number is formatted with the element's data-places (default: 0 for a whole number, else 1); a string is written as it is.
function setLive(values, root = document) {
  for (const [name, v] of Object.entries(values))
    root.querySelectorAll(`[data-live="${name}"]`).forEach((el) => (el.textContent = typeof v === "number" ? fmt(v, Number(el.dataset.places ?? (Number.isInteger(v) ? 0 : 1))) : v));
}

// The page-side twin of plot()'s at(x, y): the same scale, read from the plot group's data-scale.
function plotAt(plotEl, vx, vy) {
  const [x, y, w, h, x0, x1, y0, y1] = plotEl.dataset.scale.split(" ").map(Number);
  return [x + ((vx - x0) / (x1 - x0)) * w, y + h - ((vy - y0) / (y1 - y0)) * h];
}

// Light one row of a grid (or one chip) by index; -1 clears.
function mark(root, i, selector = ".u-mark") {
  root.querySelectorAll(`${selector}[data-r],${selector}[data-i]`).forEach((el) => el.toggleAttribute("data-on", Number(el.dataset.r ?? el.dataset.i) === i));
}

// Source for the page's <script type="module">. Defines UNFOLD = { stage, go, scene, pause, … } and only the helpers
// that `uses` (the page's own script) names, plus what they need. A page does not ship helpers it never calls.
const HELPERS = { cellLook: [CELL_LOOK], fmt: [fmt], setGrid: [setGrid, "cellLook", "fmt"], showRows: [showRows], setBars: [setBars, "fmt"], mark: [mark], showSpans: [showSpans], setLive: [setLive, "fmt"], plotAt: [plotAt] };
export function runtimeScript(uses = "") {
  const need = new Set();
  const add = (name) => need.has(name) || (need.add(name), HELPERS[name].slice(1).forEach(add));
  for (const name of Object.keys(HELPERS)) if (new RegExp(`(?<![\\w.$-])${name}\\b(?!-)`).test(uses)) add(name);
  return [...Object.keys(HELPERS).filter((name) => need.has(name)).map((name) => HELPERS[name][0]), runtime].map(String).join("\n") + "\nconst UNFOLD = runtime();\n";
}

// The model's pure functions as page source, so a live input recomputes with the same code the build used.
// Each must be a named `function` declaration (String() of an arrow function loses its name). `data` becomes
// `const` lines; JSON has no Infinity, so pass only finite numbers there.
export function modelScript(fns, data = {}) {
  for (const fn of fns) if (!/^function\s+\w/.test(String(fn))) throw new Error(`modelScript: ${fn.name || "an arrow function"} must be a named function declaration`);
  return Object.entries(data).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};\n`).join("") + fns.map(String).join("\n") + "\n";
}

// The narration script: a markdown file with one "## n. Scene name" section per scene, in scene order, and one
// sentence (a beat) per line. A line may start with a cue, "[satcat] With the starting numbers, …": while the voice
// says that line, the stage has data-cue="satcat", so the build's CSS can light what the line talks about.
// Returns { voice, beats: [{ cue, text }] } per scene; spread it into the scene. Write the script before recording,
// and show it to the user: each changed section records a new clip.
export function readScript(file) {
  const sections = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "").split(/^## .*$/m).slice(1);
  return sections.map((section) => {
    const beats = section.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [, cue = "", text] = /^(?:\[([\w-]+)\]\s*)?(.*)$/.exec(line);
      return { cue, text };
    });
    return { voice: beats.map((b) => b.text).join(" "), beats };
  });
}

// Narration clips for stageHtml({ audio }): each scene's `voice` text read by a TTS provider at build time, as
// { src, beats }: a data URI, and the start time in seconds of each script line (beat) in the clip.
// provider: "gemini", "openai" or "elevenlabs" (see TTS below); default UNFOLD_TTS_PROVIDER, else the first
// provider whose key is set. model and voice default to UNFOLD_TTS_MODEL and UNFOLD_TTS_VOICE, else the provider's
// own defaults. Pin all three in build.mjs: the cache name holds the model and the voice, so a rebuild finds the clips.
// A clip is cached in `dir` by its text, so a rebuild makes no request and needs no key. A scene gets null (and the
// page reads it with the browser's own voice) when there is no key and no cached clip, or the request fails.
// `style` is an optional short direction: Gemini reads it before the text (keep it a tag, "[calm, warm teacher]",
// or it can be read aloud), OpenAI gets it as instructions, ElevenLabs has no such field and ignores it.
export async function narrate(scenes, { dir, provider, model, voice, style = "" } = {}) {
  provider ||= process.env.UNFOLD_TTS_PROVIDER || Object.keys(TTS).find((name) => TTS[name].keys.some((k) => process.env[k])) || "gemini";
  const tts = TTS[provider];
  if (!tts) throw new Error(`narrate: unknown provider "${provider}". Use ${Object.keys(TTS).join(", ")}.`);
  model ??= process.env.UNFOLD_TTS_MODEL ?? tts.model;
  voice ??= process.env.UNFOLD_TTS_VOICE ?? tts.voice;
  let key = tts.keys.map((k) => process.env[k]).find(Boolean);
  const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
  const out = [];
  for (const s of scenes) {
    const text = s.voice ? spokenText(s.voice) : "";
    const name = createHash("sha1").update([model, voice, style, text].join("\n")).digest("hex").slice(0, 16);
    const file = [".mp3", ".wav"].map((ext) => join(dir, name + ext)).find(existsSync);
    if (!text || (!file && !key)) {
      out.push(null);
      continue;
    }
    if (file) {
      out.push(clipOf(file, s.beats, ffmpeg));
      continue;
    }
    try {
      const { pcm: raw, rate } = await speech(tts, text, { key, model, voice, style });
      const pcm = cleanEnds(raw, rate);
      mkdirSync(dir, { recursive: true });
      const made = join(dir, name + (ffmpeg ? ".mp3" : ".wav"));
      if (ffmpeg) spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "s16le", "-ar", String(rate), "-ac", "1", "-i", "pipe:0", "-b:a", "48k", made], { input: pcm });
      else writeFileSync(made, Buffer.concat([wavHeader(pcm.length, rate), pcm]));
      console.log(`narrate: recorded scene ${out.length + 1}`);
      out.push(clipOf(made, s.beats, ffmpeg));
    } catch (error) {
      console.warn(`narrate: ${error.message}. This scene uses the browser's voice.`);
      // The free tier allows 10 requests a day per model. Stop asking: the next day's build records the rest.
      if (error.daily) (key = null), console.warn("narrate: daily quota used up. The cached clips are kept. Build again tomorrow, or enable billing on the key.");
      out.push(null);
    }
  }
  const made = out.filter(Boolean).length;
  console.log(`narrate: ${made} of ${scenes.length} scenes have a recorded clip (${provider}, ${model}, ${voice})${made < scenes.length && !key ? `. The others use the browser's voice: set ${tts.keys[0]} to record them` : ""}`);
  return out;
}

// A clip and where each beat starts in it. The voice pauses between sentences, so each beat boundary goes to the
// pause nearest to where it falls by text length; with no pause near, it stays at that estimate.
function clipOf(file, beats, ffmpeg) {
  const src = dataUri(file);
  if (!beats || beats.length < 2 || !ffmpeg) return { src };
  const rate = 24000;
  const pcm = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", String(rate), "-"], { maxBuffer: 1 << 27 }).stdout;
  return { src, beats: beatTimes(pcm, rate, beats.map((b) => b.text.length)) };
}

export function beatTimes(pcm, rate, lengths) {
  const s = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length - (pcm.length % 2)));
  const w = Math.round(rate / 100);
  const loud = [];
  for (let f = 0; (f + 1) * w <= s.length; f++) {
    let sum = 0;
    for (let i = f * w; i < (f + 1) * w; i++) sum += s[i] * s[i];
    loud.push(Math.sqrt(sum / w) >= 150);
  }
  const first = loud.indexOf(true);
  const last = loud.lastIndexOf(true);
  const gaps = [];
  for (let f = first, start = -1; f <= last; f++) {
    if (!loud[f] && start < 0) start = f;
    if (loud[f] && start >= 0) {
      if (f - start >= 15) gaps.push({ mid: (start + f) / 200, end: f / 100, len: (f - start) / 100 });
      start = -1;
    }
  }
  const total = lengths.reduce((a, b) => a + b, 0);
  const times = [0];
  let done = 0;
  let after = 0;
  for (let k = 1; k < lengths.length; k++) {
    done += lengths[k - 1];
    const guess = (first + ((last - first) * done) / total) / 100;
    // A near pause wins, and a long pause (the end of a sentence) wins over a short one (a comma).
    const score = (g) => Math.abs(g.mid - guess) - g.len;
    const best = gaps.filter((g) => g.mid > after && Math.abs(g.mid - guess) < 2).sort((a, b) => score(a) - score(b))[0];
    const t = best ? Math.max(0, best.end - 0.15) : guess;
    times.push(Math.round(t * 100) / 100);
    after = best ? best.mid : guess;
  }
  return times;
}

const spokenText = (html) =>
  html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/​/g, "").replace(/\s+/g, " ").trim();
const dataUri = (file) => `data:audio/${file.endsWith(".mp3") ? "mpeg" : "wav"};base64,${readFileSync(file).toString("base64")}`;

// The TTS providers. Each one: the environment variables that may hold its key, its default model and voice, the
// request for one text, and how to read 16-bit mono PCM and its rate from the answer.
// Gemini returns PCM in JSON with the rate in the mime type ("audio/l16; rate=24000"). If it returns a WAV file
// instead, only its "data" chunk is sound: its header and metadata, read as samples, are loud clicks.
// OpenAI and ElevenLabs return raw PCM at 24 kHz when asked for it.
const TTS = {
  gemini: {
    keys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    model: "gemini-3.8-flash-tts",
    voice: "Kore",
    request: (text, { key, model, voice, style }) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      headers: { "x-goog-api-key": key },
      body: { contents: [{ parts: [{ text: `${style} ${text}`.trim() }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } },
    }),
    read: async (res) => {
      const inline = (await res.json()).candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
      if (!inline?.data) return null;
      const bytes = Buffer.from(inline.data, "base64");
      if (bytes.toString("latin1", 0, 4) === "RIFF") return wavData(bytes);
      return { pcm: bytes, rate: Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000) };
    },
  },
  openai: {
    keys: ["OPENAI_API_KEY"],
    model: "gpt-4o-mini-tts",
    voice: "coral",
    request: (text, { key, model, voice, style }) => ({
      url: "https://api.openai.com/v1/audio/speech",
      headers: { authorization: `Bearer ${key}` },
      body: { model, voice, input: text, response_format: "pcm", ...(style ? { instructions: style } : {}) },
    }),
    read: async (res) => ({ pcm: Buffer.from(await res.arrayBuffer()), rate: 24000 }),
  },
  elevenlabs: {
    keys: ["ELEVENLABS_API_KEY", "XI_API_KEY"],
    model: "eleven_multilingual_v2",
    voice: "JBFqnCBsd6RMkjVDRZzb",
    request: (text, { key, model, voice }) => ({
      url: `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=pcm_24000`,
      headers: { "xi-api-key": key },
      body: { text, model_id: model },
    }),
    read: async (res) => ({ pcm: Buffer.from(await res.arrayBuffer()), rate: 24000 }),
  },
};
export const TTS_PROVIDERS = Object.fromEntries(Object.entries(TTS).map(([name, t]) => [name, { keys: t.keys, model: t.model, voice: t.voice }]));

// One text to PCM with any provider. The free tiers allow few requests a minute, so a 429 (and a busy 500 or 503,
// or a network error) waits and tries again. A daily quota (Gemini says so in the error) stops at once.
async function speech(tts, text, opts) {
  for (let tries = 0; ; tries++) {
    const { url, headers, body } = tts.request(text, opts);
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) }).catch((error) => ({
      ok: false,
      status: 0,
      json: async () => ({ error: { message: error.message } }),
    }));
    if (res.ok) {
      const got = await tts.read(res).catch(() => null);
      if (got?.pcm?.length) return got;
    }
    const err = res.ok ? {} : await res.json().catch(() => ({}));
    // Gemini and OpenAI: { error: { message } }. ElevenLabs: { detail: { message } } or { detail: "…" }.
    const message = err.error?.message ?? err.detail?.message ?? (typeof err.detail === "string" ? err.detail : "no audio in the answer");
    const daily = err.error?.details?.some((d) => d.violations?.some((v) => /PerDay/.test(v.quotaId)));
    if (daily || ![0, 429, 500, 503].includes(res.status) || tries >= 5) throw Object.assign(new Error(`TTS ${res.status}: ${message.split("\n")[0]}`), { daily });
    const wait = parseFloat(err.error?.details?.find((d) => d.retryDelay)?.retryDelay) || 10 * (tries + 1);
    console.log(`narrate: ${res.status || "network error"}, waiting ${Math.ceil(wait)} s`);
    await new Promise((done) => setTimeout(done, wait * 1000 + 500));
  }
}

// The sound chunk of a WAV file, and its sample rate.
function wavData(bytes) {
  let rate = 24000;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const id = bytes.toString("latin1", at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (id === "fmt ") rate = bytes.readUInt32LE(at + 12);
    if (id === "data") return { pcm: bytes.subarray(at + 8, Math.min(bytes.length, at + 8 + size)), rate };
    at += 8 + size + (size % 2);
  }
  throw new Error("Gemini TTS: a WAV answer with no data chunk");
}

// Clips from gemini-3.8-flash-tts had two noises: a 5 ms click at the start, before a gap of silence, and a burst
// at full scale (0.1 to 0.15 s) after the last word and a gap. Cut both. The start: sound in the first 60 ms that a
// 20 ms gap follows is silenced. The end: sound in the last 0.4 s is cut only if it clips (a peak of 30000 or more,
// which speech here never reaches) and a gap of 100 ms or more comes before it. The last 20 ms always fade out.
// pcm is 16-bit mono; returns a new Buffer. Checked by node kit/concept-kit.mjs --check.
export function cleanEnds(pcm, rate = 24000) {
  const s = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length - (pcm.length % 2)));
  const w = Math.round(rate / 100);
  const frames = Math.floor(s.length / w);
  const rms = (f) => {
    let sum = 0;
    for (let i = f * w; i < (f + 1) * w; i++) sum += s[i] * s[i];
    return Math.sqrt(sum / w);
  };
  const loud = (f) => rms(f) >= 150;
  for (let f = 0; f < 6 && f + 2 < frames; f++) if (loud(f) && !loud(f + 1) && !loud(f + 2)) s.fill(0, 0, (f + 1) * w);
  let f = frames - 1;
  while (f >= 0 && loud(f) && frames - 1 - f < 40) f--;
  let q = f;
  while (q >= 0 && !loud(q)) q--;
  let peak = 0;
  for (let i = (f + 1) * w; i < s.length; i++) peak = Math.max(peak, Math.abs(s[i]));
  const cut = f - q >= 10 && q >= 0 && peak >= 30000;
  const out = cut ? s.slice(0, (q + 1) * w + Math.round(rate * 0.12)) : s.slice();
  const fade = Math.min(out.length, Math.round(rate * 0.02));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] = Math.round(out[out.length - 1 - i] * (i / fade));
  return Buffer.from(out.buffer);
}

function wavHeader(bytes, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + bytes, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(bytes, 40);
  return h;
}

const ink = (dark, light) => [dark, light];
const PALETTE = {
  blue: ink("#58c4dd", "#1f78a4"),
  yellow: ink("#f4d345", "#a67c00"),
  red: ink("#fc6255", "#cf3b2e"),
  green: ink("#83c167", "#3e8a2a"),
  teal: ink("#5cd0b3", "#16866b"),
  purple: ink("#b48ad1", "#7a4fa3"),
  gold: ink("#f0ac5f", "#b8661a"),
};

export const UNFOLD_CSS = `
.iso{${Object.entries(PALETTE).map(([n, [d]]) => `--unfold-${n}:${d}`).join(";")};--unfold-on-hot:#0b0b0b;--unfold-serif:"Latin Modern Math","STIX Two Math","Cambria Math",math,serif}
.iso[data-theme="light"]{${Object.entries(PALETTE).map(([n, [, l]]) => `--unfold-${n}:${l}`).join(";")};--unfold-on-hot:#ffffff}
${HUES.map((h) => `[data-hue="${h}"]{--hue:var(--unfold-${h})}`).join("")}[data-hue="ink"]{--hue:var(--u-hi)}
.u-key{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 16px;margin-top:10px;color:var(--u-muted);font-size:12px}
.u-key>span{display:inline-flex;align-items:center;gap:6px}
.u-key i{width:10px;height:10px;border-radius:2px;background:var(--hue)}
.u-key i.u-hollow{background:none;box-shadow:inset 0 0 0 1.2px var(--u-mid)}
.u-key i.u-solid{background:var(--u-mid)}
.u-stage{position:relative;outline:none;container-type:inline-size;--u-fade:.5s;--u-fade-at:.22s}
.u-stage:focus-visible{outline:1px solid var(--u-faint);outline-offset:8px}
.u-stage .iso-svg{overflow:visible}
.u-eq,.u-say,.u-cc{display:grid;align-items:center}
.u-eq>.u-at,.u-say>.u-at,.u-cc>.u-at{grid-area:1/1;opacity:0;visibility:hidden;transition:opacity .2s var(--u-ease),visibility 0s .2s;margin:0}
.u-eq{min-height:44px;margin-bottom:8px;overflow-x:auto;overflow-y:hidden}
.u-eq math{font-family:var(--unfold-serif);font-size:20px;color:var(--u-strong)}
.u-eq [data-hue]{color:var(--hue)}
.u-say{min-height:48px;margin-top:6px;color:var(--u-text);font-size:14px;line-height:1.55;text-align:center}
.u-cc{margin-top:6px;color:var(--u-text);font-size:14px;line-height:1.55;text-align:center}
.u-stage[data-voice] .u-cc{display:none}
:is(.u-say,.u-cc)>.u-at{max-width:62ch;justify-self:center}
:is(.u-say,.u-cc) b{color:var(--u-strong);font-weight:500}
:is(.u-say,.u-cc) [data-hue]{color:var(--hue)}
.u-steps{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:14px}
.u-steps button{display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;border:0;border-radius:999px;background:transparent;color:var(--u-muted);font:11px/1 var(--u-mono);letter-spacing:.04em;cursor:pointer;box-shadow:0 0 0 1px var(--u-faint);transition:color .2s,box-shadow .2s}
.u-steps button span{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:var(--u-faint);color:var(--u-text);font-size:10px}
.u-steps button:hover{color:var(--u-text)}
.u-steps button[aria-current]{color:var(--u-strong);box-shadow:0 0 0 1px var(--u-mid)}
.u-steps button[aria-current] span{background:var(--u-strong);color:var(--u-card)}
.u-steps :is(.u-play,.u-voice){margin-right:6px}.u-steps :is(.u-play,.u-voice)[aria-pressed="true"]{color:var(--u-strong);box-shadow:0 0 0 1px var(--u-mid)}
.u-move{transition:transform .9s var(--u-ease),opacity var(--u-fade) var(--u-ease) var(--u-fade-at)}
.u-grid text,.u-chip text,.u-bars text,.u-arrow text{dominant-baseline:central;text-anchor:middle}
.u-cell{transform:translate(var(--x),var(--y));transition:transform .9s var(--u-ease) calc(var(--i) * 18ms),opacity .35s}
.u-cell-bg{fill:var(--hue);fill-opacity:var(--a);stroke:none;transition:fill-opacity .35s,stroke-width .3s}
.u-cell[data-neg]>.u-cell-bg,.u-cell-bg[data-neg]{fill-opacity:calc(var(--a) * .18);stroke:var(--hue);stroke-opacity:var(--a);stroke-width:1.2}
.u-cell[data-masked]>.u-cell-bg,.u-cell-bg[data-masked]{fill:none;stroke:var(--u-faint);stroke-width:.8;stroke-dasharray:2 2}
.u-num{font:500 10px var(--u-mono);font-variant-numeric:tabular-nums;fill:var(--u-strong)}
.u-cell[data-hot] .u-num{fill:var(--unfold-on-hot)}
.u-cell[data-masked] .u-num{fill:var(--u-lo)}
.u-name{font:italic 600 17px var(--unfold-serif);fill:var(--hue);dominant-baseline:auto!important;text-anchor:start!important}
.u-dims{font:400 10px var(--u-mono);font-style:normal;fill:var(--u-muted)}
.u-T,.u-dims-T{display:none}
.u-mark{fill:none;stroke:var(--u-strong);stroke-width:1.2;opacity:0;transition:opacity .3s}
.u-mark[data-on]{opacity:.9}
.u-chip rect{fill:var(--u-card);stroke:var(--u-mid);stroke-width:.8;transition:stroke .25s,fill .25s}
.u-chip text{font:500 11px var(--u-mono);fill:var(--u-text);transition:fill .25s}
.u-chip[data-hue] rect{stroke:var(--hue)}
.u-chip[data-hue] text{fill:var(--hue)}
.u-cell[data-later],.u-mark[data-later]{opacity:0!important;transition:opacity .3s}
.u-plot-axis{stroke:var(--u-mid);stroke-width:.9;fill:none}
.u-plot-grid{stroke:var(--u-faint);stroke-width:.6;fill:none}
.u-tick-label{font:10px var(--u-mono);fill:var(--u-muted)}
.u-plot-name{font:italic 600 15px var(--unfold-serif);fill:var(--hue,var(--u-text))}
.u-curve{fill:none;stroke:var(--hue,var(--u-hi));stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.u-chip[data-on] rect{fill:var(--u-strong);stroke:var(--u-strong)}
.u-chip[data-on] text{fill:var(--u-card)}
.u-chip[data-i]{cursor:pointer}
.u-arrow{--w:1.1;color:var(--u-mid)}
.u-arrow[data-hue]{color:var(--hue)}
.u-arrow-line{fill:none;stroke:currentColor;stroke-width:var(--w);stroke-linecap:round;transition:stroke-width .4s,opacity .4s}
.u-arrow-head{fill:currentColor}
.u-bar-fill{fill:var(--hue);transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(var(--v));transition:transform .6s var(--u-ease)}
.u-bar-value{font:500 10px var(--u-mono);fill:var(--u-strong);transition:y .6s var(--u-ease)}
.u-bar-label{font:11px var(--u-mono);fill:var(--u-muted)}
.u-axis{stroke:var(--u-mid);stroke-width:.8;fill:none}
.u-link{fill:none;stroke:var(--hue,var(--u-mid));stroke-width:1.1;stroke-linecap:round;transition:d .9s var(--u-ease),opacity .5s var(--u-ease),stroke .3s}
.u-link[data-off]{opacity:0}
.u-eq>.u-at{text-align:center}
.u-eq .u-rule{font:500 14px/1.5 var(--u-mono);color:var(--u-strong);letter-spacing:.01em}
.u-lane-bg{fill:var(--u-faint);fill-opacity:.18;stroke:var(--u-faint);stroke-width:.6}
.u-lane-name{font:11px var(--u-mono);fill:var(--hue,var(--u-muted));text-anchor:end;dominant-baseline:central}
.u-tick{stroke:var(--u-faint);stroke-width:.6}
.u-lanes .u-tick-label{text-anchor:middle;dominant-baseline:central}
.u-now{stroke:var(--u-strong);stroke-width:1.2;transition:transform .5s var(--u-ease)}
.u-span-bar{fill:var(--hue,var(--u-mid));fill-opacity:.9;transform-box:fill-box;transform-origin:0 50%;transform:scaleX(var(--v,1));transition:transform .5s var(--u-ease)}
.u-span-label{opacity:0;transition:opacity .3s}
.u-span[data-labeled] .u-span-label{opacity:1}
.u-span-label text{font:500 10px var(--u-mono);fill:var(--unfold-on-hot);dominant-baseline:central}
.u-face .u-cell-bg{stroke-width:.5}
.u-cell-bg{transform-box:fill-box;transform-origin:50% 50%}
.u-cell[data-hl]>.u-cell-bg{stroke:var(--u-strong);stroke-opacity:1;stroke-width:1.6;animation:u-ping .5s var(--u-ease)}
.u-pulse{fill:var(--hue,var(--u-strong));filter:drop-shadow(0 0 3px var(--hue,var(--u-strong)))}
.u-rise{transform-box:fill-box}
@keyframes u-pop{from{opacity:0;transform:scale(.4)}}
@keyframes u-fade{from{opacity:0}}
@keyframes u-rise{from{opacity:0;transform:translateY(-14px)}}
@keyframes u-grow{from{transform:scaleY(0)}}
@keyframes u-draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}
@keyframes u-ping{from{stroke-width:4;stroke-opacity:0}}
.u-floor-text{font-family:var(--unfold-serif);font-style:italic;font-weight:600;fill:var(--hue,var(--u-text))}
.u-floor-label{font-family:var(--u-mono);fill:var(--u-muted)}
.u-guide{fill:none;stroke:var(--u-lo);stroke-width:.8;stroke-dasharray:2 3}
.u-controls{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 18px;margin-top:10px}
.u-controls button{border:0;border-radius:999px;background:transparent;color:var(--u-muted);font:11px/1 var(--u-mono);letter-spacing:.04em;padding:6px 10px;cursor:pointer;box-shadow:0 0 0 1px var(--u-faint);transition:color .2s,box-shadow .2s}
.u-controls button:hover{color:var(--u-text)}
.u-controls button[aria-pressed="true"]{color:var(--u-strong);box-shadow:0 0 0 1px var(--u-mid)}
.u-time{display:flex;align-items:center;gap:8px;flex:1 1 260px;max-width:440px;transition:opacity .4s}
.u-time button{width:28px;height:28px;padding:0;font-size:15px}
.u-time input{flex:1;min-width:80px;accent-color:var(--u-hi)}
.u-ctl{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px 12px;transition:opacity .4s}
.u-controls [data-scenes]{transition:opacity .4s}.u-controls [data-idle]{opacity:.4}
.u-sub{font-size:72%}
.u-line rect{fill:var(--hue,var(--u-hi));fill-opacity:0;transition:fill-opacity .25s}
.u-line[data-on] rect{fill-opacity:.18}
.u-line-num{font:10px var(--u-mono);fill:var(--u-lo);text-anchor:end;dominant-baseline:central}
.u-line-text{font:11.5px var(--u-mono);fill:var(--u-text);dominant-baseline:central;white-space:pre}
.u-line[data-on] .u-line-text{fill:var(--u-strong)}
.u-controls label{display:inline-flex;align-items:center;gap:6px;color:var(--u-muted);font:11px var(--u-mono)}
.u-controls :is(input[type=number],input[type=text]){width:calc(5ch + 28px);padding:4px 6px;border:0;border-radius:6px;background:transparent;color:var(--u-text);font:12px var(--u-mono);font-variant-numeric:tabular-nums;box-shadow:0 0 0 1px var(--u-faint)}
.u-controls input[type=range]{accent-color:var(--u-hi)}
.u-controls select{max-width:100%;padding:4px 22px 4px 8px;border:0;border-radius:6px;background:var(--u-card);color:var(--u-text);font:11px var(--u-mono);box-shadow:0 0 0 1px var(--u-faint);cursor:pointer}
.iso-plate-corner[data-corner="readout"]{max-width:62%;white-space:normal;text-align:right;line-height:1.4}
.u-time output{font:11px var(--u-mono);color:var(--u-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.u-more{margin-top:48px}
.u-more>summary{cursor:pointer;color:var(--u-muted);font:500 12px var(--u-mono);letter-spacing:.04em}
.u-more>summary:hover,.u-more[open]>summary{color:var(--u-strong)}
.u-notes{color:var(--u-text);font-size:14px;line-height:1.65}
.u-notes h2{margin:36px 0 10px;font:500 13px var(--u-mono);letter-spacing:.04em;color:var(--u-strong)}
.u-notes p,.u-notes ul{margin:0 0 12px;max-width:72ch}
.u-notes li{margin-bottom:6px}
.u-notes b{color:var(--u-strong);font-weight:500}
.u-notes code{font:12.5px var(--u-mono);color:var(--u-strong)}
.u-notes table{width:100%;border-collapse:collapse;font-size:13px;line-height:1.5}
.u-notes th,.u-notes td{padding:7px 10px 7px 0;border-bottom:1px solid var(--u-faint);text-align:left;vertical-align:top}
.u-notes th{color:var(--u-muted);font:500 11.5px var(--u-mono);letter-spacing:.03em}
.u-notes svg{display:block;width:100%;max-width:640px;height:auto;margin:6px 0 14px;overflow:visible}
.u-notes td:first-child{color:var(--u-strong);white-space:nowrap}
@media (max-width:560px){.u-notes thead{display:none}.u-notes tr{display:block;padding:8px 0;border-bottom:1px solid var(--u-faint)}.u-notes td{display:block;padding:2px 0;border:0}.u-notes td[data-th]:not(:first-child)::before{content:attr(data-th) ": ";color:var(--u-muted)}}
@container (max-width:520px){:not([data-keep])>.u-cell .u-num,:not([data-keep])>.u-bar .u-bar-value{display:none}.u-eq math{font-size:14px}.u-steps button{font-size:0;gap:0;padding:4px}.u-controls{gap:8px;flex-direction:column;align-items:stretch}.u-ctl{gap:6px 8px}.u-time{flex:none;max-width:none}.u-controls label{gap:4px}}
@media (max-width:560px){.iso-plate-corner[data-corner="readout"]{left:0;max-width:none;white-space:normal;text-align:right;line-height:1.4}.iso-plate-corner[data-corner="hint"]{display:none}}
@media (prefers-reduced-motion:reduce){.u-stage *{transition:none!important;animation:none!important}.u-pulse{display:none}}
`;

// A function on named axes (curves, loss landscapes, growth rates). One scale serves the curve, the ticks and
// anything you place with at(x, y). The curve breaks where f leaves the y range. Returns { svg, at, sx, sy }.
// origin: where the axes cross, in data units (default [0, 0], clamped into the ranges). Pass [xr[0], yr[0]] to put
// the axes on the left and bottom edges, so tick labels stay off a curve that crosses x = 0.
export function plot({ id, x = 0, y = 0, w, h, xr, yr, f, samples = 160, xTicks = [], yTicks = [], xName = "", yName = "", hue = "", xHue = "", yHue = "", grid = true, origin = [0, 0], tickLabel }) {
  const sx = (v) => x + ((v - xr[0]) / (xr[1] - xr[0])) * w;
  const sy = (v) => y + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
  const at = (vx, vy) => [r1(sx(vx)), r1(sy(vy))];
  const ox = sx(Math.min(Math.max(origin[0], xr[0]), xr[1]));
  const oy = sy(Math.min(Math.max(origin[1], yr[0]), yr[1]));
  const runs = [];
  let run = [];
  for (let i = 0; i <= samples; i++) {
    const vx = xr[0] + ((xr[1] - xr[0]) * i) / samples;
    const vy = f ? f(vx) : NaN;
    if (Number.isFinite(vy) && vy >= yr[0] && vy <= yr[1]) run.push(at(vx, vy));
    else if (run.length) (runs.push(run), (run = []));
  }
  if (run.length) runs.push(run);
  const curve = runs.map((r) => `M${r.map(([a, b]) => `${a} ${b}`).join("L")}`).join("");
  // Default: as many places as the tick has (0.75 stays 0.75), up to 3. tickLabel(v, "x" | "y") returns the text, for a log axis or units.
  const places = (v) => (String(+v.toFixed(3)).split(".")[1] ?? "").length;
  const label = (v, axis) => (tickLabel ? tickLabel(v, axis) : fmt(v, places(v)));
  const lines = [];
  if (grid) lines.push(`<path class="u-plot-grid" d="${[...xTicks.map((v) => `M${r1(sx(v))} ${y}V${y + h}`), ...yTicks.map((v) => `M${x} ${r1(sy(v))}H${x + w}`)].join("")}"/>`);
  lines.push(`<path class="u-plot-axis" d="M${x} ${r1(oy)}H${x + w}M${r1(ox)} ${y}V${y + h}${xTicks.map((v) => `M${r1(sx(v))} ${r1(oy)}v4`).join("")}${yTicks.map((v) => `M${r1(ox)} ${r1(sy(v))}h-4`).join("")}"/>`);
  const ticks =
    xTicks.map((v) => `<text class="u-tick-label" x="${r1(sx(v))}" y="${r1(oy + 15)}" text-anchor="middle">${label(v, "x")}</text>`).join("") +
    yTicks.map((v) => `<text class="u-tick-label" x="${r1(ox - 7)}" y="${r1(sy(v) + 3.5)}" text-anchor="end">${label(v, "y")}</text>`).join("");
  const names =
    (xName ? `<text class="u-plot-name"${xHue ? ` data-hue="${xHue}"` : ""} x="${x + w + 6}" y="${r1(oy + 4)}">${xName}</text>` : "") +
    (yName ? `<text class="u-plot-name"${yHue ? ` data-hue="${yHue}"` : ""} x="${r1(ox)}" y="${y - 8}" text-anchor="middle">${yName}</text>` : "");
  const scale = [x, y, w, h, ...xr, ...yr].join(" ");
  const svg = `<g class="u-plot"${id ? ` id="${id}"` : ""} data-scale="${scale}">${lines.join("")}${ticks}${names}${curve ? `<path class="u-curve"${hue ? ` data-hue="${hue}"` : ""} d="${curve}"/>` : ""}</g>`;
  return { svg, at, sx, sy };
}

// MathML pieces coloured by identity. Multi-letter names render upright in MathML, so write a prime as
// prime("L") (an <msup> with a prime mark), not <mi>L′</mi>.
export const mi = (name, hue) => `<mi${hue ? ` data-hue="${hue}"` : ""}>${name}</mi>`;
export const msub = (base, s, hue) => `<msub>${mi(base, hue)}<mi>${s}</mi></msub>`;
export const prime = (name, hue) => `<msup>${mi(name, hue)}<mo>\u2032</mo></msup>`;
export const mfrac = (top, bottom) => `<mfrac><mrow>${top}</mrow><mrow>${bottom}</mrow></mfrac>`;
// An operator. Brackets and bars get stretchy="false": next to an munder, mtable or mfrac they would grow too tall.
export const mo = (op) => `<mo${/^[()[\]{}|\u2016\u27e8\u27e9]$/.test(op) ? ' stretchy="false"' : ""}>${op}</mo>`;

// A number in MathML. With `live`, the page can rewrite it with setLive({ [live]: value }), so the equation bar
// follows the focus item and the reader's input instead of keeping the preset's numbers.
export const mn = (value, { places = 1, live, hue } = {}) => `<mn${hue ? ` data-hue="${hue}"` : ""}${live ? ` data-live="${live}" data-places="${places}"` : ""}>${typeof value === "number" ? fmt(value, places) : esc(value)}</mn>`;

// A subscript inside SVG <text>: `<text>x${tsub("1")}</text>`. Unicode subscripts (x₁) look wrong in the italic serif.
// The second tspan moves the baseline back, so text after it sits on the line again.
export const tsub = (s) => `<tspan class="u-sub" dy=".35em">${esc(s)}</tspan><tspan class="u-sub" dy="-.35em">\u200b</tspan>`;

// Source code or pseudocode as numbered lines, for "the line that runs now". Light line i (0-based) with
// mark(codeEl, i, ".u-line"); -1 clears. Lines keep their leading spaces. `hue` colours the lit line.
export function codeLines(lines, { id, x = 0, y = 0, w = 320, lineH = 20, hue = "", numbers = true, className = "" } = {}) {
  const tx = numbers ? 26 : 8;
  const rows = lines
    .map(
      (text, i) =>
        `<g class="u-line" data-i="${i}" transform="translate(0 ${i * lineH})"><rect width="${w}" height="${lineH}" rx="3"/>` +
        (numbers ? `<text class="u-line-num" x="16" y="${lineH / 2}">${i + 1}</text>` : "") +
        `<text class="u-line-text" x="${tx}" y="${lineH / 2}">${esc(text)}</text></g>`,
    )
    .join("");
  return `<g class="u-code${className ? ` ${className}` : ""}"${id ? ` id="${id}"` : ""}${hue ? ` data-hue="${hue}"` : ""} transform="translate(${x} ${y})">${rows}</g>`;
}

// A colour key: one entry per identity hue, plus the fill rule. Goes under the stepper.
// signs: add "positive" / "negative" entries; they describe cellGrid cells only (filled / hollow), so pass it
// only when the figure has signed values in grids.
export const keyHtml = (items, { signs = false } = {}) =>
  `<div class="u-key">${items.map(({ hue, label }) => `<span data-hue="${hue}"><i></i>${esc(label)}</span>`).join("")}${signs ? `<span><i class="u-solid"></i>positive</span><span><i class="u-hollow"></i>negative</span>` : ""}</div>`;

// A reference section under the card: the depth a figure cannot hold (differences, edge cases, terms).
// Each section is { title, html } and may add table: { head, rows } (cells are HTML). At phone width each row becomes a block.
// Give each section a table or a small <svg viewBox> in html, and at most 3 sentences (scripts/words.mjs checks it).
// It is closed by default: the figure and its voice carry the idea, and the reader opens the notes for depth.
export const notesHtml = (sections, { summary = "Reference: what differs, what is left out, terms" } = {}) =>
  `<details class="u-more"><summary>${esc(summary)}</summary><section class="u-notes">${sections
    .map(({ title, html = "", table }) => {
      const grid = table
        ? `<table><thead><tr>${table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((r) => `<tr>${r.map((c, i) => `<td data-th="${esc(table.head[i])}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
        : "";
      return `<h2>${esc(title)}</h2>${html}${grid}`;
    })
    .join("")}</section></details>`;

// The anatomy card and page, with the unfold styles and runtime added.
// theme: "dark", "light", or "auto" (follows the reader's system setting: light for most readers of a blog or docs).
export function pageHtml({ title, theme = "dark", body, script = "", width = 900 }) {
  const auto = theme === "auto" ? `@media (prefers-color-scheme:light){html{color-scheme:light}.iso[data-theme="auto"]{${lightTokens(iso.ISO_CSS + UNFOLD_CSS)}}}` : "";
  return iso.pageHtml({ title, theme, width, body: `<style>${UNFOLD_CSS}${auto}</style>${body}`, script: runtimeScript(script) + script });
}
const lightTokens = (css) => [...css.matchAll(/(?:body|\.iso)\[data-theme="light"\]\{([^}]*)\}/g)].map((m) => m[1]).join(";");

// The same page as a claude.ai Artifact fragment: no document skeleton, and the theme follows the viewer
// (dark first; light under prefers-color-scheme or an explicit data-theme on the root).
export function artifactHtml({ title, body, script = "", width = 900 }) {
  const light = (css) =>
    css.replace(/(?:body|\.iso)\[data-theme="light"\]\{([^}]*)\}/g, (_, rules) => `@media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .iso{${rules}}}:root[data-theme="light"] .iso{${rules}}`);
  const page = `
:root{--page:#0b0b0b;color-scheme:dark}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--page:#f2f2ef;color-scheme:light}}
:root[data-theme="light"]{--page:#f2f2ef;color-scheme:light}
*{box-sizing:border-box}
body{background:var(--page);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.iso{background:var(--u-page);color:var(--u-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.iso-page{width:min(${width}px,100%);margin:0 auto;padding-block:40px 64px}`;
  const js = (runtimeScript(script) + script).replace(/<\/(script)/gi, "<\\/$1");
  return `<title>${esc(title)}</title><meta name="claude:viewport-fit-sides" content="cover"><style>${light(iso.ISO_CSS + UNFOLD_CSS)}${page}</style><div class="iso"><main class="iso-page">${body}</main></div><script type="module">${js}</script>`;
}

// node kit/concept-kit.mjs --check: cleanEnds on synthetic clips (a tone stands for speech).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes("--check")) {
  const { default: assert } = await import("node:assert/strict");
  const rate = 24000;
  const part = (sec, amp) => Array.from({ length: Math.round(sec * rate) }, (_, i) => Math.round(amp * Math.sin(i / 3)));
  const pcm = (...parts) => Buffer.from(Int16Array.from(parts.flat()).buffer);
  const samples = (b) => new Int16Array(b.buffer, b.byteOffset, b.length / 2);
  // A burst at full scale after the last word and a gap: cut 120 ms into the gap.
  const burst = samples(cleanEnds(pcm(part(0.5, 8000), part(0.3, 0), part(0.12, 32767))));
  assert.equal(burst.length, Math.round(0.62 * rate));
  assert.ok(burst.every((v) => Math.abs(v) < 30000));
  // A click before the speech: silenced.
  const click = samples(cleanEnds(pcm(part(0.005, 20000), part(0.05, 0), part(0.5, 8000))));
  assert.ok(click.slice(0, 120).every((v) => v === 0));
  // A short last word after a pause is speech, not noise: kept.
  const word = samples(cleanEnds(pcm(part(0.5, 8000), part(0.2, 0), part(0.15, 9000))));
  assert.equal(word.length, Math.round(0.85 * rate));
  console.log("cleanEnds ok");
}
