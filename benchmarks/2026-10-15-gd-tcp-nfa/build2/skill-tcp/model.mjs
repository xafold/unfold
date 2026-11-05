// A tiny TCP simulator (RFC 9293 rules) for one connection: open, 5 bytes of data, close.
// Pure: every segment, state and counter the figure shows comes from run() below.
// `node model.mjs` also captures the same exchange from the Linux kernel on loopback (capture.py)
// and checks that every segment matches, with the model's ISNs replaced by the captured ones.
// ponytail: only the transitions this exchange uses; simultaneous open, RST and loss are left out.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ISN = { client: 1000, server: 5000 }; // chosen by hand: real ISNs are random 32-bit numbers
export const DATA = "hello";
const MOD = 2 ** 32;
// Sequence numbers a segment uses: one per data byte, plus one each for SYN and FIN.
export const uses = (seg) => seg.len + (seg.flags.includes("SYN") ? 1 : 0) + (seg.flags.includes("FIN") ? 1 : 0);

export function run(isn = ISN) {
  const side = (name) => ({ name, state: "CLOSED", iss: isn[name], sndUna: null, sndNxt: null, rcvNxt: null });
  const ep = { client: side("client"), server: side("server") };
  const other = (e) => (e.name === "client" ? ep.server : ep.client);
  ep.server.state = "LISTEN";
  const steps = [];
  const changes = []; // { side, state, t, at: "send" | "recv" | "timer" }
  const setState = (e, state, t, at) => {
    e.state = state;
    changes.push({ side: e.name, state, t, at });
  };
  const snap = (t, seg, say) =>
    steps.push({ t, seg, say, ...Object.fromEntries(Object.values(ep).map((e) => [e.name, { state: e.state, sndUna: e.sndUna, sndNxt: e.sndNxt, rcvNxt: e.rcvNxt }])) });
  changes.push({ side: "client", state: "CLOSED", t: 0, at: "start" }, { side: "server", state: "LISTEN", t: 0, at: "start" });
  snap(0, null, "client CLOSED, server LISTEN");

  const send = (e, flags, data = "") => {
    if (flags.includes("SYN")) e.sndUna = e.sndNxt = e.iss;
    const seg = { from: e.name, flags, seq: e.sndNxt, ack: flags.includes("ACK") ? e.rcvNxt : null, len: data.length, data };
    e.sndNxt = (e.sndNxt + uses(seg)) % MOD;
    return seg;
  };
  // What the receiver does with one segment: update its counters and state, and maybe answer.
  // The answer is returned as a function, so it goes on the wire (and moves SND.NXT) in the next step.
  const receive = (e, seg, t) => {
    if (seg.flags.includes("SYN")) e.rcvNxt = seg.seq;
    if (seg.seq !== e.rcvNxt) throw new Error(`${e.name}: out of order seq ${seg.seq}, expected ${e.rcvNxt}`);
    e.rcvNxt = (e.rcvNxt + uses(seg)) % MOD;
    if (seg.ack !== null) {
      if (seg.ack !== e.sndNxt) throw new Error(`${e.name}: ack ${seg.ack} is not SND.NXT ${e.sndNxt}`);
      e.sndUna = seg.ack;
    }
    const f = seg.flags;
    if (e.state === "LISTEN" && f.includes("SYN")) return setState(e, "SYN-RECEIVED", t, "recv"), () => send(e, ["SYN", "ACK"]);
    if (e.state === "SYN-SENT" && f.includes("SYN")) return setState(e, "ESTABLISHED", t, "recv"), () => send(e, ["ACK"]);
    if (e.state === "SYN-RECEIVED") return setState(e, "ESTABLISHED", t, "recv"), null;
    if (e.state === "ESTABLISHED" && f.includes("FIN")) return setState(e, "CLOSE-WAIT", t, "recv"), () => send(e, ["ACK"]);
    if (e.state === "ESTABLISHED" && seg.len) return () => send(e, ["ACK"]);
    if (e.state === "FIN-WAIT-1") return setState(e, "FIN-WAIT-2", t, "recv"), null;
    if (e.state === "FIN-WAIT-2" && f.includes("FIN")) return setState(e, "TIME-WAIT", t, "recv"), () => send(e, ["ACK"]);
    if (e.state === "LAST-ACK") return setState(e, "CLOSED", t, "recv"), null;
    return null;
  };
  // What the applications do, in order, each when the wire is quiet.
  const apps = [
    (t) => (setState(ep.client, "SYN-SENT", t, "send"), send(ep.client, ["SYN"])), // connect()
    () => send(ep.client, ["PSH", "ACK"], DATA), // send("hello")
    (t) => (setState(ep.client, "FIN-WAIT-1", t, "send"), send(ep.client, ["FIN", "ACK"])), // client close()
    (t) => (setState(ep.server, "LAST-ACK", t, "send"), send(ep.server, ["FIN", "ACK"])), // server close()
  ];
  let wire = null;
  while (wire || apps.length) {
    const t = steps.length;
    const seg = wire ? wire() : apps.shift()(t);
    wire = receive(other(ep[seg.from]), seg, t);
    snap(t, seg, "");
  }
  // TIME-WAIT ends after 2 MSL; nothing goes on the wire.
  setState(ep.client, "CLOSED", steps.length, "timer");
  snap(steps.length, null, "2·MSL timer ends: client CLOSED");
  return { steps, changes };
}

export const { steps: STEPS, changes: CHANGES } = run();
export const SEGMENTS = STEPS.filter((s) => s.seg).map((s) => s.seg);

// The sequence-number space of each direction: one cell per number used, in order.
export function space(from, segments = SEGMENTS) {
  const cells = [];
  for (const seg of segments.filter((s) => s.from === from)) {
    if (seg.flags.includes("SYN")) cells.push({ n: seg.seq, what: "SYN" });
    [...seg.data].forEach((ch, k) => cells.push({ n: seg.seq + k, what: ch }));
    if (seg.flags.includes("FIN")) cells.push({ n: seg.seq + seg.len, what: "FIN" });
  }
  return cells;
}

// The arithmetic the receiver does: ack = seq + len + SYN + FIN.
export const ackSum = (seg) => ({ seq: seg.seq, len: seg.len, syn: seg.flags.includes("SYN") ? 1 : 0, fin: seg.flags.includes("FIN") ? 1 : 0, ack: (seg.seq + uses(seg)) % MOD });

// The segment whose numbers an ack answers: the last one the other side sent before step t.
export function answers(t, steps = STEPS) {
  const from = steps[t].seg.from;
  for (let k = t - 1; k > 0; k--) if (steps[k].seg && steps[k].seg.from !== from) return steps[k];
  return null;
}

const HERE = dirname(fileURLToPath(import.meta.url));

// Runs capture.py in a fresh user + network namespace. Returns the segments, or { skipped } with the reason.
export function capture() {
  const r = spawnSync("unshare", ["-rn", "sh", "-c", "ip link set lo up && python3 capture.py"], { cwd: HERE, encoding: "utf8", timeout: 20000 });
  if (r.status !== 0) return { skipped: (r.stderr || r.error?.message || "unknown error").trim().split("\n").at(-1) };
  return JSON.parse(r.stdout);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  const segs = SEGMENTS;
  assert(segs.length === 9, `9 segments (got ${segs.length})`);
  assert(segs.slice(0, 3).map((s) => s.flags.join(",")).join(" ") === "SYN SYN,ACK ACK", "three-way handshake");
  assert(segs[1].ack === ISN.client + 1 && segs[2].ack === ISN.server + 1, "SYN uses one sequence number");
  assert(segs[4].ack === segs[3].seq + DATA.length, "data uses one number per byte");
  assert(segs[6].ack === segs[5].seq + 1 && segs[8].ack === segs[7].seq + 1, "FIN uses one sequence number");
  assert(segs[2].seq === segs[3].seq, "a pure ACK uses no sequence number");
  const last = STEPS.at(-1);
  assert(last.client.state === "CLOSED" && last.server.state === "CLOSED", "both sides end CLOSED");
  assert(STEPS[8].client.state === "TIME-WAIT", "the client waits in TIME-WAIT after the server's FIN");
  assert(STEPS[1].server.sndNxt === null && STEPS[2].server.sndNxt === ISN.server + 1, "the server's SYN counts from step 2, when it is sent");
  assert(space("client").map((c) => c.n).join() === "1000,1001,1002,1003,1004,1005,1006", "client space 1000..1006");
  assert(space("server").map((c) => c.n).join() === "5000,5001", "server space 5000..5001");

  for (const s of STEPS.filter((p) => p.seg?.ack != null)) assert(s.seg.ack === ackSum(answers(s.t).seg).ack, `step ${s.t}: ack = seq + len + SYN + FIN of the segment it answers`);

  for (const s of STEPS) {
    const g = s.seg;
    const line = g ? `${g.from.padEnd(6)} ${g.flags.join(",").padEnd(8)} seq=${g.seq} ack=${g.ack ?? "-"} len=${g.len}` : "".padEnd(40);
    console.log(String(s.t).padStart(2), line.padEnd(48), `client ${s.client.state.padEnd(11)} server ${s.server.state}`);
  }

  const real = capture();
  if (real.skipped) console.log("capture skipped:", real.skipped);
  else {
    assert(real.length === segs.length, `Linux sent ${real.length} segments, the model ${segs.length}`);
    const isn = { client: real[0].seq, server: real[1].seq };
    const again = run(isn).steps.filter((s) => s.seg).map((s) => s.seg);
    real.forEach((r, i) => {
      const m = again[i];
      const same = r.from === m.from && r.flags.join() === m.flags.join() && r.seq === m.seq && r.ack === m.ack && r.len === m.len;
      assert(same, `segment ${i + 1}: Linux ${JSON.stringify(r)} vs model ${JSON.stringify(m)}`);
    });
    writeFileSync(join(HERE, "capture.json"), JSON.stringify(real, null, 1));
    console.log(`capture ok: Linux matches all ${real.length} segments (ISNs ${isn.client} and ${isn.server}); wrote capture.json`);
  }
  console.log("model ok");
}
