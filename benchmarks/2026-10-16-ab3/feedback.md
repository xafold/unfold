# Feedback from the 2026-10-16 ab3 run

Judge: Gemini 4 Argon High in agy (`gemini-4-argon-high`) for the hash table and the binary search control. The Argon quota ran out before the binary search page was judged, so both binary search pages were then judged with Gemini 3.8 Flash High (`gemini-3.8-flash-high`). Each judge has 2 runs per prompt with A and B swapped. Raw output: `judge/<folder>/order*-run1.json`. Print it with `node show.mjs judge/<folder>`.

The unfold pages were built with the skill after the "What wins a blind test" rules were added to `SKILL.md` (skill v4). The baseline pages are the ab2 pages, unchanged.

**Binary search has no Argon result for the ab3 page.** Both Argon runs stopped with `RESOURCE_EXHAUSTED (code 429): Individual quota reached`, with a reset in about 165 hours (on about 2026-10-23). The failed outputs are in `judge/bsearch/order*-quota.json`. So the ab3 page and the ab2 control were both judged with Flash, in `judge/bsearch-flash` and `judge/bsearch-ab2-flash` (`SUFFIX=flash`). Compare Flash rows only with Flash rows.

## The judge now uses the pages

This run changes the judge protocol. The ab2 judge read the HTML and 5 screenshots made by the builder. The ab3 judge gets no screenshots. It drives both pages in headless Chrome with anatomy's `drive.mjs`: it clicks every control, types its own values, uses the keyboard, and opens each page at 390 px and with `--reduced`. It takes and opens its own screenshots (34 to 44 per run). The schema adds `interactions_tried` and `interaction_feedback` for each page. The prompt is `prompt.tmpl`.

Scores from the two protocols are not comparable. So the ab2 unfold pages were judged again with the new protocol as a control (`ARM=ab2`, folders `judge/<slug>-ab2`).

| Prompt | Judge | Unfold page | Unfold wins | Unfold /80 | Baseline /80 |
|---|---|---|---|---|---|
| hash table (docs page) | Argon | skill v4 (ab3) | 2 of 2 | 70.50 | 61.50 |
| hash table (docs page) | Argon | skill v3 (ab2), control | 0 of 2 | 67.00 | 70.00 |
| binary search (blog post) | Flash | skill v4 (ab3) | 2 of 2 | 76.00 | 60.50 |
| binary search (blog post) | Flash | skill v3 (ab2), control | 1 of 2 | 65.00 | 69.50 |
| binary search (blog post) | Argon | skill v4 (ab3) | not judged (quota) | | |
| binary search (blog post) | Argon | skill v3 (ab2), control | 0 of 2 | 59.50 | 70.50 |

The control repeats the ab2 result for the hash table (a loss). For binary search, the ab2 tie becomes a clear loss with the interactive Argon judge: the judge found the faults by using the page. The Flash control is split, but both Flash judges picked page A, so that split is position bias. The Flash judges picked the ab3 page in both orders.

Binary search per criterion (ab3, Flash, unfold vs baseline): accuracy 9.5/9.5, core idea 9.5/8.0, visual explanation 10.0/7.0, interactivity 9.0/7.5, request coverage 10.0/8.5, depth 10.0/6.0, visual design 9.0/7.5, mobile and accessibility 9.0/6.5.

Hash table per criterion (ab3, Argon, unfold vs baseline): accuracy 8.5/8.5, core idea 8.5/8.5, visual explanation 9.0/7.5, interactivity 8.0/6.5, request coverage 9.5/8.5, depth 10.0/7.0, visual design 9.0/7.5, mobile and accessibility 8.0/7.5. The baseline page is the same as in the control, but its score fell from 70.00 to 61.50. The judge scores each page relative to the other page.

## Judge feedback on the unfold pages

### Hash table, skill v4 (unfold won 2 of 2, 70.5 vs 61.5)
- Strength: one figure links the 32-bit hash, the `h ^ (h >>> 16)` spread, binary bucket indices, the linked chains with null marks, a Java put/resize code panel with the live line, and a load chart with a sawtooth that shows why doubling costs O(1) per put on average. The reader can scrub the run, step back, insert keys, and click a node to look it up.
- Weakness: "insert" on an early scene does not insert into the table on screen. It appends after all 7 preset keys and jumps to the last step (16 buckets). "reset" goes to the end of the preset run, not to an empty table.
- Weakness: clicking a node puts its key in the field without selecting the text. Typing then appends to it, and the 5-character limit cuts it ("bee" + "fox" gives "beefo"). The field also removes characters other than a to z without a message.
- Error (both judges): in the Collide scene, a key that is alone in its bucket makes the equation compare the key with itself: h(dog) mod 4 = h(dog) mod 4 = 1.
- Error (both judges): in the Grow scene the equation uses n for the old size (h mod 2n = 99645 mod 8), but the load bar uses n for the new size (4 / 8 = 0.50). One name is used for two things.
- At 390 px, the scene 1 equation is cut off on the right.
- Baseline weakness: forward only, with no step back or scrub. Under reduced motion all delays become 0 ms, so the "table full" state and the chain probe are not shown. One judge found clipped chain connectors (`overflow: hidden`) and a wrong "not all 2 keys" sentence.

### Binary search, skill v4, Flash judge (unfold won 2 of 2, 76 vs 60.5)
- Strength (both judges): in the Tree scene, the 16-cell array morphs into the binary decision tree, and each probe is one level. This shows why the worst case is ⌊log2 n⌋ + 1. The Scale scene has a log-scale step plot against linear scan, with an n slider up to 10^9.
- Strength: click a cell or type a target, "new numbers" for a random array, one step run with scrubber and keyboard, a missing target shows lo > hi and `return -1`, and the notes cover overflow and library variants. The array stays one row on a phone.
- Error (one judge): in the Tree scene, a new target (a click or a typed value) resets `treeN` to 0. The probe path does not light, and the readout shows "probes , found at". The other judge saw the same malformed readout for a moment when the scene opens.
- Baseline weakness: at 390 px the 32 cells wrap into a 4 by 8 grid, which breaks the picture of one shrinking range, and the "hi" tag sits under the wrong cell. No tree or other picture of why log2 n holds.

### Binary search, skill v3 control, Flash judge (1 of 2, 65 vs 69.5)
- Both judges picked page A. The weaknesses match the Argon control: two clicks per comparison (scenes and steps), cells that cannot be clicked, and the text overlap in the log2 n scene at 390 px.

### Hash table, skill v3 control (baseline won 2 of 2, 67 vs 70)
- The same faults as in ab2: the table is 6 fixed scenes, "try a key" only previews the hash, and the equation keeps the preset key's numbers. The interactive judge also found that text left in "try a key" stays in focus across scenes.

### Binary search, skill v3 control (baseline won 2 of 2, 59.5 vs 70.5)
- Strength: separate "compare mid" and "drop a half" steps, the "dropped" bracket, and the range ladder under the array.
- Weakness: the scene 3 caption is fixed text ("a[mid] is too small"), and it is wrong when the target is in the left half. Opening scene 4 shows the last step for 500 ms, then jumps back to step 0. The presets do nothing on scene 1. The reader cannot click a cell, and the log2 n scene has no n control. The scene 5 equation (k ≤ log2 n) disagrees with the 5-compare bar for n = 16. Scene 5 text overlaps at 390 px.
- Baseline strength: click any cell to search for it, the live code line, the candidate funnel, and a log-scale n slider up to 10^9.

## Lessons for the skill

1. A live input must act on the state the reader sees. An insert on scene 2 must insert into the table of scene 2, not into the end of the preset run. "reset" must go back to the start state.
2. An equation for a focus item must handle every case of that item. A collision equation for a key that has no collision must change its form, not fall back to the same key twice.
3. One name for one thing also applies to symbols. If n is the table size, the grow equation must not use n for the old size on the same screen (write n and 2n, or n_old and n_new, everywhere).
4. A caption that describes a branch (too small or too big) must follow the run. Fixed text is wrong for half the inputs.
5. The interactive judge finds faults that screenshots hide: stale captions, jumps when a scene opens, input fields that keep old text. A builder must drive the page with its own values before shooting, not only check the preset.
6. A live input must work in every scene where it is visible. In the binary search Tree scene, a new target stopped the sweep before it set the path, so the readout broke ("probes , found at").

## Builder friction points (2 unfold builders)

Both builders:
1. The brief said `page.html` is "the dark page", but `SKILL.md` rule 9 says a docs page or a blog post ships `theme: "auto"`. Both builders followed the skill. The docs do not say which theme `node build.mjs` writes by default.
2. `UNFOLD_CSS` defines `.u-tick-label` twice: 10 px for plots, then 9 px with `text-anchor: middle` for lanes. The later rule wins for plot ticks too. The labels are below the 10 px minimum, and the y labels are centred on the axis.
3. `plot()` has no tick-label format. A tick at 0.75 shows "0.8", and a log axis cannot be labelled. Both builders drew their own labels.
4. "Scenes are chapters of one step run" (rule 5) is wired by hand in every example: ranges, a `crossing` flag, the `unfold:scene` handler, `onTime`, `beat` per scene. Both builders copied about 25 lines from `examples/dijkstra/`. A kit helper is due.

Hash table builder:
5. `plot()` fixes the x range at build time, so a history that grows with the reader's inserts cannot rescale. The figure stops at 16 puts.
6. Under reduced motion, `beat` calls `fn(-1)` only in `go()`, not on page load. So scene 1 shows a different readout in the reduced shot.
7. No kit form for the bucket array with chains, though `references/vocabulary.md` lists it. Rows, null marks and chips with arrows were drawn by hand.
8. No runtime API for "after the reader's input, show step t, then step t + 1 after a delay". `beat` holds after `pause()`, so the builder used `setTimeout`.
9. The `shoot.mjs` overlap check covers text on text only. Labels that cross a polyline needed two manual rounds.
10. The step label shows "step 9 / 9" for a 10-step run, because steps count from 0.
11. No live helper for text in MathML, only `mn(…, { live })`. Hand-written `<mtext data-live>` works with `setLive`, but the docs mention only `mn` and spans.
12. The kit table in `SKILL.md` does not say that `chip()` sets a `transform` attribute.

Binary search builder:
13. `placeCss` writes `transform`, so a group that also needs a narrow-layout CSS transform must be nested. There is no helper for "visible in these scenes" for a drawing element. `data-scenes` exists only for controls.
14. A control with `data-scenes` runs `go(scene)` in the capture phase. The page's `unfold:scene` handler then wrote the old value back into the slider before the input handler read it, so the reader's value was lost. `references/scenes.md` section 5 does not cover this case.
15. Calling `UNFOLD.pause()` and then `UNFOLD.go(n)` to replay a sweep works, but the docs say this only indirectly.
16. `shoot.mjs` does not see an equation that is too wide at 390 px, because `.u-eq` scrolls by itself. There is no helper for a two-row "cases" equation.
17. The wide layout has one viewBox height for all scenes. Only `narrow` takes heights per scene.
18. `iso.plateHtml({ fig, title, hint, readout, caption, body })` is not documented in `SKILL.md`.
19. A 16-cell strip in the 400-wide narrow layout has numbers of about 10 px on a phone. There is no option to wrap a strip into 2 rows.

## Changes made after this run

The ab3 pages were not rebuilt. They show the skill as it was judged.

Lessons 1 to 6 are now in `SKILL.md`: lessons 1 and 6 under rule 2, lessons 2 to 4 under rule 3, and lesson 5 in Verify, step 9 (drive the page in every scene where an input is visible, with values for each branch, before you choose the shots).

Fixed in the kit and the scripts:
- Friction 1: `SKILL.md` step 9 and the repo `CLAUDE.md` now say that `node build.mjs` writes the page you ship, in the theme from the request (`auto` or `dark`).
- Friction 2: the lane rule is now `.u-lanes .u-tick-label`, and all tick labels are 10 px. `plot` y labels are right-aligned again. This changes the event-loop lanes from 9 to 10 px.
- Friction 3: `plot` tick labels show as many places as the tick has (0.75 stays 0.75). The new `tickLabel(v, axis)` option returns your own text, for a log axis.
- Friction 6: under reduced motion, a sweep on the scene that is open at load now shows its resting state, `fn(-1)`.
- Friction 16: `shoot.mjs` fails with `EQUATION CUT` when a visible equation is wider than its bar.

Documented, with no code change: 10 (step 0 is the start state, so "step 9 / 9" is correct), 11 (`<mtext data-live>`), 12 and 13 (`chip` and `placeCss` write `transform`), 14 (the scoped-control trap, `references/scenes.md` section 5), 15 (`pause()` then `go(UNFOLD.scene())` replays a sweep), 18 (`iso.plateHtml`).

Still open: 4 (a helper for "scenes are chapters of one step run": dijkstra, backprop, tcp-handshake, regex-nfa and both ab3 pages repeat about 25 lines, so it is due by the kit rule, but moving 4 examples to it is a larger change), 5 (`plot` ranges are fixed at build time), 7 (no kit form for a bucket array with chains), 8 (no API for "show step t, then t + 1 after a delay"), 9 (the overlap check covers text on text only), 13 (no "visible in these scenes" helper for drawing elements), 17 (one wide viewBox height for all scenes), 19 (no 2-row wrap for a long strip).

## Rerun

Run these from `benchmarks/2026-10-16-ab3/` after the Argon quota resets:

```bash
MODEL=gemini-4-argon-high sh judge.sh bsearch run1
```

```bash
node score.mjs judge/bsearch
```

```bash
node show.mjs judge/bsearch
```

`ARM=ab2` judges the ab2 page (the control), in `judge/<slug>-ab2`. `SUFFIX=flash` writes to `judge/<slug>-flash` (or `judge/<slug>-ab2-flash`), so a run with another judge model does not mix with the Argon runs. A run takes 10 to 15 minutes.
