import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as u from "../../kit/concept-kit.mjs";
import * as m from "./model.mjs";

const { iso } = u;
const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const W = 820;
const H = 290;
const SW = 42; // one key slot
const KH = 30; // key height
const PAD = 5;
const BOX = { w: m.MAX * SW + PAD * 2, h: KH + PAD * 2 };
const LEVEL = 104;
const GAP = 44;

// Colour identity: what happened to a key or a node in this scene.
const HUE = { key: "ink", inserted: "yellow", promoted: "blue", overflow: "red", path: "green" };

// The scenes are chosen steps of the real insert sequence.
const STEPS = m.build();
const PICK = [1, 2, 3, 4, 6, 9, 10];
const SNAPS = PICK.map((i) => STEPS[i]);
const N = SNAPS.length;

// Layout of one snapshot: leaves left to right, each parent centred over its children, the tree centred.
function layout(tree) {
  const at = {};
  let x = 0;
  const place = (node, level) => {
    const width = BOX.w + (node.keys.length > m.MAX ? SW + 2 : 0);
    if (!node.kids.length) {
      at[node.id] = { x, y: level * LEVEL, node };
      x += width + GAP;
    } else {
      node.kids.forEach((kid) => place(kid, level + 1));
      const first = at[node.kids[0].id];
      const last = at[node.kids.at(-1).id];
      at[node.id] = { x: (first.x + last.x) / 2, y: level * LEVEL, node };
    }
  };
  place(tree, 0);
  const right = Math.max(...Object.values(at).map((p) => p.x + BOX.w + (p.node.keys.length > m.MAX ? SW + 2 : 0)));
  const shift = (W - right) / 2;
  const top = (H - (m.height(tree) - 1) * LEVEL - BOX.h) / 2;
  for (const p of Object.values(at)) {
    p.x = Math.round(p.x + shift);
    p.y = Math.round(p.y + top);
  }
  return at;
}
const LAYOUTS = SNAPS.map((s) => layout(s.tree));

const nodeIds = [...new Set(LAYOUTS.flatMap((l) => Object.keys(l)))];
const keyAt = (l, key) => {
  for (const { x, y, node } of Object.values(l)) {
    const i = node.keys.indexOf(key);
    if (i >= 0) return { x: x + PAD + i * SW + 2, y: y + PAD };
  }
  return null;
};

// Links: parent pointer i leaves the slot boundary i on the parent's bottom edge and ends on the child's top.
const linkIds = [...new Set(LAYOUTS.flatMap((l) => Object.values(l).flatMap(({ node }) => node.kids.map((k) => `${node.id}-${k.id}`))))];
const links = linkIds.map((id) => {
  const [pid, cid] = id.split("-");
  const ds = LAYOUTS.map((l) => {
    const p = l[pid];
    const c = l[cid];
    if (!p || !c) return null;
    const i = p.node.kids.findIndex((k) => k.id === cid);
    if (i < 0) return null;
    const x1 = p.x + PAD + i * SW;
    const y1 = p.y + BOX.h;
    const x2 = c.x + BOX.w / 2;
    const y2 = c.y;
    return `M${x1} ${y1}C${x1} ${y1 + 34} ${x2} ${y2 - 34} ${x2} ${y2}`;
  });
  return u.morphPath(ds, { id: `link-${id}` });
});

const nodes = nodeIds.map(
  (id) =>
    `<g class="u-move u-node" id="node-${id}" data-node="${id}"><rect class="u-node-box" width="${BOX.w}" height="${BOX.h}" rx="4"/>` +
    `<rect class="u-node-over" x="${BOX.w + 2}" width="${SW + 2}" height="${BOX.h}" rx="4"/>` +
    [1].map((i) => `<path class="u-node-rule" d="M${PAD + i * SW} ${PAD + 2}V${BOX.h - PAD - 2}"/>`).join("") +
    `</g>`,
);
const keys = m.INSERTS.map((k) => `<g class="u-move" id="key-${k}">${u.chip(String(k), 0, 0, { w: SW - 4, h: KH, rx: 4, className: "u-keycell" })}</g>`);

const svg = iso.figureSvg({
  width: W,
  height: H,
  label: "A B-tree with at most 2 keys per node, built by inserting 10, 20, 30, 40, 50, 60 and 70, shown in seven scenes.",
  body: [...links, ...nodes, ...keys],
});

// Where each node and key stands in each scene, and what colour it takes.
const states = (fn) => SNAPS.map((_, i) => fn(i));
const css = [];
for (const id of nodeIds) css.push(u.placeCss(`#node-${id}`, states((i) => (LAYOUTS[i][id] ? { x: LAYOUTS[i][id].x, y: LAYOUTS[i][id].y } : null))));
for (const k of m.INSERTS) {
  const place = states((i) => keyAt(LAYOUTS[i], k));
  const first = place.findIndex(Boolean);
  // A new key drops in from above: in the scene before it exists, it waits higher up, unseen.
  if (first > 0) place[first - 1] = { ...place[first], y: place[first].y - 40, o: 0 };
  css.push(u.placeCss(`#key-${k}`, place));
}
SNAPS.forEach((s, i) => {
  const scene = `.u-stage[data-scene="${i}"]`;
  const newest = s.kind === "insert" ? s.key : null;
  if (newest) css.push(`${scene} #key-${newest}{--hue:var(--unfold-${HUE.inserted})}`);
  if (s.promoted) css.push(`${scene} #key-${s.promoted}{--hue:var(--unfold-${HUE.promoted})}`);
  if (s.overflow) css.push(`${scene} #node-${s.overflow}{--over:1;--hue:var(--unfold-${HUE.overflow})}`);
});
css.push(
  `.u-node-box{fill:var(--u-card);stroke:var(--hue,var(--u-mid));stroke-width:1;transition:stroke .3s}`,
  `.u-node-rule{stroke:var(--u-faint);stroke-width:.8}`,
  `.u-node-over{fill:none;stroke:var(--unfold-red);stroke-width:1;stroke-dasharray:3 2;opacity:var(--over,0);transition:opacity .4s}`,
  `.u-node[data-on] .u-node-box{stroke:var(--unfold-${HUE.path});stroke-width:1.8}`,
  `.u-node[data-on][data-hit] .u-node-box{fill:color-mix(in srgb,var(--unfold-${HUE.path}) 14%,var(--u-card))}`,
  `.u-keycell rect{fill:color-mix(in srgb,var(--hue,var(--u-hi)) 18%,var(--u-card));stroke:var(--hue,var(--u-lo));stroke-width:1;transition:fill .3s,stroke .3s}`,
  `.u-keycell text{font-size:14px;fill:var(--u-strong)}`,
  `.u-keycell{cursor:pointer}`,
);

// Equations: MathML, coloured by role.
const k = (v, role) => `<mn data-hue="${HUE[role]}">${v}</mn>`;
const node = (...items) => `<mo>[</mo>${items.join("<mspace width=\"0.3em\"/>")}<mo>]</mo>`;
const up = `<mo>↑</mo>`;
// The narration is in script.md: one section per scene.
const script = u.readScript(join(HERE, "script.md"));
const scenes = [
  {
    name: "Sorted",
    math: `${node(k(10, "key"), k(20, "key"))}<mspace width="1em"/><msub><mi>k</mi><mn>1</mn></msub><mo>&lt;</mo><msub><mi>k</mi><mn>2</mn></msub><mspace width="1em"/><mi>keys</mi><mo>≤</mo><mn>2</mn>`,
  },
  {
    name: "Overflow",
    math: `${node(k(10, "key"), k(20, "key"), k(30, "inserted"))}<mspace width="1em"/><mi>keys</mi><mo>=</mo><mn data-hue="red">3</mn><mo>&gt;</mo><mn>2</mn>`,
  },
  {
    name: "Split",
    math: `${node(k(10, "key"))}<mspace width="0.6em"/>${k(20, "promoted")}${up}<mspace width="0.6em"/>${node(k(30, "key"))}`,
  },
  {
    name: "Search",
    math: `${k(40, "inserted")}<mo>&gt;</mo>${k(20, "key")}<mspace width="0.5em"/><mo>⇒</mo><mspace width="0.5em"/><mtext>right pointer</mtext>`,
  },
  {
    name: "Promote",
    math: `${node(k(30, "key"), k(40, "promoted"), k(50, "inserted"))}<mspace width="0.5em"/><mo>→</mo><mspace width="0.5em"/>${node(k(30, "key"))}<mspace width="0.4em"/>${k(40, "promoted")}${up}<mspace width="0.4em"/>${node(k(50, "inserted"))}`,
  },
  {
    name: "Cascade",
    math: `${node(k(50, "key"), k(60, "promoted"), k(70, "key"))}<mspace width="0.4em"/><mo>→</mo><mspace width="0.4em"/>${k(60, "promoted")}${up}<mspace width="1em"/><mi>root</mi><mo>:</mo><mspace width="0.3em"/><mi>keys</mi><mo>=</mo><mn data-hue="red">3</mn>`,
  },
  {
    name: "Taller",
    math: `<msub><mi>log</mi><mn>3</mn></msub><mo>(</mo><mi>n</mi><mo>+</mo><mn>1</mn><mo>)</mo><mo>≤</mo><mi>h</mi><mo>≤</mo><msub><mi>log</mi><mn>2</mn></msub><mo>(</mo><mi>n</mi><mo>+</mo><mn>1</mn><mo>)</mo><mspace width="1em"/><mn>1.9</mn><mo>≤</mo><mn>3</mn><mo>≤</mo><mn>3</mn>`,
  },
].map((scene, i) => ({ ...scene, ...script[i] }));

const key = u.keyHtml(
  [
    { hue: HUE.inserted, label: "inserted key" },
    { hue: HUE.promoted, label: "key moving up" },
    { hue: HUE.overflow, label: "overflow" },
    { hue: HUE.path, label: "search path" },
  ],
  { signs: false },
);

const stage = u.stageHtml({ audio: await u.narrate(scenes, { dir: join(HERE, "voice") }), dwell: 7000, scenes, svg, label: "B-tree insert explainer. Left and right arrows change the scene. Up and down arrows pick the key to search for.", css: css.join("\n"), key });

// Page data: each scene's tree, the key it inserted, and the search path for every key in it.
const DATA = SNAPS.map((s) => ({
  focus: s.key,
  keys: m.keysOf(s.tree),
  paths: Object.fromEntries(m.keysOf(s.tree).map((key) => [key, m.searchPath(s.tree, key)])),
}));

const live = `
const DATA = ${JSON.stringify(DATA)};
const root = UNFOLD.stage;
const readout = document.querySelector("[data-readout]");
let focus = DATA[0].focus;
let shown = 99;
const describe = (key, path) =>
  "find " + key + ": " + path.map((p) => (p.found ? "found in [" + p.keys.join(" ") + "]" : key + (p.go === 0 ? " < " + p.keys[0] : " > " + p.keys[p.go - 1]) + " \\u2192 " + (p.go === 0 ? "left" : p.go === p.keys.length ? "right" : "middle"))).join(" \\u00b7 ") + " \\u00b7 " + path.length + (path.length > 1 ? " nodes" : " node") + " read";
function draw() {
  const data = DATA[UNFOLD.scene()];
  if (!data.keys.includes(focus)) focus = data.focus;
  const path = data.paths[focus];
  const on = new Set(path.slice(0, shown).map((p) => p.id));
  root.querySelectorAll(".u-node").forEach((n) => {
    n.toggleAttribute("data-on", on.has(n.dataset.node));
    n.toggleAttribute("data-hit", on.has(n.dataset.node) && path.some((p) => p.id === n.dataset.node && p.found));
  });
  const text = describe(focus, path);
  if (readout.textContent !== text) readout.textContent = text;
}
// Sweep the search path one node at a time, then hold, then start again.
for (let s = 0; s < DATA.length; s++)
  UNFOLD.beat(s, 700, (n) => {
    const steps = DATA[s].paths[focus]?.length ?? 1;
    shown = n < 0 ? 99 : n % (steps + 3);
    draw();
  }, 1100);
root.addEventListener("unfold:scene", (e) => {
  focus = DATA[e.detail.scene].focus;
  shown = 0;
  draw();
});
const pick = (key) => {
  focus = key;
  shown = 99;
  UNFOLD.pause();
  draw();
};
root.addEventListener("keydown", (e) => {
  const list = DATA[UNFOLD.scene()].keys;
  const at = list.indexOf(focus);
  const to = { ArrowUp: at - 1, ArrowDown: at + 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  pick(list[(to + list.length) % list.length]);
});
root.addEventListener("click", (e) => {
  const cell = e.target.closest("[id^=key-]");
  if (cell) pick(Number(cell.id.slice(4)));
});
draw();
`;

const body = iso.plateHtml({
  fig: "Fig 2",
  title: "B-tree insert",
  hint: "← → scene · ↑ ↓ key",
  readout: "",
  caption:
    "A B-tree of order 3: at most 2 keys and 3 pointers per node. It was built by inserting 10, 20, 30, 40, 50, 60 and 70 in that order. Every node and key position comes from the real insert. Real database B-trees use the same splits with hundreds of keys per node.",
  body: stage,
});

// --artifact <file>: one page for a claude.ai Artifact, which follows the viewer's theme.
const artifact = process.argv.indexOf("--artifact");
const file = artifact > 0 ? process.argv[artifact + 1] : join(HERE, theme === "light" ? "btree-insert-light.html" : "btree-insert.html");
const html = artifact > 0 ? u.artifactHtml({ title: "B-tree insert", body, script: live }) : u.pageHtml({ title: "B-tree insert", theme, body, script: live });
writeFileSync(file, html);
console.log("wrote", file);
