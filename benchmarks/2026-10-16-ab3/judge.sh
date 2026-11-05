#!/bin/sh
# usage: [ARM=ab2] [SUFFIX=flash] judge.sh <slug> [run-tag]   sets up the blind folders, then runs 2 agy judges (MODEL, default gemini-4-argon-high) in parallel (A/B swapped).
# Each judge drives both pages itself with anatomy's drive.mjs. Results: judge/<slug>/order1-<tag>.json and order2-<tag>.json (tag default run1).
# Score: node score.mjs judge/<slug>. Feedback: node show.mjs judge/<slug>
set -e
AB=$(cd "$(dirname "$0")" && pwd); S=$1; T=${2:-run1}
sh $AB/setup.sh $S
cd $AB/judge/$S${ARM:+-$ARM}${SUFFIX:+-$SUFFIX}
for o in order1 order2; do
  (cd $o && agy -p "$(cat prompt.md)" --model ${MODEL:-gemini-4-argon-high} --disable-slash-commands --sandbox --dangerously-skip-permissions \
    --json-schema ../schema.json --output-format json --print-timeout 1800s > ../$o-$T.json 2> ../$o-$T.err; echo "$S $o exit $?") &
done
wait
