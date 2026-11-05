import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const W = 820;
const H = 352;
const LAST = m.STEPS.length - 1;

// Colour identity: who the work belongs to. Plain calls (console.log, setTimeout, .then) have no hue.
const HUE = { script: "ink", task: "gold", micro: "blue", call: "" };
const SHORT = { script: "script", cbB: "cb B", cbC: "cb C" };

// ---- Places: boxes with a label, laid out once ----
const BOX = {
  code: { x: 0, y: 18, w: 350, h: 96, label: "script.js" },
  stack: { x: 370, y: 18, w: 140, h: 164, label: "call stack" },
  webapi: { x: 530, y: 18, w: 290, h: 44, label: "Web APIs" },
  tasks: { x: 530, y: 96, w: 290, h: 26, label: "task queue" },
  micro: { x: 530, y: 156, w: 290, h: 26, label: "microtask queue" },
  console: { x: 0, y: 136, w: 350, h: 46, label: "console" },
};
const box = (name) => {
  const b = BOX[name];
  return `<g class="el-box" id="box-${name}"><rect class="el-place" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5"/><text class="el-label" x="${b.x}" y="${b.y - 6}">${b.label}</text></g>`;
};

// Where an item stands in each place, by its index there.
const SLOT = {
  stack: (k) => [380, 160 - k * 22],
  webapi: (k) => [538 + k * 126, 31],
  tasks: (k) => [536 + k * 126, 100],
  micro: (k) => [536 + k * 126, 160],
  out: (k) => [10 + k * 32, 150],
};
const PLACE = Object.fromEntries(Object.keys(m.ITEMS).map((id) => [id, m.STEPS.map(() => null)]));
m.STEPS.forEach((s, t) => {
  for (const [place, ids] of Object.entries({ stack: s.stack, webapi: s.webapi, tasks: s.tasks, micro: s.micro, out: s.out }))
    ids.forEach((id, k) => (PLACE[id][t] = SLOT[place](k)));
});

const items = Object.values(m.ITEMS)
  .map((it) => {
    const output = it.id.startsWith("out");
    const at = PLACE[it.id][LAST] ?? PLACE[it.id].find(Boolean);
    const shown = PLACE[it.id][LAST] ? 1 : 0;
    const look = u.chip(it.label, 0, 0, { w: output ? 26 : 120, h: 18, rx: 4, hue: HUE[it.kind] });
    return `<g class="el-item" id="it-${it.id}" style="transform:translate(${at[0]}px,${at[1]}px);opacity:${shown}">${look}</g>`;
  })
  .join("");

const code = m.PROGRAM.map(
  (p, i) => `<text class="el-num" x="10" y="${BOX.code.y + 14 + i * 22}">${p.line}</text><text class="el-code" x="28" y="${BOX.code.y + 14 + i * 22}">${p.code.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`,
).join("");
const cursor = `<g class="el-cursor" id="cursor" style="opacity:0"><rect x="4" y="${BOX.code.y + 4}" width="342" height="20" rx="3"/></g>`;

// ---- Timeline: one lane per place, time in steps ----
const L = { id: "timeline", names: ["call stack", "Web APIs", "task queue", "microtasks"], x: 0, y: 228, w: W, laneH: 24, labelW: 120, from: 0, to: m.STEPS.length, ticks: 1 };
const LANE = { stack: 0, webapi: 1, tasks: 2, micro: 3 };
const spans = m.spans().map((s) => u.span(L, { lane: LANE[s.lane], from: s.from, to: s.to, text: SHORT[s.id] ?? "", hue: HUE[m.ITEMS[s.id].kind] }));

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "The JavaScript event loop running four lines: the code, the call stack, the Web APIs timer, the task and microtask queues, the console, and a timeline of where each callback waits.",
  body: [
    ...Object.keys(BOX).map(box),
    u.arrow([770, 62], [770, 96], { hue: "gold" }),
    u.arrow([530, 109], [512, 109], { hue: "gold" }),
    u.arrow([530, 169], [512, 169], { hue: "blue" }),
    cursor,
    code,
    items,
    u.lanes(L),
    spans.join(""),
  ],
});

// ---- Scenes are chapters; each owns a range of trace steps ----
const range = (phase) => [m.STEPS.findIndex((s) => s.phase === phase), m.STEPS.findLastIndex((s) => s.phase === phase)];
const RANGES = [[0, LAST], [1, 2], [3, 6], range("drain"), range("task")];
const hue = (h, text) => `<span data-hue="${h}">${text}</span>`;
const scenes = [
  {
    name: "Overview",
    rule: `run one ${hue("gold", "task")} → run every ${hue("blue", "microtask")} → repeat`,
    voice: `Four lines print <b>A D C B</b>, not A B C D. Each callback waits in a queue until the event loop runs it.`,
  },
  {
    name: "Run script",
    rule: `the ${hue("ink", "script")} is the first task`,
    voice: `The loop takes the first task, the whole <b data-hue="ink">script</b>, and runs it on the call stack. Line 1 runs at once and prints A.`,
  },
  {
    name: "Queue callbacks",
    rule: `${hue("gold", "setTimeout")} → timer → task queue · ${hue("blue", ".then")} → microtask queue`,
    voice: `setTimeout sends its callback to the <b data-hue="gold">task queue</b> through a timer, and .then sends its callback to the <b data-hue="blue">microtask queue</b>. Neither runs while the script is on the stack.`,
  },
  {
    name: "Drain microtasks",
    rule: `stack empty → run every ${hue("blue", "microtask")}`,
    voice: `When the script ends, the loop runs every <b data-hue="blue">microtask</b> before it takes another task. That is why C prints before B.`,
  },
  {
    name: "Next task",
    rule: `no microtasks left → take the next ${hue("gold", "task")}`,
    voice: `Only now does the loop take the next task, the <b data-hue="gold">timer callback</b>, and B prints. A 0 ms timer still waits for the script and for every microtask.`,
  },
];

const emphasis = { 1: ["code", "stack"], 2: ["webapi", "tasks", "micro"], 3: ["micro", "stack"], 4: ["tasks", "stack"] };
const css = [
  `.el-place{fill:var(--anatomy-faint);fill-opacity:.12;stroke:var(--anatomy-lo);stroke-width:.8;transition:stroke .4s}`,
  ...Object.entries(emphasis).map(([s, names]) => `.u-stage[data-scene="${s}"] :is(${names.map((n) => `#box-${n}`).join(",")}) .el-place{stroke:var(--anatomy-strong)}`),
  ...Object.entries(emphasis).map(([s, names]) => `.u-stage[data-scene="${s}"] :is(${names.map((n) => `#box-${n}`).join(",")}) .el-label{fill:var(--anatomy-strong)}`),
  `.el-label{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.06em;text-transform:uppercase;transition:fill .4s}`,
  `.el-num{font:11px var(--anatomy-mono);fill:var(--anatomy-lo);dominant-baseline:central}`,
  `.el-code{font:11px var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central;white-space:pre}`,
  `.el-item{transition:transform .65s var(--anatomy-ease),opacity .4s var(--anatomy-ease)}`,
  `.el-item .u-chip rect{fill:color-mix(in srgb,var(--hue,var(--anatomy-mid)) 16%,var(--anatomy-card))}`,
  `.el-item .u-chip text{fill:var(--anatomy-strong);font-size:10.5px}`,
  `.el-cursor{transition:transform .5s var(--anatomy-ease),opacity .3s}`,
  `.el-cursor rect{fill:var(--hue,var(--anatomy-hi));fill-opacity:.16;stroke:var(--hue,var(--anatomy-hi));stroke-width:1;transition:fill .3s,stroke .3s}`,
  `#timeline{cursor:pointer}`,
].join("\n");

const key = u.keyHtml(
  [
    { hue: "ink", label: "the script (first task)" },
    { hue: "gold", label: "timer callback (task)" },
    { hue: "blue", label: "promise callback (microtask)" },
  ],
  { signs: false },
);

const stage = u.stageHtml({ audio: await u.narrate(scenes, { dir: join(HERE, "voice") }), dwell: 8000, scenes, svg, label: "Event loop explainer. Left and right arrows change the chapter. Up and down arrows step through time.", css, key, time: { steps: LAST + 1 } });

// Item positions per step, the cursor line and hue per step, and the readout text, all from the trace.
const STEPDATA = m.STEPS.map((s) => ({ line: s.line, hue: s.stack.length ? HUE[m.ITEMS[s.stack[0]].kind] : "", say: s.say }));
const live = `
const PLACE = ${JSON.stringify(PLACE)};
const STEPS = ${JSON.stringify(STEPDATA)};
const RANGES = ${JSON.stringify(RANGES)};
const LAST = ${LAST};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const cursor = root.querySelector("#cursor");
const timeline = root.querySelector("#timeline");
let step = LAST;
let crossing = false;
function show(t) {
  step = Math.max(0, Math.min(LAST, t));
  for (const [id, at] of Object.entries(PLACE)) {
    const el = root.querySelector("#it-" + id);
    const here = at[step];
    if (here) el.style.transform = "translate(" + here[0] + "px," + here[1] + "px)";
    el.style.opacity = here ? 1 : 0;
  }
  const s = STEPS[step];
  cursor.style.opacity = s.line ? 1 : 0;
  if (s.line) cursor.style.transform = "translateY(" + (s.line - 1) * 22 + "px)";
  if (s.hue) cursor.setAttribute("data-hue", s.hue); else cursor.removeAttribute("data-hue");
  showSpans(root, step + 1);
  UNFOLD.timeAt(step);
  const text = "step " + step + " \\u00b7 " + s.say;
  if (readout.textContent !== text) readout.textContent = text;
}
// Stepping by hand can cross into the next chapter; the chapter follows the step.
function stepTo(t) {
  show(t);
  const s = UNFOLD.scene();
  const [a, b] = RANGES[s];
  if (s > 0 && (step < a || step > b)) {
    crossing = true;
    UNFOLD.go(RANGES.findIndex((r, i) => i > 0 && step >= r[0] && step <= r[1]));
    crossing = false;
  }
  UNFOLD.pause();
}
root.addEventListener("unfold:scene", (e) => {
  if (!crossing) show(e.detail.scene === 0 ? LAST : RANGES[e.detail.scene][0]);
});
RANGES.forEach(([a, b], s) => UNFOLD.beat(s, s === 0 ? 550 : 1300, (n) => show(n < 0 ? b : a + n), s === 0 ? 900 : 700, b - a + 1));
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  stepTo(to);
});
timeline.addEventListener("click", (e) => {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(timeline.ownerSVGElement.getScreenCTM().inverse());
  stepTo(Math.floor((p.x - Number(timeline.dataset.x0)) / Number(timeline.dataset.px)));
});
show(LAST);
`;

const body = iso.plateHtml({
  fig: "Fig 3",
  title: "The event loop",
  hint: "← → chapter · ↑ ↓ step",
  readout: "step " + LAST + " · " + m.STEPS[LAST].say,
  caption:
    "A browser-style event loop on four lines of JavaScript. Every frame, queue entry and timeline bar comes from a small simulator of the loop. The time axis counts steps of the simulation, not milliseconds. Rendering between tasks is left out.",
  body: stage,
});

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "event-loop-light.html" : "event-loop.html");
const html = artifact > 0 ? u.artifactHtml({ title: "The event loop", body, script: live }) : u.pageHtml({ title: "The event loop", theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
