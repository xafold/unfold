// One program, six languages: sum_sq(3, 4) calls square twice and returns 25.
// Each language's `lines` are the whole program, and `node model.mjs` runs exactly those lines with the real tool.
// run() is a tiny evaluator of the same program. Every frame, value and line in the figure comes from its trace.
// The two "what differs" scenes also come from real tools: `code` is what the compiler or VM makes of
// `return square(a) + square(b)`, and `depth` is how deep a recursive call got before the stack ran out.

// Generic line ids used by the trace: 1 square header, 2 its return, 4 sum_sq header, 5 its return, 7 the call site.
// `at` maps them to the line numbers of each language's program.
// code.lines: [text, role, note]. Roles: "arg" puts an argument in place, "call" makes the call, "ret" is a result
// coming back or the return, "gap" marks tool lines the figure leaves out. `check` is the text that must appear,
// in order, in the tool's output.
export const LANGS = [
  {
    id: "python", name: "Python", names: { sum_sq: "sum_sq", main: "<module>" },
    lines: ["def square(x):", "    return x * x", "", "def sum_sq(a, b):", "    return square(a) + square(b)", "", "print(sum_sq(3, 4))"],
    at: { 1: 1, 2: 2, 4: 4, 5: 5, 7: 7 }, file: "main.py", run: (f) => ["python3", [f]],
    code: {
      kind: "CPython 3.13 bytecode", tool: "python3 -m dis",
      lines: [
        ["RESUME       0", "", ""],
        ["LOAD_GLOBAL  1 (square + NULL)", "", "find square"],
        ["LOAD_FAST    0 (a)", "arg", "push a"],
        ["CALL         1", "call", "call, 1 argument"],
        ["LOAD_GLOBAL  1 (square + NULL)", "", ""],
        ["LOAD_FAST    1 (b)", "arg", "push b"],
        ["CALL         1", "call", ""],
        ["BINARY_OP    0 (+)", "", "9 + 16"],
        ["RETURN_VALUE", "ret", "back to the caller"],
      ],
      dump: (dir) => ["python3", ["-c", `import dis, runpy; dis.dis(runpy.run_path("${dir}/main.py")["sum_sq"])`]],
    },
    depth: {
      measured: 999, twice: 1995, stack: "1000 frames", source: "sys.getrecursionlimit()", end: "RecursionError, which the program can catch",
      probe: { file: "d.py", text: "depth = 0\ndef down(n):\n    global depth\n    depth = n\n    down(n + 1)\ntry:\n    down(1)\nexcept RecursionError:\n    print(depth)\n", run: (f) => ["python3", [f]], twice: (f) => ["python3", ["-c", `import sys, runpy; sys.setrecursionlimit(2000); runpy.run_path("${f}")`]] },
    },
  },
  {
    id: "javascript", name: "JavaScript", names: { sum_sq: "sumSq", main: "<anonymous>" },
    lines: ["function square(x) {", "  return x * x;", "}", "function sumSq(a, b) {", "  return square(a) + square(b);", "}", "console.log(sumSq(3, 4));"],
    at: { 1: 1, 2: 2, 4: 4, 5: 5, 7: 7 }, file: "main.js", run: (f) => ["node", [f]],
    code: {
      kind: "V8 Ignition bytecode (Node 24)", tool: "node --print-bytecode",
      lines: [
        ["LdaImmutableCurrentContextSlot [2]", "", "find square"],
        ["Star0", "", ""],
        ["CallUndefinedReceiver1 r0, a0, [1]", "call", "call with a0 = a"],
        ["Star0", "ret", "keep the result"],
        ["LdaImmutableCurrentContextSlot [2]", "", ""],
        ["Star1", "", ""],
        ["CallUndefinedReceiver1 r1, a1, [3]", "call", "call with a1 = b"],
        ["Add r0, [0]", "", "9 + 16"],
        ["Return", "ret", "back to the caller"],
      ],
      dump: (dir) => ["node", ["--print-bytecode", "--print-bytecode-filter=sumSq", `${dir}/main.js`]],
    },
    depth: {
      measured: 10455, twice: 20951, stack: "984 KiB", source: "node --stack-size", end: "RangeError, which the program can catch",
      probe: { file: "d.js", text: "let depth = 0;\nfunction down(n) { depth = n; down(n + 1); }\ntry { down(1); } catch (e) { console.log(depth); }\n", run: (f) => ["node", [f]], twice: (f) => ["node", ["--stack-size=1968", f]] },
    },
  },
  {
    id: "ruby", name: "Ruby", names: { sum_sq: "sum_sq", main: "<main>" },
    lines: ["def square(x)", "  return x * x", "end", "def sum_sq(a, b)", "  return square(a) + square(b)", "end", "puts sum_sq(3, 4)"],
    at: { 1: 1, 2: 2, 4: 4, 5: 5, 7: 7 }, file: "main.rb", run: (f) => ["ruby", [f]],
    code: {
      kind: "YARV instructions (Ruby 3.2)", tool: "ruby --dump=insns",
      lines: [
        ["putself", "", "the receiver"],
        ["getlocal_WC_0 a@0", "arg", "push a"],
        ["opt_send_without_block mid:square", "call", "call, argc:1"],
        ["putself", "", ""],
        ["getlocal_WC_0 b@1", "arg", "push b"],
        ["opt_send_without_block mid:square", "call", ""],
        ["opt_plus", "", "9 + 16"],
        ["leave", "ret", "back to the caller"],
      ],
      // The tool prints "<calldata!mid:square, argc:1, FCALL|ARGS_SIMPLE>"; the figure keeps only mid:square.
      check: (l) => l[0].replace("opt_send_without_block mid:square", "opt_send_without_block <calldata!mid:square"),
      dump: (dir) => ["ruby", ["--dump=insns", `${dir}/main.rb`]],
    },
    depth: {
      measured: 10080, twice: 20162, stack: "1 MiB", source: "RUBY_THREAD_VM_STACK_SIZE", end: "SystemStackError, which the program can catch",
      probe: { file: "d.rb", text: "$depth = 0\ndef down(n)\n  $depth = n\n  down(n + 1)\nend\nbegin\n  down(1)\nrescue SystemStackError\n  puts $depth\nend\n", run: (f) => ["ruby", [f]], twice: (f) => ["sh", ["-c", `RUBY_THREAD_VM_STACK_SIZE=2097152 ruby ${f}`]] },
    },
  },
  {
    id: "c", name: "C", names: { sum_sq: "sum_sq", main: "main" },
    lines: ["#include <stdio.h>", "int square(int x) {", "  return x * x;", "}", "int sum_sq(int a, int b) {", "  return square(a) + square(b);", "}", "int main(void) {", '  printf("%d\\n", sum_sq(3, 4));', "}"],
    at: { 1: 2, 2: 3, 4: 5, 5: 6, 7: 9 }, file: "main.c", run: (f, dir) => ["sh", ["-c", `gcc -Wall -Werror -o ${dir}/c.out ${f} && ${dir}/c.out`]],
    code: {
      kind: "x86-64 machine code (gcc 13, -O0)", tool: "gcc -S -O0",
      lines: [
        ["⋯ 5 lines: endbr64, then push rbp and rbx", "gap", ""],
        ["movl  %edi, -12(%rbp)", "", "save a in the frame"],
        ["movl  %esi, -16(%rbp)", "", "save b in the frame"],
        ["movl  -12(%rbp), %eax", "", ""],
        ["movl  %eax, %edi", "arg", "1st argument: edi"],
        ["call  square", "call", "push return address"],
        ["movl  %eax, %ebx", "ret", "result came in eax"],
        ["movl  -16(%rbp), %eax", "", ""],
        ["movl  %eax, %edi", "arg", "b goes in edi"],
        ["call  square", "call", ""],
        ["addl  %ebx, %eax", "", "9 + 16 in eax"],
        ["movq  -8(%rbp), %rbx", "", "restore rbx"],
        ["leave", "", "drop the frame"],
        ["ret", "ret", "pop address, jump"],
      ],
      dump: (dir) => ["gcc", ["-O0", "-S", "-o", "-", `${dir}/main.c`]],
    },
    depth: {
      measured: 261000, twice: 523000, stack: "8 MiB", source: "ulimit -s", end: "SIGSEGV: the OS kills the process",
      probe: { file: "d.c", text: '#include <stdio.h>\nvoid down(long n) {\n  if (n % 1000 == 0) fprintf(stderr, "%ld\\n", n);\n  down(n + 1);\n}\nint main(void) { down(1); }\n', run: (f, dir) => ["sh", ["-c", `gcc -O0 -w -o ${dir}/d.out ${f} && ${dir}/d.out`]], twice: (f, dir) => ["sh", ["-c", `ulimit -s 16384 && ${dir}/d.out`]] },
    },
  },
  {
    id: "java", name: "Java", names: { sum_sq: "sumSq", main: "main" },
    lines: ["class Main {", "  static int square(int x) {", "    return x * x;", "  }", "  static int sumSq(int a, int b) {", "    return square(a) + square(b);", "  }", "  public static void main(String[] args) {", "    System.out.println(sumSq(3, 4));", "  }", "}"],
    at: { 1: 2, 2: 3, 4: 5, 5: 6, 7: 9 }, file: "Main.java", run: (f) => ["java", [f]],
    code: {
      kind: "JVM bytecode (javac 21)", tool: "javap -c",
      lines: [
        ["iload_0", "arg", "push a"],
        ["invokestatic  #7", "call", "Method square:(I)I"],
        ["iload_1", "arg", "push b"],
        ["invokestatic  #7", "call", ""],
        ["iadd", "", "9 + 16"],
        ["ireturn", "ret", "back to the caller"],
      ],
      dump: (dir) => ["sh", ["-c", `cd ${dir} && java -m jdk.compiler/com.sun.tools.javac.Main -d . Main.java && java -m jdk.jdeps/com.sun.tools.javap.Main -c -cp . Main`]],
    },
    depth: {
      measured: 21800, twice: 46500, stack: "1 MiB", source: "java -Xss", end: "StackOverflowError, which the program can catch",
      probe: { file: "D.java", text: "class D {\n  static int depth = 0;\n  static void down(int n) { depth = n; down(n + 1); }\n  public static void main(String[] args) {\n    try { down(1); } catch (StackOverflowError e) { System.out.println(depth); }\n  }\n}\n", run: (f) => ["java", [f]], twice: (f) => ["java", ["-Xss2m", f]] },
    },
  },
  {
    id: "rust", name: "Rust", names: { sum_sq: "sum_sq", main: "main" },
    lines: ["fn square(x: i32) -> i32 {", "    return x * x;", "}", "fn sum_sq(a: i32, b: i32) -> i32 {", "    return square(a) + square(b);", "}", "fn main() {", '    println!("{}", sum_sq(3, 4));', "}"],
    at: { 1: 1, 2: 2, 4: 4, 5: 5, 7: 8 }, file: "main.rs", run: (f, dir) => ["sh", ["-c", `rustc -D warnings -o ${dir}/rs.out ${f} && ${dir}/rs.out`]],
    code: {
      kind: "x86-64 machine code (rustc 1.95, debug)", tool: "rustc --emit asm",
      lines: [
        ["subq  $24, %rsp", "", "make the frame"],
        ["movl  %esi, 12(%rsp)", "", "save b; a is in edi"],
        ["callq main::square", "call", "push return address"],
        ["movl  12(%rsp), %edi", "arg", "b goes in edi"],
        ["movl  %eax, 16(%rsp)", "ret", "result came in eax"],
        ["callq main::square", "call", ""],
        ["movl  %eax, %ecx", "ret", ""],
        ["movl  16(%rsp), %eax", "", ""],
        ["addl  %ecx, %eax", "", "9 + 16"],
        ["movl  %eax, 20(%rsp)", "", ""],
        ["seto  %al", "", ""],
        ["jo    .LBB10_2", "", "overflow? panic"],
        ["movl  20(%rsp), %eax", "ret", "result in eax"],
        ["addq  $24, %rsp", "", "drop the frame"],
        ["retq", "ret", "pop address, jump"],
      ],
      // The tool prints the mangled name (_ZN4main6square17h…E); the figure shows it demangled.
      check: (l) => l[0].replace("callq main::square", "callq _ZN4main6square"),
      dump: (dir) => ["sh", ["-c", `rustc -C opt-level=0 --emit asm -o ${dir}/main.s ${dir}/main.rs && cat ${dir}/main.s`]],
    },
    depth: {
      measured: 130000, twice: 261000, stack: "8 MiB", source: "ulimit -s", end: "the runtime prints \"has overflowed its stack\" and aborts",
      probe: { file: "d.rs", text: 'fn down(n: u64) {\n    if n % 1000 == 0 { eprintln!("{}", n); }\n    down(n + 1);\n}\nfn main() { down(1); }\n', run: (f, dir) => ["sh", ["-c", `rustc -A warnings -C opt-level=0 -o ${dir}/drs.out ${f} && ${dir}/drs.out`]], twice: (f, dir) => ["sh", ["-c", `ulimit -s 16384 && ${dir}/drs.out`]] },
    },
  },
];

// Bytes per frame: the stack size over the depth reached. Python's limit is a frame count, not bytes.
const KIB = { "984 KiB": 984 * 1024, "1 MiB": 1 << 20, "8 MiB": 8 << 20 };
for (const lang of LANGS) lang.depth.bytes = KIB[lang.depth.stack] ? Math.round(KIB[lang.depth.stack] / lang.depth.measured) : null;

// The program as a tree. `line` is where the header sits, `body` the line of its return.
const num = (v) => ({ k: "num", v });
const ref = (name) => ({ k: "var", name });
const call = (fn, ...args) => ({ k: "call", fn, args });
const bin = (op, l, r) => ({ k: "bin", op, l, r });
export const FNS = {
  square: { params: ["x"], line: 1, body: 2, expr: bin("*", ref("x"), ref("x")) },
  sum_sq: { params: ["a", "b"], line: 4, body: 5, expr: bin("+", call("square", ref("a")), call("square", ref("b"))) },
};
const CALL_LINE = 7;
const MAIN = call("sum_sq", num(3), num(4));
const OPS = { "+": (a, b) => a + b, "*": (a, b) => a * b };

// An expression as coloured segments: { t, hue } or { fn } for a function name the page renames per language.
// A value that came from an argument or a variable is gold; a value a call returned is red.
function segments(node) {
  if (node.k === "num") return [{ t: String(node.v), hue: "gold" }];
  if (node.k === "var") return node.val === undefined ? [{ t: node.name, hue: "green" }] : [{ t: String(node.val), hue: "gold" }];
  if (node.k === "bin") return [...segments(node.l), { t: ` ${node.op} ` }, ...segments(node.r)];
  if (node.val !== undefined) return [{ t: String(node.val), hue: "red" }];
  return [{ fn: node.fn }, { t: "(" }, ...node.args.flatMap((a, i) => [...(i ? [{ t: ", " }] : []), ...segments(a)]), { t: ")" }];
}

export function run() {
  const steps = [];
  const stack = [];
  const counts = {};
  let line = CALL_LINE;
  let out = "";
  const snap = (say, chips = []) =>
    steps.push({
      t: steps.length, line, out, say, chips,
      // A frame below the top waits at the line of its call: that is where its return lands.
      frames: stack.map((f, i) => ({
        id: f.id, fn: f.fn, vars: Object.entries(f.vars), expr: segments(f.expr),
        line: i === stack.length - 1 ? line : f.fn === "main" ? CALL_LINE : FNS[f.fn].body,
      })),
    });
  const value = (node, frame) => (node.k === "num" ? node.v : frame.vars[node.name]);

  // A call: evaluate the arguments in the caller, push a frame, bind parameters, run the body, return, pop.
  function invoke(node, caller) {
    const fn = FNS[node.fn];
    const id = `${node.fn}${(counts[node.fn] = (counts[node.fn] ?? 0) + 1)}`;
    const vals = node.args.map((a) => (a.val = value(a, caller)));
    const argChips = vals.map((v, i) => ({ id: `arg-${id}-${i}`, text: String(v), hue: "gold" }));
    const named = node.args.map((a, i) => (a.k === "var" ? `${a.name} is ${vals[i]}, so ` : "")).join("");
    snap(`${named}{${node.fn}}(${vals.join(", ")}): ${vals.length > 1 ? "the arguments are" : "the argument is"} ${vals.join(" and ")}`, argChips.map((c) => ({ ...c, frame: caller.id, slot: "expr" })));

    const frame = { id, fn: node.fn, vars: Object.fromEntries(fn.params.map((p, i) => [p, vals[i]])), expr: structuredClone(fn.expr) };
    stack.push(frame);
    line = fn.line;
    const binds = fn.params.map((p, i) => `${p} = ${vals[i]}`).join(", ");
    snap(`new frame for {${node.fn}}: ${binds}`, argChips.map((c, i) => ({ ...c, frame: id, slot: `p${i}` })));

    line = fn.body;
    const result = evaluate(frame.expr, frame);
    const ret = { id: `ret-${id}`, text: String(result), hue: "red" };
    snap(`{${node.fn}} computes ${show(frame.expr)} = ${result} and returns ${result}`, [{ ...ret, frame: id, slot: "ret" }]);

    stack.pop();
    node.val = result;
    line = caller.id === "main" ? CALL_LINE : FNS[caller.fn].body;
    snap(`frame of {${node.fn}} removed: ${result} replaces the call`, [{ ...ret, frame: caller.id, slot: "expr" }]);
    return result;
  }
  // Variables are read at once; a call inside an expression runs to its end before the expression goes on.
  function evaluate(node, frame) {
    if (node.k === "num" || node.k === "var") return (node.val = value(node, frame));
    if (node.k === "call") return invoke(node, frame);
    return OPS[node.op](evaluate(node.l, frame), evaluate(node.r, frame));
  }
  const show = (node) => segments(node).map((s) => s.t ?? s.fn).join("");

  const main = { id: "main", fn: "main", vars: {}, expr: MAIN };
  stack.push(main);
  const result = invoke(MAIN, main);
  // The print runs while the top-level frame is still on the stack; that frame ends after it.
  out = String(result);
  snap(`{main} prints ${result}; its frame is still on the stack`, [{ id: "ret-sum_sq1", text: out, hue: "red", frame: "console", slot: "out" }]);
  stack.pop();
  snap(`{main} ends and its frame is removed; the stack is empty`, [{ id: "ret-sum_sq1", text: out, hue: "red", frame: "console", slot: "out" }]);
  return steps;
}

export const STEPS = run();
export const RESULT = Number(STEPS.at(-1).out);

if (import.meta.url === `file://${process.argv[1]}`) {
  const { execFileSync, spawnSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const assert = (ok, what) => { if (!ok) { console.error("FAIL", what); process.exit(1); } };
  const square = (x) => x * x;
  assert(RESULT === square(3) + square(4), `sum_sq(3, 4) is 25 (got ${RESULT})`);
  assert(Math.max(...STEPS.map((s) => s.frames.length)) === 3, "at most three frames: main, sum_sq, square");
  assert(STEPS.at(-2).out === "25" && STEPS.at(-2).frames.length === 1 && STEPS.at(-2).frames[0].id === "main", "main is still on the stack while it prints");
  assert(STEPS.at(-1).frames.length === 0, "the stack is empty at the end");
  const xs = STEPS.flatMap((s) => s.frames.filter((f) => f.fn === "square").map((f) => `${f.id}:${f.vars[0][1]}`));
  assert(new Set(xs).size === 2 && xs.includes("square1:3") && xs.includes("square2:4"), "two separate square frames, x = 3 and x = 4");
  assert(STEPS.every((s) => s.frames.every((f, i) => i === 0 || f.id !== s.frames[i - 1].id)), "a frame is never on the stack twice");
  for (const lang of LANGS) {
    const l = (k) => lang.lines[lang.at[k] - 1];
    assert(l(1).includes("square(") && l(2).includes("x * x") && l(4).includes(lang.names.sum_sq + "(") && l(5).includes("square(a) + square(b)") && l(7).includes(lang.names.sum_sq + "(3, 4)"), `${lang.name}: line map matches the program`);
  }

  const dir = mkdtempSync(join(tmpdir(), "function-call-"));
  const tool = (cmd, args) => {
    try {
      return execFileSync(cmd, args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  };
  // Squash runs of spaces so "movl\t%eax, %edi" in the tool matches "movl  %eax, %edi" in the figure.
  const squash = (s) => s.replace(/\s+/g, " ").trim();
  for (const lang of LANGS) {
    // 1. The program, exactly as the figure shows it, prints the model's result.
    const file = join(dir, lang.file);
    writeFileSync(file, lang.lines.join("\n") + "\n");
    const printed = tool(...lang.run(file, dir));
    if (printed === null) { console.log(`${lang.name.padEnd(11)} skipped: tool not installed`); continue; }
    assert(printed.trim() === String(RESULT), `${lang.name} prints ${RESULT} (got ${printed.trim()})`);

    // 2. Every listing line is in the tool's output, in order.
    const dump = squash(tool(...lang.code.dump(dir)));
    let from = 0;
    for (const row of lang.code.lines) {
      if (row[1] === "gap") continue;
      const want = squash(lang.code.check ? lang.code.check(row) : row[0]);
      const at = dump.indexOf(want, from);
      assert(at >= 0, `${lang.name}: "${want}" is in the ${lang.code.tool} output, in order`);
      from = at + want.length;
    }

    // 3. Recursion depth: near the stored value, and about twice as deep with twice the stack.
    const p = lang.depth.probe;
    const pf = join(dir, p.file);
    writeFileSync(pf, p.text);
    const deepest = (args) => {
      const r = spawnSync(args[0], args[1], { cwd: dir, encoding: "utf8" });
      return Math.max(...(r.stdout + r.stderr).split("\n").filter((x) => /^\d+$/.test(x)).map(Number));
    };
    const once = deepest(p.run(pf, dir));
    const twice = deepest(p.twice(pf, dir));
    assert(Math.abs(once / lang.depth.measured - 1) < 0.15, `${lang.name}: depth ${once} is near the stored ${lang.depth.measured}`);
    assert(Math.abs(twice / once - 2) < 0.3, `${lang.name}: twice the stack gives about twice the depth (${once} -> ${twice})`);
    assert(Math.abs(twice / lang.depth.twice - 1) < 0.15, `${lang.name}: depth with twice the stack ${twice} is near the stored ${lang.depth.twice}`);
    console.log(`${lang.name.padEnd(11)} prints ${printed.trim()} · ${lang.code.lines.length} listing lines found · depth ${once}, ${twice} with twice the stack`);
  }

  // 4. Claims in the notes: gcc -O2 turns a tail call into a jump, and folds sum_sq(3, 4) to 25 at compile time.
  const tail = join(dir, "tail.c");
  writeFileSync(tail, '#include <stdio.h>\nlong down(long n, long stop) { return n == stop ? n : down(n + 1, stop); }\nint main(void) { printf("%ld\\n", down(0, 100000000)); }\n');
  if (tool("gcc", ["-O2", "-o", join(dir, "tail2"), tail]) !== null) {
    assert(tool(join(dir, "tail2"), []).trim() === "100000000", "gcc -O2: 100 million tail calls run in constant stack");
    tool("gcc", ["-O0", "-o", join(dir, "tail0"), tail]);
    assert(spawnSync(join(dir, "tail0")).signal === "SIGSEGV", "gcc -O0: the same tail calls overflow the stack");
    const main2 = tool("gcc", ["-O2", "-S", "-o", "-", join(dir, "main.c")]);
    assert(/^main:[\s\S]*?\$25,[\s\S]*?\.cfi_endproc/m.test(main2) && !/call\s+sum_sq/.test(main2.slice(main2.indexOf("\nmain:"))), "gcc -O2: main holds the constant 25 and does not call sum_sq");
    console.log("gcc -O2     tail call becomes a jump; sum_sq(3, 4) folds to 25");
  }
  rmSync(dir, { recursive: true, force: true });

  for (const s of STEPS) console.log(String(s.t).padStart(2), `L${s.line}`, s.frames.map((f) => `${f.id}(${f.vars.map((v) => v.join("=")).join(",")})`).join(" > ").padEnd(42), s.say);
  console.log("model ok");
}
