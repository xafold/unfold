// A tiny JavaScript event-loop simulator. Pure: every frame, queue, timer and output the figure shows
// comes from the trace below. It knows only the operations this program uses (log, setTimeout, then).
// ponytail: one timer is due as soon as the next step runs (a 0 ms delay); real delays and ordering
// between several timers would need a clock in the state, add it when a figure needs more than one timer.

export const PROGRAM = [
  { line: 1, code: 'console.log("A");', op: "log", value: "A" },
  { line: 2, code: 'setTimeout(() => console.log("B"), 0);', op: "timeout", cb: { id: "cbB", label: "() => log(B)", log: "B" } },
  { line: 3, code: 'Promise.resolve().then(() => console.log("C"));', op: "then", cb: { id: "cbC", label: "() => log(C)", log: "C" } },
  { line: 4, code: 'console.log("D");', op: "log", value: "D" },
];

// Every work item the figure draws. `kind` is its identity: the script, a timer (task) callback or a promise
// (microtask) callback. Frames that a line pushes for a moment (console.log, setTimeout, then) are "call".
export const ITEMS = {};
const item = (id, label, kind, extra = {}) => (ITEMS[id] = { id, label, kind, ...extra });

export function run(program = PROGRAM) {
  const steps = [];
  const state = { line: null, stack: [], webapi: [], tasks: [], micro: [], out: [] };
  const snap = (say, extra = {}) => steps.push({ t: steps.length, ...structuredClone(state), say, ...extra });
  let calls = 0;
  const call = (label) => item(`call${++calls}`, label, "call").id;
  const log = (value, by) => {
    item(`out${value}`, value, by);
    state.out.push(`out${value}`);
  };
  const timerDue = [];

  snap("nothing has run yet", { phase: "idle" });
  item("script", "script", "script");
  state.stack.push("script");
  snap("the loop takes the first task: the script", { phase: "script" });

  for (const statement of program) {
    state.line = statement.line;
    if (statement.op === "log") {
      const frame = call(`console.log("${statement.value}")`);
      state.stack.push(frame);
      log(statement.value, "script");
      snap(`line ${statement.line} prints ${statement.value} at once`, { phase: "script" });
      state.stack.pop();
    }
    if (statement.op === "timeout") {
      const frame = call("setTimeout(…)");
      state.stack.push(frame);
      item(statement.cb.id, statement.cb.label, "task", { line: statement.line, log: statement.cb.log });
      state.webapi.push(statement.cb.id);
      timerDue.push(statement.cb.id);
      snap(`line ${statement.line} hands its callback to a 0 ms timer`, { phase: "queue" });
      state.stack.pop();
      // The timer is due now, but its callback may only join the task queue; it cannot interrupt the script.
      state.webapi = state.webapi.filter((id) => !timerDue.includes(id));
      state.tasks.push(...timerDue.splice(0));
      snap("timer done: its callback waits in the task queue", { phase: "queue" });
    }
    if (statement.op === "then") {
      const frame = call(".then(…)");
      state.stack.push(frame);
      item(statement.cb.id, statement.cb.label, "micro", { line: statement.line, log: statement.cb.log });
      state.micro.push(statement.cb.id);
      snap(`line ${statement.line}: .then queues its callback as a microtask`, { phase: "queue" });
      state.stack.pop();
    }
  }

  state.line = null;
  state.stack.pop();
  snap("the script ends: the stack is empty", { phase: "drain" });

  // One turn of the loop: drain every microtask, then take one task. Repeat until nothing is left.
  const runCallback = (id, phase, why) => {
    const cb = ITEMS[id];
    state.stack.push(id);
    state.line = cb.line;
    const frame = call(`console.log("${cb.log}")`);
    state.stack.push(frame);
    log(cb.log, cb.kind);
    snap(`${why}: it prints ${cb.log}`, { phase });
    state.stack.pop();
    state.stack.pop();
    state.line = null;
  };
  while (state.micro.length || state.tasks.length) {
    while (state.micro.length) runCallback(state.micro.shift(), "drain", "stack empty, so microtasks run first");
    snap("no microtasks left", { phase: "drain" });
    if (state.tasks.length) runCallback(state.tasks.shift(), "task", "next task: the timer callback");
  }
  snap("all queues empty \u00b7 output " + state.out.map((id) => ITEMS[id].label).join(" "), { phase: "task" });
  return steps;
}

export const STEPS = run();
export const OUTPUT = STEPS.at(-1).out.map((id) => ITEMS[id].label).join("");

// Presence intervals for the timeline: where an item is (the bottom stack frame = the running task)
// from step `from` until step `to` (exclusive).
export function spans(steps = STEPS) {
  const lanes = { stack: (s) => s.stack.slice(0, 1), webapi: (s) => s.webapi, tasks: (s) => s.tasks, micro: (s) => s.micro };
  const out = [];
  for (const [lane, pick] of Object.entries(lanes)) {
    const open = new Map();
    steps.forEach((s, t) => {
      const here = new Set(pick(s));
      for (const id of here) if (!open.has(id)) open.set(id, t);
      for (const [id, from] of open) if (!here.has(id)) (out.push({ lane, id, from, to: t }), open.delete(id));
    });
    for (const [id, from] of open) out.push({ lane, id, from, to: steps.length });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  assert(OUTPUT === "ADCB", `output is A D C B (got ${OUTPUT})`);
  const at = (id) => STEPS.findIndex((s) => s.stack.includes(id));
  const scriptEnd = STEPS.findIndex((s, t) => t > 1 && !s.stack.includes("script"));
  assert(at("cbC") > scriptEnd && at("cbB") > scriptEnd, "no callback runs while the script is on the stack");
  assert(at("cbC") < at("cbB"), "the microtask runs before the next task");
  assert(STEPS.every((s) => !s.stack.includes("cbB") || s.micro.length === 0), "a task only starts when the microtask queue is empty");
  assert(STEPS.find((s) => s.tasks.includes("cbB")) && STEPS.findIndex((s) => s.tasks.includes("cbB")) < scriptEnd, "the timer callback waits in the task queue during the script");
  for (const s of STEPS) console.log(String(s.t).padStart(2), s.phase.padEnd(6), `[${s.stack.map((id) => ITEMS[id].label).join(", ")}]`.padEnd(40), `T[${s.tasks}] M[${s.micro}] W[${s.webapi}] out:${s.out.map((id) => ITEMS[id].label).join("")}`);
  for (const sp of spans()) console.log(sp.lane.padEnd(7), sp.id.padEnd(7), sp.from, "->", sp.to);
  console.log("model ok");
}
