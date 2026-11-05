#!/bin/bash
# usage: run.sh <id> <skill|base>
B=$(dirname "$(readlink -f "$0")"); id=$1; side=$2
P=$(awk -F'\t' -v k="$id" '$1==k{print $2}' "$B/prompts.tsv")
D="$B/$side-$id"; mkdir -p "$D"; cd "$D"
if [ "$side" = skill ]; then
  claude -p "$P Use the unfold skill. Build in this folder." --model claude-opus-5-5 --permission-mode auto --output-format json > ../$side-$id.log.json 2> ../$side-$id.err
else
  claude -p "$P" --model claude-opus-5-5 --permission-mode auto --disable-slash-commands --output-format json > ../$side-$id.log.json 2> ../$side-$id.err
fi
echo "exit $?" >> ../$side-$id.err
