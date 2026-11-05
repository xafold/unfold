import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const u = await import(pathToFileURL(join(process.env.UNFOLD_DIR ?? join(homedir(), ".claude", "skills", "unfold"), "kit", "concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LAST = m.STEPS.length - 1;
// Colour identity. A segment arrow takes the hue of its main job: open (SYN), close (FIN), carry data, or acknowledge.
const FLAG_HUE = { SYN: "yellow", FIN: "red", ACK: "green", PSH: "", RST: "", URG: "" };
const segHue = (seg) => (seg.flags.includes("SYN") ? "yellow" : seg.flags.includes("FIN") ? "red" : seg.len ? "purple" : "green");

// ---- Ladder (left column, 400 wide): client and server timelines, time runs down ----
const CX = 96;
const SX = 304;
const ROW = 40;
const DROP = 26;
const yTop = (t) => 64 + (t - 1) * ROW;
const H = 448;
const sideX = { client: CX, server: SX };
const eventY = (c) => (c.at === "start" ? 36 : c.at === "timer" ? yTop(LAST) + 6 : c.at === "send" ? yTop(c.t) : yTop(c.t) + DROP);

const heads = ["client", "server"].map((s) => u.chip(s, sideX[s] - 32, 4, { w: 64, h: 18, rx: 4, className: "el-head" })).join("");
const lines = ["client", "server"].map((s) => `<path class="el-life" d="M${sideX[s]} 22V${H - 4}"/>`).join("");

const label = (seg) => {
  const parts = [[seg.flags.join(","), ""], [` seq=${seg.seq}`, "blue"]];
  if (seg.ack !== null) parts.push([` ack=${seg.ack}`, "green"]);
  if (seg.len) parts.push([` len=${seg.len}`, "purple"]);
  const flagSpans = seg.flags.map((f, k) => `${k ? "," : ""}<tspan${FLAG_HUE[f] ? ` data-hue="${FLAG_HUE[f]}"` : ""}>${f}</tspan>`).join("");
  const text = flagSpans + parts.slice(1).map(([t, h]) => `<tspan data-hue="${h}">${esc(t)}</tspan>`).join("");
  const chars = parts.map(([t]) => t).join("").length;
  return { text, w: chars * 6.02 + 10 };
};
const segs = m.STEPS.filter((s) => s.seg).map((s) => {
  const g = s.seg;
  const [x1, x2] = g.from === "client" ? [CX, SX] : [SX, CX];
  const y = yTop(s.t);
  const { text, w } = label(g);
  return (
    `<g class="el-seg" id="seg-${s.t}" data-t="${s.t}">` +
    `<path class="el-hit" d="M${x1} ${y}L${x2} ${y + DROP}"/>` +
    u.arrow([x1, y], [x2 + (x2 > x1 ? -1 : 1), y + DROP], { hue: segHue(g), head: 6, width: 1.4 }) +
    `<g class="el-lab"><rect x="${200 - w / 2}" y="${y + DROP / 2 - 8}" width="${w}" height="16" rx="3"/><text x="200" y="${y + DROP / 2}">${text}</text></g>` +
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

// ---- Right column (400 wide): the current segment's header, and each direction's sequence-number space ----
const FLAGS = ["URG", "ACK", "PSH", "RST", "SYN", "FIN"];
const field = (id, x, w, name, hue) =>
  `<g class="el-field" id="${id}"${hue ? ` data-hue="${hue}"` : ""}><rect x="${x}" y="22" width="${w}" height="40" rx="3"/><text class="el-fname" x="${x + w / 2}" y="33">${name}</text><text class="el-fval" x="${x + w / 2}" y="50">—</text></g>`;
const header =
  `<text class="el-label" x="0" y="10">current segment</text><text class="el-dir" id="dir" x="400" y="10">—</text>` +
  field("f-seq", 0, 72, "seq", "blue") +
  field("f-ack", 78, 72, "ack", "green") +
  FLAGS.map((f, k) => `<g class="el-flag" id="flag-${f}"${FLAG_HUE[f] ? ` data-hue="${FLAG_HUE[f]}"` : ""}><rect x="${158 + k * 30}" y="22" width="26" height="40" rx="3"/><text x="${158 + k * 30 + 13}" y="42">${f}</text></g>`).join("") +
  field("f-data", 340, 60, "data", "purple");

const CELL = 50;
const cellHue = (what) => (what === "SYN" ? "yellow" : what === "FIN" ? "red" : "purple");
const strip = (from, y) => {
  const to = from === "client" ? "server" : "client";
  const cells = m.space(from);
  const ghost = { n: cells.at(-1).n + 1, what: "" };
  const body = [...cells, ghost]
    .map((c, k) => `<g class="el-cell" data-n="${c.n}"${c.what ? ` data-hue="${cellHue(c.what)}"` : " data-ghost"}><rect x="${k * CELL}" y="${y + 28}" width="${CELL - 4}" height="36" rx="3"/><text class="el-cn" x="${k * CELL + 23}" y="${y + 39}">${c.n}</text><text class="el-cw" x="${k * CELL + 23}" y="${y + 54}">${esc(c.what)}</text></g>`)
    .join("");
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
const right = `<g class="el-right">${header}${strip("client", STRIP_Y.client)}${strip("server", STRIP_Y.server)}${legend}</g>`;
const RIGHT_H = 326;

const svg = iso.figureSvg({
  width: 820,
  height: H,
  label: "TCP connection between a client and a server: the three-way handshake, 5 bytes of data, and the four-segment teardown, with the sequence and ack number of every segment and the state of each side.",
  body: [ladder, right],
});

// ---- Scenes: each owns a range of steps ----
const RANGES = [[0, LAST], [0, 1], [2, 2], [3, 3], [4, 5], [6, 7], [8, LAST]];
const mn = (v, hue) => `<mn${hue ? ` data-hue="${hue}"` : ""}>${v}</mn>`;
const plus = `<mo>+</mo>`;
const ackMath = (t) => {
  const a = m.ackSum(m.answers(t).seg);
  return `${u.mi("ack", "green")}<mo>=</mo>${mn(a.seq, "blue")}${plus}${mn(a.len, "purple")}${plus}${mn(a.syn, "yellow")}${plus}${mn(a.fin, "red")}<mo>=</mo>${mn(a.ack, "green")}`;
};
const hue = (h, text) => `<b data-hue="${h}">${text}</b>`;
const seg = (t) => m.STEPS[t].seg;
const scenes = [
  {
    name: "Overview",
    math: `${u.mi("ack", "green")}<mo>=</mo>${u.mi("seq", "blue")}${plus}${u.mi("len", "purple")}${plus}${u.mi("SYN", "yellow")}${plus}${u.mi("FIN", "red")}`,
    say: `Three segments open the connection and four segments close it. An ${hue("green", "ack")} names the next ${hue("blue", "sequence number")} that the receiver expects.`,
  },
  {
    name: "SYN",
    math: `${u.mi("seq", "blue")}<mo>=</mo>${u.msub("ISN", "client", "blue")}<mo>=</mo>${mn(m.ISN.client, "blue")}`,
    say: `The client picks its initial sequence number (ISN), ${m.ISN.client}, and sends ${hue("yellow", "SYN")}. SYN uses one number, so the next number is ${m.ISN.client + 1}.`,
  },
  {
    name: "SYN-ACK",
    math: ackMath(2),
    say: `The server sends its own ${hue("yellow", "SYN")} with ISN ${m.ISN.server}. Its ${hue("green", `ack ${seg(2).ack}`)} names the next number it expects from the client.`,
  },
  {
    name: "ACK",
    math: ackMath(3),
    say: `The client acknowledges the server's SYN with ${hue("green", `ack ${seg(3).ack}`)}. A pure ACK uses no number, so the next segment also has seq ${seg(3).seq}.`,
  },
  {
    name: "Data",
    math: ackMath(5),
    say: `The client sends ${hue("purple", `${m.DATA.length} bytes`)}, numbers ${seg(4).seq} to ${seg(4).seq + m.DATA.length - 1}. Each byte uses one number, so the server acknowledges ${seg(5).ack}.`,
  },
  {
    name: "Client FIN",
    math: ackMath(7),
    say: `The client sends ${hue("red", "FIN")}, which also uses one number. The server acknowledges ${seg(7).ack} and can still send data in CLOSE-WAIT.`,
  },
  {
    name: "Server FIN",
    math: ackMath(9),
    say: `The server sends its own ${hue("red", "FIN")}, and the client acknowledges ${seg(9).ack}. The client waits 2·MSL in TIME-WAIT, so it can resend a lost last ACK.`,
  },
];

const NARROW = { w: 400, h: H + 16 + RIGHT_H };
const css = [
  `.el-right{transform:translate(420px,56px)}`,
  `.u-stage[data-narrow] .el-right{transform:translate(0,${H + 16}px)}`,
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
  `.el-flag text{font:9.5px var(--anatomy-mono);fill:var(--anatomy-lo);text-anchor:middle;dominant-baseline:central}`,
  `.el-flag rect{transition:fill .3s,stroke .3s}`,
  `.el-flag[data-on] rect{fill:var(--hue,var(--anatomy-hi));fill-opacity:.22;stroke:var(--hue,var(--anatomy-hi))}`,
  `.el-flag[data-on] text{fill:var(--hue,var(--anatomy-strong));font-weight:600}`,
  `.el-cell rect{fill:var(--hue,none);fill-opacity:0;stroke:var(--anatomy-faint);stroke-width:.8;stroke-dasharray:2 2;transition:fill-opacity .4s,stroke .4s}`,
  `.el-cell[data-sent] rect{stroke:var(--hue);stroke-dasharray:none;stroke-width:1.2}`,
  `.el-cell[data-acked] rect{fill-opacity:.38}`,
  `.el-cn{font:9.5px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.el-cw{font:500 12px var(--anatomy-mono);fill:var(--anatomy-lo);text-anchor:middle;dominant-baseline:central;transition:fill .4s}`,
  `.el-cell[data-sent] .el-cw{fill:var(--hue)}`,
  `.el-cell[data-acked] .el-cw{fill:var(--anatomy-strong)}`,
  `.el-cell[data-acked] .el-cn{fill:var(--anatomy-text)}`,
  `.el-ptr{transition:transform .5s var(--anatomy-ease),opacity .3s}`,
  `.el-ptr path{fill:var(--hue)}`,
  `.el-ptr text{font:500 10px var(--anatomy-mono);fill:var(--hue);dominant-baseline:central}`,
  `.el-ptr[data-flip] text{text-anchor:end}`,
  `.el-ptr[data-flip] .el-ptl{transform:translateX(-20px)}`,
  `.el-legend text{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.u-notes b[data-hue]{color:var(--hue)}`,
  `.el-sent{fill:none;stroke:var(--anatomy-hi);stroke-width:1.2}`,
  `.el-acked{fill:var(--anatomy-hi);fill-opacity:.38;stroke:var(--anatomy-hi);stroke-width:1.2}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "seq · SND.NXT" },
  { hue: "green", label: "ack · RCV.NXT" },
  { hue: "yellow", label: "SYN (opens)" },
  { hue: "red", label: "FIN (closes)" },
  { hue: "purple", label: "data bytes" },
]);

const stage = u.stageHtml({
  dwell: 8000,
  scenes,
  svg,
  label: "TCP handshake and teardown explainer. Left and right arrows change the scene. Up and down arrows step through the segments.",
  css,
  key,
  time: { steps: LAST + 1 },
  narrow: [NARROW.w, NARROW.h],
});

// Per step: which arrow is new, each side's state chip, the counters, the header fields and the readout.
const readout = (s) => {
  if (!s.seg) return s.t === 0 ? `step 0 · client CLOSED · server LISTEN` : `step ${s.t} · 2·MSL timer ends · client CLOSED`;
  const head = `step ${s.t} · ${s.seg.from} ${s.seg.flags.join(",")}`;
  if (s.seg.ack === null) return `${head} · seq = ISN = ${s.seg.seq} · no ack yet`;
  const src = m.answers(s.t);
  const a = m.ackSum(src.seg);
  return `${head} · ack = ${a.seq} + ${a.len} + ${a.syn} + ${a.fin} = ${a.ack}, answers step ${src.t}`;
};
const STEPDATA = m.STEPS.map((s) => ({
  seg: s.seg && { from: s.seg.from, flags: s.seg.flags, seq: s.seg.seq, ack: s.seg.ack, data: s.seg.data },
  vars: { client: s.client, server: s.server },
  readout: readout(s),
}));
const ON = Object.fromEntries(
  ["client", "server"].map((side) => [side, m.STEPS.map((_, t) => m.CHANGES.reduce((on, c, k) => (c.side === side && c.t <= t ? k : on), -1))]),
);
const live = `
const STEPS = ${JSON.stringify(STEPDATA)};
const ON = ${JSON.stringify(ON)};
const RANGES = ${JSON.stringify(RANGES)};
const LAST = ${LAST};
const CELL = ${CELL};
const ISN = ${JSON.stringify(m.ISN)};
const root = UNFOLD.stage;
const out = document.querySelector("[data-readout]");
const $ = (q) => root.querySelector(q);
let step = LAST;
let crossing = false;
function show(t) {
  step = Math.max(0, Math.min(LAST, t));
  const s = STEPS[step];
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
    const v = s.vars[from];
    root.querySelectorAll("#strip-" + from + " .el-cell").forEach((c) => {
      const n = Number(c.dataset.n);
      c.toggleAttribute("data-sent", !c.hasAttribute("data-ghost") && v.sndNxt !== null && n < v.sndNxt);
      c.toggleAttribute("data-acked", !c.hasAttribute("data-ghost") && v.sndUna !== null && n < v.sndUna);
    });
    const place = (el, n) => {
      el.style.opacity = n === null ? 0 : 1;
      if (n === null) return;
      el.style.transform = "translateX(" + (n - ISN[from]) * CELL + "px)";
      el.toggleAttribute("data-flip", n - ISN[from] >= 4);
    };
    place($("#snd-" + from), v.sndNxt);
    place($("#rcv-" + from), s.vars[to].rcvNxt);
  }
  const g = s.seg;
  $("#dir").textContent = g ? g.from + " → " + (g.from === "client" ? "server" : "client") : "no segment";
  $("#f-seq .el-fval").textContent = g ? g.seq : "—";
  $("#f-ack .el-fval").textContent = g && g.ack !== null ? g.ack : "—";
  $("#f-data .el-fval").textContent = g && g.data ? '"' + g.data + '"' : "—";
  root.querySelectorAll(".el-flag").forEach((f) => f.toggleAttribute("data-on", !!g && g.flags.includes(f.id.slice(5))));
  UNFOLD.timeAt(step);
  if (out.textContent !== s.readout) out.textContent = s.readout;
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
RANGES.forEach(([a, b], sc) => sc > 0 && a < b && UNFOLD.beat(sc, 1300, (n) => show(n < 0 ? b : Math.min(a + n, b)), 1300));
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const to = { ArrowUp: step - 1, ArrowDown: step + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  stepTo(to);
});
root.querySelectorAll(".el-seg").forEach((g) => g.addEventListener("click", () => stepTo(Number(g.dataset.t))));
show(LAST);
`;

// ---- Reference section under the card ----
const real = existsSync(join(HERE, "capture.json")) ? JSON.parse(readFileSync(join(HERE, "capture.json"), "utf8")) : null;
const segList = m.SEGMENTS;
const pair = (seq, ack) => `${seq} / ${ack ?? "—"}`;
const notes = u.notesHtml([
  {
    title: "What uses a sequence number",
    html: `<p>An ack is one more than the last number it covers. That is why the ack after a SYN or a FIN is seq + 1.</p>`,
    table: {
      head: ["part of a segment", "numbers it uses", "in this figure"],
      rows: [
        [`<b data-hue="yellow">SYN</b>`, "1", `${m.ISN.client} and ${m.ISN.server}`],
        [`<b data-hue="purple">data byte</b>`, "1 each", `${segList[3].seq} to ${segList[3].seq + m.DATA.length - 1} ("${m.DATA}")`],
        [`<b data-hue="red">FIN</b>`, "1", `${segList[5].seq} and ${segList[7].seq}`],
        [`<b data-hue="green">pure ACK</b>`, "0", "segments 3, 5, 7 and 9"],
      ],
    },
  },
  real && {
    title: "Checked against Linux",
    html: `<p><code>node model.mjs</code> runs the same exchange on loopback in a private network namespace and captures it. Linux picks random ISNs, but every flag, length and offset from the ISN matches the figure.</p>`,
    table: {
      head: ["#", "segment", "figure seq / ack", "Linux seq / ack"],
      rows: real.map((r, i) => [String(i + 1), `${r.from} ${r.flags.join(",")}${r.len ? ` len=${r.len}` : ""}`, pair(segList[i].seq, segList[i].ack), pair(r.seq, r.ack)]),
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
        ["wraparound", "Sequence numbers are 32-bit and wrap modulo 2³²."],
        ["three-segment close", "A server that closes at once sends one FIN,ACK that also acknowledges the client's FIN."],
        ["delayed ACK", "A receiver may wait 40 to 200 ms (Linux) to combine ACKs."],
        ["window and options", "Every segment also carries a window size. SYNs carry MSS, window scale, SACK and timestamps."],
        ["loss and RST", "Lost segments are sent again after a timeout. RST aborts a connection without FIN."],
        ["TIME-WAIT length", "Linux waits a fixed 60 s, not a measured 2·MSL."],
      ],
    },
  },
].filter(Boolean));

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "TCP open and close",
    hint: "← → scene · ↑ ↓ step",
    readout: m.STEPS[LAST] && readout(m.STEPS[LAST]),
    caption:
      `One TCP connection: a three-way handshake, ${m.DATA.length} bytes from the client, then a close that the client starts. ` +
      `We chose the ISNs ${m.ISN.client} and ${m.ISN.server} by hand, and every other number follows from TCP's rules. ` +
      `A Linux capture of the same exchange matches every segment.`,
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "tcp-handshake-light.html" : "tcp-handshake.html");
const title = "TCP handshake and teardown";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
