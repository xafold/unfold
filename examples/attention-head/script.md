# Attention head: narration script

One section per scene, in scene order, one sentence per line. The build reads this file, and each section becomes
the voice of that scene. A changed section records a new clip. Numbers in the script are for the starting numbers,
and the script says so.

A line may start with a cue in brackets, for example [satcat]. While the voice says that line, the figure lights
what the line talks about. The cues are defined in build.mjs, in CUES.

## 1. Overview

[words] Take the sentence "the cat sat on the mat".
[sat] When a model reads the word "sat", how can it know who did the sitting?
[flow] One attention head lets each word look back at the words before it, and take what it needs.
A trained model learns this. Here the numbers are set by hand, so the pattern is easy to see.

## 2. Embed

[rows] First, each word becomes a row of 4 numbers.
[rows] That row is the word's embedding, plus a little extra for its position in the sentence.
[the] Look at the two rows for "the".
[the] It is the same word in two places, so the two rows are not the same.

## 3. Project

[w] Next, each row is multiplied by three different matrices.
[qkv] That gives every word three new vectors: a query, a key, and a value.
[q] The query asks: what am I looking for?
[k] The key says: this is what I have.
[v] And the value is what the word passes on.

## 4. Score

[qk] To see how well two words match, we take the dot product of a query and a key.
[s] Then we divide it by the square root of 3, to keep the scores small.
[s] A big score means a good match.
[satcat] With the starting numbers, "sat" matches "cat" best, with a score of 1.4.
[mask] And a word can only look back, so every score above the diagonal is blocked.

## 5. Softmax

[a] Scores can be any size, so we turn each row into shares.
[row] That is what softmax does: the weights are all positive, and they add up to 1.
[satcat] With the starting numbers, "sat" gives 0.67 of its attention to "cat".
[mask] A blocked score gets a weight of exactly 0.

## 6. Mix

Last step.
[weigh] "sat" takes the value of each word it can see, multiplies it by its weight, and adds them all up.
[cat] Most of the result comes from "cat".
[sum] So the new vector for "sat" now carries a piece of "cat".
That is attention: each word builds its new meaning from the words it looks at.
