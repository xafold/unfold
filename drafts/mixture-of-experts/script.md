# Mixture of experts: narration script

One section per scene, in scene order, one sentence per line. The build reads this file, and each section becomes
the voice of that scene. A changed section records a new clip. Numbers in the script are for the starting numbers,
and the script says so.

A line may start with a cue in brackets, for example [seven]. While the voice says that line, the figure lights
what the line talks about. The cues are defined in build.mjs, in CUES.

## 1. Overview

[x] A big language model is slow if every token uses all of its weights.
[experts] A mixture of experts splits one big layer into several small ones, called experts.
[router] A small router reads each token, and sends it to only a few of them.
[seven] With the starting numbers, the token "7" goes to expert 2 and expert 4.
These numbers are set by hand, so the pattern is easy to see.

## 2. Score

[x] So how does the router choose?
[wr] It keeps one column of numbers for each expert.
[h] It multiplies the token's row by each column, and that gives one score per expert.
[seven] With the starting numbers, "7" gets 2.3 for expert 2, and much less for the others.
A big score means that this expert fits this token.

## 3. Top k

[keep] Next, the router keeps only the best 2 scores in each row.
[drop] It drops the others, so those experts never run for that token.
[load] Here is the saving: each token uses 2 experts, and not all 4.
[load] Now look at the counts below.
[load] With the starting numbers, expert 4 gets 4 tokens, and expert 3 gets only 1.

## 4. Weights

[g] The scores that are left become weights.
[row] Softmax does that: the weights in a row are positive, and they add up to 1.
[seven] With the starting numbers, "7" gives 0.85 to expert 2, and 0.15 to expert 4.
[zero] A dropped expert gets a weight of exactly 0.

## 5. Experts

[kept] Now the chosen experts do their work.
[kept] Each one multiplies the token's row by its own matrix, and gives back a new row.
[pair] Notice that the two experts give different answers for the same token.
[off] The other experts do nothing for this token, and that is the work we save.

## 6. Mix

Last step.
[weigh] We multiply each expert's answer by its weight.
[sum] Then we add the rows, and the sum is the output of the layer for this token.
[big] With the starting numbers, most of it comes from expert 2.
That is a mixture of experts: many experts in the model, and only a few at work for each token.
