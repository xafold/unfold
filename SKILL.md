---
name: unfold
description: Build interactive explainer figures for abstract software and math concepts, in a combined 3Blue1Brown and Welch Labs style. The figure draws the real structure of the idea (vectors, matrices, trees, graphs, timelines, spaces, memory) with real computed numbers, one colour per concept, math next to the shapes, and scenes that morph from the big picture down to single values. Use it when someone wants a figure, diagram, animation or interactive explainer for how an algorithm, data structure, protocol, model or math idea works - for example attention, embeddings, gradient descent, B-trees, hashing, git internals, the event loop, consensus, compilers, encodings - even if they never say "3Blue1Brown". It ships its own card, iso camera, motion and checks. For a concept that is a physical machine, or that is about things flowing through something with capacity (a queue, a pool, a rate limiter, a cache), use the anatomy skill instead if it is installed.
argument-hint: "[--voice | --no-voice] <topic>"
license: MIT
compatibility: Written for Claude Code. Needs Node.js 20.10+ and Chrome or Chromium for the checks. No other skill is needed.
---

# Unfold

## Options

Arguments: `$ARGUMENTS`

| Option | What the figure gets |
|---|---|
| `--voice` (the default) | A narration script (`script.md`) that the user approves, then a recorded voice per scene, with the figure in sync (workflow step 11). |
| `--no-voice` | No script, no recording, no Voice button. Each scene gets a short `say` text in the card instead: 2 sentences and 30 words at most. |

Read the option from the arguments, and remove it from the topic: `/unfold --no-voice B-tree insert` is the topic "B-tree insert" with no voice. Plain words count too: "no audio", "without voice", "text only" mean `--no-voice`. With no option, or when the skill starts without a slash command, use `--voice`. Say which mode you use when you tell the user the size (workflow step 1).

### Choose the voice provider (with `--voice`)

Do this before you write the script.

1. Check which keys are set. Check the names only, and never print a value:

   ```bash
   for k in GEMINI_API_KEY GOOGLE_API_KEY OPENAI_API_KEY ELEVENLABS_API_KEY XI_API_KEY; do [ -n "${!k}" ] && echo "$k is set"; done
   ```

2. Ask the user which provider to use. Show every provider, and mark the ones whose key is set. Add "browser voice only" (free, no key, robotic on Linux).
3. Ask which model and which voice, with the defaults below as the first choice.
4. If the chosen provider's key is not set, tell the user to set it in their shell profile and start Claude Code again. Never ask the user to paste a key into the chat, and never write a key into a file.
5. Pin the choice in `build.mjs`: `u.narrate(scenes, { dir, provider, model, voice })`. The clip cache name holds the model and the voice, so a rebuild with other defaults would not find the clips.

| Provider | Key | Default model | Other models | Default voice | Other voices |
|---|---|---|---|---|---|
| `gemini` | `GEMINI_API_KEY` | `gemini-3.8-flash-tts` | `gemini-3.1-flash-tts-preview`, `gemini-2.5-pro-preview-tts` | `Kore` | `Puck`, `Charon`, `Aoede`, `Fenrir`, `Leda` |
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini-tts` | `tts-1`, `tts-1-hd` | `coral` | `alloy`, `nova`, `sage`, `onyx`, `shimmer` |
| `elevenlabs` | `ELEVENLABS_API_KEY` | `eleven_multilingual_v2` | `eleven_flash_v2_5` | `JBFqnCBsd6RMkjVDRZzb` (George) | any voice ID from the user's ElevenLabs voice library |

The Gemini models were listed by the API on 2026-11-04. The OpenAI and ElevenLabs names are from their docs: check them there if a request fails with "model not found". The Gemini free tier allows 10 requests a day per model. A figure needs one request per scene.

This skill makes explainer figures for ideas that have no physical body. The reader understands the idea because they see its real structure change, one step at a time, with true numbers they can check by hand.

It was inspired by the anatomy skill, and its card, page, iso camera, solids, theme tokens and Chrome driver are adapted from anatomy (`THIRD_PARTY_NOTICES.md`). It does not use anatomy's main rule ("invent a physical machine"), because a machine metaphor hides an abstract idea behind a second layer that the reader must decode.

Eight complete examples ship with the skill. Open the closest one before you start. The last four won their blind tests and show the rules in "What wins a blind test" at work.

- `examples/attention-head/` is one causal self-attention head on "the cat sat on the mat", in 6 scenes. Scene 1 shows the whole head as iso tensor blocks with real values on their top faces. Scenes 2 to 6 zoom into flat matrices: embed, project (X times three weight matrices, in the "falling" matrix-multiply layout), score (K transposes cell by cell), softmax (bars for one row), mix (weighted value rows add up to one output row). Up and down arrows pick the query token, and every number updates. Four number fields edit the picked token's row of X, and the page recomputes the whole head with the model's own `head(X)`: it is the reference for a **live input**. `node model.mjs` checks the math; `node build.mjs` writes `attention-head.html`, and `--light` writes the light page.
- `examples/btree-insert/` is a B-tree with at most 2 keys per node, built by really inserting 10 to 70, in 7 scenes (sorted node, overflow, split, search, promote, cascade, taller). Every key is one object that moves between nodes from scene to scene; a new key drops in from above, a promoted key rises, and the links (`morphPath`) follow their nodes. Up and down arrows pick a key, and the search path for it lights level by level with the comparisons in the readout. It is the reference for structures and for a process on a structure.
- `examples/event-loop/` is the JavaScript event loop on four lines that print A D C B, in 5 chapters (overview, run script, queue callbacks, drain microtasks, next task). A small simulator (`model.mjs`) produces the trace; callback chips move from the timer to the task queue to the call stack, the code cursor takes the hue of the running task, and a swimlane timeline (`lanes`, `span`) fills in step by step. Up and down arrows, or the step control under the drawing, step through time, and the chapter follows. It has no math: each chapter shows its rule in the equation bar with `rule`.
- `examples/function-call/` is one program (`sum_sq(3, 4)` calls `square` twice) in six languages, in 7 scenes. It is the reference for a **breadth request** ("in all the languages"). Scenes 1 to 5 show what is shared: frames push and pop, chips carry arguments in and return values out, and a step control moves through the run by hand. Scenes 6 and 7 show what differs: the real bytecode or machine code of the call per language, and the measured stack depth per language. A reference section under the card holds a 13-language table. Each program is shown whole, and `node model.mjs` runs each one, finds every listing line in the real tool's output, and re-measures each depth. It also has a narrow layout for phones.
- `examples/dijkstra/` is shortest paths on a 6-node weighted graph, in 6 chapters of one 18-step run. It is the reference for a **process on a structure** that the reader drives: click a node to make it the source, click an edge and type its weight, and the model's own `dijkstra()` runs again. The queue is drawn with lazy deletion (stale entries struck through), the pseudocode line that runs is lit (`codeLines`), and "was 4" stays beside a lowered distance. `model.mjs` checks the result against Floyd-Warshall, and against networkx when it is installed.
- `examples/backprop/` is one training example through a 2-2-1 network, in 7 scenes: the forward pass, the loss, gradients flowing back on the same edges, and the weight update. It is the reference for **repeating an operation**: "take a step" applies one more gradient step to the current weights, a sparkline keeps the loss history, and every number follows the current weights. A small finite-difference table shows the gradients are right.
- `examples/tcp-handshake/` is a TCP open, data and close as a message sequence chart, in 7 chapters of 11 steps. The reader types both ISNs and the payload, and every seq and ack number, sentence and equation follows (with the wrap at 2³²). A 12-line receive rule lights the line that runs. The model is checked against a real Linux loopback capture.
- `examples/regex-nfa/` is `a(b|c)*d` as a Thompson NFA, in 6 chapters. The reader types their own input string, and the state set steps through it on the graph; the run length follows the input. The loop's 5 lines are lit per step, and the last step shows that the browser's `RegExp` agrees.

## The one idea that matters

**The structure is the explanation.** Draw what the concept really is: the vectors, the matrix, the tree, the timeline, the points in a space. Then show how it changes. Do not invent a machine for it, and do not draw boxes with words in them.

Two ways this fails:

- **A metaphor instead of the thing.** Drawers for vectors and springs for weights look rich but teach the metaphor, not the idea.
- **A wall of numbers.** Every matrix at once, with no order and no focus. The reader sees data but no story.

The fix for both is the same: the real structure, one small concrete example, and scenes that show one change at a time.

A third way it fails: **the narrowed request.** When the request names a breadth axis ("in all the languages", "all the databases", "every sorting algorithm"), a small example that shows only what is shared answers half the question. Show what differs along that axis too, with real data, in a scene or in the reference section under the card.

## What wins a blind test

Each rule below decided at least one blind A/B test against a careful page made without the skill (`benchmarks/README.md` has the results). Each rule is written for any topic, not only for the topic where it was found. Apply all of them to every Explainer.

1. **The canonical picture.** If one picture is in every textbook and video for the topic, show it with real values. Fourier without rotating circles lost, and DNS without the server tree lost. `references/vocabulary.md` lists known pictures.
2. **The reader runs the operation.** Name the verb of the topic: search, insert, look up, relax, step, send, match. The reader does that verb on an input they choose, on the main drawing, as often as they want.
   - The operation changes the whole figure, not a preview beside it. A hash table page whose input only showed the hash lost to a working simulator.
   - Prefer action on the drawing itself: click a cell to search for it, click a node to make it the source, drag the start point. A binary search page without click-to-search only tied.
   - When the topic repeats its operation (gradient steps, inserts, rounds, iterations), one button applies one more step to the current state. Keep the history on screen: a trail, a sparkline, a table that grows. Add a reset.
   - The operation acts on the state the reader sees. An insert in scene 2 goes into the table of scene 2, not after the end of the preset run. "reset" goes back to step 0 of the preset run (the start state), not to its end. The 2026-10-16 ab3 hash table page lost points for both.
   - An input works in every scene where it is visible. If a scene has a sweep, a new input redraws that scene's sweep for the new value (`UNFOLD.pause()`, then `UNFOLD.go(UNFOLD.scene())`). In the ab3 binary search page, a new target in the tree scene stopped the sweep before it lit the path, and the readout broke.
3. **One state, and every number follows it.** The equation bar, the labels, the readout and the tables all come from one state, redrawn by one function after each input. A number that keeps the preset's value after the reader changes the input or the focus is an error. Both judges found it in the hash table page. Print live numbers with `mn(…, { live })` and `setLive`, or write the equation with symbols only.
   - Every case of the focus item has its own form. A collision equation for a key that has no collision must change its form (or say "no collision"), not compare the key with itself.
   - A sentence that names a branch ("a[mid] is too small") follows the run. Fixed text is wrong for half the inputs.
   - One name for one thing holds for symbols too. If n is the table size, do not use n for the old size and the new size on the same screen. Write n and 2n, or n_old and n_new, in the equation, the labels and the readout.
4. **The event is at the shape.** Show what this step changed where it happened: a label, a colour, a struck-through old value. The readout corner is 10.5 px type for the expert's arithmetic. Never put the event only there.
5. **One way through time.** Scenes are chapters of one run. The scene buttons, the step control and the keys move the same position. Name each chapter by the steps it holds, and keep the step number visible in every scene that has steps.
6. **Code beside the run.** For an algorithm or a protocol, show its pseudocode or code (12 lines or fewer) with `codeLines`, and light the line that runs in the current step. Judges named it a strength of the baseline in two tests.
7. **The evidence and the scale.** Where an independent check is cheap, show it: finite differences beside the backprop gradients, the real tool's output beside the model's, a brute-force answer beside the algorithm. Where the point of the topic is a growth rate (log n compares, O(1) on average), let the reader see the real size too: a slider or a table up to 10⁹, computed by the model.
8. **Fit the reader's place.** Take the theme from the request (a blog post gets `auto`, step 9 below). At 390 px no text may sit on other text, and the drawing's text must be readable. `shoot.mjs` reports text that overlaps.

## The style in one table

Read `references/style.md` for the full rules.

| From 3Blue1Brown | From Welch Labs |
|---|---|
| Colour is identity: Q is blue in every scene, in the math and in the key | Real numbers are visible in the cells |
| Objects morph between scenes; nothing cuts | Tensors as solid iso blocks, values on the faces |
| Math sits next to the shapes it describes | Zoom levels: the whole system, then one part, then single numbers |
| A tiny concrete example first | A worked example with true values all the way through |

## Workflow

Work in this order. Write the truth model and the storyboard before any geometry. Most of the quality is decided there.

1. **Size it.** Tell the user (or the agent that started you) the size before other work.
   - **Figure**: one scene, one form. Usually under 20 minutes of agent work.
   - **Explainer**: 3 to 7 scenes, 2 or 3 forms. Usually 15 to 60 minutes of agent work, plus the user's review rounds. Build it unless the user asked for something quick.
   - **Series**: several explainers (a whole model, a whole protocol). Do not start it. Propose one Explainer that holds the core idea, and list what the series would add.
   - Have a page that opens in the browser within the first hour. Run `date` at the start and at each step.
2. **Name the verb and the state.** Write down the operation the request names (rule 2 above), the input the reader will choose for it, and the state that the operation changes. For a structure: the keys in it. For an optimizer: the current weights and the loss history. For a protocol: the sequence numbers and each side's state. This is the plan for the live part. It also names the truth model's main function: `step(state, input)` returns the next state.
3. **Classify the concept.** Find its shape in `references/vocabulary.md` (transform of numbers, points in a space, structure, sequence in time, states, landscape, memory layout, process on a structure). Pick one form per shape, at most three in one figure. If the concept is a physical machine, or things flowing through something with capacity, stop and use the anatomy skill.
   - **Canonical picture.** Ask: is there one picture that every textbook and video uses for this topic? Fourier series has rotating circles (epicycles) that draw the sum. DNS has the server tree (root, TLD, authoritative server) with the query path on it. If there is one, show it in at least one scene, with real values (rule 1 above).
4. **Truth model.** Write a small pure module (`model.mjs`) that computes every value: the real softmax, the real tree split, the real hash. The figure shows results from the model; it never draws a made-up result. Add asserts that run with `node model.mjs`. Round the values you print, then compute the next step from the rounded values, so the numbers on screen add up by hand. Exception: a process that repeats until it converges (iterations of an optimizer, a numeric method). Rounding each step can stop it early or reach a false limit, for example a gradient of exactly 0. Compute it in full precision, print rounded values, say so in the caption, and assert in `model.mjs` that the printed path does not stop before the exact path does. Never write "reaches" or "lands on" for a limit that only rounding reaches.
5. **Pick a tiny concrete example.** Small enough to print every number: 6 tokens and 4 dimensions, 7 keys, 5 commits, 8 bytes. Choose inputs that make the pattern easy to see, and say in the caption which inputs were chosen by hand.
   - **Breadth axis.** If the request names a set to cover (all languages, all databases, all protocols), plan two parts. First, what is shared, on the tiny example. Second, what differs along the axis: at least one scene with real data from each member (the bytecode each compiler makes, the depth each stack allows, the latency each database shows), and a table under the card for members you cannot run. Mark which rows you checked with a real tool.
6. **Colour key.** Give one hue to each concept (at most 7). Keep it in every scene, in the MathML and in the key under the stepper. Neutral "ink" is for inputs and plain structure.
7. **Storyboard.** Write one line per scene: what is on screen, what changes, and what that change means. Each scene adds one idea. Plan which objects persist from scene to scene, because those are the ones that morph. Mark the scene where the reader runs the verb on their own input, and the steps each chapter holds.
8. **Build.** One `build.mjs` per figure: geometry with the kit, positions per scene with `placeCss`, the page with `stageHtml`, `plateHtml` and `pageHtml`. See `references/scenes.md`.
9. **Deliver it.** By default write a standalone page. `node build.mjs` writes the page you ship, in the theme from the request (`auto` or `dark`). `node build.mjs --light` writes the light page for the checks. `shoot.mjs` shows an `auto` page dark in its dark run, so one build covers both checks. Do not ship a fixed dark page only because a brief calls `node build.mjs` "the dark page".
   - **Pick the theme from the request.** For a blog post, an article, docs or a wiki, ship `pageHtml({ theme: "auto" })`: it follows the reader's system setting, so most readers get a light page. Ship dark only when the request asks for a dark or video look, or the host site is dark. In the 2026-10-16 test the judge marked a dark-only page down for a blog post. Still build the dark and the `--light` page for the checks. When the user wants to view or share it in claude.ai (a team wiki, a link, "show me"), write `node build.mjs --artifact <file>` (`artifactHtml`: no page skeleton, follows the viewer's theme) and publish that file with the Artifact tool. If the request names a wiki or a doc site, say which of the two you made.
10. **Frame it.** The card: `Fig n` top left, a short title top right, the key hint bottom left, the live readout bottom right. Keep the readout to about 70 characters. A longer readout wraps to a second line inside 62% of the card width, so it never covers the hint. Inside the card: the equation bar, the drawing, the stepper and the colour key. The scene's explanation is spoken (step 11, "Voice"), not written in the card. A true caption goes under the card. For an Explainer, add a short reference section under the caption with `notesHtml`: what differs, what the figure leaves out, and the terms it uses. The figure carries the idea; the notes carry the depth. The notes are diagrams and tables first: each section holds a table (`table`) or a small SVG (in `html`), plus at most 3 sentences of prose. Terms go in a table (term, meaning in 12 words or fewer).
11. **Make it live.** Scenes change with the stepper and the arrow keys. The tour starts paused: the reader presses Play, and it runs once to the last scene. One more control picks the focus item (a token, a node, a language), and every view updates from the model. The readout shows the real arithmetic for the focus item. If the figure runs through time (a trace, iterations, a protocol), the reader must be able to step through it by hand: `stageHtml({ time })` adds back and next buttons, a scrubber and the "," and "." keys. The tour and `UNFOLD.beat` are not enough.
    - **The verb on the reader's input.** Give the input from step 2 a field, a slider, or a click target in the drawing. On input, run the model's `step` (shipped with `modelScript`) on the current state, then call one `render(state)` that redraws every view: drawing, equation bar, readout, tables. Do not offer only presets. Keep the presets as named buttons that set the state back to a chosen value. See `references/scenes.md`, sections 7 and 8.
    - **Repeat and reset.** If the operation repeats, add "one more step" and "reset" buttons and a visible history (rule 2 above). If the run length changes with the input, pass the new length to `UNFOLD.timeAt(t, steps)` and give each counted sweep a `count` function.
    - **Scope each control.** A control that only some scenes use must not show its value in the other scenes as if it applied there. Pass `controlScenes` to `stageHtml` for the whole group, or put `data-scenes="2 3"` on one control. It is dimmed in the other scenes, and an input there moves to the first scene that uses it.
    - **With `--no-voice`, skip the next three items.** Give each scene a `say` (2 sentences, 30 words at most), do not call `narrate`, and do not pass `audio`. The page then has no Voice button.
    - **Script first.** Write the narration in `script.md` beside `build.mjs`: one `## n. Scene name` section per scene, in the 3Blue1Brown style of `references/style.md`, section 10. Show the script to the user and record only after they agree. Write one sentence per line. `u.readScript(join(HERE, "script.md"))` returns `{ voice, beats }` per scene; spread it into the scene (`{ ...scene, ...script[i] }`).
    - **Sync the figure with the voice.** Start a line with a cue, `[satcat] With the starting numbers, …`. While the voice says that line, the stage has `data-speaking` and `data-cue="satcat"`. Write CSS that lights what the line talks about and dims the rest, scoped to the scene: `.u-stage[data-speaking][data-scene="3"][data-cue="satcat"] #gS …`. Every sentence that names a part of the picture gets a cue. `examples/attention-head/build.mjs` (`CUES`) is the reference.
    - **Voice.** Each scene's explanation is its `voice` (3 to 5 short spoken sentences), not text in the card. `u.narrate(scenes, { dir: join(HERE, "voice"), provider, model, voice })` records it with the provider the user chose (see "Choose the voice provider") and caches the MP3 clips in `voice/`. Pass the result as `stageHtml({ audio })`. Without a key or a cached clip, the page reads the text with the browser's own voice, which can sound robotic on Linux. Leave `say` out, or keep it to the event in a few words. With voice off, the page shows the narration as text.
12. **Verify like a critic.** See "Verify" below. Read every PNG you make.

## Setup

The skill folder is `${CLAUDE_SKILL_DIR}`. It holds everything the skill needs: the kit, the scripts and the examples. Nothing else must be installed.

Build a new figure in its own folder, not in `examples/`. Import the kit by its full path, so the build works from any folder:

```js
import { pathToFileURL } from "node:url";
import * as m from "./model.mjs";
const u = await import(pathToFileURL("${CLAUDE_SKILL_DIR}/kit/concept-kit.mjs").href);
const { iso } = u;
```

Run the scripts by their install path too: `node ${CLAUDE_SKILL_DIR}/scripts/shoot.mjs page.html --scenes N --out <dir>`. In this file, `../../scripts/` means the same folder, as seen from an example.

| File | Use it for |
|---|---|
| `kit/concept-kit.mjs` | New forms and scenes. Re-exports `kit/iso.mjs` as `iso`. |
| `kit/iso.mjs` | Through `iso`: `fitProjection`, `slabOf`, `solidSvg`, `topMatrix`, `figureSvg`, the theme tokens, and the card `iso.plateHtml({ fig, title, hint, readout, caption, body })` (`body` is the `stageHtml` output). `references/iso.md` has the API. |
| `scripts/shoot.mjs` | Every scene's finished state in dark, light, 390 px and reduced motion, with readouts, console, sideways-scroll, text-overlap and cut-equation checks. |
| `scripts/words.mjs` | The reader text of a built page against its budget: narration and on-screen words per scene, long sentences, semicolons, notes prose without a table or SVG. `--text` prints the plain text for a linter. |
| `scripts/record.mjs` | Records a built page's narrated tour as an MP4 with the voice and a fast silent GIF: `node ${CLAUDE_SKILL_DIR}/scripts/record.mjs page.html --out demo`. Needs ffmpeg. Use it when the user wants a video or a README preview. |
| `scripts/drive.mjs` | Headless Chrome: scripted clicks and keys, screenshots of an element or a region, and contact sheets to catch pops in a scene change. `node scripts/drive.mjs` with no arguments prints its actions. |

`concept-kit.mjs` exports:

| Export | What it does |
|---|---|
| `cellGrid({ id, values, hue, cell, max, places, name, dims, transposeIn, keep })` | A matrix of real values. Colour strength = size, filled = positive, hollow = negative, dashed = masked. Cells move to transposed places in the scenes listed in `transposeIn`. `keep: true` keeps the numbers under 520 px. |
| `chip(text, x, y, { w, h, rx, hue, i, id })` | A token, word, key or state. `rx` sets the corners (a pill by default). `data-i` makes it pickable. It places itself with a `transform` attribute, so a chip that moves with `placeCss` or CSS sits inside an outer `<g>` that moves. |
| `arrow(from, to, { hue, bend, head, width, className })` | An arrow that ends on a real target. The head is a path, not a marker. |
| `codeLines(lines, { id, x, y, w, lineH, hue })` | Code or pseudocode as numbered lines (leading spaces kept). The page lights the line that runs with `mark(codeEl, i, ".u-line")`. |
| `bars({ id, values, labels, x, y, w, h, hue, max, places, keep })` | A small bar chart for a distribution. `keep: true` keeps the values under 520 px. |
| `tensorBlock(P, { at, values, hue, cell, height })` | A matrix as an iso slab with its values on the top face. |
| `floorText(P, at, z, text, { size, cls, anchor })` | Text lying on an iso plane. |
| `revealCss(scene, selector, { kind, delay, stepR, stepC, dur })` | An entrance that plays each time a scene opens: `cells` (a grid fills row by row), `pop`, `fade`, `rise`, `grow` (bars), `draw` (arrows). |
| `pulseSvg(from, to, { hue, begin, travel, cycle })` | A value travelling along a link, on a loop. Stagger `begin` by pipeline stage. |
| `artifactHtml({ title, body, script, width })` | The page as a claude.ai Artifact that follows the viewer's theme. `build.mjs --artifact <file>` writes it. |
| `morphPath(ds, { id, hue })` | A link whose path changes per scene (`ds[i]`, or `null` when absent). It follows nodes that move with `placeCss`. |
| `lanes(L)`, `span(L, { lane, from, to, text, hue, id })` | Swimlanes with a time scale, and a bar in one lane. `showSpans(root, t)` in the page grows the bars up to time `t`. |
| `plot({ x, y, w, h, xr, yr, f, xTicks, yTicks, xName, yName, hue, origin, tickLabel })` | A function on named axes. Tick labels show as many places as the tick has (0.75 stays 0.75), and `tickLabel(v, "x" or "y")` returns your own text (a log axis: `10³`). The ranges are fixed at build time. `origin` is where the axes cross (default `[0, 0]`); `[xr[0], yr[0]]` puts them on the left and bottom edges. Returns `{ svg, at, sx, sy }`: place points, tangents and steps with `at(x, y)` on the same scale. In the page, `plotAt(plotEl, x, y)` uses the same scale. |
| `mn(value, { places, live, hue })` | A MathML number. With `live: "name"`, the page rewrites it with `setLive({ name: v })`, so the equation follows the state (rule 3). `setLive` writes into any element with `data-live`, so a live key name is `<mtext data-live="key">`. |
| `tsub(s)` | A subscript inside SVG `<text>`: `` `x${tsub("1")}` ``. Unicode subscripts (x₁) look wrong in the italic serif. |
| `mi`, `msub`, `prime`, `mfrac`, `mo` | MathML pieces coloured by hue. Use `prime("L")` for L′: a multi-letter `<mi>` renders upright. `mo("(")` writes a bracket or bar with `stretchy="false"`, so it does not grow next to an `munder`, `mtable` or `mfrac`. |
| `states(n, map)` | A full per-scene list for `placeCss` from a sparse map: `states(6, { 2: {x, y} })`. |
| `placeCss(selector, states, narrowStates?)` | Where an element stands in each scene, as CSS. A scene change is a native CSS transition: what leaves fades out first (0.22 s), then what arrives fades in. `narrowStates` is a second list for the narrow layout. It writes `transform`, so an element that also needs a narrow-layout CSS transform sits inside an outer group. |
| `stageHtml({ scenes, svg, label, css, key, dwell, time, controls, controlScenes, narrow, audio })` | Equation bar, drawing, a Play button, a Voice button and the stepper, key. Each scene is `{ name, math, voice, say }`, or `{ name, rule, voice }` when the topic has no real math (one line in code type; `<span data-hue="…">` colours a word). `time: { steps, scenes }` adds the step control (back, scrubber, next, "," and "."); it is dimmed outside `scenes`. `controls` is HTML put beside it, for example a row of picker buttons, a slider or number fields. `controlScenes: [i, …]` dims `controls` outside those scenes, and an input there moves to the first of them before the page's own handler runs. One control inside `controls` can carry its own `data-scenes="2 3"` with the same effect. `controls` may hold buttons, number and text fields, sliders and `<select>`; under 520 px the controls stack in a column. Keys typed in a control stay in it. `narrow: [w, h]` is the viewBox for a stage under 560 px; `h` may be a list with one height per scene. See "Composition". |
| `readScript(file)` | The narration script: one `## n. Scene name` section per scene in a markdown file, one sentence (a beat) per line, each line with an optional `[cue]` at the start. Returns `{ voice, beats: [{ cue, text }] }` per scene, in scene order. |
| `beatTimes(pcm, rate, lengths)` | Where each beat starts in a clip, in seconds: each boundary goes to the pause nearest to where it falls by text length. `narrate` calls it. |
| `narrate(scenes, { dir, provider, model, voice, style })` | Records each scene's `voice` with a TTS provider (`gemini`, `openai` or `elevenlabs`; by default `UNFOLD_TTS_PROVIDER`, else the first provider whose key is set) and returns `{ src, beats }` per scene for `stageHtml({ audio })`: the clip as a data URI, and the start time of each beat. Clips are cached in `dir` by text, so a rebuild needs no key. Each new clip goes through `cleanEnds(pcm, rate)`, which removes the click before the first word and the loud burst after the last word (`node kit/concept-kit.mjs --check` tests it). `UNFOLD_TTS_MODEL` and `UNFOLD_TTS_VOICE` change the defaults. `TTS_PROVIDERS` lists each provider's key names, default model and default voice. Keep `style` to a short tag such as `"[calm, warm teacher]"`: a long instruction can be read aloud. A scene without a clip gets `null`, and the page uses the browser's voice. |
| `modelScript(fns, data)` | The model's pure functions as page source, for live inputs. Each must be a named `function` declaration, exported from `model.mjs`, and every helper it calls must be in `fns` too. `data` becomes `const` lines (finite numbers only: JSON has no Infinity). |
| `notesHtml(sections, { summary })` | The reference section under the card, closed by default (a `<details>` with `summary` as its label). Each section is `{ title, html, table: { head, rows } }`. At phone width a table row becomes a block. |
| `keyHtml(items, { signs })` | The colour key. `signs: true` adds the filled/hollow entries; use it only when grids show signed values. |
| `pageHtml({ title, theme, body, script, width })` | The iso page with the unfold CSS and runtime. `theme` is `"dark"`, `"light"` or `"auto"` (follows the reader's system setting). The page ships only the runtime helpers that `script` names (`setGrid`, `fmt`, …), plus what they need. |
| Page runtime | `UNFOLD.go(i)` (it also speaks the new scene's narration when voice is on), `UNFOLD.scene()`, `UNFOLD.pause()` (call it on every user input: the tour stops and the sweeps hold until the scene changes; `UNFOLD.go(i)` releases them, so `pause()` then `go(UNFOLD.scene())` replays the sweep for a new input), `UNFOLD.beat(scene, ms, fn, wait, count)` (with `count` the sweep stops after `fn(count - 1)`; the tour and `shoot.mjs` wait for it, and the tour holds the last step 1.8 s; `count` may be a function for a run whose length changes), `UNFOLD.onTime(fn)` (the step control calls `fn(t)`, then pauses, so the sweeps hold even when `fn` changes the scene), `UNFOLD.timeAt(t, steps?)` (move the control when your code changes the step; pass `steps` when a live input changed the run's length; step 0 is the start state, so the label reads "step 9 / 9" after 9 steps), `UNFOLD.narrow()`, `showRows(grid, t)`, `setGrid(grid, values, max?)`, `setBars(bars, values, max?)`, `mark`, `fmt`, `setLive(values)`, `plotAt(plotEl, x, y)`, and the `unfold:scene` and `unfold:layout` events. |

The kit has helpers only for the forms an example has needed so far. For other forms in `references/vocabulary.md`, draw them with plain SVG and the same CSS tokens. Add a helper to the kit when a second figure needs the same form.

## Craft rules (short form)

- **Real numbers, checkable by hand.** Every printed value comes from the model. A reader with a pencil can redo one cell.
- **One colour per concept, everywhere.** The same hue in the drawing, the math, the sentences and the key. Never use colour only for decoration.
- **Draw it, do not write it.** If a sentence describes something the reader could see (a path, a count, a before and after, a comparison, a "this one, not that one"), draw it instead: a label on the shape, an arrow, a highlighted cell, a small multiple. Labels on the drawing name things in 1 to 4 words and sit next to what they name ("dies", "+1 for SYN", "loop back"). Tokens, names of matrices, dimensions, axis names and numbers belong in the drawing too. Only the reason ("because …") goes in the narration.
- **Hear it, see it, do not read it.** The explanation is the `voice` narration. The card holds the drawing, its labels and the equation bar, and no paragraph. A reader with voice off gets the narration as captions.
- **Plain words, for a newcomer and an expert at once.** The drawing and the narration must make sense to a newcomer. The equation bar and the readout give the expert the exact form. Write all reader text (narration, caption, notes, readout) in the plain style of the explain-clear skill: say what changed first, one idea per sentence, at most 20 words a sentence and 3 sentences of narration a scene, no semicolons, no idioms, metaphors or phrasal verbs, a verb instead of a noun ("compares", not "performs a comparison"), active voice. Give one concept one name, and use it in the drawing, the key, the sentences and the notes. Define a term the first time it appears, in the sentence or as a label. Keep exact technical names (`SYN`, ε-closure, `RCV.NXT`). See `references/style.md`, section 10.
- **Math next to the shapes, when there is math.** One equation per scene in the equation bar, in MathML, coloured by identity. No equation without the shape it describes on screen. A topic without real math (a protocol, the event loop) uses `rule`: the scene's rule in one line. Never force math.
- **Morph, do not cut.** An object that exists in two scenes moves to its new place. A transpose moves each cell. A new object fades in where it will stay.
- **Animate the computation.** Motion shows the order in which things are computed: a grid fills row by row, a sweep visits each key in turn, a sum lands in its row, values travel along the links of the overview. No motion only for decoration. Never animate a `<text>` element itself; Chrome can stop painting SVG text after an animation on it ends. Animate its group.
- **One change per scene.** If a scene needs two sentences to say what changed, split it. A rule and its repeated use (an update rule and its iterations, a step and its loop) may share one scene.
- **Focus.** One item is selected at a time (one token, one node). It is outlined in every view, and the readout shows its arithmetic. Everything else stays visible but quieter.
- **The rules in "What wins a blind test"** hold here too: the reader runs the operation, every number follows the state, the event is at the shape, one way through time, code beside the run.
- **Arrows end on things.** An arrow starts on its source and its head touches its target. No floating arrows.
- **Time by hand.** A figure that runs through steps has the step control (`stageHtml({ time })` and `UNFOLD.onTime`). Stepping by hand moves to the scene that owns the step. Show the step number in the control.
- **Reader text never points to build files.** The reader has the page, not `model.mjs` or `build.mjs`. Do not write "run `node model.mjs`" in a caption, a note or a readout. Say what was checked and with which tool: "checked with `dig` on 2026-10-16". `words.mjs` reports it.
- **Code is runnable as shown.** A code panel shows the whole program, and `model.mjs` runs exactly those lines with the real tool. If a panel must leave lines out, mark the gap in the panel itself (a dim `⋯ 4 lines: main, includes`), not only in the caption. The same holds for tool output: a shortened listing says what it shortened.
- **Moving values never cover text.** A chip that travels to a value already written in the drawing lands next to it (above it, for example) and then fades. Size a chip to its text. A label next to a curve or a line keeps a gap of at least 4 px from it.
- **Composition.** The drawing fills the card width at desktop. No empty band above or below the drawing. At 390 px a fixed viewBox scales everything down to about 40%, so text in the drawing becomes too small to read. A figure with two columns, or with text at 10 to 12 px, needs a narrow layout: pass `narrow: [w, h]` to `stageHtml` (about 400 wide), and move groups with `.u-stage[data-narrow] …` CSS so the columns stack. Elements your script moves read `UNFOLD.narrow()` and redraw on `unfold:layout`. A one-column figure with large shapes may skip it: the cell numbers and bar values hide by themselves at 390 px and the colours still carry the values. For that case, add `@container (max-width:520px){…}` rules to hide secondary labels or enlarge the main ones.

## Verify

1. `node model.mjs` prints the tables and `model ok`.
2. Build both themes: `node build.mjs` and `node build.mjs --light`.
3. Capture every scene's finished state in one command: `node ../../scripts/shoot.mjs page.html --scenes N --out <dir>`. It runs dark (with the reader's system set to dark, so a `theme: "auto"` page shows dark too), light (`page-light.html`), 390 px and reduced motion, prints each scene's readout, and reports a clean console, no sideways scroll, and no text in the drawing that overlaps other text (`TEXT OVERLAP` fails the run). It also fails when a scene's equation is wider than the equation bar (`EQUATION CUT`): the bar scrolls by itself, so the page does not scroll sideways, but the reader sees a cut equation. Split it over two rows (`<mtable>`) or shorten it for the narrow layout. After its wait (`--wait`, 4000 ms) it also waits until every counted sweep (`UNFOLD.beat` with `count`) of the scene is done. A sweep without `count` loops, and is shot at whatever step it shows. Keep the shots outside the skill folder. Read every PNG. In the 390 px shots, the code and labels in the drawing must be readable without zoom; if they are not, add a narrow layout.
4. For a close-up, use `drive.mjs` with a `["shot", out.png, sel, scale, [x, y, w, h]]` action after a `["wait", 4000]`, so the scene has finished its entrance.
5. Redo one value per scene by hand from the PNG. When the topic is backed by a real tool (git, a compiler, a hash, a protocol stack), also check the model against that tool in `model.mjs`, as the blind-test git figure did with real `git`.
6. Check each hue: one concept per hue, in every scene, in the math and in the key.
7. Check the words: `node ../../scripts/words.mjs page.html` must print `words ok`. Play one scene with voice on and listen: numbers, symbols and code names must sound right (write "2 to the 32" in `voice` if the model reads 2³² badly). It also reports reader text that names `model.mjs` or `build.mjs`. For each problem, first try to draw the point (a label, an arrow, a table row). Cut words only after that. If the explain-clear skill is installed, also run `node ../../scripts/words.mjs page.html --text | python3 ~/.claude/skills/explain-clear/scripts/ste-lint.py` and fix what it finds. Its passive-voice and tense warnings are advice only.
8. Ask the critic question: could a newcomer explain the concept after one press of Play? If a scene does not add a clear idea, merge it or cut it.
9. Do the reader test with `drive.mjs` (an `--actions` file: click or type, wait, shot). Do it before you choose the shots for anyone else: a judge uses the page, not only your screenshots. Run the verb on an input that is not a preset, then run it again. Run it in every scene where the input is visible, and with values that take each branch (found and missing, a collision and none, below and above mid). Click a shape, then type in the field. Check four things in the shots. The whole figure changed, not only a preview. Every number on screen agrees with the new state: the equation bar, the labels, the readout and the tables. The event is marked at the shape. The step number and the scene agree. Then press reset and check that it shows the start state. `references/scenes.md`, section 10, has an actions file to start from.
10. Ask the scope question: does the figure answer the whole request? Read the request again. If it names a breadth axis, find the scene or table that shows what differs along it. Compare with what a plain, careful answer would contain: if it would cover a fact the figure leaves out (an ABI, a limit, an edge case), put it in the notes.

## References

- `references/style.md`: the 3Blue1Brown and Welch Labs style in detail: colour, type, numbers, math, motion, composition, and the anti-patterns.
- `references/vocabulary.md`: concept shapes and their visual forms, with what moves, what to select, and when to route to anatomy.
- `references/scenes.md`: storyboards, the scene runtime, `placeCss`, the falling matrix layout, and live updates.
