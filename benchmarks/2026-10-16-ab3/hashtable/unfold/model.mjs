// Truth model: a hash table with separate chaining that works like Java's HashMap, step by step.
// Java: new HashMap<>(4) gets 4 buckets, load factor 0.75, threshold 3. A put appends a node at the end of
// its bucket's chain. When size > threshold, the table doubles, and every node goes to i or i + n_old.
// The figure shows the resize as its own step after the put that triggers it (Java runs it inside that put).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CAP0 = 4;
export const LOAD = 0.75;
export const MAX_CAP = 16; // the figure draws at most 16 buckets
export const MAX_KEYS = 12; // 12 keys fill 16 buckets to the threshold. Key 13 would need 32 buckets.
export const KEY_MAX_LEN = 5; // keys of 1 to 5 lowercase letters keep hashCode below 2^31, so it is never negative
// Chosen by hand: bee collides with cat, the first resize moves 2 nodes and keeps 2, owl collides with dog.
export const PRESET = ["cat", "dog", "bee", "yak", "owl", "hen", "emu"];

// The pseudocode the figure shows, after Java's HashMap.putVal and resize.
export const CODE = [
  "int h = key.hashCode();",
  "h = h ^ (h >>> 16);       // spread",
  "int i = h & (n - 1);      // = h mod n",
  "if (table[i] == null)",
  "  table[i] = new Node(h, key);",
  "else if (chain has key)",
  "  return;                 // stored already",
  "else",
  "  add new Node(h, key) at chain end;",
  "if (++size > 0.75 * n) resize();",
  "// resize: 2n buckets, i stays or i + n",
];

// Java's String.hashCode: s[0]*31^(len-1) + ... + s[len-1], in 32-bit int arithmetic.
export function hashCode(s) {
  let h = 0;
  for (let k = 0; k < s.length; k++) h = (Math.imul(31, h) + s.charCodeAt(k)) | 0;
  return h;
}

// Java's HashMap.hash: mixes the high 16 bits into the low 16 bits.
export function spread(h) {
  return h ^ (h >>> 16);
}

export function validKey(s) {
  return typeof s === "string" && s.length >= 1 && s.length <= KEY_MAX_LEN && /^[a-z]+$/.test(s);
}

// One step after another. table[i] lists the keys of bucket i in chain order.
// kinds: "init", "put" (new node), "dup" (key stored already), "resize" (the table doubles).
export function hashRun(keys) {
  let n = CAP0;
  let table = Array.from({ length: n }, () => []);
  let size = 0;
  let moves = 0;
  const copy = () => table.map((c) => c.slice());
  const steps = [{ kind: "init", n, table: copy(), size, load: 0, moves }];
  for (const key of keys) {
    const h0 = hashCode(key);
    const h = spread(h0);
    const i = h & (n - 1);
    const chain = table[i];
    if (chain.includes(key)) {
      steps.push({ kind: "dup", key, h0, h, i, n, pos: chain.indexOf(key), table: copy(), size, load: size / n, moves });
      continue;
    }
    chain.push(key);
    size++;
    steps.push({ kind: "put", key, h0, h, i, n, pos: chain.length - 1, table: copy(), size, load: size / n, moves, full: size > LOAD * n });
    if (size > LOAD * n) {
      const old = n;
      n = 2 * n;
      const next = Array.from({ length: n }, () => []);
      const moved = [];
      // Java walks each old chain in order and splits it into a "lo" list (index i) and a "hi" list (index i + old).
      table.forEach((c, from) =>
        c.forEach((k) => {
          const to = spread(hashCode(k)) & (n - 1);
          next[to].push(k);
          moved.push({ key: k, from, to });
        }),
      );
      table = next;
      moves += size;
      steps.push({ kind: "resize", key, n, old, table: copy(), size, load: size / n, moves, moved });
    }
  }
  return steps;
}

// The scenes are chapters of one run: [first step, last step] per scene.
// Hash (empty table, first put), Store (puts with no collision), Collide (the first collision),
// Full (the put that passes the threshold), Grow (the first resize), Repeat (the rest).
export function sceneRanges(steps) {
  const last = steps.length - 1;
  const firstPut = steps.findIndex((s) => s.kind === "put");
  const collide = steps.findIndex((s) => s.kind === "put" && s.pos > 0);
  const resize = steps.findIndex((s) => s.kind === "resize");
  return [[0, firstPut], [firstPut + 1, collide - 1], [collide, collide], [collide + 1, resize - 1], [resize, resize], [resize + 1, last]];
}

// Look a key up: its bucket, and how many keys of the chain it compares with equals().
export function lookup(table, key) {
  const h = spread(hashCode(key));
  const i = h & (table.length - 1);
  const at = table[i].indexOf(key);
  return { h, i, found: at >= 0, compares: at >= 0 ? at + 1 : table[i].length };
}

// The pseudocode line a step runs (0-based).
export function codeLine(s) {
  if (s.kind === "init") return -1;
  if (s.kind === "dup") return 6;
  if (s.kind === "resize") return 10;
  if (s.full) return 9; // the put that passes 0.75: the check line runs, and the resize follows
  return s.pos === 0 ? 4 : 8;
}

// The cost of growing, for n puts from 4 buckets: Java doubles when size passes 0.75 of the buckets.
export function growth(puts) {
  let n = CAP0;
  let moves = 0;
  let resizes = 0;
  while (puts > LOAD * n) {
    moves += Math.floor(LOAD * n) + 1; // the size when the resize runs
    n *= 2;
    resizes++;
  }
  return { puts, n, resizes, moves, perPut: moves / puts, load: puts / n };
}

// ---- Checks ----
function checkRun(keys) {
  const steps = hashRun(keys);
  let prev = steps[0];
  for (const s of steps.slice(1)) {
    const all = s.table.flat();
    assert.equal(new Set(all).size, all.length, "a key is stored once");
    assert.equal(all.length, s.size);
    assert.equal(s.table.length, s.n);
    s.table.forEach((c, i) => c.forEach((k) => assert.equal(spread(hashCode(k)) & (s.n - 1), i, "every key sits in bucket h mod n")));
    if (s.kind === "put") {
      assert.equal(s.i, s.h % s.n, "h & (n - 1) equals h mod n for n a power of 2 and h >= 0");
      assert.ok(s.h0 >= 0 && s.h >= 0);
      assert.equal(s.size, prev.size + 1);
      assert.equal(s.table[s.i].at(-1), s.key, "a new node goes to the end of its chain");
    }
    if (s.kind === "dup") assert.equal(s.size, prev.size);
    if (s.kind === "resize") {
      assert.equal(prev.kind, "put");
      assert.ok(prev.load > LOAD && s.load <= LOAD, "the resize runs when the load passes 0.75, and brings it back under");
      for (const { key, from, to } of s.moved) {
        const bit = spread(hashCode(key)) & s.old;
        assert.equal(to, bit ? from + s.old : from, "one new bit decides: i stays, or i + n_old");
      }
      // Java keeps the order of the nodes inside each half of a split chain.
      prev.table.forEach((c, from) => {
        assert.deepEqual(s.table[from], c.filter((k) => !(spread(hashCode(k)) & s.old)));
        assert.deepEqual(s.table[from + s.old], c.filter((k) => spread(hashCode(k)) & s.old));
      });
      assert.equal(s.moves, prev.moves + s.size);
    }
    if (s.kind !== "resize") assert.ok(s.n === CAP0 || s.load > LOAD / 2, "after a resize the load stays above 0.375");
    prev = s;
  }
  const r = sceneRanges(steps);
  return { steps, r };
}

const preset = hashRun(PRESET);
const { r: ranges } = checkRun(PRESET);
assert.deepEqual(ranges, [[0, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 9]]);
assert.deepEqual(preset.map((s) => s.kind), ["init", "put", "put", "put", "put", "resize", "put", "put", "put", "resize"]);
assert.equal(hashCode("cat"), 98262, "a value worked by hand: 99*31^2 + 97*31 + 116");
assert.equal(99 * 31 * 31 + 97 * 31 + 116, 98262);
assert.deepEqual(preset[5].table, [[], [], [], ["bee"], [], ["dog"], [], ["cat"]].map((c, i) => (i === 2 ? ["yak"] : c)));
assert.deepEqual(preset.at(-1).table.map((c) => c.join(",")), ["hen", "", "yak", "bee", "", "owl", "", "cat", "", "", "", "", "emu", "dog", "", ""]);

// Random keys in the range the page allows (seeded), appended to the preset, up to the figure's limit.
let seed = 11;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const word = () => Array.from({ length: 1 + Math.floor(rand() * KEY_MAX_LEN) }, () => String.fromCharCode(97 + Math.floor(rand() * 26))).join("");
let maxChain = 0;
for (let t = 0; t < 600; t++) {
  const keys = PRESET.slice();
  while (keys.length < MAX_KEYS + 3) keys.push(rand() < 0.15 ? keys[Math.floor(rand() * keys.length)] : word());
  const { steps, r } = checkRun(keys);
  assert.deepEqual(r.slice(0, 5), ranges.slice(0, 5), "the reader's keys go to the last chapter, the first five stay as they are");
  assert.equal(r[5][1], steps.length - 1);
  const distinct = new Set(keys).size;
  const upTo = steps.filter((s) => s.size <= MAX_KEYS);
  assert.ok(upTo.every((s) => s.n <= MAX_CAP), "12 keys never need more than 16 buckets");
  for (const s of steps) if (s.n <= MAX_CAP) maxChain = Math.max(maxChain, ...s.table.map((c) => c.length));
  for (const k of keys) assert.ok(validKey(k));
  assert.ok(distinct >= MAX_KEYS || steps.at(-1).size === distinct);
}
assert.ok(hashCode("zzzzz") > 0 && hashCode("zzzzz") < 2 ** 31, "5 letters never overflow");

// Lookup: found keys cost their chain position, absent keys cost the whole chain.
const last = preset.at(-1).table;
assert.deepEqual(lookup(last, "owl"), { h: 110469, i: 5, found: true, compares: 1 });
assert.deepEqual(lookup(preset[4].table, "bee"), { h: 97411, i: 3, found: true, compares: 2 });
assert.equal(lookup(last, "cod").found, false);

// Growth at real sizes: moves per put stays near 2, the load stays between 0.375 and 0.75.
export const GROWTH = [10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9].map(growth);
for (const g of GROWTH) {
  assert.ok(g.perPut < 2.02 && g.load > 0.375 && g.load <= 0.75, `growth at ${g.puts}`);
  // brute force for the small sizes: the same totals as hashRun on distinct keys
}
for (let puts = 1; puts <= 200; puts++) {
  const g = growth(puts);
  let n = CAP0, size = 0, moves = 0;
  for (let p = 0; p < puts; p++) if (++size > LOAD * n) (moves += size), (n *= 2);
  assert.deepEqual([g.n, g.moves], [n, moves]);
}

// A real tool: Java's own HashMap, read by reflection after every put. Skipped with a message when java is missing.
const JAVA = `
import java.lang.reflect.*;
import java.util.*;
public class Check {
  public static void main(String[] a) throws Exception {
    HashMap<String, Boolean> m = new HashMap<>(4);
    Field tf = HashMap.class.getDeclaredField("table");
    tf.setAccessible(true);
    for (String k : a) {
      m.put(k, true);
      Object[] t = (Object[]) tf.get(m);
      StringBuilder sb = new StringBuilder();
      for (int i = 0; i < t.length; i++) {
        if (i > 0) sb.append("|");
        for (Object e = t[i]; e != null; ) {
          Field kf = e.getClass().getSuperclass() == Object.class ? e.getClass().getDeclaredField("key") : e.getClass().getSuperclass().getDeclaredField("key");
          kf.setAccessible(true);
          Field nf = kf.getDeclaringClass().getDeclaredField("next");
          nf.setAccessible(true);
          sb.append(kf.get(e)).append(",");
          e = nf.get(e);
        }
      }
      System.out.println(sb + " " + k.hashCode());
    }
  }
}`;
const JAVA_KEYS = [...PRESET, "cod", "ant", "pig", "ape", "gnu", "cat", "jay"];
let javaOut = "";
try {
  const dir = mkdtempSync(join(tmpdir(), "hm-"));
  writeFileSync(join(dir, "Check.java"), JAVA);
  javaOut = execFileSync("java", ["--add-opens", "java.base/java.util=ALL-UNNAMED", join(dir, "Check.java"), ...JAVA_KEYS], { stdio: ["ignore", "pipe", "pipe"] }).toString();
} catch (e) {
  console.log("java not found or failed: the HashMap check is skipped", String(e.stderr ?? e).slice(0, 200));
}
export let JAVA_CHECKED = false;
if (javaOut) {
  const lines = javaOut.trim().split("\n");
  const steps = hashRun(JAVA_KEYS);
  // After each put (and its resize, which Java runs inside put), the buckets must match.
  const after = [];
  steps.forEach((s, k) => {
    if (s.kind === "init" || s.kind === "resize") return;
    after.push(steps[k + 1]?.kind === "resize" ? steps[k + 1] : s);
  });
  assert.equal(lines.length, after.length);
  lines.forEach((line, k) => {
    const [buckets, code] = line.split(" ");
    assert.equal(buckets, after[k].table.map((c) => c.map((x) => x + ",").join("")).join("|"), `Java HashMap buckets after put ${k + 1}`);
    assert.equal(Number(code), hashCode(JAVA_KEYS[k]));
  });
  JAVA_CHECKED = true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [t, s] of preset.entries()) {
    const what = s.kind === "init" ? "empty" : s.kind === "resize" ? `resize ${s.old}->${s.n}: ${s.moved.filter((x) => x.to !== x.from).map((x) => `${x.key} ${x.from}->${x.to}`).join(" ")}` : `${s.kind} ${s.key} h0=${s.h0} h=${s.h} i=${s.i} pos=${s.pos}`;
    console.log(String(t).padStart(2), `L${codeLine(s) + 1}`.padEnd(4), what.padEnd(52), `size ${s.size}/${s.n} load ${s.load.toFixed(3)} moves ${s.moves}`);
  }
  for (const g of GROWTH) console.log(`puts ${g.puts}: n ${g.n}, resizes ${g.resizes}, moves ${g.moves}, per put ${g.perPut.toFixed(3)}, load ${g.load.toFixed(3)}`);
  console.log("ranges", JSON.stringify(ranges), "max chain", maxChain, "java", JAVA_CHECKED ? "checked" : "skipped");
  console.log("model ok");
}
