# Vocabulary: concept shapes and their forms

Find the shape of the concept first. Then draw its native form. A figure usually needs one to three forms. Each entry says what to draw, what moves, what the reader selects, what the reader does (the verb, rule 2 in `SKILL.md`), and which kit helper exists today.

## Route to anatomy first

Use the anatomy skill, not this one, when:

- the concept is a physical machine (an engine, a lock, a printer), or
- the concept is about discrete things flowing through something with capacity or state: a queue, a connection pool, a rate limiter, a cache hit and miss, back-pressure.

A machine metaphor works there because the reader already knows the machine. Everything else (math on representations, structures, protocols, algorithms) belongs here.

## Canonical pictures first

Some topics have one picture that every textbook and video uses. The reader expects it. If the topic has one, show it in at least one scene, with real values from the model. Then add the concept shape below for the part the canonical picture does not show. In the 2026-10-16 blind test, unfold lost Fourier (no epicycles) and DNS (no server tree) to pages that had the canonical picture.

| Topic | Canonical picture |
|---|---|
| Fourier series, DFT | rotating circles (epicycles) whose tip draws the partial sum, next to the spectrum bars |
| DNS lookup | the server tree (root, TLD, authoritative), with the query path on it and cached steps marked |
| TCP handshake, any protocol | a message sequence chart: two vertical lifelines, arrows sloping down between them (`examples/tcp-handshake/`) |
| Dijkstra, BFS, shortest paths | a node-link graph with edge weights, the frontier, and a distance table |
| Gradient descent | a loss curve or contour map, with the steps as dots and arrows on it |
| Hash table | an array of buckets, with keys falling into slots and a chain for a collision |
| Binary search | a sorted array, with low, mid and high pointers that close in |
| Merge sort, quicksort | the array split into a tree of halves, then merged back level by level |
| Backpropagation | the computation graph, with values forward and gradients flowing back on the same edges |
| Convolution | a kernel window that slides over the input grid, writing one output cell at a time |
| Git branches, rebase | the commit graph, time left to right, with branch labels as pointers |
| Unit circle, sine, cosine | a point that turns on the circle, with its projections traced as waves |

If the topic is not in this table, ask: what does the first image search result for this topic show? If many sources agree on one picture, use it.

## 1. Transform of numbers

Examples: attention, matrix multiply, convolution, a neural layer, normalisation, softmax, a hash function's mixing.

- **Draw:** `cellGrid` for matrices and vectors (a vector is a 1-row grid). `tensorBlock` for the overview. `bars` for one distribution.
- **Moves:** matrices slide into the falling layout, a transpose moves each cell, a result fills in, a row lights up.
- **Select:** one row (one token, one sample). Outline it in every grid with `mark`.
- **Readout:** the arithmetic of one cell.
- **Reader does:** edits an input row or a weight, and every result grid recomputes. For a network that learns, takes one more training step and watches the loss history.
- **Kit:** `cellGrid`, `tensorBlock`, `bars`, `setGrid`, `setBars`, `mark`. Examples: `examples/attention-head/`, `examples/backprop/` (a computation graph with gradients flowing back on the same edges).

## 2. Points in a space

Examples: embeddings, nearest neighbours, k-means, consistent hashing (a ring), locality-sensitive hashing, a linear map.

- **Draw:** a 2D plane with a light grid and two named axes, points as small dots in their hue, labels next to the important points only. A ring for hash spaces. For a linear map, draw the grid itself and let it transform (3Blue1Brown).
- **Moves:** points glide to new positions, a query point drops in, distances draw as lines, regions fill.
- **Select:** one point. Show its neighbours and their distances.
- **Readout:** the distance or similarity, with its formula.
- **Reader does:** drags a query point or picks one, and the neighbours and distances update.
- **Truth:** if the real space has more than 2 dimensions, project it with a stated method (PCA, or two chosen axes) and say so in the caption.
- **Kit:** no helper yet. Use plain SVG `<circle>`, `<line>`, `<text>` with the `.u-*` CSS tokens, and `arrow`.

## 3. Structure

Examples: B-tree, trie, heap, linked list, git commit graph, dependency graph, a parse tree, a neural network's layers.

- **Draw:** nodes as rounded rectangles (or chips) holding their real content; edges as short straight or gently curved lines that end on the node outlines. A fixed, hand-computed layout (layers top to bottom, or time left to right for git). No force layout.
- **Moves:** a node splits, an edge re-points, a new node fades in where it will stay, a subtree slides.
- **Select:** one node or one path. Light the path from the root.
- **Readout:** the comparison or pointer that decides the next step.
- **Reader does:** types a key and inserts it, finds it, or deletes it, in the structure itself. The structure keeps the reader's keys, so the next insert builds on them. A reset returns to the preset.
- **Kit:** `chip` with a small `rx` for keys and nodes, `placeCss` to move them, and `morphPath` for links that follow moving nodes. Lay the structure out in `build.mjs` from the model's snapshot (leaves left to right, parents centred over their children). Example: `examples/btree-insert/`.

## 4. Sequence in time

Examples: the event loop, a TCP handshake, Raft or Paxos, async/await, a cache-coherence protocol, request tracing.

- **Draw:** swimlanes, one per actor (thread, server, queue), time running left to right or top to bottom. Messages are arrows between lanes, at the time they are sent and received.
- **Moves:** a cursor sweeps time; a message travels along its arrow; a lane's state chip changes.
- **Select:** one message or one moment. Show the state of every lane at that moment.
- **Readout:** the time and the state change.
- **Reader does:** sends their own message (a payload size, a start number, a delay) and steps it through every lane by hand.
- **Kit:** `lanes(L)` draws the lane labels, rows, time ticks and a "now" line; `span(L, { lane, from, to, text, hue })` is a bar in one lane, on the same scale; `showSpans(root, t)` (page runtime) grows every span up to time `t` and moves the "now" line. Use `arrow` for messages and `chip` for states. Example: `examples/event-loop/`.

## 5. States

Examples: a TCP state machine, a regex engine, a parser, a lexer, a protocol's states.

- **Draw:** states as chips on a fixed layout, transitions as curved arrows with the input that triggers them as a small label at the arrow's middle.
- **Moves:** the current state lights up; the input tape (a row of chips) advances one symbol at a time.
- **Select:** one input symbol, or one step.
- **Reader does:** types their own input string and steps the machine through it. The run length follows the input (`UNFOLD.timeAt(t, steps)`).
- **Kit:** `chip` for states, `arrow` for transitions, `morphPath` if the layout changes between scenes. Example: `examples/regex-nfa/`.

## 6. Function or landscape

Examples: gradient descent, a loss surface, learning rate, a hash's distribution, big-O growth, sampling temperature.

- **Draw:** a plotted curve on named axes, or a surface in the iso camera (a grid of heights drawn as a mesh of lines, painted back to front). A point or ball on it.
- **Moves:** the point steps; a tangent line or gradient arrow updates; a parameter slider reshapes the curve.
- **Select:** one parameter value (a slider, or arrow keys).
- **Readout:** the value, the slope and the step.
- **Reader does:** picks the start point (a drag or a field) and the parameter, then takes one more step, again and again, with the trail of past steps on the curve.
- **Kit:** `plot({ x, y, w, h, xr, yr, f, xTicks, yTicks, xName, yName, hue, tickLabel })` draws the axes, ticks, names and the curve, and returns `at(x, y)` to place the point, the tangent and the step arrows on the same scale. A table of iterations is a set of one-column `cellGrid`s (`dims: false`) with `showRows(grid, t)`. For a surface, use `iso.iso` to project points.

## 7. Memory layout

Examples: pointers, a stack frame, page tables, UTF-8, struct padding, tokenization into bytes, a hash table's buckets.

- **Draw:** byte strips (a 1-row `cellGrid` with `places: 0`, or chips) with addresses under them in small mono. Pointers as arrows from a cell to the cell they point at.
- **Moves:** bytes fill in, a pointer re-points, a strip splits into fields.
- **Select:** one byte or one field. Show its bits or its meaning in the readout.
- **Reader does:** types their own value (a string, a number, an address) and every byte and bit updates.
- **Kit:** `cellGrid` (values as numbers), `chip`, `arrow`.

## 8. Process on a structure

Examples: sorting, binary search, BFS and DFS, Dijkstra, merge, a garbage collector's mark phase, git rebase.

- **Draw:** the structure in its own form (1 to 7), plus a cursor (a lit outline) and the working set (a queue or stack as a row of chips).
- **Moves:** one algorithm step per key press, and a slow tour. Each step changes one thing.
- **Select:** the step number (arrow keys). The scene stepper holds the chapters; up and down step inside one chapter.
- **Readout:** the comparison or decision made in this step.
- **Reader does:** picks the start or the target by clicking it in the drawing (a cell to search for, a source node), changes the input (an edge weight, the array), and steps the run by hand. Show the pseudocode with `codeLines` and light the line that runs.
- **Kit:** the structure's own helpers, plus `codeLines`. Example: `examples/dijkstra/` (a node-link graph, the distance table, the queue, and the line that runs).

## Mixing forms

Use at most three forms in one figure, and give each its own scene or its own region. Keep one hue per concept across forms. The overview scene can use iso blocks for any shape: a block per matrix, a slab per lane, a disc per node.
