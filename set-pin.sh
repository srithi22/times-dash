#!/bin/bash
# Sets the Times Dash family PIN and publishes it.
# Only a hash of the PIN goes into index.html; the PIN itself is never saved.
set -e
cd "$(dirname "$0")"

read -rsp "New 4-digit family PIN: " p; echo
[[ "$p" =~ ^[0-9]{4}$ ]] || { echo "The PIN must be exactly 4 digits."; exit 1; }
read -rsp "Type it again: " p2; echo
[ "$p" = "$p2" ] || { echo "Those didn't match. Nothing changed."; exit 1; }

h=$(printf 'timesdash:%s' "$p" | shasum -a 256 | cut -d' ' -f1)
sed -i '' "s/^const PIN_HASH = '.*';/const PIN_HASH = '$h';/" index.html
grep -q "const PIN_HASH = '$h';" index.html || { echo "Couldn't update index.html."; exit 1; }

git commit -qam "Update family PIN"
git push -q
echo "Done. The PIN is set and published. It goes live in about a minute."
