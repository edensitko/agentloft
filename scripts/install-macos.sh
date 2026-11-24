#!/bin/sh
# Runs Agentloft in the background on macOS and starts it again at login.
#   scripts/install-macos.sh            install and start
#   scripts/install-macos.sh uninstall  stop and remove
set -eu
LABEL="com.agentloft"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${1:-}" = "uninstall" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Agentloft was removed from the login items."
  exit 0
fi

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "node was not found on PATH. Install Node.js 22 or newer first." >&2; exit 1; }
[ -d "$ROOT/node_modules/three" ] || { echo "Dependencies are missing. Run 'npm install' in $ROOT first." >&2; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$ROOT/server/index.js</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key><dict><key>PORT</key><string>${PORT:-4455}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/agentloft.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/agentloft.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Agentloft is running at http://localhost:${PORT:-4455} and will start at login."
echo "Log: $HOME/Library/Logs/agentloft.log"
