# B-tree insert: narration script

One section per scene, in scene order. The build reads this file, and each section becomes the voice of that scene.
A changed section records a new clip.

## 1. Sorted

Imagine a million keys stored on a disk, where every read is slow.
How do you find one key with very few reads?
A B-tree's answer: put many sorted keys in each node, so one read brings back many keys at once.
Here, to keep it small, a node holds at most 2 keys.

## 2. Overflow

Let's add 30.
It is bigger than 20, so it goes at the end.
Now the node holds 3 keys, but the limit is 2.
The node is too full. So what do we do?

## 3. Split

We split it in two.
10 gets its own node, and so does 30.
The middle key, 20, moves up and becomes a new root.
Notice this: the tree just grew taller, but it grew at the top, not at the bottom.

## 4. Search

Now add 40.
We start at the root and compare: 40 is bigger than 20, so we go right.
40 lands in the leaf next to 30, and that leaf still has room.

## 5. Promote

Add 50, and that same leaf fills up: 30, 40, 50.
One key too many, again.
So it splits, just like before, and the middle key, 40, moves up next to 20.

## 6. Cascade

Now add 60, and then 70.
The right leaf overflows, splits, and sends 60 up.
But look at the root. It now holds 20, 40 and 60.
That is 3 keys, so now the root is too full.

## 7. Taller

So the root splits too, and 40 becomes the new root.
And here is the nice part. Every leaf is the same distance from the top.
So finding any of these 7 keys takes exactly 3 reads.
With hundreds of keys in each node, a real tree stays this flat, even with millions of keys.
