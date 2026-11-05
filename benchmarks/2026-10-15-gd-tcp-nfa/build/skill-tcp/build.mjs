import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const UNFOLD_DIR = process.env.UNFOLD_DIR ?? join(homedir(), ".claude", "skills", "unfold");
const u = await import(pathToFileURL(join(UNFOLD_DIR, "kit", "concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const { segments: SEGS, changes: CHANGES, steps: STEPS } = m.BOOK;
const LAST = STEPS.length - 1; // step 10: TIME-WAIT has ended

// Colour identity: which byte stream a number counts. Client seq and server ack are both "client bytes".
const STREAM = { client: "blue", server: "gold" };
const FLAG_HUE = { SYN: "green", FIN: "red" };

// ---- Geometry. The ladder is drawn with the client line at x 0 and the server line at x GAP. ----
const W = 820;
const H = 400;
const GAP = 320;
const DROP = 24; // how far a segment falls while it travels
const ys = (n) => 56 + (n - 1) * 36; // y where segment n leaves its sender
const yOf = (c) => (c.at === "start" ? 40 : c.at === "send" ? ys(c.step) : c.at === "recv" ? ys(c.step) + DROP : ys(LAST));
const stepY = (t) => (t === 0 ? 40 : t === LAST ? ys(LAST) : ys(t) + DROP);
const lineX = (side) => (side === "client" ? 0 : GAP);
const PANEL_W = 230;
const NARROW = [400, 712];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const tspan = (text, hue, cls = "") => `<tspan${cls ? ` class="${cls}"` : ""}${hue ? ` data-hue="${hue}"` : ""}>${esc(text)}</tspan>`;

// One segment: an arrow from the sender's line to the receiver's line, with its header written above it.
function segmentSvg(s) {
  const from = [lineX(s.from), ys(s.n)];
  const to = [lineX(s.to), ys(s.n) + DROP];
  const angle = (Math.atan2(DROP, GAP) * 180) / Math.PI * (s.from === "client" ? 1 : -1);
  const flags = s.flags.map((f) => tspan(f, FLAG_HUE[f], "el-flag")).join(tspan(","));
  const words =
    flags +
    tspan(" seq=") + tspan(s.seq, STREAM[s.from], "v-seq") +
    (s.ack === null ? "" : tspan(" ack=") + tspan(s.ack, STREAM[s.to], "v-ack")) +
    (s.len ? tspan(" len=") + tspan(s.len, STREAM[s.from]) : "");
  return (
    `<g class="el-seg" id="seg-${s.n}" data-n="${s.n}" data-st="past">` +
    u.arrow(from, to, { hue: STREAM[s.from], head: 6 }) +
    `<g class="el-tag" transform="translate(${GAP / 2} ${ys(s.n) + DROP / 2}) rotate(${angle.toFixed(2)})"><text x="0" y="-6">${words}</text></g>` +
    `<line class="el-hit" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/></g>`
  );
}

// A state name beside the lifeline, at the moment that side enters the state.
function stateSvg(c) {
  const y = yOf(c);
  const x = c.side === "client" ? -12 : GAP + 12;
  return (
    `<g class="el-state" data-side="${c.side}" data-step="${c.step}" data-at="${c.at}">` +
    `<circle cx="${lineX(c.side)}" cy="${y}" r="2.6"/><text x="${x}" y="${y}" text-anchor="${c.side === "client" ? "end" : "start"}">${c.state}</text></g>`
  );
}

// TIME-WAIT lasts 2 MSL: a bracket on the client side, from entering TIME-WAIT to CLOSED.
const twFrom = yOf(CHANGES.find((c) => c.state === "TIME-WAIT")) + 5;
const twTo = ys(LAST) - 5;
const msl =
  `<g class="el-state el-msl" data-side="client" data-step="${LAST - 2}" data-at="timer">` +
  `<path d="M-4 ${twFrom}h-4V${twTo}h4"/><text x="-14" y="${(twFrom + twTo) / 2}" text-anchor="end">2·MSL</text></g>`;

const ladder =
  `<g class="el-ladder">` +
  `<line class="el-life" x1="0" y1="30" x2="0" y2="${H - 4}"/><line class="el-life" x1="${GAP}" y1="30" x2="${GAP}" y2="${H - 4}"/>` +
  `<g class="el-now" id="now" style="transform:translateY(${stepY(LAST)}px)"><line x1="-6" x2="${GAP + 6}" y1="0" y2="0"/></g>` +
  u.chip("client", -34, 4, { w: 68, h: 20, rx: 4, hue: STREAM.client }) +
  u.chip("server", GAP - 34, 4, { w: 68, h: 20, rx: 4, hue: STREAM.server }) +
  CHANGES.map(stateSvg).join("") +
  msl +
  SEGS.map(segmentSvg).join("") +
  `</g>`;

// ---- The header panel: the fields of the selected segment, and both sides' counters. ----
const field = (x, y, w, label, id) =>
  `<rect class="el-cell" x="${x}" y="${y}" width="${w}" height="34"/><text class="el-flabel" x="${x + 7}" y="${y + 11}">${label}</text><text class="el-fval" id="${id}" x="${x + 7}" y="${y + 25}">-</text>`;
const FLAGS = ["URG", "ACK", "PSH", "RST", "SYN", "FIN"];
const fw = PANEL_W / FLAGS.length;
const flagCells = FLAGS.map(
  (f, i) =>
    `<g class="el-fbit" id="p-f-${f}"${FLAG_HUE[f] ? ` data-hue="${FLAG_HUE[f]}"` : ""}><rect x="${(i * fw).toFixed(2)}" y="130" width="${fw.toFixed(2)}" height="34"/><text x="${(i * fw + fw / 2).toFixed(2)}" y="147">${f}</text></g>`,
).join("");
// Both sides' counters as a small table: one row per value, one column per side (wide enough for 10 digits).
const COL = { client: 66, server: 150 };
const counters =
  `<text class="el-flabel" x="0" y="248">state</text><text class="el-flabel" x="0" y="276">SND.NXT</text><text class="el-flabel" x="0" y="294">RCV.NXT</text>` +
  Object.entries(COL)
    .map(
      ([side, x]) =>
        `<text class="el-label" x="${x}" y="230">${side}</text>` +
        `<g class="el-pstate" id="p-st-${side}"><rect x="${x}" y="238" width="80" height="20" rx="4"/><text x="${x + 40}" y="248">-</text></g>` +
        `<text class="el-count" id="p-snd-${side}" data-hue="${STREAM[side]}" x="${x}" y="276">-</text>` +
        `<text class="el-count" id="p-rcv-${side}" data-hue="${STREAM[side === "client" ? "server" : "client"]}" x="${x}" y="294">-</text>`,
    )
    .join("");
const panel =
  `<g class="el-panel">` +
  `<text class="el-label" id="p-title" x="0" y="14">segment</text>` +
  field(0, 28, PANEL_W / 2, "source port", "p-src") +
  field(PANEL_W / 2, 28, PANEL_W / 2, "destination port", "p-dst") +
  field(0, 62, PANEL_W, "sequence number", "p-seq") +
  field(0, 96, PANEL_W, "acknowledgment number", "p-ack") +
  flagCells +
  field(0, 164, PANEL_W, "data", "p-data") +
  `<text class="el-flabel" x="0" y="212">⋯ not shown: window, checksum, options</text>` +
  counters +
  `</g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "A TCP connection as a ladder diagram: the client on the left, the server on the right, time going down. Nine segments open the connection, carry 5 bytes and close it. A panel shows the header of the selected segment and the counters of both sides.",
  body: [ladder, panel],
});

// ---- Scenes. Each owns a range of steps; step t = after segment t arrived (10 = after 2 MSL). ----
const RANGES = [[0, LAST], [0, 1], [2, 2], [3, 3], [4, 5], [6, 7], [8, LAST]];
const mo = (s) => `<mo>${s}</mo>`;
const mn = (s, hue) => `<mn${hue ? ` data-hue="${hue}"` : ""}>${s}</mn>`;
const sp = `<mspace width="1.2em"/>`;
const hue = (h, text) => `<b data-hue="${h}">${text}</b>`;
const x = u.mi("x", "blue");
const y = u.mi("y", "gold");
const seqB = u.mi("seq", "blue");
const ackB = u.mi("ack", "blue");
const seqG = u.mi("seq", "gold");
const ackG = u.mi("ack", "gold");
const scenes = [
  {
    name: "Overview",
    math: `${u.mi("ack")}${mo("=")}${u.mi("seq")}${mo("+")}${u.mi("len")}${mo("+")}${u.mi("SYN", "green")}${mo("+")}${u.mi("FIN", "red")}`,
    say: `Nine segments open a connection, carry 5 bytes and close it. Each side numbers its own bytes. An ack number means "the next number I expect from you".`,
  },
  {
    name: "SYN",
    math: `${seqB}${mo("=")}${x}`,
    say: `The client picks a random first number, the ISN ${hue("blue", "x")}. It sends ${hue("green", "SYN")} with seq = x. The SYN carries no data, but it uses one sequence number.`,
  },
  {
    name: "SYN-ACK",
    math: `${seqG}${mo("=")}${y}${sp}${ackB}${mo("=")}${x}${mo("+")}${mn(1, "green")}`,
    say: `The server picks its own ISN ${hue("gold", "y")} and sends its own ${hue("green", "SYN")}. Its ack is ${hue("blue", "x + 1")}: the client's SYN used number x.`,
  },
  {
    name: "ACK",
    math: `${seqB}${mo("=")}${x}${mo("+")}${mn(1, "green")}${sp}${ackG}${mo("=")}${y}${mo("+")}${mn(1, "green")}`,
    say: `The client acknowledges the server's SYN with ack = ${hue("gold", "y + 1")}. Both sides are now ESTABLISHED. A pure ACK uses no sequence number.`,
  },
  {
    name: "Data",
    math: `${ackB}${mo("=")}${seqB}${mo("+")}${u.mi("len", "blue")}${mo("=")}${x}${mo("+")}${mn(1, "green")}${mo("+")}${mn(5, "blue")}`,
    say: `The client sends 5 bytes from seq = x + 1. The server answers ack = ${hue("blue", "x + 6")}. The ack counts bytes, not segments.`,
  },
  {
    name: "First FIN",
    math: `${ackB}${mo("=")}${x}${mo("+")}${mn(6)}${mo("+")}${mn(1, "red")}`,
    say: `The client closes first. Its ${hue("red", "FIN")} uses one number, so the server's ack is ${hue("blue", "x + 7")}. The server can still send data: this is a half close.`,
  },
  {
    name: "Second FIN",
    math: `${ackG}${mo("=")}${y}${mo("+")}${mn(1, "green")}${mo("+")}${mn(1, "red")}${sp}<mtext>wait</mtext><mspace width="0.4em"/>${mn(2)}${mo("·")}${u.mi("MSL")}`,
    say: `The server sends its own ${hue("red", "FIN")}, and the client answers ack = ${hue("gold", "y + 2")}. The client then waits 2 MSL. If that last ACK is lost, the server sends its FIN again.`,
  },
];

const css = [
  `.el-ladder{transform:translate(130px,0)}`,
  `.el-panel{transform:translate(568px,40px)}`,
  `.u-stage[data-narrow] .el-ladder{transform:translate(40px,0)}`,
  `.u-stage[data-narrow] .el-panel{transform:translate(${(NARROW[0] - PANEL_W) / 2}px,410px)}`,
  `.u-stage[data-narrow] .el-state text{display:none}`,
  `.el-life{stroke:var(--anatomy-lo);stroke-width:1}`,
  `.el-now line{stroke:var(--anatomy-mid);stroke-width:.8;stroke-dasharray:3 3}`,
  `.el-now{transition:transform .5s var(--anatomy-ease)}`,
  // A segment draws in when it is sent; older segments step back; the selected one is thicker.
  `.el-seg{cursor:pointer;transition:opacity .4s}`,
  `.el-seg .u-arrow-line{stroke-dasharray:1 2;stroke-dashoffset:0;transition:stroke-dashoffset .55s var(--anatomy-ease),stroke-width .3s,opacity .2s}`,
  `.el-seg[data-st="later"] .u-arrow-line{stroke-dashoffset:1;opacity:0}`,
  `.el-seg :is(.u-arrow-head,.el-tag){transition:opacity .3s .45s}`,
  `.el-seg[data-st="later"] :is(.u-arrow-head,.el-tag){opacity:0;transition-delay:0s}`,
  `.el-seg[data-st="later"]{pointer-events:none}`,
  `.el-seg[data-st="past"]{opacity:.4}`,
  `.u-stage[data-scene="0"] .el-seg[data-st="past"]{opacity:.85}`,
  `.el-seg[data-st="now"] .u-arrow{--w:1.9}`,
  `.el-tag text{font:500 10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;white-space:pre}`,
  `.el-tag tspan[data-hue]{fill:var(--hue)}`,
  `.el-seg[data-st="now"] .el-tag text{fill:var(--anatomy-text)}`,
  `.el-hit{stroke:transparent;stroke-width:14}`,
  `.el-state{transition:opacity .4s}`,
  `.el-state[data-at="recv"]{transition-delay:.4s}`,
  `.el-state[data-st="later"]{opacity:0}`,
  `.el-state circle{fill:var(--anatomy-mid)}`,
  `.el-state text{font:500 10px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.04em;dominant-baseline:central}`,
  `.el-state[data-cur] text{fill:var(--anatomy-strong)}`,
  `.el-state[data-cur] circle{fill:var(--anatomy-strong)}`,
  `.el-msl path{fill:none;stroke:var(--anatomy-mid);stroke-width:.9}`,
  `.el-label{font:10.5px var(--anatomy-mono);fill:var(--anatomy-muted);letter-spacing:.06em;text-transform:uppercase}`,
  `.el-cell{fill:var(--anatomy-faint);fill-opacity:.12;stroke:var(--anatomy-lo);stroke-width:.8}`,
  `.el-flabel{font:10px var(--anatomy-mono);fill:var(--anatomy-muted)}`,
  `.el-fval{font:500 12.5px var(--anatomy-mono);fill:var(--anatomy-strong);font-variant-numeric:tabular-nums}`,
  `.el-fval[data-hue],.el-count[data-hue]{fill:var(--hue)}`,
  `.el-fval[data-off]{fill:var(--anatomy-lo)}`,
  `.el-fbit rect{fill:none;stroke:var(--anatomy-lo);stroke-width:.8;transition:fill .3s}`,
  `.el-fbit text{font:500 10px var(--anatomy-mono);fill:var(--anatomy-lo);text-anchor:middle;dominant-baseline:central;transition:fill .3s}`,
  `.el-fbit[data-on] rect{fill:var(--hue,var(--anatomy-hi));fill-opacity:.9}`,
  `.el-fbit[data-on] text{fill:var(--unfold-on-hot)}`,
  `.el-pstate rect{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:.8}`,
  `.el-pstate text{font:500 10px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:middle;dominant-baseline:central}`,
  `.el-count{font:500 11.5px var(--anatomy-mono);font-variant-numeric:tabular-nums}`,
  `.el-isn{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px}`,
  `.el-isn span{font:11px var(--anatomy-mono);color:var(--anatomy-muted);letter-spacing:.06em}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "client bytes (client seq, server ack)" },
  { hue: "gold", label: "server bytes (server seq, client ack)" },
  { hue: "green", label: "SYN: uses 1 number" },
  { hue: "red", label: "FIN: uses 1 number" },
]);

const MODES = { book: "x = 1000, y = 5000", relative: "relative (Wireshark)", linux: "real Linux capture" };
const picker = `<div class="el-isn" role="group" aria-label="Initial sequence numbers"><span>ISN</span>${Object.entries(MODES)
  .map(([k, label]) => `<button type="button" data-isn="${k}" aria-pressed="${k === "book"}">${label}</button>`)
  .join("")}</div>`;

const stage = u.stageHtml({
  dwell: 8000,
  scenes,
  svg,
  label: "TCP handshake and teardown explainer. Left and right arrows change the scene. Up and down arrows step through the segments.",
  css,
  key,
  time: { steps: LAST + 1 },
  controls: picker,
  narrow: NARROW,
});

// Every number is stored as an offset from its stream's ISN, so the page can show any ISN pair (mod 2^32).
const isnBook = m.ISN.book;
const rel = (v, stream) => (v === null ? null : v - isnBook[stream]);
const DATA = {
  segs: SEGS.map((s) => ({ n: s.n, from: s.from, to: s.to, flags: s.flags, seq: rel(s.seq, s.from), ack: rel(s.ack, s.to), len: s.len, data: s.data, cost: m.cost(s) })),
  steps: STEPS.map((st) => Object.fromEntries(Object.entries(st.sides).map(([side, v]) => [side, { state: v.state, snd: rel(v.snd, side), rcv: rel(v.rcv, side === "client" ? "server" : "client") }]))),
  ranges: RANGES,
  isn: m.ISN,
  ports: m.PORTS,
  stream: STREAM,
  last: LAST,
  stepY: STEPS.map((_, t) => stepY(t)),
};

const live = `
const D = ${JSON.stringify(DATA)};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const $ = (id) => root.querySelector("#" + id);
let isn = D.isn.book;
let step = D.last;
let crossing = false;
const num = (v, stream) => (v === null ? null : (isn[stream] + v) % 4294967296);
const why = (s) => s.len ? s.len + " bytes" : s.flags.includes("SYN") ? "1 (SYN)" : s.flags.includes("FIN") ? "1 (FIN)" : "0 (no data)";
// The segment before n from one side: the source of n's seq (same side) or of n's ack (other side).
const before = (n, side) => D.segs.slice(0, n - 1).filter((s) => s.from === side).at(-1);
function arithmetic(s) {
  const seq = num(s.seq, s.from);
  const mine = before(s.n, s.from);
  const seqText = mine ? "seq " + seq + " = " + num(mine.seq, mine.from) + " + " + why(mine) : "seq " + seq + " = " + s.from + " ISN";
  if (s.ack === null) return seqText;
  const theirs = before(s.n, s.to);
  return seqText + " \\u00b7 ack " + num(s.ack, s.to) + " = " + num(theirs.seq, theirs.from) + " + " + why(theirs);
}
function setText(id, text, hue) {
  const el = $(id);
  el.textContent = text;
  if (hue) el.setAttribute("data-hue", hue); else el.removeAttribute("data-hue");
}
function show(t) {
  step = Math.max(0, Math.min(D.last, t));
  root.querySelectorAll(".el-seg").forEach((el) => {
    const n = Number(el.dataset.n);
    el.dataset.st = n > step ? "later" : n === Math.min(step, D.segs.length) ? "now" : "past";
  });
  for (const side of ["client", "server"]) {
    const seen = [...root.querySelectorAll('.el-state[data-side="' + side + '"]')].filter((el) => Number(el.dataset.step) <= step);
    root.querySelectorAll('.el-state[data-side="' + side + '"]').forEach((el) => {
      el.dataset.st = Number(el.dataset.step) <= step ? "past" : "later";
      el.toggleAttribute("data-cur", el === seen.filter((e) => !e.classList.contains("el-msl")).at(-1));
    });
  }
  $("now").style.transform = "translateY(" + D.stepY[step] + "px)";
  // The panel shows the latest segment (none before the first one).
  const s = D.segs[Math.min(step, D.segs.length) - 1];
  setText("p-title", s ? "segment " + s.n + " \\u00b7 " + s.from + " \\u2192 " + s.to : "no segment sent yet");
  setText("p-src", s ? D.ports[s.from] : "-");
  setText("p-dst", s ? D.ports[s.to] : "-");
  setText("p-seq", s ? num(s.seq, s.from) : "-", s && D.stream[s.from]);
  setText("p-ack", s ? (s.ack === null ? "not used (ACK flag off)" : num(s.ack, s.to)) : "-", s && s.ack !== null && D.stream[s.to]);
  $("p-ack").toggleAttribute("data-off", !s || s.ack === null);
  setText("p-data", s ? (s.len ? '"' + s.data + '" \\u00b7 ' + s.len + " bytes" : "none") : "-", s && s.len && D.stream[s.from]);
  $("p-data").toggleAttribute("data-off", !s || !s.len);
  root.querySelectorAll(".el-fbit").forEach((el) => el.toggleAttribute("data-on", !!s && s.flags.includes(el.id.slice(4))));
  const sides = D.steps[step];
  for (const side of ["client", "server"]) {
    const v = sides[side];
    const other = side === "client" ? "server" : "client";
    $("p-st-" + side).querySelector("text").textContent = v.state;
    setText("p-snd-" + side, num(v.snd, side), D.stream[side]);
    setText("p-rcv-" + side, v.rcv === null ? "-" : num(v.rcv, other), D.stream[other]);
  }
  UNFOLD.timeAt(step);
  const text = step === 0 ? "step 0 \\u00b7 client CLOSED, server LISTEN \\u00b7 nothing sent yet"
    : step === D.last ? "step " + step + " \\u00b7 2 MSL later: client CLOSED \\u00b7 both sides closed"
    : "step " + step + " \\u00b7 " + s.flags.join(",") + " \\u00b7 " + arithmetic(s);
  if (readout.textContent !== text) readout.textContent = text;
}
function relabel() {
  root.querySelectorAll(".el-seg").forEach((el) => {
    const s = D.segs[Number(el.dataset.n) - 1];
    el.querySelector(".v-seq").textContent = num(s.seq, s.from);
    const ack = el.querySelector(".v-ack");
    if (ack) ack.textContent = num(s.ack, s.to);
  });
  show(step);
}
// Stepping by hand can cross into another scene; the scene follows the step.
function stepTo(t) {
  show(t);
  const sc = UNFOLD.scene();
  const [a, b] = D.ranges[sc];
  if (sc > 0 && (step < a || step > b)) {
    crossing = true;
    UNFOLD.go(D.ranges.findIndex((r, i) => i > 0 && step >= r[0] && step <= r[1]));
    crossing = false;
  }
  UNFOLD.pause();
}
root.addEventListener("unfold:scene", (e) => {
  if (crossing) return;
  const sc = e.detail.scene;
  show(sc === 0 ? D.last : Math.max(0, D.ranges[sc][0] - 1));
});
D.ranges.forEach(([a, b], sc) => sc > 0 && UNFOLD.beat(sc, 1500, (n) => show(n < 0 ? b : Math.min(a + n, b)), 500));
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  stepTo(to);
});
root.addEventListener("click", (e) => {
  const seg = e.target.closest(".el-seg");
  if (seg) return stepTo(Number(seg.dataset.n));
  const b = e.target.closest("[data-isn]");
  if (!b) return;
  isn = D.isn[b.dataset.isn];
  root.querySelectorAll("[data-isn]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  UNFOLD.pause();
  relabel();
});
show(D.last);
`;

// ---- Notes under the card: the real capture, what is left out, and the terms. ----
const capture = readFileSync(join(HERE, "capture.txt"), "utf8");
const real = m.parseTcpdump(capture);
const linux = m.run(m.ISN.linux).segments;
const notes = u.notesHtml([
  {
    title: "Checked against Linux",
    html: `<p>The figure's numbers come from a small model of two TCP endpoints (<code>model.mjs</code>). To check it, <code>capture.sh</code> runs a real connection on Linux 7.1 over loopback, in a private network namespace, and records it with <code>tcpdump -S</code>. The model, started from the same two ISNs, produces the same 9 segments. Pick <b>real Linux capture</b> under the drawing to see these numbers in the figure.</p>`,
    table: {
      head: ["#", "direction", "tcpdump flags", "seq", "ack", "len"],
      rows: real.map((r, i) => [
        String(i + 1),
        `${r.from} → ${r.from === "client" ? "server" : "client"}`,
        `<code>[${capture.trim().split("\n")[i].match(/Flags \[([^\]]*)\]/)[1]}]</code> ${linux[i].flags.join(",")}`,
        r.seq === null ? `${linux[i].seq} <span style="color:var(--anatomy-muted)">(tcpdump hides it)</span>` : String(r.seq),
        r.ack === null ? "-" : String(r.ack),
        String(r.len),
      ]),
    },
  },
  {
    title: "What the figure leaves out",
    html: `<ul>
<li><b>Header fields</b>: window size, checksum, urgent pointer and options. The real SYNs also carry options: MSS, SACK permitted, window scale and timestamps.</li>
<li><b>Loss</b>: no segment is lost or sent again. A lost SYN or FIN is sent again after a timeout, with the same sequence number.</li>
<li><b>Three-segment close</b>: if the server closes at once, it can put its ACK and its FIN in one segment (FIN,ACK). <code>capture.sh</code> waits 0.3 s before the server closes, so the capture has the 4-segment close drawn here.</li>
<li><b>RST</b>: a reset ends a connection at once, without FIN and without TIME-WAIT.</li>
<li><b>Simultaneous open and close</b>: both sides send SYN (or FIN) at the same time. The state machine has extra paths for this.</li>
<li><b>Random ISN</b>: RFC 6528 makes the ISN from a clock plus a keyed hash of the addresses and ports, so an attacker cannot guess it. Sequence numbers are 32-bit and wrap around after 2<sup>32</sup> − 1.</li>
<li><b>TIME-WAIT length</b>: RFC 793 suggested an MSL of 2 minutes. Linux uses a fixed TIME-WAIT of 60 s.</li>
</ul>`,
  },
  {
    title: "Terms",
    html: `<ul>
<li><b>Segment</b>: one TCP packet: a header and optional data.</li>
<li><b>ISN</b> (initial sequence number): the first sequence number a side uses. Each side picks its own.</li>
<li><b>seq</b>: the number of the first byte in this segment. A SYN or a FIN carries no data, but uses one sequence number.</li>
<li><b>ack</b>: the next sequence number the sender expects from the other side. It is valid only when the ACK flag is set.</li>
<li><b>SND.NXT</b> and <b>RCV.NXT</b>: the next number a side will send, and the next number it expects to receive. Every ack is the sender's RCV.NXT.</li>
<li><b>Relative numbers</b>: Wireshark and tcpdump subtract the ISN by default, so the SYN shows seq 0 and its answer shows ack 1. <code>tcpdump -S</code> shows the real numbers.</li>
<li><b>MSL</b> (maximum segment lifetime): the longest time a segment can stay in the network. TIME-WAIT lasts 2 MSL, so old copies die before the same ports are used again.</li>
</ul>`,
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "TCP open and close",
    hint: "← → scene · ↑ ↓ segment",
    readout: "step " + LAST + " · 2 MSL later: client CLOSED · both sides closed",
    caption:
      "A client opens a TCP connection, sends 5 bytes and closes first. The ISNs x = 1000 and y = 5000 were chosen by hand to make the arithmetic easy; real ISNs are random 32-bit numbers. Every segment, number and state comes from a small model of the two endpoints, and the model matches a real Linux capture segment by segment.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "tcp-handshake-light.html" : "tcp-handshake.html");
const title = "TCP open and close";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
