// Capture the finished state of every scene: dark, light (if page-light.html exists), 390 px and reduced motion.
//   node shoot.mjs page.html --scenes 6 --out shots [--wait 4000] [--only dark,phone]
// Runs anatomy's drive.mjs once per variant. Files are <out>/<variant>-<scene>.png, scenes counted from 1.
// After the wait it also waits (up to 60 s) until the stage has no data-busy: a sweep made with
// UNFOLD.beat(scene, ms, fn, wait, count) is then finished. A sweep without a count loops and is shot as it stands.
// Each run also prints whether the page scrolls sideways, and each shot lists visible SVG text that overlaps
// other visible text in the drawing (a badge on a label, a value on a tick), which is a failure. It also fails
// when the scene's equation is wider than the equation bar: the bar scrolls by itself, so the page does not.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ANATOMY_DIR = process.env.ANATOMY_DIR ?? join(homedir(), ".claude", "skills", "anatomy");
const DRIVE = join(ANATOMY_DIR, "scripts", "drive.mjs");
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const page = args.find((a) => a.endsWith(".html"));
const scenes = Number(opt("--scenes", 0));
if (!page || !scenes) {
  console.log("usage: node shoot.mjs page.html --scenes N --out dir [--wait ms] [--only dark,light,phone,reduced]");
  process.exit(1);
}
const out = resolve(opt("--out", "shots"));
const wait = Number(opt("--wait", 4000));
const only = opt("--only", "dark,light,phone,reduced").split(",");
mkdirSync(out, { recursive: true });

const light = resolve(page).replace(/\.html$/, "-light.html");
const variants = [
  ["dark", resolve(page), ["--theme", "dark"]],
  ["light", light, []],
  ["phone", resolve(page), ["--width", "390"]],
  ["reduced", resolve(page), ["--reduced"]],
].filter(([name, file]) => only.includes(name) && existsSync(file));

// Visible text boxes in the drawing that overlap by more than 2 px across and a third of the shorter height.
const OVERLAP = `(() => {
  // Skip text on a slanted plane (iso floor labels): its box is far larger than its letters.
  const flat = (t) => { const m = t.getScreenCTM(); return !m || (Math.abs(m.b) < 0.01 && Math.abs(m.c) < 0.01); };
  const seen = (t) => t.textContent.trim() && flat(t) && t.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && Number(getComputedStyle(t).fillOpacity) > 0;
  const T = [...document.querySelectorAll(".u-stage svg text")].filter(seen).map((t) => [t, t.getBoundingClientRect()]).filter(([, r]) => r.width && r.height);
  const out = [];
  for (let i = 0; i < T.length; i++)
    for (let j = i + 1; j < T.length; j++) {
      const [a, ra] = T[i], [b, rb] = T[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (ox > 2 && oy > Math.min(ra.height, rb.height) / 3) out.push(JSON.stringify(a.textContent.trim().slice(0, 18)) + " on " + JSON.stringify(b.textContent.trim().slice(0, 18)));
    }
  const eq = document.querySelector(".u-eq");
  const at = eq && [...eq.children].find((c) => getComputedStyle(c).visibility === "visible");
  // Measure the content, not the element: a block <math> stretches to the widest scene's equation.
  const r = document.createRange();
  if (at) r.selectNodeContents(at.firstElementChild ?? at);
  const wide = at && r.getBoundingClientRect().width > eq.clientWidth + 1;
  return (out.length ? "TEXT OVERLAP: " + out.slice(0, 8).join(", ") : "text ok") + (wide ? " · EQUATION CUT: wider than the bar" : "");
})()`;

let failed = false;
for (const [name, file, flags] of variants) {
  // Voice off: the shots show each scene's finished state, not the part that the narration lights at that moment.
  const actions = [["eval", "((b) => (b ? (b.click(), 'voice off') : 'no voice'))(document.querySelector('.u-voice[aria-pressed=\"true\"]'))"]];
  for (let i = 0; i < scenes; i++) {
    if (i) actions.push(["key", "ArrowRight"]);
    actions.push(["wait", wait], ["until", "!document.querySelector('.u-stage[data-busy]')", 60000], ["shot", join(out, `${name}-${i + 1}.png`)], ["eval", OVERLAP]);
  }
  actions.push(["eval", "document.documentElement.scrollWidth > innerWidth + 1 ? 'SCROLLS SIDEWAYS' : 'no sideways scroll'"]);
  const list = join(out, `${name}.json`);
  writeFileSync(list, JSON.stringify(actions));
  const run = spawnSync(process.execPath, [DRIVE, file, "--actions", list, ...flags], { encoding: "utf8" });
  const lines = (run.stdout + run.stderr).split("\n").filter((l) => /readout|console|eval|rror|SIDEWAYS/.test(l));
  console.log(`== ${name}\n${lines.map((l) => "  " + l.replace(out + "/", "")).join("\n")}`);
  failed ||= run.status !== 0 || lines.some((l) => /SIDEWAYS|OVERLAP|EQUATION CUT|rror/.test(l) && !/console: clean/.test(l));
}
process.exit(failed ? 1 : 0);
