// node score.mjs <judge-dir>: mean scores of unfold vs baseline over order1 (unfold = B) and order2 (unfold = A).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2];
const runs = readdirSync(dir).filter((f) => /^order[12]-run\d+\.json$/.test(f)).sort();
const C = ["accuracy", "core_idea_clarity", "visual_explanation", "interactivity", "language_coverage", "depth", "visual_design", "mobile_and_accessibility"];
const sum = { unfold: Object.fromEntries(C.map((c) => [c, 0])), baseline: Object.fromEntries(C.map((c) => [c, 0])) };
const wins = { unfold: 0, baseline: 0, tie: 0 };
let n = 0;
for (const f of runs) {
  const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const o = j.structured_output ?? JSON.parse(j.response);
  if (!o?.A) { console.log(f, "no result"); continue; }
  const u = f.startsWith("order1") ? "B" : "A";
  const b = u === "A" ? "B" : "A";
  for (const c of C) { sum.unfold[c] += o[u].scores[c]; sum.baseline[c] += o[b].scores[c]; }
  wins[o.winner === "tie" ? "tie" : o.winner === u ? "unfold" : "baseline"]++;
  n++;
  const tot = (x) => C.reduce((a, c) => a + o[x].scores[c], 0);
  console.log(`${f}: winner ${o.winner === u ? "unfold" : o.winner === "tie" ? "tie" : "baseline"} · unfold ${tot(u)} · baseline ${tot(b)}`);
}
console.log(`runs ${n} · wins: unfold ${wins.unfold}, baseline ${wins.baseline}, tie ${wins.tie}`);
for (const c of C) console.log(c.padEnd(26), (sum.unfold[c] / n).toFixed(2).padStart(6), (sum.baseline[c] / n).toFixed(2).padStart(6));
const T = (s) => (Object.values(s).reduce((a, v) => a + v, 0) / n).toFixed(2);
console.log("total /80".padEnd(26), T(sum.unfold).padStart(6), T(sum.baseline).padStart(6));
