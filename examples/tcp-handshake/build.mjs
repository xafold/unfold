import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
// A networking class reads it as a handout or on a projector: the default page follows the reader's system theme.
const theme = process.argv.includes("--light") ? "light" : "auto";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LAST = m.STEPS.length - 1;
// Colour identity. A segment arrow takes the hue of its main job: open (SYN), close (FIN), carry data, or acknowledge.
const FLAG_HUE = { SYN: "yellow", FIN: "red", ACK: "green", PSH: "", RST: "", URG: "" };
const segHue = (seg) => (seg.flags.includes("SYN") ? "yellow" : seg.flags.includes("FIN") ? "red" : seg.len ? "purple" : "green");

// Every number in the sentences, the equation bar and the notes, by name. The page runs this same function
// after each input, on the result of the model's run(), and writes the values with setLive.
function liveValues(steps, data) {
  const seg = (t) => steps[t].seg;
  const v = { isnC: seg(1).seq, isnS: seg(2).seq, isnC1: seg(3).seq, ack2: seg(2).ack, ack3: seg(3).ack, seq3: seg(3).seq };
  v.d0 = seg(4).seq;
  v.d1 = (seg(4).seq + data.length - 1) % MOD;
  v.bytes = data.length === 1 ? "1 byte" : data.length + " bytes";
  v.dataq = '"' + data + '"';
  v.fin1 = seg(6).seq;
  v.fin2 = seg(8).seq;
  for (const t of [2, 3, 5, 7, 9]) {
    const a = ackSum(answers(t, steps).seg);
    for (const k of ["seq", "len", "syn", "fin", "ack"]) v["a" + t + k] = a[k];
    v["a" + t + "mod"] = a.seq + a.len + a.syn + a.fin >= MOD ? " (mod 2³²)" : "";
  }
  v.ack5 = seg(5).ack;
  v.ack7 = seg(7).ack;
  v.ack9 = seg(9).ack;
  return v;
}
// liveValues reads MOD, ackSum and answers by name, as the page does.
const { MOD, ackSum, answers } = m;
const V = liveValues(m.STEPS, m.DATA);
const L = (name) => `<span data-live="${name}" data-places="0">${esc(V[name])}</span>`;
const N = (name, hue) => u.mn(V[name], { places: 0, live: name }).replace("<mn", `<mn${hue ? ` data-hue="${hue}"` : ""}`);

// ---- Ladder (left column, 400 wide): client and server timelines, time runs down ----
const CX = 96;
const SX = 304;
const ROW = 50;
const DROP = 28;
const yTop = (t) => 64 + (t - 1) * ROW;
const H = 566;
const sideX = { client: CX, server: SX };
const eventY = (c) => (c.at === "start" ? 36 : c.at === "timer" ? yTop(LAST) + 6 : c.at === "send" ? yTop(c.t) : yTop(c.t) + DROP);

const heads = ["client", "server"].map((s) => u.chip(s, sideX[s] - 32, 4, { w: 64, h: 18, rx: 4, className: "el-head" })).join("");
const lines = ["client", "server"].map((s) => `<path class="el-life" d="M${sideX[s]} 22V${yTop(LAST) + 30}"/>`).join("");

// The label text is written by the page (drawLabel), because the reader's ISNs change its length.
const segs = m.STEPS.filter((s) => s.seg).map((s) => {
  const g = s.seg;
  const [x1, x2] = g.from === "client" ? [CX, SX] : [SX, CX];
  const y = yTop(s.t);
  return (
    `<g class="el-seg" id="seg-${s.t}" data-t="${s.t}">` +
    `<path class="el-hit" d="M${x1} ${y}L${x2} ${y + DROP}"/>` +
    u.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y + DROP], { hue: segHue(g), head: 6, width: 1.4 }) +
    `<g class="el-lab" data-cy="${y + DROP / 2}"><rect x="150" y="${y + DROP / 2 - 8}" width="100" height="16" rx="3"/><text x="200" y="${y + DROP / 2}"></text></g>` +
    `</g>`
  );
});

const chipW = (s) => s.length * 6.6 + 12;
const stateChips = m.CHANGES.map((c, k) => {
  const y = eventY(c);
  const w = chipW(c.state);
  const x = c.side === "client" ? CX - 8 - w : SX + 8;
  return `<g class="el-state" id="st-${k}" data-side="${c.side}" data-t="${c.t}"><circle class="el-dot" cx="${sideX[c.side]}" cy="${y}" r="2.6"/>${u.chip(c.state, x, y - 8, { w, h: 16, rx: 3 })}</g>`;
}).join("");

const tw = m.CHANGES.find((c) => c.state === "TIME-WAIT");
const twY = eventY(tw);
const endY = yTop(LAST) + 6;
const timer = `<g class="el-timer"><path d="M${CX - 4} ${twY + 10}V${endY - 10}" /><text x="${CX - 12}" y="${(twY + endY) / 2}">2·MSL wait</text></g>`;

const ladder = `<g class="el-ladder">${lines}${heads}${timer}${segs.join("")}${stateChips}</g>`;

// ---- Right column (400 wide): the current segment's header, each direction's sequence numbers, the receive rule ----
const FLAGS = ["URG", "ACK", "PSH", "RST", "SYN", "FIN"];
const field = (id, x, w, name, hue) =>
  `<g class="el-field" id="${id}"${hue ? ` data-hue="${hue}"` : ""}><rect x="${x}" y="22" width="${w}" height="40" rx="3"/><text class="el-fname" x="${x + w / 2}" y="33">${name}</text><text class="el-fval" x="${x + w / 2}" y="50">—</text></g>`;
const header =
  `<text class="el-label" x="0" y="10">current segment</text><text class="el-dir" id="dir" x="400" y="10">—</text>` +
  field("f-seq", 0, 88, "seq", "blue") +
  field("f-ack", 94, 88, "ack", "green") +
  FLAGS.map((f, k) => `<g class="el-flag" id="flag-${f}"${FLAG_HUE[f] ? ` data-hue="${FLAG_HUE[f]}"` : ""}><rect x="${188 + k * 24}" y="22" width="21" height="40" rx="3"/><text x="${188 + k * 24 + 10.5}" y="42">${f}</text></g>`).join("") +
  field("f-data", 336, 64, "data", "purple");

const CELL = 50;
const SLOTS = { client: m.MAX_DATA + 3, server: 3 }; // SYN, data, FIN, and one "next" cell
const strip = (from, y) => {
  const to = from === "client" ? "server" : "client";
  const body = Array.from({ length: SLOTS[from] }, (_, k) =>
    `<g class="el-cell" data-k="${k}"><rect x="${k * CELL}" y="${y + 28}" width="${CELL - 4}" height="36" rx="3"/><text class="el-cn" x="${k * CELL + 23}" y="${y + 39}"></text><text class="el-cw" x="${k * CELL + 23}" y="${y + 54}"></text></g>`,
  ).join("");
  const ptr = (id, hue, name, up) => {
    const py = up ? y + 66 : y + 26;
    const tri = up ? `M23 ${py}l-5 7h10z` : `M23 ${py}l-5 -7h10z`;
    return `<g class="el-ptr" id="${id}" data-hue="${hue}" style="transform:translateX(0px);opacity:0"><path d="${tri}"/><g class="el-ptl"><text x="33" y="${up ? py + 4 : py - 4}">${name}</text></g></g>`;
  };
  return (
    `<g class="el-strip" id="strip-${from}"><text class="el-label" x="0" y="${y}">${from} → ${to} · sequence numbers</text>${body}` +
    ptr(`snd-${from}`, "blue", `SND.NXT (${from})`, false) +
    ptr(`rcv-${from}`, "green", `RCV.NXT (${to})`, true) +
    `</g>`
  );
};
const STRIP_Y = { client: 84, server: 200 };
const legend = `<g class="el-legend"><rect class="el-sent" x="0" y="314" width="12" height="10" rx="2"/><text x="18" y="319">outline: sent</text><rect class="el-acked" x="120" y="314" width="12" height="10" rx="2"/><text x="138" y="319">filled: acknowledged</text></g>`;
// The receive rule, in the order the model's receive() checks it. Line i is steps[t].rule.
const CODE = [
  "if SYN: RCV.NXT = s.seq",
  "drop s unless s.seq = RCV.NXT",
  "RCV.NXT += len + SYN + FIN",
  "if ACK: SND.UNA = s.ack",
  "LISTEN + SYN       → SYN-RECEIVED, send SYN,ACK",
  "SYN-SENT + SYN     → ESTABLISHED, send ACK",
  "SYN-RECEIVED + ACK → ESTABLISHED",
  "ESTABLISHED + data → send ACK",
  "ESTABLISHED + FIN  → CLOSE-WAIT, send ACK",
  "FIN-WAIT-1 + ACK   → FIN-WAIT-2",
  "FIN-WAIT-2 + FIN   → TIME-WAIT, send ACK",
  "LAST-ACK + ACK     → CLOSED",
];
const CODE_Y = 352;
const code =
  `<g class="el-code"><text class="el-label" x="0" y="${CODE_Y - 12}">receive rule · for segment s</text><text class="el-dir" id="code-who" x="400" y="${CODE_Y - 12}"></text>` +
  u.codeLines(CODE, { id: "code", y: CODE_Y, w: 400, lineH: 15 }) +
  `</g>`;
const RIGHT_TOP = 36;
const right = `<g class="el-right">${header}${strip("client", STRIP_Y.client)}${strip("server", STRIP_Y.server)}${legend}${code}</g>`;
const RIGHT_H = 326; // without the code panel, which the narrow layout leaves out

const svg = iso.figureSvg({
  width: 820,
  height: H,
  label: "TCP connection between a client and a server: the three-way handshake, 1 to 5 bytes of data, and the four-segment teardown, with the sequence and ack number of every segment and the state of each side.",
  body: [ladder, right],
});

// ---- Scenes: each owns a range of steps ----
const RANGES = [[0, LAST], [0, 1], [2, 2], [3, 3], [4, 5], [6, 7], [8, LAST]];
const plus = `<mo>+</mo>`;
const ackMath = (t) =>
  `${u.mi("ack", "green")}<mo>=</mo>${N(`a${t}seq`, "blue")}${plus}${N(`a${t}len`, "purple")}${plus}${N(`a${t}syn`, "yellow")}${plus}${N(`a${t}fin`, "red")}<mo>=</mo>${N(`a${t}ack`, "green")}<mtext data-live="a${t}mod">${V[`a${t}mod`]}</mtext>`;
const hue = (h, text) => `<b data-hue="${h}">${text}</b>`;
const scenes = [
  {
    name: "Overview",
    math: `${u.mi("ack", "green")}<mo>=</mo>${u.mi("seq", "blue")}${plus}${u.mi("len", "purple")}${plus}${u.mi("SYN", "yellow")}${plus}${u.mi("FIN", "red")}`,
    voice: `Three segments open the connection and four segments close it. An ${hue("green", "ack")} names the next ${hue("blue", "sequence number")} that the receiver expects.`,
  },
  {
    name: "SYN",
    math: `${u.mi("seq", "blue")}<mo>=</mo>${u.msub("ISN", "client", "blue")}<mo>=</mo>${N("isnC", "blue")}`,
    voice: `The client picks its initial sequence number (ISN), ${L("isnC")}, and sends ${hue("yellow", "SYN")}. SYN uses one number, so the next number is ${L("isnC1")}.`,
  },
  {
    name: "SYN-ACK",
    math: ackMath(2),
    voice: `The server sends its own ${hue("yellow", "SYN")} with ISN ${L("isnS")}. Its ${hue("green", `ack ${L("ack2")}`)} names the next number it expects from the client.`,
  },
  {
    name: "ACK",
    math: ackMath(3),
    voice: `The client acknowledges the server's SYN with ${hue("green", `ack ${L("ack3")}`)}. A pure ACK carries seq ${L("seq3")} but uses no number, so the data also starts at ${L("seq3")}.`,
  },
  {
    name: "Data",
    math: ackMath(5),
    voice: `The client sends ${hue("purple", L("bytes"))}, numbers ${L("d0")} to ${L("d1")}. Each byte uses one number, so the server acknowledges ${L("ack5")}.`,
  },
  {
    name: "Client FIN",
    math: ackMath(7),
    voice: `The client sends ${hue("red", "FIN")}, which also uses one number. The server acknowledges ${L("ack7")} and can still send data in CLOSE-WAIT.`,
  },
  {
    name: "Server FIN",
    math: ackMath(9),
    voice: `The server sends its own ${hue("red", "FIN")}, and the client acknowledges ${L("ack9")}. The client waits 2·MSL in TIME-WAIT, so it can resend a lost last ACK.`,
  },
];

const css = [
  `.el-right{transform:translate(420px,${RIGHT_TOP}px)}`,
  `.u-stage[data-narrow] .el-right{transform:translate(0,${yTop(LAST) + 46}px)}`,
  `.u-stage[data-narrow] .el-code{display:none}`,
  `.el-life{stroke:var(--anatomy-mid);stroke-width:1}`,
  `.el-head rect{fill:var(--anatomy-card);stroke:var(--anatomy-strong)}`,
  `.el-head text{fill:var(--anatomy-strong);font-size:11.5px}`,
  `.el-seg{cursor:pointer;opacity:0;transition:opacity .35s var(--anatomy-ease)}`,
  `.el-seg[data-show]{opacity:.42}`,
  `.el-seg[data-now],.u-stage[data-scene="0"] .el-seg[data-show]{opacity:1}`,
  `.el-hit{stroke:transparent;stroke-width:16}`,
  `.el-seg[data-now] .u-arrow-line{animation:u-draw .6s var(--anatomy-ease) backwards}`,
  `.el-seg[data-now] .u-arrow-head{animation:u-fade .25s .5s backwards}`,
  `.el-seg[data-now] .el-lab{animation:u-fade .4s .3s backwards}`,
  `.el-lab rect{fill:var(--anatomy-card);stroke:var(--anatomy-faint);stroke-width:.6}`,
  `.el-lab text{font:500 10px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central;white-space:pre}`,
  `.el-ladder tspan[data-hue],.el-right [data-hue]>text.el-fval{fill:var(--hue)}`,
  `.el-state{opacity:0;transition:opacity .35s var(--anatomy-ease)}`,
  `.el-state[data-show]{opacity:.5}`,
  `.el-state[data-on]{opacity:1}`,
  `.el-state .u-chip text{font-size:10.5px}`,
  `.el-state[data-on] .u-chip rect{fill:var(--anatomy-strong);stroke:var(--anatomy-strong)}`,
  `.el-state[data-on] .u-chip text{fill:var(--anatomy-card)}`,
  `.el-dot{fill:var(--anatomy-strong)}`,
  `.el-timer{opacity:0;transition:opacity .35s}`,
  `.el-timer[data-show]{opacity:1}`,
  `.el-timer path{stroke:var(--anatomy-hi);stroke-width:1.4;stroke-dasharray:3 3;fill:none}`,
  `.el-timer text{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central;text-anchor:end}`,
  `.el-label{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.06em}`,
  `.el-dir{font:10.5px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:end}`,
  `.el-field rect,.el-flag rect{fill:none;stroke:var(--anatomy-faint);stroke-width:.8}`,
  `.el-field[data-hue] rect{stroke:var(--hue);stroke-opacity:.6}`,
  `.el-fname{font:10px var(--anatomy-mono);fill:var(--hue,var(--anatomy-muted));text-anchor:middle;dominant-baseline:central}`,
  `.el-fval{font:500 12px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}`,
  `.el-flag text{font:9px var(--anatomy-mono);fill:var(--anatomy-lo);text-anchor:middle;dominant-baseline:central}`,
  `.el-flag rect{transition:fill .3s,stroke .3s}`,
  `.el-flag[data-on] rect{fill:var(--hue,var(--anatomy-hi));fill-opacity:.22;stroke:var(--hue,var(--anatomy-hi))}`,
  `.el-flag[data-on] text{fill:var(--hue,var(--anatomy-strong));font-weight:600}`,
  `.el-cell{cursor:pointer}`,
  `.el-cell[data-off]{display:none}`,
  `.el-cell rect{fill:var(--hue,none);fill-opacity:0;stroke:var(--anatomy-faint);stroke-width:.8;stroke-dasharray:2 2;transition:fill-opacity .4s,stroke .4s}`,
  `.el-cell[data-sent] rect{stroke:var(--hue);stroke-dasharray:none;stroke-width:1.2}`,
  `.el-cell[data-acked] rect{fill-opacity:.38}`,
  `.el-cn{font:9.5px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-cw{font:500 12px var(--anatomy-mono);fill:var(--anatomy-lo);text-anchor:middle;dominant-baseline:central;white-space:pre;transition:fill .4s}`,
  `.el-cell[data-sent] .el-cw{fill:var(--hue)}`,
  `.el-cell[data-acked] .el-cw{fill:var(--anatomy-strong)}`,
  `.el-cell[data-acked] .el-cn{fill:var(--anatomy-text)}`,
  `.el-ptr{transition:transform .5s var(--anatomy-ease),opacity .3s}`,
  `.el-ptr path{fill:var(--hue)}`,
  `.el-ptr text{font:500 10px var(--anatomy-mono);fill:var(--hue);dominant-baseline:central}`,
  `.el-ptr[data-flip] text{text-anchor:end}`,
  `.el-ptr[data-flip] .el-ptl{transform:translateX(-20px)}`,
  `.el-legend text{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.el-code .u-line-text{font-size:11px}`,
  `.u-notes b[data-hue]{color:var(--hue)}`,
  `.el-sent{fill:none;stroke:var(--anatomy-hi);stroke-width:1.2}`,
  `.el-acked{fill:var(--anatomy-hi);fill-opacity:.38;stroke:var(--anatomy-hi);stroke-width:1.2}`,
  `.u-controls input.el-isn{width:calc(10ch + 28px)}`,
  `.u-controls input.el-data{width:calc(5ch + 28px)}`,
  `.el-in-isn{color:var(--hue)}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "seq · SND.NXT" },
  { hue: "green", label: "ack · RCV.NXT" },
  { hue: "yellow", label: "SYN (opens)" },
  { hue: "red", label: "FIN (closes)" },
  { hue: "purple", label: "data bytes" },
]);

// The reader's own ISNs and payload. Presets: the hand-picked numbers, Linux's ISNs from the capture, and ISNs
// close to 2^32, so the numbers wrap to 0.
const PRESETS = {
  hand: { client: m.ISN.client, server: m.ISN.server, data: m.DATA },
  linux: { ...m.CAPTURE_ISN, data: m.DATA },
  wrap: { client: m.MOD - 3, server: m.MOD - 1, data: m.DATA },
};
const isnField = (side) =>
  `<label>${side} ISN <input type="number" class="el-isn" data-side="${side}" min="0" max="${m.MOD - 1}" step="1" value="${m.ISN[side]}" aria-label="${side} initial sequence number"></label>`;
const controls =
  isnField("client") +
  isnField("server") +
  `<label>data <input type="text" class="el-data" maxlength="${m.MAX_DATA}" value="${m.DATA}" aria-label="payload, 1 to ${m.MAX_DATA} ASCII characters"></label>` +
  `<button type="button" data-preset="hand">1000 / 5000</button><button type="button" data-preset="linux">Linux ISNs</button><button type="button" data-preset="wrap">near 2³²</button>`;

const stage = u.stageHtml({ audio: await u.narrate(scenes, { dir: join(HERE, "voice") }),
  dwell: 8000,
  scenes,
  svg,
  label: "TCP handshake and teardown explainer. Left and right arrows change the scene. Up and down arrows step through the segments. The fields set each side's ISN and the data the client sends.",
  css,
  key,
  controls,
  time: { steps: LAST + 1 },
  narrow: [400, yTop(LAST) + 46 + RIGHT_H],
});

// Which state chip is lit per step. The states do not depend on the ISNs or the payload (model.mjs asserts it).
const ON = Object.fromEntries(
  ["client", "server"].map((side) => [side, m.STEPS.map((_, t) => m.CHANGES.reduce((on, c, k) => (c.side === side && c.t <= t ? k : on), -1))]),
);
const live = `
${u.modelScript([m.uses, m.run, m.space, m.ackSum, m.answers], { MOD: m.MOD, MAX_DATA: m.MAX_DATA, PRESETS })}
${liveValues}
const ON = ${JSON.stringify(ON)};
const RANGES = ${JSON.stringify(RANGES)};
const FLAG_HUE = ${JSON.stringify(FLAG_HUE)};
const LAST = ${LAST};
const CELL = ${CELL};
const root = UNFOLD.stage;
const out = document.querySelector("[data-readout]");
const $ = (q) => root.querySelector(q);
const off = (n, base) => (n - base + MOD) % MOD;
let input = { ...PRESETS.hand };
let R = run(input, input.data);
let step = LAST;
let crossing = false;

function readout(s) {
  if (!s.seg) return s.t === 0 ? "step 0 · client CLOSED · server LISTEN" : "step " + s.t + " · 2·MSL timer ends · client CLOSED";
  const head = "step " + s.t + " · " + s.seg.from + " " + s.seg.flags.join(",");
  if (s.seg.ack === null) return head + " · seq = ISN = " + s.seg.seq + " · no ack yet";
  const src = answers(s.t, R.steps);
  const a = ackSum(src.seg);
  const wrap = a.seq + a.len + a.syn + a.fin >= MOD ? " mod 2³²" : "";
  return head + " · ack = " + a.seq + " + " + a.len + " + " + a.syn + " + " + a.fin + " = " + a.ack + wrap + " (step " + src.t + ")";
}
// One line while it fits between the lifelines, else flags and seq on top, ack and len below.
function drawLabel(g, seg) {
  const flags = seg.flags.map((f, k) => (k ? "," : "") + '<tspan data-hue="' + FLAG_HUE[f] + '">' + f + "</tspan>").join("");
  const seq = '<tspan data-hue="blue"> seq=' + seg.seq + "</tspan>";
  const rest = (seg.ack !== null ? '<tspan data-hue="green">ack=' + seg.ack + "</tspan>" : "") + (seg.len ? '<tspan data-hue="purple"> len=' + seg.len + "</tspan>" : "");
  const top = seg.flags.join(",").length + 5 + String(seg.seq).length;
  const low = (seg.ack !== null ? 4 + String(seg.ack).length : 0) + (seg.len ? 5 + String(seg.len).length : 0);
  const one = (top + (low ? low + 1 : 0)) * 6.02 + 10 <= 200;
  const lab = g.querySelector(".el-lab");
  const cy = Number(lab.dataset.cy);
  const text = lab.querySelector("text");
  const rect = lab.querySelector("rect");
  const w = (one ? top + (low ? low + 1 : 0) : Math.max(top, low)) * 6.02 + 10;
  text.innerHTML = one || !low ? flags + seq + (low ? " " + rest : "") : '<tspan x="200" dy="-6">' + flags + seq + '</tspan><tspan x="200" dy="12">' + rest + "</tspan>";
  text.setAttribute("y", String(cy));
  const h = one || !low ? 16 : 28;
  rect.setAttribute("x", String(200 - w / 2));
  rect.setAttribute("width", String(w));
  rect.setAttribute("y", String(cy - h / 2));
  rect.setAttribute("height", String(h));
}
// After a new input: every number in the ladder, the strips, the sentences, the equation and the notes.
function redraw() {
  R = run(input, input.data);
  R.steps.forEach((s) => s.seg && drawLabel($("#seg-" + s.t), s.seg));
  const segments = R.steps.filter((s) => s.seg).map((s) => s.seg);
  for (const from of ["client", "server"]) {
    const cells = space(from, segments);
    const sentAt = R.steps.filter((s) => s.seg && s.seg.from === from && (s.seg.len || s.seg.flags.includes("SYN") || s.seg.flags.includes("FIN")));
    const owner = [];
    sentAt.forEach((s) => owner.push(...Array(s.seg.len + (s.seg.flags.includes("SYN") ? 1 : 0) + (s.seg.flags.includes("FIN") ? 1 : 0)).fill(s.t)));
    const all = [...cells, { n: (cells.at(-1).n + 1) % MOD, what: "" }];
    root.querySelectorAll("#strip-" + from + " .el-cell").forEach((c, k) => {
      const cell = all[k];
      c.toggleAttribute("data-off", !cell);
      if (!cell) return;
      const what = cell.what;
      if (what) c.dataset.hue = what === "SYN" ? "yellow" : what === "FIN" ? "red" : "purple";
      else c.removeAttribute("data-hue");
      c.toggleAttribute("data-ghost", !what);
      c.dataset.n = String(cell.n);
      c.dataset.t = String(owner[k] ?? "");
      const cn = c.querySelector(".el-cn");
      cn.textContent = String(cell.n);
      cn.style.fontSize = Math.min(9.5, 44 / (String(cell.n).length * 0.6)).toFixed(2) + "px";
      c.querySelector(".el-cw").textContent = what;
    });
  }
  setLive(liveValues(R.steps, input.data));
  show(step);
}
function show(t) {
  step = Math.max(0, Math.min(LAST, t));
  const s = R.steps[step];
  root.querySelectorAll(".el-seg").forEach((g) => {
    const k = Number(g.dataset.t);
    g.toggleAttribute("data-show", k <= step);
    if (k !== step) g.removeAttribute("data-now");
    else if (!g.hasAttribute("data-now")) g.setAttribute("data-now", "");
  });
  root.querySelectorAll(".el-state").forEach((g) => {
    const k = Number(g.id.slice(3));
    g.toggleAttribute("data-show", Number(g.dataset.t) <= step);
    g.toggleAttribute("data-on", ON[g.dataset.side][step] === k);
  });
  $(".el-timer").toggleAttribute("data-show", step === LAST);
  for (const from of ["client", "server"]) {
    const to = from === "client" ? "server" : "client";
    const v = s[from];
    const base = input[from];
    root.querySelectorAll("#strip-" + from + " .el-cell").forEach((c) => {
      const k = off(Number(c.dataset.n), base);
      const real = !c.hasAttribute("data-ghost");
      c.toggleAttribute("data-sent", real && v.sndNxt !== null && k < off(v.sndNxt, base));
      c.toggleAttribute("data-acked", real && v.sndUna !== null && k < off(v.sndUna, base));
    });
    const place = (el, n) => {
      el.style.opacity = n === null ? 0 : 1;
      if (n === null) return;
      const k = off(n, base);
      el.style.transform = "translateX(" + k * CELL + "px)";
      el.toggleAttribute("data-flip", k >= 4);
    };
    place($("#snd-" + from), v.sndNxt);
    place($("#rcv-" + from), s[to].rcvNxt);
  }
  const g = s.seg;
  $("#dir").textContent = g ? g.from + " → " + (g.from === "client" ? "server" : "client") : "no segment";
  $("#f-seq .el-fval").textContent = g ? g.seq : "—";
  $("#f-ack .el-fval").textContent = g && g.ack !== null ? g.ack : "—";
  $("#f-data .el-fval").textContent = g && g.data ? '"' + g.data + '"' : "—";
  root.querySelectorAll(".el-flag").forEach((f) => f.toggleAttribute("data-on", !!g && g.flags.includes(f.id.slice(5))));
  const code = $("#code");
  mark(code, s.rule, ".u-line");
  if (g) code.dataset.hue = g.flags.includes("SYN") ? "yellow" : g.flags.includes("FIN") ? "red" : g.len ? "purple" : "green";
  $("#code-who").textContent = g ? (g.from === "client" ? "server" : "client") + " runs line " + (s.rule + 1) : "";
  UNFOLD.timeAt(step);
  const text = readout(s);
  if (out.textContent !== text) out.textContent = text;
}
// Stepping by hand can cross into another scene; the scene follows the step.
function stepTo(t) {
  show(t);
  const sc = UNFOLD.scene();
  const [a, b] = RANGES[sc];
  if (sc > 0 && (step < a || step > b)) {
    crossing = true;
    UNFOLD.go(RANGES.findIndex((r, i) => i > 0 && step >= r[0] && step <= r[1]));
    crossing = false;
  }
  UNFOLD.pause();
}
root.addEventListener("unfold:scene", (e) => {
  if (!crossing) show(e.detail.scene === 0 ? LAST : RANGES[e.detail.scene][0]);
});
RANGES.forEach(([a, b], sc) => sc > 0 && a < b && UNFOLD.beat(sc, 1300, (n) => show(n < 0 ? b : Math.min(a + n, b)), 1300, b - a + 1));
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  stepTo(to);
});
root.addEventListener("click", (e) => {
  const hit = e.target.closest(".el-seg, .el-cell[data-t]:not([data-t=''])");
  if (hit) stepTo(Number(hit.dataset.t));
});

// Inputs: any 32-bit ISN, 1 to MAX_DATA printable ASCII bytes. A bad value is skipped until it is fixed.
const isnIn = [...root.querySelectorAll(".el-isn")];
const dataIn = $(".el-data");
const ascii = (s) => [...s].filter((ch) => ch >= " " && ch <= "~").join("").slice(0, MAX_DATA);
function readInputs() {
  const next = { ...input };
  for (const el of isnIn) {
    const v = Number(el.value);
    if (el.value.trim() === "" || !Number.isInteger(v) || v < 0 || v >= MOD) return null;
    next[el.dataset.side] = v;
  }
  next.data = ascii(dataIn.value);
  return next.data ? next : null;
}
function writeInputs() {
  isnIn.forEach((el) => (el.value = String(input[el.dataset.side])));
  dataIn.value = input.data;
}
root.querySelector(".u-ctl").addEventListener("input", () => {
  UNFOLD.pause();
  const next = readInputs();
  if (!next) return;
  input = next;
  redraw();
});
root.querySelector(".u-ctl").addEventListener("change", writeInputs);
root.querySelectorAll("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => {
    UNFOLD.pause();
    input = { ...PRESETS[b.dataset.preset] };
    writeInputs();
    redraw();
  }),
);
redraw();
`;

// ---- Reference section under the card ----
const cap = m.CAPTURE;
const model = m.run(m.CAPTURE_ISN, m.DATA).steps.filter((s) => s.seg).map((s) => s.seg);
const pair = (seq, ack) => `${seq} / ${ack ?? "—"}`;
const notes = u.notesHtml([
  {
    title: "What uses a sequence number",
    html: `<p>An ack is one more than the last number it covers. That is why the ack after a SYN or a FIN is seq + 1.</p>`,
    table: {
      head: ["part of a segment", "numbers it uses", "in this figure"],
      rows: [
        [`<b data-hue="yellow">SYN</b>`, "1", `${L("isnC")} and ${L("isnS")}`],
        [`<b data-hue="purple">data byte</b>`, "1 each", `${L("d0")} to ${L("d1")} (${L("dataq")})`],
        [`<b data-hue="red">FIN</b>`, "1", `${L("fin1")} and ${L("fin2")}`],
        [`<b data-hue="green">pure ACK</b>`, "0", "segments 3, 5, 7 and 9"],
      ],
    },
  },
  {
    title: "Checked against Linux",
    html:
      `<p>On ${cap.date} we ran the same exchange on ${esc(cap.kernel)} loopback, in a private network namespace, and read each segment with a raw socket. ` +
      `With the two random ISNs that Linux picked, the simulator gives the same 9 segments. The “Linux ISNs” button shows that run in the figure.</p>`,
    table: {
      head: ["#", "segment", "Linux seq / ack", "simulator seq / ack"],
      rows: cap.segments.map((r, i) => [String(i + 1), `${r.from} ${r.flags.join(",")}${r.len ? ` len=${r.len}` : ""}`, pair(r.seq, r.ack), pair(model[i].seq, model[i].ack)]),
    },
  },
  {
    title: "States in this figure",
    table: {
      head: ["state", "side", "meaning"],
      rows: [
        ["LISTEN", "server", "waits for a SYN"],
        ["SYN-SENT", "client", "sent SYN, waits for SYN-ACK"],
        ["SYN-RECEIVED", "server", "got SYN, sent SYN-ACK, waits for ACK"],
        ["ESTABLISHED", "both", "open: data can flow both ways"],
        ["FIN-WAIT-1", "client", "sent FIN, waits for its ACK"],
        ["FIN-WAIT-2", "client", "FIN acknowledged, waits for the server's FIN"],
        ["CLOSE-WAIT", "server", "got FIN, can still send until it closes"],
        ["LAST-ACK", "server", "sent FIN, waits for the last ACK"],
        ["TIME-WAIT", "client", "waits 2·MSL in case the last ACK is lost"],
        ["CLOSED", "both", "no connection"],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["segment", "one TCP packet: header plus optional data"],
        ["ISN", "initial sequence number, picked by each side at SYN"],
        [`<b data-hue="blue">seq</b>`, "number of the first byte (or SYN, FIN) in a segment"],
        [`<b data-hue="green">ack</b>`, "next number the sender of the ack expects"],
        [`<b data-hue="blue">SND.NXT</b>`, "next sequence number this side will send"],
        ["SND.UNA", "oldest number this side sent that is not acknowledged"],
        [`<b data-hue="green">RCV.NXT</b>`, "next sequence number this side expects to receive"],
        ["MSL", "maximum segment lifetime: how long a segment can live"],
        ["half-close", "one direction closed, the other still open"],
      ],
    },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["topic", "what really happens"],
      rows: [
        ["random ISN", "Linux hashes the addresses with a secret and adds a clock (RFC 6528)."],
        ["relative numbers", "Wireshark shows seq − ISN by default, so each SYN shows as 0."],
        ["wraparound", "Sequence numbers are 32-bit and wrap modulo 2³². The “near 2³²” button shows it."],
        ["three-segment close", "A server that closes at once sends one FIN,ACK that also acknowledges the client's FIN."],
        ["delayed ACK", "A receiver may wait 40 to 200 ms (Linux) to combine ACKs."],
        ["window and options", "Every segment also carries a window size. SYNs carry MSS, window scale, SACK and timestamps."],
        ["loss and RST", "Lost segments are sent again after a timeout. RST aborts a connection without FIN."],
        ["TIME-WAIT length", "Linux waits a fixed 60 s, not a measured 2·MSL."],
        ["more data", "The figure draws at most 5 bytes. Real segments carry up to one MSS, often 1460 bytes."],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "TCP open and close",
    hint: "← → scene · ↑ ↓ step",
    readout: "",
    caption:
      `One TCP connection: a three-way handshake, 1 to ${m.MAX_DATA} bytes from the client, then a close that the client starts. ` +
      `Type any 32-bit ISN or payload, and every number follows TCP's rules. ` +
      `With Linux's ISNs, the figure matches all 9 segments of a real loopback capture.`,
    body: stage,
  }) + notes;

// --artifact <file>: one page for a claude.ai Artifact, which follows the viewer's theme.
const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "tcp-handshake-light.html" : "tcp-handshake.html");
const title = "TCP handshake and teardown";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
