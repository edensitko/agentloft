#!/bin/sh
# Runs Agentloft in the background on Linux (systemd user service) and starts it again at login.
#   scripts/install-linux.sh            install and start
#   scripts/install-linux.sh uninstall  stop and remove
set -eu
UNIT="$HOME/.config/systemd/user/agentloft.service"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ "${1:-}" = "uninstall" ]; then systemctl --user disable --now agentloft 2>/dev/null || true; rm -f "$UNIT"; systemctl --user daemon-reload; echo "Agentloft was removed."; exit 0; fi
NODE="$(command -v node || true)"; [ -n "$NODE" ] || { echo "node was not found on PATH. Install Node.js 22 or newer first." >&2; exit 1; }
[ -d "$ROOT/node_modules/three" ] || { echo "Dependencies are missing. Run 'npm install' in $ROOT first." >&2; exit 1; }
mkdir -p "$(dirname "$UNIT")"
cat > "$UNIT" <<UNIT
[Unit]
Description=Agentloft
[Service]
ExecStart="$NODE" "$ROOT/server/index.js"
WorkingDirectory=$ROOT
Environment=PORT=${PORT:-4455}
Restart=on-failure
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload; systemctl --user enable --now agentloft
echo "Agentloft is running at http://localhost:${PORT:-4455} and will start at login."
