#!/bin/sh
# usage: run.sh <order-dir> <tag>   (runs agy inside the order folder, same flags as the 2026-10-15 run)
cd "$1" || exit 1
agy -p "$(cat prompt.md)" --model gemini-3.8-flash-high --disable-slash-commands --sandbox --dangerously-skip-permissions --json-schema ../schema.json --output-format json --print-timeout 900s > "../$2.json" 2> "../$2.err"
echo "$2 exit $?"
