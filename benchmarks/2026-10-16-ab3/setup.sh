#!/bin/sh
# usage: [ARM=ab2] [SUFFIX=flash] setup.sh <slug>   builds judge/<slug>/order1 (unfold = B) and order2 (unfold = A). Runs nothing.
# The unfold page comes from this folder (ARM=ab2: the ab2 unfold page, judged in judge/<slug>-ab2 as a control). The baseline page is the ab2 one, unchanged. No screenshots: the judge drives the pages.
set -e
AB=$(cd "$(dirname "$0")" && pwd); S=$1; J=$AB/judge/$S${ARM:+-$ARM}${SUFFIX:+-$SUFFIX}
REQ=$(grep "^$S	" $AB/prompts.tsv | cut -f2-)
[ -n "$REQ" ] || { echo "unknown slug: $S (see prompts.tsv)"; exit 1; }
UNFOLD=$AB/$S/unfold/page.html; [ "$ARM" = ab2 ] && UNFOLD=$AB/../2026-10-16-ab2/$S/unfold/page.html; BASE=$AB/../2026-10-16-ab2/$S/baseline/page.html
DRIVER=$HOME/.claude/skills/anatomy/scripts/drive.mjs
mkdir -p $J; cp $AB/schema.json $J/
for o in order1 order2; do
  if [ $o = order1 ]; then a=$BASE; b=$UNFOLD; else a=$UNFOLD; b=$BASE; fi
  rm -rf $J/$o; mkdir -p $J/$o/A $J/$o/B
  cp $a $J/$o/A/page.html; cp $b $J/$o/B/page.html
  awk -v r="$REQ" -v d="$DRIVER" '{gsub("__REQUEST__", r); gsub("__DRIVER__", d)}1' $AB/prompt.tmpl > $J/$o/prompt.md
done
echo "ready: $J"
