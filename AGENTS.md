# AGENTS.md

This file guides Codex when it works in this repository.

## What this is

`unfold` is a Codex skill. It builds interactive explainer figures for abstract software and math topics (attention, B-trees, the event loop, gradient descent, git, protocols). The style combines 3Blue1Brown and Welch Labs: the real structure of the idea, real computed numbers, one colour per concept, MathML, and scenes that morph.

It is built on the `anatomy` skill. It reuses anatomy's card, page, iso camera, theme tokens and screenshot scripts. It does not use anatomy's "invent a physical machine" rule.

- **Repo:** `~/personal_projects/Codex-skills/unfold/` (this folder).
- **Install:** `~/.Codex/skills/unfold` is a symlink to this folder. Edits here are live in Codex at once. Do not copy the folder back into `~/.Codex/skills`.
- **Git:** remote `origin` is `github.com/xafold/unfold` (public), owned by the `xafold` account. The active `gh` account on this machine is `utsavpaudellf`, so push with the `xafold` token (`GH_TOKEN=$(gh auth token --user xafold)`).

## Layout

| Path | What it is |
|---|---|
| `SKILL.md` | The skill itself: the core idea, the workflow, the kit table, the craft rules and the checks. Codex loads this file. |
| `references/style.md` | Colour identity, type, MathML, numbers, zoom levels, motion, anti-patterns. |
| `references/vocabulary.md` | 8 concept shapes and how to draw each one. It also says when to route to anatomy. |
| `references/scenes.md` | Storyboard, `placeCss`, the transpose, the page runtime, animation and checks. |
| `kit/concept-kit.mjs` | The only kit file. Forms, scenes, runtime, CSS, `pageHtml` and `artifactHtml`. |
| `scripts/shoot.mjs` | Captures every scene's finished state in dark, light, 390 px and reduced motion. It fails on console errors, sideways scroll, and visible text in the drawing that overlaps other text. |
| `scripts/words.mjs` | Checks the reader text of a built page against its budget (sentences per scene, sentence length, semicolons, notes prose, and reader text that names `model.mjs` or `build.mjs`). `--text` prints plain text for the explain-clear linter. |
| `examples/<name>/` | `model.mjs` (the truth model, with asserts), `build.mjs`, and the built pages `<name>.html` and `<name>-light.html`. |
| `evals/evals.json` | 8 test prompts: one per concept shape, one routing check, and one breadth request. |
| `benchmarks/` | Blind A/B test runs against a no-skill baseline, judged by Gemini in agy. `benchmarks/README.md` has the results table and the rerun commands. |

Examples: `attention-head` (transform of numbers, with live number fields for one row of X), `btree-insert` (structure and a process on it), `event-loop` (sequence in time), `function-call` (a breadth request: what is shared and what differs across six languages, with a narrow phone layout and a reference section under the card). Four more won their blind tests and were ported from `benchmarks/` on 2026-10-16, with the judges' notes applied: `dijkstra` (the reader clicks the source and edits weights, lazy-deletion queue, lit pseudocode), `backprop` (repeated gradient steps with a loss history, finite-difference check), `tcp-handshake` (the reader's own ISNs and payload, checked against a Linux loopback capture), `regex-nfa` (the reader's own input string, checked against `RegExp`).

## Commands

Run these from the example folder, for example `examples/btree-insert/`:

```bash
node model.mjs                                   # truth model asserts; prints "model ok"
node build.mjs                                   # dark page: <name>.html
node build.mjs --light                           # light page: <name>-light.html
node build.mjs --artifact /path/to/out.html      # Codex.ai Artifact page (follows the viewer's theme)
node ../../scripts/shoot.mjs <name>.html --scenes N --out /tmp/some-dir
node ../../scripts/words.mjs <name>.html          # text budget; prints "words ok"
```

Scene counts: `attention-head` 6, `backprop` 7, `btree-insert` 7, `dijkstra` 6, `event-loop` 5, `function-call` 7, `regex-nfa` 6, `tcp-handshake` 7.

`function-call/model.mjs` runs real tools: python3, node, ruby, gcc, java (with the `jdk.compiler` and `jdk.jdeps` modules) and rustc. It takes about 10 s. A language whose tool is missing is skipped with a message. The stored stack depths are for this machine (Linux x86-64, `ulimit -s` 8192); on another machine the depth asserts may fail, and the stored values must be measured again. On 2026-10-16 the Java depth assert failed once on this machine too (14544, stored 21800): the JIT makes Java's depth vary between runs.

`dijkstra/model.mjs` also checks against Python networkx, and skips that check with a message when networkx is missing. `tcp-handshake/model.mjs` checks against the stored `capture.json`; `node model.mjs --capture` captures again with `capture.py` in a user and network namespace (`unshare -rn`, no root).

To check everything after a kit change, run this from the repo root:

```bash
for e in attention-head backprop btree-insert dijkstra event-loop function-call regex-nfa tcp-handshake; do
  (cd examples/$e && node model.mjs | tail -1 && node build.mjs && node build.mjs --light)
done
```

Then run `shoot.mjs` and `words.mjs` on each example and read the PNGs. `shoot.mjs` must exit 0: a clean console, no sideways scroll and `text ok` for every shot. `words.mjs` must print `words ok`.

There is no package.json and there are no dependencies. You need Node 20.10+ and Google Chrome (`/usr/bin/google-chrome`) for the screenshot scripts.

## Dependency on anatomy

- The kit loads `~/.Codex/skills/anatomy/kit/iso-kit.mjs` by its install path, not by a relative path. This skill is a symlink, and Node resolves imports from the real path. Set `ANATOMY_DIR` to use another anatomy checkout. `scripts/shoot.mjs` uses anatomy's `scripts/drive.mjs` the same way.
- anatomy is a clone of `github.com/wheresryan22/anatomy`. Do not edit it from here. The skill was tested at anatomy commit `689dcf9`. After an anatomy `git pull`, run the full check above.
- Routing between the two skills works in one direction only. unfold's description sends machine and capacity topics (a queue, a pool, a rate limiter) to anatomy. anatomy's description still claims "algorithm", so a plain request may pick anatomy. This is an open decision for the user.

## Rules for kit and example code

- **Truth first.** Every number in a figure comes from `model.mjs`. Print rounded values, and compute the next step from the rounded values, so the screen adds up by hand. Exception: a process that repeats until it converges is computed in full precision, because rounding each step can reach a false limit (the 2026-10-15 gradient descent test claimed w "lands on 3"). A topic backed by a real tool (git, a compiler) checks the model against that tool.
- **Never animate a `<text>` element.** Chrome can stop painting SVG text after an animation on it ends. Animate the group around it.
- **`pop` and `rise` animate `transform`.** Never put them on a `.u-move` element or on a `chip`, because the animation replaces the element's position. Use an inner `<g>`.
- **Call `UNFOLD.pause()` on every user input.** The tour stops, and the sweeps (`UNFOLD.beat`) hold until the scene changes. The tour starts paused and runs only after the reader presses Play.
- **A live input runs the model's own code.** A field or slider that changes an input recomputes with the function from `model.mjs`, shipped with `modelScript`. Never write a second copy of the math in the page. `model.mjs` asserts its rules on many inputs in the allowed range, not only on the preset.
- **Add a kit helper only when a second figure needs the same form.** Until then, draw it in the example's `build.mjs`.
- **Keep the kit's API and the docs in step.** When you change an export, update the kit table in `SKILL.md` and the reference that covers it.
- Keep screenshots out of the repo. Use `/tmp` or a scratch directory (`shots/` is in `.gitignore`).
- The built `.html` pages in `examples/` are checked in on purpose, so people can open them without building. Rebuild them after any kit change.

## Writing the docs

`SKILL.md` and `references/` follow the user's global writing rules: plain words, short sentences, one name for one thing, and no idioms. The text inside the figures follows the same style (the explain-clear skill), with budgets in `references/style.md`, section 10.

## Testing the skill (blind test)

To check that a change still generalizes, start a fresh general-purpose agent with one prompt from `evals/evals.json`. Tell it to load the `unfold` skill, build in a scratch folder, edit nothing under `~/.Codex/skills/`, and report friction points. The 2026-10-15 run (gradient descent, git rebase) passed, and its 28 friction points were fixed.

## Known limits

- At 390 px, text that a figure draws itself is very small. Cell numbers and bar values hide by themselves (unless `keep: true`). `function-call`, `dijkstra`, `backprop`, `tcp-handshake` and `regex-nfa` use the kit's narrow layout (`stageHtml({ narrow })`). `attention-head`, `btree-insert` and `event-loop` do not have one yet. In `tcp-handshake`, the 10-digit numbers in the sequence strips are about 6 px at 390 px.
- `regex-nfa` takes the reader's input string, but not their own pattern: the graph layout is placed by hand for `a(b|c)*d`.
- `dijkstra` and `backprop` both draw a node-link graph by hand. By the kit rule, a shared helper is now due, but the shared part is not found yet.
- The event-loop simulator supports only one 0 ms timer, and it does not model rendering.
- `revealCss` entrances replay each time a scene opens. They do not replay when the user picks a different focus item.
