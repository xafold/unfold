// A B-tree with at most 2 keys per node (a 2-3 tree), built by real inserts. Pure: the figure only draws
// what this module records. Each step is a snapshot of the whole tree after one insert or one split.

export const MAX = 2;
export const INSERTS = [10, 20, 30, 40, 50, 60, 70];

let nextId = 0;
const nodeOf = (keys = [], kids = []) => ({ id: `n${nextId++}`, keys, kids });
const clone = (node) => ({ id: node.id, keys: [...node.keys], kids: node.kids.map(clone) });

// Child index to follow for `key`: the first key greater than it.
export const branch = (node, key) => node.keys.filter((k) => k < key).length;

export function searchPath(root, key) {
  const path = [];
  let node = root;
  while (node) {
    const found = node.keys.includes(key);
    path.push({ id: node.id, keys: [...node.keys], found, go: found || !node.kids.length ? null : branch(node, key) });
    if (found || !node.kids.length) break;
    node = node.kids[branch(node, key)];
  }
  return path;
}

export function build(inserts = INSERTS) {
  nextId = 0;
  let root = nodeOf();
  const steps = [];
  const snap = (kind, extra) => steps.push({ kind, tree: clone(root), ...extra });
  for (const key of inserts) {
    const path = [root];
    while (path.at(-1).kids.length) path.push(path.at(-1).kids[branch(path.at(-1), key)]);
    const leaf = path.at(-1);
    leaf.keys.splice(branch(leaf, key), 0, key);
    snap("insert", { key, overflow: leaf.keys.length > MAX ? leaf.id : null });
    // Split upward while a node holds more than MAX keys: the middle key moves into the parent.
    for (let level = path.length - 1; path[level].keys.length > MAX; level--) {
      const node = path[level];
      const mid = node.keys[1];
      const right = nodeOf(node.keys.slice(2), node.kids.slice(2));
      node.keys = node.keys.slice(0, 1);
      node.kids = node.kids.slice(0, 2);
      let parent = path[level - 1];
      if (!parent) {
        parent = root = nodeOf([], [node]);
        path.unshift(parent);
        level++;
      }
      const at = parent.kids.indexOf(node);
      parent.keys.splice(at, 0, mid);
      parent.kids.splice(at + 1, 0, right);
      snap("split", { key, promoted: mid, overflow: parent.keys.length > MAX ? parent.id : null });
    }
  }
  return steps;
}

export const height = (node) => (node.kids.length ? 1 + height(node.kids[0]) : 1);
export const leafDepths = (node, d = 1) => (node.kids.length ? node.kids.flatMap((k) => leafDepths(k, d + 1)) : [d]);
export const keysOf = (node) => [...node.keys, ...node.kids.flatMap(keysOf)].sort((a, b) => a - b);
export const show = (node) => (node.kids.length ? `[${node.keys.join(" ")}](${node.kids.map(show).join(" ")})` : `[${node.keys.join(" ")}]`);

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  const steps = build();
  steps.forEach((s, i) => console.log(String(i).padStart(2), s.kind.padEnd(6), `key ${s.key}`, s.promoted ? `up ${s.promoted}` : "", s.overflow ? `overflow ${s.overflow}` : "", show(s.tree)));
  const last = steps.at(-1).tree;
  assert(show(last) === "[40]([20]([10] [30]) [60]([50] [70]))", "final shape");
  assert(new Set(leafDepths(last)).size === 1, "every leaf at the same depth");
  assert(keysOf(last).join() === INSERTS.join(), "all keys kept, in order");
  const n = INSERTS.length;
  assert(Math.log(n + 1) / Math.log(3) <= height(last) && height(last) <= Math.log2(n + 1), "height bounds");
  assert(searchPath(last, 50).map((p) => p.keys.join(" ")).join(" > ") === "40 > 60 > 50", "search 50");
  console.log("model ok");
}
