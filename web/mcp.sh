#!/bin/sh
# Installs the dissolve MCP server for Claude Code.
# Usage: curl -fsSL https://dissolve.rselmi.com/mcp.sh | sh
set -e
BASE="${DISSOLVE_BASE:-https://dissolve.rselmi.com}"
DIR="$HOME/.dissolve"
mkdir -p "$DIR"
curl -fsSL "$BASE/mcp/server.mjs" -o "$DIR/server.mjs"
if command -v claude >/dev/null 2>&1; then
  claude mcp add dissolve -- node "$DIR/server.mjs"
  echo "dissolve MCP server added to Claude Code."
else
  echo "Saved to $DIR/server.mjs. Register it with: claude mcp add dissolve -- node $DIR/server.mjs"
fi
