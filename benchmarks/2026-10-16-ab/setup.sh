#!/bin/sh
# usage: setup.sh <slug>   builds judge/<slug>/order1 (unfold = B) and order2 (unfold = A). Runs nothing.
set -e
AB=$(cd "$(dirname "$0")" && pwd); S=$1; J=$AB/judge/$S
REQ=$(grep "^$S	" $AB/prompts.tsv | cut -f2-)
[ -n "$REQ" ] || { echo "unknown slug: $S (see prompts.tsv)"; exit 1; }
mkdir -p $J; cp $AB/schema.json $J/
for o in order1 order2; do
  if [ $o = order1 ]; then a=baseline; b=unfold; else a=unfold; b=baseline; fi
  rm -rf $J/$o; mkdir -p $J/$o/A $J/$o/B
  cp $AB/$S/$a/page.html $J/$o/A/; cp $AB/$S/$a/shots/shot-*.png $J/$o/A/
  cp $AB/$S/$b/page.html $J/$o/B/; cp $AB/$S/$b/shots/shot-*.png $J/$o/B/
  awk -v r="$REQ" '{gsub("__REQUEST__", r)}1' $AB/prompt.tmpl > $J/$o/prompt.md
done
echo "ready: $J"
