# Reinforcement learning: narration script

One section per scene, in scene order, one sentence per line. The build reads this file, and each section becomes
the voice of that scene. A changed section records a new clip. Numbers are for the starting run (seed 24,
alpha 0.5, gamma 0.9, epsilon 0.2).

A line may start with a cue in brackets, for example [goal]. While the voice says that line, the figure lights
what the line talks about. The cues are defined in build.mjs, in CUES.

## 1. Loop

How does a program learn to act, when nobody tells it the right answer?
[agent] In reinforcement learning, an agent picks an action.
[env] The world answers with a new state and a reward.
[back] Then the agent acts again, and the loop goes on.
The agent wants one thing: as much reward as it can get.

## 2. World

[grid] Here is a small world: 11 cells, and the agent starts at the bottom left.
[moves] In each cell, it can move up, right, down or left.
[goal] The top right cell gives a reward of plus 1.
[pit] The cell under it gives minus 1, and every other move gives 0.
[q] The agent keeps four numbers per cell, one for each move, called Q values, and they all start at 0.

## 3. Episode

[walk] Now the agent walks, from the start to an end cell, and we call one such walk an episode.
[walk] It knows nothing yet, so its moves are random.
[zero] Look at the Q values: after 7 moves, they are all still 0, because no move gave a reward.
[you] You can click a cell next to the agent to make the move yourself.
So what happens when it reaches the goal?

## 4. Return

[last] On move 8, the agent steps into the goal and gets plus 1.
[bars] What was each earlier move worth? We call that its return.
[bars] It is the reward, times 0.9, the factor gamma, once for each move before it.
[first] So the last move is worth 1, and the first move only 0.48, so short paths are worth more.

## 5. Update

Q-learning does not wait for the end of an episode.
[target] After each move, it guesses the return: the reward plus 0.9 times the best Q value ahead.
[target] Here the guess is 1, because the goal ends the episode.
[new] Then it moves the old Q value halfway to the guess, from 0 to 0.5.
[new] It is the first Q value that is not 0, right next to the goal.

## 6. Learn

[spread] Now the agent plays 29 more episodes, and values spread back from the goal.
[explore] It mostly takes its best move, but 1 move in 5 is random, so it keeps exploring.
[hist] The episodes get shorter, down to about 5 moves.
[start] At the end, the start cell is worth 0.66, that is 0.9 to the power 4.
That is the value of the shortest path: 5 moves.

## 7. Policy

[arrows] The policy is simple: in each cell, take the move with the biggest Q value.
[check] To check it, we solve the same grid exactly, with value iteration.
[check] The learned moves match the exact best moves in 8 of the 9 cells.
[tie] One cell is still a tie: all four of its values are still 0.
And nobody showed the agent the path: it found it from rewards alone.
