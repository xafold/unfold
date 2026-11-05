// DNS lookup explainer. Storyboard:
// | # | Name          | On screen                                  | What changes                          | Meaning                                   |
// | 0 | Overview      | 5 lifelines, all 8 messages, full cache    | nothing                               | one question, three servers, one cache    |
// | 1 | Ask           | client -> resolver, cache = root hints     | message 1 draws                       | the resolver does the walk for you        |
// | 2 | Root          | resolver <-> root                          | referral, com. NS row appears          | root knows only who runs com.             |
// | 3 | TLD           | resolver <-> TLD                           | referral, example.com. NS row appears  | TLD knows only who runs example.com.      |
// | 4 | Authoritative | resolver <-> auth, answer to client        | A row appears with TTL 300             | the zone's own server holds the record    |
// | 5 | Second lookup | lookup 1 dimmed, lookup 2 on top (60 s)    | TTL bars shrink, cache answers         | a live record means no servers asked      |
// | 6 | TTL runs out  | same, 600 s                                | A row expires, walk starts at auth     | each record expires on its own TTL        |
// Persisting objects: lifelines, lookup 1 messages (dim in 5-6), cache rows (TTL bars move).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import * as m from "./model.mjs";

const u = await import(join(homedir(), ".claude/skills/unfold/kit/concept-kit.mjs"));
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

const HUE = { query: "blue", referral: "gold", answer: "green" };
const COLS = ["client", "resolver", "root", "tld", "auth"];
const PAIRS = [["client", "resolver"], ["resolver", "client"], ["resolver", "root"], ["root", "resolver"], ["resolver", "tld"], ["tld", "resolver"], ["resolver", "auth"], ["auth", "resolver"]];
const ROWS = 6;

const WIDE = {
  cls: "lay-wide",
  W: 820,
  H: 492,
  X: { client: 46, resolver: 214, root: 392, tld: 566, auth: 740 },
  head: {
    client: ["you", "browser + OS", "", ""],
    resolver: ["recursive resolver", "ISP or 1.1.1.1", "", ""],
    root: ["root server", m.ZONES["."].host, m.ZONES["."].ip, "zone ."],
    tld: ["TLD server", m.ZONES["com."].host, m.ZONES["com."].ip, "zone com."],
    auth: ["authoritative", m.ZONES["example.com."].host, m.ZONES["example.com."].ip, "zone example.com."],
  },
  headY: [14, 31, 45, 59],
  lifeTop: 70,
  rowY0: 92,
  rowH: 27,
  lifeEnd: 300,
  numbers: true,
  wideLabels: true,
  table: { y: 318, titleY: 334, headY: 351, rowY0: 362, rowH: 20, cols: { name: 10, type: 150, value: 196, bar: 404, barW: 190, left: 604, tag: 700 }, font: 10.5 },
  count: { x: 810, y: 306 },
};
const NARROW = {
  cls: "lay-narrow",
  W: 400,
  H: 486,
  X: { client: 24, resolver: 104, root: 194, tld: 280, auth: 356 },
  head: { client: ["you"], resolver: ["resolver"], root: ["root", "."], tld: ["TLD", "com."], auth: ["auth", "example.com."] },
  headY: [14, 31],
  lifeTop: 42,
  rowY0: 62,
  rowH: 30,
  lifeEnd: 286,
  numbers: false,
  wideLabels: false,
  table: { y: 304, titleY: 322, headY: 338, rowY0: 348, rowH: 22, cols: { name: 8, bar: 172, barW: 140, left: 318 }, font: 12 },
  count: { x: 396, y: 296 },
};

function msgSvg(L, row, from, to, kind, label, cls, data) {
  const y = L.rowY0 + row * L.rowH;
  const dir = L.X[to] > L.X[from] ? 1 : -1;
  const a = [L.X[from] + 3 * dir, y];
  const b = [L.X[to] - 3 * dir, y];
  const mid = (a[0] + b[0]) / 2;
  const num = L.numbers ? `<text class="m-num" x="12" y="${y}">${row + 1}</text>` : "";
  return (
    `<g class="msg ${cls}" ${data}${kind ? ` data-hue="${HUE[kind]}"` : ""}>${num}` +
    u.arrow(a, b, { head: 5 }) +
    `<text class="m-label" x="${mid}" y="${y - 7}">${esc(label)}</text></g>`
  );
}

function layout(L) {
  const out = [];
  for (const c of COLS) {
    const x = L.X[c];
    const lines = L.head[c]
      .map((t, i) => (t ? `<text class="hd-${i}" x="${x}" y="${L.headY[i]}">${esc(t)}</text>` : ""))
      .join("");
    const end = c === "resolver" ? L.table.y : L.lifeEnd;
    out.push(`<g class="hd" data-col="${c}"><path class="life" d="M${x} ${L.lifeTop}V${end}"/>${lines}</g>`);
  }
  // Lookup 1: fixed messages from the model.
  out.push(`<g class="m1">${m.FIRST.msgs.map((g, k) => msgSvg(L, k, g.from, g.to, g.kind, L.wideLabels ? g.label : g.short, "", `data-k="${k}"`)).join("")}</g>`);
  // Lookup 2: every possible message in every row; the page shows the ones the model sends.
  const m2 = [];
  for (let row = 0; row < 8; row++) for (const [f, t] of PAIRS) m2.push(msgSvg(L, row, f, t, "", "", "", `data-row="${row}" data-pair="${f}-${t}"`));
  out.push(`<g class="m2">${m2.join("")}</g>`);
  out.push(`<text class="count" x="${L.count.x}" y="${L.count.y}"></text>`);
  // The resolver's cache.
  const T = L.table;
  const c = T.cols;
  const heads = L.wideLabels
    ? `<text class="th" x="${c.name}" y="${T.headY}">name</text><text class="th" x="${c.type}" y="${T.headY}">type</text><text class="th" x="${c.value}" y="${T.headY}">value</text><text class="th" x="${c.bar}" y="${T.headY}">TTL left</text>`
    : `<text class="th" x="${c.name}" y="${T.headY}">name, type</text><text class="th" x="${c.bar}" y="${T.headY}">TTL left</text>`;
  const rows = [];
  for (let s = 0; s < ROWS; s++) {
    const y = T.rowY0 + s * T.rowH;
    const mid = y + T.rowH / 2;
    rows.push(
      `<g class="crow" data-s="${s}" style="--fs:${T.font}px">` +
        `<rect class="c-bg" x="2" y="${y + 1}" width="${L.W - 4}" height="${T.rowH - 2}" rx="3"/>` +
        `<text class="c-name" x="${c.name}" y="${mid}"></text>` +
        (c.type !== undefined ? `<text class="c-type" x="${c.type}" y="${mid}"></text><text class="c-value" x="${c.value}" y="${mid}"></text>` : "") +
        `<rect class="c-track" x="${c.bar}" y="${mid - 4}" width="${c.barW}" height="8" rx="2"/>` +
        `<rect class="c-bar" x="${c.bar}" y="${mid - 4}" width="${c.barW}" height="8" rx="2"/>` +
        `<text class="c-left" x="${c.left}" y="${mid}"></text>` +
        (c.tag !== undefined ? `<text class="c-tag" x="${c.tag}" y="${mid}"></text>` : "") +
        `</g>`,
    );
  }
  const tableH = T.rowY0 + ROWS * T.rowH + 6 - T.y;
  out.push(`<g class="cache"><rect class="c-box" x="0.5" y="${T.y}" width="${L.W - 1}" height="${tableH}" rx="6"/><text class="c-title" x="${c.name}" y="${T.titleY}">resolver cache</text>${heads}${rows.join("")}</g>`);
  return `<g class="lay ${L.cls}">${out.join("")}</g>`;
}

const svg = iso.figureSvg({
  width: WIDE.W,
  height: WIDE.H,
  label: "A DNS lookup for www.example.com as a sequence of messages between your computer, a recursive resolver, a root server, the com TLD server and the authoritative server, with the resolver's cache and the time each record has left.",
  body: [layout(WIDE), layout(NARROW)],
});

const hue = (h, t) => `<span data-hue="${h}">${t}</span>`;
const scenes = [
  {
    name: "Overview",
    rule: `1 ${hue("blue", "query")} → 2 ${hue("gold", "referrals")} → 1 ${hue("green", "answer")} → every record cached`,
    say: `One question from you makes the resolver ask three servers in turn. Each server knows one level of the name, read from right to left.`,
  },
  {
    name: "Ask",
    rule: `resolver cache = root hints only`,
    say: `Your computer sends one ${hue("blue", "query")} to a <b>recursive resolver</b> and waits. The resolver's cache starts with only the root server addresses, from a built-in hints file.`,
  },
  {
    name: "Root",
    rule: `root: not mine → ${hue("gold", "referral")} to com. (NS + glue)`,
    say: `The root server does not know www.example.com. It sends a ${hue("gold", "referral")}: the names and addresses of the com. servers.`,
  },
  {
    name: "TLD",
    rule: `com.: not mine → ${hue("gold", "referral")} to example.com.`,
    say: `The TLD server knows only which servers run example.com. The ${hue("gold", "referral")} also carries their address (glue), so the resolver can ask at once.`,
  },
  {
    name: "Authoritative",
    rule: `example.com.: mine → ${hue("green", "answer")} (flag aa), cache for its TTL`,
    say: `The authoritative server holds the record and sends the ${hue("green", "answer")}. The resolver stores it for its TTL (time to live) and passes it to you.`,
  },
  {
    name: "Second lookup",
    math: `<mrow><mi>TTL left</mi><mo>=</mo><mi>TTL</mi><mo>−</mo><mi mathvariant="normal">Δ</mi><mi>t</mi></mrow>`,
    say: `Each cached record lives for its TTL, counted from when it arrived. A live ${hue("green", "A record")} answers at once, so the resolver asks no server.`,
  },
  {
    name: "TTL runs out",
    rule: `start at the lowest zone whose ${hue("gold", "NS record")} still lives`,
    say: `When a TTL runs out, the resolver drops only that record. It starts the walk at the lowest zone whose ${hue("gold", "NS record")} still lives.`,
  },
];

const css = [
  `.lay-narrow{display:none}.u-stage[data-narrow] .lay-wide{display:none}.u-stage[data-narrow] .lay-narrow{display:inline}`,
  `.hd text{text-anchor:middle;dominant-baseline:central}`,
  `.hd-0{font:500 12.5px ui-sans-serif,system-ui,sans-serif;fill:var(--anatomy-text);transition:fill .3s}`,
  `.lay-narrow .hd-0{font-size:13px}`,
  `.hd-1{font:10.5px var(--anatomy-mono);fill:var(--anatomy-text)}.lay-narrow .hd-1{font-size:12px;fill:var(--anatomy-muted)}`,
  `.hd-2,.hd-3{font:10px var(--anatomy-mono);fill:var(--anatomy-muted)}`,
  `.hd[data-on] .hd-0{fill:var(--anatomy-strong)}`,
  `.life{stroke:var(--anatomy-faint);stroke-width:1;stroke-dasharray:3 3;transition:stroke .3s}`,
  `.hd[data-on] .life{stroke:var(--anatomy-mid)}`,
  `.msg{opacity:0;transition:opacity .35s var(--anatomy-ease)}`,
  `.msg[data-show]{opacity:1}`,
  `.msg .u-arrow{color:var(--hue)}`,
  `.msg .u-arrow-line{stroke-width:1.5;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset .55s var(--anatomy-ease)}`,
  `.msg[data-show] .u-arrow-line{stroke-dashoffset:0}`,
  `.msg .u-arrow-head{opacity:0;transition:opacity .2s .45s}.msg[data-show] .u-arrow-head{opacity:1}`,
  `.m-label{font:10.5px var(--anatomy-mono);fill:var(--hue);text-anchor:middle;paint-order:stroke;stroke:var(--anatomy-card);stroke-width:4px;stroke-linejoin:round}`,
  `.lay-narrow .m-label{font-size:12px}`,
  `.m-num{font:10px var(--anatomy-mono);fill:var(--anatomy-muted);text-anchor:middle;dominant-baseline:central}`,
  `.m1,.m2{transition:opacity .6s var(--anatomy-ease)}`,
  `.u-stage:is([data-scene="5"],[data-scene="6"]) .m1{opacity:.16}`,
  `.u-stage:is([data-scene="5"],[data-scene="6"]) .m1 :is(.m-label,.m-num){opacity:0}`,
  `.u-stage:not([data-scene="5"]):not([data-scene="6"]) :is(.m2,.count){opacity:0}`,
  `.count{font:11px var(--anatomy-mono);fill:var(--anatomy-strong);text-anchor:end;transition:opacity .4s}`,
  `.c-box{fill:var(--anatomy-faint);fill-opacity:.1;stroke:var(--anatomy-faint);stroke-width:.8}`,
  `.c-title{font:500 11px var(--anatomy-mono);fill:var(--anatomy-strong);letter-spacing:.04em}.lay-narrow .c-title{font-size:12px}`,
  `.th{font:10px var(--anatomy-mono);fill:var(--anatomy-muted)}.lay-narrow .th{font-size:11px}`,
  `.crow{opacity:0;transition:opacity .4s}.crow[data-show]{opacity:1}`,
  `.crow text{font:var(--fs) var(--anatomy-mono);fill:var(--anatomy-text);dominant-baseline:central}`,
  `.crow .c-name{fill:var(--anatomy-strong)}.crow .c-type,.crow .c-tag{fill:var(--hue)}`,
  `.c-bg{fill:var(--hue);fill-opacity:0;stroke:none;transition:fill-opacity .4s}`,
  `.crow[data-state="new"] .c-bg,.crow[data-state="renewed"] .c-bg{fill-opacity:.12}`,
  `.crow[data-used] .c-bg{fill-opacity:.06;stroke:var(--anatomy-strong);stroke-width:1.2}`,
  `.c-track{fill:var(--anatomy-faint);fill-opacity:.35}`,
  `.c-bar{fill:var(--hue);transform-box:fill-box;transform-origin:0 50%;transform:scaleX(var(--v,1));transition:transform .7s var(--anatomy-ease)}`,
  `.crow[data-state="expired"] :is(.c-name,.c-type,.c-value,.c-left){fill:var(--anatomy-muted);text-decoration:line-through}`,
  `.crow[data-state="expired"] .c-track{fill:none;stroke:var(--hue);stroke-width:.8;stroke-dasharray:2 2}`,
  `.crow[data-hints] :is(.c-track,.c-bar){display:none}`,
  `.el-pick{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 8px}`,
  `.el-pick .el-lbl{font:11px var(--anatomy-mono);color:var(--anatomy-muted)}`,
  `.el-sep{width:1px;height:18px;background:var(--anatomy-faint);margin:0 4px}`,
].join("\n");

const key = u.keyHtml([
  { hue: "blue", label: "query" },
  { hue: "gold", label: "referral: NS records" },
  { hue: "green", label: "answer: A record" },
]);

const short = (n) => n.replace(/\.$/, "");
const controls =
  `<div class="el-pick" role="group" aria-label="Second lookup">` +
  `<span class="el-lbl">lookup 2</span>` +
  m.NAMES.map((n, i) => `<button type="button" data-name="${n}" aria-pressed="${i === 0}">${short(n)}</button>`).join("") +
  `<span class="el-sep"></span><label>after <input type="number" id="dt" min="0" max="${m.DT_MAX}" step="1" value="60"> s</label>` +
  [["1 min", 60], ["10 min", 600], ["3 days", 259200]].map(([t, v]) => `<button type="button" data-dt="${v}">${t}</button>`).join("") +
  `</div>`;

const stage = u.stageHtml({
  dwell: 7500,
  scenes,
  svg,
  label: "DNS lookup explainer. Left and right arrows change the scene. Comma and period step through lookup 1. Up and down arrows pick the name for lookup 2.",
  css,
  key,
  time: { steps: 9, scenes: [1, 2, 3, 4], label: "message" },
  controls,
  controlScenes: [5, 6],
  narrow: [NARROW.W, NARROW.H],
});

const live = `
${u.modelScript([m.hints, m.alive, m.roleOf, m.pathOf, m.lookup, m.cacheRows, m.scenario], { ZONES: m.ZONES, ANSWERS: m.ANSWERS, NAMES: m.NAMES, DT_MAX: m.DT_MAX })}
const HUE = ${JSON.stringify(HUE)};
const RANGES = [[8, 8], [0, 1], [2, 3], [4, 5], [6, 8]];
const PRESET = { 5: 60, 6: 600 };
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const field = root.querySelector("#dt");
const FIRST = lookup("www.example.com.", hints(), 0);
const SHORT = (n) => n.replace(/\\.$/, "");
let step = 8;
let name2 = NAMES[0];
let dt = 60;
let shown2 = 8;
let crossing = false;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function headers(on, authZone) {
  const z = ZONES[authZone];
  root.querySelectorAll(".hd").forEach((h) => h.toggleAttribute("data-on", on.includes(h.dataset.col)));
  root.querySelectorAll('.lay-wide .hd[data-col="auth"]').forEach((h) => {
    h.querySelector(".hd-1").textContent = z.host;
    h.querySelector(".hd-2").textContent = z.ip;
    h.querySelector(".hd-3").textContent = "zone " + authZone;
  });
  root.querySelectorAll('.lay-narrow .hd[data-col="auth"] .hd-1').forEach((t) => (t.textContent = authZone));
}
function table(rows, usedKey) {
  root.querySelectorAll(".crow").forEach((g) => {
    const r = rows[Number(g.dataset.s)];
    g.toggleAttribute("data-show", !!r);
    if (!r) return;
    const narrow = !!g.closest(".lay-narrow");
    g.dataset.hue = r.type === "A" ? "green" : "gold";
    g.dataset.state = r.state;
    g.toggleAttribute("data-hints", r.left === null);
    g.toggleAttribute("data-used", usedKey === r.name + " " + r.type);
    const more = r.more ? " +" + r.more : "";
    g.querySelector(".c-name").textContent = narrow ? r.name + " " + r.type : r.name;
    if (!narrow) {
      g.querySelector(".c-type").textContent = r.type;
      g.querySelector(".c-value").textContent = r.value + more;
      const tag = { new: "new", renewed: "renewed", expired: "expired", kept: "" }[r.state];
      g.querySelector(".c-tag").textContent = usedKey === r.name + " " + r.type ? "used" + (tag && tag !== "expired" ? ", " + tag : "") : tag;
    }
    g.querySelector(".c-bar").style.setProperty("--v", r.share.toFixed(4));
    g.querySelector(".c-left").textContent = r.left === null ? "hints file" : r.left <= 0 ? "0 s" : r.left + " s";
  });
}

// Lookup 1, after t messages.
function show1(t) {
  step = Math.max(0, Math.min(8, t));
  root.querySelectorAll(".m1 .msg").forEach((g) => g.toggleAttribute("data-show", Number(g.dataset.k) < step));
  const cache = step === 0 ? hints() : FIRST.snaps[step - 1];
  const before = step <= 1 ? hints() : FIRST.snaps[step - 2];
  table(cacheRows(cache, 0, before), null);
  const g = FIRST.msgs[step - 1];
  headers(g ? [g.from, g.to] : [], "example.com.");
  UNFOLD.timeAt(step);
  say(g ? step + " · " + g.from + " → " + g.to + " · " + g.line : "0 · nothing sent yet · the cache holds the root hints only");
}

// Lookup 2: name2 after dt seconds, showing its first n messages.
function show2(n) {
  const S = scenario(name2, dt);
  const msgs = S.second.msgs;
  shown2 = Math.min(n, msgs.length);
  root.querySelectorAll(".m2 .msg").forEach((g) => g.removeAttribute("data-show"));
  msgs.slice(0, shown2).forEach((g, row) => {
    root.querySelectorAll('.m2 .msg[data-row="' + row + '"][data-pair="' + g.from + "-" + g.to + '"]').forEach((el) => {
      el.dataset.hue = HUE[g.kind];
      el.querySelector(".m-label").textContent = el.closest(".lay-narrow") ? g.short : g.label;
      el.setAttribute("data-show", "");
    });
  });
  table(S.rows, S.second.used[0]);
  const zone = name2.includes("google") ? "google.com." : "example.com.";
  const last = msgs[shown2 - 1];
  headers(last ? [last.from, last.to] : [], zone);
  root.querySelectorAll(".count").forEach((t) => (t.textContent = "lookup 1: 8 messages · lookup 2: " + msgs.length + " messages"));
  // The readout: the TTL arithmetic that decided where lookup 2 starts.
  const old = (nm, type) => FIRST.cache.find((e) => e.name === nm && e.type === type);
  const a = old(name2, "A");
  const parts = ["Δt " + dt + " s"];
  if (a) parts.push("A: " + a.ttl + " − " + dt + (a.ttl - dt > 0 ? " = " + (a.ttl - dt) + " s left, from cache" : " ≤ 0, expired"));
  else parts.push("A not cached");
  if (S.second.start) {
    const ns = old(S.second.start, "NS");
    parts.push(S.second.start === "." ? "NS expired, start at root" : S.second.start + " NS: " + (ns.ttl - dt) + " s left");
  }
  parts.push(msgs.length + " messages");
  say(parts.join(" · "));
}

function setInputs(name, value, writeField) {
  if (name) name2 = name;
  if (value !== undefined) dt = value;
  root.querySelectorAll("[data-name]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.name === name2)));
  root.querySelectorAll("[data-dt]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.dt) === dt)));
  if (writeField) field.value = String(dt);
}
// A control used outside scenes 5 and 6 moves there first, so the reader sees what changed.
function own() {
  UNFOLD.pause();
  if (UNFOLD.scene() < 5) UNFOLD.go(5);
}
root.querySelectorAll("[data-name]").forEach((b) => b.addEventListener("click", () => { own(); setInputs(b.dataset.name); show2(8); }));
root.querySelectorAll("[data-dt]").forEach((b) => b.addEventListener("click", () => { own(); setInputs(null, Number(b.dataset.dt), true); show2(8); }));
field.addEventListener("input", () => {
  const v = Number(field.value);
  if (field.value === "" || !Number.isFinite(v)) return;
  own();
  setInputs(null, Math.round(Math.max(0, Math.min(DT_MAX, v))), false);
  show2(8);
});
field.addEventListener("change", () => (field.value = String(dt)));

function stepTo(t) {
  const s = UNFOLD.scene();
  const target = Math.max(0, Math.min(8, t));
  const owner = RANGES.findIndex((r, i) => i > 0 && target >= r[0] && target <= r[1]);
  if (s === 0 || s >= 5 || target < RANGES[s][0] || target > RANGES[s][1]) {
    crossing = true;
    UNFOLD.go(owner);
    crossing = false;
  }
  show1(target);
}
root.addEventListener("unfold:scene", (e) => {
  const s = e.detail.scene;
  if (s >= 5) {
    setInputs(null, PRESET[s], true);
    show2(UNFOLD.narrow() || matchMedia("(prefers-reduced-motion: reduce)").matches ? 8 : 1);
  } else if (!crossing) show1(s === 0 ? 8 : RANGES[s][0] + (s === 1 ? 1 : 0));
});
root.addEventListener("unfold:layout", () => (UNFOLD.scene() >= 5 ? show2(shown2) : show1(step)));
[1, 2, 3, 4].forEach((s) => UNFOLD.beat(s, 1200, (n) => show1(n < 0 ? RANGES[s][1] : Math.min(RANGES[s][0] + (s === 1 ? 1 : 0) + n, RANGES[s][1])), 1000));
[5, 6].forEach((s) => UNFOLD.beat(s, 900, (n) => show2(n < 0 ? 8 : n + 2), 700));
UNFOLD.onTime(stepTo);
root.addEventListener("keydown", (e) => {
  const by = { ArrowUp: -1, ArrowDown: 1 }[e.key];
  if (by === undefined) return;
  e.preventDefault();
  own();
  setInputs(NAMES[(NAMES.indexOf(name2) + by + NAMES.length) % NAMES.length]);
  show2(8);
});
show1(8);
`;

// Notes: the real records, the lookup 2 cases from the model, what is left out, and the terms.
const caseRow = (name) => [
  `<code>${short(name)}</code>`,
  ...m.PRESETS.map((dt) => {
    const s = m.scenario(name, dt).second;
    const asked = s.msgs.filter((g) => g.from === "resolver" && g.to !== "client").map((g) => g.to);
    return `${s.msgs.length} messages${asked.length ? ` · ${asked.join(", ")}` : " · cache only"}`;
  }),
];
const notes = u.notesHtml([
  {
    title: "Lookup 1, message by message",
    html: `<p>Each line is what <code>dig +norecurse</code> showed when asked the same server directly.</p>`,
    table: {
      head: ["#", "from → to", "record"],
      rows: m.FIRST.msgs.map((g, k) => [String(k + 1), `${g.from} → ${g.to}`, `<code>${esc(g.line)}</code>`]),
    },
  },
  {
    title: "Lookup 2: which servers does it need?",
    html: `<p>Computed by the same model as the figure. All names are in com., so the com. NS record helps all three.</p>`,
    table: { head: ["name", "after 1 min", "after 10 min", "after 3 days"], rows: m.NAMES.map(caseRow) },
  },
  {
    title: "What the figure leaves out",
    table: {
      head: ["topic", "in a real resolver"],
      rows: [
        ["13 servers per level", "There are 13 root names and 13 com. names. The resolver picks one by its measured round-trip time."],
        ["QNAME minimisation", "Many resolvers ask the root only <code>com. NS?</code>, not the full name (RFC 9156)."],
        ["Other caches", "The browser and the operating system keep their own cache in front of the resolver."],
        ["Negative answers", "A name that does not exist (NXDOMAIN) is cached too, for a time set by the zone (RFC 2308)."],
        ["No glue", "example.org's servers are in cloudflare.com, so .org cannot send their address. The resolver looks them up first."],
        ["Left out", "AAAA (IPv6) records, DNSSEC, TCP fallback and retries after a timeout."],
      ],
    },
  },
  {
    title: "Terms",
    table: {
      head: ["term", "meaning"],
      rows: [
        ["recursive resolver", "Server that asks other servers until it has the answer."],
        ["zone", "Part of the name tree that one set of servers runs."],
        ["NS record", "Names a server for a zone."],
        ["glue", "Address of an NS server, sent with the referral."],
        ["referral", "Reply that says which servers to ask next."],
        ["A record", "IPv4 address of a name."],
        ["aa flag", "Set when the reply comes from the zone's own server."],
        ["TTL", "Seconds a resolver may keep a record in its cache."],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "A DNS lookup, then a cached one",
    hint: "← → scene · , . message",
    readout: "8 · resolver → client · " + m.FIRST.msgs[7].line,
    caption:
      "Servers, records, TTLs and glue addresses are real, captured with dig +norecurse on 16 Oct 2026. Run node model.mjs --dig to compare them with the live servers again. The resolver is a small model: one server per zone, A records only, times in seconds after lookup 1. The names and delays for lookup 2 are presets you can change.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "page-light.html" : "page.html");
const title = "A DNS lookup, then a cached one";
const html = artifact > 0 ? u.artifactHtml({ title, body, script: live }) : u.pageHtml({ title, theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
