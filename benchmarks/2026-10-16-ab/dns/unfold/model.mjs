// Truth model: an iterative DNS resolver with a TTL cache, walking real delegations.
// Every server, record and TTL below was captured with `dig +norecurse` on 2026-10-16 (DiG 9.18).
// `node model.mjs` asserts the rules; `node model.mjs --dig` also re-asks the real servers.
// ponytail: A records only, one server per zone (the "a." or first NS), no QNAME minimisation,
// no negative caching; the notes under the figure list these.
import { execFileSync } from "node:child_process";

// Delegations as the parent zone sends them: NS name, glue address, how many NS records, TTL.
export const ZONES = {
  ".": { host: "a.root-servers.net", ip: "198.41.0.4", more: 12, ttl: 0 },
  "com.": { host: "a.gtld-servers.net", ip: "192.5.6.30", more: 12, ttl: 172800 },
  "example.com.": { host: "hera.ns.cloudflare.com", ip: "108.162.192.162", more: 1, ttl: 172800 },
  "google.com.": { host: "ns1.google.com", ip: "216.239.32.10", more: 3, ttl: 172800 },
};
// Answers from the authoritative servers (flag aa). `more` = further A records in the same answer.
export const ANSWERS = {
  "www.example.com.": { ip: "104.20.23.154", more: 1, ttl: 300 },
  "example.com.": { ip: "104.20.23.154", more: 1, ttl: 300 },
  "www.google.com.": { ip: "142.251.157.119", more: 7, ttl: 300 },
};
export const NAMES = Object.keys(ANSWERS);

// The cache a resolver starts with: the root hints file. It never expires here.
export function hints() {
  return [{ name: ".", type: "NS", value: "a.root-servers.net", more: 12, ttl: Infinity, at: 0 }];
}

export function alive(entry, now) {
  return now < entry.at + entry.ttl;
}

// Which column of the figure owns a zone: the root, a TLD (one label) or an authoritative server.
export function roleOf(zone) {
  if (zone === ".") return "root";
  return zone.split(".").length === 2 ? "tld" : "auth";
}

// The zones on the path from the root down to a name, for example ".", "com.", "example.com.".
export function pathOf(name) {
  const labels = name.split(".").filter(Boolean);
  const out = ["."];
  for (let i = labels.length - 1; i >= 0; i--) {
    const zone = labels.slice(i).join(".") + ".";
    if (ZONES[zone]) out.push(zone);
  }
  return out;
}

// One lookup of `name` (type A) at time `now` (seconds), with the resolver's cache `cache`.
// Returns the messages in order, a cache snapshot after each message, the final cache, and what was reused.
export function lookup(name, cache, now) {
  const store = cache.map((e) => ({ ...e }));
  const msgs = [];
  const snaps = [];
  const send = (msg) => {
    msgs.push(msg);
    snaps.push(store.map((e) => ({ ...e })));
  };
  const put = (entry) => {
    const old = store.findIndex((e) => e.name === entry.name && e.type === entry.type);
    if (old >= 0) store[old] = entry;
    else store.push(entry);
  };
  const find = (n, type) => store.find((e) => e.name === n && e.type === type && alive(e, now));
  const q = `${name} A?`;
  send({ from: "client", to: "resolver", kind: "query", label: q, short: "A?", line: `${name} IN A ? (recursion desired)` });

  const hit = find(name, "A");
  if (hit) {
    const left = hit.at + hit.ttl - now;
    send({ from: "resolver", to: "client", kind: "answer", label: `A ${hit.value} · TTL ${left}`, short: "A", line: `${name} ${left} IN A ${hit.value} (from cache)`, cached: true });
    return { msgs, snaps, cache: store, used: [name + " A"], start: null };
  }
  // Start at the lowest zone on the path whose NS record still lives in the cache.
  const path = pathOf(name);
  let depth = path.length - 1;
  while (!find(path[depth], "NS")) depth--;
  const start = path[depth];
  const used = [path[depth] + " NS"];
  for (;;) {
    const zone = path[depth];
    const server = roleOf(zone);
    const z = ZONES[zone];
    send({ from: "resolver", to: server, kind: "query", label: q, short: "A?", line: `${name} IN A ? to ${z.ip}` });
    if (depth === path.length - 1) {
      const a = ANSWERS[name];
      put({ name, type: "A", value: a.ip, more: a.more, ttl: a.ttl, at: now });
      const extra = a.more ? ` +${a.more}` : "";
      send({ from: server, to: "resolver", kind: "answer", label: `answer: A ${a.ip}`, short: "A", line: `${name} ${a.ttl} IN A ${a.ip}${extra} · flag aa`, zone });
      send({ from: "resolver", to: "client", kind: "answer", label: `A ${a.ip} · TTL ${a.ttl}`, short: "A", line: `${name} ${a.ttl} IN A ${a.ip}${extra}` });
      return { msgs, snaps, cache: store, used, start };
    }
    const child = path[depth + 1];
    const c = ZONES[child];
    put({ name: child, type: "NS", value: c.host, more: c.more, ttl: c.ttl, at: now });
    send({ from: server, to: "resolver", kind: "referral", label: `referral: ${child} NS`, short: `${child} NS`, line: `${child} ${c.ttl} IN NS ${c.host}. +${c.more} · glue ${c.ip}`, zone: child });
    depth++;
  }
}

// Rows of the cache table at time `now`: TTL left, its share of the full TTL, and the row's state.
export function cacheRows(cache, now, before = []) {
  return cache.map((e) => {
    const was = before.find((b) => b.name === e.name && b.type === e.type);
    const left = e.ttl === Infinity ? null : e.at + e.ttl - now;
    const state = left !== null && left <= 0 ? "expired" : !was ? "new" : was.at === e.at ? "kept" : "renewed";
    return { name: e.name, type: e.type, value: e.value, more: e.more, ttl: e.ttl === Infinity ? null : e.ttl, left, share: left === null ? 1 : Math.max(0, left / e.ttl), state };
  });
}

// The scenario the figure tells: lookup 1 at t = 0 on a fresh resolver, lookup 2 of `name` after `dt` seconds.
export function scenario(name, dt) {
  const first = lookup("www.example.com.", hints(), 0);
  const second = lookup(name, first.cache, dt);
  return { first, second, rows: cacheRows(second.cache, dt, first.cache) };
}

export const FIRST = lookup("www.example.com.", hints(), 0);
export const DT_MAX = 300000;
export const PRESETS = [60, 600, 259200];

// ---- checks ----
const assert = (ok, msg) => {
  if (!ok) throw new Error("model: " + msg);
};
const kinds = (r) => r.msgs.map((m) => m.kind[0]).join("");
assert(FIRST.msgs.length === 8, "first lookup is 8 messages");
assert(kinds(FIRST) === "qqrqrqaa", "query, referral, referral, answer order: " + kinds(FIRST));
assert(FIRST.msgs.map((m) => m.to).join(",") === "resolver,root,resolver,tld,resolver,auth,resolver,client", "walk order");
assert(FIRST.cache.length === 4, "cache holds hints, com. NS, example.com. NS, www A");

const expect = { "www.example.com.": [2, 4, 4, 8], "example.com.": [4, 4, 4, 8], "www.google.com.": [6, 6, 6, 8] };
for (const name of NAMES)
  [60, 600, 3600, 172800].forEach((dt, i) => {
    const n = scenario(name, dt).second.msgs.length;
    assert(n === expect[name][i], `${name} after ${dt} s: ${n} messages, expected ${expect[name][i]}`);
  });

// Every allowed input: messages pair up, the walk only goes down, and a live record is never asked for again.
for (let dt = 0; dt <= DT_MAX; dt += dt < 1000 ? 7 : 997)
  for (const name of NAMES) {
    const { second, rows } = scenario(name, dt);
    const n = second.msgs.length;
    assert(n % 2 === 0 && n >= 2 && n <= 8, `even count 2..8 at ${dt}`);
    assert(second.msgs[0].from === "client" && second.msgs[n - 1].to === "client", "starts and ends at the client");
    const order = second.msgs.filter((m) => m.from === "resolver" && m.to !== "client").map((m) => ["root", "tld", "auth"].indexOf(m.to));
    assert(order.every((v, i) => i === 0 || v > order[i - 1]), "walk goes down the tree");
    const cachedA = FIRST.cache.find((e) => e.name === name && e.type === "A");
    if (cachedA && dt < cachedA.ttl) assert(n === 2, "a live A record answers from the cache");
    assert(rows.every((r) => r.left === null || r.state !== "expired" || r.left <= 0), "expired means no time left");
    assert(rows.every((r) => r.share >= 0 && r.share <= 1), "share in 0..1");
  }

// Optional: ask the real servers again and compare the stored delegations and answers.
if (process.argv.includes("--dig")) {
  const dig = (server, name) => {
    try {
      return execFileSync("dig", [`@${server}`, name, "A", "+norecurse", "+nodnssec", "+noall", "+answer", "+authority", "+additional"], { encoding: "utf8", timeout: 8000 });
    } catch {
      return null;
    }
  };
  const records = (text) => text.split("\n").filter(Boolean).map((l) => l.split(/\s+/)).map(([n, ttl, , type, value]) => ({ n, ttl: Number(ttl), type, value }));
  const checks = [
    [".", "com.", "www.example.com."],
    ["com.", "example.com.", "www.example.com."],
    ["com.", "google.com.", "www.google.com."],
  ];
  let ran = 0;
  for (const [parent, child, name] of checks) {
    const out = dig(ZONES[parent].ip, name);
    if (out === null) {
      console.log(`dig: ${ZONES[parent].host} did not answer, skipped`);
      continue;
    }
    const r = records(out);
    const ns = r.filter((x) => x.n === child && x.type === "NS");
    assert(ns.some((x) => x.value === ZONES[child].host + "."), `${parent} refers ${child} to ${ZONES[child].host}`);
    assert(ns.length === ZONES[child].more + 1, `${child}: ${ns.length} NS records`);
    assert(ns.every((x) => x.ttl === ZONES[child].ttl), `${child} NS TTL ${ZONES[child].ttl}`);
    assert(r.some((x) => x.n === ZONES[child].host + "." && x.type === "A" && x.value === ZONES[child].ip), `glue ${ZONES[child].ip}`);
    ran++;
  }
  for (const name of NAMES) {
    const zone = pathOf(name).at(-1);
    const out = dig(ZONES[zone].ip, name);
    if (out === null) {
      console.log(`dig: ${ZONES[zone].host} did not answer, skipped`);
      continue;
    }
    const a = records(out).filter((x) => x.n === name && x.type === "A");
    assert(a.length === ANSWERS[name].more + 1 && a.every((x) => x.ttl === ANSWERS[name].ttl), `${name}: ${a.length} A records, TTL ${ANSWERS[name].ttl}`);
    // ponytail: www.google.com rotates its addresses, so only example.com's address is compared.
    if (name.includes("example")) assert(a.some((x) => x.value === ANSWERS[name].ip), `${name} has ${ANSWERS[name].ip}`);
    ran++;
  }
  console.log(`dig: ${ran} of 6 real answers match`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const m of FIRST.msgs) console.log(`${m.from.padEnd(8)} -> ${m.to.padEnd(8)} ${m.line}`);
  for (const name of NAMES) console.log(name.padEnd(18), PRESETS.map((dt) => `${dt}s:${scenario(name, dt).second.msgs.length}`).join("  "));
  console.log("model ok");
}
