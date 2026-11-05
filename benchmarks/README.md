# Benchmarks

Blind A/B tests of the unfold skill. Each test gives the same prompt to a builder with the unfold skill and to a builder without it. Then a judge compares the two pages without knowing which is which.

The judge is Gemini 3.8 Flash High in agy (`gemini-3.8-flash-high`). Each prompt is judged with A and B swapped (order1: unfold is B, order2: unfold is A). The score is out of 80 (8 criteria, 1 to 10 each).

## Results

| Date | Prompt | Runs | Unfold wins | Unfold /80 | Baseline /80 | Folder |
|---|---|---|---|---|---|---|
| 2026-10-15 | function call in all languages (first try) | 4 | 0 | 44.25 | 75.25 | `2026-10-15-function-call/judge1` |
| 2026-10-15 | function call, after fixes (intermediate) | 4 | 3 | 71.25 | 65.50 | `2026-10-15-function-call/judge2` |
| 2026-10-15 | function call, after fixes | 4 | 4 | 77.75 | 63.50 | `2026-10-15-function-call/judge3` |
| 2026-10-15 | gradient descent | 4 | 3 | 70.50 | 65.50 | `2026-10-15-gd-tcp-nfa/judge/gd` |
| 2026-10-15 | gradient descent, wrapped baseline | 4 | 2 | 67.25 | 69.75 | `2026-10-15-gd-tcp-nfa/judge/gdw` |
| 2026-10-15 | TCP handshake | 4 | 3 | 72.25 | 61.00 | `2026-10-15-gd-tcp-nfa/judge/tcp` |
| 2026-10-15 | TCP handshake, wrapped baseline | 4 | 4 | 76.50 | 60.50 | `2026-10-15-gd-tcp-nfa/judge/tcpw` |
| 2026-10-15 | regex NFA | 4 | 4 | 79.50 | 38.25 | `2026-10-15-gd-tcp-nfa/judge/nfa` |
| 2026-10-15 | gradient descent, skill v2 | 4 | 3 | 71.25 | 66.25 | `2026-10-15-gd-tcp-nfa/judge2/gd` |
| 2026-10-15 | TCP handshake, skill v2 | 4 | 4 | 77.75 | 58.75 | `2026-10-15-gd-tcp-nfa/judge2/tcp` |
| 2026-10-15 | regex NFA, skill v2 | 4 | 4 | 78.50 | 38.00 | `2026-10-15-gd-tcp-nfa/judge2/nfa` |
| 2026-10-16 | Dijkstra | 2 | 2 | 79.00 | 62.00 | `2026-10-16-ab/judge/dijkstra` |
| 2026-10-16 | Fourier square wave | 2 | 0 | 67.00 | 73.00 | `2026-10-16-ab/judge/fourier` |
| 2026-10-16 | DNS lookup | 2 | 0 | 59.50 | 77.00 | `2026-10-16-ab/judge/dns` |
| 2026-10-16 | binary search, skill v3, Argon judge | 2 | 1 | 66.00 | 66.00 | `2026-10-16-ab2/judge/bsearch` |
| 2026-10-16 | hash table, skill v3, Argon judge | 2 | 0 | 65.00 | 71.00 | `2026-10-16-ab2/judge/hashtable` |
| 2026-10-16 | backpropagation, skill v3, Argon judge | 2 | 2 | 72.50 | 64.00 | `2026-10-16-ab2/judge/backprop` |
| 2026-10-16 | hash table, skill v4, interactive Argon judge | 2 | 2 | 70.50 | 61.50 | `2026-10-16-ab3/judge/hashtable` |
| 2026-10-16 | hash table, skill v3 page (control), interactive Argon judge | 2 | 0 | 67.00 | 70.00 | `2026-10-16-ab3/judge/hashtable-ab2` |
| 2026-10-16 | binary search, skill v4, interactive Flash judge | 2 | 2 | 76.00 | 60.50 | `2026-10-16-ab3/judge/bsearch-flash` |
| 2026-10-16 | binary search, skill v3 page (control), interactive Flash judge | 2 | 1 | 65.00 | 69.50 | `2026-10-16-ab3/judge/bsearch-ab2-flash` |
| 2026-10-16 | binary search, skill v3 page (control), interactive Argon judge | 2 | 0 | 59.50 | 70.50 | `2026-10-16-ab3/judge/bsearch-ab2` |

The 2026-10-16 DNS accuracy score is wrong: the judge marked unfold's correct live DNS records as false. See `2026-10-16-ab/feedback.md`.

The `2026-10-16-ab2` rows use a different judge: Gemini 4 Argon High (`gemini-4-argon-high`). Do not compare their totals with the Flash rows. On binary search both judges picked page A (once unfold, once the baseline), with mirrored scores. That is position bias, so the result is a tie with no signal.

The `2026-10-16-ab3` rows use an interactive judge: Gemini gets no screenshots and drives both pages itself in headless Chrome. Do not compare their totals with the screenshot rows. The "control" rows judge the ab2 unfold page with the same interactive judge, so the skill v4 rows can be compared with them. The Argon quota ran out (reset on about 2026-10-23) before the binary search skill v4 page was judged. So both binary search pages were also judged with the interactive Flash judge (`gemini-3.8-flash-high`). Compare Flash rows only with Flash rows. In the Flash control, both judges picked page A, so its 1 win is position bias.

## Folders

- `2026-10-15-function-call/`: the baseline page (`baseline/function-call.html`) and 3 judge rounds. The unfold pages judged are in each round's `order1/B` and `order2/A`. The current unfold page is `examples/function-call/`.
- `2026-10-15-gd-tcp-nfa/`: builders were `claude -p` runs (`build/run.sh`, prompts in `build/prompts.tsv`). `build/` is the first skill version and the baseline. `build2/` is the skill rebuilt after fixes. `judge/` judges `build/`, and `judge2/` judges `build2/`.
- `2026-10-16-ab/`: builders were Claude subagents. Each prompt folder has `unfold/` (page, light page, `model.mjs`, `build.mjs`) and `baseline/` (page). `feedback.md` lists the judge feedback and the builder friction points.
- `2026-10-16-ab2/`: the skill after the fixes from `2026-10-16-ab` (skill v3), with 3 new prompts. Builders were 6 Claude subagents that ran at the same time. Each built its page in a scratch folder and made its own 5 screenshots with anatomy's `drive.mjs` (light theme). The judge is `gemini-4-argon-high`. `judge.sh` takes the model from `MODEL`. `feedback.md` lists the judge feedback and the builder friction points.
- `2026-10-16-ab3/`: the hash table and binary search prompts again, built with skill v4 (after the "What wins a blind test" rules). Builders were 2 Claude subagents. The baselines are the ab2 pages, unchanged. The judge drives the pages itself with anatomy's `drive.mjs` (`prompt.tmpl`), and the schema adds `interactions_tried` and `interaction_feedback`. `ARM=ab2 sh judge.sh <slug>` judges the ab2 unfold page as a control, in `judge/<slug>-ab2`. `SUFFIX=flash` puts a run with another judge model in its own folder. `feedback.md` lists the results, the judge feedback and the builder friction points.
- `assets/attention-head.html`: a copy of `examples/attention-head/attention-head.html` (the transformer attention head, dark page) as built on 2026-10-16, with live X inputs and the Play button. The example folder holds the current version.

## Rerun the 2026-10-16 judge

Run these from `benchmarks/2026-10-16-ab/`:

```bash
sh judge.sh dijkstra run2
```

```bash
node score.mjs judge/dijkstra
```

```bash
node show.mjs judge/dijkstra
```

`judge.sh` copies the pages and screenshots into `judge/<slug>/order1` and `order2`, then runs 2 agy judges at the same time. A run takes about 5 minutes. The second argument is a tag, so a new run does not overwrite `run1`.

To test a changed skill, rebuild a page first. Then copy the new page to `<slug>/unfold/page.html` and its 5 screenshots to `<slug>/unfold/shots/` (`shot-1.png` to `shot-4.png` at 1440 px, `shot-phone.png` at 390 px). Then run the judge.

To rebuild an unfold page, run this from `<slug>/unfold/`:

```bash
node model.mjs && node build.mjs && node build.mjs --light
```

`build.mjs` writes `page.html`, and with `--light` it writes `page-light.html`.

## Caveats

- `judge.sh` runs agy with `--sandbox --dangerously-skip-permissions`. Without that flag, headless agy cannot open the files. Run it only in these folders.
- Git ignores `*.png` and the `order1/` and `order2/` folders. The screenshots and the judge input copies exist only on this machine.
- The judge scores each page relative to the other page. The same baseline got 75.25 in one round and 63.50 in another.
- The judge checks facts from memory. It cannot check live data such as DNS records.
- 2026-10-16 used 2 runs per prompt. That is a small sample.
- The 2026-10-16 `dns/unfold/model.mjs --dig` asks live DNS servers. The stored records were captured on 2026-10-16.
