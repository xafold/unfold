# Style: 3Blue1Brown and Welch Labs combined

The goal is a figure that feels like a frame from a good math video, but that the reader can stop, step through and poke. Two sources:

- **3Blue1Brown** gives clarity: a dark ground, colour as identity, math typeset next to the shapes, objects that morph, and one small concrete example before the general idea.
- **Welch Labs** gives substance: the real numbers of the real system, tensors as solid blocks, and zoom levels from the whole system down to one value.

Use both in one figure. A typical figure opens on a Welch Labs overview (iso blocks, real values on their faces), then zooms into 3Blue1Brown scenes (flat shapes, colour-coded math, morphs).

## 1. Ground and themes

- Dark and light both come from the anatomy tokens (`--anatomy-page`, `--anatomy-card`, `--anatomy-text`, `--anatomy-strong`, `--anatomy-muted`, `--anatomy-faint`). Build both (`node build.mjs` and `--light`) for the checks.
- Pick the shipped theme from the request. A blog post, an article, docs or a wiki gets `pageHtml({ theme: "auto" })`: it follows the reader's system setting, and most readers see light. Use dark only when the request asks for a dark or video look, or the host site is dark. A claude.ai Artifact (`artifactHtml`) always follows the viewer.
- The card is the anatomy card. Do not restyle it.

## 2. Colour is identity

- Each concept gets one hue, and keeps it everywhere: in the drawing, in the MathML, in the scene sentence (`<b data-hue="blue">query</b>`) and in the key.
- The palette is `--unfold-blue`, `yellow`, `red`, `green`, `teal`, `purple`, `gold`, plus `ink` (the anatomy `hi` tone) for inputs and plain structure. Each hue has a dark-theme and a light-theme value.
- At most 7 hues in one figure. If you need more, two things are probably one concept.
- A derived thing takes the hue of what it is, not of where it came from. In the example, W_Q is blue because it makes Q.
- Value strength is the opacity of the hue: `0.1 + 0.8 * |v| / max`. Filled = positive, hollow (outline) = negative, dashed outline = masked or missing. This keeps the hue as identity and still shows sign.
- Never use colour only to decorate. Never use a rainbow scale.

## 3. Type

- Names of math objects: italic serif (`.u-name`, Latin Modern Math or STIX Two Math), in their hue. Dimensions beside them in small mono (`6×4`).
- Numbers: mono, tabular figures, a true minus sign (`fmt`). Use 1 decimal place for most values and 2 places for probabilities. `−∞` for masked.
- Tokens and words: mono, in chips.
- Scene sentences: the page sans font, 14 px, at most about 60 characters a line, at most 2 sentences. See section 10.
- No text smaller than 10 px at desktop width. At 390 px the cell numbers hide by themselves (`keep: true` on `cellGrid` or `bars` keeps them); titles, tokens and math stay.
- A subscript in the drawing is a `<tspan>`, not a Unicode subscript: `` `<text>x${u.tsub("1")}</text>` ``. In the italic serif, x₁ looks like two fonts.

## 4. Math

- One equation per scene, in the equation bar above the drawing, in MathML (`<math display="block">`). No KaTeX and no images.
- Colour the identifiers with `data-hue` (`<mi data-hue="blue">Q</mi>`), the same hue as the shape. The kit's `mi`, `msub`, `prime` and `mfrac` write these for you.
- A multi-letter `<mi>` renders upright, so `<mi>L′</mi>` looks wrong. Use `prime("L", hue)`.
- Write brackets and bars with `mo("(")`, not `<mo>(</mo>`. Next to an `munder`, `mtable` or `mfrac`, a plain `<mo>(</mo>` stretches to the full height of its neighbour. `mo` adds `stretchy="false"`. Do: `${mo("(")}${mi("x")}${mo(")")}`. Do not: `<mo>(</mo><munder>…</munder><mo>)</mo>`. When you want a bracket to grow around a tall fraction, write `<mo>(</mo>` on purpose and keep both sides in one `<mrow>`.
- A topic without real math uses the scene's `rule` instead: one line in code type, where `<span data-hue>` may colour a word.
- The equation describes what is on screen in this scene. If the shape is not on screen, the symbol is not in the equation.
- Prefer the textbook form the reader will meet later (`QKᵀ/√d_k`), and let the drawing make it concrete.

## 5. Numbers

- Print real values. A reader must be able to redo one cell by hand from the screen.
- Compute each step from the rounded values of the step before. Then the screen adds up, even if the last digit differs from full-precision math.
- Exception: a process that repeats until it converges (gradient descent, Newton's method, power iteration). Rounding each step can stop it early: in a 2026-10-15 test, a gradient descent page rounded its way to w = 3.00 with a gradient of exactly 0, and claimed the rate "lands on 3". Compute such a process in full precision and print rounded values. Assert in the model that the printed path does not stop before the exact path does. Never claim a limit is reached when only rounding reaches it.
- When inputs are chosen by hand to make the pattern clear, say so in the caption. The arithmetic after them is still real.
- The readout shows the arithmetic for the focus item: `q·k / √3 = (1.5×1.7 + −0.2×−0.2 + −0.2×0.9) / 1.73 = 1.4`. Keep it to about 70 characters. A longer readout wraps to a second line, and at 390 px it takes the full width.

## 6. Zoom levels (Welch Labs)

- **System:** iso tensor blocks (`tensorBlock`) or a graph of parts, with real values on the faces. Use it as scene 1 so the reader knows where each later scene sits.
- **Part:** flat shapes with numbers (`cellGrid`, plane, tree, lanes).
- **Value:** one cell, one dot product, one comparison, in the readout or as a highlighted row.
- Go from system to value. The transition between levels is a zoom: the overview grows and fades while the part fades in.

## 7. Motion (3Blue1Brown)

- Scene changes are CSS transitions: `transform` 0.9 s on the anatomy ease curve. Opacity is sequenced: what leaves fades out in 0.22 s, and what arrives fades in over 0.5 s after it. Never let two scenes show on top of each other: a double exposure of old and new shapes, or two sentences at once, looks muddy. Cells stagger by about 18 ms each (`--i`).
- An object in two scenes moves. A transpose moves each cell to `(c, r)`. Nothing cuts, and nothing appears from nowhere: a new object fades in where it will stay.
- Each scene builds its result in the order it is computed (`revealCss`). A scene with a step-by-step operation shows it as a sweep (`UNFOLD.beat`): the example visits each key for the selected query, lights the key column and the score cell, and shows that dot product in the readout. The overview carries values along its links (`pulseSvg`), stage by stage.
- Entrances only start from hidden; the resting state is always complete, so a still frame, a thumbnail and reduced motion all show the full scene.
- The tour starts paused. The page opens on scene 1 with a Play button before the scene buttons. Play advances one scene every 6.5 s (8 s in the attention example, so the sweeps can finish) while the figure is on screen. It stops at the last scene and at any input, and it does not start again by itself. Judges called a self-starting tour "intrusive" in the 2026-10-15 test. The motion inside a scene (entrances, sweeps) still plays without Play.
- Reduced motion: no transitions. Play still works, because the reader asked for it. Every scene and control still works.

## 8. Composition

- The SVG view box is about 820 wide. Set the height to what the busiest scene needs. Leave no empty band above or below the drawing.
- At 390 px a fixed view box shrinks to about 40%. Text drawn at 10 to 12 px becomes 4 to 5 px and cannot be read. A figure with two columns or with code in it gets a narrow layout: a second view box about 400 wide (`stageHtml({ narrow })`), where the columns stack. See `references/scenes.md`, section 6.
- Matrices that multiply use the falling layout: A on the left, B above, the result where their rows and columns meet. The reader sees that row i and column j make cell (i, j).
- Labels sit above the top-left of their shape. Chips for rows sit on the left; chips for columns sit above.
- Keep a dimmed copy of the inputs on screen when it helps to show where a result came from (opacity 0.3).

## 9. Anti-patterns

- **The machine metaphor.** Drawers for vectors, pipes for data, a factory for a model. Use the anatomy skill for real machines only.
- **Boxes with words.** A box labelled "Encoder" with an arrow to a box labelled "Decoder" explains nothing. Show what is inside the box, or leave it out.
- **The wall of numbers.** All matrices at once, from the first frame. Build them up one scene at a time.
- **Colour without a key.** Every hue in the drawing is in the key and in the math.
- **Fake numbers.** Random-looking values that are not computed. If the reader redoes a cell and it fails, the figure has lied.
- **The slideshow.** Scenes that replace each other with no shared objects. Plan what persists.
- **Too big an example.** 512 dimensions shown as a grey blur. Pick dimensions small enough to print, and say the real size in the caption.
- **Arrows to nowhere.** Every arrow touches its source and its target.
- **The narrowed request.** The user asked for "all the languages" and got one example copied six times. Show what differs along the axis the request names, with real data.
- **Fragments shown as code.** A panel with a top-level `printf` and no `main` does not compile, and a careful reader will say so. Show the whole program, or mark the cut lines in the panel.
- **Tour only.** A figure that runs through time but has no way to step back and forth by hand. Add the step control.
- **Chips over text.** A value chip that sits on the text next to it ("squar[4]"). Land it beside the value, then fade it.
- **The sentence that describes the picture.** "State 4 and state 10 die because they need a b." Draw it: the two states turn red with a label "needs b". Keep the sentence for the reason only.
- **The essay under the card.** Notes with paragraphs of prose. The reader came for a figure. Turn each paragraph into a table row or a small diagram. Keep at most 3 sentences per section.
- **Build files in reader text.** A caption that says "run `node model.mjs --dig`". The reader has the page, not the build folder. Say what was checked and with which tool ("checked with `dig` on 2026-10-16").
- **The missing canonical picture.** A Fourier series figure without rotating circles, or a DNS figure without the server tree. When a topic has a picture that every textbook uses, show it. See `references/vocabulary.md`.
- **The fixed snapshot.** Scenes that show the operation on preset data only, with an input that changes a preview beside the drawing. The reader asks "what happens to my key?" and the figure cannot answer. Run the operation on the reader's input, on the whole figure, again and again.
- **The stale number.** The equation bar, a label or a table keeps the preset's number after the reader picks another item or types a value. The drawing then disagrees with the math. Draw everything from one state with one `render()`.
- **The event in the corner.** The only place that says what this step did is the 10.5 px readout. Mark the change at the shape it changes.
- **Two clocks.** Scenes and steps that move separately ("scene 3 of 5", "step 7 of 9"), so the reader does not know where they are. Scenes are chapters of the steps.
- **Code out of step.** An algorithm figure with no code, or with code that does not show which line runs now. Light the line with `codeLines` and `mark`.
- **Text on text.** A badge, a chip or a label placed on another label, often only at 390 px. `shoot.mjs` reports it.
- **Uppercase math.** CSS `text-transform: uppercase` turns η into Η, which reads as the letter H. Do not uppercase text that can hold a math symbol.

## 10. Words

The drawing carries the idea. Words name things, give the reason, and give the depth that a drawing cannot hold. Two readers use the same figure: a newcomer reads the drawing and the scene sentence, and an expert reads the equation bar and the readout. Each layer must make sense without the other.

**Draw first, then say it.** Before you write a sentence, ask whether the reader could see it instead. What is left is the narration (`voice`): the reason, spoken. It is not printed in the card unless the reader turns voice off. Write for the ear: short sentences, the number as it is said, and no symbol the voice cannot say.

| If the sentence says | Draw it as |
|---|---|
| which items take part ("states 4 and 10 die") | a colour change plus a 1 to 4 word label on the items |
| a path or an order ("then it goes to the task queue") | an arrow, a moving chip, or numbered marks on the path |
| a before and an after | a dimmed copy of the before, or a small multiple beside it |
| a comparison of 3 or more things | a table row each, or bars on one scale |
| a count or a size ("6 states added") | the items themselves, highlighted, and the number as a label |
| a rule ("each step multiplies the distance by 0.4") | the equation bar, with the same hue as the shape |

**Narration like 3Blue1Brown.** The narration explains the scene the way Grant Sanderson does: a person talks to the viewer about what is on the screen. Write it in `script.md` first (see `examples/btree-insert/script.md`), show it to the user, and record only after they agree.

1. Start with a question or a problem, not a definition: "How do you find one key with very few reads?"
2. Talk to the viewer: "you", "we", "let's". Use short spoken words ("it is", "that is").
3. Point at the picture: "look at the root", "notice this", "see how 40 moves up".
4. Show the event first, then name it: "the node is too full" first, then the word "overflow" if the scene needs it.
5. Use the numbers on the screen, said as a person says them: "40 is bigger than 20, so we go right."
6. One idea per scene. End a scene with what comes next ("So what do we do?"), and answer it in the next scene.
7. Save one sentence for why it matters ("And here is the nice part …"), in the scene where the pattern is complete.
8. One sentence per line in `script.md`. A sentence that names a part of the picture ("the query of sat", "the blocked scores") starts with a cue, so the figure lights that part while the voice says it.
9. No symbols the voice cannot say (2³², ≤, [30 40]). Write the words.

**Plain words.** This is the plain style of the explain-clear skill (a softened ASD-STE100), applied to scene sentences, the caption, the notes and the readout.

1. Say what changed first. Give the reason second.
2. One idea per sentence. At most 20 words a sentence and 2 sentences a scene. The caption and notes allow 25 words.
3. No semicolons, em-dash chains or arrow chains in a sentence. Write two sentences.
4. No idioms, metaphors or phrasal verbs. Write "start", not "kick off". Write "removes", not "takes off".
5. A verb, not a noun: "compares", not "performs a comparison".
6. Active voice: say what does the action ("the server sends", not "is sent").
7. One concept, one name. Use the same name in the drawing, the key, the sentences and the notes. Do not rotate synonyms ("frame", "record", "activation").
8. Define a term the first time it appears, as a label on the drawing or in the sentence: "ε edge (moves without reading input)".
9. Keep exact technical names (`SYN`, `RCV.NXT`, ε-closure, softmax). Do not replace them with simpler words. Define them instead.
10. Keep hedges. Add no fact that the model or a source does not support.
11. Never point the reader to a build file (`model.mjs`, `build.mjs`) or a build command. The reader does not have them. `words.mjs` reports it.

**Budgets.** `scripts/words.mjs` checks them on the built page.

| Text | Budget |
|---|---|
| Narration (`voice`) | 5 sentences, 70 words |
| On-screen line (`say`) with narration | 1 sentence, 12 words, or none |
| Scene sentence without narration | 2 sentences, 30 words |
| Any sentence | 20 words (25 in the caption and notes) |
| Label on the drawing | 1 to 4 words |
| Readout | about 70 characters (it wraps to 2 lines after that) |
| Notes section | a table or a small SVG, plus at most 3 sentences |
| Notes prose in total | 250 words |
| Terms | a table: term, meaning in 12 words or fewer |

A small SVG in the notes is a plain `<svg viewBox>` in a section's `html`, drawn with the same hues and tokens as the card. For example, the factor 1 − 2η on a number line, with the regions "slow", "fast", "flips sides" and "grows".
