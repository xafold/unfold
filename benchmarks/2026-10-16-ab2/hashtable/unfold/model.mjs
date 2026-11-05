// A hash table with separate chaining, built by real inserts. Hash: 32-bit FNV-1a on the UTF-8 bytes.
// Index: h mod m. Growth rule (as in Java's HashMap): after an insert, if n / m > 0.75, double m and rehash.

export const START = 4;
export const LIMIT = 0.75;
export const INSERTS = ["apple", "pear", "kiwi", "lime", "fig", "peach"];

export function fnv1a(key) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(key)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function bucketOf(key, m) {
  return fnv1a(key) % m;
}

// Every step is a snapshot: after one insert, or after one growth.
export function build(inserts = INSERTS, start = START, limit = LIMIT) {
  let m = start;
  let table = Array.from({ length: m }, () => []);
  const steps = [];
  const snap = (kind, key) => steps.push({ kind, key, m, n: table.flat().length, table: table.map((c) => [...c]) });
  for (const key of inserts) {
    table[bucketOf(key, m)].push(key);
    snap("insert", key);
    if (table.flat().length / m > limit) {
      const keys = table.flat();
      m *= 2;
      table = Array.from({ length: m }, () => []);
      for (const k of keys) table[bucketOf(k, m)].push(k);
      snap("grow", null);
    }
  }
  return steps;
}

// The keys a lookup compares, in chain order, until it finds `key` or the chain ends.
export function lookup(table, key) {
  const chain = table[bucketOf(key, table.length)];
  const at = chain.indexOf(key);
  return { bucket: bucketOf(key, table.length), compared: at < 0 ? [...chain] : chain.slice(0, at + 1), found: at >= 0 };
}

export function bits(h, n = 8) {
  return (h & ((1 << n) - 1)).toString(2).padStart(n, "0");
}

// The other common method, open addressing with linear probing: a taken slot sends the key to the next slot.
export function linearProbe(keys, m) {
  const slots = Array(m).fill(null);
  for (const key of keys) {
    let i = bucketOf(key, m);
    while (slots[i] !== null) i = (i + 1) % m;
    slots[i] = key;
  }
  return slots;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  // Published FNV-1a 32-bit test vectors.
  assert(fnv1a("") === 0x811c9dc5 && fnv1a("a") === 0xe40c292c && fnv1a("foobar") === 0xbf9cf968, "FNV-1a test vectors");
  for (const k of INSERTS) console.log(k.padEnd(6), String(fnv1a(k)).padStart(10), bits(fnv1a(k)), "mod4", bucketOf(k, 4), "mod8", bucketOf(k, 8));
  const steps = build();
  steps.forEach((s, i) => console.log(i, s.kind.padEnd(6), (s.key ?? "").padEnd(6), `n/m=${s.n}/${s.m}`, s.table.map((c, b) => `${b}:[${c.join(" ")}]`).join(" ")));
  assert(steps.map((s) => s.kind).join() === "insert,insert,insert,insert,grow,insert,insert", "one growth, after the 4th key");
  assert(steps[2].table[1].join() === "pear,kiwi", "kiwi collides with pear at m=4");
  assert(steps[4].m === 8 && steps[4].table[5].join() === "pear" && steps[4].table[1].join() === "kiwi", "growth separates pear and kiwi");
  assert(steps[5].table[5].join() === "pear,fig", "fig collides with pear at m=8");
  // Rules the sentences state, on many random keys:
  // a key in bucket i of m moves to i or i + m after doubling; the load stays at or under the limit after each step.
  let seed = 7;
  const rand = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
  for (let t = 0; t < 2000; t++) {
    const key = rand().toString(36).slice(0, 1 + (rand() % 7));
    for (const m of [4, 8, 16]) {
      const i = bucketOf(key, m);
      const j = bucketOf(key, 2 * m);
      assert(j === i || j === i + m, `split rule for ${key}`);
      assert(j === i + m * ((fnv1a(key) >>> Math.log2(m)) & 1), "the next bit picks the half");
    }
  }
  const many = build(Array.from({ length: 200 }, (_, i) => `k${i}`));
  assert(many.every((s) => s.kind === "insert" ? true : s.n / s.m <= LIMIT), "after growth the load is under the limit");
  assert(many.filter((s) => s.kind === "insert").every((s) => s.table.flat().length === s.n), "no key lost");
  assert(lookup(steps[3].table, "kiwi").compared.join() === "pear,kiwi", "lookup kiwi compares pear then kiwi");
  assert(!lookup(steps[3].table, "fig").found && lookup(steps[3].table, "fig").compared.join() === "pear,kiwi", "missing key reads the whole chain");
  assert(linearProbe(INSERTS.slice(0, 3), 4).join() === ",pear,kiwi,apple", "linear probing puts kiwi in slot 2");
  console.log("model ok");
}
