// Check the words a reader sees or hears: scene narration (voice), the short on-screen line (say), caption and notes.
// The drawing should carry the idea, so text has a budget.
//   node words.mjs page.html            report: words per scene, long sentences, semicolons, notes prose and diagrams
//   node words.mjs page.html --text     the plain text only, one sentence per line, to pipe into a linter:
//   node words.mjs page.html --text | python3 ~/.claude/skills/explain-clear/scripts/ste-lint.py
// Exits 1 when a budget is broken. Budgets: narration 5 sentences and 70 words a scene, the on-screen line 1 sentence and
// 12 words when the page has narration (2 sentences and 30 words when it has none), any sentence 20 words (25 in notes),
// no semicolons, notes prose 250 words, and each notes section has a table or an SVG plus at most 3 sentences of prose.
// Reader text must not point to build files (model.mjs, build.mjs): the reader of the page does not have them.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.log("usage: node words.mjs page.html [--text]");
  process.exit(1);
}
const html = readFileSync(file, "utf8");
const plain = (s) =>
  s.replace(/<math[\s\S]*?<\/math>/g, " [math] ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
const sentences = (s) => plain(s).split(/(?<=[.!?])\s+(?=[A-Za-z0-9"(])/).filter(Boolean);
const words = (s) => s.split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;

const sayBox = html.match(/<div class="u-say"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
const ccBox = html.match(/<div class="u-cc"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
const atText = (box) => [...box.matchAll(/<p class="u-at" data-at="(\d+)"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[2]);
const says = atText(sayBox);
const voices = atText(ccBox);
const voiced = voices.length > 0;
const caption = html.match(/<span class="iso-caption">([\s\S]*?)<\/span>/)?.[1] ?? "";
const notes = html.match(/<section class="u-notes">([\s\S]*?)<\/section>/)?.[1] ?? "";
const sections = notes.split(/(?=<h2>)/).filter((s) => s.startsWith("<h2>")).map((s) => ({
  title: plain(s.match(/<h2>([\s\S]*?)<\/h2>/)[1]),
  prose: [...s.replace(/<table[\s\S]*?<\/table>/g, "").matchAll(/<(p|li)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map((m) => m[2]),
  pictures: (s.match(/<table|<svg|<img/g) ?? []).length,
}));

if (process.argv.includes("--text")) {
  for (const s of [...voices, ...says, caption, ...sections.flatMap((x) => x.prose)]) for (const line of sentences(s)) console.log(line);
  process.exit(0);
}

const problems = [];
const checkSentences = (where, s, limit) => {
  for (const line of sentences(s)) {
    if (words(line) > limit) problems.push(`${where}: ${words(line)} words: "${line}"`);
    if (line.includes(";")) problems.push(`${where}: semicolon: "${line}"`);
  }
};
const budget = (what, list, maxN, maxW) =>
  list.forEach((s, i) => {
    const n = sentences(s).length;
    const w = words(plain(s));
    console.log(`scene ${i + 1} ${what}: ${n} sentences, ${w} words`);
    if (n > maxN || w > maxW) problems.push(`scene ${i + 1} ${what}: ${n} sentences, ${w} words (budget ${maxN} and ${maxW}). Draw the rest, or cut it.`);
    checkSentences(`scene ${i + 1} ${what}`, s, 20);
  });
budget("voice", voices, 5, 70);
voiced ? budget("on screen", says, 1, 12) : budget("text", says, 2, 30);
checkSentences("caption", caption, 25);
let prose = 0;
for (const { title, prose: parts, pictures } of sections) {
  const w = parts.reduce((a, p) => a + words(plain(p)), 0);
  prose += w;
  console.log(`notes "${title}": ${w} words of prose, ${pictures} tables or pictures`);
  const n = parts.reduce((a, p) => a + sentences(p).length, 0);
  if (!pictures && w) problems.push(`notes "${title}": no table or SVG. Show it as a small diagram or a table.`);
  if (n > 3) problems.push(`notes "${title}": ${n} sentences of prose (budget 3). Move the rest into table rows or a diagram.`);
  parts.forEach((p) => checkSentences(`notes "${title}"`, p, 25));
}
for (const [where, s] of [...voices.map((s, i) => [`scene ${i + 1} voice`, s]), ...says.map((s, i) => [`scene ${i + 1}`, s]), ["caption", caption], ["notes", notes]]) {
  const hit = plain(s).match(/[^.]*\b(?:model|build)\.mjs\b[^.]*/);
  if (hit) problems.push(`${where}: points to a build file the reader does not have: "${hit[0].trim()}". Say what was checked, and with which tool.`);
}
console.log(`notes prose: ${prose} words (budget 250)`);
if (prose > 250) problems.push(`notes prose: ${prose} words (budget 250). Turn paragraphs into tables or small diagrams.`);
console.log(problems.length ? `\n${problems.length} problems:\n${problems.map((p) => "  " + p).join("\n")}` : "\nwords ok");
process.exit(problems.length ? 1 : 0);
