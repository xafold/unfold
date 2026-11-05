# Feedback from the 2026-10-16 run

Raw judge output: `judge/<slug>/order*-run1.json`. Print it with `node show.mjs judge/<slug>`.

## Judge feedback on the unfold pages

### Dijkstra (unfold won 2 of 2, 79 vs 62)
- Strength: 6 scenes (Graph, Relax, Closest, Improve, Repeat, Tree), live edge weights and source, relax arrows with "was 4", and a negative-weight counterexample in the notes.
- Weakness: unused kit helper functions are in the page script. The control bar and the colour key are dense for a first view.
- Baseline strength: pseudocode lines highlighted in step with the table, and lazy deletion with stale queue entries struck through.

### Fourier square wave (baseline won 2 of 2, 67 vs 73)
- Strength: scene 5 shows the area of f(x) sin(kx). The filled and hollow areas show why even terms are 0. The notes compare square, sawtooth and triangle waves.
- Weakness: no rotating circles (epicycles). The dark "dashboard" look does not suit a blog post. Inactive controls wrap badly on a phone.
- Baseline strength: rotating circles that draw the sum, a light blog layout, a spectrum panel and a Gibbs zoom panel.

### DNS lookup (baseline won 2 of 2, 59.5 vs 77)
- Strength: the notes and the cross-domain cache case (www.google.com reuses the cached .com records).
- Weakness: the sequence diagram is cramped and has low contrast. It gets worse at 390 px. The page has dead template code. The caption tells the reader to run `node model.mjs --dig`, but the reader does not have that file.
- Judge error: both judges called the example.com records "fabricated" (NS hera/elliott.ns.cloudflare.com, A 104.20.23.154). `dig` on 2026-10-16 shows that these records are correct. The baseline's a.iana-servers.net and 93.184.215.14 are out of date. So unfold's accuracy score (6.5 vs 10) is wrong. Without accuracy, the baseline still leads, 67 vs 53.
- Baseline strength: a server tree with a moving packet, "SKIPPED: CACHED" badges, TTLs that count down, and time bars that compare lookup 1 with lookup 2.

## Builder friction points (from the 3 unfold builder agents)

Repeated by 2 or more builders:
1. `scripts/shoot.mjs` waits a fixed 4000 ms per scene. A scene whose `UNFOLD.beat` sweep takes longer is captured part way through.
2. The `time` option of `stageHtml` has a fixed step count. A run whose length changes with a live input cannot use the step control.
3. Ordering in the runtime: `UNFOLD.go()` sets `held = false`, so the sweep starts again after `onTime`. The `controlScenes` move to the owner scene runs after the control's own handler, so a preset applied on scene entry overwrites what the reader just set.
4. MathML: a `(` next to `munder`, `mtable` or `mfrac` stretches too tall. The helpers do not add `stretchy="false"`, and `style.md` does not warn about it.
5. A long readout covers the hint in the other corner. `plateHtml` does not wrap it, and the docs give no length budget.
6. Narrow layout: no rule for when to use `narrow` and when to draw two layouts. Font size in the narrow box must be raised per class.
7. No kit form for the figure: node-link graph (Dijkstra), message sequence (DNS), curve and area path in the page (Fourier). Each builder drew its form by hand.

Reported by 1 builder:
8. No docs for building outside `examples/`. The import path to the kit must be built from `homedir()`.
9. `shoot.mjs` captures the plate (about 908 px), not the 1440 px viewport. It cannot capture a chosen step.
10. A rule is missing: the resting frame of a scene must still show the scene's idea (Dijkstra's "was 4" was gone at rest).
11. `arrow()` has no option to run beside a link, so it covers the weight labels.
12. `.u-controls` has no CSS for `<select>`.
13. `notesHtml` placement is shown only in `function-call`.
14. `plot()` has no tick formatter and no clip. The page has no `plot` scale.
15. `placeCss` and the narrow layout both set `transform` on the same element. A wrapper `<g>` is needed.
16. "Compute the next step from rounded values" breaks for a long sum (25 rounded terms drift by 0.02).
17. `mark()` lights `.u-bar`, but the kit has no CSS for `.u-bar[data-on]`.
18. Chip and arrow labels have no halo option.
19. `modelScript` needs the helpers to be exported from `model.mjs`. The docs do not say so.
20. `arrow` exists only at build time, so arrows that change with input must all be drawn ahead and toggled.
