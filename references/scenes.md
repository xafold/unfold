# Scenes: storyboard, runtime and live values

## 1. Storyboard first

Before any geometry, write a table like this one, from `examples/attention-head/`:

| # | Name | On screen | What changes | What it means |
|---|---|---|---|---|
| 1 | Overview | iso blocks X, Q, K, V, A, O with arrows | nothing; the page opens here | the whole head and where each part sits |
| 2 | Embed | token chips, X | the overview zooms away, X fades in | a token is a row of numbers |
| 3 | Project | X, W_Q/W_K/W_V above Q/K/V | X slides left, W and Q/K/V fade in | three learned views of each row |
| 4 | Score | Q, Kᵀ, S, column chips | K transposes cell by cell, X and W leave | every query meets every key |
| 5 | Softmax | dim Q and Kᵀ, A, bars | S fades into A in place, bars appear | scores become weights that add to 1 |
| 6 | Mix | A, V, a·v, Σ, O | V rows dim by weight, the sum lands in O | the output is a weighted sum of values |

Rules:

- Each scene adds one idea. The "what it means" cell is one short sentence.
- Mark which objects persist. Those morph. The rest fade.
- The last scene answers the question the first scene raised.

## 2. Positions per scene: `placeCss`

Every movable group is a `<g class="u-move" id="…">` drawn at its local origin. `placeCss(selector, states)` writes one CSS rule per scene:

```js
u.placeCss("#gQ", [null, null, { x: 350, y: 202 }, { x: 276, y: 222 }, { x: 216, y: 222, o: 0.3 }, null]);
```

- A state is `{ x, y, s, o }` (translate, scale, opacity). `null` hides the element, faded where it last stood, with pointer events off.
- **Leave first, then arrive.** An element that leaves (`null` or `o: 0`) fades out in 0.22 s at once. An element that arrives fades in over 0.5 s, after 0.22 s. So the old and the new scene never show on top of each other. The scene sentence and the equation change the same way.
- An element you show and hide with your own scene CSS (not `placeCss`) uses the same timing: write `transition: opacity var(--u-fade) var(--u-ease) var(--u-fade-at)`, and add `--u-fade:.22s;--u-fade-at:0s` to the rule that hides it. `examples/function-call/` does this for its panels.
- The stage carries `data-scene="i"`, so a scene change is a native CSS transition. There is no animation code to write.
- `states(n, { 2: {…}, 3: {…} })` from the kit turns a sparse map into the full array.
- A state with `o > 0` stays clickable, so a dimmed item (o: 0.3) can still be picked. Only `null` or `o: 0` turns pointer events off.
- **Spawn from a source.** To show a copy, a clone, an insert or a promotion, give the new object, in the scene before it appears, the place it comes from with `o: 0`. It then slides out of its source while it fades in. The B-tree uses this for a key that drops in; a git rebase figure uses it for a commit copy that slides out of its original.

## 3. Transpose and other per-cell moves

`cellGrid({ transposeIn: [3, 4] })` gives every cell `--x/--y` (normal place) and `--tx/--ty` (transposed place). In the listed scenes the cells move to the transposed place, with an 18 ms stagger by `--i = r + c`. The name gets a `ᵀ` and the dimensions swap.

For another per-cell move (a sort, a reshape), use the same pattern: put both places in custom properties and add one CSS rule per scene.

## 4. The falling matrix layout

For C = A·B: put A on the left of C and B above C. Row i of A lines up with row i of C, and column j of B lines up with column j of C. With cells of 32 × 20:

```
            [ B ]
  [ A ]     [ C ]
```

Chained products reuse it: X on the left feeds W_Q, W_K and W_V above Q, K and V.

## 5. The runtime

`pageHtml` fills the window by default (`width: "fill"`). The card is as wide as the window. The drawing grows until the card is as tall as the window, and it keeps the shape of its view box, so draw in the same view box units as before. The equation, the sentence and the scene buttons grow with the card. Three cases have no height limit, and the drawing then takes the full width and the page scrolls: the narrow layout, a window under 520 px high, and a fixed `width` in px.

`pageHtml` adds the runtime before your script. It defines:

- `UNFOLD.stage`: the `.u-stage` element.
- `UNFOLD.go(i)`, `UNFOLD.scene()`, `UNFOLD.pause()`.
- The tour: it starts paused. `stageHtml` puts a Play button before the scene buttons. Play advances one scene every `dwell` ms while the figure is on screen, stops at the last scene, and stops at any input. It never starts again by itself. Play on the last scene starts again from scene 1.
- The tour never leaves a scene while a counted sweep (`beat` with `count`) still runs. When the sweep ends, the tour holds its last step for 1.8 s, then moves on. A looping sweep (no `count`) does not hold the tour, so give every sweep that plays a run once a `count`, or the tour cuts it.
- The `unfold:scene` event on the stage, with `detail.scene` and `detail.by` (`"user"` or `"tour"`).
- `UNFOLD.pause()`: call it on every user input. The tour stops, and every sweep (`beat`) holds until the scene changes, so a sweep never undoes what the user picked. `UNFOLD.go(i)` releases the hold. To play a scene's sweep again for a new input (a new target in the tree scene), call `UNFOLD.pause()`, set the new state, then `UNFOLD.go(UNFOLD.scene())`. Under reduced motion each sweep shows its resting state, `fn(-1)`, when its scene opens and when the page loads on its scene.
- `setGrid(gridEl, values, max?)`: rewrites numbers and colour strength in a `cellGrid`. Pass `max` when the new values have their own scale.
- `showRows(gridEl, t)`: shows rows 0..t and hides the rows not computed yet.
- `setBars(barsEl, values)`: moves the bars and their labels.
- `mark(root, i, selector = ".u-mark")`: lights the element with `data-r` or `data-i` equal to `i`, and clears the rest. `-1` clears all.
- `fmt(value, places)`: the number format used everywhere.
- `setLive(values, root?)`: writes each value into every `[data-live="name"]` element on the page: an `mn` in the equation bar (from the kit's `mn(v, { live })`), a `<span data-live>` in the readout, a label. A number is formatted with the element's `data-places` (without it: 0 places for a whole number, 1 otherwise).
- `plotAt(plotEl, x, y)`: the page-side twin of the build's `plot().at`, on the same scale. Use it to move a point, a tangent or a step arrow after an input.

- `UNFOLD.onTime(fn)`: with `stageHtml({ time: { steps, scenes } })`, the step control (back, scrubber, next) and the "," and "." keys call `fn(t)`. Move to the scene that owns step `t` with `UNFOLD.go`, then draw it. The runtime calls `pause()` after `fn`, so the sweeps hold even though `go` released them.
- `UNFOLD.timeAt(t, steps?)`: call it whenever your code shows step `t` (from a sweep, a scene change or a key), so the control and its "step t / n" label follow.
- **A run whose length changes.** `time.steps` is only the first length. When a live input makes a longer or shorter trace (a new source node, another payload), call `UNFOLD.timeAt(t, newSteps)`. The scrubber then runs from 0 to `newSteps − 1`, and the keys clamp to it. Keep `time.scenes` as it is, and compute which scene owns each step from the new trace. A counted sweep over that trace passes a function as `count`: `UNFOLD.beat(2, 700, show, 900, () => trace.length)`.
- **Voice.** When a scene has `voice`, the stepper gets a Voice button (on by default when the page has clips or the browser can speak). A scene change speaks the new scene: its recorded clip (`stageHtml({ audio })` from `narrate()`), or the browser's most natural English voice. The tour waits until the narration ends, then 0.9 s more. `go(UNFOLD.scene())` does not restart it. A clip plays only while the narration text is the text it was recorded from: after a live input changes a number in it (`setLive`), the browser voice reads the new text. With voice off, the narration shows as text under the drawing.
- **Beats.** While the voice says line k of the scene's script, the stage has `data-speaking` and `data-cue` = the cue of that line (empty for a line with no cue). The times come from the clip (`beatTimes`, from the pauses between sentences), or, for the browser's voice, from the text length. When the narration ends, both attributes go, so the full scene shows. Light the parts a line names with CSS under `.u-stage[data-speaking][data-scene="i"][data-cue="name"]`: dim the other groups (`opacity:.15`), outline the cell (`stroke-width:2`), show a row mark (`.u-mark{opacity:1}`). Do not hide what the scene needs at the end: the cue rules only add emphasis. `shoot.mjs` turns the voice off, so its shots show the finished scene. Browsers block sound before the first click, so the first narration starts with Play or a scene button.
- `UNFOLD.narrow()`: true while the stage uses its narrow view box. The `unfold:layout` event fires when it changes.

Keys: left and right change the scene, Home and End jump, "," and "." step through time. The figure adds its own keys for the focus item (up and down in the examples). Clicks on the stepper change the scene. A figure with several focus items may also add a row of picker buttons with `stageHtml({ controls })`, so a mouse or touch user can change the item in any scene. Keys typed in an `input`, `select` or `textarea` inside the controls stay there: an arrow key in a number field changes the number, not the scene.

**Scene-scoped controls.** A control that only some scenes use (a learning-rate slider for the "compare rates" scene) is scoped to them. `controlScenes: [i, …]` on `stageHtml` scopes the whole group. `data-scenes="2 3"` on one element inside `controls` scopes only that element, so the focus picker stays live in every scene while the slider beside it does not. In the other scenes a scoped control is dimmed to 40%, the same as the step control outside `time.scenes`. If the reader uses it there, the page moves to the first listed scene, so they see what they changed. The move runs before your own `input` or `click` handler (the runtime listens in the capture phase). So an `unfold:scene` handler that sets a preset runs first, and your handler then applies what the reader set. That handler must not write a value back into the control the reader is using: it runs before your `input` handler reads the control, so the reader's value is lost (the ab3 binary search n slider). Keep the value in your state, and let the `input` handler write the state. Do not nest two scoped elements. A control with no scope applies to every scene.

## 6. Narrow layout

At 390 px the card is about 330 px wide. A view box of 820 then shrinks to 40%, and text drawn at 11 px shows at 4.5 px. Give such a figure a second layout:

1. Pass `narrow: [400, h]` to `stageHtml`. Below 560 px of stage width, the runtime swaps the SVG's view box to `0 0 400 h` and sets `data-narrow` on the stage.
2. Draw in columns about 400 wide. Wrap each column in a group, and place the second column with CSS: `.el-right{transform:translate(460px,0)}` and `.u-stage[data-narrow] .el-right{transform:translate(0,360px)}`.
3. Elements that `placeCss` moves take a second state list for the narrow layout: `placeCss("#gK", wide, narrow)`. Elements your script places by coordinates add the column offset for the current layout (`UNFOLD.narrow()`), and are drawn again on `unfold:layout`.
   - When scenes need different heights in the narrow layout (one scene stacks two columns, the next has one row), pass one height per scene: `narrow: [400, [520, 300, 300, 640]]`. The view box follows the scene, so no scene has an empty band.
4. The controls under the drawing stack in a column under 520 px: the pickers and fields on one row, the step control on its own full-width row. Keep a picker row to about 6 short labels. For more items, use a `<select>` (the kit styles it).
5. For an overview that cannot fit 400 px at a readable size, show it smaller in the narrow layout and let the next scenes carry the detail. `examples/function-call/` shows the six code panels at 70% in a 2 × 3 grid, and previews the call stack under them.

## 7. Live values

The page keeps one state: the focus item (`query` in the example), the reader's inputs, and the results computed from them. One function, `render()`, draws every view from that state: row marks, bars, derived grids, labels, the equation bar and the readout. Every input changes the state and then calls `render()`. Call it once at load. With one state and one `render`, no view can keep an old number (rule 3 in `SKILL.md`).

```js
const state = { focus: 0, X: X0, ...head(X0) };
function render() {
  mark(UNFOLD.stage, state.focus);
  setGrid(gQ, state.Q);
  setLive({ q1: state.Q[state.focus][0], score: state.S[state.focus][state.focus] });
  readout.textContent = `…`;
}
```

- Numbers in the equation bar: write them with `u.mn(value, { places, live: "q1" })` in the build, and update them with `setLive` in `render`. If the equation cannot follow the state, write it with symbols only.

- Write attributes and CSS custom properties. Do not rebuild the SVG.
- Gate scene-specific looks with CSS, not JS: the example sets `--w` on V's cells at all times, and only `.u-stage[data-scene="5"] #gV .u-cell{opacity:var(--w)}` uses it.
- The readout reads from the model, and changes with the scene and the focus item.

## 8. Live inputs

Presets alone leave the reader's first question open: "what if I start somewhere else?" Give the inputs that question names a field or a slider (a start point, a rate, an ISN, a payload size, a row of numbers). `examples/attention-head/` does it with four number fields for the picked token's row of X.

1. **One pure function in `model.mjs`.** Write the computation as a named function of its inputs: `export function head(X) { … return { Q, K, V, S, A, O }; }`. Its helpers are named function declarations too, and `model.mjs` must export them: `build.mjs` reads them as `m.matmul`, and `modelScript` needs each one in its list. A helper left out of the list is a `ReferenceError` in the page, not in the build. The preset values come from the same call: `export const { Q, K, V, S, A, O } = head(X);`.
2. **Assert the range, not only the preset.** The reader can type any value the control allows. In `model.mjs`, run the function on many inputs from that range (a seeded random loop is enough) and assert the rules the scene sentences state: rows add up to 1, the mask holds, the loss goes down for a small rate.
3. **Ship it.** In the page script, `${u.modelScript([m.matmul, m.softmax, m.head], { W_Q: m.W_Q, X0: m.X })}` writes the functions and the constants. Compute the page's values from it at load (`const M = { X: X0, ...head(X0) }`), so the build and the page share one source. Never write the math a second time in the page.
4. **The control.** Put the fields or the slider in `stageHtml({ controls, controlScenes })`. Set `min`, `max` and `step` to the range that `model.mjs` asserts. On `input`: call `UNFOLD.pause()`, read the number, skip it if it is empty or not finite, clamp it, round it to the places the figure prints, recompute, and redraw with `setGrid`, `setBars`, `mark` and the readout. Do not rewrite the field the reader is typing in. Write the rounded value back on `change`.
5. **The verb, on the drawing.** The input is often a click on the drawing, not a field: click a cell to search for it, click a node to make it the source, click an edge to trace its path. Give the clickable shapes `data-i` and a `cursor:pointer`, and handle the click on their group. Keep a field too, for values the drawing does not show (a key that is not in the table yet).
6. **Repeat it.** When the topic repeats its operation (one more gradient step, one more insert), the model exports `step(state, input)` and the page keeps the current state. A "one more step" button calls `step` on the current state, appends to a history, and calls `render()`. Show the history (a trail of dots, a sparkline drawn with `plot` and `plotAt`, a table that grows with `showRows`). A "reset" button sets the state back to the preset at step 0, the start state (an empty table, the first weights). In `model.mjs`, assert the rule the sentences state over many repeats (the loss goes down for every allowed rate, the table stays sorted after 200 random inserts).
7. **Presets are named buttons.** "model X", "η = 0.05 (slow)", "Linux capture": each sets the inputs to a chosen value and recomputes. They are the anchors the scene sentences talk about.
8. **Sentences must stay true.** A scene sentence must hold for every value the control allows, or name the preset it describes ("With η = 0.05, …"). Live numbers go in the readout and the drawing, not in the sentences.
9. **Redraw, do not rebuild.** Write attributes, text and CSS custom properties, as in section 7. A form the kit draws without a setter (the top face of a `tensorBlock`) can be updated by order: its `rect`s are in row order. Mark its group in the build (`data-block="Q"`) so the script can find it.

## 9. Animation inside a scene

- **Entrances:** `revealCss(scene, selector, opts)` plays each time the scene opens. The delay is `delay + --r × stepR + --c × stepC`, and `cellGrid` and `bars` set `--r` and `--c`, so `{ kind: "cells", stepR: 110 }` fills a grid row by row. Wrap other items in a `<g style="--r:k">` to order them.
- **Sweeps:** `UNFOLD.beat(scene, ms, fn, wait, count)` calls `fn(0)`, `fn(1)`, … every `ms` while that scene shows and the figure is on screen. Under reduced motion it calls `fn(-1)` once: draw the resting state. Use `data-hl` on cells to light the current step.
  - A sweep that ends (a trace played once) passes `count`. It stops after `fn(count − 1)`. While it runs, the stage has `data-busy`, and `shoot.mjs` waits until it clears. `examples/event-loop/` and `examples/function-call/` do this.
  - A sweep that loops (a search path shown again and again) has no `count`. It never ends, and the shot shows whatever step it is on. Make its resting step (`fn(-1)`) and each step still show the scene's idea.
- **Flow:** `pulseSvg(from, to, { begin })` moves a dot along a link on a loop. Give each pipeline stage a later `begin`.
- **Transforms:** `pop` and `rise` animate `transform`. Never put them on a `.u-move` element or on anything with a `transform` attribute (a `chip`), or the animation replaces its position. Wrap the content in an inner `<g>` and animate that. `fade`, `grow` and `draw` are safe anywhere.
- **Links:** `morphPath` has `pathLength="1"`, so `revealCss(…, { kind: "draw" })` draws a new link in.
- **JS-moved elements:** if your script moves an element with a transform, write its first transform in the build too, or it flies in from (0, 0) on load.
- **Values that travel:** a chip that carries a value to a place where the value is already written lands beside it, not on it, and then fades (`examples/function-call/`: the chip lands above the value and a `data-landed` attribute fades it 0.65 s later). A chip on top of text hides its neighbours in every still frame.
- **Text:** never put an animation on a `<text>` element. Chrome can stop painting it once the animation ends. Animate the group around it.
- Reduced motion turns off every transition, entrance and pulse.

## 10. Checks for scenes

- `node ../../scripts/shoot.mjs page.html --scenes N --out <dir>` captures every finished scene in all variants in one run. It waits `--wait` ms (4000), then until the stage has no `data-busy` (every counted sweep is done, up to 60 s).

- `capture.mjs` waits before it presses `--key`, so its shot comes right after the keys, part way through the entrances. To check a scene's finished state, use `drive.mjs` with `["key", "ArrowRight"], ["wait", 4000], ["shot", "out.png"]`.
- To see a morph mid-flight, take a contact sheet right after the key press. Scene changes are CSS transitions, and `["slow", …]` does not slow them (it slows only the page clock). Use a short frame gap instead:

  ```json
  [["key", "ArrowRight"], ["wait", 2000], ["key", "ArrowRight"], ["sheet", "shots/morph.png", 150, 8]]
  ```

  Run it with `node ../../scripts/drive.mjs page.html --actions morph.json`. Nothing should jump, and no object should pass through text.
- Capture with `--reduced`: every scene must still be correct with no transitions.
- `shoot.mjs` also lists visible text in the drawing that overlaps other visible text, per shot, and fails on it. It skips text on a slanted plane (iso floor labels). It does not see text that touches a curve or a line: check those in the PNGs.

**The reader test.** Drive the live part once like a reader, with an actions file for `scripts/drive.mjs`:

```json
[["key", "End"], ["wait", 3000],
 ["click", "#cell-11"], ["wait", 1500], ["shot", "shots/verb-1.png"],
 ["click", ".u-controls [data-act=step]"], ["wait", 1500], ["shot", "shots/verb-2.png"],
 ["eval", "document.querySelector('.u-eq .u-at[data-at=\"6\"]').textContent"]]
```

In each shot, check that the whole figure changed, that the equation bar, labels, readout and tables agree with the new state, and that the event is marked at the shape. To type into a field, focus it with `["click", "#field"]` and press one `key` action per character, or set the value in an `eval` and dispatch an `input` event. Two `drive.mjs` limits: a `key` action takes key names such as `","` (not `"Comma"`, which it ignores without an error), and a `shot` region is measured after the page scrolls for a key action.
