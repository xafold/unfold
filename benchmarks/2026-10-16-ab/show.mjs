// node show.mjs <judge-dir>: print each run's reasons, strengths, weaknesses and errors per arm.
import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2];
for (const f of readdirSync(dir).filter((f) => /^order[12]-run\d+\.json$/.test(f)).sort()) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  const o = j.structured_output ?? JSON.parse(j.response);
  const u = f.startsWith("order1") ? "B" : "A", b = u === "A" ? "B" : "A";
  console.log(`\n== ${f}\nreasons: ${o.reasons}\nUNFOLD+ ${o[u].biggest_strength}\nUNFOLD- ${o[u].biggest_weakness}\nUNFOLD errors: ${JSON.stringify(o[u].factual_errors)}\nBASE+ ${o[b].biggest_strength}\nBASE- ${o[b].biggest_weakness}\nBASE errors: ${JSON.stringify(o[b].factual_errors)}\nshots viewed: ${o.screenshots_viewed.length}`);
}
