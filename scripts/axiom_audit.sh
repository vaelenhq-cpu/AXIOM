#!/data/data/com.termux/files/usr/bin/bash

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT" || exit 1

echo
echo "============================================================"
echo " AXIOM — FULL BACKEND AUDIT"
echo "============================================================"
echo

export PYTHONPATH="$ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"

python "$ROOT/scripts/axiom_audit.py"

EXIT_CODE=$?

echo

if [ "$EXIT_CODE" -eq 0 ]; then
    echo "============================================================"
    echo " AXIOM AUDIT RESULT: READY"
    echo "============================================================"
else
    echo "============================================================"
    echo " AXIOM AUDIT RESULT: NOT READY"
    echo "============================================================"
fi

exit "$EXIT_CODE"
