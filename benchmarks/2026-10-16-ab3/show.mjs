// node show.mjs <judge-dir>: print each run's reasons, strengths, weaknesses, errors and interaction feedback per arm.
import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2];
for (const f of readdirSync(dir).filter((f) => /^order[12]-run\d+\.json$/.test(f)).sort()) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  const o = j.structured_output ?? JSON.parse(j.response);
  const u = f.startsWith("order1") ? "B" : "A", b = u === "A" ? "B" : "A";
  const arm = (name, x) => `${name}+ ${x.biggest_strength}\n${name}- ${x.biggest_weakness}\n${name} errors: ${JSON.stringify(x.factual_errors)}\n${name} tried: ${JSON.stringify(x.interactions_tried)}\n${name} feedback: ${x.interaction_feedback}`;
  console.log(`\n== ${f}\nreasons: ${o.reasons}\n${arm("UNFOLD", o[u])}\n${arm("BASE", o[b])}\nshots viewed: ${o.screenshots_viewed.length}`);
}
