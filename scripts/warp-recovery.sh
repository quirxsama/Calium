#!/usr/bin/env bash
set -euo pipefail

# Restart the WARP daemon itself (not just re-register). A re-registration
# leaves a wedged tunnel driver in place; a full daemon restart clears it.
if ! command -v warp-cli >/dev/null 2>&1; then
  echo "[warp-recovery] warp-cli not found" >&2
  exit 1
fi

echo "[warp-recovery] restarting warp-svc"
systemctl restart warp-svc
warp-cli --accept-tos connect >/dev/null 2>&1 || true

for _ in $(seq 1 30); do
  if warp-cli --accept-tos status 2>/dev/null | grep -qE 'Status update: Connected|^Connected$'; then
    echo "[warp-recovery] warp-svc connected"
    exit 0
  fi
  sleep 1
done

echo "[warp-recovery] warp-svc did not report Connected within 30s" >&2
warp-cli --accept-tos status 2>&1 >&2 || true
exit 1
