import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as m from "./model.mjs";

const u = await import(pathToFileURL(join(homedir(), ".claude/skills/unfold/kit/concept-kit.mjs")).href);
const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const light = process.argv.includes("--light");
const dark = process.argv.includes("--dark"); // dark build, only for the checks

const W = 820;
const H = 340;
const ROW = 40; // bucket row pitch
const NODE = 104; // chain node pitch
const X0 = 90; // first chain node
const ARRAY_AT = { wide: [440, 0], narrow: [40, 316] };
const PIPE_AT = { wide: [24, 26], narrow: [24, 10] };

// Colour identity.
const HUE = { hash: "blue", index: "gold", load: "purple", over: "red", moved: "teal", find: "green" };

// Each scene shows one snapshot of the real insert sequence.
const STEPS = m.build();
const AT = [0, 2, 2, 3, 4, 6];
const SNAP = AT.map((i) => STEPS[i]);
const FOCUS = ["apple", "kiwi", "kiwi", "lime", "pear", "fig"];
const N = SNAP.length;
const rowY = (b) => 6 + b * ROW;
const where = (snap, key) => {
  for (let b = 0; b < snap.table.length; b++) {
    const p = snap.table[b].indexOf(key);
    if (p >= 0) return { b, p, last: p === snap.table[b].length - 1 };
  }
  return null;
};

// ---- Bucket array (in the array group) ----
const buckets = Array.from({ length: 8 }, (_, b) =>
  `<g class="u-move bk" id="b-${b}" data-b="${b}"><text class="idx" x="8" y="14">${b}</text><rect class="cell" x="18" width="44" height="28" rx="3"/>` +
  `<path class="null" d="M24 24L56 4"/><circle class="dot" cx="40" cy="14" r="2.6"/></g>`,
);
const nodes = m.INSERTS.map((k) =>
  `<g class="u-move hk" id="k-${k}" data-key="${k}">` +
  u.arrow([-50, 14], [-1, 14], { head: 5 }).replace('class="u-arrow"', 'class="u-arrow in-b"') +
  u.arrow([-37, 14], [-1, 14], { head: 5 }).replace('class="u-arrow"', 'class="u-arrow in-n"') +
  `<g class="body"><rect class="k" width="60" height="28" rx="4"/><text class="kt" x="30" y="14">${k}</text>` +
  `<rect class="p" x="60" width="14" height="28" rx="2"/><path class="null" d="M62 25L72 3"/><circle class="dot" cx="67" cy="14" r="2.4"/></g>` +
  `<g class="cmpb"><circle cx="2" cy="1" r="7.5"/><text x="2" y="1.5">1</text></g></g>`,
);

// Labels that belong to one scene, beside the thing they name.
const labels = [];
const label = (scene, x, y, text, hue) => labels.push({ scene, x, y, text, hue });
label(1, X0 + NODE + 84, rowY(1) + 14, "collision", "ink");
for (const k of m.INSERTS.slice(0, 4)) {
  const before = where(SNAP[3], k);
  const after = where(SNAP[4], k);
  if (before.b !== after.b) label(4, X0 + after.p * NODE + 84, rowY(after.b) + 14, `was ${before.b} · +4`, HUE.moved);
  else label(4, X0 + after.p * NODE + 84, rowY(after.b) + 14, `stays ${after.b}`, "ink");
}
label(5, X0 + NODE + 84, rowY(5) + 14, "collision", "ink");
const labelSvg = labels.map((l, i) => `<g class="u-move lab" id="lab-${i}"><text x="0" y="0"${l.hue !== "ink" ? ` data-hue="${l.hue}"` : ""}>${l.text}</text></g>`);

// ---- The hash pipeline (in the pipe group) ----
const bitCells = Array.from({ length: 8 }, (_, j) => `<g class="bit" data-bit="${7 - j}" transform="translate(${40 + j * 25} 112)"><rect width="22" height="22" rx="3"/><text x="11" y="11">0</text></g>`).join("");
const pipe =
  `<g class="pipe">` +
  `<text class="lbl" x="0" y="14">key</text>` +
  `<g class="u-chip pk" transform="translate(40 0)"><rect width="120" height="28" rx="4"/><text x="60" y="14" data-pk>apple</text></g>` +
  u.arrow([100, 30], [100, 56], { hue: HUE.hash }) +
  `<text class="lbl" x="112" y="47" data-hue="${HUE.hash}">FNV-1a hash</text>` +
  `<text class="lbl" x="0" y="80">h</text><text class="hv" x="40" y="80" data-hv data-hue="${HUE.hash}">0</text>` +
  `<text class="lbl" x="40" y="104">last 8 bits of h</text>` +
  bitCells +
  `<text class="lbl small" x="240" y="127" data-lowlbl>mod 4 = last 2 bits</text>` +
  u.arrow([100, 138], [100, 160], { hue: HUE.index }) +
  `<text class="lbl" x="112" y="153" data-hue="${HUE.index}" data-modlbl>mod m</text>` +
  `<text class="lbl" x="0" y="181">i</text>` +
  `<g class="ibox" transform="translate(40 166)"><rect width="44" height="30" rx="4"/><text x="22" y="15" data-iv>3</text></g>` +
  `<text class="lbl" x="96" y="181" data-ilbl>bucket index</text>` +
  `<text class="lbl" x="0" y="232" data-hue="${HUE.load}">load factor n / m</text>` +
  `<rect class="track" x="0" y="242" width="300" height="12" rx="6"/>` +
  `<rect class="fill" x="0" y="242" width="300" height="12" rx="6" data-fill/>` +
  `<path class="limit" d="M180 236V260"/><text class="lbl small" x="180" y="272" text-anchor="middle" data-hue="${HUE.over}">limit 0.75</text>` +
  `<text class="lv" x="0" y="290" data-lv>1 / 4 = 0.25</text>` +
  `</g>`;

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "A hash table with chaining. Six keys are hashed into buckets. Two keys collide and form a chain. The table doubles from 4 to 8 buckets when it is too full.",
  body: [
    `<path class="route" data-route d="M0 0"/>`,
    `<g class="grp-pipe">${pipe}</g>`,
    `<g class="grp-array">${buckets.join("")}${nodes.join("")}${labelSvg.join("")}</g>`,
  ],
});

// ---- Per-scene places and looks ----
const css = [];
const S = (i) => `.u-stage[data-scene="${i}"]`;
for (let b = 0; b < 8; b++) css.push(u.placeCss(`#b-${b}`, SNAP.map((s) => (b < s.m ? { x: 0, y: rowY(b) } : null))));
for (const k of m.INSERTS) {
  const place = SNAP.map((s) => {
    const w = where(s, k);
    return w ? { x: X0 + w.p * NODE, y: rowY(w.b) } : null;
  });
  const first = place.findIndex(Boolean);
  if (first > 0) place[first - 1] = { ...place[first], y: place[first].y - 34, o: 0 };
  css.push(u.placeCss(`#k-${k}`, place));
  SNAP.forEach((s, i) => {
    const w = where(s, k);
    if (!w) return;
    css.push(`${S(i)} #k-${k} .${w.p === 0 ? "in-b" : "in-n"}{opacity:1}`);
    if (!w.last) css.push(`${S(i)} #k-${k} .dot{opacity:1}`, `${S(i)} #k-${k} .null{opacity:0}`);
  });
}
SNAP.forEach((s, i) => s.table.forEach((c, b) => c.length && css.push(`${S(i)} #b-${b} .dot{opacity:1}`, `${S(i)} #b-${b} .null{opacity:0}`)));
labels.forEach((l, i) => css.push(u.placeCss(`#lab-${i}`, SNAP.map((_, s) => (s === l.scene ? { x: l.x, y: l.y } : null)))));
for (const k of m.INSERTS.slice(0, 4)) if (where(SNAP[3], k).b !== where(SNAP[4], k).b) css.push(`${S(4)} #k-${k} .k{stroke:var(--unfold-${HUE.moved});fill:color-mix(in srgb,var(--unfold-${HUE.moved}) 14%,var(--anatomy-card))}`);
css.push(
  `.grp-pipe{transform:translate(${PIPE_AT.wide[0]}px,${PIPE_AT.wide[1]}px)}.grp-array{transform:translate(${ARRAY_AT.wide[0]}px,${ARRAY_AT.wide[1]}px)}`,
  `.u-stage[data-narrow] .grp-pipe{transform:translate(${PIPE_AT.narrow[0]}px,${PIPE_AT.narrow[1]}px)}.u-stage[data-narrow] .grp-array{transform:translate(${ARRAY_AT.narrow[0]}px,${ARRAY_AT.narrow[1]}px)}.u-stage[data-narrow] .route{display:none}`,
  `.lbl{font:12px var(--anatomy-mono);fill:var(--anatomy-muted)}.lbl.small{font-size:11px}.lbl[data-hue],.lab text[data-hue],.hv[data-hue]{fill:var(--hue)}`,
  `.hv{font:600 18px var(--anatomy-mono);font-variant-numeric:tabular-nums}`,
  `.lv{font:13px var(--anatomy-mono);fill:var(--anatomy-text)}`,
  `.pk rect{fill:var(--anatomy-card);stroke:var(--anatomy-strong);stroke-width:1.2}.pk text{font:500 14px var(--anatomy-mono);fill:var(--anatomy-strong)}`,
  `.bit rect{fill:var(--anatomy-card);stroke:var(--anatomy-faint);transition:fill .3s,stroke .3s}.bit text{font:12px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central;text-anchor:middle}`,
  `.bit[data-low] rect{stroke:var(--unfold-${HUE.index});fill:color-mix(in srgb,var(--unfold-${HUE.index}) 22%,var(--anatomy-card))}.bit[data-low] text{fill:var(--anatomy-strong)}`,
  `.bit[data-new] rect{stroke:var(--unfold-${HUE.moved});stroke-width:2}`,
  `.ibox rect{fill:color-mix(in srgb,var(--unfold-${HUE.index}) 22%,var(--anatomy-card));stroke:var(--unfold-${HUE.index})}.ibox text{font:600 16px var(--anatomy-mono);fill:var(--anatomy-strong);dominant-baseline:central;text-anchor:middle}`,
  `.track{fill:var(--anatomy-faint);opacity:.5}.fill{fill:var(--unfold-${HUE.load});transform-box:fill-box;transform-origin:left;transition:transform .7s,fill .3s}.fill[data-over]{fill:var(--unfold-${HUE.over})}`,
  `.limit{stroke:var(--unfold-${HUE.over});stroke-width:1.5;stroke-dasharray:3 2}`,
  `.idx{font:12px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central;text-anchor:middle}`,
  `.bk .cell{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1;transition:stroke .3s,fill .3s}`,
  `.bk[data-lit] .cell{stroke:var(--unfold-${HUE.index});stroke-width:2;fill:color-mix(in srgb,var(--unfold-${HUE.index}) 18%,var(--anatomy-card))}.bk[data-lit] .idx{fill:var(--unfold-${HUE.index});font-weight:700}`,
  `.null{stroke:var(--anatomy-mid);stroke-width:1;transition:opacity .4s}.dot{fill:var(--anatomy-strong);opacity:0;transition:opacity .4s}`,
  `.hk .in-b,.hk .in-n{opacity:0;transition:opacity .4s}`,
  `.hk .k{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1;transition:stroke .3s,fill .3s}.hk .p{fill:var(--anatomy-card);stroke:var(--anatomy-mid);stroke-width:1}`,
  `.kt{font:500 13px var(--anatomy-mono);fill:var(--anatomy-strong);dominant-baseline:central;text-anchor:middle}.hk{cursor:pointer}`,
  `.hk[data-focus] .k{stroke:var(--anatomy-strong);stroke-width:2.2}`,
  `.hk[data-cmp] .k{stroke:var(--unfold-${HUE.find});stroke-width:2;stroke-dasharray:4 2}.hk[data-cmp][data-hit] .k{stroke-dasharray:none;fill:color-mix(in srgb,var(--unfold-${HUE.find}) 22%,var(--anatomy-card))}`,
  `.cmpb{opacity:0;transition:opacity .25s}.hk[data-cmp] .cmpb{opacity:1}.cmpb circle{fill:var(--unfold-${HUE.find})}.cmpb text{font:700 10px var(--anatomy-mono);fill:var(--anatomy-card);dominant-baseline:central;text-anchor:middle}`,
  `.lab text{font:12px var(--anatomy-mono);fill:var(--anatomy-muted);dominant-baseline:central}`,
  `.route{fill:none;stroke:var(--unfold-${HUE.index});stroke-width:1.2;stroke-dasharray:4 3;opacity:.8;transition:d .6s}`,
  `.u-controls input[type=text]{width:12ch;padding:4px 6px;border:0;border-radius:6px;background:transparent;color:var(--anatomy-text);font:12px var(--anatomy-mono);box-shadow:0 0 0 1px var(--anatomy-faint)}`,
  `.pick{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 8px}`,
  `@container (max-width:520px){.lab text{font-size:11px}}`,
);

// ---- Math and sentences ----
const h = (k) => m.fnv1a(k);
const mn = (v, hue) => `<mn${hue ? ` data-hue="${hue}"` : ""}>${v}</mn>`;
const hk = (k) => `${u.mi("h", HUE.hash)}${u.mo("(")}<mtext>${k}</mtext>${u.mo(")")}`;
const MOD = `<mo lspace="0.4em" rspace="0.4em">mod</mo>`;
const alpha = u.mi("α", HUE.load);
const scenes = [
  {
    name: "Hash",
    math: `${u.mi("i", HUE.index)}<mo>=</mo>${hk("k").replace("<mtext>k</mtext>", u.mi("k"))}${MOD}${u.mi("m")}<mo>=</mo>${mn(h("apple"), HUE.hash)}${MOD}${mn(4)}<mo>=</mo>${mn(m.bucketOf("apple", 4), HUE.index)}`,
    say: `A <b data-hue="${HUE.hash}">hash function</b> turns the key into a 32-bit number h. The remainder h mod 4 is the <b data-hue="${HUE.index}">bucket index</b>.`,
  },
  {
    name: "Collide",
    math: `${hk("pear")}${MOD}${mn(4)}<mo>=</mo>${hk("kiwi")}${MOD}${mn(4)}<mo>=</mo>${mn(1, HUE.index)}`,
    say: `pear and kiwi get the same index, so they collide. kiwi joins a chain after pear in bucket 1.`,
  },
  {
    name: "Find",
    math: `<mi>T</mi>${u.mo("[")}${mn(1, HUE.index)}${u.mo("]")}<mo>:</mo><mspace width="0.4em"/><mtext>pear</mtext><mo>≠</mo><mtext>kiwi</mtext><mo>,</mo><mspace width="0.6em"/><mtext>kiwi</mtext><mo>=</mo><mtext>kiwi</mtext>`,
    say: `To find a key, the table hashes it again to get the same bucket. Then it <b data-hue="${HUE.find}">compares</b> the key with each key in that chain.`,
  },
  {
    name: "Too full",
    math: `${alpha}<mo>=</mo><mfrac><mi>n</mi><mi>m</mi></mfrac><mo>=</mo><mfrac>${mn(4)}${mn(4)}</mfrac><mo>=</mo>${mn("1.00", HUE.over)}<mo>&gt;</mo>${mn("0.75", HUE.over)}`,
    say: `lime makes 4 keys in 4 buckets. The <b data-hue="${HUE.load}">load factor</b> is now above the <b data-hue="${HUE.over}">limit</b>, so chains will get long.`,
  },
  {
    name: "Grow",
    math: `${u.mi("h")}${MOD}${mn(8)}<mo>=</mo>${u.mi("h")}${MOD}${mn(4)}<mo>+</mo>${mn(4)}<mo>·</mo><msub>${u.mi("b", HUE.moved)}${mn(2)}</msub>`,
    say: `The table doubles to 8 buckets and puts every key in again. One more bit of h decides if a key <b data-hue="${HUE.moved}">moves</b> from i to i + 4.`,
  },
  {
    name: "Spread",
    math: `${alpha}<mo>=</mo><mfrac>${mn(6)}${mn(8)}</mfrac><mo>=</mo>${mn("0.75", HUE.load)}<mo>≤</mo>${mn("0.75", HUE.over)}`,
    say: `fig and peach arrive. Collisions still happen, but chains stay short until the load factor passes the limit again.`,
  },
];

const key = u.keyHtml([
  { hue: HUE.hash, label: "hash h" },
  { hue: HUE.index, label: "bucket index i" },
  { hue: HUE.load, label: "load factor n / m" },
  { hue: HUE.over, label: "limit 0.75" },
  { hue: HUE.moved, label: "key that moves" },
  { hue: HUE.find, label: "compare" },
]);

const controls =
  `<div class="pick">` +
  m.INSERTS.map((k) => `<button type="button" data-pick="${k}">${k}</button>`).join("") +
  `<label>try a key <input type="text" maxlength="16" spellcheck="false" autocomplete="off" data-try aria-label="Type any key to see its hash and bucket"></label></div>`;

const stage = u.stageHtml({
  dwell: 7000,
  scenes,
  svg,
  label: "Hash table explainer. Left and right arrows change the scene. Up and down arrows pick the key. The text field hashes any key you type.",
  css: css.join("\n"),
  key,
  controls,
  narrow: [400, 650],
});

// ---- Page script: every number comes from the model's own functions ----
const DATA = SNAP.map((s, i) => ({ m: s.m, n: s.n, table: s.table, focus: FOCUS[i] }));
const live = `
${u.modelScript([m.fnv1a, m.bucketOf, m.lookup, m.bits], { DATA, KEYS: m.INSERTS, LIMIT: m.LIMIT, ROW, ARRAY_AT, PIPE_AT })}
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
const field = root.querySelector("[data-try]");
const $ = (s) => root.querySelector(s);
let focus = DATA[0].focus;
let shown = 99;
const FIND = 2, GROW = 4;
function draw() {
  const s = UNFOLD.scene();
  const d = DATA[s];
  const h = fnv1a(focus);
  const i = h % d.m;
  const lowBits = Math.log2(d.m);
  $("[data-pk]").textContent = focus;
  $("[data-hv]").textContent = String(h);
  const b = bits(h);
  root.querySelectorAll(".bit").forEach((g) => {
    const j = Number(g.dataset.bit);
    g.querySelector("text").textContent = b[7 - j];
    g.toggleAttribute("data-low", j < lowBits);
    g.toggleAttribute("data-new", s === GROW && j === lowBits - 1);
  });
  $("[data-lowlbl]").textContent = "mod " + d.m + " = last " + lowBits + " bits";
  $("[data-modlbl]").textContent = "mod " + d.m;
  $("[data-iv]").textContent = String(i);
  $("[data-ilbl]").textContent = "bucket index of " + d.m;
  const alpha = d.n / d.m;
  const fill = $("[data-fill]");
  fill.style.transform = "scaleX(" + Math.min(alpha / 1.25, 1) + ")";
  fill.toggleAttribute("data-over", alpha > LIMIT);
  $("[data-lv]").textContent = "n / m = " + d.n + " / " + d.m + " = " + alpha.toFixed(2) + (alpha > LIMIT ? "  > 0.75: grow" : "");
  root.querySelectorAll(".bk").forEach((g) => g.toggleAttribute("data-lit", Number(g.dataset.b) === i));
  const narrow = UNFOLD.narrow();
  if (!narrow) {
    const x1 = PIPE_AT.wide[0] + 262, y1 = PIPE_AT.wide[1] + 181;
    const x2 = ARRAY_AT.wide[0] - 4, y2 = ARRAY_AT.wide[1] + 6 + i * ROW + 14;
    $("[data-route]").style.d = 'path("M' + x1 + " " + y1 + "C" + (x2 - 14) + " " + y1 + " " + (x2 - 34) + " " + y2 + " " + x2 + " " + y2 + '")';
  }
  const found = s === FIND ? lookup(d.table, focus) : null;
  root.querySelectorAll(".hk").forEach((g) => {
    const k = g.dataset.key;
    g.toggleAttribute("data-focus", k === focus);
    const at = found ? found.compared.indexOf(k) : -1;
    g.toggleAttribute("data-cmp", at >= 0 && at < shown);
    g.toggleAttribute("data-hit", found !== null && found.found && at === found.compared.length - 1);
    if (at >= 0) g.querySelector(".cmpb text").textContent = String(at + 1);
  });
  root.querySelectorAll("[data-pick]").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.pick === focus)));
  let text;
  if (found) {
    const steps = found.compared.map((k) => k + (k === focus ? " = " : " \\u2260 ") + focus);
    const c = found.compared.length;
    text = "find " + focus + ": bucket " + found.bucket + (c ? " \\u00b7 " + steps.join(" \\u00b7 ") : " is empty") + " \\u00b7 " + (found.found ? "found" : "not found") + ", " + c + (c === 1 ? " compare" : " compares");
  } else if (s === GROW) {
    const was = h % (d.m / 2);
    text = focus + ": " + h + " mod 4 = " + was + ", mod 8 = " + i + " \\u00b7 bit 2 is " + b[5] + (i === was ? ", so it stays" : ", so " + was + " + 4");
  } else {
    text = "h(" + focus + ") = " + h + " \\u00b7 mod " + d.m + " = " + i + " (last " + lowBits + " bits " + b.slice(8 - lowBits) + ")";
  }
  if (readout.textContent !== text) readout.textContent = text;
}
// Find: light the chain one compare at a time, then hold the result.
UNFOLD.beat(FIND, 800, (n) => {
  shown = n < 0 ? 99 : n;
  draw();
}, 600, 4);
root.addEventListener("unfold:scene", (e) => {
  if (!field.value) focus = DATA[e.detail.scene].focus;
  shown = e.detail.scene === FIND ? 0 : 99;
  draw();
});
root.addEventListener("unfold:layout", draw);
const pick = (k) => {
  UNFOLD.pause();
  focus = k;
  shown = 99;
  draw();
};
root.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-pick]");
  const node = e.target.closest(".hk");
  if (btn || node) {
    field.value = "";
    pick(btn ? btn.dataset.pick : node.dataset.key);
  }
});
field.addEventListener("input", () => {
  const k = field.value.slice(0, 16);
  pick(k.length ? k : DATA[UNFOLD.scene()].focus);
});
root.addEventListener("keydown", (e) => {
  if (e.target === field) return;
  const to = { ArrowUp: -1, ArrowDown: 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  field.value = "";
  const at = KEYS.indexOf(focus);
  pick(KEYS[(at + to + KEYS.length) % KEYS.length]);
});
draw();
`;

// ---- Reference notes ----
const probe = m.linearProbe(m.INSERTS.slice(0, 3), 4);
const chainAt4 = STEPS[2].table;
const cellRow = (y, title, cells) =>
  `<text x="0" y="${y + 15}" font-size="12" fill="var(--anatomy-muted)" font-family="var(--anatomy-mono)">${title}</text>` +
  cells.map((c, b) => `<g transform="translate(${130 + b * 100} ${y})"><rect width="92" height="28" rx="4" fill="var(--anatomy-card)" stroke="${c.hue ? `var(--unfold-${c.hue})` : "var(--anatomy-mid)"}" stroke-width="${c.hue ? 2 : 1}"/><text x="46" y="15" text-anchor="middle" dominant-baseline="central" font-size="12" font-family="var(--anatomy-mono)" fill="var(--anatomy-strong)">${c.text}</text><text x="46" y="${y ? 42 : -6}" text-anchor="middle" font-size="11" font-family="var(--anatomy-mono)" fill="var(--anatomy-muted)">${y ? b : ""}</text></g>`).join("");
const methodsSvg =
  `<svg viewBox="0 0 530 104" role="img" aria-label="The first three keys with chaining and with linear probing, in 4 buckets." style="max-width:530px;width:100%">` +
  cellRow(0, "chaining", chainAt4.map((c) => ({ text: c.join(" → ") || "–", hue: c.length > 1 ? "red" : "" }))) +
  cellRow(50, "linear probing", probe.map((k, b) => ({ text: k ?? "–", hue: k === "kiwi" ? "red" : "" }))) +
  `</svg>`;
const c = (t) => `<code>${t}</code>`;
const notes = u.notesHtml([
  {
    title: "Two ways to handle a collision",
    html: `${methodsSvg}<p>The same three keys in 4 buckets. With linear probing, kiwi finds bucket 1 taken and uses the next free bucket, 2. A lookup then walks the next buckets until it finds the key or an empty bucket.</p>`,
  },
  {
    title: "What real hash tables do",
    html: `<p>These rows come from each language's documentation and source. They were not run for this figure.</p>`,
    table: {
      head: ["Table", "Collisions", "Grows when", "Grows to"],
      rows: [
        [`Java ${c("HashMap")}`, "chaining; a chain of 8 or more becomes a tree", "n / m > 0.75", "2 × m"],
        [`C++ ${c("std::unordered_map")}`, "chaining", `n / m > ${c("max_load_factor()")}, 1.0 by default`, "more buckets, chosen by the library"],
        [`Python ${c("dict")}`, "open addressing with a pseudo-random probe order", "about 2/3 full", "a larger power of 2"],
        [`Rust ${c("HashMap")}, Go ${c("map")} (1.24+)`, "open addressing in groups of slots (Swiss table)", "7/8 full", "2 × m"],
      ],
    },
  },
  {
    title: "Cost",
    table: {
      head: ["Operation", "Average", "Worst case"],
      rows: [
        ["insert, find, delete", "O(1): a chain holds about n / m keys", "O(n): every key in one chain"],
        ["grow", "O(n) once, but rare", "doubling makes the total work for n inserts O(n)"],
      ],
    },
  },
  {
    title: "Words used here",
    table: {
      head: ["Term", "Meaning"],
      rows: [
        ["Hash function", "turns a key into a fixed-size number, the same every time"],
        ["Bucket", "one slot of the array, picked by the index"],
        ["Collision", "two different keys get the same bucket index"],
        ["Chain", "a linked list of the keys in one bucket"],
        ["Load factor", "keys per bucket: n / m"],
        ["Rehash", "put every key in again with the new m"],
      ],
    },
  },
]);

const body =
  iso.plateHtml({
    fig: "Fig 1",
    title: "Hash table",
    hint: "← → scene · ↑ ↓ key",
    readout: "",
    caption:
      "A hash table with separate chaining, built by real inserts of six keys chosen by hand. The hash h is 32-bit FNV-1a of the key's UTF-8 bytes, checked against the published FNV-1a test values. The table doubles when n / m passes 0.75, the rule Java's HashMap uses.",
    body: stage,
  }) + notes;

const artifact = process.argv.indexOf("--artifact");
const theme = light ? "light" : dark ? "dark" : "auto";
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, light ? "page-light.html" : dark ? "page-dark.html" : "page.html");
const html = artifact > 0 ? u.artifactHtml({ title: "Hash table", body, script: live }) : u.pageHtml({ title: "Hash table", theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
