# Feedback from the 2026-10-16 ab2 run

Judge: Gemini 4 Argon High in agy (`gemini-4-argon-high`), 2 runs per prompt with A and B swapped. Raw output: `judge/<slug>/order*-run1.json`. Print it with `node show.mjs judge/<slug>`.

The unfold pages were built with the skill after the fixes from `2026-10-16-ab`. The fixes made after this run (listed at the end) were not in the pages.

| Prompt | Unfold wins | Unfold /80 | Baseline /80 |
|---|---|---|---|
| binary search (blog post) | 1 of 2 | 66.00 | 66.00 |
| hash table (docs page) | 0 of 2 | 65.00 | 71.00 |
| backpropagation (ML course) | 2 of 2 | 72.50 | 64.00 |

## Judge feedback on the unfold pages

### Binary search (tie, 66 vs 66)
- Position bias: both judges picked page A, and the scores mirror each other (60/72 and 72/60).
- Strength: separate "compare mid" and "drop a half" steps, a "dropped" bracket, low and high crossing on a miss, a range ladder lined up with the array, and edge cases in the notes (overflow, repeated values, half-open range).
- Weakness: scenes (5) and steps (9) are two kinds of navigation, and one judge called that confusing. The step's explanation sits in the 10.5 px readout. On a phone the scene labels hide, and the TARGET badge overlaps the ladder. The reader cannot click a cell to search for it.
- Claimed error: the scene 5 equation shows k ≤ log2 n, and the +1 (worst case ⌊log2 n⌋ + 1) is only in the readout and the notes.
- Baseline strength: click any cell to search for it, the code line lights in step, and a log-scale n slider up to 10^9.

### Hash table (baseline won 2 of 2, 65 vs 71)
- Strength: the textbook bucket array with linked-list nodes, the hash bits linked to the bucket index, a chain that splits during a resize, and notes on linear probing and real language implementations.
- Weakness: the figure is 6 fixed scenes, not a live table. "Try a key" changes only the hash preview. It does not insert into the table, find in it, or grow it.
- Error found by both judges: the equation bar keeps the numbers of the scene's preset key ("apple", "kiwi") after the reader picks or types another key. The drawing then disagrees with the math.
- Baseline strength: a working simulator. The reader inserts and finds any key, watches the table grow 4, 8, 16, 32, and sees a per-key table of the split bit.

### Backpropagation (unfold won 2 of 2, 72.5 vs 64)
- Strength: z and h are separate nodes, the loss and sigmoid curves show live tangent slopes, gradients add where paths meet, the weight gradients form outer-product grids, and the graph has a vertical layout on a phone.
- Weakness: the update scene shows one step from the preset weights. The reader cannot repeat it and watch the loss go down. The "slope 0.235" label touches the curve.
- Baseline strength: a "take a gradient step" button with a loss sparkline, click-to-trace chain-rule paths, and a live finite-difference table.

## Lessons for the skill

1. A live input must run the operation the request names on the whole figure: insert into the structure, not only preview a hash. Added to SKILL.md, step 10.
2. Numbers in the equation bar must follow the focus item, or the equation uses symbols only. Added to the SKILL.md craft rules.
3. Show the step's event in the drawing or the scene sentence, not only in the readout. Added to the craft rules.
4. Scenes and steps are one run: the scenes are chapters of the steps. Added to the craft rules.
5. Let the reader repeat an operation that the topic repeats (gradient steps, inserts). Not yet a rule. The backprop page still won without it.

Later on 2026-10-16, lessons 1 to 5 were merged into general rules for any topic, in the new `SKILL.md` section "What wins a blind test": the reader runs the operation (and repeats it), one state that every number follows, the event at the shape, one way through time, code beside the run, and the evidence and the scale. `shoot.mjs` now fails on text that overlaps other text (it finds the phone overlap in the binary search page, scene 5).

## Builder friction points (3 unfold builders)

Fixed in this session, after the pages were built:
1. `shoot.mjs` shot a `theme: "auto"` page as light in the "dark" run. It now passes `--theme dark`. (3 builders)
2. Controls without `controlScenes` had no `.u-ctl` wrapper, so each picker button stretched to full width under 520 px. A hand-made `.u-ctl` crashed the runtime. The kit now always wraps controls, and only `.u-ctl[data-scenes]` moves the scene. (3 builders)
3. `words.mjs` read `<pre>` as a paragraph, and did not split a sentence that starts with a lowercase name ("h is 32-bit"). Both fixed.
4. The kit had no CSS for `input[type=text]`. Added.
5. `placeCss` crashed when every state was `null`. It now hides the element.

Fixed later on 2026-10-16 (kit and docs):
7. `UNFOLD.beat` takes a `count` function, read each frame.
8. One control can carry its own `data-scenes`. The runtime dims it and moves to its scene.
9. `placeCss(selector, states, narrowStates)`.
10. `tsub(s)` writes a `<tspan>` subscript in SVG text.
11. `cellGrid({ keep })` and `bars({ keep })` keep their numbers under 520 px.
12. `plotAt(plotEl, x, y)` in the page, and `setBars(bars, values, max)`.
13. `stageHtml({ narrow: [w, [h0, h1, …]] })`: one narrow height per scene.
14. `arrow({ className })`. The `drive.mjs` "Comma" key name and item 15 are anatomy's. They are documented in `references/scenes.md`, section 10, and not changed.

Still open:
6. No kit form for an array strip with pointers, a node-link graph or a bucket array with chains. `examples/dijkstra/` and `examples/backprop/` now draw two node-link graphs by hand, so by the kit rule a shared helper is due. It is not done yet: one is a weighted graph and one is a layered graph, and the shared part must be found first.
