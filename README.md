# unfold

`unfold` is a [Claude Code](https://claude.com/claude-code) skill. It builds interactive explainer figures for software and math ideas: attention, B-trees, the event loop, Dijkstra, backprop, TCP, regex engines and more.

The style combines 3Blue1Brown and Welch Labs:

- The figure draws the real structure of the idea (vectors, matrices, trees, graphs, timelines). It does not use a machine metaphor.
- Every number on screen comes from a small truth model (`model.mjs`) with asserts. You can check the numbers by hand.
- Each concept has one colour, everywhere in the figure.
- Math is shown in MathML next to the shapes.
- Scenes morph from the big picture down to single values.
- The reader does the operation (insert, search, step, send, match) on their own input.
- Optional recorded narration per scene, in sync with the figure.

The output is one standalone HTML page. It has no runtime dependencies.

## Examples

Each folder in `examples/` has the truth model, the build script and the built pages. Clone the repo and open any `.html` file in a browser.

| Example | What the reader does | Scenes |
|---|---|---|
| [`attention-head`](examples/attention-head/) | Edits one row of X and sees the whole self-attention head recompute | 6 |
| [`btree-insert`](examples/btree-insert/) | Picks a key and follows the search path; watches splits and promotions | 7 |
| [`event-loop`](examples/event-loop/) | Steps through the JavaScript event loop that prints A D C B | 5 |
| [`function-call`](examples/function-call/) | Compares one call in six languages: frames, bytecode, stack depth | 7 |
| [`dijkstra`](examples/dijkstra/) | Clicks a source node, edits edge weights, reruns Dijkstra | 6 |
| [`backprop`](examples/backprop/) | Takes gradient steps on a 2-2-1 network and watches the loss | 7 |
| [`tcp-handshake`](examples/tcp-handshake/) | Types the ISNs and payload; every seq and ack number follows | 7 |
| [`regex-nfa`](examples/regex-nfa/) | Types an input string and steps the Thompson NFA for `a(b\|c)*d` | 6 |
| [`google-search`](examples/google-search/) | Follows a query through crawl, inverted index, BM25 and PageRank on 6 pages | - |

Each example has a dark page (`<name>.html`) and a light page (`<name>-light.html`).

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node.js 20.10 or later
- Google Chrome or Chromium, for the screenshot checks (`scripts/shoot.mjs`)
- The [`anatomy`](https://github.com/wheresryan22/anatomy) skill, installed at `~/.claude/skills/anatomy`. unfold reuses its card, iso camera, theme tokens and screenshot scripts. It was tested at anatomy commit `689dcf9`.

There is no `package.json` and nothing to `npm install`.

## Install

1. Install the anatomy skill:

   ```bash
   git clone https://github.com/wheresryan22/anatomy ~/.claude/skills/anatomy
   ```

2. Install unfold:

   ```bash
   git clone https://github.com/xafold/unfold ~/.claude/skills/unfold
   ```

   If you want to edit the skill, clone it somewhere else and link it instead:

   ```bash
   git clone https://github.com/xafold/unfold ~/code/unfold && ln -s ~/code/unfold ~/.claude/skills/unfold
   ```

3. Check that the kit runs:

   ```bash
   cd ~/.claude/skills/unfold/examples/btree-insert && node model.mjs && node build.mjs
   ```

   You see `model ok`, and `btree-insert.html` is written again.

4. Start Claude Code again. Type `/` and you see `unfold` in the skill list.

If anatomy is in another folder, set `ANATOMY_DIR` to that folder.

## Use

Ask Claude Code for a figure. You can call the skill by name:

```text
/unfold B-tree insert
/unfold --no-voice how git rebase rewrites commits
```

Or ask in plain words. The skill starts by itself when the request fits:

```text
Make me an interactive explainer of gradient descent for my ML course notes.
Use a 1-D loss and show a learning rate that is too small, about right and too big.
```

```text
explain git rebase vs merge visually for our team wiki. show the commit graph changing.
```

### Options

| Option | Result |
|---|---|
| `--voice` (default) | Claude writes a narration script (`script.md`). You approve it. Then each scene is recorded with a TTS provider, and the figure follows the voice. |
| `--no-voice` | No narration. Each scene gets a short text in the card instead. "no audio" or "text only" in the request means the same thing. |

### Narration providers

With `--voice`, Claude asks which provider to use. Set the key in your shell profile before you start Claude Code. Do not paste a key into the chat.

| Provider | Key | Default voice |
|---|---|---|
| Gemini | `GEMINI_API_KEY` | `Kore` |
| OpenAI | `OPENAI_API_KEY` | `coral` |
| ElevenLabs | `ELEVENLABS_API_KEY` | George |

With no key, the page uses the browser's built-in voice. The clips are cached as MP3 files next to the page, so a rebuild needs no key.

### What Claude does

1. Picks the concept shape (structure, process, sequence in time, transform of numbers, and so on).
2. Writes `model.mjs`: the real computation, with asserts.
3. Writes `build.mjs`: the scenes, built with `kit/concept-kit.mjs`.
4. Builds dark and light pages.
5. Takes screenshots of every scene in dark, light, 390 px and reduced motion, and reads them.
6. Checks the text budget of the page.

## Build an example by hand

Run these from an example folder, for example `examples/dijkstra/`:

```bash
node model.mjs
```

```bash
node build.mjs
```

```bash
node build.mjs --light
```

```bash
node build.mjs --artifact /tmp/dijkstra-artifact.html
```

```bash
node ../../scripts/shoot.mjs dijkstra.html --scenes 6 --out /tmp/dijkstra-shots
```

```bash
node ../../scripts/words.mjs dijkstra.html
```

What each command does:

1. `node model.mjs` runs the truth model asserts. It prints `model ok`.
2. `node build.mjs` writes the dark page.
3. `node build.mjs --light` writes the light page.
4. `node build.mjs --artifact <path>` writes a page for a claude.ai Artifact. It follows the viewer's theme.
5. `shoot.mjs` captures every scene. It fails on console errors, sideways scroll, overlapping text, or an equation that is too wide.
6. `words.mjs` checks the reader text against its budget. It prints `words ok`.

Some models check against real tools. `function-call` runs python3, node, ruby, gcc, java and rustc. `dijkstra` checks against networkx when it is installed. A missing tool is skipped with a message.

## Repository layout

| Path | What it is |
|---|---|
| `SKILL.md` | The skill: the core idea, the workflow, the kit API and the checks. Claude Code loads this file. |
| `references/` | Style rules, the concept shapes, and how scenes and animation work. |
| `kit/concept-kit.mjs` | The kit: forms, scenes, page runtime, CSS and page output. |
| `scripts/` | `shoot.mjs` (screenshot checks) and `words.mjs` (text budget). |
| `examples/` | Finished figures with their models and build scripts. |
| `evals/evals.json` | Test prompts, one per concept shape. |
| `benchmarks/` | Blind A/B tests against pages made without the skill. See [`benchmarks/README.md`](benchmarks/README.md). |
| `drafts/` | Figures in progress. |

## Benchmarks

Each benchmark gives the same prompt to a builder with unfold and a builder without it. A Gemini judge scores both pages blind, with the order swapped. Highlights:

| Prompt | unfold /80 | Baseline /80 |
|---|---|---|
| Regex NFA | 78.50 | 38.00 |
| Dijkstra | 79.00 | 62.00 |
| TCP handshake | 77.75 | 58.75 |
| Function call in all languages | 77.75 | 63.50 |

Not every test is a win. Fourier and DNS lost. The full table, with losses, is in [`benchmarks/README.md`](benchmarks/README.md).

## Known limits

- At 390 px, small text that the figure draws is hard to read. `attention-head`, `btree-insert` and `event-loop` do not have a narrow phone layout yet.
- `regex-nfa` takes your input string, but not your own pattern.
- The event-loop simulator supports only one 0 ms timer, and it does not model rendering.
- Stack depths in `function-call` were measured on Linux x86-64. On another machine, measure them again.

## License

MIT, as declared in `SKILL.md`.
