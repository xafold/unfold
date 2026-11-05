// Record a built page's narrated tour as an MP4 with the voice, and a fast silent GIF for a README.
//   node record.mjs page.html --out demo [--width 1440] [--max 200] [--gif-speed 6] [--gif-width 720]
// Writes <out>.mp4 and <out>.gif. Needs ffmpeg and Chrome.
// It presses Play in headless Chrome, takes timed screenshots of the card until the tour ends, and logs when
// each scene's clip starts. Then it rebuilds the video from the frames at their real times and lays the same
// clips (the page's own data-audio) under it at the logged times.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const page = args.find((a) => a.endsWith(".html"));
if (!page) {
  console.log("usage: node record.mjs page.html --out demo [--width 1440] [--max 200] [--gif-speed 6] [--gif-width 720]");
  process.exit(1);
}
const out = resolve(opt("--out", "demo"));
const maxSeconds = Number(opt("--max", 200));
const gifSpeed = Number(opt("--gif-speed", 6));
const gifWidth = Number(opt("--gif-width", 720));
const DRIVE = join(dirname(fileURLToPath(import.meta.url)), "drive.mjs");
const work = mkdtempSync(join(tmpdir(), "unfold-record-"));
const run = (cmd, list) => {
  const r = spawnSync(cmd, list, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || r.stdout).slice(-2000)}`);
  return r.stdout;
};

// Log each clip start: [ms, scene].
writeFileSync(join(work, "preload.js"), `window.__starts = [];
const __start = AudioBufferSourceNode.prototype.start;
AudioBufferSourceNode.prototype.start = function (...a) {
  window.__starts.push([performance.now(), Number(document.querySelector(".u-stage")?.dataset.scene)]);
  return __start.apply(this, a);
};`);

// A frame takes about 0.1 to 0.2 s, so this count covers maxSeconds; frames after the tour ends are dropped.
const frames = Math.ceil(maxSeconds / 0.1);
const state = `JSON.stringify([performance.now(), document.querySelector(".u-play").getAttribute("aria-pressed")])`;
const actions = [["wait", 1500], ["eval", state], ["click", ".u-play"]];
for (let k = 0; k < frames; k++) actions.push(["shot", join(work, `f${String(k).padStart(5, "0")}.png`)], ["eval", state]);
actions.push(["eval", "JSON.stringify(window.__starts)"]);
writeFileSync(join(work, "actions.json"), JSON.stringify(actions));

console.log(`recording ${page} (up to ${maxSeconds} s) ...`);
const log = run(process.execPath, [DRIVE, resolve(page), "--actions", join(work, "actions.json"), "--preload", join(work, "preload.js"), "--width", opt("--width", "1440")]);
const evals = [...log.matchAll(/eval: "?(.*?)"?$/gm)].map((m) => JSON.parse(m[1].replace(/\\"/g, '"')));
const starts = evals.pop();
const t0 = evals.shift()[0];
// evals[k] is the time after frame k. Keep frames until Play is released (the tour ended), plus 1.5 s.
let end = evals.findIndex(([, p], k) => k > 5 && p === "false");
if (end < 0) end = evals.length - 1;
const endTime = evals[end][0] + 1500;
const kept = evals.map(([t], k) => [k, t]).filter(([, t]) => t <= endTime);

// Frame list with real durations.
const list = kept.map(([k, t], i) => `file '${join(work, `f${String(k).padStart(5, "0")}.png`)}'\nduration ${(((kept[i + 1]?.[1] ?? t + 100) - t) / 1000).toFixed(3)}`);
list.push(`file '${join(work, `f${String(kept.at(-1)[0]).padStart(5, "0")}.png`)}'`);
writeFileSync(join(work, "frames.txt"), list.join("\n"));
const firstFrame = kept[0][1];

// The clips, from the page itself, by scene.
const html = readFileSync(page, "utf8");
const clip = {};
for (const m of html.matchAll(/data-at="(\d+)" data-audio="data:audio\/mpeg;base64,([^"]+)"/g)) {
  writeFileSync(join(work, `a${m[1]}.mp3`), Buffer.from(m[2], "base64"));
  clip[m[1]] = join(work, `a${m[1]}.mp3`);
}
const used = starts.filter(([, s]) => clip[s]);
const inputs = used.flatMap(([, s]) => ["-i", clip[s]]);
const delays = used.map(([t], i) => `[${i + 1}:a]adelay=${Math.max(0, Math.round(t - firstFrame))}:all=1[d${i}]`);
const mix = `${delays.join(";")};${used.map((_, i) => `[d${i}]`).join("")}amix=inputs=${used.length}:normalize=0[a]`;

run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "frames.txt"), ...inputs,
  "-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
  "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", `${out}.mp4`]);
run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(work, "frames.txt"),
  "-vf", `setpts=PTS/${gifSpeed},fps=10,scale=${gifWidth}:-1:flags=lanczos,split[x][y];[x]palettegen=max_colors=96:stats_mode=diff[p];[y][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
  `${out}.gif`]);
rmSync(work, { recursive: true, force: true });
console.log(`tour ${((endTime - t0) / 1000).toFixed(1)} s, ${kept.length} frames, ${used.length} clips (scenes ${used.map(([, s]) => s).join(",")})`);
console.log(`wrote ${out}.mp4 and ${out}.gif`);
