// A tiny TCP endpoint model: two sides, each with a state, SND.NXT (next sequence number it will send) and
// RCV.NXT (next sequence number it expects). Every segment, number and state the figure shows comes from run().
// It knows only the path this figure draws: active open by the client, 5 bytes of data, active close by the client.
// ponytail: no loss, retransmission, windows or simultaneous open/close; add them when a figure needs them.
import { existsSync, readFileSync } from "node:fs";

export const MOD = 2 ** 32;
export const DATA = "hello";
export const PORTS = { client: 50612, server: 8080 };
// The ISN pairs the figure can show. "linux" is the pair from capture.txt (a real Linux connection).
export const ISN = {
  book: { client: 1000, server: 5000 },
  relative: { client: 0, server: 0 },
  linux: { client: 1681612212, server: 2877419702 },
};

const other = (side) => (side === "client" ? "server" : "client");
// How many sequence numbers a segment uses: one per data byte, plus one for SYN, plus one for FIN.
export const cost = (s) => s.len + (s.flags.includes("SYN") ? 1 : 0) + (s.flags.includes("FIN") ? 1 : 0);

export function run(isn = ISN.book) {
  const side = {
    client: { state: "CLOSED", snd: isn.client, rcv: null },
    server: { state: "LISTEN", snd: isn.server, rcv: null },
  };
  const segments = [];
  const changes = [
    { side: "client", state: "CLOSED", step: 0, at: "start" },
    { side: "server", state: "LISTEN", step: 0, at: "start" },
  ];
  const snapshot = () => structuredClone(side);
  const steps = [{ step: 0, sides: snapshot() }];
  const enter = (who, state, at) => {
    side[who].state = state;
    changes.push({ side: who, state, step: segments.length, at });
  };

  // One segment: the sender builds it from its own counters, the receiver checks it and moves its counters.
  const send = (from, flags, { data = "", sendState, recvState } = {}) => {
    const me = side[from];
    const you = side[other(from)];
    const seg = { n: segments.length + 1, from, to: other(from), flags, seq: me.snd, ack: flags.includes("ACK") ? me.rcv : null, len: data.length, data };
    segments.push(seg);
    me.snd = (me.snd + cost(seg)) % MOD;
    if (sendState) enter(from, sendState, "send");
    // The receiver: a SYN sets RCV.NXT from the peer's ISN; otherwise the segment must start at RCV.NXT.
    if (flags.includes("SYN")) you.rcv = seg.seq;
    if (seg.seq !== you.rcv) throw new Error(`segment ${seg.n} out of order: seq ${seg.seq}, expected ${you.rcv}`);
    if (seg.ack !== null && seg.ack !== you.snd) throw new Error(`segment ${seg.n} acks ${seg.ack}, but ${seg.to} has sent up to ${you.snd}`);
    you.rcv = (you.rcv + cost(seg)) % MOD;
    if (recvState) enter(seg.to, recvState, "recv");
    steps.push({ step: seg.n, sides: snapshot() });
  };

  send("client", ["SYN"], { sendState: "SYN-SENT", recvState: "SYN-RECEIVED" });
  send("server", ["SYN", "ACK"], { recvState: "ESTABLISHED" });
  send("client", ["ACK"], { recvState: "ESTABLISHED" });
  send("client", ["PSH", "ACK"], { data: DATA });
  send("server", ["ACK"]);
  send("client", ["FIN", "ACK"], { sendState: "FIN-WAIT-1", recvState: "CLOSE-WAIT" });
  send("server", ["ACK"], { recvState: "FIN-WAIT-2" });
  send("server", ["FIN", "ACK"], { sendState: "LAST-ACK", recvState: "TIME-WAIT" });
  send("client", ["ACK"], { recvState: "CLOSED" });
  // The last step is time, not a segment: TIME-WAIT ends after 2 MSL.
  side.client.state = "CLOSED";
  changes.push({ side: "client", state: "CLOSED", step: segments.length + 1, at: "timer" });
  steps.push({ step: segments.length + 1, sides: snapshot() });
  return { segments, changes, steps };
}

export const BOOK = run(ISN.book);

// tcpdump -S prints "Flags [S.]" etc. Map its letters to flag names, in the order the figure prints them.
const LETTERS = { F: "FIN", S: "SYN", R: "RST", P: "PSH", ".": "ACK" };
const ORDER = ["URG", "PSH", "RST", "SYN", "FIN", "ACK"];
export function parseTcpdump(text) {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const [, src, flagText] = line.match(/IP \S+?\.(\d+) > \S+?: Flags \[([^\]]*)\]/);
      const seq = line.match(/seq (\d+)/)?.[1];
      const ack = line.match(/ack (\d+)/)?.[1];
      return {
        from: Number(src) === PORTS.client ? "client" : "server",
        flags: [...flagText].map((c) => LETTERS[c]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
        seq: seq === undefined ? null : Number(seq),
        ack: ack === undefined ? null : Number(ack),
        len: Number(line.match(/length (\d+)/)[1]),
      };
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => {
    if (!ok) {
      console.error("FAIL", what);
      process.exit(1);
    }
  };
  const flagsOf = (s) => [...s.flags].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(",");
  const { segments, steps } = BOOK;
  assert(segments.length === 9, "9 segments: 3 open, 2 data, 4 close");
  assert(segments[0].seq === 1000 && segments[1].ack === 1001, "SYN uses one sequence number: ack = x + 1");
  assert(segments[2].seq === 1001 && segments[2].ack === 5001, "third segment: seq = x + 1, ack = y + 1");
  assert(segments[4].ack === 1006, "ack after 5 data bytes = 1001 + 5");
  assert(segments[6].ack === 1007 && segments[8].ack === 5002, "each FIN uses one sequence number");
  assert(steps[3].sides.client.state === "ESTABLISHED" && steps[3].sides.server.state === "ESTABLISHED", "both ESTABLISHED after the third segment");
  assert(steps[9].sides.client.state === "TIME-WAIT" && steps[9].sides.server.state === "CLOSED", "client waits, server closed");
  // Every ack equals the RCV.NXT of its sender at that moment.
  segments.forEach((s, i) => s.ack === null || assert(s.ack === steps[i].sides[s.from].rcv, `segment ${s.n}: ack is RCV.NXT`));
  // Wrap-around: the arithmetic is mod 2^32.
  const wrap = run({ client: MOD - 3, server: 7 }).segments;
  assert(wrap[3].seq === MOD - 2 && wrap[4].ack === 3, "sequence numbers wrap mod 2^32");

  for (const s of segments)
    console.log(String(s.n).padStart(2), s.from.padEnd(6), flagsOf(s).padEnd(8), `seq ${s.seq}`.padEnd(10), `ack ${s.ack ?? "-"}`.padEnd(10), `len ${s.len}`, " ", steps[s.n].sides.client.state.padEnd(12), steps[s.n].sides.server.state);

  // Compare with a real Linux connection, captured by capture.sh. tcpdump hides seq on a pure ACK with no data.
  const file = new URL("./capture.txt", import.meta.url);
  if (existsSync(file)) {
    const real = parseTcpdump(readFileSync(file, "utf8"));
    const linux = run(ISN.linux).segments;
    assert(real.length === linux.length, `capture has ${real.length} segments, model ${linux.length}`);
    real.forEach((r, i) => {
      const m = linux[i];
      const what = `segment ${i + 1}`;
      assert(r.from === m.from, `${what}: sender`);
      assert(r.flags.join(",") === flagsOf(m), `${what}: flags ${r.flags} vs ${flagsOf(m)}`);
      assert(r.seq === null || r.seq === m.seq, `${what}: seq ${r.seq} vs ${m.seq}`);
      assert(r.ack === m.ack, `${what}: ack ${r.ack} vs ${m.ack}`);
      assert(r.len === m.len, `${what}: len`);
    });
    console.log("capture.txt: all 9 segments match the model (flags, seq, ack, length)");
  } else console.log("capture.txt missing: run `unshare -rn sh capture.sh > capture.txt` to check against Linux");
  console.log("model ok");
}
