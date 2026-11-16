#!/bin/sh
# Adds the dissolve MCP server to Claude Code.
# Usage: curl -fsSL https://dissolve.rselmi.com/mcp.sh | sh
# The server is the npm package react-native-dissolve-mcp, run with npx, so it stays up to date.
set -e
if command -v claude >/dev/null 2>&1; then
  claude mcp add dissolve -- npx -y react-native-dissolve-mcp
  echo "dissolve MCP server added to Claude Code."
else
  echo "Claude Code not found. Register the server in your agent with: npx -y react-native-dissolve-mcp"
fi
